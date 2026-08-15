// Mock RN-only modules so importing databaseService doesn't blow up under Node/Jest.
jest.mock('react-native-sqlite-storage', () => ({
  openDatabase: jest.fn(),
  SQLiteDatabase: class {},
}));
jest.mock('@dr.pogodin/react-native-fs', () => ({
  DownloadDirectoryPath: '/tmp',
  copyFile: jest.fn(),
}));
jest.mock('react-native', () => ({Alert: {alert: jest.fn()}}));

import Database from 'better-sqlite3';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {
  fetchActivitySessions,
  fetchHomeSummary,
  getSetting,
  setSetting,
  fetchProfile,
  saveProfile,
  finishSession,
  fetchTodayKcal,
  fetchKcalTotals,
} from '../src/common/databaseService';
import {estimateKcal, STRENGTH_MET, ACTIVITY_MET} from '../src/common/calories';
import {isoDate} from '../src/components/heatmapMath';
import type {UserProfile} from '../src/common/types';

const schemaSql = readFileSync(
  resolve(__dirname, '../scripts/schema-v2.sql'),
  'utf8',
)
  .split(/\n--[^\n]*/)
  .join('')
  .split(/;\s*\n/)
  .map(s => s.trim())
  .filter(s => s.length > 0);

function makeDb() {
  const raw = new Database(':memory:');
  raw.pragma('foreign_keys = ON');
  for (const stmt of schemaSql) raw.exec(stmt);
  raw.exec(
    `INSERT INTO plans (id, slug, name, description) VALUES (1, 'surf', 'Surf', '5-day plan')`,
  );
  raw.exec(`INSERT INTO settings (key, value) VALUES ('active_plan_id', '1')`);
  raw.exec(
    `INSERT INTO activities (id, slug, name) VALUES
       (1, 'surf', 'Surfing'),
       (2, 'altinha', 'Altinha')`,
  );
  return {
    executeSql: async (sql: string, params: unknown[] = []) => {
      const trimmed = sql.trim();
      if (/^(SELECT|PRAGMA)/i.test(trimmed)) {
        const arr = raw.prepare(sql).all(...(params as never[])) as Record<
          string,
          unknown
        >[];
        return [
          {
            rows: {
              length: arr.length,
              item: (i: number) => arr[i],
              raw: () => arr,
            },
            insertId: 0,
          },
        ];
      }
      const info = raw.prepare(sql).run(...(params as never[]));
      return [
        {
          rows: {length: 0, item: () => null, raw: () => []},
          insertId: Number(info.lastInsertRowid),
        },
      ];
    },
    _raw: raw,
  } as never;
}

const rawOf = (db: never) => (db as {_raw: Database.Database})._raw;

describe('settings helpers', () => {
  it('getSetting returns null for a missing key', async () => {
    const db = makeDb();
    expect(await getSetting(db, 'nope')).toBeNull();
  });

  it('setSetting round-trips and overwrites', async () => {
    const db = makeDb();
    await setSetting(db, 'profile_weight_kg', '80');
    expect(await getSetting(db, 'profile_weight_kg')).toBe('80');
    await setSetting(db, 'profile_weight_kg', '82.5');
    expect(await getSetting(db, 'profile_weight_kg')).toBe('82.5');
  });

  it('getSetting still reads keys written by setActivePlanId-style SQL', async () => {
    const db = makeDb();
    expect(await getSetting(db, 'active_plan_id')).toBe('1');
  });
});

describe('kcal columns', () => {
  it('activity_sessions.kcal survives a fetch round-trip', async () => {
    const db = makeDb();
    rawOf(db).exec(
      `INSERT INTO activity_sessions (activity_id, performed_at, duration_minutes, kcal)
       VALUES (1, '2026-08-05', 90, 455)`,
    );
    const [s] = await fetchActivitySessions(db);
    expect(s.kcal).toBe(455);
  });

  it('sessions.kcal is readable via fetchHomeSummary', async () => {
    const db = makeDb();
    rawOf(db).exec(`INSERT INTO weeks (id, plan_id) VALUES (1, 1)`);
    rawOf(db).exec(
      `INSERT INTO sessions (id, week_id, day_index, session_name, finished, kcal)
       VALUES (10, 1, 1, 'Lower', 1, 303)`,
    );
    const summary = await fetchHomeSummary(db);
    expect(summary!.currentWeek!.sessions[0].kcal).toBe(303);
  });
});

const PROFILE: UserProfile = {
  weightKg: 80,
  heightCm: 180,
  birthYear: 1990,
  sex: 'male',
  sessionMinutes: 60,
};
const YEAR = new Date().getFullYear();

describe('fetchProfile / saveProfile', () => {
  it('returns null when no profile is stored', async () => {
    const db = makeDb();
    expect(await fetchProfile(db)).toBeNull();
  });

  it('returns null while the profile is incomplete', async () => {
    const db = makeDb();
    await setSetting(db, 'profile_weight_kg', '80');
    await setSetting(db, 'profile_height_cm', '180');
    expect(await fetchProfile(db)).toBeNull();
  });

  it('round-trips a saved profile', async () => {
    const db = makeDb();
    await saveProfile(db, PROFILE);
    expect(await fetchProfile(db)).toEqual(PROFILE);
  });

  it('defaults sessionMinutes to 60 when the key is missing', async () => {
    const db = makeDb();
    await setSetting(db, 'profile_weight_kg', '80');
    await setSetting(db, 'profile_height_cm', '180');
    await setSetting(db, 'profile_birth_year', '1990');
    await setSetting(db, 'profile_sex', 'male');
    expect((await fetchProfile(db))!.sessionMinutes).toBe(60);
  });
});

describe('saveProfile backfill (gaps only)', () => {
  it('fills timed activity rows without kcal, per-activity MET', async () => {
    const db = makeDb();
    rawOf(db).exec(
      `INSERT INTO activity_sessions (id, activity_id, performed_at, duration_minutes, kcal) VALUES
         (1, 1, '2026-08-01', 90, NULL),
         (2, 2, '2026-08-02', 60, NULL),
         (3, 1, '2026-08-03', NULL, NULL),
         (4, 1, '2026-08-04', 60, 999)`,
    );
    await saveProfile(db, PROFILE);
    const rows = rawOf(db)
      .prepare(`SELECT id, kcal FROM activity_sessions ORDER BY id`)
      .all() as {id: number; kcal: number | null}[];
    expect(rows[0].kcal).toBe(
      estimateKcal(ACTIVITY_MET.surf, 90, PROFILE, YEAR),
    );
    expect(rows[1].kcal).toBe(
      estimateKcal(ACTIVITY_MET.altinha, 60, PROFILE, YEAR),
    );
    expect(rows[2].kcal).toBeNull(); // untimed stays unknown
    expect(rows[3].kcal).toBe(999); // existing snapshot untouched
  });

  it('fills finished plan sessions with the flat estimate, skips unfinished', async () => {
    const db = makeDb();
    rawOf(db).exec(`INSERT INTO weeks (id, plan_id) VALUES (1, 1)`);
    rawOf(db).exec(
      `INSERT INTO sessions (id, week_id, day_index, session_name, finished, kcal) VALUES
         (10, 1, 1, 'Lower', 1, NULL),
         (11, 1, 2, 'Upper', 0, NULL),
         (12, 1, 3, 'Lower', 1, 777)`,
    );
    await saveProfile(db, PROFILE);
    const rows = rawOf(db)
      .prepare(`SELECT id, kcal FROM sessions ORDER BY id`)
      .all() as {id: number; kcal: number | null}[];
    expect(rows[0].kcal).toBe(estimateKcal(STRENGTH_MET, 60, PROFILE, YEAR));
    expect(rows[1].kcal).toBeNull();
    expect(rows[2].kcal).toBe(777);
  });
});

describe('finishSession kcal snapshot', () => {
  it('writes the flat estimate when a profile exists', async () => {
    const db = makeDb();
    await saveProfile(db, {...PROFILE, sessionMinutes: 75});
    rawOf(db).exec(`INSERT INTO weeks (id, plan_id) VALUES (1, 1)`);
    rawOf(db).exec(
      `INSERT INTO sessions (id, week_id, day_index, session_name) VALUES (10, 1, 1, 'Lower')`,
    );
    await finishSession(db, 10);
    const row = rawOf(db)
      .prepare(`SELECT finished, kcal FROM sessions WHERE id = 10`)
      .get() as {finished: number; kcal: number | null};
    expect(row.finished).toBe(1);
    expect(row.kcal).toBe(
      estimateKcal(STRENGTH_MET, 75, {...PROFILE, sessionMinutes: 75}, YEAR),
    );
  });

  it('writes null without a profile and still cascades the week', async () => {
    const db = makeDb();
    rawOf(db).exec(`INSERT INTO weeks (id, plan_id) VALUES (1, 1)`);
    rawOf(db).exec(
      `INSERT INTO sessions (id, week_id, day_index, session_name) VALUES (10, 1, 1, 'Lower')`,
    );
    await finishSession(db, 10);
    const s = rawOf(db)
      .prepare(`SELECT kcal FROM sessions WHERE id = 10`)
      .get() as {kcal: number | null};
    expect(s.kcal).toBeNull();
    const w = rawOf(db)
      .prepare(`SELECT finished FROM weeks WHERE id = 1`)
      .get() as {finished: number};
    expect(w.finished).toBe(1);
  });
});

describe('kcal aggregates', () => {
  it('fetchTodayKcal sums both sources for the given local day', async () => {
    const db = makeDb();
    const today = isoDate(new Date());
    rawOf(db).exec(
      `INSERT INTO activity_sessions (activity_id, performed_at, duration_minutes, kcal) VALUES
         (1, '${today}', 90, 400),
         (1, '${today}', 30, 100),
         (1, '2020-01-01', 60, 999)`,
    );
    rawOf(db).exec(`INSERT INTO weeks (id, plan_id) VALUES (1, 1)`);
    rawOf(db).exec(
      `INSERT INTO sessions (id, week_id, day_index, session_name, finished, trained_at, kcal) VALUES
         (10, 1, 1, 'Lower', 1, datetime('now'), 300),
         (11, 1, 2, 'Upper', 1, '2020-01-01 10:00:00', 999),
         (12, 1, 3, 'Push', 0, NULL, NULL)`,
    );
    expect(await fetchTodayKcal(db, today)).toBe(800);
  });

  it('fetchTodayKcal returns 0 when nothing is logged', async () => {
    const db = makeDb();
    expect(await fetchTodayKcal(db, isoDate(new Date()))).toBe(0);
  });

  it('fetchKcalTotals sums each source over all time', async () => {
    const db = makeDb();
    rawOf(db).exec(
      `INSERT INTO activity_sessions (activity_id, performed_at, duration_minutes, kcal) VALUES
         (1, '2026-08-01', 90, 400),
         (2, '2026-08-02', NULL, NULL)`,
    );
    rawOf(db).exec(`INSERT INTO weeks (id, plan_id) VALUES (1, 1)`);
    rawOf(db).exec(
      `INSERT INTO sessions (id, week_id, day_index, session_name, finished, kcal) VALUES
         (10, 1, 1, 'Lower', 1, 300),
         (11, 1, 2, 'Upper', 0, NULL)`,
    );
    expect(await fetchKcalTotals(db)).toEqual({
      training: 300,
      activities: 400,
      total: 700,
    });
  });
});

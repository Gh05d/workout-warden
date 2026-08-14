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
} from '../src/common/databaseService';

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

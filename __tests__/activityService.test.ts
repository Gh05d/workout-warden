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
  createActivitySession,
  deleteActivitySession,
  fetchActivities,
  fetchActivityHeatmapData,
  fetchActivitySessions,
  fetchRecentSpots,
  updateActivitySession,
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
    `INSERT INTO activities (id, slug, name) VALUES
       (1, 'surf', 'Surf'),
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

describe('activity CRUD', () => {
  it('creates a session and reads it back joined with activity name', async () => {
    const db = makeDb();
    const id = await createActivitySession(db, {
      activityId: 1,
      performedAt: '2026-08-05',
      durationMinutes: 90,
      spot: 'Uluwatu',
      note: 'offshore, hip high',
    });
    expect(id).toBeGreaterThan(0);
    const list = await fetchActivitySessions(db);
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({
      id,
      activity_id: 1,
      activity_slug: 'surf',
      activity_name: 'Surf',
      performed_at: '2026-08-05',
      duration_minutes: 90,
      spot: 'Uluwatu',
      note: 'offshore, hip high',
    });
  });

  it('lists newest-first and respects fromDate', async () => {
    const db = makeDb();
    await createActivitySession(db, {
      activityId: 1,
      performedAt: '2026-08-01',
      durationMinutes: null,
      spot: null,
      note: null,
    });
    await createActivitySession(db, {
      activityId: 2,
      performedAt: '2026-08-05',
      durationMinutes: 60,
      spot: null,
      note: null,
    });
    const all = await fetchActivitySessions(db);
    expect(all.map(s => s.performed_at)).toEqual(['2026-08-05', '2026-08-01']);
    const windowed = await fetchActivitySessions(db, {fromDate: '2026-08-03'});
    expect(windowed).toHaveLength(1);
    expect(windowed[0].activity_slug).toBe('altinha');
  });

  it('allows two sessions on the same day', async () => {
    const db = makeDb();
    await createActivitySession(db, {
      activityId: 1,
      performedAt: '2026-08-05',
      durationMinutes: 60,
      spot: null,
      note: null,
    });
    await createActivitySession(db, {
      activityId: 1,
      performedAt: '2026-08-05',
      durationMinutes: 45,
      spot: null,
      note: null,
    });
    expect(await fetchActivitySessions(db)).toHaveLength(2);
  });

  it('partially updates only the given fields', async () => {
    const db = makeDb();
    const id = await createActivitySession(db, {
      activityId: 1,
      performedAt: '2026-08-05',
      durationMinutes: 90,
      spot: 'Uluwatu',
      note: null,
    });
    await updateActivitySession(db, id, {
      durationMinutes: 120,
      note: 'long one',
    });
    const [s] = await fetchActivitySessions(db);
    expect(s).toMatchObject({
      duration_minutes: 120,
      note: 'long one',
      spot: 'Uluwatu',
      performed_at: '2026-08-05',
    });
  });

  it('deletes a session', async () => {
    const db = makeDb();
    const id = await createActivitySession(db, {
      activityId: 1,
      performedAt: '2026-08-05',
      durationMinutes: null,
      spot: null,
      note: null,
    });
    await deleteActivitySession(db, id);
    expect(await fetchActivitySessions(db)).toHaveLength(0);
  });

  it('fetchActivities returns the catalogue ordered by id', async () => {
    const db = makeDb();
    const acts = await fetchActivities(db);
    expect(acts).toEqual([
      {id: 1, slug: 'surf', name: 'Surf'},
      {id: 2, slug: 'altinha', name: 'Altinha'},
    ]);
  });
});

describe('fetchActivityHeatmapData', () => {
  it('groups per day and activity, honoring fromDate', async () => {
    const db = makeDb();
    for (const [act, day] of [
      [1, '2026-08-05'],
      [1, '2026-08-05'],
      [2, '2026-08-05'],
      [1, '2026-08-01'],
      [1, '2026-06-01'],
    ] as const) {
      await createActivitySession(db, {
        activityId: act,
        performedAt: day,
        durationMinutes: null,
        spot: null,
        note: null,
      });
    }
    const map = await fetchActivityHeatmapData(db, '2026-07-01');
    expect([...map.keys()]).toEqual(['2026-08-01', '2026-08-05']);
    expect(map.get('2026-08-05')).toEqual([
      {activityId: 1, count: 2},
      {activityId: 2, count: 1},
    ]);
    expect(map.get('2026-08-01')).toEqual([{activityId: 1, count: 1}]);
  });
});

describe('fetchRecentSpots', () => {
  it('groups per activity, most recent first, excluding null spots', async () => {
    const db = makeDb();
    for (const [act, day, spot] of [
      [1, '2026-08-01', 'Uluwatu'],
      [1, '2026-08-03', 'Padang Padang'],
      [1, '2026-08-05', 'Uluwatu'],
      [2, '2026-08-04', 'Praia do Forte'],
      [1, '2026-08-02', null],
    ] as const) {
      await createActivitySession(db, {
        activityId: act,
        performedAt: day,
        durationMinutes: null,
        spot,
        note: null,
      });
    }
    const map = await fetchRecentSpots(db);
    expect(map.get(1)).toEqual(['Uluwatu', 'Padang Padang']);
    expect(map.get(2)).toEqual(['Praia do Forte']);
  });

  it('caps at 8 spots per activity', async () => {
    const db = makeDb();
    for (let i = 1; i <= 10; i++) {
      await createActivitySession(db, {
        activityId: 1,
        performedAt: `2026-07-${String(i).padStart(2, '0')}`,
        durationMinutes: null,
        spot: `Spot ${i}`,
        note: null,
      });
    }
    const map = await fetchRecentSpots(db);
    expect(map.get(1)).toHaveLength(8);
    expect(map.get(1)?.[0]).toBe('Spot 10');
    expect(map.get(1)).not.toContain('Spot 1');
  });

  it('returns an empty map when nothing has a spot', async () => {
    const db = makeDb();
    await createActivitySession(db, {
      activityId: 1,
      performedAt: '2026-08-05',
      durationMinutes: 60,
      spot: null,
      note: null,
    });
    expect((await fetchRecentSpots(db)).size).toBe(0);
  });

  it('breaks a same-day tie toward the newer row', async () => {
    const db = makeDb();
    for (const spot of ['Older Spot', 'Newer Spot']) {
      await createActivitySession(db, {
        activityId: 1,
        performedAt: '2026-08-05',
        durationMinutes: null,
        spot,
        note: null,
      });
    }
    const map = await fetchRecentSpots(db);
    expect(map.get(1)).toEqual(['Newer Spot', 'Older Spot']);
  });

  it('keeps the same spot name separate per activity', async () => {
    const db = makeDb();
    for (const act of [1, 2] as const) {
      await createActivitySession(db, {
        activityId: act,
        performedAt: '2026-08-05',
        durationMinutes: null,
        spot: 'Praia do Forte',
        note: null,
      });
    }
    const map = await fetchRecentSpots(db);
    expect(map.get(1)).toEqual(['Praia do Forte']);
    expect(map.get(2)).toEqual(['Praia do Forte']);
  });
});

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
  fetchActivitySessions,
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

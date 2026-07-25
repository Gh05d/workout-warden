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
import {fetchHeatmapData} from '../src/common/databaseService';

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
    `INSERT INTO plans (id, slug, name, description) VALUES
       (1, 'surf', 'Surf', null),
       (2, 'strength', 'Strength', null)`,
  );
  return {
    executeSql: async (sql: string, params: unknown[] = []) => {
      const trimmed = sql.trim().toUpperCase();
      if (trimmed.startsWith('SELECT') || trimmed.startsWith('PRAGMA')) {
        const stmt = raw.prepare(sql);
        const arr = stmt.all(...params) as Record<string, unknown>[];
        return [
          {
            rows: {
              length: arr.length,
              item: (i: number) => arr[i],
              raw: () => arr,
            },
          },
        ];
      }
      raw.prepare(sql).run(...params);
      return [{rows: {length: 0, item: () => null, raw: () => []}}];
    },
    _raw: raw,
  } as never;
}

// noon timestamps: DATE(x,'localtime') stays on the same calendar day for every
// real timezone offset (|offset| < 12h), so date bucketing is deterministic.
describe('fetchHeatmapData', () => {
  it('returns an empty map when nothing is trained', async () => {
    const db = makeDb();
    const map = await fetchHeatmapData(db, '2026-01-01');
    expect(map.size).toBe(0);
  });

  it('sums sessions of the same plan on one day', async () => {
    const db = makeDb();
    const raw = (db as never as {_raw: Database.Database})._raw;
    raw.exec(`INSERT INTO weeks (id, plan_id) VALUES (1, 1)`);
    raw.exec(
      `INSERT INTO sessions (id, week_id, day_index, session_name, trained_at)
       VALUES (10, 1, 1, 'A', '2026-07-20 12:00:00'),
              (11, 1, 2, 'B', '2026-07-20 12:00:00')`,
    );
    const map = await fetchHeatmapData(db, '2026-01-01');
    expect(map.size).toBe(1);
    expect([...map.values()][0]).toEqual({count: 2, planId: 1});
  });

  it('picks the plan with the most sessions as dominant', async () => {
    const db = makeDb();
    const raw = (db as never as {_raw: Database.Database})._raw;
    raw.exec(`INSERT INTO weeks (id, plan_id) VALUES (1, 1), (2, 2)`);
    raw.exec(
      `INSERT INTO sessions (id, week_id, day_index, session_name, trained_at)
       VALUES (10, 2, 1, 'S', '2026-07-20 12:00:00'),
              (11, 1, 1, 'A', '2026-07-20 12:00:00'),
              (12, 1, 2, 'B', '2026-07-20 12:00:00')`,
    );
    const map = await fetchHeatmapData(db, '2026-01-01');
    // plan 1 has 2 sessions, plan 2 has 1 → dominant is plan 1, total count 3.
    expect([...map.values()][0]).toEqual({count: 3, planId: 1});
  });

  it('breaks a session-count tie toward the lowest plan_id', async () => {
    const db = makeDb();
    const raw = (db as never as {_raw: Database.Database})._raw;
    raw.exec(`INSERT INTO weeks (id, plan_id) VALUES (1, 1), (2, 2)`);
    raw.exec(
      `INSERT INTO sessions (id, week_id, day_index, session_name, trained_at)
       VALUES (10, 2, 1, 'S', '2026-07-20 12:00:00'),
              (11, 1, 1, 'A', '2026-07-20 12:00:00')`,
    );
    const map = await fetchHeatmapData(db, '2026-01-01');
    expect([...map.values()][0]).toEqual({count: 2, planId: 1});
  });

  it('excludes days before fromLocalDate', async () => {
    const db = makeDb();
    const raw = (db as never as {_raw: Database.Database})._raw;
    raw.exec(`INSERT INTO weeks (id, plan_id) VALUES (1, 1)`);
    raw.exec(
      `INSERT INTO sessions (id, week_id, day_index, session_name, trained_at)
       VALUES (10, 1, 1, 'A', '2026-01-15 12:00:00'),
              (11, 1, 2, 'B', '2026-07-20 12:00:00')`,
    );
    const map = await fetchHeatmapData(db, '2026-06-01');
    expect(map.size).toBe(1);
    expect([...map.values()][0]).toEqual({count: 1, planId: 1});
  });
});

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
import {fetchHomeSummary} from '../src/common/databaseService';

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
  raw.exec(
    `INSERT INTO settings (key, value) VALUES ('active_plan_id', '1')`,
  );
  // Adapter so fetchHomeSummary's `db.executeSql` works against better-sqlite3
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

describe('fetchHomeSummary', () => {
  it('returns null when no active plan id is set', async () => {
    const db = makeDb();
    (db as never as {_raw: Database.Database})._raw
      .prepare(`DELETE FROM settings WHERE key = 'active_plan_id'`)
      .run();
    expect(await fetchHomeSummary(db)).toBeNull();
  });

  it('returns plan with null week when no weeks exist', async () => {
    const db = makeDb();
    const summary = await fetchHomeSummary(db);
    expect(summary).not.toBeNull();
    expect(summary!.activePlan.slug).toBe('surf');
    expect(summary!.currentWeek).toBeNull();
    expect(summary!.nextSession).toBeNull();
  });

  it('returns most recent week with first unfinished session as nextSession', async () => {
    const db = makeDb();
    const raw = (db as never as {_raw: Database.Database})._raw;
    raw.exec(`INSERT INTO weeks (id, plan_id) VALUES (1, 1), (2, 1)`);
    raw.exec(
      `INSERT INTO sessions (id, week_id, day_index, weekday_label, session_name, finished)
       VALUES (10, 2, 1, 'Mon', 'Lower', 1),
              (11, 2, 2, 'Tue', 'Upper', 0),
              (12, 2, 3, 'Wed', 'Lower', 0),
              (13, 1, 1, 'Mon', 'Lower', 1)`,
    );
    const summary = await fetchHomeSummary(db);
    expect(summary!.currentWeek!.id).toBe(2);
    expect(summary!.currentWeek!.sessions).toHaveLength(3);
    expect(summary!.nextSession!.id).toBe(11);
    expect(summary!.nextSession!.day_index).toBe(2);
  });

  it('returns null nextSession when current week is fully finished', async () => {
    const db = makeDb();
    const raw = (db as never as {_raw: Database.Database})._raw;
    raw.exec(`INSERT INTO weeks (id, plan_id, finished) VALUES (1, 1, 1)`);
    raw.exec(
      `INSERT INTO sessions (id, week_id, day_index, weekday_label, session_name, finished)
       VALUES (10, 1, 1, 'Mon', 'Lower', 1), (11, 1, 2, 'Tue', 'Upper', 1)`,
    );
    const summary = await fetchHomeSummary(db);
    expect(summary!.currentWeek!.finished).toBe(1);
    expect(summary!.nextSession).toBeNull();
  });

  it('picks lowest day_index when multiple sessions are unfinished', async () => {
    const db = makeDb();
    const raw = (db as never as {_raw: Database.Database})._raw;
    raw.exec(`INSERT INTO weeks (id, plan_id) VALUES (1, 1)`);
    raw.exec(
      `INSERT INTO sessions (id, week_id, day_index, weekday_label, session_name, finished)
       VALUES (10, 1, 3, 'Wed', 'Lower', 0),
              (11, 1, 1, 'Mon', 'Lower', 0),
              (12, 1, 2, 'Tue', 'Upper', 1)`,
    );
    const summary = await fetchHomeSummary(db);
    expect(summary!.nextSession!.day_index).toBe(1);
  });
});

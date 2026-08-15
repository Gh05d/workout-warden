/**
 * Exercises the seed-revision migration against a real SQLite engine.
 *
 * session_templates are write-once, so a device that already seeded a plan keeps
 * its old prescriptions until SEED_REVISION moves ahead of the stored value. The
 * safety property that matters: refreshing templates must never touch recorded
 * training data, which lives in session_exercises/sets (copied at week creation).
 */
import Database from 'better-sqlite3';

let mockRaw: InstanceType<typeof Database>;

// Adapter presenting better-sqlite3 through react-native-sqlite-storage's API.
function mockMakeAdapter() {
  return {
    executeSql: async (sql: string, params: unknown[] = []) => {
      const trimmed = sql.trim();
      if (/^PRAGMA/i.test(trimmed)) {
        mockRaw.pragma(trimmed.replace(/^PRAGMA\s+/i, '').replace(/;$/, ''));
        return [{rows: {length: 0, item: () => undefined}, insertId: 0}];
      }
      if (/^SELECT/i.test(trimmed)) {
        const rows = mockRaw
          .prepare(trimmed)
          .all(params as never[]) as unknown[];
        return [
          {
            rows: {length: rows.length, item: (i: number) => rows[i]},
            insertId: 0,
          },
        ];
      }
      const info = mockRaw.prepare(trimmed).run(params as never[]);
      return [
        {
          rows: {length: 0, item: () => undefined},
          insertId: Number(info.lastInsertRowid),
        },
      ];
    },
  };
}

jest.mock('react-native-sqlite-storage', () => ({
  openDatabase: jest.fn(async () => mockMakeAdapter()),
}));
jest.mock('@dr.pogodin/react-native-fs', () => ({
  DownloadDirectoryPath: '/tmp',
  copyFile: jest.fn(),
  exists: jest.fn(),
}));

const {initDB} = require('../src/common/databaseService');

const {PLANS, SEED_REVISION} = require('../src/seeds');

const SURF2 = PLANS.find((p: {slug: string}) => p.slug === 'surf-2');

/** Prescription rows currently stored for a template slug, in order. */
function storedRows(templateSlug: string) {
  return mockRaw
    .prepare(
      `SELECT e.slug AS exercise_slug, ste.order_index, ste.prescribed_sets,
              ste.prescribed_reps, ste.prescribed_seconds, ste.per_side,
              ste.as_maximum, ste.circuit_index, ste.circuit_rounds, ste.hint
         FROM session_template_exercises ste
         JOIN session_templates st ON st.id = ste.session_template_id
         JOIN exercises e          ON e.id = ste.exercise_id
        WHERE st.slug = ?
        ORDER BY ste.order_index`,
    )
    .all(templateSlug) as Record<string, unknown>[];
}

/** weekday_label stored for a plan's days, by day_index. */
function storedWeekdayLabels(planSlug: string) {
  return mockRaw
    .prepare(
      `SELECT pd.day_index, pd.weekday_label
         FROM plan_days pd
         JOIN plans p ON p.id = pd.plan_id
        WHERE p.slug = ?
        ORDER BY pd.day_index`,
    )
    .all(planSlug) as {day_index: number; weekday_label: string | null}[];
}

function revision(): number {
  const row = mockRaw
    .prepare(`SELECT value FROM settings WHERE key = 'seed_revision'`)
    .get() as {value: string} | undefined;
  return row ? Number(row.value) : 0;
}

beforeEach(() => {
  mockRaw = new Database(':memory:');
});

afterEach(() => {
  mockRaw.close();
});

describe('seed revision migration', () => {
  it('seeds a fresh install and records the revision', async () => {
    await initDB();
    expect(revision()).toBe(SEED_REVISION);
    expect(storedRows('surf2-power-mon').length).toBe(
      SURF2.session_templates.find(
        (t: {slug: string}) => t.slug === 'surf2-power-mon',
      ).exercises.length,
    );
  });

  it('is idempotent — a second run at the same revision changes nothing', async () => {
    await initDB();
    const before = storedRows('surf2-power-mon');
    await initDB();
    expect(storedRows('surf2-power-mon')).toEqual(before);
  });

  it('rewrites stale prescriptions when the stored revision is behind', async () => {
    await initDB();
    const expected = storedRows('surf2-strength-thu');

    // Simulate the device state: prescriptions from an older release, and a
    // stored revision behind the current one.
    mockRaw
      .prepare(
        `UPDATE session_template_exercises SET prescribed_sets = 99, hint = NULL
         WHERE session_template_id = (SELECT id FROM session_templates WHERE slug = 'surf2-strength-thu')`,
      )
      .run();
    mockRaw
      .prepare(
        `DELETE FROM session_template_exercises
         WHERE session_template_id = (SELECT id FROM session_templates WHERE slug = 'surf2-strength-thu')
           AND order_index = 3`,
      )
      .run();
    mockRaw
      .prepare(`UPDATE settings SET value = '1' WHERE key = 'seed_revision'`)
      .run();

    await initDB();

    expect(storedRows('surf2-strength-thu')).toEqual(expected);
    expect(revision()).toBe(SEED_REVISION);
  });

  it('restores stale plan_days weekday labels when the revision is behind', async () => {
    // The Home strip derives training-vs-rest days from plan_days.weekday_label,
    // and Routes names the Sessions tabs from it — so a device seeded before a
    // plan gained labels must pick them up on the revision bump, not stay NULL.
    await initDB();
    const expected = storedWeekdayLabels('strength');
    // Guard against a vacuous pass: if the plan carried no labels at all, the
    // NULL-out below would be a no-op and this test would prove nothing.
    expect(expected.length).toBeGreaterThan(0);
    expect(expected.every(d => !!d.weekday_label)).toBe(true);

    mockRaw
      .prepare(
        `UPDATE plan_days SET weekday_label = NULL
          WHERE plan_id = (SELECT id FROM plans WHERE slug = 'strength')`,
      )
      .run();
    mockRaw
      .prepare(`UPDATE settings SET value = '1' WHERE key = 'seed_revision'`)
      .run();

    await initDB();

    expect(storedWeekdayLabels('strength')).toEqual(expected);
  });

  it('leaves recorded training data untouched during a refresh', async () => {
    await initDB();
    const planId = (
      mockRaw.prepare(`SELECT id FROM plans WHERE slug = 'surf-2'`).get() as {
        id: number;
      }
    ).id;
    const exId = (
      mockRaw.prepare(`SELECT id FROM exercises LIMIT 1`).get() as {id: number}
    ).id;

    mockRaw
      .prepare(`INSERT INTO weeks (id, plan_id) VALUES (1, ?)`)
      .run(planId);
    mockRaw
      .prepare(
        `INSERT INTO sessions (id, week_id, day_index, session_name, finished)
       VALUES (1, 1, 1, 'Power + Posterior', 1)`,
      )
      .run();
    mockRaw
      .prepare(
        `INSERT INTO session_exercises (id, session_id, exercise_id, order_index, prescribed_sets, prescribed_reps)
       VALUES (1, 1, ?, 1, 3, 8)`,
      )
      .run(exId);
    mockRaw
      .prepare(
        `INSERT INTO sets (session_exercise_id, set_index, weight, reps) VALUES (1, 1, 42.5, 8)`,
      )
      .run();

    mockRaw
      .prepare(`UPDATE settings SET value = '1' WHERE key = 'seed_revision'`)
      .run();
    await initDB();

    expect(mockRaw.prepare(`SELECT COUNT(*) AS n FROM weeks`).get()).toEqual({
      n: 1,
    });
    expect(mockRaw.prepare(`SELECT COUNT(*) AS n FROM sessions`).get()).toEqual(
      {
        n: 1,
      },
    );
    expect(
      mockRaw.prepare(`SELECT * FROM session_exercises WHERE id = 1`).get(),
    ).toMatchObject({prescribed_sets: 3, prescribed_reps: 8});
    expect(
      mockRaw
        .prepare(`SELECT weight, reps FROM sets WHERE set_index = 1`)
        .get(),
    ).toEqual({weight: 42.5, reps: 8});
  });

  it('gives activity_sessions a rating column on a fresh install', async () => {
    await initDB();
    const cols = (
      mockRaw.prepare(`PRAGMA table_info(activity_sessions)`).all() as {
        name: string;
      }[]
    ).map(c => c.name);
    expect(cols).toContain('rating');
  });

  it('adds the rating column to a pre-rating activity_sessions table', async () => {
    // Simulate a device that created the table before rating existed —
    // CREATE TABLE IF NOT EXISTS will keep this shape, only the ALTER helps.
    mockRaw.exec(
      `CREATE TABLE activity_sessions (
         id               INTEGER PRIMARY KEY AUTOINCREMENT,
         activity_id      INTEGER NOT NULL REFERENCES activities(id),
         performed_at     TEXT NOT NULL,
         duration_minutes INTEGER,
         spot             TEXT,
         note             TEXT,
         created_at       DATETIME DEFAULT (datetime('now'))
       )`,
    );
    await initDB();
    const cols = (
      mockRaw.prepare(`PRAGMA table_info(activity_sessions)`).all() as {
        name: string;
      }[]
    ).map(c => c.name);
    expect(cols).toContain('rating');
  });

  it('adds the kcal column to activity_sessions and sessions on upgrade', async () => {
    // Simulate a device on the pre-kcal-branch schema: activity_sessions
    // already has `rating` (added in an earlier release) but neither table
    // has `kcal` yet — CREATE TABLE IF NOT EXISTS will keep this shape, only
    // the ALTERs help.
    mockRaw.exec(
      `CREATE TABLE activity_sessions (
         id               INTEGER PRIMARY KEY AUTOINCREMENT,
         activity_id      INTEGER NOT NULL REFERENCES activities(id),
         performed_at     TEXT NOT NULL,
         duration_minutes INTEGER,
         spot             TEXT,
         note             TEXT,
         rating           INTEGER,
         created_at       DATETIME DEFAULT (datetime('now'))
       )`,
    );
    mockRaw.exec(
      `CREATE TABLE sessions (
         id            INTEGER PRIMARY KEY AUTOINCREMENT,
         week_id       INTEGER NOT NULL REFERENCES weeks(id) ON DELETE CASCADE,
         day_index     INTEGER NOT NULL,
         weekday_label TEXT,
         session_name  TEXT NOT NULL,
         trained_at    DATETIME,
         finished      BOOLEAN NOT NULL DEFAULT 0,
         notes         TEXT
       )`,
    );
    await initDB();
    const activityCols = (
      mockRaw.prepare(`PRAGMA table_info(activity_sessions)`).all() as {
        name: string;
      }[]
    ).map(c => c.name);
    const sessionCols = (
      mockRaw.prepare(`PRAGMA table_info(sessions)`).all() as {
        name: string;
      }[]
    ).map(c => c.name);
    expect(activityCols).toContain('kcal');
    expect(sessionCols).toContain('kcal');
  });

  it('seeds the activity catalogue and re-upserts it idempotently', async () => {
    await initDB();
    const rows = () =>
      mockRaw
        .prepare(`SELECT slug, name FROM activities ORDER BY id`)
        .all() as {slug: string; name: string}[];
    expect(rows()).toEqual([
      {slug: 'surf', name: 'Surfing'},
      {slug: 'altinha', name: 'Altinha'},
    ]);
    await initDB();
    expect(rows()).toEqual([
      {slug: 'surf', name: 'Surfing'},
      {slug: 'altinha', name: 'Altinha'},
    ]);
  });
});

describe('activity note-list migration', () => {
  const noteOf = (id: number) =>
    (
      mockRaw
        .prepare(`SELECT note FROM activity_sessions WHERE id = ?`)
        .get(id) as {note: string | null}
    ).note;

  function insertNote(id: number, note: string | null) {
    mockRaw
      .prepare(
        `INSERT INTO activity_sessions (id, activity_id, performed_at, note)
         VALUES (?, 1, '2026-08-06', ?)`,
      )
      .run(id, note);
  }

  it('strips legacy "- " bullets and leaves plain/NULL notes intact', async () => {
    await initDB();
    // Simulate an upgrading device: legacy-shaped rows exist, marker not set.
    insertNote(1, '- Tons of people\n- longboard\n- maybe 4 waves surfed');
    insertNote(2, 'With indo boys and one tourist before. Easy');
    insertNote(3, null);
    mockRaw
      .prepare(`DELETE FROM settings WHERE key = 'note_list_migrated'`)
      .run();

    await initDB();

    expect(noteOf(1)).toBe('Tons of people\nlongboard\nmaybe 4 waves surfed');
    expect(noteOf(2)).toBe('With indo boys and one tourist before. Easy');
    expect(noteOf(3)).toBeNull();
  });

  it('runs exactly once — a later note starting with "- " is never re-stripped', async () => {
    await initDB();
    // Written through the new list UI AFTER the migration already ran:
    // the dash is user content, not a legacy bullet.
    insertNote(1, '- 4 foot swell predicted');

    await initDB();

    expect(noteOf(1)).toBe('- 4 foot swell predicted');
  });
});

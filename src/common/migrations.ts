import {SQLiteDatabase} from 'react-native-sqlite-storage';

export async function migrateTrainingDaysTable(
  db: SQLiteDatabase,
): Promise<void> {
  // Fetch the table definition
  const [result] = await db.executeSql(`
          SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'training_days';
        `);

  const tableDefinition = result.rows.item(0)?.sql;

  if (!tableDefinition) {
    return console.error('Table training_days does not exist.');
  }

  // Normalize the table definition by removing extra spaces and line breaks
  const normalizedTableDefinition = tableDefinition.replace(/\s+/g, ' ').trim();

  // Define the expected CHECK constraint in normalized format
  const expectedConstraint = `
          CHECK(day IN (
            'Reverse Step Up Leg Day',
            'Chest Pressing Upper Body Day',
            'Mobility Day',
            'Split Squat Leg Day',
            'Shoulder Pressing Upper Body Day',
            'Lower Body',
            'Lower Body 2',
            'Lower Body 3',
            'Upper Body and Stretching',
            'Upper Body and Stretching 2'
          ))
        `
    .replace(/\s+/g, ' ')
    .trim();

  // Check if the normalized constraint exists in the normalized table definition
  const hasCorrectConstraint =
    normalizedTableDefinition.includes(expectedConstraint);

  if (hasCorrectConstraint) {
    return console.info('No migration needed for training_days table.');
  }

  // If the constraint is missing, perform the migration
  console.info('Migrating training_days table...');

  // Create the new table
  await db.executeSql(`
          CREATE TABLE training_days_new (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              workout_program_id INTEGER,
              day TEXT CHECK(day IN (
                  'Reverse Step Up Leg Day',
                  'Chest Pressing Upper Body Day',
                  'Mobility Day',
                  'Split Squat Leg Day',
                  'Shoulder Pressing Upper Body Day',
                  'Lower Body',
                  'Lower Body 2',
                  'Lower Body 3',
                  'Upper Body and Stretching',
                  'Upper Body and Stretching 2'
              )),
              finished BOOLEAN DEFAULT 0,
              FOREIGN KEY (workout_program_id) REFERENCES workout_programs(id)
          );
        `);

  // Copy data from the old table
  await db.executeSql(`
          INSERT INTO training_days_new (id, workout_program_id, day, finished)
          SELECT id, workout_program_id, day, finished FROM training_days;
        `);

  // Drop the old table
  await db.executeSql(`DROP TABLE training_days;`);

  // Rename the new table to the old table's name
  await db.executeSql(`ALTER TABLE training_days_new RENAME TO training_days;`);

  console.info('Migration completed successfully for training_days.');
}

export async function migrateWorkoutProgramsTable(
  db: SQLiteDatabase,
): Promise<void> {
  const [result] = await db.executeSql(`
        SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'workout_programs';
      `);

  const tableDefinition = result.rows.item(0)?.sql;

  if (!tableDefinition) {
    return console.error('Table workout_programs does not exist.');
  }

  // Check if the CHECK constraint includes 'C'
  const hasCorrectConstraint = tableDefinition.includes(
    "CHECK(type IN ('A', 'B', 'C'))",
  );

  if (hasCorrectConstraint) {
    return console.info('No migration needed for workout_programs table.');
  }

  // If the constraint is missing, perform the migration
  console.info('Migrating workout_programs table...');

  // Create the new table
  await db.executeSql(`
        CREATE TABLE workout_programs_new (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            type CHAR(1) CHECK(type IN ('A', 'B', 'C')) NOT NULL,
            start_date DATE DEFAULT (date('now')),
            end_date DATE,
            finished BOOLEAN DEFAULT 0
        );
      `);

  // Copy data from the old table
  await db.executeSql(`
        INSERT INTO workout_programs_new (id, type, start_date, end_date, finished)
        SELECT id, type, start_date, end_date, finished FROM workout_programs;
      `);

  // Drop the old table
  await db.executeSql(`DROP TABLE workout_programs;`);

  // Rename the new table to the old table's name
  await db.executeSql(
    `ALTER TABLE workout_programs_new RENAME TO workout_programs;`,
  );

  console.info('Migration completed successfully.');
}

export async function migrateExercisesTable(db: SQLiteDatabase): Promise<void> {
  // Fetch the current table definition
  const [result] = await db.executeSql(`
        SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'exercises';
      `);

  const tableDefinition = result.rows.item(0)?.sql;

  if (!tableDefinition) {
    return console.error('Table exercises does not exist.');
  }

  // Check if the `next` column exists
  const hasNextColumn = tableDefinition.includes('next BOOLEAN');

  if (!hasNextColumn) {
    return console.info('No migration needed for exercises table.');
  }

  console.info('Migrating exercises table to remove the next column...');

  // Create a new table without the `next` column
  await db.executeSql(`
        CREATE TABLE exercises_new (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            sets INTEGER DEFAULT 1,
            name TEXT NOT NULL UNIQUE,
            hint TEXT,
            sled BOOLEAN DEFAULT 0,
            time INTEGER, -- NULL if not applicable
            video TEXT
        );
      `);

  // Copy data from the old table to the new table
  await db.executeSql(`
        INSERT INTO exercises_new (id, sets, name, hint, sled, time, video)
        SELECT id, sets, name, hint, sled, time, video FROM exercises;
      `);

  // Drop the old table
  await db.executeSql(`DROP TABLE exercises;`);

  // Rename the new table to the old table's name
  await db.executeSql(`ALTER TABLE exercises_new RENAME TO exercises;`);

  console.info('Migration completed successfully for exercises.');
}

export async function migrateTrainingDayExercisesTable(
  db: SQLiteDatabase,
): Promise<void> {
  // Fetch the current table definition
  const [result] = await db.executeSql(`
        SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'training_day_exercises';
      `);

  const tableDefinition = result.rows.item(0)?.sql;

  if (!tableDefinition) {
    return console.error('Table training_day_exercises does not exist.');
  }

  // Check if the `next` column is already present
  const hasNextColumn = tableDefinition.includes('next BOOLEAN');

  if (hasNextColumn) {
    return console.info(
      'No migration needed for training_day_exercises table.',
    );
  }

  console.info(
    'Migrating training_day_exercises table to add the next column...',
  );

  // Create a new table with the `next` column
  await db.executeSql(`
        CREATE TABLE training_day_exercises_new (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            training_day_id INTEGER,
            exercise_id INTEGER,
            finished BOOLEAN DEFAULT 0,
            next BOOLEAN DEFAULT 0,
            FOREIGN KEY (training_day_id) REFERENCES training_days(id),
            FOREIGN KEY (exercise_id) REFERENCES exercises(id)
        );
      `);

  // Copy data from the old table to the new table
  await db.executeSql(`
        INSERT INTO training_day_exercises_new (id, training_day_id, exercise_id, finished)
        SELECT id, training_day_id, exercise_id, finished FROM training_day_exercises;
      `);

  // Drop the old table
  await db.executeSql(`DROP TABLE training_day_exercises;`);

  // Rename the new table to the old table's name
  await db.executeSql(
    `ALTER TABLE training_day_exercises_new RENAME TO training_day_exercises;`,
  );

  console.info('Migration completed successfully for training_day_exercises.');
}

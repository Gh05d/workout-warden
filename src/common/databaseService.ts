import {SQLiteDatabase, openDatabase} from 'react-native-sqlite-storage';
import fs from 'react-native-fs';
import {training} from './variables';
import {Alert} from 'react-native';

export const getDBConnection = async () => {
  return openDatabase({name: 'warden.db', location: 'default'});
};

export const dropAllTables = async () => {
  const db = await getDBConnection();
  const dropTableQueries = [
    'DROP TABLE IF EXISTS sets;',
    'DROP TABLE IF EXISTS exercises;',
    'DROP TABLE IF EXISTS training_days;',
    'DROP TABLE IF EXISTS training_day_exercises;',
    'DROP TABLE IF EXISTS workout_programs;',
  ];

  try {
    await Promise.all(dropTableQueries.map(query => db.executeSql(query)));
    console.log('All tables dropped successfully');
  } catch (error) {
    console.error('Error dropping tables', error);
  }
};

export const initDB = async () => {
  const db = await getDBConnection();

  const queries = [
    `
    CREATE TABLE IF NOT EXISTS sets (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        training_day_exercise_id INTEGER,
        weight FLOAT,
        reps INTEGER,
        FOREIGN KEY (training_day_exercise_id) REFERENCES training_day_exercises(id)
    );`,
    `
    CREATE TABLE IF NOT EXISTS exercises (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        sets INTEGER DEFAULT 1,
        name TEXT NOT NULL UNIQUE,
        hint TEXT,
        sled BOOLEAN DEFAULT 0,
        time INTEGER, -- NULL if not applicable
        video TEXT
    );`,
    `
    CREATE TABLE IF NOT EXISTS training_days (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        workout_program_id INTEGER,
        day TEXT CHECK( day IN (
            'Reverse Step Up Leg Day',
            'Chest Pressing Upper Body Day',
            'Mobility Day',
            'Split Squat Leg Day',
            'Shoulder Pressing Upper Body Day'
        )),
        finished BOOLEAN DEFAULT 0,
        FOREIGN KEY (workout_program_id) REFERENCES workout_programs(id)
    );`,
    `
    CREATE TABLE IF NOT EXISTS training_day_exercises (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        training_day_id INTEGER,
        exercise_id INTEGER,
        finished BOOLEAN DEFAULT 0,
        FOREIGN KEY (training_day_id) REFERENCES training_days(id),
        FOREIGN KEY (exercise_id) REFERENCES exercises(id)
    );`,
    `
    CREATE TABLE IF NOT EXISTS workout_programs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        type CHAR(1) CHECK( type IN ('A', 'B')) NOT NULL,
        start_date DATE DEFAULT (date('now')),
        end_date DATE,
        finished BOOLEAN DEFAULT 0
    );`,
  ];

  for (const query of queries) {
    await db.executeSql(query);
  }

  const [res] = await db.executeSql(`SELECT id FROM exercises;`);
  const rows = res.rows.raw();

  if (!rows.length) await createExercises(db);
};

async function createExercises(db: SQLiteDatabase) {
  // Create a map to track unique exercises by name
  const uniqueExercises = new Map();

  // Iterate over all sessions and their exercises
  training.A.sessions.forEach(session => {
    session.exercises.forEach(exercise => {
      // Use exercise name as the key to ensure uniqueness
      if (!uniqueExercises.has(exercise.name)) {
        uniqueExercises.set(exercise.name, exercise);
      }
    });
  });

  training.B.sessions.forEach(session => {
    session.exercises.forEach(exercise => {
      if (!uniqueExercises.has(exercise.name)) {
        uniqueExercises.set(exercise.name, exercise);
      }
    });
  });

  // Now insert each unique exercise into the database
  for (const exercise of uniqueExercises.values()) {
    const query = `
              INSERT INTO exercises (name, hint, sled, time, video, sets)
              VALUES (?, ?, ?, ?, ?, ?);
            `;
    await db.executeSql(query, [
      exercise.name,
      exercise.hint || null,
      exercise.sled ? 1 : 0,
      exercise.time || null,
      exercise.video,
      exercise.sets?.length || 1,
    ]);
  }
}

export async function insertWorkoutProgram(
  db: SQLiteDatabase,
  type: 'A' | 'B',
) {
  // Insert new workout program
  const [programResult] = await db.executeSql(
    `
      INSERT INTO workout_programs (type, start_date, end_date, finished)
      VALUES (?, datetime('now'), datetime('now', '+7 days'), ?);
    `,
    [type, 0],
  );

  const workoutProgramID = programResult.insertId;

  // Fetch the last workout program of the same type
  const [lastProgramResult] = await db.executeSql(
    `
      SELECT id FROM workout_programs
      WHERE type = ? AND id < ?
      ORDER BY id DESC
      LIMIT 1;
    `,
    [type, workoutProgramID],
  );

  const [lastWorkoutProgram] = lastProgramResult.rows.raw();

  // If there is a previous workout program of the same type, use its sessions as a template
  if (lastWorkoutProgram) {
    const lastProgramSessions = await fetchTrainingDays(
      db,
      lastWorkoutProgram.id,
    );

    for (const session of lastProgramSessions) {
      const lastSessionExercises = await fetchExercisesForTrainingDay(
        db,
        session.id,
      );
      await insertTrainingDays(db, workoutProgramID, [
        {...session, exercises: lastSessionExercises},
      ]);
    }
  } else {
    // If there's no previous program of the same type, use the default sessions from the training object
    await insertTrainingDays(db, workoutProgramID, training[type].sessions);
  }
}

export async function insertTrainingDays(
  db: SQLiteDatabase,
  workoutProgramId: number,
  sessions: typeof training.A.sessions | typeof training.B.sessions,
) {
  for (const day of sessions) {
    const query = `
        INSERT INTO training_days (workout_program_id, day, finished)
        VALUES (?, ?, ?);
    `;
    const [result] = await db.executeSql(query, [workoutProgramId, day.day, 0]);

    const trainingDayID = result.insertId;
    await insertExercises(db, trainingDayID, day.exercises);
  }
}

export async function insertExercises(
  db: SQLiteDatabase,
  trainingDayID: number,
  exercises: Exercise[],
) {
  for (const exercise of exercises) {
    const [result] = await db.executeSql(
      `SELECT id FROM exercises WHERE name = ?`,
      [exercise.name],
    );

    const [rows] = result.rows.raw();

    const trainingDayExerciseID = await insertTrainingDayExercises(
      db,
      trainingDayID,
      rows.id,
    );
    if (exercise.sets?.length > 0) {
      for (const set of exercise.sets) {
        await insertSets(db, trainingDayExerciseID, set);
      }
    }
  }
}

export async function insertTrainingDayExercises(
  db: SQLiteDatabase,
  trainingDayID: number,
  exerciseID: number,
) {
  const query = `
        INSERT INTO training_day_exercises (training_day_id, exercise_id)
        VALUES (?, ?);`;
  const [res] = await db.executeSql(query, [trainingDayID, exerciseID]);
  return res.insertId;
}

export async function insertSets(
  db: SQLiteDatabase,
  trainingDayExerciseID: number,
  set: ExerciseSet,
) {
  const query = `
        INSERT INTO sets (training_day_exercise_id, weight, reps)
        VALUES (?, ?, ?);`;
  await db.executeSql(query, [
    trainingDayExerciseID,
    set.weight || null,
    set.reps,
  ]);
}

export async function getNewWorkoutProgramType(db: SQLiteDatabase) {
  const query = `
        SELECT type FROM workout_programs
        ORDER BY id DESC
        LIMIT 1;
    `;
  const [result] = await db.executeSql(query);
  const rows = result.rows.raw();

  if (rows.length > 0) return rows[0].type == 'A' ? 'B' : 'A';

  return 'A';
}

export async function fetchWeeks(db: SQLiteDatabase) {
  const workoutPrograms = await fetchWorkoutPrograms(db);
  for (const program of workoutPrograms) {
    program.sessions = await fetchTrainingDays(db, program.id);
    for (const session of program.sessions) {
      session.exercises = await fetchExercisesForTrainingDay(db, session.id);
    }
  }
  return workoutPrograms;
}

export async function fetchWeekByID(
  db: SQLiteDatabase,
  workoutProgramID: number,
) {
  const workoutPrograms = await fetchWorkoutPrograms(db, workoutProgramID);

  if (workoutPrograms.length === 0) {
    console.log(`Workout program with ID ${workoutProgramID} not found.`);
    return null;
  }

  const [program] = workoutPrograms;

  program.sessions = await fetchTrainingDays(db, program.id);

  for (const session of program.sessions) {
    session.exercises = await fetchExercisesForTrainingDay(db, session.id);
  }

  return program;
}

async function fetchWorkoutPrograms(
  db: SQLiteDatabase,
  workoutProgramID?: number,
) {
  let query = `SELECT * FROM workout_programs`;
  let params = [];

  if (workoutProgramID) {
    query += ` WHERE id = ?`;
    params.push(workoutProgramID);
  }

  const [result] = await db.executeSql(query, params);
  return result.rows.raw();
}

async function fetchTrainingDays(db: SQLiteDatabase, workoutProgramID: number) {
  const result = await db.executeSql(
    `SELECT * FROM training_days WHERE workout_program_id = ?;`,
    [workoutProgramID],
  );
  return result[0].rows.raw();
}

async function fetchExercisesForTrainingDay(
  db: SQLiteDatabase,
  trainingDayID: number,
) {
  const [result] = await db.executeSql(
    `SELECT e.*, tde.finished, tde.id as training_day_exercise_id FROM exercises e 
     JOIN training_day_exercises tde ON e.id = tde.exercise_id 
     WHERE tde.training_day_id = ?;`,
    [trainingDayID],
  );
  const exercises = result.rows.raw();

  for (const exercise of exercises) {
    exercise.sets = await fetchSetsForExercise(
      db,
      exercise.training_day_exercise_id,
    );
  }

  return exercises;
}

async function fetchSetsForExercise(
  db: SQLiteDatabase,
  trainingDayExerciseID: number,
) {
  const result = await db.executeSql(
    `SELECT * FROM sets WHERE training_day_exercise_id = ?;`,
    [trainingDayExerciseID],
  );

  return result[0].rows.raw();
}

export async function deleteWorkoutProgram(workoutProgramId: number) {
  const db = await getDBConnection();
  await db.transaction(async tx => {
    try {
      // Delete sets related to the workout program
      const deleteSetsQuery = `
      DELETE FROM sets
      WHERE training_day_exercise_id IN (
        SELECT tde.id
        FROM training_day_exercises tde
        JOIN training_days td ON tde.training_day_id = td.id
        WHERE td.workout_program_id = ?
      );`;
      tx.executeSql(deleteSetsQuery, [workoutProgramId]);
      // Delete training day exercises related to the workout program
      const deleteTrainingDayExercisesQuery = `
      DELETE FROM training_day_exercises
      WHERE training_day_id IN (
        SELECT id FROM training_days WHERE workout_program_id = ?
      );`;
      tx.executeSql(deleteTrainingDayExercisesQuery, [workoutProgramId]);
      // Delete training days related to the workout program
      const deleteTrainingDaysQuery = `DELETE FROM training_days WHERE workout_program_id = ?;`;
      tx.executeSql(deleteTrainingDaysQuery, [workoutProgramId]);
      // Finally, delete the workout program itself
      const deleteWorkoutProgramQuery = `DELETE FROM workout_programs WHERE id = ?;`;
      tx.executeSql(deleteWorkoutProgramQuery, [workoutProgramId]);
    } catch (error) {
      console.error(error);
    }
  });

  console.log(
    `Workout program ${workoutProgramId} and all related data has been deleted.`,
  );
}

export async function fetchExerciseProgress(
  db: SQLiteDatabase,
  exerciseName: string,
) {
  const query = `
    SELECT wp.start_date, tde.id as training_day_id, s.reps, s.weight, s.id
    FROM sets s
    INNER JOIN training_day_exercises tde ON s.training_day_exercise_id = tde.id
    INNER JOIN exercises e ON tde.exercise_id = e.id
    INNER JOIN training_days td ON tde.training_day_id = td.id
    INNER JOIN workout_programs wp ON td.workout_program_id = wp.id
    WHERE e.name = ?
    ORDER BY wp.start_date ASC;
  `;

  const [results] = await db.executeSql(query, [exerciseName]);
  return results?.rows.raw();
}

export async function getAllExercises(db: SQLiteDatabase) {
  const [results] = await db.executeSql('SELECT name FROM exercises;');
  return results?.rows.raw();
}

export async function exportDataToJSON() {
  const db = await getDBConnection();

  try {
    const [setsResult] = await db.executeSql('SELECT * FROM sets;');
    const [exercisesResult] = await db.executeSql('SELECT * FROM exercises;');
    const [trainingDaysResult] = await db.executeSql(
      'SELECT * FROM training_days;',
    );
    const [trainingDayExercisesResult] = await db.executeSql(
      'SELECT * FROM training_day_exercises;',
    );
    const [workoutProgramsResult] = await db.executeSql(
      'SELECT * FROM workout_programs;',
    );

    // Convert results to JSON
    const data = {
      sets: setsResult.rows.raw(),
      exercises: exercisesResult.rows.raw(),
      training_days: trainingDaysResult.rows.raw(),
      training_day_exercises: trainingDayExercisesResult.rows.raw(),
      workout_programs: workoutProgramsResult.rows.raw(),
    };

    // Write data to a JSON file
    const path = `${fs.DownloadDirectoryPath}/warden-exportedData.json`;
    await fs.writeFile(path, JSON.stringify(data), 'utf8');
    return Alert.alert('Success', `Data export to ${path}`);
  } catch (error) {
    Alert.alert('Export failed', (error as Error)?.message);
  }
}

export async function importDataFromJSON() {
  const db = await getDBConnection();
  const path = `${fs.DownloadDirectoryPath}/warden-exportedData.json`;

  try {
    // Read JSON file from the Downloads directory
    const jsonString = await fs.readFile(path, 'utf8');
    const data = JSON.parse(jsonString);

    // Insert data into SQLite database
    await db.transaction(async tx => {
      // Insert sets
      for (const set of data.sets) {
        await tx.executeSql(
          'INSERT OR REPLACE INTO sets (id, training_day_exercise_id, weight, reps) VALUES (?, ?, ?, ?);',
          [set.id, set.training_day_exercise_id, set.weight, set.reps],
        );
      }

      // Insert exercises
      for (const exercise of data.exercises) {
        await tx.executeSql(
          'INSERT OR REPLACE INTO exercises (id, sets, name, hint, sled, time, video) VALUES (?, ?, ?, ?, ?, ?, ?);',
          [
            exercise.id,
            exercise.sets,
            exercise.name,
            exercise.hint,
            exercise.sled,
            exercise.time,
            exercise.video,
          ],
        );
      }

      // Insert training days
      for (const trainingDay of data.training_days) {
        await tx.executeSql(
          'INSERT OR REPLACE INTO training_days (id, workout_program_id, day, finished) VALUES (?, ?, ?, ?);',
          [
            trainingDay.id,
            trainingDay.workout_program_id,
            trainingDay.day,
            trainingDay.finished,
          ],
        );
      }

      // Insert training day exercises
      for (const trainingDayExercise of data.training_day_exercises) {
        await tx.executeSql(
          'INSERT OR REPLACE INTO training_day_exercises (id, training_day_id, exercise_id, finished) VALUES (?, ?, ?, ?);',
          [
            trainingDayExercise.id,
            trainingDayExercise.training_day_id,
            trainingDayExercise.exercise_id,
            trainingDayExercise.finished,
          ],
        );
      }

      // Insert workout programs
      for (const workoutProgram of data.workout_programs) {
        await tx.executeSql(
          'INSERT OR REPLACE INTO workout_programs (id, type, start_date, end_date, finished) VALUES (?, ?, ?, ?, ?);',
          [
            workoutProgram.id,
            workoutProgram.type,
            workoutProgram.start_date,
            workoutProgram.end_date,
            workoutProgram.finished,
          ],
        );
      }
    });

    Alert.alert('Success', 'Data imported successfully');
  } catch (error) {
    Alert.alert('Import failed', (error as Error)?.message);
  }
}

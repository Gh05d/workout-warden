import {Alert} from 'react-native';
import {SQLiteDatabase, openDatabase} from 'react-native-sqlite-storage';
import RNFS from 'react-native-fs';

import {training} from './variables';

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

  await db
    .executeSql(
      `
    ALTER TABLE exercises ADD COLUMN next BOOLEAN DEFAULT 0;
  `,
    )
    .catch(error => {
      if (error.message.includes('duplicate column name')) {
        console.log('Column "next" already exists, skipping...');
      } else {
        console.error('Error adding new column', error);
      }
    });

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
        next BOOLEAN DEFAULT 0,
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
              INSERT INTO exercises (name, hint, sled, time, video, next, sets)
              VALUES (?, ?, ?, ?, ?, ?, ?);
            `;

    await db.executeSql(query, [
      exercise.name,
      exercise.hint || null,
      exercise.sled ? 1 : 0,
      exercise.time || null,
      exercise.video,
      exercise.next ? 1 : 0,
      exercise.sets?.length || 1,
    ]);
  }
}

export async function insertWorkoutProgram(
  db: SQLiteDatabase,
  type: 'A' | 'B',
) {
  try {
    // Insert new workout program
    const [programResult] = await db.executeSql(
      `
        INSERT INTO workout_programs (type, start_date, end_date, finished)
        VALUES (?, datetime('now'), datetime('now', '+7 days'), ?);
      `,
      [type, 0],
    );

    const workoutProgramID = programResult?.insertId;
    if (!workoutProgramID) {
      throw new Error('Failed to insert new workout program.');
    }

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

    const lastWorkoutProgram =
      lastProgramResult.rows.length > 0 ? lastProgramResult.rows.item(0) : null;

    // Use training object as the template for new sessions
    let sessionsToInsert = training[type].sessions;

    if (lastWorkoutProgram && lastWorkoutProgram.id) {
      // Fetch sessions from the last workout program
      const lastProgramSessions = await fetchTrainingDays(
        db,
        lastWorkoutProgram.id,
      );

      // Map the sessions from the training object while updating weights
      sessionsToInsert = await Promise.all(
        training[type].sessions.map(async (newSession, index) => {
          const lastSession = lastProgramSessions[index];

          if (lastSession) {
            // Fetch exercises for this specific training day in the last workout program
            const lastSessionExercises = await fetchExercisesForTrainingDay(
              db,
              lastSession.id,
            );

            // Update exercises in the new session using the fetched data from the previous session
            const updatedExercises = newSession.exercises.map(exercise => {
              const lastExercise = lastSessionExercises.find(
                ex => ex.name === exercise.name,
              );

              if (lastExercise) {
                // Map over sets to update weights where applicable
                const updatedSets = exercise.sets.map((set, setIndex) => {
                  if (
                    lastExercise.sets &&
                    lastExercise.sets[setIndex] &&
                    lastExercise.sets[setIndex].weight !== undefined &&
                    lastExercise.sets[setIndex].weight !== null
                  ) {
                    return {
                      ...set,
                      weight: lastExercise.sets[setIndex].weight,
                    };
                  }
                  return set; // If no previous value, return original set
                });

                return {
                  ...exercise,
                  sets: updatedSets,
                };
              }
              return exercise;
            });

            return {
              ...newSession,
              exercises: updatedExercises,
            };
          }

          return newSession; // If no last session, keep the original session from training
        }),
      );
    }

    // Insert training days with the updated sessions
    await insertTrainingDays(db, workoutProgramID, sessionsToInsert);
  } catch (error) {
    console.error('Error inserting workout program:', error.message);
    throw error; // Re-throw to handle it elsewhere if needed
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

  console.log(workoutPrograms);

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

export async function getAllExercises(db: SQLiteDatabase) {
  const [results] = await db.executeSql('SELECT name FROM exercises;');
  return results?.rows.raw();
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

const dbPath = '/data/data/com.workoutwarden/databases/warden.db';

export async function exportDatabase() {
  const exportPath = `${RNFS.DownloadDirectoryPath}/warden-exported.db`;

  try {
    await RNFS.copyFile(dbPath, exportPath);
    Alert.alert('Success', `Database exported to ${exportPath}`);
  } catch (error) {
    console.error('Error exporting database:', error);
    Alert.alert('Export failed', (error as Error)?.message);
  }
}

export async function importDatabase(importPath: string) {
  try {
    const db = await getDBConnection();
    await db.close();

    await RNFS.copyFile(importPath, dbPath);
    Alert.alert('Success', 'Database imported successfully');
  } catch (error) {
    console.error('Error importing database:', error);
    Alert.alert('Import failed', (error as Error)?.message);
  }
}

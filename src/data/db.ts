import type { SQLiteDatabase } from 'expo-sqlite';

export type Db = Pick<SQLiteDatabase, 'execAsync' | 'getAllAsync' | 'getFirstAsync' | 'runAsync'>;

export const DATABASE_NAME = 'shalev-gym.db';

// Each entry upgrades the database by one version. Never edit an entry that has shipped.
// An entry that rebuilds a table runs with foreign keys off (SQLite's own steps for changing a
// table) and checks that every link is intact before it commits.
type Migration = string | { sql: string; rebuildsTables: true };

const MIGRATIONS: Migration[] = [
  `
  CREATE TABLE workouts (
    id TEXT PRIMARY KEY NOT NULL,
    user_id TEXT NOT NULL,
    started_at TEXT NOT NULL,
    ended_at TEXT,
    last_activity_at TEXT NOT NULL,
    end_reason TEXT CHECK (end_reason IN ('user', 'auto')),
    title TEXT,
    focus TEXT
  );
  CREATE UNIQUE INDEX workouts_one_active_per_user ON workouts (user_id) WHERE ended_at IS NULL;
  CREATE INDEX workouts_user_started ON workouts (user_id, started_at DESC);
  `,
  `
  CREATE TABLE exercises (
    id TEXT PRIMARY KEY NOT NULL,
    workout_id TEXT NOT NULL REFERENCES workouts (id),
    user_id TEXT NOT NULL,
    position INTEGER NOT NULL,
    name TEXT NOT NULL,
    technique TEXT CHECK (technique IN ('pyramid', 'drop set')),
    superset_group TEXT,
    spoken_text TEXT,
    created_at TEXT NOT NULL
  );
  CREATE INDEX exercises_workout ON exercises (workout_id, position);
  CREATE TABLE exercise_sets (
    id TEXT PRIMARY KEY NOT NULL,
    exercise_id TEXT NOT NULL REFERENCES exercises (id),
    user_id TEXT NOT NULL,
    position INTEGER NOT NULL,
    weight REAL CHECK (weight IS NULL OR weight >= 0),
    unit TEXT CHECK (unit IN ('kg', 'lb')),
    reps INTEGER CHECK (reps IS NULL OR reps >= 0),
    to_failure INTEGER NOT NULL DEFAULT 0 CHECK (to_failure IN (0, 1)),
    started_at TEXT,
    ended_at TEXT
  );
  CREATE INDEX exercise_sets_exercise ON exercise_sets (exercise_id, position);
  `,
  // An exercise is chosen once, then its sets are logged until it is finished.
  `
  ALTER TABLE exercises ADD COLUMN muscle TEXT;
  ALTER TABLE exercises ADD COLUMN finished_at TEXT;
  UPDATE exercises SET finished_at = created_at;
  `,
  // The trainer's profile and dated body weights (requirement 20).
  `
  CREATE TABLE profiles (
    user_id TEXT PRIMARY KEY NOT NULL,
    birth_date TEXT,
    sex TEXT CHECK (sex IN ('male', 'female')),
    height_cm REAL CHECK (height_cm IS NULL OR height_cm > 0),
    height_unit TEXT NOT NULL DEFAULT 'cm' CHECK (height_unit IN ('cm', 'ft')),
    weight_reminder_dismissed_at TEXT,
    updated_at TEXT NOT NULL
  );
  CREATE TABLE body_weights (
    id TEXT PRIMARY KEY NOT NULL,
    user_id TEXT NOT NULL,
    weight REAL NOT NULL CHECK (weight > 0),
    unit TEXT NOT NULL CHECK (unit IN ('kg', 'lb')),
    recorded_at TEXT NOT NULL
  );
  CREATE INDEX body_weights_user ON body_weights (user_id, recorded_at DESC);
  `,
  // Equipment and timed sets (requirements 14 and 17), and what the trainer corrected (15d).
  // Exercises saved before this keep a null equipment and show their weights as before.
  `
  ALTER TABLE exercises ADD COLUMN equipment TEXT
    CHECK (equipment IN ('barbell', 'dumbbells', 'dumbbell', 'machine', 'plates', 'bodyweight'));
  ALTER TABLE exercises ADD COLUMN measure TEXT NOT NULL DEFAULT 'reps' CHECK (measure IN ('reps', 'time'));
  ALTER TABLE exercises ADD COLUMN bar_kg REAL CHECK (bar_kg IS NULL OR bar_kg >= 0);
  ALTER TABLE exercise_sets ADD COLUMN duration_s INTEGER CHECK (duration_s IS NULL OR duration_s > 0);
  CREATE TABLE name_corrections (
    user_id TEXT NOT NULL,
    heard TEXT NOT NULL,
    name TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    PRIMARY KEY (user_id, heard)
  );
  CREATE TABLE bar_weights (
    user_id TEXT NOT NULL,
    exercise TEXT NOT NULL,
    bar_kg REAL NOT NULL CHECK (bar_kg >= 0),
    PRIMARY KEY (user_id, exercise)
  );
  `,
  // The last monthly summary the trainer opened, so a new one is announced once (requirement 12).
  `
  ALTER TABLE profiles ADD COLUMN summary_seen_month TEXT;
  `,
  // Cardio and conditioning (treadmill, HIIT, CrossFit) as an equipment type, logged in time.
  // SQLite can't change a column's CHECK, so the table is copied into a new one.
  {
    rebuildsTables: true,
    sql: `
  CREATE TABLE exercises_new (
    id TEXT PRIMARY KEY NOT NULL,
    workout_id TEXT NOT NULL REFERENCES workouts (id),
    user_id TEXT NOT NULL,
    position INTEGER NOT NULL,
    name TEXT NOT NULL,
    technique TEXT CHECK (technique IN ('pyramid', 'drop set')),
    superset_group TEXT,
    spoken_text TEXT,
    created_at TEXT NOT NULL,
    muscle TEXT,
    finished_at TEXT,
    equipment TEXT
      CHECK (equipment IN ('barbell', 'dumbbells', 'dumbbell', 'machine', 'plates', 'bodyweight', 'cardio')),
    measure TEXT NOT NULL DEFAULT 'reps' CHECK (measure IN ('reps', 'time')),
    bar_kg REAL CHECK (bar_kg IS NULL OR bar_kg >= 0)
  );
  INSERT INTO exercises_new
    (id, workout_id, user_id, position, name, technique, superset_group, spoken_text, created_at, muscle,
     finished_at, equipment, measure, bar_kg)
  SELECT id, workout_id, user_id, position, name, technique, superset_group, spoken_text, created_at, muscle,
     finished_at, equipment, measure, bar_kg
  FROM exercises;
  DROP TABLE exercises;
  ALTER TABLE exercises_new RENAME TO exercises;
  CREATE INDEX exercises_workout ON exercises (workout_id, position);
  `,
  },
  // Cardio machine settings (requirement 23), and HIIT and CrossFit sessions and their saved
  // routines (requirement 24). A session's structure and movements are kept as text (JSON).
  `
  ALTER TABLE exercise_sets ADD COLUMN speed_kmh REAL CHECK (speed_kmh IS NULL OR speed_kmh >= 0);
  ALTER TABLE exercise_sets ADD COLUMN incline REAL;
  ALTER TABLE exercise_sets ADD COLUMN level REAL CHECK (level IS NULL OR level >= 0);
  ALTER TABLE exercise_sets ADD COLUMN distance_km REAL CHECK (distance_km IS NULL OR distance_km >= 0);
  ALTER TABLE exercise_sets ADD COLUMN calories REAL CHECK (calories IS NULL OR calories >= 0);
  ALTER TABLE exercises ADD COLUMN session TEXT;
  ALTER TABLE exercises ADD COLUMN routine_id TEXT;
  CREATE TABLE routines (
    id TEXT PRIMARY KEY NOT NULL,
    user_id TEXT NOT NULL,
    name TEXT NOT NULL,
    details TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE INDEX routines_user ON routines (user_id, updated_at DESC);
  `,
];

// Upgrades the database to the latest version, or only up to `upTo` versions (for tests).
export async function migrate(db: Db, upTo = MIGRATIONS.length): Promise<void> {
  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  const current = row?.user_version ?? 0;
  for (let version = current; version < upTo; version++) {
    const migration = MIGRATIONS[version];
    if (typeof migration === 'string') {
      await db.execAsync(`BEGIN; ${migration} PRAGMA user_version = ${version + 1}; COMMIT;`);
      continue;
    }
    const keys = await db.getFirstAsync<{ foreign_keys: number }>('PRAGMA foreign_keys');
    await db.execAsync('PRAGMA foreign_keys = OFF;');
    try {
      await db.execAsync(`BEGIN; ${migration.sql}`);
      const broken = await db.getAllAsync('PRAGMA foreign_key_check');
      if (broken.length > 0) {
        throw new Error('The database upgrade would break links between workouts, exercises and sets.');
      }
      await db.execAsync(`PRAGMA user_version = ${version + 1}; COMMIT;`);
    } catch (error) {
      await db.execAsync('ROLLBACK;').catch(() => undefined);
      throw error;
    } finally {
      if (keys?.foreign_keys) await db.execAsync('PRAGMA foreign_keys = ON;');
    }
  }
}

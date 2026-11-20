import type { SQLiteDatabase } from 'expo-sqlite';

export type Db = Pick<SQLiteDatabase, 'execAsync' | 'getAllAsync' | 'getFirstAsync' | 'runAsync'>;

export const DATABASE_NAME = 'shalev-gym.db';

// Each entry upgrades the database by one version. Never edit an entry that has shipped.
const MIGRATIONS = [
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
];

export async function migrate(db: Db): Promise<void> {
  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  const current = row?.user_version ?? 0;
  for (let version = current; version < MIGRATIONS.length; version++) {
    await db.execAsync(
      `BEGIN; ${MIGRATIONS[version]} PRAGMA user_version = ${version + 1}; COMMIT;`,
    );
  }
}

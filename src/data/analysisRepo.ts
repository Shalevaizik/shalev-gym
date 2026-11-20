import { toKg, type WeightUnit } from '../domain/exerciseLog';
import { monthBounds, type BodyWeightEntry, type TrainingWorkout } from '../domain/training';
import type { Db } from './db';
import { assemble, type ExerciseRow, type SetRow } from './exerciseRepo';

type WorkoutRow = { id: string; started_at: string; ended_at: string | null; title: string | null };

// Every workout of this trainer with its exercises and sets, oldest first: what Analyse and the
// next-exercise suggestions look back over. A trainer logs a few hundred workouts at most, so one
// read is enough.
export async function loadTraining(db: Db, userId: string): Promise<TrainingWorkout[]> {
  const workouts = await db.getAllAsync<WorkoutRow>(
    'SELECT id, started_at, ended_at, title FROM workouts WHERE user_id = ? ORDER BY started_at',
    [userId],
  );
  const exercises = await db.getAllAsync<ExerciseRow>(
    'SELECT * FROM exercises WHERE user_id = ? ORDER BY workout_id, position',
    [userId],
  );
  const sets = await db.getAllAsync<SetRow>(
    `SELECT s.* FROM exercise_sets s JOIN exercises e ON e.id = s.exercise_id
     WHERE e.user_id = ? ORDER BY s.position`,
    [userId],
  );
  const byWorkout = new Map<string, TrainingWorkout['exercises']>();
  for (const exercise of assemble(exercises, sets)) {
    const list = byWorkout.get(exercise.workoutId) ?? [];
    list.push(exercise);
    byWorkout.set(exercise.workoutId, list);
  }
  return workouts.map((w) => ({
    id: w.id,
    startedAt: w.started_at,
    endedAt: w.ended_at,
    title: w.title,
    exercises: byWorkout.get(w.id) ?? [],
  }));
}

export async function listBodyWeights(db: Db, userId: string): Promise<BodyWeightEntry[]> {
  const rows = await db.getAllAsync<{ weight: number; unit: WeightUnit; recorded_at: string }>(
    'SELECT weight, unit, recorded_at FROM body_weights WHERE user_id = ? ORDER BY recorded_at',
    [userId],
  );
  return rows.map((row) => ({ kg: toKg(row.weight, row.unit), at: row.recorded_at }));
}

export async function summarySeenMonth(db: Db, userId: string): Promise<string | null> {
  const row = await db.getFirstAsync<{ summary_seen_month: string | null }>(
    'SELECT summary_seen_month FROM profiles WHERE user_id = ?',
    [userId],
  );
  return row?.summary_seen_month ?? null;
}

// Called when the trainer opens a month's summary; only a later month is announced again.
export async function markSummarySeen(db: Db, userId: string, month: string, now: Date): Promise<void> {
  await db.runAsync(
    `INSERT INTO profiles (user_id, summary_seen_month, updated_at) VALUES (?, ?, ?)
     ON CONFLICT (user_id) DO UPDATE SET summary_seen_month = MAX(COALESCE(summary_seen_month, ''), excluded.summary_seen_month)`,
    [userId, month, now.toISOString()],
  );
}

// Whether the trainer finished any workout in a calendar month (local time).
export async function monthHasWorkouts(db: Db, userId: string, month: string): Promise<boolean> {
  const { start, end } = monthBounds(month);
  const row = await db.getFirstAsync<{ found: number }>(
    `SELECT 1 AS found FROM workouts WHERE user_id = ? AND ended_at IS NOT NULL
       AND started_at >= ? AND started_at < ? LIMIT 1`,
    [userId, start.toISOString(), end.toISOString()],
  );
  return row !== null;
}

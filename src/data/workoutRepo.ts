import { isStale, type EndReason, type Workout } from '../domain/workout';
import { workoutTitle, type TitleInput } from '../domain/workoutTitle';
import type { Db } from './db';

type WorkoutRow = {
  id: string;
  user_id: string;
  started_at: string;
  ended_at: string | null;
  last_activity_at: string;
  end_reason: EndReason | null;
  title: string | null;
  focus: string | null;
};

const toWorkout = (row: WorkoutRow): Workout => ({
  id: row.id,
  userId: row.user_id,
  startedAt: row.started_at,
  endedAt: row.ended_at,
  lastActivityAt: row.last_activity_at,
  endReason: row.end_reason,
  title: row.title,
  focus: row.focus,
});

export async function getActiveWorkout(db: Db, userId: string): Promise<Workout | null> {
  const row = await db.getFirstAsync<WorkoutRow>(
    'SELECT * FROM workouts WHERE user_id = ? AND ended_at IS NULL',
    [userId],
  );
  return row ? toWorkout(row) : null;
}

export async function getWorkout(db: Db, userId: string, id: string): Promise<Workout | null> {
  const row = await db.getFirstAsync<WorkoutRow>(
    'SELECT * FROM workouts WHERE user_id = ? AND id = ?',
    [userId, id],
  );
  return row ? toWorkout(row) : null;
}

export async function listWorkouts(db: Db, userId: string): Promise<Workout[]> {
  const rows = await db.getAllAsync<WorkoutRow>(
    'SELECT * FROM workouts WHERE user_id = ? ORDER BY started_at DESC',
    [userId],
  );
  return rows.map(toWorkout);
}

// Closes an abandoned workout at its last activity, so idle hours don't count as training time.
export async function closeStaleWorkout(db: Db, userId: string, now: Date): Promise<void> {
  const active = await getActiveWorkout(db, userId);
  if (!active || !isStale(active, now)) return;
  await db.runAsync(
    `UPDATE workouts SET ended_at = last_activity_at, end_reason = 'auto'
     WHERE id = ? AND ended_at IS NULL`,
    [active.id],
  );
}

// Returns the workout already in progress, if any, rather than opening a second one.
export async function startWorkout(
  db: Db,
  userId: string,
  newId: string,
  now: Date,
): Promise<Workout> {
  await closeStaleWorkout(db, userId, now);
  const timestamp = now.toISOString();
  await db.runAsync(
    `INSERT OR IGNORE INTO workouts (id, user_id, started_at, last_activity_at)
     VALUES (?, ?, ?, ?)`,
    [newId, userId, timestamp, timestamp],
  );
  const active = await getActiveWorkout(db, userId);
  if (!active) throw new Error('The workout could not be saved.');
  return active;
}

export async function endWorkout(db: Db, userId: string, id: string, now: Date): Promise<void> {
  const result = await db.runAsync(
    `UPDATE workouts SET ended_at = ?, end_reason = 'user'
     WHERE user_id = ? AND id = ? AND ended_at IS NULL`,
    [now.toISOString(), userId, id],
  );
  if (result.changes === 0) return;
  // An exercise chosen but never done is dropped; the rest are finished with the workout.
  await db.runAsync(
    `DELETE FROM exercises WHERE workout_id = ? AND finished_at IS NULL
       AND NOT EXISTS (SELECT 1 FROM exercise_sets s WHERE s.exercise_id = exercises.id)`,
    [id],
  );
  await db.runAsync('UPDATE exercises SET finished_at = ? WHERE workout_id = ? AND finished_at IS NULL', [
    now.toISOString(),
    id,
  ]);
}

// Deletes a workout with its exercises and sets, all or nothing. Only the owner can.
export async function deleteWorkout(db: Db, userId: string, id: string): Promise<void> {
  await db.execAsync('BEGIN');
  try {
    const owned = await db.getFirstAsync<{ id: string }>(
      'SELECT id FROM workouts WHERE user_id = ? AND id = ?',
      [userId, id],
    );
    if (owned) {
      await db.runAsync(
        'DELETE FROM exercise_sets WHERE exercise_id IN (SELECT id FROM exercises WHERE workout_id = ?)',
        [id],
      );
      await db.runAsync('DELETE FROM exercises WHERE workout_id = ?', [id]);
      await db.runAsync('DELETE FROM workouts WHERE id = ?', [id]);
    }
    await db.execAsync('COMMIT');
  } catch (error) {
    await db.execAsync('ROLLBACK');
    throw error;
  }
}

// The title the app gives each workout from the exercises logged in it (requirement 21), by
// workout id. Worked out when shown, so it stays right after an exercise is edited.
export async function autoTitles(db: Db, userId: string): Promise<Map<string, string>> {
  const rows = await db.getAllAsync<{ workout_id: string; name: string; muscle: string | null; sets: number }>(
    `SELECT e.workout_id, e.name, e.muscle, COUNT(s.id) AS sets
     FROM exercises e LEFT JOIN exercise_sets s ON s.exercise_id = e.id
     WHERE e.user_id = ? GROUP BY e.id ORDER BY e.workout_id, e.position`,
    [userId],
  );
  const byWorkout = new Map<string, TitleInput[]>();
  for (const row of rows) {
    const list = byWorkout.get(row.workout_id) ?? [];
    list.push({ name: row.name, muscle: row.muscle, sets: row.sets });
    byWorkout.set(row.workout_id, list);
  }
  return new Map([...byWorkout].map(([id, exercises]) => [id, workoutTitle(exercises)]));
}

// A title the trainer chose; null or blank goes back to the app's own title.
export async function renameWorkout(db: Db, userId: string, id: string, title: string | null): Promise<void> {
  const clean = title?.trim() || null;
  await db.runAsync('UPDATE workouts SET title = ? WHERE user_id = ? AND id = ?', [clean, userId, id]);
}

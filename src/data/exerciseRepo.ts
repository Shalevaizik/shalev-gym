import {
  DEFAULT_BAR_KG,
  EZ_BAR_KG,
  kindFor,
  saysEzBar,
  type Equipment,
  type ExerciseKind,
  type Measure,
} from '../domain/equipment';
import {
  estimateSetTimes,
  toKg,
  type LoggedExercise,
  type LoggedSet,
  type ParsedSet,
  type Technique,
  type WeightUnit,
} from '../domain/exerciseLog';
import type { Db } from './db';

export type ExerciseRow = {
  id: string;
  workout_id: string;
  position: number;
  name: string;
  technique: Technique | null;
  superset_group: string | null;
  spoken_text: string | null;
  muscle: string | null;
  created_at: string;
  finished_at: string | null;
  equipment: Equipment | null;
  measure: Measure;
  bar_kg: number | null;
};

export type SetRow = {
  id: string;
  exercise_id: string;
  weight: number | null;
  unit: WeightUnit | null;
  reps: number | null;
  to_failure: number;
  started_at: string | null;
  ended_at: string | null;
  duration_s: number | null;
};

const toSet = (row: SetRow): LoggedSet => ({
  id: row.id,
  weight: row.weight,
  unit: row.unit,
  reps: row.reps,
  toFailure: row.to_failure === 1,
  ...(row.duration_s !== null && { durationS: row.duration_s }),
  startedAt: row.started_at,
  endedAt: row.ended_at,
});

export function assemble(exercises: ExerciseRow[], sets: SetRow[]): LoggedExercise[] {
  const byExercise = new Map<string, LoggedSet[]>();
  for (const row of sets) {
    const list = byExercise.get(row.exercise_id) ?? [];
    list.push(toSet(row));
    byExercise.set(row.exercise_id, list);
  }
  return exercises.map((row) => ({
    id: row.id,
    workoutId: row.workout_id,
    name: row.name,
    technique: row.technique,
    supersetGroup: row.superset_group,
    spokenText: row.spoken_text,
    muscle: row.muscle,
    createdAt: row.created_at,
    finishedAt: row.finished_at,
    equipment: row.equipment,
    measure: row.measure,
    barKg: row.bar_kg,
    sets: byExercise.get(row.id) ?? [],
  }));
}

export async function listExercises(
  db: Db,
  userId: string,
  workoutId: string,
): Promise<LoggedExercise[]> {
  const exercises = await db.getAllAsync<ExerciseRow>(
    'SELECT * FROM exercises WHERE user_id = ? AND workout_id = ? ORDER BY position',
    [userId, workoutId],
  );
  const sets = await db.getAllAsync<SetRow>(
    `SELECT s.* FROM exercise_sets s JOIN exercises e ON e.id = s.exercise_id
     WHERE e.user_id = ? AND e.workout_id = ? ORDER BY s.position`,
    [userId, workoutId],
  );
  return assemble(exercises, sets);
}

export async function getExercise(
  db: Db,
  userId: string,
  exerciseId: string,
): Promise<LoggedExercise | null> {
  const row = await db.getFirstAsync<ExerciseRow>(
    'SELECT * FROM exercises WHERE user_id = ? AND id = ?',
    [userId, exerciseId],
  );
  if (!row) return null;
  const sets = await db.getAllAsync<SetRow>(
    'SELECT * FROM exercise_sets WHERE exercise_id = ? ORDER BY position',
    [exerciseId],
  );
  return assemble([row], sets)[0];
}

async function inTransaction<T>(db: Db, work: () => Promise<T>): Promise<T> {
  await db.execAsync('BEGIN');
  try {
    const result = await work();
    await db.execAsync('COMMIT');
    return result;
  } catch (error) {
    await db.execAsync('ROLLBACK');
    throw error;
  }
}

async function insertSet(
  db: Db,
  id: string,
  exerciseId: string,
  userId: string,
  position: number,
  set: ParsedSet,
  times: { startedAt: string | null; endedAt: string | null },
) {
  await db.runAsync(
    `INSERT INTO exercise_sets
       (id, exercise_id, user_id, position, weight, unit, reps, to_failure, started_at, ended_at, duration_s)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      exerciseId,
      userId,
      position,
      set.weight,
      set.weight === null ? null : set.unit,
      set.reps,
      set.toFailure ? 1 : 0,
      times.startedAt,
      times.endedAt,
      set.durationS ? Math.round(set.durationS) : null,
    ],
  );
}

async function openWorkout(db: Db, userId: string, workoutId: string) {
  const workout = await db.getFirstAsync<{ started_at: string; ended_at: string | null }>(
    'SELECT started_at, ended_at FROM workouts WHERE user_id = ? AND id = ?',
    [userId, workoutId],
  );
  if (!workout) throw new Error('The workout could not be found.');
  if (workout.ended_at !== null) throw new Error('This workout has already ended.');
  return workout;
}

async function touchWorkout(db: Db, workoutId: string, at: Date) {
  await db.runAsync('UPDATE workouts SET last_activity_at = ? WHERE id = ?', [at.toISOString(), workoutId]);
}

// Finishes the exercises in progress. One that never got a set is removed, since it was
// chosen and then not done.
async function closeOpenExercises(db: Db, workoutId: string, at: Date) {
  await db.runAsync(
    `DELETE FROM exercises WHERE workout_id = ? AND finished_at IS NULL
       AND NOT EXISTS (SELECT 1 FROM exercise_sets s WHERE s.exercise_id = exercises.id)`,
    [workoutId],
  );
  await db.runAsync('UPDATE exercises SET finished_at = ? WHERE workout_id = ? AND finished_at IS NULL', [
    at.toISOString(),
    workoutId,
  ]);
}

// Equipment and measure come from the exercise's name (see kindFor) unless given.
export type NewExercise = { name: string; muscle: string | null; kind?: ExerciseKind };

// Starts the exercise the trainer confirmed, or two or more done as a superset. The ones in
// progress are finished first. Returns the new exercises' ids, in order.
export async function startExercise(
  db: Db,
  userId: string,
  workoutId: string,
  exercises: NewExercise[],
  spokenText: string | null,
  at: Date,
  newId: () => string,
): Promise<string[]> {
  const names = exercises.map((e) => ({ ...e, name: e.name.trim() }));
  if (names.length === 0 || names.some((e) => !e.name)) throw new Error('The exercise needs a name.');
  return inTransaction(db, async () => {
    await openWorkout(db, userId, workoutId);
    await closeOpenExercises(db, workoutId, at);
    const last = await db.getFirstAsync<{ position: number | null }>(
      'SELECT MAX(position) AS position FROM exercises WHERE workout_id = ?',
      [workoutId],
    );
    let position = (last?.position ?? -1) + 1;
    const supersetGroup = names.length > 1 ? newId() : null;
    const ids: string[] = [];
    for (const exercise of names) {
      const id = newId();
      const kind = exercise.kind ?? kindFor(exercise.name);
      // The trainer's own bar weight for this exercise (requirement 17a), else the usual one.
      const ownBar =
        kind.equipment === 'barbell'
          ? await db.getFirstAsync<{ bar_kg: number }>(
              'SELECT bar_kg FROM bar_weights WHERE user_id = ? AND exercise = ?',
              [userId, exercise.name.toLowerCase()],
            )
          : null;
      await db.runAsync(
        `INSERT INTO exercises
           (id, workout_id, user_id, position, name, technique, superset_group, spoken_text, muscle, created_at,
            finished_at, equipment, measure, bar_kg)
         VALUES (?, ?, ?, ?, ?, NULL, ?, ?, ?, ?, NULL, ?, ?, ?)`,
        [
          id,
          workoutId,
          userId,
          position++,
          exercise.name,
          supersetGroup,
          spokenText,
          exercise.muscle,
          at.toISOString(),
          kind.equipment,
          kind.measure,
          kind.equipment === 'barbell'
            ? // Saying "EZ bar" picks it for this exercise, over the usual bar (requirement 17a).
              saysEzBar(spokenText)
              ? EZ_BAR_KG
              : (ownBar?.bar_kg ?? kind.barKg ?? DEFAULT_BAR_KG)
            : null,
        ],
      );
      ids.push(id);
    }
    await touchWorkout(db, workoutId, at);
    return ids;
  });
}

// Adds the sets the trainer just said to an exercise in progress. The set ended about when
// they tapped Record; its start is estimated from the reps (requirement 6b).
export async function logSets(
  db: Db,
  userId: string,
  exerciseId: string,
  sets: ParsedSet[],
  technique: Technique | null,
  at: Date,
  newId: () => string,
): Promise<LoggedSet[]> {
  if (sets.length === 0) return [];
  return inTransaction(db, async () => {
    const exercise = await db.getFirstAsync<ExerciseRow>(
      'SELECT * FROM exercises WHERE user_id = ? AND id = ?',
      [userId, exerciseId],
    );
    if (!exercise) throw new Error('The exercise could not be found.');
    const workout = await openWorkout(db, userId, exercise.workout_id);

    const lastSet = await db.getFirstAsync<{ ended_at: string | null }>(
      `SELECT MAX(s.ended_at) AS ended_at FROM exercise_sets s
       JOIN exercises e ON e.id = s.exercise_id WHERE e.workout_id = ?`,
      [exercise.workout_id],
    );
    const windowStart = new Date(lastSet?.ended_at ?? exercise.created_at ?? workout.started_at);
    const times = estimateSetTimes([{ name: exercise.name, sets, technique }], false, windowStart, at);
    const count = await db.getFirstAsync<{ n: number }>(
      'SELECT COUNT(*) AS n FROM exercise_sets WHERE exercise_id = ?',
      [exerciseId],
    );

    const saved: LoggedSet[] = [];
    for (const [index, set] of sets.entries()) {
      const id = newId();
      const time = { startedAt: times[index]?.startedAt ?? null, endedAt: times[index]?.endedAt ?? null };
      await insertSet(db, id, exerciseId, userId, (count?.n ?? 0) + index, set, time);
      saved.push({ ...set, unit: set.weight === null ? null : set.unit, id, ...time });
    }
    if (technique && !exercise.technique) {
      await db.runAsync('UPDATE exercises SET technique = ? WHERE id = ?', [technique, exerciseId]);
    }
    if (exercise.finished_at !== null) {
      await db.runAsync('UPDATE exercises SET finished_at = NULL WHERE id = ?', [exerciseId]);
    }
    await touchWorkout(db, exercise.workout_id, at);
    return saved;
  });
}

// Removes the most recent set of an exercise ("undo") and returns it.
export async function deleteLastSet(
  db: Db,
  userId: string,
  exerciseId: string,
): Promise<LoggedSet | null> {
  const row = await db.getFirstAsync<SetRow>(
    `SELECT s.* FROM exercise_sets s JOIN exercises e ON e.id = s.exercise_id
     WHERE e.user_id = ? AND s.exercise_id = ? ORDER BY s.position DESC LIMIT 1`,
    [userId, exerciseId],
  );
  if (!row) return null;
  await db.runAsync('DELETE FROM exercise_sets WHERE id = ?', [row.id]);
  return toSet(row);
}

// "Next exercise": finishes what is in progress so the trainer can choose the next one.
export async function finishExercises(db: Db, userId: string, workoutId: string, at: Date): Promise<void> {
  await inTransaction(db, async () => {
    await openWorkout(db, userId, workoutId);
    await closeOpenExercises(db, workoutId, at);
  });
}

// Goes back to an earlier exercise of this workout to add more sets to it.
export async function resumeExercise(
  db: Db,
  userId: string,
  exerciseId: string,
  at: Date,
): Promise<void> {
  await inTransaction(db, async () => {
    const exercise = await db.getFirstAsync<ExerciseRow>(
      'SELECT * FROM exercises WHERE user_id = ? AND id = ?',
      [userId, exerciseId],
    );
    if (!exercise) throw new Error('The exercise could not be found.');
    await openWorkout(db, userId, exercise.workout_id);
    await closeOpenExercises(db, exercise.workout_id, at);
    if (exercise.superset_group) {
      await db.runAsync('UPDATE exercises SET finished_at = NULL WHERE workout_id = ? AND superset_group = ?', [
        exercise.workout_id,
        exercise.superset_group,
      ]);
    } else {
      await db.runAsync('UPDATE exercises SET finished_at = NULL WHERE id = ?', [exerciseId]);
    }
  });
}

// Exercise names this trainer used before, newest first: quick picks and better matching.
export async function recentExerciseNames(db: Db, userId: string, limit = 12): Promise<string[]> {
  const rows = await db.getAllAsync<{ name: string }>(
    `SELECT name FROM exercises WHERE user_id = ?
     GROUP BY lower(name) ORDER BY MAX(created_at) DESC LIMIT ?`,
    [userId, limit],
  );
  return rows.map((row) => row.name);
}

export type ExerciseEdit = {
  name: string;
  technique: Technique | null;
  sets: (ParsedSet & { id?: string })[];
  // Left out to keep what the exercise has.
  kind?: ExerciseKind;
};

// Replaces an exercise's name and sets with the edited version. Sets that were kept keep their
// times; sets added by hand have none, since the app cannot know when they were done.
export async function updateExercise(
  db: Db,
  userId: string,
  exerciseId: string,
  edit: ExerciseEdit,
  newId: () => string,
): Promise<void> {
  const name = edit.name.trim();
  if (!name) throw new Error('The exercise needs a name.');
  await inTransaction(db, async () => {
    const existing = await getExercise(db, userId, exerciseId);
    if (!existing) throw new Error('The exercise could not be found.');

    await db.runAsync('UPDATE exercises SET name = ?, technique = ? WHERE id = ?', [
      name,
      edit.technique,
      exerciseId,
    ]);
    if (edit.kind) {
      await db.runAsync('UPDATE exercises SET equipment = ?, measure = ?, bar_kg = ? WHERE id = ?', [
        edit.kind.equipment,
        edit.kind.measure,
        edit.kind.equipment === 'barbell' ? (edit.kind.barKg ?? DEFAULT_BAR_KG) : null,
        exerciseId,
      ]);
    }

    const kept = new Map(existing.sets.map((set) => [set.id, set]));
    await db.runAsync('DELETE FROM exercise_sets WHERE exercise_id = ?', [exerciseId]);
    for (const [position, set] of edit.sets.entries()) {
      const previous = set.id ? kept.get(set.id) : undefined;
      await insertSet(db, previous?.id ?? newId(), exerciseId, userId, position, set, {
        startedAt: previous?.startedAt ?? null,
        endedAt: previous?.endedAt ?? null,
      });
    }
  });
}

export async function deleteExercise(db: Db, userId: string, exerciseId: string): Promise<void> {
  await inTransaction(db, async () => {
    const owned = await db.getFirstAsync<{ id: string }>(
      'SELECT id FROM exercises WHERE user_id = ? AND id = ?',
      [userId, exerciseId],
    );
    if (!owned) return;
    await db.runAsync('DELETE FROM exercise_sets WHERE exercise_id = ?', [exerciseId]);
    await db.runAsync('DELETE FROM exercises WHERE id = ?', [exerciseId]);
  });
}

// The weights recently said for an exercise, in kg, newest first: how heavy the trainer usually
// goes, to catch a misheard number (requirement 15e).
export async function recentWeightsKg(
  db: Db,
  userId: string,
  name: string,
  excludeExerciseId: string | null,
  // Weights only compare within one equipment type: "20" per side is not "20" on the machine.
  equipment: Equipment | null = null,
  limit = 12,
): Promise<number[]> {
  const rows = await db.getAllAsync<{ weight: number; unit: WeightUnit }>(
    `SELECT s.weight, s.unit FROM exercise_sets s JOIN exercises e ON e.id = s.exercise_id
     WHERE e.user_id = ? AND lower(e.name) = lower(?) AND e.id IS NOT ? AND e.equipment IS ?
       AND s.weight IS NOT NULL AND s.unit IS NOT NULL
     ORDER BY s.ended_at DESC LIMIT ?`,
    [userId, name, excludeExerciseId, equipment, limit],
  );
  return rows.map((row) => toKg(row.weight, row.unit));
}

// ---------------------------------------------------------------------------
// Corrections the trainer made to what the app heard (requirement 15d)

export async function getCorrections(db: Db, userId: string): Promise<Map<string, string>> {
  const rows = await db.getAllAsync<{ heard: string; name: string }>(
    'SELECT heard, name FROM name_corrections WHERE user_id = ?',
    [userId],
  );
  return new Map(rows.map((row) => [row.heard, row.name]));
}

export async function recordCorrection(db: Db, userId: string, heard: string, name: string, at: Date): Promise<void> {
  const key = heard.trim().toLowerCase();
  if (!key || key === name.trim().toLowerCase()) return;
  await db.runAsync(
    `INSERT INTO name_corrections (user_id, heard, name, updated_at) VALUES (?, ?, ?, ?)
     ON CONFLICT (user_id, heard) DO UPDATE SET name = excluded.name, updated_at = excluded.updated_at`,
    [userId, key, name.trim(), at.toISOString()],
  );
}

// ---------------------------------------------------------------------------
// Bar weights per exercise (requirement 17a), set in the menu

export type BarWeight = { name: string; barKg: number; own: boolean };

// The barbell exercises this trainer has done, with the bar weight each one uses.
export async function listBarWeights(db: Db, userId: string): Promise<BarWeight[]> {
  const done = await db.getAllAsync<{ name: string }>(
    `SELECT name FROM exercises WHERE user_id = ? AND equipment = 'barbell'
     GROUP BY lower(name) ORDER BY lower(name)`,
    [userId],
  );
  const own = await db.getAllAsync<{ exercise: string; bar_kg: number }>(
    'SELECT exercise, bar_kg FROM bar_weights WHERE user_id = ?',
    [userId],
  );
  const set = new Map(own.map((row) => [row.exercise, row.bar_kg]));
  return done.map(({ name }) => {
    const mine = set.get(name.toLowerCase());
    return { name, barKg: mine ?? kindFor(name).barKg ?? DEFAULT_BAR_KG, own: mine !== undefined };
  });
}

// Sets the bar weight for an exercise from now on, and for its exercise in a workout in progress.
// Null goes back to the usual bar.
export async function setBarWeight(db: Db, userId: string, name: string, barKg: number | null): Promise<void> {
  const key = name.trim().toLowerCase();
  if (barKg === null) {
    await db.runAsync('DELETE FROM bar_weights WHERE user_id = ? AND exercise = ?', [userId, key]);
  } else {
    await db.runAsync(
      `INSERT INTO bar_weights (user_id, exercise, bar_kg) VALUES (?, ?, ?)
       ON CONFLICT (user_id, exercise) DO UPDATE SET bar_kg = excluded.bar_kg`,
      [userId, key, barKg],
    );
  }
  await db.runAsync(
    `UPDATE exercises SET bar_kg = ? WHERE user_id = ? AND lower(name) = ? AND equipment = 'barbell'
       AND workout_id IN (SELECT id FROM workouts WHERE ended_at IS NULL)`,
    [barKg ?? kindFor(name).barKg ?? DEFAULT_BAR_KG, userId, key],
  );
}

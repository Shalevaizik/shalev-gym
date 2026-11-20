// Progress per exercise over time (Analyse → Progress): the best set of each workout, and which
// ones were personal records.

import { formatDurationS } from './equipment';
import type { LoggedExercise } from './exerciseLog';
import { bodyKgOn, setLoadKg, type BodyWeightEntry, type TrainingWorkout } from './training';

export type ProgressMetric = 'kg' | 'reps' | 'seconds';

export type ProgressPoint = {
  workoutId: string;
  date: string;
  value: number;
  // The best set, in words: "100 kg × 8 reps", "1 min 30 s".
  label: string;
  record: boolean;
};

export type ExerciseProgress = { name: string; metric: ProgressMetric; points: ProgressPoint[] };

const round1 = (n: number) => Math.round(n * 10) / 10;

// Timed exercises compare time; exercises with a known load compare the heaviest load; bodyweight
// exercises without a body weight compare reps.
function metricFor(exercises: { exercise: LoggedExercise; bodyKg: number | null }[]): ProgressMetric {
  if (exercises.some(({ exercise }) => exercise.measure === 'time')) return 'seconds';
  const anyLoad = exercises.some(({ exercise, bodyKg }) =>
    exercise.sets.some((set) => setLoadKg(set, exercise, bodyKg) !== null),
  );
  return anyLoad ? 'kg' : 'reps';
}

export function exerciseProgress(name: string, workouts: TrainingWorkout[], weights: BodyWeightEntry[]): ExerciseProgress {
  const key = name.trim().toLowerCase();
  const sessions = workouts
    .filter((w) => w.endedAt !== null)
    .sort((a, b) => a.startedAt.localeCompare(b.startedAt))
    .flatMap((w) => {
      const bodyKg = bodyKgOn(weights, w.startedAt);
      return w.exercises
        .filter((e) => e.name.trim().toLowerCase() === key && e.sets.length > 0)
        .map((exercise) => ({ workout: w, exercise, bodyKg }));
    });
  const metric = metricFor(sessions);

  let best = -Infinity;
  const points: ProgressPoint[] = [];
  for (const { workout, exercise, bodyKg } of sessions) {
    let value = -Infinity;
    let label = '';
    for (const set of exercise.sets) {
      if (metric === 'seconds' && set.durationS != null && set.durationS > value) {
        value = set.durationS;
        label = formatDurationS(set.durationS);
      } else if (metric === 'reps' && set.reps !== null && set.reps > value) {
        value = set.reps;
        label = `${set.reps} reps`;
      } else if (metric === 'kg') {
        const load = setLoadKg(set, exercise, bodyKg);
        if (load !== null && load > value) {
          value = load;
          label = `${round1(load)} kg${set.reps !== null ? ` × ${set.reps} reps` : ''}`;
        }
      }
    }
    if (value === -Infinity) continue;
    const record = points.length > 0 && value > best;
    best = Math.max(best, value);
    points.push({ workoutId: workout.id, date: workout.startedAt, value: round1(value), label, record });
  }
  return { name: sessions[0]?.exercise.name ?? name, metric, points };
}

// Every exercise the trainer has done, most recent first, with how many workouts it was in.
export function exercisesDone(workouts: TrainingWorkout[]): { name: string; workouts: number; last: string }[] {
  const seen = new Map<string, { name: string; workouts: Set<string>; last: string }>();
  for (const w of workouts) {
    if (w.endedAt === null) continue;
    for (const e of w.exercises) {
      if (e.sets.length === 0) continue;
      const key = e.name.trim().toLowerCase();
      const entry = seen.get(key) ?? { name: e.name, workouts: new Set<string>(), last: w.startedAt };
      entry.workouts.add(w.id);
      if (w.startedAt > entry.last) entry.last = w.startedAt;
      seen.set(key, entry);
    }
  }
  return [...seen.values()]
    .sort((a, b) => b.last.localeCompare(a.last))
    .map((e) => ({ name: e.name, workouts: e.workouts.size, last: e.last }));
}

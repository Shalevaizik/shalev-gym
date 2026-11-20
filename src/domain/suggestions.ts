// Suggests the next exercise during a workout (requirement 16): from the muscle groups trained so
// far, what the trainer did in past workouts with a similar focus, leaving out what's done today.

import { CATALOG, muscleOf, type Muscle } from './exerciseCatalog';
import type { TrainingWorkout } from './training';
import { workoutTitle } from './workoutTitle';

// Muscle groups usually trained together, so a chest day can suggest triceps.
const RELATED: Partial<Record<Muscle, Muscle[]>> = {
  Chest: ['Triceps', 'Shoulders'],
  Shoulders: ['Chest', 'Triceps'],
  Triceps: ['Chest', 'Shoulders'],
  Back: ['Biceps', 'Shoulders'],
  Biceps: ['Back', 'Forearms'],
  Forearms: ['Biceps'],
  Quads: ['Hamstrings', 'Glutes', 'Calves'],
  Hamstrings: ['Quads', 'Glutes', 'Calves'],
  Glutes: ['Quads', 'Hamstrings'],
  Calves: ['Quads', 'Hamstrings'],
};

export type Suggestion = { name: string; muscle: Muscle | null };
export type Suggestions = { focus: string; options: Suggestion[] };

type Current = { name: string; muscle: string | null };

const mainMuscle = (e: Current): Muscle | null => (e.muscle as Muscle | null) ?? muscleOf(e.name);

export function suggestNext(current: Current[], past: TrainingWorkout[], limit = 3): Suggestions | null {
  const focus = new Set(current.map(mainMuscle).filter((m): m is Muscle => m !== null));
  if (focus.size === 0) return null;
  const related = new Set([...focus].flatMap((m) => RELATED[m] ?? []).filter((m) => !focus.has(m)));
  const done = new Set(current.map((e) => e.name.trim().toLowerCase()));

  const scores = new Map<string, { option: Suggestion; score: number }>();
  const add = (name: string, muscle: Muscle | null, score: number) => {
    const key = name.trim().toLowerCase();
    if (done.has(key) || score <= 0) return;
    const entry = scores.get(key) ?? { option: { name, muscle }, score: 0 };
    entry.score += score;
    scores.set(key, entry);
  };
  const weightOf = (muscle: Muscle | null) => (muscle && focus.has(muscle) ? 1 : muscle && related.has(muscle) ? 0.6 : 0);

  // Past workouts count more the more their muscle groups overlap with today's.
  for (const workout of past) {
    const muscles = new Set(workout.exercises.map(mainMuscle).filter((m): m is Muscle => m !== null));
    const overlap = [...focus].filter((m) => muscles.has(m)).length / focus.size;
    if (overlap === 0) continue;
    for (const exercise of workout.exercises) {
      if (exercise.sets.length === 0) continue;
      const muscle = mainMuscle(exercise);
      add(exercise.name, muscle, overlap * weightOf(muscle));
    }
  }
  // Common exercises fill in when there is little history.
  CATALOG.forEach((entry, index) => add(entry.name, entry.muscle, weightOf(entry.muscle) * 0.05 - index * 0.0001));

  const options = [...scores.values()]
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((s) => s.option);
  return { focus: workoutTitle(current.map((e) => ({ ...e, sets: 1 }))), options };
}

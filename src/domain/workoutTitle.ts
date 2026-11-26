// Names a workout from the muscle groups it trained (requirements 9 and 21), so the trainer
// never has to: "Push · Chest & Triceps", "Pull · Back & Biceps", "Legs", "Upper Body".

import { muscleOf, type Muscle } from './exerciseCatalog';

export type TitleInput = { name: string; muscle: string | null; sets: number };

const LEGS: Muscle[] = ['Quads', 'Hamstrings', 'Glutes', 'Calves'];
const UPPER: Muscle[] = ['Chest', 'Back', 'Shoulders', 'Biceps', 'Triceps', 'Forearms'];
const PUSH: Muscle[] = ['Chest', 'Shoulders', 'Triceps'];
const PULL: Muscle[] = ['Back', 'Biceps', 'Forearms'];

// A muscle group counts toward the title when it got at least this share of the upper-body sets.
const SIGNIFICANT = 0.15;

function joinNames(names: string[]): string {
  if (names.length <= 1) return names.join('');
  return `${names.slice(0, -1).join(', ')} & ${names.at(-1)}`;
}

function isMuscle(value: string | null): value is Muscle {
  return value !== null && [...LEGS, ...UPPER, 'Core', 'Full body', 'Cardio'].includes(value);
}

// A cardio session (a treadmill warm-up) adds "+ Cardio" to the title; cardio alone is "Cardio".
export function workoutTitle(exercises: TitleInput[]): string {
  const cardio = exercises.some(
    (e) => (isMuscle(e.muscle) ? e.muscle : muscleOf(e.name)) === 'Cardio',
  );
  const title = strengthTitle(exercises);
  if (!cardio) return title;
  return title === 'Workout' ? 'Cardio' : `${title} + Cardio`;
}

// The workout's title without its cardio: "Legs + Cardio" is a Legs day.
export const withoutCardio = (title: string) => title.replace(/ \+ Cardio$/, '');

function strengthTitle(exercises: TitleInput[]): string {
  const sets = new Map<Muscle, number>();
  for (const exercise of exercises) {
    const muscle = isMuscle(exercise.muscle) ? exercise.muscle : muscleOf(exercise.name);
    if (!muscle || muscle === 'Cardio') continue;
    // An exercise chosen but not yet logged still says what the workout was about.
    sets.set(muscle, (sets.get(muscle) ?? 0) + Math.max(1, exercise.sets));
  }

  const sum = (group: Muscle[]) => group.reduce((total, m) => total + (sets.get(m) ?? 0), 0);
  const legs = sum(LEGS);
  const upper = sum(UPPER);
  const core = sets.get('Core') ?? 0;
  const fullBody = sets.get('Full body') ?? 0;
  const total = legs + upper + core + fullBody;

  if (total === 0) return 'Workout';
  if (core / total > 0.5) return 'Core';
  if (fullBody / total >= 0.5) return 'Full Body';

  const trained = legs + upper;
  if (trained === 0) return 'Full Body';
  if (legs / trained >= 0.25 && upper / trained >= 0.25) return 'Full Body';
  if (legs >= upper) return 'Legs';

  const groups = UPPER.filter((m) => (sets.get(m) ?? 0) / upper >= SIGNIFICANT).sort(
    (a, b) => (sets.get(b) ?? 0) - (sets.get(a) ?? 0) || UPPER.indexOf(a) - UPPER.indexOf(b),
  );
  const described = joinNames(groups);

  if (groups.length >= 2 && groups.every((m) => PUSH.includes(m))) return `Push · ${described}`;
  if (groups.length >= 2 && groups.includes('Back') && groups.every((m) => PULL.includes(m))) {
    return `Pull · ${described}`;
  }
  if (groups.length >= 3) return 'Upper Body';
  return described;
}

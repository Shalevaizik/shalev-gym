// Which muscle groups an exercise trains, and how many hard sets each group got (requirement 19c):
// a set counts fully for the exercise's main muscle group and half for each helper group.

import { muscleOf, type Muscle } from './exerciseCatalog';

// The groups shown on the body map. "Full body" is spread over the big groups instead.
export const BODY_MUSCLES = [
  'Chest',
  'Back',
  'Shoulders',
  'Biceps',
  'Triceps',
  'Forearms',
  'Core',
  'Quads',
  'Hamstrings',
  'Glutes',
  'Calves',
] as const;
export type BodyMuscle = (typeof BODY_MUSCLES)[number];

const FULL_BODY: BodyMuscle[] = ['Quads', 'Hamstrings', 'Glutes', 'Back', 'Shoulders'];

// Helper muscle groups of the catalog's exercises (lowercase name → groups).
const HELPERS: Record<string, BodyMuscle[]> = {
  'bench press': ['Triceps', 'Shoulders'],
  'dumbbell bench press': ['Triceps', 'Shoulders'],
  'incline bench press': ['Shoulders', 'Triceps'],
  'incline dumbbell press': ['Shoulders', 'Triceps'],
  'decline bench press': ['Triceps'],
  'chest press machine': ['Triceps', 'Shoulders'],
  'push-up': ['Triceps', 'Shoulders', 'Core'],
  dips: ['Triceps', 'Shoulders'],
  deadlift: ['Hamstrings', 'Glutes', 'Forearms'],
  'pull-up': ['Biceps', 'Forearms'],
  'chin-up': ['Biceps', 'Forearms'],
  'lat pulldown': ['Biceps'],
  'close grip lat pulldown': ['Biceps'],
  'barbell row': ['Biceps', 'Shoulders'],
  'dumbbell row': ['Biceps', 'Shoulders'],
  'seated cable row': ['Biceps', 'Shoulders'],
  't-bar row': ['Biceps', 'Shoulders'],
  'machine row': ['Biceps', 'Shoulders'],
  'back extension': ['Glutes', 'Hamstrings'],
  shrugs: ['Forearms'],
  'overhead press': ['Triceps'],
  'dumbbell shoulder press': ['Triceps'],
  'arnold press': ['Triceps'],
  'machine shoulder press': ['Triceps'],
  'rear delt fly': ['Back'],
  'face pull': ['Back'],
  'upright row': ['Back', 'Biceps'],
  'barbell curl': ['Forearms'],
  'dumbbell curl': ['Forearms'],
  'hammer curl': ['Forearms'],
  'ez bar curl': ['Forearms'],
  'close grip bench press': ['Chest', 'Shoulders'],
  'tricep dips': ['Chest', 'Shoulders'],
  "farmer's walk": ['Back', 'Core'],
  squat: ['Glutes', 'Hamstrings', 'Core'],
  'front squat': ['Glutes', 'Core'],
  'leg press': ['Glutes'],
  'hack squat': ['Glutes'],
  'bulgarian split squat': ['Glutes', 'Hamstrings'],
  lunges: ['Glutes', 'Hamstrings'],
  'goblet squat': ['Glutes', 'Core'],
  'step-up': ['Glutes'],
  'romanian deadlift': ['Glutes', 'Back'],
  'good morning': ['Glutes', 'Back'],
  'hip thrust': ['Hamstrings'],
  'hanging leg raise': ['Forearms'],
  'side plank': ['Shoulders'],
};

const isBodyMuscle = (value: string | null): value is BodyMuscle =>
  value !== null && (BODY_MUSCLES as readonly string[]).includes(value);

// The share of one set each muscle group gets from an exercise.
export function muscleShares(name: string, savedMuscle: string | null): Map<BodyMuscle, number> {
  const shares = new Map<BodyMuscle, number>();
  const main: Muscle | null = (savedMuscle as Muscle | null) ?? muscleOf(name);
  if (main === 'Full body') {
    for (const muscle of FULL_BODY) shares.set(muscle, 0.5);
    return shares;
  }
  if (!isBodyMuscle(main)) return shares;
  shares.set(main, 1);
  for (const helper of HELPERS[name.trim().toLowerCase()] ?? []) {
    if (!shares.has(helper)) shares.set(helper, 0.5);
  }
  return shares;
}

export type MuscleLevel = 'neglected' | 'maintaining' | 'growing' | 'overtrained';

// Requirement 19b's thresholds, as hard sets per week.
export const LEVELS: { level: MuscleLevel; label: string; from: number; detail: string }[] = [
  { level: 'neglected', label: 'Neglected', from: 0, detail: 'under 4 sets a week' },
  { level: 'maintaining', label: 'Maintaining', from: 4, detail: '4–10 sets a week' },
  { level: 'growing', label: 'Growing well', from: 10, detail: '10–20 sets a week' },
  { level: 'overtrained', label: 'Possibly overtrained', from: 20, detail: 'over 20 sets a week' },
];

export function levelOf(setsPerWeek: number): MuscleLevel {
  if (setsPerWeek > 20) return 'overtrained';
  if (setsPerWeek >= 10) return 'growing';
  if (setsPerWeek >= 4) return 'maintaining';
  return 'neglected';
}

import { kindFor } from './equipment';
import type { LoggedExercise, LoggedSet } from './exerciseLog';
import { detectSplit, monthlySummary } from './monthly';
import { muscleShares } from './muscles';
import { exerciseProgress, exercisesDone } from './progress';
import { suggestNext } from './suggestions';
import type { TrainingWorkout } from './training';

let ids = 0;
const set = (weight: number | null, reps: number | null, durationS?: number): LoggedSet => ({
  id: `s${++ids}`,
  weight,
  unit: weight === null ? null : 'kg',
  reps,
  toFailure: false,
  ...(durationS !== undefined && { durationS }),
  startedAt: null,
  endedAt: null,
});

function exercise(name: string, muscle: string | null, sets: LoggedSet[]): LoggedExercise {
  const kind = kindFor(name);
  return {
    id: `e${++ids}`,
    workoutId: 'w',
    name,
    technique: null,
    supersetGroup: null,
    spokenText: null,
    muscle,
    createdAt: '',
    finishedAt: '',
    equipment: kind.equipment,
    measure: kind.measure,
    barKg: kind.barKg,
    sets,
  };
}

const workout = (date: string, exercises: LoggedExercise[]): TrainingWorkout => ({
  id: `w${++ids}`,
  startedAt: new Date(`${date}T18:00:00`).toISOString(),
  endedAt: new Date(`${date}T19:00:00`).toISOString(),
  title: null,
  exercises,
});

const times = (n: number, make: () => LoggedSet) => Array.from({ length: n }, make);

describe('muscleShares', () => {
  it('counts the main muscle fully and helpers half', () => {
    expect(Object.fromEntries(muscleShares('Bench Press', 'Chest'))).toEqual({ Chest: 1, Triceps: 0.5, Shoulders: 0.5 });
    expect(Object.fromEntries(muscleShares('My Curl', 'Biceps'))).toEqual({ Biceps: 1 });
    expect(Object.fromEntries(muscleShares('Burpees', null))).toEqual({
      Quads: 0.5,
      Hamstrings: 0.5,
      Glutes: 0.5,
      Back: 0.5,
      Shoulders: 0.5,
    });
  });
});

describe('detectSplit', () => {
  it('names common plans from workout titles', () => {
    expect(detectSplit(['Push · Chest & Triceps', 'Pull · Back & Biceps', 'Legs', 'Push · Chest & Triceps'])).toBe('Push/Pull/Legs');
    expect(detectSplit(['Upper Body', 'Legs', 'Upper Body', 'Legs'])).toBe('Upper/Lower');
    expect(detectSplit(['Full Body', 'Full Body', 'Legs'])).toBe('Full body');
    expect(detectSplit(['Chest', 'Back', 'Shoulders', 'Legs', 'Biceps & Triceps'])).toBe('Bro split');
    expect(detectSplit([])).toBeNull();
  });
});

describe('monthlySummary', () => {
  const NOW = new Date('2026-12-05T12:00:00');
  const october = workout('2026-10-10', [exercise('Bench Press', 'Chest', times(3, () => set(30, 8)))]);
  const novemberWorkouts = [1, 4, 8, 11, 15, 18, 22, 25].map((day) =>
    workout(`2026-11-${String(day).padStart(2, '0')}`, [
      exercise('Bench Press', 'Chest', times(4, () => set(35, 8))),
      exercise('Lat Pulldown', 'Back', times(4, () => set(60, 10))),
      exercise('Plank', 'Core', [set(null, null, 60)]),
    ]),
  );
  const summary = monthlySummary('2026-11', [october, ...novemberWorkouts], [], NOW);
  const muscle = (name: string) => summary.muscles.find((m) => m.muscle === name)!;

  it('counts sets per muscle group as a weekly average with its level', () => {
    expect(summary.workouts).toBe(8);
    expect(muscle('Chest').sets).toBe(32);
    expect(muscle('Chest').perWeek).toBeCloseTo(7.5, 1);
    expect(muscle('Chest').level).toBe('maintaining');
    expect(muscle('Triceps').sets).toBe(16);
    expect(muscle('Quads').level).toBe('neglected');
    expect(muscle('Chest').topExercises).toEqual([{ name: 'Bench Press', sets: 32 }]);
  });

  it('counts volume with the bar and both sides of a barbell', () => {
    // 35 kg a side + 20 kg bar = 90 kg × 8 reps × 4 sets × 8 workouts.
    expect(muscle('Chest').volumeKg).toBe(90 * 8 * 4 * 8);
  });

  it('finds records against earlier months only', () => {
    expect(summary.records).toEqual([{ exercise: 'Bench Press', kind: 'weight', text: '90 kg, up from 80 kg' }]);
  });

  it('names the most repeated exercise and the most and least worked muscles', () => {
    expect(summary.mostRepeated).toEqual({ name: 'Bench Press', workouts: 8 });
    expect(summary.mostWorked.slice(0, 2).sort()).toEqual(['Back', 'Chest']);
    expect(summary.leastWorked).toHaveLength(3);
  });

  it('recommends what to focus on next month', () => {
    expect(summary.keepPlan).toBe(false);
    expect(summary.focus[0]).toMatch(/^Legs are neglected/);
  });

  it('handles a month without workouts', () => {
    const empty = monthlySummary('2026-09', [october], [], NOW);
    expect(empty.workouts).toBe(0);
    expect(empty.split).toBeNull();
    expect(empty.verdict).toMatch(/No workouts/);
  });
});

describe('exerciseProgress', () => {
  const workouts = [
    workout('2026-11-01', [exercise('Bench Press', 'Chest', [set(30, 10), set(35, 6)])]),
    workout('2026-11-05', [exercise('Bench Press', 'Chest', [set(30, 10)])]),
    workout('2026-11-09', [exercise('Bench Press', 'Chest', [set(40, 5)])]),
    workout('2026-11-02', [exercise('Plank', 'Core', [set(null, null, 45)])]),
    workout('2026-11-06', [exercise('Plank', 'Core', [set(null, null, 70)])]),
  ];

  it('tracks the heaviest load per workout and marks records', () => {
    const progress = exerciseProgress('bench press', workouts, []);
    expect(progress.metric).toBe('kg');
    expect(progress.points.map((p) => [p.value, p.record])).toEqual([
      [90, false],
      [80, false],
      [100, true],
    ]);
    expect(progress.points[2].label).toBe('100 kg × 5 reps');
  });

  it('tracks time for timed exercises', () => {
    const progress = exerciseProgress('Plank', workouts, []);
    expect(progress.metric).toBe('seconds');
    expect(progress.points.map((p) => p.label)).toEqual(['45 s', '1 min 10 s']);
  });

  it('lists exercises done, most recent first', () => {
    expect(exercisesDone(workouts).map((e) => [e.name, e.workouts])).toEqual([
      ['Bench Press', 3],
      ['Plank', 2],
    ]);
  });
});

describe('suggestNext', () => {
  const past = [
    workout('2026-11-01', [
      exercise('Lat Pulldown', 'Back', times(3, () => set(60, 10))),
      exercise('Seated Cable Row', 'Back', times(3, () => set(50, 10))),
      exercise('Hammer Curl', 'Biceps', times(3, () => set(14, 10))),
    ]),
    workout('2026-11-04', [
      exercise('Lat Pulldown', 'Back', times(3, () => set(60, 10))),
      exercise('Face Pull', 'Shoulders', times(3, () => set(20, 15))),
    ]),
    workout('2026-11-06', [exercise('Squat', 'Quads', times(5, () => set(40, 5)))]),
  ];

  it('suggests exercises from past workouts with the same focus, leaving out what is done', () => {
    const result = suggestNext([{ name: 'Lat Pulldown', muscle: 'Back' }], past);
    expect(result?.focus).toBe('Back');
    const names = result?.options.map((o) => o.name) ?? [];
    // Same-muscle exercises first, then the related ones done alongside them.
    expect(names[0]).toBe('Seated Cable Row');
    expect(names.slice(1).sort()).toEqual(['Face Pull', 'Hammer Curl']);
  });

  it('falls back to common exercises for the focus when there is no history', () => {
    const result = suggestNext([{ name: 'Leg Press', muscle: 'Quads' }], []);
    expect(result?.options).toHaveLength(3);
    expect(result?.options.every((o) => o.muscle === 'Quads')).toBe(true);
    expect(result?.options.map((o) => o.name)).not.toContain('Leg Press');
  });

  it('suggests nothing before the first exercise', () => {
    expect(suggestNext([], past)).toBeNull();
  });
});

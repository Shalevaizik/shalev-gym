// The start screen's week (1.4.0, design D): the weekly ring and the strip of days, Sunday to
// Saturday as the week runs in Israel. Trained days show the workout's type, past days without a
// workout are rest days, and today stands out.

import { withoutCardio } from './workoutTitle';

// The weekly goals the ring fills toward, until the user can set their own.
export const WEEKLY_WORKOUT_GOAL = 4;
export const WEEKLY_SET_GOAL = 80;

export type WeekWorkout = { startedAt: string; title: string; sets: number };

export type WeekDay = {
  date: Date;
  // "Sun", "Mon"…
  name: string;
  isToday: boolean;
  // trained: a workout that day; rest: a past day without one; open: today or later, nothing yet.
  state: 'trained' | 'rest' | 'open';
  // The first workout's type in a word: "Push", "Legs", "Cardio".
  type: string | null;
};

export type Week = { days: WeekDay[]; workouts: number; sets: number; restDays: number };

const NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const dayKey = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;

// "Push · Chest & Triceps" → "Push", "Legs + Cardio" → "Legs", "Upper Body" → "Upper", "Back & Biceps" → "Back".
export function shortType(title: string): string {
  const main = withoutCardio(title).split(' · ')[0].split(/ & |, /)[0].trim();
  if (main === 'Workout') return 'Done';
  return main.split(' ')[0];
}

export function weekOf(workouts: WeekWorkout[], now: Date): Week {
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay());
  const byDay = new Map<string, WeekWorkout[]>();
  for (const workout of workouts) {
    const key = dayKey(new Date(workout.startedAt));
    byDay.set(key, [...(byDay.get(key) ?? []), workout]);
  }
  const today = dayKey(now);
  let count = 0;
  let sets = 0;
  let restDays = 0;
  const days = NAMES.map((name, index) => {
    const date = new Date(start.getFullYear(), start.getMonth(), start.getDate() + index);
    const key = dayKey(date);
    const done = (byDay.get(key) ?? []).sort((a, b) => a.startedAt.localeCompare(b.startedAt));
    const isToday = key === today;
    count += done.length;
    sets += done.reduce((n, w) => n + w.sets, 0);
    const past = date < new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const state: WeekDay['state'] = done.length > 0 ? 'trained' : past ? 'rest' : 'open';
    if (state === 'rest') restDays++;
    return { date, name, isToday, state, type: done[0] ? shortType(done[0].title) : null };
  });
  return { days, workouts: count, sets, restDays };
}

// The monthly summary (requirements 12, 13 and 19): how much each muscle group was trained, the
// kind of split, the month's records, and advice for next month.

import { t } from '../i18n/core';

import { formatDurationS } from './equipment';
import { muscleOf } from './exerciseCatalog';
import type { LoggedExercise } from './exerciseLog';
import { BODY_MUSCLES, levelOf, muscleShares, type BodyMuscle, type MuscleLevel } from './muscles';
import {
  bodyKgOn,
  kgText,
  monthBounds,
  monthKey,
  setLoadKg,
  setVolumeKg,
  type BodyWeightEntry,
  type TrainingWorkout,
} from './training';
import { withoutCardio, workoutTitle } from './workoutTitle';

export type MuscleSummary = {
  muscle: BodyMuscle;
  sets: number;
  perWeek: number;
  level: MuscleLevel;
  workouts: number;
  // Weight moved: load × reps, counted like the sets (full for the main group, half for helpers).
  volumeKg: number;
  topExercises: { name: string; sets: number }[];
};

export type MonthRecord = { exercise: string; kind: 'weight' | 'reps' | 'time'; text: string };

export type MonthlySummary = {
  month: string;
  workouts: number;
  totalSets: number;
  weeks: number;
  muscles: MuscleSummary[];
  split: string | null;
  records: MonthRecord[];
  mostRepeated: { name: string; workouts: number } | null;
  mostWorked: BodyMuscle[];
  leastWorked: BodyMuscle[];
  keepPlan: boolean;
  verdict: string;
  focus: string[];
};

const LEGS: BodyMuscle[] = ['Quads', 'Hamstrings', 'Glutes', 'Calves'];
const round1 = (n: number) => Math.round(n * 10) / 10;

// Requirement 13a: what kind of plan the month's workouts follow, from their titles.
export function detectSplit(titles: string[]): string | null {
  if (titles.length === 0) return null;
  const count = { push: 0, pull: 0, legs: 0, upper: 0, full: 0, bro: 0 };
  for (const full of titles) {
    const title = withoutCardio(full);
    if (title.startsWith('Push')) count.push++;
    else if (title.startsWith('Pull')) count.pull++;
    else if (title === 'Legs') count.legs++;
    else if (title === 'Upper Body') count.upper++;
    else if (title === 'Full Body') count.full++;
    else if (title !== 'Workout' && title !== 'Core' && title !== 'Cardio') count.bro++;
  }
  const n = titles.length;
  if (count.push && count.pull && count.legs && (count.push + count.pull + count.legs) / n >= 0.6) return 'Push/Pull/Legs';
  if (count.upper && count.legs && (count.upper + count.legs) / n >= 0.6) return 'Upper/Lower';
  if (count.full / n >= 0.5) return 'Full body';
  if ((count.bro + count.push + count.pull) / n >= 0.5 && count.bro > 0) return 'Bro split';
  return 'Mixed';
}

const exerciseKey = (e: LoggedExercise) => `${e.name.trim().toLowerCase()}|${e.equipment ?? ''}|${e.measure}`;

type Best = { loadKg: number | null; repsAtLoad: Map<number, number>; seconds: number | null };

function bestsOf(workouts: TrainingWorkout[], weights: BodyWeightEntry[]): Map<string, Best> {
  const bests = new Map<string, Best>();
  for (const workout of workouts) {
    const body = bodyKgOn(weights, workout.startedAt);
    for (const exercise of workout.exercises) {
      const key = exerciseKey(exercise);
      const best = bests.get(key) ?? { loadKg: null, repsAtLoad: new Map(), seconds: null };
      for (const set of exercise.sets) {
        const load = setLoadKg(set, exercise, body);
        if (load !== null && (best.loadKg === null || load > best.loadKg)) best.loadKg = load;
        if (set.durationS != null && (best.seconds === null || set.durationS > best.seconds)) best.seconds = set.durationS;
        if (set.reps !== null) {
          const at = Math.round(load ?? 0);
          best.repsAtLoad.set(at, Math.max(best.repsAtLoad.get(at) ?? 0, set.reps));
        }
      }
      bests.set(key, best);
    }
  }
  return bests;
}

// The most reps done before at this load or heavier.
function repsBefore(best: Best, load: number): number {
  let most = 0;
  for (const [at, reps] of best.repsAtLoad) if (at >= Math.round(load)) most = Math.max(most, reps);
  return most;
}

function records(before: TrainingWorkout[], month: TrainingWorkout[], weights: BodyWeightEntry[]): MonthRecord[] {
  const earlier = bestsOf(before, weights);
  const now = bestsOf(month, weights);
  const names = new Map<string, string>();
  for (const w of month) for (const e of w.exercises) names.set(exerciseKey(e), e.name);
  const found: MonthRecord[] = [];
  for (const [key, best] of now) {
    const old = earlier.get(key);
    if (!old) continue; // A first time is not a record yet.
    const name = names.get(key) ?? key;
    if (best.loadKg !== null && old.loadKg !== null && best.loadKg > old.loadKg) {
      found.push({ exercise: name, kind: 'weight', text: t('{now}, up from {before}', { now: kgText(best.loadKg), before: kgText(old.loadKg) }) });
      continue;
    }
    if (best.seconds !== null && old.seconds !== null && best.seconds > old.seconds) {
      found.push({
        exercise: name,
        kind: 'time',
        text: t('{now}, up from {before}', { now: formatDurationS(best.seconds), before: formatDurationS(old.seconds) }),
      });
      continue;
    }
    for (const [at, reps] of [...best.repsAtLoad].sort((a, b) => b[0] - a[0])) {
      const previous = repsBefore(old, at);
      if (previous > 0 && reps > previous) {
        found.push({
          exercise: name,
          kind: 'reps',
          text:
            at > 0
              ? t('{reps} reps at {kg}, up from {before}', { reps, kg: kgText(at), before: previous })
              : t('{reps} reps, up from {before}', { reps, before: previous }),
        });
        break;
      }
    }
  }
  return found;
}

export function monthlySummary(
  month: string,
  all: TrainingWorkout[],
  weights: BodyWeightEntry[],
  now: Date,
): MonthlySummary {
  const { start, days } = monthBounds(month);
  const finished = all.filter((w) => w.endedAt !== null);
  const inMonth = finished.filter((w) => monthKey(new Date(w.startedAt)) === month);
  const before = finished.filter((w) => new Date(w.startedAt) < start);
  const elapsed = monthKey(now) === month ? now.getDate() : days;
  const weeks = Math.max(1, elapsed / 7);

  const stats = new Map<BodyMuscle, { sets: number; volume: number; workouts: Set<string>; exercises: Map<string, number> }>();
  for (const muscle of BODY_MUSCLES) stats.set(muscle, { sets: 0, volume: 0, workouts: new Set(), exercises: new Map() });

  let totalSets = 0;
  const repeated = new Map<string, { name: string; workouts: Set<string> }>();
  for (const workout of inMonth) {
    const body = bodyKgOn(weights, workout.startedAt);
    for (const exercise of workout.exercises) {
      if (exercise.sets.length === 0) continue;
      totalSets += exercise.sets.length;
      const key = exercise.name.trim().toLowerCase();
      const entry = repeated.get(key) ?? { name: exercise.name, workouts: new Set<string>() };
      entry.workouts.add(workout.id);
      repeated.set(key, entry);

      const volume = exercise.sets.reduce((sum, set) => sum + setVolumeKg(set, exercise, body), 0);
      for (const [muscle, share] of muscleShares(exercise.name, exercise.muscle ?? muscleOf(exercise.name))) {
        const s = stats.get(muscle)!;
        s.sets += exercise.sets.length * share;
        s.volume += volume * share;
        s.workouts.add(workout.id);
        if (share === 1) s.exercises.set(exercise.name, (s.exercises.get(exercise.name) ?? 0) + exercise.sets.length);
      }
    }
  }

  const muscles: MuscleSummary[] = BODY_MUSCLES.map((muscle) => {
    const s = stats.get(muscle)!;
    const perWeek = s.sets / weeks;
    return {
      muscle,
      sets: round1(s.sets),
      perWeek: round1(perWeek),
      level: levelOf(perWeek),
      workouts: s.workouts.size,
      volumeKg: Math.round(s.volume),
      topExercises: [...s.exercises]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([name, sets]) => ({ name, sets })),
    };
  });

  const bySets = [...muscles].sort((a, b) => b.sets - a.sets);
  const mostWorked = bySets.filter((m) => m.sets > 0).slice(0, 3).map((m) => m.muscle);
  const leastWorked = [...bySets].reverse().slice(0, 3).map((m) => m.muscle);
  const top = [...repeated.values()].sort((a, b) => b.workouts.size - a.workouts.size)[0];

  const advice = recommend(muscles, inMonth.length, weeks);
  return {
    month,
    workouts: inMonth.length,
    totalSets,
    weeks: round1(weeks),
    muscles,
    split: detectSplit(
      inMonth.map((w) =>
        workoutTitle(w.exercises.map((e) => ({ name: e.name, muscle: e.muscle, sets: e.sets.length }))),
      ),
    ),
    records: records(before, inMonth, weights),
    mostRepeated: top && top.workouts.size >= 2 ? { name: top.name, workouts: top.workouts.size } : null,
    mostWorked,
    leastWorked,
    ...advice,
  };
}

// Requirement 13d: keep or change the plan, and what to focus on next month.
function recommend(
  muscles: MuscleSummary[],
  workouts: number,
  weeks: number,
): { keepPlan: boolean; verdict: string; focus: string[] } {
  if (workouts === 0) {
    return {
      keepPlan: false,
      verdict: t('No workouts were logged this month.'),
      focus: [t('Aim for two or three workouts a week to get started.')],
    };
  }
  const byMuscle = new Map(muscles.map((m) => [m.muscle, m]));
  const neglected = muscles.filter((m) => m.level === 'neglected' && m.muscle !== 'Forearms');
  const overtrained = muscles.filter((m) => m.level === 'overtrained');
  const perWeek = workouts / weeks;
  const legsNeglected = LEGS.filter((m) => byMuscle.get(m)!.level === 'neglected').length >= 3;
  const busiest = [...muscles].sort((a, b) => b.perWeek - a.perWeek)[0];

  const focus: string[] = [];
  const lower = (muscle: string) => (t(muscle) === muscle ? muscle.toLowerCase() : t(muscle));
  if (legsNeglected) {
    focus.push(
      busiest && !LEGS.includes(busiest.muscle)
        ? t('Legs are neglected. Add a leg day and do a little less {muscle}.', { muscle: lower(busiest.muscle) })
        : t('Legs are neglected. Add a leg day.'),
    );
  }
  const otherNeglected = neglected.filter((m) => !(legsNeglected && LEGS.includes(m.muscle)));
  if (otherNeglected.length > 0) {
    focus.push(
      t('Give more work to {muscles}: at least 4 sets a week each.', { muscles: list(otherNeglected.map((m) => lower(m.muscle))) }),
    );
  }
  if (overtrained.length > 0) {
    focus.push(
      t('Ease off {muscles}: over 20 sets a week leaves little room to recover.', { muscles: list(overtrained.map((m) => lower(m.muscle))) }),
    );
  }
  if (perWeek < 2) focus.push(t('Train at least twice a week, so every muscle group gets worked regularly.'));

  const keepPlan = perWeek >= 2 && neglected.length <= 2 && overtrained.length === 0;
  const verdict = keepPlan
    ? t('Keep your current plan. Your training is regular and well balanced.')
    : neglected.length > 4 || legsNeglected
      ? t('Consider switching your plan, so every muscle group gets regular work.')
      : t('Keep the plan, with the changes below.');
  if (focus.length === 0) focus.push(t('Keep adding a little weight or a rep where you can.'));
  return { keepPlan, verdict, focus };
}

function list(items: string[]): string {
  if (items.length <= 1) return items.join('');
  return t('{first} and {last}', { first: items.slice(0, -1).join(', '), last: items.at(-1)! });
}

// The months that have finished workouts, newest first, for moving between summaries.
export function monthsWithWorkouts(workouts: TrainingWorkout[]): string[] {
  return [...new Set(workouts.filter((w) => w.endedAt).map((w) => monthKey(new Date(w.startedAt))))].sort().reverse();
}


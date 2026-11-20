// The workout summary of requirement 11: date and time, the app's title, and each exercise with
// its number of sets, working weights and reps per set.

import { formatSetFor } from './equipment';
import { kindOf } from './exerciseLog';
import type { TrainingWorkout } from './training';
import { formatTime } from './workout';
import { workoutTitle } from './workoutTitle';

export type SummaryExercise = { name: string; sets: string[]; note: string | null };
export type WorkoutSummary = { title: string; when: string; exercises: SummaryExercise[]; totalSets: number };

export function summarizeWorkout(workout: TrainingWorkout): WorkoutSummary {
  const done = workout.exercises.filter((e) => e.sets.length > 0);
  const title =
    workout.title ?? workoutTitle(done.map((e) => ({ name: e.name, muscle: e.muscle, sets: e.sets.length })));
  const day = new Date(workout.startedAt).toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
  const when = workout.endedAt
    ? `${day}, ${formatTime(workout.startedAt)} to ${formatTime(workout.endedAt)}`
    : `${day}, from ${formatTime(workout.startedAt)}`;
  return {
    title,
    when,
    totalSets: done.reduce((n, e) => n + e.sets.length, 0),
    exercises: done.map((e) => ({
      name: e.name,
      sets: e.sets.map((set) => formatSetFor(set, kindOf(e))),
      note: [e.technique, e.supersetGroup && 'superset'].filter(Boolean).join(', ') || null,
    })),
  };
}

// The same summary as plain text, for sharing in a message.
export function summaryText(summary: WorkoutSummary): string {
  const lines = [summary.title, summary.when, ''];
  summary.exercises.forEach((exercise, index) => {
    const count = `${exercise.sets.length} ${exercise.sets.length === 1 ? 'set' : 'sets'}`;
    lines.push(`${index + 1}. ${exercise.name} (${count}${exercise.note ? `, ${exercise.note}` : ''})`);
    exercise.sets.forEach((set, k) => lines.push(`   ${k + 1}) ${set}`));
  });
  return lines.join('\n').trim();
}

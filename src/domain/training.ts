// Shared shapes and helpers for looking back over finished workouts (requirements 11, 13, 16, 19).

import { loadKg, volumeKg } from './equipment';
import { kindOf, type LoggedExercise, type LoggedSet } from './exerciseLog';

export type TrainingWorkout = {
  id: string;
  startedAt: string;
  endedAt: string | null;
  // A title the trainer chose; null means the app's own (requirement 21).
  title: string | null;
  exercises: LoggedExercise[];
};

export type BodyWeightEntry = { kg: number; at: string };

// The trainer's body weight on a date: the last one entered by then, else the first one known.
export function bodyKgOn(weights: BodyWeightEntry[], iso: string): number | null {
  if (weights.length === 0) return null;
  const sorted = [...weights].sort((a, b) => a.at.localeCompare(b.at));
  const before = sorted.filter((w) => w.at <= iso).at(-1);
  return (before ?? sorted[0]).kg;
}

export function setLoadKg(set: LoggedSet, exercise: LoggedExercise, bodyKg: number | null): number | null {
  return loadKg(set, kindOf(exercise), bodyKg);
}

export function setVolumeKg(set: LoggedSet, exercise: LoggedExercise, bodyKg: number | null): number {
  return volumeKg(set, kindOf(exercise), bodyKg);
}

// "2026-11" for the trainer's local calendar month of a moment.
export function monthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

export function monthBounds(month: string): { start: Date; end: Date; days: number } {
  const [year, m] = month.split('-').map(Number);
  const start = new Date(year, m - 1, 1);
  const end = new Date(year, m, 1);
  return { start, end, days: new Date(year, m, 0).getDate() };
}

export function shiftMonth(month: string, by: number): string {
  const [year, m] = month.split('-').map(Number);
  return monthKey(new Date(year, m - 1 + by, 1));
}

export function formatMonth(month: string): string {
  const { start } = monthBounds(month);
  return start.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
}

const round1 = (n: number) => Math.round(n * 10) / 10;
export const kgText = (kg: number) => `${round1(kg)} kg`;

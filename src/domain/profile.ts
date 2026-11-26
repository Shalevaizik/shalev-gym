// The trainer's profile (requirement 20): date of birth, sex, height and dated body weights.

import { dateLocale } from '../i18n/core';

export type Sex = 'male' | 'female';
export type HeightUnit = 'cm' | 'ft';
export type BodyWeightUnit = 'kg' | 'lb';

export type BodyWeight = { weight: number; unit: BodyWeightUnit; recordedAt: string };

export type Profile = {
  birthDate: string | null; // YYYY-MM-DD
  sex: Sex | null;
  heightCm: number | null;
  heightUnit: HeightUnit;
  weight: BodyWeight | null; // the latest one
  reminderDismissedAt: string | null;
};

export const EMPTY_PROFILE: Profile = {
  birthDate: null,
  sex: null,
  heightCm: null,
  heightUnit: 'cm',
  weight: null,
  reminderDismissedAt: null,
};

const CM_PER_INCH = 2.54;
const KG_PER_LB = 0.45359237;
// Requirement 20e: body weight is asked for once a month.
export const WEIGHT_REMINDER_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;

export const isComplete = (profile: Profile) =>
  profile.birthDate !== null && profile.sex !== null && profile.heightCm !== null && profile.weight !== null;

export function toKg(weight: number, unit: BodyWeightUnit): number {
  return unit === 'kg' ? weight : weight * KG_PER_LB;
}

export function cmFromFeetInches(feet: number, inches: number): number {
  return (feet * 12 + inches) * CM_PER_INCH;
}

export function feetInchesFromCm(cm: number): { feet: number; inches: number } {
  let totalInches = Math.round(cm / CM_PER_INCH);
  const feet = Math.floor(totalInches / 12);
  totalInches -= feet * 12;
  return { feet, inches: totalInches };
}

// Builds a date only if it exists on the calendar (no 31 February) and is in the past.
export function birthDateFrom(day: number, month: number, year: number, now: Date): string | null {
  if (![day, month, year].every(Number.isInteger)) return null;
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    return null;
  }
  const age = ageOn(date.toISOString().slice(0, 10), now);
  if (age < 10 || age > 110) return null;
  return date.toISOString().slice(0, 10);
}

export function ageOn(birthDate: string, now: Date): number {
  const [year, month, day] = birthDate.split('-').map(Number);
  let age = now.getFullYear() - year;
  const hadBirthday = now.getMonth() + 1 > month || (now.getMonth() + 1 === month && now.getDate() >= day);
  if (!hadBirthday) age -= 1;
  return age;
}

const round1 = (n: number) => Math.round(n * 10) / 10;

export function formatHeight(cm: number, unit: HeightUnit): string {
  if (unit === 'cm') return `${Math.round(cm)} cm`;
  const { feet, inches } = feetInchesFromCm(cm);
  return `${feet}′${inches}″`;
}

export function formatBodyWeight(weight: BodyWeight): string {
  return `${round1(weight.weight)} ${weight.unit}`;
}

export function formatBirthDate(birthDate: string): string {
  const [year, month, day] = birthDate.split('-').map(Number);
  return new Date(year, month - 1, day).toLocaleDateString(dateLocale(), {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

// True when the start screen should ask for the body weight: there is none, or it is more than a
// month old, and the trainer hasn't said "not now" in the past month.
export function needsWeightReminder(profile: Profile, now: Date): boolean {
  const olderThanAMonth = (iso: string | null) =>
    iso === null || now.getTime() - new Date(iso).getTime() >= WEIGHT_REMINDER_DAYS * DAY_MS;
  return olderThanAMonth(profile.weight?.recordedAt ?? null) && olderThanAMonth(profile.reminderDismissedAt);
}

// The app's two languages: English and Hebrew (one app, the same features in both).
//
// Text in the code stays in English and is looked up in the Hebrew dictionary when Hebrew is on:
// t('Start new workout'). Missing Hebrew falls back to English, so nothing is ever blank. Values go
// in braces: t('Set {n}', { n: 3 }).
//
// This file has no native code, so the domain logic and its tests can use it. The phone's choice
// is read once at start-up (see ./language.ts); changing it restarts the app, because right-to-left
// layout only takes effect after a restart.

import { EXERCISE_HE, HE } from './he';

export type Language = 'en' | 'he';

let current: Language = 'en';

export function setCurrentLanguage(language: Language) {
  current = language;
}

export const currentLanguage = (): Language => current;
export const isHebrew = () => current === 'he';

// For dates and numbers: Hebrew dates read "יום שישי, 27 בנובמבר".
export const dateLocale = () => (current === 'he' ? 'he-IL' : 'en-GB');

export function fill(text: string, values?: Record<string, string | number>): string {
  if (!values) return text;
  return text.replace(/\{(\w+)\}/g, (match, key: string) => (key in values ? String(values[key]) : match));
}

export function t(text: string, values?: Record<string, string | number>): string {
  return fill((current === 'he' && HE[text]) || text, values);
}

// Counted words: "1 set", "3 sets", "סט אחד", "3 סטים".
const NOUNS: Record<string, { en: [string, string]; he: [string, string] }> = {
  set: { en: ['set', 'sets'], he: ['סט אחד', 'סטים'] },
  exercise: { en: ['exercise', 'exercises'], he: ['תרגיל אחד', 'תרגילים'] },
  workout: { en: ['workout', 'workouts'], he: ['אימון אחד', 'אימונים'] },
  rep: { en: ['rep', 'reps'], he: ['חזרה אחת', 'חזרות'] },
  session: { en: ['session', 'sessions'], he: ['אימון אחד', 'אימונים'] },
  day: { en: ['day', 'days'], he: ['יום אחד', 'ימים'] },
  minute: { en: ['minute', 'minutes'], he: ['דקה אחת', 'דקות'] },
};

export function count(n: number, noun: keyof typeof NOUNS | string): string {
  const forms = NOUNS[noun];
  if (!forms) return `${n} ${noun}${n === 1 ? '' : 's'}`;
  if (current === 'he') return n === 1 ? forms.he[0] : `${n} ${forms.he[1]}`;
  return `${n} ${n === 1 ? forms.en[0] : forms.en[1]}`;
}

// Exercise names are saved in English (the catalog's names), and shown in Hebrew when Hebrew is on.
// A name the trainer typed themselves is shown as they wrote it.
export function exerciseName(name: string): string {
  if (current !== 'he') return name;
  return EXERCISE_HE[name.trim().toLowerCase()] ?? name;
}

// The app's own workout titles ("Push · Chest & Triceps", "Legs + Cardio") are built in English and
// shown in Hebrew word by word. A title the trainer typed is shown as written.
export function titleText(title: string): string {
  if (current !== 'he') return title;
  return title
    .split(/( · | & |, | \+ )/)
    .map((part) => (part === ' & ' ? ' ו' : (HE[part] ?? part)))
    .join('')
    .replace(/ ו /g, ' ו');
}

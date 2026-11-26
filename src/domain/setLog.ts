// Reads one spoken set for the exercise already chosen: "80 kg 10 reps", "same weight 8",
// "80 for 10", "bodyweight 12 to failure". The exercise name is never needed here.

import {
  readSets,
  setTokens,
  tokenize,
  type ParsedSet,
  type Technique,
  type WeightUnit,
} from './exerciseLog';

export type SetCommand =
  | { kind: 'sets'; sets: ParsedSet[]; technique: Technique | null }
  | { kind: 'repeat' }
  | { kind: 'undo' }
  | { kind: 'next-exercise' }
  | { kind: 'end-workout' }
  | { kind: 'not-understood'; reason: string };

const END_WORKOUT = /^(please )?(end|finish|stop|close)( (the|my|this))? (workout|training|session)( now)?( please)?$/;
const NEXT_EXERCISE =
  /^((i'?m )?(done|finished)( with)?( (this|the))?( exercise)?|(next|new|change|switch)( (the|an?))? exercise|next( one)?|finish( (this|the))? exercise)( please)?$/;
const UNDO = /^(undo|delete|remove|scratch|cancel)( (that|it|the last|last|the|this))?( set)?( please)?$/;
const REPEAT = /^((the )?same( (again|set|thing|as (before|last( time)?)))?|again|one more( (the )?same)?|repeat( (that|the last|last)( set)?)?|another( one| set)?( the same)?)( please)?$/;

// For cardio a bare number is minutes ("20" is a 20-minute session) and weight isn't asked for.
export function parseSetLog(
  text: string,
  previous: ParsedSet | null,
  measure: 'reps' | 'time' = 'reps',
  cardio = false,
): SetCommand {
  const timed = measure === 'time';
  const plain = text.toLowerCase().replace(/[^a-z'\s]/g, ' ').replace(/\s+/g, ' ').trim();
  const hasDigits = /\d/.test(text);
  if (!hasDigits) {
    if (END_WORKOUT.test(plain)) return { kind: 'end-workout' };
    if (NEXT_EXERCISE.test(plain)) return { kind: 'next-exercise' };
    if (UNDO.test(plain)) return { kind: 'undo' };
    if (REPEAT.test(plain)) {
      return previous
        ? { kind: 'repeat' }
        : { kind: 'not-understood', reason: 'There is no set to repeat yet. Say the weight and reps.' };
    }
  }
  if (!plain && !hasDigits) {
    return { kind: 'not-understood', reason: 'Nothing was heard. Try again a little closer to the phone.' };
  }

  // In a set, "for" joins weight and reps: "80 for 10".
  const tokens = tokenize(text.replace(/\bfor\b/gi, ' x '));
  const defaultUnit: WeightUnit = previous?.unit ?? 'kg';
  const reading = readSets(setTokens(tokens), timed || cardio ? 'time' : 'set', defaultUnit, cardio ? 60 : 1);

  if (cardio) {
    const sets = reading.sets
      .filter((set) => set.durationS != null)
      .map((set) => ({ weight: null, unit: null, reps: null, toFailure: false, durationS: set.durationS }));
    return sets.length > 0
      ? { kind: 'sets', sets, technique: null }
      : { kind: 'not-understood', reason: 'I didn’t catch how long. Try “15 minutes” or just “20”.' };
  }

  if (reading.weightOnly) {
    return timed
      ? { kind: 'not-understood', reason: `I heard the weight but not the time. Try "${text.trim()} 60 seconds".` }
      : { kind: 'not-understood', reason: `I heard the weight but not the reps. Try "${text.trim()} 10 reps".` };
  }
  if (reading.sets.length === 0) {
    return timed
      ? { kind: 'not-understood', reason: 'I didn’t catch the time. Try “60 seconds” or “1:30”.' }
      : { kind: 'not-understood', reason: 'I didn’t catch the weight and reps. Try “80 kg 10 reps”.' };
  }

  // "10 reps" with nothing about weight keeps the weight of the last set.
  const sets = reading.weightSaid
    ? reading.sets
    : reading.sets.map((set) => ({ ...set, weight: previous?.weight ?? null, unit: previous?.unit ?? null }));
  return { kind: 'sets', sets, technique: reading.technique };
}

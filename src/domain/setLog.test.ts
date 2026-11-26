import type { ParsedSet } from './exerciseLog';
import { parseSetLog, type SetCommand } from './setLog';

const set = (weight: number | null, unit: 'kg' | 'lb' | null, reps: number | null, toFailure = false) => ({
  weight,
  unit,
  reps,
  toFailure,
});

function sets(text: string, previous = null as ReturnType<typeof set> | null) {
  const result: SetCommand = parseSetLog(text, previous);
  if (result.kind !== 'sets') throw new Error(`Not read: ${text} → ${JSON.stringify(result)}`);
  return result.sets;
}

describe('parseSetLog', () => {
  it('reads weight and reps in common phrasings', () => {
    expect(sets('80 kg 10 reps')).toEqual([set(80, 'kg', 10)]);
    expect(sets('eighty kilos ten')).toEqual([set(80, 'kg', 10)]);
    expect(sets('10 reps at 80 kg')).toEqual([set(80, 'kg', 10)]);
    expect(sets('135 pounds for 8')).toEqual([set(135, 'lb', 8)]);
    expect(sets('22.5kg x 12')).toEqual([set(22.5, 'kg', 12)]);
  });

  it('reads a weight without a unit in the unit used last', () => {
    expect(sets('80 for 10')).toEqual([set(80, 'kg', 10)]);
    expect(sets('80 x 10')).toEqual([set(80, 'kg', 10)]);
    expect(sets('80 10')).toEqual([set(80, 'kg', 10)]);
    expect(sets('185 for 5', set(175, 'lb', 5))).toEqual([set(185, 'lb', 5)]);
  });

  it('keeps the last weight when only reps are said', () => {
    const previous = set(80, 'kg', 10);
    expect(sets('8 reps', previous)).toEqual([set(80, 'kg', 8)]);
    expect(sets('same weight 8', previous)).toEqual([set(80, 'kg', 8)]);
    expect(sets('eight', previous)).toEqual([set(80, 'kg', 8)]);
  });

  it('reads bodyweight and failure', () => {
    expect(sets('bodyweight 12')).toEqual([set(null, null, 12)]);
    expect(sets('bodyweight to failure')).toEqual([set(null, null, null, true)]);
    expect(sets('60 kg 9 to failure')).toEqual([set(60, 'kg', 9, true)]);
  });

  it('reads several sets said at once', () => {
    expect(sets('80 kg 10 10 8')).toEqual([set(80, 'kg', 10), set(80, 'kg', 10), set(80, 'kg', 8)]);
    expect(sets('3 sets of 10 at 60 kg')).toHaveLength(3);
  });

  it('understands commands', () => {
    expect(parseSetLog('same again', set(80, 'kg', 10))).toEqual({ kind: 'repeat' });
    expect(parseSetLog('same', null).kind).toBe('not-understood');
    expect(parseSetLog('undo', null)).toEqual({ kind: 'undo' });
    expect(parseSetLog('delete the last set', null)).toEqual({ kind: 'undo' });
    expect(parseSetLog('next exercise', null)).toEqual({ kind: 'next-exercise' });
    expect(parseSetLog("I'm done with this exercise", null)).toEqual({ kind: 'next-exercise' });
    expect(parseSetLog('end workout', null)).toEqual({ kind: 'end-workout' });
  });

  it('reads plates as the weight per side', () => {
    expect(sets('two plates 8 reps')).toEqual([set(40, 'kg', 8)]);
    expect(sets('a plate for 10')).toEqual([set(20, 'kg', 10)]);
    expect(sets('2 plates 5', set(135, 'lb', 5))).toEqual([set(90, 'lb', 5)]);
    expect(sets('20 a side 10')).toEqual([set(20, 'kg', 10)]);
  });

  it('reads times for exercises held for a time', () => {
    const timed = (text: string, previous: ParsedSet | null = null) => {
      const result = parseSetLog(text, previous, 'time');
      if (result.kind !== 'sets') throw new Error(`Not read: ${text} → ${JSON.stringify(result)}`);
      return result.sets.map((s) => [s.weight, s.unit, s.durationS, s.toFailure]);
    };
    expect(timed('60 seconds')).toEqual([[null, null, 60, false]]);
    expect(timed('45')).toEqual([[null, null, 45, false]]);
    expect(timed('a minute')).toEqual([[null, null, 60, false]]);
    expect(timed('1:30')).toEqual([[null, null, 90, false]]);
    expect(timed('one minute and a half')).toEqual([[null, null, 90, false]]);
    expect(timed('1 minute 15 seconds')).toEqual([[null, null, 75, false]]);
    expect(timed('plus 10 kg 45 seconds')).toEqual([[10, 'kg', 45, false]]);
    expect(timed('50 seconds', { ...set(10, 'kg', null), durationS: 45 })).toEqual([[10, 'kg', 50, false]]);
    expect(timed('90 seconds to failure')).toEqual([[null, null, 90, true]]);
    expect(parseSetLog('10 kg', null, 'time')).toMatchObject({ kind: 'not-understood', reason: expect.stringContaining('time') });
  });

  it('still reads reps for exercises measured in reps when a time is said', () => {
    expect(parseSetLog('60 seconds', null).kind).toBe('sets');
  });

  it('explains what is missing', () => {
    expect(parseSetLog('80 kg', null)).toMatchObject({ kind: 'not-understood', reason: expect.stringContaining('reps') });
    expect(parseSetLog('hello there', null).kind).toBe('not-understood');
  });
});

describe('cardio sessions', () => {
  const cardio = (text: string) => parseSetLog(text, null, 'time', true);

  it('reads a bare number as minutes', () => {
    expect(cardio('20')).toEqual({
      kind: 'sets',
      technique: null,
      sets: [{ weight: null, unit: null, reps: null, toFailure: false, durationS: 1200 }],
    });
  });

  it('reads minutes, hours and half hours', () => {
    const seconds = (text: string) => {
      const result = cardio(text);
      return result.kind === 'sets' ? result.sets[0].durationS : result.kind;
    };
    expect(seconds('15 minutes')).toBe(900);
    expect(seconds('an hour')).toBe(3600);
    expect(seconds('1 hour 20 minutes')).toBe(4800);
    expect(seconds('half an hour')).toBe(1800);
    expect(seconds('45 seconds')).toBe(45);
  });

  it('still understands commands', () => {
    expect(cardio('next exercise').kind).toBe('next-exercise');
    expect(cardio('banana').kind).toBe('not-understood');
  });
});

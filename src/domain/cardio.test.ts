import { readCardioDetails } from './cardio';
import { formatSetFor, kindFor, shortSetFor } from './equipment';
import { parseExerciseChoice } from './exerciseChoice';
import { readCardioSession } from './setLog';

describe('cardio machine settings (requirement 23)', () => {
  it('reads speed, incline, level, distance and calories, leaving the time', () => {
    expect(readCardioDetails('20 minutes speed 6.5 incline 8')).toEqual({
      details: { speedKmh: 6.5, incline: 8 },
      rest: '20 minutes',
    });
    expect(readCardioDetails('15 minutes level 10 150 calories').details).toEqual({ level: 10, calories: 150 });
    expect(readCardioDetails('25 min 5 km').details).toEqual({ distanceKm: 5 });
    expect(readCardioDetails('10 minutes 500 meters').details).toEqual({ distanceKm: 0.5 });
    expect(readCardioDetails('30 minutes at 10 km/h 8% incline').details).toEqual({ speedKmh: 10, incline: 8 });
    expect(readCardioDetails('resistance 6 for 20 minutes').details).toEqual({ level: 6 });
    expect(readCardioDetails('20 minutes').details).toEqual({});
  });

  it('logs a session with its time and settings', () => {
    const result = readCardioSession('20 minutes speed 6.5 incline 8');
    expect(result).toEqual({
      kind: 'sets',
      technique: null,
      sets: [{ weight: null, unit: null, reps: null, toFailure: false, durationS: 1200, cardio: { speedKmh: 6.5, incline: 8 } }],
    });
    expect(readCardioSession('level 7').kind).toBe('not-understood');
  });

  it('shows the session in one line', () => {
    const treadmill = kindFor('Treadmill');
    const set = { weight: null, unit: null, reps: null, toFailure: false, durationS: 1200, cardio: { speedKmh: 6.5, incline: 8 } };
    expect(formatSetFor(set, treadmill)).toBe('20 min · 6.5 km/h · incline 8');
    expect(shortSetFor(set, treadmill)).toBe('20 min · 6.5 km/h · incline 8');
    expect(formatSetFor({ ...set, cardio: { level: 10, distanceKm: 0.5, calories: 90 } }, kindFor('Rowing Machine'))).toBe(
      '20 min · level 10 · 500 m · 90 cal',
    );
  });

  it('understands the machine and its settings said in one go', () => {
    const choice = parseExerciseChoice('treadmill 20 minutes speed 6.5 incline 8');
    expect(choice.kind).toBe('choice');
    if (choice.kind !== 'choice') return;
    expect(choice.parts[0].match.best?.name).toBe('Treadmill');
    expect(choice.parts[0].sets).toEqual([
      { weight: null, unit: null, reps: null, toFailure: false, durationS: 1200, cardio: { speedKmh: 6.5, incline: 8 } },
    ]);
  });

  it('leaves exercise names alone when they only look like settings', () => {
    const choice = parseExerciseChoice('incline bench press 30 kg 10');
    expect(choice.kind === 'choice' && choice.parts[0].match.best?.name).toBe('Incline Bench Press');
  });
});

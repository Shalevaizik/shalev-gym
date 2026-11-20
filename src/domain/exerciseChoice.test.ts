import { correctionKey, matchExercise, searchExercises, soundKey } from './exerciseCatalog';
import { bestTranscript, parseExerciseChoice, type ExerciseChoice } from './exerciseChoice';

function parts(text: string, history: string[] = []) {
  const result: ExerciseChoice = parseExerciseChoice(text, history);
  if (result.kind !== 'choice') throw new Error(`Not read: ${text} → ${JSON.stringify(result)}`);
  return result;
}

describe('matchExercise', () => {
  it.each([
    ['bench press', 'Bench Press'],
    ['db bench', 'Dumbbell Bench Press'],
    ['lat pull down', 'Lat Pulldown'],
    ['lap pulldown', 'Lat Pulldown'], // misheard
    ['tricep push downs', 'Cable Pushdown'],
    ['rdl', 'Romanian Deadlift'],
    ['pull ups', 'Pull-Up'],
    ['lateral raises', 'Lateral Raise'],
    ['cable flies', 'Cable Fly'],
  ])('confidently matches “%s” to %s', (spoken, name) => {
    const match = matchExercise(spoken);
    expect(match.best?.name).toBe(name);
    expect(match.confident).toBe(true);
  });

  it('offers close alternatives', () => {
    expect(matchExercise('bench press').alternatives.map((a) => a.name)).toContain('Dumbbell Bench Press');
  });

  it('is unsure about an exercise it does not know', () => {
    const match = matchExercise('zercher squat');
    expect(match.confident).toBe(false);
  });

  it('matches names the trainer used before', () => {
    const match = matchExercise('zercher squats', ['Zercher Squat']);
    expect(match.best).toMatchObject({ name: 'Zercher Squat', catalogId: null });
    expect(match.confident).toBe(true);
  });
});

describe('parseExerciseChoice', () => {
  it('reads a name with lead-in words', () => {
    const choice = parts('next exercise is squats');
    expect(choice.parts).toHaveLength(1);
    expect(choice.parts[0].match.best?.name).toBe('Squat');
    expect(choice.parts[0].sets).toEqual([]);
  });

  it('reads a superset', () => {
    const choice = parts('curls superset with tricep pushdowns');
    expect(choice.superset).toBe(true);
    expect(choice.parts.map((p) => p.match.best?.name)).toEqual(['Barbell Curl', 'Cable Pushdown']);
  });

  it('keeps a first set said with the name', () => {
    const [part] = parts('bench press 80 kg 10 reps').parts;
    expect(part.match.best?.name).toBe('Bench Press');
    expect(part.sets).toEqual([{ weight: 80, unit: 'kg', reps: 10, toFailure: false }]);
  });

  it('keeps the spoken name for a custom exercise', () => {
    expect(parts('zercher squat').parts[0].spokenName).toBe('Zercher Squat');
  });

  it('recognises end workout and empty speech', () => {
    expect(parseExerciseChoice('end workout').kind).toBe('end-workout');
    expect(parseExerciseChoice('80 kg 10').kind).toBe('not-understood');
  });
});

describe('searchExercises', () => {
  it('suggests exercises as the name is typed', () => {
    expect(searchExercises('ben').map((o) => o.name)[0]).toBe('Bench Press');
    expect(searchExercises('lat pul').map((o) => o.name)).toContain('Lat Pulldown');
    expect(searchExercises('rdl').map((o) => o.name)).toEqual(['Romanian Deadlift']);
  });

  it('puts names used before first', () => {
    expect(searchExercises('squ', ['Zercher Squat'])[0].name).toBe('Zercher Squat');
  });
});

describe('understanding misheard exercises (requirement 15)', () => {
  it('matches names that sound alike but are spelled differently', () => {
    expect(matchExercise('dead left').best?.name).toBe('Deadlift');
    expect(matchExercise('romanian dead left').best?.name).toBe('Romanian Deadlift');
    expect(soundKey('deadlift')).toBe(soundKey('dead left'));
  });

  it('prefers exercises that fit the workout’s focus when it is unsure', () => {
    expect(matchExercise('row', [], { focus: ['Back'] }).best?.muscle).toBe('Back');
    expect(matchExercise('row', [], { focus: ['Shoulders'] }).best?.name).toBe('Upright Row');
  });

  it('prefers the trainer’s own exercises on a near tie', () => {
    const plain = matchExercise('curl');
    const withHistory = matchExercise('curl', ['Hammer Curl']);
    expect(plain.best?.name).not.toBe('Hammer Curl');
    expect([withHistory.best?.name, ...withHistory.alternatives.map((a) => a.name)]).toContain('Hammer Curl');
  });

  it('remembers a correction and gets it right the next time', () => {
    const corrections = new Map([[correctionKey('lap top pull'), 'Lat Pulldown']]);
    const match = matchExercise('lap top pull', [], { corrections });
    expect(match.best?.name).toBe('Lat Pulldown');
    expect(match.confident).toBe(true);
  });

  it('picks the phone’s guess that names a known exercise', () => {
    expect(bestTranscript(['bench rest', 'bench press', 'bench dress'])).toBe('bench press');
    expect(bestTranscript(['squat', 'squad'])).toBe('squat');
    expect(bestTranscript(['end workout', 'and work out'])).toBe('end workout');
  });
});

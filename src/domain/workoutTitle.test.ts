import { workoutTitle, type TitleInput } from './workoutTitle';

const ex = (name: string, sets: number, muscle: string | null = null): TitleInput => ({ name, muscle, sets });

describe('workoutTitle', () => {
  it('names an empty workout plainly', () => {
    expect(workoutTitle([])).toBe('Workout');
    expect(workoutTitle([ex('Something Unknown', 3)])).toBe('Workout');
  });

  it('uses the Push shorthand with the muscle groups for chest, shoulders and triceps', () => {
    expect(workoutTitle([ex('Bench Press', 4), ex('Cable Pushdown', 3)])).toBe('Push · Chest & Triceps');
    expect(
      workoutTitle([ex('Bench Press', 4), ex('Overhead Press', 3), ex('Skull Crusher', 3)]),
    ).toBe('Push · Chest, Shoulders & Triceps');
  });

  it('uses the Pull shorthand for back with biceps', () => {
    expect(workoutTitle([ex('Lat Pulldown', 4), ex('Barbell Row', 3), ex('Hammer Curl', 3)])).toBe(
      'Pull · Back & Biceps',
    );
  });

  it('names one or two muscle groups that are not a push or pull day', () => {
    expect(workoutTitle([ex('Bench Press', 4), ex('Dumbbell Fly', 3)])).toBe('Chest');
    expect(workoutTitle([ex('Bench Press', 4), ex('Barbell Curl', 3)])).toBe('Chest & Biceps');
  });

  it('calls three or more mixed upper-body groups Upper Body', () => {
    expect(
      workoutTitle([ex('Bench Press', 4), ex('Lat Pulldown', 4), ex('Lateral Raise', 3), ex('Barbell Curl', 3)]),
    ).toBe('Upper Body');
  });

  it('calls a mostly lower-body workout Legs', () => {
    expect(workoutTitle([ex('Squat', 5), ex('Leg Curl', 3), ex('Standing Calf Raise', 4)])).toBe('Legs');
    expect(workoutTitle([ex('Squat', 5), ex('Leg Press', 4), ex('Lateral Raise', 1)])).toBe('Legs');
  });

  it('calls a real mix of upper body and legs Full Body', () => {
    expect(workoutTitle([ex('Squat', 4), ex('Bench Press', 4), ex('Barbell Row', 4)])).toBe('Full Body');
    expect(workoutTitle([ex('Burpees', 3), ex('Kettlebell Swing', 3)])).toBe('Full Body');
  });

  it('ignores a little core work but names a core session', () => {
    expect(workoutTitle([ex('Bench Press', 4), ex('Cable Pushdown', 3), ex('Plank', 2)])).toBe(
      'Push · Chest & Triceps',
    );
    expect(workoutTitle([ex('Plank', 3), ex('Crunch', 3), ex('Hanging Leg Raise', 3)])).toBe('Core');
  });

  it('leaves out a muscle group that got only a few sets', () => {
    expect(
      workoutTitle([ex('Lat Pulldown', 5), ex('Barbell Row', 5), ex('Dumbbell Curl', 4), ex('Lateral Raise', 1)]),
    ).toBe('Pull · Back & Biceps');
  });

  it('uses the muscle saved with a custom exercise', () => {
    expect(workoutTitle([ex('My Special Row', 4, 'Back'), ex('Bayesian Curl', 3, 'Biceps')])).toBe(
      'Pull · Back & Biceps',
    );
  });

  it('counts an exercise without sets once', () => {
    expect(workoutTitle([ex('Bench Press', 0)])).toBe('Chest');
  });
});

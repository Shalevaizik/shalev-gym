import { loadTraining, listBodyWeights, markSummarySeen, summarySeenMonth } from './analysisRepo';
import { migrate, type Db } from './db';
import { logSets, startExercise } from './exerciseRepo';
import { saveProfile } from './profileRepo';
import { openTestDb } from './testDb';
import { endWorkout, startWorkout } from './workoutRepo';

const T0 = new Date('2026-11-05T10:00:00.000Z');
const minutes = (n: number) => new Date(T0.getTime() + n * 60_000);

describe('analysisRepo', () => {
  let db: Db;
  let counter = 0;
  const newId = () => `id${++counter}`;

  beforeEach(async () => {
    db = openTestDb();
    await migrate(db);
  });

  it('loads each workout with its exercises and sets, for its owner only', async () => {
    await startWorkout(db, 'alice', 'w1', T0);
    const [bench] = await startExercise(db, 'alice', 'w1', [{ name: 'Bench Press', muscle: 'Chest' }], null, minutes(1), newId);
    await logSets(db, 'alice', bench, [{ weight: 20, unit: 'kg', reps: 10, toFailure: false }], null, minutes(3), newId);
    await endWorkout(db, 'alice', 'w1', minutes(30));
    await startWorkout(db, 'bob', 'w2', T0);

    const training = await loadTraining(db, 'alice');
    expect(training).toHaveLength(1);
    expect(training[0]).toMatchObject({ id: 'w1', endedAt: minutes(30).toISOString(), title: null });
    expect(training[0].exercises.map((e) => [e.name, e.equipment, e.sets.length])).toEqual([['Bench Press', 'barbell', 1]]);
  });

  it('lists body weights in kg, oldest first', async () => {
    const profile = { birthDate: '1990-01-01', sex: 'male' as const, heightCm: 180, heightUnit: 'cm' as const };
    await saveProfile(db, 'alice', { ...profile, weight: 80, weightUnit: 'kg' }, 'b1', T0);
    await saveProfile(db, 'alice', { ...profile, weight: 180, weightUnit: 'lb' }, 'b2', minutes(60 * 24 * 40));
    const weights = await listBodyWeights(db, 'alice');
    expect(weights.map((w) => Math.round(w.kg))).toEqual([80, 82]);
  });

  it('remembers the latest monthly summary opened', async () => {
    expect(await summarySeenMonth(db, 'alice')).toBeNull();
    await markSummarySeen(db, 'alice', '2026-10', T0);
    await markSummarySeen(db, 'alice', '2026-09', T0);
    expect(await summarySeenMonth(db, 'alice')).toBe('2026-10');
  });
});

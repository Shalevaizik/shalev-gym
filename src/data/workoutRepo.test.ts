import { AUTO_END_IDLE_MS } from '../domain/workout';
import { migrate, type Db } from './db';
import { logSets, startExercise } from './exerciseRepo';
import { openTestDb } from './testDb';
import {
  autoTitles,
  closeStaleWorkout,
  endWorkout,
  getActiveWorkout,
  getWorkout,
  listWorkouts,
  renameWorkout,
  startWorkout,
} from './workoutRepo';

const T0 = new Date('2026-11-02T08:00:00.000Z');
const later = (ms: number) => new Date(T0.getTime() + ms);
const HOUR = 60 * 60 * 1000;

describe('workoutRepo', () => {
  let db: Db;

  beforeEach(async () => {
    db = openTestDb();
    await migrate(db);
  });

  it('migrates repeatedly without error', async () => {
    await migrate(db);
    expect(await listWorkouts(db, 'alice')).toEqual([]);
  });

  it('opens a workout record with the current date and time', async () => {
    const workout = await startWorkout(db, 'alice', 'w1', T0);

    expect(workout).toMatchObject({
      id: 'w1',
      userId: 'alice',
      startedAt: T0.toISOString(),
      endedAt: null,
      endReason: null,
    });
  });

  it('returns the workout in progress instead of opening a second one', async () => {
    await startWorkout(db, 'alice', 'w1', T0);
    const again = await startWorkout(db, 'alice', 'w2', later(1000));

    expect(again.id).toBe('w1');
    expect(await listWorkouts(db, 'alice')).toHaveLength(1);
  });

  it('allows multiple workouts on the same day, newest first', async () => {
    await startWorkout(db, 'alice', 'w1', T0);
    await endWorkout(db, 'alice', 'w1', later(HOUR));
    await startWorkout(db, 'alice', 'w2', later(2 * HOUR));

    const workouts = await listWorkouts(db, 'alice');
    expect(workouts.map((w) => w.id)).toEqual(['w2', 'w1']);
  });

  it('records when and why a workout ended', async () => {
    await startWorkout(db, 'alice', 'w1', T0);
    await endWorkout(db, 'alice', 'w1', later(HOUR));

    expect(await getActiveWorkout(db, 'alice')).toBeNull();
    expect(await getWorkout(db, 'alice', 'w1')).toMatchObject({
      endedAt: later(HOUR).toISOString(),
      endReason: 'user',
    });
  });

  it('does not overwrite the end time of a finished workout', async () => {
    await startWorkout(db, 'alice', 'w1', T0);
    await endWorkout(db, 'alice', 'w1', later(HOUR));
    await endWorkout(db, 'alice', 'w1', later(2 * HOUR));

    const workout = await getWorkout(db, 'alice', 'w1');
    expect(workout?.endedAt).toBe(later(HOUR).toISOString());
  });

  it('closes an abandoned workout at its last activity', async () => {
    await startWorkout(db, 'alice', 'w1', T0);
    await closeStaleWorkout(db, 'alice', later(AUTO_END_IDLE_MS));

    expect(await getWorkout(db, 'alice', 'w1')).toMatchObject({
      endedAt: T0.toISOString(),
      endReason: 'auto',
    });
  });

  it('keeps a workout open until the idle limit is reached', async () => {
    await startWorkout(db, 'alice', 'w1', T0);
    await closeStaleWorkout(db, 'alice', later(AUTO_END_IDLE_MS - 1));

    expect((await getActiveWorkout(db, 'alice'))?.id).toBe('w1');
  });

  it('starts a new workout when the previous one was abandoned', async () => {
    await startWorkout(db, 'alice', 'w1', T0);
    const next = await startWorkout(db, 'alice', 'w2', later(AUTO_END_IDLE_MS));

    expect(next.id).toBe('w2');
    expect((await getWorkout(db, 'alice', 'w1'))?.endReason).toBe('auto');
  });

  it('keeps each user’s workouts separate on a shared device', async () => {
    await startWorkout(db, 'alice', 'w1', T0);
    const bobs = await startWorkout(db, 'bob', 'w2', T0);

    expect(bobs.id).toBe('w2');
    expect(await getWorkout(db, 'bob', 'w1')).toBeNull();
    expect((await listWorkouts(db, 'alice')).map((w) => w.id)).toEqual(['w1']);

    await endWorkout(db, 'bob', 'w1', later(HOUR));
    expect((await getActiveWorkout(db, 'alice'))?.id).toBe('w1');
  });

  describe('titles', () => {
    let counter = 0;
    const newId = () => `id${++counter}`;
    const set = { weight: 60, unit: 'kg' as const, reps: 10, toFailure: false };

    async function doExercise(userId: string, workoutId: string, name: string, muscle: string | null, sets: number) {
      const [id] = await startExercise(db, userId, workoutId, [{ name, muscle }], null, later(1000), newId);
      await logSets(db, userId, id, Array.from({ length: sets }, () => set), null, later(2000), newId);
    }

    it('names each workout from its exercises, for its owner only', async () => {
      await startWorkout(db, 'alice', 'w1', T0);
      await doExercise('alice', 'w1', 'Lat Pulldown', 'Back', 4);
      await doExercise('alice', 'w1', 'Hammer Curl', 'Biceps', 3);
      await endWorkout(db, 'alice', 'w1', later(HOUR));
      await startWorkout(db, 'alice', 'w2', later(2 * HOUR));
      await doExercise('alice', 'w2', 'Squat', 'Quads', 5);

      const titles = await autoTitles(db, 'alice');
      expect(titles.get('w1')).toBe('Pull · Back & Biceps');
      expect(titles.get('w2')).toBe('Legs');
      expect((await autoTitles(db, 'bob')).size).toBe(0);
    });

    it('keeps a title the trainer chose until it is cleared', async () => {
      await startWorkout(db, 'alice', 'w1', T0);
      await renameWorkout(db, 'alice', 'w1', '  Deload day ');
      expect((await getWorkout(db, 'alice', 'w1'))?.title).toBe('Deload day');

      await renameWorkout(db, 'bob', 'w1', 'Not yours');
      expect((await getWorkout(db, 'alice', 'w1'))?.title).toBe('Deload day');

      await renameWorkout(db, 'alice', 'w1', '   ');
      expect((await getWorkout(db, 'alice', 'w1'))?.title).toBeNull();
    });
  });
});

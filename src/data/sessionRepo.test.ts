import { readCardioSession } from '../domain/setLog';
import { newSession, type SessionDetails } from '../domain/session';
import { migrate, type Db } from './db';
import { listExercises, logSets, saveSession, startExercise, updateSession } from './exerciseRepo';
import { listRoutines, saveRoutine, updateRoutine } from './routineRepo';
import { openTestDb } from './testDb';
import { startWorkout } from './workoutRepo';

const T0 = new Date('2026-11-26T17:00:00.000Z');
const minutes = (n: number) => new Date(T0.getTime() + n * 60_000);

const hiit: SessionDetails = {
  ...newSession('hiit', 'intervals'),
  movements: [
    { name: 'Goblet Squat', amount: 12, unit: 'reps', weightKg: 16 },
    { name: 'Rowing Machine', amount: 15, unit: 'calories', weightKg: null },
  ],
};

describe('cardio sessions and HIIT/CrossFit logs (requirements 23 and 24)', () => {
  let db: Db;
  let counter: number;
  const newId = () => `id${++counter}`;

  beforeEach(async () => {
    counter = 0;
    db = openTestDb();
    await migrate(db);
    await startWorkout(db, 'alice', 'w1', T0);
  });

  it('keeps a cardio machine’s settings with the session', async () => {
    const [id] = await startExercise(db, 'alice', 'w1', [{ name: 'Treadmill', muscle: 'Cardio' }], null, minutes(1), newId);
    const command = readCardioSession('20 minutes speed 6.5 incline 8');
    if (command.kind !== 'sets') throw new Error('not read');
    await logSets(db, 'alice', id, command.sets, null, minutes(21), newId);

    const [treadmill] = await listExercises(db, 'alice', 'w1');
    expect(treadmill.equipment).toBe('cardio');
    expect(treadmill.sets[0]).toMatchObject({ durationS: 1200, cardio: { speedKmh: 6.5, incline: 8 } });
  });

  it('saves a HIIT session as one finished exercise with its time', async () => {
    // An exercise in progress is finished when the session is saved.
    await startExercise(db, 'alice', 'w1', [{ name: 'Squat', muscle: 'Quads' }], null, minutes(1), newId);
    const sessionId = await saveSession(
      db,
      'alice',
      'w1',
      { name: 'HIIT', details: hiit, durationS: 600, routineId: null },
      minutes(15),
      newId,
    );

    const exercises = await listExercises(db, 'alice', 'w1');
    // The squat had no sets, so it was dropped as not done.
    expect(exercises).toHaveLength(1);
    const [session] = exercises;
    expect(session).toMatchObject({ id: sessionId, name: 'HIIT', muscle: 'Cardio', equipment: 'cardio', measure: 'time' });
    expect(session.finishedAt).toBe(minutes(15).toISOString());
    expect(session.session).toEqual(hiit);
    expect(session.sets).toHaveLength(1);
    expect(session.sets[0]).toMatchObject({ durationS: 600, endedAt: minutes(15).toISOString(), startedAt: minutes(5).toISOString() });

    const changed = { ...hiit, rounds: 12 };
    await updateSession(db, 'alice', sessionId, { name: 'HIIT', details: changed, durationS: 720, routineId: null });
    const [after] = await listExercises(db, 'alice', 'w1');
    expect(after.session?.rounds).toBe(12);
    expect(after.sets[0]).toMatchObject({ durationS: 720, endedAt: minutes(15).toISOString() });
  });

  it('saves routines by name, replacing one with the same name, and updates them', async () => {
    const first = await saveRoutine(db, 'alice', 'Friday WOD', hiit, minutes(1), newId);
    const again = await saveRoutine(db, 'alice', 'friday wod', { ...hiit, rounds: 8 }, minutes(2), newId);
    expect(again.id).toBe(first.id);
    await saveRoutine(db, 'bob', 'Friday WOD', hiit, minutes(3), newId);

    let mine = await listRoutines(db, 'alice');
    expect(mine).toHaveLength(1);
    expect(mine[0]).toMatchObject({ name: 'friday wod', details: { rounds: 8 } });

    await updateRoutine(db, 'alice', first.id, { ...hiit, rounds: 6 }, minutes(4));
    mine = await listRoutines(db, 'alice');
    expect(mine[0].details.rounds).toBe(6);
  });
});

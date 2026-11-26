import { migrate } from './db';
import { openTestDb } from './testDb';

describe('migrate', () => {
  it('keeps every exercise and set when cardio is added as an equipment type', async () => {
    const db = openTestDb();
    await migrate(db, 6);
    await db.runAsync(
      `INSERT INTO workouts (id, user_id, started_at, last_activity_at) VALUES ('w1', 'u1', '2026-11-20T10:00:00Z', '2026-11-20T10:00:00Z')`,
    );
    await db.runAsync(
      `INSERT INTO exercises (id, workout_id, user_id, position, name, created_at, muscle, finished_at, equipment, measure, bar_kg)
       VALUES ('e1', 'w1', 'u1', 0, 'Bench Press', '2026-11-20T10:01:00Z', 'Chest', NULL, 'barbell', 'reps', 20)`,
    );
    await db.runAsync(
      `INSERT INTO exercise_sets (id, exercise_id, user_id, position, weight, unit, reps) VALUES ('s1', 'e1', 'u1', 0, 40, 'kg', 8)`,
    );

    await migrate(db);

    const exercise = await db.getFirstAsync<Record<string, unknown>>('SELECT * FROM exercises WHERE id = ?', ['e1']);
    expect(exercise).toMatchObject({ name: 'Bench Press', muscle: 'Chest', equipment: 'barbell', bar_kg: 20, finished_at: null });
    const joined = await db.getFirstAsync<{ reps: number }>(
      'SELECT s.reps FROM exercise_sets s JOIN exercises e ON e.id = s.exercise_id WHERE e.id = ?',
      ['e1'],
    );
    expect(joined?.reps).toBe(8);
    await db.runAsync(
      `INSERT INTO exercises (id, workout_id, user_id, position, name, created_at, equipment, measure)
       VALUES ('e2', 'w1', 'u1', 1, 'Treadmill', '2026-11-20T10:30:00Z', 'cardio', 'time')`,
    );
    const version = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
    expect(version?.user_version).toBe(7);
  });
});

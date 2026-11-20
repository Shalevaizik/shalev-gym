import { migrate, type Db } from './db';
import { dismissWeightReminder, getProfile, saveProfile, weightOn, type ProfileUpdate } from './profileRepo';
import { openTestDb } from './testDb';

const DAY = 24 * 60 * 60 * 1000;
const T0 = new Date('2026-09-01T09:00:00.000Z');
const day = (n: number) => new Date(T0.getTime() + n * DAY);

const update = (weight: number, weightUnit: 'kg' | 'lb' = 'kg'): ProfileUpdate => ({
  birthDate: '1990-03-05',
  sex: 'male',
  heightCm: 180,
  heightUnit: 'cm',
  weight,
  weightUnit,
});

describe('profileRepo', () => {
  let db: Db;

  beforeEach(async () => {
    db = openTestDb();
    await migrate(db);
  });

  it('starts empty', async () => {
    expect(await getProfile(db, 'alice')).toMatchObject({ birthDate: null, sex: null, weight: null });
  });

  it('saves the profile with the latest body weight', async () => {
    await saveProfile(db, 'alice', update(80), 'b1', T0);

    expect(await getProfile(db, 'alice')).toMatchObject({
      birthDate: '1990-03-05',
      sex: 'male',
      heightCm: 180,
      heightUnit: 'cm',
      weight: { weight: 80, unit: 'kg', recordedAt: T0.toISOString() },
    });
    expect(await getProfile(db, 'bob')).toMatchObject({ weight: null });
  });

  it('keeps each body weight change with its date, for workouts on that date', async () => {
    await saveProfile(db, 'alice', update(80), 'b1', T0);
    await saveProfile(db, 'alice', update(84), 'b2', day(40));

    expect((await getProfile(db, 'alice')).weight?.weight).toBe(84);
    expect((await weightOn(db, 'alice', day(10)))?.weight).toBe(80);
    expect((await weightOn(db, 'alice', day(50)))?.weight).toBe(84);
    // Before the first entry, the first one known is the best guess.
    expect((await weightOn(db, 'alice', day(-30)))?.weight).toBe(80);
  });

  it('counts saving the same weight as a check-in, without a duplicate entry', async () => {
    await saveProfile(db, 'alice', update(80), 'b1', T0);
    await saveProfile(db, 'alice', update(80), 'b2', day(35));

    expect((await getProfile(db, 'alice')).weight?.recordedAt).toBe(day(35).toISOString());
    expect(await db.getAllAsync('SELECT * FROM body_weights')).toHaveLength(1);
  });

  it('records "not now" on the weight reminder, also before a profile exists', async () => {
    await dismissWeightReminder(db, 'alice', day(3));
    expect((await getProfile(db, 'alice')).reminderDismissedAt).toBe(day(3).toISOString());

    await saveProfile(db, 'alice', update(80), 'b1', day(4));
    expect((await getProfile(db, 'alice')).reminderDismissedAt).toBe(day(3).toISOString());
  });
});

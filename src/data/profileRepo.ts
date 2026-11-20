import {
  EMPTY_PROFILE,
  type BodyWeight,
  type BodyWeightUnit,
  type HeightUnit,
  type Profile,
  type Sex,
} from '../domain/profile';
import type { Db } from './db';

type ProfileRow = {
  birth_date: string | null;
  sex: Sex | null;
  height_cm: number | null;
  height_unit: HeightUnit;
  weight_reminder_dismissed_at: string | null;
};

type WeightRow = { weight: number; unit: BodyWeightUnit; recorded_at: string };

const toWeight = (row: WeightRow): BodyWeight => ({
  weight: row.weight,
  unit: row.unit,
  recordedAt: row.recorded_at,
});

export async function getProfile(db: Db, userId: string): Promise<Profile> {
  const row = await db.getFirstAsync<ProfileRow>('SELECT * FROM profiles WHERE user_id = ?', [userId]);
  const weight = await db.getFirstAsync<WeightRow>(
    'SELECT weight, unit, recorded_at FROM body_weights WHERE user_id = ? ORDER BY recorded_at DESC LIMIT 1',
    [userId],
  );
  return {
    ...EMPTY_PROFILE,
    ...(row && {
      birthDate: row.birth_date,
      sex: row.sex,
      heightCm: row.height_cm,
      heightUnit: row.height_unit,
      reminderDismissedAt: row.weight_reminder_dismissed_at,
    }),
    weight: weight ? toWeight(weight) : null,
  };
}

// The body weight on a given day: the last one entered on or before it, else the first one after.
// Bodyweight exercises use it (requirement 20d).
export async function weightOn(db: Db, userId: string, at: Date): Promise<BodyWeight | null> {
  const before = await db.getFirstAsync<WeightRow>(
    `SELECT weight, unit, recorded_at FROM body_weights WHERE user_id = ? AND recorded_at <= ?
     ORDER BY recorded_at DESC LIMIT 1`,
    [userId, at.toISOString()],
  );
  if (before) return toWeight(before);
  const after = await db.getFirstAsync<WeightRow>(
    'SELECT weight, unit, recorded_at FROM body_weights WHERE user_id = ? ORDER BY recorded_at LIMIT 1',
    [userId],
  );
  return after ? toWeight(after) : null;
}

export type ProfileUpdate = {
  birthDate: string;
  sex: Sex;
  heightCm: number;
  heightUnit: HeightUnit;
  weight: number;
  weightUnit: BodyWeightUnit;
};

// Saves the profile. A body weight is added as a new dated entry only when it changed, so the
// history shows real changes; re-saving the same weight still counts as this month's check-in.
export async function saveProfile(
  db: Db,
  userId: string,
  update: ProfileUpdate,
  newWeightId: string,
  now: Date,
): Promise<void> {
  const at = now.toISOString();
  await db.execAsync('BEGIN');
  try {
    await db.runAsync(
      `INSERT INTO profiles (user_id, birth_date, sex, height_cm, height_unit, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT (user_id) DO UPDATE SET birth_date = excluded.birth_date, sex = excluded.sex,
         height_cm = excluded.height_cm, height_unit = excluded.height_unit, updated_at = excluded.updated_at`,
      [userId, update.birthDate, update.sex, update.heightCm, update.heightUnit, at],
    );
    const latest = await db.getFirstAsync<{ id: string; weight: number; unit: BodyWeightUnit }>(
      'SELECT id, weight, unit FROM body_weights WHERE user_id = ? ORDER BY recorded_at DESC LIMIT 1',
      [userId],
    );
    if (latest && latest.weight === update.weight && latest.unit === update.weightUnit) {
      await db.runAsync('UPDATE body_weights SET recorded_at = ? WHERE id = ?', [at, latest.id]);
    } else {
      await db.runAsync(
        'INSERT INTO body_weights (id, user_id, weight, unit, recorded_at) VALUES (?, ?, ?, ?, ?)',
        [newWeightId, userId, update.weight, update.weightUnit, at],
      );
    }
    await db.execAsync('COMMIT');
  } catch (error) {
    await db.execAsync('ROLLBACK');
    throw error;
  }
}

// "Not now" on the monthly weight reminder.
export async function dismissWeightReminder(db: Db, userId: string, now: Date): Promise<void> {
  const at = now.toISOString();
  await db.runAsync(
    `INSERT INTO profiles (user_id, weight_reminder_dismissed_at, updated_at) VALUES (?, ?, ?)
     ON CONFLICT (user_id) DO UPDATE SET weight_reminder_dismissed_at = excluded.weight_reminder_dismissed_at`,
    [userId, at, at],
  );
}

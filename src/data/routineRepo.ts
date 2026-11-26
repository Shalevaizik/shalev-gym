// Saved HIIT and CrossFit routines (requirement 24f), such as "Friday WOD".

import { readSession, writeSession, type Routine, type SessionDetails } from '../domain/session';
import type { Db } from './db';

type RoutineRow = { id: string; name: string; details: string; updated_at: string };

const toRoutine = (row: RoutineRow): Routine | null => {
  const details = readSession(row.details);
  return details ? { id: row.id, name: row.name, details, updatedAt: row.updated_at } : null;
};

// The trainer's routines, most recently used or changed first.
export async function listRoutines(db: Db, userId: string): Promise<Routine[]> {
  const rows = await db.getAllAsync<RoutineRow>(
    'SELECT id, name, details, updated_at FROM routines WHERE user_id = ? ORDER BY updated_at DESC',
    [userId],
  );
  return rows.map(toRoutine).filter((r): r is Routine => r !== null);
}

export async function getRoutine(db: Db, userId: string, id: string): Promise<Routine | null> {
  const row = await db.getFirstAsync<RoutineRow>(
    'SELECT id, name, details, updated_at FROM routines WHERE user_id = ? AND id = ?',
    [userId, id],
  );
  return row ? toRoutine(row) : null;
}

// Saves a new routine. A routine with the same name (any capitals) is replaced, so names stay unique.
export async function saveRoutine(
  db: Db,
  userId: string,
  name: string,
  details: SessionDetails,
  at: Date,
  newId: () => string,
): Promise<Routine> {
  const trimmed = name.trim();
  if (!trimmed) throw new Error('The routine needs a name.');
  const same = await db.getFirstAsync<{ id: string }>(
    'SELECT id FROM routines WHERE user_id = ? AND lower(name) = lower(?)',
    [userId, trimmed],
  );
  const id = same?.id ?? newId();
  if (same) {
    await db.runAsync('UPDATE routines SET name = ?, details = ?, updated_at = ? WHERE id = ?', [
      trimmed,
      writeSession(details),
      at.toISOString(),
      id,
    ]);
  } else {
    await db.runAsync('INSERT INTO routines (id, user_id, name, details, updated_at) VALUES (?, ?, ?, ?, ?)', [
      id,
      userId,
      trimmed,
      writeSession(details),
      at.toISOString(),
    ]);
  }
  return { id, name: trimmed, details, updatedAt: at.toISOString() };
}

// "Update routine": the routine takes the session's structure and movements.
export async function updateRoutine(db: Db, userId: string, id: string, details: SessionDetails, at: Date): Promise<void> {
  await db.runAsync('UPDATE routines SET details = ?, updated_at = ? WHERE user_id = ? AND id = ?', [
    writeSession(details),
    at.toISOString(),
    userId,
    id,
  ]);
}

// Using a routine moves it to the top of the list.
export async function touchRoutine(db: Db, userId: string, id: string, at: Date): Promise<void> {
  await db.runAsync('UPDATE routines SET updated_at = ? WHERE user_id = ? AND id = ?', [at.toISOString(), userId, id]);
}

export async function deleteRoutine(db: Db, userId: string, id: string): Promise<void> {
  await db.runAsync('DELETE FROM routines WHERE user_id = ? AND id = ?', [userId, id]);
}

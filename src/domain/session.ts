// HIIT and CrossFit sessions (requirement 24): logged, not run. A session is its structure (Intervals,
// Tabata, EMOM, AMRAP or For Time, with their settings), its movements with their amounts, and how
// long it took. A session can be saved as a named routine and used again.

import { muscleOf } from './exerciseCatalog';
import { muscleShares, type BodyMuscle } from './muscles';

export type SessionKind = 'hiit' | 'crossfit';
export type Structure = 'intervals' | 'tabata' | 'emom' | 'amrap' | 'for-time';
export type AmountUnit = 'reps' | 'calories' | 'meters' | 'seconds';

export type Movement = {
  name: string;
  amount: number | null;
  unit: AmountUnit;
  // The weight used, in kg: barbell snatch 20 kg, slam ball 16 kg.
  weightKg: number | null;
};

export type SessionDetails = {
  kind: SessionKind;
  structure: Structure;
  workS: number | null; // Intervals and Tabata
  restS: number | null; // Intervals and Tabata
  rounds: number | null; // Intervals, Tabata and For Time
  minutes: number | null; // EMOM and AMRAP: how many minutes the clock ran
  movements: Movement[];
};

export const KIND_LABEL: Record<SessionKind, string> = { hiit: 'HIIT', crossfit: 'CrossFit' };

export const STRUCTURES: { value: Structure; label: string; detail: string }[] = [
  { value: 'intervals', label: 'Intervals', detail: 'Work, rest, rounds' },
  { value: 'tabata', label: 'Tabata', detail: '20 s on, 10 s off, 8 rounds' },
  { value: 'emom', label: 'EMOM', detail: 'Every minute on the minute' },
  { value: 'amrap', label: 'AMRAP', detail: 'As many rounds as possible' },
  { value: 'for-time', label: 'For Time', detail: 'Rounds as fast as you can' },
];

// The movements offered on the session screen before anything is typed, by type. Every name is in
// the exercise catalog, so each one counts toward its muscle group (requirement 24g).
export const SESSION_MOVEMENTS: { group: string; names: string[] }[] = [
  {
    group: 'Bodyweight',
    names: [
      'Burpees', 'Air Squat', 'Jump Squat', 'Push-Up', 'Sit-Up', 'Mountain Climber', 'Jumping Jack', 'High Knees',
      'Box Jump', 'Box Jump-Over', 'Burpee Box Jump-Over', 'Jumping Lunge', 'Lunges', 'Broad Jump', 'Tuck Jump',
      'Skater Jump', 'Pistol Squat', 'Bear Crawl', 'Plank', 'V-Up', 'Hollow Hold', 'Flutter Kicks',
      'Handstand Push-Up', 'Handstand Walk',
    ],
  },
  {
    group: 'Gymnastics',
    names: [
      'Pull-Up', 'Kipping Pull-Up', 'Chest-to-Bar Pull-Up', 'Burpee Pull-Up', 'Muscle-Up', 'Toes-to-Bar',
      'Knees-to-Elbows', 'Hanging Leg Raise', 'Ring Dip', 'Dips', 'Ring Row', 'Rope Climb', 'GHD Sit-Up', 'L-Sit',
    ],
  },
  {
    group: 'Kettlebell and dumbbell',
    names: [
      'Kettlebell Swing', 'Goblet Squat', 'Kettlebell Snatch', 'Kettlebell Clean', 'Kettlebell Goblet Lunge',
      'Turkish Get-Up', 'Dumbbell Snatch', 'Dumbbell Clean', 'Dumbbell Thruster', 'Devil Press', 'Man Maker',
      'Renegade Row', 'Dumbbell Overhead Lunge', "Farmer's Walk",
    ],
  },
  {
    group: 'Barbell',
    names: [
      'Thruster', 'Deadlift', 'Power Clean', 'Hang Power Clean', 'Squat Clean', 'Clean and Jerk', 'Snatch',
      'Power Snatch', 'Front Squat', 'Overhead Squat', 'Squat', 'Push Press', 'Push Jerk', 'Overhead Press',
      'Shoulder to Overhead', 'Ground to Overhead', 'Sumo Deadlift High Pull',
    ],
  },
  {
    group: 'Ball, sled and more',
    names: ['Wall Ball', 'Slam Ball', 'Battle Ropes', 'Sled Push', 'Sled Pull', 'Sandbag Carry', 'Sandbag Clean', 'Tire Flip'],
  },
  {
    group: 'Cardio',
    names: [
      'Rowing Machine', 'Stationary Bike', 'Ski Erg', 'Running', 'Sprint', 'Shuttle Run', 'Double-Unders', 'Jump Rope',
      'Treadmill', 'Stair Climber',
    ],
  },
];

export const UNIT_LABEL: Record<AmountUnit, string> = { reps: 'reps', calories: 'cal', meters: 'm', seconds: 's' };

// What a new session starts with, so Tabata is ready to save as it is.
export function newSession(kind: SessionKind, structure: Structure = kind === 'hiit' ? 'intervals' : 'for-time'): SessionDetails {
  return { kind, ...structureDefaults(structure), movements: [] };
}

export function structureDefaults(structure: Structure): Pick<SessionDetails, 'structure' | 'workS' | 'restS' | 'rounds' | 'minutes'> {
  switch (structure) {
    case 'tabata':
      return { structure, workS: 20, restS: 10, rounds: 8, minutes: null };
    case 'intervals':
      return { structure, workS: 30, restS: 30, rounds: 10, minutes: null };
    case 'emom':
      return { structure, workS: null, restS: null, rounds: null, minutes: 12 };
    case 'amrap':
      return { structure, workS: null, restS: null, rounds: null, minutes: 15 };
    case 'for-time':
      return { structure, workS: null, restS: null, rounds: 5, minutes: null };
  }
}

// The words that open the session screen (requirement 24a), with the structure they name.
const TRIGGERS: { pattern: RegExp; kind: SessionKind; structure?: Structure }[] = [
  { pattern: /^(a\s+)?(hiit|h i i t|hit workout|interval training|intervals)\b/, kind: 'hiit', structure: 'intervals' },
  { pattern: /^(a\s+)?tabata\b/, kind: 'hiit', structure: 'tabata' },
  { pattern: /^(a\s+)?(crossfit|cross fit|cross-fit|wod|metcon)\b/, kind: 'crossfit' },
  { pattern: /^(an?\s+)?(emom|e m o m|every minute on the minute)\b/, kind: 'crossfit', structure: 'emom' },
  { pattern: /^(an?\s+)?(amrap|am rap|a m r a p|as many rounds as possible)\b/, kind: 'crossfit', structure: 'amrap' },
  { pattern: /^(a\s+)?for time\b/, kind: 'crossfit', structure: 'for-time' },
];

export function sessionTrigger(text: string): { kind: SessionKind; structure: Structure } | null {
  const plain = text
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z\s-]/g, ' ')
    .replace(/\b(start|starting|let'?s do|doing|now|next|ok|okay|so)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  for (const trigger of TRIGGERS) {
    if (trigger.pattern.test(plain)) {
      return { kind: trigger.kind, structure: trigger.structure ?? newSession(trigger.kind).structure };
    }
  }
  return null;
}

// Whether a name the app saved is a session's own: "HIIT", "CrossFit".
export function isSessionName(name: string): boolean {
  return sessionTrigger(name) !== null && name.trim().split(/\s+/).length <= 2;
}

const seconds = (s: number) => (s % 60 === 0 && s >= 60 ? `${s / 60} min` : `${s} s`);

// "Intervals · 30 s on / 30 s off · 10 rounds", "AMRAP · 15 min", "For Time · 5 rounds"
export function describeStructure(details: SessionDetails): string {
  const label = STRUCTURES.find((s) => s.value === details.structure)?.label ?? details.structure;
  const parts = [label];
  if (details.structure === 'intervals' || details.structure === 'tabata') {
    if (details.workS) parts.push(`${seconds(details.workS)} on${details.restS ? ` / ${seconds(details.restS)} off` : ''}`);
  }
  if (details.minutes && (details.structure === 'emom' || details.structure === 'amrap')) parts.push(`${details.minutes} min`);
  if (details.rounds && details.structure !== 'emom' && details.structure !== 'amrap') {
    parts.push(`${details.rounds} ${details.rounds === 1 ? 'round' : 'rounds'}`);
  }
  return parts.join(' · ');
}

// "Barbell Snatch · 20 kg × 5", "Burpees × 20", "Bike · 45 cal", "Row · 500 m", "Plank · 30 s"
export function describeMovement(movement: Movement): string {
  const weight = movement.weightKg ? `${Math.round(movement.weightKg * 10) / 10} kg` : '';
  if (movement.amount === null) return [movement.name, weight].filter(Boolean).join(' · ');
  if (movement.unit === 'reps') {
    return weight ? `${movement.name} · ${weight} × ${movement.amount}` : `${movement.name} × ${movement.amount}`;
  }
  return [movement.name, weight, `${movement.amount} ${UNIT_LABEL[movement.unit]}`].filter(Boolean).join(' · ');
}

// How many times each movement was done, for the body map: the rounds when known, the minutes
// shared out between the movements on an EMOM, and once otherwise (an AMRAP's rounds aren't recorded).
function timesDone(details: SessionDetails): number {
  if (details.rounds) return details.rounds;
  if (details.structure === 'emom' && details.minutes) return Math.max(1, details.minutes / Math.max(1, details.movements.length));
  return 1;
}

// Requirement 24g: the movements count toward their muscle groups at half credit, like helper muscles.
export function sessionMuscleSets(details: SessionDetails): Map<BodyMuscle, number> {
  const sets = new Map<BodyMuscle, number>();
  const times = timesDone(details);
  for (const movement of details.movements) {
    const main = muscleOf(movement.name);
    if (!main || main === 'Cardio') continue;
    // Half of what a normal set gives: half for the main group, a quarter for helpers and full-body.
    for (const [muscle, share] of muscleShares(movement.name, main)) {
      sets.set(muscle, (sets.get(muscle) ?? 0) + 0.5 * share * times);
    }
  }
  return sets;
}

// Sessions are saved as text in the database; anything unreadable is treated as no session.
export function readSession(text: string | null): SessionDetails | null {
  if (!text) return null;
  try {
    const value = JSON.parse(text) as Partial<SessionDetails>;
    if (!value || !value.kind || !value.structure || !Array.isArray(value.movements)) return null;
    return {
      kind: value.kind,
      structure: value.structure,
      workS: value.workS ?? null,
      restS: value.restS ?? null,
      rounds: value.rounds ?? null,
      minutes: value.minutes ?? null,
      movements: value.movements.map((m) => ({
        name: String(m.name ?? ''),
        amount: typeof m.amount === 'number' ? m.amount : null,
        unit: m.unit ?? 'reps',
        weightKg: typeof m.weightKg === 'number' ? m.weightKg : null,
      })),
    };
  } catch {
    return null;
  }
}

export const writeSession = (details: SessionDetails) => JSON.stringify(details);

export type Routine = { id: string; name: string; details: SessionDetails; updatedAt: string };

// The routine the trainer named, said as the whole phrase ("Friday WOD", "do the Friday WOD").
export function routineSaid(text: string, routines: Routine[]): Routine | null {
  const plain = (s: string) => s.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
  const said = plain(text).replace(/^(start|starting|let s do|lets do|do|doing|the|my)\s+/g, '').replace(/^(the|my)\s+/, '');
  return routines.find((r) => plain(r.name) === said) ?? null;
}

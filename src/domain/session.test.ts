import {
  describeMovement,
  describeStructure,
  newSession,
  readSession,
  routineSaid,
  sessionMuscleSets,
  sessionTrigger,
  writeSession,
  type SessionDetails,
} from './session';

const wod: SessionDetails = {
  kind: 'crossfit',
  structure: 'for-time',
  workS: null,
  restS: null,
  rounds: 5,
  minutes: null,
  movements: [
    { name: 'Power Clean', amount: 5, unit: 'reps', weightKg: 40 },
    { name: 'Burpees', amount: 20, unit: 'reps', weightKg: null },
    { name: 'Stationary Bike', amount: 45, unit: 'calories', weightKg: null },
  ],
};

describe('HIIT and CrossFit sessions (requirement 24)', () => {
  it('opens from what the trainer says', () => {
    expect(sessionTrigger('HIIT')).toEqual({ kind: 'hiit', structure: 'intervals' });
    expect(sessionTrigger("let's do crossfit")).toEqual({ kind: 'crossfit', structure: 'for-time' });
    expect(sessionTrigger('AMRAP')).toEqual({ kind: 'crossfit', structure: 'amrap' });
    expect(sessionTrigger('EMOM')).toEqual({ kind: 'crossfit', structure: 'emom' });
    expect(sessionTrigger('tabata')).toEqual({ kind: 'hiit', structure: 'tabata' });
    expect(sessionTrigger('bench press')).toBeNull();
    expect(sessionTrigger('hip thrust')).toBeNull();
  });

  it('describes the structure and the movements', () => {
    expect(describeStructure(newSession('hiit', 'tabata'))).toBe('Tabata · 20 s on / 10 s off · 8 rounds');
    expect(describeStructure({ ...newSession('crossfit', 'amrap'), minutes: 15 })).toBe('AMRAP · 15 min');
    expect(describeStructure(wod)).toBe('For Time · 5 rounds');
    expect(describeMovement(wod.movements[0])).toBe('Power Clean · 40 kg × 5');
    expect(describeMovement(wod.movements[1])).toBe('Burpees × 20');
    expect(describeMovement(wod.movements[2])).toBe('Stationary Bike · 45 cal');
  });

  it('counts the movements toward their muscles at half credit, per round', () => {
    const sets = sessionMuscleSets({ ...wod, movements: [{ name: 'Goblet Squat', amount: 10, unit: 'reps', weightKg: 16 }] });
    // 5 rounds × half a set for quads; helpers (glutes, core) get a quarter set each round.
    expect(sets.get('Quads')).toBe(2.5);
    expect(sets.get('Glutes')).toBe(1.25);
    // Cardio movements don't count toward a muscle.
    expect(sessionMuscleSets({ ...wod, movements: [wod.movements[2]] }).size).toBe(0);
  });

  it('saves and reads back as text, ignoring anything broken', () => {
    expect(readSession(writeSession(wod))).toEqual(wod);
    expect(readSession('not json')).toBeNull();
    expect(readSession(null)).toBeNull();
  });

  it('finds a saved routine said by name', () => {
    const routines = [{ id: 'r1', name: 'Friday WOD', details: wod, updatedAt: '' }];
    expect(routineSaid('Friday WOD', routines)?.id).toBe('r1');
    expect(routineSaid('do the friday wod', routines)?.id).toBe('r1');
    expect(routineSaid('friday', routines)).toBeNull();
  });
});

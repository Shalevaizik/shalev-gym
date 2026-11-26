import {
  describeMovement,
  describeStructure,
  newSession,
  readSession,
  routineSaid,
  sessionMuscleSets,
  SESSION_MOVEMENTS,
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

describe('the movements offered for HIIT and CrossFit', () => {
  it('are all known exercises with a muscle group and equipment', () => {
    const { CATALOG } = jest.requireActual('./exerciseCatalog') as typeof import('./exerciseCatalog');
    const { kindFor } = jest.requireActual('./equipment') as typeof import('./equipment');
    const known = new Set(CATALOG.map((e) => e.name));
    const names = SESSION_MOVEMENTS.flatMap((g) => g.names);
    expect(names.filter((name) => !known.has(name))).toEqual([]);
    expect(new Set(names).size).toBe(names.length);
    expect(kindFor('Thruster').equipment).toBe('barbell');
    expect(kindFor('Box Jump').equipment).toBe('bodyweight');
    expect(kindFor('Ski Erg')).toMatchObject({ equipment: 'cardio', measure: 'time' });
  });

  it('are found when searched by their usual names', () => {
    const { matchExercise } = jest.requireActual('./exerciseCatalog') as typeof import('./exerciseCatalog');
    expect(matchExercise('wall balls').best?.name).toBe('Wall Ball');
    expect(matchExercise('t2b').best?.name).toBe('Toes-to-Bar');
    expect(matchExercise('db snatch').best?.name).toBe('Dumbbell Snatch');
    expect(matchExercise('ball slams').best?.name).toBe('Slam Ball');
    expect(matchExercise('thrusters').best?.name).toBe('Thruster');
  });
});

describe('the amount a movement starts with', () => {
  it('fits the movement', () => {
    const { defaultUnit } = jest.requireActual('./session') as typeof import('./session');
    expect(defaultUnit('Rowing Machine')).toBe('calories');
    expect(defaultUnit('Stationary Bike')).toBe('calories');
    expect(defaultUnit('Ski Erg')).toBe('calories');
    expect(defaultUnit('Running')).toBe('meters');
    expect(defaultUnit("Farmer's Walk")).toBe('meters');
    expect(defaultUnit('Sled Push')).toBe('meters');
    expect(defaultUnit('Plank')).toBe('seconds');
    expect(defaultUnit('Battle Ropes')).toBe('seconds');
    expect(defaultUnit('Double-Unders')).toBe('reps');
    // Rows that aren't the rowing machine are counted in reps.
    expect(defaultUnit('Ring Row')).toBe('reps');
    expect(defaultUnit('Renegade Row')).toBe('reps');
    expect(defaultUnit('Thruster')).toBe('reps');
  });
});

import {
  barTypeFor,
  formatSetFor,
  kindFor,
  loadKg,
  saysEzBar,
  shortSetFor,
  type ExerciseKind,
} from './equipment';
import type { ParsedSet } from './exerciseLog';

const set = (weight: number | null, unit: 'kg' | 'lb' | null, reps: number | null, durationS?: number): ParsedSet => ({
  weight,
  unit,
  reps,
  toFailure: false,
  ...(durationS !== undefined && { durationS }),
});
const BARBELL: ExerciseKind = { equipment: 'barbell', measure: 'reps', barKg: 20 };
const DUMBBELLS: ExerciseKind = { equipment: 'dumbbells', measure: 'reps', barKg: null };
const BODYWEIGHT: ExerciseKind = { equipment: 'bodyweight', measure: 'reps', barKg: null };
const PLANK: ExerciseKind = { equipment: 'bodyweight', measure: 'time', barKg: null };

describe('kindFor', () => {
  it('knows the catalog’s equipment, measure and bar weight', () => {
    expect(kindFor('Bench Press')).toEqual(BARBELL);
    expect(kindFor('EZ Bar Curl')).toEqual({ equipment: 'barbell', measure: 'reps', barKg: 10 });
    expect(kindFor('Dumbbell Bench Press')).toEqual(DUMBBELLS);
    expect(kindFor('Dumbbell Row').equipment).toBe('dumbbell');
    expect(kindFor('Leg Press').equipment).toBe('plates');
    expect(kindFor('Lat Pulldown').equipment).toBe('machine');
    expect(kindFor('Pull-Up')).toEqual(BODYWEIGHT);
    expect(kindFor('Plank')).toEqual(PLANK);
  });

  it('guesses custom exercises from their name', () => {
    expect(kindFor('Incline Smith Press').equipment).toBe('barbell');
    expect(kindFor('Seated Dumbbell Curl').equipment).toBe('dumbbells');
    expect(kindFor('Dumbell Incline Bench Press').equipment).toBe('dumbbells');
    expect(kindFor('Dumbbell Incline Bench Press').equipment).toBe('dumbbells');
    expect(kindFor('Single Arm Dumbbell Press').equipment).toBe('dumbbell');
    expect(kindFor('Cable Woodchopper').equipment).toBe('machine');
    expect(kindFor('Hollow Body Hold')).toEqual({ equipment: 'bodyweight', measure: 'time', barKg: null });
    expect(kindFor('Something New').equipment).toBe('machine');
  });
});

describe('formatSetFor', () => {
  it('shows a barbell as weight per side with the total', () => {
    expect(formatSetFor(set(20, 'kg', 10), BARBELL)).toBe('20 kg per side · 60 kg total × 10 reps');
    expect(formatSetFor(set(45, 'lb', 5), BARBELL)).toBe('45 lb per side · 134 lb total × 5 reps');
    expect(formatSetFor(set(null, null, 12), BARBELL)).toBe('Empty bar (20 kg) × 12 reps');
  });

  it('shows a plate-loaded machine as weight per side with the plates total', () => {
    const PLATES: ExerciseKind = { equipment: 'plates', measure: 'reps', barKg: null };
    expect(formatSetFor(set(40, 'kg', 10), PLATES)).toBe('40 kg per side · 80 kg plates × 10 reps');
  });

  it('shows dumbbells as a pair with the total', () => {
    expect(formatSetFor(set(20, 'kg', 10), DUMBBELLS)).toBe('2 × 20 kg · 40 kg total × 10 reps');
    expect(formatSetFor(set(12, 'kg', 12), DUMBBELLS)).toBe('2 × 12 kg · 24 kg total × 12 reps');
  });

  it('shows bodyweight with or without added weight', () => {
    expect(formatSetFor(set(null, null, 12), BODYWEIGHT)).toBe('Bodyweight × 12 reps');
    expect(formatSetFor(set(10, 'kg', 8), BODYWEIGHT)).toBe('Bodyweight + 10 kg × 8 reps');
  });

  it('shows a time instead of reps', () => {
    expect(formatSetFor(set(null, null, null, 60), PLANK)).toBe('Bodyweight · 1 min');
    expect(formatSetFor(set(10, 'kg', null, 45), PLANK)).toBe('Bodyweight + 10 kg · 45 s');
    expect(formatSetFor(set(null, null, null, 90), PLANK)).toBe('Bodyweight · 1 min 30 s');
  });

  it('keeps the old format for exercises saved before equipment existed', () => {
    expect(formatSetFor(set(80, 'kg', 10), null)).toBe('80 kg (176.4 lb) × 10 reps');
  });

  it('has a short form for chips', () => {
    expect(shortSetFor(set(20, 'kg', 10), BARBELL)).toBe('20/side × 10');
    expect(shortSetFor(set(20, 'kg', 10), DUMBBELLS)).toBe('2×20=40 kg × 10');
    expect(shortSetFor(set(null, null, null, 45), PLANK)).toBe('BW · 45 s');
  });
});

describe('loadKg', () => {
  it('counts the bar and both sides of a barbell', () => {
    expect(loadKg(set(20, 'kg', 10), BARBELL, null)).toBe(60);
    expect(loadKg(set(null, null, 10), BARBELL, null)).toBe(20);
  });

  it('counts both dumbbells', () => {
    expect(loadKg(set(20, 'kg', 10), DUMBBELLS, null)).toBe(40);
  });

  it('adds body weight when it is known', () => {
    expect(loadKg(set(10, 'kg', 8), BODYWEIGHT, 80)).toBe(90);
    expect(loadKg(set(null, null, 8), BODYWEIGHT, 80)).toBe(80);
    expect(loadKg(set(10, 'kg', 8), BODYWEIGHT, null)).toBe(10);
    expect(loadKg(set(null, null, 8), BODYWEIGHT, null)).toBeNull();
  });
});

describe('EZ bar', () => {
  it('hears "EZ bar" in what the trainer said, however it was written', () => {
    expect(saysEzBar('Easy Bar skull crusher')).toBe(true);
    expect(saysEzBar('EZ bar curl')).toBe(true);
    expect(saysEzBar('e-z bar curls')).toBe(true);
    expect(saysEzBar('ezbar skull crusher')).toBe(true);
    expect(saysEzBar('skull crusher')).toBe(false);
    expect(saysEzBar('easy does it, bench press')).toBe(false);
    expect(saysEzBar(null)).toBe(false);
  });

  it('gives an exercise named with an EZ bar the 10 kg bar', () => {
    expect(kindFor('Easy Bar Skull Crusher')).toEqual({ equipment: 'barbell', measure: 'reps', barKg: 10 });
  });

  it('names the bar type from its weight', () => {
    expect(barTypeFor(20)).toBe('olympic');
    expect(barTypeFor(10)).toBe('ez');
    expect(barTypeFor(15)).toBe('other');
    expect(barTypeFor(null)).toBe('other');
  });
});

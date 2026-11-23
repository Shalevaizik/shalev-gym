// How each exercise is loaded (requirement 17) and measured (requirement 14), so a spoken number
// is understood the way the trainer means it: per side on a barbell, per hand with dumbbells,
// added weight on bodyweight exercises, and seconds on a plank.

import { formatWeight, toKg, toLb, type ParsedSet, type WeightUnit } from './exerciseLog';

export type Equipment = 'barbell' | 'dumbbells' | 'dumbbell' | 'machine' | 'plates' | 'bodyweight';
export type Measure = 'reps' | 'time';

export const EQUIPMENT_LABEL: Record<Equipment, string> = {
  barbell: 'Barbell',
  dumbbells: 'Dumbbells (pair)',
  dumbbell: 'Single dumbbell',
  machine: 'Machine or cable',
  plates: 'Plate-loaded machine',
  bodyweight: 'Bodyweight',
};

// What the trainer says for each equipment type, shown when the exercise starts.
export const EQUIPMENT_HINT: Record<Equipment, string> = {
  barbell: 'Say the weight per side, like “20 a side” or “two plates”.',
  dumbbells: 'Say the weight of one dumbbell, like “20 kg 10 reps”.',
  dumbbell: 'Say the weight of the dumbbell, like “24 kg 10 reps”.',
  machine: 'Say the weight on the machine, like “50 kg 12 reps”.',
  plates: 'Say the weight per side, like “40 a side 10 reps”.',
  bodyweight: 'Say the reps, or the added weight too, like “plus 10 kg 8 reps”.',
};

export const DEFAULT_BAR_KG = 20;
export const EZ_BAR_KG = 10;

// The bars a trainer picks from (requirement 17a). Anything else, such as a Smith machine, is
// "Other" with its own weight.
export type BarType = 'olympic' | 'ez' | 'other';
export const BAR_TYPES: { type: Exclude<BarType, 'other'>; label: string; kg: number }[] = [
  { type: 'olympic', label: 'Olympic bar', kg: DEFAULT_BAR_KG },
  { type: 'ez', label: 'EZ bar', kg: EZ_BAR_KG },
];

export function barTypeFor(barKg: number | null): BarType {
  return BAR_TYPES.find((bar) => bar.kg === barKg)?.type ?? 'other';
}

// Whether the trainer said they use an EZ bar: "EZ bar", "E-Z bar", or "easy bar" as speech
// recognition often hears it.
export function saysEzBar(text: string | null | undefined): boolean {
  return !!text && /\b(ez|e[ .-]?z|easy)[ -]?bar\b/i.test(text);
}

export type ExerciseKind = { equipment: Equipment; measure: Measure; barKg: number | null };

// The catalog's exercises. Anything else is guessed from its name (see kindFor).
const KNOWN: Record<string, [Equipment, Measure?, number?]> = {
  'bench press': ['barbell'],
  'incline bench press': ['barbell'],
  'decline bench press': ['barbell'],
  'close grip bench press': ['barbell'],
  deadlift: ['barbell'],
  'romanian deadlift': ['barbell'],
  'barbell row': ['barbell'],
  'overhead press': ['barbell'],
  'upright row': ['barbell'],
  'barbell curl': ['barbell'],
  'ez bar curl': ['barbell', 'reps', 10],
  'skull crusher': ['barbell', 'reps', 10],
  'wrist curl': ['barbell'],
  squat: ['barbell'],
  'front squat': ['barbell'],
  'good morning': ['barbell'],
  'hip thrust': ['barbell'],
  'clean and jerk': ['barbell'],
  'power clean': ['barbell'],
  shrugs: ['barbell'],
  'dumbbell bench press': ['dumbbells'],
  'incline dumbbell press': ['dumbbells'],
  'dumbbell fly': ['dumbbells'],
  'dumbbell shoulder press': ['dumbbells'],
  'arnold press': ['dumbbells'],
  'lateral raise': ['dumbbells'],
  'front raise': ['dumbbells'],
  'rear delt fly': ['dumbbells'],
  'dumbbell curl': ['dumbbells'],
  'hammer curl': ['dumbbells'],
  'incline dumbbell curl': ['dumbbells'],
  "farmer's walk": ['dumbbells'],
  'bulgarian split squat': ['dumbbells'],
  lunges: ['dumbbells'],
  'step-up': ['dumbbells'],
  'tricep kickback': ['dumbbells'],
  'dumbbell row': ['dumbbell'],
  'concentration curl': ['dumbbell'],
  'overhead tricep extension': ['dumbbell'],
  'goblet squat': ['dumbbell'],
  'kettlebell swing': ['dumbbell'],
  'russian twist': ['dumbbell'],
  'leg press': ['plates'],
  'hack squat': ['plates'],
  't-bar row': ['plates'],
  'push-up': ['bodyweight'],
  dips: ['bodyweight'],
  'tricep dips': ['bodyweight'],
  'pull-up': ['bodyweight'],
  'chin-up': ['bodyweight'],
  'back extension': ['bodyweight'],
  crunch: ['bodyweight'],
  'hanging leg raise': ['bodyweight'],
  'ab wheel': ['bodyweight'],
  burpees: ['bodyweight'],
  plank: ['bodyweight', 'time'],
  'side plank': ['bodyweight', 'time'],
  'wall sit': ['bodyweight', 'time'],
  'dead hang': ['bodyweight', 'time'],
};

// The equipment and measure of an exercise: from the catalog, else guessed from words in its name.
export function kindFor(name: string): ExerciseKind {
  const key = name.trim().toLowerCase();
  const known = KNOWN[key];
  if (known) {
    const [equipment, measure = 'reps', barKg] = known;
    return { equipment, measure, barKg: equipment === 'barbell' ? (barKg ?? DEFAULT_BAR_KG) : null };
  }
  const has = (pattern: RegExp) => pattern.test(key);
  const measure: Measure = has(/\b(plank|hold|hang|wall sit|l-?sit|isometric)\b/) ? 'time' : 'reps';
  let equipment: Equipment = 'machine';
  if (has(/\b(one arm|single arm|single|one-arm|single-arm)\b.*\bdumb?bell|\bdumb?bell\b.*\b(one arm|single arm)\b/)) {
    equipment = 'dumbbell';
  } else if (has(/\bdumb?bells?\b|\bdb\b/)) equipment = 'dumbbells';
  else if (has(/\b(barbell|ez|smith|bar)\b/)) equipment = 'barbell';
  else if (has(/\b(machine|cable|pulldown|pushdown|press machine)\b/)) equipment = 'machine';
  else if (measure === 'time' || has(/\b(push ?-?ups?|pull ?-?ups?|chin ?-?ups?|dips?|bodyweight|sit ?-?ups?)\b/)) {
    equipment = 'bodyweight';
  }
  const barKg = equipment === 'barbell' ? (has(/\bez\b/) || saysEzBar(key) ? EZ_BAR_KG : DEFAULT_BAR_KG) : null;
  return { equipment, measure, barKg };
}

// ---------------------------------------------------------------------------
// Showing a set

const trim = (n: number) => String(Math.round(n * 10) / 10);

function barIn(unit: WeightUnit, barKg: number): number {
  // A 20 kg bar is the 45 lb bar people know, so round to a whole pound.
  return unit === 'kg' ? barKg : Math.round(toLb(barKg, 'kg'));
}

export function formatDurationS(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const rest = Math.round(seconds % 60);
  if (minutes === 0) return `${rest} s`;
  return rest === 0 ? `${minutes} min` : `${minutes} min ${rest} s`;
}

// What the weight means for this equipment: "20 kg per side · 60 kg total", "2 × 20 kg · 40 kg total".
export function formatLoad(set: ParsedSet, kind: ExerciseKind | null): string {
  const { weight, unit } = set;
  if (!kind) return formatWeight(weight, unit);
  const bar = kind.barKg ?? DEFAULT_BAR_KG;
  if (weight === null || unit === null) {
    if (kind.equipment === 'barbell') return `Empty bar (${trim(bar)} kg)`;
    return kind.equipment === 'bodyweight' ? 'Bodyweight' : '';
  }
  switch (kind.equipment) {
    case 'barbell':
      return `${trim(weight)} ${unit} per side · ${trim(2 * weight + barIn(unit, bar))} ${unit} total`;
    case 'plates':
      // The machine's own sled weight isn't known, so the total is the plates only.
      return `${trim(weight)} ${unit} per side · ${trim(2 * weight)} ${unit} plates`;
    case 'dumbbells':
      return `2 × ${trim(weight)} ${unit} · ${trim(2 * weight)} ${unit} total`;
    case 'bodyweight':
      return weight === 0 ? 'Bodyweight' : `Bodyweight + ${trim(weight)} ${unit}`;
    default:
      return formatWeight(weight, unit);
  }
}

function formatEffort(set: ParsedSet): string {
  const failure = set.toFailure ? 'to failure' : '';
  if (set.durationS != null) return [formatDurationS(set.durationS), failure].filter(Boolean).join(' ');
  if (set.reps === null) return failure ? 'To failure' : '';
  return [`${set.reps} reps`, failure].filter(Boolean).join(' ');
}

export function formatSetFor(set: ParsedSet, kind: ExerciseKind | null): string {
  const load = formatLoad(set, kind);
  const effort = formatEffort(set);
  if (load && effort) return `${load}${set.durationS != null ? ' · ' : ' × '}${effort}`;
  return load || effort || 'Set';
}

// A short form that fits on a chip: "20/side × 10", "2×20=40 kg × 10", "BW · 45 s".
export function shortSetFor(set: ParsedSet, kind: ExerciseKind | null): string {
  let load: string;
  if (set.weight === null || set.unit === null) load = kind?.equipment === 'barbell' ? 'Bar' : 'BW';
  else if (kind?.equipment === 'barbell' || kind?.equipment === 'plates') load = `${trim(set.weight)}/side`;
  else if (kind?.equipment === 'dumbbells') load = `2×${trim(set.weight)}=${trim(2 * set.weight)} ${set.unit}`;
  else if (kind?.equipment === 'bodyweight') load = set.weight === 0 ? 'BW' : `BW+${trim(set.weight)} ${set.unit}`;
  else load = `${trim(set.weight)} ${set.unit}`;
  if (set.durationS != null) return `${load} · ${formatDurationS(set.durationS)}`;
  return set.reps === null ? load : `${load} × ${set.reps}`;
}

// ---------------------------------------------------------------------------
// The real load, for progress and volume (requirement 17g)

// The total weight moved in one rep, in kg: the bar and both sides, both dumbbells, or the trainer's
// body weight plus what they added. Until a body weight is entered, a bodyweight exercise counts only
// the added weight (requirement 20f). Null when nothing is known.
export function loadKg(set: ParsedSet, kind: ExerciseKind | null, bodyKg: number | null): number | null {
  const said = set.weight === null || set.unit === null ? null : toKg(set.weight, set.unit);
  switch (kind?.equipment) {
    case 'barbell':
      return 2 * (said ?? 0) + (kind.barKg ?? DEFAULT_BAR_KG);
    case 'plates':
    case 'dumbbells':
      return said === null ? null : 2 * said;
    case 'bodyweight':
      return bodyKg === null ? (said === null ? null : said) : bodyKg + (said ?? 0);
    default:
      return said;
  }
}

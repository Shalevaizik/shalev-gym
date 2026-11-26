// How each exercise is loaded (requirement 17) and measured (requirement 14), so a spoken number
// is understood the way the trainer means it: per side on a barbell, per hand with dumbbells,
// added weight on bodyweight exercises, and seconds on a plank.

import { t } from '../i18n/core';

import { cardioParts } from './cardio';
import { formatWeight, toKg, toLb, type ParsedSet, type WeightUnit } from './exerciseLog';

// cardio: cardio and conditioning sessions (treadmill, HIIT, CrossFit), logged as a time.
export type Equipment = 'barbell' | 'dumbbells' | 'dumbbell' | 'machine' | 'plates' | 'bodyweight' | 'cardio';
export type Measure = 'reps' | 'time';

export const EQUIPMENT_LABEL: Record<Equipment, string> = {
  barbell: 'Barbell',
  dumbbells: 'Dumbbells (pair)',
  dumbbell: 'Single dumbbell',
  machine: 'Machine or cable',
  plates: 'Plate-loaded machine',
  bodyweight: 'Bodyweight',
  cardio: 'Cardio',
};

// What the trainer says for each equipment type, shown when the exercise starts.
export const EQUIPMENT_HINT: Record<Equipment, string> = {
  barbell: 'Say the weight per side, like “20 a side” or “two plates”.',
  dumbbells: 'Say the weight of one dumbbell, like “20 kg 10 reps”.',
  dumbbell: 'Say the weight of the dumbbell, like “24 kg 10 reps”.',
  machine: 'Say the weight on the machine, like “50 kg 12 reps”.',
  plates: 'Say the weight per side, like “40 a side 10 reps”.',
  bodyweight: 'Say the reps, or the added weight too, like “plus 10 kg 8 reps”.',
  cardio: 'When you finish, say how long, like “15 minutes” or just “20”.',
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

// oneArm: done one arm at a time, like a one-arm dumbbell row. The reps said were done with each
// arm, so the set shows "each arm" and counts twice toward volume.
export type ExerciseKind = { equipment: Equipment; measure: Measure; barKg: number | null; oneArm?: true };

// Exercises done one arm at a time. Those that hold one dumbbell with both hands (goblet squat,
// overhead tricep extension, kettlebell swing, Russian twist) are not.
const ONE_ARM = new Set(['dumbbell row', 'concentration curl']);

export function isOneArm(name: string): boolean {
  const key = name.trim().toLowerCase();
  return ONE_ARM.has(key) || /\b(one|single|1)[ -]?arm(ed)?\b/.test(key);
}

const withArms = (kind: ExerciseKind, name: string): ExerciseKind =>
  isOneArm(name) ? { ...kind, oneArm: true } : kind;

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

// Cardio and conditioning, from the words in a name: "Treadmill", "HIIT", "CrossFit WOD".
const CARDIO =
  /\b(cardio|treadmill|run|running|jog|jogging|walk|walking|bike|biking|cycling|cycle|spin|spinning|rowing|rower|erg|elliptical|cross ?trainer|stair ?(master|climber|mill)|stairs|hiit|intervals?|crossfit|wod|metcon|conditioning|jump ?rope|skipping|swim|swimming|zumba|boxing)\b/;

export function isCardio(name: string): boolean {
  const key = name.trim().toLowerCase();
  return !(key in KNOWN) && CARDIO.test(key);
}

// The equipment and measure of an exercise: from the catalog, else guessed from words in its name.
export function kindFor(name: string): ExerciseKind {
  const key = name.trim().toLowerCase();
  const known = KNOWN[key];
  if (known) {
    const [equipment, measure = 'reps', barKg] = known;
    return withArms({ equipment, measure, barKg: equipment === 'barbell' ? (barKg ?? DEFAULT_BAR_KG) : null }, name);
  }
  if (isCardio(key)) return { equipment: 'cardio', measure: 'time', barKg: null };
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
  return withArms({ equipment, measure, barKg }, name);
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
  if (minutes === 0) return t('{s} s', { s: rest });
  return rest === 0 ? t('{m} min', { m: minutes }) : t('{m} min {s} s', { m: minutes, s: rest });
}

// The equipment's name and what to say for it, in the app's language.
export const equipmentLabel = (equipment: Equipment) => t(EQUIPMENT_LABEL[equipment]);
export const equipmentHint = (equipment: Equipment) => t(EQUIPMENT_HINT[equipment]);

// What the weight means for this equipment: "20 kg per side · 60 kg total", "2 × 20 kg · 40 kg total".
export function formatLoad(set: ParsedSet, kind: ExerciseKind | null): string {
  const { weight, unit } = set;
  if (!kind) return formatWeight(weight, unit);
  if (kind.equipment === 'cardio') return '';
  const bar = kind.barKg ?? DEFAULT_BAR_KG;
  if (weight === null || unit === null) {
    if (kind.equipment === 'barbell') return t('Empty bar ({kg} kg)', { kg: trim(bar) });
    return kind.equipment === 'bodyweight' ? t('Bodyweight') : '';
  }
  const w = trim(weight);
  switch (kind.equipment) {
    case 'barbell':
      return t('{w} {u} per side · {total} {u} total', { w, u: unit, total: trim(2 * weight + barIn(unit, bar)) });
    case 'plates':
      // The machine's own sled weight isn't known, so the total is the plates only.
      return t('{w} {u} per side · {total} {u} plates', { w, u: unit, total: trim(2 * weight) });
    case 'dumbbells':
      return t('2 × {w} {u} · {total} {u} total', { w, u: unit, total: trim(2 * weight) });
    case 'bodyweight':
      return weight === 0 ? t('Bodyweight') : t('Bodyweight + {w} {u}', { w, u: unit });
    default:
      return formatWeight(weight, unit);
  }
}

function formatEffort(set: ParsedSet, kind: ExerciseKind | null): string {
  const failure = set.toFailure ? t('to failure') : '';
  const arms = kind?.oneArm ? t('each arm') : '';
  if (kind?.equipment === 'cardio') {
    return [set.durationS != null ? formatDurationS(set.durationS) : '', ...cardioParts(set.cardio)].filter(Boolean).join(' · ');
  }
  if (set.durationS != null) return [formatDurationS(set.durationS), arms, failure].filter(Boolean).join(' ');
  if (set.reps === null) return failure ? t('To failure') : '';
  return [t('{n} reps', { n: set.reps }), arms, failure].filter(Boolean).join(' ');
}

export function formatSetFor(set: ParsedSet, kind: ExerciseKind | null): string {
  const load = formatLoad(set, kind);
  const effort = formatEffort(set, kind);
  if (load && effort) return `${load}${set.durationS != null ? ' · ' : ' × '}${effort}`;
  return load || effort || t('Set');
}

// A short form that fits on a chip: "20/side × 10", "2×20=40 kg × 10", "BW · 45 s".
export function shortSetFor(set: ParsedSet, kind: ExerciseKind | null): string {
  if (kind?.equipment === 'cardio') {
    const parts = [set.durationS != null ? formatDurationS(set.durationS) : '', ...cardioParts(set.cardio).slice(0, 2)];
    return parts.filter(Boolean).join(' · ') || t('Session');
  }
  let load: string;
  if (set.weight === null || set.unit === null) load = kind?.equipment === 'barbell' ? t('Bar') : t('BW');
  else if (kind?.equipment === 'barbell' || kind?.equipment === 'plates') load = t('{w}/side', { w: trim(set.weight) });
  else if (kind?.equipment === 'dumbbells') load = `2×${trim(set.weight)}=${trim(2 * set.weight)} ${set.unit}`;
  else if (kind?.equipment === 'bodyweight') load = set.weight === 0 ? t('BW') : `${t('BW')}+${trim(set.weight)} ${set.unit}`;
  else load = `${trim(set.weight)} ${set.unit}`;
  const arms = kind?.oneArm ? ` ${t('each')}` : '';
  if (set.durationS != null) return `${load} · ${formatDurationS(set.durationS)}${arms}`;
  return set.reps === null ? load : `${load} × ${set.reps}${arms}`;
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
    case 'cardio':
      return null;
    default:
      return said;
  }
}

// Weight moved in a set, load × reps, for volume (requirement 13). A one-arm exercise was done with
// each arm, so it counts twice.
export function volumeKg(set: ParsedSet, kind: ExerciseKind | null, bodyKg: number | null): number {
  const load = loadKg(set, kind, bodyKg);
  if (load === null || set.reps === null) return 0;
  return load * set.reps * (kind?.oneArm ? 2 : 1);
}

// What a cardio machine was set to (requirement 23): speed and incline on a treadmill, or the level
// on a bike, stepper, rower or elliptical, and the distance and calories when the machine shows them.
//
// Read from what the trainer says, e.g. "treadmill 20 minutes speed 6.5 incline 8", before the time
// is read from what's left ("20 minutes").

export type CardioDetails = {
  speedKmh?: number;
  incline?: number;
  level?: number;
  distanceKm?: number;
  calories?: number;
};

const NUMBER = String.raw`(\d+(?:[.,]\d+)?)`;
const KM_PER_MILE = 1.609344;

const num = (text: string) => Number(text.replace(',', '.'));
const round1 = (n: number) => Math.round(n * 10) / 10;
const round2 = (n: number) => Math.round(n * 100) / 100;

// Each rule finds one setting and is removed from the text, so the rest reads as the time.
const RULES: { pattern: RegExp; read: (match: RegExpExecArray, details: CardioDetails) => void }[] = [
  // "6.5 km/h", "6.5 kph", "4 mph"
  {
    pattern: new RegExp(String.raw`${NUMBER}\s*(km\s*/\s*h|kph|kmh|km an hour|km per hour|kilometers per hour|kilometres per hour|mph|miles per hour)`, 'i'),
    read: (m, d) => {
      d.speedKmh = /mph|miles/i.test(m[2]) ? round1(num(m[1]) * KM_PER_MILE) : num(m[1]);
    },
  },
  // "speed 6.5", "at speed 6.5", "pace 10"
  {
    pattern: new RegExp(String.raw`\b(?:at\s+)?(?:speed|pace)\s*(?:of\s*|at\s*)?${NUMBER}`, 'i'),
    read: (m, d) => {
      d.speedKmh = num(m[1]);
    },
  },
  // "incline 8", "8 percent incline", "8% incline", "gradient 5"
  {
    pattern: new RegExp(String.raw`\b(?:incline|gradient|grade)\s*(?:of\s*|at\s*)?${NUMBER}\s*(?:%|percent)?`, 'i'),
    read: (m, d) => {
      d.incline = num(m[1]);
    },
  },
  {
    pattern: new RegExp(String.raw`${NUMBER}\s*(?:%|percent)\s*(?:incline|gradient|grade)`, 'i'),
    read: (m, d) => {
      d.incline = num(m[1]);
    },
  },
  // "level 10", "resistance 6", "difficulty 4", "setting 7"
  {
    pattern: new RegExp(String.raw`\b(?:at\s+)?(?:level|resistance|difficulty|setting|intensity)\s*(?:of\s*|at\s*)?${NUMBER}`, 'i'),
    read: (m, d) => {
      d.level = num(m[1]);
    },
  },
  // "150 calories", "150 cal", "150 kcal"
  {
    pattern: new RegExp(String.raw`${NUMBER}\s*(?:kcal|kilocalories|calories|calorie|cals|cal)\b`, 'i'),
    read: (m, d) => {
      d.calories = Math.round(num(m[1]));
    },
  },
  // "2 km", "2.5 kilometers", "500 m", "500 meters", "1 mile"
  {
    pattern: new RegExp(String.raw`${NUMBER}\s*(km|kms|kilometers|kilometres|kilometer|kilometre|k|meters|metres|meter|metre|m|miles|mile|mi)\b`, 'i'),
    read: (m, d) => {
      const value = num(m[1]);
      const unit = m[2].toLowerCase();
      if (unit.startsWith('mi')) d.distanceKm = round2(value * KM_PER_MILE);
      else if (unit === 'm' || unit.startsWith('met')) d.distanceKm = round2(value / 1000);
      else d.distanceKm = value;
    },
  },
];

export function readCardioDetails(text: string): { details: CardioDetails; rest: string } {
  const details: CardioDetails = {};
  let rest = text;
  for (const rule of RULES) {
    const match = rule.pattern.exec(rest);
    if (!match) continue;
    rule.read(match, details);
    rest = `${rest.slice(0, match.index)} ${rest.slice(match.index + match[0].length)}`;
  }
  return { details, rest: rest.replace(/\s+/g, ' ').trim() };
}

export function hasCardioDetails(details: CardioDetails | null | undefined): boolean {
  return !!details && Object.values(details).some((v) => v !== undefined && v !== null);
}

// "6.5 km/h", "incline 8", "level 10", "2 km", "150 cal": the parts to show after the time.
export function cardioParts(details: CardioDetails | null | undefined): string[] {
  if (!details) return [];
  const parts: string[] = [];
  if (details.speedKmh != null) parts.push(`${round1(details.speedKmh)} km/h`);
  if (details.incline != null) parts.push(`incline ${round1(details.incline)}`);
  if (details.level != null) parts.push(`level ${round1(details.level)}`);
  if (details.distanceKm != null) {
    parts.push(details.distanceKm < 1 ? `${Math.round(details.distanceKm * 1000)} m` : `${round2(details.distanceKm)} km`);
  }
  if (details.calories != null) parts.push(`${Math.round(details.calories)} cal`);
  return parts;
}

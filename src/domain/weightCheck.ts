// Catches weights that were probably misheard (requirement 15e): "18 kg" on an exercise usually
// done with 80 kg is far more likely "80" said in a noisy gym than a real 18.

import { toKg, type ParsedSet, type WeightUnit } from './exerciseLog';

export type WeightDoubt = {
  // What was heard and what the trainer more likely said, in the same unit.
  heard: number;
  suggestion: number;
  unit: WeightUnit;
};

// Speech recognizers mix up "eighteen" and "eighty", "fifteen" and "fifty", and so on.
function teenTySwap(value: number): number | null {
  if (Number.isInteger(value) && value >= 13 && value <= 19) return (value - 10) * 10;
  if (Number.isInteger(value) && value >= 30 && value <= 90 && value % 10 === 0) return value / 10 + 10;
  return null;
}

const roundTo = (value: number, step: number) => Math.round(value / step) * step;

// referenceKg: the weight the trainer usually uses on this exercise, as said (per side, per hand…).
export function checkWeight(set: ParsedSet, referenceKg: number | null): WeightDoubt | null {
  if (set.weight === null || set.unit === null || referenceKg === null || referenceKg <= 0) return null;
  const heardKg = toKg(set.weight, set.unit);
  const ratio = heardKg / referenceKg;
  if (ratio >= 0.45 && ratio <= 2.2) return null;

  const reference = set.unit === 'kg' ? referenceKg : referenceKg / toKg(1, 'lb');
  const swapped = teenTySwap(set.weight);
  const fits = swapped !== null && swapped / reference >= 0.6 && swapped / reference <= 1.6;
  const suggestion = fits ? swapped : roundTo(reference, set.unit === 'kg' ? 0.5 : 1);
  if (suggestion === set.weight) return null;
  return { heard: set.weight, suggestion, unit: set.unit };
}

// The usual weight: the middle of the recent ones, so one odd set doesn't move it.
export function typicalKg(recentKg: number[]): number | null {
  const sorted = recentKg.filter((kg) => kg > 0).sort((a, b) => a - b);
  if (sorted.length === 0) return null;
  return sorted[Math.floor(sorted.length / 2)];
}

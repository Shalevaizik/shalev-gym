import {
  ageOn,
  birthDateFrom,
  cmFromFeetInches,
  EMPTY_PROFILE,
  feetInchesFromCm,
  formatHeight,
  needsWeightReminder,
  toKg,
  type Profile,
} from './profile';

const NOW = new Date(2026, 10, 20, 12); // 20 Nov 2026
const daysAgo = (days: number) => new Date(NOW.getTime() - days * 24 * 60 * 60 * 1000).toISOString();

describe('profile', () => {
  it('works out the age from the date of birth, counting this year’s birthday', () => {
    expect(ageOn('1990-11-20', NOW)).toBe(36);
    expect(ageOn('1990-11-21', NOW)).toBe(35);
    expect(ageOn('1990-03-05', NOW)).toBe(36);
  });

  it('accepts only real, plausible dates of birth', () => {
    expect(birthDateFrom(5, 3, 1990, NOW)).toBe('1990-03-05');
    expect(birthDateFrom(31, 2, 1990, NOW)).toBeNull();
    expect(birthDateFrom(1, 1, 2030, NOW)).toBeNull();
    expect(birthDateFrom(1, 1, 1890, NOW)).toBeNull();
  });

  it('converts height between cm and feet and inches', () => {
    expect(Math.round(cmFromFeetInches(5, 11))).toBe(180);
    expect(feetInchesFromCm(180)).toEqual({ feet: 5, inches: 11 });
    expect(feetInchesFromCm(182.88)).toEqual({ feet: 6, inches: 0 });
    expect(formatHeight(180, 'cm')).toBe('180 cm');
    expect(formatHeight(180, 'ft')).toBe('5′11″');
  });

  it('converts pounds to kilograms', () => {
    expect(toKg(80, 'kg')).toBe(80);
    expect(toKg(200, 'lb')).toBeCloseTo(90.72, 2);
  });

  describe('monthly weight reminder', () => {
    const withWeight = (recordedDaysAgo: number, dismissedDaysAgo: number | null = null): Profile => ({
      ...EMPTY_PROFILE,
      weight: { weight: 80, unit: 'kg', recordedAt: daysAgo(recordedDaysAgo) },
      reminderDismissedAt: dismissedDaysAgo === null ? null : daysAgo(dismissedDaysAgo),
    });

    it('asks when there is no weight yet', () => {
      expect(needsWeightReminder(EMPTY_PROFILE, NOW)).toBe(true);
    });

    it('asks once the weight is a month old', () => {
      expect(needsWeightReminder(withWeight(10), NOW)).toBe(false);
      expect(needsWeightReminder(withWeight(30), NOW)).toBe(true);
    });

    it('waits a month after "not now"', () => {
      expect(needsWeightReminder(withWeight(45, 3), NOW)).toBe(false);
      expect(needsWeightReminder(withWeight(75, 31), NOW)).toBe(true);
    });
  });
});

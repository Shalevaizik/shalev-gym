import { checkWeight, typicalKg } from './weightCheck';

const set = (weight: number | null, unit: 'kg' | 'lb' | null = 'kg') => ({ weight, unit, reps: 10, toFailure: false });

describe('checkWeight', () => {
  it('lets normal changes through', () => {
    expect(checkWeight(set(80), 80)).toBeNull();
    expect(checkWeight(set(60), 80)).toBeNull();
    expect(checkWeight(set(100), 80)).toBeNull();
    expect(checkWeight(set(null, null), 80)).toBeNull();
    expect(checkWeight(set(18), null)).toBeNull();
  });

  it('suggests the "-ty" number when a "-teen" was probably misheard', () => {
    expect(checkWeight(set(18), 80)).toEqual({ heard: 18, suggestion: 80, unit: 'kg' });
    expect(checkWeight(set(15), 50)).toEqual({ heard: 15, suggestion: 50, unit: 'kg' });
  });

  it('suggests the "-teen" number when a "-ty" was probably misheard', () => {
    expect(checkWeight(set(70), 17)).toEqual({ heard: 70, suggestion: 17, unit: 'kg' });
  });

  it('otherwise suggests the usual weight', () => {
    expect(checkWeight(set(8), 60)).toEqual({ heard: 8, suggestion: 60, unit: 'kg' });
    expect(checkWeight(set(500), 100)).toEqual({ heard: 500, suggestion: 100, unit: 'kg' });
  });

  it('works in pounds', () => {
    expect(checkWeight(set(18, 'lb'), 36.3)).toEqual({ heard: 18, suggestion: 80, unit: 'lb' });
  });
});

describe('typicalKg', () => {
  it('takes the middle of recent weights', () => {
    expect(typicalKg([80, 82.5, 20, 80, 85])).toBe(80);
    expect(typicalKg([])).toBeNull();
  });
});

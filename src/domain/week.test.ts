import { shortType, weekOf } from './week';

// Friday 27 November 2026, 9:00.
const NOW = new Date(2026, 10, 27, 9, 0);
const at = (day: number, hour = 18) => new Date(2026, 10, day, hour).toISOString();

describe('the start screen week', () => {
  it('runs Sunday to Saturday with trained, rest and open days', () => {
    const week = weekOf(
      [
        { startedAt: at(23), title: 'Legs + Cardio', sets: 22 },
        { startedAt: at(24), title: 'Push · Chest & Triceps', sets: 20 },
        { startedAt: at(26), title: 'Pull · Back & Biceps', sets: 22 },
        { startedAt: at(16), title: 'Legs', sets: 18 }, // last week: not counted
      ],
      NOW,
    );
    expect(week.days.map((d) => d.name)).toEqual(['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']);
    expect(week.days.map((d) => d.date.getDate())).toEqual([22, 23, 24, 25, 26, 27, 28]);
    expect(week.days.map((d) => d.state)).toEqual(['rest', 'trained', 'trained', 'rest', 'trained', 'open', 'open']);
    expect(week.days.map((d) => d.type)).toEqual([null, 'Legs', 'Push', null, 'Pull', null, null]);
    expect(week.days.map((d) => d.isToday)).toEqual([false, false, false, false, false, true, false]);
    expect(week).toMatchObject({ workouts: 3, sets: 64, restDays: 2 });
  });

  it('marks today as trained once there is a workout', () => {
    const week = weekOf([{ startedAt: at(27, 7), title: 'Upper Body', sets: 15 }], NOW);
    expect(week.days[5]).toMatchObject({ isToday: true, state: 'trained', type: 'Upper' });
  });

  it('names the workout type in a word', () => {
    expect(shortType('Push · Chest & Triceps')).toBe('Push');
    expect(shortType('Legs + Cardio')).toBe('Legs');
    expect(shortType('Back & Biceps')).toBe('Back');
    expect(shortType('Full Body')).toBe('Full');
    expect(shortType('Cardio')).toBe('Cardio');
    expect(shortType('Workout')).toBe('Done');
  });
});

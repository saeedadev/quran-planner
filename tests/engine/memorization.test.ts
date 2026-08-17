import { describe, expect, it } from 'vitest';

import type { PlanConfig } from '@shared/plan-types';

import { buildMemorizationSchedule } from '../../src/engine/memorization';

function closedConfig(overrides: Partial<PlanConfig> & object): PlanConfig {
  const base: PlanConfig = {
    kind: 'closed',
    direction: 'forward',
    startRef: { surah: 1, ayah: 1 },
    rate: { type: 'half-page' },
    weeklyPattern: ['study', 'study', 'rest', 'rest', 'rest', 'rest', 'rest'],
    grandReview: { unit: 'ayahs', count: 10 },
    dates: { start: '2026-09-01', end: '2026-09-07' },
  };
  return { ...base, ...overrides } as PlanConfig;
}

describe('memorization layer (scratch)', () => {
  it('forward half-page: the whole of Al-Fatihah is one face, then the first Al-Baqarah page is one face', () => {
    const schedule = buildMemorizationSchedule(closedConfig({}));
    expect(schedule.days[0].newMemorization).toEqual({ from: { surah: 1, ayah: 1 }, to: { surah: 1, ayah: 7 } });
    expect(schedule.days[0].pointerAfter).toEqual({ surah: 1, ayah: 7 });
    expect(schedule.days[0].completedSurahs).toEqual([1]);
    expect(schedule.days[1].newMemorization).toEqual({ from: { surah: 2, ayah: 1 }, to: { surah: 2, ayah: 5 } });
    expect(schedule.days[1].pointerAfter).toEqual({ surah: 2, ayah: 5 });
    expect(schedule.days[1].completedSurahs).toEqual([1]);
    expect(schedule.days[2].newMemorization).toBeNull();
    expect(schedule.endRef).toEqual({ surah: 2, ayah: 5 });
    expect(schedule.endDayIndex).toBe(1);
    expect(schedule.completedSurahs).toEqual([1]);
    expect(schedule.issues).toEqual([]);
  });

  it('forward full-page: Al-Fatihah plus the first Al-Baqarah page form one full face', () => {
    const schedule = buildMemorizationSchedule(
      closedConfig({ rate: { type: 'full-page' }, weeklyPattern: ['study', 'rest', 'rest', 'rest', 'rest', 'rest', 'rest'] }),
    );
    expect(schedule.days[0].newMemorization).toEqual({ from: { surah: 1, ayah: 1 }, to: { surah: 2, ayah: 5 } });
    expect(schedule.days[0].completedSurahs).toEqual([1]);
  });

  it('forward ayahs rate takes exactly the requested count', () => {
    const schedule = buildMemorizationSchedule(closedConfig({ startRef: { surah: 2, ayah: 1 }, rate: { type: 'ayahs', count: 5 } }));
    expect(schedule.days[0].newMemorization).toEqual({ from: { surah: 2, ayah: 1 }, to: { surah: 2, ayah: 5 } });
  });

  it('forward reaching the end of the Quran stops memorization early', () => {
    const schedule = buildMemorizationSchedule(
      closedConfig({
        startRef: { surah: 114, ayah: 5 },
        rate: { type: 'ayahs', count: 3 },
        weeklyPattern: ['study', 'study', 'rest', 'rest', 'rest', 'rest', 'rest'],
      }),
    );
    expect(schedule.days[0].newMemorization).toEqual({ from: { surah: 114, ayah: 5 }, to: { surah: 114, ayah: 6 } });
    expect(schedule.days[0].completedSurahs).toEqual([114]);
    expect(schedule.days[1].newMemorization).toBeNull();
    expect(schedule.issues).toHaveLength(1);
    expect(schedule.issues[0]).toContain('114:6');
    expect(schedule.endDayIndex).toBe(0);
  });

  it('reverse half-page starts at the end surah and reads its ayahs forward', () => {
    const schedule = buildMemorizationSchedule(
      closedConfig({ direction: 'reverse', startRef: { surah: 114, ayah: 1 } }),
    );
    expect(schedule.days[0].newMemorization).toEqual({ from: { surah: 114, ayah: 1 }, to: { surah: 114, ayah: 6 } });
    expect(schedule.days[0].pointerAfter).toEqual({ surah: 114, ayah: 6 });
    expect(schedule.days[0].completedSurahs).toEqual([114]);
    expect(schedule.days[1].newMemorization).toEqual({ from: { surah: 113, ayah: 1 }, to: { surah: 113, ayah: 5 } });
    expect(schedule.days[1].completedSurahs).toEqual([113, 114]);
  });

  it('reverse ayahs rate walks forward within the surah without reversing ayahs', () => {
    const schedule = buildMemorizationSchedule(
      closedConfig({ direction: 'reverse', startRef: { surah: 114, ayah: 1 }, rate: { type: 'ayahs', count: 4 } }),
    );
    expect(schedule.days[0].newMemorization).toEqual({ from: { surah: 114, ayah: 1 }, to: { surah: 114, ayah: 4 } });
    expect(schedule.days[0].completedSurahs).toEqual([]);
    expect(schedule.days[1].newMemorization).toEqual({ from: { surah: 114, ayah: 5 }, to: { surah: 114, ayah: 6 } });
    expect(schedule.days[1].completedSurahs).toEqual([114]);
  });

  it('reverse stops at the end of Al-Fatihah without fake ayahs', () => {
    const schedule = buildMemorizationSchedule(
      closedConfig({ direction: 'reverse', startRef: { surah: 1, ayah: 7 }, rate: { type: 'ayahs', count: 5 } }),
    );
    expect(schedule.days[0].newMemorization).toEqual({ from: { surah: 1, ayah: 7 }, to: { surah: 1, ayah: 7 } });
    expect(schedule.days[0].completedSurahs).toEqual([1]);
    expect(schedule.days[1].newMemorization).toBeNull();
    expect(schedule.issues).toHaveLength(1);
    expect(schedule.endRef).toEqual({ surah: 1, ayah: 7 });
  });

  it('tathbeet and companion days carry no new memorization', () => {
    const schedule = buildMemorizationSchedule(
      closedConfig({ weeklyPattern: ['study', 'tathbeet', 'companion', 'rest', 'rest', 'rest', 'rest'] }),
    );
    expect(schedule.days[0].newMemorization).not.toBeNull();
    expect(schedule.days[1].kind).toBe('tathbeet');
    expect(schedule.days[1].newMemorization).toBeNull();
    expect(schedule.days[1].pointerAfter).toEqual({ surah: 1, ayah: 7 });
    expect(schedule.days[2].kind).toBe('companion');
    expect(schedule.days[2].newMemorization).toBeNull();
  });

  it('open plans consume all their weeks with dates from the start date', () => {
    const schedule = buildMemorizationSchedule({
      kind: 'open',
      direction: 'forward',
      startRef: { surah: 2, ayah: 1 },
      rate: { type: 'ayahs', count: 2 },
      weeklyPattern: ['study', 'study', 'study', 'study', 'study', 'rest', 'rest'],
      grandReview: { unit: 'ayahs', count: 10 },
      weeks: 1,
      startDate: '2026-09-01',
    });
    expect(schedule.days).toHaveLength(7);
    expect(schedule.days[0].date).toBe('2026-09-01');
    expect(schedule.days[0].newMemorization).toEqual({ from: { surah: 2, ayah: 1 }, to: { surah: 2, ayah: 2 } });
    expect(schedule.days[4].newMemorization).toEqual({ from: { surah: 2, ayah: 9 }, to: { surah: 2, ayah: 10 } });
    expect(schedule.days[5].kind).toBe('rest');
    expect(schedule.days[5].newMemorization).toBeNull();
    expect(schedule.endRef).toEqual({ surah: 2, ayah: 10 });
    expect(schedule.endDayIndex).toBe(4);
  });

  it('records surah completion and moving into the next surah', () => {
    const schedule = buildMemorizationSchedule(
      closedConfig({ startRef: { surah: 1, ayah: 1 }, rate: { type: 'ayahs', count: 7 } }),
    );
    expect(schedule.days[0].newMemorization).toEqual({ from: { surah: 1, ayah: 1 }, to: { surah: 1, ayah: 7 } });
    expect(schedule.days[0].completedSurahs).toEqual([1]);
    expect(schedule.days[0].pointerAfter).toEqual({ surah: 1, ayah: 7 });
  });

  it('forward half-page: Al-Kahf merges its short page head into two balanced faces', () => {
    const schedule = buildMemorizationSchedule(
      closedConfig({ startRef: { surah: 18, ayah: 1 }, weeklyPattern: new Array(7).fill('study') }),
    );
    expect(schedule.days[0].newMemorization).toEqual({ from: { surah: 18, ayah: 1 }, to: { surah: 18, ayah: 9 } });
    expect(schedule.days[1].newMemorization).toEqual({ from: { surah: 18, ayah: 10 }, to: { surah: 18, ayah: 15 } });
    expect(schedule.days[2].newMemorization).toEqual({ from: { surah: 18, ayah: 16 }, to: { surah: 18, ayah: 18 } });
  });

  it('forward half-page: a surah ending mid-page never leaks into the next surah', () => {
    const schedule = buildMemorizationSchedule(
      closedConfig({ startRef: { surah: 10, ayah: 107 }, weeklyPattern: new Array(7).fill('study') }),
    );
    expect(schedule.days[0].newMemorization).toEqual({ from: { surah: 10, ayah: 107 }, to: { surah: 10, ayah: 109 } });
    expect(schedule.days[0].completedSurahs).toContain(10);
    expect(schedule.days[1].newMemorization).toEqual({ from: { surah: 11, ayah: 1 }, to: { surah: 11, ayah: 5 } });
  });

  it('forward full-page: Al-Kahf first day covers the merged head page plus the next page', () => {
    const schedule = buildMemorizationSchedule(
      closedConfig({ startRef: { surah: 18, ayah: 1 }, rate: { type: 'full-page' }, weeklyPattern: new Array(7).fill('study') }),
    );
    expect(schedule.days[0].newMemorization).toEqual({ from: { surah: 18, ayah: 1 }, to: { surah: 18, ayah: 15 } });
    expect(schedule.days[1].newMemorization).toEqual({ from: { surah: 18, ayah: 16 }, to: { surah: 18, ayah: 20 } });
  });

  it('reverse half-page: Maryam tail merges into two faces, then Al-Kahf head starts its region', () => {
    const schedule = buildMemorizationSchedule(
      closedConfig({ direction: 'reverse', startRef: { surah: 19, ayah: 77 }, weeklyPattern: new Array(7).fill('study') }),
    );
    expect(schedule.days[0].newMemorization).toEqual({ from: { surah: 19, ayah: 77 }, to: { surah: 19, ayah: 87 } });
    expect(schedule.days[1].newMemorization).toEqual({ from: { surah: 19, ayah: 88 }, to: { surah: 19, ayah: 98 } });
    expect(schedule.days[1].completedSurahs).toContain(19);
    expect(schedule.days[2].newMemorization).toEqual({ from: { surah: 18, ayah: 1 }, to: { surah: 18, ayah: 9 } });
  });
});

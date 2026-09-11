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

  it('reverse full-page traverses all 24 Juz Amma units accurately with complete surahs', () => {
    const schedule = buildMemorizationSchedule(
      closedConfig({
        direction: 'reverse',
        startRef: { surah: 114, ayah: 6 },
        rate: { type: 'full-page' },
        weeklyPattern: new Array(24).fill('study'),
        dates: { start: '2026-09-01', end: '2026-09-24' },
      }),
    );

    // 1. ص 604: الإخلاص + الفلق + الناس
    expect(schedule.days[0].newMemorization).toEqual({ from: { surah: 112, ayah: 1 }, to: { surah: 114, ayah: 6 } });
    expect(schedule.days[0].completedSurahs).toEqual([112, 113, 114]);

    // 2. ص 603: الكافرون + النصر + المسد
    expect(schedule.days[1].newMemorization).toEqual({ from: { surah: 109, ayah: 1 }, to: { surah: 111, ayah: 5 } });
    expect(schedule.days[1].completedSurahs).toContain(109);

    // 3. ص 602: قريش + الماعون + الكوثر
    expect(schedule.days[2].newMemorization).toEqual({ from: { surah: 106, ayah: 1 }, to: { surah: 108, ayah: 3 } });

    // 4. ص 601: العصر + الهمزة + الفيل
    expect(schedule.days[3].newMemorization).toEqual({ from: { surah: 103, ayah: 1 }, to: { surah: 105, ayah: 5 } });

    // 5. ص 600: القارعة + التكاثر
    expect(schedule.days[4].newMemorization).toEqual({ from: { surah: 101, ayah: 1 }, to: { surah: 102, ayah: 8 } });

    // 6. ص 599: الزلزلة + العاديات كاملة دون اقتصاص
    expect(schedule.days[5].newMemorization).toEqual({ from: { surah: 99, ayah: 1 }, to: { surah: 100, ayah: 11 } });

    // 7. ص 598: القدر + البينة كاملة دون اقتصاص
    expect(schedule.days[6].newMemorization).toEqual({ from: { surah: 97, ayah: 1 }, to: { surah: 98, ayah: 8 } });

    // 8. ص 597: التين + العلق كاملة دون اقتصاص
    expect(schedule.days[7].newMemorization).toEqual({ from: { surah: 95, ayah: 1 }, to: { surah: 96, ayah: 19 } });

    // 9. ص 596: الضحى + الشرح كاملة دون اقتصاص
    expect(schedule.days[8].newMemorization).toEqual({ from: { surah: 93, ayah: 1 }, to: { surah: 94, ayah: 8 } });

    // 10. ص 595: الشمس + الليل كاملة دون اقتصاص
    expect(schedule.days[9].newMemorization).toEqual({ from: { surah: 91, ayah: 1 }, to: { surah: 92, ayah: 21 } });

    // 11. ص 594: البلد كاملة
    expect(schedule.days[10].newMemorization).toEqual({ from: { surah: 90, ayah: 1 }, to: { surah: 90, ayah: 20 } });

    // 12. ص 593: الفجر كاملة
    expect(schedule.days[11].newMemorization).toEqual({ from: { surah: 89, ayah: 1 }, to: { surah: 89, ayah: 30 } });

    // 13. الغاشية كاملة لوحدها
    expect(schedule.days[12].newMemorization).toEqual({ from: { surah: 88, ayah: 1 }, to: { surah: 88, ayah: 26 } });

    // 14. الطارق + الأعلى كاملتين معاً
    expect(schedule.days[13].newMemorization).toEqual({ from: { surah: 86, ayah: 1 }, to: { surah: 87, ayah: 19 } });

    // 15. ص 590: البروج كاملة
    expect(schedule.days[14].newMemorization).toEqual({ from: { surah: 85, ayah: 1 }, to: { surah: 85, ayah: 22 } });

    // 16. ص 589: الإنشقاق كاملة
    expect(schedule.days[15].newMemorization).toEqual({ from: { surah: 84, ayah: 1 }, to: { surah: 84, ayah: 25 } });

    // 17. ص 588: المطففين كاملة
    expect(schedule.days[16].newMemorization).toEqual({ from: { surah: 83, ayah: 1 }, to: { surah: 83, ayah: 36 } });

    // 18. ص 587: الإنفطار كاملة
    expect(schedule.days[17].newMemorization).toEqual({ from: { surah: 82, ayah: 1 }, to: { surah: 82, ayah: 19 } });

    // 19. ص 586: التكوير كاملة
    expect(schedule.days[18].newMemorization).toEqual({ from: { surah: 81, ayah: 1 }, to: { surah: 81, ayah: 29 } });

    // 20. ص 585: عبس كاملة
    expect(schedule.days[19].newMemorization).toEqual({ from: { surah: 80, ayah: 1 }, to: { surah: 80, ayah: 42 } });

    // 21. النازعات (ص 583 / الوجه الأول)
    expect(schedule.days[20].newMemorization).toEqual({ from: { surah: 79, ayah: 1 }, to: { surah: 79, ayah: 16 } });

    // 22. النازعات (ص 584 / الوجه الثاني)
    expect(schedule.days[21].newMemorization).toEqual({ from: { surah: 79, ayah: 17 }, to: { surah: 79, ayah: 46 } });
    expect(schedule.days[21].completedSurahs).toContain(79);

    // 23. النبإ (ص 582 / القسم الأول)
    expect(schedule.days[22].newMemorization).toEqual({ from: { surah: 78, ayah: 1 }, to: { surah: 78, ayah: 30 } });

    // 24. النبإ (ص 583 / القسم الثاني)
    expect(schedule.days[23].newMemorization).toEqual({ from: { surah: 78, ayah: 31 }, to: { surah: 78, ayah: 40 } });
    expect(schedule.days[23].completedSurahs).toContain(78);
  });

  it('reverse ayahs rate walks forward within the surah from beginning without reversing ayahs', () => {
    const schedule = buildMemorizationSchedule(
      closedConfig({
        direction: 'reverse',
        startRef: { surah: 114, ayah: 6 },
        rate: { type: 'ayahs', count: 4 },
        weeklyPattern: ['study', 'study', 'study', 'rest', 'rest', 'rest', 'rest'],
      }),
    );
    expect(schedule.days[0].newMemorization).toEqual({ from: { surah: 114, ayah: 1 }, to: { surah: 114, ayah: 4 } });
    expect(schedule.days[0].completedSurahs).toEqual([]);
    expect(schedule.days[1].newMemorization).toEqual({ from: { surah: 114, ayah: 5 }, to: { surah: 114, ayah: 6 } });
    expect(schedule.days[1].completedSurahs).toEqual([114]);
    expect(schedule.days[2].newMemorization).toEqual({ from: { surah: 113, ayah: 1 }, to: { surah: 113, ayah: 4 } });
  });

  it('reverse stops at the beginning of Al-Fatihah without fake ayahs', () => {
    const schedule = buildMemorizationSchedule(
      closedConfig({ direction: 'reverse', startRef: { surah: 1, ayah: 7 }, rate: { type: 'ayahs', count: 7 } }),
    );
    expect(schedule.days[0].newMemorization).toEqual({ from: { surah: 1, ayah: 1 }, to: { surah: 1, ayah: 7 } });
    expect(schedule.days[0].completedSurahs).toEqual([1]);
    expect(schedule.days[1].newMemorization).toBeNull();
    expect(schedule.issues).toHaveLength(1);
    expect(schedule.endRef).toEqual({ surah: 1, ayah: 1 });
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

  it('reverse full-page: continues seamlessly from Juz Amma into Al-Mursalat with forward ayahs', () => {
    const schedule = buildMemorizationSchedule(
      closedConfig({
        direction: 'reverse',
        startRef: { surah: 114, ayah: 6 },
        rate: { type: 'full-page' },
        weeklyPattern: new Array(28).fill('study'),
        dates: { start: '2026-09-01', end: '2026-09-28' },
      }),
    );

    // Day 21: An-Nazi'at face 1 (ص 583)
    expect(schedule.days[20].newMemorization).toEqual({ from: { surah: 79, ayah: 1 }, to: { surah: 79, ayah: 16 } });
    // Day 22: An-Nazi'at face 2 (ص 584)
    expect(schedule.days[21].newMemorization).toEqual({ from: { surah: 79, ayah: 17 }, to: { surah: 79, ayah: 46 } });
    expect(schedule.days[21].completedSurahs).toContain(79);

    // Day 23: An-Naba' face 1 (ص 582)
    expect(schedule.days[22].newMemorization).toEqual({ from: { surah: 78, ayah: 1 }, to: { surah: 78, ayah: 30 } });
    // Day 24: An-Naba' face 2 (ص 583)
    expect(schedule.days[23].newMemorization).toEqual({ from: { surah: 78, ayah: 31 }, to: { surah: 78, ayah: 40 } });
    expect(schedule.days[23].completedSurahs).toContain(78);

    // Day 25: Al-Mursalat part 1 (head of surah: 77:1..77:19)
    expect(schedule.days[24].newMemorization).toEqual({ from: { surah: 77, ayah: 1 }, to: { surah: 77, ayah: 19 } });
    // Day 26: Al-Mursalat part 2 (tail of surah: 77:20..77:50)
    expect(schedule.days[25].newMemorization).toEqual({ from: { surah: 77, ayah: 20 }, to: { surah: 77, ayah: 50 } });
    expect(schedule.days[25].completedSurahs).toContain(77);
  });
});

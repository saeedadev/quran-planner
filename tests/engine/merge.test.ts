import { describe, expect, it } from 'vitest';

import { PlanConfigError } from '@shared/plan-validation';
import { REST_DAY_PHRASE, type DayPlan, type PlanConfig } from '@shared/plan-types';

import { computePlan } from '../../src/engine/merge';
import { refExists } from '../../src/engine/mushaf';

function closedConfig(overrides: Partial<PlanConfig> & object): PlanConfig {
  const base: PlanConfig = {
    kind: 'closed',
    direction: 'forward',
    startRef: { surah: 1, ayah: 1 },
    rate: { type: 'ayahs', count: 7 },
    weeklyPattern: ['study', 'study', 'study', 'study', 'tathbeet', 'rest', 'rest'],
    grandReview: { ayahsPerRound: 3 },
    dates: { start: '2026-09-01', end: '2026-09-14' },
  };
  return { ...base, ...overrides } as PlanConfig;
}

function allRefs(day: DayPlan): readonly { readonly from: { readonly surah: number; readonly ayah: number }; readonly to: { readonly surah: number; readonly ayah: number } }[] {
  const ranges = [day.newMemorization, day.smallReview, day.grandReview].filter(
    (range): range is { readonly from: { readonly surah: number; readonly ayah: number }; readonly to: { readonly surah: number; readonly ayah: number } } => range !== null,
  );
  return ranges;
}

describe('merge layer (scratch)', () => {
  it('merges the three day columns from the underlying layers', () => {
    const plan = computePlan(closedConfig({}));
    const d0 = plan.days[0];
    const d1 = plan.days[1];
    expect(d0).toMatchObject({
      date: '2026-09-01',
      kind: 'study',
      newMemorization: { from: { surah: 1, ayah: 1 }, to: { surah: 1, ayah: 7 } },
      smallReview: null,
      grandReview: null,
      phrase: null,
    });
    expect(d1.newMemorization).toEqual({ from: { surah: 2, ayah: 1 }, to: { surah: 2, ayah: 7 } });
    expect(d1.smallReview).toEqual({ from: { surah: 1, ayah: 1 }, to: { surah: 1, ayah: 7 } });
    expect(d1.grandReview).toEqual({ from: { surah: 1, ayah: 1 }, to: { surah: 1, ayah: 3 } });
  });

  it('keeps tathbeet and rest days structured per the plan rules', () => {
    const plan = computePlan(closedConfig({}));
    const tathbeet = plan.days[4];
    const rest = plan.days[5];
    expect(tathbeet).toMatchObject({
      kind: 'tathbeet',
      newMemorization: null,
      smallReview: { from: { surah: 2, ayah: 1 }, to: { surah: 2, ayah: 21 } },
      grandReview: null,
      phrase: null,
    });
    expect(rest).toMatchObject({
      kind: 'rest',
      newMemorization: null,
      smallReview: null,
      grandReview: null,
      phrase: REST_DAY_PHRASE,
    });
  });

  it('collects endRef, completedSurahs and issues in the result', () => {
    const plan = computePlan(closedConfig({}));
    expect(plan.endRef).toEqual({ surah: 2, ayah: 49 });
    expect(plan.completedSurahs).toEqual([1]);
    expect(plan.issues).toEqual([]);
  });

  it('computes gregorian dates forward from the start date by calendar days', () => {
    const plan = computePlan(closedConfig({}));
    expect(plan.days).toHaveLength(14);
    expect(plan.days[6].date).toBe('2026-09-07');
    expect(plan.days[7].date).toBe('2026-09-08');
    expect(plan.days[13].date).toBe('2026-09-14');
  });

  it('validates the config before computing', () => {
    expect(() => computePlan(closedConfig({ weeklyPattern: [] as never }))).toThrow(PlanConfigError);
    expect(() => computePlan(closedConfig({ startRef: { surah: 200, ayah: 1 } as never }))).toThrow(PlanConfigError);
  });

  it('reverse plan stops at the beginning of the Quran without fake refs', () => {
    const config = closedConfig({
      direction: 'reverse',
      startRef: { surah: 114, ayah: 6 },
      rate: { type: 'ayahs', count: 500 },
      weeklyPattern: ['study', 'study', 'study', 'study', 'study', 'study', 'study'],
      dates: { start: '2026-09-01', end: '2026-12-31' },
    });
    const plan = computePlan(config);
    expect(plan.endRef).toEqual({ surah: 1, ayah: 7 });
    for (const day of plan.days) {
      for (const range of allRefs(day)) {
        expect(refExists(range.from)).toBe(true);
        expect(refExists(range.to)).toBe(true);
      }
    }
  });

  it('every output ref exists in the mushaf index', () => {
    const plan = computePlan(closedConfig({}));
    for (const day of plan.days) {
      for (const range of allRefs(day)) {
        expect(refExists(range.from)).toBe(true);
        expect(refExists(range.to)).toBe(true);
      }
    }
  });
});

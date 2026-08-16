import { describe, expect, it } from 'vitest';

import type { PlanConfig } from '@shared/plan-types';

import { PlanConfigError, validatePlanConfig } from '@shared/plan-validation';

import { refExists } from '../../src/engine/mushaf';

const baseClosed: PlanConfig = {
  kind: 'closed',
  direction: 'forward',
  startRef: { surah: 2, ayah: 1 },
  rate: { type: 'half-page' },
  weeklyPattern: ['study', 'study', 'study', 'study', 'tathbeet', 'rest', 'rest'],
  grandReview: { ayahsPerRound: 10 },
  dates: { start: '2026-09-01', end: '2026-09-07' },
};

const baseOpen: PlanConfig = {
  kind: 'open',
  direction: 'forward',
  startRef: { surah: 2, ayah: 1 },
  rate: { type: 'ayahs', count: 5 },
  weeklyPattern: ['study', 'study', 'study', 'study', 'study', 'rest', 'rest'],
  grandReview: { ayahsPerRound: 10 },
  weeks: 4,
  startDate: '2026-09-01',
};

function expectReject(config: PlanConfig, code: string): void {
  expect(() => validatePlanConfig(config, refExists)).toThrowError(expect.objectContaining({ code }));
  try {
    validatePlanConfig(config, refExists);
  } catch (error) {
    expect(error).toBeInstanceOf(PlanConfigError);
    expect((error as PlanConfigError).code).toBe(code);
  }
}

describe('plan config validation (scratch)', () => {
  it('accepts valid closed and open configs', () => {
    expect(() => validatePlanConfig(baseClosed, refExists)).not.toThrow();
    expect(() => validatePlanConfig(baseOpen, refExists)).not.toThrow();
  });

  it('rejects a weekly pattern with no study days', () => {
    expectReject(
      { ...baseClosed, weeklyPattern: ['rest', 'rest', 'rest', 'rest', 'tathbeet', 'rest', 'rest'] },
      'no-study-days',
    );
  });

  it('rejects reversed or zero-length date ranges', () => {
    expectReject(
      { ...baseClosed, dates: { start: '2026-09-10', end: '2026-09-01' } },
      'reversed-dates',
    );
  });

  it('rejects a zero ayahs rate', () => {
    expectReject({ ...baseClosed, rate: { type: 'ayahs', count: 0 } }, 'zero-rate');
  });

  it('rejects a duration over the 730-day maximum', () => {
    expectReject(
      { ...baseClosed, dates: { start: '2026-01-01', end: '2028-01-01' } },
      'duration-over-limit',
    );
  });

  it('rejects a start ref that does not exist in the index', () => {
    expectReject({ ...baseClosed, startRef: { surah: 114, ayah: 7 } }, 'start-ref-not-found');
  });

  it('rejects a reverse start before the end of Al-Fatihah', () => {
    expectReject(
      { ...baseClosed, direction: 'reverse', startRef: { surah: 1, ayah: 3 } },
      'reverse-start-before-fatihah',
    );
  });

  it('rejects an open plan with invalid weeks', () => {
    expectReject({ ...baseOpen, weeks: 0 }, 'invalid-weeks');
    expectReject({ ...baseOpen, weeks: 200 }, 'duration-over-limit');
  });

  it('rejects an open plan with an invalid start date', () => {
    expectReject({ ...baseOpen, startDate: 'not-a-date' }, 'start-date-format');
  });
});

import { describe, expect, it } from 'vitest';

import type { DayKind, PlanConfig } from '@shared/plan-types';

import { buildGrandReviewSchedule } from '../../src/engine/grand-review';
import { buildMemorizationSchedule } from '../../src/engine/memorization';
import { juzEndOf } from '../../src/engine/mushaf';

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

const fiveStudyPattern: readonly DayKind[] = ['study', 'study', 'study', 'study', 'study', 'rest', 'rest'];

function days(config: PlanConfig) {
  return buildGrandReviewSchedule(config, buildMemorizationSchedule(config)).days;
}

describe('grand-review layer (scratch)', () => {
  it('returns null while no surah has been completed yet', () => {
    const output = days(
      closedConfig({
        startRef: { surah: 2, ayah: 1 },
        rate: { type: 'ayahs', count: 2 },
        weeklyPattern: fiveStudyPattern,
        grandReview: { unit: 'ayahs', count: 2 },
      }),
    );
    expect(output).toEqual([null, null, null, null, null, null, null]);
  });

  it('a completed surah joins the grand-review pool once memorization moves on', () => {
    const output = days(
      closedConfig({
        rate: { type: 'full-page' },
        weeklyPattern: fiveStudyPattern,
        grandReview: { unit: 'ayahs', count: 2 },
      }),
    );
    expect(output[0]).toEqual({ from: { surah: 1, ayah: 1 }, to: { surah: 1, ayah: 2 } });
    expect(output[1]).toEqual({ from: { surah: 1, ayah: 3 }, to: { surah: 1, ayah: 4 } });
  });

  it('applies grand review on every study day', () => {
    const output = days(
      closedConfig({
        rate: { type: 'ayahs', count: 7 },
        weeklyPattern: fiveStudyPattern,
        grandReview: { unit: 'ayahs', count: 2 },
      }),
    );
    expect(output[0]).toBeNull();
    expect(output[1]).toEqual({ from: { surah: 1, ayah: 1 }, to: { surah: 1, ayah: 2 } });
    expect(output[2]).toEqual({ from: { surah: 1, ayah: 3 }, to: { surah: 1, ayah: 4 } });
    expect(output[3]).toEqual({ from: { surah: 1, ayah: 5 }, to: { surah: 1, ayah: 6 } });
    expect(output[4]).toEqual({ from: { surah: 1, ayah: 7 }, to: { surah: 1, ayah: 7 } });
    expect(output[5]).toBeNull();
    expect(output[6]).toBeNull();
  });

  it('cycles through the completed pool and wraps back to the start', () => {
    const output = days(
      closedConfig({
        rate: { type: 'ayahs', count: 2 },
        weeklyPattern: fiveStudyPattern,
        grandReview: { unit: 'ayahs', count: 2 },
        dates: { start: '2026-09-01', end: '2026-09-14' },
      }),
    );
    expect(output[0]).toBeNull();
    expect(output[1]).toBeNull();
    expect(output[2]).toBeNull();
    expect(output[3]).toEqual({ from: { surah: 1, ayah: 1 }, to: { surah: 1, ayah: 2 } });
    expect(output[4]).toEqual({ from: { surah: 1, ayah: 3 }, to: { surah: 1, ayah: 4 } });
    expect(output[5]).toBeNull();
    expect(output[6]).toBeNull();
    expect(output[7]).toEqual({ from: { surah: 1, ayah: 5 }, to: { surah: 1, ayah: 6 } });
    expect(output[8]).toEqual({ from: { surah: 1, ayah: 7 }, to: { surah: 1, ayah: 7 } });
    expect(output[9]).toEqual({ from: { surah: 1, ayah: 1 }, to: { surah: 1, ayah: 2 } });
    expect(output[10]).toEqual({ from: { surah: 1, ayah: 3 }, to: { surah: 1, ayah: 4 } });
    expect(output[11]).toEqual({ from: { surah: 1, ayah: 5 }, to: { surah: 1, ayah: 6 } });
    expect(output[12]).toBeNull();
    expect(output[13]).toBeNull();
  });

  it('has no daily juz cap when the amount crosses a juz boundary (cap removed)', () => {
    const output = days(
      closedConfig({
        startRef: { surah: 2, ayah: 284 },
        rate: { type: 'ayahs', count: 3 },
        weeklyPattern: fiveStudyPattern,
        grandReview: { unit: 'ayahs', count: 150 },
      }),
    );
    expect(juzEndOf({ surah: 2, ayah: 1 })).toEqual({ surah: 2, ayah: 141 });
    expect(output[0]).toBeNull();
    expect(output[1]).toEqual({ from: { surah: 2, ayah: 1 }, to: { surah: 2, ayah: 150 } });
  });

  it('reverse reviews the completed pool from its end backward', () => {
    const output = days(
      closedConfig({
        direction: 'reverse',
        startRef: { surah: 114, ayah: 6 },
        rate: { type: 'ayahs', count: 3 },
        weeklyPattern: fiveStudyPattern,
        grandReview: { unit: 'ayahs', count: 3 },
      }),
    );
    expect(output[0]).toBeNull();
    expect(output[1]).toEqual({ from: { surah: 114, ayah: 4 }, to: { surah: 114, ayah: 6 } });
    expect(output[2]).toEqual({ from: { surah: 114, ayah: 1 }, to: { surah: 114, ayah: 3 } });
    expect(output[3]).toEqual({ from: { surah: 114, ayah: 4 }, to: { surah: 114, ayah: 6 } });
    expect(output[4]).toEqual({ from: { surah: 114, ayah: 1 }, to: { surah: 114, ayah: 3 } });
    expect(output[5]).toBeNull();
    expect(output[6]).toBeNull();
  });
});

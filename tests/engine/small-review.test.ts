import { describe, expect, it } from 'vitest';

import type { PlanConfig } from '@shared/plan-types';

import { buildMemorizationSchedule } from '../../src/engine/memorization';
import { buildSmallReviewSchedule } from '../../src/engine/small-review';

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

function days(config: PlanConfig) {
  return buildSmallReviewSchedule(config, buildMemorizationSchedule(config)).days;
}

describe('small-review layer (scratch)', () => {
  it('reviews the previous study day memorization on a normal study day', () => {
    const output = days(closedConfig({}));
    expect(output).toHaveLength(7);
    expect(output[0]).toBeNull();
    expect(output[1]).toEqual({ from: { surah: 1, ayah: 1 }, to: { surah: 1, ayah: 7 } });
    expect(output[2]).toBeNull();
    expect(output[3]).toBeNull();
    expect(output[4]).toBeNull();
    expect(output[5]).toBeNull();
    expect(output[6]).toBeNull();
  });

  it('skips the first study day after a sard day and reviews each day later', () => {
    const output = days(
      closedConfig({
        startRef: { surah: 2, ayah: 1 },
        rate: { type: 'ayahs', count: 2 },
        weeklyPattern: ['study', 'study', 'study', 'study', 'tathbeet', 'rest', 'rest'],
        dates: { start: '2026-09-01', end: '2026-09-14' },
      }),
    );
    expect(output[0]).toBeNull();
    expect(output[1]).toEqual({ from: { surah: 2, ayah: 1 }, to: { surah: 2, ayah: 2 } });
    expect(output[2]).toEqual({ from: { surah: 2, ayah: 3 }, to: { surah: 2, ayah: 4 } });
    expect(output[3]).toEqual({ from: { surah: 2, ayah: 5 }, to: { surah: 2, ayah: 6 } });
    expect(output[4]).toEqual({ from: { surah: 2, ayah: 1 }, to: { surah: 2, ayah: 8 } });
    expect(output[7]).toBeNull();
    expect(output[8]).toEqual({ from: { surah: 2, ayah: 9 }, to: { surah: 2, ayah: 10 } });
    expect(output[11]).toEqual({ from: { surah: 2, ayah: 1 }, to: { surah: 2, ayah: 16 } });
  });

  it('includes the whole of yesterday memorization even when it crosses a surah boundary', () => {
    const output = days(
      closedConfig({
        startRef: { surah: 2, ayah: 280 },
        rate: { type: 'ayahs', count: 8 },
      }),
    );
    expect(output[0]).toBeNull();
    expect(output[1]).toEqual({ from: { surah: 2, ayah: 280 }, to: { surah: 3, ayah: 1 } });
  });

  it('tathbeet reviews the full current surah range; companion days carry no tasks', () => {
    const output = days(
      closedConfig({
        startRef: { surah: 2, ayah: 1 },
        rate: { type: 'ayahs', count: 2 },
        weeklyPattern: ['study', 'tathbeet', 'companion', 'rest', 'rest', 'rest', 'rest'],
      }),
    );
    expect(output[0]).toBeNull();
    expect(output[1]).toEqual({ from: { surah: 2, ayah: 1 }, to: { surah: 2, ayah: 2 } });
    expect(output[2]).toBeNull();
    expect(output[3]).toBeNull();
  });

  it('reverse small review follows the same rules and never reverses ayahs', () => {
    const output = days(
      closedConfig({
        direction: 'reverse',
        startRef: { surah: 114, ayah: 1 },
        rate: { type: 'ayahs', count: 2 },
        weeklyPattern: ['study', 'study', 'study', 'tathbeet', 'rest', 'rest', 'rest'],
      }),
    );
    expect(output[0]).toBeNull();
    expect(output[1]).toEqual({ from: { surah: 114, ayah: 1 }, to: { surah: 114, ayah: 2 } });
    expect(output[2]).toEqual({ from: { surah: 114, ayah: 3 }, to: { surah: 114, ayah: 4 } });
    expect(output[3]).toEqual({ from: { surah: 114, ayah: 1 }, to: { surah: 114, ayah: 6 } });
    expect(output[4]).toBeNull();
    expect(output[5]).toBeNull();
    expect(output[6]).toBeNull();
  });
});

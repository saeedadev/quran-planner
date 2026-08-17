import { END_OF_FATIHAH_REF } from './types';
import type { AyahRef } from './types';

import { inclusiveDayCount } from './dates';

import { MAX_PLAN_DAYS, WEEK_LENGTH, type DayKind, type PlanConfig, type PlanDirection, type Rate } from './plan-types';

export class PlanConfigError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = 'PlanConfigError';
    this.code = code;
  }
}

const fail = (code: string, message: string): never => {
  throw new PlanConfigError(code, message);
};

export function isBefore(a: AyahRef, b: AyahRef): boolean {
  return a.surah < b.surah || (a.surah === b.surah && a.ayah < b.ayah);
}

function validateWeekPattern(pattern: readonly DayKind[]): void {
  if (!Array.isArray(pattern) || pattern.length !== WEEK_LENGTH) {
    fail('week-pattern-length', `weekly pattern must contain exactly ${WEEK_LENGTH} day kinds`);
  }
  const validKinds: readonly DayKind[] = ['study', 'tathbeet', 'companion', 'rest'];
  for (const kind of pattern) {
    if (!validKinds.includes(kind)) {
      fail('week-pattern-kind', `unknown day kind "${String(kind)}" in the weekly pattern`);
    }
  }
  if (!pattern.includes('study')) {
    fail('no-study-days', 'the weekly pattern must contain at least one study day');
  }
}

function validateDirection(direction: PlanDirection): void {
  if (direction !== 'forward' && direction !== 'reverse') {
    fail('direction', `unknown direction "${String(direction)}"`);
  }
}

function validateRate(rate: Rate): void {
  if (rate === null || typeof rate !== 'object') {
    fail('rate', 'a daily memorization rate is required');
  }
  switch (rate.type) {
    case 'half-page':
    case 'full-page':
      break;
    case 'ayahs':
      if (!Number.isInteger(rate.count) || rate.count < 1) {
        fail('zero-rate', 'an ayahs-based rate must be a positive integer');
      }
      break;
    default:
      fail('rate-type', `unknown rate type "${String((rate as { type?: unknown }).type)}"`);
  }
}

function validateGrandReview(config: PlanConfig['grandReview']): void {
  if (config === null || typeof config !== 'object') {
    fail('grand-review', 'grand review settings are required');
  }
  const validUnits = ['ayahs', 'pages', 'quarters', 'ajza'];
  if (!validUnits.includes(config.unit)) {
    fail('grand-review-unit', `unknown grand review unit "${String(config.unit)}"`);
  }
  if (!Number.isInteger(config.count) || config.count < 1) {
    fail('grand-review-amount', 'grand review count must be a positive integer');
  }
}

function validateStartRef(config: PlanConfig, refExists: (ref: AyahRef) => boolean): void {
  const start = config.startRef;
  if (start === null || typeof start !== 'object' || !Number.isInteger(start.surah) || !Number.isInteger(start.ayah)) {
    fail('start-ref', 'the plan must declare a valid starting surah:ayah');
  }
  if (!refExists(start)) {
    fail('start-ref-not-found', `starting ref ${start.surah}:${start.ayah} does not exist in the mushaf index`);
  }
  if (config.direction === 'reverse' && isBefore(start, END_OF_FATIHAH_REF)) {
    fail('reverse-start-before-fatihah', 'a reverse plan must start at or after the end of Al-Fatihah (1:7)');
  }
}

export function validatePlanConfig(config: PlanConfig, refExists: (ref: AyahRef) => boolean): void {
  if (config === null || typeof config !== 'object') {
    fail('plan', 'a plan configuration is required');
  }
  if (config.kind !== 'closed' && config.kind !== 'open') {
    fail('kind', `unknown plan kind "${String((config as { kind?: unknown }).kind)}"`);
  }
  validateDirection(config.direction);
  validateRate(config.rate);
  validateWeekPattern(config.weeklyPattern);
  validateGrandReview(config.grandReview);
  validateStartRef(config, refExists);

  if (config.kind === 'closed') {
    let duration = 0;
    try {
      duration = inclusiveDayCount(config.dates.start, config.dates.end);
    } catch {
      fail('dates-format', 'closed plan dates must be valid YYYY-MM-DD dates');
    }
    if (duration < 1) {
      fail('reversed-dates', 'the plan end date must not be before its start date');
    }
    if (duration > MAX_PLAN_DAYS) {
      fail('duration-over-limit', `plan duration exceeds the ${MAX_PLAN_DAYS}-day maximum`);
    }
  } else {
    if (!Number.isInteger(config.weeks) || config.weeks < 1) {
      fail('invalid-weeks', 'an open plan must declare a positive number of weeks');
    }
    const duration = config.weeks * WEEK_LENGTH;
    if (duration > MAX_PLAN_DAYS) {
      fail('duration-over-limit', `plan duration exceeds the ${MAX_PLAN_DAYS}-day maximum`);
    }
    try {
      inclusiveDayCount(config.startDate, config.startDate);
    } catch {
      fail('start-date-format', 'an open plan must declare a valid YYYY-MM-DD start date');
    }
  }
}

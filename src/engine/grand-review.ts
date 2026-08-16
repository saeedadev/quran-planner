import type { AyahRef } from '@shared/types';

import type { PlanConfig, PlanRange } from '@shared/plan-types';

import { isBefore } from '@shared/plan-validation';

import { nextRef, prevRef, surahEnd, surahStart } from './mushaf';

import type { MemorizationDay, MemorizationSchedule } from './memorization';

export interface GrandReviewSchedule {
  readonly days: readonly (PlanRange | null)[];
}

interface Pool {
  readonly start: AyahRef;
  readonly end: AyahRef;
}

function refAfterSteps(start: AyahRef, steps: number): AyahRef {
  let ref = start;
  for (let step = 0; step < steps; step += 1) {
    const next = nextRef(ref);
    if (next === null) {
      break;
    }
    ref = next;
  }
  return ref;
}

function refBeforeSteps(start: AyahRef, steps: number): AyahRef {
  let ref = start;
  for (let step = 0; step < steps; step += 1) {
    const prev = prevRef(ref);
    if (prev === null) {
      break;
    }
    ref = prev;
  }
  return ref;
}

function poolForDay(day: MemorizationDay): Pool | null {
  const currentSurah = day.pointerAfter.surah;
  const completed = day.completedSurahs.filter((surah) => surah !== currentSurah);
  if (completed.length === 0) {
    return null;
  }
  const start = surahStart(completed[0]);
  const end = surahEnd(completed[completed.length - 1]);
  return { start, end };
}

function forwardSlice(cursor: AyahRef, size: number, pool: Pool): PlanRange {
  let to = refAfterSteps(cursor, size - 1);
  if (isBefore(pool.end, to)) {
    to = pool.end;
  }
  return { from: cursor, to };
}

function reverseSlice(cursor: AyahRef, size: number, pool: Pool): PlanRange {
  let from = refBeforeSteps(cursor, size - 1);
  if (isBefore(from, pool.start)) {
    from = pool.start;
  }
  return { from, to: cursor };
}

function nextCursorAfterForward(to: AyahRef, pool: Pool): AyahRef {
  const next = nextRef(to);
  if (next === null || isBefore(pool.end, next)) {
    return pool.start;
  }
  return next;
}

function nextCursorAfterReverse(from: AyahRef, pool: Pool): AyahRef {
  const prev = prevRef(from);
  if (prev === null || isBefore(prev, pool.start)) {
    return pool.end;
  }
  return prev;
}

export function buildGrandReviewSchedule(config: PlanConfig, schedule: MemorizationSchedule): GrandReviewSchedule {
  const forward = config.direction === 'forward';
  const { ayahsPerRound } = config.grandReview;

  const output: (PlanRange | null)[] = [];
  let cursor: AyahRef | null = null;

  schedule.days.forEach((day) => {
    if (day.kind !== 'study') {
      output.push(null);
      return;
    }
    const pool = poolForDay(day);
    if (pool === null) {
      output.push(null);
      return;
    }
    if (cursor === null) {
      cursor = forward ? pool.start : pool.end;
    }
    const range = forward ? forwardSlice(cursor, ayahsPerRound, pool) : reverseSlice(cursor, ayahsPerRound, pool);
    output.push(range);
    cursor = forward ? nextCursorAfterForward(range.to, pool) : nextCursorAfterReverse(range.from, pool);
  });

  return { days: output };
}

import type { AyahRef } from '@shared/types';

import type { GrandReviewUnit, PlanConfig, PlanRange } from '@shared/plan-types';

import { isBefore } from '@shared/plan-validation';

import { juzEndOf, juzStartOf, nextRef, pageOf, prevRef, surahEnd, surahStart } from './mushaf';

import type { MemorizationDay, MemorizationSchedule } from './memorization';

export interface GrandReviewSchedule {
  readonly days: readonly (PlanRange | null)[];
}

interface Pool {
  readonly start: AyahRef;
  readonly end: AyahRef;
}

function nextBoundary(ref: AyahRef, unit: GrandReviewUnit): AyahRef | null {
  switch (unit) {
    case 'ayahs':
      return nextRef(ref);
    case 'pages': {
      const page = pageOf(ref);
      let current: AyahRef | null = ref;
      while (current !== null) {
        const next = nextRef(current);
        if (next === null) {
          return null;
        }
        if (pageOf(next) !== page) {
          return next;
        }
        current = next;
      }
      return null;
    }
    case 'ajza': {
      const end = juzEndOf(ref);
      return nextRef(end);
    }
    case 'quarters': {
      const start = juzStartOf(ref);
      const end = juzEndOf(ref);
      let juzCount = 0;
      let cursor: AyahRef | null = start;
      while (cursor !== null && !isBefore(end, cursor)) {
        juzCount += 1;
        cursor = nextRef(cursor);
      }
      const quarterSize = Math.ceil(juzCount / 4);
      let pos = 0;
      cursor = start;
      while (cursor !== null && isBefore(cursor, ref)) {
        pos += 1;
        cursor = nextRef(cursor);
      }
      const currentQuarter = Math.floor(pos / quarterSize);
      const targetPos = (currentQuarter + 1) * quarterSize;
      cursor = start;
      for (let i = 0; i < targetPos && cursor !== null; i += 1) {
        cursor = nextRef(cursor);
      }
      return cursor;
    }
  }
}

function prevBoundary(ref: AyahRef, unit: GrandReviewUnit): AyahRef | null {
  switch (unit) {
    case 'ayahs':
      return prevRef(ref);
    case 'pages': {
      const page = pageOf(ref);
      let current: AyahRef | null = ref;
      while (current !== null) {
        const prev = prevRef(current);
        if (prev === null) {
          return null;
        }
        if (pageOf(prev) !== page) {
          return prev;
        }
        current = prev;
      }
      return null;
    }
    case 'ajza': {
      const start = juzStartOf(ref);
      return prevRef(start);
    }
    case 'quarters': {
      const start = juzStartOf(ref);
      const end = juzEndOf(ref);
      let juzCount = 0;
      let cursor: AyahRef | null = start;
      while (cursor !== null && !isBefore(end, cursor)) {
        juzCount += 1;
        cursor = nextRef(cursor);
      }
      const quarterSize = Math.ceil(juzCount / 4);
      let pos = 0;
      cursor = start;
      while (cursor !== null && !isBefore(cursor, ref)) {
        pos += 1;
        cursor = nextRef(cursor);
      }
      const currentQuarter = Math.floor(pos / quarterSize);
      const targetPos = currentQuarter * quarterSize;
      cursor = start;
      for (let i = 0; i < targetPos && cursor !== null; i += 1) {
        cursor = nextRef(cursor);
      }
      return cursor;
    }
  }
}

function advanceForward(start: AyahRef, steps: number, unit: GrandReviewUnit): AyahRef {
  let ref = start;
  for (let i = 0; i < steps; i += 1) {
    const next = nextBoundary(ref, unit);
    if (next === null) {
      break;
    }
    ref = next;
  }
  return ref;
}

function advanceReverse(start: AyahRef, steps: number, unit: GrandReviewUnit): AyahRef {
  let ref = start;
  for (let i = 0; i < steps; i += 1) {
    const prev = prevBoundary(ref, unit);
    if (prev === null) {
      break;
    }
    ref = prev;
  }
  return ref;
}

function forwardEnd(cursor: AyahRef, count: number, unit: GrandReviewUnit): AyahRef {
  if (unit === 'ayahs') {
    return advanceForward(cursor, count - 1, 'ayahs');
  }
  const boundary = advanceForward(cursor, count, unit);
  return prevRef(boundary) ?? boundary;
}

function reverseStart(cursor: AyahRef, count: number, unit: GrandReviewUnit): AyahRef {
  if (unit === 'ayahs') {
    return advanceReverse(cursor, count - 1, 'ayahs');
  }
  const boundary = advanceReverse(cursor, count, unit);
  return nextRef(boundary) ?? boundary;
}

function forwardSlice(cursor: AyahRef, count: number, unit: GrandReviewUnit, pool: Pool): PlanRange {
  let to = forwardEnd(cursor, count, unit);
  if (isBefore(pool.end, to)) {
    to = pool.end;
  }
  return { from: cursor, to };
}

function reverseSlice(cursor: AyahRef, count: number, unit: GrandReviewUnit, pool: Pool): PlanRange {
  let from = reverseStart(cursor, count, unit);
  if (isBefore(from, pool.start)) {
    from = pool.start;
  }
  return { from, to: cursor };
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
  const { unit, count } = config.grandReview;

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
    const range = forward ? forwardSlice(cursor, count, unit, pool) : reverseSlice(cursor, count, unit, pool);
    output.push(range);
    cursor = forward ? nextCursorAfterForward(range.to, pool) : nextCursorAfterReverse(range.from, pool);
  });

  return { days: output };
}

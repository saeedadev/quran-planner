import type { AyahRef } from '@shared/types';

import type { DayKind, PlanConfig, PlanRange } from '@shared/plan-types';

import { surahStart } from './mushaf';

import type { MemorizationSchedule } from './memorization';

export interface SmallReviewSchedule {
  readonly days: readonly (PlanRange | null)[];
}

function fullRangeForDay(pointer: AyahRef): PlanRange {
  return { from: surahStart(pointer.surah), to: pointer };
}

function firstStudyAfterSardPositions(kinds: readonly DayKind[]): Set<number> {
  const positions = new Set<number>();
  let awaitingExclusion = false;
  kinds.forEach((kind, index) => {
    if (kind === 'tathbeet') {
      awaitingExclusion = true;
    } else if (kind === 'study') {
      if (awaitingExclusion) {
        positions.add(index);
      }
      awaitingExclusion = false;
    }
  });
  return positions;
}

export function buildSmallReviewSchedule(config: PlanConfig, schedule: MemorizationSchedule): SmallReviewSchedule {
  const pattern = config.weeklyPattern;
  const excludedPositions = firstStudyAfterSardPositions(pattern);

  const output: (PlanRange | null)[] = [];
  let previousMemorization: PlanRange | null = null;

  schedule.days.forEach((day, index) => {
    if (day.kind === 'tathbeet') {
      output.push(fullRangeForDay(day.pointerAfter));
      previousMemorization = day.newMemorization;
      return;
    }
    if (day.kind === 'study') {
      const isFirstAfterSard = excludedPositions.has(index % pattern.length);
      output.push(isFirstAfterSard ? null : previousMemorization);
      previousMemorization = day.newMemorization;
      return;
    }
    output.push(null);
    previousMemorization = day.newMemorization;
  });

  return { days: output };
}

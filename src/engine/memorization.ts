import type { AyahRef } from '@shared/types';

import { addDaysToKey, dateKeyToUtcDays } from '@shared/dates';

import type { DayKind, PlanConfig, PlanRange } from '@shared/plan-types';

import { isBefore } from '@shared/plan-validation';

import {
  endOfFace,
  endOfFatihah,
  endOfPage,
  endOfQuran,
  nextRef,
  surahEnd,
  surahName,
} from './mushaf';

export interface MemorizationDay {
  readonly date: string;
  readonly kind: DayKind;
  readonly newMemorization: PlanRange | null;
  readonly pointerAfter: AyahRef;
  readonly completedSurahs: readonly number[];
}

export interface MemorizationSchedule {
  readonly days: readonly MemorizationDay[];
  readonly endRef: AyahRef;
  readonly endDayIndex: number;
  readonly completedSurahs: readonly number[];
  readonly issues: readonly string[];
}

function buildDays(config: PlanConfig): readonly { date: string; kind: DayKind }[] {
  const pattern = config.weeklyPattern;
  if (config.kind === 'closed') {
    const startUtc = dateKeyToUtcDays(config.dates.start);
    const endUtc = dateKeyToUtcDays(config.dates.end);
    const days: { date: string; kind: DayKind }[] = [];
    for (let offset = 0; startUtc + offset <= endUtc; offset += 1) {
      days.push({
        date: addDaysToKey(config.dates.start, offset),
        kind: pattern[offset % pattern.length],
      });
    }
    return days;
  }
  const totalDays = config.weeks * pattern.length;
  const days: { date: string; kind: DayKind }[] = [];
  for (let offset = 0; offset < totalDays; offset += 1) {
    days.push({ date: addDaysToKey(config.startDate, offset), kind: pattern[offset % pattern.length] });
  }
  return days;
}

function forwardTarget(config: PlanConfig, pointer: AyahRef): { target: AyahRef; finished: boolean } {
  const end = endOfQuran();
  let target: AyahRef;
  switch (config.rate.type) {
    case 'half-page':
      target = endOfFace(pointer);
      break;
    case 'full-page':
      target = endOfPage(pointer);
      break;
    case 'ayahs': {
      let cursor = pointer;
      for (let step = 1; step < config.rate.count; step += 1) {
        const next = nextRef(cursor);
        if (next === null) {
          cursor = end;
          break;
        }
        cursor = next;
      }
      target = cursor;
      break;
    }
  }
  if (isBefore(end, target)) {
    target = end;
  }
  return { target, finished: target.surah === end.surah && target.ayah === end.ayah };
}

// الاتجاه المعكوس: الطالبة تصعد عكسياً بين السور (من الناس إلى الفاتحة)،
// لكن داخل كل سورة تُقرأ الآيات بالترتيب الاعتيادي من الآية 1 فصاعداً.
// وحدة اليوم لا تتجاوز نهاية السورة الجارية: تكتمل السورة ثم تنتقل لما قبلها.
function reverseUnit(config: PlanConfig, cursor: AyahRef): PlanRange {
  const surahEndRef = surahEnd(cursor.surah);
  let to: AyahRef;
  switch (config.rate.type) {
    case 'half-page':
      to = endOfFace(cursor);
      break;
    case 'full-page':
      to = endOfPage(cursor);
      break;
    case 'ayahs': {
      let ref = cursor;
      for (let step = 1; step < config.rate.count; step += 1) {
        const next = nextRef(ref);
        if (next === null || next.surah !== cursor.surah) {
          break;
        }
        ref = next;
      }
      to = ref;
      break;
    }
  }
  if (isBefore(surahEndRef, to)) {
    to = surahEndRef;
  }
  return { from: cursor, to };
}

function completedSurahsInForwardRange(from: AyahRef, to: AyahRef): number[] {
  const completed: number[] = [];
  let cursor: AyahRef | null = from;
  while (cursor !== null && !isBefore(to, cursor)) {
    const next = nextRef(cursor);
    if (next === null || next.surah !== cursor.surah) {
      completed.push(cursor.surah);
    }
    cursor = next;
  }
  return completed;
}

export function buildMemorizationSchedule(config: PlanConfig): MemorizationSchedule {
  const forward = config.direction === 'forward';
  const boundary = forward ? endOfQuran() : endOfFatihah();

  const days: MemorizationDay[] = [];
  const allCompleted = new Set<number>();
  const issues: string[] = [];

  let frontier: AyahRef = config.startRef;
  let cursor: AyahRef = config.startRef;
  let endRef: AyahRef = config.startRef;
  let endDayIndex = 0;
  let reachedBoundary = false;

  const dayStructures = buildDays(config);
  dayStructures.forEach((structure, index) => {
    if (reachedBoundary || structure.kind !== 'study') {
      days.push({
        date: structure.date,
        kind: structure.kind,
        newMemorization: null,
        pointerAfter: reachedBoundary ? endRef : frontier,
        completedSurahs: [...allCompleted].sort((a, b) => a - b),
      });
      return;
    }

    let newMemorization: PlanRange;
    let newlyCompleted: number[];
    if (forward) {
      const { target } = forwardTarget(config, cursor);
      newMemorization = { from: cursor, to: target };
      newlyCompleted = completedSurahsInForwardRange(cursor, target);
      const after = nextRef(target);
      frontier = target;
      endRef = target;
      cursor = after ?? target;
      if (after === null) {
        reachedBoundary = true;
        issues.push(`الوصول إلى نهاية المصحف (${surahName(boundary.surah)} ${boundary.surah}:${boundary.ayah}) في يوم ${index + 1} — توقف الحفظ الجديد`);
      }
    } else {
      const unit = reverseUnit(config, cursor);
      newMemorization = unit;
      newlyCompleted = completedSurahsInForwardRange(unit.from, unit.to);
      frontier = unit.to;
      endRef = unit.to;
      const surahCompleted = unit.to.ayah === surahEnd(unit.to.surah).ayah;
      if (surahCompleted) {
        if (unit.to.surah === 1) {
          reachedBoundary = true;
          issues.push(`الوصول إلى نهاية الفاتحة (${surahName(boundary.surah)} ${boundary.surah}:${boundary.ayah}) في يوم ${index + 1} — توقف الحفظ الجديد`);
        } else {
          cursor = { surah: unit.to.surah - 1, ayah: 1 };
        }
      } else {
        const after = nextRef(unit.to);
        cursor = after ?? unit.to;
      }
    }
    newlyCompleted.forEach((surah) => allCompleted.add(surah));

    days.push({
      date: structure.date,
      kind: structure.kind,
      newMemorization,
      pointerAfter: frontier,
      completedSurahs: [...allCompleted].sort((a, b) => a - b),
    });
    endDayIndex = index;
  });

  return {
    days,
    endRef,
    endDayIndex,
    completedSurahs: [...allCompleted].sort((a, b) => a - b),
    issues,
  };
}

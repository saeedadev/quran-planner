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
  surahStart,
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

// وحدات الحفظ المعتمدة لقصار السور وجزء عمّ في الاتجاه المعكوس (بمقدار صفحة كاملة)
// تُراعي اكتمال السور وعدم التجزئة، وتبدأ دائماً من أول السورة تصاعدياً حتى ختامها
export const JUZ_AMMA_REVERSE_FULL_PAGE_UNITS: readonly PlanRange[] = [
  // 1. ص 604: الإخلاص + الفلق + الناس
  { from: { surah: 112, ayah: 1 }, to: { surah: 114, ayah: 6 } },
  // 2. ص 603: الكافرون + النصر + المسد
  { from: { surah: 109, ayah: 1 }, to: { surah: 111, ayah: 5 } },
  // 3. ص 602: قريش + الماعون + الكوثر
  { from: { surah: 106, ayah: 1 }, to: { surah: 108, ayah: 3 } },
  // 4. ص 601: العصر + الهمزة + الفيل
  { from: { surah: 103, ayah: 1 }, to: { surah: 105, ayah: 5 } },
  // 5. ص 600: القارعة + التكاثر
  { from: { surah: 101, ayah: 1 }, to: { surah: 102, ayah: 8 } },
  // 6. ص 599: الزلزلة + العاديات كاملة دون اقتصاص
  { from: { surah: 99, ayah: 1 }, to: { surah: 100, ayah: 11 } },
  // 7. ص 598: القدر + البينة كاملة دون اقتصاص
  { from: { surah: 97, ayah: 1 }, to: { surah: 98, ayah: 8 } },
  // 8. ص 597: التين + العلق كاملة دون اقتصاص
  { from: { surah: 95, ayah: 1 }, to: { surah: 96, ayah: 19 } },
  // 9. ص 596: الضحى + الشرح كاملة دون اقتصاص
  { from: { surah: 93, ayah: 1 }, to: { surah: 94, ayah: 8 } },
  // 10. ص 595: الشمس + الليل كاملة دون اقتصاص
  { from: { surah: 91, ayah: 1 }, to: { surah: 92, ayah: 21 } },
  // 11. ص 594: البلد كاملة
  { from: { surah: 90, ayah: 1 }, to: { surah: 90, ayah: 20 } },
  // 12. ص 593: الفجر كاملة
  { from: { surah: 89, ayah: 1 }, to: { surah: 89, ayah: 30 } },
  // 13. الغاشية كاملة لوحدها
  { from: { surah: 88, ayah: 1 }, to: { surah: 88, ayah: 26 } },
  // 14. الطارق + الأعلى كاملتين معاً
  { from: { surah: 86, ayah: 1 }, to: { surah: 87, ayah: 19 } },
  // 15. ص 590: البروج كاملة
  { from: { surah: 85, ayah: 1 }, to: { surah: 85, ayah: 22 } },
  // 16. ص 589: الإنشقاق كاملة
  { from: { surah: 84, ayah: 1 }, to: { surah: 84, ayah: 25 } },
  // 17. ص 588: المطففين كاملة
  { from: { surah: 83, ayah: 1 }, to: { surah: 83, ayah: 36 } },
  // 18. ص 587: الإنفطار كاملة
  { from: { surah: 82, ayah: 1 }, to: { surah: 82, ayah: 19 } },
  // 19. ص 586: التكوير كاملة
  { from: { surah: 81, ayah: 1 }, to: { surah: 81, ayah: 29 } },
  // 20. ص 585: عبس كاملة
  { from: { surah: 80, ayah: 1 }, to: { surah: 80, ayah: 42 } },
  // 21. النازعات (ص 583 / الوجه الأول) - من الآية 1 إلى 16
  { from: { surah: 79, ayah: 1 }, to: { surah: 79, ayah: 16 } },
  // 22. النازعات (ص 584 / الوجه الثاني) - من الآية 17 إلى 46
  { from: { surah: 79, ayah: 17 }, to: { surah: 79, ayah: 46 } },
  // 23. النبإ (ص 582 / القسم الأول) - من الآية 1 إلى 30
  { from: { surah: 78, ayah: 1 }, to: { surah: 78, ayah: 30 } },
  // 24. النبإ (ص 583 / القسم الثاني) - من الآية 31 إلى 40
  { from: { surah: 78, ayah: 31 }, to: { surah: 78, ayah: 40 } },
];

function findJuzAmmaStartIndex(startRef: AyahRef): number {
  for (let i = 0; i < JUZ_AMMA_REVERSE_FULL_PAGE_UNITS.length; i += 1) {
    const u = JUZ_AMMA_REVERSE_FULL_PAGE_UNITS[i];
    if (!isBefore(startRef, u.from) && !isBefore(u.to, startRef)) {
      return i;
    }
  }
  for (let i = 0; i < JUZ_AMMA_REVERSE_FULL_PAGE_UNITS.length; i += 1) {
    const u = JUZ_AMMA_REVERSE_FULL_PAGE_UNITS[i];
    if (startRef.surah >= u.from.surah && startRef.surah <= u.to.surah) {
      return i;
    }
  }
  return 0;
}

function completedSurahsInUnit(unit: PlanRange, allCompleted: ReadonlySet<number>): number[] {
  const completed: number[] = [];
  for (let s = unit.from.surah; s <= unit.to.surah; s += 1) {
    if (allCompleted.has(s)) {
      continue;
    }
    const end = surahEnd(s);
    if (!isBefore(unit.to, end)) {
      completed.push(s);
    }
  }
  return completed;
}

// ===== الاتجاه الأمامي (forward) =====

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

// ===== بناء أيام الخطة =====

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

export function buildMemorizationSchedule(config: PlanConfig): MemorizationSchedule {
  const forward = config.direction === 'forward';
  const boundary = forward ? endOfQuran() : endOfFatihah();

  const days: MemorizationDay[] = [];
  const allCompleted = new Set<number>();
  const issues: string[] = [];

  let frontier: AyahRef = config.startRef;
  let endRef: AyahRef = config.startRef;
  let endDayIndex = 0;
  let reachedBoundary = false;

  let forwardCursor: AyahRef = config.startRef;

  // حالة الاتجاه المعكوس:
  let reverseInJuzAmma = !forward && config.rate.type === 'full-page' && config.startRef.surah >= 78;
  let reverseJuzAmmaIndex = reverseInJuzAmma ? findJuzAmmaStartIndex(config.startRef) : 0;
  let reverseSurah = config.startRef.surah;
  let reverseAyahCursor: AyahRef =
    config.startRef.ayah === surahEnd(config.startRef.surah).ayah
      ? surahStart(config.startRef.surah)
      : config.startRef;

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
      const { target } = forwardTarget(config, forwardCursor);
      newMemorization = { from: forwardCursor, to: target };
      newlyCompleted = completedSurahsInForwardRange(forwardCursor, target);
      const after = nextRef(target);
      frontier = target;
      endRef = target;
      forwardCursor = after ?? target;
      if (after === null) {
        reachedBoundary = true;
        issues.push(
          `الوصول إلى نهاية المصحف (${surahName(boundary.surah)} ${boundary.surah}:${boundary.ayah}) في يوم ${index + 1} — توقف الحفظ الجديد`,
        );
      }
    } else {
      // الاتجاه المعكوس:
      if (reverseInJuzAmma) {
        if (reverseJuzAmmaIndex < JUZ_AMMA_REVERSE_FULL_PAGE_UNITS.length) {
          const unit = JUZ_AMMA_REVERSE_FULL_PAGE_UNITS[reverseJuzAmmaIndex];
          newMemorization = unit;
          newlyCompleted = completedSurahsInUnit(unit, allCompleted);
          frontier = unit.to;
          endRef = unit.from;
          reverseJuzAmmaIndex += 1;
          if (reverseJuzAmmaIndex >= JUZ_AMMA_REVERSE_FULL_PAGE_UNITS.length) {
            reverseInJuzAmma = false;
            reverseSurah = 77;
            reverseAyahCursor = surahStart(77);
          }
        } else {
          reverseInJuzAmma = false;
          reverseSurah = 77;
          reverseAyahCursor = surahStart(77);
        }
      }

      if (!reverseInJuzAmma && !newMemorization!) {
        const surahLast = surahEnd(reverseSurah);
        let target: AyahRef;
        switch (config.rate.type) {
          case 'full-page': {
            const pageEnd = endOfPage(reverseAyahCursor);
            target = isBefore(surahLast, pageEnd) ? surahLast : pageEnd;
            break;
          }
          case 'half-page': {
            const faceEnd = endOfFace(reverseAyahCursor);
            target = isBefore(surahLast, faceEnd) ? surahLast : faceEnd;
            break;
          }
          case 'ayahs': {
            let cursor = reverseAyahCursor;
            for (let step = 1; step < config.rate.count; step += 1) {
              const next = nextRef(cursor);
              if (next === null || next.surah !== reverseSurah) {
                break;
              }
              cursor = next;
            }
            target = isBefore(surahLast, cursor) ? surahLast : cursor;
            break;
          }
        }

        const unit: PlanRange = { from: reverseAyahCursor, to: target };
        newMemorization = unit;
        newlyCompleted = [];
        const isSurahComplete = target.ayah === surahLast.ayah;
        if (isSurahComplete && !allCompleted.has(reverseSurah)) {
          newlyCompleted.push(reverseSurah);
        }

        frontier = unit.to;
        endRef = unit.from;

        if (isSurahComplete) {
          if (reverseSurah <= 1) {
            reachedBoundary = true;
            endRef = { surah: 1, ayah: 1 };
            issues.push(
              `الوصول إلى نهاية الفاتحة (${surahName(boundary.surah)} ${boundary.surah}:${boundary.ayah}) في يوم ${index + 1} — توقف الحفظ الجديد`,
            );
          } else {
            reverseSurah -= 1;
            reverseAyahCursor = surahStart(reverseSurah);
          }
        } else {
          const next = nextRef(target);
          if (next === null || next.surah !== reverseSurah) {
            if (reverseSurah <= 1) {
              reachedBoundary = true;
              endRef = { surah: 1, ayah: 1 };
              issues.push(
                `الوصول إلى نهاية الفاتحة (${surahName(boundary.surah)} ${boundary.surah}:${boundary.ayah}) في يوم ${index + 1} — توقف الحفظ الجديد`,
              );
            } else {
              reverseSurah -= 1;
              reverseAyahCursor = surahStart(reverseSurah);
            }
          } else {
            reverseAyahCursor = next;
          }
        }
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


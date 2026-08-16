import type { AyahRef, MushafIndex } from '@shared/types';

import { formatAyahRef } from '@shared/validation';

import indexData from '../data/mushaf-index.json';

// المصدر المعتمد: الفهرس المدمج المبني من مواد QUL (تخطيط KFGQPC V4 — Layout 19)
// عبر tools/build-mushaf.ts — كل القيم هنا مشتقة من الفهرس، لا يُدخل أي رقم يدوياً.
const index = indexData as unknown as MushafIndex;

export interface MushafErrorCode {
  readonly code: string;
  readonly message: string;
}

export class MushafDataError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = 'MushafDataError';
    this.code = code;
  }
}

function fail(code: string, message: string): never {
  throw new MushafDataError(code, message);
}

const refKey = (ref: AyahRef): string => `${ref.surah}:${ref.ayah}`;

interface AyahLineEntry {
  readonly line: number;
  readonly first: AyahRef;
  readonly last: AyahRef;
}

function buildAyahLineTable(): {
  readonly ayahCountBySurah: readonly number[];
  readonly pageAyahLines: ReadonlyMap<number, readonly AyahLineEntry[]>;
  readonly refToPage: ReadonlyMap<string, number>;
  readonly refToAyahLineIndex: ReadonlyMap<string, number>;
} {
  const ayahCountBySurah = new Array<number>(index.surahs.length + 1).fill(0);
  const pageAyahLines = new Map<number, AyahLineEntry[]>();
  const refToPage = new Map<string, number>();
  const refToAyahLineIndex = new Map<string, number>();

  for (const page of index.pages) {
    const ayahLines: AyahLineEntry[] = [];
    for (const line of page.lines) {
      if (line.type !== 'ayah' || !line.ayahRange || !line.ayahRange.first || !line.ayahRange.last) {
        continue;
      }
      const { first, last } = line.ayahRange;
      const entry: AyahLineEntry = { line: line.line, first, last };
      ayahLines.push(entry);
      const surahCount = ayahCountBySurah[first.surah] ?? 0;
      if (first.ayah > surahCount) {
        ayahCountBySurah[first.surah] = first.ayah;
      }
      const lastCount = ayahCountBySurah[last.surah] ?? 0;
      if (last.ayah > lastCount) {
        ayahCountBySurah[last.surah] = last.ayah;
      }
      const registerRef = (ref: AyahRef): void => {
        if (!refToPage.has(refKey(ref))) {
          refToPage.set(refKey(ref), page.page);
          refToAyahLineIndex.set(refKey(ref), entry.line);
        }
      };
      if (first.surah === last.surah) {
        for (let ayah = first.ayah; ayah <= last.ayah; ayah += 1) {
          registerRef({ surah: first.surah, ayah });
        }
      } else {
        registerRef(first);
        registerRef(last);
      }
    }
    pageAyahLines.set(page.page, ayahLines);
  }
  return {
    ayahCountBySurah,
    pageAyahLines,
    refToPage,
    refToAyahLineIndex,
  };
}

const table = buildAyahLineTable();

export function refExists(ref: AyahRef): boolean {
  if (ref === null || typeof ref !== 'object') {
    return false;
  }
  if (!Number.isInteger(ref.surah) || !Number.isInteger(ref.ayah)) {
    return false;
  }
  if (ref.surah < 1 || ref.surah > index.surahs.length) {
    return false;
  }
  if (ref.ayah < 1 || ref.ayah > (table.ayahCountBySurah[ref.surah] ?? 0)) {
    return false;
  }
  return table.refToPage.has(refKey(ref));
}

export function isRefInRange(ref: AyahRef, first: AyahRef, last: AyahRef): boolean {
  if (!refExists(ref) || !refExists(first) || !refExists(last)) {
    return false;
  }
  return !isBefore(ref, first) && !isBefore(last, ref);
}

function isBefore(a: AyahRef, b: AyahRef): boolean {
  return a.surah < b.surah || (a.surah === b.surah && a.ayah < b.ayah);
}

function isBeforeOrEqual(a: AyahRef, b: AyahRef): boolean {
  return a.surah < b.surah || (a.surah === b.surah && a.ayah <= b.ayah);
}

// كبح وجه/صفحة كاملة إلى نهاية السورة الجارية: عند نهاية السورة في منتصف الصفحة
// لا تُؤخذ آية من السورة التالية، بل يتوقف الوجه عند آخر آية في السورة.
function clampToSurahEnd(ref: AyahRef, surah: number): AyahRef {
  const boundary = surahEnd(surah);
  return isBefore(boundary, ref) ? boundary : ref;
}

export function nextRef(ref: AyahRef): AyahRef | null {
  if (!refExists(ref)) {
    return null;
  }
  const count = table.ayahCountBySurah[ref.surah] ?? 0;
  if (ref.ayah < count) {
    return { surah: ref.surah, ayah: ref.ayah + 1 };
  }
  if (ref.surah < index.surahs.length) {
    return { surah: ref.surah + 1, ayah: 1 };
  }
  return null;
}

export function prevRef(ref: AyahRef): AyahRef | null {
  if (!refExists(ref)) {
    return null;
  }
  if (ref.ayah > 1) {
    return { surah: ref.surah, ayah: ref.ayah - 1 };
  }
  if (ref.surah > 1) {
    const prevCount = table.ayahCountBySurah[ref.surah - 1] ?? 0;
    if (prevCount < 1) {
      return null;
    }
    return { surah: ref.surah - 1, ayah: prevCount };
  }
  return null;
}

export function surahStart(surah: number): AyahRef {
  if (!Number.isInteger(surah) || surah < 1 || surah > index.surahs.length) {
    fail('surah-out-of-range', `surah ${surah} is out of range 1..${index.surahs.length}`);
  }
  if ((table.ayahCountBySurah[surah] ?? 0) < 1) {
    fail('surah-empty', `surah ${surah} has no ayahs in the index`);
  }
  return { surah, ayah: 1 };
}

export function surahEnd(surah: number): AyahRef {
  if (!Number.isInteger(surah) || surah < 1 || surah > index.surahs.length) {
    fail('surah-out-of-range', `surah ${surah} is out of range 1..${index.surahs.length}`);
  }
  const count = table.ayahCountBySurah[surah] ?? 0;
  if (count < 1) {
    fail('surah-empty', `surah ${surah} has no ayahs in the index`);
  }
  return { surah, ayah: count };
}

export function surahName(surah: number): string {
  if (!Number.isInteger(surah) || surah < 1 || surah > index.surahs.length) {
    fail('surah-out-of-range', `surah ${surah} is out of range 1..${index.surahs.length}`);
  }
  const entry = index.surahs[surah - 1];
  if (!entry || typeof entry.name !== 'string' || entry.name.length === 0) {
    fail('surah-name-missing', `surah ${surah} has no name in the index`);
  }
  return entry.name;
}

export function pageOf(ref: AyahRef): number {
  if (!refExists(ref)) {
    fail('ref-not-found', `ref ${formatAyahRef(ref)} is not in the index`);
  }
  return table.refToPage.get(refKey(ref)) ?? 0;
}

export function lineIndexOf(ref: AyahRef): number {
  if (!refExists(ref)) {
    fail('ref-not-found', `ref ${formatAyahRef(ref)} is not in the index`);
  }
  return table.refToAyahLineIndex.get(refKey(ref)) ?? 0;
}

function ayahLinesOfPage(page: number): readonly AyahLineEntry[] {
  const lines = table.pageAyahLines.get(page);
  if (!lines || lines.length === 0) {
    fail('page-no-ayah-lines', `page ${page} has no ayah lines`);
  }
  return lines;
}

function firstRefOfPage(page: number): AyahRef {
  const lines = ayahLinesOfPage(page);
  return lines[0].first;
}

function lastRefOfPage(page: number): AyahRef {
  const lines = ayahLinesOfPage(page);
  return lines[lines.length - 1].last;
}

// ==== مناطق الأوجه المركّبة (دمج أطراف السور القصيرة) ====
// إذا بدأت السورة أو انتهت في منتصف صفحة مشتركة مع سورة أخرى بأسطر قليلة (٤ أسطر أو أقل)،
// لا تُترك هذه الأسطر وحدها وجهًا كاملًا، بل تُضمّ إلى الوجه المجاور:
// البدء القصير يُضمّ إلى الوجه الذي يليه، والانتهاء القصير يُضمّ إلى الوجه الذي قبله.
// كل القيم مشتقة من الفهرس (أطراف الصفحات وأطراف السور) — لا يُدخل أي رقم يدوياً.

interface FaceRegion {
  readonly start: AyahRef;
  readonly mid: AyahRef;
  readonly end: AyahRef;
}

function pageSurahs(page: number): ReadonlySet<number> {
  const set = new Set<number>();
  for (const entry of ayahLinesOfPage(page)) {
    set.add(entry.first.surah);
    set.add(entry.last.surah);
  }
  return set;
}

function ayahLineCountOfSurahOnPage(surah: number, page: number): number {
  let count = 0;
  for (const entry of ayahLinesOfPage(page)) {
    if (entry.first.surah === surah) {
      count += 1;
    }
  }
  return count;
}

function isPageEntirelySurah(page: number, surah: number): boolean {
  const lines = table.pageAyahLines.get(page);
  if (!lines || lines.length === 0) {
    return false;
  }
  return lines.every((entry) => entry.first.surah === surah && entry.last.surah === surah);
}

function firstPageOfSurah(surah: number): number {
  return table.refToPage.get(refKey({ surah, ayah: 1 })) ?? 0;
}

function lastPageOfSurah(surah: number): number {
  const count = table.ayahCountBySurah[surah] ?? 0;
  return table.refToPage.get(refKey({ surah, ayah: count })) ?? 0;
}

function refAfterSteps(ref: AyahRef, steps: number): AyahRef {
  let cursor = ref;
  for (let step = 0; step < steps; step += 1) {
    const next = nextRef(cursor);
    if (next === null) {
      break;
    }
    cursor = next;
  }
  return cursor;
}

// تقسيم الوجه نصفين يعتمد على المنتصف البصري للصفحة (الأسطر لا عدد الآيات):
// النصف الأول = أول floor(N/2) من أسطر الآيات، والنصف الثاني = الباقي،
// والخط الأوسط يُحتسب في النصف الثاني (مثل صفحة البقرة 6–16: النصف الأول 6–11 ثم 12–16).
function firstFaceEndOfPage(page: number): AyahRef {
  const lines = ayahLinesOfPage(page);
  const split = Math.floor(lines.length / 2);
  if (split < 1) {
    return lines[0].last;
  }
  return lines[split - 1].last;
}

// بداية النصف الثاني = ما بعد آخر آية في النصف الأول (وليس أول آية في السطر الأوسط):
// السطر الأوسط قد يبدأ بآية تسبق نهاية النصف الأول (مثل صفحة المطففين التي يبدأ سطرها الأوسط بـ83:19–21).
function secondFaceStartOfPage(page: number): AyahRef {
  const firstEnd = firstFaceEndOfPage(page);
  return nextRef(firstEnd) ?? firstEnd;
}

function rangeAyahLines(first: AyahRef, last: AyahRef): readonly AyahLineEntry[] {
  const out: AyahLineEntry[] = [];
  const firstPage = pageOf(first);
  const lastPage = pageOf(last);
  const firstLine = lineIndexOf(first);
  for (let page = firstPage; page <= lastPage; page += 1) {
    const lines = ayahLinesOfPage(page);
    for (const entry of lines) {
      if (page === firstPage && entry.line < firstLine) {
        continue;
      }
      if (isBefore(last, entry.first)) {
        return out;
      }
      out.push(entry);
    }
  }
  return out;
}

function visualMid(first: AyahRef, last: AyahRef): AyahRef {
  const lines = rangeAyahLines(first, last);
  const split = Math.floor(lines.length / 2);
  if (split < 1) {
    return last;
  }
  return lines[split - 1].last;
}

function assertRegionsDisjoint(regions: readonly FaceRegion[]): void {
  for (let i = 0; i < regions.length; i += 1) {
    for (let j = i + 1; j < regions.length; j += 1) {
      const a = regions[i];
      const b = regions[j];
      const overlaps = !isBefore(b.end, a.start) && !isBefore(a.end, b.start);
      if (overlaps) {
        fail(
          'region-overlap',
          `face regions overlap: ${formatAyahRef(a.start)}..${formatAyahRef(a.end)} vs ${formatAyahRef(b.start)}..${formatAyahRef(b.end)}`,
        );
      }
    }
  }
}

function buildFaceRegions(): readonly FaceRegion[] {
  const regions: FaceRegion[] = [];
  const lastPageNum = index.pages[index.pages.length - 1].page;
  const push = (start: AyahRef, end: AyahRef): void => {
    const mid = visualMid(start, end);
    regions.push({ start, mid, end });
  };
  for (let surah = 1; surah <= index.surahs.length; surah += 1) {
    const firstPage = firstPageOfSurah(surah);
    const lastPage = lastPageOfSurah(surah);
    if (firstPage < 1 || lastPage < 1) {
      continue;
    }
    const startLines = ayahLineCountOfSurahOnPage(surah, firstPage);
    const endLines = ayahLineCountOfSurahOnPage(surah, lastPage);
    const startPartial = pageSurahs(firstPage).size > 1 && startLines <= 4;
    const endPartial = pageSurahs(lastPage).size > 1 && endLines <= 4;
    const nextFull = firstPage + 1 <= lastPage && firstPage + 1 <= lastPageNum && isPageEntirelySurah(firstPage + 1, surah);
    const prevFull = lastPage - 1 >= firstPage && lastPage - 1 >= 1 && isPageEntirelySurah(lastPage - 1, surah);

    if (startPartial && nextFull) {
      if (endPartial && prevFull && lastPage === firstPage + 2) {
        // سورة تمتد على ٣ صفحات ببداية ونهاية قصيرتين: تُقسَّم الصفحة الوسطى إلى وجهين
        push(surahStart(surah), firstFaceEndOfPage(firstPage + 1));
        push(secondFaceStartOfPage(firstPage + 1), surahEnd(surah));
      } else {
        push(surahStart(surah), lastRefOfPage(firstPage + 1));
        if (endPartial && prevFull) {
          push(firstRefOfPage(lastPage - 1), surahEnd(surah));
        }
      }
    } else if (endPartial && prevFull) {
      push(firstRefOfPage(lastPage - 1), surahEnd(surah));
    }
  }
  assertRegionsDisjoint(regions);
  return regions;
}

// سور قصيرة تبدأ في منتصف صفحة مشتركة ولا تملك صفحة تالية خاصة بها:
// تُعامل كامل السورة وجهًا واحدًا في المعدل اليومي وجه كامل (وليس نصف وجه).
const tinyPageRegions: readonly FaceRegion[] = (() => {
  const regions: FaceRegion[] = [];
  const lastPageNum = index.pages[index.pages.length - 1].page;
  const push = (start: AyahRef, end: AyahRef): void => {
    const mid = refAfterSteps(start, Math.ceil(countAyahs(start, end) / 2) - 1);
    regions.push({ start, mid, end });
  };
  for (let surah = 1; surah <= index.surahs.length; surah += 1) {
    const firstPage = firstPageOfSurah(surah);
    const lastPage = lastPageOfSurah(surah);
    if (firstPage < 1 || lastPage < 1) {
      continue;
    }
    const startLines = ayahLineCountOfSurahOnPage(surah, firstPage);
    const startPartial = pageSurahs(firstPage).size > 1 && startLines <= 4;
    const nextFull = firstPage + 1 <= lastPage && firstPage + 1 <= lastPageNum && isPageEntirelySurah(firstPage + 1, surah);
    if (startPartial && !nextFull && lastPage <= firstPage + 1) {
      push(surahStart(surah), surahEnd(surah));
    }
  }
  assertRegionsDisjoint(regions);
  return regions;
})();

const faceRegions = buildFaceRegions();

function regionFor(ref: AyahRef, regions: readonly FaceRegion[]): FaceRegion | null {
  for (const region of regions) {
    if (!isBefore(ref, region.start) && !isBefore(region.end, ref)) {
      return region;
    }
  }
  return null;
}

// استثناء أول صفحتين في المصحف (تخطيط KFGQPC V4):
// صفحة الفاتحة (1:1..1:7) وصفحة البداية من سورة البقرة (2:1..2:5) كلتاهما قصيرتان،
// فتُعاملان كصفحة واحدة كاملة الوجه: الوجه الأول = الفاتحة كلها، والوجه الثاني = 2:1..2:5.
// القيم مشتقة من الفهرس (نهاية الفاتحة / نهاية صفحة 2) ولا يُدخل أي رقم يدوياً.
export function endOfFace(ref: AyahRef): AyahRef {
  if (!refExists(ref)) {
    fail('ref-not-found', `ref ${formatAyahRef(ref)} is not in the index`);
  }
  const page = pageOf(ref);
  if (page === 1) {
    return endOfFatihah();
  }
  if (page === 2) {
    return lastRefOfPage(2);
  }
  const region = regionFor(ref, faceRegions);
  if (region) {
    const faceEnd = isBeforeOrEqual(ref, region.mid) ? region.mid : region.end;
    return clampToSurahEnd(faceEnd, ref.surah);
  }
  const lines = ayahLinesOfPage(page);
  const split = Math.floor(lines.length / 2);
  const currentLine = lineIndexOf(ref);
  const currentPosition = lines.findIndex((entry) => entry.line === currentLine);
  if (currentPosition < 0) {
    fail('line-not-found', `ref ${formatAyahRef(ref)} line not found on page ${page}`);
  }
  // لا تتجاوز الآية نهاية سورتها الجارية: عند نهاية السورة في منتصف الصفحة
  // (مثل صفحة يونس التي يلي آخر آياتها بداية سورة هود) يتوقف الوجه عند نهاية السورة.
  const inFirstFace = split > 0 && currentPosition < split;
  const lastLine = inFirstFace ? lines[split - 1] : lines[lines.length - 1];
  return clampToSurahEnd(lastLine.last, ref.surah);
}

export function startOfFace(ref: AyahRef): AyahRef {
  if (!refExists(ref)) {
    fail('ref-not-found', `ref ${formatAyahRef(ref)} is not in the index`);
  }
  const page = pageOf(ref);
  if (page === 1) {
    return firstRefOfPage(1);
  }
  if (page === 2) {
    return firstRefOfPage(2);
  }
  const region = regionFor(ref, faceRegions);
  if (region) {
    return region.start;
  }
  const lines = ayahLinesOfPage(page);
  const split = Math.floor(lines.length / 2);
  const currentLine = lineIndexOf(ref);
  const currentPosition = lines.findIndex((entry) => entry.line === currentLine);
  if (currentPosition < 0) {
    fail('line-not-found', `ref ${formatAyahRef(ref)} line not found on page ${page}`);
  }
  if (split < 1 || currentPosition < split) {
    return lines[0].first;
  }
  // النصف الثاني يبدأ بعد نهاية النصف الأول مباشرة (وليس من أول السطر الأوسط)،
  // حتى لا تُفقد آية تبدأ في السطر الأوسط ولا تُكرَّر أخرى تنتهي فيه.
  const secondStart = nextRef(lines[split - 1].last);
  return secondStart ?? lines[split - 1].last;
}

export function endOfPage(ref: AyahRef): AyahRef {
  if (!refExists(ref)) {
    fail('ref-not-found', `ref ${formatAyahRef(ref)} is not in the index`);
  }
  const page = pageOf(ref);
  if (page === 1 || page === 2) {
    return lastRefOfPage(2);
  }
  const region = regionFor(ref, faceRegions) ?? regionFor(ref, tinyPageRegions);
  if (region) {
    return region.end;
  }
  const pageEnd = lastRefOfPage(page);
  return clampToSurahEnd(pageEnd, ref.surah);
}

export function startOfPage(ref: AyahRef): AyahRef {
  if (!refExists(ref)) {
    fail('ref-not-found', `ref ${formatAyahRef(ref)} is not in the index`);
  }
  const page = pageOf(ref);
  if (page === 1 || page === 2) {
    return firstRefOfPage(1);
  }
  const region = regionFor(ref, faceRegions) ?? regionFor(ref, tinyPageRegions);
  if (region) {
    return region.start;
  }
  return firstRefOfPage(page);
}

export function endOfQuran(): AyahRef {
  const pages = index.pages;
  const lastPageLines = ayahLinesOfPage(pages[pages.length - 1].page);
  return lastPageLines[lastPageLines.length - 1].last;
}

export function endOfFatihah(): AyahRef {
  const lines = ayahLinesOfPage(1);
  let last: AyahRef | null = null;
  for (const line of lines) {
    if (line.first.surah === 1 || line.last.surah === 1) {
      if (line.last.surah === 1 && (!last || isBefore(last, line.last))) {
        last = line.last;
      }
    }
  }
  if (!last) {
    fail('fatihah-missing', 'Al-Fatihah ayahs not found on page 1');
  }
  return last;
}

export function countAyahs(first: AyahRef, last: AyahRef): number {
  if (!refExists(first) || !refExists(last)) {
    fail('ref-not-found', `range ${formatAyahRef(first)}..${formatAyahRef(last)} is not in the index`);
  }
  if (isBefore(last, first)) {
    fail('range-order', `range ${formatAyahRef(first)}..${formatAyahRef(last)} is out of order`);
  }
  if (first.surah === last.surah) {
    return last.ayah - first.ayah + 1;
  }
  let total = 0;
  total += (table.ayahCountBySurah[first.surah] ?? 0) - first.ayah + 1;
  for (let surah = first.surah + 1; surah < last.surah; surah += 1) {
    total += table.ayahCountBySurah[surah] ?? 0;
  }
  total += last.ayah;
  return total;
}

function juzPositionOf(ref: AyahRef): number {
  if (!refExists(ref)) {
    fail('ref-not-found', `ref ${formatAyahRef(ref)} is not in the index`);
  }
  for (let position = 0; position < index.juzes.length; position += 1) {
    const juz = index.juzes[position];
    if (isBeforeOrEqual(juz.first, ref) && isBeforeOrEqual(ref, juz.last)) {
      return position;
    }
  }
  fail('juz-not-found', `no juz contains ref ${formatAyahRef(ref)}`);
}

export function juzOf(ref: AyahRef): number {
  return index.juzes[juzPositionOf(ref)].juz;
}

export function juzStartOf(ref: AyahRef): AyahRef {
  return index.juzes[juzPositionOf(ref)].first;
}

export function juzEndOf(ref: AyahRef): AyahRef {
  return index.juzes[juzPositionOf(ref)].last;
}

export function juzAyahCount(juz: number): number {
  if (!Number.isInteger(juz) || juz < 1 || juz > index.juzes.length) {
    fail('juz-out-of-range', `juz ${juz} is out of range 1..${index.juzes.length}`);
  }
  return index.juzes[juz - 1].versesCount;
}

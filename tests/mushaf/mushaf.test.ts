import { createHash } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import {
  INDEX_FORMAT,
  INDEX_VERSION,
  JUZ_COUNT,
  MAX_SURAH,
  REFERENCE_AYAH_COUNT,
  REFERENCE_PAGE_COUNT,
  REFERENCE_SURAH_COUNT,
  type AyahRef,
} from '@shared/types';

import { canonicalJson } from '@shared/serialization';

import { buildIndexData, type BuildResult } from '../../tools/build-mushaf';

function contentOf(result: BuildResult): Record<string, unknown> {
  return {
    format: result.index.format,
    version: result.index.version,
    source: result.index.source,
    pages: result.index.pages,
    surahs: result.index.surahs,
    juzes: result.index.juzes,
  };
}

function recomputeHash(result: BuildResult): string {
  return createHash('sha256').update(canonicalJson(contentOf(result))).digest('hex');
}

function withinReadingOrder(ref: AyahRef, first: AyahRef, last: AyahRef): boolean {
  const pos = (value: AyahRef): string => `${String(value.surah).padStart(3, '0')}:${String(value.ayah).padStart(3, '0')}`;
  return pos(ref) >= pos(first) && pos(ref) <= pos(last);
}

function walkStrings(value: unknown, visit: (text: string) => void): void {
  if (typeof value === 'string') {
    visit(value);
  } else if (Array.isArray(value)) {
    value.forEach((item) => walkStrings(item, visit));
  } else if (value !== null && typeof value === 'object') {
    Object.values(value as Record<string, unknown>).forEach((item) => walkStrings(item, visit));
  }
}

const result = buildIndexData();
const { index, words, refs, maxWord } = result;

describe('mushaf index built from real QUL materials', () => {
  it('official numbers 604 / 114 / 6236 come from the real files', () => {
    expect(index.pages).toHaveLength(REFERENCE_PAGE_COUNT);
    expect(index.surahs).toHaveLength(REFERENCE_SURAH_COUNT);
    expect(refs).toHaveLength(REFERENCE_AYAH_COUNT);
    expect(maxWord).toBe(words.length);
  });

  it('index format and version are set, hash is a sha256 hex string', () => {
    expect(index.format).toBe(INDEX_FORMAT);
    expect(index.version).toBe(INDEX_VERSION);
    expect(index.hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('pages and lines are numbered contiguously from 1', () => {
    index.pages.forEach((page, pagePosition) => {
      expect(page.page).toBe(pagePosition + 1);
      expect(page.lines.length).toBeGreaterThan(0);
      page.lines.forEach((line, linePosition) => {
        expect(line.line).toBe(linePosition + 1);
      });
    });
  });

  it('word ranges are continuous across every page boundary and line', () => {
    let expectedNext = 1;
    let covered = 0;
    for (const page of index.pages) {
      for (const line of page.lines) {
        if (line.type !== 'ayah' || !line.wordRange) {
          continue;
        }
        expect(line.wordRange.first).toBe(expectedNext);
        expect(line.wordRange.last).toBeGreaterThanOrEqual(line.wordRange.first);
        expectedNext = line.wordRange.last + 1;
        covered += line.wordRange.last - line.wordRange.first + 1;
      }
    }
    expect(expectedNext).toBe(words.length + 1);
    expect(covered).toBe(words.length);
  });

  it('every page splits into two consecutive halves by actual line count', () => {
    for (const page of index.pages) {
      const lineCount = page.lines.length;
      expect(lineCount).toBeGreaterThanOrEqual(2);
      const split = Math.ceil(lineCount / 2);
      const firstHalf = page.lines.slice(0, split);
      const secondHalf = page.lines.slice(split);
      expect(firstHalf.length).toBeGreaterThan(0);
      expect(secondHalf.length).toBeGreaterThan(0);
      expect(firstHalf[0].line).toBe(1);
      expect(firstHalf[firstHalf.length - 1].line).toBe(split);
      expect(secondHalf[0].line).toBe(split + 1);
      expect(secondHalf[secondHalf.length - 1].line).toBe(lineCount);
    }
  });

  it('hash is reproducible and matches an independent recomputation', () => {
    expect(index.hash).toBe(recomputeHash(result));
    const secondRun = buildIndexData();
    expect(secondRun.index.hash).toBe(index.hash);
  });

  it('every surah:ayah range in the index is faithful to the real word data', () => {
    const refAt = new Map<number, AyahRef>();
    for (const word of words) {
      refAt.set(word.wordIndex, { surah: word.surah, ayah: word.ayah });
    }
    for (const page of index.pages) {
      for (const line of page.lines) {
        if (line.type !== 'ayah' || !line.wordRange || !line.ayahRange) {
          continue;
        }
        const firstRef = refAt.get(line.wordRange.first);
        const lastRef = refAt.get(line.wordRange.last);
        expect(firstRef).toEqual(line.ayahRange.first);
        expect(lastRef).toEqual(line.ayahRange.last);
        for (let word = line.wordRange.first; word <= line.wordRange.last; word += 1) {
          const ref = refAt.get(word);
          expect(ref).toBeDefined();
          expect(withinReadingOrder(ref as AyahRef, line.ayahRange.first, line.ayahRange.last)).toBe(true);
        }
      }
    }
  });

  it('surah names are present and numbered contiguously', () => {
    index.surahs.forEach((surah, position) => {
      expect(surah.number).toBe(position + 1);
      expect(surah.name.length).toBeGreaterThan(0);
    });
  });

  it('the 30 juz boundaries come from QUL and cover the whole mushaf', () => {
    expect(index.juzes).toHaveLength(JUZ_COUNT);
    index.juzes.forEach((juz, position) => {
      expect(juz.juz).toBe(position + 1);
      expect(juz.versesCount).toBeGreaterThan(0);
      const firstPos = refs.findIndex((ref) => ref.surah === juz.first.surah && ref.ayah === juz.first.ayah);
      const lastPos = refs.findIndex((ref) => ref.surah === juz.last.surah && ref.ayah === juz.last.ayah);
      expect(firstPos).toBeGreaterThanOrEqual(0);
      expect(lastPos).toBeGreaterThanOrEqual(firstPos);
      if (position > 0) {
        const prev = index.juzes[position - 1];
        const prevLastPos = refs.findIndex((ref) => ref.surah === prev.last.surah && ref.ayah === prev.last.ayah);
        expect(firstPos).toBe(prevLastPos + 1);
      }
    });
    expect(index.juzes[0].first).toEqual({ surah: 1, ayah: 1 });
    expect(index.juzes[JUZ_COUNT - 1].last).toEqual({ surah: 114, ayah: 6 });
    const sum = index.juzes.reduce((total, juz) => total + juz.versesCount, 0);
    expect(sum).toBe(REFERENCE_AYAH_COUNT);
  });

  it('the index contains no ayah text or glyph data, only the 114 surah names', () => {
    const serialized = canonicalJson(index);
    expect(serialized).not.toMatch(/"(text|glyph|wordKey|location)":/);
    const names = new Set(index.surahs.map((surah) => surah.name));
    const arabicStrings: string[] = [];
    walkStrings(index, (text) => {
      if (/[\u0600-\u06FF]/.test(text)) {
        arabicStrings.push(text);
      }
    });
    expect(arabicStrings).toHaveLength(MAX_SURAH);
    for (const text of arabicStrings) {
      expect(names.has(text)).toBe(true);
    }
  });

  it('sample pages match the structure documented in the manifest', () => {
    const page1 = index.pages[0];
    expect(page1.lines[0]).toMatchObject({ type: 'surah_name', surah: 1, centered: true });
    const lastLine1 = page1.lines[page1.lines.length - 1];
    expect(lastLine1.type).toBe('ayah');
    expect(lastLine1.wordRange?.last).toBe(36);
    expect(lastLine1.ayahRange?.last).toEqual({ surah: 1, ayah: 7 });

    const page2 = index.pages[1];
    expect(page2.lines[0]).toMatchObject({ type: 'surah_name', surah: 2 });
    expect(page2.lines[1]).toMatchObject({ type: 'basmallah', centered: true });
    const firstAyahLine2 = page2.lines.find((line) => line.type === 'ayah');
    expect(firstAyahLine2?.wordRange?.first).toBe(37);
    expect(firstAyahLine2?.ayahRange?.first).toEqual({ surah: 2, ayah: 1 });

    const page604 = index.pages[603];
    const lastLine604 = page604.lines[page604.lines.length - 1];
    expect(lastLine604.type).toBe('ayah');
    expect(lastLine604.wordRange).toEqual({ first: 83665, last: 83668 });
    expect(lastLine604.ayahRange?.last).toEqual({ surah: 114, ayah: 6 });
  });
});

import { createHash } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import indexData from '../src/data/mushaf-index.json';

import {
  INDEX_FORMAT,
  INDEX_VERSION,
  JUZ_COUNT,
  MAX_SURAH,
  REFERENCE_AYAH_COUNT,
  REFERENCE_PAGE_COUNT,
  REFERENCE_SURAH_COUNT,
  type MushafIndex,
} from '@shared/types';

import { validateIndexShape } from '@shared/validation';

import { canonicalJson } from '@shared/serialization';

const index = indexData as unknown as MushafIndex;

function content(): Record<string, unknown> {
  return {
    format: index.format,
    version: index.version,
    source: index.source,
    pages: index.pages,
    surahs: index.surahs,
    juzes: index.juzes,
  };
}

function isBeforeOrEqual(a: AyahRefLike, b: AyahRefLike): boolean {
  return a.surah < b.surah || (a.surah === b.surah && a.ayah <= b.ayah);
}

interface AyahRefLike {
  readonly surah: number;
  readonly ayah: number;
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

describe('bundled mushaf index (src/data/mushaf-index.json)', () => {
  it('passes the shared index shape validation', () => {
    expect(() => validateIndexShape(index)).not.toThrow();
  });

  it('holds the official reference numbers', () => {
    expect(index.pages).toHaveLength(REFERENCE_PAGE_COUNT);
    expect(index.surahs).toHaveLength(REFERENCE_SURAH_COUNT);
    expect(index.format).toBe(INDEX_FORMAT);
    expect(index.version).toBe(INDEX_VERSION);
  });

  it('hash matches an independent recomputation over the structural content', () => {
    const hash = createHash('sha256').update(canonicalJson(content())).digest('hex');
    expect(index.hash).toBe(hash);
    expect(index.hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('word ranges are continuous across every page boundary', () => {
    let expectedNext = 1;
    let total = 0;
    for (const page of index.pages) {
      expect(page.page).toBeGreaterThanOrEqual(1);
      expect(page.page).toBeLessThanOrEqual(REFERENCE_PAGE_COUNT);
      for (const line of page.lines) {
        if (line.type !== 'ayah' || !line.wordRange) {
          continue;
        }
        expect(line.wordRange.first).toBe(expectedNext);
        expect(line.wordRange.last).toBeGreaterThanOrEqual(line.wordRange.first);
        expectedNext = line.wordRange.last + 1;
        total += line.wordRange.last - line.wordRange.first + 1;
      }
    }
    expect(total).toBeGreaterThanOrEqual(REFERENCE_AYAH_COUNT);
  });

  it('contains no ayah text or glyph data, only the 114 surah names', () => {
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

  it('every ayah range endpoint refers to a valid reference', () => {
    let wordCount = 0;
    for (const page of index.pages) {
      for (const line of page.lines) {
        if (line.type !== 'ayah' || !line.wordRange || !line.ayahRange) {
          continue;
        }
        wordCount += line.wordRange.last - line.wordRange.first + 1;
        const first = line.ayahRange.first;
        const last = line.ayahRange.last;
        expect(first.surah).toBeGreaterThanOrEqual(1);
        expect(first.surah).toBeLessThanOrEqual(MAX_SURAH);
        expect(first.ayah).toBeGreaterThanOrEqual(1);
        expect(last.surah).toBeGreaterThanOrEqual(first.surah);
        expect(isBeforeOrEqual(first, last)).toBe(true);
      }
    }
    expect(wordCount).toBeGreaterThanOrEqual(REFERENCE_AYAH_COUNT);
  });

  it('holds the 30 juz boundaries starting at 1:1 and ending at 114:6', () => {
    expect(index.juzes).toHaveLength(JUZ_COUNT);
    expect(index.juzes[0].first).toEqual({ surah: 1, ayah: 1 });
    expect(index.juzes[JUZ_COUNT - 1].last).toEqual({ surah: 114, ayah: 6 });
  });
});

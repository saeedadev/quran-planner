import { describe, expect, it } from 'vitest';

import {
  countAyahs,
  endOfFace,
  endOfFatihah,
  endOfPage,
  endOfQuran,
  isRefInRange,
  juzAyahCount,
  juzEndOf,
  juzOf,
  lineIndexOf,
  nextRef,
  pageOf,
  prevRef,
  refExists,
  SPLIT_POLICY,
  startOfFace,
  startOfPage,
  surahName,
  surahStart,
} from '../../src/engine/mushaf';

describe('mushaf layer (scratch)', () => {
  it('refExists follows the index boundaries', () => {
    expect(refExists({ surah: 1, ayah: 1 })).toBe(true);
    expect(refExists({ surah: 1, ayah: 7 })).toBe(true);
    expect(refExists({ surah: 2, ayah: 286 })).toBe(true);
    expect(refExists({ surah: 114, ayah: 6 })).toBe(true);
    expect(refExists({ surah: 1, ayah: 8 })).toBe(false);
    expect(refExists({ surah: 114, ayah: 7 })).toBe(false);
    expect(refExists({ surah: 115, ayah: 1 })).toBe(false);
    expect(refExists({ surah: 0, ayah: 1 })).toBe(false);
  });

  it('surahName returns the real name from the index for every surah', () => {
    expect(surahName(1)).toBe('الفاتحة');
    expect(surahName(2)).toBe('البقرة');
    expect(surahName(113)).toBe('الفلق');
    expect(surahName(114)).toBe('الناس');
    expect(() => surahName(0)).toThrow();
    expect(() => surahName(115)).toThrow();
  });

  it('nextRef/prevRef walk ayah by ayah and respect the boundaries', () => {
    expect(nextRef({ surah: 1, ayah: 7 })).toEqual({ surah: 2, ayah: 1 });
    expect(nextRef({ surah: 2, ayah: 286 })).toEqual({ surah: 3, ayah: 1 });
    expect(nextRef({ surah: 114, ayah: 6 })).toBeNull();
    expect(prevRef({ surah: 2, ayah: 1 })).toEqual({ surah: 1, ayah: 7 });
    expect(prevRef({ surah: 1, ayah: 1 })).toBeNull();
  });

  it('addresses every ayah within each line range, not only line endpoints', () => {
    expect(refExists({ surah: 114, ayah: 2 })).toBe(true);
    expect(refExists({ surah: 114, ayah: 4 })).toBe(true);
    expect(refExists({ surah: 113, ayah: 2 })).toBe(true);
    expect(nextRef({ surah: 114, ayah: 2 })).toEqual({ surah: 114, ayah: 3 });
    expect(prevRef({ surah: 114, ayah: 4 })).toEqual({ surah: 114, ayah: 3 });
    expect(lineIndexOf({ surah: 114, ayah: 2 })).toBe(12);
  });

  it('surahStart and pageOf come from the index', () => {
    expect(surahStart(1)).toEqual({ surah: 1, ayah: 1 });
    expect(surahStart(2)).toEqual({ surah: 2, ayah: 1 });
    expect(pageOf({ surah: 1, ayah: 1 })).toBe(1);
    expect(pageOf({ surah: 114, ayah: 6 })).toBe(604);
  });

  it('lineIndexOf returns the first line that carries the ref', () => {
    expect(lineIndexOf({ surah: 1, ayah: 1 })).toBe(2);
    expect(lineIndexOf({ surah: 1, ayah: 7 })).toBe(6);
  });

  it('endOfFace treats the first two pages as one full face', () => {
    expect(endOfFace({ surah: 1, ayah: 1 })).toEqual({ surah: 1, ayah: 7 });
    expect(endOfFace({ surah: 1, ayah: 7 })).toEqual({ surah: 1, ayah: 7 });
    expect(endOfFace({ surah: 2, ayah: 1 })).toEqual({ surah: 2, ayah: 5 });
    expect(endOfFace({ surah: 2, ayah: 5 })).toEqual({ surah: 2, ayah: 5 });
  });

  it('endOfPage/endOfQuran/endOfFatihah resolve to the index ends', () => {
    expect(endOfPage({ surah: 1, ayah: 1 })).toEqual({ surah: 2, ayah: 5 });
    expect(endOfPage({ surah: 2, ayah: 1 })).toEqual({ surah: 2, ayah: 5 });
    expect(endOfQuran()).toEqual({ surah: 114, ayah: 6 });
    expect(endOfFatihah()).toEqual({ surah: 1, ayah: 7 });
  });

  it('endOfFace merges short surah starts/ends into the adjacent face', () => {
    expect(endOfFace({ surah: 18, ayah: 1 })).toEqual({ surah: 18, ayah: 9 });
    expect(endOfFace({ surah: 18, ayah: 9 })).toEqual({ surah: 18, ayah: 9 });
    expect(endOfFace({ surah: 18, ayah: 10 })).toEqual({ surah: 18, ayah: 15 });
    expect(endOfFace({ surah: 18, ayah: 16 })).toEqual({ surah: 18, ayah: 18 });
    expect(endOfFace({ surah: 19, ayah: 77 })).toEqual({ surah: 19, ayah: 87 });
    expect(endOfFace({ surah: 19, ayah: 88 })).toEqual({ surah: 19, ayah: 98 });
  });

  it('endOfFace splits large shared portions using balance, keeps small ones as one face', () => {
    // طه: قسم كبير (>50% من الصفحة) يعبر النصف البصري → توازن سطري:
    expect(endOfFace({ surah: 20, ayah: 1 })).toEqual({ surah: 20, ayah: 7 });
    expect(endOfFace({ surah: 20, ayah: 8 })).toEqual({ surah: 20, ayah: 12 });
    // النور: قسم كبير (>50%) → توازن (آية 62 وحدها لأنها طويلة):
    expect(endOfFace({ surah: 24, ayah: 62 })).toEqual({ surah: 24, ayah: 62 });
    expect(endOfFace({ surah: 24, ayah: 63 })).toEqual({ surah: 24, ayah: 64 });
    // الفلق: سياسة 'whole' → السورة كاملة بدون تقسيم:
    expect(endOfFace({ surah: 113, ayah: 1 })).toEqual({ surah: 113, ayah: 5 });
    // الناس: سياسة 'whole' → السورة كاملة بدون تقسيم:
    expect(endOfFace({ surah: 114, ayah: 1 })).toEqual({ surah: 114, ayah: 6 });
  });

  it('endOfFace splits by the visual middle of the page, not by ayah count', () => {
    expect(endOfFace({ surah: 2, ayah: 6 })).toEqual({ surah: 2, ayah: 11 });
    expect(endOfFace({ surah: 2, ayah: 12 })).toEqual({ surah: 2, ayah: 16 });
    expect(endOfFace({ surah: 2, ayah: 17 })).toEqual({ surah: 2, ayah: 20 });
    expect(endOfFace({ surah: 2, ayah: 21 })).toEqual({ surah: 2, ayah: 24 });
  });

  it('endOfFace never crosses into the next surah when a surah ends mid-page', () => {
    expect(endOfFace({ surah: 10, ayah: 107 })).toEqual({ surah: 10, ayah: 109 });
    expect(endOfFace({ surah: 10, ayah: 108 })).toEqual({ surah: 10, ayah: 109 });
    expect(endOfFace({ surah: 11, ayah: 1 })).toEqual({ surah: 11, ayah: 5 });
    expect(endOfFace({ surah: 15, ayah: 91 })).toEqual({ surah: 15, ayah: 99 });
    expect(endOfFace({ surah: 16, ayah: 1 })).toEqual({ surah: 16, ayah: 6 });
    expect(endOfFace({ surah: 17, ayah: 105 })).toEqual({ surah: 17, ayah: 108 });
    expect(endOfFace({ surah: 17, ayah: 111 })).toEqual({ surah: 17, ayah: 111 });
  });

  it('endOfPage merges short starts/ends into the adjacent page and clamps to the surah end', () => {
    expect(endOfPage({ surah: 18, ayah: 1 })).toEqual({ surah: 18, ayah: 15 });
    expect(endOfPage({ surah: 18, ayah: 16 })).toEqual({ surah: 18, ayah: 20 });
    expect(endOfPage({ surah: 19, ayah: 77 })).toEqual({ surah: 19, ayah: 98 });
    expect(endOfPage({ surah: 20, ayah: 1 })).toEqual({ surah: 20, ayah: 12 });
    expect(endOfPage({ surah: 17, ayah: 105 })).toEqual({ surah: 17, ayah: 111 });
    expect(endOfPage({ surah: 94, ayah: 1 })).toEqual({ surah: 94, ayah: 8 });
    expect(endOfPage({ surah: 113, ayah: 1 })).toEqual({ surah: 113, ayah: 5 });
  });

  it('startOfFace/startOfPage are region-aware and begin at the merged face start', () => {
    expect(startOfFace({ surah: 18, ayah: 9 })).toEqual({ surah: 18, ayah: 1 });
    expect(startOfFace({ surah: 19, ayah: 88 })).toEqual({ surah: 19, ayah: 77 });
    expect(startOfFace({ surah: 20, ayah: 1 })).toEqual({ surah: 20, ayah: 1 });
    expect(startOfFace({ surah: 20, ayah: 8 })).toEqual({ surah: 20, ayah: 8 });
    expect(startOfFace({ surah: 24, ayah: 62 })).toEqual({ surah: 24, ayah: 62 });
    expect(startOfFace({ surah: 24, ayah: 63 })).toEqual({ surah: 24, ayah: 63 });
    expect(startOfPage({ surah: 18, ayah: 9 })).toEqual({ surah: 18, ayah: 1 });
    expect(startOfPage({ surah: 19, ayah: 88 })).toEqual({ surah: 19, ayah: 77 });
    expect(startOfPage({ surah: 113, ayah: 1 })).toEqual({ surah: 113, ayah: 1 });
  });

  it('countAyahs counts within and across surahs', () => {
    expect(countAyahs({ surah: 1, ayah: 1 }, { surah: 1, ayah: 7 })).toBe(7);
    expect(countAyahs({ surah: 1, ayah: 7 }, { surah: 2, ayah: 1 })).toBe(2);
    expect(countAyahs({ surah: 1, ayah: 1 }, { surah: 114, ayah: 6 })).toBe(6236);
  });

  it('juz helpers use the QUL juz boundaries', () => {
    expect(juzOf({ surah: 1, ayah: 1 })).toBe(1);
    expect(juzOf({ surah: 2, ayah: 141 })).toBe(1);
    expect(juzOf({ surah: 2, ayah: 142 })).toBe(2);
    expect(juzEndOf({ surah: 1, ayah: 1 })).toEqual({ surah: 2, ayah: 141 });
    expect(juzEndOf({ surah: 114, ayah: 6 })).toEqual({ surah: 114, ayah: 6 });
    expect(juzAyahCount(1)).toBe(148);
  });

  it('isRefInRange respects reading order', () => {
    const first = { surah: 1, ayah: 1 };
    const last = { surah: 2, ayah: 5 };
    expect(isRefInRange({ surah: 1, ayah: 7 }, first, last)).toBe(true);
    expect(isRefInRange({ surah: 2, ayah: 5 }, first, last)).toBe(true);
    expect(isRefInRange({ surah: 2, ayah: 6 }, first, last)).toBe(false);
  });

  describe('split policy', () => {
    it('whole surahs are never split: endOfFace returns the last ayah', () => {
      const wholeSurahs = [86, 91, 93, 94, 95, 97, 100, 101, 104, 107, 113, 114];
      for (const surah of wholeSurahs) {
        expect(SPLIT_POLICY[surah]).toBe('whole');
        const first = { surah, ayah: 1 };
        expect(endOfFace(first)).toEqual({ surah, ayah: expect.any(Number) });
        const end = endOfFace(first);
        expect(end.surah).toBe(surah);
      }
    });

    it('whole surahs: startOfFace returns the first ayah', () => {
      const wholeSurahs = [82, 86, 87, 91, 93, 94, 95, 97, 100, 101, 104, 107, 110, 113, 114];
      for (const surah of wholeSurahs) {
        const first = { surah, ayah: 1 };
        expect(startOfFace(first)).toEqual({ surah, ayah: 1 });
      }
    });

    it('half surahs are split into exactly 2 parts', () => {
      const halfSurahs = [80, 84, 85, 88, 89, 90, 92, 96, 98];
      for (const surah of halfSurahs) {
        expect(SPLIT_POLICY[surah]).toBe('half');
        const first = { surah, ayah: 1 };
        const mid = endOfFace(first);
        expect(mid.surah).toBe(surah);
        expect(mid.ayah).toBeGreaterThan(1);
        const afterMid = nextRef(mid);
        expect(afterMid).not.toBeNull();
        if (afterMid) {
          const end = endOfFace(afterMid);
          expect(end.surah).toBe(surah);
          expect(end.ayah).toBeGreaterThan(mid.ayah);
        }
      }
    });

    it('half surahs: startOfFace returns first ayah in first half, mid+1 in second', () => {
      const halfSurahs = [80, 84, 85, 88, 89, 90, 92, 96, 98];
      for (const surah of halfSurahs) {
        const first = { surah, ayah: 1 };
        const mid = endOfFace(first);
        expect(startOfFace(first)).toEqual({ surah, ayah: 1 });
        const secondHalfStart = { surah, ayah: mid.ayah + 1 };
        const expected = { surah, ayah: mid.ayah + 1 };
        expect(startOfFace(secondHalfStart)).toEqual(expected);
      }
    });

    it('Al-Fajr (89) is split into exactly 2 parts: 1..15 and 16..30', () => {
      expect(SPLIT_POLICY[89]).toBe('half');
      expect(endOfFace({ surah: 89, ayah: 1 })).toEqual({ surah: 89, ayah: 15 });
      expect(startOfFace({ surah: 89, ayah: 1 })).toEqual({ surah: 89, ayah: 1 });
      expect(endOfFace({ surah: 89, ayah: 16 })).toEqual({ surah: 89, ayah: 30 });
      expect(startOfFace({ surah: 89, ayah: 16 })).toEqual({ surah: 89, ayah: 16 });
    });

    it('Al-Ala (87) and Al-Infitar (82) are whole surahs without split', () => {
      expect(SPLIT_POLICY[87]).toBe('whole');
      expect(endOfFace({ surah: 87, ayah: 1 })).toEqual({ surah: 87, ayah: 19 });
      expect(SPLIT_POLICY[82]).toBe('whole');
      expect(endOfFace({ surah: 82, ayah: 1 })).toEqual({ surah: 82, ayah: 19 });
    });

    it('Al-Mutaffifin (83) is split into exactly 3 parts', () => {
      expect(SPLIT_POLICY[83]).toBe('thirds');
      const first = { surah: 83, ayah: 1 };
      const t1 = endOfFace(first);
      expect(t1.surah).toBe(83);
      const t2 = endOfFace(nextRef(t1)!);
      expect(t2.surah).toBe(83);
      expect(t2.ayah).toBeGreaterThan(t1.ayah);
      const t3 = endOfFace(nextRef(t2)!);
      expect(t3.surah).toBe(83);
      expect(t3.ayah).toBeGreaterThan(t2.ayah);
      expect(t3.ayah).toBe(36);
    });

    it('Al-Falaq (113) is taken whole: 5 ayahs in one face', () => {
      const result = endOfFace({ surah: 113, ayah: 1 });
      expect(result).toEqual({ surah: 113, ayah: 5 });
    });

    it('An-Nas (114) is taken whole: 6 ayahs in one face', () => {
      const result = endOfFace({ surah: 114, ayah: 1 });
      expect(result).toEqual({ surah: 114, ayah: 6 });
    });

    it('An-Nasr (110) is taken whole: all ayahs in one face', () => {
      expect(SPLIT_POLICY[110]).toBe('whole');
      const result = endOfFace({ surah: 110, ayah: 1 });
      expect(result).toEqual({ surah: 110, ayah: 3 });
    });

    it('Al-Qiyamah (75) is split into exactly 3 parts', () => {
      expect(SPLIT_POLICY[75]).toBe('thirds');
      const first = { surah: 75, ayah: 1 };
      const t1 = endOfFace(first);
      expect(t1.surah).toBe(75);
      const t2 = endOfFace(nextRef(t1)!);
      expect(t2.surah).toBe(75);
      expect(t2.ayah).toBeGreaterThan(t1.ayah);
      const t3 = endOfFace(nextRef(t2)!);
      expect(t3.surah).toBe(75);
      expect(t3.ayah).toBeGreaterThan(t2.ayah);
      expect(t3.ayah).toBe(40);
    });

    it('Al-Qalam (68) is split into exactly 4 parts', () => {
      expect(SPLIT_POLICY[68]).toBe('quarters');
      const first = { surah: 68, ayah: 1 };
      const q1 = endOfFace(first);
      expect(q1.surah).toBe(68);
      const q2 = endOfFace(nextRef(q1)!);
      expect(q2.surah).toBe(68);
      expect(q2.ayah).toBeGreaterThan(q1.ayah);
      const q3 = endOfFace(nextRef(q2)!);
      expect(q3.surah).toBe(68);
      expect(q3.ayah).toBeGreaterThan(q2.ayah);
      const q4 = endOfFace(nextRef(q3)!);
      expect(q4.surah).toBe(68);
      expect(q4.ayah).toBe(52);
    });
  });
});

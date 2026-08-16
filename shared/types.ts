export const MIN_SURAH = 1;
export const MAX_SURAH = 114;
export const MIN_AYAH = 1;
export const MAX_AYAH = 286;
export const MIN_PAGE = 1;
export const MAX_PAGE = 604;
export const REFERENCE_SURAH_COUNT = 114;
export const REFERENCE_AYAH_COUNT = 6236;
export const REFERENCE_PAGE_COUNT = 604;
export const LAYOUT_RESOURCE_ID = 19;
export const SCRIPT_RESOURCE_ID = 47;
export const LAYOUT_NAME = 'KFGQPC V4 (1441H print)';
export const INDEX_FORMAT = 'tawasu-mushaf-index';
export const INDEX_VERSION = 2;
export const JUZ_COUNT = 30;

export const END_OF_QURAN_REF: AyahRef = { surah: 114, ayah: 6 };
export const END_OF_FATIHAH_REF: AyahRef = { surah: 1, ayah: 7 };

export type LineType = 'ayah' | 'surah_name' | 'basmallah';
export type SurahNumber = number;
export type AyahNumber = number;
export type PageNumber = number;
export type WordId = number;

export interface AyahRef {
  readonly surah: SurahNumber;
  readonly ayah: AyahNumber;
}

export interface AyahRange {
  readonly first: AyahRef;
  readonly last: AyahRef;
}

export interface WordRange {
  readonly first: WordId;
  readonly last: WordId;
}

export interface QulLine {
  readonly pageNumber: PageNumber;
  readonly lineNumber: number;
  readonly lineType: LineType;
  readonly isCentered: boolean;
  readonly firstWordId: WordId | null;
  readonly lastWordId: WordId | null;
  readonly surahNumber: SurahNumber | null;
}

export interface QulWord {
  readonly wordIndex: WordId;
  readonly wordKey: string;
  readonly surah: SurahNumber;
  readonly ayah: AyahNumber;
}

export interface MushafLine {
  readonly line: number;
  readonly type: LineType;
  readonly centered: boolean;
  readonly wordRange?: WordRange;
  readonly ayahRange?: AyahRange;
  readonly surah?: SurahNumber;
}

export interface MushafPage {
  readonly page: PageNumber;
  readonly lines: readonly MushafLine[];
}

export interface MushafSurah {
  readonly number: SurahNumber;
  readonly name: string;
}

export interface MushafJuz {
  readonly juz: number;
  readonly first: AyahRef;
  readonly last: AyahRef;
  readonly versesCount: number;
}

export interface MushafIndexSource {
  readonly library: 'QUL';
  readonly layout: string;
  readonly layoutResourceId: number;
  readonly scriptResourceId: number;
  readonly surahNamesSource: 'QUL' | 'quran-metadata';
}

export interface MushafIndex {
  readonly format: typeof INDEX_FORMAT;
  readonly version: typeof INDEX_VERSION;
  readonly source: MushafIndexSource;
  readonly hash: string;
  readonly pages: readonly MushafPage[];
  readonly surahs: readonly MushafSurah[];
  readonly juzes: readonly MushafJuz[];
}

import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import initSqlJs from 'sql.js';

import {
  INDEX_FORMAT,
  INDEX_VERSION,
  LAYOUT_NAME,
  LAYOUT_RESOURCE_ID,
  MAX_PAGE,
  MAX_SURAH,
  MIN_SURAH,
  REFERENCE_PAGE_COUNT,
  REFERENCE_SURAH_COUNT,
  SCRIPT_RESOURCE_ID,
  type AyahRef,
  type MushafIndex,
  type MushafLine,
  type MushafPage,
  type MushafSurah,
  type QulLine,
  type QulWord,
} from '../shared/types';

import {
  QulDataError,
  computeAyahRefs,
  validateAyahContinuity,
  validateIndexShape,
  validateLineWordContinuity,
  validateQulLines,
  validateQulWords,
} from '../shared/validation';

import { canonicalJson } from '../shared/serialization';

export const DATA_DIR = fileURLToPath(new URL('../data/mushaf/', import.meta.url));
export const MANIFEST_FILE = fileURLToPath(new URL('../data/qul-source-manifest.json', import.meta.url));
export const OUT_FILE = fileURLToPath(new URL('../src/data/mushaf-index.json', import.meta.url));

const SQL = await initSqlJs();

interface ManifestMaterial {
  readonly fileName: string;
  readonly sizeBytes: number;
  readonly sha256: string;
}

export interface BuildResult {
  readonly index: MushafIndex;
  readonly lines: readonly QulLine[];
  readonly words: readonly QulWord[];
  readonly refs: readonly AyahRef[];
  readonly maxWord: number;
}

const asInteger = (name: string, value: unknown): number => {
  if (typeof value === 'number' && Number.isInteger(value)) {
    return value;
  }
  if (typeof value === 'string' && /^\d+$/.test(value)) {
    return Number(value);
  }
  throw new QulDataError('word-entry', `word entry field "${name}" must be an integer, got ${String(value)}`);
};

function parseWordEntry(key: string, rawValue: unknown): QulWord {
  if (rawValue === null || typeof rawValue !== 'object') {
    throw new QulDataError('word-entry', `word entry "${key}" is not an object`);
  }
  const entry = rawValue as Record<string, unknown>;
  const wordIndex = asInteger('id', entry.id);
  const surah = asInteger('surah', entry.surah);
  const ayah = asInteger('ayah', entry.ayah);
  const word = asInteger('word', entry.word);
  const location = entry.location;
  if (typeof location !== 'string') {
    throw new QulDataError('word-entry', `word entry "${key}" has a non-string location`);
  }
  const expectedLocation = `${surah}:${ayah}:${word}`;
  if (key !== expectedLocation) {
    throw new QulDataError('word-entry', `word entry key "${key}" does not match "${expectedLocation}"`);
  }
  if (location !== expectedLocation) {
    throw new QulDataError('word-entry', `word entry "${key}" has location "${location}", expected "${expectedLocation}"`);
  }
  return { wordIndex, wordKey: `${surah}:${ayah}`, surah, ayah };
}

export function readWords(): QulWord[] {
  const raw = JSON.parse(readFileSync(`${DATA_DIR}/qpc-v4.json`, 'utf8')) as unknown;
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new QulDataError('words-shape', 'qpc-v4.json must be an object keyed by surah:ayah:word');
  }
  const record = raw as Record<string, unknown>;
  return Object.entries(record)
    .map(([key, value]) => parseWordEntry(key, value))
    .sort((a, b) => a.wordIndex - b.wordIndex);
}

export function readLayoutLines(): QulLine[] {
  const buffer = readFileSync(`${DATA_DIR}/qpc-v4-tajweed-15-lines.db`);
  const db = new SQL.Database(buffer);
  const info = db.exec('SELECT number_of_pages FROM info;');
  const result = db.exec(
    'SELECT page_number, line_number, line_type, is_centered, first_word_id, last_word_id, surah_number FROM pages ORDER BY page_number, line_number;',
  );
  db.close();
  const infoPages = info[0]?.values[0]?.[0];
  if (infoPages !== REFERENCE_PAGE_COUNT) {
    throw new QulDataError('layout-info', `info.number_of_pages is ${String(infoPages)}, expected ${REFERENCE_PAGE_COUNT}`);
  }
  if (!result[0]) {
    throw new QulDataError('layout-empty', 'no rows in the pages table');
  }
  return result[0].values.map((row) => {
    const [pageNumber, lineNumber, lineType, isCentered, firstWordId, lastWordId, surahNumber] = row as [
      number,
      number,
      string,
      number,
      number | string,
      number | string,
      number | string,
    ];
    return {
      pageNumber,
      lineNumber,
      lineType: lineType as QulLine['lineType'],
      isCentered: isCentered === 1,
      firstWordId: firstWordId === '' ? null : (firstWordId as number),
      lastWordId: lastWordId === '' ? null : (lastWordId as number),
      surahNumber: surahNumber === '' ? null : (surahNumber as number),
    };
  });
}

export function readSurahNames(): MushafSurah[] {
  const raw = JSON.parse(readFileSync(`${DATA_DIR}/quran-metadata-surah-name.json`, 'utf8')) as unknown;
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new QulDataError('surah-names-shape', 'surah name file must be an object keyed by surah number');
  }
  const record = raw as Record<string, unknown>;
  if (Object.keys(record).length !== REFERENCE_SURAH_COUNT) {
    throw new QulDataError('surah-names-count', `expected ${REFERENCE_SURAH_COUNT} surah name entries, got ${Object.keys(record).length}`);
  }
  const surahs: MushafSurah[] = [];
  for (let number = MIN_SURAH; number <= MAX_SURAH; number += 1) {
    const entry = record[String(number)];
    if (entry === null || typeof entry !== 'object') {
      throw new QulDataError('surah-name-missing', `surah name entry missing for surah ${number}`);
    }
    const name = (entry as Record<string, unknown>).name_arabic;
    if (typeof name !== 'string' || name.length === 0) {
      throw new QulDataError('surah-name-empty', `surah ${number} has an empty name_arabic`);
    }
    surahs.push({ number, name });
  }
  return surahs;
}

export function verifyInputIntegrity(): void {
  const raw = JSON.parse(readFileSync(MANIFEST_FILE, 'utf8')) as { materials?: ManifestMaterial[] };
  const materials = raw.materials;
  if (!Array.isArray(materials)) {
    throw new QulDataError('manifest-shape', 'manifest is missing a materials array');
  }
  for (const material of materials) {
    const bytes = readFileSync(`${DATA_DIR}/${material.fileName}`);
    if (bytes.length !== material.sizeBytes) {
      throw new QulDataError('manifest-size', `input "${material.fileName}" size ${bytes.length} does not match manifest ${material.sizeBytes}`);
    }
    const actual = createHash('sha256').update(bytes).digest('hex');
    if (actual !== material.sha256) {
      throw new QulDataError('manifest-hash', `input "${material.fileName}" sha256 does not match manifest`);
    }
  }
}

export function buildPages(lines: readonly QulLine[], wordRefs: ReadonlyMap<number, AyahRef>): MushafPage[] {
  const pages: MushafPage[] = [];
  for (let pageNumber = 1; pageNumber <= MAX_PAGE; pageNumber += 1) {
    const pageLines = lines
      .filter((line) => line.pageNumber === pageNumber)
      .sort((a, b) => a.lineNumber - b.lineNumber);
    if (pageLines.length === 0) {
      throw new QulDataError('page-empty', `page ${pageNumber} has no lines`);
    }
    const mushafLines: MushafLine[] = pageLines.map((line) => {
      const common = { line: line.lineNumber, type: line.lineType, centered: line.isCentered };
      switch (line.lineType) {
        case 'ayah': {
          const first = line.firstWordId;
          const last = line.lastWordId;
          if (first === null || last === null) {
            throw new QulDataError('word-range-missing', `page ${pageNumber} line ${line.lineNumber}: ayah line without a word range`);
          }
          const firstRef = wordRefs.get(first);
          const lastRef = wordRefs.get(last);
          if (firstRef === undefined || lastRef === undefined) {
            throw new QulDataError('word-ref-missing', `page ${pageNumber} line ${line.lineNumber}: no surah:ayah ref for word ${first} or ${last}`);
          }
          return { ...common, wordRange: { first, last }, ayahRange: { first: firstRef, last: lastRef } };
        }
        case 'surah_name': {
          const surah = line.surahNumber;
          if (surah === null) {
            throw new QulDataError('surah-number-missing', `page ${pageNumber} line ${line.lineNumber}: surah_name line without surah number`);
          }
          return { ...common, surah };
        }
        case 'basmallah':
          return common;
      }
    });
    pages.push({ page: pageNumber, lines: mushafLines });
  }
  return pages;
}

export function buildIndexData(): BuildResult {
  verifyInputIntegrity();
  const lines = readLayoutLines();
  validateQulLines(lines);
  const maxWord = validateLineWordContinuity(lines);
  const words = readWords();
  validateQulWords(words);
  if (maxWord !== words.length) {
    throw new QulDataError('layout-words-mismatch', `layout covers words 1..${maxWord} but the script file has ${words.length} words`);
  }
  const refs = computeAyahRefs(words);
  validateAyahContinuity(refs);

  const wordRefs = new Map<number, AyahRef>();
  for (const word of words) {
    wordRefs.set(word.wordIndex, { surah: word.surah, ayah: word.ayah });
  }

  const pages = buildPages(lines, wordRefs);
  const surahs = readSurahNames();

  const content = {
    format: INDEX_FORMAT as typeof INDEX_FORMAT,
    version: INDEX_VERSION as typeof INDEX_VERSION,
    source: {
      library: 'QUL' as const,
      layout: LAYOUT_NAME,
      layoutResourceId: LAYOUT_RESOURCE_ID,
      scriptResourceId: SCRIPT_RESOURCE_ID,
      surahNamesSource: 'quran-metadata' as const,
    },
    pages,
    surahs,
  };

  const hash = createHash('sha256').update(canonicalJson(content)).digest('hex');
  const index: MushafIndex = { ...content, hash };
  validateIndexShape(index);

  return { index, lines, words, refs, maxWord };
}

function main(): void {
  const { index, lines, words, refs, maxWord } = buildIndexData();
  mkdirSync(dirname(OUT_FILE), { recursive: true });
  writeFileSync(OUT_FILE, canonicalJson(index), 'utf8');

  const ayahLines = lines.filter((line) => line.lineType === 'ayah').length;
  console.log(`layout: ${index.pages.length} pages, ${lines.length} lines (${ayahLines} ayah lines)`);
  console.log(`words: ${words.length} (1..${maxWord})`);
  console.log(`ayahs: ${refs.length} across ${new Set(refs.map((ref) => ref.surah)).size} surahs`);
  console.log(`index written to ${OUT_FILE}`);
  console.log(`hash: ${index.hash}`);
}

const isEntryPoint = process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isEntryPoint) {
  main();
}

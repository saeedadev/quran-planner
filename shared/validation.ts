import {
  MAX_AYAH,
  MAX_PAGE,
  MAX_SURAH,
  MIN_AYAH,
  MIN_PAGE,
  MIN_SURAH,
  REFERENCE_AYAH_COUNT,
  REFERENCE_PAGE_COUNT,
  REFERENCE_SURAH_COUNT,
  INDEX_FORMAT,
  INDEX_VERSION,
  type AyahRef,
  type LineType,
  type MushafIndex,
  type MushafLine,
  type PageNumber,
  type QulLine,
  type QulWord,
  type WordId,
} from './types';

export class QulDataError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = 'QulDataError';
    this.code = code;
  }
}

const fail = (code: string, message: string): never => {
  throw new QulDataError(code, message);
};

const isLineType = (value: unknown): value is LineType =>
  value === 'ayah' || value === 'surah_name' || value === 'basmallah';

export function formatAyahRef(ref: AyahRef): string {
  return `${ref.surah}:${ref.ayah}`;
}

export function validateQulLines(lines: readonly QulLine[]): void {
  if (lines.length === 0) {
    fail('empty', 'layout lines data is empty');
  }
  const byPage = new Map<PageNumber, QulLine[]>();
  for (const line of lines) {
    if (line.pageNumber < MIN_PAGE || line.pageNumber > MAX_PAGE) {
      fail('page-number', `line refers to out-of-range page ${line.pageNumber}`);
    }
    const group = byPage.get(line.pageNumber);
    if (group) {
      group.push(line);
    } else {
      byPage.set(line.pageNumber, [line]);
    }
  }
  if (byPage.size !== REFERENCE_PAGE_COUNT) {
    fail('page-count', `expected ${REFERENCE_PAGE_COUNT} pages, got ${byPage.size}`);
  }
  for (let page = MIN_PAGE; page <= MAX_PAGE; page += 1) {
    if (!byPage.has(page)) {
      fail('page-missing', `page ${page} has no lines`);
    }
  }
  for (const [page, group] of byPage) {
    const sorted = [...group].sort((a, b) => a.lineNumber - b.lineNumber);
    sorted.forEach((line, position) => {
      if (line.lineNumber !== position + 1) {
        fail('line-number', `page ${page}: line numbers must be contiguous from 1, found line ${line.lineNumber} at position ${position + 1}`);
      }
    });
    for (const line of sorted) {
      if (!isLineType(line.lineType)) {
        fail('line-type', `page ${page} line ${line.lineNumber}: invalid line_type ${String(line.lineType)}`);
      }
      switch (line.lineType) {
        case 'ayah':
          if (line.firstWordId === null || line.lastWordId === null) {
            fail('word-range-missing', `page ${page} line ${line.lineNumber}: ayah line without a word range`);
          } else {
            if (line.firstWordId > line.lastWordId) {
              fail('word-range-order', `page ${page} line ${line.lineNumber}: first word ${line.firstWordId} is greater than last word ${line.lastWordId}`);
            }
            if (line.surahNumber !== null) {
              fail('surah-on-ayah', `page ${page} line ${line.lineNumber}: ayah line must not carry surah_number`);
            }
          }
          break;
        case 'surah_name':
          if (line.firstWordId !== null || line.lastWordId !== null) {
            fail('words-on-surah-name', `page ${page} line ${line.lineNumber}: surah_name line must not carry a word range`);
          }
          if (line.surahNumber === null || line.surahNumber < MIN_SURAH || line.surahNumber > MAX_SURAH) {
            fail('surah-number', `page ${page} line ${line.lineNumber}: surah_name line with invalid surah_number`);
          }
          break;
        case 'basmallah':
          if (line.firstWordId !== null || line.lastWordId !== null) {
            fail('words-on-basmallah', `page ${page} line ${line.lineNumber}: basmallah line must not carry a word range`);
          }
          if (line.surahNumber !== null) {
            fail('surah-on-basmallah', `page ${page} line ${line.lineNumber}: basmallah line must not carry surah_number`);
          }
          break;
      }
    }
  }
}

export function validateLineWordContinuity(lines: readonly QulLine[]): number {
  const ayahLines = lines
    .filter((line) => line.lineType === 'ayah')
    .sort((a, b) => a.pageNumber - b.pageNumber || a.lineNumber - b.lineNumber);
  if (ayahLines.length === 0) {
    fail('no-ayah-lines', 'no ayah lines found in the layout data');
  }
  let previousLast: WordId | null = null;
  let maxWord: WordId = 0;
  for (const line of ayahLines) {
    const first = line.firstWordId;
    const last = line.lastWordId;
    if (first === null || last === null) {
      fail('word-range-missing', `page ${line.pageNumber} line ${line.lineNumber}: ayah line without a word range`);
    } else {
      if (previousLast === null) {
        if (first !== 1) {
          fail('word-start', `the first ayah line starts at word ${first}, expected 1`);
        }
      } else if (first !== previousLast + 1) {
        fail('word-gap', `page ${line.pageNumber} line ${line.lineNumber}: word range starts at ${first}, expected ${previousLast + 1}`);
      }
      if (last > maxWord) {
        maxWord = last;
      }
      previousLast = last;
    }
  }
  return maxWord;
}

export function validateQulWords(words: readonly QulWord[]): void {
  if (words.length === 0) {
    fail('empty', 'words data is empty');
  }
  words.forEach((word, position) => {
    const expectedIndex = position + 1;
    if (word.wordIndex !== expectedIndex) {
      fail('word-index', `word_index must be contiguous from 1, expected ${expectedIndex}, got ${word.wordIndex}`);
    }
    if (word.surah < MIN_SURAH || word.surah > MAX_SURAH) {
      fail('surah-number', `word ${word.wordIndex}: surah ${word.surah} is out of range`);
    }
    if (word.ayah < MIN_AYAH || word.ayah > MAX_AYAH) {
      fail('ayah-number', `word ${word.wordIndex}: ayah ${word.ayah} is out of range`);
    }
    const expectedKey = `${word.surah}:${word.ayah}`;
    if (word.wordKey !== expectedKey) {
      fail('word-key', `word ${word.wordIndex}: word_key "${word.wordKey}" does not match ${expectedKey}`);
    }
  });
}

export function computeAyahRefs(words: readonly QulWord[]): AyahRef[] {
  const refs: AyahRef[] = [];
  const seen = new Set<string>();
  for (const word of words) {
    const key = `${word.surah}:${word.ayah}`;
    if (!seen.has(key)) {
      seen.add(key);
      refs.push({ surah: word.surah, ayah: word.ayah });
    }
  }
  return refs;
}

export function validateAyahContinuity(refs: readonly AyahRef[]): void {
  const bySurah = new Map<number, number[]>();
  for (const ref of refs) {
    const list = bySurah.get(ref.surah);
    if (list) {
      list.push(ref.ayah);
    } else {
      bySurah.set(ref.surah, [ref.ayah]);
    }
  }
  if (bySurah.size !== REFERENCE_SURAH_COUNT) {
    fail('surah-count', `expected ${REFERENCE_SURAH_COUNT} surahs, got ${bySurah.size}`);
  }
  for (let surah = MIN_SURAH; surah <= MAX_SURAH; surah += 1) {
    const ayahs = bySurah.get(surah);
    if (!ayahs) {
      fail('surah-missing', `surah ${surah} has no ayahs`);
    } else {
      const sorted = [...ayahs].sort((a, b) => a - b);
      sorted.forEach((ayah, position) => {
        if (ayah !== position + 1) {
          fail('ayah-continuity', `surah ${surah}: ayahs must be contiguous from 1, found ayah ${ayah} at position ${position + 1}`);
        }
      });
    }
  }
  if (refs.length !== REFERENCE_AYAH_COUNT) {
    fail('ayah-count', `expected ${REFERENCE_AYAH_COUNT} ayahs, got ${refs.length}`);
  }
}

export function validateIndexShape(index: MushafIndex): void {
  if (index.format !== INDEX_FORMAT) {
    fail('format', `index format is "${index.format}", expected "${INDEX_FORMAT}"`);
  }
  if (index.version !== INDEX_VERSION) {
    fail('version', `index version is ${index.version}, expected ${INDEX_VERSION}`);
  }
  if (typeof index.hash !== 'string' || index.hash.length === 0) {
    fail('hash', 'index is missing its hash');
  }
  if (index.pages.length !== REFERENCE_PAGE_COUNT) {
    fail('page-count', `expected ${REFERENCE_PAGE_COUNT} pages, got ${index.pages.length}`);
  }
  index.pages.forEach((page, position) => {
    if (page.page !== position + 1) {
      fail('page-number', `pages must be numbered contiguously from 1, found page ${page.page} at position ${position + 1}`);
    }
    if (page.lines.length === 0) {
      fail('page-lines', `page ${page.page} has no lines`);
    }
    page.lines.forEach((line, linePosition) => {
      validateIndexLine(page.page, line, linePosition);
    });
  });
  if (index.surahs.length !== REFERENCE_SURAH_COUNT) {
    fail('surah-count', `expected ${REFERENCE_SURAH_COUNT} surahs, got ${index.surahs.length}`);
  }
  index.surahs.forEach((surah, position) => {
    if (surah.number !== position + 1) {
      fail('surah-number', `surahs must be numbered contiguously from 1, found surah ${surah.number} at position ${position + 1}`);
    }
    if (typeof surah.name !== 'string' || surah.name.length === 0) {
      fail('surah-name', `surah ${surah.number} has an empty name`);
    }
  });
}

function validateIndexLine(page: PageNumber, line: MushafLine, position: number): void {
  if (line.line !== position + 1) {
    fail('line-number', `page ${page}: line numbers must be contiguous from 1, found line ${line.line} at position ${position + 1}`);
  }
  if (!isLineType(line.type)) {
    fail('line-type', `page ${page} line ${line.line}: invalid type ${String(line.type)}`);
  }
  switch (line.type) {
    case 'ayah':
      if (!line.wordRange || line.wordRange.first > line.wordRange.last) {
        fail('word-range', `page ${page} line ${line.line}: ayah line without a valid word range`);
      } else {
        if (!line.ayahRange) {
          fail('ayah-range', `page ${page} line ${line.line}: ayah line without an ayah range`);
        } else {
          if (line.ayahRange.first.surah < MIN_SURAH || line.ayahRange.last.surah > MAX_SURAH) {
            fail('ayah-ref', `page ${page} line ${line.line}: ayah range refers to an out-of-range surah`);
          }
        }
        if (line.surah !== undefined) {
          fail('surah-on-ayah', `page ${page} line ${line.line}: ayah line must not carry a surah number`);
        }
      }
      break;
    case 'surah_name':
      if (line.wordRange !== undefined || line.ayahRange !== undefined) {
        fail('words-on-surah-name', `page ${page} line ${line.line}: surah_name line must not carry word or ayah ranges`);
      }
      if (line.surah === undefined || line.surah < MIN_SURAH || line.surah > MAX_SURAH) {
        fail('surah-number', `page ${page} line ${line.line}: surah_name line without a valid surah number`);
      }
      break;
    case 'basmallah':
      if (line.wordRange !== undefined || line.ayahRange !== undefined || line.surah !== undefined) {
        fail('words-on-basmallah', `page ${page} line ${line.line}: basmallah line must not carry word range, ayah range, or surah number`);
      }
      break;
  }
}

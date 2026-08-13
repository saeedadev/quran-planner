---
name: quran-data-safety
description: Use this skill whenever the task involves Quranic text, Madinah Mushaf layout data, verse numbering, surah/juz/hizb/page structure, or any Islamic religious content that must be accurate and sourced only from approved data.
license: MIT
compatibility: opencode
---

# Quran Data Safety

## Goal
Handle Quranic and Mushaf data with zero tolerance for guessing or unverified sources.

## Rules
- Only use Quranic text, verse numbers, page numbers, juz, hizb, or ruku data from files explicitly provided inside this project (for example a local JSON/SQLite/CSV dataset named by the user as the Madinah Mushaf source).
- Never generate, autocomplete, or "fill in" Quranic text, verse boundaries, or Mushaf page/line layout from memory or general knowledge.
- If the required data is missing from the project's approved source, stop and tell the user exactly what is missing instead of guessing.
- Do not merge or cross-reference multiple Quran data sources unless the user explicitly instructs it.
- If two sources conflict (e.g. verse numbering differs), stop and ask the user which one is authoritative instead of picking one automatically.
- Preserve Arabic diacritics (tashkeel) exactly as they appear in the source file — do not "clean up," reformat, or normalize Arabic text unless asked.
- Any feature that displays Quranic text must trace back to a named, identifiable data file in the project (e.g. `data/madinah-mushaf.json`).
- When writing code that touches Quran data, add a comment noting the source file used.

## Before finishing any task involving Quran data
1. Confirm which file/table was used as the source.
2. Confirm no text was invented or altered.
3. Confirm missing/uncertain data was flagged to the user, not silently filled in.

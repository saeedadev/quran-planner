---
name: debugging
description: Use this skill whenever an error, bug, crash, unexpected behavior, or broken feature occurs and needs to be diagnosed and fixed.
license: MIT
compatibility: opencode
---

# Debugging

## Goal
Fix problems by finding the real cause, not by guessing or making random changes.

## Workflow
1. Reproduce the problem first — identify exactly what action triggers it.
2. Read the full error message / stack trace / console log before changing anything.
3. Narrow down the smallest piece of code where the problem happens.
4. Form 1-3 possible causes, and check each one before editing code.
5. Fix the root cause — not just the symptom.
6. After fixing, re-test the original broken scenario AND nearby features that share the same code, to make sure nothing else broke.
7. Explain the cause and the fix in simple, non-technical language.

## Rules
- Never say "should be fixed now" without actually re-checking the reproduction steps.
- Never silently swallow errors (e.g. empty catch blocks) — always show or log something meaningful.
- If the bug involves external/third-party data (including Quran data), verify the data itself before assuming the code is wrong.
- If unsure of the cause, say so clearly and propose how to investigate further, instead of guessing a fix.

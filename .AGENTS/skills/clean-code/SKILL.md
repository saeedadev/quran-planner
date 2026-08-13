---
name: clean-code
description: Use this skill when writing, reviewing, or refactoring application code to keep it readable, correct, well-organized, and low in bugs.
license: MIT
compatibility: opencode
---

# Clean Code

## Goal
Write code that is easy to read, easy to change later, and has as few bugs as possible — appropriate for a non-technical founder who relies on AI to maintain the codebase.

## Rules
- Use clear, descriptive names for files, variables, functions, and components — avoid vague names like `data2`, `temp`, `handleStuff`.
- Keep functions and components small and focused on one responsibility.
- Avoid duplicating logic — extract shared code into a reusable function/component when the same logic appears more than twice.
- Always handle edge cases: empty data, loading state, error state, missing/undefined values.
- Use TypeScript types/interfaces consistently if the project uses TypeScript — avoid `any` unless unavoidable.
- Keep related files organized (e.g. components, hooks, data, styles in clearly named folders).
- Do not leave commented-out code, unused variables, or vague `// TODO` notes without explanation.
- When changing a function or component, update every place that uses it — don't leave partial changes.

## Before marking any coding task done
1. Re-read the changed code once for typos, unused imports, and unclosed tags/brackets.
2. Confirm loading, empty, and error states are handled.
3. Confirm the change didn't break other parts of the app that use the same function/component.
4. Explain briefly, in plain language, what was changed and why.

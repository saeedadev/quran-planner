---
name: responsive-web-app
description: Use this skill when building or editing web app UI that must work well on mobile, tablet, and desktop screens, and that may later be packaged into a mobile app.
license: MIT
compatibility: opencode
---

# Responsive Web App

## Goal
Build UI that works cleanly from 320px phone screens up to large desktop screens, with an architecture that stays easy to convert into a mobile app later (PWA or Capacitor-style wrapping).

## Rules
- Design mobile-first: build the small-screen layout first, then expand with responsive breakpoints (e.g. 640px, 768px, 1024px, 1280px).
- Use flexible layout systems (CSS Grid, Flexbox, fluid widths) instead of fixed pixel widths.
- Touch targets (buttons, links, icons) must be at least 44x44px.
- Navigation must adapt: turn into a bottom bar or hamburger menu on small screens if there are more than 4-5 nav items.
- Avoid layouts that only make sense on a wide desktop screen (e.g. multi-column tables) without a mobile fallback (stacked cards, horizontal scroll).
- Keep UI components reusable and self-contained so they aren't tied to one specific screen size or page.
- Avoid browser-only APIs when a mobile-app-compatible alternative exists, since this app may later run inside a native wrapper.
- Test every new page/component mentally (or literally) at 375px, 768px, and 1280px widths before considering it done.

## Checklist before finishing a UI task
- [ ] Works at 375px without horizontal scrolling or overlapping elements
- [ ] Works at tablet width (768px)
- [ ] Works at desktop width (1280px+)
- [ ] Buttons/links are easily tappable on a phone
- [ ] No fixed-width containers that break on small screens

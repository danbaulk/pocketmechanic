# PocketMechanic

A local-first web app that makes car ownership less stressful by giving clear visibility into
how worn each part of your car is. Breakdowns rarely happen "for no reason" — usually it's an
old part that was on its way out for a while. PocketMechanic makes each part's remaining life
legible with a green / amber / red signal, so you can see what's ageing before it strands you.

Single-user, no backend, no accounts — all data lives in your browser's `localStorage`.

## Features (Phase 1)

- **Garage** — add your car (make, model, year, reg) and its mileage.
- **Parts by area** — parts are grouped by where they live on the car (engine bay, front wheels,
  rear wheels, underside, windscreen), ready for a visual car diagram in a later phase.
- **Health signal (RAG)** — each part is green, amber (last ~10% of life), or red (due) based on
  a built-in reference table of typical replacement intervals, by mileage and/or age (whichever
  is closest to end-of-life).
- **Mileage estimation** — an "electricity-meter" model estimates your current odometer between
  actual readings, which you re-anchor whenever you enter a fresh reading.
- **Replace = reset** — recording that a part was replaced restarts its wear clock.

The full phased roadmap lives in `.docs/PROJECT_PLAN.md`, which is kept local (not committed).

## Tech stack

React 19 · Vite · TypeScript · Tailwind v4 · Vitest

## Getting started

```bash
npm install
npm run dev      # dev server at http://localhost:5173
npm run build    # tsc typecheck + production build
npm run lint     # eslint
npm test         # vitest
```

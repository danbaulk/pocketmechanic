# CLAUDE.md

Guidance for Claude Code when working in this repository.

## What this is

**PocketMechanic** — a local-first web app that makes car ownership less stressful by giving
clear visibility into how worn each part of a car is (green/amber/red). Single-user, no
backend, no accounts; all state lives in `localStorage`. It is a sibling of Dan's other
local-first apps (`pantry`, `gymbuddy`, `aroundtheworld`) and follows the same conventions.

**`.docs/PROJECT_PLAN.md` is the source of truth for scope and phasing** — read it before
starting new feature work. Phase 1 (health readout) is built; Phases 2–4 (car avatar & garage,
service/MOT/repair history, reg lookup & MOT fetch) are planned there.

## Build, test & lint

```bash
npm run dev      # Vite dev server (http://localhost:5173) — mobile-first, check at phone width
npm run build    # tsc -b typecheck + vite build — the main verification gate
npm run lint     # eslint
npm test         # vitest run (one-shot)
npm run test:watch
npx vitest run src/health.test.ts -t "soonest wins"   # a single test by name
```

## Architecture

- **Local-first, single-user.** All state is one typed object (`AppState` in `src/types.ts`)
  persisted to `localStorage` under `pocketmechanic:state`.
- **One state object, immutable updates, via a single context hook.** State flows through a
  pure reducer (`src/reducer.ts`) exposed by `GarageProvider` (`src/store.tsx`) and consumed
  with `useGarage()` (`src/garageContext.ts`). The provider and the context/hook are in
  **separate files** on purpose (so `react-refresh/only-export-components` doesn't fire).
  Components never touch storage directly.
- **Versioned persistence.** `src/storage.ts` owns the schema `version`; `load()` seeds an empty
  state on first run and `normalizeState()` validates/heals a stored blob. Bump the version and
  add a migration step (see the pantry/aroundtheworld step-migrator pattern) when the shape
  changes. Persistence is isolated to this one file.
- **Pure domain logic is framework-free and tested.** `src/health.ts` (mileage estimation, the
  RAG health engine) imports no React and is covered by `src/health.test.ts`. Reducer/storage
  are covered by `src/store.test.ts`.
- **Static reference data** lives in `src/data/` (`partsCatalogue.ts`) — a slug-keyed catalogue
  decoupled from runtime ids, following pantry's data-pack pattern.

## Domain model (key concepts)

- A **Vehicle** has an odometer anchor (`lastReadingMiles` + `lastReadingDate`) and an
  `avgAnnualMiles`. Current mileage is *estimated* between readings ("electricity-meter" model:
  `estimateCurrentMileage`) and re-anchored when the user records an actual reading.
- A **FittedPart** links to a `CataloguePart` by `catalogueId` and has a `fitDate`/`fitMileage`
  (its wear-clock start). Both `null` = fitment not yet recorded → renders as "needs info", no
  RAG computed.
- **Health** (`computePartHealth`) uses the **soonest** of a part's mileage and age clocks
  (whichever is closest to end-of-life). RAG thresholds: `≥1` red, `≥0.9` amber (`AMBER_THRESHOLD`),
  else green. Editing a part's fitment resets its clock (the "replaced it" action).

## Conventions

- British spelling throughout (catalogue, tyres, favourite).
- Match the existing file layout and the sibling apps' idioms rather than introducing new
  patterns. Keep pure logic out of components.
- No em dashes in prose/UI copy — use a normal dash.

# DataBench UI audit

## Stack

| concern | what the repo uses |
| --- | --- |
| framework | React 19 + Vite 6, TypeScript strict |
| styling | Tailwind v4, css-first; tokens on `:root` / `.dark` in `src/index.css` |
| components | hand-rolled `Card`, `Button`, `Meter`, `TypeBadge`, … in `components/primitives.tsx` |
| state | `@tanstack/react-query` for server data; a `SessionProvider` context (open dataset, target, job id) persisted to `sessionStorage`; theme in `localStorage` |
| routing | `react-router-dom` 7, one flat `<Routes>`; every screen renders its own `<Shell>` (so the sidebar remounts on each navigation) |
| api | `src/lib/api.ts`, a thin `fetch` wrapper over the FastAPI service at `/api` (Vite proxies to `:8000` in dev) |
| charts | none — histograms, confusion matrix, importance bars are divs |
| animation | none (only Tailwind `transition` / `animate-spin`) |
| lint / tests | no ESLint config and no frontend tests; `tsc -b` + `vite build`; backend has 48 pytest tests |

## Screens

| route | flow step | reads |
| --- | --- | --- |
| `/` Upload | ingest | `POST /datasets` (multipart) or `/datasets/from-path`, `GET /datasets` |
| `/overview` | ingest result | the upload response (meta, schema, 50-row preview) |
| `/analyse` | profile | `GET /datasets/{id}/profile` |
| `/model` | model config | `GET /datasets/{id}/plan?target=`, `POST /datasets/{id}/train` |
| `/results` | train | `GET /jobs/{id}` polled at 700 ms |

There is no history screen beyond the "Already loaded" list on Upload, no settings screen, and no cleaning step.

## Data shapes the UI can bind to (`src/lib/types.ts`)

- **Loaded** — `meta {rows, columns, memory_mb, read_ms, format}`, `schema: Column[] {name, dtype, kind, reason, modelable}`, `preview {columns, rows[][]}` (50 rows, nulls preserved), `suggested_targets`.
- **Profile** — `rows`, `sampled_rows` (≤ 50k), `duplicate_rows`, `missing_cells_pct`, `column_stats[]` (per kind: missing_pct, unique, unique_pct, min/max/mean/std/median/q1/q3, skew, outliers(_pct), `histogram {counts, edges}` (20 bins), `by_month`, `top_values[]` (8), avg/max length), `correlations[]` — **only pairs with |r| ≥ 0.5, top 25**, `warnings[] {column, level, issue}`.
- **Plan** — `task`, `task_reason`, `features {numeric, categorical, temporal, dropped}`, `target_summary`, `algorithms[] {name, recommended, why}` (already ranked), `notes`.
- **Job / Training** — `state running|done|failed`, `started` (epoch s), `elapsed_ms`; result: `results[] {algorithm, ok, score, metrics, importance[], fit_ms, examples?}`, `score_name`, `best`, `rows_used`, `train_ms`.

What does **not** exist in the api: per-row missingness beyond the 50-row preview, a full correlation matrix, per-epoch training metrics (sklearn fits in one shot), training progress, cancellation, hyperparameters, model export, and any cleaning endpoint. The train endpoint accepts only `target`, `algorithms`, `max_rows`.

## Top 10 UX problems

1. **No overall read on data quality.** Missing %, duplicates, outliers and warnings are scattered; nothing says "is this dataset healthy?"
2. **Upload is a black box.** "Reading…" spinner for the whole request, no upload %, no step feedback, then an abrupt jump to `/overview`.
3. **Overview is two dense tables.** No hierarchy; type mix, missingness and cardinality are only discoverable by reading every row.
4. **No column drill-down.** Column stats live only in `/analyse` cards; the overview table rows are dead.
5. **Correlations are a table** of pairs, not a matrix — patterns across many columns are invisible.
6. **Loading is a lone spinner** and errors are a red strip with no retry; no skeletons, no empty states except "no dataset".
7. **The next step is unclear.** No pipeline indicator; the sidebar has four links with no sense of progress, and there is no clean step at all.
8. **Model setup is a `<select>` and toggle cards.** Features are a static chip list, no sense of the train/test split or row cap, no explanation of ranking.
9. **Training feedback is a spinner.** No elapsed time, no sense of what is running, results appear all at once.
10. **Navigation and accessibility gaps.** Sidebar remounts on every route, no mobile layout (fixed 220 px sidebar), no keyboard shortcuts / command palette, no toasts, `ink-faint` text and several light-theme hues fall below 4.5:1, some meaning is colour-only (correlation sign, confusion cells).

## Plan

1. **Tokens + motion foundation** — contrast-fixed palette, quality palette, type/space/radius/shadow/motion tokens; `src/lib/motion` presets, `MotionProvider` (`LazyMotion` + `MotionConfig reducedMotion="user"`), `PageTransition`, `CountUp`. Persistent layout route so the sidebar stops remounting.
2. **Infographics** in `src/components/viz/`, SVG + motion, bound to the real shapes above: health ring, type donut, missing matrix (preview rows) + per-column bars, column mini-profiles, correlation heatmap (built from the reported pairs), box plot, duplicates/cardinality, model recommendation, training progress/results.
3. **Screens** — upload stepper with real byte progress (XHR on the same endpoint) and profile prefetch; overview hero + infographics + sortable column table; column drawer; a *staged* cleaning recipe (clearly marked: no backend endpoint); model cards/chips/row-cap slider; training progress + staggered results + report download; command palette, toasts, collapsible sidebar, pipeline breadcrumb, shortcuts modal.
4. **Polish** — button/card springs, count-ups, reading progress, memoised chart data, sampled matrices, windowed tables.

Backend, api contracts and data models stay untouched.

---

# What was done

Four commits on top of this audit, one per phase. Backend, api contracts and
`lib/types.ts` are untouched; the 48 backend tests still pass. Dependencies
added: `motion`, `@radix-ui/react-dialog`, `-tooltip`, `-popover` — nothing else.

## Phase 1 — foundation

- **Tokens** (`src/index.css`, `src/lib/tokens.ts`): contrast-fixed greys (both
  now ≥ 4.5:1), `accent-fg` for accent-as-text, a named quality palette
  (`quality-good/warning/critical`), a type scale, radii, elevation and scrim
  tokens, a diverging pair for correlation, a `.skeleton` shimmer.
- **Kind palette re-validated.** numeric/categorical were indistinguishable
  under deuteranopia (ΔE 1.3) and boolean reused the "good" status green. The
  new order — blue / pink / amber / teal — passes the CVD, lightness and
  contrast checks in both themes. Kind *text* stays in ink; the hue lives on
  the icon and border, and every kind has a glyph, so type is never colour-only.
- **Motion** (`src/lib/motion/`): `spring` / `tween` presets, `fadeUp`,
  `fadeIn`, `scaleIn`, `slideIn()`, `stagger()`, `press`, `lift`, `inView`;
  `MotionProvider` (`LazyMotion strict` with `domMax` loaded async +
  `MotionConfig reducedMotion="user"`, plus a CSS reduced-motion guard);
  `PageTransition`; `CountUp` (writes text directly, no re-render per frame,
  screen readers get the final value only).
- **Layout route**: sidebar and top bar now persist across navigation; route
  content animates underneath with `AnimatePresence`.

## Phase 2 — infographics (`src/components/viz/`)

All SVG + motion, all bound to real api data, all with hover tooltips and an
in-view entrance.

| component | binds to |
| --- | --- |
| `HealthRing` | `healthScore(profile)` — completeness 40%, type consistency 20%, uniqueness 20%, outliers 20%; breakdown on hover/focus |
| `TypeDonut` | `schema[].kind`; segments click to filter the column table |
| `MissingMatrixChart` / `MissingBars` | nulls in `preview.rows` (sampled to ≤ 48 columns) / `column_stats[].missing_pct` |
| `HistogramSpark`, `TopNBars`, `TimelineDensity` | `histogram`, `top_values`, `by_month` |
| `BoxPlot` | `q1/median/q3/min/max/mean`, histogram silhouette behind it |
| `CorrelationHeatmap` | `profile.correlations` (crosshair hover, click → inspector) |
| `DuplicatesCard`, `CardinalityCard` | `duplicate_rows`, `unique_pct` |
| `TaskInference`, `ModelCard` | `plan` + data-driven reasons from the profile |
| `ProgressRing`, `ScoreBars`, `MetricTile`, `ImportanceBars`, `ConfusionMatrix`, `FitTimeline` | `job`, `training.results` |

Pure derivations live in `src/lib/insights.ts` so the charts stay dumb.

## Phase 3 — screens

- **Upload**: drop zone with drag feedback and file-type glyphs; real byte
  progress (XHR on the same endpoint) with cancel; stepper Uploading → Reading
  → Detecting types → Profiling → Done, where *Profiling* is a real prefetch of
  the profile; detected-type chips; sample preview slides in; recent datasets
  animate in/out, forget gives a toast.
- **Overview**: health + hero stats with count-ups; type donut, missing
  matrix, most-incomplete bars, duplicates, cardinality; column table with
  sticky header, type glyphs, inline missing bars, sort (aria-sort), filter by
  name or kind, `layout` row animation, quick-action popover (drop / impute /
  cast / encode …), windowing past 120 columns.
- **Column inspector**: right drawer (non-modal, so toasts and undo stay
  reachable) opened from any row, card, chart or the palette; the name morphs
  in via `layoutId`; stats, histogram + box plot, missing pattern, profiler
  flags, suggested fixes with one-click staging, related columns.
- **Clean** (new, `/clean`): staged recipe, projected health before → after
  per component, suggestions ordered by profiler severity, undo on every add
  and remove, export as JSON.
- **Model**: target as radio chips with the inferred task explained; feature
  chips animate as the target changes; dropped features disclosed; training
  row budget slider bound to the api's `max_rows` with a live train/test/unused
  bar; ranked model cards with "why this model", read-only hyperparameters,
  switch-style selection; sticky train bar.
- **Results**: elapsed timer + estimated progress ring + queued models while
  running; completion toast; staggered reveal of leaderboard, fit times, metric
  count-ups, importance bars, cell-by-cell confusion matrix; clustering view
  with validated cluster colours; JSON export and a Markdown report download.
- **Global**: ⌘K / Ctrl+K palette (screens, columns, datasets, models,
  actions), `?` shortcuts dialog, `g`+letter navigation, `[` sidebar, `t`
  theme, collapsible sidebar (persisted), mobile drawer nav, pipeline
  breadcrumb Ingest → Profile → Clean → Model → Train, toasts with undo,
  reading-progress bar, skeleton / empty / error-with-retry states on every
  data screen.

## Phase 4 — polish and performance

- Buttons `whileHover` 1.02 / `whileTap` 0.98 on a spring; cards lift; inputs
  grow a focus ring; one focus-visible outline everywhere else.
- Routes and overlays are code-split; overlays mount on first open. Main chunk
  is 506 kB (167 kB gzip) after the mobile nav moved onto Radix Dialog, down
  from 607 kB before splitting (the pre-upgrade app was 320 kB).
- Charts never draw more than ~2.4k marks (matrix: 50 rows × ≤ 48 columns);
  derived data is memoised; profile cards are `memo`'d; the preview and column
  tables window rows.

## macOS look (follow-up)

- **Materials** (`index.css`): `glass` (content), `glass-chrome` (sidebar,
  toolbar) and `glass-sheet` (dialogs, drawer, toasts, palette, tooltips) —
  translucent fills with `backdrop-filter: blur() saturate()`, so sticky
  chrome frosts the content scrolling beneath it. `prefers-reduced-transparency`
  swaps in solid panels.
- **Plain background**: flat white in light mode, black in dark, switched by
  a Light / Dark segmented control in the sidebar (also `t` and the palette).
  No wallpaper, no gradients, a single blue accent. An earlier pass had
  accent-colour themes and a gradient wallpaper; both were removed on request.
- **Chrome**: floating inset sidebar, frosted sticky toolbar, Spotlight-style
  ⌘K palette, SF Pro / SF Mono on Apple platforms (Inter / JetBrains Mono
  elsewhere).
- **Still colourful**: flat iOS-Settings-style icon tiles give every screen
  and section its own hue (`IconTile`). Green, red and amber are kept out of
  the tiles because they mean good / critical / warning.

## Hyperparameters and code export (follow-up)

- **Editable per model.** The plan now returns each candidate's settings
  (`backend/ads/params.py`): real scikit-learn argument names, defaults that
  match what the backend always used, and bounds. The Model screen renders
  them as sliders / number boxes / segmented choices / switches with inline
  validation and per-field reset; `/train` validates again server-side (400
  with a readable message). The held-out share is a real setting now.
- **Settings used** appear on every result, custom values highlighted, and in
  the downloadable report.
- **Export code.** `GET /api/jobs/{id}/code?algorithm=` returns a standalone
  Python script built from what the job actually used (column blocks,
  resolved parameters, split, row cap, tuned threshold). Tests run every
  exported script and check it reproduces DataBench's score.

## Review fixes

An independent review of the diff found eight defects, all fixed in
`fix(ui): review fixes …`: "Show all" rows staying invisible, fit-time bars
going NaN when a model failed, dialogs dropping focus to `<body>` on close,
a mobile nav with no keyboard support (now a Radix dialog), windowed table
rows jittering during exit animations, a shared `layoutId` between the two
sidebars, palette option ids containing spaces, and drops on the busy drop
zone navigating the browser to the file.

## Mocked, staged or estimated — read before trusting a number

| what | why | where |
| --- | --- | --- |
| **Cleaning recipe** is staged only | no cleaning endpoint; models still train on raw data | `state/cleaning.tsx`, `/clean` says so on screen |
| **Projected health** after cleaning | computed from the profile, not re-profiled data | `projectProfile()` in `lib/insights.ts` |
| **Health score** weights | a UI heuristic, not a backend metric | `healthScore()` |
| **Training progress ring** | api has no progress; ring eases toward an estimate, labelled "est." — elapsed time is real | `ProgressRing`, `Running` in `routes/Results.tsx` |
| **"Why this model" extra reasons** | rules over the profile, beneath the planner's own reason; no score is invented — the bar is the planner's rank | `modelReasons()` |
| **Missing matrix** | first 50 preview rows only — the only per-row data the api returns | `missingMatrix()` |
| **Correlation matrix** | only pairs with \|r\| ≥ 0.5 (top 25); the rest shows as "weak", not zero | `correlationMatrix()` |

Not built, because the data does not exist: live loss/accuracy curves (sklearn
fits in one shot, no epochs), pause/cancel (no endpoint — the screen says a
started job runs to completion), model export (no endpoint; JSON + Markdown
report instead), editable train/test split (fixed 20% in the backend).

## Verified

- `tsc -b`, `vite build`, backend `pytest` (48 passed) after every phase.
- Walked the whole flow in Chrome against the real api with a 3,060-row
  synthetic dataset: upload → overview → analyse → inspector → stage fix →
  undo toast → clean → model → train → results → palette → shortcuts, in both
  themes, at 1440 and 390 px wide.
- Kind palette validated with the dataviz palette checker; text tokens checked
  for ≥ 4.5:1 in both themes.

There is no ESLint config or frontend test runner in the repo, and adding one
was out of scope (dependency rule), so "lint" here is `tsc` strict with
`noUnusedLocals/Parameters`.

## Next steps

1. **Backend**: a cleaning endpoint (apply the exported recipe), progress
   events for training (per-model start/finish), cancel, and a model export —
   each unlocks a UI piece that is staged or estimated today.
2. Return a full correlation matrix (or a lower floor) and a sampled null mask
   so the heatmap and missing matrix are not limited to strong pairs / preview rows.
3. Add Vitest + Testing Library for `lib/insights.ts` (pure, easy to cover)
   and a Playwright smoke run of the flow above.
4. Add ESLint (`react-hooks`) — several effects rely on careful dependency lists.
5. Sidebar collapse animates `width`; switch to a transform-based panel if it
   ever janks on large tables.

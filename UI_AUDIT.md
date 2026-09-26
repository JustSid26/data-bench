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

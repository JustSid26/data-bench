# DataBench backend

Load a dataset, understand it, and run the models that fit it.

```
ingest  ->  schema  ->  profile  ->  recommend  ->  train
read     what each   stats and    which task     fit, score
a file   column is   warnings     and models     and explain
```

## Run

```bash
pip install -r requirements.txt
./run.sh                 # http://127.0.0.1:8000 — serves the api and the built ui
```

Interactive API docs are at `/api/docs`. If `frontend/dist` exists it is served at
`/`, so production is a single origin with no cors round trip.

Or without the API:

```bash
python -m ads.cli data.csv --target churned --train
```

## Endpoints

| method | path | what it gives you |
| --- | --- | --- |
| `POST` | `/api/datasets` | upload a file; answers with meta + schema + preview + suggested targets |
| `POST` | `/api/datasets/from-path` | same, for a file already on the server (no copy) |
| `GET` | `/api/datasets` | everything currently loaded |
| `GET` | `/api/datasets/{id}` | meta + schema |
| `GET` | `/api/datasets/{id}/preview?rows=` | rows for the table view |
| `GET` | `/api/datasets/{id}/profile` | stats, histograms, correlations, warnings |
| `GET` | `/api/datasets/{id}/plan?target=` | task, usable features, ranked algorithms |
| `POST` | `/api/datasets/{id}/train` | starts a job, returns `{job, plan}` |
| `GET` | `/api/jobs/{id}` | `running` / `done` / `failed` plus the leaderboard |
| `DELETE` | `/api/datasets/{id}` | forget it |

Formats: csv, tsv, xlsx, xlsm, xls, parquet, json, jsonl.

## What each module does

- **`ingest.py`** — reads the file with the fastest engine available (pyarrow for
  csv/parquet), repairs duplicate and blank headers, then downcasts numbers and
  folds repeated strings into categories so every later stage is cheaper.
- **`schema.py`** — decides what each column *is*: numeric, categorical, boolean,
  datetime, text, identifier, constant or empty, with a plain-English reason.
  Only the first four are `modelable`.
- **`profile.py`** — the analysis pass: per-column stats and histograms, the
  strongest numeric correlations, and warnings written for a human.
- **`recommend.py`** — reads the schema and picks the task (binary, multiclass,
  regression, clustering), the usable features, and a ranked algorithm list.
  Nothing is fitted here, so the UI can render choices instantly.
- **`train.py`** — builds the preprocessing pipeline, fits every candidate,
  scores them on a holdout and returns a leaderboard with feature importances.
- **`store.py`** — keeps parsed datasets and their computed views in memory so a
  revisit is a dictionary lookup, not a re-read.

## Where the speed comes from

Measured on a 1,000,000 row / 50 MB csv:

| step | time |
| --- | --- |
| read + schema + preview (one request) | 156 ms |
| profile, first call | 28 ms |
| profile, repeat call | 0.8 ms |
| plan | 17 ms |
| train 2 models on 100k rows | 6.2 s (job, polled) |

The techniques:

- **Bounded sampling.** Schema and profile work on a capped random sample
  (20k / 50k rows), so cost is flat in file size. Sampling is random rather than
  strided — a fixed stride aliases against repeating patterns and silently
  collapses the distinct-value counts every decision depends on.
- **One round trip for the first screen.** Upload answers with meta, schema,
  preview and suggested targets together.
- **Cache per dataset.** Schema and profile are computed once and reused.
- **Nothing blocks the event loop.** Every pandas/sklearn call runs in a worker
  thread; training runs on its own pool and is polled by job id.
- **Capped training.** Models see at most 100k rows, scaling is skipped for tree
  models, and importances are read off the fitted model — permutation is the
  fallback and only for the winner.

## Modelling notes

- Identifier, text, constant and empty columns are never used as features, and
  the UI is told why each was dropped.
- Rare categories are folded into one bucket (`min_frequency=1%`, 40 max), so a
  high-cardinality column cannot explode the feature space.
- Date columns become year / month / day / weekday / hour / epoch.
- For binary targets the decision threshold is tuned on a held-back slice of the
  *training* rows, never the holdout. Without this an imbalanced column just
  yields the majority class: on the churn sample this moved balanced accuracy
  from 0.53 to 0.69.
- Feature importances are folded back onto the original column names, so you see
  `city`, not `city_pune` and `city_goa`.

## Tests

```bash
python -m pytest tests -q      # 48 tests
```

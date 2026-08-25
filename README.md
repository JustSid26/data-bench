# DataBench

Drop in a dataset. DataBench works out what every column is, profiles it, decides
which machine learning problem the data actually poses, and runs the algorithms
that fit — then tells you in plain language what it found.

```
ingest  ->  schema  ->  profile  ->  recommend  ->  train
read a     what each   stats and    which task     fit, score
file       column is   warnings     and models     and explain
```

## Run it

```bash
# backend
cd backend
pip install -r requirements.txt
./run.sh                       # http://127.0.0.1:8000

# frontend (only needed to change the ui)
cd frontend
npm install
npm run build                  # backend then serves it at /
npm run dev                    # or hot-reload at :5173, proxying /api to :8000
```

`./run.sh` alone is enough once the ui is built — it serves the API under `/api`
and the bundle at `/`, so there is one origin and no cors round trip.

No UI at all, if you prefer:

```bash
python -m ads.cli data.csv --target churned --train
```

## What it does

**Reads** csv, tsv, excel, parquet, json and jsonl — picking the fastest engine
available, sniffing the delimiter, repairing duplicate and blank headers, then
shrinking the frame in memory so every later stage is cheaper.

**Classifies every column** as numeric, categorical, boolean, datetime, text,
identifier, constant or empty, each with a readable reason. Only the first four
are usable as model features, and the UI says why the others were dropped.

**Profiles** the data: distributions and histograms, missingness, outliers,
skew, cardinality, the strongest numeric correlations, and a "worth fixing" list
written for a human rather than a log file.

**Picks the problem** from the target you choose — binary, multiclass,
regression, or clustering when you choose none — and ranks candidate algorithms
with a reason specific to *this* dataset's size and shape.

**Trains and explains**: a leaderboard scored on a holdout, a confusion matrix,
feature importances folded back onto the original column names, and for
clustering, the actual rows that fit no pattern.

## Speed

Measured on a 1,000,000 row / 50 MB csv:

| step | time |
| --- | --- |
| read + schema + preview (one request) | 156 ms |
| profile, first call | 28 ms |
| profile, repeat call | 0.8 ms |
| plan | 17 ms |
| train 2 models on 100k rows | ~6 s (background job, polled) |

Schema and profile run on a bounded random sample, so cost is flat in file size.
Upload answers with meta, schema, preview and suggested targets in one round
trip. Everything computed is cached per dataset. No pandas or sklearn call
touches the event loop. See `backend/README.md` for the details.

## Layout

```
backend/          ingest, schema, profile, recommend, train, api, cli  (48 tests)
frontend/         vite + react + tailwind ui
frontend/mockups/ the original stitch screens and DESIGN.md they came from
```

## Tests

```bash
cd backend && python -m pytest tests -q
cd frontend && npm run typecheck
```

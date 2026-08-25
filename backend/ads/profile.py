'''
analysing the data once we know what each column is

Everything heavy (quantiles, correlations, outliers) runs on the same bounded
sample the schema used, so profiling cost is flat in the number of rows.
'''
import time

import numpy as np
import pandas as pd

from . import schema as sc
from .ingest import jsonable

PROFILE_ROWS = 50_000
TOP_VALUES = 8
# a numeric pair is worth reporting above this absolute correlation
CORRELATION_FLOOR = 0.5
HIGH_MISSING = 0.4
HIGH_CARDINALITY = 50


def profile(df, schema=None, rows=PROFILE_ROWS):
    started = time.perf_counter()
    schema = schema or sc.infer_schema(df)
    view = sc.sample_frame(df, rows)

    columns = [column_report(df[c["name"]], view[c["name"]], c, len(df)) for c in schema]
    report = {
        "rows": int(len(df)),
        "columns": int(df.shape[1]),
        "sampled_rows": int(len(view)),
        "duplicate_rows": int(view.duplicated().sum()),
        "missing_cells_pct": round(float(view.isna().to_numpy().mean()) * 100, 2),
        "column_stats": columns,
        "correlations": correlations(view, schema),
        "warnings": warnings(columns, df),
    }
    report["profile_ms"] = round((time.perf_counter() - started) * 1000, 1)
    return report


def column_report(full, sample, spec, n_rows):
    values = sample.dropna()
    out = {
        "name": spec["name"],
        "kind": spec["kind"],
        "dtype": spec["dtype"],
        "reason": spec["reason"],
        "modelable": spec["modelable"],
        "missing_pct": round(float(sample.isna().mean()) * 100, 2),
        "unique": int(values.nunique()) if len(values) else 0,
    }
    out["unique_pct"] = round(out["unique"] / max(len(values), 1) * 100, 2)

    if spec["kind"] == sc.num:
        out.update(numeric_stats(values))
    elif spec["kind"] == sc.date_time:
        out.update(datetime_stats(values))
    elif spec["kind"] in (sc.cat, sc.boolean, sc.const):
        out.update(category_stats(values))
    elif spec["kind"] == sc.text:
        lengths = values.astype(str).str.len()
        out["avg_length"] = round(float(lengths.mean()), 1) if len(lengths) else 0.0
        out["max_length"] = int(lengths.max()) if len(lengths) else 0
    return out


def numeric_stats(values):
    if len(values) == 0:
        return {}
    arr = pd.to_numeric(values, errors="coerce").dropna().to_numpy(dtype="float64")
    if arr.size == 0:
        return {}
    q1, median, q3 = np.percentile(arr, [25, 50, 75])
    spread = q3 - q1
    low, high = q1 - 1.5 * spread, q3 + 1.5 * spread
    outliers = int(((arr < low) | (arr > high)).sum())
    return {
        "min": jsonable(float(arr.min())),
        "max": jsonable(float(arr.max())),
        "mean": jsonable(float(arr.mean())),
        "std": jsonable(float(arr.std())),
        "median": jsonable(float(median)),
        "q1": jsonable(float(q1)),
        "q3": jsonable(float(q3)),
        "zeros_pct": round(float((arr == 0).mean()) * 100, 2),
        "negative_pct": round(float((arr < 0).mean()) * 100, 2),
        "skew": jsonable(float(pd.Series(arr).skew())),
        "outliers": outliers,
        "outliers_pct": round(outliers / arr.size * 100, 2),
        "histogram": histogram(arr),
    }


def histogram(arr, bins=20):
    counts, edges = np.histogram(arr, bins=min(bins, max(len(np.unique(arr)), 1)))
    return {
        "counts": [int(c) for c in counts],
        "edges": [jsonable(float(e)) for e in edges],
    }


def datetime_stats(values):
    stamps = pd.to_datetime(values, errors="coerce").dropna()
    if stamps.empty:
        return {}
    return {
        "min": stamps.min().isoformat(),
        "max": stamps.max().isoformat(),
        "span_days": int((stamps.max() - stamps.min()).days),
        "by_month": {str(k): int(v) for k, v in
                     stamps.dt.to_period("M").value_counts().sort_index().head(36).items()},
    }


def category_stats(values):
    if len(values) == 0:
        return {}
    counts = values.astype(object).value_counts()
    top = counts.head(TOP_VALUES)
    balance = float(counts.min() / counts.max()) if len(counts) > 1 else 1.0
    return {
        "top_values": [{"value": jsonable(k), "count": int(v),
                        "pct": round(v / len(values) * 100, 2)} for k, v in top.items()],
        "balance": round(balance, 4),
    }


def correlations(view, schema):
    """Strongest numeric relationships, so the UI can show what moves together."""
    names = sc.columns_of_kind(schema, sc.num)
    if len(names) < 2:
        return []
    frame = view[names].apply(pd.to_numeric, errors="coerce")
    matrix = frame.corr(numeric_only=True)
    pairs = []
    seen = set()
    for a in matrix.columns:
        for b in matrix.columns:
            if a == b or (b, a) in seen:
                continue
            seen.add((a, b))
            value = matrix.at[a, b]
            if pd.notna(value) and abs(value) >= CORRELATION_FLOOR:
                pairs.append({"a": a, "b": b, "r": round(float(value), 3)})
    pairs.sort(key=lambda p: -abs(p["r"]))
    return pairs[:25]


def warnings(columns, df):
    """Plain-language problems a user should fix before modelling."""
    out = []
    for col in columns:
        name, kind = col["name"], col["kind"]
        if kind == sc.empty:
            out.append({"column": name, "level": "high", "issue": "column is completely empty"})
        elif kind == sc.const:
            out.append({"column": name, "level": "medium", "issue": "same value in every row, carries no signal"})
        elif kind == sc.identifier:
            out.append({"column": name, "level": "medium", "issue": "looks like an id, will be excluded from models"})
        if col["missing_pct"] >= HIGH_MISSING * 100:
            out.append({"column": name, "level": "high",
                        "issue": "%.0f%% of values are missing" % col["missing_pct"]})
        if kind == sc.cat and col["unique"] > HIGH_CARDINALITY:
            out.append({"column": name, "level": "medium",
                        "issue": "{:,} categories, rare ones will be grouped together".format(col["unique"])})
        if kind == sc.num and abs(col.get("skew") or 0) >= 3:
            out.append({"column": name, "level": "low",
                        "issue": "heavily skewed, a log transform may help"})
        if kind == sc.num and col.get("outliers_pct", 0) >= 5:
            out.append({"column": name, "level": "low",
                        "issue": "%.0f%% of values sit outside the normal range" % col["outliers_pct"]})
    if len(df) < 50:
        out.append({"column": None, "level": "high",
                    "issue": "only %d rows, model scores will not be reliable" % len(df)})
    return out

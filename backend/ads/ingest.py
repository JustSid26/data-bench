'''
loading excel/csv files

Reading is the first thing a user waits on, so every path here picks the
fastest reader available (pyarrow for csv/parquet, read_only for excel) and
then shrinks the frame in memory so every stage after this is cheaper.
'''
import csv
import datetime
import io
import os
import time

import numpy as np
import pandas as pd

CSV_SUFFIX = {".csv", ".tsv", ".txt"}
EXCEL_SUFFIX = {".xlsx", ".xlsm", ".xls"}
PARQUET_SUFFIX = {".parquet", ".pq"}
JSON_SUFFIX = {".json", ".jsonl", ".ndjson"}

SUPPORTED = sorted(CSV_SUFFIX | EXCEL_SUFFIX | PARQUET_SUFFIX | JSON_SUFFIX)

# object columns with fewer distinct values than this fraction become category
CATEGORY_RATIO = 0.5
CATEGORY_MAX = 1000


class IngestError(ValueError):
    pass


def suffix_of(name):
    return os.path.splitext(str(name).lower())[1]


def read_any(source, name=None, nrows=None, sheet=None):
    """Load a file path or bytes into a DataFrame plus a small meta dict."""
    started = time.perf_counter()
    name = name or (source if isinstance(source, (str, os.PathLike)) else "upload")
    kind = suffix_of(name)

    if kind in CSV_SUFFIX:
        df = read_csv(source, kind, nrows)
    elif kind in EXCEL_SUFFIX:
        df = read_excel(source, nrows, sheet)
    elif kind in PARQUET_SUFFIX:
        df = read_parquet(source, nrows)
    elif kind in JSON_SUFFIX:
        df = read_json(source, kind, nrows)
    else:
        raise IngestError("cannot read '%s', supported types are %s" % (name, ", ".join(SUPPORTED)))

    df = tidy(df)
    df = numbers_stored_as_text(df)
    df = dates_as_datetimes(df)
    df = shrink(df)
    meta = {
        "name": os.path.basename(str(name)),
        "format": kind.lstrip("."),
        "rows": int(len(df)),
        "columns": int(df.shape[1]),
        "memory_mb": round(float(df.memory_usage(deep=True).sum()) / 1e6, 2),
        "truncated": bool(nrows is not None and len(df) >= nrows),
        "read_ms": round((time.perf_counter() - started) * 1000, 1),
    }
    if kind in CSV_SUFFIX:
        # remembered so an exported script reads the file the same way
        meta["separator"] = sniff_separator(source, kind)
    return df, meta


def _buffer(source):
    return io.BytesIO(source) if isinstance(source, (bytes, bytearray)) else source


SEPARATORS = ",;\t|"


def sniff_separator(source, kind):
    """Guess the delimiter so we never need the slow python engine.

    Looks at several lines, not just the header: a quoted header such as
    "fixed acidity";"volatile acidity" (the UCI wine files, most European
    exports) defeats a one-line sniff, which then fell back to a comma and
    read the whole file as a single column.
    """
    if kind == ".tsv":
        return "\t"
    try:
        if isinstance(source, (bytes, bytearray)):
            head = bytes(source[:65536])
        else:
            with open(source, "rb") as handle:
                head = handle.read(65536)
        lines = [l for l in head.decode("utf-8", errors="ignore").splitlines()[:20] if l.strip()]
        if len(lines) > 1:
            lines = lines[:-1]  # the last line in the buffer may be cut short
        try:
            return csv.Sniffer().sniff("\n".join(lines), delimiters=SEPARATORS).delimiter
        except csv.Error:
            pass
        # fallback: the candidate that appears the same, non-zero number of
        # times on every line, preferring the one that splits into most fields
        best, best_count = ",", 0
        for sep in SEPARATORS:
            counts = {len(next(csv.reader([l], delimiter=sep))) for l in lines}
            if len(counts) == 1 and (n := counts.pop()) > max(1, best_count):
                best, best_count = sep, n
        return best
    except Exception:
        return ","


def read_csv(source, kind, nrows):
    sep = sniff_separator(source, kind)
    # pyarrow reads multithreaded and is the fastest engine pandas exposes,
    # but it cannot take nrows -- fall back to the C engine when we need a head.
    if nrows is None:
        try:
            return pd.read_csv(_buffer(source), sep=sep, engine="pyarrow")
        except Exception:
            pass
    return pd.read_csv(_buffer(source), sep=sep, engine="c", nrows=nrows, low_memory=False)


def read_excel(source, nrows, sheet):
    return pd.read_excel(_buffer(source), sheet_name=sheet or 0, nrows=nrows)


def read_parquet(source, nrows):
    df = pd.read_parquet(_buffer(source))
    return df.head(nrows) if nrows else df


def read_json(source, kind, nrows):
    lines = kind in {".jsonl", ".ndjson"}
    df = pd.read_json(_buffer(source), lines=lines, nrows=nrows if lines else None)
    return df.head(nrows) if nrows and not lines else df


def tidy(df):
    """Drop the junk index column pandas writes out, and give columns real names."""
    df.columns = [str(c).strip() for c in df.columns]
    unnamed = [c for c in df.columns if c == "" or c.lower().startswith("unnamed:")]
    empty = [c for c in unnamed if df[c].isna().all()]
    if empty:
        df = df.drop(columns=empty)
    df.columns = [c if c else "column_%d" % i for i, c in enumerate(df.columns)]
    if df.columns.duplicated().any():
        seen = {}
        names = []
        for c in df.columns:
            seen[c] = seen.get(c, 0) + 1
            names.append(c if seen[c] == 1 else "%s_%d" % (c, seen[c]))
        df.columns = names
    return df


def numbers_stored_as_text(df):
    """Turn text columns that are really numbers back into numbers.

    Exports often write a blank or a space for a missing number (the Telco
    churn data's TotalCharges is the textbook case), which makes the reader
    keep the whole column as text -- and then it looks like an id. Blank
    cells become NaN; a column converts when nearly every non-blank value
    parses as a number. Codes with leading zeros ("00123") stay text.
    """
    for name in df.columns:
        col = df[name]
        if not (col.dtype == object or pd.api.types.is_string_dtype(col)):
            continue
        text = col.astype("string").str.strip()
        filled = text[text.notna() & (text != "")]
        if filled.empty:
            continue
        if filled.str.match(r"^-?0\d").mean() > 0.01:
            continue
        numbers = pd.to_numeric(filled, errors="coerce")
        if numbers.notna().mean() >= 0.98:
            # plain float64, not a nullable dtype: sklearn chokes on pd.NA
            df[name] = pd.to_numeric(text.replace("", pd.NA), errors="coerce").astype("float64")
    return df


def dates_as_datetimes(df):
    """Turn columns of python date objects into real datetimes.

    pyarrow reads "2025-01-01" as datetime.date objects in an object column,
    which shrink() would then fold into a category -- so a date column showed
    up as hundreds of categories instead of a date.
    """
    for name in df.columns:
        col = df[name]
        if col.dtype != object:
            continue
        filled = col.dropna()
        if not filled.empty and filled.map(lambda v: isinstance(v, (datetime.date, datetime.datetime))).all():
            df[name] = pd.to_datetime(col, errors="coerce")
    return df


def shrink(df):
    """Downcast numbers and fold repeated strings into categories."""
    for name in df.columns:
        col = df[name]
        if pd.api.types.is_integer_dtype(col):
            df[name] = pd.to_numeric(col, downcast="integer")
        elif pd.api.types.is_float_dtype(col):
            df[name] = pd.to_numeric(col, downcast="float")
        elif col.dtype == object:
            n = len(col)
            if n and col.nunique(dropna=True) <= min(CATEGORY_MAX, n * CATEGORY_RATIO):
                df[name] = col.astype("category")
    return df


def preview(df, rows=50):
    """JSON-safe head of the frame for the table view."""
    head = df.head(rows).copy()
    for name in head.columns:
        col = head[name]
        if pd.api.types.is_datetime64_any_dtype(col):
            head[name] = col.dt.strftime("%Y-%m-%d %H:%M:%S")
        elif isinstance(col.dtype, pd.CategoricalDtype):
            head[name] = col.astype(object)
    head = head.astype(object).where(pd.notna(head), None)
    return {
        "columns": [str(c) for c in df.columns],
        "rows": [[jsonable(v) for v in row] for row in head.values.tolist()],
    }


def jsonable(value):
    """numpy scalars and NaN do not survive json.dumps -- make them plain python."""
    if value is None or value is pd.NaT:
        return None
    if isinstance(value, (np.integer,)):
        return int(value)
    if isinstance(value, (np.floating,)):
        value = float(value)
    if isinstance(value, float):
        return None if (value != value or value in (float("inf"), float("-inf"))) else value
    if isinstance(value, (np.bool_,)):
        return bool(value)
    if isinstance(value, (pd.Timestamp,)):
        return value.isoformat()
    return value

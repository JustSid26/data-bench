'''
checking what type of data the column stores

Kind inference runs on a bounded sample so the cost is O(sample) per column,
not O(rows). That keeps a 5M row file as fast to profile as a 50k row one.
'''
import numpy as np
import pandas as pd

num = "numeric"
cat = "categorical"
boolean = "boolean"
date_time = "datetime"
text = "text"
identifier = "identifier"
const = "constant"
empty = "empty"

modelable = [num, cat, boolean, date_time]

boolean_words = ["true", "false", "yes", "no", "y", "n", "t", "f", "0", "1"]

# rows scanned per column when guessing the kind. profile.py samples the same
# count with the same seed, so the two always agree on distinct-value counts.
SAMPLE_ROWS = 50_000
# rows parsed when testing whether strings are dates
DATE_PROBE_ROWS = 500


def sample_frame(df, rows=SAMPLE_ROWS, seed=0):
    """Bounded, deterministic view of a frame.

    Random rather than strided: a fixed stride aliases against any repeating
    pattern in the file and silently collapses the distinct-value counts every
    decision below depends on.
    """
    if rows is None or len(df) <= rows:
        return df
    return df.sample(rows, random_state=seed)


def column_kind(series, full_length=None):
    """Return (kind, reason) for one column."""
    values = series.dropna()
    n_rows = len(values)
    if n_rows == 0:
        return empty, "no value is available"

    n_unique = values.nunique()
    if n_unique == 1:
        return const, "only one distinct value"

    if pd.api.types.is_bool_dtype(series):
        return boolean, "stored as boolean"

    if pd.api.types.is_datetime64_any_dtype(series):
        return date_time, "stored as date time"

    if isinstance(series.dtype, pd.CategoricalDtype):
        return cat, "{:,} different values".format(n_unique)

    if pd.api.types.is_numeric_dtype(series):
        return check_numeric(values, n_unique, full_length or n_rows)

    return check_text(values, n_unique, full_length or n_rows)


def check_numeric(values, n_unique, full_length):
    if n_unique == 2 and set(np.unique(values.to_numpy())) <= {0, 1}:
        return boolean, "only 0 and 1"

    is_integer = pd.api.types.is_integer_dtype(values)
    if is_integer and n_unique == len(values) and full_length > 20:
        return identifier, "each row has a different integer"

    if is_integer and n_unique <= 10:
        return cat, "integer with only %d different values" % n_unique

    return num, "{:,} different numeric values".format(n_unique)


def check_text(values, n_unique, full_length):
    as_text = values.astype(str)

    if n_unique <= 2:
        words = set(v.strip().lower() for v in as_text.unique())
        if words.issubset(set(boolean_words)):
            return boolean, "reads as true/false"

    probe = as_text.head(DATE_PROBE_ROWS)
    if check_if_dates(probe):
        return date_time, "date-time value"

    if n_unique / len(values) <= 0.5 and n_unique <= 200:
        return cat, "{:,} different values in {:,} rows".format(n_unique, len(values))

    average_length = probe.str.len().mean()
    if average_length >= 25:
        return text, "free text, about %d characters long" % average_length

    return identifier, "{:,} different values, almost one per row".format(n_unique)


def check_if_dates(sample):
    if len(sample) == 0:
        return False
    all_numbers = sample.str.match(r"^\s*-?\d+\.?\d*\s*$").fillna(False).all()
    if all_numbers:
        return False

    with pd.option_context("mode.chained_assignment", None):
        parsed = pd.to_datetime(sample, errors="coerce", format="mixed")
    return parsed.notna().mean() >= 0.85


def infer_schema(df, rows=SAMPLE_ROWS):
    """Schema for every column, inferred from a bounded sample of the frame."""
    view = sample_frame(df, rows)
    full_length = len(df)
    schema = []
    for name in df.columns:
        kind, reason = column_kind(view[name], full_length=full_length)
        schema.append({
            "name": str(name),
            "dtype": str(df[name].dtype),
            "kind": kind,
            "reason": reason,
            "modelable": kind in modelable,
        })
    return schema


def kinds_by_name(schema):
    return {c["name"]: c["kind"] for c in schema}


def columns_of_kind(schema, *wanted):
    return [c["name"] for c in schema if c["kind"] in wanted]

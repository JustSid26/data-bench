import json

import pandas as pd
import pytest

from ads import ingest


def test_reads_csv_with_meta(csv_path):
    df, meta = ingest.read_any(csv_path)
    assert meta["rows"] == 600 and meta["format"] == "csv"
    assert meta["read_ms"] >= 0 and json.dumps(meta)


def test_reads_excel_and_parquet(frame, tmp_path):
    for name in ("sheet.xlsx", "block.parquet"):
        path = tmp_path / name
        frame.to_excel(path, index=False) if name.endswith("xlsx") else frame.to_parquet(path)
        df, meta = ingest.read_any(str(path))
        assert len(df) == 600 and meta["columns"] == frame.shape[1]


def test_unknown_extension_says_what_is_supported(tmp_path):
    path = tmp_path / "notes.docx"
    path.write_bytes(b"x")
    with pytest.raises(ingest.IngestError, match="supported"):
        ingest.read_any(str(path))


def test_nrows_marks_the_frame_truncated(csv_path):
    _, meta = ingest.read_any(csv_path, nrows=20)
    assert meta["rows"] == 20 and meta["truncated"]


def test_duplicate_and_empty_headers_are_repaired():
    raw = b"a,a,,b\n1,2,,4\n5,6,,8\n"
    df, _ = ingest.read_any(raw, name="dupes.csv")
    assert len(set(df.columns)) == len(df.columns)


def test_preview_is_json_safe(frame):
    df = ingest.shrink(frame.copy())
    body = ingest.preview(df, 5)
    assert body["columns"] and len(body["rows"]) == 5
    json.dumps(body)


def test_shrink_folds_repeated_strings_into_categories(frame):
    shrunk = ingest.shrink(frame.copy())
    assert isinstance(shrunk["city"].dtype, pd.CategoricalDtype)


def test_semicolon_file_with_a_quoted_header_splits_into_columns():
    # the UCI wine files: a one-line sniff of this header used to fall back to
    # a comma and read the whole file as a single column
    raw = b'"fixed acidity";"volatile acidity";"quality"\n7.4;0.7;5\n7.8;0.88;5\n11.2;0.28;6\n'
    df, meta = ingest.read_any(raw, "wine.csv")
    assert list(df.columns) == ["fixed acidity", "volatile acidity", "quality"]
    assert meta["rows"] == 3


def test_numbers_with_blank_cells_stay_numeric():
    # Telco churn's TotalCharges: a space where a number is missing
    raw = b"id,total\na,29.85\nb, \nc,1889.5\nd,108.15\n"
    df, _ = ingest.read_any(raw, "telco.csv")
    assert pd.api.types.is_float_dtype(df["total"])
    assert df["total"].isna().sum() == 1


def test_iso_dates_read_as_datetimes_not_categories():
    # pyarrow hands back datetime.date objects; they must not fold into a category
    rows = "".join("2025-01-%02d,%d\n" % (day % 28 + 1, day) for day in range(60))
    df, _ = ingest.read_any(("when,n\n" + rows).encode(), "visits.csv")
    assert pd.api.types.is_datetime64_any_dtype(df["when"])


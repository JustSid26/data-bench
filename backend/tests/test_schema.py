import pandas as pd
import pytest

from ads import schema as sc


def test_every_column_gets_a_kind_and_reason(frame):
    result = sc.infer_schema(frame)
    assert [c["name"] for c in result] == list(frame.columns)
    for col in result:
        assert isinstance(col["reason"], str) and col["reason"]
        assert col["kind"] in {sc.num, sc.cat, sc.boolean, sc.date_time,
                               sc.text, sc.identifier, sc.const, sc.empty}


def test_kinds_are_what_a_human_would_say(frame):
    kinds = sc.kinds_by_name(sc.infer_schema(frame))
    assert kinds == {
        "id": sc.identifier, "city": sc.cat, "spend": sc.num, "clicks": sc.num,
        "day": sc.date_time, "note": sc.text, "always": sc.const,
        "blank": sc.empty, "converted": sc.boolean, "revenue": sc.num,
    }


def test_constant_column_returns_a_pair_not_a_bare_string():
    # this used to return one string and blow up when infer_schema unpacked it
    kind, reason = sc.column_kind(pd.Series(["x"] * 10))
    assert kind == sc.const and isinstance(reason, str)


def test_long_text_is_reported_as_text_not_as_the_series():
    kind, _ = sc.column_kind(pd.Series(["a long unique sentence number %d here" % i
                                        for i in range(300)]))
    assert kind == sc.text


@pytest.mark.parametrize("values,expected", [
    (["yes", "no", "yes", "no"], sc.boolean),
    (["true", "false"] * 5, sc.boolean),
    ([0, 1] * 30, sc.boolean),
    (["2024-01-%02d" % (i % 28 + 1) for i in range(100)], sc.date_time),
    (list(range(100)), sc.identifier),
    ([1, 2, 3] * 40, sc.cat),
])
def test_specific_shapes(values, expected):
    assert sc.column_kind(pd.Series(values))[0] == expected


def test_numbers_stored_as_strings_are_not_mistaken_for_dates():
    kind, _ = sc.column_kind(pd.Series([str(i * 1.5) for i in range(500)]))
    assert kind != sc.date_time


def test_sampling_does_not_change_the_answer(frame):
    big = pd.concat([frame] * 40, ignore_index=True)
    assert sc.kinds_by_name(sc.infer_schema(big, rows=500)) == \
           sc.kinds_by_name(sc.infer_schema(big, rows=None))

import json

import numpy as np
import pandas as pd
import pytest

from ads import recommend as rc
from ads import train as tr
from ads.profile import profile
from ads.schema import infer_schema


@pytest.fixture
def schema(frame):
    return infer_schema(frame)


def test_profile_is_complete_and_serialisable(frame, schema):
    report = profile(frame, schema)
    assert report["rows"] == 600
    assert len(report["column_stats"]) == frame.shape[1]
    json.dumps(report)


def test_numeric_column_gets_real_statistics(frame, schema):
    spend = next(c for c in profile(frame, schema)["column_stats"] if c["name"] == "spend")
    assert 0 <= spend["min"] <= spend["median"] <= spend["max"] <= 1000
    assert sum(spend["histogram"]["counts"]) > 0


def test_correlated_columns_are_reported(frame, schema):
    pairs = profile(frame, schema)["correlations"]
    assert any({p["a"], p["b"]} == {"spend", "revenue"} for p in pairs)


def test_warnings_name_the_broken_columns(frame, schema):
    flagged = {(w["column"], w["issue"]) for w in profile(frame, schema)["warnings"]}
    assert any(c == "blank" for c, _ in flagged)
    assert any(c == "always" for c, _ in flagged)
    assert any(c == "id" for c, _ in flagged)


@pytest.mark.parametrize("target,expected", [
    ("converted", rc.BINARY),
    ("revenue", rc.REGRESSION),
    ("city", rc.MULTICLASS),
    (None, rc.CLUSTERING),
])
def test_task_matches_the_target_column(frame, schema, target, expected):
    assert rc.plan(frame, schema, target)["task"] == expected


def test_ids_and_text_never_become_features(frame, schema):
    features = rc.plan(frame, schema, "converted")["features"]
    used = features["numeric"] + features["categorical"] + features["temporal"]
    assert "id" not in used and "note" not in used and "blank" not in used
    assert {"spend", "clicks", "city", "day"} <= set(used)


def test_unknown_target_is_rejected(frame, schema):
    with pytest.raises(ValueError, match="not in this dataset"):
        rc.plan(frame, schema, "nope")


def test_too_many_classes_is_rejected(frame, schema):
    with pytest.raises(ValueError, match="too many"):
        rc.plan(frame, schema, "note")


def test_classification_learns_the_signal(frame, schema):
    plan = rc.plan(frame, schema, "converted")
    result = tr.run(frame, plan, ["gradient_boosting", "logistic_regression"])
    assert result["best"] and result["score_name"] == "balanced accuracy"
    winner = result["results"][0]
    assert winner["score"] > 0.6
    assert winner["metrics"]["confusion"] and "roc_auc" in winner["metrics"]
    json.dumps(result)


def test_regression_recovers_a_linear_target(frame, schema):
    plan = rc.plan(frame, schema, "revenue")
    result = tr.run(frame, plan, ["ridge", "random_forest"])
    assert result["results"][0]["score"] > 0.9
    top = result["results"][0]["importance"][0]["column"]
    assert top == "spend"


def test_clustering_runs_without_a_target(frame, schema):
    plan = rc.plan(frame, schema, None)
    result = tr.run(frame, plan, ["kmeans", "isolation_forest"])
    by_name = {r["algorithm"]: r for r in result["results"]}
    assert by_name["kmeans"]["metrics"]["clusters"] >= 2
    assert 0 < by_name["isolation_forest"]["metrics"]["outliers_pct"] < 20
    json.dumps(result)


def test_a_broken_algorithm_does_not_sink_the_others(frame, schema):
    plan = rc.plan(frame, schema, "converted")
    result = tr.run(frame, plan, ["ridge", "gradient_boosting"])
    failed = [r for r in result["results"] if not r.get("ok")]
    assert result["best"] == "gradient_boosting"
    assert len(failed) <= 1


def test_the_winner_always_explains_itself(frame, schema):
    plan = rc.plan(frame, schema, "converted")
    result = tr.run(frame, plan, ["gradient_boosting"])
    # boosted models have no built-in weights, so this must come from permutation
    assert result["results"][0]["importance"]


def test_importance_is_reported_per_original_column(frame, schema):
    plan = rc.plan(frame, schema, "revenue")
    result = tr.run(frame, plan, ["random_forest"])
    named = {w["column"] for w in result["results"][0]["importance"]}
    assert named <= set(frame.columns)  # not city_pune, not temporal__day__hour


def test_training_caps_the_rows_it_reads(frame, schema):
    big = pd.concat([frame] * 5, ignore_index=True)
    plan = rc.plan(big, infer_schema(big), "converted")
    result = tr.run(big, plan, ["decision_tree"], max_rows=800)
    assert result["rows_used"] == 800 and result["rows_sampled"]


def test_missing_values_do_not_break_training(frame, schema):
    holey = frame.copy()
    rng = np.random.default_rng(1)
    for column in ("spend", "city", "day"):
        holey.loc[rng.random(len(holey)) < 0.3, column] = None
    plan = rc.plan(holey, infer_schema(holey), "converted")
    result = tr.run(holey, plan, ["random_forest"])
    assert result["results"][0]["ok"]

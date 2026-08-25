'''
deciding which ml algorithms suit this data

Nothing is trained here. This module only reads the schema plus a few cheap
target statistics and returns the plan, so the UI can render choices instantly.
'''
import numpy as np
import pandas as pd

from . import schema as sc

BINARY = "binary_classification"
MULTICLASS = "multiclass_classification"
REGRESSION = "regression"
CLUSTERING = "clustering"

# a categorical target with more distinct labels than this is not a class column
MAX_CLASSES = 50
# below this many rows the boosted models overfit, prefer the simple ones
SMALL_DATA = 1_000


def detect_task(df, schema, target):
    """What kind of problem the chosen target column makes this."""
    if target is None:
        return CLUSTERING, "no target column chosen, grouping rows instead"

    spec = next((c for c in schema if c["name"] == target), None)
    if spec is None:
        raise ValueError("column '%s' is not in this dataset" % target)

    values = df[target].dropna()
    if values.empty:
        raise ValueError("column '%s' has no values to predict" % target)

    n_classes = int(values.nunique())
    if spec["kind"] == sc.boolean or n_classes == 2:
        return BINARY, "target has two outcomes"
    if spec["kind"] in (sc.cat, sc.text, sc.identifier):
        if n_classes > MAX_CLASSES:
            raise ValueError(
                "column '%s' has %d different values, too many to predict as classes"
                % (target, n_classes))
        return MULTICLASS, "target has %d different classes" % n_classes
    if spec["kind"] == sc.num:
        return REGRESSION, "target is a number, predicting its value"
    raise ValueError("column '%s' is %s and cannot be predicted" % (target, spec["kind"]))


def usable_features(schema, target=None):
    """Columns worth feeding a model, split by how they need encoding."""
    numeric, categorical, temporal, dropped = [], [], [], []
    for col in schema:
        name = col["name"]
        if name == target:
            continue
        kind = col["kind"]
        if kind == sc.num:
            numeric.append(name)
        elif kind in (sc.cat, sc.boolean):
            categorical.append(name)
        elif kind == sc.date_time:
            temporal.append(name)
        else:
            dropped.append({"name": name, "why": "%s columns are not used as features" % kind})
    return {"numeric": numeric, "categorical": categorical,
            "temporal": temporal, "dropped": dropped}


def target_summary(df, target, task):
    if target is None:
        return {}
    values = df[target].dropna()
    if task == REGRESSION:
        arr = pd.to_numeric(values, errors="coerce").dropna()
        return {
            "kind": "numeric",
            "min": float(arr.min()), "max": float(arr.max()),
            "mean": float(arr.mean()), "std": float(arr.std()),
        }
    counts = values.astype(object).value_counts()
    balance = float(counts.min() / counts.max()) if len(counts) > 1 else 1.0
    return {
        "kind": "classes",
        "classes": int(len(counts)),
        "balance": round(balance, 4),
        "imbalanced": balance < 0.2,
        "distribution": [{"value": str(k), "count": int(v)} for k, v in counts.head(20).items()],
    }


def algorithms_for(task, n_rows, features, target_info):
    """Ranked candidates with the reason each one fits this particular dataset."""
    n_features = len(features["numeric"]) + len(features["categorical"]) + len(features["temporal"])
    wide = n_features > 50
    small = n_rows < SMALL_DATA
    picks = []

    if task in (BINARY, MULTICLASS):
        picks.append(("gradient_boosting", not small,
                      "handles mixed column types and missing values, usually the strongest here"))
        picks.append(("random_forest", True,
                      "robust with {:,} rows and needs no tuning".format(n_rows)))
        picks.append(("logistic_regression", small or wide,
                      "fast, and the coefficients read as plain per-column effects"))
        picks.append(("decision_tree", small, tree_reason(small)))
    elif task == REGRESSION:
        picks.append(("gradient_boosting", not small,
                      "captures non-linear effects across %d features" % n_features))
        picks.append(("random_forest", True, "stable baseline that ignores feature scaling"))
        picks.append(("ridge", True, "linear baseline, tells you if the signal is simple"))
        picks.append(("decision_tree", small, tree_reason(small)))
    else:
        picks.append(("kmeans", True, "groups rows into clusters of similar behaviour"))
        picks.append(("dbscan", n_rows <= 20_000,
                      "finds clusters of any shape and marks leftovers as outliers"))
        picks.append(("isolation_forest", True, "flags the rows that do not fit any pattern"))

    ranked = [{"name": n, "recommended": bool(r), "why": w} for n, r, w in picks]
    ranked.sort(key=lambda a: not a["recommended"])
    return ranked


def tree_reason(small):
    if small:
        return "few rows to learn from, a single tree stays explainable"
    return "one readable tree, usually beaten by the ensembles on data this size"


def plan(df, schema, target=None):
    """Everything the UI needs to show before anyone presses train."""
    task, task_reason = detect_task(df, schema, target)
    features = usable_features(schema, target)
    info = target_summary(df, target, task)
    notes = []
    if info.get("imbalanced"):
        notes.append("classes are uneven, scores are balanced to compensate")
    if not (features["numeric"] or features["categorical"] or features["temporal"]):
        notes.append("no usable feature columns, add data before training")
    if len(df) < 50:
        notes.append("only %d rows, treat any score as a guess" % len(df))
    return {
        "target": target,
        "task": task,
        "task_reason": task_reason,
        "features": features,
        "target_summary": info,
        "algorithms": algorithms_for(task, len(df), features, info),
        "notes": notes,
    }

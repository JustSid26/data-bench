'''
running the ml algorithms the data asked for

Speed rules here: cap the rows a model sees, skip scaling for tree models,
read importances off the fitted model instead of permuting, and run every
candidate in one pass so the leaderboard arrives in a single round trip.
'''
import time
import warnings

import numpy as np
import pandas as pd
from sklearn.base import clone
from sklearn.cluster import DBSCAN, KMeans
from sklearn.compose import ColumnTransformer
from sklearn.ensemble import (
    HistGradientBoostingClassifier, HistGradientBoostingRegressor,
    IsolationForest, RandomForestClassifier, RandomForestRegressor,
)
from sklearn.impute import SimpleImputer
from sklearn.linear_model import LogisticRegression, Ridge
from sklearn.metrics import (
    accuracy_score, balanced_accuracy_score, confusion_matrix, f1_score,
    mean_absolute_error, mean_squared_error, r2_score, roc_auc_score, silhouette_score,
)
from sklearn.inspection import permutation_importance
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import FunctionTransformer, OneHotEncoder, StandardScaler
from sklearn.tree import DecisionTreeClassifier, DecisionTreeRegressor

from . import recommend as rc
from .ingest import jsonable

# models never see more rows than this -- accuracy plateaus long before the wait does
MAX_TRAIN_ROWS = 100_000
# rows used for the silhouette score, which is O(n^2)
SILHOUETTE_ROWS = 5_000
TEST_SIZE = 0.2
SEED = 0
# rare categories below this share get folded into one "infrequent" bucket
MIN_CATEGORY_FREQUENCY = 0.01
# share of the training rows held back to pick the decision threshold
VALIDATION_SIZE = 0.2
MAX_CATEGORIES = 40
# share of rows isolation forest is asked to flag as unusual
OUTLIER_SHARE = 0.05
# rows and repeats used when a model has no built-in importances
PERMUTATION_ROWS = 1_000
PERMUTATION_REPEATS = 2

SCALE_NEEDED = {"logistic_regression", "ridge", "kmeans", "dbscan"}


def expand_datetimes(frame):
    """Turn each date column into the numbers a model can actually use."""
    out = {}
    for name in frame.columns:
        stamps = pd.to_datetime(frame[name], errors="coerce")
        out["%s__year" % name] = stamps.dt.year
        out["%s__month" % name] = stamps.dt.month
        out["%s__day" % name] = stamps.dt.day
        out["%s__weekday" % name] = stamps.dt.dayofweek
        out["%s__hour" % name] = stamps.dt.hour
        out["%s__epoch" % name] = stamps.astype("int64").where(stamps.notna(), np.nan) / 1e9
    return pd.DataFrame(out, index=frame.index).astype("float64")


def datetime_names(transformer, input_features):
    parts = ["year", "month", "day", "weekday", "hour", "epoch"]
    return np.array(["%s__%s" % (n, p) for n in input_features for p in parts])


def build_preprocessor(features, scale):
    blocks = []
    if features["numeric"]:
        steps = [("fill", SimpleImputer(strategy="median"))]
        if scale:
            steps.append(("scale", StandardScaler()))
        blocks.append(("numeric", Pipeline(steps), features["numeric"]))
    if features["categorical"]:
        blocks.append(("categorical", Pipeline([
            ("fill", SimpleImputer(strategy="most_frequent")),
            ("encode", OneHotEncoder(
                handle_unknown="infrequent_if_exist",
                min_frequency=MIN_CATEGORY_FREQUENCY,
                max_categories=MAX_CATEGORIES,
                sparse_output=False,
            )),
        ]), features["categorical"]))
    if features["temporal"]:
        steps = [
            ("expand", FunctionTransformer(expand_datetimes, feature_names_out=datetime_names)),
            ("fill", SimpleImputer(strategy="median")),
        ]
        if scale:
            steps.append(("scale", StandardScaler()))
        blocks.append(("temporal", Pipeline(steps), features["temporal"]))
    if not blocks:
        raise ValueError("no usable feature columns to train on")
    return ColumnTransformer(blocks, remainder="drop", n_jobs=None)


def make_model(name, task):
    classifying = task in (rc.BINARY, rc.MULTICLASS)
    # only the classifiers accept class_weight -- passing it to a regressor raises
    weighted = {"class_weight": "balanced"} if classifying else {}
    if name == "gradient_boosting":
        if classifying:
            return HistGradientBoostingClassifier(
                max_iter=200, early_stopping=True, random_state=SEED, **weighted)
        return HistGradientBoostingRegressor(max_iter=200, early_stopping=True, random_state=SEED)
    if name == "random_forest":
        cls = RandomForestClassifier if classifying else RandomForestRegressor
        return cls(n_estimators=100, n_jobs=-1, random_state=SEED, **weighted)
    if name == "logistic_regression":
        return LogisticRegression(max_iter=1000, n_jobs=-1, class_weight="balanced")
    if name == "ridge":
        return Ridge(random_state=SEED)
    if name == "decision_tree":
        cls = DecisionTreeClassifier if classifying else DecisionTreeRegressor
        return cls(max_depth=6, random_state=SEED, **weighted)
    if name == "kmeans":
        return KMeans(n_init=10, random_state=SEED)
    if name == "dbscan":
        return DBSCAN(n_jobs=-1)
    if name == "isolation_forest":
        return IsolationForest(n_estimators=150, contamination=OUTLIER_SHARE,
                               random_state=SEED, n_jobs=-1)
    raise ValueError("unknown algorithm '%s'" % name)


def prepare(df, plan, max_rows=MAX_TRAIN_ROWS):
    """Rows and columns the models will actually see."""
    features = plan["features"]
    used = features["numeric"] + features["categorical"] + features["temporal"]
    target = plan["target"]
    frame = df[used + ([target] if target else [])]
    if target:
        frame = frame.dropna(subset=[target])
    sampled = len(frame) > max_rows
    if sampled:
        frame = frame.sample(max_rows, random_state=SEED)
    X = frame[used]
    y = frame[target] if target else None
    return X, y, sampled, len(frame)


def run(df, plan, algorithms=None, max_rows=MAX_TRAIN_ROWS):
    """Train every requested algorithm and return a ranked leaderboard."""
    started = time.perf_counter()
    task = plan["task"]
    wanted = algorithms or [a["name"] for a in plan["algorithms"] if a["recommended"]]
    if not wanted:
        wanted = [plan["algorithms"][0]["name"]]

    X, y, sampled, n_used = prepare(df, plan, max_rows)
    results = []
    for name in wanted:
        try:
            with warnings.catch_warnings():
                warnings.simplefilter("ignore")
                results.append(train_one(name, task, X, y))
        except Exception as error:
            results.append({"algorithm": name, "ok": False, "error": str(error)})

    good = [r for r in results if r.get("ok")]
    good.sort(key=lambda r: -(r["score"] if r.get("score") is not None else -1e18))
    ordered = good + [r for r in results if not r.get("ok")]
    if good and not good[0]["importance"]:
        good[0]["importance"] = permutation_importance_of(good[0])
    for item in ordered:
        item.pop("_pipe", None)
        item.pop("_holdout", None)
    return {
        "task": task,
        "target": plan["target"],
        "rows_used": int(n_used),
        "rows_sampled": bool(sampled),
        "score_name": score_name(task),
        "best": ordered[0]["algorithm"] if good else None,
        "results": ordered,
        "train_ms": round((time.perf_counter() - started) * 1000, 1),
    }


def score_name(task):
    if task in (rc.BINARY, rc.MULTICLASS):
        return "balanced accuracy"
    if task == rc.REGRESSION:
        return "r2"
    return "silhouette"


def train_one(name, task, X, y):
    started = time.perf_counter()
    scale = name in SCALE_NEEDED
    pre = build_preprocessor(split_features(X), scale)

    if task == rc.CLUSTERING:
        result = fit_clustering(name, pre, X)
    else:
        result = fit_supervised(name, task, pre, X, y)

    result.update({"algorithm": name, "ok": True,
                   "fit_ms": round((time.perf_counter() - started) * 1000, 1)})
    return result


def split_features(X):
    numeric, categorical, temporal = [], [], []
    for name in X.columns:
        col = X[name]
        if pd.api.types.is_datetime64_any_dtype(col):
            temporal.append(name)
        elif pd.api.types.is_numeric_dtype(col) and not pd.api.types.is_bool_dtype(col):
            numeric.append(name)
        else:
            categorical.append(name)
    return {"numeric": numeric, "categorical": categorical, "temporal": temporal}


def fit_supervised(name, task, pre, X, y):
    classifying = task in (rc.BINARY, rc.MULTICLASS)
    if classifying:
        y = y.astype(object).astype(str)
    else:
        y = pd.to_numeric(y, errors="coerce")
        keep = y.notna()
        X, y = X[keep], y[keep]

    stratify = y if classifying and y.value_counts().min() >= 2 else None
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=TEST_SIZE, random_state=SEED, stratify=stratify)

    pipe = Pipeline([("prepare", pre), ("model", make_model(name, task))])
    pipe.fit(X_train, y_train)

    if classifying:
        threshold = choose_threshold(pipe, task, X_train, y_train)
        predicted = predict_at(pipe, X_test, threshold)
        metrics = classification_metrics(pipe, X_test, y_test, predicted, task)
        metrics["threshold"] = threshold
        score = metrics["balanced_accuracy"]
    else:
        metrics = regression_metrics(y_test, pipe.predict(X_test))
        score = metrics["r2"]

    return {
        "score": jsonable(float(score)),
        "metrics": metrics,
        "importance": importances(pipe),
        "_pipe": pipe,
        "_holdout": (X_test, y_test),
    }


def choose_threshold(pipe, task, X_train, y_train):
    """Pick the cut-off that balances the classes, on data the score never sees.

    Rare-outcome columns are the normal case in real data. Left at 0.5 every
    model just predicts the majority class and looks accurate while being
    useless, so the cut-off is tuned on a held-back slice of the training rows.
    """
    if task != rc.BINARY or not hasattr(pipe, "predict_proba"):
        return None
    counts = pd.Series(y_train).value_counts()
    if len(counts) != 2 or counts.min() < 20:
        return None
    try:
        X_fit, X_valid, y_fit, y_valid = train_test_split(
            X_train, y_train, test_size=VALIDATION_SIZE, random_state=SEED, stratify=y_train)
        tuned = clone(pipe).fit(X_fit, y_fit)
        positive = tuned.classes_[1]
        proba = tuned.predict_proba(X_valid)[:, 1]
        truth = (y_valid.to_numpy() == positive)
    except Exception:
        return None

    best, best_score = 0.5, -1.0
    for cut in np.quantile(proba, np.linspace(0.02, 0.98, 25)):
        score = balanced_accuracy_score(truth, proba >= cut)
        if score > best_score:
            best, best_score = float(cut), score
    return round(best, 4)


def predict_at(pipe, X_test, threshold):
    if threshold is None:
        return pipe.predict(X_test)
    proba = pipe.predict_proba(X_test)[:, 1]
    return np.where(proba >= threshold, pipe.classes_[1], pipe.classes_[0])


def classification_metrics(pipe, X_test, y_test, predicted, task):
    labels = sorted(pd.unique(np.concatenate([y_test.to_numpy(), predicted])).tolist())
    out = {
        "accuracy": round(float(accuracy_score(y_test, predicted)), 4),
        "balanced_accuracy": round(float(balanced_accuracy_score(y_test, predicted)), 4),
        "f1": round(float(f1_score(y_test, predicted, average="weighted", zero_division=0)), 4),
        "labels": [str(l) for l in labels],
        "confusion": confusion_matrix(y_test, predicted, labels=labels).tolist(),
        "test_rows": int(len(y_test)),
    }
    if task == rc.BINARY and hasattr(pipe, "predict_proba"):
        try:
            proba = pipe.predict_proba(X_test)[:, 1]
            positive = pipe.classes_[1]
            out["roc_auc"] = round(float(roc_auc_score((y_test == positive).astype(int), proba)), 4)
        except Exception:
            pass
    return out


def regression_metrics(y_test, predicted):
    error = mean_absolute_error(y_test, predicted)
    rmse = float(np.sqrt(mean_squared_error(y_test, predicted)))
    actual = np.asarray(y_test, dtype="float64")
    nonzero = actual != 0
    mape = float(np.mean(np.abs((actual[nonzero] - np.asarray(predicted)[nonzero])
                                / actual[nonzero])) * 100) if nonzero.any() else None
    return {
        "r2": round(float(r2_score(y_test, predicted)), 4),
        "mae": jsonable(round(float(error), 4)),
        "rmse": jsonable(round(rmse, 4)),
        "mape_pct": jsonable(round(mape, 2)) if mape is not None else None,
        "test_rows": int(len(y_test)),
    }


def fit_clustering(name, pre, X):
    encoded = pre.fit_transform(X)
    if name == "kmeans":
        model, k = choose_k(encoded)
        labels = model.labels_
        extra = {"clusters": int(k)}
    elif name == "isolation_forest":
        model = make_model(name, rc.CLUSTERING).fit(encoded)
        labels = model.predict(encoded)
        outliers = int((labels == -1).sum())
        return {
            "score": None,
            "metrics": {"outliers": outliers,
                        "outliers_pct": round(outliers / max(len(labels), 1) * 100, 2),
                        "normal_rows": int((labels == 1).sum())},
            "importance": [],
            "labels_preview": [int(v) for v in labels[:200]],
            "examples": strangest_rows(model, encoded, X),
        }
    else:
        labels = make_model(name, rc.CLUSTERING).fit_predict(encoded)
        extra = {"clusters": int(len(set(labels) - {-1})),
                 "outliers": int((labels == -1).sum())}

    score = silhouette_of(encoded, labels)
    sizes = pd.Series(labels).value_counts().sort_index()
    return {
        "score": jsonable(score),
        "metrics": dict(extra, silhouette=jsonable(score),
                        sizes=[{"cluster": int(k), "count": int(v)} for k, v in sizes.items()]),
        "importance": [],
        "labels_preview": [int(v) for v in labels[:200]],
    }


def strangest_rows(model, encoded, X, count=10):
    """The rows the model found least normal, so the UI can show real examples."""
    try:
        scores = model.score_samples(encoded)  # lower means more anomalous
    except Exception:
        return []
    order = np.argsort(scores)[:count]
    rows = X.iloc[order]
    out = []
    for position, (_, row) in zip(order, rows.iterrows()):
        record = {"deviation": round(float(-scores[position]), 4)}
        for column, value in row.items():
            record[str(column)] = jsonable(
                value.isoformat() if isinstance(value, pd.Timestamp) else value)
        out.append(record)
    return out


def choose_k(encoded, candidates=(2, 3, 4, 5, 6, 7, 8)):
    """Pick the cluster count with the best silhouette, scored on a sample."""
    sample = encoded if len(encoded) <= SILHOUETTE_ROWS else \
        encoded[np.random.default_rng(SEED).choice(len(encoded), SILHOUETTE_ROWS, replace=False)]
    best, best_score = candidates[0], -2.0
    for k in candidates:
        trial = KMeans(n_clusters=k, n_init=5, random_state=SEED).fit(sample)
        try:
            score = silhouette_score(sample, trial.labels_)
        except ValueError:
            continue
        if score > best_score:
            best, best_score = k, score
    return KMeans(n_clusters=best, n_init=10, random_state=SEED).fit(encoded), best


def silhouette_of(encoded, labels):
    valid = np.asarray(labels) != -1
    if len(set(np.asarray(labels)[valid])) < 2:
        return None
    data, marks = np.asarray(encoded)[valid], np.asarray(labels)[valid]
    if len(data) > SILHOUETTE_ROWS:
        pick = np.random.default_rng(SEED).choice(len(data), SILHOUETTE_ROWS, replace=False)
        data, marks = data[pick], marks[pick]
    try:
        return round(float(silhouette_score(data, marks)), 4)
    except ValueError:
        return None


def importances(pipe):
    """Model weights folded back onto the original column names."""
    model = pipe.named_steps["model"]
    prepare = pipe.named_steps["prepare"]
    try:
        names = prepare.get_feature_names_out()
    except Exception:
        return []

    if hasattr(model, "feature_importances_"):
        weights = np.asarray(model.feature_importances_, dtype="float64")
    elif hasattr(model, "coef_"):
        coef = np.asarray(model.coef_, dtype="float64")
        weights = np.abs(coef).mean(axis=0) if coef.ndim > 1 else np.abs(coef)
    else:
        return []
    if len(weights) != len(names):
        return []

    sources = source_columns(prepare)
    totals = {}
    for full, weight in zip(names, weights):
        source = match_source(full, sources)
        totals[source] = totals.get(source, 0.0) + float(weight)
    grand = sum(totals.values()) or 1.0
    ranked = sorted(totals.items(), key=lambda kv: -kv[1])
    return [{"column": k, "weight": round(v / grand, 4)} for k, v in ranked[:20]]


def source_columns(prepare):
    """Original column names per block, longest first so prefixes match correctly."""
    out = {}
    for block, _, columns in prepare.transformers_:
        if isinstance(columns, (list, tuple)):
            out[block] = sorted((str(c) for c in columns), key=len, reverse=True)
    return out


def match_source(feature_name, sources):
    """'categorical__city_pune' and 'temporal__day__hour' both came from one column."""
    block, _, rest = feature_name.partition("__")
    for column in sources.get(block, []):
        if rest == column or rest.startswith(column + "_"):
            return column
    return rest or feature_name


def permutation_importance_of(result):
    """Fallback for models with no built-in weights (the boosted ones).

    Shuffling one column at a time costs a predict per column, so it runs on a
    small slice of the holdout and only for the model that actually won.
    """
    pipe, holdout = result.get("_pipe"), result.get("_holdout")
    if pipe is None or holdout is None:
        return []
    X_test, y_test = holdout
    if len(X_test) > PERMUTATION_ROWS:
        X_test = X_test.head(PERMUTATION_ROWS)
        y_test = y_test.head(PERMUTATION_ROWS)
    try:
        with warnings.catch_warnings():
            warnings.simplefilter("ignore")
            report = permutation_importance(
                pipe, X_test, y_test, n_repeats=PERMUTATION_REPEATS,
                random_state=SEED, n_jobs=-1)
    except Exception:
        return []
    weights = np.clip(report.importances_mean, 0, None)
    grand = float(weights.sum()) or 1.0
    ranked = sorted(zip(X_test.columns, weights), key=lambda kv: -kv[1])
    return [{"column": str(k), "weight": round(float(v) / grand, 4)}
            for k, v in ranked[:20] if v > 0]

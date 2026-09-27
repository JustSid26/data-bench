'''
turning a trained model into a script someone can run without DataBench

The script is generated from what the job actually used -- the columns each
preprocessing block saw, the resolved hyperparameters, the split, the row cap,
the decision threshold -- so running it on the same file reproduces the score
DataBench showed. Helpers are copied from train.py with inspect.getsource
rather than rewritten, so the two can never drift apart.
'''
import datetime as dt
import inspect
import re

import sklearn

from . import recommend as rc
from . import train as tr

HEADER = '''"""
{title}

Exported from DataBench on {date}.
  data      {source}
  task      {task}{target_line}
  score     {score_line}

Run it:
  pip install "scikit-learn=={sklearn}" pandas pyarrow openpyxl joblib
  python {filename} path/to/{source}

With the same file this reproduces the score above; the fitted pipeline is
saved next to the script as {model_file}.
"""
'''


def _kwargs(model):
    """Constructor arguments that differ from the estimator's own defaults."""
    defaults = type(model)().get_params(deep=False)
    changed = {k: v for k, v in model.get_params(deep=False).items() if defaults.get(k, object()) != v}
    return ", ".join("%s=%r" % kv for kv in sorted(changed.items()))


def _loader(source):
    fmt = (source.get("format") or "csv").lower()
    if fmt in ("csv", "txt", "tsv"):
        sep = source.get("separator") or ("\t" if fmt == "tsv" else ",")
        return "pd.read_csv(path, sep=%r)" % sep
    if fmt in ("xlsx", "xlsm", "xls"):
        return "pd.read_excel(path)"
    if fmt in ("parquet", "pq"):
        return "pd.read_parquet(path)"
    if fmt in ("jsonl", "ndjson"):
        return "pd.read_json(path, lines=True)"
    return "pd.read_json(path)"


def _preprocessor(columns, scaled):
    blocks = []
    if columns["numeric"]:
        steps = '("fill", SimpleImputer(strategy="median"))'
        if scaled:
            steps += ', ("scale", StandardScaler())'
        blocks.append('    ("numeric", Pipeline([%s]), NUMERIC),' % steps)
    if columns["categorical"]:
        blocks.append(
            '    ("categorical", Pipeline([\n'
            '        ("fill", SimpleImputer(strategy="most_frequent")),\n'
            '        ("encode", OneHotEncoder(handle_unknown="infrequent_if_exist", min_frequency=%r,\n'
            '                                 max_categories=%r, sparse_output=False)),\n'
            '    ]), CATEGORICAL),' % (tr.MIN_CATEGORY_FREQUENCY, tr.MAX_CATEGORIES))
    if columns["temporal"]:
        steps = ('("expand", FunctionTransformer(expand_datetimes, feature_names_out=datetime_names)), '
                 '("fill", SimpleImputer(strategy="median"))')
        if scaled:
            steps += ', ("scale", StandardScaler())'
        blocks.append('    ("temporal", Pipeline([%s]), TEMPORAL),' % steps)
    return "preprocess = ColumnTransformer([\n%s\n], remainder=\"drop\")" % "\n".join(blocks)


def _public_module(cls):
    """sklearn.ensemble._forest -> sklearn.ensemble: import from the public package."""
    parts = cls.__module__.split(".")
    cut = next((i for i, p in enumerate(parts) if p.startswith("_")), len(parts))
    return ".".join(parts[:cut])


def _slug(text):
    return re.sub(r"[^a-z0-9]+", "_", str(text).lower()).strip("_") or "data"


def script(job, result):
    """(python source, suggested filename) for one trained result of a finished job."""
    training = job["result"]
    plan = job["plan"]
    task, target = training["task"], training["target"]
    name = result["algorithm"]
    source = job.get("source") or {"name": "data.csv", "format": "csv"}
    columns, scaled, values = result["columns"], result["scaled"], result["params"]
    clustering = task == rc.CLUSTERING
    classifying = task in (rc.BINARY, rc.MULTICLASS)
    filename = "databench_%s_%s.py" % (_slug(name), _slug(target or "clusters"))
    model_file = filename.replace(".py", ".joblib")

    if name == "kmeans":
        k = result["metrics"].get("clusters")
        model = tr.KMeans(n_clusters=k, random_state=tr.SEED, **tr.ps.estimator_kwargs(values))
    else:
        model = tr.make_model(name, task, values)
    model_line = "model = %s(%s)" % (type(model).__name__, _kwargs(model))

    score = result.get("score")
    score_line = "%s %s (DataBench)" % (training["score_name"], score) if score is not None else \
        "%s%% of rows flagged as outliers (DataBench)" % result["metrics"].get("outliers_pct")
    header = HEADER.format(
        title="%s %s" % (name.replace("_", " ").capitalize(),
                         "predicting `%s`" % target if target else "on unlabelled rows"),
        date=dt.date.today().isoformat(), source=source.get("name"), task=task.replace("_", " "),
        target_line="\n  target    %s" % target if target else "", score_line=score_line,
        sklearn=sklearn.__version__, filename=filename, model_file=model_file)

    imports = [
        "import sys", "", "import joblib", "import numpy as np", "import pandas as pd",
        "from sklearn.compose import ColumnTransformer",
        "from sklearn.impute import SimpleImputer",
        "from sklearn.pipeline import Pipeline",
        "from sklearn.preprocessing import FunctionTransformer, OneHotEncoder, StandardScaler",
        "from %s import %s" % (_public_module(type(model)), type(model).__name__),
    ]
    if clustering:
        imports.append("from sklearn.metrics import silhouette_score")
    else:
        imports.append("from sklearn.model_selection import train_test_split")
        imports.append("from sklearn.metrics import accuracy_score, balanced_accuracy_score, classification_report"
                       if classifying else "from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score")

    used = columns["numeric"] + columns["categorical"] + columns["temporal"]
    settings = [
        "DATA = sys.argv[1] if len(sys.argv) > 1 else %r" % source.get("name"),
        "TARGET = %r" % target,
        "NUMERIC = %r" % columns["numeric"],
        "CATEGORICAL = %r" % columns["categorical"],
        "TEMPORAL = %r" % columns["temporal"],
        "SEED = %d" % tr.SEED,
        "MAX_ROWS = %d  # DataBench trains on at most this many rows" % training.get("max_rows", tr.MAX_TRAIN_ROWS),
    ]
    if not clustering:
        settings.append("TEST_SIZE = %r" % training.get("test_size", tr.TEST_SIZE))
    threshold = result["metrics"].get("threshold") if task == rc.BINARY else None
    if task == rc.BINARY:
        settings.append("THRESHOLD = %r  # decision cut-off DataBench tuned for balanced classes; None = 0.5"
                        % threshold)
    if columns["temporal"]:
        helpers = inspect.getsource(tr.expand_datetimes) + "\n\n" + inspect.getsource(tr.datetime_names)
    else:
        helpers = ""

    load = [
        "def load(path):",
        "    df = %s" % _loader(source),
        "    df.columns = [str(c).strip() for c in df.columns]",
        "    # the same column types DataBench trained with",
        "    for name in NUMERIC:",
        "        df[name] = pd.to_numeric(df[name].replace(r\"^\\s*$\", np.nan, regex=True), errors=\"coerce\")",
        "    for name in TEMPORAL:",
        "        df[name] = pd.to_datetime(df[name], errors=\"coerce\")",
        "    for name in CATEGORICAL:",
        "        df[name] = df[name].astype(object).where(df[name].notna(), np.nan)",
        "    return df",
    ]

    body = ["df = load(DATA)"]
    if clustering:
        body += [
            "frame = df[NUMERIC + CATEGORICAL + TEMPORAL]",
            "if len(frame) > MAX_ROWS:",
            "    frame = frame.sample(MAX_ROWS, random_state=SEED)",
            "",
            _preprocessor(columns, scaled),
            model_line,
            "",
            "encoded = preprocess.fit_transform(frame)",
        ]
        if name == "isolation_forest":
            body += [
                "labels = model.fit(encoded).predict(encoded)  # -1 = outlier",
                'print("outliers: %d of %d rows (%.2f%%)" % ((labels == -1).sum(), len(labels), (labels == -1).mean() * 100))',
                "frame.assign(outlier=labels == -1).to_csv(%r, index=False)" % filename.replace(".py", "_rows.csv"),
            ]
        else:
            body += [
                "labels = model.fit_predict(encoded)",
                "valid = labels != -1  # dbscan marks noise as -1",
                "data, marks = encoded[valid], labels[valid]",
                "if len(data) > %d:  # silhouette is O(n^2); DataBench scores a fixed sample" % tr.SILHOUETTE_ROWS,
                "    pick = np.random.default_rng(SEED).choice(len(data), %d, replace=False)" % tr.SILHOUETTE_ROWS,
                "    data, marks = data[pick], marks[pick]",
                'print("clusters:", len(set(labels) - {-1}), "| sizes:", pd.Series(labels).value_counts().sort_index().to_dict())',
                'print("silhouette: %.4f" % silhouette_score(data, marks))',
                "frame.assign(cluster=labels).to_csv(%r, index=False)" % filename.replace(".py", "_rows.csv"),
            ]
        body += ["joblib.dump(Pipeline([(\"prepare\", preprocess), (\"model\", model)]), %r)" % model_file,
                 'print("saved", %r)' % model_file]
    else:
        body += [
            "frame = df[NUMERIC + CATEGORICAL + TEMPORAL + [TARGET]].dropna(subset=[TARGET])",
            "if len(frame) > MAX_ROWS:",
            "    frame = frame.sample(MAX_ROWS, random_state=SEED)",
            "X = frame[NUMERIC + CATEGORICAL + TEMPORAL]",
        ]
        if classifying:
            body += ["y = frame[TARGET].astype(object).astype(str)",
                     "stratify = y if y.value_counts().min() >= 2 else None"]
        else:
            body += ["y = pd.to_numeric(frame[TARGET], errors=\"coerce\")",
                     "X, y = X[y.notna()], y[y.notna()]",
                     "stratify = None"]
        body += [
            "X_train, X_test, y_train, y_test = train_test_split(",
            "    X, y, test_size=TEST_SIZE, random_state=SEED, stratify=stratify)",
            "",
            _preprocessor(columns, scaled),
            model_line,
            'pipeline = Pipeline([("prepare", preprocess), ("model", model)])',
            "pipeline.fit(X_train, y_train)",
            "",
        ]
        if task == rc.BINARY:
            body += [
                "if THRESHOLD is None:",
                "    predicted = pipeline.predict(X_test)",
                "else:",
                "    proba = pipeline.predict_proba(X_test)[:, 1]",
                "    predicted = np.where(proba >= THRESHOLD, pipeline.classes_[1], pipeline.classes_[0])",
            ]
        else:
            body += ["predicted = pipeline.predict(X_test)"]
        if classifying:
            body += [
                'print("balanced accuracy: %.4f" % balanced_accuracy_score(y_test, predicted))',
                'print("accuracy:          %.4f" % accuracy_score(y_test, predicted))',
                "print(classification_report(y_test, predicted, zero_division=0))",
            ]
        else:
            body += [
                'print("r2:   %.4f" % r2_score(y_test, predicted))',
                'print("mae:  %.4f" % mean_absolute_error(y_test, predicted))',
                'print("rmse: %.4f" % mean_squared_error(y_test, predicted) ** 0.5)',
            ]
        body += ["joblib.dump(pipeline, %r)" % model_file, 'print("saved", %r)' % model_file]

    parts = [header, "\n".join(imports), "\n".join(settings)]
    if helpers:
        parts.append(helpers.strip())
    parts += ["\n".join(load), "\n".join(body)]
    return "\n\n\n".join(p.strip("\n") for p in parts) + "\n", filename

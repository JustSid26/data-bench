'''
the hyperparameters a user may change, per algorithm

Each entry names the real scikit-learn argument, so an override passes
straight through to the estimator and the exported script reads the same.
Every value is range-checked here: the api takes these from the browser, and
an unchecked n_estimators=10_000_000 would take the server down.

Spec fields:
  name      sklearn keyword argument
  type      int | float | choice | bool
  default   value used when the user changes nothing (may differ per task)
  min, max  inclusive bounds for numbers; `log` marks a log-scale range
  nullable  None is allowed, shown as `none_label` ("unlimited", "auto")
  choices   allowed values for a choice
  tasks     "classify" / "regress" / "cluster" -- omitted means every task
'''
from . import recommend as rc

CLASSIFY = "classify"
REGRESS = "regress"
CLUSTER = "cluster"

TEST_SIZE = {"name": "test_size", "label": "Held-out share", "type": "float",
             "default": 0.2, "min": 0.1, "max": 0.5,
             "help": "share of rows kept aside to score every model"}

CLASS_WEIGHT = {"name": "class_weight", "label": "Class weights", "type": "choice",
                "choices": ["balanced", "none"], "default": "balanced", "tasks": [CLASSIFY],
                "help": "balanced makes rare classes count as much as common ones"}

SPECS = {
    "gradient_boosting": [
        {"name": "learning_rate", "label": "Learning rate", "type": "float", "default": 0.1,
         "min": 0.001, "max": 1.0, "log": True, "help": "smaller learns slower but generalises better"},
        {"name": "max_iter", "label": "Boosting rounds", "type": "int", "default": 200,
         "min": 10, "max": 2000, "help": "trees added one after another"},
        {"name": "max_depth", "label": "Max depth", "type": "int", "default": None, "nullable": True,
         "none_label": "unlimited", "min": 1, "max": 100},
        {"name": "max_leaf_nodes", "label": "Leaves per tree", "type": "int", "default": 31,
         "min": 2, "max": 512},
        {"name": "min_samples_leaf", "label": "Min rows per leaf", "type": "int", "default": 20,
         "min": 1, "max": 500},
        {"name": "l2_regularization", "label": "L2 regularisation", "type": "float", "default": 0.0,
         "min": 0.0, "max": 100.0},
        {"name": "early_stopping", "label": "Early stopping", "type": "bool", "default": True,
         "help": "stop adding trees once a validation slice stops improving"},
        CLASS_WEIGHT,
    ],
    "random_forest": [
        {"name": "n_estimators", "label": "Trees", "type": "int", "default": 100, "min": 10, "max": 1000},
        {"name": "max_depth", "label": "Max depth", "type": "int", "default": None, "nullable": True,
         "none_label": "unlimited", "min": 1, "max": 100},
        {"name": "min_samples_split", "label": "Min rows to split", "type": "int", "default": 2,
         "min": 2, "max": 200},
        {"name": "min_samples_leaf", "label": "Min rows per leaf", "type": "int", "default": 1,
         "min": 1, "max": 200},
        {"name": "max_features", "label": "Features per split", "type": "choice",
         "choices": ["sqrt", "log2", "all"], "default": {CLASSIFY: "sqrt", REGRESS: "all"}},
        {"name": "bootstrap", "label": "Bootstrap rows", "type": "bool", "default": True},
        CLASS_WEIGHT,
    ],
    "logistic_regression": [
        {"name": "C", "label": "Inverse regularisation (C)", "type": "float", "default": 1.0,
         "min": 0.0001, "max": 10000.0, "log": True, "help": "smaller C = simpler, more regularised model"},
        {"name": "max_iter", "label": "Max iterations", "type": "int", "default": 1000,
         "min": 100, "max": 10000},
        CLASS_WEIGHT,
    ],
    "ridge": [
        {"name": "alpha", "label": "Regularisation (alpha)", "type": "float", "default": 1.0,
         "min": 0.0001, "max": 10000.0, "log": True, "help": "larger alpha shrinks coefficients harder"},
    ],
    "decision_tree": [
        {"name": "max_depth", "label": "Max depth", "type": "int", "default": 6, "nullable": True,
         "none_label": "unlimited", "min": 1, "max": 100},
        {"name": "min_samples_split", "label": "Min rows to split", "type": "int", "default": 2,
         "min": 2, "max": 200},
        {"name": "min_samples_leaf", "label": "Min rows per leaf", "type": "int", "default": 1,
         "min": 1, "max": 200},
        {"name": "criterion", "label": "Split criterion", "type": "choice",
         "choices": {CLASSIFY: ["gini", "entropy", "log_loss"],
                     REGRESS: ["squared_error", "friedman_mse", "absolute_error"]},
         "default": {CLASSIFY: "gini", REGRESS: "squared_error"}},
        CLASS_WEIGHT,
    ],
    "kmeans": [
        {"name": "n_clusters", "label": "Clusters (k)", "type": "int", "default": None, "nullable": True,
         "none_label": "auto (2-8 by silhouette)", "min": 2, "max": 30},
        {"name": "n_init", "label": "Restarts", "type": "int", "default": 10, "min": 1, "max": 50},
        {"name": "max_iter", "label": "Max iterations", "type": "int", "default": 300, "min": 10, "max": 1000},
    ],
    "dbscan": [
        {"name": "eps", "label": "Neighbourhood radius (eps)", "type": "float", "default": 0.5,
         "min": 0.01, "max": 50.0, "log": True, "help": "features are standardised, so this is in standard deviations"},
        {"name": "min_samples", "label": "Min neighbours", "type": "int", "default": 5, "min": 1, "max": 200},
        {"name": "metric", "label": "Distance", "type": "choice",
         "choices": ["euclidean", "manhattan", "cosine"], "default": "euclidean"},
    ],
    "isolation_forest": [
        {"name": "n_estimators", "label": "Trees", "type": "int", "default": 150, "min": 10, "max": 1000},
        {"name": "contamination", "label": "Expected outlier share", "type": "float", "default": 0.05,
         "min": 0.001, "max": 0.5},
    ],
}


def task_group(task):
    if task in (rc.BINARY, rc.MULTICLASS):
        return CLASSIFY
    return REGRESS if task == rc.REGRESSION else CLUSTER


def _for_task(value, group):
    '''Unwrap a per-task default or choice list.'''
    return value.get(group) if isinstance(value, dict) else value


def specs_for(name, task):
    '''The parameters shown for this algorithm on this task, defaults resolved.'''
    group = task_group(task)
    out = []
    for spec in SPECS.get(name, []):
        if "tasks" in spec and group not in spec["tasks"]:
            continue
        resolved = dict(spec, default=_for_task(spec["default"], group))
        resolved.pop("tasks", None)
        if "choices" in spec:
            resolved["choices"] = _for_task(spec["choices"], group)
        out.append(resolved)
    return out


def check(spec, value):
    '''Validate one value against its spec; returns the cleaned value.'''
    label = spec["name"]
    if value is None:
        if spec.get("nullable"):
            return None
        raise ValueError("%s cannot be empty" % label)
    kind = spec["type"]
    if kind == "bool":
        if not isinstance(value, bool):
            raise ValueError("%s must be true or false" % label)
        return value
    if kind == "choice":
        if value not in spec["choices"]:
            raise ValueError("%s must be one of %s" % (label, ", ".join(spec["choices"])))
        return value
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        raise ValueError("%s must be a number" % label)
    if kind == "int":
        if float(value) != int(value):
            raise ValueError("%s must be a whole number" % label)
        value = int(value)
    else:
        value = float(value)
    if not spec["min"] <= value <= spec["max"]:
        raise ValueError("%s must be between %s and %s" % (label, spec["min"], spec["max"]))
    return value


def resolve(name, task, overrides=None):
    '''Every parameter for this algorithm: defaults, with checked overrides on top.'''
    specs = {s["name"]: s for s in specs_for(name, task)}
    chosen = {n: s["default"] for n, s in specs.items()}
    for key, value in (overrides or {}).items():
        if key not in specs:
            raise ValueError("%s has no setting '%s'" % (name, key))
        chosen[key] = check(specs[key], value)
    return chosen


def validate_request(task, algorithms, overrides, test_size):
    '''Check a whole train request up front, so a bad value is a 400, not a failed job.'''
    overrides = overrides or {}
    if not isinstance(overrides, dict):
        raise ValueError("params must map algorithm names to settings")
    for name, values in overrides.items():
        if name not in SPECS:
            raise ValueError("unknown algorithm '%s'" % name)
        if not isinstance(values, dict):
            raise ValueError("settings for %s must be an object" % name)
        resolve(name, task, values)
    if algorithms:
        unknown = [a for a in algorithms if a not in SPECS]
        if unknown:
            raise ValueError("unknown algorithm '%s'" % unknown[0])
    return overrides, check(TEST_SIZE, test_size if test_size is not None else TEST_SIZE["default"])


def estimator_kwargs(values):
    '''Spec values -> sklearn keyword arguments (the few UI spellings mapped back).'''
    kwargs = dict(values)
    if kwargs.get("class_weight") == "none":
        kwargs["class_weight"] = None
    if kwargs.get("max_features") == "all":
        kwargs["max_features"] = 1.0
    kwargs.pop("n_clusters", None)  # kmeans picks k itself when this is None; handled by the caller
    return kwargs

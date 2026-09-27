import re
import subprocess
import sys
import time

import pytest
from fastapi.testclient import TestClient

from ads.api import app
from ads.store import store


@pytest.fixture
def client():
    return TestClient(app)


@pytest.fixture
def dataset(client, csv_path):
    body = client.post("/api/datasets/from-path", json={"path": csv_path}).json()
    yield body
    store.drop(body["id"])


def train(client, dataset, **body):
    started = client.post("/api/datasets/%s/train" % dataset["id"], json=body)
    assert started.status_code == 200, started.json()
    job = started.json()["job"]
    for _ in range(300):
        state = client.get("/api/jobs/%s" % job).json()
        if state["state"] != "running":
            break
        time.sleep(0.1)
    assert state["state"] == "done", state
    return job, {r["algorithm"]: r for r in state["result"]["results"]}


def test_plan_lists_editable_settings_per_algorithm(client, dataset):
    plan = client.get("/api/datasets/%s/plan?target=converted" % dataset["id"]).json()
    forest = next(a for a in plan["algorithms"] if a["name"] == "random_forest")
    names = {p["name"] for p in forest["params"]}
    assert {"n_estimators", "max_depth", "class_weight"} <= names
    assert plan["test_size"]["default"] == 0.2
    ridge = client.get("/api/datasets/%s/plan?target=revenue" % dataset["id"]).json()
    assert all(p["name"] != "class_weight" for a in ridge["algorithms"] for p in a["params"])


@pytest.mark.parametrize("params,message", [
    ({"random_forest": {"n_estimators": 10_000_000}}, "between"),
    ({"random_forest": {"n_estimators": 2.5}}, "whole number"),
    ({"random_forest": {"bogus": 1}}, "no setting"),
    ({"decision_tree": {"criterion": "wat"}}, "one of"),
    ({"not_a_model": {}}, "unknown algorithm"),
])
def test_bad_settings_are_a_clear_400(client, dataset, params, message):
    response = client.post("/api/datasets/%s/train" % dataset["id"],
                           json={"target": "converted", "algorithms": ["random_forest"], "params": params})
    assert response.status_code == 400
    assert message in response.json()["detail"]


def test_custom_settings_are_used_and_reported(client, dataset):
    _, results = train(client, dataset, target="converted", algorithms=["decision_tree", "random_forest"],
                       params={"decision_tree": {"max_depth": 1}, "random_forest": {"n_estimators": 12}},
                       test_size=0.3)
    assert results["decision_tree"]["params"]["max_depth"] == 1
    assert results["random_forest"]["params"]["n_estimators"] == 12
    assert results["decision_tree"]["metrics"]["test_rows"] == 180  # 30% of 600


def run_export(client, job, algorithm, csv_path, tmp_path):
    response = client.get("/api/jobs/%s/code?algorithm=%s" % (job, algorithm))
    assert response.status_code == 200, response.text
    assert "attachment" in response.headers["content-disposition"]
    script = tmp_path / ("%s.py" % algorithm)
    script.write_text(response.text)
    done = subprocess.run([sys.executable, str(script), csv_path], cwd=tmp_path,
                          capture_output=True, text=True, timeout=300)
    assert done.returncode == 0, done.stderr
    return done.stdout


def printed(output, label):
    return float(re.search(r"%s:\s+(-?[0-9.]+)" % label, output).group(1))


@pytest.mark.parametrize("algorithm", ["gradient_boosting", "random_forest", "logistic_regression", "decision_tree"])
def test_exported_classifier_reproduces_the_score(client, dataset, csv_path, tmp_path, algorithm):
    job, results = train(client, dataset, target="converted", algorithms=[algorithm],
                         params={algorithm: {"class_weight": "balanced"}})
    output = run_export(client, job, algorithm, csv_path, tmp_path)
    assert printed(output, "balanced accuracy") == pytest.approx(results[algorithm]["score"], abs=0.02)


@pytest.mark.parametrize("algorithm", ["ridge", "random_forest"])
def test_exported_regressor_reproduces_the_score(client, dataset, csv_path, tmp_path, algorithm):
    job, results = train(client, dataset, target="revenue", algorithms=[algorithm])
    output = run_export(client, job, algorithm, csv_path, tmp_path)
    assert printed(output, "r2") == pytest.approx(results[algorithm]["score"], abs=0.02)


def test_exported_clustering_runs_with_the_chosen_k(client, dataset, csv_path, tmp_path):
    job, results = train(client, dataset, target=None, algorithms=["kmeans"],
                         params={"kmeans": {"n_clusters": 4}})
    assert results["kmeans"]["metrics"]["clusters"] == 4
    output = run_export(client, job, "kmeans", csv_path, tmp_path)
    assert printed(output, "silhouette") == pytest.approx(results["kmeans"]["score"], abs=0.02)


def test_code_for_an_unknown_algorithm_is_a_404(client, dataset):
    job, _ = train(client, dataset, target="converted", algorithms=["decision_tree"])
    assert client.get("/api/jobs/%s/code?algorithm=ridge" % job).status_code == 404

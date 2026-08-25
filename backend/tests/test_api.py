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


def test_health(client):
    assert client.get("/api/health").json()["ok"] is True


def test_upload_answers_with_everything_the_first_screen_needs(client, csv_path):
    with open(csv_path, "rb") as handle:
        response = client.post("/api/datasets", files={"file": ("sample.csv", handle, "text/csv")})
    body = response.json()
    assert response.status_code == 200
    assert body["meta"]["rows"] == 600
    assert len(body["schema"]) == 10
    assert len(body["preview"]["rows"]) == 50
    assert body["suggested_targets"][0]["kind"] in ("boolean", "categorical")
    store.drop(body["id"])


def test_unsupported_file_is_a_clear_400(client):
    response = client.post("/api/datasets", files={"file": ("a.docx", b"junk", "application/msword")})
    assert response.status_code == 400 and "supported" in response.json()["detail"]


def test_missing_dataset_is_a_404(client):
    assert client.get("/api/datasets/nope/profile").status_code == 404


def test_profile_endpoint(client, dataset):
    report = client.get("/api/datasets/%s/profile" % dataset["id"]).json()
    assert report["rows"] == 600 and report["column_stats"]


def test_profile_is_cached_so_the_second_call_is_free(client, dataset):
    url = "/api/datasets/%s/profile" % dataset["id"]
    client.get(url)
    started = time.perf_counter()
    client.get(url)
    assert (time.perf_counter() - started) < 0.05


def test_plan_endpoint_and_bad_target(client, dataset):
    plan = client.get("/api/datasets/%s/plan" % dataset["id"], params={"target": "converted"}).json()
    assert plan["task"] == "binary_classification" and plan["algorithms"]
    bad = client.get("/api/datasets/%s/plan" % dataset["id"], params={"target": "nope"})
    assert bad.status_code == 400


def test_training_runs_as_a_job(client, dataset):
    started = client.post("/api/datasets/%s/train" % dataset["id"],
                          json={"target": "converted", "algorithms": ["decision_tree"]}).json()
    assert started["state"] == "running" and started["plan"]["task"] == "binary_classification"

    for _ in range(100):
        job = client.get("/api/jobs/%s" % started["job"]).json()
        if job["state"] != "running":
            break
        time.sleep(0.1)
    assert job["state"] == "done", job.get("error")
    assert job["result"]["best"] == "decision_tree"
    assert job["result"]["results"][0]["metrics"]["confusion"]


def test_preview_row_count_is_bounded(client, dataset):
    assert client.get("/api/datasets/%s/preview" % dataset["id"],
                      params={"rows": 5000}).status_code == 422


def test_delete_forgets_the_dataset(client, csv_path):
    body = client.post("/api/datasets/from-path", json={"path": csv_path}).json()
    assert client.delete("/api/datasets/%s" % body["id"]).status_code == 200
    assert client.get("/api/datasets/%s" % body["id"]).status_code == 404

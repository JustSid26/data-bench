import time

import pytest
from fastapi.testclient import TestClient

from ads import api
from ads.blobs import MemoryBlobs
from ads.store import store


@pytest.fixture
def blobs(monkeypatch):
    # the in-memory stand-in for S3; restored to "no backend" after each test
    backend = MemoryBlobs()
    monkeypatch.setattr(api.durable, "backend", backend)
    return backend


@pytest.fixture
def client():
    return TestClient(api.app)


def upload(client, csv_path):
    with open(csv_path, "rb") as handle:
        return client.post("/api/datasets", files={"file": ("sample.csv", handle, "text/csv")}).json()


def test_without_a_bucket_nothing_is_persisted(client):
    assert client.get("/api/health").json()["storage"] == "none"


def test_upload_writes_the_file_and_its_meta(client, csv_path, blobs):
    body = upload(client, csv_path)
    assert blobs.keys("datasets/%s/" % body["id"]) == [
        "datasets/%s/meta.json" % body["id"],
        "datasets/%s/source.csv" % body["id"],
    ]
    with open(csv_path, "rb") as handle:
        assert blobs.get("datasets/%s/source.csv" % body["id"]) == handle.read()
    assert client.get("/api/health").json()["storage"] == "memory"
    store.drop(body["id"])


def test_a_dataset_memory_lost_is_reloaded_under_the_same_id(client, csv_path, blobs):
    body = upload(client, csv_path)
    store.drop(body["id"])  # what a restart or an eviction does

    described = client.get("/api/datasets/%s" % body["id"])
    assert described.status_code == 200
    assert described.json()["meta"]["rows"] == body["meta"]["rows"]
    assert client.get("/api/datasets/%s/profile" % body["id"]).status_code == 200
    store.drop(body["id"])


def test_the_list_includes_saved_datasets_not_in_memory(client, csv_path, blobs):
    body = upload(client, csv_path)
    store.drop(body["id"])
    listed = {item["id"] for item in client.get("/api/datasets").json()["datasets"]}
    assert body["id"] in listed


def test_finished_jobs_survive_a_restart(client, csv_path, blobs):
    body = upload(client, csv_path)
    job = client.post("/api/datasets/%s/train" % body["id"], json={"target": "converted"}).json()["job"]
    for _ in range(100):
        if client.get("/api/jobs/%s" % job).json()["state"] != "running":
            break
        time.sleep(0.1)

    with api.jobs_lock:
        api.jobs.clear()  # the process restarted
    status = client.get("/api/jobs/%s" % job)
    assert status.status_code == 200
    assert status.json()["state"] == "done"
    assert status.json()["result"]["best"]
    store.drop(body["id"])


def test_delete_removes_the_saved_copy_too(client, csv_path, blobs):
    body = upload(client, csv_path)
    store.drop(body["id"])
    assert client.delete("/api/datasets/%s" % body["id"]).status_code == 200
    assert blobs.keys("datasets/%s/" % body["id"]) == []
    assert client.get("/api/datasets/%s" % body["id"]).status_code == 404


def test_a_failing_bucket_never_fails_the_upload(client, csv_path, monkeypatch):
    class Broken(MemoryBlobs):
        def put(self, *args, **kwargs):
            raise RuntimeError("bucket unreachable")

    monkeypatch.setattr(api.durable, "backend", Broken())
    body = upload(client, csv_path)
    assert body["id"]
    assert client.get("/api/datasets/%s/profile" % body["id"]).status_code == 200
    store.drop(body["id"])

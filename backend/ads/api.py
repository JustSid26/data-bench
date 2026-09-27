'''
the http surface the frontend talks to

Latency choices that matter here:
  - upload answers with meta + schema + preview in one response, so the first
    screen needs a single round trip
  - profiles and plans are cached per dataset, so revisiting a tab is instant
  - every pandas/sklearn call runs in a worker thread, so one slow train never
    blocks the event loop for everyone else
  - training returns a job id immediately and is polled
'''
import os
import threading
import time
import uuid
from concurrent.futures import ThreadPoolExecutor

from fastapi import Body, FastAPI, HTTPException, Query, UploadFile
from fastapi.concurrency import run_in_threadpool
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from starlette.exceptions import HTTPException as StarletteHTTPException

from . import profile as pf
from . import recommend as rc
from . import train as tr
from .blobs import durable
from .ingest import IngestError, preview, read_any
from .schema import infer_schema
from .store import store

MAX_UPLOAD_MB = 512
PREVIEW_ROWS = 50

# the built ui, when it exists -- served from the same origin so the browser
# never pays for a preflight and there is no cors round trip in production
BUNDLE = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(
    os.path.abspath(__file__)))), "frontend", "dist")

service = FastAPI(title="DataBench API", version="0.1.0",
                  description="load data, understand it, and run the models that fit it")
service.add_middleware(GZipMiddleware, minimum_size=1024)
service.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

jobs = {}
jobs_lock = threading.Lock()
# training runs on its own small pool rather than an event-loop task, so a job
# outlives the request that started it no matter how the app is served
trainers = ThreadPoolExecutor(max_workers=2, thread_name_prefix="databench-train")


@service.get("/health")
def health():
    return {"ok": True, "datasets": len(store.list()), "storage": durable.kind}


@service.get("/datasets")
def list_datasets():
    """Loaded datasets, plus ones kept in durable storage that a restart or
    eviction dropped from memory -- opening one reloads it."""
    loaded = store.list()
    seen = {item["id"] for item in loaded}
    saved = [dict(r["meta"], id=r["id"], created=r["created"])
             for r in durable.list_datasets() if r["id"] not in seen]
    return {"datasets": sorted(loaded + saved, key=lambda d: -d["created"])}


@service.post("/datasets")
async def upload(file: UploadFile):
    """Read an uploaded file and answer with everything the first screen needs."""
    raw = await file.read()
    if len(raw) > MAX_UPLOAD_MB * 1_000_000:
        raise HTTPException(413, "file is larger than %d MB" % MAX_UPLOAD_MB)
    return await load_bytes(raw, file.filename)


@service.post("/datasets/from-path")
async def upload_path(path: str = Body(..., embed=True)):
    """Load a file already on the server -- no copy, so this is the fast path."""
    if not os.path.isfile(path):
        raise HTTPException(404, "no file at '%s'" % path)
    with open(path, "rb") as handle:
        return await load_bytes(handle.read(), os.path.basename(path))


async def load_bytes(raw, name):
    try:
        df, meta = await run_in_threadpool(read_any, raw, name)
    except IngestError as error:
        raise HTTPException(400, str(error))
    except Exception as error:
        raise HTTPException(400, "could not read %s: %s" % (name, error))
    if df.empty:
        raise HTTPException(400, "%s has no rows" % name)

    key = store.add(df, meta)
    await run_in_threadpool(durable.save_dataset, key, raw, name, meta, store.get(key)["created"])
    schema = await run_in_threadpool(store.cached, key, "schema", infer_schema)
    return {
        "id": key,
        "meta": meta,
        "schema": schema,
        "preview": preview(df, PREVIEW_ROWS),
        "suggested_targets": suggest_targets(schema),
    }


def suggest_targets(schema):
    """Columns worth offering as a prediction target, most likely first."""
    order = {"boolean": 0, "categorical": 1, "numeric": 2, "datetime": 4}
    picks = [c for c in schema if c["kind"] in order]
    picks.sort(key=lambda c: order[c["kind"]])
    return [{"name": c["name"], "kind": c["kind"]} for c in picks[:20]]


def entry_or_404(dataset_id):
    """The loaded dataset, reloading it from durable storage when memory lost it."""
    try:
        return store.get(dataset_id)
    except KeyError as error:
        saved = durable.load_dataset(dataset_id)
        if saved is None:
            raise HTTPException(404, str(error))
        raw, record = saved
        df, _ = read_any(raw, record["name"])
        store.add(df, record["meta"], key=dataset_id, created=record["created"])
        return store.get(dataset_id)


async def loaded_or_404(dataset_id):
    # a restore parses a whole file, so keep it off the event loop
    return await run_in_threadpool(entry_or_404, dataset_id)


@service.get("/datasets/{dataset_id}")
async def describe(dataset_id: str):
    entry = await loaded_or_404(dataset_id)
    schema = await run_in_threadpool(store.cached, dataset_id, "schema", infer_schema)
    return {"id": dataset_id, "meta": entry["meta"], "schema": schema,
            "suggested_targets": suggest_targets(schema)}


@service.get("/datasets/{dataset_id}/preview")
def preview_rows(dataset_id: str, rows: int = Query(PREVIEW_ROWS, ge=1, le=1000)):
    entry = entry_or_404(dataset_id)
    return preview(entry["df"], rows)


@service.get("/datasets/{dataset_id}/profile")
async def profile_dataset(dataset_id: str):
    await loaded_or_404(dataset_id)
    schema = await run_in_threadpool(store.cached, dataset_id, "schema", infer_schema)
    return await run_in_threadpool(
        store.cached, dataset_id, "profile", lambda df: pf.profile(df, schema))


@service.get("/datasets/{dataset_id}/plan")
async def plan_models(dataset_id: str, target: str = Query(None)):
    entry = await loaded_or_404(dataset_id)
    schema = await run_in_threadpool(store.cached, dataset_id, "schema", infer_schema)
    try:
        return await run_in_threadpool(rc.plan, entry["df"], schema, target)
    except ValueError as error:
        raise HTTPException(400, str(error))


@service.post("/datasets/{dataset_id}/train")
async def start_training(dataset_id: str, body: dict = Body(default={})):
    entry = await loaded_or_404(dataset_id)
    schema = await run_in_threadpool(store.cached, dataset_id, "schema", infer_schema)
    target = body.get("target")
    try:
        plan = await run_in_threadpool(rc.plan, entry["df"], schema, target)
    except ValueError as error:
        raise HTTPException(400, str(error))

    algorithms = body.get("algorithms") or None
    max_rows = int(body.get("max_rows") or tr.MAX_TRAIN_ROWS)
    job_id = uuid.uuid4().hex[:12]
    with jobs_lock:
        jobs[job_id] = {"id": job_id, "dataset": dataset_id, "state": "running",
                        "plan": plan, "started": time.time(), "result": None, "error": None}

    trainers.submit(run_job, job_id, entry["df"], plan, algorithms, max_rows)
    return {"job": job_id, "state": "running", "plan": plan}


# a job still "running" after this long is reported as failed, so the ui can
# never spin forever on a job whose worker died
JOB_TIMEOUT_S = 20 * 60


def run_job(job_id, df, plan, algorithms, max_rows):
    try:
        finish(job_id, "done", result=tr.run(df, plan, algorithms, max_rows))
    except BaseException as error:  # noqa: B036 -- a job must always end in a state
        finish(job_id, "failed", error=str(error) or type(error).__name__)


def finish(job_id, state, result=None, error=None):
    with jobs_lock:
        job = jobs.get(job_id)
        if job is None:
            return
        job.update(state=state, result=result, error=error,
                   elapsed_ms=round((time.time() - job["started"]) * 1000, 1))
        record = dict(job)
    # finished jobs outlive the process: results stay readable after a restart
    durable.save_job(record)


@service.get("/jobs/{job_id}")
def job_status(job_id: str):
    with jobs_lock:
        job = jobs.get(job_id)
    if job is None:
        job = durable.load_job(job_id)
    if job is None:
        raise HTTPException(404, "no job '%s'" % job_id)
    if job["state"] == "running" and time.time() - job["started"] > JOB_TIMEOUT_S:
        finish(job_id, "failed", error="training did not finish within %d minutes" % (JOB_TIMEOUT_S // 60))
    return job


@service.delete("/datasets/{dataset_id}")
def forget(dataset_id: str):
    try:
        store.get(dataset_id)
    except KeyError:
        # not in memory -- still forgettable if it only lives in the bucket
        if not durable.has_dataset(dataset_id):
            raise HTTPException(404, "dataset '%s' is not loaded, upload it again" % dataset_id)
    store.drop(dataset_id)
    durable.forget_dataset(dataset_id)
    return {"removed": dataset_id}


class SinglePageFiles(StaticFiles):
    """Serve the built bundle, falling back to index.html.

    The ui routes on the client, so /analyse is a real url the server has no
    file for. Without this fallback a refresh on any screen but / would 404.
    """

    async def get_response(self, path, scope):
        try:
            return await super().get_response(path, scope)
        except StarletteHTTPException as error:
            if error.status_code == 404:
                return FileResponse(os.path.join(self.directory, "index.html"))
            raise


app = FastAPI(title="DataBench", version="0.1.0")
app.mount("/api", service)

if os.path.isdir(BUNDLE):
    app.mount("/", SinglePageFiles(directory=BUNDLE, html=True), name="ui")
else:
    @app.get("/")
    def no_bundle():
        return {
            "api": "/api",
            "docs": "/api/docs",
            "ui": "not built -- run `npm install && npm run build` in frontend/",
        }

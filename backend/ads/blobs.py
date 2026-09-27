'''
durable copies of datasets and training results

The Store keeps parsed frames in memory, which is what makes the app fast, but
memory does not survive a restart or a redeploy. When DATABENCH_BUCKET is set,
every upload and every finished job is also written to S3, and anything the
Store no longer has is read back from there on demand.

Without the variable nothing here touches the network, so local runs and the
tests behave exactly as before.

Layout in the bucket:
  datasets/<id>/meta.json     name, meta and created time
  datasets/<id>/source<ext>   the file exactly as it was uploaded
  jobs/<id>.json              the job record, result included
'''
import json
import logging
import os
import threading

log = logging.getLogger("databench.blobs")

BUCKET = os.environ.get("DATABENCH_BUCKET", "").strip()
# how many past datasets the "already loaded" list reads back from the bucket
LIST_LIMIT = 50


class S3Blobs:
    kind = "s3"

    def __init__(self, bucket):
        import boto3  # only needed when a bucket is configured

        self.bucket = bucket
        # credentials come from the instance's IAM role -- none are stored here
        self.client = boto3.client("s3")

    def put(self, key, body, content_type="application/octet-stream"):
        self.client.put_object(Bucket=self.bucket, Key=key, Body=body, ContentType=content_type)

    def get(self, key):
        try:
            return self.client.get_object(Bucket=self.bucket, Key=key)["Body"].read()
        except self.client.exceptions.NoSuchKey:
            return None

    def keys(self, prefix):
        pages = self.client.get_paginator("list_objects_v2").paginate(Bucket=self.bucket, Prefix=prefix)
        return [item["Key"] for page in pages for item in page.get("Contents", [])]

    def delete_prefix(self, prefix):
        keys = self.keys(prefix)
        for start in range(0, len(keys), 1000):
            batch = [{"Key": k} for k in keys[start:start + 1000]]
            self.client.delete_objects(Bucket=self.bucket, Delete={"Objects": batch})


class MemoryBlobs:
    '''Same interface, kept in a dict -- for tests.'''
    kind = "memory"

    def __init__(self):
        self.items = {}
        self._lock = threading.Lock()

    def put(self, key, body, content_type="application/octet-stream"):
        with self._lock:
            self.items[key] = body if isinstance(body, bytes) else body.encode()

    def get(self, key):
        with self._lock:
            return self.items.get(key)

    def keys(self, prefix):
        with self._lock:
            return sorted(k for k in self.items if k.startswith(prefix))

    def delete_prefix(self, prefix):
        with self._lock:
            for key in [k for k in self.items if k.startswith(prefix)]:
                del self.items[key]


class Durable:
    '''What the api calls. Every method is a no-op without a backend, and a
    failing bucket is logged rather than raised -- S3 trouble should cost
    durability, never an upload that already worked in memory.'''

    def __init__(self, backend=None):
        self.backend = backend

    @property
    def kind(self):
        return self.backend.kind if self.backend else "none"

    def save_dataset(self, key, raw, name, meta, created):
        if not self.backend:
            return
        try:
            ext = os.path.splitext(name)[1].lower()
            self.backend.put("datasets/%s/source%s" % (key, ext), raw)
            record = {"id": key, "name": name, "meta": meta, "created": created, "source": "source%s" % ext}
            self.backend.put("datasets/%s/meta.json" % key, json.dumps(record), "application/json")
        except Exception:
            log.exception("could not save dataset %s to %s", key, self.kind)

    def load_dataset(self, key):
        '''(raw bytes, record) for a saved dataset, or None.'''
        if not self.backend:
            return None
        try:
            record = self.backend.get("datasets/%s/meta.json" % key)
            if record is None:
                return None
            record = json.loads(record)
            raw = self.backend.get("datasets/%s/%s" % (key, record["source"]))
            return (raw, record) if raw is not None else None
        except Exception:
            log.exception("could not load dataset %s from %s", key, self.kind)
            return None

    def has_dataset(self, key):
        if not self.backend:
            return False
        try:
            return self.backend.get("datasets/%s/meta.json" % key) is not None
        except Exception:
            log.exception("could not check dataset %s in %s", key, self.kind)
            return False

    def list_datasets(self):
        '''Saved dataset records, newest first.'''
        if not self.backend:
            return []
        try:
            metas = [k for k in self.backend.keys("datasets/") if k.endswith("/meta.json")]
            records = [json.loads(self.backend.get(k) or "null") for k in metas]
            records = [r for r in records if r]
            return sorted(records, key=lambda r: -r.get("created", 0))[:LIST_LIMIT]
        except Exception:
            log.exception("could not list datasets in %s", self.kind)
            return []

    def forget_dataset(self, key):
        if not self.backend:
            return
        try:
            self.backend.delete_prefix("datasets/%s/" % key)
        except Exception:
            log.exception("could not delete dataset %s from %s", key, self.kind)

    def save_job(self, job):
        if not self.backend:
            return
        try:
            self.backend.put("jobs/%s.json" % job["id"], json.dumps(job, default=str), "application/json")
        except Exception:
            log.exception("could not save job %s to %s", job.get("id"), self.kind)

    def load_job(self, job_id):
        if not self.backend:
            return None
        try:
            body = self.backend.get("jobs/%s.json" % job_id)
            return json.loads(body) if body else None
        except Exception:
            log.exception("could not load job %s from %s", job_id, self.kind)
            return None


durable = Durable(S3Blobs(BUCKET) if BUCKET else None)

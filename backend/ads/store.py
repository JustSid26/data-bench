'''
keeping loaded datasets in memory between requests

Re-reading and re-profiling a file on every call is what makes a data tool feel
slow. A dataset is parsed once, then the schema, profile and plans hang off the
same entry so repeat views are a dictionary lookup.
'''
import threading
import time
import uuid

MAX_DATASETS = 12
TTL_SECONDS = 60 * 60 * 4


class Store:
    def __init__(self, limit=MAX_DATASETS, ttl=TTL_SECONDS):
        self.limit = limit
        self.ttl = ttl
        self._items = {}
        self._lock = threading.Lock()

    def add(self, df, meta):
        key = uuid.uuid4().hex[:12]
        with self._lock:
            self._items[key] = {
                "id": key, "df": df, "meta": meta,
                "cache": {}, "created": time.time(), "touched": time.time(),
            }
            self._evict()
        return key

    def get(self, key):
        with self._lock:
            entry = self._items.get(key)
            if entry is None:
                raise KeyError("dataset '%s' is not loaded, upload it again" % key)
            entry["touched"] = time.time()
            return entry

    def cached(self, key, name, build):
        """Return a computed view, building it only the first time it is asked for."""
        entry = self.get(key)
        if name not in entry["cache"]:
            entry["cache"][name] = build(entry["df"])
        return entry["cache"][name]

    def put(self, key, name, value):
        self.get(key)["cache"][name] = value
        return value

    def drop(self, key):
        with self._lock:
            self._items.pop(key, None)

    def list(self):
        with self._lock:
            self._evict()
            return [dict(e["meta"], id=e["id"], created=e["created"])
                    for e in sorted(self._items.values(), key=lambda e: -e["created"])]

    def _evict(self):
        """Called with the lock held: drop stale entries, then the least recently used."""
        now = time.time()
        for key, entry in list(self._items.items()):
            if now - entry["touched"] > self.ttl:
                del self._items[key]
        while len(self._items) > self.limit:
            oldest = min(self._items.values(), key=lambda e: e["touched"])
            del self._items[oldest["id"]]


store = Store()

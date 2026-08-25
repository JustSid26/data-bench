#!/usr/bin/env bash
# start the api on http://127.0.0.1:8000  (docs at /docs)
set -e
cd "$(dirname "$0")"
exec uvicorn ads.api:app --host 127.0.0.1 --port 8000 --reload "$@"

#!/bin/sh
# The API does not migrate — the one-shot migrate service owns that, and this
# container waits on it. It only needs the DB reachable before serving.
set -e
exec uvicorn app.main:app --host 0.0.0.0 --port 8000 --proxy-headers

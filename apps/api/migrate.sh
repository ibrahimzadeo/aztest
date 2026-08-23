#!/bin/sh
# One-shot migration + seed, run by the aztest-migrate service.
#
# Coolify aborts the whole deployment if this exits non-zero, so the two steps
# have deliberately different failure semantics: a wrong schema must stop the
# deploy, a seeding hiccup must not take the API and worker down with it.
set -e

echo "Running migrations..."
python -m azbench.migrate

echo "Seeding starter task library..."
if ! python -m azbench.seed; then
  echo "WARNING: task seeding reported a problem (see above). The stack will" >&2
  echo "         start; add tasks under Bench -> Tasks if the library is empty." >&2
fi

echo "Migrate step complete."

#!/usr/bin/env bash
cd "$(dirname "$0")/.." || exit 1

PY="$(command -v python3 || command -v python)"
if [ -z "$PY" ]; then
  echo "Python 3 is required."
  exit 1
fi
if ! "$PY" -c 'import sys; raise SystemExit(0 if sys.version_info >= (3, 9) else 1)' >/dev/null 2>&1; then
  echo "Python 3.9 or newer is required."
  exit 1
fi

exec "$PY" all/vesper_launcher.py stop

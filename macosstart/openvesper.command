#!/bin/bash
cd "$(dirname "$0")/.." || exit 1

PY="$(command -v python3 || command -v python)"
if [ -z "$PY" ]; then
  echo "Python 3 bulunamadı. python.org adresinden Python 3 kurun."
  read -r -p "Kapatmak için Enter'a basın..." _
  exit 1
fi
if ! "$PY" -c 'import sys; raise SystemExit(0 if sys.version_info >= (3, 9) else 1)' >/dev/null 2>&1; then
  echo "Python 3.9 veya daha yeni bir sürüm gerekli."
  read -r -p "Kapatmak için Enter'a basın..." _
  exit 1
fi

"$PY" all/vesper_launcher.py start
STATUS=$?
if [ "$STATUS" -ne 0 ]; then
  read -r -p "Kapatmak için Enter'a basın..." _
fi
exit "$STATUS"

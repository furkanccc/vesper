#!/bin/bash
# Vesper sunucusunu durdurur. Başka bir şey yapmaz.
cd "$(dirname "$0")" || exit 1

PORT=8777
PIPER_PORT=8778
ALL_DIR="./all"
PIDFILE="$ALL_DIR/.vesper.pid"
PIPER_PIDFILE="$ALL_DIR/.vesper-piper.pid"

if [ -f "$PIDFILE" ]; then
  kill "$(cat "$PIDFILE" 2>/dev/null)" 2>/dev/null
  rm -f "$PIDFILE"
fi
if [ -f "$PIPER_PIDFILE" ]; then
  kill "$(cat "$PIPER_PIDFILE" 2>/dev/null)" 2>/dev/null
  rm -f "$PIPER_PIDFILE"
fi
lsof -ti "tcp:$PORT" 2>/dev/null | xargs kill -9 2>/dev/null
lsof -ti "tcp:$PIPER_PORT" 2>/dev/null | xargs kill -9 2>/dev/null

echo ""
echo "  ⏹  Vesper kapatıldı."
echo ""
sleep 1

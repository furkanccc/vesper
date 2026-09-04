#!/bin/bash
# Vesper'i başlat — bu klasörü localhost'ta yayınlar, NVIDIA'ya CORS'lu proxy
# yapar ve varsayılan tarayıcıda vesper.html'i açar.
cd "$(dirname "$0")" || exit 1

PORT=8777
PIPER_PORT=8778
URL="http://localhost:$PORT/vesper.html"
ALL_DIR="./all"
PIDFILE="$ALL_DIR/.vesper.pid"
PIPER_PIDFILE="$ALL_DIR/.vesper-piper.pid"
PIPER_VENV="$ALL_DIR/.piper-venv/bin/python3"

PY="$(command -v python3 || command -v python)"
if [ -z "$PY" ]; then
  echo ""
  echo "  ⚠  python3 bulunamadı."
  echo "     Terminal'e:  xcode-select --install   yaz, ya da python.org'dan kur."
  echo ""
  read -r -p "  Kapatmak için Enter'a bas..." _
  exit 1
fi

if [ -f "$PIDFILE" ] && kill -0 "$(cat "$PIDFILE" 2>/dev/null)" 2>/dev/null; then
  echo ""
  echo "  Vesper zaten çalışıyor → $URL"
  open "$URL"
  echo ""
  exit 0
fi

lsof -ti "tcp:$PORT" 2>/dev/null | xargs kill -9 2>/dev/null
lsof -ti "tcp:$PIPER_PORT" 2>/dev/null | xargs kill -9 2>/dev/null

# Yerel Piper sesi (offline TTS) — kurulmuşsa arka planda başlat.
# Kurulu değilse sessizce atlanır; vesper.html tarayıcının kendi sesine döner.
if [ -x "$PIPER_VENV" ] && [ -f "$ALL_DIR/piper_server.py" ]; then
  nohup "$PIPER_VENV" "$ALL_DIR/piper_server.py" "$PIPER_PORT" >/dev/null 2>&1 &
  echo $! > "$PIPER_PIDFILE"
  disown 2>/dev/null
fi

nohup "$PY" - "$PORT" >/dev/null 2>&1 <<'PYEOF' &
import sys, json, re, html, urllib.request, urllib.error, urllib.parse
from http.server import SimpleHTTPRequestHandler
from socketserver import ThreadingMixIn
from http.server import HTTPServer

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8777
NVIDIA = "https://integrate.api.nvidia.com"
PIPER_URL = "http://127.0.0.1:8778"

_RESULT_RE = re.compile(
    r'class="result__a"[^>]*href="([^"]+)"[^>]*>(.*?)</a>.*?class="result__snippet"[^>]*>(.*?)</a>',
    re.S,
)
_TAG_RE = re.compile(r"<[^<]+?>")

def web_search(query, n=5):
    data = urllib.parse.urlencode({"q": query}).encode()
    req = urllib.request.Request(
        "https://html.duckduckgo.com/html/", data=data,
        headers={"User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)",
                 "Content-Type": "application/x-www-form-urlencoded"},
    )
    with urllib.request.urlopen(req, timeout=15) as r:
        body = r.read().decode("utf-8", "ignore")
    out = []
    for href, title, snippet in _RESULT_RE.findall(body):
        title = html.unescape(_TAG_RE.sub("", title)).strip()
        snippet = html.unescape(_TAG_RE.sub("", snippet)).strip()
        mu = re.search(r"uddg=([^&]+)", href)
        url = urllib.parse.unquote(mu.group(1)) if mu else href
        if title:
            out.append({"title": title, "snippet": snippet, "url": url})
        if len(out) >= n:
            break
    return out

class H(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Headers", "Authorization, Content-Type")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Cache-Control", "no-store")
        SimpleHTTPRequestHandler.end_headers(self)

    def do_OPTIONS(self):
        self.send_response(204); self.end_headers()

    def _proxy(self, method):
        path = self.path[len("/nvidia"):] or "/"
        n = int(self.headers.get("Content-Length", 0) or 0)
        body = self.rfile.read(n) if n else None
        req = urllib.request.Request(NVIDIA + path, data=body, method=method)
        req.add_header("Content-Type", "application/json")
        req.add_header("Accept", "text/event-stream, application/json")
        auth = self.headers.get("Authorization")
        if auth:
            req.add_header("Authorization", auth)
        try:
            r = urllib.request.urlopen(req, timeout=240)
        except urllib.error.HTTPError as e:
            data = e.read()
            self.send_response(e.code)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(data)))
            self.end_headers()
            self.wfile.write(data)
            return
        except Exception as e:
            data = json.dumps({"detail": str(e)}).encode()
            self.send_response(502)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(data)))
            self.end_headers()
            self.wfile.write(data)
            return
        # stream the upstream body straight through (SSE or JSON)
        self.send_response(r.status)
        self.send_header("Content-Type", r.headers.get("Content-Type", "application/json"))
        self.end_headers()
        try:
            while True:
                chunk = r.read(512)
                if not chunk:
                    break
                self.wfile.write(chunk)
                self.wfile.flush()
        except Exception:
            pass

    def _search(self):
        qs = urllib.parse.urlparse(self.path).query
        q = urllib.parse.parse_qs(qs).get("q", [""])[0]
        try:
            results = web_search(q) if q.strip() else []
            data = json.dumps({"query": q, "results": results}).encode()
            status = 200
        except Exception as e:
            data = json.dumps({"query": q, "results": [], "error": str(e)}).encode()
            status = 502
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def _tts(self):
        try:
            req = urllib.request.Request(PIPER_URL + self.path)
            r = urllib.request.urlopen(req, timeout=60)
            data = r.read()
            self.send_response(r.status)
            self.send_header("Content-Type", r.headers.get("Content-Type", "audio/wav"))
            self.send_header("Content-Length", str(len(data)))
            self.end_headers()
            self.wfile.write(data)
        except urllib.error.HTTPError as e:
            data = e.read()
            self.send_response(e.code)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(data)))
            self.end_headers()
            self.wfile.write(data)
        except Exception as e:
            data = json.dumps({"error": str(e)}).encode()
            self.send_response(503)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(data)))
            self.end_headers()
            self.wfile.write(data)

    def do_GET(self):
        if self.path.startswith("/nvidia/"):
            return self._proxy("GET")
        if self.path.startswith("/search"):
            return self._search()
        if self.path.startswith("/tts"):
            return self._tts()
        return SimpleHTTPRequestHandler.do_GET(self)

    def do_POST(self):
        if self.path.startswith("/nvidia/"):
            return self._proxy("POST")
        self.send_response(404); self.end_headers()

    def log_message(self, *a):
        pass

class S(ThreadingMixIn, HTTPServer):
    daemon_threads = True
    allow_reuse_address = True

S(("127.0.0.1", PORT), H).serve_forever()
PYEOF

echo $! > "$PIDFILE"
disown 2>/dev/null

sleep 1
open "$URL"

echo ""
echo "  ✅  Vesper açıldı:  $URL"
echo "  ⏹   Kapatmak için:  closevesper"
echo ""
echo "  (bu pencereyi kapatabilirsin — sunucu arka planda çalışır)"
echo ""

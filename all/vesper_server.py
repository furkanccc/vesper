#!/usr/bin/env python3
"""Cross-platform localhost server and NVIDIA proxy for Vesper."""

import html
import json
import os
import re
import sys
import urllib.error
import urllib.parse
import urllib.request
from http.server import HTTPServer, SimpleHTTPRequestHandler
from pathlib import Path
from socketserver import ThreadingMixIn


PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8777
ROOT = Path(__file__).resolve().parents[1]
NVIDIA = "https://integrate.api.nvidia.com"
PIPER_PORT = int(os.environ.get("VESPER_PIPER_PORT", "8778"))
PIPER_URL = f"http://127.0.0.1:{PIPER_PORT}"

_RESULT_RE = re.compile(
    r'class="result__a"[^>]*href="([^"]+)"[^>]*>(.*?)</a>.*?'
    r'class="result__snippet"[^>]*>(.*?)</a>',
    re.S,
)
_TAG_RE = re.compile(r"<[^<]+?>")


def web_search(query, count=5):
    data = urllib.parse.urlencode({"q": query}).encode()
    request = urllib.request.Request(
        "https://html.duckduckgo.com/html/",
        data=data,
        headers={
            "User-Agent": "Mozilla/5.0 (Vesper)",
            "Content-Type": "application/x-www-form-urlencoded",
        },
    )
    with urllib.request.urlopen(request, timeout=15) as response:
        body = response.read().decode("utf-8", "ignore")

    results = []
    for href, title, snippet in _RESULT_RE.findall(body):
        title = html.unescape(_TAG_RE.sub("", title)).strip()
        snippet = html.unescape(_TAG_RE.sub("", snippet)).strip()
        encoded_url = re.search(r"uddg=([^&]+)", href)
        url = urllib.parse.unquote(encoded_url.group(1)) if encoded_url else href
        if title:
            results.append({"title": title, "snippet": snippet, "url": url})
        if len(results) >= count:
            break
    return results


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def end_headers(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Headers", "Authorization, Content-Type")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def _json(self, status, payload):
        data = json.dumps(payload).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def do_OPTIONS(self):
        self.send_response(204)
        self.end_headers()

    def _proxy(self, method):
        path = self.path[len("/nvidia"):] or "/"
        length = int(self.headers.get("Content-Length", 0) or 0)
        body = self.rfile.read(length) if length else None
        request = urllib.request.Request(NVIDIA + path, data=body, method=method)
        request.add_header("Content-Type", "application/json")
        request.add_header("Accept", "text/event-stream, application/json")
        authorization = self.headers.get("Authorization")
        if authorization:
            request.add_header("Authorization", authorization)
        try:
            response = urllib.request.urlopen(request, timeout=240)
        except urllib.error.HTTPError as error:
            data = error.read()
            self.send_response(error.code)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(data)))
            self.end_headers()
            self.wfile.write(data)
            return
        except Exception as error:
            self._json(502, {"detail": str(error)})
            return

        self.send_response(response.status)
        self.send_header("Content-Type", response.headers.get("Content-Type", "application/json"))
        self.end_headers()
        try:
            while True:
                chunk = response.read(512)
                if not chunk:
                    break
                self.wfile.write(chunk)
                self.wfile.flush()
        except (BrokenPipeError, ConnectionResetError):
            pass

    def _search(self):
        query = urllib.parse.parse_qs(urllib.parse.urlparse(self.path).query).get("q", [""])[0]
        try:
            results = web_search(query) if query.strip() else []
            self._json(200, {"query": query, "results": results})
        except Exception as error:
            self._json(502, {"query": query, "results": [], "error": str(error)})

    def _tts(self):
        try:
            response = urllib.request.urlopen(PIPER_URL + self.path, timeout=60)
            data = response.read()
            self.send_response(response.status)
            self.send_header("Content-Type", response.headers.get("Content-Type", "audio/wav"))
            self.send_header("Content-Length", str(len(data)))
            self.end_headers()
            self.wfile.write(data)
        except urllib.error.HTTPError as error:
            data = error.read()
            self.send_response(error.code)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(data)))
            self.end_headers()
            self.wfile.write(data)
        except Exception as error:
            self._json(503, {"error": str(error)})

    def do_GET(self):
        if self.path == "/health":
            self._json(200, {"ok": True})
        elif self.path.startswith("/nvidia/"):
            self._proxy("GET")
        elif self.path.startswith("/search"):
            self._search()
        elif self.path.startswith("/tts"):
            self._tts()
        else:
            super().do_GET()

    def do_POST(self):
        if self.path.startswith("/nvidia/"):
            self._proxy("POST")
        else:
            self.send_response(404)
            self.end_headers()

    def log_message(self, *_args):
        pass


class Server(ThreadingMixIn, HTTPServer):
    daemon_threads = True
    allow_reuse_address = True


if __name__ == "__main__":
    Server(("127.0.0.1", PORT), Handler).serve_forever()

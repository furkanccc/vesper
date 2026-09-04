#!/usr/bin/env python3
"""Local, offline TTS worker for Vesper — runs inside .piper-venv (Piper needs a
newer Python + onnxruntime than the system python3 used by the main proxy).

Serves GET /tts?text=...&lang=xx-XX on 127.0.0.1:<port>. Vesper only speaks two
languages, each with one fixed voice (see VOICE_MAP below): Turkish uses the
real "Fahrettin" voice, English uses "lessac". Model files are downloaded once
and cached under voices/ forever after. Any other language returns 404 so the
caller falls back to the browser's own built-in voice.
"""
import io
import json
import re
import sys
import threading
import urllib.error
import urllib.request
import wave
from http.server import BaseHTTPRequestHandler
from pathlib import Path
from socketserver import ThreadingMixIn
from http.server import HTTPServer
from urllib.parse import urlparse, parse_qs

PREPARE_ONLY = len(sys.argv) > 1 and sys.argv[1] == "--prepare"
PORT = int(sys.argv[1]) if len(sys.argv) > 1 and not PREPARE_ONLY else 8778
ROOT = Path(__file__).resolve().parent
VOICES_DIR = ROOT / "voices"
VOICES_DIR.mkdir(exist_ok=True)
VOICES_JSON_PATH = VOICES_DIR / "voices.json"
VOICES_JSON_URL = "https://huggingface.co/rhasspy/piper-voices/resolve/main/voices.json?download=true"
FILE_URL_FMT = "https://huggingface.co/rhasspy/piper-voices/resolve/main/{relpath}?download=true"

# Turkish -> Fahrettin (pulled from an older catalog revision; removed from
# "main" at some point but the git history still serves it — see FALLBACK_URLS).
# English -> lessac, Piper's best-known, most natural default voice.
VOICE_MAP = {"tr": "tr_TR-fahrettin-medium", "en": "en_US-lessac-medium"}
FALLBACK_COMMIT = "2083514c726ed4e54d15dbf8d86285d6059642f0"  # last commit with fahrettin/

from piper import PiperVoice  # noqa: E402  (after sys.path is set up by the venv)

_lock = threading.Lock()
_index = None            # voices.json contents, loaded once
_voice_cache = {}        # voice key -> PiperVoice


def load_index():
    global _index
    if _index is not None:
        return _index
    if VOICES_JSON_PATH.exists():
        _index = json.loads(VOICES_JSON_PATH.read_text())
        return _index
    with urllib.request.urlopen(VOICES_JSON_URL, timeout=60) as r:
        data = json.load(r)
    VOICES_JSON_PATH.write_text(json.dumps(data))
    _index = data
    return data


def resolve_voice(lang):
    primary = re.split(r"[-_]", lang or "en-US")[0].lower()
    key = VOICE_MAP.get(primary)
    if not key:
        return None, None
    return load_index().get(key), key


def ensure_voice_files(key, entry):
    onnx_path = VOICES_DIR / f"{key}.onnx"
    json_path = VOICES_DIR / f"{key}.onnx.json"
    if onnx_path.exists() and json_path.exists():
        return onnx_path

    if entry is not None:
        for relpath in entry["files"]:
            if not (relpath.endswith(".onnx") or relpath.endswith(".onnx.json")):
                continue
            dest = VOICES_DIR / Path(relpath).name
            if dest.exists():
                continue
            _download(FILE_URL_FMT.format(relpath=relpath), dest)
        return onnx_path

    # Not in the live catalog (e.g. fahrettin was pulled from "main") — pull
    # straight from the last commit that still has it.
    base = f"https://huggingface.co/rhasspy/piper-voices/resolve/{FALLBACK_COMMIT}/tr/tr_TR/fahrettin/medium"
    if not onnx_path.exists():
        _download(f"{base}/{key}.onnx?download=true", onnx_path)
    if not json_path.exists():
        _download(f"{base}/{key}.onnx.json?download=true", json_path)
    return onnx_path


def _download(url, dest):
    with urllib.request.urlopen(url, timeout=120) as r, open(dest, "wb") as f:
        while True:
            chunk = r.read(1 << 16)
            if not chunk:
                break
            f.write(chunk)


def get_voice(lang):
    entry, key = resolve_voice(lang)
    if key is None:
        return None
    if key in _voice_cache:
        return _voice_cache[key]
    onnx_path = ensure_voice_files(key, entry)
    voice = PiperVoice.load(str(onnx_path))
    _voice_cache[key] = voice
    return voice


class H(BaseHTTPRequestHandler):
    def _json(self, status, obj):
        data = json.dumps(obj).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def do_GET(self):
        parsed = urlparse(self.path)
        if parsed.path == "/health":
            return self._json(200, {"ok": True})
        if parsed.path != "/tts":
            return self._json(404, {"error": "not found"})

        qs = parse_qs(parsed.query)
        text = (qs.get("text", [""])[0] or "").strip()
        lang = qs.get("lang", ["en-US"])[0]
        if not text:
            return self._json(400, {"error": "empty text"})

        try:
            with _lock:
                voice = get_voice(lang)
                if voice is None:
                    return self._json(404, {"error": "no local voice for language", "lang": lang})
                buf = io.BytesIO()
                with wave.open(buf, "wb") as w:
                    voice.synthesize_wav(text, w)
            data = buf.getvalue()
        except urllib.error.HTTPError as e:
            return self._json(502, {"error": f"voice download failed: {e.code}"})
        except Exception as e:
            return self._json(500, {"error": str(e)})

        self.send_response(200)
        self.send_header("Content-Type", "audio/wav")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def log_message(self, *a):
        pass


class S(ThreadingMixIn, HTTPServer):
    daemon_threads = True
    allow_reuse_address = True


def prepare_voices():
    for language in ("tr-TR", "en-US"):
        entry, key = resolve_voice(language)
        ensure_voice_files(key, entry)
        print(f"prepared {key}")


if __name__ == "__main__":
    if PREPARE_ONLY:
        prepare_voices()
    else:
        S(("127.0.0.1", PORT), H).serve_forever()

#!/usr/bin/env python3
"""Start and stop Vesper consistently on macOS, Windows, and Linux."""

import os
import shutil
import signal
import socket
import subprocess
import sys
import time
import venv
import webbrowser
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
ALL_DIR = ROOT / "all"
PORT = int(os.environ.get("VESPER_PORT", "8777"))
PIPER_PORT = int(os.environ.get("VESPER_PIPER_PORT", "8778"))
URL = f"http://localhost:{PORT}/vesper.html"
PIDFILE = ALL_DIR / ".vesper.pid"
PIPER_PIDFILE = ALL_DIR / ".vesper-piper.pid"
LOGFILE = ALL_DIR / ".vesper.log"
PIPER_LOGFILE = ALL_DIR / ".vesper-piper.log"
VENV_DIR = ALL_DIR / ".piper-venv"
PIPER_VERSION = "1.8.0"


def patch_binary_string(path, old, new):
    """Replace a fixed-width C string without changing the binary's size."""
    path = Path(path)
    data = path.read_bytes()
    if old not in data:
        return False
    if len(new) > len(old):
        raise ValueError("replacement path is longer than embedded path")
    replacement = new + (b"\0" * (len(old) - len(new)))
    path.write_bytes(data.replace(old, replacement, 1))
    return True


def repair_macos_piper(python):
    """Repair the published Apple Silicon wheel's baked-in CI data path."""
    if sys.platform != "darwin":
        return

    package_dir = Path(
        subprocess.check_output(
            [
                str(python),
                "-c",
                "from pathlib import Path; import piper; print(Path(piper.__file__).resolve().parent)",
            ],
            text=True,
        ).strip()
    )
    data_dir = package_dir / "espeak-ng-data"
    bridges = list(package_dir.glob("espeakbridge*.so"))
    if not data_dir.is_dir() or not bridges:
        raise RuntimeError("Piper macOS files are incomplete")

    # The affected wheel ignores the Python API's data path and uses an absolute
    # GitHub Actions build path. A short per-user symlink keeps the replacement
    # stable even if the Vesper folder is moved later.
    data_link = Path(f"/tmp/vesper-espeak-ng-data-{os.getuid()}")
    if data_link.is_symlink():
        data_link.unlink()
    elif data_link.exists():
        raise RuntimeError(f"cannot create Piper data link: {data_link}")
    data_link.symlink_to(data_dir, target_is_directory=True)

    marker = b"/Users/runner/work/piper1-gpl"
    replacement = str(data_link).encode()
    for bridge in bridges:
        binary = bridge.read_bytes()
        marker_at = binary.find(marker)
        if marker_at < 0:
            continue
        string_end = binary.find(b"\0", marker_at)
        if string_end < 0:
            raise RuntimeError("invalid Piper bridge binary")
        embedded_path = binary[marker_at:string_end]
        if patch_binary_string(bridge, embedded_path, replacement):
            subprocess.check_call(
                ["/usr/bin/codesign", "--force", "--sign", "-", str(bridge)],
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
            )


def venv_python(venv_dir, platform_name=None):
    platform_name = platform_name or sys.platform
    if platform_name == "win32":
        return Path(venv_dir) / "Scripts" / "python.exe"
    return Path(venv_dir) / "bin" / "python3"


def port_is_open(port, host="127.0.0.1"):
    try:
        with socket.create_connection((host, port), timeout=0.25):
            return True
    except OSError:
        return False


def process_is_running(pid):
    if sys.platform == "win32":
        try:
            import ctypes

            handle = ctypes.windll.kernel32.OpenProcess(0x1000, False, pid)
            if not handle:
                return False
            ctypes.windll.kernel32.CloseHandle(handle)
            return True
        except (AttributeError, OSError, ValueError):
            return False
    try:
        os.kill(pid, 0)
        return True
    except (OSError, ValueError):
        return False


def read_live_pid(pidfile):
    pidfile = Path(pidfile)
    if not pidfile.exists():
        return None
    try:
        pid = int(pidfile.read_text(encoding="utf-8").strip())
        if pid > 0 and process_is_running(pid):
            return pid
    except (OSError, ValueError):
        pass
    try:
        pidfile.unlink()
    except OSError:
        pass
    return None


def detached_process(command, logfile):
    logfile.parent.mkdir(parents=True, exist_ok=True)
    output = open(logfile, "ab")
    kwargs = {
        "cwd": str(ROOT),
        "stdin": subprocess.DEVNULL,
        "stdout": output,
        "stderr": subprocess.STDOUT,
    }
    if sys.platform == "win32":
        kwargs["creationflags"] = 0x00000008 | 0x00000200
    else:
        kwargs["start_new_session"] = True
    try:
        return subprocess.Popen([str(item) for item in command], **kwargs)
    finally:
        output.close()


def wait_for_port(port, timeout=12):
    deadline = time.time() + timeout
    while time.time() < deadline:
        if port_is_open(port):
            return True
        time.sleep(0.1)
    return False


def prepare_piper():
    if os.environ.get("VESPER_SKIP_PIPER") == "1":
        return None
    python = venv_python(VENV_DIR)
    try:
        if not python.exists():
            print("  Piper kuruluyor (yalnızca ilk çalıştırmada)...", flush=True)
            venv.EnvBuilder(with_pip=True).create(VENV_DIR)
        check = subprocess.run(
            [
                str(python),
                "-c",
                (
                    "import importlib.metadata as m; "
                    f"raise SystemExit(0 if m.version('piper-tts') == '{PIPER_VERSION}' else 1)"
                ),
            ],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
        if check.returncode:
            subprocess.check_call(
                [str(python), "-m", "pip", "install", f"piper-tts=={PIPER_VERSION}"]
            )

        repair_macos_piper(python)

        required = [
            ALL_DIR / "voices" / "tr_TR-fahrettin-medium.onnx",
            ALL_DIR / "voices" / "tr_TR-fahrettin-medium.onnx.json",
            ALL_DIR / "voices" / "en_US-lessac-medium.onnx",
            ALL_DIR / "voices" / "en_US-lessac-medium.onnx.json",
        ]
        if not all(path.exists() for path in required):
            print("  Fahrettin ve lessac sesleri indiriliyor...", flush=True)
            subprocess.check_call([str(python), str(ALL_DIR / "piper_server.py"), "--prepare"])
        return python
    except Exception as error:
        print(f"  Uyarı: Piper kurulamadı ({error}). Tarayıcı sesi kullanılacak.", flush=True)
        return None


def start_piper(python):
    if python is None or read_live_pid(PIPER_PIDFILE):
        return
    if port_is_open(PIPER_PORT):
        print(f"  Uyarı: {PIPER_PORT} portu kullanımda; mevcut ses servisi kullanılacak.")
        return
    process = detached_process(
        [python, ALL_DIR / "piper_server.py", str(PIPER_PORT)],
        PIPER_LOGFILE,
    )
    if wait_for_port(PIPER_PORT):
        PIPER_PIDFILE.write_text(str(process.pid), encoding="utf-8")
    else:
        stop_pid(process.pid)
        print("  Uyarı: Piper başlatılamadı. Tarayıcı sesi kullanılacak.")


def browser_candidates():
    if sys.platform == "darwin":
        return [
            Path("/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"),
            Path("/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge"),
        ]
    if sys.platform == "win32":
        roots = [
            os.environ.get("PROGRAMFILES"),
            os.environ.get("PROGRAMFILES(X86)"),
            os.environ.get("LOCALAPPDATA"),
        ]
        relative = [
            Path("Google/Chrome/Application/chrome.exe"),
            Path("Microsoft/Edge/Application/msedge.exe"),
        ]
        return [Path(root) / item for root in roots if root for item in relative]
    return [Path(found) for name in (
        "google-chrome-stable",
        "google-chrome",
        "microsoft-edge-stable",
        "microsoft-edge",
    ) if (found := shutil.which(name))]


def open_browser(url=URL):
    if os.environ.get("VESPER_NO_BROWSER") == "1":
        return
    for candidate in browser_candidates():
        if candidate.exists():
            try:
                subprocess.Popen(
                    [str(candidate), url],
                    stdout=subprocess.DEVNULL,
                    stderr=subprocess.DEVNULL,
                )
                return
            except OSError:
                continue
    webbrowser.open(url)


def stop_pid(pid):
    if not pid:
        return
    if sys.platform == "win32":
        subprocess.run(
            ["taskkill", "/PID", str(pid), "/T", "/F"],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
        return
    try:
        os.kill(pid, signal.SIGTERM)
    except OSError:
        return
    deadline = time.time() + 3
    while time.time() < deadline and process_is_running(pid):
        time.sleep(0.05)
    if process_is_running(pid):
        try:
            os.kill(pid, signal.SIGKILL)
        except OSError:
            pass


def start():
    existing = read_live_pid(PIDFILE)
    if existing and port_is_open(PORT):
        print(f"  Vesper zaten çalışıyor: {URL}")
        open_browser()
        return 0
    if port_is_open(PORT):
        print(f"  Hata: {PORT} portu başka bir uygulama tarafından kullanılıyor.")
        return 1

    piper_python = prepare_piper()
    start_piper(piper_python)

    process = detached_process(
        [sys.executable, ALL_DIR / "vesper_server.py", str(PORT)],
        LOGFILE,
    )
    if not wait_for_port(PORT):
        stop_pid(process.pid)
        print(f"  Hata: Vesper başlatılamadı. Günlük: {LOGFILE}")
        return 1
    PIDFILE.write_text(str(process.pid), encoding="utf-8")
    open_browser()
    print(f"  Vesper açıldı: {URL}")
    return 0


def stop():
    stopped = False
    for pidfile in (PIDFILE, PIPER_PIDFILE):
        pid = read_live_pid(pidfile)
        if pid:
            stop_pid(pid)
            stopped = True
        try:
            pidfile.unlink()
        except OSError:
            pass
    if stopped:
        print("  Vesper kapatıldı.")
    else:
        print("  Vesper zaten kapalı.")
    return 0


def main(arguments=None):
    arguments = list(sys.argv[1:] if arguments is None else arguments)
    if len(arguments) != 1 or arguments[0] not in {"start", "stop"}:
        print("Kullanım: vesper_launcher.py start|stop")
        return 2
    return start() if arguments[0] == "start" else stop()


if __name__ == "__main__":
    raise SystemExit(main())

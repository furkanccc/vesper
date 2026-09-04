import importlib.util
import socket
import subprocess
import sys
import tempfile
import time
import unittest
from pathlib import Path
from unittest import mock


ROOT = Path(__file__).resolve().parents[2]
LAUNCHER_PATH = ROOT / "all" / "vesper_launcher.py"
SERVER_PATH = ROOT / "all" / "vesper_server.py"


def free_port():
    with socket.socket() as sock:
        sock.bind(("127.0.0.1", 0))
        return sock.getsockname()[1]


class LauncherContractTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        if not LAUNCHER_PATH.exists():
            cls.launcher = None
            return
        spec = importlib.util.spec_from_file_location("vesper_launcher", LAUNCHER_PATH)
        cls.launcher = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(cls.launcher)

    def test_launcher_module_exists(self):
        self.assertTrue(LAUNCHER_PATH.exists(), "all/vesper_launcher.py is required")

    def test_virtual_environment_python_path_is_platform_specific(self):
        if self.launcher is None:
            self.skipTest("launcher module is not implemented yet")
        base = Path("project") / "all" / ".piper-venv"
        self.assertEqual(
            self.launcher.venv_python(base, "win32"),
            base / "Scripts" / "python.exe",
        )
        self.assertEqual(
            self.launcher.venv_python(base, "linux"),
            base / "bin" / "python3",
        )
        self.assertEqual(
            self.launcher.venv_python(base, "darwin"),
            base / "bin" / "python3",
        )

    def test_missing_or_invalid_pid_is_not_reported_as_running(self):
        if self.launcher is None:
            self.skipTest("launcher module is not implemented yet")
        with tempfile.TemporaryDirectory() as directory:
            pidfile = Path(directory) / "server.pid"
            self.assertIsNone(self.launcher.read_live_pid(pidfile))
            pidfile.write_text("not-a-pid", encoding="utf-8")
            self.assertIsNone(self.launcher.read_live_pid(pidfile))
            self.assertFalse(pidfile.exists())

    def test_piper_setup_failure_falls_back_without_blocking_startup(self):
        if self.launcher is None:
            self.skipTest("launcher module is not implemented yet")
        with tempfile.TemporaryDirectory() as directory:
            missing_venv = Path(directory) / ".piper-venv"
            with (
                mock.patch.object(self.launcher, "VENV_DIR", missing_venv),
                mock.patch.object(
                    self.launcher.venv.EnvBuilder,
                    "create",
                    side_effect=RuntimeError("installation unavailable"),
                ),
            ):
                self.assertIsNone(self.launcher.prepare_piper())

    def test_binary_path_patch_preserves_file_size_and_null_pads_replacement(self):
        if self.launcher is None:
            self.skipTest("launcher module is not implemented yet")
        with tempfile.TemporaryDirectory() as directory:
            binary = Path(directory) / "bridge.so"
            old = b"/a/very/long/compiled/espeak-ng-data"
            new = b"/tmp/vesper-espeak"
            binary.write_bytes(b"prefix\0" + old + b"\0suffix")

            self.assertTrue(self.launcher.patch_binary_string(binary, old, new))
            patched = binary.read_bytes()

            self.assertEqual(len(patched), len(b"prefix\0" + old + b"\0suffix"))
            self.assertIn(new + (b"\0" * (len(old) - len(new))), patched)
            self.assertNotIn(old, patched)


class ServerSmokeTests(unittest.TestCase):
    def test_health_endpoint_responds_on_localhost(self):
        self.assertTrue(SERVER_PATH.exists(), "all/vesper_server.py is required")
        port = free_port()
        process = subprocess.Popen(
            [sys.executable, str(SERVER_PATH), str(port)],
            cwd=ROOT,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
        try:
            deadline = time.time() + 5
            while time.time() < deadline:
                try:
                    with socket.create_connection(("127.0.0.1", port), timeout=0.2):
                        break
                except OSError:
                    time.sleep(0.05)
            else:
                self.fail("Vesper server did not listen within five seconds")

            import urllib.request

            with urllib.request.urlopen(f"http://127.0.0.1:{port}/health", timeout=2) as response:
                self.assertEqual(response.status, 200)
                self.assertEqual(response.read(), b'{"ok": true}')
        finally:
            process.terminate()
            process.wait(timeout=5)


if __name__ == "__main__":
    unittest.main()

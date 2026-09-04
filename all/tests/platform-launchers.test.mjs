import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const testsDir = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(testsDir, "../..");

const expectedLaunchers = [
  "macosstart/openvesper.command",
  "macosstart/closevesper.command",
  "windowsstart/openvesper.bat",
  "windowsstart/closevesper.bat",
  "linuxstart/openvesper.sh",
  "linuxstart/closevesper.sh",
  "all/vesper_launcher.py",
  "all/vesper_server.py",
];

test("release contains start and stop launchers for all supported platforms", () => {
  const missing = expectedLaunchers.filter((relative) => !fs.existsSync(path.join(root, relative)));
  assert.deepEqual(missing, []);
});

test("public API configuration is an empty five-field template", () => {
  const configPath = path.join(root, "apikey.json");
  assert.ok(fs.existsSync(configPath), "apikey.json is missing");
  const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
  assert.deepEqual(config, {
    provider: "",
    apikey: "",
    model: "",
    effort: "",
    language: "",
  });
});

test("macOS and Linux launchers retain executable file mode", () => {
  const executableLaunchers = expectedLaunchers.filter((file) => /\.(command|sh)$/.test(file));
  const missing = executableLaunchers.filter((relative) => !fs.existsSync(path.join(root, relative)));
  assert.deepEqual(missing, []);
  for (const relative of executableLaunchers) {
    const mode = fs.statSync(path.join(root, relative)).mode;
    assert.notEqual(mode & 0o111, 0, `${relative} is not executable`);
  }
});

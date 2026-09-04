import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";

const html = readFileSync(new URL("../../vesper.html", import.meta.url), "utf8");

function extract(pattern, name) {
  const match = html.match(pattern);
  assert.ok(match, `${name} must exist in vesper.html`);
  return match[0];
}

const typingSource = extract(
  /function isTypingTarget\(target\) \{[\s\S]*?\n  \}/,
  "isTypingTarget",
);
const toggleSource = extract(
  /async function toggleFullscreen\(\) \{[\s\S]*?\n  \}/,
  "toggleFullscreen",
);
const shortcutSource = extract(
  /async function handleFullscreenKey\(event\) \{[\s\S]*?\n  \}/,
  "handleFullscreenKey",
);
const fullscreenSource = `${typingSource}\n${toggleSource}\n${shortcutSource}`;

test("F shortcut enters and exits fullscreen", async () => {
  const calls = [];
  const document = {
    fullscreenElement: null,
    documentElement: {
      async requestFullscreen() {
        calls.push("enter");
        document.fullscreenElement = document.documentElement;
      },
    },
    async exitFullscreen() {
      calls.push("exit");
      document.fullscreenElement = null;
    },
  };
  const context = vm.createContext({ document });
  vm.runInContext(fullscreenSource, context);

  await vm.runInContext("handleFullscreenKey({ key: 'f', repeat: false, metaKey: false, ctrlKey: false, altKey: false, target: {}, preventDefault() {} })", context);
  await vm.runInContext("handleFullscreenKey({ key: 'F', repeat: false, metaKey: false, ctrlKey: false, altKey: false, target: {}, preventDefault() {} })", context);

  assert.deepEqual(calls, ["enter", "exit"]);
});

test("F shortcut is ignored while typing in a form field", async () => {
  let entered = false;
  const calls = [];
  const document = {
    fullscreenElement: null,
    documentElement: { async requestFullscreen() { entered = true; } },
    async exitFullscreen() {},
  };
  const event = {
    key: "f",
    repeat: false,
    metaKey: false,
    ctrlKey: false,
    altKey: false,
    target: { closest() { return true; } },
    preventDefault() { calls.push("prevented"); },
  };
  const context = vm.createContext({ document, event });
  vm.runInContext(fullscreenSource, context);

  await vm.runInContext("handleFullscreenKey(event)", context);

  assert.equal(entered, false);
  assert.deepEqual(calls, []);
});

test("F shortcut does not also trigger the tap-to-start microphone handler", () => {
  const tapKeyListenerSource = extract(
    /document\.addEventListener\("keydown", \(e\) => \{\n    if \(e\.key === "Escape"[\s\S]*?\n  \}\);/,
    "tap-to-start key listener",
  );
  let listener;
  let micStarts = 0;
  const context = vm.createContext({
    document: { addEventListener(_type, handler) { listener = handler; } },
    modal: { classList: { contains: () => false } },
    S: { phase: "tap" },
    orbTap: () => { micStarts += 1; },
  });
  vm.runInContext(tapKeyListenerSource, context);

  listener({ key: "f" });

  assert.equal(micStarts, 0);
});

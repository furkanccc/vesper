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

const stripSource = extract(
  /function stripEmojiForSpeech\(text\) \{[\s\S]*?\n  \}/,
  "stripEmojiForSpeech",
);

test("removes emoji sequences without changing ordinary speech text", () => {
  const context = vm.createContext({});
  vm.runInContext(stripSource, context);

  const cases = [
    ["Harika! 😊 Devam ediyoruz 🚀", "Harika! Devam ediyoruz"],
    ["Aferin 👍🏽!", "Aferin!"],
    ["Türkiye 🇹🇷, tamam ✅", "Türkiye, tamam"],
    ["Seçenek 1️⃣ hazır", "Seçenek hazır"],
    ["Normal metin aynen kalır.", "Normal metin aynen kalır."],
  ];

  for (const [input, expected] of cases) {
    assert.equal(
      vm.runInContext(`stripEmojiForSpeech(${JSON.stringify(input)})`, context),
      expected,
    );
  }
});

test("queues sanitized text and skips emoji-only responses", () => {
  const enqueueSource = extract(
    /function enqueueSpeech\(text\) \{[\s\S]*?\n  \}/,
    "enqueueSpeech",
  );
  const context = vm.createContext({});
  vm.runInContext(
    `let ttsQueue = [];
     let drainCalls = 0;
     function drainTts() { drainCalls += 1; }
     ${stripSource}
     ${enqueueSource}`,
    context,
  );

  vm.runInContext("enqueueSpeech('Merhaba 😊')", context);
  vm.runInContext("enqueueSpeech('❤️')", context);

  assert.equal(
    vm.runInContext("JSON.stringify(ttsQueue)", context),
    '["Merhaba"]',
  );
  assert.equal(vm.runInContext("drainCalls", context), 1);
});

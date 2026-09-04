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

const primarySource = extract(/const primary = .*?;/, "primary");
const normalizeSource = `${primarySource}\n${extract(
  /function normalizeLang\(code\) \{[\s\S]*?\n  \}/,
  "normalizeLang",
)}`;

function run(source, expression, globals = {}) {
  return vm.runInNewContext(`${source}\n${expression}`, globals);
}

test("legacy and regional language values collapse to the two supported choices", () => {
  const cases = [
    ["tr-TR", "tr-TR"],
    ["tr", "tr-TR"],
    ["en-US", "en-US"],
    ["en-GB", "en-US"],
    ["de-DE", "en-US"],
    [null, "en-US"],
  ];

  for (const [input, expected] of cases) {
    assert.equal(run(normalizeSource, `normalizeLang(${JSON.stringify(input)})`), expected);
  }
});

test("disk config cannot restore an unsupported legacy language", () => {
  const fromFileSource = extract(
    /const fromFile = \(j\) => \(\{[\s\S]*?\n  \}\);/,
    "fromFile",
  );
  const cfg = run(
    `${normalizeSource}\n${fromFileSource}`,
    'fromFile({ language: "de-DE", model: "demo" })',
    { detectLang: () => "en-US" },
  );

  assert.equal(cfg.lang, "en-US");
});

test("browser config cannot restore an unsupported legacy language", () => {
  const defaultSource = extract(/const DEFAULT = .*?;/, "DEFAULT");
  const loadSource = extract(
    /const loadCfg = \(\) => \{[\s\S]*?\n  \};/,
    "loadCfg",
  );
  const cfg = run(
    `${normalizeSource}\n${defaultSource}\n${loadSource}`,
    "loadCfg()",
    {
      detectLang: () => "en-US",
      store: { get: () => JSON.stringify({ language: "de-DE", lang: "de-DE" }) },
    },
  );

  assert.equal(cfg.lang, "en-US");
});

test("empty apikey file ignores and deletes legacy browser settings", async () => {
  const configSource = extract(
    /\/\* ================= config[\s\S]*?(?=\n  \/\* ================= apikey\.json)/,
    "config initialization",
  );
  const promptSource = extract(
    /function sysPromptFor\(lang\) \{[\s\S]*?\n  \}/,
    "sysPromptFor",
  );
  const historySource = extract(
    /let history = \[\{ role: "system", content: sysPromptFor\(cfg\.lang\) \}\];/,
    "history initialization",
  );
  const bootSource = extract(
    /\(async \(\) => \{\n    \/\/ baseline:[\s\S]*?\n  \}\)\(\);/,
    "boot sequence",
  );
  let storageReads = 0;
  let storageDeletes = 0;
  let databaseDeletes = 0;
  let settingsOpened = 0;
  let microphoneArmed = 0;
  const context = vm.createContext({
    detectLang: () => "en-US",
    localStorage: {
      getItem() {
        storageReads += 1;
        return JSON.stringify({
          apiKey: "legacy-key",
          model: "legacy-model",
          effort: "high",
          lang: "tr-TR",
        });
      },
      setItem() {},
      removeItem(key) {
        if (key === "vesper.config") storageDeletes += 1;
      },
    },
    indexedDB: {
      deleteDatabase(name) {
        if (name === "vesper") databaseDeletes += 1;
      },
    },
    readDisk: async () => null,
    applyStaticI18n: () => {},
    render: () => {},
    armStart: () => { microphoneArmed += 1; },
    openConfig: () => { settingsOpened += 1; },
  });

  const boot = vm.runInContext(
    `${normalizeSource}\n${configSource}\n${promptSource}\n${historySource}\n${bootSource}`,
    context,
  );
  await boot;
  const cfg = vm.runInContext("cfg", context);

  assert.equal(cfg.model, "");
  assert.equal(cfg.apiKey, "");
  assert.equal(settingsOpened, 1);
  assert.equal(microphoneArmed, 0);
  assert.equal(storageReads, 0);
  assert.equal(storageDeletes, 1);
  assert.equal(databaseDeletes, 1);
});

test("empty apikey file is not replaced by a legacy IndexedDB file handle", async () => {
  const fromFileSource = extract(
    /const fromFile = \(j\) => \(\{[\s\S]*?\n  \}\);/,
    "fromFile",
  );
  const hasContentSource = extract(/const hasContent = .*?;/, "hasContent");
  const readDiskSource = extract(
    /async function readDisk\(\) \{[\s\S]*?\n  \}/,
    "readDisk",
  );
  let idbReads = 0;
  const context = vm.createContext({
    detectLang: () => "en-US",
    idb: async () => {
      idbReads += 1;
      return {
        queryPermission: async () => "granted",
        getFile: async () => ({
          text: async () => JSON.stringify({
            apikey: "legacy-key",
            model: "legacy-model",
            effort: "high",
            language: "tr-TR",
          }),
        }),
      };
    },
    fetch: async () => ({
      ok: true,
      json: async () => ({
        provider: "",
        apikey: "",
        model: "",
        effort: "",
        language: "",
      }),
    }),
  });

  const result = await vm.runInContext(
    `${normalizeSource}\n${fromFileSource}\n${hasContentSource}\nlet fsHandle = null;\n${readDiskSource}\nreadDisk()`,
    context,
  );

  assert.equal(result, null);
  assert.equal(idbReads, 0);
});

test("disk language replaces the chat system prompt during boot", async () => {
  const cfgSource = extract(/let cfg = loadCfg\(\);/, "cfg initialization");
  const promptSource = extract(
    /function sysPromptFor\(lang\) \{[\s\S]*?\n  \}/,
    "sysPromptFor",
  );
  const historySource = extract(
    /let history = \[\{ role: "system", content: sysPromptFor\(cfg\.lang\) \}\];/,
    "history initialization",
  );
  const bootSource = extract(
    /\(async \(\) => \{\n    \/\/ baseline:[\s\S]*?\n  \}\)\(\);/,
    "boot sequence",
  );
  const cases = [
    { cached: "en-US", disk: "tr-TR", expected: /HER ZAMAN TÜRKÇE/ },
    { cached: "tr-TR", disk: "en-US", expected: /ALWAYS reply in ENGLISH/ },
  ];

  for (const sample of cases) {
    const context = vm.createContext({
      loadCfg: () => ({ lang: sample.cached, model: "demo" }),
      store: { get: () => null, set: () => {} },
      readDisk: async () => ({ lang: sample.disk, model: "demo" }),
      applyStaticI18n: () => {},
      render: () => {},
      armStart: () => {},
      openConfig: () => {},
    });

    const boot = vm.runInContext(
      `${cfgSource}\n${promptSource}\n${historySource}\n${bootSource}`,
      context,
    );
    await boot;
    const state = vm.runInContext("({ cfg, history })", context);

    assert.equal(state.cfg.lang, sample.disk);
    assert.match(state.history[0].content, sample.expected);
  }
});

test("boot does not reintroduce an unsupported raw browser language", async () => {
  const cfgSource = extract(/let cfg = loadCfg\(\);/, "cfg initialization");
  const promptSource = extract(
    /function sysPromptFor\(lang\) \{[\s\S]*?\n  \}/,
    "sysPromptFor",
  );
  const historySource = extract(
    /let history = \[\{ role: "system", content: sysPromptFor\(cfg\.lang\) \}\];/,
    "history initialization",
  );
  const bootSource = extract(
    /\(async \(\) => \{\n    \/\/ baseline:[\s\S]*?\n  \}\)\(\);/,
    "boot sequence",
  );
  const context = vm.createContext({
    loadCfg: () => ({ lang: "en-US", model: "demo" }),
    store: {
      get: () => JSON.stringify({ lang: "de-DE", model: "demo" }),
      set: () => {},
    },
    readDisk: async () => null,
    applyStaticI18n: () => {},
    render: () => {},
    armStart: () => {},
    openConfig: () => {},
  });

  const boot = vm.runInContext(
    `${cfgSource}\n${promptSource}\n${historySource}\n${bootSource}`,
    context,
  );
  await boot;
  const state = vm.runInContext("({ cfg, history })", context);

  assert.equal(state.cfg.lang, "en-US");
  assert.match(state.history[0].content, /ALWAYS reply in ENGLISH/);
});

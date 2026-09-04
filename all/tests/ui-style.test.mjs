import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const html = readFileSync(new URL("../../vesper.html", import.meta.url), "utf8");

function declarations(selector) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = html.match(new RegExp(`${escaped}\\s*\\{([^}]*)\\}`));
  assert.ok(match, `${selector} CSS rule must exist`);
  return Object.fromEntries(
    match[1]
      .split(";")
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => {
        const colon = part.indexOf(":");
        return [part.slice(0, colon).trim(), part.slice(colon + 1).trim()];
      }),
  );
}

test("bottom-right GitHub link stays pure white in every link state", () => {
  for (const selector of ["#credit", "#credit:visited", "#credit:hover"]) {
    assert.equal(declarations(selector).color, "#fff", `${selector} must be pure white`);
  }
});

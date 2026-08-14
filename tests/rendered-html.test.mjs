import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const html = await readFile(new URL("../out/index.html", import.meta.url), "utf8");

test("renders GitHub Pages metadata", () => {
  assert.match(html, /https:\/\/foye3\.github\.io\/visited-cities-cn/);
  assert.doesNotMatch(html, /chatgpt\.site/i);
  assert.doesNotMatch(html, /codex-preview/i);
});

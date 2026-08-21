import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");

test("enabled city labels are not filtered by region size", () => {
  assert.match(
    page,
    /showLabels \\? cityNames\\.filter\\(\\(city\\) => Boolean\\(labelMetrics\\[city\\]\\)\\) : \\[\\]/,
  );
  assert.doesNotMatch(page, /screenWidth >= requiredWidth/);
});

test("city labels expose selection semantics", () => {
  assert.match(page, /className="city-label"[\\s\\S]*data-city=\\{city\\}/);
  assert.match(page, /role="button"[\\s\\S]*aria-label=\\{`Select/);
  assert.match(page, /setSelectedCity\\(city\\)/);
});

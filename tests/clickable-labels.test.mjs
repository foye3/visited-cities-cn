import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");

test("enabled city labels are not filtered by region size", () => {
  assert.ok(page.includes(
    "() => showLabels ? cityNames.filter((city) => Boolean(labelMetrics[city])) : []",
  ));
  assert.ok(!page.includes("screenWidth >= requiredWidth"));
});

test("city labels expose selection semantics", () => {
  assert.ok(page.includes('className="city-label"'));
  assert.ok(page.includes("data-city={city}"));
  assert.ok(page.includes('role="button"'));
  assert.ok(page.includes("setSelectedCity(city)"));
});

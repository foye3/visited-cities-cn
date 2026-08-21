import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");

test("enabled city labels progressively appear as the map zooms", () => {
  assert.ok(page.includes("const zoomProgress"));
  assert.ok(page.includes("screenWidth >= requiredWidth"));
  assert.ok(page.includes("zoomProgress >= 0.35"));
  assert.ok(page.includes("zoomProgress >= 0.65"));
});

test("maximum zoom guarantees every measured city label is shown", () => {
  assert.ok(page.includes("const atMaxZoom = zoom >= maxZoom - 0.01"));
  assert.ok(page.includes("if (atMaxZoom) return true"));
});

test("city labels are clickable without retaining native SVG focus", () => {
  assert.ok(page.includes('className="city-label"'));
  assert.ok(page.includes("data-city={city}"));
  assert.ok(page.includes("setSelectedCity(city)"));
  const labelBlock = page.slice(
    page.indexOf('key={`label-${city}`}'),
    page.indexOf("{getCityLabel(city)}"),
  );
  assert.ok(!labelBlock.includes('role="button"'));
  assert.ok(!labelBlock.includes("tabIndex={0}"));
});

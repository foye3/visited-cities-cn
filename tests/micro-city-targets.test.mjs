import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { parsePathRings } from "../lib/label-geometry.mjs";

const source = await readFile(new URL("../lib/china-map-data.ts", import.meta.url), "utf8");
const marker = "export const chinaMap: Record<string, CityGeometry> = ";
const chinaMap = JSON.parse(source.slice(
  source.indexOf(marker) + marker.length,
  source.lastIndexOf(";"),
));

function dimensions(path) {
  const points = parsePathRings(path).flat();
  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  return {
    width: Math.max(...xs) - Math.min(...xs),
    height: Math.max(...ys) - Math.min(...ys),
  };
}

test("Macau qualifies for the micro-city interaction target", () => {
  const macau = dimensions(chinaMap["澳门特别行政区"].path);
  assert.ok(Math.max(macau.width, macau.height) <= 4);
});

test("neighboring Zhuhai retains its normal polygon target", () => {
  const zhuhai = dimensions(chinaMap["珠海"].path);
  assert.ok(Math.max(zhuhai.width, zhuhai.height) > 4);
});

test("micro-city target is invisible and only follows a visible label", async () => {
  const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  assert.ok(!page.includes('className="micro-city-marker"'));
  assert.ok(page.includes('className="micro-city-hit-area"'));
  assert.ok(page.includes("MICRO_CITY_HIT_RADIUS_PX"));
  assert.ok(page.includes("visibleMicroCities.map"));
  assert.ok(page.includes("microCities.filter((city) => visible.has(city))"));
});

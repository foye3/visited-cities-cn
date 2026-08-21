import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  findInteriorPoint,
  parsePathRings,
  pointInRing,
} from "../lib/label-geometry.mjs";

const source = await readFile(new URL("../lib/china-map-data.ts", import.meta.url), "utf8");
const marker = "export const chinaMap: Record<string, CityGeometry> = ";
const chinaMap = JSON.parse(source.slice(
  source.indexOf(marker) + marker.length,
  source.lastIndexOf(";"),
));

test("every city receives a finite interior label anchor", () => {
  for (const [city, geometry] of Object.entries(chinaMap)) {
    const point = findInteriorPoint(geometry.path);
    assert.ok(Number.isFinite(point.x) && Number.isFinite(point.y), city);
    assert.ok(
      parsePathRings(geometry.path).some((ring) => pointInRing(point, ring)),
      `${city} label must stay inside one of its polygon components`,
    );
  }
});

test("Tacheng label does not fall inside Karamay", () => {
  const point = findInteriorPoint(chinaMap["塔城地区"].path);
  const insideKaramay = parsePathRings(chinaMap["克拉玛依"].path)
    .some((ring) => pointInRing(point, ring));

  assert.equal(insideKaramay, false);
});

test("Macau receives a stable anchor despite its tiny geometry", () => {
  const point = findInteriorPoint(chinaMap["澳门特别行政区"].path);
  assert.ok(point.x > 519 && point.x < 521);
  assert.ok(point.y > 407 && point.y < 409);
});

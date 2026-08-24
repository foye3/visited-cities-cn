import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const mapSource = await readFile(new URL("../lib/china-map-data.ts", import.meta.url), "utf8");
const mapMarker = "export const chinaMap: Record<string, CityGeometry> = ";
const chinaMap = JSON.parse(mapSource.slice(
  mapSource.indexOf(mapMarker) + mapMarker.length,
  mapSource.lastIndexOf(";"),
));

const namesSource = await readFile(new URL("../lib/city-names-en.ts", import.meta.url), "utf8");
const namesMarker = "export const CITY_NAMES_EN: Record<string, string> = ";
const namesStart = namesSource.indexOf(namesMarker) + namesMarker.length;
const namesEnd = namesSource.indexOf(";\n\nexport function", namesStart);
const englishNames = JSON.parse(namesSource.slice(namesStart, namesEnd));

test("every city on the map has an explicit English name", () => {
  const mapCities = Object.keys(chinaMap).sort();
  const translatedCities = Object.keys(englishNames).sort();
  assert.deepEqual(translatedCities, mapCities);
});

test("English city names do not silently fall back to Chinese", () => {
  for (const [city, englishName] of Object.entries(englishNames)) {
    assert.ok(englishName.trim().length > 0, `${city} has an empty English name`);
    assert.ok(!/[\u3400-\u9fff]/u.test(englishName), `${city} still contains Chinese characters: ${englishName}`);
  }
});

test("known non-trivial romanizations use established English forms", () => {
  assert.equal(englishNames["锡林郭勒盟"], "Xilingol");
  assert.equal(englishNames["淮安"], "Huai'an");
  assert.equal(englishNames["日喀则"], "Shigatse");
  assert.equal(englishNames["昌都"], "Chamdo");
  assert.equal(englishNames["林芝"], "Nyingchi");
  assert.equal(englishNames["喀什地区"], "Kashgar");
  assert.equal(englishNames["和田地区"], "Hotan");
  assert.equal(englishNames["新竹"], "Hsinchu");
  assert.equal(englishNames["高雄"], "Kaohsiung");
  assert.equal(englishNames["香港特别行政区"], "Hong Kong");
  assert.equal(englishNames["澳门特别行政区"], "Macao");
});

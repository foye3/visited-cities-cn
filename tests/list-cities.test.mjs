import { readFile } from "node:fs/promises";
import test from "node:test";

const source = await readFile(new URL("../lib/china-map-data.ts", import.meta.url), "utf8");
const marker = "export const chinaMap: Record<string, CityGeometry> = ";
const chinaMap = JSON.parse(source.slice(source.indexOf(marker) + marker.length, source.lastIndexOf(";")));

test("list map city keys for localization audit", () => {
  console.log(`LOCALIZATION_CITY_KEYS=${JSON.stringify(Object.keys(chinaMap))}`);
});

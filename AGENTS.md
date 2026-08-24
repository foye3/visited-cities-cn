# Repository guide for coding agents

Use this file as the shortest reliable path into the repository. Keep `README.md` as the product/deployment overview; open `docs/agent-playbooks.md` only for the task types it covers.

## Read efficiently

1. Read `README.md` and this file.
2. Open only the task-specific files listed below.
3. **Do not scan `lib/china-map-data.ts` unless the task actually changes map geometry/data.** It is roughly 600 KB. For city-key coverage, use `tests/list-cities.test.mjs` or the localization tests instead.
4. Treat tests as executable documentation for interaction and geometry invariants.

## Architecture and identity

- Next.js 16 App Router, React 19, TypeScript; the application is a single client-side page statically exported for GitHub Pages.
- No API, server runtime, database, authentication, analytics, or external map SDK is part of the supported architecture.
- `app/page.tsx` owns application state, map rendering, interactions, search, scoring, localization wiring, and PNG export.
- `app/globals.css` owns responsive layout and map/control styling.
- The **canonical city identifier is the Chinese key in `chinaMap`**. That same key joins geometry, visit state, concise labels, and English names. Do not rename city keys casually: persisted visit state is keyed by these identifiers.
- Visit state is stored under `visited-china-levels-v1`; locale is stored under `visited-china-locale-v1`. Preserve these keys unless a task explicitly includes a migration.

## Change routing

| Task | Start here | Also check |
| --- | --- | --- |
| UI/layout/style | `app/page.tsx`, `app/globals.css` | responsive/touch behavior |
| UI copy / locale | `lib/i18n.ts` | `app/page.tsx`, `app/layout.tsx`, `tests/localization.test.mjs` |
| English city names | `lib/city-names-en.ts` | `tests/localization.test.mjs` |
| Chinese map labels | `lib/city-labels.ts` | label visibility/selection in `app/page.tsx` |
| Map interaction | pointer/zoom handlers in `app/page.tsx` | `tests/clickable-labels.test.mjs`, `tests/micro-city-targets.test.mjs` |
| Label placement / geometry | `lib/label-geometry.mjs` | `tests/label-geometry.test.mjs` |
| Map dataset | `lib/china-map-data.ts` | every keyed lookup and localization coverage |
| PNG export | `exportMap` in `app/page.tsx` | localization, labels, export-site env var |
| Metadata / base path | `app/layout.tsx`, `next.config.ts` | GitHub Pages workflows |
| CI / previews / deploy | `.github/workflows/*` | `docs/agent-playbooks.md` |

## Behavioral invariants

### Map interaction

- Desktop and touch intentionally differ: desktop max zoom is 6; coarse-pointer/touch max zoom is 18.
- Click/tap selection must remain distinct from drag/pinch. The pointer handlers include movement thresholds, mouse-click suppression after dragging, and a short level-choice guard to absorb mobile synthetic clicks.
- Touch selection can fall back to the nearest city bounds so tiny regions remain usable.
- City paths remain keyboard-selectable. Visible SVG text labels are clickable but deliberately **not** native focus targets; adding `tabIndex`/button semantics to the labels previously produced unwanted browser focus artifacts.
- City names are off by default. When enabled, labels appear progressively with zoom and every measured city label must be visible at maximum zoom.
- Do not add permanent micro-city dots, markers, or separate SVG hit targets unless a product requirement explicitly reverses that decision. Macau and other tiny regions are handled through zoom, progressive labels, and touch targeting.
- Label anchors use `findInteriorPoint(...)` plus the per-city map offset. Do not replace them with SVG bounding-box centers; that can place a label inside a neighboring polygon (the Tacheng/Karamay regression is tested).

### Localization

- `lib/i18n.ts` is the source of truth for UI and visit-level strings.
- `lib/city-names-en.ts` must contain an explicit English name for every `chinaMap` key. The test suite rejects missing entries and Chinese-character fallbacks.
- Chinese concise display labels belong in `lib/city-labels.ts`; canonical Chinese map keys/names remain unchanged.
- Search intentionally matches the map key, canonical Chinese name, and English name in either locale.
- Runtime locale switching updates `<html lang>`, document title, and description. `app/layout.tsx` supplies static bilingual social/metadata values for the exported page.
- PNG export must use the active locale too.

### Export and persistence

- The exported PNG always renders the complete map and legend; it must not depend on the user's current pan/zoom.
- Keep export URLs base-path aware through `NEXT_PUBLIC_EXPORT_SITE_ADDRESS`; do not hard-code preview/production paths into application logic.
- A visit level of `0` is a valid stored choice (`没去过` / `Not yet`); `visitedCount` intentionally counts only levels greater than zero.

### Static hosting and previews

- `next.config.ts` always uses `output: "export"`, `trailingSlash: true`, and `PAGES_BASE_PATH` for production or PR-preview subpaths. Avoid root-absolute asset assumptions.
- `main` is production source. `pages-content` is generated deployment state only; never develop application changes there.
- PR code executes only in the read-only `pr-preview.yml` workflow. The privileged `publish-pr-preview.yml` checks out trusted `main` and consumes the resulting **static artifact**; it must not execute or source PR code.
- Production and PR previews share the `pages-publish` concurrency group so deployment-state writes remain serialized.

## Validation

Use Node.js 22 and npm.

```bash
npm ci
npm run lint
npm test
```

`npm test` runs a static Next.js build and then the Node regression suite. Important coverage:

- `rendered-html.test.mjs` — exported GitHub Pages metadata/URL regressions.
- `localization.test.mjs` — complete English city coverage and reviewed non-trivial names.
- `label-geometry.test.mjs` — interior anchors, Tacheng/Karamay, Macau stability.
- `clickable-labels.test.mjs` — progressive labels, all labels at max zoom, label interaction/focus behavior.
- `micro-city-targets.test.mjs` — tiny-city assumptions and absence of separate markers/hit targets.
- `list-cities.test.mjs` — audit utility that prints canonical map keys.

For ordinary code changes, lint + `npm test` is the local minimum. For workflow/base-path changes, also reason through both builds in `pr-preview.yml`: an empty local base path and `/visited-cities-cn/preview/pr-<number>`.

## Definition of done

- Make the smallest change that preserves the invariants above.
- Add/update regression coverage when changing an invariant or fixing a regression.
- Do not rewrite the large map dataset for unrelated work.
- Keep README product-facing; put agent-only implementation knowledge here or in the targeted playbooks.
- On same-repository PRs, expect the validation workflow to run and the trusted publisher to post/update the GitHub Pages preview URL after success.

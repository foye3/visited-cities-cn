# Agent playbooks

Open only the section relevant to the current task. The stable repository-wide rules live in [`../AGENTS.md`](../AGENTS.md).

## Localization or city-name changes

1. Keep Chinese `chinaMap` keys as canonical IDs. Do not translate or rename those keys.
2. Put UI and visit-level copy in `lib/i18n.ts`; avoid new locale conditionals with ad-hoc string literals in `app/page.tsx` when the text belongs in the locale table.
3. Put English city display names in `lib/city-names-en.ts` and keep one explicit entry per map key.
4. Put only concise Chinese map-label overrides in `lib/city-labels.ts`.
5. Check every surface that bypasses ordinary JSX copy:
   - search result labels and matching;
   - path/popover accessibility labels;
   - runtime document language/title/description;
   - static social metadata in `app/layout.tsx` when appropriate;
   - confirmation text;
   - PNG title, score/legend text, labels, suffixes, and filename.
6. Run `npm run lint && npm test`. `tests/localization.test.mjs` is the coverage gate for English names; extend its reviewed-name assertions when a translation has a non-obvious established form.

Avoid deriving English names mechanically from pinyin when an established English/romanized form exists. Existing reviewed examples include Xilingol, Shigatse, Chamdo, Nyingchi, Kashgar, Hotan, Hsinchu, Kaohsiung, Hong Kong, and Macao.

## Map interaction or responsive UI changes

The map uses Pointer Events rather than separate mouse/touch implementations, with special handling for device differences. The max-zoom branch uses `window.matchMedia("(pointer: coarse)")`, so it follows the device's primary-pointer media query rather than the `pointerType` of an individual event. Before simplifying a handler, preserve the behavior that motivated it.

Check these scenarios after a change:

- Desktop click selects a city; moving the mouse away does not leave a native SVG focus artifact.
- Desktop drag pans and does not subsequently select the city where the drag started/ended.
- Mouse wheel zoom keeps the cursor/map focus stable enough for navigation.
- Touch tap selects a city without the synthetic follow-up click immediately choosing a footprint level.
- Single-finger drag pans without selecting a city.
- Two-finger pinch zooms and suppresses city selection.
- Tiny regions remain selectable through high zoom, enabled labels, or touch nearest-bounds targeting; do not add always-visible micro-city markers.
- Search focus selects a city and centers it; the reset control returns to the full-map view.
- City-name labels remain progressively disclosed; maximum zoom reveals every measured label.
- Paths remain keyboard selectable. SVG text labels should remain pointer-selectable but non-focusable unless the accessibility model is deliberately redesigned and browser focus styling is tested.
- Test at narrow/mobile widths as well as desktop, because controls/popovers and the map stage share responsive CSS in `app/globals.css`.

Relevant regression files are `tests/clickable-labels.test.mjs` and `tests/micro-city-targets.test.mjs`. Add a focused regression before changing a behavior that is not already encoded there.

## Labels or map geometry changes

`chinaMap[city].path` contains the SVG geometry; `chinaMap[city].offset` is applied to rendering/label placement. Label placement is not a normal centroid/bbox-center problem because multi-part or concave polygons can put that point outside the intended region or inside a neighbor.

Use `findInteriorPoint` from `lib/label-geometry.mjs` for anchors. Keep `tests/label-geometry.test.mjs` passing, especially:

- every city has a finite anchor inside one of its polygon components;
- Tacheng's anchor does not land inside Karamay;
- Macau's tiny geometry/anchor remains stable.

For readability, add a Chinese concise display override in `lib/city-labels.ts` rather than shortening the canonical map key. If English labels are too long, adjust label-fit/visibility logic deliberately rather than changing canonical IDs.

Do not load or rewrite the full ~600 KB `lib/china-map-data.ts` for a label-only task.

## PNG export changes

`exportMap` constructs a standalone SVG string, loads it into an `Image`, paints a fixed-size canvas, and downloads PNG output. It intentionally does not reuse the current map transform.

When changing export behavior, verify:

- all map paths render with the same visit-level color mapping as the UI;
- exported labels obey the label toggle and active locale;
- title, score, city count, legend details, point suffixes, and filename are localized;
- the full map and legend remain present even when the interactive view is zoomed/panned;
- the footer uses `NEXT_PUBLIC_EXPORT_SITE_ADDRESS`, so production and PR-preview exports do not advertise a stale host/path;
- XML text/path values remain escaped before interpolation.

## GitHub Pages, base-path, or workflow changes

There are two distinct GitHub Actions trust zones:

1. `.github/workflows/pr-preview.yml` runs PR source/build code with read-only repository permissions, validates it, and uploads static artifacts.
2. `.github/workflows/publish-pr-preview.yml` is triggered from the completed validation run, checks out trusted `main`, downloads the static preview artifact, validates its shape/size, writes it into generated `pages-content`, deploys combined production + active previews, and posts the PR preview URL. It must not execute PR scripts or source code.

Do not collapse those Actions trust zones by checking out or executing the PR branch in the privileged publisher.

The published preview is not a browser sandbox: opening it executes the compiled PR client-side JavaScript. Production and PR previews are different paths on the same `foye3.github.io` origin, so origin-scoped browser state such as `localStorage` is shared between them. Keep that distinction in mind when reasoning about preview safety or adding browser-side persistence.

Production `.github/workflows/deploy-pages.yml` builds `main`, refreshes `pages-content/production`, preserves active `pages-content/preview/*`, assembles the combined site, and deploys it. Preview cleanup is handled separately when PRs close.

Base-path rules:

- Production: `/visited-cities-cn`.
- PR preview: `/visited-cities-cn/preview/pr-<number>`.
- Local-preview validation: empty base path.
- `next.config.ts` is the single place that turns `PAGES_BASE_PATH` into Next.js `basePath` and the default public export-site address.

If a preview HTML page loads but `_next/static/...` assets 404, inspect the build-time `PAGES_BASE_PATH`, generated asset URLs, and which artifact was deployed before changing application routing. Transient GitHub Pages/CDN cache misses can also occur, so distinguish reproducible wrong paths from one-off fetch failures.

Workflow changes should preserve the shared `pages-publish` concurrency group to serialize deployment-state writes. Never treat `pages-content` as an application source branch.

## Pull-request completion

For a same-repository PR:

1. Run local lint/tests before opening the PR.
2. Keep the PR description explicit about invariants affected and tests added/run.
3. Verify the PR head receives a successful validation workflow.
4. Verify the bot comment points to `https://foye3.github.io/visited-cities-cn/preview/pr-<number>/` when the change publishes a preview.
5. For UI changes, use the preview to exercise the relevant desktop/touch scenarios rather than relying only on static source-string tests.

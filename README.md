# 中国地级市足迹

An interactive map for recording and sharing the prefecture-level cities you have visited in China.

**Published site:** [https://foye3.github.io/visited-cities-cn/](https://foye3.github.io/visited-cities-cn/)

## What it does

- Click or tap a city and assign one of six footprint levels:
  - 居住 / Lived — 5 points
  - 短居 / Stayed — 4 points
  - 游玩 / Explored — 3 points
  - 出差 / Business — 2 points
  - 路过 / Passed — 1 point
  - 没去过 / Not yet — 0 points
- Calculates a total footprint score and the number of marked cities.
- Searches cities by their short or full Chinese names and focuses the selected city on the map.
- Supports mouse-wheel zoom and dragging on desktop, plus dragging and two-finger pinch zoom on mobile.
- Keeps the city option panel a fixed screen size and positions it beside the selected city.
- Shows city names on demand. Labels are hidden by default, small-city labels appear as the map is enlarged, and desktop users can see a city name by hovering while labels are off.
- Saves progress automatically in the current browser and provides a confirmed reset action.
- Exports the complete, unzoomed map as a PNG with the score, legend, optional city labels, and the published site address.
- Includes responsive layouts, mobile-safe 16 px search input sizing, Open Graph metadata, sharing artwork, and app icons.

## Privacy and storage

The application is a static, client-side site. It has no account system, API, database, analytics, or server-side storage. Footprint choices are stored in the browser under the `visited-china-levels-v1` local-storage key, so they remain on that browser and device unless the user clears its site data.

## Implementation

- **UI:** Next.js 16, React 19, TypeScript, and CSS.
- **Map:** local SVG path data from `lib/china-map-data.ts`; no external map SDK is loaded.
- **State:** React state synchronized to `localStorage` after the initial browser read.
- **Input model:** Pointer Events provide a shared mouse/touch interaction layer. Movement thresholds distinguish a city tap from a pan, a short selection guard prevents synthetic mobile clicks from immediately choosing a visit level, and two active pointers drive pinch zoom.
- **Zoom limits:** desktop zoom is capped at 6× and coarse-pointer/mobile zoom at 18× so small cities remain reachable.
- **City labels:** path bounding boxes and the rendered map scale determine whether each label has enough screen space. At high zoom levels, progressively smaller cities become eligible.
- **Image export:** the app reconstructs the full map and legend as an 1800 × 1160 SVG, renders it to a canvas, and downloads the resulting PNG. Export does not inherit the interactive map's current pan or zoom.
- **Metadata:** `app/layout.tsx` emits the Chinese site name, description, Open Graph/Twitter preview data, and icons. URLs switch to the GitHub Pages origin during a Pages build.

## GitHub Pages publishing

GitHub Pages serves static files, so the Pages build uses a separate Next.js configuration path:

1. A push to `github-pages` starts `.github/workflows/deploy-pages.yml`.
2. GitHub Actions installs Node.js 22 dependencies with `npm ci`.
3. `npm run build:pages` sets `GITHUB_PAGES=true` and runs `next build`.
4. `next.config.ts` enables `output: "export"`, applies the repository base path `/visited-cities-cn`, adds trailing slashes, and writes the static site to `out/`.
5. `tsconfig.pages.json` excludes the Cloudflare/Sites-only worker and database files from the static-export type check.
6. The workflow uploads `out/` as a Pages artifact and deploys it through the protected `github-pages` environment.

The workflow uses only the minimum required permissions: read access to repository contents, write access to Pages, and an OIDC identity token for the deployment.

## Branches

- `main` contains the current application source and documentation.
- `github-pages` is the deployment branch. Pushing to this branch automatically rebuilds the public GitHub Pages site.

The two branches are synchronized at the time of this README update. Future application changes should be developed on `main`, verified, and then fast-forwarded or merged into `github-pages` to publish them.

## Local development

Requirements: Node.js 22 and npm.

```bash
npm ci
npm run dev
```

Useful checks:

```bash
# Standard Sites/Vinext production build
npm run build

# GitHub Pages static export
PAGES_BASE_PATH=/visited-cities-cn \
NEXT_PUBLIC_EXPORT_SITE_ADDRESS=foye3.github.io/visited-cities-cn \
npm run build:pages

# Lint
npm run lint
```

The normal `npm run build` path remains available for the existing Sites/Vinext deployment. The GitHub Pages build is activated only when `GITHUB_PAGES=true`, so the two hosting targets can share the same source without changing their asset or metadata URLs.

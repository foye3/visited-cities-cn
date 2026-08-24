# 中国地级市足迹

An interactive map for recording and sharing the prefecture-level cities you have visited in China.

**Published site:** https://foye3.github.io/visited-cities-cn/

## What it does

- Click or tap a city and assign one of six footprint levels: 居住 / 短居 / 游玩 / 出差 / 路过 / 没去过.
- Calculates a total footprint score and the number of marked cities.
- Searches cities by Chinese name and focuses the selected city on the map.
- Supports desktop and touch pan/zoom interactions.
- Stores progress locally in the browser.
- Exports the complete map as a PNG.

## Privacy and storage

The application is a static, client-side site. It has no account system, API, database, analytics, or server-side storage. Footprint choices are stored in the browser under the `visited-china-levels-v1` local-storage key.

## Implementation

- **UI:** Next.js 16, React 19, TypeScript, and CSS.
- **Map:** local SVG path data from `lib/china-map-data.ts`; no external map SDK is loaded.
- **Hosting:** static export deployed to GitHub Pages.
- **State:** React state synchronized to `localStorage`.
- **Image export:** the app renders the full map and legend to an SVG/canvas and downloads the result as PNG.

The repository intentionally contains only the GitHub Pages application path. The previous ChatGPT/Copilot Sites, Vinext, Cloudflare Worker, database, and related scaffolding are no longer part of the project.

## Development

Requirements: Node.js 22 and npm.

```bash
npm ci
npm run dev
```

Useful checks:

```bash
npm run lint
npm test
```

`npm test` performs the static Next.js build and then runs regression checks for exported HTML, map/label geometry, clickable and micro-city behavior, and localization coverage.

### Contributor and AI-agent guidance

- [`AGENTS.md`](AGENTS.md) is the compact implementation map: architecture, invariants, task-to-file routing, and validation expectations.
- [`docs/agent-playbooks.md`](docs/agent-playbooks.md) contains deeper task-specific guidance for localization, map interactions/geometry, PNG export, and GitHub Pages workflows.

These guides intentionally avoid duplicating product documentation and point agents away from loading the large map dataset when a task does not require it.

## GitHub Pages publishing

`main` is the production branch. A push or merge to `main` builds the static site with base path `/visited-cities-cn` and publishes it to:

```text
https://foye3.github.io/visited-cities-cn/
```

The workflow is defined in `.github/workflows/deploy-pages.yml` and uses the protected `github-pages` deployment environment.

## Pull request previews

Pull requests targeting `main` are validated automatically. For same-repository PRs, the workflow also publishes an isolated preview at:

```text
https://foye3.github.io/visited-cities-cn/preview/pr-<number>/
```

The workflow posts or updates that URL on the PR. Preview content is persisted in the generated `pages-content` branch so multiple open PR previews can coexist. When a PR is closed or merged, its `preview/pr-<number>` directory is removed automatically.

The `pages-content` branch contains generated static output only; application source remains on `main` and feature branches.

## Branch model

- `main` — production application source. Every successful push deploys production.
- feature branches — application changes under development.
- `pages-content` — generated deployment content maintained automatically by GitHub Actions.
- `github-pages` — legacy deployment branch retained temporarily for rollback during this migration; it can be deleted after the new `main` deployment is verified.

## Static export configuration

`next.config.ts` always enables static export. The deployment workflow sets `PAGES_BASE_PATH` to either the production path or the PR-specific preview path, allowing the same application build to work at both locations without runtime hosting dependencies.

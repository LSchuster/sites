# sites monorepo

A collection of small, fully static websites, each self-contained in its own folder under
`sites/` and deployed to its own subdomain of the shared umbrella domain **teespoon.io**
(registered 2026-08-08 via Cloudflare Registrar; one registration covers every site —
subdomains are free).

| Site | Folder | Hostname (planned) | Status |
|---|---|---|---|
| conflicts.io — an atlas of human conflict | `sites/conflicts/` | `conflicts.teespoon.io` | pre-launch |
| invoice — German invoice generator with e-invoice (ZUGFeRD) output | `sites/invoice/` | `invoice.teespoon.io` | in development |
| dataplant — turn data into a procedurally generated 3D planet | `sites/dataplant/` | `dataplant.teespoon.io` | in development |

## Structure rules

- **Each site is self-contained**: its own `package.json`, lockfile, `node_modules`,
  build config, docs, and `CLAUDE.md`. Run all npm commands *inside* the site folder.
- **No cross-site imports, no shared workspace.** Deliberate: Cloudflare Pages builds each
  site with its "root directory" pointed at the site folder, which requires a local
  lockfile; independence also lets sites upgrade dependencies separately. Duplicated
  devDependencies are the accepted cost.
- **Hosting model** (details in `sites/conflicts/docs/hosting-architecture.md`, which
  doubles as the umbrella-level hosting doc until a second site exists): one Cloudflare
  account, one DNS zone for the umbrella domain, one Cloudflare Pages project per site,
  each bound to `<site>.teespoon.io`. Cloudflare's free Universal SSL covers first-level
  subdomains automatically — never nest deeper (`a.b.teespoon.io` would need a paid cert).

## Adding a new site

1. `mkdir sites/<name>` and scaffold a self-contained static app (own `package.json`,
   build emitting `dist/`, relative `base` so it deploys anywhere, own `.gitignore`,
   own `CLAUDE.md`).
2. Add a row to the table above.
3. Create a Cloudflare Pages project: root directory `sites/<name>`, build command
   `npm run build`, output `dist`, and a build-watch path of `sites/<name>/*` so pushes to
   other sites don't trigger rebuilds.
4. Add the custom domain `<name>.teespoon.io` to the project (DNS record is created
   automatically in the shared zone).
5. Extend the CI workflow with a job for the new folder (path-filtered).

## Licence

The repository `LICENSE` is **GPL-3.0-or-later**, required by `sites/conflicts/` (it
redistributes GPL border data — see its README). A site that ships no GPL material may
carry its own `LICENSE` file inside its folder: `sites/invoice/` and `sites/dataplant/`
are **MIT** (invoice's fonts are OFL 1.1 under their own notice). Anything without a
folder-level licence is GPL.

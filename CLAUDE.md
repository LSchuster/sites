# Monorepo brief

This repo holds multiple independent static websites, one per folder under `sites/`. Each
site is fully self-contained (own `package.json`, lockfile, docs, `CLAUDE.md`) and deploys
to its own subdomain of one shared umbrella domain. Root `README.md` carries the site
table, the structure rules, and the add-a-site checklist.

**Working on a site? `cd` into its folder and follow its own `CLAUDE.md` — that file is
the contract for everything inside.** Currently:

| Site | Contract |
|---|---|
| `sites/conflicts/` — conflicts.io atlas | `sites/conflicts/CLAUDE.md` |

Hard rules at repo level:

1. **No cross-site imports and no npm workspaces.** Sites must stay independently
   buildable with `npm ci && npm run build` from their own folder (Cloudflare Pages builds
   with root directory = the site folder).
2. **Run npm commands inside the site folder**, never at the root. There is no root
   package.json by design.
3. **Root `LICENSE` (GPL-3.0-or-later) covers everything** unless a site folder carries
   its own licence file. `sites/conflicts/` must stay GPL while it ships its border data.
4. Hosting/deploy/launch/monetization strategy for the repo lives in
   `sites/conflicts/docs/` (publication-plan, hosting-architecture,
   commercialization-plan, implementation-roadmap) — `hosting-architecture.md` describes
   the umbrella-domain model all sites share.

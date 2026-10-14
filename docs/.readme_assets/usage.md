## Local development

Everything runs via Nix, token-free:

Ports live in one place — the `ports` attrset in `flake.nix`; the runners
export them, so nothing here hardcodes a number.

| Command | What |
| --- | --- |
| `nix run .#dev` | full stack: shared postgres + backend + frontend |
| `nix run .#frontend` | Next.js site only |
| `nix run .#backend` | axum API only (ensures the shared postgres) |
| `nix run .#db` | ensure the shared ev_invest postgres is up (+ this repo's `landing` db) |
| `nix run .#gen-api` | regenerate `backend/openapi.json` + the TS client (run after any DTO/handler change; commit both) |
| `nix run .#test` | frontend typecheck + i18n + Tailwind conflict gates |
| `nix develop -c cargo test --workspace` | backend and domain unit tests |
| `nix run .#publish` | bump latest remote `vX.Y.Z` tag (`-- major\|minor\|patch`) + push |

Frontend runs pull docs and the REA bundle from checkouts next to
`landing/` — `_estate/whitepaper/`, `blog/`, `_estate/real_estate_allocation/`,
all optional. A missing checkout just warns: docs degrade to a PDF link, the
portfolio section falls back to the in-repo render. For a live REA remote
instead of the baked bundle: run `nix run .#dev` in the
`_estate/real_estate_allocation` checkout (→ :59079, verify with
`nix run .#healthcheck` there).

## Microfrontends — no iframes

Other EV surfaces compose at runtime through `frontend/shared/mfe`, never via
`<iframe>`. Full reference: [`frontend/PATTERNS.md` §8](../../frontend/PATTERNS.md)
and [`frontend/README.md`](../../frontend/README.md). The home portfolio section
is `real_estate_allocation`'s custom element, served same-origin from `/mfe/`
(baked into the image from `real_estate_allocation#embeds`, with one static
snapshot per locale); `/whitepaper` and `/publications/[slug]` are static HTML
from the sibling typst repos.

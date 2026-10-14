# landing — frontend

Public landing of the EV Investment fund, served at `invest.evinvest.ltd/` —
Next.js 16 (App Router) + React 19, laid out with Feature-Sliced Design, styled
with Tailwind v4. Moved from `site_conductor/frontend` (origin/main `ac600eb`)
without its zone machinery: the investor cabinet on `/cabinet` of the same host
is a separate app routed by Traefik (see [`PATTERNS.md` §9](./PATTERNS.md)).

## Layout

```
app/          routing + root layout (Server Components by default)
views/        page composition (HomeView), agnostic of A/B
features/     behaviour slices: analytics, ab-variant, error-monitoring, contact-message, job-application, publication-search
entities/     domain data (team, …)
shared/       app-agnostic ui/, lib/, config/, hooks/, mfe/ (microfrontend host)
application/  styles/globals.css → imports @evinvest/uikit/styles/tokens.css
public/       static assets (populated by the build; see below)
```

FSD import order `app → views → features → entities → shared`; import from a
slice's `index.ts`, never deep paths. Conventions live in [`PATTERNS.md`](./PATTERNS.md).

## Run

```sh
cp .env.example .env.local   # set NEXT_PUBLIC_API_URL at least
npm ci && npm run dev
```

`public/` is filled by the build, not by hand: the REA portfolio embed and its
per-locale snapshots (`public/mfe/`), the whitepaper and publications HTML/PDF,
and a copy of `assets/`. Without them the dev server still boots; the home page
build fails on the missing portfolio snapshot (§ component-MFE snapshot contract
in `PATTERNS.md`).

Tailwind builds automatically inside Next via the `@tailwindcss/postcss` plugin —
no separate step. It imports the shared tokens from
`@evinvest/uikit/styles/tokens.css` through `application/styles/globals.css`;
tokens are owned by [`EV-Main/lib`](https://github.com/EV-Main/lib) and
reach this repo through a `@evinvest/uikit` bump, never a local edit.

## Checks

```sh
npm run check                # tsc --noEmit
npm run lint                 # eslint
npm run lint:css             # stylelint
npm run css:check            # Tailwind class conflicts in cn()
npm run i18n:check           # en generated from code + translation drift
npm run redirects:check      # /en/* collapse and the English rewrite
```

> The site calls only its own backend (vacancies / applications / contact / newsletter)
> through the generated client in `shared/api` — there is no hub API client here.

### Visual regression — not wired yet

`playwright.config.ts` and `tests/` (section screenshots, the first-viewport
cabinet CTA, the Russian portfolio) are imported verbatim from
`site_conductor@ac600eb` and do **not** run in this repo yet: the config still
reads the old port variable, the header test and the cabinet-CTA test still
target the removed account chip and `/cabinet/login`, the committed baselines
predate the header rewrite, and neither `nix run .#test`
nor CI invokes Playwright. Until that lands, `npm run check` only typechecks
them.

Baselines are Linux renders (the flake pins nixpkgs' Chromium; macOS has none),
so they are never captured on a Mac. The intended refresh, as in
site_conductor: a CI job renders them and uploads a `visual-snapshots`
artifact, then

```sh
gh run download <run-id> -R EV-Fund/landing -n visual-snapshots -D frontend/tests/__screenshots__
```

and commit after looking at the diffs. That job needs the REA deploy key (the
home page cannot render without REA's per-locale snapshots).

## Environment

One typed reader, [`config.ts`](./config.ts); `process.env` anywhere else fails
lint. Annotated defaults: [`.env.example`](./.env.example). The prod values are
set in `flake.nix` (image build and container env).

| Variable | When | Prod value | If unset |
| --- | --- | --- | --- |
| `NEXT_PUBLIC_SITE_URL` | build | `https://invest.evinvest.ltd` | placeholder origin at build; prod server refuses to boot |
| `NEXT_PUBLIC_API_URL` | build | `https://invest.evinvest.ltd` (`/api/v1` via Traefik) | throws on first use, dev and prod |
| `NEXT_PUBLIC_REA_URL` | build | `https://rea.evinvest.ltd` | dev: flake falls back to local REA; prod server refuses to boot |
| `NEXT_PUBLIC_POSTHOG_KEY` / `_HOST` | build | literal in `flake.nix` | analytics no-op |
| `NEXT_PUBLIC_SENTRY_DSN`, `NEXT_PUBLIC_APP_ENV` | build | — | error monitoring no-op |
| `NEXT_PUBLIC_ANALYTICS_ENDPOINT` / `_WEBSITE_ID` | build | — | Umami not loaded |
| `API_URL_INTERNAL` | runtime | `http://landing-backend:58846` | prod server throws on first server fetch; dev falls back to the public URL |
| `SENTRY_DSN`, `APP_ENV`, `SENTRY_ORG` / `_PROJECT` / `_AUTH_TOKEN` | runtime / CI | — | no-op |

`NEXT_PUBLIC_*` is inlined at `next build`; changing it means a new image.
Dropped with the zone machinery: `CABINET_ZONE_URL`, `REA_ZONE_URL`,
`AUTH_WEB_URL`. The backend's contract (`CORS_ALLOWED_ORIGINS` and the rest) is
the `RawSettings` struct in `backend/src/config.rs`.

## Microfrontends

The landing composes other EV surfaces at runtime — **never via `<iframe>`** (see
[`PATTERNS.md` §8](./PATTERNS.md)). Two transports from `@/shared/mfe`:

| Remote ships… | Use | Mount |
| --- | --- | --- |
| a self-registering custom-element ESM bundle (React, Rust/WASM) | `RemoteElement` | light DOM; inline or `/apps/<name>` |
| a self-contained static HTML document (typst whitepaper/blog) | `RemoteDocument` | light DOM (`prose`) or, if self-styled, a shadow root |

### Element remotes — `RemoteElement`

Inline widgets or whole pages, JS bundles (React, …) or Rust/WASM (Dioxus, Leptos).

**Universal contract — a custom element.** Every microfrontend ships one
self-registering ESM bundle that calls `customElements.define("mfe-<service>-<name>", …)`.
The host mounts it with [`<RemoteElement>`](./shared/mfe/remote-element.tsx): load
the bundle by URL → `customElements.whenDefined(tag)` → render `<tag>`, mapping
props to attributes and CustomEvents to callbacks. The boundary is identical for
every framework. **Light DOM only** — Tailwind v4 `@property` tokens break inside
shadow roots, and the global uikit tokens must cascade in.

- **Inline widget** — render `<RemoteElement>` with the remote's `tag` and
  `scriptUrl` as in-repo constants. `scriptUrl`s are operator-controlled and run
  third-party JS in this origin — **treat them as code**; gate them against an
  origin allowlist if they ever become user-/dynamically-sourced.

  ```tsx
  <RemoteElement tag="mfe-real-estate-overview" scriptUrl="/mfe/mfe-real-estate-overview.js"
    fallback={<ShadowDocument src="/mfe/portfolio.en.html" />} />
  ```

**Producing a microfrontend** (other repos — this app ships no producer SDK). The
canonical, fuller recipe lives in the hub's
[`docs/ARCHITECTURE.md` § Microfrontends](https://github.com/EV-Main/banking/blob/main/docs/ARCHITECTURE.md#microfrontends); the
contract is shared with `cabinet`, so keep this in sync with it.

- **React** — wrap a component as a custom element with
  [`@r2wc/react-to-web-component`](https://github.com/bitovi/react-to-web-component);
  ship it as one ESM bundle that self-registers. _Optional_ for React-to-React
  widgets: Module Federation 2.0 **runtime** (`@module-federation/runtime` +
  `bridge-react`) to share one React instance — never `@module-federation/nextjs-mf`.
- **Rust/WASM** — Dioxus 0.7 mounts via `dioxus-web` `Config::rootelement(Element)`
  into the custom element; Leptos via `mount_to(HtmlElement, …)`. CSR-only, light
  DOM, `wasm-bindgen =0.2.125`. Don't use `dioxus-web-component` yet (it pins Dioxus
  0.6). _Open item:_ prove multiple independent Dioxus instances per page before
  relying on it.

### Document remotes — `RemoteDocument`

For remotes that are a self-contained **static HTML document** (the typst-built
[whitepaper](<./app/[locale]/publications/whitepaper>) and
[publications](<./app/[locale]/publications>)) rather than a custom-element
bundle. The document is addressed by URL (site-relative → read from `public/`;
absolute → fetched, so a doc service can move to its own origin) and composed into
the page natively, keeping the host chrome and scroll.

```tsx
// research article — no styles of its own: light DOM + host typography (prose),
// rendered server-side (SSR'd, indexable)
<RemoteDocument src={`/publications/${slug}.dark.html`} className="prose prose-invert …" />

// whitepaper — ships its own complete styles targeting bare tags: isolate it in a
// shadow root (a small client island; see PATTERNS.md for the React-19/DSD caveat)
<RemoteDocument src="/whitepaper.dark.html" isolate fallback={…PDF link…} />
```

`isolate={false}` (default) is a pure Server Component; `isolate` mounts a client
shadow island. A source that can't be loaded renders the `fallback`, so a missing
doc build degrades gracefully. The docs are produced by the sibling `whitepaper`/
`blog` repos and copied into `public/` by the build.

## Design system (Figma)

The visual language is mirrored in a Figma file
([`Main`](https://www.figma.com/design/e0V2P1cQpEFRuXTeNtEMh6/Main)), kept
**code-first**: [`application/styles/globals.css`](./application/styles/globals.css)
plus the shared `@evinvest/uikit/styles/tokens.css` (from
[`EV-Main/lib`](https://github.com/EV-Main/lib)) are the source of truth;
the Figma side is conformed to them, never the reverse.

- **Tokens → Figma Variables.** Three collections mirror the CSS tokens 1:1, each
  with `var(--token)` code syntax so Dev Mode round-trips cleanly: `ev/color`
  (the kit's roles and surfaces from `@evinvest/uikit/styles/tokens.css`:
  surfaces background / card / popover / muted, ink / ink-mid / ink-soft, lines
  border / input / ring, filled roles brand / primary + primary-ink / secondary /
  positive, and the accent ladder trace → debug → info → warn → error),
  `ev/semantic` (shadcn roles aliased onto `ev/color`), `ev/radius` (the
  `--radius` scale).
- **Components.** The shadcn `bricks` are rebuilt as Figma variant-sets bound to
  those Variables (Button, Badge, Input/Field, Checkbox, Switch, Card, Select,
  Tabs, Accordion, Tooltip), on a dark navy surface. Fonts: Inter (sans) +
  Playfair (display).

> Code Connect (the design↔code mapping) is intentionally **not** wired up: it
> requires a Figma Organization/Enterprise plan and the file is on Pro. Tokens and
> variant-sets work regardless.

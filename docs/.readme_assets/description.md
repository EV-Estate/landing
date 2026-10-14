`landing` is the public landing of the **EV Investment** fund at
`invest.evinvest.ltd` — a real-estate advisory and investment fund specializing
in premium coastal developments in Quy Nhon, Vietnam. A Next.js 16 (App Router)
front end in [`frontend/`](frontend) sits next to an axum + Postgres API in
[`backend/`](backend) (vacancies, applications, contact, newsletter) with its
pure model in [`domain/`](domain). The investor cabinet on `/cabinet` of the
same host is a separate app routed by Traefik. Moved from
`EV-Main/site_conductor` at `ac600eb`. The shared design system ships as the
published `@evinvest/uikit`.

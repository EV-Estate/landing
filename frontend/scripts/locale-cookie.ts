// Carries the reader's site language into the cabinet.
//
// The cabinet is a separate app on this host (EV-Fund/invest behind Traefik's
// `PathPrefix(/cabinet)`), entered through an unprefixed `/cabinet`. To pick a
// language for that entry it reads the `ev_locale` cookie, falling back to
// Accept-Language when there is none. Accept-Language is a suggestion; the URL
// the reader is looking at is a fact, and the fact must win — without this a
// reader on the English site with a Russian-configured browser lands in a
// Russian cabinet.
//
// Runs pre-paint, inlined into <head> by application/layout/site-document.tsx:
// the header's cabinet link is clickable the moment the header paints, so a
// deferred script can lose the race it exists to win.
//
// COOKIE CONTRACT — shared with the cabinet, which is where the cookie is
// otherwise minted and read (inherited from banking
// `cabinet/frontend/shared/config/cookies.ts`). Two rules, and the
// browser enforces both, so a mismatch fails loudly rather than silently:
//   - `__Host-` requires Secure, and Secure requires https. Keying the prefix
//     off the live protocol therefore produces exactly the name the cabinet
//     computes from AUTH_COOKIE_SECURE on both hosts — `__Host-ev_locale` in
//     production, bare `ev_locale` over plain http in dev.
//   - `__Host-` also requires Path=/ and forbids Domain. Both hold below.
//
// Deliberately unconditional: this is a mirror of the current URL, not a
// remembered preference, so re-asserting it on every page is the point. A
// reader who switches to /ru and clicks through to the cabinet must arrive in
// Russian even though the cookie already said English a moment ago.

/** Inline `<script>` body. `locale` is the document's own, baked in per render. */
export const localeCookieScript = (locale: string) =>
  `(()=>{try{var s=location.protocol==="https:",n=(s?"__Host-":"")+"ev_locale";document.cookie=n+"="+${JSON.stringify(locale)}+";path=/;max-age=31536000;samesite=lax"+(s?";secure":"")}catch(e){}})()`;

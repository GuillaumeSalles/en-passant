# Electron desktop app

Status: bundled desktop foundation implemented in this PR

## Outcome

En Passant's desktop shell and core application assets are installed with Electron. The app starts
and remains useful without internet access, including on first launch.

Internet access is only required for server-owned features:

| Available offline                   | Requires internet                    |
| ----------------------------------- | ------------------------------------ |
| Create and edit repertoires         | Email OTP and Google sign-in         |
| Train and review lines              | Sync authenticated data              |
| Run the packaged Stockfish engine   | Import games from remote providers   |
| Import and export local PGNs        | Download desktop application updates |
| Use local IndexedDB and preferences | Load remote account data             |

The web app remains independently deployable to Cloudflare Pages. Both targets use the same Solid
renderer build and HTTP contracts.

## Implemented architecture

### Packaged renderer

`npm run desktop:build` produces two outputs:

- `dist/`: the existing Vite renderer, including route chunks, Stockfish JavaScript and wasm,
  openings data, sounds, icons, and locally bundled Geist fonts;
- `dist-electron/main.cjs`: the bundled Electron main process.

Electron Forge packages both directories into `app.asar`. Production loads
`app://enpassant/app`; it never loads the hosted frontend as its normal renderer. Development uses
the Vite server so UI changes retain the existing feedback loop.

[`electron/protocol.ts`](../electron/protocol.ts) implements a standard, secure custom protocol. It:

- serves only files contained by the packaged `dist/` directory;
- returns `index.html` for extensionless Solid client routes;
- returns `404` for missing assets instead of hiding build errors behind the SPA fallback;
- applies CSP, COOP, COEP, CORP, referrer policy, and `nosniff` headers;
- assigns explicit content types for scripts, styles, wasm, fonts, audio, JSON, and icons;
- forwards only the `/api` subtree to the fixed `https://enpassant.io` backend origin;
- returns a defined `502` API response while offline without affecting local application routes.

The renderer service worker is disabled on `app:` because the installed files are already the
offline application shell. It remains enabled for production web builds.

### API and storage boundary

Existing relative `fetch("/api/...")` calls continue to work. Requests to
`app://enpassant/api/...` are handled in the main process and sent through the persistent Electron
session's Chromium network stack to `https://enpassant.io/api/...`.

The proxy:

- cannot be directed to another host;
- preserves the method, query, body, and application headers;
- strips renderer-supplied cookies and transport/browser headers;
- supplies the production origin and referrer expected by the existing backend contract;
- uses the Electron session's cookie jar with credentials included;
- strips `Set-Cookie` before returning the response to renderer JavaScript;
- passes successful backend responses through as the trusted HTTP contracts defined by this repo.

IndexedDB, local storage, backend cookies, and service state use the persistent
`persist:en-passant` session. The existing authenticated-owner metadata and `401` deletion behavior
remain in the renderer and apply to the desktop database without a separate storage implementation.

### Authentication

Better Auth accepts only HTTP(S) base URLs. On desktop,
[`src/lib/authClient.ts`](../src/lib/authClient.ts) gives Better Auth the production HTTPS auth URL,
then maps those auth requests back through the scoped `app://enpassant/api/auth/...` proxy.

Email OTP stays inside the bundled app. Google OAuth uses Better Auth's Electron PKCE transfer
flow and never loads Google in the application window. The narrow preload bridge asks the main
process to bind an ephemeral `127.0.0.1` callback listener and open a production
`/app/auth/desktop?desktop_auth=google` broker URL in the system browser. The broker shows an
explicit confirmation before starting Google OAuth and preserves the Electron client id, PKCE
state and code challenge, loopback port, and random callback path nonce.

After Google returns, the backend issues a short-lived, single-use authorization code. It also
signs the existing/new-account classification against that exact code and authenticated user. The
hosted app returns both values to the random loopback callback. The main process checks the PKCE
state, exchanges the code with its in-memory verifier, and verifies the signed classification
through the newly authenticated session. Both requests use the persistent Electron session's
Chromium cookie jar, so renderer JavaScript never receives the session token and no `Set-Cookie`
parsing or cookie copying is required.

The complete flow must still receive a real-account release-candidate check on every supported
platform before public distribution.

Development uses the same system-browser PKCE flow against the local Vite origin. Vite proxies the
browser broker and token exchange to the local backend, and the resulting session cookie is scoped
to `localhost` so the Electron development renderer can read the authenticated session. Packaged
builds use `https://enpassant.io` for the broker, token exchange, and session cookie.

### Electron security boundary

[`electron/main.ts`](../electron/main.ts) configures one application window with:

- Node integration disabled;
- context isolation and Chromium sandboxing enabled;
- web security enabled;
- a sandboxed preload exposing only Google sign-in initiation and typed completion/error events;
- webviews disabled and attachment attempts blocked;
- all permission checks and requests denied;
- DevTools available only in development;
- renderer-created windows denied;
- external URLs opened only for an exact HTTPS host allowlist;
- arbitrary top-level navigation denied, including Google and hosted auth pages;
- a single application instance.

The package uses ASAR and flips Electron fuses to disable Run-as-Node, Node options, and CLI inspect;
enable cookie encryption; and enforce embedded ASAR integrity plus load-only-from-ASAR.

The auth bridge validates its sender against the exact renderer origin. If a later feature needs a
file dialog, application menu operation, or update status, add one typed operation at a time,
validate its sender and arguments in the main process, and never expose raw `ipcRenderer`,
filesystem, shell, or network primitives.

## Commands

| Command                    | Purpose                                                   |
| -------------------------- | --------------------------------------------------------- |
| `npm run desktop:dev`      | Start Vite and the Electron development window            |
| `npm run desktop:build`    | Build the web renderer and Electron main process          |
| `npm run desktop:test`     | Run Electron protocol and navigation unit tests           |
| `npm run desktop:test:e2e` | Build and prove first-launch offline behavior in Electron |
| `npm run desktop:package`  | Create an unpacked application for the current platform   |
| `npm run desktop:make`     | Create configured distributables for the current platform |

Electron's TypeScript compilation is isolated in [`electron/tsconfig.json`](../electron/tsconfig.json)
so Electron/Node globals do not leak into browser source. The regular type-check and lint commands
include the desktop code.

## Regression coverage

Unit tests cover:

- exact navigation and external-link allowlists, including malicious lookalike hosts and unsafe
  schemes;
- rejection of embedded Google and hosted callback navigation;
- exact PKCE token parsing, loopback broker parameters, and account classification;
- packaged asset responses, security headers, SPA fallback, missing assets, and path containment;
- API target, method, body, origin/referrer, cookie stripping, response headers, and offline errors;
- Better Auth desktop request mapping and browser-broker URLs;
- desktop service-worker suppression.

[`tests/electron/bundled.spec.ts`](../tests/electron/bundled.spec.ts) launches Electron with DNS
disabled and a fresh user-data directory. It proves that:

- the app initializes its demo repertoire on first launch without reaching the internet;
- the board and moves tree render from `app://enpassant`;
- Stockfish is available from the installed bundle;
- the renderer remains cross-origin isolated;
- local fonts are installed and active;
- no service worker controls the desktop page;
- offline API calls fail without taking down the local app;
- the complete local loopback handoff verifies PKCE and retains the session cookie in Chromium;
- local storage survives a full Electron restart.

The existing web test suite remains the source of truth for detailed chess, PGN, state, storage, UI,
and browser-offline behavior.

## Packaging and distribution

[`forge.config.cjs`](../forge.config.cjs) currently packages macOS and Windows ZIP artifacts and a
Windows Squirrel installer. The application identifier is `io.enpassant.desktop`.

The implementation is packageable, but the generated artifacts are development builds. Before a
public release:

1. create proper source artwork plus `.icns` and `.ico` assets;
2. configure Apple Developer ID signing and notarization;
3. configure a Windows signing certificate or managed signing service;
4. add native macOS and Windows GitHub Actions jobs for package and smoke tests;
5. manually verify email OTP, Google OAuth, account switching, sign-out, session expiry, and
   authenticated IndexedDB deletion against production;
6. manually verify PGN downloads, Stockfish, sounds, keyboard commands, and multi-display window
   behavior from signed installers;
7. verify GPL source availability and ship the repository license, third-party notices, and
   Stockfish copying notice with every release;
8. publish draft GitHub Releases with checksums and release notes.

Use SemVer in `package.json` and tag desktop releases as `desktop-vX.Y.Z`. The desktop package and
hosted web application can release independently.

Enable automatic updates only after signed install, upgrade, interrupted-update, and rollback tests
pass. Electron's built-in updater supports macOS and Windows; Linux needs a package-manager or manual
update strategy.

## Release gates

The first public desktop release is blocked until:

- `npm run check`, `npm run desktop:test`, `npm run desktop:test:e2e`, and platform packaging pass;
- real email OTP and Google OAuth flows pass on every release platform;
- session expiry, account switching, explicit sign-out, and authenticated `401` responses delete the
  correct desktop IndexedDB before reload;
- anonymous data remains intact when there is no authenticated-user marker;
- artifacts have product icons, are signed, and macOS artifacts are notarized;
- install, upgrade, and uninstall are exercised on supported OS versions and architectures;
- update artifacts are accepted only after signature verification;
- GPL and third-party compliance materials are present.

## References

- [Electron security checklist](https://www.electronjs.org/docs/latest/tutorial/security)
- [Electron process sandboxing](https://www.electronjs.org/docs/latest/tutorial/sandbox)
- [Electron custom protocols](https://www.electronjs.org/docs/latest/api/protocol)
- [Electron fuses](https://www.electronjs.org/docs/latest/tutorial/fuses)
- [Electron Forge packaging overview](https://www.electronjs.org/docs/latest/tutorial/forge-overview)
- [Electron distribution overview](https://www.electronjs.org/docs/latest/tutorial/distribution-overview)
- [Electron application updates](https://www.electronjs.org/docs/latest/tutorial/updates)

# Electron wrapper plan

Status: proposed

## Outcome

Ship En Passant as an installable desktop application without forking the Solid application or
weakening its browser security boundary. The first release should wrap the production web app in a
small, locked-down Electron shell. macOS is the suggested first signed target, followed by Windows;
Linux can follow when there is a distribution and update strategy.

The desktop app is considered ready when it can:

- open `https://enpassant.io/app` in a single application window;
- build and train a repertoire, run Stockfish, import games, and export PGNs with web parity;
- sign in with email OTP and Google, sign out, and enforce the existing authenticated IndexedDB
  deletion rules;
- restart without losing local IndexedDB, local storage, cookies, or the last useful window state;
- reopen after the web app shell has been cached while the machine is offline;
- keep arbitrary web content outside the Electron renderer and expose no Node or generic IPC API;
- produce signed, notarized installers from CI and receive desktop runtime security updates.

## Recommended architecture

### Release 1: hosted renderer

The Electron main process loads `https://enpassant.io/app` in production and the local Vite URL in
development. The existing Cloudflare Pages deployment remains the renderer release channel and the
existing backend remains the only server boundary.

The shell owns only desktop lifecycle concerns:

- window creation and restoration;
- navigation and new-window policy;
- permissions policy;
- application menus and keyboard conventions;
- packaging, signing, publishing, and updates.

There should be no preload script and no IPC bridge in the first release. The renderer does not need
filesystem or shell access for current product behavior. The browser PGN download remains the export
path until a native save dialog is a proven requirement.

Use a persistent Electron session so the production origin keeps the same cookies, IndexedDB,
local-storage, and service-worker behavior users already have in a browser. Do not partition web
storage by app version.

### Why this fits the current application

The application is intentionally origin-dependent today:

- API and Better Auth requests use relative `/api/...` URLs in
  [`src/lib/authClient.ts`](../src/lib/authClient.ts),
  [`src/storage/backendSync.ts`](../src/storage/backendSync.ts), and
  [`src/lib/games.ts`](../src/lib/games.ts).
- Google auth returns to the current URL in [`src/lib/authRedirect.ts`](../src/lib/authRedirect.ts).
- authenticated-user ownership and deletion are tied to browser IndexedDB in
  [`src/lib/authSessionPersistence.ts`](../src/lib/authSessionPersistence.ts).
- the production service worker supplies the offline shell from
  [`src/lib/serviceWorker.ts`](../src/lib/serviceWorker.ts) and
  [`scripts/offline-service-worker.ts`](../scripts/offline-service-worker.ts).
- Cloudflare supplies cross-origin isolation and other response headers through
  [`public/_headers`](../public/_headers), while Stockfish is loaded as a web worker by
  [`src/lib/engine.ts`](../src/lib/engine.ts).
- application routes assume an HTTP-style origin and history fallback in
  [`src/App.tsx`](../src/App.tsx) and [`public/_redirects`](../public/_redirects).

A bundled renderer would therefore require a custom secure protocol, SPA fallbacks, API proxying,
cookie and OAuth validation, equivalent response headers, worker/wasm validation, and a separate
offline/update model before it delivers user-visible value. Loading the existing production origin
keeps those contracts intact.

### Deferred alternative: bundled renderer

Revisit a bundled renderer only if first-launch offline support, independent frontend rollouts, or a
native-only feature justifies it. Do not use `file://`. The follow-up design must use a standard,
secure custom protocol, constrain file resolution to the packaged renderer, and prove all of the
following in an isolated spike:

- `/api` forwarding preserves Better Auth cookies, CSRF/origin checks, `401` behavior, and request
  streaming;
- Google OAuth can leave and return to the app without allowing arbitrary navigation;
- IndexedDB and local storage remain stable across upgrades;
- deep client routes receive `index.html` without masking missing assets;
- Stockfish's worker, wasm, audio, and cross-origin isolation all work from the custom origin;
- the web service worker is disabled or given a clearly non-overlapping responsibility.

Electron recommends a custom protocol over `file://`, but this additional work is not necessary for
the hosted first release.

## Delivery sequence

Keep each phase as a separate, reviewable PR after this planning PR.

### 1. Secure shell and local development

Add an `electron/` boundary with a small TypeScript main process and pure helpers that can be unit
tested outside Electron.

Planned files and changes:

- `electron/main.ts`: single-instance lifecycle, `BrowserWindow` creation, macOS activate behavior,
  window bounds restoration, and production/development URL selection.
- `electron/navigation.ts`: parsed-URL allowlists for in-app navigation, OAuth navigation, and links
  that may open in the system browser.
- `electron/permissions.ts`: deny every permission by default; add a capability only alongside a
  product requirement and test.
- `electron/windowState.ts`: validate persisted window bounds and keep a usable minimum size.
- `electron/tsconfig.json`: isolate Electron/Node types from the web renderer type-check.
- `forge.config.ts`: package the shell with ASAR enabled and explicit product metadata.
- `package.json`: add `desktop:dev`, `desktop:package`, `desktop:make`, and focused desktop test
  scripts without changing `dev`, `build`, or `deploy`.

Use Electron Forge for packaging because it is the Electron project's recommended packaging path.
Keep the existing Vite renderer build independent from Forge's experimental Vite plugin: development
loads the existing Vite server, and the hosted production shell does not bundle a renderer.

Set the `BrowserWindow` security posture explicitly even where it matches Electron defaults:

- `nodeIntegration: false`;
- `contextIsolation: true`;
- `sandbox: true`;
- `webSecurity: true`;
- no `<webview>` support;
- no preload bridge;
- a persistent session scoped to En Passant;
- a restrictive permission request/check handler;
- DevTools only in development.

Navigation rules must use `URL` parsing and exact protocol/origin comparisons, never prefix checks.
Allow normal routes only on `https://enpassant.io`. Deny renderer-created windows. Open the known
GitHub, X, Chess.com, Lichess, and Chessable HTTPS links in the system browser only after validating
their exact host and protocol. Deny every other external protocol, including `file:`, `javascript:`,
and unknown custom schemes.

Google sign-in is the only expected cross-origin main-frame flow in the current UI. Capture its
actual redirect chain in a test environment, then choose one of these implementations during the
phase:

1. preferred: open authentication in the system browser and return through an HTTPS callback page
   owned by `enpassant.io`, which hands a one-time authorization code to a registered
   `enpassant://auth/callback` deep link; or
2. interim: allow the exact configured Google authentication origins in the unprivileged main
   window, while continuing to block all other navigation.

Do not ship Google sign-in until the callback, cancellation, and malicious redirect cases have been
tested. Email OTP is the fallback auth path during development.

### 2. Desktop regression coverage

Keep the existing web checks unchanged. Add a smaller Electron-specific suite that launches the
application through Playwright's Electron support and tests the desktop boundary rather than
duplicating every browser test.

Automated coverage:

- main-process helper unit tests for URL allowlists, unsafe schemes, production/dev URL selection,
  and invalid saved window bounds;
- a smoke test that opens `/app`, waits for 64 squares and the moves tree, and reports renderer
  console errors;
- external-link tests proving approved HTTPS hosts use the system-browser adapter and all other URLs
  are denied;
- a persistence test that creates anonymous data, restarts the Electron context, and reads it back;
- an authenticated storage test that restarts, receives a mocked `401`, and confirms the database is
  deleted before reload;
- a Stockfish smoke test that starts and completes an evaluation;
- a PGN export test that observes a completed download;
- a warm-cache offline restart test matching the guarantees in
  [`tests/e2e/offline.spec.ts`](../tests/e2e/offline.spec.ts).

Manual release-candidate checks:

- Google and email OTP sign-in, account switching, sign-out, and expired sessions;
- anonymous and signed-in sync behavior across restart;
- keyboard shortcuts, context menus, drag interactions, audio, clipboard behavior, and PGN download;
- first launch online, warm launch offline, and recovery when connectivity returns;
- window restoration across multiple displays and after a display is disconnected;
- install, upgrade, and uninstall on every supported OS/architecture.

Add a desktop smoke job to pull requests. Keep signing and full installer tests in protected release
workflows so secrets are not exposed to untrusted PR code.

### 3. Packaging and platform readiness

Package one artifact per supported OS and architecture on that operating system. Suggested rollout:

1. macOS arm64 and x64, signed and notarized;
2. Windows x64, signed installer;
3. Linux only after choosing package formats and an update channel.

Before the first external build:

- create proper `.icns`, `.ico`, and source artwork rather than scaling the favicon at package time;
- choose and reserve the application identifier, suggested `io.enpassant.desktop`;
- verify that macOS Keychain prompts and storage remain stable across upgrades;
- configure ASAR packaging and Forge's fuses plugin;
- disable Run-as-Node, Node options, and CLI inspect fuses;
- enable cookie encryption;
- enable embedded ASAR integrity validation and load-only-from-ASAR where supported;
- generate a software bill of materials and retain third-party notices, including Stockfish GPL
  materials and the repository's GPL license.

The desktop package version is independent from the hosted renderer deployment. Use SemVer in
`package.json`, tag desktop releases as `desktop-vX.Y.Z`, and display both the desktop version and web
build revision in diagnostics.

### 4. Signed release and updates

Add a manually triggered/tag-gated GitHub Actions release workflow with native macOS and Windows
runners. It should run the relevant checks, build installers, sign/notarize, attach checksums and
release notes, and publish a draft GitHub Release for approval.

Required secrets and ownership decisions:

- Apple Developer ID certificate, team identifier, and notarization credentials;
- Windows code-signing certificate or managed signing service;
- who can approve a production desktop release;
- whether crash reporting is in scope and, if so, its privacy policy and retention.

Enable automatic updates only after signed upgrade and rollback testing passes. Use Electron's
supported updater path for macOS and Windows and show a user-controlled restart prompt. Linux has no
built-in Electron auto-updater, so use package-manager updates or document manual updates instead.
Never update the Electron runtime by replacing files from renderer code.

Add a recurring dependency PR for Electron and Forge. The release owner should take Electron stable
security updates promptly and run the desktop smoke suite before publishing them.

### 5. Native capabilities only when justified

If a later feature needs native access, introduce a preload bridge one operation at a time. Define a
typed request/result contract, validate the sender frame and every argument in the main process, and
expose a named operation rather than raw `ipcRenderer`, filesystem, shell, or network primitives.

Likely candidates are a native PGN save/open dialog, application-menu commands, and OS update status.
None blocks the first wrapper release.

## Release gates

The first public desktop release is blocked until all of these are true:

- all existing `npm run check` behavior remains green;
- desktop unit and smoke tests pass on each release platform;
- the renderer has no Node access and no generic IPC surface;
- navigation, new windows, permissions, and external URL handling are deny-by-default;
- email OTP and Google auth satisfy the authenticated storage deletion rules;
- Stockfish, PGN export, sync, and warm-cache offline startup have desktop coverage;
- artifacts are signed, macOS is notarized, and install/upgrade/uninstall have been exercised;
- the updater accepts only signed artifacts and has a tested failure/rollback procedure;
- GPL source and third-party notices ship with the application and release artifacts.

## Decisions to confirm before implementation

- Is macOS-first acceptable, and which architectures must the first release support?
- Should the first release require first-launch offline support? If yes, run the bundled-renderer
  spike before building the shell.
- Can the backend contract support a one-time desktop authorization code returned through an
  `enpassant.io` callback and registered `enpassant://auth/callback` deep link, or is the interim
  in-window OAuth flow required?
- Which signing accounts and certificates already exist?
- Should releases be downloadable only from GitHub at first, or also submitted to app stores?
- Is automatic update required for the first public release or acceptable in the next release?

## References

- [Electron security checklist](https://www.electronjs.org/docs/latest/tutorial/security)
- [Electron process sandboxing](https://www.electronjs.org/docs/latest/tutorial/sandbox)
- [Electron custom protocols](https://www.electronjs.org/docs/latest/api/protocol)
- [Electron fuses](https://www.electronjs.org/docs/latest/tutorial/fuses)
- [Electron Forge packaging overview](https://www.electronjs.org/docs/latest/tutorial/forge-overview)
- [Electron distribution overview](https://www.electronjs.org/docs/latest/tutorial/distribution-overview)
- [Electron application updates](https://www.electronjs.org/docs/latest/tutorial/updates)
- [Electron Forge build lifecycle](https://www.electronforge.io/core-concepts/build-lifecycle)

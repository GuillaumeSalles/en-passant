# Local-only browser architecture

Editing, training, analysis, and game review work without an account or a backend.
The app is browser-only. The Electron and iOS/Android clients have been removed;
native apps and SQLite support are deferred.

The existing production service is not modified. Legacy account stores are not
read, deleted, or migrated. A fresh installation opens an empty library. PGN
imports are explicit user actions; production exports are never imported at startup.

## Persistence

IndexedDB `en-passant-local-v1` is separate from the old `en-passant` account
cache. It stores repertoires, chapters, full PGNs, training schedules, and imported
games. The UI uses a local storage interface, independent of future sync transport.

Commits use a revision check and an atomic transaction so concurrent writes cannot
overwrite unrelated records. The PGN queue serializes and coalesces edits within a
window. Simultaneous editing of the same chapter in multiple tabs is not a
collaborative editing protocol: the last saved PGN wins. Cross-tab notifications
refresh affected views.

Write failures are visible. Failed PGN batches remain queued for the next edit;
the user can export the current PGN before closing. Storage errors and unsupported
schema versions do not reset the library.

## Local features

Games are imported from PGN and remain on the device. Position statistics and
repertoire coverage are computed from local games and repertoires. Server-side
Lichess polling and the remote masters explorer are removed. Stockfish and the
opening-name index remain local assets.

The production browser build caches its application shell for offline use after
an initial successful visit. PGN export remains available, but does not include
training review schedules. Browser data remains subject to site-data deletion
and browser storage policies; the downloaded production backup is kept separately.

## Development and verification

From the umbrella workspace, `./start-local` starts Vite only. Inside this
repository, use `npm run dev:local`. No secrets or backend processes are required.
`npm run check` covers formatting, static checks, unit tests, the production build,
browser interaction tests, and offline startup.

## Future encrypted sync

Keep local storage authoritative. Add an optional transport adapter that exchanges
versioned, encrypted records, using stable IDs, deletion markers, and explicit
conflict handling. Encryption and decryption belong on the device; key creation,
recovery, and device enrollment must be designed before enabling sync. A server
may store opaque encrypted blobs and delivery metadata, but should never need
plaintext PGNs, training history, or the decryption key. Encryption and sync are
not implemented in this version.

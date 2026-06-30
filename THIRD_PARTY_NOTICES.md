# Third-Party Notices

This project is licensed under GPL-3.0-or-later except where third-party
materials below state otherwise.

## Cburnett SVG Chess Pieces

- Source: https://commons.wikimedia.org/wiki/Category:SVG_chess_pieces
- Example file: https://commons.wikimedia.org/wiki/File:Chess_plt45.svg
- Author: Colin M.L. Burnett
- License selected for this project: GPL-2.0-or-later

The default chess piece artwork is based on the Wikimedia Commons SVG chess
pieces by Cburnett. The source files are multi-licensed; this project uses them
under the GPL-2.0-or-later option.

## Stockfish.js / Stockfish

- Package: stockfish@18.0.8
- Package tarball: https://registry.npmjs.org/stockfish/-/stockfish-18.0.8.tgz
- Package integrity:
  sha512-z+f2UMPXLylDBGjv9e9zU8QulY7hUl8MYHesLRrdddewlOXjJrUSmtNmbtID1/F72EPhq0CCkCNxgWS5MQVWtQ==
- Package git commit: https://github.com/nmrugg/stockfish.js/tree/93c994592dcf3b4b21052ab925e9b534df9c0918
- Stockfish source: https://github.com/official-stockfish/Stockfish
- License: GPL-3.0
- Local files:
  - `public/stockfish-18-lite-single.js`
    sha256: `5243fd9b276cab7dfe3ad1d43ab9ead73568fac76468c614242977a210c4a391`
  - `public/stockfish-18-lite-single.wasm`
    sha256: `a8fbc05ec6920b56d7485826dcb02c5ffd2826bcbf751cf973046f237a9096f1`
  - `public/stockfish-18-Copying.txt`
    sha256: `0b383d5a63da644f628d99c33976ea6487ed89aaa59f0b3257992deac1171e6b`

The bundled Stockfish.js files are copied unmodified from the `bin/` directory
of the `stockfish@18.0.8` npm package.

## Chess Piece Sound Effects

- Source: https://pixabay.com/sound-effects/film-special-effects-chess-pieces-60890/
- Source file: `freesound_community-chess-pieces-60890.mp3`
- Author: simone_ds (Freesound)
- License: Pixabay Content License
- Local files:
  - `public/sounds/default/Move.m4a`
    sha256: `54b361bff1b26f346a2ebb1061cedcda1cd7d38464fc4f6f5d2f7bbc119ebe33`
  - `public/sounds/default/Capture.m4a`
    sha256: `8cfecbcf56385d36e1b664cd57393280ccc2fa3583be845f0119efe3f9422438`

The bundled move and capture sounds are individual clips extracted from the
Pixabay source file listed above. They are used under the Pixabay Content
License and are not part of the GPL-licensed source distribution.

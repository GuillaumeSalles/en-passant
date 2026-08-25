import { expect, test } from "vitest";
import { chessablePositionUrl, chessComPositionUrl, lichessPositionUrl } from "./positionShareUrls";

const fen = "r1bqkbnr/pp1ppppp/2n5/2p5/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3";

test("builds a Chess.com analysis URL for a position", () => {
  expect(chessComPositionUrl(fen)).toBe(
    "https://www.chess.com/analysis?fen=r1bqkbnr%2Fpp1ppppp%2F2n5%2F2p5%2F4P3%2F5N2%2FPPPP1PPP%2FRNBQKB1R%20w%20KQkq%20-%202%203",
  );
});

test("builds a Lichess analysis URL for a position", () => {
  expect(lichessPositionUrl(fen)).toBe(
    "https://lichess.org/analysis/standard/r1bqkbnr/pp1ppppp/2n5/2p5/4P3/5N2/PPPP1PPP/RNBQKB1R_w_KQkq_-_2_3",
  );
});

test("builds a Chessable course search URL for a position", () => {
  expect(chessablePositionUrl(fen)).toBe(
    "https://www.chessable.com/courses/fen/r1bqkbnrUpp1pppppU2n5U2p5U4P3U5N2UPPPP1PPPURNBQKB1R%20w%20KQkq%20-%202%203/",
  );
});

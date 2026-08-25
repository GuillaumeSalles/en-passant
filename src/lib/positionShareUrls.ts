export function chessComPositionUrl(fen: string): string {
  return `https://www.chess.com/analysis?fen=${encodeURIComponent(fen)}`;
}

export function lichessPositionUrl(fen: string): string {
  return `https://lichess.org/analysis/standard/${fen.replaceAll(" ", "_")}`;
}

export function chessablePositionUrl(fen: string): string {
  const chessableFen = fen.replaceAll("/", "U");
  return `https://www.chessable.com/courses/fen/${encodeURIComponent(chessableFen)}/`;
}

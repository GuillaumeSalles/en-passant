import { ArrowKind, HighlightKind, SquareHighlightKind, Orientation } from "@/lib/AppState";
import { FenPiece } from "./Chessboard";

export const lightSquareColor = "rgb(214 223 229)";
export const darkSquareColor = "rgb(133 159 178)";

export function getHighlightSquareColor(kind: SquareHighlightKind): string {
  switch (kind) {
    case "alt":
      return "rgba(82, 176, 220, 0.8)";
    case "shift":
      return "rgba(172, 206, 89, 0.8)";
    case "ctrl":
      return "rgba(255, 170, 0, 0.8)";
    case "normal":
      return "rgba(235, 97, 80, 0.8)";
    case "last-move":
      return "rgba(155, 199, 0, .41)";
  }
}

export function getHighlightArrowColor(kind: ArrowKind): string {
  switch (kind) {
    case "alt":
      return "rgba(72, 193, 249, 0.64)";
    case "shift":
      return "rgba(159, 207, 63, 0.64)";
    case "ctrl":
      return "rgba(248, 85, 63, 0.64)";
    case "normal":
      return "rgba(255, 170, 0, 0.64)";
    case "best-move":
      return "rgba(72, 193, 249, 0.64)";
  }
}

export function getSquarePosition(
  square: string,
  boardOrientation: Orientation,
): { x: number; y: number } {
  const file = square.charCodeAt(0) - 97; // a=0, b=1, etc.
  const rankChar = square[1];
  if (rankChar === undefined) {
    throw new Error(`Invalid square: ${square}`);
  }
  const rank = parseInt(rankChar) - 1; // 1=0, 2=1, etc.

  const visualFile = boardOrientation === "black" ? 7 - file : file;
  const visualRank = boardOrientation === "black" ? 7 - rank : rank;

  const x = visualFile;
  const y = 7 - visualRank;

  return { x, y };
}

export const squares = Array.from({ length: 64 }, (_, index) => indexToSquare(index));

export function indexToSquare(index: number): string {
  if (index < 0 || index >= 64) {
    throw new Error(`Invalid index: ${index}`);
  }

  const rank = Math.floor(index / 8) + 1;
  const file = String.fromCharCode(97 + (index % 8));
  return `${file}${rank}`;
}

export function isLight(square: string): boolean {
  const file = square.charCodeAt(0) - 97;
  const rankChar = square[1];
  if (rankChar === undefined) {
    throw new Error(`Invalid square: ${square}`);
  }
  const rank = parseInt(rankChar) - 1;

  return (file + rank) % 2 === 1;
}

export function getHighlightKindFromEvent(
  event: Pick<PointerEvent, "ctrlKey" | "shiftKey" | "altKey">,
): HighlightKind {
  if (event.ctrlKey) {
    return "ctrl";
  }
  if (event.shiftKey) {
    return "shift";
  }
  if (event.altKey) {
    return "alt";
  }
  return "normal";
}

export function parseFen(fen: string): { [square: string]: FenPiece } {
  const boardPart = fen.split(" ")[0]; // Get only the board part
  if (boardPart === undefined) {
    throw new Error(`Invalid FEN: ${fen}`);
  }
  const rows = boardPart.split("/");
  const board: { [square: string]: FenPiece } = {};

  for (let row = 0; row < 8; row++) {
    const fenRow = rows[row];
    if (fenRow === undefined) {
      throw new Error(`Invalid FEN: ${fen}`);
    }
    const rowId = 7 - row;
    let col = 0;

    for (let i = 0; i < fenRow.length; i++) {
      const char = fenRow[i];
      if (char === undefined) {
        throw new Error(`Invalid FEN: ${fen}`);
      }
      if (char >= "1" && char <= "8") {
        // Empty squares
        const emptyCount = parseInt(char);
        col += emptyCount;
      } else {
        // Piece
        board[`${String.fromCharCode(97 + col)}${rowId + 1}`] = char as FenPiece;
        col++;
      }
    }
  }

  return board;
}
export function fenPieceToPiece(fenPiece: FenPiece): string {
  if (fenPiece.toLowerCase() === fenPiece) {
    return "b" + fenPiece.toUpperCase();
  }

  return "w" + fenPiece;
}

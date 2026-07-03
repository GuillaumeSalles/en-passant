export const STARTING_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

export type Color = "w" | "b";
type PieceKind = "p" | "n" | "b" | "r" | "q" | "k";
type CastlingRight = "K" | "Q" | "k" | "q";
export type FenPiece = "p" | "P" | "n" | "N" | "b" | "B" | "r" | "R" | "q" | "Q" | "k" | "K";

type Piece = {
  color: Color;
  kind: PieceKind;
};

type Offset = readonly [file: number, rank: number];

export type ChessPosition = {
  board: Array<Piece | null>;
  turn: Color;
  castling: Set<CastlingRight>;
  enPassant: string | null;
  halfmoveClock: number;
  fullmoveNumber: number;
};

export type AppliedMove = {
  from: string;
  to: string;
  promotion: string | null;
  san: string;
  fen: string;
  animation: AppliedMoveAnimation;
};

export type AppliedMoveAnimation = {
  movements: AppliedMoveMovement[];
  captures: AppliedMoveCapture[];
  promotion: AppliedMovePromotion | null;
};

export type AppliedMoveMovement = {
  piece: FenPiece;
  from: string;
  to: string;
};

export type AppliedMoveCapture = {
  piece: FenPiece;
  square: string;
};

export type AppliedMovePromotion = {
  piece: FenPiece;
  square: string;
};

type LegalMove = {
  from: number;
  to: number;
  piece: Piece;
  captured: Piece | null;
  promotion: PieceKind | null;
  castle: "king" | "queen" | null;
  enPassantCapture: number | null;
};

const files = "abcdefgh";
const promotionPieces: PieceKind[] = ["q", "r", "b", "n"];

type CastlingConfig = {
  right: CastlingRight;
  rook: string;
  squares: string[];
  attacked: string[];
};

function pieceAt(position: ChessPosition, index: number): Piece | null {
  return position.board[index] ?? null;
}

function fileAt(index: number): string {
  const file = files[index];
  if (file === undefined) {
    throw new Error(`Invalid file index: ${index}`);
  }
  return file;
}

export function createChessPosition(fen = STARTING_FEN): ChessPosition {
  const [placement, turn, castling, enPassant, halfmove, fullmove] = fen.split(" ");
  if (placement === undefined) {
    throw new Error(`Invalid FEN: ${fen}`);
  }
  const board: Array<Piece | null> = [];

  for (const rank of placement.split("/")) {
    for (const char of rank) {
      const emptySquares = Number(char);
      if (Number.isInteger(emptySquares) && emptySquares > 0) {
        board.push(...Array<null>(emptySquares).fill(null));
      } else {
        board.push(pieceFromFen(char));
      }
    }
  }

  if (board.length !== 64) {
    throw new Error(`Invalid FEN board: ${fen}`);
  }

  return {
    board,
    turn: turn === "b" ? "b" : "w",
    castling: new Set(
      castling === undefined || castling === "-" ? [] : (castling.split("") as CastlingRight[]),
    ),
    enPassant: enPassant === undefined || enPassant === "-" ? null : enPassant,
    halfmoveClock: Number(halfmove ?? 0),
    fullmoveNumber: Number(fullmove ?? 1),
  };
}

export function fen(position: ChessPosition): string {
  const ranks: string[] = [];

  for (let rank = 0; rank < 8; rank++) {
    let result = "";
    let empty = 0;

    for (let file = 0; file < 8; file++) {
      const piece = pieceAt(position, rank * 8 + file);
      if (piece === null) {
        empty++;
        continue;
      }

      if (empty > 0) {
        result += empty;
        empty = 0;
      }
      result += pieceToFen(piece);
    }

    if (empty > 0) result += empty;
    ranks.push(result);
  }

  const castling =
    (["K", "Q", "k", "q"] as CastlingRight[])
      .filter((right) => position.castling.has(right))
      .join("") || "-";

  return [
    ranks.join("/"),
    position.turn,
    castling,
    position.enPassant ?? "-",
    position.halfmoveClock,
    position.fullmoveNumber,
  ].join(" ");
}

export function applySan(position: ChessPosition, san: string): AppliedMove {
  const normalizedSan = normalizeSan(san);
  const move = legalMoves(position).find(
    (candidate) => normalizeSan(moveToSan(position, candidate)) === normalizedSan,
  );

  if (move === undefined) {
    throw new Error(`Illegal SAN move "${san}" from ${fen(position)}`);
  }

  return applyLegalMove(position, move);
}

export function applyMove(
  position: ChessPosition,
  {
    from,
    to,
    promotion,
  }: {
    from: string;
    to: string;
    promotion?: string | null;
  },
): AppliedMove {
  const fromIndex = squareToIndex(from);
  const toIndex = squareToIndex(to);
  const requestedPromotion = normalizePromotion(promotion);
  const move = legalMoves(position).find(
    (candidate) =>
      candidate.from === fromIndex &&
      candidate.to === toIndex &&
      (candidate.promotion === null ||
        candidate.promotion === requestedPromotion ||
        (requestedPromotion === null && candidate.promotion === "q")),
  );

  if (move === undefined) {
    throw new Error(`Illegal move ${from}${to} from ${fen(position)}`);
  }

  return applyLegalMove(position, {
    ...move,
    promotion: move.promotion === null ? null : (requestedPromotion ?? "q"),
  });
}

export function isMoveLegal(
  position: ChessPosition,
  move: { from: string; to: string; promotion?: string | null },
): boolean {
  try {
    applyMove(clonePosition(position), move);
    return true;
  } catch {
    return false;
  }
}

export function clonePosition(position: ChessPosition): ChessPosition {
  return {
    board: position.board.map((piece) => (piece === null ? null : { ...piece })),
    turn: position.turn,
    castling: new Set(position.castling),
    enPassant: position.enPassant,
    halfmoveClock: position.halfmoveClock,
    fullmoveNumber: position.fullmoveNumber,
  };
}

function applyLegalMove(position: ChessPosition, move: LegalMove): AppliedMove {
  const san = moveToSan(position, move);
  const animation = moveToAnimation(position, move);
  mutatePosition(position, move);
  return {
    from: indexToSquare(move.from),
    to: indexToSquare(move.to),
    promotion: move.promotion,
    san,
    fen: fen(position),
    animation,
  };
}

function moveToAnimation(position: ChessPosition, move: LegalMove): AppliedMoveAnimation {
  const movements: AppliedMoveMovement[] = [
    {
      piece: pieceToFen(move.piece),
      from: indexToSquare(move.from),
      to: indexToSquare(move.to),
    },
  ];

  const rookMovement = castleRookMovement(position, move);
  if (rookMovement !== null) {
    movements.push(rookMovement);
  }

  const capture = moveCapture(position, move);
  const promotion =
    move.promotion === null
      ? null
      : {
          piece: pieceToFen({ color: move.piece.color, kind: move.promotion }),
          square: indexToSquare(move.to),
        };

  return {
    movements,
    captures: capture === null ? [] : [capture],
    promotion,
  };
}

function castleRookMovement(position: ChessPosition, move: LegalMove): AppliedMoveMovement | null {
  if (move.castle === null) return null;

  const rookFrom =
    move.castle === "king"
      ? move.piece.color === "w"
        ? squareToIndex("h1")
        : squareToIndex("h8")
      : move.piece.color === "w"
        ? squareToIndex("a1")
        : squareToIndex("a8");
  const rookTo =
    move.castle === "king"
      ? move.piece.color === "w"
        ? squareToIndex("f1")
        : squareToIndex("f8")
      : move.piece.color === "w"
        ? squareToIndex("d1")
        : squareToIndex("d8");
  const rook = pieceAt(position, rookFrom);
  if (rook === null) return null;

  return {
    piece: pieceToFen(rook),
    from: indexToSquare(rookFrom),
    to: indexToSquare(rookTo),
  };
}

function moveCapture(position: ChessPosition, move: LegalMove): AppliedMoveCapture | null {
  if (move.enPassantCapture !== null) {
    const captured = pieceAt(position, move.enPassantCapture);
    return captured === null
      ? null
      : {
          piece: pieceToFen(captured),
          square: indexToSquare(move.enPassantCapture),
        };
  }

  if (move.captured === null) return null;
  return {
    piece: pieceToFen(move.captured),
    square: indexToSquare(move.to),
  };
}

function mutatePosition(position: ChessPosition, move: LegalMove): void {
  const movingPiece = { ...move.piece };
  const targetPiece = pieceAt(position, move.to);
  position.board[move.from] = null;

  if (move.enPassantCapture !== null) {
    position.board[move.enPassantCapture] = null;
  }

  position.board[move.to] =
    move.promotion === null ? movingPiece : { color: movingPiece.color, kind: move.promotion };

  if (move.castle === "king") {
    const rookFrom = movingPiece.color === "w" ? squareToIndex("h1") : squareToIndex("h8");
    const rookTo = movingPiece.color === "w" ? squareToIndex("f1") : squareToIndex("f8");
    position.board[rookTo] = pieceAt(position, rookFrom);
    position.board[rookFrom] = null;
  } else if (move.castle === "queen") {
    const rookFrom = movingPiece.color === "w" ? squareToIndex("a1") : squareToIndex("a8");
    const rookTo = movingPiece.color === "w" ? squareToIndex("d1") : squareToIndex("d8");
    position.board[rookTo] = pieceAt(position, rookFrom);
    position.board[rookFrom] = null;
  }

  updateCastlingRights(position, move, targetPiece);
  position.enPassant = nextEnPassantSquare(move);
  position.halfmoveClock =
    movingPiece.kind === "p" || move.captured !== null ? 0 : position.halfmoveClock + 1;

  if (position.turn === "b") {
    position.fullmoveNumber++;
  }
  position.turn = opposite(position.turn);
}

function legalMoves(position: ChessPosition): LegalMove[] {
  return pseudoMoves(position).filter((move) => {
    const next = clonePosition(position);
    mutatePosition(next, move);
    return !isKingInCheck(next, position.turn);
  });
}

function pseudoMoves(position: ChessPosition): LegalMove[] {
  const moves: LegalMove[] = [];
  for (let from = 0; from < 64; from++) {
    const piece = pieceAt(position, from);
    if (piece === null || piece.color !== position.turn) continue;

    if (piece.kind === "p") addPawnMoves(position, from, piece, moves);
    if (piece.kind === "n") addJumpMoves(position, from, piece, moves, knightOffsets);
    if (piece.kind === "b") addSlidingMoves(position, from, piece, moves, bishopDirections);
    if (piece.kind === "r") addSlidingMoves(position, from, piece, moves, rookDirections);
    if (piece.kind === "q") addSlidingMoves(position, from, piece, moves, queenDirections);
    if (piece.kind === "k") addKingMoves(position, from, piece, moves);
  }
  return moves;
}

function addPawnMoves(
  position: ChessPosition,
  from: number,
  piece: Piece,
  moves: LegalMove[],
): void {
  const direction = piece.color === "w" ? -1 : 1;
  const startRank = piece.color === "w" ? 6 : 1;
  const promotionRank = piece.color === "w" ? 0 : 7;
  const rank = rankOf(from);
  const file = fileOf(from);
  const oneForward = indexAt(file, rank + direction);

  if (oneForward !== null && pieceAt(position, oneForward) === null) {
    addPawnMove(position, from, oneForward, piece, null, promotionRank, moves);

    const twoForward = indexAt(file, rank + direction * 2);
    if (rank === startRank && twoForward !== null && pieceAt(position, twoForward) === null) {
      moves.push(baseMove(position, from, twoForward, piece));
    }
  }

  for (const fileOffset of [-1, 1]) {
    const to = indexAt(file + fileOffset, rank + direction);
    if (to === null) continue;

    const captured = pieceAt(position, to);
    if (captured !== null && captured.color !== piece.color) {
      addPawnMove(position, from, to, piece, captured, promotionRank, moves);
      continue;
    }

    if (position.enPassant === indexToSquare(to)) {
      const capturedIndex = indexAt(file + fileOffset, rank);
      if (capturedIndex !== null) {
        moves.push({
          ...baseMove(position, from, to, piece),
          captured: pieceAt(position, capturedIndex),
          enPassantCapture: capturedIndex,
        });
      }
    }
  }
}

function addPawnMove(
  position: ChessPosition,
  from: number,
  to: number,
  piece: Piece,
  captured: Piece | null,
  promotionRank: number,
  moves: LegalMove[],
): void {
  if (rankOf(to) === promotionRank) {
    for (const promotion of promotionPieces) {
      moves.push({ ...baseMove(position, from, to, piece), captured, promotion });
    }
    return;
  }

  moves.push({ ...baseMove(position, from, to, piece), captured });
}

const knightOffsets: Offset[] = [
  [-1, -2],
  [1, -2],
  [-2, -1],
  [2, -1],
  [-2, 1],
  [2, 1],
  [-1, 2],
  [1, 2],
];
const bishopDirections: Offset[] = [
  [-1, -1],
  [1, -1],
  [-1, 1],
  [1, 1],
];
const rookDirections: Offset[] = [
  [0, -1],
  [-1, 0],
  [1, 0],
  [0, 1],
];
const queenDirections: Offset[] = [...bishopDirections, ...rookDirections];

function addJumpMoves(
  position: ChessPosition,
  from: number,
  piece: Piece,
  moves: LegalMove[],
  offsets: Offset[],
): void {
  for (const [fileOffset, rankOffset] of offsets) {
    const to = indexAt(fileOf(from) + fileOffset, rankOf(from) + rankOffset);
    if (to === null) continue;
    addTargetMove(position, from, to, piece, moves);
  }
}

function addSlidingMoves(
  position: ChessPosition,
  from: number,
  piece: Piece,
  moves: LegalMove[],
  directions: Offset[],
): void {
  for (const [fileDirection, rankDirection] of directions) {
    let file = fileOf(from) + fileDirection;
    let rank = rankOf(from) + rankDirection;
    while (true) {
      const to = indexAt(file, rank);
      if (to === null) break;
      const target = pieceAt(position, to);
      if (target !== null) {
        if (target.color !== piece.color) {
          moves.push({ ...baseMove(position, from, to, piece), captured: target });
        }
        break;
      }
      moves.push(baseMove(position, from, to, piece));
      file += fileDirection;
      rank += rankDirection;
    }
  }
}

function addKingMoves(
  position: ChessPosition,
  from: number,
  piece: Piece,
  moves: LegalMove[],
): void {
  addJumpMoves(position, from, piece, moves, queenDirections);
  addCastlingMoves(position, from, piece, moves);
}

function addCastlingMoves(
  position: ChessPosition,
  from: number,
  piece: Piece,
  moves: LegalMove[],
): void {
  if (isKingInCheck(position, piece.color)) return;

  const kingSide =
    piece.color === "w"
      ? {
          right: "K" as const,
          rook: "h1",
          squares: ["f1", "g1"],
          attacked: ["f1", "g1"],
        }
      : {
          right: "k" as const,
          rook: "h8",
          squares: ["f8", "g8"],
          attacked: ["f8", "g8"],
        };
  const queenSide =
    piece.color === "w"
      ? {
          right: "Q" as const,
          rook: "a1",
          squares: ["b1", "c1", "d1"],
          attacked: ["c1", "d1"],
        }
      : {
          right: "q" as const,
          rook: "a8",
          squares: ["b8", "c8", "d8"],
          attacked: ["c8", "d8"],
        };

  if (canCastle(position, piece.color, kingSide)) {
    const kingDestination = kingSide.squares[1];
    if (kingDestination === undefined) return;
    moves.push({
      ...baseMove(position, from, squareToIndex(kingDestination), piece),
      castle: "king",
    });
  }
  if (canCastle(position, piece.color, queenSide)) {
    const queenDestination = queenSide.attacked[0];
    if (queenDestination === undefined) return;
    moves.push({
      ...baseMove(position, from, squareToIndex(queenDestination), piece),
      castle: "queen",
    });
  }
}

function canCastle(position: ChessPosition, color: Color, config: CastlingConfig): boolean {
  const rook = pieceAt(position, squareToIndex(config.rook));
  return (
    position.castling.has(config.right) &&
    rook?.color === color &&
    rook.kind === "r" &&
    config.squares.every((square) => pieceAt(position, squareToIndex(square)) === null) &&
    config.attacked.every(
      (square) => !isSquareAttacked(position, squareToIndex(square), opposite(color)),
    )
  );
}

function addTargetMove(
  position: ChessPosition,
  from: number,
  to: number,
  piece: Piece,
  moves: LegalMove[],
): void {
  const target = pieceAt(position, to);
  if (target === null || target.color !== piece.color) {
    moves.push({ ...baseMove(position, from, to, piece), captured: target });
  }
}

function baseMove(position: ChessPosition, from: number, to: number, piece: Piece): LegalMove {
  return {
    from,
    to,
    piece,
    captured: pieceAt(position, to),
    promotion: null,
    castle: null,
    enPassantCapture: null,
  };
}

function moveToSan(position: ChessPosition, move: LegalMove): string {
  if (move.castle === "king") return withCheckSuffix(position, move, "O-O");
  if (move.castle === "queen") return withCheckSuffix(position, move, "O-O-O");

  const pieceName = move.piece.kind === "p" ? "" : pieceKindToSan(move.piece.kind);
  const capture = move.captured !== null || move.enPassantCapture !== null;
  const disambiguation =
    move.piece.kind === "p"
      ? capture
        ? fileAt(fileOf(move.from))
        : ""
      : getDisambiguation(position, move);
  const promotion = move.promotion === null ? "" : `=${pieceKindToSan(move.promotion)}`;
  const san = `${pieceName}${disambiguation}${
    capture ? "x" : ""
  }${indexToSquare(move.to)}${promotion}`;

  return withCheckSuffix(position, move, san);
}

function withCheckSuffix(position: ChessPosition, move: LegalMove, san: string): string {
  const next = clonePosition(position);
  mutatePosition(next, move);
  if (!isKingInCheck(next, next.turn)) return san;
  return legalMoves(next).length === 0 ? `${san}#` : `${san}+`;
}

function getDisambiguation(position: ChessPosition, move: LegalMove): string {
  const alternatives = pseudoMoves(position).filter(
    (candidate) =>
      candidate.from !== move.from &&
      candidate.to === move.to &&
      candidate.piece.color === move.piece.color &&
      candidate.piece.kind === move.piece.kind &&
      isLegalCandidate(position, candidate),
  );

  if (alternatives.length === 0) return "";

  const sameFile = alternatives.some((candidate) => fileOf(candidate.from) === fileOf(move.from));
  const sameRank = alternatives.some((candidate) => rankOf(candidate.from) === rankOf(move.from));

  if (!sameFile) return fileAt(fileOf(move.from));
  if (!sameRank) return String(8 - rankOf(move.from));
  return indexToSquare(move.from);
}

function isLegalCandidate(position: ChessPosition, move: LegalMove): boolean {
  const next = clonePosition(position);
  mutatePosition(next, move);
  return !isKingInCheck(next, position.turn);
}

function isKingInCheck(position: ChessPosition, color: Color): boolean {
  const kingIndex = position.board.findIndex(
    (piece) => piece?.color === color && piece.kind === "k",
  );
  return kingIndex !== -1 && isSquareAttacked(position, kingIndex, opposite(color));
}

function isSquareAttacked(position: ChessPosition, square: number, attacker: Color): boolean {
  const file = fileOf(square);
  const rank = rankOf(square);
  const pawnRank = rank + (attacker === "w" ? 1 : -1);
  for (const fileOffset of [-1, 1]) {
    const index = indexAt(file + fileOffset, pawnRank);
    const piece = index === null ? null : pieceAt(position, index);
    if (piece?.color === attacker && piece.kind === "p") return true;
  }

  if (isAttackedByJump(position, square, attacker, "n", knightOffsets)) {
    return true;
  }
  if (isAttackedByJump(position, square, attacker, "k", queenDirections)) {
    return true;
  }
  if (isAttackedBySlider(position, square, attacker, ["b", "q"], bishopDirections)) {
    return true;
  }
  return isAttackedBySlider(position, square, attacker, ["r", "q"], rookDirections);
}

function isAttackedByJump(
  position: ChessPosition,
  square: number,
  attacker: Color,
  kind: PieceKind,
  offsets: Offset[],
): boolean {
  for (const [fileOffset, rankOffset] of offsets) {
    const index = indexAt(fileOf(square) + fileOffset, rankOf(square) + rankOffset);
    const piece = index === null ? null : pieceAt(position, index);
    if (piece?.color === attacker && piece.kind === kind) return true;
  }
  return false;
}

function isAttackedBySlider(
  position: ChessPosition,
  square: number,
  attacker: Color,
  kinds: PieceKind[],
  directions: Offset[],
): boolean {
  for (const [fileDirection, rankDirection] of directions) {
    let file = fileOf(square) + fileDirection;
    let rank = rankOf(square) + rankDirection;
    while (true) {
      const index = indexAt(file, rank);
      if (index === null) break;
      const piece = pieceAt(position, index);
      if (piece !== null) {
        if (piece.color === attacker && kinds.includes(piece.kind)) return true;
        break;
      }
      file += fileDirection;
      rank += rankDirection;
    }
  }
  return false;
}

function updateCastlingRights(
  position: ChessPosition,
  move: LegalMove,
  captured: Piece | null,
): void {
  if (move.piece.kind === "k") {
    if (move.piece.color === "w") {
      position.castling.delete("K");
      position.castling.delete("Q");
    } else {
      position.castling.delete("k");
      position.castling.delete("q");
    }
  }

  if (move.piece.kind === "r") removeRookCastlingRight(position, move.from);
  if (captured?.kind === "r") removeRookCastlingRight(position, move.to);
}

function removeRookCastlingRight(position: ChessPosition, square: number): void {
  if (square === squareToIndex("a1")) position.castling.delete("Q");
  if (square === squareToIndex("h1")) position.castling.delete("K");
  if (square === squareToIndex("a8")) position.castling.delete("q");
  if (square === squareToIndex("h8")) position.castling.delete("k");
}

function nextEnPassantSquare(move: LegalMove): string | null {
  if (move.piece.kind !== "p") return null;
  if (Math.abs(rankOf(move.from) - rankOf(move.to)) !== 2) return null;
  const index = indexAt(fileOf(move.from), (rankOf(move.from) + rankOf(move.to)) / 2);
  if (index === null) {
    throw new Error("Invalid en passant square");
  }
  return indexToSquare(index);
}

function normalizeSan(san: string): string {
  return san
    .trim()
    .replace(/[!?]+$/g, "")
    .replace(/[+#]$/g, "")
    .replace(/^0-0-0/, "O-O-O")
    .replace(/^0-0/, "O-O");
}

function normalizePromotion(promotion?: string | null): PieceKind | null {
  if (promotion == null) return null;
  const normalized = promotion.toLowerCase();
  return promotionPieces.includes(normalized as PieceKind) ? (normalized as PieceKind) : null;
}

function pieceFromFen(char: string): Piece {
  const lower = char.toLowerCase();
  if (!["p", "n", "b", "r", "q", "k"].includes(lower)) {
    throw new Error(`Invalid FEN piece: ${char}`);
  }
  return {
    color: char === lower ? "b" : "w",
    kind: lower as PieceKind,
  };
}

function pieceToFen(piece: Piece): FenPiece {
  return (piece.color === "w" ? piece.kind.toUpperCase() : piece.kind) as FenPiece;
}

function pieceKindToSan(kind: PieceKind): string {
  return kind.toUpperCase();
}

function opposite(color: Color): Color {
  return color === "w" ? "b" : "w";
}

function squareToIndex(square: string): number {
  const fileChar = square[0];
  const rankChar = square[1];
  if (fileChar === undefined || rankChar === undefined) {
    throw new Error(`Invalid square: ${square}`);
  }

  const file = files.indexOf(fileChar);
  const rank = 8 - Number(rankChar);
  const index = indexAt(file, rank);
  if (index === null) {
    throw new Error(`Invalid square: ${square}`);
  }
  return index;
}

function indexToSquare(index: number): string {
  return `${fileAt(fileOf(index))}${8 - rankOf(index)}`;
}

function fileOf(index: number): number {
  return index % 8;
}

function rankOf(index: number): number {
  return Math.floor(index / 8);
}

function indexAt(file: number, rank: number): number | null {
  if (file < 0 || file > 7 || rank < 0 || rank > 7) return null;
  return rank * 8 + file;
}

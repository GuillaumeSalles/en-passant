export type ParsedPgnMove = {
  notation: {
    notation: string;
  };
  nags: number[];
  commentBefore?: string;
  commentAfter?: string;
  variations: ParsedPgnMove[][];
};

type Token =
  | { type: "comment"; value: string }
  | { type: "open-variation" }
  | { type: "close-variation" }
  | { type: "word"; value: string };

const results = new Set(["1-0", "0-1", "1/2-1/2", "*"]);
const symbolicNags: Record<string, number> = {
  "!": 1,
  "?": 2,
  "!!": 3,
  "??": 4,
  "!?": 5,
  "?!": 6,
};

export function parsePgnMoves(pgn: string): ParsedPgnMove[] {
  const tokens = tokenize(removeTags(pgn));
  let index = 0;

  function parseLine(): ParsedPgnMove[] {
    const moves: ParsedPgnMove[] = [];
    let previousMove: ParsedPgnMove | null = null;
    let pendingCommentBefore: string | undefined;
    let isExpectingMoveAfterNumber = false;

    while (index < tokens.length) {
      const token = tokens[index];
      if (token === undefined) break;

      if (token.type === "close-variation") {
        index++;
        break;
      }

      if (token.type === "open-variation") {
        index++;
        isExpectingMoveAfterNumber = false;
        const variation = parseLine();
        if (previousMove !== null) {
          previousMove.variations.push(variation);
        }
        continue;
      }

      if (token.type === "comment") {
        index++;
        if (previousMove !== null && !isExpectingMoveAfterNumber) {
          previousMove.commentAfter = appendComment(previousMove.commentAfter, token.value);
        } else {
          pendingCommentBefore = appendComment(pendingCommentBefore, token.value);
        }
        continue;
      }

      index++;
      const nag = nagFromToken(token.value);
      if (nag !== null) {
        if (previousMove !== null) {
          previousMove.nags.push(nag);
        }
        isExpectingMoveAfterNumber = false;
        continue;
      }

      const moveToken = moveFromToken(token.value);
      if (moveToken === null) {
        isExpectingMoveAfterNumber = isStandaloneMoveNumber(token.value);
        continue;
      }

      previousMove = {
        notation: { notation: moveToken.notation },
        nags: moveToken.nag === null ? [] : [moveToken.nag],
        variations: [],
      };
      if (pendingCommentBefore !== undefined) {
        previousMove.commentBefore = pendingCommentBefore;
      }
      pendingCommentBefore = undefined;
      isExpectingMoveAfterNumber = false;
      moves.push(previousMove);
    }

    return moves;
  }

  return parseLine();
}

function appendComment(existingComment: string | undefined, comment: string): string {
  return existingComment === undefined ? comment : `${existingComment}\n${comment}`;
}

function removeTags(pgn: string): string {
  return pgn
    .split("\n")
    .filter((line) => !line.trim().startsWith("["))
    .join("\n");
}

function tokenize(pgn: string): Token[] {
  const tokens: Token[] = [];
  let index = 0;

  while (index < pgn.length) {
    const char = pgn[index];
    if (char === undefined) break;

    if (/\s/.test(char)) {
      index++;
      continue;
    }

    if (char === "{") {
      const end = pgn.indexOf("}", index + 1);
      if (end === -1) {
        throw new Error("Unterminated PGN comment");
      }
      tokens.push({
        type: "comment",
        value: pgn.slice(index + 1, end).trim(),
      });
      index = end + 1;
      continue;
    }

    if (char === "(") {
      tokens.push({ type: "open-variation" });
      index++;
      continue;
    }

    if (char === ")") {
      tokens.push({ type: "close-variation" });
      index++;
      continue;
    }

    let end = index + 1;
    while (end < pgn.length) {
      const nextChar = pgn[end];
      if (
        nextChar === undefined ||
        /\s/.test(nextChar) ||
        nextChar === "{" ||
        nextChar === "(" ||
        nextChar === ")"
      ) {
        break;
      }
      end++;
    }
    tokens.push({ type: "word", value: pgn.slice(index, end) });
    index = end;
  }

  return tokens;
}

function nagFromToken(token: string): number | null {
  if (token.startsWith("$")) {
    const value = Number(token.slice(1));
    return Number.isInteger(value) && value > 0 ? value : null;
  }

  return symbolicNags[token] ?? null;
}

function moveFromToken(token: string): { notation: string; nag: number | null } | null {
  if (results.has(token)) {
    return null;
  }

  const withoutMoveNumber = token.replace(/^\d+\.(?:\.\.)?/, "");
  if (withoutMoveNumber === "") {
    return null;
  }

  const annotation = withoutMoveNumber.match(/[!?]+$/)?.[0] ?? "";
  const notation = withoutMoveNumber.slice(0, withoutMoveNumber.length - annotation.length);
  const nag = symbolicNags[annotation];

  return {
    notation,
    nag: nag ?? null,
  };
}

function isStandaloneMoveNumber(token: string): boolean {
  return token.replace(/^\d+\.(?:\.\.)?/, "") === "";
}

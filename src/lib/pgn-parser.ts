export type ParsedPgnMove = {
  notation: {
    notation: string;
  };
  nags: number[];
  clock?: string;
  commentBefore?: string;
  commentAfter?: string;
  metadata: string[];
  timeSpent?: string;
  timeSpentSource?: TimeSpentSource;
  variations: ParsedPgnMove[][];
};

export type ParsedPgnTags = Record<string, string>;

type TimeSpentSource = "timestamp" | "emt";
type MoveCommentData = {
  clock: string | undefined;
  comment: string | undefined;
  metadata: string[];
  timeSpent: string | undefined;
  timeSpentSource: TimeSpentSource | undefined;
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
    let pendingCommentMetadata = emptyMoveCommentData();
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
          appendMoveComment(previousMove, token.value);
        } else {
          const commentData = extractMoveCommentData(token.value);
          pendingCommentMetadata = mergeMoveCommentData(pendingCommentMetadata, commentData);
          if (commentData.comment !== undefined) {
            pendingCommentBefore = appendComment(pendingCommentBefore, commentData.comment);
          }
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
        metadata: [],
        variations: [],
      };
      applyMoveCommentData(previousMove, pendingCommentMetadata);
      if (pendingCommentBefore !== undefined) {
        previousMove.commentBefore = pendingCommentBefore;
      }
      pendingCommentBefore = undefined;
      pendingCommentMetadata = emptyMoveCommentData();
      isExpectingMoveAfterNumber = false;
      moves.push(previousMove);
    }

    return moves;
  }

  return parseLine();
}

function appendMoveComment(move: ParsedPgnMove, comment: string): void {
  const commentData = extractMoveCommentData(comment);
  applyMoveCommentData(move, commentData);

  if (commentData.comment !== undefined) {
    move.commentAfter = appendComment(move.commentAfter, commentData.comment);
  }
}

function emptyMoveCommentData(): MoveCommentData {
  return {
    clock: undefined,
    comment: undefined,
    metadata: [],
    timeSpent: undefined,
    timeSpentSource: undefined,
  };
}

function extractMoveCommentData(comment: string): MoveCommentData {
  let clock: string | undefined;
  let timeSpent: string | undefined;
  let timeSpentSource: TimeSpentSource | undefined;
  const metadata: string[] = [];
  const cleanedComment = comment
    .replace(
      /\[%([A-Za-z][A-Za-z0-9_-]*)(?:\s+([^\]]*?))?\s*\]/g,
      (_match, rawKey: string, rawValue: string | undefined) => {
        const key = rawKey.toLowerCase();
        const value = rawValue?.trim() ?? "";
        const metadataText = value === "" ? `[%${rawKey}]` : `[%${rawKey} ${value}]`;
        metadata.push(metadataText);

        if (key === "clk") {
          clock = value;
        } else if (key === "timestamp") {
          timeSpent = value;
          timeSpentSource = "timestamp";
        } else if (key === "emt" && timeSpentSource !== "timestamp") {
          timeSpent = value;
          timeSpentSource = "emt";
        }

        return "";
      },
    )
    .trim();

  return {
    clock,
    comment: cleanedComment === "" && comment.trim() !== "" ? undefined : cleanedComment,
    metadata,
    timeSpent,
    timeSpentSource,
  };
}

function mergeMoveCommentData(left: MoveCommentData, right: MoveCommentData): MoveCommentData {
  const result: MoveCommentData = {
    clock: right.clock ?? left.clock,
    comment: undefined,
    metadata: [...left.metadata, ...right.metadata],
    timeSpent: left.timeSpent,
    timeSpentSource: left.timeSpentSource,
  };
  const source = right.timeSpentSource;
  if (
    right.timeSpent !== undefined &&
    source !== undefined &&
    shouldApplyTimeSpent(left.timeSpentSource, source)
  ) {
    result.timeSpent = right.timeSpent;
    result.timeSpentSource = source;
  }
  return result;
}

function applyMoveCommentData(move: ParsedPgnMove, commentData: MoveCommentData): void {
  if (commentData.clock !== undefined) {
    move.clock = commentData.clock;
  }
  move.metadata.push(...commentData.metadata);

  const source = commentData.timeSpentSource;
  if (
    commentData.timeSpent !== undefined &&
    source !== undefined &&
    shouldApplyTimeSpent(move.timeSpentSource, source)
  ) {
    move.timeSpent = commentData.timeSpent;
    move.timeSpentSource = source;
  }
}

function shouldApplyTimeSpent(
  currentSource: TimeSpentSource | undefined,
  nextSource: TimeSpentSource | undefined,
): boolean {
  if (nextSource === undefined) return false;
  return nextSource === "timestamp" || currentSource !== "timestamp";
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

export function parsePgnTags(pgn: string): ParsedPgnTags {
  const tags: ParsedPgnTags = {};
  for (const line of pgn.split("\n")) {
    const match = line.trim().match(/^\[([A-Za-z0-9_]+)\s+"((?:\\"|[^"])*)"\]$/);
    if (match === null) continue;

    const [, key, value] = match;
    if (key === undefined || value === undefined) continue;
    tags[key] = value.replace(/\\"/g, '"');
  }

  return tags;
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

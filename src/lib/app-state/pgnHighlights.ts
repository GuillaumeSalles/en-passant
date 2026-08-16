import type { HighlightKind, Highlights } from "./types";

const squarePattern = /^[a-h][1-8]$/;
const metadataPattern = /^\[%([A-Za-z][A-Za-z0-9_-]*)(?:\s+([^\]]*?))?\s*\]$/;

type PgnHighlightColor =
  | { code: "B"; arrowKind: "alt"; squareKind: "alt" }
  | { code: "G"; arrowKind: "shift"; squareKind: "shift" }
  | { code: "R"; arrowKind: "ctrl"; squareKind: "normal" }
  | { code: "Y"; arrowKind: "normal"; squareKind: "ctrl" };

const blue: PgnHighlightColor = { code: "B", arrowKind: "alt", squareKind: "alt" };
const green: PgnHighlightColor = { code: "G", arrowKind: "shift", squareKind: "shift" };
const red: PgnHighlightColor = { code: "R", arrowKind: "ctrl", squareKind: "normal" };
const yellow: PgnHighlightColor = { code: "Y", arrowKind: "normal", squareKind: "ctrl" };
const pgnHighlightColors: readonly PgnHighlightColor[] = [blue, green, red, yellow];

function pgnHighlightColor(code: string | undefined): PgnHighlightColor | undefined {
  const normalizedCode = code?.toUpperCase();
  return pgnHighlightColors.find((color) => color.code === normalizedCode);
}

function pgnArrowColor(kind: HighlightKind): PgnHighlightColor {
  switch (kind) {
    case "alt":
      return blue;
    case "ctrl":
      return red;
    case "normal":
      return yellow;
    case "shift":
      return green;
  }
}

function pgnSquareColor(kind: HighlightKind): PgnHighlightColor {
  switch (kind) {
    case "alt":
      return blue;
    case "ctrl":
      return yellow;
    case "normal":
      return red;
    case "shift":
      return green;
  }
}

function parseMetadata(metadata: string): { key: string; value: string } | null {
  const match = metadata.match(metadataPattern);
  const key = match?.[1];
  if (key === undefined) return null;
  return { key: key.toLowerCase(), value: match?.[2]?.trim() ?? "" };
}

function parseSquareHighlights(value: string, squares: Highlights["squares"]): void {
  for (const annotation of value.split(",")) {
    const token = annotation.trim();
    const color = pgnHighlightColor(token[0]);
    const square = token.slice(1).toLowerCase();
    if (color !== undefined && squarePattern.test(square)) {
      squares[square] = color.squareKind;
    }
  }
}

function parseArrows(value: string, arrows: Highlights["arrows"]): void {
  for (const annotation of value.split(",")) {
    const token = annotation.trim();
    const color = pgnHighlightColor(token[0]);
    const from = token.slice(1, 3).toLowerCase();
    const to = token.slice(3, 5).toLowerCase();
    if (color !== undefined && squarePattern.test(from) && squarePattern.test(to) && from !== to) {
      arrows[from + to] = color.arrowKind;
    }
  }
}

function chessComHighlightKind(fields: readonly string[]): HighlightKind {
  const keyPressedIndex = fields.findIndex((field) => field.toLowerCase() === "keypressed");
  const keyPressed = fields[keyPressedIndex + 1]?.toLowerCase();
  if (keyPressed === "shift") return "shift";
  if (keyPressed === "alt") return "alt";
  if (keyPressed === "ctrl" || keyPressed === "control") return "ctrl";
  return "normal";
}

function propertyValue(fields: readonly string[], property: string): string | undefined {
  const index = fields.findIndex((field) => field.toLowerCase() === property);
  return fields[index + 1]?.toLowerCase();
}

function parseChessComSquares(value: string, squares: Highlights["squares"]): void {
  for (const annotation of value.split(",")) {
    const fields = annotation.split(";").map((field) => field.trim());
    const square = propertyValue(fields, "square") ?? fields[0]?.toLowerCase();
    if (square !== undefined && squarePattern.test(square)) {
      squares[square] = chessComHighlightKind(fields);
    }
  }
}

function parseChessComArrows(value: string, arrows: Highlights["arrows"]): void {
  for (const annotation of value.split(",")) {
    const fields = annotation.split(";").map((field) => field.trim());
    const coordinate = fields[0]?.toLowerCase() ?? "";
    const from = propertyValue(fields, "from") ?? coordinate.slice(0, 2);
    const to = propertyValue(fields, "to") ?? coordinate.slice(2, 4);
    if (squarePattern.test(from) && squarePattern.test(to) && from !== to) {
      arrows[from + to] = chessComHighlightKind(fields);
    }
  }
}

export function highlightsFromPgnMetadata(metadata: readonly string[]): Highlights {
  const highlights: Highlights = { squares: {}, arrows: {} };

  for (const annotation of metadata) {
    const parsed = parseMetadata(annotation);
    if (parsed?.key === "csl") {
      parseSquareHighlights(parsed.value, highlights.squares);
    } else if (parsed?.key === "cal") {
      parseArrows(parsed.value, highlights.arrows);
    } else if (parsed?.key === "c_highlight" || parsed?.key === "c_square") {
      parseChessComSquares(parsed.value, highlights.squares);
    } else if (parsed?.key === "c_arrow") {
      parseChessComArrows(parsed.value, highlights.arrows);
    }
  }

  return highlights;
}

function isHighlightMetadata(metadata: string): boolean {
  const key = parseMetadata(metadata)?.key;
  return (
    key === "cal" ||
    key === "csl" ||
    key === "c_arrow" ||
    key === "c_highlight" ||
    key === "c_square"
  );
}

export function withPgnHighlightMetadata(
  metadata: readonly string[],
  highlights: Highlights,
): string[] {
  const result = metadata.filter((annotation) => !isHighlightMetadata(annotation));
  const squares = Object.entries(highlights.squares).map(
    ([square, kind]) => `${pgnSquareColor(kind).code}${square}`,
  );
  const arrows = Object.entries(highlights.arrows).map(
    ([fromTo, kind]) => `${pgnArrowColor(kind).code}${fromTo}`,
  );

  if (squares.length > 0) {
    result.push(`[%csl ${squares.join(",")}]`);
  }
  if (arrows.length > 0) {
    result.push(`[%cal ${arrows.join(",")}]`);
  }
  return result;
}

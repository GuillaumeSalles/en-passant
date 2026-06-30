const nagGlyphs: Record<number, string> = {
  1: "!",
  2: "?",
  3: "!!",
  4: "??",
  5: "!?",
  6: "?!",
  7: "□",
  8: "□",
  9: "??",
  10: "=",
  11: "=",
  12: "=",
  13: "∞",
  14: "+=",
  15: "=+",
  16: "+/-",
  17: "-/+",
  18: "+-",
  19: "-+",
  20: "+-",
  21: "-+",
  22: "⨀",
  23: "⨀",
  36: "↑",
  37: "↑",
  40: "→",
  41: "→",
};

const nagMeanings: Record<number, string> = {
  1: "Good move",
  2: "Mistake",
  3: "Brilliant move",
  4: "Blunder",
  5: "Interesting move",
  6: "Dubious move",
  7: "Forced move",
  8: "Singular move",
  9: "Worst move",
  10: "Position is equal",
  11: "Equal chances, quiet position",
  12: "Equal chances, active position",
  13: "Unclear position",
  14: "White has a slight advantage",
  15: "Black has a slight advantage",
  16: "White has a moderate advantage",
  17: "Black has a moderate advantage",
  18: "White is winning",
  19: "Black is winning",
};

const moveQualityNags = new Set([1, 2, 3, 4, 5, 6, 7, 8]);
const evaluationNags = new Set([10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21]);

export function getNagGlyph(nag: number): string {
  return nagGlyphs[nag] ?? `$${nag}`;
}

export function getNagMeaning(nag: number): string {
  return nagMeanings[nag] ?? `NAG $${nag}`;
}

function isSameNagGroup(left: number, right: number): boolean {
  return (
    (moveQualityNags.has(left) && moveQualityNags.has(right)) ||
    (evaluationNags.has(left) && evaluationNags.has(right))
  );
}

export function applyNagToList(nags: number[], nag: number): number[] {
  if (nags.includes(nag)) {
    return nags.filter((currentNag) => currentNag !== nag);
  }

  return [...nags.filter((currentNag) => !isSameNagGroup(currentNag, nag)), nag];
}

export function normalizeNags(nags: number[]): number[] {
  return nags.reduce((result, nag) => applyNagToList(result, nag), [] as number[]);
}

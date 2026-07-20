import { normalizePgn, type Move, type NormalizedPgn } from "@/lib/AppState";

export type MovePath = string[];

export type MoveAnnotations = {
  nags: number[];
  commentBefore: string | null;
  commentAfter: string | null;
};

export type PgnMutation =
  | {
      type: "addMove";
      parentPath: MovePath;
      move: string;
      annotations: MoveAnnotations;
    }
  | { type: "deleteSubtree"; path: MovePath }
  | { type: "setAnnotations"; path: MovePath; annotations: MoveAnnotations }
  | { type: "reorderVariations"; parentPath: MovePath; childMoves: string[] }
  | { type: "replacePgn"; pgn: string };

type PathNode = {
  path: MovePath;
  parentPath: MovePath;
  move: string;
  annotations: MoveAnnotations;
  childMoves: string[];
};

const MAX_INCREMENTAL_MUTATIONS = 500;

function pathKey(path: MovePath): string {
  return path.join("/");
}

function uci(move: Move): string {
  return `${move.from}${move.to}${move.promotion ?? ""}`;
}

function canonicalCommentAfter(move: Move): string | null {
  const annotations = [
    ...move.metadata,
    ...(move.metadata.length === 0 && move.clock !== null
      ? [`[%clk ${move.clock}]`]
      : move.metadata.length === 0 && move.timeSpent === null
        ? []
        : move.metadata.length === 0
          ? [`[%emt ${move.timeSpent}]`]
          : []),
  ];
  const parts = [
    ...annotations,
    ...(move.commentAfter === null || move.commentAfter === "" ? [] : [move.commentAfter]),
  ];
  return parts.length === 0 ? null : parts.join(" ");
}

function annotations(move: Move): MoveAnnotations {
  return {
    nags: [...move.nags],
    commentBefore: move.commentBefore,
    commentAfter: canonicalCommentAfter(move),
  };
}

function pathNodes(pgn: NormalizedPgn): Map<string, PathNode> {
  const result = new Map<string, PathNode>();

  function visit(moveIds: number[], parentPath: MovePath): void {
    for (const moveId of moveIds) {
      const move = pgn.moves[moveId];
      if (move === undefined) continue;
      const moveUci = uci(move);
      const path = [...parentPath, moveUci];
      const key = pathKey(path);
      if (result.has(key)) throw new Error(`Duplicate move path: ${path.join(" ")}`);
      result.set(key, {
        path,
        parentPath,
        move: moveUci,
        annotations: annotations(move),
        childMoves: move.next.flatMap((id) => {
          const child = pgn.moves[id];
          return child === undefined ? [] : [uci(child)];
        }),
      });
      visit(move.next, path);
    }
  }

  visit(pgn.rootMoveIds, []);
  return result;
}

function childrenByParent(nodes: Map<string, PathNode>): Map<string, string[]> {
  const result = new Map<string, string[]>();
  for (const node of nodes.values()) {
    result.set(pathKey(node.path), node.childMoves);
  }
  result.set(
    "",
    [...nodes.values()].filter((node) => node.parentPath.length === 0).map((node) => node.move),
  );
  return result;
}

function sameValue(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

export function pgnMutationsBetween(
  previousPgn: string | undefined,
  currentPgn: string,
): PgnMutation[] {
  if (previousPgn === undefined) return [{ type: "replacePgn", pgn: currentPgn }];
  if (previousPgn === currentPgn) return [];

  const previous = pathNodes(normalizePgn(previousPgn));
  const current = pathNodes(normalizePgn(currentPgn));
  const mutations: PgnMutation[] = [];

  const removed = [...previous.values()].filter((node) => !current.has(pathKey(node.path)));
  for (const node of removed) {
    if (node.parentPath.length > 0 && !current.has(pathKey(node.parentPath))) continue;
    mutations.push({ type: "deleteSubtree", path: node.path });
  }

  const added = [...current.values()]
    .filter((node) => !previous.has(pathKey(node.path)))
    .sort((left, right) => left.path.length - right.path.length);
  for (const node of added) {
    mutations.push({
      type: "addMove",
      parentPath: node.parentPath,
      move: node.move,
      annotations: node.annotations,
    });
  }

  for (const node of current.values()) {
    const oldNode = previous.get(pathKey(node.path));
    if (oldNode !== undefined && !sameValue(oldNode.annotations, node.annotations)) {
      mutations.push({
        type: "setAnnotations",
        path: node.path,
        annotations: node.annotations,
      });
    }
  }

  const previousChildren = childrenByParent(previous);
  const currentChildren = childrenByParent(current);
  for (const [parentKey, childMoves] of currentChildren) {
    const oldChildMoves = previousChildren.get(parentKey);
    if (oldChildMoves === undefined || sameValue(oldChildMoves, childMoves)) continue;
    const parentPath = parentKey === "" ? [] : (current.get(parentKey)?.path ?? []);
    mutations.push({ type: "reorderVariations", parentPath, childMoves });
  }

  return mutations.length > MAX_INCREMENTAL_MUTATIONS
    ? [{ type: "replacePgn", pgn: currentPgn }]
    : mutations;
}

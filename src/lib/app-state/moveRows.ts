import type { CommentPlacement } from "@/lib/commentShortcutEvents";
import { getMoveNumber, isMoveWhite } from "./pgnTree";
import type { Move } from "./types";

type MoveRowTask =
  | { type: "main"; move: Move }
  | { type: "partial-white"; move: Move }
  | { type: "partial-black"; move: Move }
  | {
      type: "variation";
      move: Move;
      indent: number;
      canMoveUp: boolean;
      canMoveDown: boolean;
    };

export type MoveTokenData = {
  moveId: number;
  class?: string;
  timeSpent: string | null;
  timeSpentShare: number | null;
  canPromoteVariation: boolean;
  canMoveVariationUp: boolean;
  canMoveVariationDown: boolean;
};

export type MoveCommentData = {
  moveId: number;
  comment: string;
  placement: CommentPlacement;
  editRequestVersion: number | null;
};

export type MainMovesRowData = {
  id: string;
  type: "main";
  index: number;
  whiteMove: MoveTokenData | "dots";
  blackMove: MoveTokenData | "dots" | undefined;
  commentBefore: MoveCommentData | undefined;
  commentAfter: MoveCommentData | undefined;
};

export type VariationRowItem =
  | { type: "move-number"; id: string; moveNumber: number; isWhite: boolean }
  | { type: "move"; id: string; move: MoveTokenData }
  | { type: "comment"; id: string; comment: MoveCommentData };

export type VariationRowData = {
  id: string;
  type: "variation";
  indent: number;
  items: VariationRowItem[];
};

export type MoveListRow = MainMovesRowData | VariationRowData;

export type CommentEditorRequest = {
  moveId: number;
  placement: CommentPlacement;
  version: number;
};

function mainMoveToken(move: Move): MoveTokenData {
  return {
    moveId: move.id,
    class: "w-14",
    timeSpent: move.timeSpent,
    timeSpentShare: move.timeSpentShare,
    canPromoteVariation: false,
    canMoveVariationUp: false,
    canMoveVariationDown: false,
  };
}

function variationMoveToken(
  move: Move,
  canMoveVariationUp: boolean,
  canMoveVariationDown: boolean,
): MoveTokenData {
  return {
    moveId: move.id,
    timeSpent: move.timeSpent,
    timeSpentShare: move.timeSpentShare,
    canPromoteVariation: true,
    canMoveVariationUp,
    canMoveVariationDown,
  };
}

function moveComment(
  move: Move,
  placement: CommentPlacement,
  commentEditorRequest: CommentEditorRequest | null,
): MoveCommentData | undefined {
  const isEditRequested =
    commentEditorRequest?.moveId === move.id && commentEditorRequest.placement === placement;
  const comment = placement === "before" ? move.commentBefore : move.commentAfter;
  if (comment == null && !isEditRequested) return undefined;
  return {
    moveId: move.id,
    comment: comment ?? "",
    placement,
    editRequestVersion: isEditRequested ? commentEditorRequest.version : null,
  };
}

function getMove(moves: Record<number, Move>, moveId: number | undefined): Move | undefined {
  return moveId === undefined ? undefined : moves[moveId];
}

function firstChild(moves: Record<number, Move>, move: Move): Move | undefined {
  return getMove(moves, move.next[0]);
}

function hasCommentAfter(move: Move, commentEditorRequest: CommentEditorRequest | null): boolean {
  return moveComment(move, "after", commentEditorRequest) != null;
}

function hasCommentBefore(move: Move, commentEditorRequest: CommentEditorRequest | null): boolean {
  return moveComment(move, "before", commentEditorRequest) != null;
}

function mainMovesRow(
  id: string,
  whiteMove: MoveTokenData | "dots",
  blackMove: MoveTokenData | "dots" | undefined,
  indexMove: Move,
  commentBefore: MoveCommentData | undefined,
  commentAfter: MoveCommentData | undefined,
): MainMovesRowData {
  return {
    id,
    type: "main",
    index: getMoveNumber(indexMove),
    whiteMove,
    blackMove,
    commentBefore,
    commentAfter,
  };
}

function variationTask(
  move: Move,
  index: number,
  siblingCount: number,
  indent: number,
): MoveRowTask {
  return {
    type: "variation",
    move,
    indent,
    canMoveDown: index < siblingCount - 1,
    canMoveUp: index > 0,
  };
}

function variationTasksFromSiblings(
  movesData: Record<number, Move>,
  moveIds: number[],
  indent: number,
): MoveRowTask[] {
  const result: MoveRowTask[] = [];
  for (let index = 0; index < moveIds.length; index++) {
    const move = getMove(movesData, moveIds[index]);
    if (move === undefined) continue;
    result.push(variationTask(move, index, moveIds.length, indent));
  }
  return result;
}

function addMoveToVariationItems(
  items: VariationRowItem[],
  move: Move,
  canMoveVariationUp: boolean,
  canMoveVariationDown: boolean,
  commentEditorRequest: CommentEditorRequest | null,
): void {
  if (items.length === 0 || isMoveWhite(move)) {
    items.push({
      type: "move-number",
      id: `move-number-${move.id}`,
      moveNumber: getMoveNumber(move),
      isWhite: isMoveWhite(move),
    });
  }

  const commentBefore = moveComment(move, "before", commentEditorRequest);
  if (commentBefore != null) {
    items.push({
      type: "comment",
      id: `comment-before-${move.id}`,
      comment: commentBefore,
    });
  }

  items.push({
    type: "move",
    id: `move-${move.id}`,
    move: variationMoveToken(move, canMoveVariationUp, canMoveVariationDown),
  });

  const commentAfter = moveComment(move, "after", commentEditorRequest);
  if (commentAfter != null) {
    items.push({
      type: "comment",
      id: `comment-after-${move.id}`,
      comment: commentAfter,
    });
  }
}

export function buildMoveRows(
  movesData: Record<number, Move>,
  rootMoveIdsData: number[],
  commentEditorRequest: CommentEditorRequest | null,
): MoveListRow[] {
  const rows: MoveListRow[] = [];
  const tasks: MoveRowTask[] = [];

  const firstRootMove = getMove(movesData, rootMoveIdsData[0]);
  if (firstRootMove !== undefined && rootMoveIdsData.length === 1) {
    tasks.push({ type: "main", move: firstRootMove });
  } else if (firstRootMove !== undefined) {
    tasks.push({ type: "partial-white", move: firstRootMove });
    tasks.push(...variationTasksFromSiblings(movesData, rootMoveIdsData.slice(1), 1));
  }

  function tasksAfterBlackMove(blackMove: Move): MoveRowTask[] {
    const nextWhiteMove = firstChild(movesData, blackMove);
    if (nextWhiteMove === undefined) return [];

    const result: MoveRowTask[] = [
      hasCommentAfter(nextWhiteMove, commentEditorRequest) || blackMove.next.length > 1
        ? { type: "partial-white", move: nextWhiteMove }
        : { type: "main", move: nextWhiteMove },
    ];
    result.push(...variationTasksFromSiblings(movesData, blackMove.next.slice(1), 1));
    return result;
  }

  function insertNext(cursor: number, nextTasks: MoveRowTask[]): void {
    tasks.splice(cursor, 0, ...nextTasks);
  }

  function appendMainTask(task: Extract<MoveRowTask, { type: "main" }>, cursor: number): void {
    const whiteMove = task.move;
    const blackMove = firstChild(movesData, whiteMove);

    if (blackMove === undefined) {
      rows.push(
        mainMovesRow(
          `main-${whiteMove.id}`,
          mainMoveToken(whiteMove),
          undefined,
          whiteMove,
          moveComment(whiteMove, "before", commentEditorRequest),
          moveComment(whiteMove, "after", commentEditorRequest),
        ),
      );
      return;
    }

    if (
      hasCommentAfter(whiteMove, commentEditorRequest) ||
      hasCommentBefore(blackMove, commentEditorRequest)
    ) {
      insertNext(cursor, [{ type: "partial-white", move: whiteMove }]);
      return;
    }

    rows.push(
      mainMovesRow(
        `main-${whiteMove.id}-${blackMove.id}`,
        mainMoveToken(whiteMove),
        mainMoveToken(blackMove),
        whiteMove,
        moveComment(whiteMove, "before", commentEditorRequest),
        moveComment(blackMove, "after", commentEditorRequest),
      ),
    );

    insertNext(cursor, variationTasksFromSiblings(movesData, whiteMove.next.slice(1), 1));
    tasks.push(...tasksAfterBlackMove(blackMove));
  }

  function appendPartialWhiteTask(task: Extract<MoveRowTask, { type: "partial-white" }>): void {
    const whiteMove = task.move;
    rows.push(
      mainMovesRow(
        `partial-white-${whiteMove.id}`,
        mainMoveToken(whiteMove),
        "dots",
        whiteMove,
        moveComment(whiteMove, "before", commentEditorRequest),
        moveComment(whiteMove, "after", commentEditorRequest),
      ),
    );

    const blackMove = firstChild(movesData, whiteMove);
    if (blackMove === undefined) return;
    tasks.push({ type: "partial-black", move: blackMove });
    tasks.push(...variationTasksFromSiblings(movesData, whiteMove.next.slice(1), 1));
  }

  function appendPartialBlackTask(task: Extract<MoveRowTask, { type: "partial-black" }>): void {
    const blackMove = task.move;
    rows.push(
      mainMovesRow(
        `partial-black-${blackMove.id}`,
        "dots",
        mainMoveToken(blackMove),
        blackMove,
        moveComment(blackMove, "before", commentEditorRequest),
        moveComment(blackMove, "after", commentEditorRequest),
      ),
    );
    tasks.push(...tasksAfterBlackMove(blackMove));
  }

  function appendVariationTask(
    task: Extract<MoveRowTask, { type: "variation" }>,
    cursor: number,
  ): void {
    let move = task.move;
    const items: VariationRowItem[] = [];

    while (true) {
      addMoveToVariationItems(items, move, task.canMoveUp, task.canMoveDown, commentEditorRequest);

      if (move.next.length === 0) break;
      if (move.next.length > 1) {
        insertNext(cursor, variationTasksFromSiblings(movesData, move.next, task.indent + 1));
        break;
      }

      const nextMove = firstChild(movesData, move);
      if (nextMove === undefined) break;
      move = nextMove;
    }

    rows.push({
      id: `variation-${task.move.id}`,
      type: "variation",
      indent: task.indent,
      items,
    });
  }

  for (let cursor = 0; cursor < tasks.length; cursor++) {
    const task = tasks[cursor];
    if (task === undefined) continue;

    switch (task.type) {
      case "main": {
        appendMainTask(task, cursor + 1);
        break;
      }
      case "partial-white": {
        appendPartialWhiteTask(task);
        break;
      }
      case "partial-black": {
        appendPartialBlackTask(task);
        break;
      }
      case "variation": {
        appendVariationTask(task, cursor + 1);
        break;
      }
    }
  }

  return rows;
}

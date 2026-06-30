import {
  SquareHighlightKind,
  HighlightKind,
  ArrowKind,
  Orientation,
  BoardAnimation,
  FenPiece,
} from "@/lib/AppState";
import {
  fenPieceToPiece,
  getHighlightKindFromEvent,
  getSquarePosition,
  parseFen,
  squares,
} from "./utils";
import { createSignal, createMemo, createEffect, onSettled, For } from "solid-js";
import styles from "./Chessboard.module.css";
import { DraggedHoverSquare } from "./DraggedHoverSquare";
import { DraggedPiece } from "./DraggedPiece";
import { Coordinates } from "./Coordinates";
import { HighlightSquare } from "./HighlightSquare";
import { Square } from "./Square";
import { Piece } from "./Piece";
import { CapturedPiece, MovingPiece, PromotedPiece } from "./MovingPiece";
import type { PieceMovement } from "./MovingPiece";
import { Arrows } from "./Arrows";
import { MoveAnnotation } from "./MoveAnnotation";
import type { MoveAnnotationData } from "./MoveAnnotation";

type ChessboardProps = {
  boardOrientation: Orientation;
  position: string; // FEN string
  onPieceDrop: (sourceSquare: string, targetSquare: string, piece: string) => void;
  arrows: { [fromTo: string]: ArrowKind };
  squareHighlights: { [square: string]: SquareHighlightKind };
  onHighlightSquare: (square: string, highlight: HighlightKind) => void;
  onDrawArrow: (from: string, to: string, type: HighlightKind) => void;
  canDrag?: boolean;
  pieceToAnimate?: BoardAnimation | null;
  annotations: { [square: string]: MoveAnnotationData[] };
};

export type { FenPiece };
type PieceKey = `${string}:${FenPiece}`;
type PieceEntry = {
  key: PieceKey;
  square: string;
  piece: FenPiece;
};
const MOVE_ANIMATION_DURATION_MS = 400;

function isSafariBrowser() {
  return (
    navigator.vendor.includes("Apple") &&
    /Safari/.test(navigator.userAgent) &&
    !/Chrome|Chromium|CriOS|FxiOS|EdgiOS|Android/.test(navigator.userAgent)
  );
}

function pieceKey(square: string, piece: FenPiece): PieceKey {
  return `${square}:${piece}`;
}

function squareFromPointer(
  event: Pick<PointerEvent, "clientX" | "clientY">,
  boardElement: HTMLElement | undefined,
  boardOrientation: Orientation,
): string | null {
  if (boardElement === undefined) return null;

  const rect = boardElement.getBoundingClientRect();
  const x = event.clientX - rect.left;
  const y = event.clientY - rect.top;
  if (x < 0 || y < 0 || x >= rect.width || y >= rect.height) return null;

  const visualFile = Math.floor((x / rect.width) * 8);
  const visualRank = Math.floor((y / rect.height) * 8);
  const file = boardOrientation === "black" ? 7 - visualFile : visualFile;
  const rank = boardOrientation === "black" ? visualRank : 7 - visualRank;

  return `${String.fromCharCode(97 + file)}${rank + 1}`;
}

export type DraggingData =
  | {
      type: "piece";
      sourceSquare: string;
      piece: FenPiece;
      position: { x: number; y: number };
      hoverSquare: string | null;
      size: number;
    }
  | {
      type: "arrow";
      sourceSquare: string;
    };

export function Chessboard(props: ChessboardProps) {
  const canDrag = () => props.canDrag ?? true;
  const [draggingData, setDraggingData] = createSignal<DraggingData | null>(null);
  const [activeAnimation, setActiveAnimation] = createSignal<BoardAnimation | null>(null);
  const [introActive, setIntroActive] = createSignal(true);
  const [useMeasuredBoardSize, setUseMeasuredBoardSize] = createSignal(false);
  const [boardSize, setBoardSize] = createSignal<number | null>(null);
  let boardFrameRef: HTMLDivElement | undefined;
  let pieceEntryCache = new Map<PieceKey, PieceEntry>();
  const constructionGridLines = Array.from({ length: 7 }, (_, index) => ({
    position: (index + 1) * 12.5,
    delay: `${index * 44}ms`,
  }));

  const draggedPieceSourceSquare = createMemo(() => {
    const data = draggingData();
    if (data == null || data.type !== "piece") return null;
    return data.sourceSquare;
  });

  const board = createMemo(() => parseFen(props.position));
  const squareItems = createMemo(() =>
    squares.map((square) => ({
      square,
      boardOrientation: props.boardOrientation,
      piece: board()[square],
      canDrag: canDrag(),
      introDelay: getIntroDelay(square, props.boardOrientation),
    })),
  );
  const squareHighlightEntries = createMemo(() =>
    Object.entries(props.squareHighlights).map(([square, highlight]) => ({
      square,
      highlight,
      boardOrientation: props.boardOrientation,
    })),
  );
  const hiddenPieceSquares = createMemo(() => {
    const animation = activeAnimation();
    return new Set(animation?.movements.map((movement) => movement.to) ?? []);
  });
  const pieceEntries = createMemo<PieceEntry[]>(() => {
    const nextCache = new Map<PieceKey, PieceEntry>();
    const entries: PieceEntry[] = [];

    for (const [square, piece] of Object.entries(board())) {
      if (draggedPieceSourceSquare() === square || hiddenPieceSquares().has(square)) {
        continue;
      }

      const key = pieceKey(square, piece);
      const entry = pieceEntryCache.get(key) ?? { key, square, piece };
      nextCache.set(key, entry);
      entries.push(entry);
    }

    pieceEntryCache = nextCache;
    return entries;
  });
  const annotationEntries = createMemo(() =>
    Object.entries(props.annotations).flatMap(([square, annotations]) =>
      annotations.map((annotation, index) => ({
        square,
        annotation,
        index,
        boardOrientation: props.boardOrientation,
      })),
    ),
  );
  const boardStyle = createMemo(() => {
    if (!useMeasuredBoardSize()) {
      return {};
    }

    const size = boardSize();
    if (size === null || size <= 0) {
      return { height: "100%", width: "100%" };
    }

    const value = `${size}px`;
    return { height: value, width: value };
  });
  const activePieceMovements = createMemo<PieceMovement[]>(() => {
    const animation = activeAnimation();
    if (animation === null) return [];
    return animation.movements.map((movement, index) => ({
      ...movement,
      id: `${animation.id}:${index}`,
    }));
  });
  const activeCaptures = createMemo(() => {
    const animation = activeAnimation();
    return animation?.captures ?? [];
  });
  const activePromotions = createMemo(() => {
    const animation = activeAnimation();
    return animation?.promotion === null || animation === null ? [] : [animation.promotion];
  });

  const onWindowPointerMove = (e: PointerEvent) => {
    const hoverSquare = squareFromPointer(e, boardFrameRef, props.boardOrientation);

    setDraggingData((current) => {
      if (current == null) return null;
      if (current.type === "piece") {
        return {
          ...current,
          position: { x: e.clientX, y: e.clientY },
          hoverSquare: hoverSquare,
        };
      }
      return current;
    });
  };

  const onWindowBlur = () => {
    setDraggingData(null);
  };

  const onVisibilityChange = () => {
    if (document.visibilityState === "hidden") {
      setDraggingData(null);
    }
  };

  const onWindowPointerCancel = () => {
    setDraggingData(null);
  };

  function finishAnimation(id: number) {
    setActiveAnimation((current) => (current?.id === id ? null : current));
  }

  function updateBoardSize() {
    const frame = boardFrameRef;
    if (frame === undefined) return;

    const rect = frame.getBoundingClientRect();
    const nextSize = Math.floor(Math.max(0, Math.min(rect.width, rect.height)));
    setBoardSize((currentSize) => (currentSize === nextSize ? currentSize : nextSize));
  }

  const onWindowPointerUp = (e: PointerEvent) => {
    const data = draggingData();
    if (data == null) return;

    const sourceSquare = data.sourceSquare;
    setDraggingData(null);

    const targetSquare = squareFromPointer(e, boardFrameRef, props.boardOrientation);
    if (targetSquare == null) return;

    if (data.type === "piece") {
      props.onPieceDrop(sourceSquare, targetSquare, fenPieceToPiece(data.piece));
      return;
    }

    const highlightKind = getHighlightKindFromEvent(e);

    if (targetSquare === sourceSquare) {
      props.onHighlightSquare(sourceSquare, highlightKind);
    } else {
      props.onDrawArrow(sourceSquare, targetSquare, highlightKind);
    }
  };

  const onPointerDown = (event: PointerEvent, sourceSquare: string, piece?: FenPiece) => {
    if (event.button === 2) {
      setDraggingData({ type: "arrow", sourceSquare });
      return;
    }

    if (event.button === 0 && canDrag()) {
      if (piece == null) return;

      const source = event.target as HTMLElement;
      setDraggingData({
        type: "piece",
        sourceSquare,
        piece,
        position: { x: event.clientX, y: event.clientY },
        size: source.getBoundingClientRect().width,
        hoverSquare: sourceSquare,
      });
    }
  };

  onSettled(() => {
    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("blur", onWindowBlur);
    window.addEventListener("pointerup", onWindowPointerUp);
    window.addEventListener("pointermove", onWindowPointerMove);
    window.addEventListener("pointercancel", onWindowPointerCancel);

    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("blur", onWindowBlur);
      window.removeEventListener("pointerup", onWindowPointerUp);
      window.removeEventListener("pointermove", onWindowPointerMove);
      window.removeEventListener("pointercancel", onWindowPointerCancel);
    };
  });

  createEffect(
    () => props.pieceToAnimate ?? null,
    (animation) => {
      if (animation === null) {
        setActiveAnimation(null);
        return;
      }

      setActiveAnimation(animation);

      const timeout = window.setTimeout(() => {
        finishAnimation(animation.id);
      }, MOVE_ANIMATION_DURATION_MS + 50);

      return () => {
        window.clearTimeout(timeout);
      };
    },
  );

  onSettled(() => {
    const timeout = window.setTimeout(() => {
      setIntroActive(false);
    }, 1850);

    return () => {
      window.clearTimeout(timeout);
    };
  });

  onSettled(() => {
    const shouldMeasureBoardSize = isSafariBrowser();
    setUseMeasuredBoardSize(shouldMeasureBoardSize);
    if (!shouldMeasureBoardSize) return;

    updateBoardSize();

    const observer = new ResizeObserver(updateBoardSize);
    const frame = boardFrameRef;
    if (frame !== undefined) {
      observer.observe(frame);
    }
    window.addEventListener("resize", updateBoardSize);

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", updateBoardSize);
    };
  });

  return (
    <>
      <DraggedPiece draggingData={draggingData} />
      <div
        ref={boardFrameRef}
        class="flex aspect-square h-auto max-h-full w-[100vmin] max-w-full items-center justify-center xl:w-[calc(100vmin-6rem)]"
      >
        <div
          class={`relative aspect-square h-auto max-h-full w-full [container-type:size] ${styles["Board"]}`}
          style={boardStyle()}
        >
          <svg
            class={styles["IntroGrid"]}
            aria-hidden="true"
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
          >
            <For each={constructionGridLines}>
              {(line) => (
                <>
                  <line
                    class={`${styles["IntroGridLine"]} ${styles["IntroGridLineVertical"]}`}
                    x1={line.position}
                    y1="0"
                    x2={line.position}
                    y2="100"
                    style={{ "--grid-delay": line.delay }}
                  />
                  <line
                    class={`${styles["IntroGridLine"]} ${styles["IntroGridLineHorizontal"]}`}
                    x1="0"
                    y1={line.position}
                    x2="100"
                    y2={line.position}
                    style={{ "--grid-delay": line.delay }}
                  />
                </>
              )}
            </For>
          </svg>
          <For each={squareItems()}>
            {(item) => (
              <Square
                square={item.square}
                boardOrientation={item.boardOrientation}
                onPointerDown={onPointerDown}
                piece={item.piece}
                canDrag={item.canDrag}
                introActive={introActive()}
                introDelay={item.introDelay}
              />
            )}
          </For>
          <Coordinates boardOrientation={props.boardOrientation} />
          <For each={squareHighlightEntries()}>
            {(item) => (
              <HighlightSquare
                highlight={item.highlight}
                square={item.square}
                boardOrientation={item.boardOrientation}
              />
            )}
          </For>
          <DraggedHoverSquare
            boardOrientation={props.boardOrientation}
            draggingData={draggingData}
          />
          <For each={pieceEntries()}>
            {(entry) => {
              return (
                <Piece
                  piece={entry.piece}
                  square={entry.square}
                  boardOrientation={props.boardOrientation}
                  introActive={introActive()}
                  introDelay={getIntroDelay(entry.square, props.boardOrientation)}
                />
              );
            }}
          </For>
          <For each={activeCaptures()}>
            {(capture) => (
              <CapturedPiece
                piece={capture.piece}
                square={capture.square}
                boardOrientation={props.boardOrientation}
              />
            )}
          </For>
          <For each={activePromotions()}>
            {(promotion) => (
              <PromotedPiece
                piece={promotion.piece}
                square={promotion.square}
                boardOrientation={props.boardOrientation}
              />
            )}
          </For>
          <For each={activePieceMovements()}>
            {(movement) => (
              <MovingPiece movement={movement} boardOrientation={props.boardOrientation} />
            )}
          </For>
          <Arrows arrows={props.arrows} boardOrientation={props.boardOrientation} />
          <For each={annotationEntries()}>
            {(item) => (
              <MoveAnnotation
                square={item.square}
                annotation={item.annotation}
                index={item.index}
                boardOrientation={item.boardOrientation}
              />
            )}
          </For>
        </div>
      </div>
    </>
  );
}

function getIntroDelay(square: string, boardOrientation: Orientation) {
  const position = getSquarePosition(square, boardOrientation);
  return `${position.x * 52 + position.y * 58}ms`;
}

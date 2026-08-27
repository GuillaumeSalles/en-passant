import {
  SquareHighlightKind,
  HighlightKind,
  ArrowKind,
  Orientation,
  BoardAnimation,
  FenPiece,
} from "@/lib/AppState";
import { isSafariBrowser } from "@/lib/browser";
import {
  fenPieceToPiece,
  getHighlightKindFromEvent,
  getSquarePosition,
  parseFen,
  squares,
} from "./utils";
import { createSignal, createMemo, createEffect, onSettled, For, Show, untrack } from "solid-js";
import styles from "./Chessboard.module.css";
import { DraggedHoverSquare } from "./DraggedHoverSquare";
import { DraggedPiece } from "./DraggedPiece";
import { SelectedPieceSquare } from "./SelectedPieceSquare";
import { Coordinates } from "./Coordinates";
import { HighlightSquare } from "./HighlightSquare";
import { Square } from "./Square";
import { Piece } from "./Piece";
import { CapturedPiece, MovingPiece, PromotedPiece } from "./MovingPiece";
import type { PieceMovement } from "./MovingPiece";
import { Arrows } from "./Arrows";
import type { PreviewArrow } from "./Arrows";
import { MoveAnnotation } from "./MoveAnnotation";
import type { MoveAnnotationData } from "./MoveAnnotation";

type ChessboardProps = {
  boardOrientation: Orientation;
  position: string; // FEN string
  onPieceDrop: (
    sourceSquare: string,
    targetSquare: string,
    piece: string,
    animate: boolean,
  ) => void;
  arrows: { [fromTo: string]: ArrowKind };
  squareHighlights: { [square: string]: SquareHighlightKind };
  onHighlightSquare: (square: string, highlight: HighlightKind) => void;
  onDrawArrow: (from: string, to: string, type: HighlightKind) => void;
  canDrag: boolean;
  pieceToAnimate?: BoardAnimation | null;
  annotations: { [square: string]: MoveAnnotationData[] };
  readOnly: boolean;
  animateIntro: boolean;
  onIntroComplete?: () => void;
  onAnimationSettled?: (animationId: number, status: "finished" | "cancelled") => void;
};

export type { FenPiece };
type PieceKey = `${string}:${FenPiece}`;
type PieceEntry = {
  key: PieceKey;
  square: string;
  piece: FenPiece;
};
const MOVE_ANIMATION_STAGGER_MS = 110;
const INTRO_GRID_LINE_STAGGER_MS = 22;
const INTRO_DELAY_FILE_MS = 26;
const INTRO_DELAY_RANK_MS = 29;
const DRAG_START_DISTANCE_PX = 4;

type SelectedPiece = {
  sourceSquare: string;
  piece: FenPiece;
};

type PendingPrimaryPress =
  | (SelectedPiece & {
      type: "piece";
      startPosition: { x: number; y: number };
      size: number;
    })
  | (SelectedPiece & {
      type: "selected-piece-target";
    });

function pieceKey(square: string, piece: FenPiece): PieceKey {
  return `${square}:${piece}`;
}

function arePiecesSameColor(first: FenPiece, second: FenPiece): boolean {
  return (first === first.toUpperCase()) === (second === second.toUpperCase());
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
      hoverSquare: string | null;
      highlightKind: HighlightKind;
    };

function isDragButtonPressed(event: Pick<PointerEvent, "buttons">, data: DraggingData): boolean {
  const buttonMask = data.type === "piece" ? 1 : 2;
  return (event.buttons & buttonMask) !== 0;
}

export function Chessboard(props: ChessboardProps) {
  const canDrag = () => props.canDrag;
  const readOnly = untrack(() => props.readOnly);
  const animateIntro = untrack(() => props.animateIntro);
  const [draggingData, setDraggingData] = createSignal<DraggingData | null>(null);
  const [selectedPiece, setSelectedPiece] = createSignal<SelectedPiece | null>(null);
  const [activeAnimation, setActiveAnimation] = createSignal<BoardAnimation | null>(null);
  let pendingPrimaryPress: PendingPrimaryPress | null = null;
  let currentActiveAnimation: BoardAnimation | null = null;
  const [introActive, setIntroActive] = createSignal(animateIntro);
  const [useMeasuredBoardSize, setUseMeasuredBoardSize] = createSignal(false);
  const [boardSize, setBoardSize] = createSignal<number | null>(null);
  let boardFrameRef: HTMLDivElement | undefined;
  let pieceEntryCache = new Map<PieceKey, PieceEntry>();
  let completedAnimationParts = new Set<string>();
  const constructionGridLines = Array.from({ length: 7 }, (_, index) => ({
    position: (index + 1) * 12.5,
    delay: `${index * INTRO_GRID_LINE_STAGGER_MS}ms`,
  }));

  const draggedPieceSourceSquare = createMemo(() => {
    const data = draggingData();
    if (data == null || data.type !== "piece") return null;
    return data.sourceSquare;
  });

  const board = createMemo(() => parseFen(props.position));
  const activeSelectedPiece = createMemo(() => {
    const selected = selectedPiece();
    if (selected === null || !canDrag()) return null;
    return board()[selected.sourceSquare] === selected.piece ? selected : null;
  });
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
      animationPartId: `${animation.id}:movement:${index}`,
      delayMs: index * MOVE_ANIMATION_STAGGER_MS,
    }));
  });
  const activeCaptures = createMemo(() => {
    const animation = activeAnimation();
    return (
      animation?.captures.map((capture, index) => ({
        ...capture,
        animationPartId: `${animation.id}:capture:${index}`,
      })) ?? []
    );
  });
  const activePromotions = createMemo(() => {
    const animation = activeAnimation();
    return animation?.promotion === null || animation === null
      ? []
      : [{ ...animation.promotion, animationPartId: `${animation.id}:promotion` }];
  });
  const previewArrow = createMemo<PreviewArrow | null>(() => {
    const data = draggingData();
    if (data == null || data.type !== "arrow") return null;
    if (data.hoverSquare === null || data.hoverSquare === data.sourceSquare) return null;

    return {
      from: data.sourceSquare,
      to: data.hoverSquare,
      kind: data.highlightKind,
    };
  });

  const onWindowPointerMove = (e: PointerEvent) => {
    let data = draggingData();
    const pending = pendingPrimaryPress;

    if (pending !== null) {
      if ((e.buttons & 1) === 0) {
        pendingPrimaryPress = null;
        return;
      }

      if (pending.type === "selected-piece-target") return;

      const distanceX = e.clientX - pending.startPosition.x;
      const distanceY = e.clientY - pending.startPosition.y;
      if (distanceX ** 2 + distanceY ** 2 < DRAG_START_DISTANCE_PX ** 2) return;

      data = {
        type: "piece",
        sourceSquare: pending.sourceSquare,
        piece: pending.piece,
        position: { x: e.clientX, y: e.clientY },
        size: pending.size,
        hoverSquare: squareFromPointer(e, boardFrameRef, props.boardOrientation),
      };
      pendingPrimaryPress = null;
      setSelectedPiece(null);
      setDraggingData(data);
    }

    if (data !== null && !isDragButtonPressed(e, data)) {
      setDraggingData(null);
      return;
    }

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
      return {
        ...current,
        hoverSquare,
        highlightKind: getHighlightKindFromEvent(e),
      };
    });
  };

  const onWindowBlur = () => {
    pendingPrimaryPress = null;
    setDraggingData(null);
    setSelectedPiece(null);
  };

  const onVisibilityChange = () => {
    if (document.visibilityState === "hidden") {
      pendingPrimaryPress = null;
      setDraggingData(null);
      setSelectedPiece(null);
    }
  };

  const onWindowPointerCancel = () => {
    pendingPrimaryPress = null;
    setDraggingData(null);
  };

  function animationPartCount(animation: BoardAnimation): number {
    return (
      animation.movements.length +
      animation.captures.length +
      (animation.promotion === null ? 0 : 1)
    );
  }

  function settleAnimation(id: number, status: "finished" | "cancelled") {
    const current = currentActiveAnimation;
    if (current?.id !== id) return;
    completedAnimationParts = new Set();
    currentActiveAnimation = null;
    setActiveAnimation(null);
    untrack(() => props.onAnimationSettled?.(id, status));
  }

  function onBoardAnimationSettled(event: AnimationEvent) {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const partId = target.getAttribute("data-board-animation-part");
    const animation = currentActiveAnimation;
    if (partId === null || animation === null || !partId.startsWith(`${animation.id}:`)) return;

    completedAnimationParts.add(partId);
    if (completedAnimationParts.size >= animationPartCount(animation)) {
      settleAnimation(animation.id, event.type === "animationcancel" ? "cancelled" : "finished");
    }
  }

  function updateBoardSize() {
    const frame = boardFrameRef;
    if (frame === undefined) return;

    const rect = frame.getBoundingClientRect();
    const nextSize = Math.floor(Math.max(0, Math.min(rect.width, rect.height)));
    setBoardSize((currentSize) => (currentSize === nextSize ? currentSize : nextSize));
  }

  const onWindowPointerUp = (e: PointerEvent) => {
    const pending = pendingPrimaryPress;
    if (pending !== null) {
      pendingPrimaryPress = null;
      const targetSquare = squareFromPointer(e, boardFrameRef, props.boardOrientation);

      if (pending.type === "piece") {
        if (targetSquare === pending.sourceSquare) {
          setSelectedPiece({ sourceSquare: pending.sourceSquare, piece: pending.piece });
        } else if (targetSquare !== null) {
          setSelectedPiece(null);
          props.onPieceDrop(
            pending.sourceSquare,
            targetSquare,
            fenPieceToPiece(pending.piece),
            true,
          );
        }
        return;
      }

      if (targetSquare === null) return;
      setSelectedPiece(null);
      if (targetSquare !== pending.sourceSquare) {
        props.onPieceDrop(pending.sourceSquare, targetSquare, fenPieceToPiece(pending.piece), true);
      }
      return;
    }

    const data = draggingData();
    if (data == null) return;

    const sourceSquare = data.sourceSquare;
    setDraggingData(null);

    const targetSquare = squareFromPointer(e, boardFrameRef, props.boardOrientation);
    if (targetSquare == null) return;

    if (data.type === "piece") {
      props.onPieceDrop(sourceSquare, targetSquare, fenPieceToPiece(data.piece), false);
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
    if (readOnly) return;
    if (draggingData() !== null || pendingPrimaryPress !== null) return;

    if (event.button === 2) {
      setSelectedPiece(null);
      setDraggingData({
        type: "arrow",
        sourceSquare,
        hoverSquare: sourceSquare,
        highlightKind: getHighlightKindFromEvent(event),
      });
      return;
    }

    if (event.button === 0 && canDrag()) {
      const selected = activeSelectedPiece();
      if (selected !== null) {
        if (
          piece !== undefined &&
          sourceSquare !== selected.sourceSquare &&
          arePiecesSameColor(selected.piece, piece)
        ) {
          const source = event.target as HTMLElement;
          setSelectedPiece(null);
          pendingPrimaryPress = {
            type: "piece",
            sourceSquare,
            piece,
            startPosition: { x: event.clientX, y: event.clientY },
            size: source.getBoundingClientRect().width,
          };
          return;
        }

        pendingPrimaryPress = {
          type: "selected-piece-target",
          sourceSquare: selected.sourceSquare,
          piece: selected.piece,
        };
        return;
      }

      if (piece == null) return;

      const source = event.target as HTMLElement;
      pendingPrimaryPress = {
        type: "piece",
        sourceSquare,
        piece,
        startPosition: { x: event.clientX, y: event.clientY },
        size: source.getBoundingClientRect().width,
      };
    }
  };

  const cleanupWindowListeners = () => {
    document.removeEventListener("visibilitychange", onVisibilityChange);
    window.removeEventListener("blur", onWindowBlur);
    window.removeEventListener("pointerup", onWindowPointerUp);
    window.removeEventListener("pointermove", onWindowPointerMove);
    window.removeEventListener("pointercancel", onWindowPointerCancel);
  };

  onSettled(() => {
    if (readOnly) return;

    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("blur", onWindowBlur);
    window.addEventListener("pointerup", onWindowPointerUp);
    window.addEventListener("pointermove", onWindowPointerMove);
    window.addEventListener("pointercancel", onWindowPointerCancel);

    return cleanupWindowListeners;
  });

  createEffect(
    () => [props.position, canDrag()] as const,
    () => {
      pendingPrimaryPress = null;
      setDraggingData(null);
      setSelectedPiece(null);
    },
  );

  createEffect(
    () => props.pieceToAnimate ?? null,
    (animation) => {
      if (animation === null) {
        const current = currentActiveAnimation;
        if (current !== null) settleAnimation(current.id, "cancelled");
        return;
      }

      const current = currentActiveAnimation;
      if (current !== null && current.id !== animation.id) {
        settleAnimation(current.id, "cancelled");
      }
      completedAnimationParts = new Set();
      currentActiveAnimation = animation;
      setActiveAnimation(animation);
    },
  );

  onSettled(() => {
    if (!animateIntro) {
      untrack(() => props.onIntroComplete?.());
      return;
    }

    const introAnimations = boardFrameRef?.getAnimations({ subtree: true }) ?? [];
    let cancelled = false;

    void Promise.allSettled(introAnimations.map((animation) => animation.finished)).then(() => {
      if (cancelled) return;
      setIntroActive(false);
      untrack(() => props.onIntroComplete?.());
    });

    return () => {
      cancelled = true;
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
          onAnimationEnd={onBoardAnimationSettled}
          onAnimationCancel={onBoardAnimationSettled}
        >
          <Show when={introActive()}>
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
          </Show>
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
          <Show when={activeSelectedPiece()}>
            {(selected) => (
              <SelectedPieceSquare
                square={selected().sourceSquare}
                boardOrientation={props.boardOrientation}
              />
            )}
          </Show>
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
                animationPartId={capture.animationPartId}
                piece={capture.piece}
                square={capture.square}
                boardOrientation={props.boardOrientation}
              />
            )}
          </For>
          <For each={activePromotions()}>
            {(promotion) => (
              <PromotedPiece
                animationPartId={promotion.animationPartId}
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
          <Arrows
            arrows={props.arrows}
            boardOrientation={props.boardOrientation}
            previewArrow={previewArrow()}
          />
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
  return `${position.x * INTRO_DELAY_FILE_MS + position.y * INTRO_DELAY_RANK_MS}ms`;
}

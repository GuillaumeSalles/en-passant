import type { Orientation } from "@/lib/AppState";
import { createChessPosition, legalMoveDestinations } from "@/lib/chess";
import { createMemo, For } from "solid-js";
import { getSquarePosition } from "./utils";
import styles from "./Chessboard.module.css";

export function LegalMoveDots(props: {
  sourceSquare: string | null;
  position: string;
  boardOrientation: Orientation;
}) {
  const destinations = createMemo<string[]>(() => {
    const source = props.sourceSquare;
    return source === null
      ? []
      : legalMoveDestinations(createChessPosition(props.position), source);
  });

  return (
    <For each={destinations()}>
      {(square) => {
        const position = createMemo(() => getSquarePosition(square, props.boardOrientation));
        return (
          <div
            class={styles["LegalMoveDot"]}
            data-legal-move-square={square}
            aria-hidden="true"
            style={{
              left: `${(position().x + 0.5) * 12.5}%`,
              top: `${(position().y + 0.5) * 12.5}%`,
            }}
          />
        );
      }}
    </For>
  );
}

import { Orientation } from "@/lib/AppState";
import { createMemo } from "solid-js";
import styles from "./Chessboard.module.css";
import { getSquarePosition } from "./utils";

export function SelectedPieceSquare(props: { square: string; boardOrientation: Orientation }) {
  const position = createMemo(() => getSquarePosition(props.square, props.boardOrientation));

  return (
    <div
      class={styles["SelectedPieceSquare"]}
      data-selected-piece-square={props.square}
      style={{
        left: `${position().x * 12.5}%`,
        top: `${position().y * 12.5}%`,
      }}
    />
  );
}

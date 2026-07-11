import { Orientation } from "@/lib/AppState";
import { defaultPieces } from "./pieces";
import { FenPiece } from "./Chessboard";
import { getSquarePosition } from "./utils";
import { createMemo } from "solid-js";
import { Dynamic } from "@solidjs/web";
import styles from "./Chessboard.module.css";

export function Piece(props: {
  piece: FenPiece;
  square: string;
  boardOrientation: Orientation;
  introActive: boolean;
  introDelay: string;
}) {
  const position = createMemo(() => getSquarePosition(props.square, props.boardOrientation));

  const PieceComponent = createMemo(() => defaultPieces[props.piece as keyof typeof defaultPieces]);

  return (
    <Dynamic
      component={PieceComponent()}
      svgProps={{
        class: props.introActive ? styles["IntroPiece"] : undefined,
        style: {
          position: "absolute",
          "z-index": 2,
          left: `${position().x * 12.5}%`,
          top: `${position().y * 12.5}%`,
          width: "12.5%",
          height: "12.5%",
          outline: "none",
          "pointer-events": "none",
          "--intro-delay": props.introDelay,
        },
      }}
    />
  );
}

import { Orientation } from "@/lib/AppState";
import { FenPiece } from "./Chessboard";
import { defaultPieces } from "./pieces";
import { getSquarePosition } from "./utils";
import { createMemo } from "solid-js";
import styles from "./Chessboard.module.css";

export type PieceMovement = {
  id: string;
  piece: FenPiece;
  from: string;
  to: string;
};

export function MovingPiece(props: { movement: PieceMovement; boardOrientation: Orientation }) {
  const toPosition = createMemo(() => getSquarePosition(props.movement.to, props.boardOrientation));
  const fromPosition = createMemo(() =>
    getSquarePosition(props.movement.from, props.boardOrientation),
  );
  const offset = createMemo(() => ({
    x: fromPosition().x - toPosition().x,
    y: fromPosition().y - toPosition().y,
  }));

  const renderedPiece = createMemo(() => {
    const PieceComponent = defaultPieces[props.movement.piece as keyof typeof defaultPieces];

    return (
      <PieceComponent
        svgProps={{
          class: styles["MovingPiece"],
          "data-moving-piece": "true",
          "data-moving-piece-id": props.movement.id,
          style: {
            position: "absolute",
            "z-index": 3,
            left: `${toPosition().x * 12.5}%`,
            top: `${toPosition().y * 12.5}%`,
            width: "12.5%",
            height: "12.5%",
            outline: "none",
            "pointer-events": "none",
            "--move-from-x": `${offset().x * 100}%`,
            "--move-from-y": `${offset().y * 100}%`,
          },
        }}
      />
    );
  });

  return <>{renderedPiece()}</>;
}

export function CapturedPiece(props: {
  piece: FenPiece;
  square: string;
  boardOrientation: Orientation;
}) {
  return (
    <StaticAnimatedPiece
      piece={props.piece}
      square={props.square}
      boardOrientation={props.boardOrientation}
      className={styles["CapturedPiece"]}
      dataAttribute="data-captured-piece"
    />
  );
}

export function PromotedPiece(props: {
  piece: FenPiece;
  square: string;
  boardOrientation: Orientation;
}) {
  return (
    <StaticAnimatedPiece
      piece={props.piece}
      square={props.square}
      boardOrientation={props.boardOrientation}
      className={styles["PromotedPiece"]}
      dataAttribute="data-promoted-piece"
    />
  );
}

function StaticAnimatedPiece(props: {
  piece: FenPiece;
  square: string;
  boardOrientation: Orientation;
  className: string | undefined;
  dataAttribute: "data-captured-piece" | "data-promoted-piece";
}) {
  const position = createMemo(() => getSquarePosition(props.square, props.boardOrientation));
  const dataProps = createMemo(() =>
    props.dataAttribute === "data-captured-piece"
      ? {
          "data-captured-piece": "true",
          "data-captured-piece-square": props.square,
        }
      : {
          "data-promoted-piece": "true",
          "data-promoted-piece-square": props.square,
        },
  );
  const renderedPiece = createMemo(() => {
    const PieceComponent = defaultPieces[props.piece as keyof typeof defaultPieces];

    return (
      <PieceComponent
        svgProps={{
          class: props.className,
          ...dataProps(),
          style: {
            position: "absolute",
            "z-index": 2,
            left: `${position().x * 12.5}%`,
            top: `${position().y * 12.5}%`,
            width: "12.5%",
            height: "12.5%",
            outline: "none",
            "pointer-events": "none",
          },
        }}
      />
    );
  });

  return <>{renderedPiece()}</>;
}

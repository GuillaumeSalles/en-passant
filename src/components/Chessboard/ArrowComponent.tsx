import { ArrowKind, Orientation } from "@/lib/AppState";
import { createMemo, Show } from "solid-js";
import { getSquarePosition } from "./utils";
import { getHighlightArrowColor } from "./utils";

const squareHalfWidth = 0.5;
const headLength = 0.3;
type ArrowRenderProps = {
  "data-arrow": string;
  "data-arrow-kind": ArrowKind;
  "data-arrow-preview": string | undefined;
  opacity: string | undefined;
};

export function ArrowHeadMarker(props: { kind: ArrowKind }) {
  return (
    <defs>
      <marker id={`arrowhead-${props.kind}`} refX={0} refY={1.5} orient="auto">
        <polygon points="0,0.4 1.5,1.5 0,2.6" fill={getHighlightArrowColor(props.kind)} />
      </marker>
    </defs>
  );
}

export function ArrowComponent(props: {
  from: string;
  to: string;
  kind: ArrowKind;
  boardOrientation: Orientation;
  isPreview: boolean;
}) {
  const positions = createMemo(() => ({
    from: getSquarePosition(props.from, props.boardOrientation),
    to: getSquarePosition(props.to, props.boardOrientation),
  }));
  const fromPos = () => positions().from;
  const toPos = () => positions().to;

  // Calculate arrow direction and length
  const fileDiff = createMemo(() => Math.abs(toPos().x - fromPos().x));
  const rankDiff = createMemo(() => Math.abs(toPos().y - fromPos().y));

  // Check if this is a knight move (L-shaped)
  const isKnightMove = createMemo(
    () => (fileDiff() === 2 && rankDiff() === 1) || (fileDiff() === 1 && rankDiff() === 2),
  );

  const arrowProps = createMemo(() => ({
    "data-arrow": `${props.from}${props.to}`,
    "data-arrow-kind": props.kind,
    "data-arrow-preview": props.isPreview ? "true" : undefined,
    opacity: props.isPreview ? "0.42" : undefined,
  }));

  return (
    <Show
      when={isKnightMove()}
      fallback={
        <StraightArrow from={fromPos()} to={toPos()} kind={props.kind} arrowProps={arrowProps()} />
      }
    >
      <KnightArrow from={fromPos()} to={toPos()} kind={props.kind} arrowProps={arrowProps()} />
    </Show>
  );
}

const startOffset = 0.2;

function KnightArrow(props: {
  from: { x: number; y: number };
  to: { x: number; y: number };
  kind: ArrowKind;
  arrowProps: ArrowRenderProps;
}) {
  const path = createMemo(() => {
    const dx = props.to.x - props.from.x;
    const dy = props.to.y - props.from.y;

    let startX: number | undefined;
    let startY: number | undefined;
    let endX = props.to.x + squareHalfWidth;
    let endY = props.to.y + squareHalfWidth;

    if (dx === 2) {
      startX = props.from.x + 1 - startOffset;
      startY = props.from.y + squareHalfWidth;
    } else if (dx === -2) {
      startX = props.from.x + startOffset;
      startY = props.from.y + squareHalfWidth;
    } else if (dx === 1) {
      endX -= headLength;
    } else if (dx === -1) {
      endX += headLength;
    }

    if (dy === 2) {
      startX = props.from.x + squareHalfWidth;
      startY = props.from.y + 1 - startOffset;
    } else if (dy === -2) {
      startX = props.from.x + squareHalfWidth;
      startY = props.from.y + startOffset;
    } else if (dy === 1) {
      endY -= headLength;
    } else if (dy === -1) {
      endY += headLength;
    }

    return `M ${startX} ${startY} L ${
      Math.abs(dx) === 2
        ? `${endX} ${startY} L ${endX} ${endY}`
        : `${startX} ${endY} L ${endX} ${endY}`
    }`;
  });

  return (
    <path
      d={path()}
      stroke={getHighlightArrowColor(props.kind)}
      stroke-width="0.2"
      fill="none"
      marker-end={`url(#arrowhead-${props.kind})`}
      data-arrow={props.arrowProps["data-arrow"]}
      data-arrow-kind={props.arrowProps["data-arrow-kind"]}
      data-arrow-preview={props.arrowProps["data-arrow-preview"]}
      opacity={props.arrowProps.opacity}
    />
  );
}

function StraightArrow(props: {
  from: { x: number; y: number };
  to: { x: number; y: number };
  kind: ArrowKind;
  arrowProps: ArrowRenderProps;
}) {
  const line = createMemo(() => {
    const dx = props.to.x - props.from.x;
    const dy = props.to.y - props.from.y;

    const length = Math.sqrt(dx * dx + dy * dy);

    const lineStartDistance = squareHalfWidth - startOffset;
    const lineEndDistance = headLength;

    const normalizedDx = dx / length;
    const normalizedDy = dy / length;

    return {
      x1: squareHalfWidth + props.from.x + normalizedDx * lineStartDistance,
      y1: squareHalfWidth + props.from.y + normalizedDy * lineStartDistance,
      x2: squareHalfWidth + props.to.x - normalizedDx * lineEndDistance,
      y2: squareHalfWidth + props.to.y - normalizedDy * lineEndDistance,
    };
  });

  const x1 = createMemo(() => line().x1);
  const y1 = createMemo(() => line().y1);
  const x2 = createMemo(() => line().x2);
  const y2 = createMemo(() => line().y2);

  return (
    <line
      x1={x1()}
      y1={y1()}
      x2={x2()}
      y2={y2()}
      stroke={getHighlightArrowColor(props.kind)}
      stroke-width="0.2"
      marker-end={`url(#arrowhead-${props.kind})`}
      data-arrow={props.arrowProps["data-arrow"]}
      data-arrow-kind={props.arrowProps["data-arrow-kind"]}
      data-arrow-preview={props.arrowProps["data-arrow-preview"]}
      opacity={props.arrowProps.opacity}
    />
  );
}

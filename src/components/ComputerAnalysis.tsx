import { getPgn, selectMove, selectSelectedMoveId } from "@/lib/AppState";
import type { NormalizedEvalScore } from "@/lib/AppState";
import { EvalBadge } from "./EvalBadge";
import { useMutation } from "@/lib/useMutation";
import { useSelector } from "@/lib/useSelector";
import { Show, createMemo, createSignal } from "solid-js";

const chartWidth = 320;
const chartHeight = 72;

export function ComputerAnalysis() {
  return (
    <div class="px-4 py-3">
      <ComputerAnalysisChart />
    </div>
  );
}

function ComputerAnalysisChart() {
  const onSelectMove = useMutation(selectMove);
  const movesSelector = useSelector((state, ctx) => getPgn(state, ctx)?.moves ?? {});
  const analysisSelector = useSelector((state) => state.analysis);
  const selectedMoveId = useSelector(selectSelectedMoveId);
  const [hoveredIndex, setHoveredIndex] = createSignal<number | null>(null);

  const points = createMemo(() => {
    const analysis = analysisSelector();
    const moves = movesSelector();
    const barWidth = chartWidth / analysis.length;

    return analysis.map((a, i) => {
      const move = moves[a.id];
      const whiteHeight = getWhiteHeightPercent(a.score);
      const x = i * barWidth;
      const centerX = x + barWidth / 2;
      const y = chartHeight - (whiteHeight / 100) * chartHeight;

      return {
        barWidth,
        centerX,
        id: a.id,
        move,
        score: a.score,
        whiteHeight,
        x,
        y,
      };
    });
  });
  const linePath = createMemo(() =>
    points()
      .map((point, index) => `${index === 0 ? "M" : "L"} ${point.centerX} ${point.y}`)
      .join(" "),
  );
  const whiteAreaPath = createMemo(() => {
    const chartPoints = points();
    if (chartPoints.length === 0) return "";

    const first = chartPoints[0];
    const last = chartPoints[chartPoints.length - 1];
    if (first === undefined || last === undefined) return "";

    const boundary = chartPoints.map((point) => `L ${point.centerX} ${point.y}`).join(" ");

    return `M 0 ${first.y} ${boundary} L ${chartWidth} ${last.y} L ${chartWidth} ${chartHeight} L 0 ${chartHeight} Z`;
  });
  const hoveredPoint = createMemo(() => {
    const index = hoveredIndex();
    return index === null ? null : (points()[index] ?? null);
  });
  const selectedPoint = createMemo(
    () => points().find((point) => point.id === selectedMoveId()) ?? null,
  );
  const activePoint = createMemo(() => hoveredPoint() ?? selectedPoint());
  const tooltipStyle = createMemo(() => {
    const point = activePoint();
    if (point === null) return {};

    const xPercent = (point.centerX / chartWidth) * 100;
    const yPercent = (point.y / chartHeight) * 100;

    return {
      left: `${xPercent}%`,
      top: `${yPercent}%`,
      transform: `translate(${xPercent > 75 ? "-100%" : xPercent < 25 ? "0" : "-50%"}, ${
        yPercent > 55 ? "-115%" : "12px"
      })`,
    };
  });
  const updateHoveredPoint = (event: PointerEvent & { currentTarget: SVGSVGElement }) => {
    const count = points().length;
    if (count === 0) return;

    const bounds = event.currentTarget.getBoundingClientRect();
    const x = Math.min(Math.max(event.clientX - bounds.left, 0), bounds.width);
    const index = Math.min(count - 1, Math.max(0, Math.floor((x / bounds.width) * count)));
    setHoveredIndex(index);
  };
  const selectHoveredPoint = () => {
    const point = hoveredPoint();
    if (point?.move === undefined) return;

    onSelectMove(point.move.id);
  };

  return (
    <Show when={analysisSelector().length > 1}>
      <div
        aria-label="Main line evaluation graph"
        class="relative overflow-hidden rounded-sm border border-border bg-background shadow-sm"
      >
        <svg
          viewBox={`0 0 ${chartWidth} ${chartHeight}`}
          preserveAspectRatio="none"
          class="block h-24 w-full cursor-crosshair"
          role="img"
          onClick={selectHoveredPoint}
          onPointerLeave={() => setHoveredIndex(null)}
          onPointerMove={updateHoveredPoint}
        >
          <rect
            x="0"
            y="0"
            width={chartWidth}
            height={chartHeight}
            class="fill-neutral-900 dark:fill-neutral-800"
          />
          <path d={whiteAreaPath()} class="fill-neutral-200 dark:fill-neutral-100" />
          <path
            d={linePath()}
            fill="none"
            class="stroke-neutral-500 dark:stroke-neutral-400"
            stroke-linecap="square"
            stroke-linejoin="miter"
            stroke-width="1.2"
            vector-effect="non-scaling-stroke"
          />
          <Show when={activePoint()}>
            {(point) => (
              <circle
                cx={point().centerX}
                cy={point().y}
                r="3.5"
                class="fill-background stroke-neutral-900 dark:stroke-neutral-100"
                stroke-width="1.5"
                vector-effect="non-scaling-stroke"
              />
            )}
          </Show>
        </svg>
        <Show when={activePoint()}>
          {(point) => (
            <div
              class="pointer-events-none absolute z-10 flex items-center gap-2 rounded-lg border bg-background p-2 text-sm shadow-sm"
              style={tooltipStyle()}
            >
              <span>{point().move?.san}</span>
              <EvalBadge score={point().score} />
            </div>
          )}
        </Show>
      </div>
    </Show>
  );
}

function getWhiteHeightPercent(score: NormalizedEvalScore): number {
  if (score.type === "mate") {
    return score.winner === "white" ? 100 : 0;
  }

  if (score.type === "stalemate") {
    return 50;
  }

  if (score.type === "mate-in") {
    return score.value > 0 ? 100 : 0;
  }

  const scoreInPawns = score.value / 100;
  const percentage = 50 + 50 * (2 / (1 + Math.exp(-0.5 * scoreInPawns)) - 1);
  return Math.min(100, Math.max(0, percentage));
}

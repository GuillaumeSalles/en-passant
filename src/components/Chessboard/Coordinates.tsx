import { Orientation } from "@/lib/AppState";
import { createMemo, For } from "solid-js";
import { darkSquareColor, lightSquareColor } from "./utils";

function range(start: number, end: number): number[] {
  return Array.from({ length: end - start + 1 }, (_, i) => start + i);
}

const fontSize = "0.16";
const offset = 0.04;

export function Coordinates(props: { boardOrientation: Orientation }) {
  const ranks = createMemo(() =>
    range(0, 7).map((rank) => ({
      rank,
      label: props.boardOrientation === "white" ? String(8 - rank) : String(rank + 1),
    })),
  );
  const files = createMemo(() =>
    range(0, 7).map((rank) => ({
      rank,
      label:
        props.boardOrientation === "white"
          ? String.fromCharCode(97 + rank)
          : String.fromCharCode(104 - rank),
    })),
  );

  return (
    <svg
      class="pointer-events-none absolute inset-0 z-[2] h-full w-full"
      viewBox="0 0 8 8"
      preserveAspectRatio="none"
    >
      <For each={ranks()}>
        {(item) => (
          <text
            x={offset}
            y={offset + item.rank}
            text-anchor="start"
            alignment-baseline="hanging"
            font-size={fontSize}
            font-weight="600"
            fill={item.rank % 2 === 0 ? darkSquareColor : lightSquareColor}
          >
            {item.label}
          </text>
        )}
      </For>
      <For each={files()}>
        {(item) => (
          <text
            x={1 - offset + item.rank}
            y={8 - offset}
            text-anchor="end"
            alignment-baseline="baseline"
            font-size={fontSize}
            font-weight="600"
            fill={item.rank % 2 === 0 ? lightSquareColor : darkSquareColor}
          >
            {item.label}
          </text>
        )}
      </For>
    </svg>
  );
}

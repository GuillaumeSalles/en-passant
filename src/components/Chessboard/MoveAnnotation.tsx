import { Orientation } from "@/lib/AppState";
import { createMemo, Show } from "solid-js";
import { getSquarePosition } from "./utils";

const size = 4;

export type MoveAnnotationData =
  | { type: "wrongMove" }
  | { type: "nag"; glyph: string; meaning: string };

function nagClass(glyph: string): string {
  switch (glyph) {
    case "!":
      return "bg-green-500";
    case "?":
      return "bg-yellow-500";
    case "!!":
      return "bg-blue-500";
    case "??":
      return "bg-red-500";
    case "!?":
      return "bg-teal-500";
    case "?!":
      return "bg-pink-500";
    default:
      return "bg-[oklch(64%_0.15_80)]";
  }
}

export function MoveAnnotation(props: {
  square: string;
  annotation: MoveAnnotationData;
  index: number;
  boardOrientation: Orientation;
}) {
  const position = createMemo(() => getSquarePosition(props.square, props.boardOrientation));
  const nagFontSize = createMemo(() => {
    if (props.annotation.type !== "nag") {
      return undefined;
    }

    return props.annotation.glyph.length > 1 ? "2.2cqw" : "2.8cqw";
  });
  const annotationClass = createMemo(() => {
    if (props.annotation.type !== "nag") {
      return "bg-[oklch(63.7%_0.237_25.331)]";
    }

    return `font-extrabold leading-none text-white ${nagClass(props.annotation.glyph)}`;
  });

  return (
    <div
      class={[
        "absolute z-[4] flex items-center justify-center rounded-full shadow-md ring-1 ring-white/35",
        annotationClass(),
      ].join(" ")}
      data-annotation={props.annotation.type}
      data-annotation-square={props.square}
      data-annotation-index={props.index}
      data-annotation-meaning={
        props.annotation.type === "nag" ? props.annotation.meaning : undefined
      }
      title={props.annotation.type === "nag" ? props.annotation.meaning : undefined}
      aria-label={props.annotation.type === "nag" ? props.annotation.meaning : undefined}
      style={{
        left: `${position().x * 12.5 + 12.5 - size * (0.75 + props.index * 1.1)}%`,
        top: `${position().y * 12.5 - size * 0.25}%`,
        width: `${size}%`,
        height: `${size}%`,
        "font-size": nagFontSize(),
      }}
    >
      <Show
        when={props.annotation.type === "nag"}
        fallback={<div class="h-[10%] w-[60%] bg-white" />}
      >
        {props.annotation.type === "nag" ? props.annotation.glyph : null}
      </Show>
    </div>
  );
}

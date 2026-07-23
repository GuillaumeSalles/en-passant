import { createSignal, onCleanup } from "solid-js";
import styles from "./HorizontalResizeHandle.module.css";

export function HorizontalResizeHandle(props: { onResize: (delta: number) => void }) {
  const [isDragging, setIsDragging] = createSignal(false);
  let lastClientY = 0;
  let previousCursor = "";
  let previousUserSelect = "";

  function finishDragging() {
    if (!isDragging()) return;

    setIsDragging(false);
    document.body.style.cursor = previousCursor;
    document.body.style.userSelect = previousUserSelect;
  }

  onCleanup(finishDragging);

  return (
    <div
      role="separator"
      aria-label="Resize moves and your games panels"
      aria-orientation="horizontal"
      aria-valuetext="Use Up and Down arrow keys or drag to resize"
      tabindex="0"
      class={styles["HorizontalResizeHandle"]}
      data-dragging={isDragging() ? "true" : undefined}
      onPointerDown={(event) => {
        if (event.button !== 0) return;

        lastClientY = event.clientY;
        previousCursor = document.body.style.cursor;
        previousUserSelect = document.body.style.userSelect;
        document.body.style.cursor = "row-resize";
        document.body.style.userSelect = "none";
        event.currentTarget.setPointerCapture(event.pointerId);
        setIsDragging(true);
        event.preventDefault();
      }}
      onPointerMove={(event) => {
        if (!isDragging()) return;

        const delta = lastClientY - event.clientY;
        lastClientY = event.clientY;
        props.onResize(delta);
      }}
      onPointerUp={finishDragging}
      onLostPointerCapture={finishDragging}
      onKeyDown={(event) => {
        event.stopPropagation();
        if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return;

        props.onResize(event.key === "ArrowUp" ? 24 : -24);
        event.preventDefault();
      }}
    >
      <span class={styles["Line"]} aria-hidden="true" data-resize-line />
    </div>
  );
}

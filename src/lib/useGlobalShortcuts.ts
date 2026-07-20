import { onSettled } from "solid-js";
import {
  back,
  forward,
  arrowUp,
  arrowDown,
  spacebar,
  flipBoard,
  setNagOnSelectedMove,
} from "./AppState";
import { dispatchCommentShortcut } from "./commentShortcutEvents";
import { useMutation } from "./useMutation";

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  return (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target.isContentEditable
  );
}

export function useGlobalShortcuts(options: { allowEditing: boolean } = { allowEditing: true }) {
  const allowEditing = options.allowEditing;
  const onBack = useMutation(back);
  const onForward = useMutation(forward);
  const onArrowUp = useMutation(arrowUp);
  const onArrowDown = useMutation(arrowDown);
  const onSpacebar = useMutation(spacebar);
  const onFlipBoard = useMutation(flipBoard);
  const onSetNagOnSelectedMove = useMutation(setNagOnSelectedMove);

  const onKeyDown = (e: KeyboardEvent) => {
    if (isEditableTarget(e.target)) {
      return;
    }

    const key = e.key.toLowerCase();

    if (e.key === "ArrowLeft") {
      onBack();
    } else if (e.key === "ArrowRight") {
      onForward();
    } else if (e.key === "ArrowUp") {
      onArrowUp();
    } else if (e.key === "ArrowDown") {
      onArrowDown();
    } else if (e.key === " ") {
      onSpacebar();
    } else if (key === "f") {
      onFlipBoard();
    } else if (allowEditing && !e.altKey && !e.ctrlKey && !e.metaKey && /^[1-9]$/.test(e.key)) {
      e.preventDefault();
      onSetNagOnSelectedMove(Number(e.key));
    } else if (allowEditing && key === "c") {
      e.preventDefault();
      dispatchCommentShortcut(e.shiftKey ? "before" : "after");
    }
  };

  onSettled(() => {
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  });
}

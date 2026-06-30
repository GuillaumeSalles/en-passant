const commentShortcutEventName = "en-passant:comment-shortcut";

export type CommentPlacement = "before" | "after";

type CommentShortcutDetail = {
  placement: CommentPlacement;
};

export function dispatchCommentShortcut(placement: CommentPlacement): void {
  document.dispatchEvent(
    new CustomEvent<CommentShortcutDetail>(commentShortcutEventName, {
      detail: { placement },
    }),
  );
}

export function addCommentShortcutListener(
  listener: (placement: CommentPlacement) => void,
): () => void {
  const onShortcut = (event: Event) => {
    if (!(event instanceof CustomEvent)) {
      return;
    }

    const detail = event.detail as CommentShortcutDetail;
    if (detail.placement !== "before" && detail.placement !== "after") {
      return;
    }

    listener(detail.placement);
  };

  document.addEventListener(commentShortcutEventName, onShortcut);
  return () => document.removeEventListener(commentShortcutEventName, onShortcut);
}

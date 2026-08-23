import { selectOrientation } from "@/lib/AppState";
import { STARTING_FEN } from "@/lib/chess";
import { useSelector } from "@/lib/useSelector";
import type { JSX } from "@solidjs/web";
import { createContext, createSignal, onCleanup, Show, useContext } from "solid-js";
import { ReadonlyChessboard } from "./Chessboard/ReadonlyChessboard";

const HOVER_DELAY_MS = 250;
const WARM_PREVIEW_MS = 300;

type PositionPreviewEvents = {
  onPointerEnter: (key: string, position: () => string, event: PointerEvent) => void;
  onPointerLeave: () => void;
};

const PositionPreviewContext = createContext<PositionPreviewEvents>({
  onPointerEnter: () => {},
  onPointerLeave: () => {},
});

export function usePositionPreview(): PositionPreviewEvents {
  return useContext(PositionPreviewContext);
}

export function PositionPreviewBoundary(props: { children: JSX.Element }) {
  const positionPreview = usePositionPreview();
  onCleanup(positionPreview.onPointerLeave);

  return (
    <div
      data-evaluation-lines
      class="flex flex-col"
      onPointerLeave={positionPreview.onPointerLeave}
    >
      {props.children}
    </div>
  );
}

export function PositionPreviewProvider(props: { children: JSX.Element }) {
  const [previewKey, setPreviewKey] = createSignal<string | null>(null);
  const [position, setPosition] = createSignal<{ read: () => string }>({
    read: () => STARTING_FEN,
  });
  const [mounted, setMounted] = createSignal(false);
  const [visible, setVisible] = createSignal(false);
  const [warm, setWarm] = createSignal(false);
  let hoveredKey: string | null = null;
  let showTimer: number | undefined;
  let coolTimer: number | undefined;

  const orientation = useSelector(selectOrientation);

  function clearShowTimer() {
    if (showTimer === undefined) return;
    window.clearTimeout(showTimer);
    showTimer = undefined;
  }

  function clearCoolTimer() {
    if (coolTimer === undefined) return;
    window.clearTimeout(coolTimer);
    coolTimer = undefined;
  }

  function showPreview(key: string) {
    if (hoveredKey !== key) return;
    setMounted(true);
    setVisible(true);
    setWarm(true);
  }

  const events: PositionPreviewEvents = {
    onPointerEnter: (enteredKey, enteredPosition, event) => {
      if (event.pointerType === "touch") return;

      hoveredKey = enteredKey;
      setPreviewKey(enteredKey);
      setPosition({ read: enteredPosition });
      clearShowTimer();
      clearCoolTimer();

      if (warm()) {
        showPreview(enteredKey);
        return;
      }

      showTimer = window.setTimeout(() => showPreview(enteredKey), HOVER_DELAY_MS);
    },
    onPointerLeave: () => {
      hoveredKey = null;
      clearShowTimer();
      setVisible(false);
      clearCoolTimer();
      coolTimer = window.setTimeout(() => setWarm(false), WARM_PREVIEW_MS);
    },
  };

  onCleanup(() => {
    clearShowTimer();
    clearCoolTimer();
  });

  return (
    <PositionPreviewContext value={events}>
      <div class="relative">
        {props.children}
        <Show when={mounted()}>
          <div
            data-position-preview
            data-preview-key={previewKey() ?? undefined}
            data-visible={visible() ? "true" : "false"}
            aria-hidden="true"
            class="pointer-events-none absolute left-1/2 top-[calc(100%+8px)] z-[100] h-[300px] w-[300px] -translate-x-1/2 overflow-hidden rounded-sm bg-background shadow-2xl ring-1 ring-black/20 [contain:strict]"
            style={{ visibility: visible() ? "visible" : "hidden" }}
          >
            <ReadonlyChessboard orientation={orientation()} position={position().read()} />
          </div>
        </Show>
      </div>
    </PositionPreviewContext>
  );
}

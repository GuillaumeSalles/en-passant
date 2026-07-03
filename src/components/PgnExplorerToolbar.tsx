import { ArrowLeft, ArrowLeftToLine, ArrowRight, ArrowRightToLine, Repeat2 } from "./Icons";
import { HorizontalDashedDivider } from "./ui/HorizontalDashedDivider";
import { TooltipIconButton } from "./ui/tooltip-icon-button";
import { useMutation } from "@/lib/useMutation";
import {
  back,
  flipBoard,
  forward,
  getPgn,
  moveToLastMainLineMove,
  moveToStart,
  selectNextMoveIds,
  selectSelectedMoveId,
} from "@/lib/AppState";
import { useSelector } from "@/lib/useSelector";

export function PgnExplorerToolbar() {
  const onFlipBoard = useMutation(flipBoard);
  const onMoveToStart = useMutation(moveToStart);
  const onMoveBack = useMutation(back);
  const onMoveForward = useMutation(forward);
  const onMoveToLastMainLineMove = useMutation(moveToLastMainLineMove);
  const canMoveToStart = useSelector((state, ctx) => selectSelectedMoveId(state, ctx) !== null);
  const canMoveBack = useSelector((state, ctx) => selectSelectedMoveId(state, ctx) !== null);
  const canMoveForward = useSelector((state, ctx) => selectNextMoveIds(state, ctx).length > 0);
  const canMoveToLastMainLineMove = useSelector((state, ctx) => {
    const pgn = getPgn(state, ctx);
    if (pgn === null) return null;
    if (pgn.rootMoveIds.length === 0) return null;
    const rootMoveId = pgn.rootMoveIds[0];
    if (rootMoveId === undefined) return null;

    let id = rootMoveId;
    while (true) {
      const move = pgn.moves[id];
      const nextId = move?.next[0];
      if (nextId === undefined) break;
      id = nextId;
    }
    return id !== selectSelectedMoveId(state, ctx);
  });

  return (
    <>
      <HorizontalDashedDivider
        animationKey="pgn-explorer-toolbar-top"
        direction="right-to-left"
      />
      <div class="flex w-full px-2 py-2">
        <div class="flex gap-2">
          <TooltipIconButton
            aria-label="Flip board"
            icon={<Repeat2 />}
            tooltip="Flip board (F)"
            onClick={onFlipBoard}
          />
          <TooltipIconButton
            aria-label="Move to start"
            icon={<ArrowLeftToLine />}
            tooltip="Move to start (↑)"
            disabled={!canMoveToStart()}
            onClick={onMoveToStart}
          />
          <TooltipIconButton
            aria-label="Previous move"
            icon={<ArrowLeft />}
            tooltip="Previous move (←)"
            onClick={() => onMoveBack()}
            disabled={!canMoveBack()}
          />
          <TooltipIconButton
            aria-label="Next move"
            icon={<ArrowRight />}
            tooltip="Next move (→)"
            onClick={() => onMoveForward()}
            disabled={!canMoveForward()}
          />
          <TooltipIconButton
            aria-label="Move to last main line move"
            icon={<ArrowRightToLine />}
            tooltip="Move to last main line move (↓)"
            onClick={onMoveToLastMainLineMove}
            disabled={!canMoveToLastMainLineMove()}
          />
        </div>
      </div>
    </>
  );
}

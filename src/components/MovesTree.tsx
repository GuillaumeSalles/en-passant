import {
  deleteMove,
  getNagGlyph,
  getNagMeaning,
  getPgn,
  moveVariationDown,
  moveVariationUp,
  promoteVariation,
  selectPreselectedVariation,
  selectMove,
  selectMoveById,
  selectSelectedMoveId,
  updateMoveCommentAfter,
  updateMoveCommentBefore,
} from "@/lib/AppState";
import { SIDE_PANEL_BREAKPOINT } from "@/lib/layoutBreakpoints";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "./ui/context-menu";
import { InlineEditInput } from "./ui/inline-edit-input";
import { cn } from "@/lib/utils";
import { addCommentShortcutListener, CommentPlacement } from "@/lib/commentShortcutEvents";
import {
  buildMoveRows,
  type CommentEditorRequest,
  type MainMovesRowData,
  type MoveTokenData,
  type VariationRowData,
} from "@/lib/app-state/moveRows";
import { useMutation } from "@/lib/useMutation";
import { useSelector } from "@/lib/useSelector";
import {
  createEffect,
  createMemo,
  createSignal,
  For,
  Match,
  onCleanup,
  Show,
  Switch,
} from "solid-js";

function isMoveListBesideBoard() {
  return window.matchMedia(`(min-width: ${SIDE_PANEL_BREAKPOINT})`).matches;
}

export function MovesTree() {
  const moves = useSelector((state, ctx) => getPgn(state, ctx)?.moves ?? {});
  const selectedMove = useSelector(selectSelectedMoveId);
  const preselectedVariation = useSelector(selectPreselectedVariation);
  const [commentEditorRequest, setCommentEditorRequest] = createSignal<CommentEditorRequest | null>(
    null,
  );
  const rootMoveIds = useSelector((state, ctx) => getPgn(state, ctx)?.rootMoveIds ?? []);
  const highlightedMove = () => preselectedVariation() ?? selectedMove();
  const moveRows = createMemo(() => buildMoveRows(moves(), rootMoveIds(), commentEditorRequest()));

  function requestComment(moveId: number, placement: CommentPlacement) {
    setCommentEditorRequest((request) => ({
      moveId,
      placement,
      version: (request?.version ?? 0) + 1,
    }));
  }

  const removeCommentShortcutListener = addCommentShortcutListener((placement) => {
    const moveId = selectedMove();
    if (moveId !== null) {
      requestComment(moveId, placement);
    }
  });
  onCleanup(removeCommentShortcutListener);

  return (
    <div
      data-moves-tree
      class="w-xs flex min-h-0 flex-1 flex-col overflow-y-auto px-4 py-2 text-xs"
    >
      <For each={moveRows()}>
        {(row) => (
          <Switch>
            <Match when={row.type === "main" && row}>
              {(mainRow) => (
                <MainMovesRow
                  row={mainRow()}
                  selectedMoveId={highlightedMove()}
                  onComment={requestComment}
                  onCommentEditDone={() => setCommentEditorRequest(null)}
                />
              )}
            </Match>
            <Match when={row.type === "variation" && row}>
              {(variationRow) => (
                <VariationMovesRow
                  row={variationRow()}
                  selectedMoveId={highlightedMove()}
                  onComment={requestComment}
                  onCommentEditDone={() => setCommentEditorRequest(null)}
                />
              )}
            </Match>
          </Switch>
        )}
      </For>
    </div>
  );
}

function TripleDots() {
  return <div class="w-14 text-left">...</div>;
}

function CommentAfter(props: {
  comment: string;
  editRequestVersion: number | null;
  moveId: number;
  placement: CommentPlacement;
  onEditDone: () => void;
}) {
  const onSelectMove = useMutation(selectMove);
  const onUpdateMoveCommentAfter = useMutation(updateMoveCommentAfter);
  const onUpdateMoveCommentBefore = useMutation(updateMoveCommentBefore);
  const [isEditing, setIsEditing] = createSignal(false);
  const [draft, setDraft] = createSignal("");
  let committedComment = "";
  let editingActive = false;
  let handledEditRequestVersion: number | null = null;

  createEffect(
    () => ({
      comment: props.comment,
      editRequestVersion: props.editRequestVersion,
    }),
    ({ comment, editRequestVersion }) => {
      if (editRequestVersion === null || editRequestVersion === handledEditRequestVersion) {
        return;
      }

      handledEditRequestVersion = editRequestVersion;
      startEditing(comment);
    },
  );

  function commit() {
    if (!editingActive) {
      return;
    }

    editingActive = false;
    const nextComment = draft();
    const previousComment = committedComment;
    const moveId = props.moveId;
    const placement = props.placement;
    setIsEditing(false);
    if (nextComment !== previousComment) {
      if (placement === "before") {
        onUpdateMoveCommentBefore(moveId, nextComment);
      } else {
        onUpdateMoveCommentAfter(moveId, nextComment);
      }
    }
    props.onEditDone();
  }

  function cancel() {
    if (!editingActive) {
      return;
    }

    editingActive = false;
    setDraft(committedComment);
    setIsEditing(false);
    props.onEditDone();
  }

  function startEditing(comment: string) {
    editingActive = true;
    committedComment = comment;
    setDraft(comment);
    setIsEditing(true);
  }

  return (
    <Show
      when={isEditing()}
      fallback={
        <div
          class="cursor-text text-blue-300"
          onClick={() => onSelectMove(props.moveId)}
          onDblClick={() => startEditing(props.comment)}
        >
          {props.comment}
        </div>
      }
    >
      <InlineEditInput
        aria-label="Move comment"
        class="text-blue-300"
        value={draft()}
        onValueInput={setDraft}
        onCommit={commit}
        onCancel={cancel}
      />
    </Show>
  );
}

function MoveSlot(props: {
  move: MoveTokenData | "dots" | undefined;
  selectedMoveId: number | null;
  onComment: (moveId: number, placement: CommentPlacement) => void;
}) {
  return (
    <Switch>
      <Match when={props.move === "dots"}>
        <TripleDots />
      </Match>
      <Match when={props.move !== "dots" && props.move}>
        {(move) => (
          <MoveComponent
            moveId={move().moveId}
            isSelected={() => move().moveId === props.selectedMoveId}
            class={move().class}
            canPromoteVariation={move().canPromoteVariation}
            canMoveVariationUp={move().canMoveVariationUp}
            canMoveVariationDown={move().canMoveVariationDown}
            onComment={props.onComment}
          />
        )}
      </Match>
    </Switch>
  );
}

function MainMovesRow(props: {
  row: MainMovesRowData;
  selectedMoveId: number | null;
  onComment: (moveId: number, placement: CommentPlacement) => void;
  onCommentEditDone: () => void;
}) {
  return (
    <>
      <Show when={props.row.commentBefore}>
        {(commentBefore) => (
          <div class="flex flex-row gap-2 py-1">
            <CommentAfter
              moveId={commentBefore().moveId}
              comment={commentBefore().comment}
              placement={commentBefore().placement}
              editRequestVersion={commentBefore().editRequestVersion}
              onEditDone={props.onCommentEditDone}
            />
          </div>
        )}
      </Show>
      <div class="flex flex-row gap-2 py-1">
        <div class="w-4 text-center text-muted-foreground">{props.row.index}</div>
        <MoveSlot
          move={props.row.whiteMove}
          selectedMoveId={props.selectedMoveId}
          onComment={props.onComment}
        />
        <MoveSlot
          move={props.row.blackMove}
          selectedMoveId={props.selectedMoveId}
          onComment={props.onComment}
        />
      </div>
      <Show when={props.row.commentAfter}>
        {(commentAfter) => (
          <div class="flex flex-row gap-2 py-1">
            <CommentAfter
              moveId={commentAfter().moveId}
              comment={commentAfter().comment}
              placement={commentAfter().placement}
              editRequestVersion={commentAfter().editRequestVersion}
              onEditDone={props.onCommentEditDone}
            />
          </div>
        )}
      </Show>
    </>
  );
}

function VariationMovesRow(props: {
  row: VariationRowData;
  selectedMoveId: number | null;
  onComment: (moveId: number, placement: CommentPlacement) => void;
  onCommentEditDone: () => void;
}) {
  return (
    <div class="flex flex-row gap-2">
      <div class="flex flex-row gap-4 pl-2">
        <For each={Array.from({ length: props.row.indent })}>
          {(_, index) => (
            <div
              class={cn("shrink-0 bg-border w-[1px]", index() === props.row.indent - 1 && "my-1")}
            />
          )}
        </For>
      </div>
      <div class="flex flex-row flex-wrap gap-2 py-1">
        <For each={props.row.items}>
          {(item) => (
            <Switch>
              <Match when={item.type === "move-number" && item}>
                {(moveNumber) => (
                  <div class="w-4 text-center text-muted-foreground">
                    {moveNumber().moveNumber}
                    {moveNumber().isWhite ? "." : "..."}
                  </div>
                )}
              </Match>
              <Match when={item.type === "move" && item}>
                {(moveItem) => (
                  <MoveComponent
                    moveId={moveItem().move.moveId}
                    isSelected={() => moveItem().move.moveId === props.selectedMoveId}
                    canPromoteVariation={moveItem().move.canPromoteVariation}
                    canMoveVariationUp={moveItem().move.canMoveVariationUp}
                    canMoveVariationDown={moveItem().move.canMoveVariationDown}
                    onComment={props.onComment}
                  />
                )}
              </Match>
              <Match when={item.type === "comment" && item}>
                {(commentItem) => (
                  <CommentAfter
                    moveId={commentItem().comment.moveId}
                    comment={commentItem().comment.comment}
                    placement={commentItem().comment.placement}
                    editRequestVersion={commentItem().comment.editRequestVersion}
                    onEditDone={props.onCommentEditDone}
                  />
                )}
              </Match>
            </Switch>
          )}
        </For>
      </div>
    </div>
  );
}

function MoveComponent(props: {
  moveId: number;
  isSelected: () => boolean;
  class?: string | undefined;
  canPromoteVariation: boolean;
  canMoveVariationUp: boolean;
  canMoveVariationDown: boolean;
  onComment: (moveId: number, placement: CommentPlacement) => void;
}) {
  const canEditMoves = useSelector((_state, ctx) => ctx.type === "repertoire-builder");
  const move = useSelector((state, ctx) => selectMoveById(state, ctx, props.moveId));
  const isSelected = createMemo(() => props.isSelected());

  const onMoveVariationUp = useMutation(moveVariationUp);
  const onMoveVariationDown = useMutation(moveVariationDown);
  const onPromoteVariation = useMutation(promoteVariation);
  const onDeleteMove = useMutation(deleteMove);
  const onSelectMove = useMutation(selectMove);
  const onUpdateMoveCommentAfter = useMutation(updateMoveCommentAfter);
  const onUpdateMoveCommentBefore = useMutation(updateMoveCommentBefore);
  let moveRef: HTMLDivElement | undefined;

  createEffect(
    () => isSelected(),
    (selected) => {
      if (selected && isMoveListBesideBoard()) {
        moveRef?.scrollIntoView({ block: "nearest" });
      }
    },
  );

  return (
    <ContextMenu>
      <ContextMenuTrigger
        disabled={!canEditMoves()}
        onContextMenu={() => onSelectMove(props.moveId)}
      >
        <div
          role="button"
          aria-label={`Move ${move()?.san ?? props.moveId}`}
          data-move-id={props.moveId}
          data-san={move()?.san}
          data-selected={isSelected() ? "true" : undefined}
          aria-current={isSelected() ? "true" : undefined}
          class={cn(
            "inline-flex cursor-pointer items-baseline gap-0.5 hover:text-blue-500",
            isSelected() ? "text-blue-500" : "",
            props.class,
          )}
          onClick={() => onSelectMove(props.moveId)}
          ref={(el) => {
            moveRef = el;
          }}
        >
          <span>{move()?.san}</span>
          <For each={move()?.nags ?? []}>
            {(nag) => (
              <span
                data-nag={nag}
                data-nag-meaning={getNagMeaning(nag)}
                title={getNagMeaning(nag)}
                class="font-semibold text-amber-500"
              >
                {getNagGlyph(nag)}
              </span>
            )}
          </For>
        </div>
      </ContextMenuTrigger>
      <ContextMenuContent class="w-48">
        <Show
          when={move()?.commentBefore != null}
          fallback={
            <ContextMenuItem
              class="text-xs"
              onClick={() => props.onComment(props.moveId, "before")}
            >
              Comment before
            </ContextMenuItem>
          }
        >
          <ContextMenuItem
            class="text-xs"
            onClick={() => onUpdateMoveCommentBefore(props.moveId, "")}
          >
            Delete comment before
          </ContextMenuItem>
        </Show>
        <Show
          when={move()?.commentAfter != null}
          fallback={
            <ContextMenuItem class="text-xs" onClick={() => props.onComment(props.moveId, "after")}>
              Comment after
            </ContextMenuItem>
          }
        >
          <ContextMenuItem
            class="text-xs"
            onClick={() => onUpdateMoveCommentAfter(props.moveId, "")}
          >
            Delete comment after
          </ContextMenuItem>
        </Show>
        <ContextMenuItem class="text-xs" onClick={() => onDeleteMove(props.moveId)}>
          Delete move
        </ContextMenuItem>
        <Show when={props.canPromoteVariation}>
          <ContextMenuItem class="text-xs" onClick={() => onPromoteVariation(props.moveId)}>
            Promote variation
          </ContextMenuItem>
        </Show>
        <Show when={props.canMoveVariationUp}>
          <ContextMenuItem class="text-xs" onClick={() => onMoveVariationUp(props.moveId)}>
            Move variation up
          </ContextMenuItem>
        </Show>
        <Show when={props.canMoveVariationDown}>
          <ContextMenuItem class="text-xs" onClick={() => onMoveVariationDown(props.moveId)}>
            Move variation down
          </ContextMenuItem>
        </Show>
      </ContextMenuContent>
    </ContextMenu>
  );
}

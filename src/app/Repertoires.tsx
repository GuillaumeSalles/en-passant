import type { JSX } from "@solidjs/web";
import { createMemo, createSignal, For, Show, untrack } from "solid-js";
import { Button } from "@/components/ui/button";
import { useState } from "@/app/AppStateProvider";
import { Chapter, Orientation, Repertoire } from "@/lib/AppState";
import { useLoadRepertoiresAndChapters } from "@/lib/useLoadRepertoiresAndChapters";
import { useSelector } from "@/lib/useSelector";
import { cn } from "@/lib/utils";
import { handleFromName, uniqueHandle } from "@/lib/handles";
import { Book, ChessPawn, Ellipsis, Plus } from "../components/Icons";
import { A, useLocation } from "@solidjs/router";
import { MutationContext, useMutation } from "@/lib/useMutation";
import {
  deleteChapter as deleteChapterFromStorage,
  deleteRepertoire as deleteRepertoireFromStorage,
  updateChapter as updateChapterInStorage,
  updateRepertoire as updateRepertoireInStorage,
} from "@/storage";
import { queueRepertoireSync } from "@/storage/backendSync";
import { DropdownMenuContent, DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { DropdownMenu, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { InlineEditInput } from "@/components/ui/inline-edit-input";
import { createNewRepertoire, CreateNewRepertoireInput } from "@/mutations/createNewRepertoire";
import { createNewChapter } from "@/mutations/createNewChapter";
import { APP_ROOT, repertoireOverviewPath, repertoirePath, routePath } from "@/lib/routes";
import { formatRepertoireName, MAX_REPERTOIRE_NAME_LENGTH } from "@/lib/repertoireNames";
import { LoadPGNDialog } from "@/components/LoadPgnDialog";
import { exportChapterPgn } from "@/lib/exportPgn";
import { MAX_CHAPTERS_PER_REPERTOIRE, MAX_REPERTOIRES } from "@/lib/repertoireLimits";

function compareByNameThenId<T extends { name: string }>(
  [leftId, left]: [string, T],
  [rightId, right]: [string, T],
): number {
  const byName = left.name.localeCompare(right.name, undefined, {
    numeric: true,
    sensitivity: "base",
  });
  return byName === 0 ? leftId.localeCompare(rightId) : byName;
}

function getRenamedRepertoireHandle(
  repertoires: Record<string, Repertoire>,
  repertoireId: string,
  name: string,
): string {
  const baseHandle = handleFromName(name, "untitled-repertoire");
  const existingHandles = Object.values(repertoires)
    .filter((repertoire) => repertoire.id !== repertoireId)
    .map((repertoire) => repertoire.handle);

  return uniqueHandle(baseHandle, existingHandles);
}

function getRenamedChapterHandle(
  chapters: Record<string, Chapter>,
  chapterId: string,
  repertoireId: string,
  name: string,
): string {
  const baseHandle = handleFromName(name, "chapter");
  const existingHandles = Object.values(chapters)
    .filter((chapter) => chapter.id !== chapterId && chapter.repertoireId === repertoireId)
    .map((chapter) => chapter.handle);

  return uniqueHandle(baseHandle, existingHandles);
}

export async function deleteChapter(
  { store, router, route }: MutationContext,
  { chapterId }: { chapterId: string; pgnId: string },
): Promise<void> {
  const state = store.state;

  if (state.repertoires.status !== "success" || state.chapters.status !== "success") {
    throw new Error("Repertoires are not loaded");
  }

  const { [chapterId]: chapterToDelete, ...newChapters } = {
    ...state.chapters.data,
  };
  if (chapterToDelete === undefined) {
    return;
  }

  const repertoire = state.repertoires.data[chapterToDelete.repertoireId];
  const hasRemainingChapter = Object.values(newChapters).some(
    (chapter) => chapter.repertoireId === chapterToDelete.repertoireId,
  );
  if (repertoire !== undefined && !hasRemainingChapter) {
    return;
  }

  const newPgns = { ...state.pgns };
  delete newPgns[chapterToDelete.pgnId];

  if (repertoire === undefined) {
    state.set("chapters", { status: "success", data: newChapters });
    state.set("pgns", newPgns);
    await deleteChapterFromStorage(chapterId, chapterToDelete.pgnId);
    queueRepertoireSync();
    return;
  }

  state.set("chapters", { status: "success", data: newChapters });
  state.set("pgns", newPgns);

  if (
    route.chapterHandle === chapterToDelete.handle &&
    repertoire.handle === route.repertoireHandle
  ) {
    router.push(APP_ROOT);
  }

  await deleteChapterFromStorage(chapterId, chapterToDelete.pgnId);
  queueRepertoireSync();
}

async function deleteRepertoire(
  { store, route, router }: MutationContext,
  { repertoireId }: { repertoireId: string },
): Promise<void> {
  const state = store.state;

  if (state.repertoires.status !== "success" || state.chapters.status !== "success") {
    throw new Error("Repertoires are not loaded");
  }

  if (Object.keys(state.repertoires.data).length <= 1) {
    return;
  }

  const { [repertoireId]: repertoireToDelete, ...newRepertoires } = {
    ...state.repertoires.data,
  };

  const chaptersAndPgnsToDelete: { chapterId: string; pgnId: string }[] = [];

  const newChapters = { ...state.chapters.data };
  const newPgns = { ...state.pgns };
  for (const chapterId in newChapters) {
    const chapter = newChapters[chapterId];
    if (chapter !== undefined && chapter.repertoireId === repertoireId) {
      const pgnId = chapter.pgnId;
      chaptersAndPgnsToDelete.push({ chapterId, pgnId });
      delete newPgns[pgnId];
      delete newChapters[chapterId];
    }
  }

  state.set("repertoires", { status: "success", data: newRepertoires });
  state.set("chapters", { status: "success", data: newChapters });
  state.set("pgns", newPgns);

  if (repertoireToDelete === undefined) {
    throw new Error(`Repertoire ${repertoireId} does not exist`);
  }

  if (route.repertoireHandle === repertoireToDelete.handle) {
    router.push(APP_ROOT);
  }

  await Promise.all([
    deleteRepertoireFromStorage(repertoireId),
    ...chaptersAndPgnsToDelete.map(({ chapterId, pgnId }) =>
      deleteChapterFromStorage(chapterId, pgnId),
    ),
  ]);
  queueRepertoireSync();
}

async function renameRepertoire(
  { store, route, router }: MutationContext,
  { repertoireId, name }: { repertoireId: string; name: string },
): Promise<void> {
  const state = store.state;

  if (state.repertoires.status !== "success") {
    throw new Error("Repertoires are not loaded");
  }

  const repertoire = state.repertoires.data[repertoireId];
  if (repertoire === undefined) {
    throw new Error(`Repertoire ${repertoireId} does not exist`);
  }

  const handle = getRenamedRepertoireHandle(state.repertoires.data, repertoireId, name);
  const renamedRepertoire: Repertoire = { ...repertoire, handle, name };

  state.set("repertoires", {
    status: "success",
    data: { ...state.repertoires.data, [repertoireId]: renamedRepertoire },
  });

  if (route.repertoireHandle === repertoire.handle) {
    router.push(routePath(route, handle, route.chapterHandle));
  }

  await updateRepertoireInStorage(renamedRepertoire);
  queueRepertoireSync();
}

async function renameChapter(
  { store, route, router }: MutationContext,
  { chapterId, name }: { chapterId: string; name: string },
): Promise<void> {
  const state = store.state;

  if (state.repertoires.status !== "success" || state.chapters.status !== "success") {
    throw new Error("Repertoires are not loaded");
  }

  const chapter = state.chapters.data[chapterId];
  if (chapter === undefined) {
    throw new Error(`Chapter ${chapterId} does not exist`);
  }

  const repertoire = state.repertoires.data[chapter.repertoireId];
  if (repertoire === undefined) {
    throw new Error(`Repertoire ${chapter.repertoireId} does not exist`);
  }

  const handle = getRenamedChapterHandle(
    state.chapters.data,
    chapterId,
    chapter.repertoireId,
    name,
  );
  const renamedChapter: Chapter = { ...chapter, handle, name };

  state.set("chapters", {
    status: "success",
    data: { ...state.chapters.data, [chapterId]: renamedChapter },
  });

  if (route.repertoireHandle === repertoire.handle && route.chapterHandle === chapter.handle) {
    router.push(routePath(route, repertoire.handle, handle));
  }

  await updateChapterInStorage(renamedChapter);
  queueRepertoireSync();
}

export function Repertoires() {
  const state = useState();
  const onCreateNewRepertoire = useMutation(createNewRepertoire, { context: true });
  const onDeleteChapter = useMutation(deleteChapter, { context: true });
  const onDeleteRepertoire = useMutation(deleteRepertoire, { context: true });
  const onCreateNewChapter = useMutation(createNewChapter, { context: true });
  const onRenameRepertoire = useMutation(renameRepertoire, { context: true });
  const onRenameChapter = useMutation(renameChapter, { context: true });

  useLoadRepertoiresAndChapters();

  const repertoires = useSelector((state) => state.repertoires);
  const chapters = useSelector((state) => state.chapters);
  const repertoireEntries = createMemo<[string, Repertoire][]>(() => {
    const result = repertoires();
    return result.status === "success" ? Object.entries(result.data).sort(compareByNameThenId) : [];
  });
  const chapterEntries = createMemo<[string, Chapter][]>(() => {
    const result = chapters();
    return result.status === "success" ? Object.entries(result.data).sort(compareByNameThenId) : [];
  });

  return (
    <Show when={repertoires().status === "success" && chapters().status === "success"}>
      <>
        <div class="flex flex-row justify-between pl-4 pr-2 pt-2">
          <h2 class="pt-0.5 text-sm text-muted-foreground">Repertoires</h2>
          <NewRepertoireMenu
            onCreate={onCreateNewRepertoire}
            limitReached={repertoireEntries().length >= MAX_REPERTOIRES}
          />
        </div>
        <ul class="p-2">
          <For each={repertoireEntries()}>
            {([id, repertoire]) => (
              <>
                <RepertoireSidebarItem
                  id={id}
                  repertoire={repertoire}
                  canDelete={repertoireEntries().length > 1}
                  canCreateChapter={
                    chapterEntries().filter(([, chapter]) => chapter.repertoireId === id).length <
                    MAX_CHAPTERS_PER_REPERTOIRE
                  }
                  onCreateNewChapter={onCreateNewChapter}
                  onDeleteRepertoire={onDeleteRepertoire}
                  onRenameRepertoire={onRenameRepertoire}
                />
                <For each={chapterEntries()}>
                  {([chapterId, chapter]) => {
                    if (chapter.repertoireId !== id) return null;
                    return (
                      <ChapterSidebarItem
                        id={chapterId}
                        repertoire={repertoire}
                        chapter={chapter}
                        canDelete={chapterEntries().some(
                          ([otherChapterId, otherChapter]) =>
                            otherChapterId !== chapterId && otherChapter.repertoireId === id,
                        )}
                        onDeleteChapter={onDeleteChapter}
                        onExportChapter={({ repertoire, chapter }) =>
                          exportChapterPgn({ state, repertoire, chapter })
                        }
                        onRenameChapter={onRenameChapter}
                      />
                    );
                  }}
                </For>
              </>
            )}
          </For>
        </ul>
      </>
    </Show>
  );
}

function NewRepertoireMenu(props: {
  onCreate: (input: CreateNewRepertoireInput) => void;
  limitReached: boolean;
}) {
  function createRepertoire(orientation: Orientation) {
    props.onCreate({
      name: "Untitled Repertoire",
      orientation,
    });
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger>
        <Button
          variant="outline"
          size="sm-icon"
          aria-label="Create repertoire"
          disabled={props.limitReached}
          title={
            props.limitReached ? `Maximum of ${MAX_REPERTOIRES} repertoires reached` : undefined
          }
        >
          <Plus />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuItem disabled={false} onClick={() => createRepertoire("white")}>
          <ChessPawn class="h-4 w-4 fill-current" aria-hidden="true" />
          Create white repertoire
        </DropdownMenuItem>
        <DropdownMenuItem disabled={false} onClick={() => createRepertoire("black")}>
          <ChessPawn class="h-4 w-4" aria-hidden="true" />
          Create black repertoire
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function RepertoireSidebarItem(props: {
  id: string;
  repertoire: Repertoire;
  canDelete: boolean;
  canCreateChapter: boolean;
  onCreateNewChapter: (args: { repertoireId: string; pgn?: string }) => void | Promise<void>;
  onDeleteRepertoire: (args: { repertoireId: string }) => void;
  onRenameRepertoire: (args: { repertoireId: string; name: string }) => void;
}) {
  const [isRenaming, setIsRenaming] = createSignal(false);
  const [draftName, setDraftName] = createSignal(untrack(() => props.repertoire.name));
  const [createFromPgnOpen, setCreateFromPgnOpen] = createSignal(false);

  function createChapter(pgn?: string) {
    return props.onCreateNewChapter(
      pgn === undefined ? { repertoireId: props.id } : { repertoireId: props.id, pgn },
    );
  }

  function startRenaming() {
    setDraftName(untrack(() => props.repertoire.name));
    setIsRenaming(true);
  }

  function commitRename() {
    const { name, currentName } = untrack(() => ({
      name: formatRepertoireName(draftName(), ""),
      currentName: props.repertoire.name,
    }));
    setIsRenaming(false);

    if (name === "" || name === currentName) {
      return;
    }

    props.onRenameRepertoire({ repertoireId: props.id, name });
  }

  function cancelRename() {
    setIsRenaming(false);
    setDraftName(props.repertoire.name);
  }

  return (
    <>
      <SidebarLink
        href={repertoireOverviewPath(props.repertoire.handle)}
        name={props.repertoire.name}
        icon={props.repertoire.orientation === "white" ? "white-pawn" : "black-pawn"}
        indent={false}
        editing={
          isRenaming()
            ? {
                ariaLabel: "Repertoire name",
                value: draftName,
                onInput: setDraftName,
                onCommit: commitRename,
                onCancel: cancelRename,
              }
            : undefined
        }
        dropdownContent={
          <DropdownMenuContent>
            <DropdownMenuItem
              disabled={!props.canCreateChapter}
              onClick={() => setCreateFromPgnOpen(true)}
            >
              Create chapter from PGN{props.canCreateChapter ? "" : " (limit reached)"}
            </DropdownMenuItem>
            <DropdownMenuItem disabled={!props.canCreateChapter} onClick={() => createChapter()}>
              Create empty chapter{props.canCreateChapter ? "" : " (limit reached)"}
            </DropdownMenuItem>
            <DropdownMenuItem disabled={false} onClick={startRenaming}>
              Rename
            </DropdownMenuItem>
            <Show when={props.canDelete}>
              <DropdownMenuItem
                disabled={false}
                onClick={() => props.onDeleteRepertoire({ repertoireId: props.id })}
              >
                Delete
              </DropdownMenuItem>
            </Show>
          </DropdownMenuContent>
        }
      />
      <LoadPGNDialog
        onLoad={createChapter}
        title="Create chapter from PGN"
        description="Paste a PGN to create a new chapter."
        submitLabel="Create chapter"
        trigger={null}
        state={{ open: createFromPgnOpen(), onOpenChange: setCreateFromPgnOpen }}
      />
    </>
  );
}

function ChapterSidebarItem(props: {
  id: string;
  repertoire: Repertoire;
  chapter: Chapter;
  canDelete: boolean;
  onDeleteChapter: (args: { chapterId: string; pgnId: string }) => void;
  onExportChapter: (args: { repertoire: Repertoire; chapter: Chapter }) => Promise<void>;
  onRenameChapter: (args: { chapterId: string; name: string }) => void;
}) {
  const [isRenaming, setIsRenaming] = createSignal(false);
  const [draftName, setDraftName] = createSignal(untrack(() => props.chapter.name));

  function startRenaming() {
    setDraftName(untrack(() => props.chapter.name));
    setIsRenaming(true);
  }

  function commitRename() {
    const { name, currentName } = untrack(() => ({
      name: formatRepertoireName(draftName(), ""),
      currentName: props.chapter.name,
    }));
    setIsRenaming(false);

    if (name === "" || name === currentName) {
      return;
    }

    props.onRenameChapter({ chapterId: props.id, name });
  }

  function cancelRename() {
    setIsRenaming(false);
    setDraftName(props.chapter.name);
  }

  return (
    <SidebarLink
      href={repertoirePath(props.repertoire.handle, props.chapter.handle)}
      name={props.chapter.name}
      icon="book"
      indent={true}
      editing={
        isRenaming()
          ? {
              ariaLabel: "Chapter name",
              value: draftName,
              onInput: setDraftName,
              onCommit: commitRename,
              onCancel: cancelRename,
            }
          : undefined
      }
      dropdownContent={
        <DropdownMenuContent>
          <DropdownMenuItem
            disabled={false}
            onClick={() =>
              void props.onExportChapter({
                repertoire: props.repertoire,
                chapter: props.chapter,
              })
            }
          >
            Export PGN
          </DropdownMenuItem>
          <DropdownMenuItem disabled={false} onClick={startRenaming}>
            Rename
          </DropdownMenuItem>
          <Show when={props.canDelete}>
            <DropdownMenuItem
              disabled={false}
              onClick={() =>
                props.onDeleteChapter({ chapterId: props.id, pgnId: props.chapter.pgnId })
              }
            >
              Delete
            </DropdownMenuItem>
          </Show>
        </DropdownMenuContent>
      }
    />
  );
}

type SidebarLinkEditing = {
  ariaLabel: string;
  value: () => string;
  onInput: (value: string) => void;
  onCommit: () => void;
  onCancel: () => void;
};

function SidebarLink(props: {
  href?: string | undefined;
  name: string;
  indent: boolean;
  icon: "black-pawn" | "white-pawn" | "book";
  dropdownContent: JSX.Element;
  editing?: SidebarLinkEditing | undefined;
}) {
  const [open, setOpen] = createSignal(false);
  const location = useLocation();
  const editing = createMemo(() => props.editing);
  const iconKind = createMemo(() => props.icon);

  function icon() {
    const kind = iconKind();

    if (kind === "black-pawn") {
      return <ChessPawn class="h-4 w-4 flex-none stroke-zinc-400 group-hover:stroke-white" />;
    }

    if (kind === "white-pawn") {
      return (
        <ChessPawn class="h-4 w-4 flex-none fill-zinc-400 stroke-zinc-400 group-hover:fill-white group-hover:stroke-white" />
      );
    }

    return <Book class="h-4 w-4 flex-none stroke-zinc-400 group-hover:stroke-white" />;
  }

  function link() {
    const className = cn(
      "peer group flex min-w-0 flex-row items-center gap-1 rounded-md py-1 pl-2 pr-8 text-sm active:bg-sidebar-link-active focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
      { "pl-4": props.indent },
      props.href !== undefined && location.pathname === props.href
        ? "bg-sidebar-link-active"
        : "hover:bg-sidebar-link-hover",
    );

    if (props.href === undefined) {
      return (
        <div class={className}>
          {icon()}
          <span class="min-w-0 flex-1 truncate" title={props.name}>
            {props.name}
          </span>
        </div>
      );
    }

    return (
      <A class={className} href={props.href}>
        {icon()}
        <span class="min-w-0 flex-1 truncate" title={props.name}>
          {props.name}
        </span>
      </A>
    );
  }

  function editingRow(current: SidebarLinkEditing) {
    return (
      <div
        class={cn(
          "peer group flex min-w-0 flex-row items-center gap-1 rounded-md bg-sidebar-link-active py-1 pl-2 pr-8 text-sm",
          { "pl-4": props.indent },
        )}
      >
        {icon()}
        <InlineEditInput
          aria-label={current.ariaLabel}
          value={current.value()}
          maxlength={MAX_REPERTOIRE_NAME_LENGTH}
          onValueInput={current.onInput}
          onCommit={current.onCommit}
          onCancel={current.onCancel}
        />
      </div>
    );
  }

  function content() {
    const currentEditing = editing();
    return currentEditing === undefined ? link() : editingRow(currentEditing);
  }

  return (
    <li class="group/sidebar-item relative">
      {content()}

      <DropdownMenu state={{ open: open(), onOpenChange: setOpen }}>
        <DropdownMenuTrigger>
          <Button
            variant="ghost"
            size="sm-icon"
            aria-label={`Actions for ${props.name}`}
            class={cn(
              "absolute right-0 top-0.5 opacity-0 hover:opacity-100 group-hover/sidebar-item:opacity-100",
              { "opacity-100": open() },
            )}
            tabindex={-1}
          >
            <Ellipsis />
          </Button>
        </DropdownMenuTrigger>
        {props.dropdownContent}
      </DropdownMenu>
    </li>
  );
}

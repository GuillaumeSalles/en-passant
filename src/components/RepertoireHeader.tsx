import { createSignal } from "solid-js";
import { getRepertoireName, getChapterName, getRepertoire } from "@/lib/AppState";
import { useSelector } from "@/lib/useSelector";
import { Brain, Plus } from "./Icons";
import { Button } from "./ui/button";
import { useRouteContext } from "@/lib/useRouteContext";
import { trainingPath } from "@/lib/routes";
import { useMutation } from "@/lib/useMutation";
import { createNewChapter } from "@/mutations/createNewChapter";
import { LoadPGNDialog } from "./LoadPgnDialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";

export function RepertoireHeader() {
  const repertoireName = useSelector(getRepertoireName);
  const chapterName = useSelector(getChapterName);
  const repertoire = useSelector(getRepertoire);
  const ctx = useRouteContext();
  const onCreateNewChapter = useMutation(createNewChapter, { context: true });
  const [createFromPgnOpen, setCreateFromPgnOpen] = createSignal(false);

  function createChapter(pgn?: string) {
    const currentRepertoire = repertoire();
    if (currentRepertoire === undefined) {
      return;
    }

    return onCreateNewChapter(
      pgn === undefined
        ? { repertoireId: currentRepertoire.id }
        : { repertoireId: currentRepertoire.id, pgn },
    );
  }

  return (
    <div class="flex min-w-0 flex-row justify-between gap-2">
      <div class="flex min-w-0 items-center gap-2">
        <div class="flex min-w-0 items-center gap-1 text-base font-medium">
          <span class="truncate">{repertoireName()}</span>
          <span>/</span>
          <span class="truncate">{chapterName()}</span>
        </div>
      </div>
      <div class="flex flex-none items-center gap-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button aria-label="Create chapter" variant="outline">
              <Plus />
              Chapter
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => setCreateFromPgnOpen(true)}>
              Create chapter from PGN
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => createChapter()}>
              Create empty chapter
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <LoadPGNDialog
          onLoad={createChapter}
          title="Create chapter from PGN"
          description="Paste a PGN to create a new chapter."
          submitLabel="Create chapter"
          trigger={null}
          open={createFromPgnOpen()}
          onOpenChange={setCreateFromPgnOpen}
        />
        <Button href={trainingPath(ctx().repertoireHandle, ctx().chapterHandle)}>
          <Brain />
          Train
        </Button>
      </div>
    </div>
  );
}

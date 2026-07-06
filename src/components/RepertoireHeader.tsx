import { getRepertoireName, getChapterName } from "@/lib/AppState";
import { useSelector } from "@/lib/useSelector";
import { Brain } from "./Icons";
import { Button } from "./ui/button";
import { useRouteContext } from "@/lib/useRouteContext";
import { trainingPath } from "@/lib/routes";
import { createMemo, Show } from "solid-js";

type HeaderTitle = readonly [repertoireName: string, chapterName: string];

export function RepertoireHeader() {
  const repertoireName = useSelector(getRepertoireName);
  const chapterName = useSelector(getChapterName);
  const ctx = useRouteContext();
  const headerTitle = createMemo<HeaderTitle | null>(() => {
    const currentRepertoireName = repertoireName();
    const currentChapterName = chapterName();

    if (currentRepertoireName === null || currentChapterName === null) {
      return null;
    }

    return [currentRepertoireName, currentChapterName];
  });

  return (
    <div class="flex min-w-0 flex-row justify-between gap-2">
      <div class="flex min-w-0 items-center gap-2">
        <Show when={headerTitle()}>
          {(title) => (
            <div class="motion-page-title flex min-w-0 items-center gap-1 text-base font-normal">
              <span class="truncate">{title()[0]}</span>
              <span>·</span>
              <span class="truncate">{title()[1]}</span>
            </div>
          )}
        </Show>
      </div>
      <div class="flex flex-none items-center gap-2">
        <Button href={trainingPath(ctx().repertoireHandle, ctx().chapterHandle)}>
          <Brain />
          Train
        </Button>
      </div>
    </div>
  );
}

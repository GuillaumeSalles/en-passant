import { getRepertoireName, getChapterName } from "@/lib/AppState";
import { useSelector } from "@/lib/useSelector";
import { Brain } from "./Icons";
import { Button } from "./ui/button";
import { useRouteContext } from "@/lib/useRouteContext";
import { trainingPath } from "@/lib/routes";

export function RepertoireHeader() {
  const repertoireName = useSelector(getRepertoireName);
  const chapterName = useSelector(getChapterName);
  const ctx = useRouteContext();

  return (
    <div class="flex min-w-0 flex-row justify-between gap-2">
      <div class="flex min-w-0 items-center gap-2">
        <div class="flex min-w-0 items-center gap-1 text-base">
          <span class="truncate">{repertoireName()}</span>
          <span>·</span>
          <span class="truncate">{chapterName()}</span>
        </div>
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

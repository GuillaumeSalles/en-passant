import { Brain } from "./Icons";
import { Button } from "./ui/button";
import { useRouteContext } from "@/lib/useRouteContext";
import { trainingPath } from "@/lib/routes";
import { RepertoireBreadcrumb } from "./RepertoireBreadcrumb";

export function RepertoireHeader() {
  const ctx = useRouteContext();

  return (
    <div class="flex min-w-0 flex-row justify-between gap-2">
      <div class="flex min-w-0 items-center gap-2">
        <RepertoireBreadcrumb showTraining={false} />
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

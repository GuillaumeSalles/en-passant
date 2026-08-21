import { Button } from "./ui/button";
import { useRouteContext } from "@/lib/useRouteContext";
import { trainingPath } from "@/lib/routes";
import { RepertoireBreadcrumb } from "./RepertoireBreadcrumb";
import { MergePgnDialog } from "./MergePgnDialog";

export function RepertoireHeader() {
  const ctx = useRouteContext();

  return (
    <div class="flex min-w-0 flex-row justify-between gap-2">
      <div class="flex min-w-0 items-center gap-2">
        <RepertoireBreadcrumb showTraining={false} trainingLineId={null} readLine={false} />
      </div>
      <div class="flex flex-none items-center gap-2">
        <MergePgnDialog />
        <Button href={trainingPath(ctx().repertoireHandle, ctx().chapterHandle)}>Train</Button>
      </div>
    </div>
  );
}

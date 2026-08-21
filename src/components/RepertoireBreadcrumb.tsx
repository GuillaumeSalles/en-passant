import { createMemo, Show } from "solid-js";
import { getChapterName, getRepertoireName } from "@/lib/AppState";
import {
  learningLinePath,
  repertoireOverviewPath,
  repertoirePath,
  trainingLinePath,
  trainingPath,
} from "@/lib/routes";
import { useRouteContext } from "@/lib/useRouteContext";
import { useSelector } from "@/lib/useSelector";

type BreadcrumbTitle = readonly [repertoireName: string, chapterName: string];

const crumbLinkClass = "truncate transition-colors duration-150 ease-emil-out hover:text-blue-500";

export function RepertoireBreadcrumb(props: {
  showTraining: boolean;
  trainingLineId: string | null;
  learningLineId?: string | null;
  readLine: boolean;
}) {
  const repertoireName = useSelector(getRepertoireName);
  const chapterName = useSelector(getChapterName);
  const ctx = useRouteContext();
  const title = createMemo<BreadcrumbTitle | null>(() => {
    const currentRepertoireName = repertoireName();
    const currentChapterName = chapterName();

    if (currentRepertoireName === null || currentChapterName === null) {
      return null;
    }

    return [currentRepertoireName, currentChapterName];
  });

  return (
    <Show when={title()}>
      {(currentTitle) => (
        <nav
          aria-label="Breadcrumb"
          class="motion-page-title flex min-w-0 items-center gap-1 text-base font-normal"
        >
          <a class={crumbLinkClass} href={repertoireOverviewPath(ctx().repertoireHandle)}>
            {currentTitle()[0]}
          </a>
          <span>·</span>
          <a
            class={crumbLinkClass}
            href={repertoirePath(ctx().repertoireHandle, ctx().chapterHandle)}
          >
            {currentTitle()[1]}
          </a>
          <Show when={props.showTraining}>
            <span>·</span>
            <a
              class={crumbLinkClass}
              href={trainingPath(ctx().repertoireHandle, ctx().chapterHandle)}
            >
              Training
            </a>
          </Show>
          <Show when={props.trainingLineId}>
            {(lineId) => (
              <>
                <span>·</span>
                <a
                  class={crumbLinkClass}
                  href={trainingLinePath(ctx().repertoireHandle, ctx().chapterHandle, lineId())}
                >
                  Line
                </a>
              </>
            )}
          </Show>
          <Show when={props.learningLineId}>
            {(lineId) => (
              <>
                <span>·</span>
                <a
                  class={crumbLinkClass}
                  href={learningLinePath(ctx().repertoireHandle, ctx().chapterHandle, lineId())}
                >
                  Learn line
                </a>
              </>
            )}
          </Show>
          <Show when={props.readLine}>
            <span>·</span>
            <span aria-current="page">Line</span>
          </Show>
        </nav>
      )}
    </Show>
  );
}

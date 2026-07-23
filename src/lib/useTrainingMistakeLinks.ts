import { createEffect, createSignal } from "solid-js";
import { currentAuthUser } from "./authSession";
import { loadTrainingMistakeLinks, type TrainingMistakeLink } from "./games";

export function trainingMistakeLinkKey(chapterId: string, uciPath: string): string {
  return `${chapterId}/${uciPath}`;
}

export function useTrainingMistakeLinks() {
  const [links, setLinks] = createSignal<Record<string, TrainingMistakeLink>>({});
  let requestId = 0;

  createEffect(
    () => currentAuthUser()?.id ?? null,
    (userId) => {
      requestId += 1;
      const currentRequestId = requestId;
      if (userId === null) {
        setLinks({});
        return;
      }
      void loadTrainingMistakeLinks().then((result) => {
        if (currentRequestId !== requestId || !result.ok) return;
        setLinks(
          Object.fromEntries(
            result.links.map((link) => [
              trainingMistakeLinkKey(link.chapterId, link.uciPath),
              link,
            ]),
          ),
        );
      });
    },
  );

  return links;
}

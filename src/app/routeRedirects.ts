import { useNavigate } from "@solidjs/router";
import { createEffect } from "solid-js";
import type { Accessor } from "solid-js";
import { useState } from "@/app/AppStateProvider";
import { getChapterScopeFromData } from "@/lib/AppState";
import { APP_ROOT } from "@/lib/routes";

export function useRedirectMissingRepertoireRoute(props: {
  getRepertoireHandle: Accessor<string>;
  getChapterHandle: Accessor<string>;
}) {
  const state = useState();
  const navigate = useNavigate();

  createEffect(
    () => ({
      repertoireHandle: props.getRepertoireHandle(),
      chapterHandle: props.getChapterHandle(),
      repertoires: state.repertoires,
      chapters: state.chapters,
    }),
    ({ repertoireHandle, chapterHandle, repertoires, chapters }) => {
      if (repertoires.status !== "success" || chapters.status !== "success") return;

      const scope = getChapterScopeFromData(
        repertoires.data,
        chapters.data,
        repertoireHandle,
        chapterHandle,
      );
      if (scope === null) navigate(APP_ROOT, { replace: true });
    },
  );
}

export function useRedirectMissingRepertoireOverviewRoute(props: {
  getRepertoireHandle: Accessor<string>;
}) {
  const state = useState();
  const navigate = useNavigate();

  createEffect(
    () => ({
      repertoireHandle: props.getRepertoireHandle(),
      repertoires: state.repertoires,
    }),
    ({ repertoireHandle, repertoires }) => {
      if (repertoires.status !== "success") return;

      const repertoire = Object.values(repertoires.data).find(
        (candidate) => candidate.handle === repertoireHandle,
      );
      if (repertoire === undefined) navigate(APP_ROOT, { replace: true });
    },
  );
}

import { createEffect } from "solid-js";
import { useState } from "@/app/AppStateProvider";
import { getPgn } from "@/storage";
import { useMutation } from "./useMutation";
import {
  AppState,
  Context,
  getChapterScopeFromData,
  getRepertoireByHandleFromData,
  normalizePgn,
  setBoardOrientation,
} from "./AppState";
import { StoreState } from "./createStore";

function startLoadingPgn(state: StoreState<AppState>, _ctx: Context, pgnId: string): void {
  state.set("pgns", {
    ...state.pgns,
    [pgnId]: { status: "loading" },
  });
}

function onPgnLoadCompleted(
  state: StoreState<AppState>,
  _ctx: Context,
  pgnId: string,
  pgn: string,
): void {
  state.set("pgns", {
    ...state.pgns,
    [pgnId]: { status: "success", data: normalizePgn(pgn) },
  });
}

export function useLoadPgn(getRepertoireHandle: () => string, getChapterHandle: () => string) {
  const state = useState();
  const onPgnLoadMutation = useMutation(onPgnLoadCompleted);
  const onStartLoadingPgnMutation = useMutation(startLoadingPgn);
  const onSetBoardOrientation = useMutation(setBoardOrientation);
  let lastAppliedRepertoireId: string | null = null;

  createEffect(
    () => ({
      repertoireHandle: getRepertoireHandle(),
      repertoires: state.repertoires,
    }),
    ({ repertoireHandle, repertoires }) => {
      const repertoire = getRepertoireByHandleFromData(repertoires.data, repertoireHandle);
      if (repertoire === undefined || repertoire.id === lastAppliedRepertoireId) {
        return;
      }

      lastAppliedRepertoireId = repertoire.id;
      onSetBoardOrientation(repertoire.orientation);
    },
  );

  createEffect(
    () => ({
      repertoireHandle: getRepertoireHandle(),
      chapterHandle: getChapterHandle(),
      repertoires: state.repertoires,
      chapters: state.chapters,
      pgns: state.pgns,
    }),
    ({ repertoireHandle, chapterHandle, repertoires, chapters, pgns }) => {
      const scope = getChapterScopeFromData(
        repertoires.data,
        chapters.data,
        repertoireHandle,
        chapterHandle,
      );
      if (scope === null) {
        return;
      }

      const { chapter } = scope;
      if (pgns[chapter.pgnId] !== undefined) {
        return;
      }

      onStartLoadingPgnMutation(chapter.pgnId);

      getPgn(chapter.pgnId).then((pgn) => {
        if (pgn == null) {
          return;
        }
        onPgnLoadMutation(chapter.pgnId, pgn);
      });
    },
  );
}

import { getInitialRepertoiresAndChapters } from "@/storage";
import { reportStorageError } from "@/storage/status";
import { onSettled } from "solid-js";
import { onRepertoireAndChapterLoad } from "./AppState";
import { useMutation } from "./useMutation";
import { useState } from "@/app/AppStateProvider";
export function useLoadRepertoiresAndChapters() {
  const state = useState();
  const loaded = useMutation(onRepertoireAndChapterLoad);
  onSettled(() => {
    if (state.repertoires.status !== "not-loaded") return;
    void getInitialRepertoiresAndChapters()
      .then((load) => loaded(load.repertoires, load.chapters, load.trainingLineSchedules))
      .catch(reportStorageError);
  });
}

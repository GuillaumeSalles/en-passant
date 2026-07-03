import { useLocation, useParams } from "@solidjs/router";
import { createMemo } from "solid-js";
import type { Accessor } from "solid-js";
import { Context } from "./AppState";

type Params = { repertoireHandle: string; chapterHandle: string };

export function useRouteContext(): Accessor<Context> {
  const location = useLocation();
  const params = useParams<Params>();
  return createMemo(() => {
    const segments = location.pathname.split("/");
    const rh = params.repertoireHandle ?? "";
    const ch = params.chapterHandle ?? "";
    if (segments.at(-1) === "train") {
      return { type: "variation-training", repertoireHandle: rh, chapterHandle: ch };
    }
    return { type: "repertoire-builder", repertoireHandle: rh, chapterHandle: ch };
  });
}

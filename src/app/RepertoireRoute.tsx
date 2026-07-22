import { useLocation, useParams } from "@solidjs/router";
import { Repertoire } from "@/components/Repertoire";
import { parseSelectedPositionKey } from "@/lib/routes";
import { useRedirectMissingRepertoireRoute } from "./routeRedirects";

export default function RepertoireRoute() {
  const params = useParams<{ repertoireHandle: string; chapterHandle: string }>();
  const location = useLocation();
  useRedirectMissingRepertoireRoute({
    getRepertoireHandle: () => params.repertoireHandle,
    getChapterHandle: () => params.chapterHandle,
  });
  return (
    <Repertoire
      repertoireHandle={params.repertoireHandle}
      chapterHandle={params.chapterHandle}
      requestedPositionKey={parseSelectedPositionKey(
        typeof location.query["selectedPositionKey"] === "string"
          ? location.query["selectedPositionKey"]
          : undefined,
      )}
    />
  );
}

import { mergeChapterPgn } from "@/lib/AppState";
import { useMutation } from "@/lib/useMutation";
import { LoadPGNDialog } from "./LoadPgnDialog";
import { Button } from "./ui/button";

export function MergePgnDialog() {
  const onMergePgn = useMutation(mergeChapterPgn);

  return (
    <LoadPGNDialog
      onLoad={onMergePgn}
      title="Merge PGN"
      description="Paste a PGN to merge into this chapter."
      submitLabel="Merge"
      cancelLabel="Cancel"
      trigger={
        <Button type="button" variant="outline">
          Merge pgn
        </Button>
      }
    />
  );
}

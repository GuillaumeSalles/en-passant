import { getPgn, selectMove, selectNextMoveIds, selectPreselectedVariation } from "@/lib/AppState";
import { Button } from "./ui/button";
import { HorizontalDashedDivider } from "./ui/HorizontalDashedDivider";
import { useMutation } from "@/lib/useMutation";
import { useSelector } from "@/lib/useSelector";
import { For } from "solid-js";

export function VariationSelector() {
  const onSelectMove = useMutation(selectMove);
  const preselectedVariation = useSelector(selectPreselectedVariation);
  const nextMoveIds = useSelector(selectNextMoveIds);
  const moves = useSelector((state, ctx) => getPgn(state, ctx)?.moves ?? {});
  const variations = () =>
    nextMoveIds()
      .map((id) => moves()[id])
      .filter((move) => move !== undefined);

  const selectedVariationId = () =>
    preselectedVariation() === null ? nextMoveIds()[0] : preselectedVariation();

  return (
    <>
      <HorizontalDashedDivider animationKey="variation-selector-top" />
      <div class="grid w-full grid-cols-2 gap-2 px-2 py-2">
        <For each={variations()}>
          {(move) => (
            <Button
              size="sm"
              variant={selectedVariationId() === move.id ? "default" : "outline"}
              aria-current={selectedVariationId() === move.id ? "true" : undefined}
              onClick={() => onSelectMove(move.id)}
            >
              {move.san}
            </Button>
          )}
        </For>
      </div>
    </>
  );
}

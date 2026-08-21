import { Show } from "solid-js";
import { Button } from "@/components/ui/button";
import { ButtonCountBadge } from "@/components/ui/button-count-badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useMutation } from "@/lib/useMutation";
import { startTrainingQueueReview } from "@/mutations/trainingSession";

export function TrainingReviewButton(props: { count: number; href: string | undefined }) {
  const onStartTrainingQueueReview = useMutation(startTrainingQueueReview);

  return (
    <Show
      when={props.href}
      fallback={
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger>
              <Button size="sm" disabled>
                Review lines
              </Button>
            </TooltipTrigger>
            <TooltipContent>You have no variation to review</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      }
    >
      {(href) => (
        <Button
          size="sm"
          class="relative"
          href={href()}
          onClick={() => onStartTrainingQueueReview(props.count)}
        >
          Review lines
          <ButtonCountBadge count={props.count} />
        </Button>
      )}
    </Show>
  );
}

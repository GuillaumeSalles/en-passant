import { createSignal, createUniqueId, Show } from "solid-js";
import type { JSX } from "@solidjs/web";
import { Button } from "./ui/button";
import {
  DialogHeader,
  DialogFooter,
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "./ui/dialog";
import { Textarea } from "./ui/textarea";
import { Upload } from "./Icons";
import { TooltipIconButton } from "./ui/tooltip-icon-button";

export function LoadPGNDialog(props: {
  onLoad: (pgn: string) => void | Promise<void>;
  trigger?: JSX.Element | null;
  title?: string;
  description?: string;
  submitLabel?: string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const [pgn, setPgn] = createSignal("");
  const [uncontrolledOpen, setUncontrolledOpen] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);
  const [submitting, setSubmitting] = createSignal(false);
  const errorId = createUniqueId();
  const trigger = () =>
    props.trigger ?? (
      <TooltipIconButton aria-label="Load PGN" icon={<Upload />} tooltip="Load PGN" />
    );
  const open = () => props.open ?? uncontrolledOpen();

  function setOpen(open: boolean) {
    if (props.open === undefined) setUncontrolledOpen(open);
    if (!open) setError(null);
    props.onOpenChange?.(open);
  }

  function focusPgnTextarea(element: HTMLTextAreaElement) {
    queueMicrotask(() => {
      element.focus();
      element.select();
    });
  }

  async function submitPgn() {
    setError(null);
    setSubmitting(true);

    try {
      await props.onLoad(pgn());
      setOpen(false);
    } catch {
      setError("Invalid PGN");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog state={{ open: open(), onOpenChange: setOpen }}>
      <Show when={props.trigger !== null}>
        <DialogTrigger>{trigger()}</DialogTrigger>
      </Show>
      <DialogContent class="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{props.title ?? "Load PGN"}</DialogTitle>
          <DialogDescription>
            {props.description ?? "Paste a PGN to load a game."}
          </DialogDescription>
        </DialogHeader>
        <Textarea
          ref={focusPgnTextarea}
          autofocus={true}
          onFocus={(e) => (e.target as HTMLTextAreaElement).select()}
          value={pgn()}
          aria-invalid={error() !== null ? "true" : undefined}
          aria-describedby={error() !== null ? errorId : undefined}
          onInput={(e) => {
            setPgn((e.target as HTMLTextAreaElement).value);
            setError(null);
          }}
        />
        <DialogFooter class="flex-col items-stretch gap-2 sm:flex-row sm:items-center sm:justify-end sm:space-x-0">
          <Show when={error() !== null}>
            <p id={errorId} role="alert" class="min-w-0 flex-1 text-left text-sm text-destructive">
              {error()}
            </p>
          </Show>
          <Button type="submit" disabled={submitting()} onClick={submitPgn}>
            {props.submitLabel ?? "Load"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

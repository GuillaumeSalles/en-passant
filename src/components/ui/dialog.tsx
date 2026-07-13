import {
  createContext,
  createEffect,
  createSignal,
  createUniqueId,
  omit,
  useContext,
} from "solid-js";
import type { JSX } from "@solidjs/web";
import { Show } from "solid-js";
import { CloseButton } from "./close-button";
import { cn } from "@/lib/utils";

type DialogContextType = {
  open: () => boolean;
  setOpen: (open: boolean) => void;
  titleId: string;
  descriptionId: string;
};

type DialogState = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

const DialogContext = createContext<DialogContextType>({
  open: () => false,
  setOpen: () => {},
  titleId: "",
  descriptionId: "",
});

function Dialog(props: { children: JSX.Element; state?: DialogState }) {
  const [uncontrolled, setUncontrolled] = createSignal(false);
  const id = createUniqueId();
  const state = () => props.state;
  const open = () => state()?.open ?? uncontrolled();
  const setOpen = (v: boolean) => {
    const controlledState = state();
    if (controlledState === undefined) {
      setUncontrolled(v);
      return;
    }
    controlledState.onOpenChange(v);
  };

  return (
    <DialogContext
      value={{ open, setOpen, titleId: `${id}-title`, descriptionId: `${id}-description` }}
    >
      {props.children}
    </DialogContext>
  );
}

function DialogTrigger(props: { children: JSX.Element }) {
  const ctx = useContext(DialogContext);
  return (
    <span style={{ display: "contents" }} onClick={() => ctx.setOpen(true)}>
      {props.children}
    </span>
  );
}

function DialogClose(props: { children: JSX.Element }) {
  const ctx = useContext(DialogContext);
  return (
    <span style={{ display: "contents" }} onClick={() => ctx.setOpen(false)}>
      {props.children}
    </span>
  );
}

function DialogContent(props: { children: JSX.Element; class?: string }) {
  const ctx = useContext(DialogContext);
  let contentRef: HTMLDivElement | undefined;

  createEffect(
    () => ctx.open(),
    (open) => {
      if (!open) return;

      const previouslyFocusedElement =
        document.activeElement instanceof HTMLElement ? document.activeElement : undefined;

      queueMicrotask(() => {
        if (contentRef === undefined || contentRef.contains(document.activeElement)) return;
        const [firstFocusable] = focusableElements(contentRef);
        (firstFocusable ?? contentRef).focus();
      });

      const onKeyDown = (event: KeyboardEvent) => {
        if (event.key === "Escape") {
          event.preventDefault();
          ctx.setOpen(false);
          return;
        }

        if (event.key !== "Tab" || contentRef === undefined) return;

        const focusable = focusableElements(contentRef);
        if (focusable.length === 0) {
          event.preventDefault();
          contentRef.focus();
          return;
        }

        const firstFocusable = focusable.at(0);
        const lastFocusable = focusable.at(-1);
        if (firstFocusable === undefined || lastFocusable === undefined) return;

        const activeElement = document.activeElement;

        if (event.shiftKey && activeElement === firstFocusable) {
          event.preventDefault();
          lastFocusable.focus();
        } else if (!event.shiftKey && activeElement === lastFocusable) {
          event.preventDefault();
          firstFocusable.focus();
        }
      };

      document.addEventListener("keydown", onKeyDown);
      return () => {
        document.removeEventListener("keydown", onKeyDown);
        if (previouslyFocusedElement?.isConnected) {
          previouslyFocusedElement.focus();
        }
      };
    },
  );

  return (
    <Show when={ctx.open()}>
      <>
        <div
          class="motion-dialog-overlay fixed inset-0 z-50 bg-black/80"
          onClick={() => ctx.setOpen(false)}
        />
        <div
          ref={contentRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby={ctx.titleId}
          aria-describedby={ctx.descriptionId}
          tabindex={-1}
          class={cn(
            "motion-dialog-content fixed left-[50%] top-[50%] z-[51] grid w-full max-w-lg gap-4 border bg-background p-6 shadow-lg sm:rounded-lg",
            props.class,
          )}
          onClick={(e) => e.stopPropagation()}
        >
          {props.children}
          <CloseButton
            label="Close"
            class="absolute right-4 top-4 opacity-70 hover:opacity-100"
            onClick={() => ctx.setOpen(false)}
          />
        </div>
      </>
    </Show>
  );
}

function focusableElements(container: HTMLElement): HTMLElement[] {
  return Array.from(
    container.querySelectorAll<HTMLElement>(
      [
        "a[href]",
        "button:not([disabled])",
        "textarea:not([disabled])",
        "input:not([disabled])",
        "select:not([disabled])",
        "[tabindex]:not([tabindex='-1'])",
      ].join(","),
    ),
  ).filter((element) => element.offsetParent !== null);
}

function DialogHeader(props: JSX.HTMLAttributes<HTMLDivElement>) {
  const rest = omit(props, "class");
  return (
    <div class={cn("flex flex-col space-y-1.5 text-center sm:text-left", props.class)} {...rest} />
  );
}

function DialogFooter(props: JSX.HTMLAttributes<HTMLDivElement>) {
  const rest = omit(props, "class");
  return (
    <div
      class={cn("flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2", props.class)}
      {...rest}
    />
  );
}

function DialogTitle(props: JSX.HTMLAttributes<HTMLHeadingElement>) {
  const ctx = useContext(DialogContext);
  const rest = omit(props, "class", "id");
  return (
    <h2
      id={ctx.titleId}
      class={cn("text-lg font-semibold leading-none tracking-tight", props.class)}
      {...rest}
    />
  );
}

function DialogDescription(props: JSX.HTMLAttributes<HTMLParagraphElement>) {
  const ctx = useContext(DialogContext);
  const rest = omit(props, "class", "id");
  return (
    <p id={ctx.descriptionId} class={cn("text-sm text-muted-foreground", props.class)} {...rest} />
  );
}

// Stubs for API compatibility
const DialogPortal = (props: { children: JSX.Element }) => <>{props.children}</>;
const DialogOverlay = (_props: JSX.HTMLAttributes<HTMLDivElement>) => null;

export {
  Dialog,
  DialogPortal,
  DialogOverlay,
  DialogTrigger,
  DialogClose,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
};

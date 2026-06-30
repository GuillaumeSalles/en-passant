import { createContext, createSignal, omit, useContext, createEffect } from "solid-js";
import type { JSX } from "@solidjs/web";
import { Show } from "solid-js";
import { cn } from "@/lib/utils";
import {
  menuContentClass,
  menuInsetClass,
  menuItemClass,
  menuLabelClass,
  menuShortcutClass,
  menuSubContentClass,
} from "./menu-styles";

type ContextMenuContextType = {
  open: () => boolean;
  setOpen: (open: boolean) => void;
  position: () => { x: number; y: number };
  setPosition: (pos: { x: number; y: number }) => void;
};

const ContextMenuContext = createContext<ContextMenuContextType>({
  open: () => false,
  setOpen: () => {},
  position: () => ({ x: 0, y: 0 }),
  setPosition: () => {},
});

function ContextMenu(props: { children: JSX.Element }) {
  const [open, setOpen] = createSignal(false);
  const [position, setPosition] = createSignal({ x: 0, y: 0 });

  return (
    <ContextMenuContext value={{ open, setOpen, position, setPosition }}>
      {props.children}
    </ContextMenuContext>
  );
}

function ContextMenuTrigger(props: {
  children: JSX.Element;
  disabled?: boolean;
  onContextMenu?: () => void;
}) {
  const ctx = useContext(ContextMenuContext);

  const handleContextMenu = (e: MouseEvent) => {
    if (props.disabled) return;
    e.preventDefault();
    props.onContextMenu?.();
    ctx.setPosition({ x: e.clientX, y: e.clientY });
    ctx.setOpen(true);
  };

  return (
    <span style="display:contents" onContextMenu={handleContextMenu}>
      {props.children}
    </span>
  );
}

function ContextMenuContent(props: { children: JSX.Element; class?: string }) {
  const ctx = useContext(ContextMenuContext);
  let contentRef: HTMLDivElement | undefined;

  createEffect(
    () => ctx.open(),
    (open) => {
      if (!open) return;

      const onMouseDown = (e: MouseEvent) => {
        if (!contentRef?.contains(e.target as Node)) ctx.setOpen(false);
      };
      const onKeyDown = (e: KeyboardEvent) => {
        if (e.key === "Escape") ctx.setOpen(false);
      };
      document.addEventListener("mousedown", onMouseDown);
      document.addEventListener("keydown", onKeyDown);
      return () => {
        document.removeEventListener("mousedown", onMouseDown);
        document.removeEventListener("keydown", onKeyDown);
      };
    },
  );

  return (
    <Show when={ctx.open()}>
      <div
        ref={contentRef}
        style={{ position: "fixed", left: `${ctx.position().x}px`, top: `${ctx.position().y}px` }}
        class={cn("motion-context-menu-content", menuContentClass, props.class)}
      >
        {props.children}
      </div>
    </Show>
  );
}

function ContextMenuItem(props: {
  children: JSX.Element;
  class?: string;
  onClick?: () => void;
  inset?: boolean;
}) {
  const ctx = useContext(ContextMenuContext);

  return (
    <div
      class={cn(menuItemClass, props.inset && menuInsetClass, props.class)}
      onClick={() => {
        props.onClick?.();
        ctx.setOpen(false);
      }}
    >
      {props.children}
    </div>
  );
}

// Pass-through stubs for API compatibility
const ContextMenuGroup = (props: { children: JSX.Element }) => <>{props.children}</>;
const ContextMenuPortal = (props: { children: JSX.Element }) => <>{props.children}</>;
const ContextMenuSub = (props: { children: JSX.Element }) => <>{props.children}</>;
const ContextMenuRadioGroup = (props: { children: JSX.Element }) => <>{props.children}</>;
const ContextMenuShortcut = (props: JSX.HTMLAttributes<HTMLSpanElement>) => {
  const rest = omit(props, "class");
  return <span class={cn(menuShortcutClass, props.class)} {...rest} />;
};
const ContextMenuSubTrigger = (props: { children: JSX.Element; class?: string }) => (
  <div class={cn(menuItemClass, props.class)}>{props.children}</div>
);
const ContextMenuSubContent = (props: { children: JSX.Element; class?: string }) => (
  <div class={cn(menuSubContentClass, props.class)}>{props.children}</div>
);
const ContextMenuCheckboxItem = (props: { children: JSX.Element; class?: string }) => (
  <div class={cn(menuItemClass, menuInsetClass, props.class)}>{props.children}</div>
);
const ContextMenuRadioItem = (props: { children: JSX.Element; class?: string }) => (
  <div class={cn(menuItemClass, menuInsetClass, props.class)}>{props.children}</div>
);
const ContextMenuLabel = (props: { children: JSX.Element; class?: string }) => (
  <div class={cn(menuLabelClass, props.class)}>{props.children}</div>
);

export {
  ContextMenu,
  ContextMenuTrigger,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuCheckboxItem,
  ContextMenuRadioItem,
  ContextMenuLabel,
  ContextMenuShortcut,
  ContextMenuGroup,
  ContextMenuPortal,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuRadioGroup,
};

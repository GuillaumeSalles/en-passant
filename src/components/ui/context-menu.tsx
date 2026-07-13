import { createContext, createEffect, createSignal, omit, useContext } from "solid-js";
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
  position: () => ContextMenuPosition;
  setPosition: (pos: ContextMenuPosition) => void;
};

type ContextMenuPosition = { x: number; y: number };

const VIEWPORT_PADDING = 8;

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
  disabled: boolean;
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
    <span style={{ display: "contents" }} onContextMenu={handleContextMenu}>
      {props.children}
    </span>
  );
}

function ContextMenuContent(props: { children: JSX.Element; class?: string }) {
  const ctx = useContext(ContextMenuContext);
  let contentRef: HTMLDivElement | undefined;
  const [contentPosition, setContentPosition] = createSignal<ContextMenuPosition>({ x: 0, y: 0 });
  const [positionReady, setPositionReady] = createSignal(false);

  const clampContentPosition = (position: ContextMenuPosition) => {
    const content = contentRef;
    if (content === undefined) return;

    const maxX = Math.max(
      VIEWPORT_PADDING,
      window.innerWidth - content.offsetWidth - VIEWPORT_PADDING,
    );
    const maxY = Math.max(
      VIEWPORT_PADDING,
      window.innerHeight - content.offsetHeight - VIEWPORT_PADDING,
    );
    setContentPosition({
      x: clamp(position.x, VIEWPORT_PADDING, maxX),
      y: clamp(position.y, VIEWPORT_PADDING, maxY),
    });
    setPositionReady(true);
  };

  createEffect(
    () => [ctx.open(), ctx.position()] as const,
    ([open, position]) => {
      setContentPosition(position);
      if (!open) return;

      setPositionReady(false);
      const clampPosition = () => clampContentPosition(position);
      clampPosition();
      const animationFrame = window.requestAnimationFrame(clampPosition);
      const resizeObserver = new ResizeObserver(clampPosition);
      if (contentRef !== undefined) resizeObserver.observe(contentRef);
      window.addEventListener("resize", clampPosition);

      const onMouseDown = (e: MouseEvent) => {
        if (!contentRef?.contains(e.target as Node)) ctx.setOpen(false);
      };
      const onKeyDown = (e: KeyboardEvent) => {
        if (e.key === "Escape") ctx.setOpen(false);
      };
      document.addEventListener("mousedown", onMouseDown);
      document.addEventListener("keydown", onKeyDown);
      return () => {
        window.cancelAnimationFrame(animationFrame);
        resizeObserver.disconnect();
        window.removeEventListener("resize", clampPosition);
        document.removeEventListener("mousedown", onMouseDown);
        document.removeEventListener("keydown", onKeyDown);
      };
    },
  );

  return (
    <Show when={ctx.open()}>
      <div
        ref={contentRef}
        style={{
          position: "fixed",
          left: `${contentPosition().x}px`,
          top: `${contentPosition().y}px`,
          "max-height": `calc(100vh - ${VIEWPORT_PADDING * 2}px)`,
          "max-width": `calc(100vw - ${VIEWPORT_PADDING * 2}px)`,
          overflow: "auto",
          visibility: positionReady() ? "visible" : "hidden",
        }}
        class={cn("motion-context-menu-content", menuContentClass, props.class)}
      >
        {props.children}
      </div>
    </Show>
  );
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function ContextMenuItem(props: { children: JSX.Element; class?: string; onClick?: () => void }) {
  const ctx = useContext(ContextMenuContext);

  return (
    <div
      class={cn(menuItemClass, props.class)}
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

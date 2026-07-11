import { createContext, createSignal, omit, useContext, createMemo, untrack } from "solid-js";
import type { JSX } from "@solidjs/web";
import { cn } from "@/lib/utils";
import {
  menuContentClass,
  menuInsetClass,
  menuItemClass,
  menuLabelClass,
  menuShortcutClass,
  menuSubContentClass,
} from "./menu-styles";

type DropdownMenuContextType = {
  open: () => boolean;
  setOpen: (open: boolean) => void;
  triggerRect: () => DOMRect | null;
  setTriggerRect: (rect: DOMRect | null) => void;
};

type DropdownMenuPosition = {
  top: number;
  left?: number;
  right?: number;
  transform?: string;
};

type DropdownMenuSide = "bottom" | "right";

const DropdownMenuContext = createContext<DropdownMenuContextType>({
  open: () => false,
  setOpen: () => {},
  triggerRect: () => null,
  setTriggerRect: () => {},
});

function DropdownMenu(props: {
  children: JSX.Element;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const [uncontrolled, setUncontrolled] = createSignal(false);
  const controlledOpen = createMemo(() => props.open);
  const onOpenChange = createMemo(() => props.onOpenChange);
  const isControlled = () => controlledOpen() !== undefined;
  const open = () => (isControlled() ? (controlledOpen() ?? false) : uncontrolled());
  const setOpen = (v: boolean) => {
    if (!untrack(isControlled)) setUncontrolled(v);
    untrack(onOpenChange)?.(v);
  };
  const [triggerRect, setTriggerRect] = createSignal<DOMRect | null>(null);

  return (
    <DropdownMenuContext value={{ open, setOpen, triggerRect, setTriggerRect }}>
      {props.children}
    </DropdownMenuContext>
  );
}

function DropdownMenuTrigger(props: { children: JSX.Element; asChild?: boolean }) {
  const ctx = useContext(DropdownMenuContext);

  function getTriggerElement(target: EventTarget | null): Element | null {
    if (!(target instanceof Element)) return null;
    return target.closest("button,a,[role='button']") ?? target;
  }

  return (
    <span
      style={{ display: "contents" }}
      onClick={(e) => {
        const trigger = getTriggerElement(e.target);
        ctx.setTriggerRect(trigger?.getBoundingClientRect() ?? null);
        ctx.setOpen(!untrack(ctx.open));
      }}
    >
      {props.children}
    </span>
  );
}

function DropdownMenuContent(props: {
  children: JSX.Element;
  class?: string;
  align?: "start" | "end" | "center";
  side?: DropdownMenuSide;
  sideOffset?: number;
}) {
  const ctx = useContext(DropdownMenuContext);
  const align = () => props.align ?? "start";
  const side = () => props.side ?? "bottom";
  const sideOffset = () => props.sideOffset ?? 4;

  const content = createMemo<JSX.Element>(() => {
    if (!ctx.open()) return null;

    const rect = ctx.triggerRect();
    if (rect === null) return null;

    const a = align();
    const position =
      side() === "right"
        ? positionRightMenu(rect, a, sideOffset())
        : positionBottomMenu(rect, a, sideOffset());

    return (
      <>
        <div aria-hidden="true" class="fixed inset-0 z-40" onMouseDown={() => ctx.setOpen(false)} />
        <div
          style={{
            position: "fixed",
            top: `${position.top}px`,
            ...(position.right !== undefined
              ? { right: `${position.right}px` }
              : { left: `${position.left}px` }),
            "--menu-translate": position.transform ?? "translateX(0)",
          }}
          data-align={a}
          data-side={side()}
          class={cn("motion-menu-content", menuContentClass, props.class)}
        >
          {props.children}
        </div>
      </>
    );
  });

  return <>{content()}</>;
}

function positionBottomMenu(
  rect: DOMRect,
  align: "start" | "end" | "center",
  sideOffset: number,
): DropdownMenuPosition {
  return {
    top: rect.bottom + sideOffset,
    ...(align === "end"
      ? { right: window.innerWidth - rect.right }
      : align === "center"
        ? { left: rect.left + rect.width / 2, transform: "translateX(-50%)" }
        : { left: rect.left }),
  };
}

function positionRightMenu(
  rect: DOMRect,
  align: "start" | "end" | "center",
  sideOffset: number,
): DropdownMenuPosition {
  return {
    left: rect.right + sideOffset,
    ...(align === "end"
      ? { top: rect.bottom, transform: "translateY(-100%)" }
      : align === "center"
        ? { top: rect.top + rect.height / 2, transform: "translateY(-50%)" }
        : { top: rect.top }),
  };
}

function DropdownMenuItem(props: {
  children: JSX.Element;
  class?: string;
  onClick?: () => void;
  inset?: boolean;
}) {
  const ctx = useContext(DropdownMenuContext);

  return (
    <div
      class={cn(menuItemClass, props.inset && menuInsetClass, props.class)}
      onMouseDown={(e) => e.preventDefault()}
      onClick={() => {
        props.onClick?.();
        ctx.setOpen(false);
      }}
    >
      {props.children}
    </div>
  );
}

function DropdownMenuLabel(props: { children: JSX.Element; class?: string; inset?: boolean }) {
  return (
    <div class={cn(menuLabelClass, props.inset && menuInsetClass, props.class)}>
      {props.children}
    </div>
  );
}

function DropdownMenuShortcut(props: JSX.HTMLAttributes<HTMLSpanElement>) {
  const rest = omit(props, "class");
  return <span class={cn(menuShortcutClass, "opacity-60", props.class)} {...rest} />;
}

// Pass-through stubs for API compatibility
const DropdownMenuGroup = (props: { children: JSX.Element }) => <>{props.children}</>;
const DropdownMenuPortal = (props: { children: JSX.Element }) => <>{props.children}</>;
const DropdownMenuSub = (props: { children: JSX.Element }) => <>{props.children}</>;
const DropdownMenuRadioGroup = (props: { children: JSX.Element }) => <>{props.children}</>;
const DropdownMenuSubTrigger = (props: { children: JSX.Element; class?: string }) => (
  <div class={cn(menuItemClass, props.class)}>{props.children}</div>
);
const DropdownMenuSubContent = (props: { children: JSX.Element; class?: string }) => (
  <div class={cn(menuSubContentClass, props.class)}>{props.children}</div>
);
const DropdownMenuCheckboxItem = (props: { children: JSX.Element; class?: string }) => (
  <div class={cn(menuItemClass, menuInsetClass, props.class)}>{props.children}</div>
);
const DropdownMenuRadioItem = (props: { children: JSX.Element; class?: string }) => (
  <div class={cn(menuItemClass, menuInsetClass, props.class)}>{props.children}</div>
);

export {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuCheckboxItem,
  DropdownMenuRadioItem,
  DropdownMenuLabel,
  DropdownMenuShortcut,
  DropdownMenuGroup,
  DropdownMenuPortal,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuRadioGroup,
};

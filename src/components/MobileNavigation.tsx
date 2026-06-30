import type { JSX } from "@solidjs/web";
import { createContext, useContext } from "solid-js";
import { Menu } from "./Icons";
import { Button } from "./ui/button";
import { cn } from "@/lib/utils";

type MobileNavigationContextValue = {
  openDrawer: () => void;
};

const MobileNavigationContext = createContext<MobileNavigationContextValue>({
  openDrawer: () => {},
});

export function MobileNavigationProvider(props: { children: JSX.Element; openDrawer: () => void }) {
  return (
    <MobileNavigationContext value={{ openDrawer: props.openDrawer }}>
      {props.children}
    </MobileNavigationContext>
  );
}

export function MobileNavigationTrigger(props: { class?: string }) {
  const navigation = useContext(MobileNavigationContext);

  return (
    <Button
      variant="outline"
      size="icon"
      aria-label="Open navigation"
      class={cn("xl:hidden", props.class)}
      onClick={navigation.openDrawer}
    >
      <Menu />
    </Button>
  );
}

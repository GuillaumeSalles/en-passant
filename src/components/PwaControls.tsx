import { createContext, createMemo, createSignal, onSettled, Show, useContext } from "solid-js";
import type { JSX } from "@solidjs/web";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Download, RefreshCw, WifiOff } from "@/components/Icons";
import { isIosDevice, isSafariBrowser, isStandaloneApp } from "@/lib/browser";
import { activateServiceWorkerUpdate, subscribeToServiceWorkerUpdates } from "@/lib/serviceWorker";

type InstallChoice = {
  outcome: "accepted" | "dismissed";
  platform: string;
};

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<InstallChoice>;
};

type PwaContextValue = {
  canInstall: () => boolean;
  install: () => Promise<void>;
  instructionsOpen: () => boolean;
  setInstructionsOpen: (open: boolean) => void;
  updateAvailable: () => boolean;
  dismissUpdate: () => void;
  applyUpdate: () => void;
};

const PwaContext = createContext<PwaContextValue>();

function usePwa(): PwaContextValue {
  const context = useContext(PwaContext);
  if (context === undefined) throw new Error("PWA controls require PwaProvider");
  return context;
}

export function PwaProvider(props: { children: JSX.Element }) {
  const [installPrompt, setInstallPrompt] = createSignal<InstallPromptEvent | null>(null);
  const [installed, setInstalled] = createSignal(isStandaloneApp());
  const [instructionsOpen, setInstructionsOpen] = createSignal(false);
  const [updateAvailable, setUpdateAvailable] = createSignal(false);
  const [updateDismissed, setUpdateDismissed] = createSignal(false);
  const [online, setOnline] = createSignal(navigator.onLine);

  const canInstall = createMemo(
    () => !installed() && (installPrompt() !== null || isIosDevice() || isSafariBrowser()),
  );

  onSettled(() => {
    const displayMode = window.matchMedia("(display-mode: standalone)");

    function captureInstallPrompt(event: Event) {
      event.preventDefault();
      setInstallPrompt(event as InstallPromptEvent);
    }

    function markInstalled() {
      setInstalled(true);
      setInstallPrompt(null);
      setInstructionsOpen(false);
    }

    function readDisplayMode() {
      setInstalled(isStandaloneApp());
    }

    function markOnline() {
      setOnline(true);
    }

    function markOffline() {
      setOnline(false);
    }

    const unsubscribeFromUpdates = subscribeToServiceWorkerUpdates(() => {
      setUpdateDismissed(false);
      setUpdateAvailable(true);
    });

    window.addEventListener("beforeinstallprompt", captureInstallPrompt);
    window.addEventListener("appinstalled", markInstalled);
    window.addEventListener("online", markOnline);
    window.addEventListener("offline", markOffline);
    displayMode.addEventListener("change", readDisplayMode);

    return () => {
      unsubscribeFromUpdates();
      window.removeEventListener("beforeinstallprompt", captureInstallPrompt);
      window.removeEventListener("appinstalled", markInstalled);
      window.removeEventListener("online", markOnline);
      window.removeEventListener("offline", markOffline);
      displayMode.removeEventListener("change", readDisplayMode);
    };
  });

  async function install(): Promise<void> {
    const prompt = installPrompt();
    if (prompt === null) {
      setInstructionsOpen(true);
      return;
    }

    setInstallPrompt(null);
    try {
      await prompt.prompt();
      const choice = await prompt.userChoice;
      if (choice.outcome === "accepted") setInstalled(true);
    } catch {
      // Browser-owned install prompts can disappear when platform state changes.
    }
  }

  function applyUpdate() {
    if (!activateServiceWorkerUpdate()) setUpdateAvailable(false);
  }

  const context: PwaContextValue = {
    canInstall,
    install,
    instructionsOpen,
    setInstructionsOpen,
    updateAvailable: () => updateAvailable() && !updateDismissed(),
    dismissUpdate: () => setUpdateDismissed(true),
    applyUpdate,
  };

  return (
    <PwaContext value={context}>
      {props.children}
      <PwaInstallDialog />
      <PwaOfflineStatus online={online()} />
      <PwaUpdatePrompt />
    </PwaContext>
  );
}

function PwaOfflineStatus(props: { online: boolean }) {
  return (
    <Show when={!props.online}>
      <div
        class="motion-update-prompt fixed bottom-3 left-3 z-[59] flex items-center gap-2 rounded-md border border-border bg-popover px-3 py-2 text-xs text-popover-foreground shadow-lg"
        role="status"
        aria-live="polite"
      >
        <WifiOff />
        Offline · Changes will sync when you reconnect
      </div>
    </Show>
  );
}

export function PwaInstallButton(props: { class?: string | undefined } = {}) {
  const pwa = usePwa();

  return (
    <Show when={pwa.canInstall()}>
      <Button
        type="button"
        variant="outline"
        class={props.class}
        onClick={() => void pwa.install()}
      >
        <Download />
        Install
      </Button>
    </Show>
  );
}

function PwaInstallDialog() {
  const pwa = usePwa();

  return (
    <Dialog state={{ open: pwa.instructionsOpen, onOpenChange: pwa.setInstructionsOpen }}>
      <DialogContent class="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Install En passant</DialogTitle>
          <DialogDescription>
            {isIosDevice()
              ? "Tap Share, then Add to Home Screen."
              : "In Safari, choose File, then Add to Dock."}
          </DialogDescription>
        </DialogHeader>
        <div class="rounded-md border border-border bg-muted/30 p-3 text-sm leading-6 text-muted-foreground">
          Once installed, En passant opens in its own window and keeps your local repertoire
          available offline.
        </div>
        <DialogFooter>
          <Button type="button" onClick={() => pwa.setInstructionsOpen(false)}>
            Got it
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PwaUpdatePrompt() {
  const pwa = usePwa();

  return (
    <Show when={pwa.updateAvailable()}>
      <div
        class="motion-update-prompt fixed bottom-3 left-3 right-3 z-[60] flex flex-col gap-3 rounded-lg border border-border bg-popover p-3 text-popover-foreground shadow-xl sm:left-auto sm:w-[24rem] sm:flex-row sm:items-center"
        role="region"
        aria-label="Application update"
      >
        <div class="min-w-0 flex-1">
          <p class="text-sm font-medium" role="status">
            Update ready
          </p>
          <p class="mt-0.5 text-xs leading-5 text-muted-foreground">
            Reload to use the latest version.
          </p>
        </div>
        <div class="flex flex-none gap-2">
          <Button type="button" variant="ghost" size="sm" onClick={pwa.dismissUpdate}>
            Later
          </Button>
          <Button type="button" size="sm" onClick={pwa.applyUpdate}>
            <RefreshCw />
            Reload
          </Button>
        </div>
      </div>
    </Show>
  );
}

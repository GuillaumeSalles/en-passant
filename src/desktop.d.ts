import type { DesktopAuthAccountKind } from "@/lib/desktopAuth";

type EnPassantDesktopBridge = {
  requestGoogleSignIn: () => Promise<void>;
  onGoogleSignInComplete: (callback: (accountKind: DesktopAuthAccountKind) => void) => () => void;
  onGoogleSignInError: (callback: (message: string) => void) => () => void;
};

declare global {
  interface Window {
    enPassantDesktop?: EnPassantDesktopBridge | undefined;
  }
}

export {};

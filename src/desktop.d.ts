import type { AuthEvent } from "@/lib/authRedirect";

type EnPassantDesktopBridge = {
  requestGoogleSignIn: () => Promise<void>;
  onGoogleSignInComplete: (callback: (event: AuthEvent) => void) => () => void;
  onGoogleSignInError: (callback: (message: string) => void) => () => void;
};

declare global {
  interface Window {
    enPassantDesktop?: EnPassantDesktopBridge | undefined;
  }
}

export {};

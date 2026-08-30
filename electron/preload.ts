import { contextBridge, ipcRenderer } from "electron";

// Sandboxed preloads cannot require relative Vite chunks, so keep these channel names inline.
const REQUEST_GOOGLE_AUTH_CHANNEL = "en-passant:request-google-auth";
const GOOGLE_AUTH_COMPLETE_CHANNEL = "en-passant:google-auth-complete";
const GOOGLE_AUTH_ERROR_CHANNEL = "en-passant:google-auth-error";

type AuthEvent = "signin" | "signup";

contextBridge.exposeInMainWorld("enPassantDesktop", {
  requestGoogleSignIn: async (): Promise<void> => {
    await ipcRenderer.invoke(REQUEST_GOOGLE_AUTH_CHANNEL);
  },
  onGoogleSignInComplete(callback: (event: AuthEvent) => void): () => void {
    const listener = (_event: Electron.IpcRendererEvent, authEvent: unknown) => {
      if (authEvent === "signin" || authEvent === "signup") callback(authEvent);
    };
    ipcRenderer.on(GOOGLE_AUTH_COMPLETE_CHANNEL, listener);
    return () => ipcRenderer.removeListener(GOOGLE_AUTH_COMPLETE_CHANNEL, listener);
  },
  onGoogleSignInError(callback: (message: string) => void): () => void {
    const listener = (_event: Electron.IpcRendererEvent, message: unknown) => {
      callback(typeof message === "string" ? message : "Google sign in failed.");
    };
    ipcRenderer.on(GOOGLE_AUTH_ERROR_CHANNEL, listener);
    return () => ipcRenderer.removeListener(GOOGLE_AUTH_ERROR_CHANNEL, listener);
  },
});

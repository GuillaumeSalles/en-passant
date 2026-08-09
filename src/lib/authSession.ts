import { createSignal } from "solid-js";
import { authClient } from "@/lib/authClient";

export type AuthUser = {
  id: string;
  email: string;
  name: string;
  pictureUrl: string | null;
};

export type AuthStatus = "loading" | "signed-in" | "signed-out";

export const AUTH_SESSION_REFRESH_INTERVAL_MS = 12 * 60 * 60 * 1000;

type SessionUser = {
  id: string;
  email: string;
  name: string;
  image?: string | null | undefined;
};

const [currentAuthUser, setCurrentAuthUser] = createSignal<AuthUser | null>(null);
const [authStatus, setAuthStatus] = createSignal<AuthStatus>("loading");

export { authStatus, currentAuthUser };

export function isSignedIn(): boolean {
  return currentAuthUser() !== null;
}

function mapSessionUser(user: SessionUser | null | undefined): AuthUser | null {
  if (user === null || user === undefined) {
    return null;
  }

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    pictureUrl: user.image ?? null,
  };
}

export async function refreshAuthSession(): Promise<AuthUser | null> {
  const { data, error } = await authClient.getSession();
  if (error !== null) {
    if (error.status === 401) {
      clearAuthSession();
    }
    return currentAuthUser();
  }

  const user = mapSessionUser(data?.user);
  setCurrentAuthUser(user);
  setAuthStatus(user === null ? "signed-out" : "signed-in");
  return user;
}

export function clearAuthSession(): void {
  setCurrentAuthUser(null);
  setAuthStatus("signed-out");
}

export function startAuthSessionRenewal(
  refreshSession: () => Promise<unknown> = refreshAuthSession,
): () => void {
  let refreshInFlight: Promise<unknown> | null = null;

  function renewSession(): void {
    if (refreshInFlight !== null) return;
    refreshInFlight = refreshSession()
      .catch(() => undefined)
      .finally(() => {
        refreshInFlight = null;
      });
  }

  function renewVisibleSession(): void {
    if (document.visibilityState === "visible") {
      renewSession();
    }
  }

  window.addEventListener("focus", renewSession);
  document.addEventListener("visibilitychange", renewVisibleSession);
  const intervalId = window.setInterval(renewVisibleSession, AUTH_SESSION_REFRESH_INTERVAL_MS);

  return () => {
    window.removeEventListener("focus", renewSession);
    document.removeEventListener("visibilitychange", renewVisibleSession);
    window.clearInterval(intervalId);
  };
}

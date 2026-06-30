import { createSignal } from "solid-js";
import { authClient } from "@/lib/authClient";

export type AuthUser = {
  id: string;
  email: string;
  name: string;
  pictureUrl: string | null;
};

export type AuthStatus = "loading" | "signed-in" | "signed-out";

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
    setCurrentAuthUser(null);
    setAuthStatus("signed-out");
    return null;
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

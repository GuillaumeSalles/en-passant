import desktopAuth from "../../desktop-auth.config.json";

const PENDING_SOCIAL_SIGN_IN_KEY = "en_passant_pending_social_sign_in";

export type AuthEvent = "signin" | "signup";

export function authEventFromUrl(): AuthEvent | null {
  const event = new URL(window.location.href).searchParams.get("auth_event");
  return event === "signin" || event === "signup" ? event : null;
}

export function authCallbackUrl(event: AuthEvent, currentUrl = window.location.href): string {
  const current = new URL(currentUrl);
  const url =
    current.protocol === "app:"
      ? new URL(
          `${current.pathname}${current.search}${current.hash}`,
          desktopAuth.productionAppOrigin,
        )
      : current;
  url.searchParams.set("auth_event", event);
  return url.toString();
}

export function consumeAuthEvent(): AuthEvent | null {
  const url = new URL(window.location.href);
  const event = authEventFromUrl();
  if (url.searchParams.has("auth_event")) {
    url.searchParams.delete("auth_event");
    window.history.replaceState(window.history.state, "", url.toString());
  }
  if (event === "signup") {
    clearPendingSocialSignIn();
  }
  return event;
}

export function markPendingSocialSignIn(): void {
  window.sessionStorage.setItem(PENDING_SOCIAL_SIGN_IN_KEY, "1");
}

export function clearPendingSocialSignIn(): void {
  window.sessionStorage.removeItem(PENDING_SOCIAL_SIGN_IN_KEY);
}

export function hasPendingExistingSocialSignIn(): boolean {
  return (
    window.sessionStorage.getItem(PENDING_SOCIAL_SIGN_IN_KEY) === "1" &&
    authEventFromUrl() !== "signup"
  );
}

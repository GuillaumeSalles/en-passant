import { createSignal, onSettled, Show } from "solid-js";
import { FullWidthLayout } from "@/components/FullWidthLayout";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/authClient";
import { authCallbackUrl, authEventFromUrl, type AuthEvent } from "@/lib/authRedirect";
import {
  clearDesktopAuthorizationCookie,
  desktopAuthContextFromUrl,
  desktopAuthDeepLink,
  desktopAuthorizationCodeFromUrl,
  type DesktopAuthContext,
} from "@/lib/desktopAuth";

async function startGoogleSignIn(context: DesktopAuthContext): Promise<string | null> {
  clearDesktopAuthorizationCookie();
  const { data, error } = await authClient.signIn.social({
    provider: "google",
    callbackURL: authCallbackUrl("signin"),
    newUserCallbackURL: authCallbackUrl("signup"),
    disableRedirect: true,
    fetchOptions: { query: context },
  });
  if (error !== null) return error.message ?? "Google sign in failed.";
  if (data?.url === undefined) return "Google sign in did not return a redirect.";
  window.location.assign(data.url);
  return null;
}

export function DesktopAuthBroker() {
  const [desktopUrl, setDesktopUrl] = createSignal<string | null>(null);
  const [error, setError] = createSignal<string | null>(null);

  onSettled(() => {
    const context = desktopAuthContextFromUrl();
    if (context === null) {
      setError("This desktop sign-in link is invalid or has expired.");
      return;
    }

    const authEvent = authEventFromUrl();
    if (authEvent === null) {
      void startGoogleSignIn(context).then((message) => {
        if (message !== null) setError(message);
      });
      return;
    }

    function captureAuthorizationCode(event: AuthEvent): boolean {
      const tokenFromUrl = desktopAuthorizationCodeFromUrl();
      const token = tokenFromUrl ?? authClient.electron.getAuthorizationCode();
      if (token === null) return false;
      clearDesktopAuthorizationCookie();
      if (tokenFromUrl !== null) {
        const currentUrl = new URL(window.location.href);
        currentUrl.hash = "";
        window.history.replaceState(window.history.state, "", currentUrl.toString());
      }
      setDesktopUrl(desktopAuthDeepLink(event, token));
      return true;
    }

    if (captureAuthorizationCode(authEvent)) return;
    const intervalId = window.setInterval(() => {
      if (captureAuthorizationCode(authEvent)) window.clearInterval(intervalId);
    }, 100);
    const timeoutId = window.setTimeout(() => {
      window.clearInterval(intervalId);
      setError(
        "The desktop authorization code was not received. Start sign in again from En Passant.",
      );
    }, 10_000);
    return () => {
      window.clearInterval(intervalId);
      window.clearTimeout(timeoutId);
    };
  });

  return (
    <FullWidthLayout reserveRightSlot showMobileHeaderDivider={false}>
      <div class="flex h-full items-center justify-center p-6">
        <div class="grid max-w-md gap-4 text-center">
          <h1 class="text-xl font-semibold">Continue in En Passant</h1>
          <Show
            when={error()}
            fallback={
              <Show
                when={desktopUrl()}
                fallback={<p class="text-sm text-muted-foreground">Finishing Google sign in…</p>}
              >
                {(url) => (
                  <>
                    <p class="text-sm text-muted-foreground">
                      Google sign in is complete. Return to the desktop app to finish.
                    </p>
                    <Button href={url()}>Open En Passant</Button>
                  </>
                )}
              </Show>
            }
          >
            {(message) => <p class="text-sm text-destructive">{message()}</p>}
          </Show>
        </div>
      </div>
    </FullWidthLayout>
  );
}

export default DesktopAuthBroker;

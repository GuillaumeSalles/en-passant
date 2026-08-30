import { createSignal, onSettled, Show } from "solid-js";
import { FullWidthLayout } from "@/components/FullWidthLayout";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/authClient";
import { authCallbackUrl, authEventFromUrl } from "@/lib/authRedirect";
import {
  clearDesktopAuthorizationCookie,
  desktopAuthContextFromUrl,
  desktopAuthLoopbackUrl,
  desktopAuthPluginContext,
  desktopAuthorizationCode,
  requestDesktopAuthAssertion,
  type DesktopAuthContext,
} from "@/lib/desktopAuth";

async function startGoogleSignIn(context: DesktopAuthContext): Promise<void> {
  clearDesktopAuthorizationCookie();
  const { data, error } = await authClient.signIn.social({
    provider: "google",
    callbackURL: authCallbackUrl("signin"),
    newUserCallbackURL: authCallbackUrl("signup"),
    disableRedirect: true,
    fetchOptions: { query: desktopAuthPluginContext(context) },
  });
  if (error !== null) throw new Error(error.message ?? "Google sign in failed.");
  if (data?.url === undefined) throw new Error("Google sign in did not return a redirect.");
  window.location.assign(data.url);
}

export function DesktopAuthBroker() {
  const [context, setContext] = createSignal<DesktopAuthContext | null>(null);
  const [desktopUrl, setDesktopUrl] = createSignal<string | null>(null);
  const [error, setError] = createSignal<string | null>(null);
  const [isStarting, setIsStarting] = createSignal(false);
  const [isCompleting, setIsCompleting] = createSignal(false);

  function beginSignIn(): void {
    const currentContext = context();
    if (currentContext === null || isStarting()) return;
    setIsStarting(true);
    void startGoogleSignIn(currentContext).catch((cause: unknown) => {
      setIsStarting(false);
      setError(cause instanceof Error ? cause.message : "Google sign in failed.");
    });
  }

  onSettled(() => {
    const currentContext = desktopAuthContextFromUrl();
    if (currentContext === null) {
      setError("This desktop sign-in link is invalid or has expired.");
      return;
    }

    const authEvent = authEventFromUrl();
    if (authEvent === null) {
      setContext(currentContext);
      return;
    }

    const token = desktopAuthorizationCode();
    if (token === null) {
      setError(
        "The desktop authorization code was not received. Start sign in again from En Passant.",
      );
      return;
    }

    setIsCompleting(true);
    void requestDesktopAuthAssertion(token, authEvent)
      .then((assertion) => {
        clearDesktopAuthorizationCookie();
        setDesktopUrl(desktopAuthLoopbackUrl(currentContext, token, assertion));
      })
      .catch(() => setError("Desktop authorization could not be completed. Please try again."));
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
                fallback={
                  <Show
                    when={!isCompleting()}
                    fallback={
                      <p class="text-sm text-muted-foreground">Finishing Google sign in…</p>
                    }
                  >
                    <p class="text-sm text-muted-foreground">
                      The En Passant desktop app is requesting access to your account. Continue only
                      if you opened this page from the desktop app.
                    </p>
                    <Button type="button" disabled={isStarting()} onClick={beginSignIn}>
                      {isStarting() ? "Opening Google…" : "Continue with Google"}
                    </Button>
                  </Show>
                }
              >
                {(url) => (
                  <>
                    <p class="text-sm text-muted-foreground">
                      Google sign in is complete. Return to the desktop app to finish.
                    </p>
                    <Button href={url()}>Return to En Passant</Button>
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

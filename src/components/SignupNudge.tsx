import { createEffect, createSignal, Show } from "solid-js";
import { Button } from "@/components/ui/button";
import { CloseButton } from "@/components/ui/close-button";
import { dismissSignupNudge, shouldShowSignupNudge, signupNudgeVersion } from "@/lib/signupNudge";
import { isSignedIn } from "@/lib/authSession";

export function SignupNudgePanel(props: { onDismiss: () => void; onSignUp: () => void }) {
  return (
    <div class="absolute bottom-3 left-3 z-30 w-72 rounded-md border border-border bg-background p-3 shadow-lg">
      <CloseButton
        label="Dismiss sign up reminder"
        class="absolute right-2 top-2 rounded-sm text-muted-foreground hover:text-foreground"
        onClick={props.onDismiss}
      />
      <p class="pr-6 text-sm text-muted-foreground">
        Sign up to make sure you don't lose your repertoires. It's free.
      </p>
      <div class="mt-3 flex justify-end">
        <Button size="sm" onClick={props.onSignUp}>
          Sign up
        </Button>
      </div>
    </div>
  );
}

export function SignupNudge() {
  const [isVisible, setIsVisible] = createSignal(false);

  function updateVisibility(signedIn: boolean): void {
    setIsVisible(shouldShowSignupNudge(signedIn));
  }

  function dismiss(): void {
    dismissSignupNudge();
    updateVisibility(isSignedIn());
  }

  function signUp(): void {
    document.dispatchEvent(new CustomEvent("en-passant:open-auth-dialog"));
  }

  createEffect(
    () => ({
      signedIn: isSignedIn(),
      version: signupNudgeVersion(),
    }),
    ({ signedIn }) => updateVisibility(signedIn),
  );

  return (
    <Show when={isVisible()}>
      <SignupNudgePanel onDismiss={dismiss} onSignUp={signUp} />
    </Show>
  );
}

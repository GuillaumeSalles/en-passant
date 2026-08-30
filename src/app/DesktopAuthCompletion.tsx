import { onSettled } from "solid-js";
import { finishAuthenticatedAccountFlow } from "@/lib/authBootstrap";
import { clearPendingSocialSignIn } from "@/lib/authRedirect";
import { refreshAuthSession } from "@/lib/authSession";
import { DESKTOP_AUTH_ERROR_EVENT } from "@/lib/desktopAuth";

function reportDesktopAuthError(message: string): void {
  clearPendingSocialSignIn();
  document.dispatchEvent(new CustomEvent(DESKTOP_AUTH_ERROR_EVENT, { detail: message }));
}

export function DesktopAuthCompletion() {
  onSettled(() => {
    const desktop = window.enPassantDesktop;
    if (desktop === undefined) return;

    const unsubscribeComplete = desktop.onGoogleSignInComplete((accountKind) => {
      void refreshAuthSession()
        .then(async (user) => {
          if (user === null) throw new Error("Google sign in did not create a session.");
          await finishAuthenticatedAccountFlow(accountKind);
        })
        .catch(() => reportDesktopAuthError("Google sign in failed."));
    });
    const unsubscribeError = desktop.onGoogleSignInError(reportDesktopAuthError);

    return () => {
      unsubscribeComplete();
      unsubscribeError();
    };
  });

  return null;
}

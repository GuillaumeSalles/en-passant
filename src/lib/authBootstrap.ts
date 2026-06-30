import { deleteIndexedDbDatabase } from "@/storage";
import { queueRepertoireSync } from "@/storage/backendSync";
import { resetSignupNudge } from "@/lib/signupNudge";
import {
  clearPendingSocialSignIn,
  consumeAuthEvent,
  hasPendingExistingSocialSignIn,
} from "@/lib/authRedirect";

export type AuthenticatedAccountKind = "new" | "existing";

export function accountKindFromIsNewUser(isNewUser: boolean): AuthenticatedAccountKind {
  return isNewUser ? "new" : "existing";
}

export function consumeRedirectAccountKind(): AuthenticatedAccountKind | null {
  const authEvent = consumeAuthEvent();
  if (authEvent === null) {
    return null;
  }
  return authEvent === "signup" ? "new" : "existing";
}

export function shouldResetLocalDataForExistingSocialAccount(): boolean {
  return hasPendingExistingSocialSignIn();
}

export async function resetLocalDataForExistingAccount(): Promise<void> {
  clearPendingSocialSignIn();
  await deleteIndexedDbDatabase();
}

export async function finishAuthenticatedAccountFlow(
  accountKind: AuthenticatedAccountKind,
): Promise<void> {
  if (accountKind === "new") {
    resetSignupNudge();
    clearPendingSocialSignIn();
    queueRepertoireSync();
    return;
  }

  await resetLocalDataForExistingAccount();
  window.location.reload();
}

import { onSettled, createSignal, Show } from "solid-js";
import { ChevronDown, LogIn, LogOut } from "./Icons";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { clearAuthSession, currentAuthUser, refreshAuthSession } from "@/lib/authSession";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { deleteIndexedDbDatabase } from "@/storage";
import { authClient } from "@/lib/authClient";
import {
  authCallbackUrl,
  clearPendingSocialSignIn,
  markPendingSocialSignIn,
} from "@/lib/authRedirect";
import {
  accountKindFromIsNewUser,
  consumeRedirectAccountKind,
  finishAuthenticatedAccountFlow,
} from "@/lib/authBootstrap";

type EmailAuthStep = "email" | "code";

type EmailOtpSignInResult = { ok: true; isNewUser: boolean } | { ok: false; message: string };
type EmailOtpResponse = { isNewUser: boolean };
type AuthButtonMenuSide = "bottom" | "top";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

async function readAuthErrorMessage(response: Response): Promise<string> {
  const body = await response
    .clone()
    .json()
    .catch(() => null);
  const message = isRecord(body) ? body["message"] : undefined;
  if (typeof message === "string") {
    return message;
  }
  return "Sign in failed.";
}

async function signInWithEmailOtp(email: string, otp: string): Promise<EmailOtpSignInResult> {
  const response = await fetch("/api/auth/sign-in/email-otp", {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({
      email,
      otp,
      name: email,
    }),
  });

  if (!response.ok) {
    return {
      ok: false,
      message: await readAuthErrorMessage(response),
    };
  }

  const body = (await response.json()) as EmailOtpResponse;
  return {
    ok: true,
    isNewUser: body.isNewUser,
  };
}

function userDisplayName(user: { email: string; name: string }): string {
  return user.name || user.email;
}

function userInitial(user: { email: string; name: string }): string {
  return userDisplayName(user).trim().charAt(0).toUpperCase() || "?";
}

export function AuthButton(
  props: { class?: string | undefined; menuSide?: AuthButtonMenuSide | undefined } = {},
) {
  const [step, setStep] = createSignal<EmailAuthStep>("email");
  const [email, setEmail] = createSignal("");
  const [code, setCode] = createSignal("");
  const [error, setError] = createSignal<string | null>(null);
  const [isSubmitting, setIsSubmitting] = createSignal(false);
  const [isAuthDialogOpen, setIsAuthDialogOpen] = createSignal(false);

  onSettled(() => {
    const accountKind = consumeRedirectAccountKind();
    refreshAuthSession()
      .then(async (user) => {
        // The repertoire loader owns existing-account social callbacks so it can
        // reset local data and pull remote data as one ordered operation.
        if (user !== null && accountKind === "new") {
          await finishAuthenticatedAccountFlow(accountKind);
        }
      })
      .catch(() => clearAuthSession());
  });

  onSettled(() => {
    function openAuthDialog() {
      setIsAuthDialogOpen(true);
    }
    document.addEventListener("en-passant:open-auth-dialog", openAuthDialog);
    return () => {
      document.removeEventListener("en-passant:open-auth-dialog", openAuthDialog);
    };
  });

  async function loginWithGoogle() {
    setError(null);
    markPendingSocialSignIn();
    const { data, error } = await authClient.signIn.social({
      provider: "google",
      callbackURL: authCallbackUrl("signin"),
      newUserCallbackURL: authCallbackUrl("signup"),
      disableRedirect: true,
    });
    if (error !== null) {
      clearPendingSocialSignIn();
      setError(error.message ?? "Google sign in failed.");
      return;
    }
    if (data?.url !== undefined) {
      window.location.href = data.url;
    }
  }

  async function requestEmailCode(event: SubmitEvent) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);
    const { error: requestError } = await authClient.emailOtp.sendVerificationOtp({
      email: email(),
      type: "sign-in",
    });
    setIsSubmitting(false);
    if (requestError === null) {
      setCode("");
      setStep("code");
      return;
    }
    setError(requestError.message ?? "Could not send code.");
  }

  async function verifyEmailCode(event: SubmitEvent) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);
    const signInResult = await signInWithEmailOtp(email(), code());
    setIsSubmitting(false);
    if (signInResult.ok) {
      await refreshAuthSession();
      const accountKind = accountKindFromIsNewUser(signInResult.isNewUser);
      if (accountKind === "new") {
        await finishAuthenticatedAccountFlow(accountKind);
        setIsAuthDialogOpen(false);
        setStep("email");
        setCode("");
      } else {
        await finishAuthenticatedAccountFlow(accountKind);
      }
      return;
    }
    setError(signInResult.message);
  }

  function logout() {
    authClient
      .signOut()
      .then(async () => {
        clearAuthSession();
        await deleteIndexedDbDatabase();
        window.location.reload();
      })
      .catch(() => undefined);
  }

  return (
    <Show
      when={currentAuthUser()}
      fallback={
        <Dialog state={{ open: isAuthDialogOpen(), onOpenChange: setIsAuthDialogOpen }}>
          <DialogTrigger>
            <Button variant="outline" class={props.class}>
              <LogIn class="mr-2 h-4 w-4" />
              Sign in
            </Button>
          </DialogTrigger>
          <DialogContent class="max-w-sm">
            <DialogHeader>
              <DialogTitle>Sign in</DialogTitle>
              <DialogDescription>Use Google or your email.</DialogDescription>
            </DialogHeader>

            <Button variant="outline" onClick={loginWithGoogle}>
              Continue with Google
            </Button>

            <Show
              when={step() === "email"}
              fallback={
                <form class="grid gap-3" onSubmit={verifyEmailCode}>
                  <Field>
                    <FieldLabel>Code</FieldLabel>
                    <Input
                      value={code()}
                      onInput={(event) => setCode(event.currentTarget.value)}
                      autocomplete="one-time-code"
                      inputmode="numeric"
                      pattern="[0-9]*"
                      required
                      maxlength={6}
                    />
                  </Field>
                  <Show when={error()}>{(message) => <FieldError>{message()}</FieldError>}</Show>
                  <Button type="submit" disabled={isSubmitting()}>
                    {isSubmitting() ? "Checking..." : "Sign in"}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => {
                      setError(null);
                      setStep("email");
                    }}
                  >
                    Use another email
                  </Button>
                </form>
              }
            >
              <form class="grid gap-3" onSubmit={requestEmailCode}>
                <Field>
                  <FieldLabel>Email</FieldLabel>
                  <Input
                    value={email()}
                    onInput={(event) => setEmail(event.currentTarget.value)}
                    autocomplete="email"
                    type="email"
                    required
                  />
                </Field>
                <Show when={error()}>{(message) => <FieldError>{message()}</FieldError>}</Show>
                <Button type="submit" disabled={isSubmitting()}>
                  {isSubmitting() ? "Sending..." : "Continue with email"}
                </Button>
              </form>
            </Show>
          </DialogContent>
        </Dialog>
      }
    >
      {(signedInUser) => (
        <DropdownMenu>
          <DropdownMenuTrigger>
            <button
              type="button"
              class={cn(
                "inline-flex h-9 min-w-0 items-center justify-start gap-2 rounded-md border border-input bg-card px-2.5 text-sm shadow-sm transition-[background-color,border-color,color,box-shadow,transform] duration-150 ease-emil-out hover:bg-accent hover:text-accent-foreground active:scale-[0.97] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring motion-reduce:transition-none motion-reduce:active:scale-100",
                props.class,
              )}
              aria-label="Account menu"
            >
              <Show
                when={signedInUser().pictureUrl}
                fallback={
                  <span class="flex h-6 w-6 flex-none items-center justify-center rounded-full border border-border bg-muted text-xs font-medium text-muted-foreground">
                    {userInitial(signedInUser())}
                  </span>
                }
              >
                {(pictureUrl) => (
                  <img
                    src={pictureUrl()}
                    alt=""
                    class="h-6 w-6 flex-none rounded-full border border-border object-cover"
                    crossorigin="anonymous"
                    referrerpolicy="no-referrer"
                  />
                )}
              </Show>
              <span class="min-w-0 max-w-36 truncate text-left text-sm text-muted-foreground">
                {userDisplayName(signedInUser())}
              </span>
              <ChevronDown class="ml-auto h-4 w-4 flex-none text-muted-foreground" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            side={props.menuSide ?? "bottom"}
            sideOffset={8}
            class="w-52"
          >
            <DropdownMenuLabel class="min-w-0">
              <div class="truncate text-sm">{userDisplayName(signedInUser())}</div>
              <div class="truncate text-xs font-normal text-muted-foreground">
                {signedInUser().email}
              </div>
            </DropdownMenuLabel>
            <DropdownMenuItem disabled={false} onClick={logout}>
              <LogOut class="h-4 w-4" />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </Show>
  );
}

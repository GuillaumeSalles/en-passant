import { render, waitFor } from "@solidjs/testing-library";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  clearPendingSocialSignIn: vi.fn(),
  finishAuthenticatedAccountFlow: vi.fn(() => Promise.resolve()),
  refreshAuthSession: vi.fn(() => Promise.resolve({ id: "player-user" })),
}));

vi.mock("@/lib/authBootstrap", () => ({
  finishAuthenticatedAccountFlow: mocks.finishAuthenticatedAccountFlow,
}));
vi.mock("@/lib/authRedirect", () => ({
  clearPendingSocialSignIn: mocks.clearPendingSocialSignIn,
}));
vi.mock("@/lib/authSession", () => ({
  refreshAuthSession: mocks.refreshAuthSession,
}));

import { DesktopAuthCompletion } from "./DesktopAuthCompletion";

describe("DesktopAuthCompletion", () => {
  let complete: ((accountKind: "new" | "existing") => void) | undefined;
  let fail: ((message: string) => void) | undefined;

  beforeEach(() => {
    mocks.clearPendingSocialSignIn.mockClear();
    mocks.finishAuthenticatedAccountFlow.mockClear();
    mocks.refreshAuthSession.mockClear();
    window.enPassantDesktop = {
      requestGoogleSignIn: () => Promise.resolve(),
      onGoogleSignInComplete(callback) {
        complete = callback;
        return () => {
          complete = undefined;
        };
      },
      onGoogleSignInError(callback) {
        fail = callback;
        return () => {
          fail = undefined;
        };
      },
    };
  });

  afterEach(() => {
    delete window.enPassantDesktop;
  });

  test("finishes one desktop authentication independently of auth buttons", async () => {
    const view = render(() => <DesktopAuthCompletion />);
    await waitFor(() => expect(complete).toBeDefined());

    complete?.("new");

    await waitFor(() => {
      expect(mocks.refreshAuthSession).toHaveBeenCalledOnce();
      expect(mocks.finishAuthenticatedAccountFlow).toHaveBeenCalledWith("new");
    });
    view.unmount();
    expect(complete).toBeUndefined();
    expect(fail).toBeUndefined();
  });
});

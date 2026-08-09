import { afterEach, describe, expect, test, vi } from "vitest";

const authMocks = vi.hoisted(() => ({
  getSession: vi.fn(),
}));

vi.mock("@/lib/authClient", () => ({
  authClient: {
    getSession: authMocks.getSession,
  },
}));

import {
  AUTH_SESSION_REFRESH_INTERVAL_MS,
  authStatus,
  clearAuthSession,
  currentAuthUser,
  refreshAuthSession,
  startAuthSessionRenewal,
} from "./authSession";

afterEach(() => {
  vi.useRealTimers();
  authMocks.getSession.mockReset();
  clearAuthSession();
});

describe("auth session state", () => {
  test("preserves a signed-in session across temporary refresh failures", async () => {
    authMocks.getSession.mockResolvedValueOnce({
      data: {
        user: {
          id: "player-user",
          email: "player@example.com",
          name: "Player One",
          image: null,
        },
      },
      error: null,
    });
    await refreshAuthSession();

    authMocks.getSession.mockResolvedValueOnce({
      data: null,
      error: { status: 503 },
    });
    const user = await refreshAuthSession();

    expect(user?.id).toBe("player-user");
    expect(currentAuthUser()?.id).toBe("player-user");
    expect(authStatus()).toBe("signed-in");
  });

  test("clears a session that Better Auth rejects as unauthorized", async () => {
    authMocks.getSession.mockResolvedValueOnce({
      data: {
        user: {
          id: "player-user",
          email: "player@example.com",
          name: "Player One",
          image: null,
        },
      },
      error: null,
    });
    await refreshAuthSession();

    authMocks.getSession.mockResolvedValueOnce({
      data: null,
      error: { status: 401 },
    });
    await refreshAuthSession();

    expect(currentAuthUser()).toBeNull();
    expect(authStatus()).toBe("signed-out");
  });
});

describe("auth session renewal", () => {
  test("renews on focus and periodically while the page is visible", async () => {
    vi.useFakeTimers();
    const refreshSession = vi.fn(async () => undefined);
    const stopRenewal = startAuthSessionRenewal(refreshSession);

    window.dispatchEvent(new Event("focus"));
    await vi.runAllTicks();
    expect(refreshSession).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(AUTH_SESSION_REFRESH_INTERVAL_MS);
    expect(refreshSession).toHaveBeenCalledTimes(2);

    stopRenewal();
    window.dispatchEvent(new Event("focus"));
    await vi.advanceTimersByTimeAsync(AUTH_SESSION_REFRESH_INTERVAL_MS);
    expect(refreshSession).toHaveBeenCalledTimes(2);
  });

  test("coalesces overlapping renewal requests", async () => {
    let finishRefresh: (() => void) | undefined;
    const refreshSession = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          finishRefresh = resolve;
        }),
    );
    const stopRenewal = startAuthSessionRenewal(refreshSession);

    window.dispatchEvent(new Event("focus"));
    window.dispatchEvent(new Event("focus"));
    expect(refreshSession).toHaveBeenCalledTimes(1);

    finishRefresh?.();
    await Promise.resolve();
    stopRenewal();
  });
});

import { afterEach, describe, expect, test, vi } from "vitest";

const authMocks = vi.hoisted(() => ({
  getSession: vi.fn(),
}));
const persistenceMocks = vi.hoisted(() => ({
  discardAuthenticatedLocalData: vi.fn(async () => undefined),
  readRememberedAuthenticatedUserId: vi.fn<() => string | null>(() => null),
  rememberAuthenticatedUser: vi.fn(),
}));

vi.mock("@/lib/authClient", () => ({
  authClient: {
    getSession: authMocks.getSession,
  },
}));

vi.mock("@/lib/authSessionPersistence", () => persistenceMocks);

import {
  AUTH_SESSION_REFRESH_INTERVAL_MS,
  authStatus,
  clearAuthSession,
  currentAuthUser,
  handleUnauthorizedResponse,
  refreshAuthSession,
  startAuthSessionRenewal,
} from "./authSession";

afterEach(() => {
  vi.useRealTimers();
  authMocks.getSession.mockReset();
  persistenceMocks.discardAuthenticatedLocalData.mockClear();
  persistenceMocks.readRememberedAuthenticatedUserId.mockReset();
  persistenceMocks.readRememberedAuthenticatedUserId.mockReturnValue(null);
  persistenceMocks.rememberAuthenticatedUser.mockClear();
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
    expect(persistenceMocks.discardAuthenticatedLocalData).not.toHaveBeenCalled();
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
    expect(persistenceMocks.discardAuthenticatedLocalData).toHaveBeenCalledOnce();
  });

  test("discards authenticated local data when a remembered session has expired", async () => {
    persistenceMocks.readRememberedAuthenticatedUserId.mockReturnValue("player-user");
    authMocks.getSession.mockResolvedValueOnce({ data: null, error: null });

    await refreshAuthSession();

    expect(persistenceMocks.discardAuthenticatedLocalData).toHaveBeenCalledOnce();
    expect(currentAuthUser()).toBeNull();
    expect(authStatus()).toBe("signed-out");
  });

  test("preserves anonymous local data when there is no authenticated session marker", async () => {
    authMocks.getSession.mockResolvedValueOnce({ data: null, error: null });

    await refreshAuthSession();

    expect(persistenceMocks.discardAuthenticatedLocalData).not.toHaveBeenCalled();
    expect(authStatus()).toBe("signed-out");
  });

  test("treats authenticated API 401 responses as a session boundary", async () => {
    persistenceMocks.readRememberedAuthenticatedUserId.mockReturnValue("player-user");

    const unauthorized = await handleUnauthorizedResponse(new Response(null, { status: 401 }));

    expect(unauthorized).toBe(true);
    expect(persistenceMocks.discardAuthenticatedLocalData).toHaveBeenCalledOnce();
    expect(authStatus()).toBe("signed-out");
  });

  test("ignores non-authentication API failures", async () => {
    persistenceMocks.readRememberedAuthenticatedUserId.mockReturnValue("player-user");

    const unauthorized = await handleUnauthorizedResponse(new Response(null, { status: 503 }));

    expect(unauthorized).toBe(false);
    expect(persistenceMocks.discardAuthenticatedLocalData).not.toHaveBeenCalled();
  });

  test("discards local data before switching authenticated users", async () => {
    persistenceMocks.readRememberedAuthenticatedUserId.mockReturnValue("other-user");
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

    const user = await refreshAuthSession();

    expect(user).toBeNull();
    expect(persistenceMocks.discardAuthenticatedLocalData).toHaveBeenCalledOnce();
    expect(persistenceMocks.rememberAuthenticatedUser).not.toHaveBeenCalled();
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

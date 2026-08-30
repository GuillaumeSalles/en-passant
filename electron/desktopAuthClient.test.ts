// @vitest-environment node

import { beforeEach, describe, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requestAuth: vi.fn(() => Promise.resolve()),
}));

vi.mock("better-auth/client", () => ({
  createAuthClient: () => ({
    authenticate: vi.fn(),
    requestAuth: mocks.requestAuth,
  }),
}));

vi.mock("@better-auth/electron/client", () => ({
  electronClient: vi.fn(() => ({
    getActions: () => ({
      authenticate: vi.fn(),
      requestAuth: mocks.requestAuth,
    }),
  })),
}));

vi.mock("electron", () => ({
  app: { isPackaged: false },
}));

import { requestGoogleSignIn } from "./desktopAuth";

describe("desktop auth client", () => {
  beforeEach(() => mocks.requestAuth.mockClear());

  test("starts Google authentication through the Electron main-process client", async () => {
    await requestGoogleSignIn();

    expect(mocks.requestAuth).toHaveBeenCalledOnce();
  });
});

// @vitest-environment node

import { beforeEach, describe, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  openExternal: vi.fn<(url: string, options: { activate: boolean }) => Promise<void>>(() =>
    Promise.resolve(),
  ),
}));

vi.mock("electron", () => ({
  shell: { openExternal: mocks.openExternal },
}));

import { startGoogleSignIn } from "./desktopAuth";

describe("desktop auth client", () => {
  beforeEach(() => mocks.openExternal.mockClear());

  test("starts a one-time loopback callback before opening the browser", async () => {
    const flow = await startGoogleSignIn({ fetch: vi.fn() } as never);
    expect(mocks.openExternal).toHaveBeenCalledOnce();
    const [value] = mocks.openExternal.mock.calls[0] ?? [];
    const url = new URL(value ?? "https://invalid.example");
    expect(url.searchParams.get("loopback_port")).toMatch(/^\d+$/);
    expect(url.searchParams.get("callback_nonce")).toMatch(/^[A-Za-z0-9_-]{16,}$/);
    expect(url.searchParams.get("state")).toMatch(/^[A-Za-z0-9_-]{16,}$/);
    expect(url.searchParams.get("code_challenge")).toMatch(/^[A-Za-z0-9_-]{32,}$/);

    flow.cancel();
    await expect(flow.completion).rejects.toThrow("cancelled");
  });
});

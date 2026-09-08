import { afterEach, describe, expect, it, vi } from "vitest";
vi.mock("react-native", () => ({ Platform: { OS: "ios" } }));
vi.mock("../src/sessionStorage", () => ({
  sessionStorage: {
    read: vi.fn(async () => null),
    write: vi.fn(async () => {}),
    clear: vi.fn(async () => {}),
  },
}));
import { Api } from "../src/api";
import { sessionStorage } from "../src/sessionStorage";
afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("native API credentials", () => {
  it("stores the signed cookie securely and includes it on API requests", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(
        new Response("{}", {
          headers: {
            "set-cookie":
              "__Secure-better-auth.session_token=signed-value; HttpOnly; Secure; Path=/",
          },
        }),
      )
      .mockResolvedValue(new Response("{}"));
    vi.stubGlobal("fetch", fetcher);
    const api = new Api();
    await api.initialize();
    await api.json("/api/auth/sign-in/email-otp", { email: "test@example.com", otp: "123456" });
    await api.json("/api/sync", {});
    expect(sessionStorage.write).toHaveBeenCalledWith(
      "__Secure-better-auth.session_token=signed-value",
    );
    const headers = fetcher.mock.calls[1]?.[1]?.headers as Headers;
    expect(headers.get("cookie")).toBe("__Secure-better-auth.session_token=signed-value");
    expect(headers.get("origin")).toBe("https://enpassant.io");
  });
  it("treats a 401 with an expired-cookie header as session loss", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          new Response("Expired", {
            status: 401,
            headers: { "set-cookie": 'better-auth.session_token=""; Max-Age=0' },
          }),
        ),
    );
    const api = new Api();
    api.onUnauthorized = vi.fn(async () => {
      await api.clear();
    });
    await expect(api.request("/api/sync")).rejects.toThrow("Expired");
    expect(api.onUnauthorized).toHaveBeenCalledOnce();
    expect(sessionStorage.write).not.toHaveBeenCalled();
  });
  it("does not restore credentials from a delayed response after sign-out", async () => {
    let resolve = (_response: Response) => {};
    const response = new Promise<Response>((done) => {
      resolve = done;
    });
    vi.stubGlobal(
      "fetch",
      vi.fn(() => response),
    );
    const api = new Api();
    const pending = api.request("/api/auth/get-session");
    await api.clear();
    resolve(
      new Response("{}", { headers: { "set-cookie": "better-auth.session_token=old-session" } }),
    );
    await pending;
    expect(sessionStorage.write).not.toHaveBeenCalled();
    expect(sessionStorage.clear).toHaveBeenCalledOnce();
  });
});

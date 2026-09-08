import { Platform } from "react-native";
import { sessionStorage } from "./sessionStorage";

const origin = process.env.EXPO_PUBLIC_API_ORIGIN ?? "https://enpassant.io";
export type SessionUser = { id: string; email: string; name: string };

export class Api {
  private cookie: string | null = null;
  private generation = 0;
  private credentials: Promise<void> = Promise.resolve();
  onUnauthorized: () => Promise<void> = async () => {};

  async initialize(): Promise<void> {
    this.cookie = await sessionStorage.read();
  }

  async clear(): Promise<void> {
    this.generation++;
    this.cookie = null;
    this.credentials = this.credentials.catch(() => {}).then(() => sessionStorage.clear());
    await this.credentials;
  }

  async request(path: string, init: RequestInit = {}): Promise<Response> {
    if (!path.startsWith("/api/")) throw new Error("Expected an API path");
    const generation = this.generation;
    const headers = new Headers(init.headers);
    if (Platform.OS !== "web") {
      headers.set("origin", origin);
      if (this.cookie !== null) headers.set("cookie", this.cookie);
    }
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15_000);
    let response: Response;
    try {
      response = await fetch(`${origin}${path}`, {
        ...init,
        headers,
        signal: init.signal ?? controller.signal,
        credentials: Platform.OS === "web" ? "include" : "omit",
      });
    } finally {
      clearTimeout(timeout);
    }
    if (response.status === 401 && generation === this.generation) await this.onUnauthorized();
    if (response.ok && Platform.OS !== "web") {
      const cookie = response.headers
        .get("set-cookie")
        ?.match(/(?:^|,\s*)((?:__Secure-)?better-auth\.session_token=[^;,]+)/)?.[1];
      if (cookie !== undefined && generation === this.generation && cookie !== this.cookie) {
        this.cookie = cookie;
        this.generation++;
        this.credentials = this.credentials
          .catch(() => {})
          .then(() => sessionStorage.write(cookie));
        await this.credentials;
      }
    }
    if (!response.ok)
      throw new Error((await response.text()) || `Request failed (${response.status})`);
    return response;
  }

  async json<T>(path: string, body?: object): Promise<T> {
    const response = await this.request(
      path,
      body === undefined
        ? {}
        : {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(body),
          },
    );
    return (await response.json()) as T;
  }
}

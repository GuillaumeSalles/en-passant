import { describe, expect, it, vi } from "vitest";
import { NativeModel } from "../src/model";
import { NativeService } from "../src/service";
import type { Api } from "../src/api";

type ServiceApi = Pick<Api, "onUnauthorized" | "initialize" | "clear" | "json" | "request">;
function deferred<T>() {
  let resolve = (_value: T) => {};
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}
async function fixture() {
  let id = 0;
  const model = new NativeModel(
    { read: async () => null, write: async () => {} },
    () => `test-${++id}`,
  );
  await model.initialize();
  await model.setOwner("alice");
  const api: ServiceApi = {
    initialize: async () => {},
    clear: vi.fn(async () => {}),
    onUnauthorized: async () => {},
    json: async <T>() => (await Promise.resolve(null)) as T,
    request: async () => new Response(""),
  };
  const service = new NativeService(model, api);
  service.user = { id: "alice", name: "Alice", email: "alice@example.com" };
  return { model, service, api };
}

describe("native service session isolation", () => {
  it("clears private games and library on an unauthorized API response", async () => {
    const { model, service, api } = await fixture();
    await api.onUnauthorized();
    expect(service.user).toBeNull();
    expect(service.games).toEqual([]);
    expect(model.repertoires).toEqual([]);
    expect(api.clear).toHaveBeenCalled();
  });
  it("keeps cached data on transient session failures", async () => {
    const { model, service, api } = await fixture();
    api.json = async () => {
      throw new Error("Network unavailable");
    };
    await expect(service.refreshSession()).rejects.toThrow("Network unavailable");
    expect(model.data.owner).toBe("alice");
    expect(model.repertoires).toHaveLength(1);
  });
  it("does not resurrect a session when a delayed session response arrives after sign-out", async () => {
    const { model, service, api } = await fixture();
    const pending = deferred<{ user: { id: string; name: string; email: string } }>();
    api.json = async <T>() => (await pending.promise) as T;
    const refresh = service.refreshSession();
    await service.endSession();
    pending.resolve({ user: { id: "alice", name: "Alice", email: "alice@example.com" } });
    await refresh;
    expect(service.user).toBeNull();
    expect(model.data.owner).toBeNull();
    expect(model.repertoires).toEqual([]);
  });
  it("ignores a sync response after the account ends", async () => {
    const { model, service, api } = await fixture();
    const pending = deferred<unknown>();
    api.json = async <T>() => (await pending.promise) as T;
    const sync = service.sync();
    await Promise.resolve();
    await service.endSession();
    pending.resolve({
      cursor: "later",
      acknowledgedPgn: null,
      changes: {
        repertoires: [{ id: "secret" }],
        chapters: [],
        pgns: [],
        trainingLineSchedules: [],
      },
    });
    await sync;
    expect(model.repertoires).toEqual([]);
    expect(model.data.cursor).toBeNull();
  });
});

import { describe, expect, test, vi } from "vitest";
import { createRecordChangeChannel, type StorageBroadcastMessage } from "./recordChanges";

class FakeBroadcastChannel {
  readonly postMessage = vi.fn<(message: StorageBroadcastMessage) => void>();
  private readonly listeners = new Set<(event: MessageEvent<unknown>) => void>();

  addEventListener(_type: "message", listener: (event: MessageEvent<unknown>) => void): void {
    this.listeners.add(listener);
  }

  removeEventListener(_type: "message", listener: (event: MessageEvent<unknown>) => void): void {
    this.listeners.delete(listener);
  }

  receive(data: unknown): void {
    for (const listener of this.listeners) {
      listener(new MessageEvent("message", { data }));
    }
  }
}

describe("record change channel", () => {
  test("publishes committed record references as one message", () => {
    const broadcastChannel = new FakeBroadcastChannel();
    const channel = createRecordChangeChannel(broadcastChannel);
    const records = [
      { kind: "chapter" as const, id: "chapter-1" },
      { kind: "pgn" as const, id: "pgn-1" },
    ];

    channel.publishRecordChanges(records);

    expect(broadcastChannel.postMessage).toHaveBeenCalledOnce();
    expect(broadcastChannel.postMessage).toHaveBeenCalledWith({
      type: "record-changed",
      records,
    });
  });

  test("accepts record-changed messages and ignores malformed messages", () => {
    const broadcastChannel = new FakeBroadcastChannel();
    const channel = createRecordChangeChannel(broadcastChannel);
    const listener = vi.fn();
    const unsubscribe = channel.subscribeToRecordChanges(listener);

    broadcastChannel.receive({ type: "storage-reset", records: [] });
    broadcastChannel.receive({
      type: "record-changed",
      records: [{ kind: "unknown", id: "record-1" }],
    });
    broadcastChannel.receive({
      type: "record-changed",
      records: [{ kind: "repertoire", id: "repertoire-1" }],
    });

    expect(listener).toHaveBeenCalledOnce();
    expect(listener).toHaveBeenCalledWith([{ kind: "repertoire", id: "repertoire-1" }]);

    unsubscribe();
    broadcastChannel.receive({
      type: "record-changed",
      records: [{ kind: "chapter", id: "chapter-1" }],
    });
    expect(listener).toHaveBeenCalledOnce();
  });

  test("publishes and validates database clear coordination messages", () => {
    const broadcastChannel = new FakeBroadcastChannel();
    const channel = createRecordChangeChannel(broadcastChannel);
    const requestListener = vi.fn();
    const resultListener = vi.fn();
    const unsubscribeFromRequests = channel.subscribeToDatabaseClearRequests(requestListener);
    const unsubscribeFromResults = channel.subscribeToDatabaseClearResults(resultListener);

    channel.publishDatabaseClearRequested("clear-1");
    channel.publishDatabaseClearFinished("clear-1", true);

    expect(broadcastChannel.postMessage).toHaveBeenNthCalledWith(1, {
      type: "database-clear-requested",
      requestId: "clear-1",
    });
    expect(broadcastChannel.postMessage).toHaveBeenNthCalledWith(2, {
      type: "database-clear-finished",
      requestId: "clear-1",
      succeeded: true,
    });

    broadcastChannel.receive({ type: "database-clear-requested", requestId: 1 });
    broadcastChannel.receive({
      type: "database-clear-finished",
      requestId: "clear-1",
      succeeded: "yes",
    });
    broadcastChannel.receive({ type: "database-clear-requested", requestId: "clear-1" });
    broadcastChannel.receive({
      type: "database-clear-finished",
      requestId: "clear-1",
      succeeded: false,
    });

    expect(requestListener).toHaveBeenCalledOnce();
    expect(requestListener).toHaveBeenCalledWith("clear-1");
    expect(resultListener).toHaveBeenCalledOnce();
    expect(resultListener).toHaveBeenCalledWith({ requestId: "clear-1", succeeded: false });

    unsubscribeFromRequests();
    unsubscribeFromResults();
  });
});

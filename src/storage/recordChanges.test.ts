import { describe, expect, test, vi } from "vitest";
import { createRecordChangeChannel, type RecordChangedMessage } from "./recordChanges";

class FakeBroadcastChannel {
  readonly postMessage = vi.fn<(message: RecordChangedMessage) => void>();
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

    channel.publish(records);

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
    const unsubscribe = channel.subscribe(listener);

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
});

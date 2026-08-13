export type StorageRecordKind = "repertoire" | "chapter" | "pgn" | "training-line-schedule";

export type StorageRecordRef = {
  kind: StorageRecordKind;
  id: string;
};

export type RecordChangedMessage = {
  type: "record-changed";
  records: StorageRecordRef[];
};

type RecordChangeBroadcastChannel = {
  postMessage: (message: RecordChangedMessage) => void;
  addEventListener: (type: "message", listener: (event: MessageEvent<unknown>) => void) => void;
  removeEventListener: (type: "message", listener: (event: MessageEvent<unknown>) => void) => void;
};

const CHANNEL_NAME = "en-passant:record-changes";
const RECORD_KINDS = new Set<StorageRecordKind>([
  "repertoire",
  "chapter",
  "pgn",
  "training-line-schedule",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isStorageRecordRef(value: unknown): value is StorageRecordRef {
  if (!isRecord(value)) return false;
  const kind = value["kind"];
  return (
    typeof kind === "string" &&
    RECORD_KINDS.has(kind as StorageRecordKind) &&
    typeof value["id"] === "string"
  );
}

function isRecordChangedMessage(value: unknown): value is RecordChangedMessage {
  return (
    isRecord(value) &&
    value["type"] === "record-changed" &&
    Array.isArray(value["records"]) &&
    value["records"].every(isStorageRecordRef)
  );
}

export function createRecordChangeChannel(channel: RecordChangeBroadcastChannel | null) {
  function publish(records: StorageRecordRef[]): void {
    if (records.length === 0) return;
    channel?.postMessage({ type: "record-changed", records });
  }

  function subscribe(listener: (records: StorageRecordRef[]) => void): () => void {
    if (channel === null) return () => undefined;

    function receive(event: MessageEvent<unknown>): void {
      if (isRecordChangedMessage(event.data)) {
        listener(event.data.records);
      }
    }

    channel.addEventListener("message", receive);
    return () => channel.removeEventListener("message", receive);
  }

  return { publish, subscribe };
}

const browserChannel =
  typeof window !== "undefined" && typeof BroadcastChannel !== "undefined"
    ? new BroadcastChannel(CHANNEL_NAME)
    : null;

const recordChangeChannel = createRecordChangeChannel(browserChannel);

export const publishRecordChanges = recordChangeChannel.publish;
export const subscribeToRecordChanges = recordChangeChannel.subscribe;

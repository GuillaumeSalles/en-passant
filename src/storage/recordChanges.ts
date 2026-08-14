export type StorageRecordKind = "repertoire" | "chapter" | "pgn" | "training-line-schedule";

export type StorageRecordRef = {
  kind: StorageRecordKind;
  id: string;
};

export type RecordChangedMessage = {
  type: "record-changed";
  records: StorageRecordRef[];
};

export type DatabaseClearRequestedMessage = {
  type: "database-clear-requested";
  requestId: string;
};

export type DatabaseClearFinishedMessage = {
  type: "database-clear-finished";
  requestId: string;
  succeeded: boolean;
};

export type StorageBroadcastMessage =
  | RecordChangedMessage
  | DatabaseClearRequestedMessage
  | DatabaseClearFinishedMessage;

type RecordChangeBroadcastChannel = {
  postMessage: (message: StorageBroadcastMessage) => void;
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

function isDatabaseClearRequestedMessage(value: unknown): value is DatabaseClearRequestedMessage {
  return (
    isRecord(value) &&
    value["type"] === "database-clear-requested" &&
    typeof value["requestId"] === "string"
  );
}

function isDatabaseClearFinishedMessage(value: unknown): value is DatabaseClearFinishedMessage {
  return (
    isRecord(value) &&
    value["type"] === "database-clear-finished" &&
    typeof value["requestId"] === "string" &&
    typeof value["succeeded"] === "boolean"
  );
}

export function createRecordChangeChannel(channel: RecordChangeBroadcastChannel | null) {
  function publishRecordChanges(records: StorageRecordRef[]): void {
    if (records.length === 0) return;
    channel?.postMessage({ type: "record-changed", records });
  }

  function publishDatabaseClearRequested(requestId: string): void {
    channel?.postMessage({ type: "database-clear-requested", requestId });
  }

  function publishDatabaseClearFinished(requestId: string, succeeded: boolean): void {
    channel?.postMessage({ type: "database-clear-finished", requestId, succeeded });
  }

  function subscribeToRecordChanges(listener: (records: StorageRecordRef[]) => void): () => void {
    if (channel === null) return () => undefined;

    function receive(event: MessageEvent<unknown>): void {
      if (isRecordChangedMessage(event.data)) {
        listener(event.data.records);
      }
    }

    channel.addEventListener("message", receive);
    return () => channel.removeEventListener("message", receive);
  }

  function subscribeToDatabaseClearRequests(listener: (requestId: string) => void): () => void {
    if (channel === null) return () => undefined;

    function receive(event: MessageEvent<unknown>): void {
      if (isDatabaseClearRequestedMessage(event.data)) {
        listener(event.data.requestId);
      }
    }

    channel.addEventListener("message", receive);
    return () => channel.removeEventListener("message", receive);
  }

  function subscribeToDatabaseClearResults(
    listener: (result: { requestId: string; succeeded: boolean }) => void,
  ): () => void {
    if (channel === null) return () => undefined;

    function receive(event: MessageEvent<unknown>): void {
      if (isDatabaseClearFinishedMessage(event.data)) {
        listener({ requestId: event.data.requestId, succeeded: event.data.succeeded });
      }
    }

    channel.addEventListener("message", receive);
    return () => channel.removeEventListener("message", receive);
  }

  return {
    publishRecordChanges,
    publishDatabaseClearRequested,
    publishDatabaseClearFinished,
    subscribeToRecordChanges,
    subscribeToDatabaseClearRequests,
    subscribeToDatabaseClearResults,
  };
}

const browserChannel =
  typeof window !== "undefined" && typeof BroadcastChannel !== "undefined"
    ? new BroadcastChannel(CHANNEL_NAME)
    : null;

const recordChangeChannel = createRecordChangeChannel(browserChannel);

export const publishRecordChanges = recordChangeChannel.publishRecordChanges;
export const publishDatabaseClearRequested = recordChangeChannel.publishDatabaseClearRequested;
export const publishDatabaseClearFinished = recordChangeChannel.publishDatabaseClearFinished;
export const subscribeToRecordChanges = recordChangeChannel.subscribeToRecordChanges;
export const subscribeToDatabaseClearRequests =
  recordChangeChannel.subscribeToDatabaseClearRequests;
export const subscribeToDatabaseClearResults = recordChangeChannel.subscribeToDatabaseClearResults;

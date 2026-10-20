// A local persistence boundary, independent of the UI and future sync transport.
export const STORE_NAMES = [
  "repertoires",
  "chapters",
  "pgns",
  "training-line-schedules",
  "games",
] as const;
export type StoreName = (typeof STORE_NAMES)[number];
export const MOVE_STORE_NAMES = ["repertoire-moves", "game-moves"] as const;
export type MoveStoreName = (typeof MOVE_STORE_NAMES)[number];
export type ReadStoreName = StoreName | MoveStoreName;
export type DatabaseRecord = { store: ReadStoreName; id: string; value: string };
export type SourceRecord = DatabaseRecord & { store: StoreName };
export type DatabaseSnapshot = { version: number; records: DatabaseRecord[] };
export type DatabaseQuery = { store: ReadStoreName; index?: string; key?: IDBValidKey };
export type DatabaseCommit = {
  expectedVersion: number;
  put: SourceRecord[];
  remove: { store: StoreName; id: string }[];
};
export type LocalDatabase = {
  read(queries?: readonly DatabaseQuery[]): Promise<DatabaseSnapshot>;
  commit(change: DatabaseCommit): Promise<boolean>;
};

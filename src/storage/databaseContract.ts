// A local persistence boundary, independent of the UI and future sync transport.
export const STORE_NAMES = [
  "repertoires",
  "chapters",
  "pgns",
  "training-line-schedules",
  "games",
] as const;
export type StoreName = (typeof STORE_NAMES)[number];
export type DatabaseRecord = { store: StoreName; id: string; value: string };
export type DatabaseSnapshot = { version: number; records: DatabaseRecord[] };
export type DatabaseCommit = {
  expectedVersion: number;
  put: DatabaseRecord[];
  remove: { store: StoreName; id: string }[];
};
export type LocalDatabase = {
  read(): Promise<DatabaseSnapshot>;
  commit(change: DatabaseCommit): Promise<boolean>;
};

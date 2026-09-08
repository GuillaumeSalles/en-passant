// React observes completed commands through useSyncExternalStore. PGN accessors
// keep the same mutation contract without allocating Solid signals on native.
export type VersionSignal = {
  get: () => number;
  set: (value: number | ((currentValue: number) => number)) => number;
};

export function createVersionSignal(): VersionSignal {
  let version = 0;
  return {
    get: () => version,
    set: (value) => (version = typeof value === "function" ? value(version) : value),
  };
}

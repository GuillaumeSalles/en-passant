import { createSignal } from "solid-js";

export type VersionSignal = {
  get: () => number;
  set: (value: number | ((currentValue: number) => number)) => number;
};

export function createVersionSignal(): VersionSignal {
  const [get, set] = createSignal(0, { equals: false });
  return { get, set };
}

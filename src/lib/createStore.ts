import { createRoot, createSignal } from "solid-js";
import type { Accessor } from "solid-js";

export type StoreState<T> = T & {
  set: <K extends Extract<keyof T, string>>(
    key: K,
    value: T[K] | ((currentValue: T[K]) => T[K]),
  ) => void;
};

export type Store<T> = {
  state: StoreState<T>;
};

type SignalEntry = {
  read: Accessor<number>;
  value: unknown;
  notify: () => void;
};

function requireSignal<Key extends string>(
  signals: Record<Key, SignalEntry>,
  key: Key,
): SignalEntry {
  const signal = signals[key];
  if (signal === undefined) {
    throw new Error(`Missing store signal for ${key}`);
  }
  return signal;
}

export function createStore<T extends object>(initialState: T): Store<T> {
  return createRoot(() => createStoreInRoot(initialState));
}

function createStoreInRoot<T extends object>(initialState: T): Store<T> {
  type Key = Extract<keyof T, string>;
  const keys = Object.keys(initialState) as Key[];
  const signals = {} as Record<Key, SignalEntry>;

  for (const key of keys) {
    const [read, write] = createSignal(0, { ownedWrite: true });
    signals[key] = {
      read,
      value: initialState[key],
      notify: () => write((version) => version + 1),
    };
  }

  const state = {} as StoreState<T>;
  for (const key of keys) {
    Object.defineProperty(state, key, {
      enumerable: true,
      get: () => {
        const signal = requireSignal(signals, key);
        signal.read();
        return signal.value as T[typeof key];
      },
    });
  }
  Object.defineProperty(state, "set", {
    enumerable: false,
    value: <K extends Extract<keyof T, string>>(
      key: K,
      value: T[K] | ((currentValue: T[K]) => T[K]),
    ) => {
      const signal = requireSignal(signals, key);
      const currentValue = signal.value as T[K];
      const nextValue =
        typeof value === "function" ? (value as (currentValue: T[K]) => T[K])(currentValue) : value;
      if (nextValue === currentValue) return;
      signal.value = nextValue;
      signal.notify();
    },
  });

  return {
    state,
  };
}

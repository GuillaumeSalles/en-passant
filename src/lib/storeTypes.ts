export type StoreState<T> = T & {
  set: <K extends Extract<keyof T, string>>(
    key: K,
    value: T[K] | ((currentValue: T[K]) => T[K]),
  ) => void;
};

export type Store<T> = {
  state: StoreState<T>;
};

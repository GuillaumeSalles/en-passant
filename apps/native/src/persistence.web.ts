// Browser preview only; iOS and Android persist to SQLite.
export const persistence = {
  read: async () => localStorage.getItem("en-passant-native-v1"),
  write: async (value: string) => localStorage.setItem("en-passant-native-v1", value),
};

import Storage from "expo-sqlite/kv-store";

export const persistence = {
  read: () => Storage.getItem("en-passant-native-v1"),
  write: (value: string) => Storage.setItem("en-passant-native-v1", value),
};

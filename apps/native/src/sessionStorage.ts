import * as SecureStore from "expo-secure-store";

export const sessionStorage = {
  read: () => SecureStore.getItemAsync("en-passant-session"),
  write: (cookie: string) => SecureStore.setItemAsync("en-passant-session", cookie),
  clear: () => SecureStore.deleteItemAsync("en-passant-session"),
};

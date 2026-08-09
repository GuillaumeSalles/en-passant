import { deleteIndexedDbDatabase } from "@/storage";

export const AUTHENTICATED_USER_STORAGE_KEY = "en_passant_signed_in";

export function readRememberedAuthenticatedUserId(): string | null {
  return window.localStorage.getItem(AUTHENTICATED_USER_STORAGE_KEY);
}

export function rememberAuthenticatedUser(userId: string): void {
  window.localStorage.setItem(AUTHENTICATED_USER_STORAGE_KEY, userId);
}

export async function discardAuthenticatedLocalData(): Promise<void> {
  await deleteIndexedDbDatabase();
  window.localStorage.removeItem(AUTHENTICATED_USER_STORAGE_KEY);
  window.location.reload();
}

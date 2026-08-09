import {
  deleteIndexedDbDatabase,
  getIndexedDbAuthenticatedUserId,
  setIndexedDbAuthenticatedUserId,
} from "@/storage";

export const AUTHENTICATED_USER_STORAGE_KEY = "en_passant_signed_in";

export type RememberedAuthenticatedUserIds = {
  localStorageUserId: string | null;
  indexedDbUserId: string | null;
};

export async function readRememberedAuthenticatedUserIds(): Promise<RememberedAuthenticatedUserIds> {
  return {
    localStorageUserId: window.localStorage.getItem(AUTHENTICATED_USER_STORAGE_KEY),
    indexedDbUserId: await getIndexedDbAuthenticatedUserId(),
  };
}

export async function rememberAuthenticatedUser(userId: string): Promise<void> {
  await setIndexedDbAuthenticatedUserId(userId);
  window.localStorage.setItem(AUTHENTICATED_USER_STORAGE_KEY, userId);
}

export async function hasRememberedAuthenticatedUser(): Promise<boolean> {
  if (window.localStorage.getItem(AUTHENTICATED_USER_STORAGE_KEY) !== null) {
    return true;
  }

  try {
    return (await getIndexedDbAuthenticatedUserId()) !== null;
  } catch {
    return true;
  }
}

export async function discardAuthenticatedLocalData(): Promise<void> {
  await deleteIndexedDbDatabase();
  window.localStorage.removeItem(AUTHENTICATED_USER_STORAGE_KEY);
  window.location.reload();
}

import {
  deleteIndexedDbDatabase,
  getIndexedDbAuthenticatedUserId,
  setIndexedDbAuthenticatedUserId,
} from "@/storage";

export async function readRememberedAuthenticatedUserId(): Promise<string | null> {
  return await getIndexedDbAuthenticatedUserId();
}

export async function rememberAuthenticatedUser(userId: string): Promise<void> {
  await setIndexedDbAuthenticatedUserId(userId);
}

export async function discardAuthenticatedLocalData(): Promise<void> {
  await deleteIndexedDbDatabase();
  window.location.reload();
}

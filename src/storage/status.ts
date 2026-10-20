import { createSignal } from "solid-js";
export const [storageError, setStorageError] = createSignal<string | null>(null);
export function reportStorageError(error: unknown): void {
  setStorageError(error instanceof Error ? error.message : "Unable to save on this device.");
}

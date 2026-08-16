import { readLocalStorage, writeLocalStorage } from "./localStorage";

const ENGINE_ENABLED_KEY = "en_passant_engine_enabled";

export function readEngineEnabledPreference(): boolean | undefined {
  const value = readLocalStorage(ENGINE_ENABLED_KEY);
  if (value === "true") return true;
  if (value === "false") return false;
  return undefined;
}

export function writeEngineEnabledPreference(isEnabled: boolean): void {
  writeLocalStorage(ENGINE_ENABLED_KEY, String(isEnabled));
}

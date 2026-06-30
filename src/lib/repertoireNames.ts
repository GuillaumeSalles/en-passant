export const MAX_REPERTOIRE_NAME_LENGTH = 100;

export function limitRepertoireNameLength(name: string): string {
  return name.slice(0, MAX_REPERTOIRE_NAME_LENGTH);
}

export function formatRepertoireName(name: string, fallback: string): string {
  return limitRepertoireNameLength(name.trim()) || fallback;
}

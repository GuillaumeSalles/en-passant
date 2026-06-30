export function handleFromName(name: string, fallback: string): string {
  const handle = name
    .trim()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return handle === "" ? fallback : handle;
}

export function uniqueHandle(baseHandle: string, existingHandles: readonly string[]): string {
  if (!existingHandles.includes(baseHandle)) {
    return baseHandle;
  }

  let suffix = 1;
  while (existingHandles.includes(`${baseHandle}-${suffix}`)) {
    suffix++;
  }

  return `${baseHandle}-${suffix}`;
}

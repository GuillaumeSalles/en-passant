export function isSafariBrowser(): boolean {
  if (typeof navigator === "undefined") return false;

  return (
    navigator.vendor.includes("Apple") &&
    /Safari/.test(navigator.userAgent) &&
    !/Chrome|Chromium|CriOS|FxiOS|EdgiOS|Android/.test(navigator.userAgent)
  );
}

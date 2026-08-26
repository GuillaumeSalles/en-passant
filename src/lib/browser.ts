export function isSafariBrowser(): boolean {
  if (typeof navigator === "undefined") return false;

  return (
    navigator.vendor.includes("Apple") &&
    /Safari/.test(navigator.userAgent) &&
    !/Chrome|Chromium|CriOS|FxiOS|EdgiOS|Android/.test(navigator.userAgent)
  );
}

export function isIosDevice(): boolean {
  if (typeof navigator === "undefined") return false;

  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );
}

export function isStandaloneApp(): boolean {
  if (typeof window === "undefined" || typeof navigator === "undefined") return false;

  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    ("standalone" in navigator &&
      (navigator as Navigator & { standalone: boolean }).standalone === true)
  );
}

export function shouldRegisterServiceWorker(
  production: boolean,
  protocol: string,
  supportsServiceWorker: boolean,
): boolean {
  return production && protocol !== "app:" && supportsServiceWorker;
}

export function registerServiceWorker(): void {
  if (
    !shouldRegisterServiceWorker(
      import.meta.env.PROD,
      window.location.protocol,
      "serviceWorker" in navigator,
    )
  )
    return;

  void navigator.serviceWorker.register("/service-worker.js").catch(() => undefined);
}

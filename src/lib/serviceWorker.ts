export function registerServiceWorker(): void {
  if (!import.meta.env.PROD || !("serviceWorker" in navigator)) return;

  void navigator.serviceWorker.register("/service-worker.js").catch(() => undefined);
}

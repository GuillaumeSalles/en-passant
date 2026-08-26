type UpdateListener = () => void;

const updateListeners = new Set<UpdateListener>();
let waitingServiceWorker: ServiceWorker | null = null;
let isReloadingForUpdate = false;

function announceUpdate(worker: ServiceWorker): void {
  waitingServiceWorker = worker;
  for (const listener of updateListeners) listener();
}

export function subscribeToServiceWorkerUpdates(listener: UpdateListener): () => void {
  updateListeners.add(listener);
  if (waitingServiceWorker !== null) queueMicrotask(listener);
  return () => updateListeners.delete(listener);
}

export function activateServiceWorkerUpdate(): boolean {
  if (waitingServiceWorker === null) return false;

  if (!isReloadingForUpdate) {
    isReloadingForUpdate = true;
    navigator.serviceWorker.addEventListener("controllerchange", () => window.location.reload(), {
      once: true,
    });
  }
  waitingServiceWorker.postMessage({ type: "SKIP_WAITING" });
  return true;
}

export function watchForServiceWorkerUpdate(registration: ServiceWorkerRegistration): void {
  if (registration.waiting !== null && navigator.serviceWorker.controller !== null) {
    announceUpdate(registration.waiting);
  }

  registration.addEventListener("updatefound", () => {
    const installingWorker = registration.installing;
    if (installingWorker === null) return;

    installingWorker.addEventListener("statechange", () => {
      if (installingWorker.state === "installed" && navigator.serviceWorker.controller !== null) {
        announceUpdate(installingWorker);
      }
    });
  });
}

export function registerServiceWorker(): void {
  if (!import.meta.env.PROD || !("serviceWorker" in navigator)) return;

  void navigator.serviceWorker
    .register("/service-worker.js")
    .then(watchForServiceWorkerUpdate)
    .catch((error: unknown) => console.error("Service worker registration failed", error));
}

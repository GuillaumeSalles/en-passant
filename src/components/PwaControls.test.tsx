import { cleanup, fireEvent, render, screen, waitFor } from "@solidjs/testing-library";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

const browserMocks = vi.hoisted(() => ({
  isIosDevice: vi.fn(() => false),
  isSafariBrowser: vi.fn(() => false),
  isStandaloneApp: vi.fn(() => false),
}));
const serviceWorkerMocks = vi.hoisted(() => ({
  activateServiceWorkerUpdate: vi.fn(() => true),
  subscribeToServiceWorkerUpdates: vi.fn(),
}));

vi.mock("@/lib/browser", () => browserMocks);
vi.mock("@/lib/serviceWorker", () => serviceWorkerMocks);

import { PwaInstallButton, PwaProvider } from "./PwaControls";

let announceUpdate: (() => void) | undefined;

beforeEach(() => {
  browserMocks.isIosDevice.mockReturnValue(false);
  browserMocks.isSafariBrowser.mockReturnValue(false);
  browserMocks.isStandaloneApp.mockReturnValue(false);
  serviceWorkerMocks.activateServiceWorkerUpdate.mockReturnValue(true);
  serviceWorkerMocks.subscribeToServiceWorkerUpdates.mockImplementation((listener: () => void) => {
    announceUpdate = listener;
    return () => undefined;
  });
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: () => ({
      matches: false,
      media: "(display-mode: standalone)",
      onchange: null,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      addListener: () => undefined,
      removeListener: () => undefined,
      dispatchEvent: () => true,
    }),
  });
});

afterEach(() => {
  cleanup();
  announceUpdate = undefined;
  vi.clearAllMocks();
});

function renderControls() {
  render(() => (
    <PwaProvider>
      <PwaInstallButton />
    </PwaProvider>
  ));
}

test("offers the browser install prompt only after Chromium makes it available", async () => {
  renderControls();
  expect(screen.queryByRole("button", { name: "Install" })).toBeNull();

  const prompt = vi.fn(async () => undefined);
  const installEvent = new Event("beforeinstallprompt");
  Object.defineProperties(installEvent, {
    prompt: { value: prompt },
    userChoice: { value: Promise.resolve({ outcome: "accepted", platform: "web" }) },
  });
  window.dispatchEvent(installEvent);

  const installButton = await screen.findByRole("button", { name: "Install" });
  fireEvent.click(installButton);
  await waitFor(() => expect(prompt).toHaveBeenCalledOnce());
  await waitFor(() => expect(screen.queryByRole("button", { name: "Install" })).toBeNull());
});

test("shows iOS Add to Home Screen guidance", async () => {
  browserMocks.isIosDevice.mockReturnValue(true);
  renderControls();

  fireEvent.click(screen.getByRole("button", { name: "Install" }));

  expect(await screen.findByRole("dialog", { name: "Install En passant" })).toBeTruthy();
  expect(screen.getByText("Tap Share, then Add to Home Screen.")).toBeTruthy();
});

test("lets the user apply or defer a waiting service-worker update", async () => {
  renderControls();
  announceUpdate?.();

  expect(await screen.findByText("Update ready")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Reload" }));
  expect(serviceWorkerMocks.activateServiceWorkerUpdate).toHaveBeenCalledOnce();

  announceUpdate?.();
  fireEvent.click(screen.getByRole("button", { name: "Later" }));
  await waitFor(() => expect(screen.queryByText("Update ready")).toBeNull());
});

test("reports offline status until connectivity returns", async () => {
  renderControls();

  window.dispatchEvent(new Event("offline"));
  expect(await screen.findByText("Offline · Changes will sync when you reconnect")).toBeTruthy();

  window.dispatchEvent(new Event("online"));
  await waitFor(() =>
    expect(screen.queryByText("Offline · Changes will sync when you reconnect")).toBeNull(),
  );
});

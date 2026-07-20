import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import {
  acceptedPgnAcknowledgment,
  acceptedSyncChanges,
  collectUnexpectedConsole,
  emptyChanges,
  isRecord,
  mockSignedInUser,
  pgnSnapshot,
  seedIndexedDb,
  storedRepertoireHandles,
  type MockAuthSession,
} from "./helpers";

const PLAYER_AVATAR_URL =
  "https://lh3.googleusercontent.com/a/ACg8ocIMWzjTbxhttfprxZV5SDj0CaSPHrT24LCDpt9gGhj7z0aH044=s96-c";
const TRANSPARENT_PIXEL = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=",
  "base64",
);

type AuthPageOptions = {
  localName?: string;
  localPgn?: string;
  dirty?: boolean;
  legacyPgnShape?: boolean;
};

async function dragPiece(page: Page, from: string, to: string): Promise<void> {
  const source = await page.locator(`[data-square="${from}"]`).boundingBox();
  const target = await page.locator(`[data-square="${to}"]`).boundingBox();
  if (source === null || target === null) throw new Error("Expected both chessboard squares");
  await page.mouse.move(source.x + source.width / 2, source.y + source.height / 2);
  await page.mouse.down();
  await page.mouse.move(target.x + target.width / 2, target.y + target.height / 2);
  await page.mouse.up();
}

async function openAuthPage(page: Page, options: AuthPageOptions = {}) {
  const localName = options.localName ?? "Untitled Repertoire";
  const localPgn = options.localPgn ?? "1. e4 e5 *";
  const dirty = options.dirty ?? false;
  await seedIndexedDb(page, {
    clearLocalStorage: true,
    legacyPgnShape: options.legacyPgnShape,
    repertoires: [
      {
        id: "auth-repertoire",
        handle: "untitled-repertoire",
        name: localName,
        orientation: "white",
        updatedAt: "2026-06-26T00:00:00.000Z",
        deletedAt: null,
        dirty,
      },
    ],
    chapters: [
      {
        id: "auth-chapter",
        repertoireId: "auth-repertoire",
        handle: "chapter-1",
        name: "Chapter 1",
        pgnId: "auth-pgn",
        updatedAt: "2026-06-26T00:00:00.000Z",
        deletedAt: null,
        dirty,
      },
    ],
    pgns: [
      {
        id: "auth-pgn",
        pgn: localPgn,
        updatedAt: "2026-06-26T00:00:00.000Z",
        deletedAt: null,
        dirty,
      },
    ],
  });

  await page.goto("/app/repertoires/untitled-repertoire/chapter-1");
}

async function completeGoogleSignIn(
  page: Page,
  auth: MockAuthSession,
  accountKind: "new" | "existing",
) {
  await page.route("**/api/auth/sign-in/social", async (route) => {
    const body = route.request().postDataJSON() as unknown;
    const callbackUrlKey = accountKind === "new" ? "newUserCallbackURL" : "callbackURL";
    const callbackUrl =
      isRecord(body) && typeof body[callbackUrlKey] === "string" ? body[callbackUrlKey] : "/";
    auth.signIn();
    await route.fulfill({
      status: 200,
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        redirect: false,
        url: callbackUrl,
      }),
    });
  });

  await page.getByRole("button", { name: "Sign in" }).click();
  await page.getByRole("button", { name: "Continue with Google" }).click();
}

test("requests an email code and signs in with it", async ({ page }) => {
  const consoleMessages = collectUnexpectedConsole(page);
  let syncRequests = 0;
  const auth = await mockSignedInUser(page, () => {
    syncRequests++;
  });
  let startRequestBody: unknown = null;
  let verifyRequestBody: unknown = null;
  await page.route("**/api/auth/email-otp/send-verification-otp", async (route) => {
    startRequestBody = route.request().postDataJSON();
    await route.fulfill({
      status: 200,
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ok: true }),
    });
  });
  await page.route("**/api/auth/sign-in/email-otp", async (route) => {
    verifyRequestBody = route.request().postDataJSON();
    auth.signIn();
    await route.fulfill({
      status: 200,
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        token: "player-session-token",
        isNewUser: true,
        user: {
          id: "player-user",
          email: "player@example.com",
          emailVerified: true,
          name: "Player One",
          image: null,
          createdAt: "2026-06-26T00:00:00.000Z",
          updatedAt: "2026-06-26T00:00:00.000Z",
        },
      }),
    });
  });

  await openAuthPage(page);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.getByLabel("Email").fill("player@example.com");
  await page.getByRole("button", { name: "Continue with email" }).click();
  await expect(page.getByLabel("Code")).toBeVisible();
  await page.getByLabel("Code").fill("123456");
  await page.getByRole("button", { name: "Sign in" }).last().click();

  await expect(page.getByText("Player One")).toBeVisible();
  await expect.poll(() => syncRequests).toBeGreaterThan(0);
  expect(startRequestBody).toEqual({ email: "player@example.com", type: "sign-in" });
  expect(verifyRequestBody).toEqual({
    email: "player@example.com",
    otp: "123456",
    name: "player@example.com",
  });
  expect(consoleMessages).toEqual([]);
});

test("new account sign in uploads local repertoire data", async ({ page }) => {
  const consoleMessages = collectUnexpectedConsole(page);
  const syncRequests: unknown[] = [];
  const auth = await mockSignedInUser(page, undefined, null, (body) => {
    syncRequests.push(body);
    return {
      cursor: "2026-06-26T00:00:01.000Z",
      changes: acceptedSyncChanges(body),
      acknowledgedPgn: acceptedPgnAcknowledgment(body),
    };
  });
  await page.route("**/api/auth/email-otp/send-verification-otp", async (route) => {
    await route.fulfill({
      status: 200,
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ok: true }),
    });
  });
  await page.route("**/api/auth/sign-in/email-otp", async (route) => {
    auth.signIn();
    await route.fulfill({
      status: 200,
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        token: "player-session-token",
        isNewUser: true,
        user: {
          id: "player-user",
          email: "player@example.com",
          emailVerified: true,
          name: "Player One",
          image: null,
          createdAt: "2026-06-26T00:00:00.000Z",
          updatedAt: "2026-06-26T00:00:00.000Z",
        },
      }),
    });
  });

  await openAuthPage(page, {
    localName: "Local London Notes",
    localPgn: "1. d4 d5 *",
    dirty: true,
    legacyPgnShape: true,
  });
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.getByLabel("Email").fill("player@example.com");
  await page.getByRole("button", { name: "Continue with email" }).click();
  await page.getByLabel("Code").fill("123456");
  await page.getByRole("button", { name: "Sign in" }).last().click();

  await expect.poll(() => syncRequests.length).toBeGreaterThan(0);
  const firstSync = syncRequests[0];
  expect(firstSync).toMatchObject({
    since: null,
    changes: {
      repertoires: [
        {
          id: "auth-repertoire",
          name: "Local London Notes",
        },
      ],
      pgns: [
        {
          id: "auth-pgn",
          mutations: [{ type: "replacePgn", pgn: "1. d4 d5 *" }],
        },
      ],
    },
  });
  expect(consoleMessages).toEqual([]);
});

test("existing account sign in discards local repertoire data and loads server data", async ({
  page,
}) => {
  const consoleMessages = collectUnexpectedConsole(page);
  const syncRequests: unknown[] = [];
  const remoteChanges = {
    repertoires: [
      {
        id: "server-repertoire",
        handle: "server-repertoire",
        name: "Server Repertoire",
        orientation: "black",
        updatedAt: "2026-06-26T00:00:01.000Z",
        deletedAt: null,
      },
    ],
    chapters: [
      {
        id: "server-chapter",
        repertoireId: "server-repertoire",
        handle: "server-chapter",
        name: "Server Chapter",
        pgnId: "server-pgn",
        updatedAt: "2026-06-26T00:00:01.000Z",
        deletedAt: null,
      },
    ],
    pgns: [pgnSnapshot("server-pgn", "1. c4 e5 *", "2026-06-26T00:00:01.000Z")],
  };
  const auth = await mockSignedInUser(page, undefined, null, (body) => {
    syncRequests.push(body);
    return {
      cursor: "2026-06-26T00:00:02.000Z",
      changes: syncRequests.length === 1 ? remoteChanges : emptyChanges(),
    };
  });
  await page.route("**/api/auth/email-otp/send-verification-otp", async (route) => {
    await route.fulfill({
      status: 200,
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ok: true }),
    });
  });
  await page.route("**/api/auth/sign-in/email-otp", async (route) => {
    auth.signIn();
    await route.fulfill({
      status: 200,
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        token: "player-session-token",
        isNewUser: false,
        user: {
          id: "player-user",
          email: "player@example.com",
          emailVerified: true,
          name: "Player One",
          image: null,
          createdAt: "2026-06-26T00:00:00.000Z",
          updatedAt: "2026-06-26T00:00:00.000Z",
        },
      }),
    });
  });

  await openAuthPage(page, {
    localName: "Local Draft Should Disappear",
    localPgn: "1. d4 d5 *",
    dirty: true,
  });
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.getByLabel("Email").fill("player@example.com");
  await page.getByRole("button", { name: "Continue with email" }).click();
  await page.getByLabel("Code").fill("123456");
  await page.getByRole("button", { name: "Sign in" }).last().click();

  await expect(page).toHaveURL(/\/app\/repertoires\/server-repertoire\/server-chapter$/);
  await expect(page.getByText("Server Repertoire").first()).toBeVisible();
  await expect(page.getByText("Local Draft Should Disappear")).toBeHidden();
  await expect.poll(() => syncRequests.length).toBeGreaterThan(0);
  expect(syncRequests[0]).toMatchObject({
    changes: {
      repertoires: [],
      chapters: [],
      pgns: [],
    },
  });
  const uploadedChanges = syncRequests
    .filter(isRecord)
    .map((request) => request["changes"])
    .filter(isRecord);
  expect(JSON.stringify(uploadedChanges)).not.toContain("auth-repertoire");
  expect(JSON.stringify(uploadedChanges)).not.toContain("auth-chapter");
  expect(JSON.stringify(uploadedChanges)).not.toContain("auth-pgn");
  expect(JSON.stringify(uploadedChanges)).not.toContain("Local Draft Should Disappear");
  expect(await storedRepertoireHandles(page)).toEqual(["server-repertoire"]);
  expect(consoleMessages).toEqual([]);
});

test("new Google account sign in uploads local repertoire data", async ({ page }) => {
  const consoleMessages = collectUnexpectedConsole(page);
  const syncRequests: unknown[] = [];
  const auth = await mockSignedInUser(page, undefined, null, (body) => {
    syncRequests.push(body);
    return {
      cursor: "2026-06-26T00:00:01.000Z",
      changes: acceptedSyncChanges(body),
      acknowledgedPgn: acceptedPgnAcknowledgment(body),
    };
  });

  await openAuthPage(page, {
    localName: "Local London Notes",
    localPgn: "1. d4 d5 *",
    dirty: true,
  });
  await completeGoogleSignIn(page, auth, "new");

  await expect.poll(() => syncRequests.length).toBeGreaterThan(0);
  const firstSync = syncRequests[0];
  expect(firstSync).toMatchObject({
    since: null,
    changes: {
      repertoires: [
        {
          id: "auth-repertoire",
          name: "Local London Notes",
        },
      ],
      pgns: [
        {
          id: "auth-pgn",
          mutations: [{ type: "replacePgn", pgn: "1. d4 d5 *" }],
        },
      ],
    },
  });
  expect(consoleMessages).toEqual([]);
});

test("existing Google account sign in discards local repertoire data and loads server data", async ({
  page,
}) => {
  const consoleMessages = collectUnexpectedConsole(page);
  const syncRequests: unknown[] = [];
  const remoteChanges = {
    repertoires: [
      {
        id: "server-repertoire",
        handle: "server-repertoire",
        name: "Server Repertoire",
        orientation: "black",
        updatedAt: "2026-06-26T00:00:01.000Z",
        deletedAt: null,
      },
    ],
    chapters: [
      {
        id: "server-chapter",
        repertoireId: "server-repertoire",
        handle: "server-chapter",
        name: "Server Chapter",
        pgnId: "server-pgn",
        updatedAt: "2026-06-26T00:00:01.000Z",
        deletedAt: null,
      },
    ],
    pgns: [pgnSnapshot("server-pgn", "1. c4 e5 *", "2026-06-26T00:00:01.000Z")],
  };
  const auth = await mockSignedInUser(page, undefined, null, (body) => {
    syncRequests.push(body);
    return {
      cursor: "2026-06-26T00:00:02.000Z",
      changes: syncRequests.length === 1 ? remoteChanges : emptyChanges(),
      acknowledgedPgn: null,
    };
  });

  await openAuthPage(page, {
    localName: "Local Draft Should Disappear",
    localPgn: "1. d4 d5 *",
    dirty: true,
  });
  const documentRequests: string[] = [];
  page.on("request", (request) => {
    if (request.resourceType() === "document") {
      documentRequests.push(request.url());
    }
  });
  await completeGoogleSignIn(page, auth, "existing");

  await expect(page).toHaveURL(/\/app\/repertoires\/server-repertoire\/server-chapter$/);
  await expect(page.getByText("Server Repertoire").first()).toBeVisible();
  await expect(page.getByText("Local Draft Should Disappear")).toBeHidden();
  await expect.poll(() => syncRequests.length).toBeGreaterThan(0);
  expect(syncRequests[0]).toMatchObject({
    changes: {
      repertoires: [],
      chapters: [],
      pgns: [],
    },
  });
  const uploadedChanges = syncRequests
    .filter(isRecord)
    .map((request) => request["changes"])
    .filter(isRecord);
  expect(JSON.stringify(uploadedChanges)).not.toContain("auth-repertoire");
  expect(JSON.stringify(uploadedChanges)).not.toContain("auth-chapter");
  expect(JSON.stringify(uploadedChanges)).not.toContain("auth-pgn");
  expect(JSON.stringify(uploadedChanges)).not.toContain("Local Draft Should Disappear");
  expect(consoleMessages).toEqual([]);
  expect(documentRequests).not.toContain(
    "http://localhost:5174/app/repertoires/untitled-repertoire/chapter-1",
  );
});

test("loads a backend session without a local signed-in marker", async ({ page }) => {
  const consoleMessages = collectUnexpectedConsole(page);
  let syncRequests = 0;
  const auth = await mockSignedInUser(
    page,
    () => {
      syncRequests++;
    },
    PLAYER_AVATAR_URL,
  );
  await page.route("https://lh3.googleusercontent.com/**", async (route) => {
    await route.fulfill({
      status: 200,
      headers: {
        "access-control-allow-origin": "*",
        "content-type": "image/png",
      },
      body: TRANSPARENT_PIXEL,
    });
  });
  auth.signIn();

  await openAuthPage(page);

  await expect(page.getByText("Player One")).toBeVisible();
  const avatar = page.locator(`img[src="${PLAYER_AVATAR_URL}"]`);
  await expect(avatar).toBeVisible();
  await expect(avatar).toHaveAttribute("crossorigin", "anonymous");
  await expect
    .poll(() =>
      avatar.evaluate((element) =>
        element instanceof HTMLImageElement && element.complete ? element.naturalWidth : 0,
      ),
    )
    .toBeGreaterThan(0);
  await page.getByRole("button", { name: "Account menu" }).click();
  await expect(page.getByText("Feedback")).toHaveCount(0);
  await expect(page.getByText("Sign out")).toBeVisible();
  await expect.poll(() => syncRequests).toBeGreaterThan(0);
  await expect
    .poll(() => page.evaluate(() => localStorage.getItem("en_passant_signed_in")))
    .toBeNull();
  expect(consoleMessages).toEqual([]);
});

test("sends a played move as a path-addressed PGN mutation", async ({ page }) => {
  const syncRequests: unknown[] = [];
  const auth = await mockSignedInUser(page, undefined, null, (body) => {
    syncRequests.push(body);
    return {
      cursor: "2026-06-26T00:00:01.000Z",
      changes: acceptedSyncChanges(body),
      acknowledgedPgn: acceptedPgnAcknowledgment(body),
    };
  });
  auth.signIn();

  await openAuthPage(page, { localPgn: "1. e4 e5 *" });
  await expect(page.locator("[data-square]")).toHaveCount(64);
  await page.getByRole("button", { name: "Move to last main line move" }).click();
  await dragPiece(page, "g1", "f3");

  await expect.poll(() => JSON.stringify(syncRequests)).toContain('"type":"addMove"');
  const requestWithMove = syncRequests.find((request) =>
    JSON.stringify(request).includes('"type":"addMove"'),
  );
  expect(requestWithMove).toMatchObject({
    changes: {
      pgns: [
        {
          id: "auth-pgn",
          mutations: expect.arrayContaining([
            expect.objectContaining({
              type: "addMove",
              parentPath: ["e2e4", "e7e5"],
              move: "g1f3",
            }),
          ]),
        },
      ],
    },
  });
});

test("mobile account menu opens above the username", async ({ page }) => {
  const consoleMessages = collectUnexpectedConsole(page);
  await page.setViewportSize({ width: 390, height: 844 });
  const auth = await mockSignedInUser(page);
  auth.signIn();

  await openAuthPage(page);
  await page.getByRole("button", { name: "Open navigation" }).click();

  const drawer = page.locator('aside[aria-label="Navigation"]');
  await expect(drawer).toBeVisible();
  const accountMenuTrigger = drawer.getByRole("button", { name: "Account menu" });
  await expect(accountMenuTrigger).toBeVisible();
  await accountMenuTrigger.click();

  const accountMenu = page.locator(".motion-menu-content").filter({ hasText: "Sign out" });
  await expect(accountMenu).toBeVisible();
  const triggerBox = await accountMenuTrigger.boundingBox();
  const menuBox = await accountMenu.boundingBox();
  if (triggerBox === null || menuBox === null) {
    throw new Error("Expected account menu trigger and popup boxes to be available");
  }
  expect(menuBox.y + menuBox.height).toBeLessThanOrEqual(triggerBox.y - 1);
  expect(consoleMessages).toEqual([]);
});

test("signing out clears local repertoire data", async ({ page }) => {
  const consoleMessages = collectUnexpectedConsole(page);
  const auth = await mockSignedInUser(page);
  auth.signIn();
  await page.route("**/api/auth/sign-out", async (route) => {
    auth.signOut();
    await route.fulfill({
      status: 200,
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ success: true }),
    });
  });

  await openAuthPage(page);
  await page.getByRole("button", { name: "Account menu" }).click();
  await page.getByText("Sign out").click();

  await expect(page).toHaveURL(/\/app\/repertoires\/demo-repertoire\/london-system$/);
  await expect(page.getByText("Demo repertoire").first()).toBeVisible();
  expect(await storedRepertoireHandles(page)).toEqual(["demo-repertoire"]);
  expect(consoleMessages).toEqual([]);
});

test("can go back from code entry to another email", async ({ page }) => {
  const consoleMessages = collectUnexpectedConsole(page);
  let requestBody: unknown = null;
  await mockSignedInUser(page);
  await page.route("**/api/auth/email-otp/send-verification-otp", async (route) => {
    requestBody = route.request().postDataJSON();
    await route.fulfill({
      status: 200,
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ok: true }),
    });
  });

  await openAuthPage(page);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.getByLabel("Email").fill("player@example.com");
  await page.getByRole("button", { name: "Continue with email" }).click();
  await expect(page.getByLabel("Code")).toBeVisible();

  await page.getByRole("button", { name: "Use another email" }).click();
  await expect(page.getByLabel("Email")).toBeVisible();
  await expect(page.getByLabel("Code")).toBeHidden();
  expect(requestBody).toEqual({
    email: "player@example.com",
    type: "sign-in",
  });
  expect(consoleMessages).toEqual([]);
});

test("shows email code auth errors", async ({ page }) => {
  await mockSignedInUser(page);
  await page.route("**/api/auth/email-otp/send-verification-otp", async (route) => {
    await route.fulfill({
      status: 200,
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ok: true }),
    });
  });
  await page.route("**/api/auth/sign-in/email-otp", async (route) => {
    await route.fulfill({
      status: 401,
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ message: "Invalid code." }),
    });
  });

  await openAuthPage(page);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.getByLabel("Email").fill("player@example.com");
  await page.getByRole("button", { name: "Continue with email" }).click();
  await page.getByLabel("Code").fill("000000");
  await page.getByRole("button", { name: "Sign in" }).last().click();

  await expect(page.getByText("Invalid code.")).toBeVisible();
});

test("starts Google sign in", async ({ page }) => {
  let requestedGoogleStart = false;
  let requestBody: unknown = null;
  await mockSignedInUser(page);
  await page.route("**/api/auth/sign-in/social", async (route) => {
    requestedGoogleStart = true;
    requestBody = route.request().postDataJSON();
    await route.fulfill({
      status: 200,
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        redirect: false,
        url: "/api/auth/callback/google?state=test",
      }),
    });
  });

  await openAuthPage(page);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.getByRole("button", { name: "Continue with Google" }).click();

  expect(requestedGoogleStart).toBe(true);
  expect(requestBody).toMatchObject({
    provider: "google",
    callbackURL:
      "http://localhost:5174/app/repertoires/untitled-repertoire/chapter-1?auth_event=signin",
    newUserCallbackURL:
      "http://localhost:5174/app/repertoires/untitled-repertoire/chapter-1?auth_event=signup",
    disableRedirect: true,
  });
});

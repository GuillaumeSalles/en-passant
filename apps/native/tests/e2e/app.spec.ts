import { test, expect, type Page } from "@playwright/test";

async function openApp(page: Page) {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.route("https://enpassant.io/api/**", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: "null",
      headers: { "access-control-allow-origin": "*" },
    }),
  );
  await page.goto("/");
  await expect(page.getByRole("button", { name: "New repertoire", exact: true })).toBeVisible();
  return errors;
}
async function createChapter(page: Page, name: string, pgn: string) {
  await page.getByRole("button", { name: "New repertoire", exact: true }).click();
  await page.getByRole("textbox", { name: "Name", exact: true }).fill(name);
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await page.getByRole("button", { name: "Import PGN", exact: true }).click();
  await page.getByRole("textbox", { name: "PGN", exact: true }).fill(pgn);
  await page.getByRole("button", { name: "Save", exact: true }).click();
}
async function move(page: Page, from: string, to: string) {
  await page.getByTestId(`square-${from}`).click();
  await page.getByTestId(`square-${to}`).click();
}

test("native library edits legal moves, comments, variations, and persists across restart", async ({
  page,
}) => {
  const errors = await openApp(page);
  await createChapter(page, "Sicilian", "1. e4 e5 (1... c5) 2. Nf3 *");
  await page.getByRole("button", { name: "First move", exact: true }).click();
  await move(page, "d2", "d5");
  await expect(page.getByTestId("square-d2")).toHaveAttribute("aria-label", "d2 wp");
  await move(page, "d2", "d4");
  await expect(page.getByTestId("square-d4")).toHaveAttribute("aria-label", "d4 wp");
  await page.getByRole("button", { name: "Edit comment", exact: true }).click();
  await page.getByRole("textbox", { name: "Comment", exact: true }).fill("Control the center");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByText("Control the center", { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("button", { name: "New repertoire", exact: true })).toBeVisible();
  const chapter = page.getByRole("button", { name: "Chapter 1", exact: true });
  await chapter.click();
  await page.getByRole("button", { name: "1. d4", exact: true }).click();
  await expect(page.getByText("Control the center", { exact: true })).toBeVisible();
  expect(errors).toEqual([]);
});

test("native training grades moves, practices mistakes, and persists the review schedule", async ({
  page,
}) => {
  const errors = await openApp(page);
  await createChapter(page, "Training fixture", "1. e4 e5 2. Nf3 *");
  await page.getByRole("button", { name: "Train chapter", exact: true }).click();
  await page.getByRole("button", { name: "Train line 1", exact: true }).click();
  await move(page, "d2", "d4");
  await expect(page.getByText("Try again. Expected e4.", { exact: true })).toBeVisible();
  await move(page, "e2", "e4");
  await expect(page.getByTestId("square-e5")).toHaveAttribute("aria-label", "e5 bp");
  await move(page, "g1", "f3");
  await expect(
    page.getByText("Practice the missed moves three times.", { exact: true }),
  ).toBeVisible();
  for (let index = 0; index < 3; index++) await move(page, "e2", "e4");
  await expect(page.getByText("Line complete · 1 mistake", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Back to lines", exact: true }).click();
  await expect(page.getByText(/Review .*learning/)).toBeVisible();
  expect(errors).toEqual([]);
});

test("native chapter deletion never leaves stale move controls", async ({ page }) => {
  const errors = await openApp(page);
  await createChapter(page, "Delete fixture", "1. e4 *");
  await page.getByRole("button", { name: "Delete chapter", exact: true }).click();
  await page.getByRole("button", { name: "Confirm delete", exact: true }).click();
  await expect(page.getByText("London system", { exact: true }).last()).toBeVisible();
  await page.getByRole("button", { name: "Next move", exact: true }).click();
  await expect(page.getByTestId("square-d4")).toHaveAttribute("aria-label", "d4 wp");
  expect(errors).toEqual([]);
});

test("email sign-in syncs the library and sign-out removes authenticated local data", async ({
  page,
}) => {
  const errors = await openApp(page);
  let signedIn = false;
  const user = { id: "native-user", name: "Native tester", email: "native@example.com" };
  const syncRequests: unknown[] = [];
  await page.route("https://enpassant.io/api/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    let result: unknown = {};
    if (path === "/api/auth/sign-in/email-otp") {
      signedIn = true;
      result = { user };
    }
    if (path === "/api/auth/get-session") result = signedIn ? { user } : null;
    if (path === "/api/auth/sign-out") signedIn = false;
    if (path === "/api/sync") {
      const body = route.request().postDataJSON() as {
        changes: { pgns: { id: string; updatedAt: string }[] };
      };
      syncRequests.push(body);
      const pgn = body.changes.pgns[0];
      result = {
        cursor: new Date().toISOString(),
        changes: { repertoires: [], chapters: [], pgns: [], trainingLineSchedules: [] },
        acknowledgedPgn:
          pgn === undefined
            ? null
            : { id: pgn.id, revision: "native-r1", byteSize: 40, updatedAt: pgn.updatedAt },
      };
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(result),
    });
  });
  await page.getByRole("button", { name: "Account", exact: true }).click();
  await page.getByRole("textbox", { name: "Email", exact: true }).fill(user.email);
  await page.getByRole("button", { name: "Send code", exact: true }).click();
  await page.getByRole("textbox", { name: "Verification code", exact: true }).fill("123456");
  await page.getByRole("button", { name: "Verify code", exact: true }).click();
  await expect(page.getByRole("button", { name: "Sync now", exact: true })).toBeVisible();
  await expect.poll(() => syncRequests.length).toBeGreaterThan(0);
  await expect(page.getByRole("button", { name: "Sign out", exact: true })).toBeEnabled();
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(
    page
      .getByRole("button", { name: "Send code", exact: true })
      .or(page.getByRole("button", { name: "Verify code", exact: true })),
  ).toBeVisible();
  await page.getByRole("button", { name: "Library", exact: true }).click();
  await expect(
    page.getByText("Create a repertoire to begin. Your library works offline.", { exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByText("Create a repertoire to begin. Your library works offline.", { exact: true }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});

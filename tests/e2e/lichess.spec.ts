import { expect, test } from "./fixtures";
import { collectUnexpectedConsole, storedGames, storedGameImports } from "./helpers";

function game(index: number, createdAt: number, status = "mate") {
  const id = index.toString().padStart(8, "0");
  return {
    id,
    createdAt,
    status,
    variant: "standard",
    rated: true,
    speed: "blitz",
    perf: "blitz",
    moves: "e4 e5",
    pgn: `[Site "https://lichess.org/${id}"]\n[White "Alice"]\n[Black "Bob"]\n[Result "1-0"]\n\n1. e4 e5 1-0`,
  };
}

test("imports full history, checks for missing games on every route at startup, and can pause", async ({
  page,
}) => {
  const messages = collectUnexpectedConsole(page);
  const backendRequests: string[] = [];
  const exports: URL[] = [];
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (url.pathname.startsWith("/api/") && url.hostname !== "lichess.org")
      backendRequests.push(request.url());
  });
  const started = Date.now() - 30_000;
  const history = Array.from({ length: 123 }, (_, index) => game(index, started + index * 100));
  await page.route("https://lichess.org/api/games/user/**", async (route) => {
    exports.push(new URL(route.request().url()));
    const games = exports.length === 1 ? history : [history[122], game(123, started + 12_300)];
    await route.fulfill({
      contentType: "application/x-ndjson",
      body: games.map((value) => JSON.stringify(value)).join("\n"),
    });
  });
  await page.goto("/app/games");
  await expect(page.getByLabel("Lichess username")).toBeEnabled();
  expect(exports).toHaveLength(0);
  await page.getByLabel("Lichess username").fill("Alice");
  await page.getByRole("button", { name: "Import all games", exact: true }).click();
  await expect(page.getByText("Lichess is up to date. Imported 123 new games.")).toBeVisible();
  await expect(page.getByRole("link", { name: "View game", exact: true })).toHaveCount(123);
  expect(exports[0]?.searchParams.has("max")).toBe(false);
  expect(exports[0]?.searchParams.has("since")).toBe(false);
  const checkpoint = (await storedGameImports(page))[0]?.since;
  expect((await storedGames(page)).length).toBe(123);

  // A full navigation into a repertoire/training route must also start the saved import.
  await page.goto("/app/training");
  await expect.poll(async () => (await storedGames(page)).length).toBe(124);
  expect(exports).toHaveLength(2);
  expect(exports[1]?.searchParams.get("since")).toBe(String(checkpoint));
  // Follow the app link so the shared import status and committed games are reused.
  await page.getByRole("link", { name: "Games", exact: true }).click();
  await expect(page.getByRole("link", { name: "View game", exact: true })).toHaveCount(124);
  await expect(page.getByLabel("Lichess username")).toHaveValue("alice");
  await page.getByLabel("Check for new games when this site opens").uncheck();
  await expect.poll(async () => (await storedGameImports(page))[0]?.automatic).toBe(false);
  await page.reload();
  await expect(page.getByLabel("Lichess username")).toBeEnabled();
  await expect(page.getByLabel("Check for new games when this site opens")).not.toBeChecked();
  expect(exports).toHaveLength(2);
  expect(backendRequests).toEqual([]);
  expect(messages).toEqual([]);
});

test("preserves imported batches after a broken stream, then resumes without duplicates", async ({
  page,
}) => {
  const messages = collectUnexpectedConsole(page);
  const started = Date.now() - 120_000;
  const history = Array.from({ length: 55 }, (_, index) => game(index, started + index * 1000));
  let attempt = 0;
  await page.route("https://lichess.org/api/games/user/**", async (route) => {
    attempt++;
    await route.fulfill({
      contentType: "application/x-ndjson",
      body:
        attempt === 1
          ? `${history
              .slice(0, 50)
              .map((value) => JSON.stringify(value))
              .join("\n")}\n{broken`
          : history.map((value) => JSON.stringify(value)).join("\n"),
    });
  });
  await page.goto("/app/games");
  await expect(page.getByLabel("Lichess username")).toBeEnabled();
  await page.getByLabel("Lichess username").fill("Alice");
  await page.getByRole("button", { name: "Import all games", exact: true }).click();
  await expect(page.getByText(/Saved games are kept/)).toBeVisible();
  expect(await storedGames(page)).toHaveLength(50);
  expect((await storedGameImports(page))[0]?.since).toBe(started + 49_000 - 60_000);
  await page.reload();
  await expect(page.getByText("Lichess is up to date. Imported 5 new games.")).toBeVisible();
  expect(await storedGames(page)).toHaveLength(55);
  await expect(page.getByRole("link", { name: "View game", exact: true })).toHaveCount(55);
  expect(messages).toEqual([]);
});

test("a PGN file and a Lichess import of the same game share one local game", async ({ page }) => {
  const entry = game(1, Date.now() - 10_000);
  await page.route("https://lichess.org/api/games/user/**", async (route) => {
    await route.fulfill({ contentType: "application/x-ndjson", body: JSON.stringify(entry) });
  });
  await page.goto("/app/games");
  await page
    .getByLabel("Import games", { exact: true })
    .setInputFiles({ name: "game.pgn", mimeType: "text/plain", buffer: Buffer.from(entry.pgn) });
  await expect(page.getByText("Imported 1 games.")).toBeVisible();
  await expect(page.getByLabel("Lichess username")).toBeEnabled();
  await page.getByLabel("Lichess username").fill("Alice");
  await page.getByRole("button", { name: "Import all games", exact: true }).click();
  await expect(page.getByText("Lichess is up to date. Imported 0 new games.")).toBeVisible();
  await page.getByLabel("Import games", { exact: true }).setInputFiles({
    name: "game.pgn",
    mimeType: "text/plain",
    buffer: Buffer.from(entry.pgn.replace("1. e4", "1. e4 {annotation}")),
  });
  await expect(page.getByText("Imported 0 games.")).toBeVisible();
  expect(await storedGames(page)).toHaveLength(1);
});

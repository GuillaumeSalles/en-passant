import { expect, test } from "./fixtures";
test("imports and reviews games locally and keeps them after reload", async ({ page }) => {
  const requests: string[] = [];
  page.on("request", (r) => {
    if (new URL(r.url()).pathname.startsWith("/api/")) requests.push(r.url());
  });
  await page.goto("/app/games");
  await page.getByLabel("Import games", { exact: true }).setInputFiles({
    name: "games.pgn",
    mimeType: "text/plain",
    buffer: Buffer.from('[White "Alice"]\n[Black "Bob"]\n[Result "1-0"]\n\n1. e4 e5 2. Nf3 *'),
  });
  await expect(page.getByText("Imported 1 games.")).toBeVisible();
  await page.reload();
  await page.getByRole("link", { name: "View game", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Alice vs Bob" })).toBeVisible();
  await expect(page.locator("[data-square]")).toHaveCount(64);
  expect(requests).toEqual([]);
});

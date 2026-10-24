import { cleanup, render, waitFor } from "@solidjs/testing-library";
import { afterEach, expect, test, vi } from "vitest";
import { useTrainingMistakeLinks } from "./useTrainingMistakeLinks";
import { notifyGamesChanged } from "./gameUpdates";
import { loadTrainingMistakeLinks } from "./games";
vi.mock("./games", () => ({
  loadTrainingMistakeLinks: vi.fn(async () => ({ ok: true, links: [] })),
}));
afterEach(cleanup);

test("updates training mistake links after a background game import", async () => {
  function Links() {
    const links = useTrainingMistakeLinks();
    return <p>{Object.keys(links()).length} mistake links</p>;
  }
  const view = render(Links);
  await waitFor(() => expect(loadTrainingMistakeLinks).toHaveBeenCalledTimes(1));
  vi.mocked(loadTrainingMistakeLinks).mockResolvedValueOnce({
    ok: true,
    links: [
      { chapterId: "c", uciPath: "e2e4", game: { id: "g", createdAt: 123, opponentName: "Bob" } },
    ],
  });
  notifyGamesChanged();
  await waitFor(() => expect(view.getByText("1 mistake links")).toBeDefined());
});

import { cleanup, fireEvent, render, screen, waitFor } from "@solidjs/testing-library";
import { afterEach, expect, test, vi } from "vitest";
import { MergePgnDialog } from "./MergePgnDialog";

const mergePgn = vi.hoisted(() => vi.fn());

vi.mock("@/lib/useMutation", () => ({
  useMutation: () => mergePgn,
}));

afterEach(() => {
  cleanup();
  mergePgn.mockReset();
});

test("clears cancelled input and merges pasted PGN", async () => {
  render(() => <MergePgnDialog />);
  const mergeButton = screen.getByRole("button", { name: "Merge pgn" });
  fireEvent.click(mergeButton);

  expect(await screen.findByRole("dialog", { name: "Merge PGN" })).not.toBeNull();
  expect(screen.getByRole("button", { name: "Cancel" })).not.toBeNull();
  const pgn = "1. e4 c5 2. Nf3 *";
  fireEvent.input(screen.getByRole("textbox"), { target: { value: pgn } });
  fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
  await waitFor(() => expect(screen.queryByRole("dialog", { name: "Merge PGN" })).toBeNull());

  fireEvent.click(mergeButton);
  expect(((await screen.findByRole("textbox")) as HTMLTextAreaElement).value).toBe("");
  fireEvent.input(screen.getByRole("textbox"), { target: { value: pgn } });
  await Promise.resolve();
  fireEvent.click(screen.getByRole("button", { name: "Merge" }));

  await waitFor(() => expect(mergePgn).toHaveBeenCalledWith(pgn));
  await waitFor(() => expect(screen.queryByRole("dialog", { name: "Merge PGN" })).toBeNull());
});

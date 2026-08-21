import { cleanup, fireEvent, render, screen } from "@solidjs/testing-library";
import { afterEach, expect, test, vi } from "vitest";
import { TrainingReviewButton } from "./TrainingReviewButton";

const mocks = vi.hoisted(() => ({ startReview: vi.fn() }));

vi.mock("@/lib/useMutation", () => ({
  useMutation: () => mocks.startReview,
}));

afterEach(() => {
  cleanup();
  mocks.startReview.mockReset();
});

test("starts a review queue through the shared review-lines control", () => {
  render(() => <TrainingReviewButton count={3} href="/training/first-line" />);

  const reviewLines = screen.getByRole("link", { name: "Review lines" });
  expect(reviewLines.getAttribute("href")).toBe("/training/first-line");
  expect(reviewLines.querySelector("[data-review-count]")?.textContent).toBe("3");

  reviewLines.addEventListener("click", (event) => event.preventDefault());
  fireEvent.click(reviewLines);
  expect(mocks.startReview).toHaveBeenCalledOnce();
  expect(mocks.startReview).toHaveBeenCalledWith(3);
});

test("keeps the shared review-lines control disabled when no line is due", () => {
  render(() => <TrainingReviewButton count={0} href={undefined} />);

  expect(screen.queryByRole("link", { name: "Review lines" })).toBeNull();
  expect(screen.getByRole("button", { name: "Review lines" }).hasAttribute("disabled")).toBe(true);
  expect(screen.getByRole("tooltip").textContent).toBe("You have no variation to review");
});

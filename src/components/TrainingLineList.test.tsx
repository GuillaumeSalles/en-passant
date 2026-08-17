import { cleanup, render, screen } from "@solidjs/testing-library";
import { afterEach, expect, test } from "vitest";
import { TrainingLineList, type TrainingLineListItem } from "./TrainingLineList";

afterEach(cleanup);

function trainingLine(overrides: Partial<TrainingLineListItem> = {}): TrainingLineListItem {
  return {
    id: "v1-line",
    label: "e4 e5 Nf3",
    intervalIndex: 1,
    isAlternative: false,
    isLearned: true,
    dueAt: 1_000,
    primaryHref: "/train/v1-line",
    viewHref: "/chapter?move=end",
    trainingStatus: "due",
    ...overrides,
  };
}

test("renders the shared training-line structure and route-specific actions", () => {
  render(() => (
    <TrainingLineList
      lines={[
        trainingLine({
          detailLinks: [{ href: "/game", label: "Review game" }],
          queueKey: "review-key",
        }),
      ]}
      emptyMessage="Nothing to train"
      loading={false}
      now={2_000}
    />
  ));

  const row = screen.getByText("e4 e5 Nf3").closest("[data-training-line]");
  expect(screen.getByText("e4 e5 Nf3").classList.contains("text-foreground")).toBe(true);
  expect(row?.getAttribute("data-training-line")).toBe("v1-line");
  expect(row?.getAttribute("data-training-queue-line")).toBe("review-key");
  expect(row?.getAttribute("data-training-status")).toBe("due");
  expect(row?.textContent).toContain("Due now");
  expect(screen.getByText("Due now").classList.contains("text-muted-foreground")).toBe(true);
  expect(screen.getByRole("link", { name: "View" }).getAttribute("href")).toBe("/chapter?move=end");
  expect(screen.getByRole("link", { name: "Review" }).getAttribute("href")).toBe("/train/v1-line");
});

test("uses Learn as the primary action for a line that has never been learned", () => {
  render(() => (
    <TrainingLineList
      lines={[
        trainingLine({
          isLearned: false,
          primaryHref: "/learn/v1-line",
        }),
      ]}
      emptyMessage="Nothing to train"
      loading={false}
      now={2_000}
    />
  ));

  expect(screen.getByRole("link", { name: "Learn" }).getAttribute("href")).toBe("/learn/v1-line");
  expect(screen.queryByRole("link", { name: "Review" })).toBeNull();
});

test("uses a secondary Overstudy action for a learned line that is not due", () => {
  render(() => (
    <TrainingLineList
      lines={[
        trainingLine({
          dueAt: 3_000,
          trainingStatus: "trained",
        }),
      ]}
      emptyMessage="Nothing to train"
      loading={false}
      now={2_000}
    />
  ));

  const overstudy = screen.getByRole("link", { name: "Overstudy" });
  expect(overstudy.getAttribute("href")).toBe("/train/v1-line");
  expect(overstudy.classList.contains("border-input")).toBe(true);
  expect(screen.queryByRole("link", { name: "Review" })).toBeNull();
});

test("renders one empty state for either training route", () => {
  render(() => (
    <TrainingLineList lines={[]} emptyMessage="No scheduled lines" loading={false} now={2_000} />
  ));

  expect(screen.getByText("No scheduled lines")).not.toBeNull();
});

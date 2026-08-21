import { cleanup, fireEvent, render, screen } from "@solidjs/testing-library";
import { flush } from "solid-js";
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
    primaryHref: "/app/white/main/v1-line/train",
    readHref: "/app/white-repertoire/main-line/v1-line",
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
  flush(() => fireEvent.click(screen.getByRole("button", { name: "Actions for e4 e5 Nf3" })));
  expect(screen.getByRole("link", { name: "Read line" }).getAttribute("href")).toBe(
    "/app/white-repertoire/main-line/v1-line",
  );
  expect(screen.getByRole("link", { name: "View in chapter" }).getAttribute("href")).toBe(
    "/chapter?move=end",
  );
  expect(screen.getByRole("link", { name: "Review" }).getAttribute("href")).toBe(
    "/app/white/main/v1-line/train",
  );
});

test("uses Learn as the primary action for a line that has never been learned", () => {
  render(() => (
    <TrainingLineList
      lines={[
        trainingLine({
          isLearned: false,
          primaryHref: "/app/white/main/v1-line/learn",
        }),
      ]}
      emptyMessage="Nothing to train"
      loading={false}
      now={2_000}
    />
  ));

  expect(screen.getByRole("link", { name: "Learn" }).getAttribute("href")).toBe(
    "/app/white/main/v1-line/learn",
  );
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
  expect(overstudy.getAttribute("href")).toBe("/app/white/main/v1-line/train");
  expect(overstudy.classList.contains("border-input")).toBe(true);
  expect(screen.queryByRole("link", { name: "Review" })).toBeNull();
});

test("renders one empty state for either training route", () => {
  render(() => (
    <TrainingLineList lines={[]} emptyMessage="No scheduled lines" loading={false} now={2_000} />
  ));

  expect(screen.getByText("No scheduled lines")).not.toBeNull();
});

test("renders line-shaped placeholders while training lines load", () => {
  render(() => (
    <TrainingLineList
      lines={[trainingLine()]}
      emptyMessage="Nothing to train"
      loading
      loadingMessage="Loading chapter lines…"
      now={2_000}
    />
  ));

  expect(screen.getByRole("status", { name: "Loading chapter lines…" })).not.toBeNull();
  expect(document.querySelectorAll("[data-training-line-skeleton]")).toHaveLength(3);
  expect(screen.queryByText("e4 e5 Nf3")).toBeNull();
  expect(screen.queryByRole("link")).toBeNull();
});

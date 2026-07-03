import { render, screen, cleanup } from "@solidjs/testing-library";
import { afterEach, expect, test } from "vitest";
import { Eval } from "@/lib/AppState";
import { EvalBar } from "./EvalBar";

afterEach(cleanup);

function evaluation(value: number): Eval {
  return {
    index: 0,
    depth: 12,
    score: { type: "cp", value },
    moves: [],
  };
}

function getFillAmount(): string {
  const evalBar = screen.getByLabelText("Evaluation bar");
  const fill = evalBar.firstElementChild;
  if (!(fill instanceof HTMLElement)) {
    throw new Error("Expected evaluation bar fill to be visible");
  }
  return fill.style.getPropertyValue("--eval-fill");
}

test("renders a neutral bar when no evaluation is available", () => {
  render(() => <EvalBar orientation="white" evaluation={undefined} />);

  expect(getFillAmount()).toBe("50%");
});

test("uses the normalized score stored on the evaluation", () => {
  const { unmount } = render(() => <EvalBar orientation="white" evaluation={evaluation(120)} />);
  const whiteAdvantageAmount = getFillAmount();
  unmount();

  render(() => <EvalBar orientation="white" evaluation={evaluation(-120)} />);
  expect(getFillAmount()).not.toBe(whiteAdvantageAmount);
});

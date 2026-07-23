import { cleanup, render, screen } from "@solidjs/testing-library";
import { afterEach, expect, test } from "vitest";
import { formatTimeControl, TimeControl } from "./TimeControl";

afterEach(cleanup);

test.each([
  ["180+0", "3+0"],
  ["180-0", "3+0"],
  ["90+5", "1:30+5"],
  ["30+0", "0:30+0"],
  ["600+10", "10+10"],
  ["correspondence", "correspondence"],
])("formats %s as %s", (value, expected) => {
  expect(formatTimeControl(value)).toBe(expected);
});

test("renders the formatted time control", () => {
  render(() => <TimeControl value="180+2" class="test-class" />);

  const timeControl = screen.getByText("3+2");
  expect(timeControl.tagName).toBe("SPAN");
  expect(timeControl.className).toBe("test-class");
});

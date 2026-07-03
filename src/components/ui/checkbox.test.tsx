import { render, screen, cleanup, fireEvent } from "@solidjs/testing-library";
import { afterEach, expect, test } from "vitest";
import { Checkbox } from "./checkbox";

afterEach(cleanup);

test("does not propagate Space keydown", () => {
  const keys: string[] = [];
  const onWindowKeyDown = (event: KeyboardEvent) => {
    keys.push(event.key);
  };
  window.addEventListener("keydown", onWindowKeyDown);

  try {
    render(() => <Checkbox checked={false} />);

    fireEvent.keyDown(screen.getByRole("checkbox"), { key: " " });

    expect(keys).toEqual([]);
  } finally {
    window.removeEventListener("keydown", onWindowKeyDown);
  }
});

test("toggles when activated", () => {
  const changes: boolean[] = [];

  render(() => (
    <Checkbox
      checked={false}
      onCheckedChange={(checked) => {
        changes.push(checked);
      }}
    />
  ));

  fireEvent.click(screen.getByRole("checkbox"));

  expect(changes).toEqual([true]);
});

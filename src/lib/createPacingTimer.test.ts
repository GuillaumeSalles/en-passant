import { afterEach, describe, expect, test, vi } from "vitest";
import { createPacingTimer } from "./createPacingTimer";

afterEach(() => {
  vi.useRealTimers();
});

describe("createPacingTimer", () => {
  test("runs the latest scheduled callback once", () => {
    vi.useFakeTimers();
    const first = vi.fn();
    const second = vi.fn();
    const timer = createPacingTimer();

    timer.schedule(100, first);
    timer.schedule(200, second);
    vi.advanceTimersByTime(199);

    expect(first).not.toHaveBeenCalled();
    expect(second).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);
    expect(second).toHaveBeenCalledOnce();
  });

  test("cancels pending pacing", () => {
    vi.useFakeTimers();
    const elapsed = vi.fn();
    const timer = createPacingTimer();

    timer.schedule(100, elapsed);
    timer.cancel();
    vi.runAllTimers();

    expect(elapsed).not.toHaveBeenCalled();
  });
});

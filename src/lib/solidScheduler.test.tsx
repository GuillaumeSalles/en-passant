import { cleanup, fireEvent, render, screen } from "@solidjs/testing-library";
import { afterEach, expect, test } from "vitest";
import { createMemo, createSignal, flush, Show } from "solid-js";

afterEach(cleanup);

test("keeps scheduling updates after an async conditional subtree remount", async () => {
  function SchedulerReproduction() {
    const [mounted, setMounted] = createSignal(true);
    const [loaded, setLoaded] = createSignal(false);
    const [heartbeat, setHeartbeat] = createSignal(0);

    const level1 = createMemo(() => heartbeat() + 1);
    const level2 = createMemo(() => level1() + 1);
    const level3 = createMemo(() => level2() + 1);
    const level4 = createMemo(() => level3() + 1);
    const level5 = createMemo(() => level4() + 1);
    const level6 = createMemo(() => level5() + 1);
    const level7 = createMemo(() => level6() + 1);
    const level8 = createMemo(() => level7() + 1);
    const level9 = createMemo(() => level8() + 1);
    const level10 = createMemo(() => level9() + 1);

    // This memo keeps the same value when loading finishes, but gains a much
    // deeper dependency. Solid 2 beta.14 could then corrupt its scheduler heap
    // when the surrounding Show was unmounted and remounted.
    const condition = createMemo(() => !loaded() || level10() >= 0);

    return (
      <>
        <button onClick={() => Promise.resolve().then(() => setLoaded(true))}>Load</button>
        <button onClick={() => setMounted((value) => !value)}>Toggle</button>
        <button onClick={() => setHeartbeat((value) => value + 1)}>Heartbeat</button>
        <output>{heartbeat()}</output>
        <Show when={mounted()}>
          <Show when={condition()}>
            <span>Ready</span>
          </Show>
        </Show>
      </>
    );
  }

  render(() => <SchedulerReproduction />);

  fireEvent.click(screen.getByText("Load"));
  await Promise.resolve();
  flush();
  flush(() => fireEvent.click(screen.getByText("Toggle")));
  flush(() => fireEvent.click(screen.getByText("Toggle")));
  flush(() => fireEvent.click(screen.getByText("Heartbeat")));

  expect(screen.getByText("Ready")).toBeTruthy();
  expect(screen.getByText("1")).toBeTruthy();
});

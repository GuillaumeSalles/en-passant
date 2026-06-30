import { createEffect, createRoot, flush } from "solid-js";
import { describe, expect, test } from "vitest";
import { createStore } from "./createStore";

describe("createStore", () => {
  test("reads initial values and applies direct and functional updates", () => {
    const store = createStore({ count: 1, label: "one" });

    expect(store.state.count).toBe(1);
    expect(store.state.label).toBe("one");

    store.state.set("count", 2);
    store.state.set("label", (label) => label.toUpperCase());

    expect(store.state.count).toBe(2);
    expect(store.state.label).toBe("ONE");
  });

  test("tracks each key independently", () => {
    createRoot((dispose) => {
      const store = createStore({ count: 1, label: "one" });
      let countRuns = 0;
      let labelRuns = 0;

      createEffect(
        () => store.state.count,
        () => {
          countRuns++;
        },
      );
      createEffect(
        () => store.state.label,
        () => {
          labelRuns++;
        },
      );
      flush();

      expect(countRuns).toBe(1);
      expect(labelRuns).toBe(1);

      store.state.set("count", 2);
      flush();

      expect(countRuns).toBe(2);
      expect(labelRuns).toBe(1);

      store.state.set("count", 2);
      flush();

      expect(countRuns).toBe(2);
      expect(labelRuns).toBe(1);

      dispose();
    });
  });
});

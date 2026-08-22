import { cleanup, render, screen, waitFor } from "@solidjs/testing-library";
import { afterEach, expect, test, vi } from "vitest";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.resetModules();
});

test("loads and shares one opening index across consumers", async () => {
  const fetchOpenings = vi.fn(
    async () =>
      new Response(JSON.stringify([["position-key", "C50", "Italian Game"]]), { status: 200 }),
  );
  vi.stubGlobal("fetch", fetchOpenings);
  const { useOpeningIndex } = await import("./useOpeningIndex");

  function Consumer() {
    const result = useOpeningIndex();
    const openingName = () => {
      const current = result();
      return current.status === "success" ? current.data.get("position-key")?.name : "Loading";
    };
    return <div>{openingName()}</div>;
  }

  render(() => (
    <>
      <Consumer />
      <Consumer />
    </>
  ));

  await waitFor(() => expect(screen.getAllByText("Italian Game")).toHaveLength(2));
  expect(fetchOpenings).toHaveBeenCalledOnce();
  expect(fetchOpenings).toHaveBeenCalledWith("/openings-4b862275.json");
});

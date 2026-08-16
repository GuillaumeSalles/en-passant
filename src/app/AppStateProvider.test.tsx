import { render, screen, cleanup, fireEvent } from "@solidjs/testing-library";
import { afterEach, expect, test } from "vitest";
import { AppStateProvider } from "./AppStateProvider";
import { useSelector } from "@/lib/useSelector";
import type { JSX } from "@solidjs/web";
import { flush } from "solid-js";
import { useMutation } from "@/lib/useMutation";
import { flipBoard, toggleEngine } from "@/lib/AppState";
import { TestRouter } from "@/tests/TestRouter";

afterEach(() => {
  cleanup();
  window.localStorage.clear();
});

function Wrapper(props: { children: JSX.Element }) {
  return (
    <TestRouter>
      <AppStateProvider>{props.children}</AppStateProvider>
    </TestRouter>
  );
}

test("should select data", () => {
  function TestComponent() {
    const orientation = useSelector((state) => state.orientation);
    return <h1>{orientation()}</h1>;
  }
  render(() => (
    <Wrapper>
      <TestComponent />
    </Wrapper>
  ));
  expect(screen.getByRole("heading").textContent).toBe("white");
});

test("should re-render when the selected data changes", async () => {
  function TestComponent() {
    const onFlipBoard = useMutation(flipBoard);
    const orientation = useSelector((state) => state.orientation);
    return (
      <>
        <h1>{orientation()}</h1>
        <button onClick={onFlipBoard}>Toggle</button>
      </>
    );
  }
  render(() => (
    <Wrapper>
      <TestComponent />
    </Wrapper>
  ));
  expect(screen.getByRole("heading").textContent).toBe("white");
  flush(() => fireEvent.click(screen.getByText("Toggle")));
  expect(screen.getByRole("heading").textContent).toBe("black");
});

test("should not re-render when the selected data does not change", async () => {
  function TestComponent() {
    const onToggleEngine = useMutation(toggleEngine);
    const orientation = useSelector((state) => state.orientation);
    return (
      <>
        <h1>{orientation()}</h1>
        <button onClick={onToggleEngine}>Toggle</button>
      </>
    );
  }
  render(() => (
    <Wrapper>
      <TestComponent />
    </Wrapper>
  ));
  expect(screen.getByRole("heading").textContent).toBe("white");
  flush(() => fireEvent.click(screen.getByText("Toggle")));
  expect(screen.getByRole("heading").textContent).toBe("white");
});

test("restores and persists the engine enabled preference", () => {
  window.localStorage.setItem("en_passant_engine_enabled", "false");

  function TestComponent() {
    const onToggleEngine = useMutation(toggleEngine);
    const isEngineEnabled = useSelector((state) => state.engineSettings.isEnabled);
    return (
      <>
        <h1>{isEngineEnabled() ? "enabled" : "disabled"}</h1>
        <button onClick={onToggleEngine}>Toggle</button>
      </>
    );
  }

  render(() => (
    <Wrapper>
      <TestComponent />
    </Wrapper>
  ));
  expect(screen.getByRole("heading").textContent).toBe("disabled");

  flush(() => fireEvent.click(screen.getByText("Toggle")));

  expect(screen.getByRole("heading").textContent).toBe("enabled");
  expect(window.localStorage.getItem("en_passant_engine_enabled")).toBe("true");
});

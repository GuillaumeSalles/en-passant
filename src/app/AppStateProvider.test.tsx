import { render, screen, cleanup, fireEvent } from "@solidjs/testing-library";
import { afterEach, expect, test } from "vitest";
import { AppStateProvider } from "./AppStateProvider";
import { useSelector } from "@/lib/useSelector";
import { MemoryRouter, Route } from "@solidjs/router";
import type { JSX } from "@solidjs/web";
import { flush } from "solid-js";
import { useMutation } from "@/lib/useMutation";
import { flipBoard, toggleEngine } from "@/lib/AppState";

afterEach(cleanup);

function Wrapper(props: { children: JSX.Element }) {
  return (
    <MemoryRouter root={() => <AppStateProvider>{props.children}</AppStateProvider>}>
      <Route path="/" component={() => null} />
    </MemoryRouter>
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

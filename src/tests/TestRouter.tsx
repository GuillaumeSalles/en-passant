import { createRouter, memoryHistory } from "@solidjs/router";
import type { JSX } from "@solidjs/web";

export function TestRouter(props: { children: JSX.Element }) {
  const Router = createRouter({
    history: memoryHistory(),
    routes: [{ path: "*", component: () => null }],
  });

  return <Router>{() => props.children}</Router>;
}

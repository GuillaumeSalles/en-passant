// Type declarations to work around @solidjs/router 0.17 beta type resolution issues
// The router exports types via ./components.jsx which TypeScript can't resolve in d.ts files

declare module "@solidjs/router" {
  import type { JSX } from "@solidjs/web";

  type RouteMetadata = Record<string, string | number | boolean | null | undefined>;
  type NavigationState = Record<string, string | number | boolean | null> | null;

  // Router
  export interface RouterProps {
    base?: string;
    root?: (props: { children?: JSX.Element }) => JSX.Element;
    children?:
      | JSX.Element
      | import("@solidjs/router").RouteDefinition
      | import("@solidjs/router").RouteDefinition[];
    explicitLinks?: boolean;
    preload?: boolean;
    url?: string;
    href?: string;
  }
  export function Router(props: RouterProps): JSX.Element;

  // Route
  export interface RouteProps {
    path?: string | string[];
    component?: () => JSX.Element;
    children?: JSX.Element;
    matchFilters?: RouteMetadata;
    preload?: () => void;
    info?: RouteMetadata;
  }
  export function Route(props: RouteProps): JSX.Element;

  // A (anchor)
  export interface AnchorProps extends Omit<JSX.AnchorHTMLAttributes<HTMLAnchorElement>, "state"> {
    href: string;
    replace?: boolean;
    noScroll?: boolean;
    state?: NavigationState;
    inactiveClass?: string;
    activeClass?: string;
    end?: boolean;
    children?: JSX.Element;
  }
  export function A(props: AnchorProps): JSX.Element;

  // Hooks
  export function useLocation(): {
    pathname: string;
    search: string;
    hash: string;
    state: NavigationState;
    query: Record<string, string>;
  };
  export function useParams<T extends Record<string, string> = Record<string, string>>(): T;
  export function useNavigate(): (
    to: string,
    options?: { replace?: boolean; resolve?: boolean; scroll?: boolean; state?: NavigationState },
  ) => void;

  // RouteSectionProps
  export interface RouteSectionProps<T = undefined> {
    children?: JSX.Element;
    params: Record<string, string>;
    location: ReturnType<typeof useLocation>;
    data?: T;
  }

  // MemoryRouter (for testing)
  export function MemoryRouter(props: {
    children?: JSX.Element;
    url?: string;
    base?: string;
    root?: (props: { children?: JSX.Element }) => JSX.Element;
  }): JSX.Element;
}

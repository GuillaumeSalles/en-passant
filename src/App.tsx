import type { JSX } from "@solidjs/web";
import { createEffect, createSignal, Show } from "solid-js";
import type { Accessor } from "solid-js";
import { Router, Route } from "@solidjs/router";
import { useLocation, useNavigate, useParams } from "@solidjs/router";
import { AppStateProvider, useState } from "@/app/AppStateProvider";
import { HorizontalDashedDivider } from "@/components/ui/HorizontalDashedDivider";
import { VerticalDashedDivider } from "@/components/ui/VerticalDashedDivider";
import { Repertoires } from "@/app/Repertoires";
import { Design } from "@/app/Design";
import { Debug } from "@/app/Debug";
import { NotFound } from "@/app/NotFound";
import { Repertoire } from "@/components/Repertoire";
import { VariationTraining } from "@/app/repertoires/[repertoireHandle]/[chapterHandle]/train/VariationTraining";
import { EnPassantLogo } from "@/components/EnPassantLogo";
import { AuthButton } from "@/components/AuthButton";
import { SignupNudge } from "@/components/SignupNudge";
import { Button } from "@/components/ui/button";
import { MobileNavigationProvider, MobileNavigationTrigger } from "@/components/MobileNavigation";
import { X } from "@/components/Icons";
import { currentAuthUser } from "@/lib/authSession";
import { getChapterScopeFromData } from "@/lib/AppState";
import { APP_ROOT, firstRepertoireChapterPath } from "@/lib/routes";

function SidebarHeader() {
  return (
    <div class="flex h-[3.25rem] flex-row items-center justify-between gap-2 p-2">
      <div class="flex min-w-0 flex-row items-center gap-1">
        <EnPassantLogo class="h-6 w-6 flex-none" />
        <h2 class="truncate text-base">En passant</h2>
      </div>
    </div>
  );
}

function SidebarActions() {
  return (
    <div class="mt-auto flex flex-col gap-2 border-t border-border p-3">
      <GlobalActions class="flex-col" buttonClass="w-full" />
    </div>
  );
}

function GlobalActions(props: { class?: string; buttonClass?: string } = {}) {
  return (
    <div class={`flex gap-2 ${props.class ?? ""}`}>
      <Show when={currentAuthUser() === null}>
        <Button variant="outline" class={props.buttonClass}>
          Feedback
        </Button>
      </Show>
      <AuthButton class={props.buttonClass} />
    </div>
  );
}

function AppShell(props: { children?: JSX.Element }) {
  const [isDrawerOpen, setIsDrawerOpen] = createSignal(false);

  function closeDrawerAfterNavigation(event: MouseEvent) {
    const target = event.target;
    if (!(target instanceof Element)) return;
    if (target.closest("a") !== null) {
      setIsDrawerOpen(false);
    }
  }

  return (
    <MobileNavigationProvider openDrawer={() => setIsDrawerOpen(true)}>
      <div class="relative flex h-screen w-screen flex-row overflow-hidden font-[family-name:var(--font-geist-sans)] antialiased">
        <HorizontalDashedDivider class="pointer-events-none absolute left-0 right-0 top-[3.25rem] z-10" />
        <VerticalDashedDivider class="pointer-events-none absolute left-[200px] top-0 z-10 hidden xl:block" />
        <VerticalDashedDivider class="pointer-events-none absolute right-[400px] top-0 z-10 hidden xl:block" />
        <div class="absolute right-0 top-0 z-20 hidden h-[3.25rem] w-[400px] items-center justify-end px-2 xl:flex">
          <GlobalActions />
        </div>
        <div class="relative hidden w-[200px] min-w-[200px] flex-none flex-col xl:flex">
          <SidebarHeader />
          <div class="min-h-0 flex-1 overflow-y-auto">
            <Repertoires />
          </div>
        </div>
        <Show when={isDrawerOpen()}>
          <>
            <div
              class="motion-drawer-overlay fixed inset-0 z-40 bg-black/70 xl:hidden"
              onClick={() => setIsDrawerOpen(false)}
            />
            <aside
              class="motion-mobile-drawer fixed inset-y-0 left-0 z-50 flex w-[min(20rem,calc(100vw-3rem))] flex-col border-r border-border bg-background shadow-xl xl:hidden"
              aria-label="Navigation"
            >
              <div class="flex h-[3.25rem] flex-row items-center justify-between gap-2 p-2">
                <div class="flex min-w-0 flex-row items-center gap-1">
                  <EnPassantLogo class="h-6 w-6 flex-none" />
                  <h2 class="truncate text-base">En passant</h2>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Close navigation"
                  onClick={() => setIsDrawerOpen(false)}
                >
                  <X />
                </Button>
              </div>
              <div class="min-h-0 flex-1 overflow-y-auto" onClick={closeDrawerAfterNavigation}>
                <Repertoires />
              </div>
              <SidebarActions />
            </aside>
          </>
        </Show>
        {props.children}
        <SignupNudge />
        <div id="drag-overlay" class="pointer-events-none absolute inset-0 z-10" />
      </div>
    </MobileNavigationProvider>
  );
}

function BaseLayout() {
  return (
    <div class="flex h-full min-w-0 flex-1 flex-col">
      <div class="flex h-[3.25rem] flex-shrink-0 flex-row">
        <div class="flex min-w-0 flex-1 items-center gap-2 pl-4 pr-2">
          <MobileNavigationTrigger class="flex-none" />
        </div>
        <div class="hidden w-[400px] min-w-[400px] max-w-[400px] flex-none xl:block" />
      </div>
      <div class="min-h-0 flex-1" />
    </div>
  );
}

function useRedirectAppRootToFirstChapter() {
  const state = useState();
  const location = useLocation();
  const navigate = useNavigate();

  createEffect(
    () => ({
      pathname: location.pathname,
      repertoires: state.repertoires,
      chapters: state.chapters,
    }),
    ({ pathname, repertoires, chapters }) => {
      if (pathname !== APP_ROOT) {
        return;
      }
      if (repertoires.status !== "success" || chapters.status !== "success") {
        return;
      }

      const path = firstRepertoireChapterPath(
        Object.values(repertoires.data),
        Object.values(chapters.data),
      );
      if (path !== null) {
        navigate(path, { replace: true });
      }
    },
  );
}

function AppRootRoute() {
  useRedirectAppRootToFirstChapter();
  return <BaseLayout />;
}

function useRedirectMissingRepertoireRoute(props: {
  getRepertoireHandle: Accessor<string>;
  getChapterHandle: Accessor<string>;
}) {
  const state = useState();
  const navigate = useNavigate();

  createEffect(
    () => ({
      repertoireHandle: props.getRepertoireHandle(),
      chapterHandle: props.getChapterHandle(),
      repertoires: state.repertoires,
      chapters: state.chapters,
    }),
    ({ repertoireHandle, chapterHandle, repertoires, chapters }) => {
      if (repertoires.status !== "success" || chapters.status !== "success") {
        return;
      }

      const scope = getChapterScopeFromData(
        repertoires.data,
        chapters.data,
        repertoireHandle,
        chapterHandle,
      );
      if (scope === null) {
        navigate(APP_ROOT, { replace: true });
      }
    },
  );
}

function RepertoireRoute() {
  const params = useParams<{ repertoireHandle: string; chapterHandle: string }>();
  useRedirectMissingRepertoireRoute({
    getRepertoireHandle: () => params.repertoireHandle,
    getChapterHandle: () => params.chapterHandle,
  });
  return (
    <Repertoire repertoireHandle={params.repertoireHandle} chapterHandle={params.chapterHandle} />
  );
}

function TrainRoute() {
  const params = useParams<{ repertoireHandle: string; chapterHandle: string }>();
  useRedirectMissingRepertoireRoute({
    getRepertoireHandle: () => params.repertoireHandle,
    getChapterHandle: () => params.chapterHandle,
  });
  return (
    <VariationTraining
      repertoireHandle={params.repertoireHandle}
      chapterHandle={params.chapterHandle}
    />
  );
}

function Root(props: { children?: JSX.Element }) {
  const location = useLocation();
  const navigate = useNavigate();

  createEffect(
    () => location.pathname,
    (pathname) => {
      if (pathname === "/") {
        navigate(APP_ROOT, { replace: true });
      }
    },
  );

  function isAppRoute() {
    return location.pathname === APP_ROOT || location.pathname.startsWith(`${APP_ROOT}/`);
  }

  return (
    <Show when={isAppRoute()} fallback={props.children}>
      <AppStateProvider>
        <AppShell>{props.children}</AppShell>
      </AppStateProvider>
    </Show>
  );
}

export default function App() {
  return (
    <Router root={Root}>
      <Route path="/design" component={Design} />
      <Route path="/debug" component={Debug} />
      <Route path={APP_ROOT} component={AppRootRoute} />
      <Route
        path={`${APP_ROOT}/repertoires/:repertoireHandle/:chapterHandle`}
        component={RepertoireRoute}
      />
      <Route
        path={`${APP_ROOT}/repertoires/:repertoireHandle/:chapterHandle/train`}
        component={TrainRoute}
      />
      <Route path="*" component={NotFound} />
    </Router>
  );
}

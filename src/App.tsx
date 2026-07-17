import type { JSX } from "@solidjs/web";
import { createEffect, createMemo, createSignal, Show } from "solid-js";
import type { Accessor } from "solid-js";
import { Router, Route } from "@solidjs/router";
import { useLocation, useNavigate, useParams } from "@solidjs/router";
import { AppStateProvider, useState } from "@/app/AppStateProvider";
import { HorizontalDashedDivider } from "@/components/ui/HorizontalDashedDivider";
import { VerticalDashedDivider } from "@/components/ui/VerticalDashedDivider";
import { Repertoires } from "@/app/Repertoires";
import { Design } from "@/app/Design";
import { Debug } from "@/app/Debug";
import { GameViewer } from "@/app/GameViewer";
import { Games } from "@/app/Games";
import { NotFound } from "@/app/NotFound";
import { Repertoire } from "@/components/Repertoire";
import { RepertoireOverview } from "@/app/repertoires/[repertoireHandle]/RepertoireOverview";
import { VariationTraining } from "@/app/repertoires/[repertoireHandle]/[chapterHandle]/train/VariationTraining";
import { TrainingLines } from "@/app/repertoires/[repertoireHandle]/[chapterHandle]/train/TrainingLines";
import { EnPassantLogo } from "@/components/EnPassantLogo";
import { AuthButton } from "@/components/AuthButton";
import { SignupNudge } from "@/components/SignupNudge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { MobileNavigationProvider, MobileNavigationTrigger } from "@/components/MobileNavigation";
import { GitHub, Info, X, XLogo } from "@/components/Icons";
import { getChapterScopeFromData } from "@/lib/AppState";
import { isSafariBrowser } from "@/lib/browser";
import { APP_ROOT, firstRepertoireChapterPath } from "@/lib/routes";

const GITHUB_REPO_URL = "https://github.com/GuillaumeSalles/en-passant";
const FEEDBACK_URL = "https://x.com/guillaume_slls";

function SidebarHeader() {
  return (
    <div class="flex h-[3.25rem] flex-row items-center justify-between gap-2 p-2">
      <div class="flex min-w-0 flex-row items-center gap-1">
        <EnPassantLogo class="h-6 w-6 flex-none" />
        <h2 class="truncate text-base font-medium">En passant</h2>
      </div>
    </div>
  );
}

function SidebarFooter(props: { showGlobalActions: boolean }) {
  return (
    <Show when={props.showGlobalActions}>
      <div class="flex flex-col gap-2 p-3">
        <AboutDialog buttonClass="w-full" />
        <GlobalActions class="flex-col" buttonClass="w-full" showAbout={false} menuSide="top" />
      </div>
    </Show>
  );
}

function GlobalActions(props: {
  class?: string;
  buttonClass?: string;
  showAbout: boolean;
  menuSide?: "bottom" | "top";
}) {
  return (
    <div class={`flex gap-2 ${props.class ?? ""}`}>
      <Show when={props.showAbout}>
        <AboutDialog buttonClass={props.buttonClass} />
      </Show>
      <AuthButton class={props.buttonClass} menuSide={props.menuSide} />
    </div>
  );
}

function AboutDialog(props: { buttonClass?: string | undefined } = {}) {
  return (
    <Dialog>
      <DialogTrigger>
        <Button type="button" variant="outline" class={props.buttonClass}>
          <Info />
          About
        </Button>
      </DialogTrigger>
      <DialogContent class="max-w-md gap-5">
        <DialogHeader class="space-y-0 pr-6 text-left">
          <div class="flex items-center gap-3">
            <span class="flex h-10 w-10 flex-none items-center justify-center rounded-md border border-border bg-muted/30">
              <EnPassantLogo class="h-6 w-6" />
            </span>
            <div class="min-w-0">
              <DialogTitle>En passant</DialogTitle>
              <DialogDescription class="mt-1">Build and train your repertoire.</DialogDescription>
            </div>
          </div>
        </DialogHeader>
        <div class="grid gap-3 text-sm leading-6 text-muted-foreground">
          <p>
            I was not satisfied with the existing apps to build and train my own chess repertoire so
            I decided to build my own and{" "}
            <a
              class="font-medium text-foreground underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              href={GITHUB_REPO_URL}
              target="_blank"
              rel="noreferrer"
            >
              open source
            </a>{" "}
            it. It's still nowhere the level of quality I want it to be; more features and polish to
            come.
          </p>
          <p>
            Reach out on{" "}
            <a
              class="font-medium text-foreground underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              href={FEEDBACK_URL}
              target="_blank"
              rel="noreferrer"
            >
              X
            </a>{" "}
            for feedback.
          </p>
        </div>
        <div class="grid gap-2 sm:grid-cols-2">
          <Button
            href={FEEDBACK_URL}
            target="_blank"
            rel="noreferrer"
            variant="outline"
            class="justify-start"
          >
            <XLogo />X
          </Button>
          <Button
            href={GITHUB_REPO_URL}
            target="_blank"
            rel="noreferrer"
            variant="outline"
            class="justify-start"
          >
            <GitHub />
            GitHub
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function AppShell(props: { children?: JSX.Element }) {
  const [isDrawerOpen, setIsDrawerOpen] = createSignal(false);
  const location = useLocation();

  const hasRightPanel = createMemo(
    () =>
      new RegExp(`^${APP_ROOT}/repertoires/[^/]+/[^/]+`).test(location.pathname) ||
      new RegExp(`^${APP_ROOT}/games/[^/]+`).test(location.pathname),
  );

  function closeDrawerAfterNavigation(event: MouseEvent) {
    const target = event.target;
    if (!(target instanceof Element)) return;
    if (target.closest("a") !== null) {
      setIsDrawerOpen(false);
    }
  }

  return (
    <MobileNavigationProvider openDrawer={() => setIsDrawerOpen(true)}>
      <div class="app-viewport relative flex flex-row overflow-hidden font-[family-name:var(--font-geist-sans)] antialiased">
        <Show when={isSafariBrowser()}>
          <HorizontalDashedDivider
            class="pointer-events-none absolute left-0 right-0 top-0 z-10"
            animationKey="safari-top-divider"
          />
        </Show>
        <HorizontalDashedDivider class="pointer-events-none absolute left-0 right-0 top-[3.25rem] z-10 hidden xl:block" />
        <VerticalDashedDivider class="pointer-events-none absolute left-[200px] top-0 z-10 hidden xl:block" />
        <Show when={hasRightPanel()}>
          <VerticalDashedDivider class="pointer-events-none absolute right-[400px] top-0 z-10 hidden xl:block" />
        </Show>
        <div class="absolute right-0 top-0 z-20 hidden h-[3.25rem] w-[400px] items-center justify-end px-2 xl:flex">
          <GlobalActions showAbout={true} />
        </div>
        <div class="relative hidden w-[200px] min-w-[200px] flex-none flex-col xl:flex">
          <SidebarHeader />
          <div class="min-h-0 flex-1 overflow-y-auto">
            <Repertoires />
          </div>
          <SidebarFooter showGlobalActions={false} />
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
                  <h2 class="truncate text-base font-medium">En passant</h2>
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
              <HorizontalDashedDivider animation="none" />
              <div class="min-h-0 flex-1 overflow-y-auto" onClick={closeDrawerAfterNavigation}>
                <Repertoires />
              </div>
              <SidebarFooter showGlobalActions />
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

function useRedirectMissingRepertoireOverviewRoute(props: {
  getRepertoireHandle: Accessor<string>;
}) {
  const state = useState();
  const navigate = useNavigate();

  createEffect(
    () => ({
      repertoireHandle: props.getRepertoireHandle(),
      repertoires: state.repertoires,
    }),
    ({ repertoireHandle, repertoires }) => {
      if (repertoires.status !== "success") {
        return;
      }

      const repertoire = Object.values(repertoires.data).find(
        (candidate) => candidate.handle === repertoireHandle,
      );
      if (repertoire === undefined) {
        navigate(APP_ROOT, { replace: true });
      }
    },
  );
}

function RepertoireOverviewRoute() {
  const params = useParams<{ repertoireHandle: string }>();
  useRedirectMissingRepertoireOverviewRoute({
    getRepertoireHandle: () => params.repertoireHandle,
  });
  return <RepertoireOverview repertoireHandle={params.repertoireHandle} />;
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
    <TrainingLines
      repertoireHandle={params.repertoireHandle}
      chapterHandle={params.chapterHandle}
      missingLine={false}
    />
  );
}

function TrainLineRoute() {
  const params = useParams<{
    repertoireHandle: string;
    chapterHandle: string;
    lineId: string;
  }>();
  useRedirectMissingRepertoireRoute({
    getRepertoireHandle: () => params.repertoireHandle,
    getChapterHandle: () => params.chapterHandle,
  });
  return (
    <VariationTraining
      repertoireHandle={params.repertoireHandle}
      chapterHandle={params.chapterHandle}
      lineId={params.lineId}
    />
  );
}

function GameRoute() {
  const params = useParams<{ gameId: string }>();
  return <GameViewer gameId={params.gameId} />;
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
      <Route path={`${APP_ROOT}/games`} component={Games} />
      <Route path={`${APP_ROOT}/games/:gameId`} component={GameRoute} />
      <Route
        path={`${APP_ROOT}/repertoires/:repertoireHandle`}
        component={RepertoireOverviewRoute}
      />
      <Route
        path={`${APP_ROOT}/repertoires/:repertoireHandle/:chapterHandle`}
        component={RepertoireRoute}
      />
      <Route
        path={`${APP_ROOT}/repertoires/:repertoireHandle/:chapterHandle/train`}
        component={TrainRoute}
      />
      <Route
        path={`${APP_ROOT}/repertoires/:repertoireHandle/:chapterHandle/train/:lineId`}
        component={TrainLineRoute}
      />
      <Route path="*" component={NotFound} />
    </Router>
  );
}

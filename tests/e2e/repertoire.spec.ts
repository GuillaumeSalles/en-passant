import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import {
  clearLocalStorageAndIndexedDb,
  collectUnexpectedConsole,
  firstStoredPgn,
  mockSignedOutAuth,
  seedIndexedDb,
  type ChapterRecord,
  type RepertoireRecord,
} from "./helpers";

declare global {
  interface Window {
    __playedSounds: string[];
    __pieceAnimations: string[];
    __boardAnimationSequence: string[];
  }
}

const syncedAt = "2026-06-26T00:00:00.000Z";

const repertoire = {
  id: "e2e-repertoire",
  handle: "untitled-repertoire",
  name: "Untitled Repertoire",
  orientation: "white",
  updatedAt: syncedAt,
  deletedAt: null,
  dirty: false,
} satisfies RepertoireRecord;

const chapter = {
  id: "e2e-chapter",
  repertoireId: repertoire.id,
  handle: "chapter-1",
  name: "Chapter 1",
  pgnId: "e2e-pgn",
  updatedAt: syncedAt,
  deletedAt: null,
  dirty: false,
} satisfies ChapterRecord;

const secondChapter = {
  id: "e2e-chapter-2",
  repertoireId: repertoire.id,
  handle: "chapter-2",
  name: "Chapter 2",
  pgnId: "e2e-pgn-2",
  updatedAt: syncedAt,
  deletedAt: null,
  dirty: false,
};

const alphaRepertoire = {
  id: "alpha-repertoire",
  handle: "alpha-repertoire",
  name: "Alpha Repertoire",
  orientation: "white",
  updatedAt: syncedAt,
  deletedAt: null,
  dirty: false,
} satisfies RepertoireRecord;

const alphaChapter = {
  id: "alpha-chapter",
  repertoireId: alphaRepertoire.id,
  handle: "alpha-chapter",
  name: "Alpha Chapter",
  pgnId: "alpha-pgn",
  updatedAt: syncedAt,
  deletedAt: null,
  dirty: false,
} satisfies ChapterRecord;

const zetaChapter = {
  id: "zeta-chapter",
  repertoireId: alphaRepertoire.id,
  handle: "zeta-chapter",
  name: "Zeta Chapter",
  pgnId: "zeta-pgn",
  updatedAt: syncedAt,
  deletedAt: null,
  dirty: false,
};

const defaultPgn = "1. e4 e5 2. Nf3 Nc6 3. Bc4";

test.beforeEach(async ({ page }) => {
  await mockSignedOutAuth(page);
});

async function seedRepertoire(
  page: Page,
  pgn = defaultPgn,
  extraChapters: ChapterRecord[] = [],
  seededRepertoire: RepertoireRecord = repertoire,
  extraRepertoires: RepertoireRecord[] = [],
) {
  const chapters = [chapter, ...extraChapters];
  await seedIndexedDb(page, {
    repertoires: [seededRepertoire, ...extraRepertoires],
    chapters,
    pgns: chapters.map((seededChapter) => ({
      id: seededChapter.pgnId,
      pgn,
      updatedAt: syncedAt,
      deletedAt: null,
      dirty: false,
    })),
  });
}

async function resetLocalAppData(page: Page) {
  await clearLocalStorageAndIndexedDb(page);
}

async function openRepertoire(page: Page, pgn = defaultPgn) {
  await seedRepertoire(page, pgn);
  await page.goto("/app/repertoires/untitled-repertoire/chapter-1");
  await expectRepertoireReady(page);
}

async function openFirstTrainingLine(page: Page) {
  await page.goto("/app/repertoires/untitled-repertoire/chapter-1/train");
  await expect(page.getByRole("heading", { name: "Lines" })).toBeVisible();
  await page.locator("[data-training-line]").first().getByRole("link", { name: "Train" }).click();
  await expect(page.locator("[data-square]")).toHaveCount(64);
}

async function expectRepertoireReady(page: Page) {
  await expect(page.locator("[data-square]")).toHaveCount(64);
  await expect(page.locator("[data-moves-tree]")).toBeVisible();
  await expect(page.getByRole("button", { name: "Next move" })).toBeEnabled();
}

async function expectDrawerLayout(page: Page) {
  const trainLink = page.getByRole("link", { name: "Train" });
  const drawerButton = page.getByRole("button", { name: "Open navigation" });
  await expect(trainLink).toBeVisible();
  await expect(drawerButton).toBeVisible();

  const trainBox = await trainLink.boundingBox();
  const drawerButtonBox = await drawerButton.boundingBox();
  if (trainBox === null || drawerButtonBox === null) {
    throw new Error("Expected Train and navigation trigger to have visible boxes");
  }
  expect(drawerButtonBox.x).toBeLessThan(trainBox.x);

  const bottomSquareBox = await page.locator('[data-square="a1"]').boundingBox();
  const panelBox = await page.getByText("Computer evaluation").boundingBox();
  if (bottomSquareBox === null || panelBox === null) {
    throw new Error("Expected chessboard and analysis panel to have visible boxes");
  }
  expect(panelBox.y).toBeGreaterThan(bottomSquareBox.y + bottomSquareBox.height);

  const horizontalOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(horizontalOverflow).toBeLessThanOrEqual(0);
  await expectEvalBarMatchesChessboardHeight(page);
}

async function expectEvalBarMatchesChessboardHeight(page: Page) {
  const boardBox = await page.evaluate(() => {
    const squareBoxes = Array.from(document.querySelectorAll("[data-square]"), (square) => {
      const rect = square.getBoundingClientRect();
      return {
        bottom: rect.bottom,
        left: rect.left,
        right: rect.right,
        top: rect.top,
      };
    });

    if (squareBoxes.length === 0) return null;

    return {
      bottom: Math.max(...squareBoxes.map((box) => box.bottom)),
      left: Math.min(...squareBoxes.map((box) => box.left)),
      right: Math.max(...squareBoxes.map((box) => box.right)),
      top: Math.min(...squareBoxes.map((box) => box.top)),
    };
  });
  const evalBarBox = await page.locator('[aria-label="Evaluation bar"]').boundingBox();

  if (boardBox === null || evalBarBox === null) {
    throw new Error("Expected chessboard and evaluation bar to have visible boxes");
  }

  const boardWidth = boardBox.right - boardBox.left;
  const boardHeight = boardBox.bottom - boardBox.top;
  const isHorizontalEvalBar = evalBarBox.width > evalBarBox.height;

  if (isHorizontalEvalBar) {
    const touchesBoard =
      Math.abs(evalBarBox.y + evalBarBox.height - boardBox.top) <= 1 ||
      Math.abs(evalBarBox.y - boardBox.bottom) <= 1;
    expect(Math.abs(evalBarBox.x - boardBox.left)).toBeLessThanOrEqual(1);
    expect(Math.abs(evalBarBox.width - boardWidth)).toBeLessThanOrEqual(1);
    expect(touchesBoard).toBe(true);
    return;
  }

  expect(Math.abs(evalBarBox.y - boardBox.top)).toBeLessThanOrEqual(1);
  expect(Math.abs(evalBarBox.height - boardHeight)).toBeLessThanOrEqual(1);
}

async function recordPlayedSounds(page: Page) {
  await page.addInitScript(() => {
    window.__playedSounds = [];
    Object.defineProperty(window, "Audio", {
      configurable: true,
      value: class {
        readonly src: string;

        constructor(src?: string | URL) {
          this.src = src?.toString() ?? "";
        }

        play() {
          window.__playedSounds.push(this.src);
          return Promise.resolve();
        }
      },
    });
  });
}

async function playedSounds(page: Page) {
  return page.evaluate(() => window.__playedSounds);
}

async function recordPieceAnimations(page: Page) {
  await page.addInitScript(() => {
    window.__pieceAnimations = [];

    document.addEventListener(
      "animationstart",
      (event) => {
        if (event.target instanceof Element && event.target.matches("[data-moving-piece]")) {
          window.__pieceAnimations.push(event.animationName);
        }
      },
      true,
    );
  });
}

async function pieceAnimationCount(page: Page) {
  return page.evaluate(() => window.__pieceAnimations.length);
}

async function resetPieceAnimations(page: Page) {
  await page.evaluate(() => {
    window.__pieceAnimations = [];
  });
}

async function recordBoardAnimationSequence(page: Page) {
  await page.addInitScript(() => {
    window.__boardAnimationSequence = [];

    document.addEventListener(
      "animationend",
      (event) => {
        if (event.target instanceof Element && event.target.matches("[data-square]")) {
          window.__boardAnimationSequence.push("board-square-end");
        }
      },
      true,
    );
    document.addEventListener(
      "animationstart",
      (event) => {
        if (event.target instanceof Element && event.target.matches("[data-moving-piece]")) {
          window.__boardAnimationSequence.push("move-start");
        }
      },
      true,
    );
  });
}

async function expectFirstMoveAfterBoardIntro(page: Page) {
  const sequence = await page.evaluate(() => window.__boardAnimationSequence);
  const firstMoveStart = sequence.indexOf("move-start");
  const lastBoardSquareEnd = sequence.lastIndexOf("board-square-end");

  expect(lastBoardSquareEnd).toBeGreaterThanOrEqual(0);
  expect(firstMoveStart).toBeGreaterThan(lastBoardSquareEnd);
}

async function moveListScrollState(page: Page) {
  return page.evaluate(() => {
    const moveList = document.querySelector("[data-moves-tree]");
    if (!(moveList instanceof HTMLElement)) {
      throw new Error("Expected move list to be visible");
    }

    const ancestorScrollTops: number[] = [];
    for (let element = moveList.parentElement; element !== null; element = element.parentElement) {
      if (element.scrollHeight > element.clientHeight) {
        ancestorScrollTops.push(element.scrollTop);
      }
    }

    return {
      ancestorScrollTops,
      windowScrollY: window.scrollY,
    };
  });
}

async function dragPiece(page: Page, from: string, to: string) {
  await dragBetweenSquares(page, from, to);
}

async function dragPieceWithCapturedTouch(page: Page, from: string, to: string) {
  const source = await squareCenter(page, from);
  const target = await squareCenter(page, to);

  await page.evaluate(
    async ({ from, source, target }) => {
      const sourceSquare = document.querySelector(`[data-square="${from}"]`);
      if (sourceSquare === null) {
        throw new Error(`Cannot drag from ${from}; square is not visible`);
      }
      const nextFrame = () =>
        new Promise<void>((resolve) => {
          requestAnimationFrame(() => resolve());
        });

      const dispatchPointer = (
        type: "pointerdown" | "pointermove" | "pointerup",
        point: { x: number; y: number },
        buttons: number,
      ) => {
        sourceSquare.dispatchEvent(
          new PointerEvent(type, {
            bubbles: true,
            cancelable: true,
            button: 0,
            buttons,
            clientX: point.x,
            clientY: point.y,
            isPrimary: true,
            pointerId: 1,
            pointerType: "touch",
          }),
        );
      };

      dispatchPointer("pointerdown", source, 1);
      await nextFrame();
      dispatchPointer("pointermove", target, 1);
      await nextFrame();
      dispatchPointer("pointerup", target, 0);
    },
    { from, source, target },
  );
}

async function dragBetweenSquares(
  page: Page,
  from: string,
  to: string,
  options: { button?: "left" | "right"; steps?: number } = {},
) {
  const sourceSquare = page.locator(`[data-square="${from}"]`);
  const targetSquare = page.locator(`[data-square="${to}"]`);

  const sourceBox = await sourceSquare.boundingBox();
  const targetBox = await targetSquare.boundingBox();
  if (sourceBox == null || targetBox == null) {
    throw new Error(`Cannot drag from ${from} to ${to}; square is not visible`);
  }

  const button = options.button ?? "left";
  await page.mouse.move(sourceBox.x + sourceBox.width / 2, sourceBox.y + sourceBox.height / 2);
  await page.mouse.down({ button });
  await page.mouse.move(targetBox.x + targetBox.width / 2, targetBox.y + targetBox.height / 2, {
    steps: options.steps ?? 8,
  });
  await page.mouse.up({ button });
}

async function squareCenter(page: Page, square: string) {
  const box = await page.locator(`[data-square="${square}"]`).boundingBox();
  if (box == null) {
    throw new Error(`Cannot find ${square}; square is not visible`);
  }
  return {
    x: box.x + box.width / 2,
    y: box.y + box.height / 2,
  };
}

test("creates a demo London System repertoire on first open", async ({ page }) => {
  const consoleMessages = collectUnexpectedConsole(page);
  await resetLocalAppData(page);
  await page.evaluate(() => {
    window.localStorage.setItem("en_passant_repertoire_bootstrap_v1", "1");
  });

  await page.goto("/app");

  await expect(page).toHaveURL(/\/app\/repertoires\/demo-repertoire\/london-system$/);
  await expect(page.getByText("Demo repertoire").first()).toBeVisible();
  await expect(page.getByText("London system").first()).toBeVisible();
  await expect(page.locator("[data-square]")).toHaveCount(64);

  const storedPgn = await firstStoredPgn(page);

  expect(storedPgn).toContain("1. d4 Nf6");
  expect(storedPgn).toContain("{Bishop out before e3.}");
  expect(storedPgn).toContain("(2... g6 {Castle first; c4 can wait.}");
  expect(consoleMessages).toEqual([]);
});

test("repertoire page renders without console warnings", async ({ page }) => {
  const consoleMessages = collectUnexpectedConsole(page);

  await openRepertoire(page);

  await expect(page.getByRole("heading", { name: "En passant" })).toBeVisible();
  await expect(page.getByText("Untitled Repertoire").first()).toBeVisible();
  await expect(page.getByText("Chapter 1").first()).toBeVisible();
  const breadcrumb = page.getByLabel("Breadcrumb");
  await expect(breadcrumb.getByRole("link", { name: "Untitled Repertoire" })).toBeVisible();
  await expect(breadcrumb.getByRole("link", { name: "Chapter 1" })).toBeVisible();
  const chapterActions = page.getByRole("button", { name: "Actions for Chapter 1" });
  await expect(chapterActions).toHaveCSS("opacity", "0");
  await page
    .locator("li")
    .filter({ has: page.getByRole("link", { name: "Chapter 1" }) })
    .hover();
  await expect(chapterActions).toHaveCSS("opacity", "1");
  await expect(page.locator('[data-square="e2"]')).toHaveAttribute("data-piece", "P");

  await page.getByRole("button", { name: "Evaluation settings" }).click();
  await expect(page.getByText("Show evaluation bar")).toBeVisible();
  await expect(page.getByText("Depth (20)")).toBeVisible();

  expect(consoleMessages).toEqual([]);
});

test("app root redirects to the first chapter of the first repertoire", async ({ page }) => {
  const consoleMessages = collectUnexpectedConsole(page);

  await seedRepertoire(page, defaultPgn, [zetaChapter, alphaChapter], repertoire, [
    alphaRepertoire,
  ]);
  await page.goto("/app");

  await expect(page).toHaveURL(/\/app\/repertoires\/alpha-repertoire\/alpha-chapter$/);
  await expect(page.locator("[data-square]")).toHaveCount(64);
  expect(consoleMessages).toEqual([]);
});

test("site root redirects to the app", async ({ page }) => {
  const consoleMessages = collectUnexpectedConsole(page);

  await seedRepertoire(page);
  await page.goto("/");

  await expect(page).toHaveURL(/\/app\/repertoires\/untitled-repertoire\/chapter-1$/);
  await expect(page.locator("[data-square]")).toHaveCount(64);
  expect(consoleMessages).toEqual([]);
});

test("moves navigation into a drawer and stacks the panel on mobile and tablet", async ({
  page,
}) => {
  for (const viewport of [
    { width: 390, height: 844 },
    { width: 834, height: 1112 },
    { width: 1024, height: 768 },
  ]) {
    await page.setViewportSize(viewport);
    await openRepertoire(page);
    await expectDrawerLayout(page);
  }

  const drawerButton = page.getByRole("button", { name: "Open navigation" });
  await drawerButton.click();
  await expect(page.getByRole("heading", { name: "En passant" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Sign in" })).toBeVisible();
});

test("dismisses the signup nudge before opening the auth dialog", async ({ page }) => {
  await seedRepertoire(page);
  await page.evaluate(() => {
    localStorage.setItem("en_passant_signup_nudge_move_count", "5");
  });
  await page.goto("/app/repertoires/untitled-repertoire/chapter-1");
  await expectRepertoireReady(page);

  const signupNudge = page.getByText(
    "Sign up to make sure you don't lose your repertoires. It's free.",
  );
  await expect(signupNudge).toBeVisible();

  await page.getByRole("button", { name: "Sign up", exact: true }).click();

  await expect(signupNudge).toBeHidden();
  await expect(page.getByRole("dialog", { name: "Sign in" })).toBeVisible();
  await expect(page.getByLabel("Email")).toBeVisible();
});

test("touch dragging pieces uses finger position and does not allow board scrolling", async ({
  page,
}) => {
  const consoleMessages = collectUnexpectedConsole(page);

  await page.setViewportSize({ width: 390, height: 844 });
  await openRepertoire(page);

  const boardTouchAction = await page.evaluate(() => {
    const square = document.querySelector("[data-square]");
    if (!(square instanceof HTMLElement) || !(square.parentElement instanceof HTMLElement)) {
      throw new Error("Expected chessboard square to have a board parent");
    }
    return getComputedStyle(square.parentElement).touchAction;
  });
  expect(boardTouchAction).toBe("none");

  const scrollYBeforeDrag = await page.evaluate(() => window.scrollY);
  await dragPieceWithCapturedTouch(page, "e2", "e4");

  await expect(page.locator('[data-square="e4"]')).toHaveAttribute("data-piece", "P");
  await expect(page.locator('[data-square="e2"]')).not.toHaveAttribute("data-piece");
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(scrollYBeforeDrag);
  expect(consoleMessages).toEqual([]);
});

test("playing a move on mobile does not scroll down to the move list", async ({ page }) => {
  const consoleMessages = collectUnexpectedConsole(page);

  await page.setViewportSize({ width: 390, height: 844 });
  await openRepertoire(page);

  const scrollStateBeforeMove = await moveListScrollState(page);
  await dragPiece(page, "d2", "d4");

  await expect(page.locator('[data-san="d4"]')).toHaveAttribute("data-selected", "true");
  await expect.poll(() => moveListScrollState(page)).toEqual(scrollStateBeforeMove);
  expect(consoleMessages).toEqual([]);
});

test("mobile shell uses dynamic viewport sizing for browser controls", async ({ page }) => {
  const consoleMessages = collectUnexpectedConsole(page);

  await page.setViewportSize({ width: 390, height: 844 });
  await openRepertoire(page);

  const viewportStyles = await page.evaluate(() => {
    const appShell = document.querySelector(".app-viewport");
    const toolbar = document.querySelector("[data-pgn-explorer-toolbar]");
    if (!(appShell instanceof HTMLElement) || !(toolbar instanceof HTMLElement)) {
      throw new Error("Expected app shell and PGN toolbar to be visible");
    }

    return {
      dynamicViewportSupported: CSS.supports("height", "100dvh"),
      shellHeight: getComputedStyle(appShell).height,
      toolbarPaddingBottom: getComputedStyle(toolbar).paddingBottom,
      viewportHeight: `${window.innerHeight}px`,
    };
  });

  expect(viewportStyles.dynamicViewportSupported).toBe(true);
  expect(viewportStyles.shellHeight).toBe(viewportStyles.viewportHeight);
  expect(Number.parseFloat(viewportStyles.toolbarPaddingBottom)).toBeGreaterThanOrEqual(8);
  expect(consoleMessages).toEqual([]);
});

test("creates a chapter from the repertoire overview before training", async ({ page }) => {
  const consoleMessages = collectUnexpectedConsole(page);

  await openRepertoire(page);
  await page.getByLabel("Breadcrumb").getByRole("link", { name: "Untitled Repertoire" }).click();
  await expect(page).toHaveURL(/\/app\/repertoires\/untitled-repertoire$/);

  const createChapterButton = page.getByRole("button", { name: "Create chapter" });
  await expect(createChapterButton).toBeVisible();
  await expect(page.getByRole("link", { name: "Train" })).toBeVisible();

  await createChapterButton.click();

  await expect(page).toHaveURL(/\/app\/repertoires\/untitled-repertoire\/chapter-2$/);
  await expect(
    page.getByLabel("Breadcrumb").getByRole("link", { name: "Chapter 2" }),
  ).toBeVisible();
  await page.waitForFunction(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const openRequest = indexedDB.open("en-passant");
      openRequest.onerror = () => reject(openRequest.error);
      openRequest.onsuccess = () => resolve(openRequest.result);
    });

    const storedChapterCount = await new Promise<number>((resolve, reject) => {
      const transaction = db.transaction(["chapters"], "readonly");
      const request = transaction.objectStore("chapters").getAll();
      transaction.onerror = () => reject(transaction.error);
      transaction.oncomplete = () => {
        db.close();
        const chapters = request.result as { handle?: string }[];
        resolve(chapters.filter((storedChapter) => storedChapter.handle === "chapter-2").length);
      };
    });

    return storedChapterCount === 1;
  });

  expect(consoleMessages).toEqual([]);
});

test("opens repertoires with the repertoire side at the bottom", async ({ page }) => {
  const consoleMessages = collectUnexpectedConsole(page);

  await openRepertoire(page);
  const whiteE1 = await squareCenter(page, "e1");
  const whiteE8 = await squareCenter(page, "e8");
  expect(whiteE1.y).toBeGreaterThan(whiteE8.y);

  await seedRepertoire(page, defaultPgn, [], { ...repertoire, orientation: "black" });
  await page.goto("/app/repertoires/untitled-repertoire/chapter-1");
  await expectRepertoireReady(page);
  const blackE1 = await squareCenter(page, "e1");
  const blackE8 = await squareCenter(page, "e8");
  expect(blackE8.y).toBeGreaterThan(blackE1.y);

  expect(consoleMessages).toEqual([]);
});

test("black repertoire training starts after the automatic white move", async ({ page }) => {
  const consoleMessages = collectUnexpectedConsole(page);

  await recordPlayedSounds(page);
  await recordBoardAnimationSequence(page);
  await seedRepertoire(page, "1. e4 e5 *", [], { ...repertoire, orientation: "black" });
  await openFirstTrainingLine(page);
  await expect(page.locator('[data-square="e4"]')).toHaveAttribute("data-piece", "P");
  await expect(page.locator('[data-square="e2"]')).not.toHaveAttribute("data-piece");
  await expect(page.getByText("Black to play.")).toBeVisible();
  await expectFirstMoveAfterBoardIntro(page);

  await dragPiece(page, "e7", "e5");

  await expect(page.locator('[data-square="e5"]')).toHaveAttribute("data-piece", "p");
  await expect(page.getByText("Good job!")).toBeVisible();
  expect(consoleMessages).toEqual([]);
});

test("black repertoire learning waits for the board intro before the first white move", async ({
  page,
}) => {
  const consoleMessages = collectUnexpectedConsole(page);

  await recordPlayedSounds(page);
  await recordBoardAnimationSequence(page);
  await seedRepertoire(page, "1. e4 e5 *", [], { ...repertoire, orientation: "black" });
  await page.goto("/app/repertoires/untitled-repertoire/chapter-1/train");
  await expect(page.getByRole("heading", { name: "Lines" })).toBeVisible();
  await page.locator("[data-training-line]").first().getByRole("link", { name: "Learn" }).click();

  await expect(page.locator('[data-square="e4"]')).toHaveAttribute("data-piece", "P");
  await expectFirstMoveAfterBoardIntro(page);
  expect(consoleMessages).toEqual([]);
});

test("lists stable line URLs and continues through untrained lines", async ({ page }) => {
  const consoleMessages = collectUnexpectedConsole(page);

  await recordPlayedSounds(page);
  await seedRepertoire(page, "1. e4 (1. d4 d5) e5 *");
  await page.goto("/app/repertoires/untitled-repertoire/chapter-1/train");
  await expect(page.getByRole("heading", { name: "Lines" })).toBeVisible();
  const lines = page.locator("[data-training-line]");
  await expect(lines).toHaveCount(2);
  await expect(lines.first().getByRole("link", { name: "Train" })).toHaveAttribute(
    "href",
    /\/train\/v1-[A-Za-z0-9_-]+$/,
  );
  const firstLineHref = await lines
    .first()
    .getByRole("link", { name: "Train" })
    .getAttribute("href");
  await expect(page.getByRole("link", { name: "Train all" })).toHaveAttribute(
    "href",
    firstLineHref ?? "",
  );
  await expect(page.getByText("0/2 trained")).toBeVisible();

  await page.getByRole("link", { name: "Train all" }).click();
  await expect(page.locator("[data-square]")).toHaveCount(64);

  await dragPiece(page, "d2", "d4");
  await expect(page.getByText("Try again.")).toBeVisible();
  await dragPiece(page, "e2", "e4");
  await expect(page.getByText("Replay the failed move.")).toBeVisible();
  await expect(page.locator('[data-square="e2"]')).toHaveAttribute("data-piece", "P");
  await dragPiece(page, "e2", "e4");
  await expect(page.getByText("Replay the failed move.")).toBeVisible();
  await expect(page.locator('[data-square="e2"]')).toHaveAttribute("data-piece", "P");
  await dragPiece(page, "e2", "e4");
  await expect(page.getByText("Good job!")).toBeVisible();
  await page.getByRole("link", { name: "Next line" }).click();
  await expect(page.locator("[data-square]")).toHaveCount(64);
  await dragPiece(page, "d2", "d4");
  await expect(page.getByText("Good job!")).toBeVisible();
  await page.getByRole("link", { name: "Back to lines" }).click();
  await expect(page.getByText("2/2 trained")).toBeVisible();
  await expect(page.getByRole("link", { name: "Train all" })).not.toBeVisible();
  await expect(page.getByText("Trained with 1 mistake")).toBeVisible();
  await expect(page.locator('[data-training-status="trained"]')).toHaveCount(2);
  expect(consoleMessages).toEqual([]);
});

test("retrying a failed training move animates the previous opponent move", async ({ page }) => {
  const consoleMessages = collectUnexpectedConsole(page);

  await recordPieceAnimations(page);
  await seedRepertoire(page, "1. e4 e5 2. Nf3 Nc6 *");
  await openFirstTrainingLine(page);

  await dragPiece(page, "e2", "e4");
  await expect(page.locator('[data-square="e5"]')).toHaveAttribute("data-piece", "p");

  await dragPiece(page, "b1", "c3");
  await expect(page.getByText("Try again.")).toBeVisible();

  await resetPieceAnimations(page);
  await dragPiece(page, "g1", "f3");
  await expect(page.locator('[data-square="f3"]')).toHaveAttribute("data-piece", "N");
  await expect(page.locator('[data-square="c6"]')).toHaveAttribute("data-piece", "n");
  await expect(page.getByText("Replay the failed move.")).toBeVisible();
  await expect(page.locator('[data-square="g1"]')).toHaveAttribute("data-piece", "N");
  await expect(page.locator('[data-square="e5"]')).toHaveAttribute("data-piece", "p");
  await expect(page.locator('[data-square="b8"]')).toHaveAttribute("data-piece", "n");
  await expect.poll(() => pieceAnimationCount(page)).toBe(2);
  expect(consoleMessages).toEqual([]);
});

test("learns a line with demonstrations, responses, and progressive comments", async ({ page }) => {
  const consoleMessages = collectUnexpectedConsole(page);

  await recordPlayedSounds(page);
  await seedRepertoire(
    page,
    "1. e4 {Take the center.} e5 {Black challenges the center.} 2. Nf3 {Develop with tempo.} *",
  );
  await page.goto("/app/repertoires/untitled-repertoire/chapter-1/train");
  const firstLine = page.locator("[data-training-line]").first();

  await expect(firstLine.getByRole("link", { name: "Learn" })).toHaveAttribute(
    "href",
    /\/learn\/v1-[A-Za-z0-9_-]+$/,
  );
  await firstLine.getByRole("link", { name: "Learn" }).click();
  await expect(page).toHaveURL(/\/learn\/v1-[A-Za-z0-9_-]+$/);

  await expect(page.getByText("Watch this move.")).toBeVisible();
  await expect(page.locator('[data-moving-piece="true"]')).toBeVisible();
  await expect(page.getByText("Now repeat the move.")).toBeVisible();
  await dragPiece(page, "e2", "e4");

  expect(consoleMessages).toEqual([]);
  await expect(page.locator('[data-square="e4"]')).toHaveAttribute("data-piece", "P");
  await expect(page.getByText("Take the center.")).toBeVisible();
  await expect(page.getByText("Black challenges the center.")).toBeVisible();
  await expect(page.getByText("Now repeat the move.")).toBeVisible();
  await dragPiece(page, "g1", "f3");

  await expect(page.getByText("Line learned.")).toBeVisible();
  await expect(page.getByText("Develop with tempo.")).toBeVisible();
  await page.getByRole("link", { name: "Back to lines" }).click();
  await expect(page.locator('[data-learning-status="learned"]')).toHaveCount(1);
  await expect(page.getByText("Learned")).toBeVisible();
  await expect(firstLine.getByRole("link", { name: "Learn again" })).toBeVisible();
  expect(consoleMessages).toEqual([]);
});

test("unknown routes render a 404 page", async ({ page }) => {
  const consoleMessages = collectUnexpectedConsole(page);

  await page.goto("/this-line-is-not-in-the-repertoire");

  await expect(page.getByRole("heading", { name: "404" })).toBeVisible();
  expect(consoleMessages).toEqual([]);
});

test("missing repertoire redirects to the first available chapter", async ({ page }) => {
  const consoleMessages = collectUnexpectedConsole(page);

  await seedRepertoire(page);
  await page.goto("/app/repertoires/missing-repertoire/chapter-1");

  await expect(page).toHaveURL(/\/app\/repertoires\/untitled-repertoire\/chapter-1$/);
  expect(consoleMessages).toEqual([]);
});

test("missing chapter redirects to the first available chapter", async ({ page }) => {
  const consoleMessages = collectUnexpectedConsole(page);

  await seedRepertoire(page);
  await page.goto("/app/repertoires/untitled-repertoire/missing-chapter");

  await expect(page).toHaveURL(/\/app\/repertoires\/untitled-repertoire\/chapter-1$/);
  expect(consoleMessages).toEqual([]);
});

test("creates a repertoire from the create repertoire menu", async ({ page }) => {
  const consoleMessages = collectUnexpectedConsole(page);

  await openRepertoire(page);

  const createRepertoireButton = page.getByRole("button", { name: "Create repertoire" });
  await createRepertoireButton.click();
  await expect(page.getByText("Create white repertoire")).toBeVisible();
  const createRepertoireBox = await createRepertoireButton.boundingBox();
  const whiteRepertoireBox = await page.getByText("Create white repertoire").boundingBox();
  if (createRepertoireBox === null || whiteRepertoireBox === null) {
    throw new Error("Expected create repertoire button and menu item to have visible boxes");
  }
  expect(whiteRepertoireBox.y).toBeGreaterThanOrEqual(
    createRepertoireBox.y + createRepertoireBox.height,
  );
  await page.getByText("Create black repertoire").click();

  await expect(page).toHaveURL(/\/app\/repertoires\/untitled-repertoire-1\/chapter-1$/);
  await page.waitForFunction(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const openRequest = indexedDB.open("en-passant");
      openRequest.onerror = () => reject(openRequest.error);
      openRequest.onsuccess = () => resolve(openRequest.result);
    });

    const storedRepertoires = await new Promise<{ name?: string; orientation?: string }[]>(
      (resolve, reject) => {
        const transaction = db.transaction(["repertoires"], "readonly");
        const request = transaction.objectStore("repertoires").getAll();
        request.onerror = () => reject(request.error);
        request.onsuccess = () =>
          resolve(request.result as { name?: string; orientation?: string }[]);
        transaction.oncomplete = () => db.close();
      },
    );

    return storedRepertoires.some(
      (storedRepertoire) =>
        storedRepertoire.name === "Untitled Repertoire" && storedRepertoire.orientation === "black",
    );
  });

  expect(consoleMessages).toEqual([]);
});

test("creates a chapter from a PGN in the sidebar repertoire menu", async ({ page }) => {
  const consoleMessages = collectUnexpectedConsole(page);

  await openRepertoire(page);

  await page.getByRole("button", { name: "Actions for Untitled Repertoire" }).click();
  await expect(page.getByText("Create chapter from PGN")).toBeVisible();
  await expect(page.getByText("Create empty chapter")).toBeVisible();
  await expect(page.getByText("Create new chapter")).toHaveCount(0);

  await page.getByText("Create chapter from PGN").click();
  await expect(page.locator("textarea")).toBeFocused();
  await page.locator("textarea").fill("1. d4 d5 2. c4 {Queen's Gambit} e6 *");
  await page
    .locator(".motion-dialog-content")
    .getByRole("button", { name: "Create chapter", exact: true })
    .click();

  await expect(page).toHaveURL(/\/app\/repertoires\/untitled-repertoire\/chapter-2$/);
  await expect(page.locator('[data-san="d4"]')).toBeVisible();
  await expect(page.locator('[data-san="c4"]')).toBeVisible();
  await expect(page.getByText("Queen's Gambit")).toBeVisible();
  expect(consoleMessages).toEqual([]);
});

test("shows an error when a chapter PGN cannot be parsed", async ({ page }) => {
  const consoleMessages = collectUnexpectedConsole(page);

  await openRepertoire(page);

  await page.getByRole("button", { name: "Actions for Untitled Repertoire" }).click();
  await page.getByText("Create chapter from PGN").click();

  const dialog = page.getByRole("dialog", { name: "Create chapter from PGN" });
  await expect(dialog).toBeVisible();
  await page.locator("textarea").fill("1. e4 e5 2. NotAMove *");
  await dialog.getByRole("button", { name: "Create chapter", exact: true }).click();

  await expect(dialog).toBeVisible();
  await expect(page.getByText("Invalid PGN")).toBeVisible();
  await expect(page).toHaveURL(/\/app\/repertoires\/untitled-repertoire\/chapter-1$/);
  expect(consoleMessages).toEqual([]);
});

test("keeps dialog focus trapped and closes with Escape", async ({ page }) => {
  const consoleMessages = collectUnexpectedConsole(page);

  await openRepertoire(page);

  await page.getByRole("button", { name: "Actions for Untitled Repertoire" }).click();
  await page.getByText("Create chapter from PGN").click();

  const dialog = page.getByRole("dialog", { name: "Create chapter from PGN" });
  await expect(dialog).toBeVisible();
  await expect(page.locator("textarea")).toBeFocused();

  await page.keyboard.press("Shift+Tab");
  await expect(dialog.getByRole("button", { name: "Close" })).toBeFocused();

  await page.keyboard.press("Tab");
  await expect(page.locator("textarea")).toBeFocused();

  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  expect(consoleMessages).toEqual([]);
});

test("sorts repertoires and chapters alphabetically", async ({ page }) => {
  const consoleMessages = collectUnexpectedConsole(page);

  const alphaRepertoire = {
    ...repertoire,
    id: "e2e-alpha-repertoire",
    handle: "alpha-repertoire",
    name: "Alpha Repertoire",
  };
  const zetaRepertoire = {
    ...repertoire,
    id: "e2e-zeta-repertoire",
    handle: "zeta-repertoire",
    name: "Zeta Repertoire",
  };
  const alphaRepertoireChapter = {
    ...chapter,
    id: "e2e-alpha-chapter",
    repertoireId: alphaRepertoire.id,
    handle: "chapter-1",
    name: "Alpha Chapter",
    pgnId: "e2e-alpha-pgn",
  };
  const zetaRepertoireChapter = {
    ...chapter,
    id: "e2e-zeta-chapter",
    repertoireId: zetaRepertoire.id,
    handle: "chapter-1",
    name: "Zeta Chapter",
    pgnId: "e2e-zeta-pgn",
  };
  const middlegameChapter = {
    ...chapter,
    id: "e2e-middlegame-chapter",
    handle: "middlegame",
    name: "Middlegame",
    pgnId: "e2e-middlegame-pgn",
  };
  const alphaIdeasChapter = {
    ...chapter,
    id: "e2e-alpha-ideas-chapter",
    handle: "alpha-ideas",
    name: "Alpha Ideas",
    pgnId: "e2e-alpha-ideas-pgn",
  };

  await seedRepertoire(
    page,
    defaultPgn,
    [middlegameChapter, alphaIdeasChapter, zetaRepertoireChapter, alphaRepertoireChapter],
    repertoire,
    [zetaRepertoire, alphaRepertoire],
  );
  await page.goto("/app/repertoires/untitled-repertoire/chapter-1");
  await expect(page.locator("[data-square]")).toHaveCount(64);

  await expect(page.locator("ul.p-2 > li")).toHaveText([
    "Alpha Repertoire",
    "Alpha Chapter",
    "Untitled Repertoire",
    "Alpha Ideas",
    "Chapter 1",
    "Middlegame",
    "Zeta Repertoire",
    "Zeta Chapter",
  ]);
  expect(consoleMessages).toEqual([]);
});

test("renames a repertoire and redirects to its clean handle", async ({ page }) => {
  const consoleMessages = collectUnexpectedConsole(page);

  await openRepertoire(page);

  await page.getByRole("button", { name: "Actions for Untitled Repertoire" }).click();
  await page.getByText("Rename").click();

  const input = page.getByLabel("Repertoire name");
  await expect(input).toBeFocused();
  await input.fill("");
  await input.pressSequentially("King Pawn Ideas");
  await expect(input).toBeFocused();
  await expect(page).toHaveURL(/\/app\/repertoires\/untitled-repertoire\/chapter-1$/);
  await page.mouse.click(500, 20);

  await expect(page).toHaveURL(/\/app\/repertoires\/king-pawn-ideas\/chapter-1$/);
  await expect(page.getByText("King Pawn Ideas").first()).toBeVisible();
  await expect(page.getByText("Untitled Repertoire")).toHaveCount(0);
  await page.waitForFunction(
    async ({ expectedName, expectedHandle }) => {
      const db = await new Promise<IDBDatabase>((resolve, reject) => {
        const openRequest = indexedDB.open("en-passant");
        openRequest.onerror = () => reject(openRequest.error);
        openRequest.onsuccess = () => resolve(openRequest.result);
      });

      const storedRepertoire = await new Promise<{ name?: string; handle?: string } | undefined>(
        (resolve, reject) => {
          const transaction = db.transaction(["repertoires"], "readonly");
          const request = transaction.objectStore("repertoires").get("e2e-repertoire");
          request.onerror = () => reject(request.error);
          request.onsuccess = () => resolve(request.result as { name?: string; handle?: string });
          transaction.oncomplete = () => db.close();
        },
      );

      return storedRepertoire?.name === expectedName && storedRepertoire.handle === expectedHandle;
    },
    { expectedName: "King Pawn Ideas", expectedHandle: "king-pawn-ideas" },
  );

  await page.reload();
  await expect(page.getByText("King Pawn Ideas").first()).toBeVisible();
  expect(consoleMessages).toEqual([]);
});

test("renames a chapter and redirects to its clean handle", async ({ page }) => {
  const consoleMessages = collectUnexpectedConsole(page);

  await openRepertoire(page);

  await page.getByRole("button", { name: "Actions for Chapter 1" }).click();
  await page.getByText("Rename").click();

  const input = page.getByLabel("Chapter name");
  await expect(input).toBeFocused();
  await input.fill("");
  await input.pressSequentially("Main Line");
  await expect(input).toBeFocused();
  await expect(page).toHaveURL(/\/app\/repertoires\/untitled-repertoire\/chapter-1$/);
  await page.mouse.click(500, 20);

  await expect(page).toHaveURL(/\/app\/repertoires\/untitled-repertoire\/main-line$/);
  await expect(page.getByText("Main Line").first()).toBeVisible();
  await expect(page.getByText("Chapter 1")).toHaveCount(0);
  await page.waitForFunction(
    async ({ expectedName, expectedHandle }) => {
      const db = await new Promise<IDBDatabase>((resolve, reject) => {
        const openRequest = indexedDB.open("en-passant");
        openRequest.onerror = () => reject(openRequest.error);
        openRequest.onsuccess = () => resolve(openRequest.result);
      });

      const storedChapter = await new Promise<{ name?: string; handle?: string } | undefined>(
        (resolve, reject) => {
          const transaction = db.transaction(["chapters"], "readonly");
          const request = transaction.objectStore("chapters").get("e2e-chapter");
          request.onerror = () => reject(request.error);
          request.onsuccess = () => resolve(request.result as { name?: string; handle?: string });
          transaction.oncomplete = () => db.close();
        },
      );

      return storedChapter?.name === expectedName && storedChapter.handle === expectedHandle;
    },
    { expectedName: "Main Line", expectedHandle: "main-line" },
  );

  await page.reload();
  await expect(page.getByText("Main Line").first()).toBeVisible();
  expect(consoleMessages).toEqual([]);
});

test("deleting a chapter keeps its repertoire when other chapters remain", async ({ page }) => {
  const consoleMessages = collectUnexpectedConsole(page);

  await seedRepertoire(page, defaultPgn, [secondChapter]);
  await page.goto("/app/repertoires/untitled-repertoire/chapter-1");
  await expect(page.locator("[data-square]")).toHaveCount(64);

  await page.getByRole("button", { name: "Actions for Chapter 2" }).click();
  await page.getByText("Delete").click();

  await expect(page).toHaveURL(/\/app\/repertoires\/untitled-repertoire\/chapter-1$/);
  await expect(page.getByText("Untitled Repertoire").first()).toBeVisible();
  await expect(page.getByText("Chapter 1").first()).toBeVisible();
  await expect(page.getByText("Chapter 2")).toHaveCount(0);
  await page.waitForFunction(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const openRequest = indexedDB.open("en-passant");
      openRequest.onerror = () => reject(openRequest.error);
      openRequest.onsuccess = () => resolve(openRequest.result);
    });

    const [storedRepertoire, storedChapter, deletedChapter, deletedPgn] = await new Promise<
      [
        unknown | undefined,
        unknown | undefined,
        { deletedAt?: unknown } | undefined,
        { deletedAt?: unknown } | undefined,
      ]
    >((resolve, reject) => {
      const transaction = db.transaction(["repertoires", "chapters", "pgns"], "readonly");
      const repertoireRequest = transaction.objectStore("repertoires").get("e2e-repertoire");
      const chapterRequest = transaction.objectStore("chapters").get("e2e-chapter");
      const deletedChapterRequest = transaction.objectStore("chapters").get("e2e-chapter-2");
      const deletedPgnRequest = transaction.objectStore("pgns").get("e2e-pgn-2");
      transaction.onerror = () => reject(transaction.error);
      transaction.oncomplete = () => {
        db.close();
        resolve([
          repertoireRequest.result,
          chapterRequest.result,
          deletedChapterRequest.result,
          deletedPgnRequest.result,
        ]);
      };
    });

    return (
      storedRepertoire !== undefined &&
      storedChapter !== undefined &&
      typeof deletedChapter?.deletedAt === "string" &&
      typeof deletedPgn?.deletedAt === "string"
    );
  });

  expect(consoleMessages).toEqual([]);
});

test("does not allow deleting the last repertoire", async ({ page }) => {
  const consoleMessages = collectUnexpectedConsole(page);

  await openRepertoire(page);

  await page.getByRole("button", { name: "Actions for Untitled Repertoire" }).click();
  await expect(page.getByText("Delete", { exact: true })).toHaveCount(0);

  await expect(page).toHaveURL(/\/app\/repertoires\/untitled-repertoire\/chapter-1$/);
  await expect(page.getByText("Untitled Repertoire").first()).toBeVisible();
  await page.waitForFunction(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const openRequest = indexedDB.open("en-passant");
      openRequest.onerror = () => reject(openRequest.error);
      openRequest.onsuccess = () => resolve(openRequest.result);
    });

    const storedRepertoire = await new Promise<unknown | undefined>((resolve, reject) => {
      const transaction = db.transaction(["repertoires"], "readonly");
      const request = transaction.objectStore("repertoires").get("e2e-repertoire");
      transaction.onerror = () => reject(transaction.error);
      transaction.oncomplete = () => {
        db.close();
        resolve(request.result);
      };
    });

    return storedRepertoire !== undefined;
  });

  expect(consoleMessages).toEqual([]);
});

test("does not allow deleting the last chapter", async ({ page }) => {
  const consoleMessages = collectUnexpectedConsole(page);

  await openRepertoire(page);

  await page.getByRole("button", { name: "Actions for Chapter 1" }).click();
  await expect(page.getByText("Delete", { exact: true })).toHaveCount(0);

  await expect(page).toHaveURL(/\/app\/repertoires\/untitled-repertoire\/chapter-1$/);
  await expect(page.getByText("Untitled Repertoire").first()).toBeVisible();
  await expect(page.getByText("Chapter 1").first()).toBeVisible();
  await page.waitForFunction(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const openRequest = indexedDB.open("en-passant");
      openRequest.onerror = () => reject(openRequest.error);
      openRequest.onsuccess = () => resolve(openRequest.result);
    });

    const [storedRepertoire, storedChapter, storedPgn] = await new Promise<
      [unknown | undefined, unknown | undefined, unknown | undefined]
    >((resolve, reject) => {
      const transaction = db.transaction(["repertoires", "chapters", "pgns"], "readonly");
      const repertoireRequest = transaction.objectStore("repertoires").get("e2e-repertoire");
      const chapterRequest = transaction.objectStore("chapters").get("e2e-chapter");
      const pgnRequest = transaction.objectStore("pgns").get("e2e-pgn");
      transaction.onerror = () => reject(transaction.error);
      transaction.oncomplete = () => {
        db.close();
        resolve([repertoireRequest.result, chapterRequest.result, pgnRequest.result]);
      };
    });

    return storedRepertoire !== undefined && storedChapter !== undefined && storedPgn !== undefined;
  });

  expect(consoleMessages).toEqual([]);
});

test("adds a move at the end of the main line", async ({ page }) => {
  const consoleMessages = collectUnexpectedConsole(page);

  await openRepertoire(page);
  await page.getByRole("button", { name: "Move to last main line move" }).click();
  await expect(page.locator('[data-square="g8"]')).toHaveAttribute("data-piece", "n");

  await dragPiece(page, "g8", "f6");

  await expect(page.locator('[data-san="Nf6"]')).toBeVisible();
  await expect(page.locator('[data-square="f6"]')).toHaveAttribute("data-piece", "n");
  expect(consoleMessages).toEqual([]);
});

test("creates a chapter from a PGN", async ({ page }) => {
  const consoleMessages = collectUnexpectedConsole(page);

  await openRepertoire(page);
  await expect(page.locator('[data-san="e4"]')).toBeVisible();

  await expect(page.getByRole("button", { name: "Load PGN" })).toHaveCount(0);

  await page.getByRole("button", { name: "Actions for Untitled Repertoire" }).click();
  await page.getByText("Create chapter from PGN").click();
  await expect(page.locator("textarea")).toBeFocused();
  await page.locator("textarea").fill("1. d4 d5 2. c4 {Queen's Gambit} e6 *");
  await page
    .locator(".motion-dialog-content")
    .getByRole("button", { name: "Create chapter", exact: true })
    .click();

  await expect(page).toHaveURL(/\/app\/repertoires\/untitled-repertoire\/chapter-2$/);
  await expect(page.locator('[data-san="d4"]')).toBeVisible();
  await expect(page.locator('[data-san="c4"]')).toBeVisible();
  await expect(page.getByText("Queen's Gambit")).toBeVisible();
  await expect(page.locator('[data-square="d2"]')).toHaveAttribute("data-piece", "P");

  await page.getByText("Queen's Gambit").dblclick();
  await page.getByLabel("Move comment").fill("Updated comment");
  await page.keyboard.press("Enter");

  await expect(page.getByText("Updated comment")).toBeVisible();
  await expect(page.getByText("Queen's Gambit")).toHaveCount(0);

  await page.getByRole("button", { name: "Next move" }).click();
  await expect(page.locator('[data-square="d4"]')).toHaveAttribute("data-piece", "P");
  expect(consoleMessages).toEqual([]);
});

test("displays NAGs in the move list", async ({ page }) => {
  await openRepertoire(page, "1. e4! $9 $40 e5 $2 2. Nf3 $19 Nc6 *");

  await expect(page.locator('[aria-label="Move e4"] [data-nag="1"]')).toHaveText("!");
  await expect(page.locator('[aria-label="Move e4"] [data-nag="1"]')).toHaveAttribute(
    "data-nag-meaning",
    "Good move",
  );
  await expect(page.locator('[aria-label="Move e4"] [data-nag="9"]')).toHaveText("??");
  await expect(page.locator('[aria-label="Move e4"] [data-nag="9"]')).toHaveAttribute(
    "data-nag-meaning",
    "Worst move",
  );
  await expect(page.locator('[aria-label="Move e4"] [data-nag="40"]')).toHaveText("→");
  await expect(page.locator('[aria-label="Move e5"] [data-nag="2"]')).toHaveText("?");
  await expect(page.locator('[aria-label="Move Nf3"] [data-nag="19"]')).toHaveText("-+");
  await expect(page.locator('[aria-label="Move Nf3"] [data-nag="19"]')).toHaveAttribute(
    "data-nag-meaning",
    "Black is winning",
  );

  await page.locator('[aria-label="Move e4"]').click();
  await expect(page.locator('[data-annotation="nag"][data-annotation-square="e4"]')).toHaveCount(2);
  await expect(
    page.locator('[data-annotation="nag"][data-annotation-square="e4"]').nth(0),
  ).toHaveText("!");
  await expect(
    page.locator('[data-annotation="nag"][data-annotation-square="e4"]').nth(1),
  ).toHaveText("??");
  await expect(
    page.locator('[data-annotation="nag"][data-annotation-square="e4"]').nth(1),
  ).toHaveAttribute("data-annotation-meaning", "Worst move");

  await page.locator('[aria-label="Move Nf3"]').click();
  await expect(page.locator('[data-annotation="nag"][data-annotation-square="f3"]')).toHaveText(
    "-+",
  );
});

test("adds a move comment from the context menu", async ({ page }) => {
  const consoleMessages = collectUnexpectedConsole(page);

  await openRepertoire(page);

  await page.locator('[data-san="e4"]').click({ button: "right" });
  await page.getByText("Comment after").click();

  await expect(page.getByLabel("Move comment")).toBeFocused();
  await page.getByLabel("Move comment").fill("King pawn");
  await page.keyboard.press("Enter");

  await expect(page.getByText("King pawn")).toBeVisible();
  await expect(page.locator('[data-san="e4"]')).toBeVisible();
  await expect(page.locator('[data-san="e5"]')).toBeVisible();
  expect(consoleMessages).toEqual([]);
});

test("adds a move comment before from the context menu", async ({ page }) => {
  const consoleMessages = collectUnexpectedConsole(page);

  await openRepertoire(page);

  await page.locator('[data-san="e5"]').click({ button: "right" });
  await page.getByText("Comment before").click();

  await expect(page.getByLabel("Move comment")).toBeFocused();
  await page.getByLabel("Move comment").fill("Black replies");
  await page.keyboard.press("Enter");

  await expect(page.getByText("Black replies")).toBeVisible();
  await expect(page.locator('[data-san="e4"]')).toBeVisible();
  await expect(page.locator('[data-san="e5"]')).toBeVisible();
  expect(consoleMessages).toEqual([]);
});

test("deletes an existing move comment from the context menu", async ({ page }) => {
  const consoleMessages = collectUnexpectedConsole(page);

  await openRepertoire(page, "1. d4 d5 2. c4 {Queen's Gambit} e6 *");

  await page.locator('[data-san="c4"]').click({ button: "right" });
  await expect(page.getByText("Delete comment after", { exact: true })).toBeVisible();
  await expect(page.getByText("Comment after", { exact: true })).toHaveCount(0);
  await page.getByText("Delete comment after", { exact: true }).click();

  await expect(page.getByText("Queen's Gambit")).toHaveCount(0);

  await page.locator('[data-san="c4"]').click({ button: "right" });
  await expect(page.getByText("Comment after", { exact: true })).toBeVisible();
  await expect(page.getByText("Delete comment after", { exact: true })).toHaveCount(0);
  expect(consoleMessages).toEqual([]);
});

test("deletes a newly added move", async ({ page }) => {
  const consoleMessages = collectUnexpectedConsole(page);

  await openRepertoire(page);
  await page.getByRole("button", { name: "Move to last main line move" }).click();
  await dragPiece(page, "g8", "f6");
  await expect(page.locator('[data-san="Nf6"]')).toBeVisible();

  await page.locator('[data-san="Nf6"]').click({ button: "right" });
  await page.getByText("Delete move").click();

  await expect(page.locator('[data-san="Nf6"]')).toHaveCount(0);
  await expect(page.locator('[data-square="g8"]')).toHaveAttribute("data-piece", "n");
  expect(consoleMessages).toEqual([]);
});

test("adds a root variation without changing the main line", async ({ page }) => {
  const consoleMessages = collectUnexpectedConsole(page);

  await openRepertoire(page);
  await dragPiece(page, "d2", "d4");
  await expect(page.locator('[data-san="d4"]')).toBeVisible();

  await page.getByRole("button", { name: "Move to start" }).click();
  await page.getByRole("button", { name: "Next move" }).click();
  await expect(page.locator('[data-square="d4"]')).not.toHaveAttribute("data-piece", "P");
  await expect(page.locator('[data-square="e4"]')).toHaveAttribute("data-piece", "P");

  await page.getByRole("button", { name: "Move d4" }).click();
  await expect(page.locator('[data-square="d4"]')).toHaveAttribute("data-piece", "P");
  await expect(page.locator('[data-square="e2"]')).toHaveAttribute("data-piece", "P");
  expect(consoleMessages).toEqual([]);
});

test("clicking a move variation selects it in the move list", async ({ page }) => {
  const consoleMessages = collectUnexpectedConsole(page);

  await openRepertoire(page);
  await page.getByRole("button", { name: "Move e4" }).click();
  await dragPiece(page, "c7", "c5");
  await expect(page.locator('[data-san="c5"]')).toBeVisible();

  await page.getByRole("button", { name: "Move to start" }).click();
  await page.getByRole("button", { name: "Next move" }).click();
  await page.getByRole("button", { name: "Next move" }).click();
  await expect(page.locator('[data-square="e5"]')).toHaveAttribute("data-piece", "p");
  await expect(page.locator('[data-san="e5"]')).toHaveAttribute("data-selected", "true");

  await page.getByRole("button", { name: "Move c5" }).click();
  await expect(page.locator('[data-square="c5"]')).toHaveAttribute("data-piece", "p");
  await expect(page.locator('[data-square="c7"]')).not.toHaveAttribute("data-piece", "p");
  await expect(page.locator('[data-san="c5"]')).toHaveAttribute("data-selected", "true");
  await expect(page.locator('[data-san="c5"]')).toHaveClass(/text-blue-500/);
  await expect(page.locator('[data-san="e5"]')).not.toHaveAttribute("data-selected", "true");
  expect(consoleMessages).toEqual([]);
});

test("opens the context menu for a move variation", async ({ page }) => {
  const consoleMessages = collectUnexpectedConsole(page);

  await openRepertoire(page);
  await page.getByRole("button", { name: "Move e4" }).click();
  await dragPiece(page, "c7", "c5");
  await expect(page.locator('[data-san="c5"]')).toBeVisible();

  await page.locator('[data-san="c5"]').click({ button: "right" });

  await expect(page.getByText("Delete move")).toBeVisible();
  await expect(page.getByText("Promote variation")).toBeVisible();
  expect(consoleMessages).toEqual([]);
});

test("clicking a continuation inside a variation selects it in the move list", async ({ page }) => {
  const consoleMessages = collectUnexpectedConsole(page);

  await openRepertoire(page);
  await page.getByRole("button", { name: "Move e4" }).click();
  await dragPiece(page, "c7", "c5");
  await dragPiece(page, "g1", "f3");
  await expect(page.locator('[data-san="Nf3"]')).toHaveCount(2);

  await page.getByRole("button", { name: "Move to start" }).click();
  await page.getByRole("button", { name: "Move c5" }).click();
  await expect(page.locator('[data-san="c5"]')).toHaveAttribute("data-selected", "true");
  await expect(page.locator('[data-san="c5"]')).toHaveClass(/text-blue-500/);
  await page.getByRole("button", { name: "Move Nf3" }).last().click();

  await expect(page.locator('[data-square="f3"]')).toHaveAttribute("data-piece", "N");
  await expect(page.locator('[data-san="Nf3"]').last()).toHaveAttribute("data-selected", "true");
  await expect(page.locator('[data-san="Nf3"]').last()).toHaveClass(/text-blue-500/);
  await expect(page.locator('[data-san="Nf3"]').first()).not.toHaveAttribute(
    "data-selected",
    "true",
  );
  expect(consoleMessages).toEqual([]);
});

test("draws and toggles board arrows", async ({ page }) => {
  const consoleMessages = collectUnexpectedConsole(page);

  await openRepertoire(page);

  const previewSource = await squareCenter(page, "b1");
  const previewTarget = await squareCenter(page, "c3");
  await page.mouse.move(previewSource.x, previewSource.y);
  await page.mouse.down({ button: "right" });
  await page.mouse.move(previewTarget.x, previewTarget.y, { steps: 8 });
  const previewArrow = page.locator('[data-arrow="b1c3"][data-arrow-preview="true"]');
  await expect(previewArrow).toHaveAttribute("data-arrow-kind", "normal");
  await expect(previewArrow).toHaveAttribute("opacity", "0.42");
  await page.mouse.up({ button: "right" });
  await expect(previewArrow).toHaveCount(0);
  await expect(page.locator('[data-arrow="b1c3"]')).toHaveAttribute("data-arrow-kind", "normal");

  await dragBetweenSquares(page, "c3", "f6", { button: "right" });
  await expect(page.locator('[data-arrow="c3f6"]')).toHaveAttribute("data-arrow-kind", "normal");

  await page.keyboard.down("Shift");
  await dragBetweenSquares(page, "g1", "f3", { button: "right" });
  await page.keyboard.up("Shift");
  await expect(page.locator('[data-arrow="g1f3"]')).toHaveAttribute("data-arrow-kind", "shift");

  await dragBetweenSquares(page, "c3", "f6", { button: "right" });
  await expect(page.locator('[data-arrow="c3f6"]')).toHaveCount(0);
  await expect(page.locator('[data-arrow="g1f3"]')).toHaveCount(1);
  expect(consoleMessages).toEqual([]);
});

test("clears a board arrow preview when right-button release is missed", async ({ page }) => {
  const consoleMessages = collectUnexpectedConsole(page);

  await openRepertoire(page);

  const source = await squareCenter(page, "b1");
  const target = await squareCenter(page, "c3");

  await page.evaluate(
    async ({ source, target }) => {
      const sourceSquare = document.querySelector('[data-square="b1"]');
      if (sourceSquare === null) {
        throw new Error("Cannot find b1; square is not visible");
      }

      const nextFrame = () =>
        new Promise<void>((resolve) => {
          requestAnimationFrame(() => resolve());
        });

      const dispatchPointer = (point: { x: number; y: number }, buttons: number) => {
        sourceSquare.dispatchEvent(
          new PointerEvent("pointermove", {
            bubbles: true,
            cancelable: true,
            button: -1,
            buttons,
            clientX: point.x,
            clientY: point.y,
            isPrimary: true,
            pointerId: 1,
            pointerType: "mouse",
          }),
        );
      };

      sourceSquare.dispatchEvent(
        new PointerEvent("pointerdown", {
          bubbles: true,
          cancelable: true,
          button: 2,
          buttons: 2,
          clientX: source.x,
          clientY: source.y,
          isPrimary: true,
          pointerId: 1,
          pointerType: "mouse",
        }),
      );
      await nextFrame();
      dispatchPointer(target, 2);
      await nextFrame();
      dispatchPointer(target, 0);
    },
    { source, target },
  );

  await expect(page.locator('[data-arrow="b1c3"][data-arrow-preview="true"]')).toHaveCount(0);
  await expect(page.locator('[data-arrow="b1c3"]')).toHaveCount(0);
  expect(consoleMessages).toEqual([]);
});

test("adds and toggles square highlights", async ({ page }) => {
  const consoleMessages = collectUnexpectedConsole(page);

  await openRepertoire(page);

  await dragBetweenSquares(page, "e4", "e4", { button: "right", steps: 1 });
  await expect(page.locator('[data-square="highlight-square-e4"]')).toHaveAttribute(
    "data-highlight-kind",
    "normal",
  );

  await page.keyboard.down("Control");
  await dragBetweenSquares(page, "d5", "d5", { button: "right", steps: 1 });
  await page.keyboard.up("Control");
  await expect(page.locator('[data-square="highlight-square-d5"]')).toHaveAttribute(
    "data-highlight-kind",
    "ctrl",
  );

  await dragBetweenSquares(page, "e4", "e4", { button: "right", steps: 1 });
  await expect(page.locator('[data-square="highlight-square-e4"]')).toHaveCount(0);
  await expect(page.locator('[data-square="highlight-square-d5"]')).toHaveCount(1);
  expect(consoleMessages).toEqual([]);
});

test("keyboard shortcuts navigate moves and flip the board", async ({ page }) => {
  const consoleMessages = collectUnexpectedConsole(page);

  await openRepertoire(page);
  const a1BeforeFlip = await squareCenter(page, "a1");

  await page.keyboard.press("ArrowRight");
  await expect(page.locator('[data-square="e4"]')).toHaveAttribute("data-piece", "P");
  await page.keyboard.press("ArrowRight");
  await expect(page.locator('[data-square="e5"]')).toHaveAttribute("data-piece", "p");
  await page.keyboard.press("ArrowLeft");
  await expect(page.locator('[data-square="e7"]')).toHaveAttribute("data-piece", "p");
  await expect(page.locator('[data-square="e5"]')).not.toHaveAttribute("data-piece", "p");

  await page.keyboard.press("f");
  const a1AfterFlip = await squareCenter(page, "a1");
  expect(a1AfterFlip.y).toBeLessThan(a1BeforeFlip.y);
  expect(a1AfterFlip.x).toBeGreaterThan(a1BeforeFlip.x);
  expect(consoleMessages).toEqual([]);
});

test("keyboard shortcuts open move comment editors", async ({ page }) => {
  const consoleMessages = collectUnexpectedConsole(page);

  await openRepertoire(page);
  await page.keyboard.press("ArrowRight");
  await expect(page.locator('[data-san="e4"]')).toHaveAttribute("data-selected", "true");

  await page.keyboard.press("c");
  await expect(page.getByLabel("Move comment")).toBeFocused();
  await expect(page.getByLabel("Move comment")).toHaveValue("");
  await page.getByLabel("Move comment").fill("After shortcut");
  await page.keyboard.press("Enter");
  await expect(page.getByText("After shortcut")).toBeVisible();

  await page.keyboard.press("Shift+C");
  await expect(page.getByLabel("Move comment")).toBeFocused();
  await expect(page.getByLabel("Move comment")).toHaveValue("");
  await page.getByLabel("Move comment").fill("Before shortcut");
  await page.keyboard.press("Enter");
  await expect(page.getByText("Before shortcut")).toBeVisible();

  expect(consoleMessages).toEqual([]);
});

test("keyboard shortcuts set a NAG on the selected move", async ({ page }) => {
  const consoleMessages = collectUnexpectedConsole(page);

  await openRepertoire(page);
  await page.keyboard.press("ArrowRight");
  await expect(page.locator('[data-san="e4"]')).toHaveAttribute("data-selected", "true");

  await page.keyboard.press("1");
  await expect(page.locator('[aria-label="Move e4"] [data-nag="1"]')).toHaveText("!");
  await expect(page.locator('[data-annotation="nag"][data-annotation-square="e4"]')).toHaveText(
    "!",
  );

  await page.keyboard.press("9");
  await expect(page.locator('[aria-label="Move e4"] [data-nag="9"]')).toHaveText("??");
  await expect(page.locator('[aria-label="Move e4"] [data-nag="1"]')).toHaveText("!");
  await expect(page.locator('[data-annotation="nag"][data-annotation-square="e4"]')).toHaveCount(2);

  await page.keyboard.press("9");
  await expect(page.locator('[aria-label="Move e4"] [data-nag="9"]')).toHaveCount(0);
  await expect(page.locator('[data-annotation="nag"][data-annotation-square="e4"]')).toHaveText(
    "!",
  );

  await page.keyboard.press("9");
  await expect(page.locator('[aria-label="Move e4"] [data-nag="9"]')).toHaveText("??");

  await page.keyboard.press("2");
  await expect(page.locator('[aria-label="Move e4"] [data-nag="1"]')).toHaveCount(0);
  await expect(page.locator('[aria-label="Move e4"] [data-nag="2"]')).toHaveText("?");
  await expect(page.locator('[aria-label="Move e4"] [data-nag="9"]')).toHaveText("??");

  await page.keyboard.press("c");
  await expect(page.getByLabel("Move comment")).toBeFocused();
  await page.getByLabel("Move comment").fill("Shortcut 1");
  await page.keyboard.press("Enter");
  await expect(page.getByText("Shortcut 1")).toBeVisible();
  await expect(page.locator('[aria-label="Move e4"] [data-nag="9"]')).toHaveCount(1);

  expect(consoleMessages).toEqual([]);
});

test("NAG shortcuts do not replay move sounds", async ({ page }) => {
  await recordPlayedSounds(page);
  await openRepertoire(page);

  await page.keyboard.press("ArrowRight");
  await expect(page.locator('[data-san="e4"]')).toHaveAttribute("data-selected", "true");
  await expect.poll(() => playedSounds(page)).toEqual(["/sounds/default/Move.m4a"]);

  await page.keyboard.press("1");
  await expect(page.locator('[aria-label="Move e4"] [data-nag="1"]')).toHaveText("!");
  await expect.poll(() => playedSounds(page)).toEqual(["/sounds/default/Move.m4a"]);

  await page.keyboard.press("1");
  await expect(page.locator('[aria-label="Move e4"] [data-nag="1"]')).toHaveCount(0);
  await expect.poll(() => playedSounds(page)).toEqual(["/sounds/default/Move.m4a"]);
});

test("dragging a piece does not replay the previous move animation", async ({ page }) => {
  await recordPieceAnimations(page);
  await openRepertoire(page);

  await page.getByRole("button", { name: "Next move" }).click();
  await expect(page.locator('[data-san="e4"]')).toHaveAttribute("data-selected", "true");
  await expect.poll(() => pieceAnimationCount(page)).toBe(1);

  await page.waitForTimeout(500);
  const e7 = await squareCenter(page, "e7");
  await page.mouse.move(e7.x, e7.y);
  await page.mouse.down();
  await expect.poll(() => pieceAnimationCount(page)).toBe(1);
  await page.mouse.up();
});

test("editing move metadata does not restart the active move animation", async ({ page }) => {
  await recordPieceAnimations(page);
  await openRepertoire(page);

  await page.getByRole("button", { name: "Next move" }).click();
  await expect(page.locator('[data-san="e4"]')).toHaveAttribute("data-selected", "true");
  await expect.poll(() => pieceAnimationCount(page)).toBe(1);

  await page.keyboard.press("1");
  await expect(page.locator('[aria-label="Move e4"] [data-nag="1"]')).toHaveText("!");
  await expect.poll(() => pieceAnimationCount(page)).toBe(1);
});

test("keyboard move shortcuts animate pieces", async ({ page }) => {
  await recordPieceAnimations(page);
  await openRepertoire(page);

  await page.keyboard.press("ArrowRight");
  await expect(page.locator('[data-san="e4"]')).toHaveAttribute("data-selected", "true");
  await expect.poll(() => pieceAnimationCount(page)).toBe(1);

  await page.keyboard.press("ArrowRight");
  await expect(page.locator('[data-san="e5"]')).toHaveAttribute("data-selected", "true");
  await expect.poll(() => pieceAnimationCount(page)).toBe(2);
  await expect(page.locator("[data-moving-piece]")).toHaveCount(1);

  await page.waitForTimeout(300);
  await expect(page.locator("[data-moving-piece]")).toHaveCount(0);
  await expect(page.locator('[data-square="e5"]')).toHaveAttribute("data-piece", "p");
});

test("capture animations fade the captured piece", async ({ page }) => {
  await recordPieceAnimations(page);
  await openRepertoire(page, "1. e4 d5 2. exd5 *");

  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowRight");
  await expect(page.locator("[data-moving-piece]")).toHaveCount(0);
  await resetPieceAnimations(page);

  await page.getByRole("button", { name: "Next move" }).click();
  await expect(page.locator('[data-san="exd5"]')).toHaveAttribute("data-selected", "true");
  await expect.poll(() => pieceAnimationCount(page)).toBe(1);
  await expect(page.locator("[data-captured-piece]")).toHaveCount(1);
  await expect(page.locator("[data-captured-piece]")).toHaveAttribute(
    "data-captured-piece-square",
    "d5",
  );

  await page.waitForTimeout(500);
  await expect(page.locator("[data-captured-piece]")).toHaveCount(0);
  await expect(page.locator('[data-square="d5"]')).toHaveAttribute("data-piece", "P");
});

test("en passant fades the piece on the captured square", async ({ page }) => {
  await recordPieceAnimations(page);
  await openRepertoire(page, "1. e4 a6 2. e5 d5 3. exd6 *");

  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowRight");
  await expect(page.locator("[data-moving-piece]")).toHaveCount(0);
  await resetPieceAnimations(page);

  await page.getByRole("button", { name: "Next move" }).click();
  await expect(page.locator('[data-san="exd6"]')).toHaveAttribute("data-selected", "true");
  await expect.poll(() => pieceAnimationCount(page)).toBe(1);
  await expect(page.locator("[data-captured-piece]")).toHaveAttribute(
    "data-captured-piece-square",
    "d5",
  );

  await page.waitForTimeout(500);
  await expect(page.locator('[data-square="d6"]')).toHaveAttribute("data-piece", "P");
  await expect(page.locator('[data-square="d5"]')).not.toHaveAttribute("data-piece");
});

test("castling animates the king and rook together", async ({ page }) => {
  await recordPieceAnimations(page);
  await openRepertoire(page, "1. Nf3 Nf6 2. g3 g6 3. Bg2 Bg7 4. O-O *");

  for (let i = 0; i < 6; i++) {
    await page.keyboard.press("ArrowRight");
  }
  await expect(page.locator("[data-moving-piece]")).toHaveCount(0);
  await resetPieceAnimations(page);

  await page.getByRole("button", { name: "Next move" }).click();
  await expect(page.locator('[data-san="O-O"]')).toHaveAttribute("data-selected", "true");
  await expect.poll(() => pieceAnimationCount(page)).toBe(2);
  await expect(page.locator("[data-moving-piece]")).toHaveCount(2);

  await page.waitForTimeout(500);
  await expect(page.locator("[data-moving-piece]")).toHaveCount(0);
  await expect(page.locator('[data-square="g1"]')).toHaveAttribute("data-piece", "K");
  await expect(page.locator('[data-square="f1"]')).toHaveAttribute("data-piece", "R");
});

test("keyboard shortcuts cycle and select variations", async ({ page }) => {
  const consoleMessages = collectUnexpectedConsole(page);

  await openRepertoire(page);
  await dragPiece(page, "d2", "d4");
  await page.getByRole("button", { name: "Move to start" }).click();

  const e4Variation = page.getByRole("button", { name: "e4", exact: true });
  const d4Variation = page.getByRole("button", { name: "d4", exact: true });

  await expect(e4Variation).toHaveAttribute("aria-current", "true");
  await expect(d4Variation).not.toHaveAttribute("aria-current", "true");

  await page.keyboard.press("ArrowDown");
  await expect(d4Variation).toHaveAttribute("aria-current", "true");
  await expect(page.locator('[data-san="d4"]')).toHaveAttribute("data-selected", "true");
  await expect(page.locator('[data-san="e4"]')).not.toHaveAttribute("data-selected", "true");

  await page.keyboard.press("ArrowUp");
  await expect(e4Variation).toHaveAttribute("aria-current", "true");
  await expect(page.locator('[data-san="e4"]')).toHaveAttribute("data-selected", "true");

  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("ArrowRight");
  await expect(page.locator('[data-square="d4"]')).toHaveAttribute("data-piece", "P");
  await expect(page.locator('[data-square="e2"]')).toHaveAttribute("data-piece", "P");
  await expect(page.locator('[data-san="d4"]')).toHaveAttribute("data-selected", "true");
  await expect(page.locator('[data-san="e4"]')).not.toHaveAttribute("data-selected", "true");
  expect(consoleMessages).toEqual([]);
});

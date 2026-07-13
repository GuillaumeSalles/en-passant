import { afterEach, beforeEach, expect, test, vi } from "vitest";
import type { Chapter, Repertoire } from "@/lib/AppState";
import { emptyState, normalizePgn } from "@/lib/AppState";
import { exportChapterPgn } from "@/lib/exportPgn";

const storageMock = vi.hoisted(() => ({
  getPgn: vi.fn<() => Promise<string | undefined>>(),
}));

vi.mock("@/storage", () => ({
  getPgn: storageMock.getPgn,
}));

const repertoire: Repertoire = {
  id: "repertoire-id",
  handle: "my-repertoire",
  name: "My Repertoire",
  orientation: "white",
};

const chapter: Chapter = {
  id: "chapter-id",
  repertoireId: repertoire.id,
  handle: "chapter-one",
  name: "Chapter One",
  pgnId: "pgn-id",
};

let createObjectUrlMock: ReturnType<typeof vi.fn<(blob: Blob) => string>>;
let revokeObjectUrlMock: ReturnType<typeof vi.fn<(url: string) => void>>;
let clickMock: ReturnType<typeof vi.fn<() => void>>;
const originalCreateObjectUrl = Object.getOwnPropertyDescriptor(URL, "createObjectURL");
const originalRevokeObjectUrl = Object.getOwnPropertyDescriptor(URL, "revokeObjectURL");

function readBlob(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error);
    reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : "");
    reader.readAsText(blob);
  });
}

beforeEach(() => {
  createObjectUrlMock = vi.fn(() => "blob:chapter-pgn");
  revokeObjectUrlMock = vi.fn();
  clickMock = vi.fn(function (this: HTMLAnchorElement) {
    expect(this.download).toBe("my-repertoire-chapter-one.pgn");
    expect(this.href).toBe("blob:chapter-pgn");
  });

  Object.defineProperty(URL, "createObjectURL", {
    configurable: true,
    value: createObjectUrlMock,
  });
  Object.defineProperty(URL, "revokeObjectURL", {
    configurable: true,
    value: revokeObjectUrlMock,
  });
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(clickMock);
});

afterEach(() => {
  vi.restoreAllMocks();
  storageMock.getPgn.mockReset();
  if (originalCreateObjectUrl === undefined) {
    Reflect.deleteProperty(URL, "createObjectURL");
  } else {
    Object.defineProperty(URL, "createObjectURL", originalCreateObjectUrl);
  }
  if (originalRevokeObjectUrl === undefined) {
    Reflect.deleteProperty(URL, "revokeObjectURL");
  } else {
    Object.defineProperty(URL, "revokeObjectURL", originalRevokeObjectUrl);
  }
});

test("exports the loaded chapter PGN when available", async () => {
  const state = {
    ...emptyState(),
    pgns: {
      [chapter.pgnId]: {
        status: "success" as const,
        data: normalizePgn("1. e4 e5 *"),
      },
    },
  };

  await exportChapterPgn({ state, repertoire, chapter });

  expect(storageMock.getPgn).not.toHaveBeenCalled();
  expect(createObjectUrlMock).toHaveBeenCalledTimes(1);
  const blob = createObjectUrlMock.mock.calls[0]?.[0];
  expect(blob).toBeInstanceOf(Blob);
  expect(blob === undefined ? "" : await readBlob(blob)).toBe("1. e4 e5 *");
  expect(clickMock).toHaveBeenCalledTimes(1);
  expect(revokeObjectUrlMock).toHaveBeenCalledWith("blob:chapter-pgn");
});

test("exports the stored chapter PGN when the chapter is not loaded", async () => {
  storageMock.getPgn.mockResolvedValue("1. d4 d5 *");

  await exportChapterPgn({ state: emptyState(), repertoire, chapter });

  expect(storageMock.getPgn).toHaveBeenCalledWith(chapter.pgnId);
  const blob = createObjectUrlMock.mock.calls[0]?.[0];
  expect(blob === undefined ? "" : await readBlob(blob)).toBe("1. d4 d5 *");
});

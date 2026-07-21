import { vi, Mocked } from "vitest";
import { type Storage } from "@/storage";
import { AppState, Context, emptyState } from "@/lib/AppState";
import { createStore } from "@/lib/createStore";
import { MutationContext, MutationRouter } from "@/lib/useMutation";

export function createStorageMock(): Mocked<Storage> {
  return {
    createChapter: vi.fn(),
    createRepertoireAndChapter: vi.fn(),
    deleteIndexedDbDatabase: vi.fn(),
    deleteChapter: vi.fn(),
    deleteRepertoire: vi.fn(),
    getAllChapters: vi.fn(),
    getAllRepertoires: vi.fn(),
    getAllTrainingLineSchedules: vi.fn(),
    getInitialRepertoiresAndChapters: vi.fn(),
    getRepertoireSyncRequest: vi.fn(),
    getPgn: vi.fn(),
    applyRepertoireSyncResponse: vi.fn(),
    savePgnMutation: vi.fn(),
    saveTrainingLineSchedule: vi.fn().mockResolvedValue(undefined),
    updateChapter: vi.fn(),
    updateRepertoire: vi.fn(),
  };
}

export function createRouterMock(): Mocked<MutationRouter> {
  return {
    push: vi.fn(),
  };
}

export function createMutationContext(
  initialState?: Partial<AppState>,
  route?: Context,
): {
  store: MutationContext["store"];
  state: MutationContext["state"];
  router: Mocked<MutationContext["router"]>;
  route: MutationContext["route"];
  storage: Mocked<MutationContext["storage"]>;
} {
  const state: AppState = {
    ...emptyState(),
    repertoires: {
      status: "success",
      data: {},
    },
    chapters: {
      status: "success",
      data: {},
    },
    ...initialState,
  };

  const store = createStore(state);
  return {
    store,
    state: store.state,
    router: createRouterMock(),
    route: route
      ? route
      : {
          type: "repertoire-builder",
          repertoireHandle: "test",
          chapterHandle: "test",
        },
    storage: createStorageMock(),
  };
}

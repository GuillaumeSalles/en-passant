import { createSignal, onSettled, type Accessor } from "solid-js";
import type { OpeningIndex } from "./AppState";

const OPENINGS_DATA_URL = "/openings-4b862275.json";

type OpeningDataRow = readonly [positionKey: string, eco: string, name: string];

export type OpeningIndexResult = { status: "loading" } | { status: "success"; data: OpeningIndex };

const EMPTY_OPENING_INDEX: OpeningIndex = new Map();
const [openingIndexResult, setOpeningIndexResult] = createSignal<OpeningIndexResult>({
  status: "loading",
});
let openingIndexPromise: Promise<OpeningIndex> | undefined;

function ensureOpeningIndex(): Promise<OpeningIndex> {
  openingIndexPromise ??= fetch(OPENINGS_DATA_URL)
    .then(async (response) => {
      if (!response.ok) throw new Error(`Opening data request failed with ${response.status}`);
      const rows = (await response.json()) as OpeningDataRow[];
      return new Map(rows.map(([key, eco, name]) => [key, { eco, name }]));
    })
    .catch(() => EMPTY_OPENING_INDEX)
    .then((data) => {
      setOpeningIndexResult({ status: "success", data });
      return data;
    });
  return openingIndexPromise;
}

export function useOpeningIndex(): Accessor<OpeningIndexResult> {
  onSettled(() => {
    void ensureOpeningIndex();
  });
  return openingIndexResult;
}

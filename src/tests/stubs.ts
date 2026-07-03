import { Repertoire, Chapter } from "@/lib/AppState";

export function repertoireStub(overrides?: Partial<Repertoire>): Repertoire {
  return {
    id: crypto.randomUUID(),
    handle: "untitled-repertoire",
    name: "",
    orientation: "white",
    ...overrides,
  };
}

export function chapterStub(overrides?: Partial<Chapter>): Chapter {
  return {
    id: crypto.randomUUID(),
    repertoireId: crypto.randomUUID(),
    handle: "chapter-1",
    name: "",
    pgnId: crypto.randomUUID(),
    ...overrides,
  };
}

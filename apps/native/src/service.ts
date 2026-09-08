import type { RepertoireSyncResponse } from "@/storage/contracts";
import type { StoredGame, GameImportState } from "@/lib/gameContracts";
import type { Api, SessionUser } from "./api";
import { NativeModel } from "./model";

export class NativeService {
  user: SessionUser | null = null;
  syncing = false;
  private sessionVersion = 0;
  games: StoredGame[] = [];
  importState: GameImportState | null = null;
  constructor(
    readonly model: NativeModel,
    readonly api: Pick<Api, "onUnauthorized" | "initialize" | "clear" | "json" | "request">,
  ) {
    api.onUnauthorized = () => this.endSession();
  }
  startAutoSync(): () => void {
    let lastVersion = -1;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const unsubscribe = this.model.subscribe(() => {
      if (this.user === null || this.syncing || this.model.dataVersion === lastVersion) return;
      lastVersion = this.model.dataVersion;
      if (timer !== undefined) clearTimeout(timer);
      if (!Object.values(this.model.syncRequest().changes).some((records) => records.length > 0))
        return;
      timer = setTimeout(() => {
        void this.sync().catch((error: unknown) => this.model.report(error));
      }, 750);
    });
    return () => {
      unsubscribe();
      if (timer !== undefined) clearTimeout(timer);
    };
  }
  async initialize(): Promise<void> {
    await this.api.initialize();
    await this.model.initialize();
    try {
      await this.refreshSession();
      await this.sync();
    } catch (error) {
      this.model.report(error);
    }
  }
  async refreshSession(): Promise<void> {
    const version = this.sessionVersion;
    const result = await this.api.json<{ user: SessionUser } | null>("/api/auth/get-session");
    if (version !== this.sessionVersion) return;
    await this.model.setOwner(result?.user.id ?? null);
    if (version !== this.sessionVersion) return;
    this.user = result?.user ?? null;
    if (this.user === null) {
      await this.api.clear();
      this.games = [];
      this.importState = null;
    }
    this.model.notify();
  }
  async sendCode(email: string): Promise<void> {
    await this.api.json("/api/auth/email-otp/send-verification-otp", { email, type: "sign-in" });
  }
  async signIn(email: string, otp: string): Promise<void> {
    this.sessionVersion++;
    await this.api.json("/api/auth/sign-in/email-otp", { email, otp });
    await this.refreshSession();
    await this.sync();
  }
  async endSession(): Promise<void> {
    this.sessionVersion++;
    this.user = null;
    this.games = [];
    this.importState = null;
    await Promise.all([this.api.clear(), this.model.setOwner(null)]);
  }
  async signOut(): Promise<void> {
    try {
      await this.api.json("/api/auth/sign-out", {});
    } finally {
      await this.endSession();
    }
  }
  async sync(): Promise<void> {
    if (this.user === null || this.syncing) return;
    this.syncing = true;
    this.model.notify();
    const generation = this.model.generation;
    try {
      let more = true;
      while (more && generation === this.model.generation && this.user !== null) {
        const request = this.model.syncRequest();
        const pgn = request.changes.pgns[0];
        const creation = pgn?.mutations.find((m) => m.type === "createPgn");
        if (pgn !== undefined && creation !== undefined) {
          await this.api.request(`/api/pgns/${encodeURIComponent(pgn.id)}`, {
            method: "PUT",
            headers: { "content-type": "application/x-chess-pgn" },
            body: creation.pgn,
          });
        }
        if (generation !== this.model.generation) return;
        const wire = {
          ...request,
          changes: {
            ...request.changes,
            pgns: request.changes.pgns.map((p) => ({
              ...p,
              mutations: p.mutations.filter((m) => m.type !== "createPgn"),
            })),
          },
        };
        const response = await this.api.json<RepertoireSyncResponse>("/api/sync", wire);
        if (generation !== this.model.generation) return;
        this.model.applySync(response, request);
        for (const remote of this.model.data.pgns.filter(
          (p) => p.deletedAt == null && p.pgn === undefined,
        )) {
          const response = await this.api.request(`/api/pgns/${encodeURIComponent(remote.id)}`);
          const pgnText = await response.text();
          if (generation !== this.model.generation) return;
          remote.pgn = pgnText;
          remote.revision = response.headers.get("x-pgn-revision") ?? remote.revision;
        }
        this.model.hydrate();
        this.model.save();
        await this.model.flush();
        const pending = this.model.syncRequest();
        more = Object.values(pending.changes).some((records) => records.length > 0);
        if (more && pgn !== undefined && response.acknowledgedPgn === null)
          throw new Error(
            "The server did not acknowledge the PGN. Your edits remain on this device; try syncing again.",
          );
      }
    } finally {
      this.syncing = false;
      this.model.notify();
    }
  }
  async loadGames(color: string, timeControl: string): Promise<void> {
    const generation = this.model.generation;
    const params = new URLSearchParams({ sort: "desc" });
    if (color !== "all") params.set("color", color);
    if (timeControl !== "all") params.set("timeControl", timeControl);
    const response = await this.api.json<{ games: StoredGame[]; total: number }>(
      `/api/games?${params}`,
    );
    if (generation !== this.model.generation) return;
    this.games = response.games;
    this.model.notify();
  }
  async importGames(handle: string): Promise<void> {
    const result = await this.api.json<{ import: GameImportState }>("/api/game-imports/lichess", {
      handle,
    });
    this.importState = result.import;
    this.model.notify();
  }
  async refreshImport(): Promise<void> {
    const result = await this.api.json<{ import: GameImportState | null }>(
      "/api/game-imports/lichess",
    );
    this.importState = result.import;
    this.model.notify();
  }
}

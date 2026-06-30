import { createSignal, Show } from "solid-js";
import { Trash } from "@/components/Icons";
import { Button } from "@/components/ui/button";
import { deleteIndexedDbDatabase } from "@/storage";

type DeleteStatus =
  | { type: "idle" }
  | { type: "pending" }
  | { type: "success"; message: string }
  | { type: "error"; message: string };

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Failed to delete IndexedDB";
}

export function Debug() {
  const [status, setStatus] = createSignal<DeleteStatus>({ type: "idle" });

  function statusMessage(): string | null {
    const currentStatus = status();
    if (currentStatus.type !== "success" && currentStatus.type !== "error") {
      return null;
    }

    return currentStatus.message;
  }

  async function onDeleteDatabase() {
    setStatus({ type: "pending" });

    try {
      await deleteIndexedDbDatabase();
      setStatus({ type: "success", message: "IndexedDB database deleted." });
    } catch (error) {
      setStatus({ type: "error", message: errorMessage(error) });
    }
  }

  return (
    <main class="flex min-h-screen items-center justify-center bg-background p-6 text-foreground">
      <div class="grid justify-items-center gap-3">
        <Button
          variant="destructive"
          onClick={onDeleteDatabase}
          disabled={status().type === "pending"}
        >
          <Trash />
          {status().type === "pending" ? "Deleting..." : "Delete IndexedDB database"}
        </Button>
        <Show when={statusMessage()}>
          <p
            class={
              status().type === "error"
                ? "text-sm text-destructive"
                : "text-sm text-muted-foreground"
            }
          >
            {statusMessage()}
          </p>
        </Show>
      </div>
    </main>
  );
}

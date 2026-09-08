import type { EngineWorker } from "@/lib/engine";

export class EngineBridge implements EngineWorker {
  private messages = new Set<(event: MessageEvent<unknown>) => void>();
  private errors = new Set<(event: ErrorEvent) => void>();
  private invalidMessages = new Set<(event: MessageEvent<unknown>) => void>();
  constructor(private send: (command: string) => void) {}
  postMessage(command: string): void {
    this.send(command);
  }
  addEventListener(type: "message", listener: (event: MessageEvent<unknown>) => void): void;
  addEventListener(type: "error", listener: (event: ErrorEvent) => void): void;
  addEventListener(type: "messageerror", listener: (event: MessageEvent<unknown>) => void): void;
  addEventListener(
    type: "message" | "error" | "messageerror",
    listener: ((event: MessageEvent<unknown>) => void) | ((event: ErrorEvent) => void),
  ): void {
    if (type === "error") this.errors.add(listener as (event: ErrorEvent) => void);
    else
      (type === "message" ? this.messages : this.invalidMessages).add(
        listener as (event: MessageEvent<unknown>) => void,
      );
  }
  removeEventListener(type: "message", listener: (event: MessageEvent<unknown>) => void): void;
  removeEventListener(type: "error", listener: (event: ErrorEvent) => void): void;
  removeEventListener(type: "messageerror", listener: (event: MessageEvent<unknown>) => void): void;
  removeEventListener(
    type: "message" | "error" | "messageerror",
    listener: ((event: MessageEvent<unknown>) => void) | ((event: ErrorEvent) => void),
  ): void {
    if (type === "error") this.errors.delete(listener as (event: ErrorEvent) => void);
    else
      (type === "message" ? this.messages : this.invalidMessages).delete(
        listener as (event: MessageEvent<unknown>) => void,
      );
  }
  receive(data: string): void {
    // The shared worker protocol only consumes data; native has no DOM MessageEvent constructor.
    const event = { data } as MessageEvent<unknown>;
    for (const listener of this.messages) listener(event);
  }
  terminate(): void {
    this.send("quit");
    this.messages.clear();
    this.errors.clear();
    this.invalidMessages.clear();
  }
}

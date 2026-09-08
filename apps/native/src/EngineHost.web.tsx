import { useEffect } from "react";
import type { EngineHostProps } from "./EngineHost";
export function EngineHost({ register, receive, fail }: EngineHostProps) {
  useEffect(() => {
    const worker = new Worker("/stockfish-18-lite-single.js");
    worker.onmessage = (event: MessageEvent<unknown>) => receive(String(event.data));
    worker.onerror = (event) => fail(event.message);
    register((command) => worker.postMessage(command));
    return () => worker.terminate();
  }, [register, receive, fail]);
  return null;
}

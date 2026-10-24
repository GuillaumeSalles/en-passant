import { createSignal } from "solid-js";

const [gamesVersion, setGamesVersion] = createSignal(0);
export { gamesVersion };

// Call only after durable game writes, so mounted game views can refresh their queries.
export function notifyGamesChanged(): void {
  setGamesVersion((version) => version + 1);
}

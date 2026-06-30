import { createSignal } from "solid-js";

const MOVE_COUNT_KEY = "en_passant_signup_nudge_move_count";
const DISMISSED_KEY = "en_passant_signup_nudge_dismissed";
const THRESHOLD = 5;

const [signupNudgeVersion, setSignupNudgeVersion] = createSignal(0);

export { signupNudgeVersion };

function notifySignupNudgeChanged(): void {
  setSignupNudgeVersion((version) => version + 1);
}

function readNumber(key: string): number {
  const value = Number(window.localStorage.getItem(key) ?? "0");
  return Number.isFinite(value) ? value : 0;
}

export function recordCachedMoveAdditions(count: number): void {
  if (count <= 0) {
    return;
  }
  window.localStorage.setItem(MOVE_COUNT_KEY, String(readNumber(MOVE_COUNT_KEY) + count));
  notifySignupNudgeChanged();
}

export function shouldShowSignupNudge(isSignedIn: boolean): boolean {
  return (
    !isSignedIn &&
    window.localStorage.getItem(DISMISSED_KEY) !== "1" &&
    readNumber(MOVE_COUNT_KEY) >= THRESHOLD
  );
}

export function dismissSignupNudge(): void {
  window.localStorage.setItem(DISMISSED_KEY, "1");
  notifySignupNudgeChanged();
}

export function resetSignupNudge(): void {
  window.localStorage.removeItem(MOVE_COUNT_KEY);
  window.localStorage.removeItem(DISMISSED_KEY);
  notifySignupNudgeChanged();
}

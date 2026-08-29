import { describe, expect, test } from "vitest";
import { authCallbackUrl } from "./authRedirect";

describe("authCallbackUrl", () => {
  test("keeps browser callbacks on their current origin", () => {
    expect(authCallbackUrl("signin", "https://enpassant.io/app/training?review=due")).toBe(
      "https://enpassant.io/app/training?review=due&auth_event=signin",
    );
  });

  test("returns desktop OAuth through the production origin", () => {
    expect(authCallbackUrl("signup", "app://enpassant/app/training?review=due")).toBe(
      "https://enpassant.io/app/training?review=due&auth_event=signup",
    );
  });
});

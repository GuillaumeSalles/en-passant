import { expect, test as base } from "@playwright/test";

const ENGINE_ENABLED_KEY = "en_passant_engine_enabled";

export const test = base.extend({
  context: async ({ context }, use) => {
    await context.addInitScript((engineEnabledKey) => {
      if (window.localStorage.getItem(engineEnabledKey) === null) {
        window.localStorage.setItem(engineEnabledKey, "false");
      }
    }, ENGINE_ENABLED_KEY);

    await use(context);
  },
});

export { expect };

import { describe, expect, test } from "bun:test";

describe("production bot startup", () => {
  test("uses Telegram webhooks instead of long polling in production", async () => {
    const source = await Bun.file(new URL("../src/index.ts", import.meta.url)).text();

    expect(source).toContain('const IS_PRODUCTION = process.env.NODE_ENV === "production"');
    expect(source).toContain("app.post(WEBHOOK_PATH, webhookCallback(bot, \"hono\"))");
    expect(source).toMatch(/if \(IS_PRODUCTION\) \{[\s\S]*?bot\.api\.setWebhook/);

    const productionBlockStart = source.indexOf("if (IS_PRODUCTION)");
    const localPollingStart = source.indexOf("void bot.start", productionBlockStart);
    const productionReturn = source.indexOf("return;", productionBlockStart);

    expect(productionBlockStart).toBeGreaterThan(-1);
    expect(productionReturn).toBeGreaterThan(productionBlockStart);
    expect(localPollingStart).toBeGreaterThan(productionReturn);
  });
});

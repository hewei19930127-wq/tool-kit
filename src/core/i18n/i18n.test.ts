import { describe, expect, it } from "vitest";
import { createTranslator, resolveLanguage } from ".";

describe("i18n", () => {
  it("resolves system language with supported fallbacks", () => {
    expect(resolveLanguage("system", ["zh-SG", "en-US"])).toBe("zh-CN");
    expect(resolveLanguage("system", ["fr-FR", "en-US"])).toBe("en");
    expect(resolveLanguage("en", ["zh-CN"])).toBe("en");
  });

  it("translates and interpolates messages", () => {
    const t = createTranslator("zh-CN");
    expect(t("app.clipboard.openIn", { tool: "JSON" })).toBe("用 JSON 打开");
  });
});

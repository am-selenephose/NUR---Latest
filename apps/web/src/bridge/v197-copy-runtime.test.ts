import { describe, expect, it } from "vitest";

import { setActiveV197Catalog, v197Copy } from "./v197I18n";

describe("construction-time V197 catalog runtime", () => {
  it("renders supported static copy from the selected bundled variant", () => {
    setActiveV197Catalog("ur", "roman");
    const roman = v197Copy("Private by default. Shared only by choice.");
    setActiveV197Catalog("ur", "script");
    const script = v197Copy("Private by default. Shared only by choice.");
    expect(roman).not.toBe("Private by default. Shared only by choice.");
    expect(script).not.toBe("Private by default. Shared only by choice.");
    expect(roman).not.toBe(script);
  });

  it("does not treat user-authored content as a translatable catalog source", () => {
    const userAuthored = "User wrote this exact line — keep it unchanged.";
    setActiveV197Catalog("de", "default");
    expect(() => v197Copy(userAuthored)).toThrow(/Uncatalogued V197 copy/);
    expect(userAuthored).toBe("User wrote this exact line — keep it unchanged.");
  });
});

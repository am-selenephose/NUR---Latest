import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const repositoryRoot = resolve(process.cwd(), "../..");
const artifactPath = resolve(
  repositoryRoot,
  "apps/web/public/v197/NUR_V197_BRAIN_EXACT_GALAXY_STARS_RADIANT_OUTER_ANATOMY_TRANSPARENT_ULTRA_SMOOTH.html",
);
const bridgePath = resolve(repositoryRoot, "apps/web/src/bridge/v197StarBrain.ts");
const polishPath = resolve(repositoryRoot, "apps/web/src/bridge/v197Polish.ts");
const galaxyPath = resolve(
  repositoryRoot,
  "apps/web/public/v197/NUR_V197_CANONICAL_CROSS_SCREEN_LAGFREE.runtime.js",
);
const galaxyCssPath = resolve(repositoryRoot, "apps/web/src/styles/v197-canonical-galaxy.css");

describe("founder-supplied exact V197 star brain", () => {
  it("ships the exact supplied artifact without rewriting its mechanics", () => {
    expect(existsSync(artifactPath)).toBe(true);
    if (!existsSync(artifactPath)) return;

    const source = readFileSync(artifactPath, "utf8");
    expect(createHash("sha256").update(source).digest("hex"))
      .toBe("60c8e2db5b3457fb079b075808e537c63441e233d72b0f3301f4bff4e9db2ce0");
    expect(source).toContain("html,body{margin:0;width:100%;height:100%;overflow:hidden;background:transparent}");
    expect(source).toContain("#welcome{position:fixed;inset:0;display:flex!important;align-items:center;justify-content:center;background:transparent}");
    expect(source).not.toContain("background:#000");
    expect(source).toContain("const NUR_RAINBOW = [");
    expect(source).toContain("[255,64,64]");
    expect(source).toContain("[255,140,48]");
    expect(source).toContain("[232,148,48]");
    expect(source).toContain("[84,214,118]");
    expect(source).toContain("[84,164,255]");
    expect(source).toContain("[96,92,255]");
    expect(source).toContain("[188,96,255]");
    expect(source).toContain("canvas.addEventListener('pointermove'");
    expect(source).toContain("canvas.addEventListener('wheel'");
    expect(source).toContain("canvas.addEventListener('click'");
    expect(source).toContain("canvas.addEventListener('dblclick'");
    expect(source).toContain("host.addEventListener('keydown'");
    expect(source).toContain("resetToOriginalPaletteShatter");
  });

  it("mounts the exact document in the preserved brain host without reviving the old engine", () => {
    const bridge = readFileSync(bridgePath, "utf8");
    const polish = readFileSync(polishPath, "utf8");

    expect(bridge).toContain("V197_EXACT_STAR_BRAIN_PATH");
    expect(bridge).toContain("NUR_V197_BRAIN_EXACT_GALAXY_STARS_RADIANT_OUTER_ANATOMY_TRANSPARENT_ULTRA_SMOOTH.html");
    expect(bridge).toContain('brainFrame.id = "nur-exact-brain-frame"');
    expect(bridge).toContain("brainFrame.src = V197_EXACT_STAR_BRAIN_PATH");
    expect(bridge).toContain('brainFrame.setAttribute("allowtransparency", "true")');
    expect(bridge).toContain('brainFrame.style.setProperty("background", "transparent", "important")');
    expect(bridge).not.toContain('element.style.setProperty("background", "transparent"');
    expect(bridge).not.toContain('innerHost.style.setProperty("width", "100%"');
    expect(bridge).not.toContain("ensureV197CelestialRuntime(document, brainHost)");
    expect(polish).toContain('from "./v197StarBrain"');
    expect(polish).toContain("ensureV197StarBrain(document)");
  });

  it("lets the exact brain coexist with the canonical full-screen galaxy", () => {
    const galaxy = readFileSync(galaxyPath, "utf8");
    const css = readFileSync(galaxyCssPath, "utf8");

    expect(galaxy).not.toContain("nurStarBrain?.dispose?.()");
    expect(css).toContain("#nur-exact-brain-frame");
    expect(css).toMatch(/#nur-exact-brain-frame\s*\{[^}]*background:\s*transparent\s*!important/s);
    expect(css).toMatch(/#nur-exact-brain-frame\s*\{[^}]*color-scheme:\s*normal\s*!important/s);
    expect(css).not.toMatch(/#nur-exact-brain-frame\s*\{[^}]*background:\s*#000\s*!important/s);
    expect(css).not.toMatch(/#nur-exact-brain-frame\s*\{[^}]*color-scheme:\s*dark\s*!important/s);
    expect(css).not.toMatch(/:is\([^)]*#front-nur-star[^)]*\)\s*\{\s*display:\s*none/s);
  });
});

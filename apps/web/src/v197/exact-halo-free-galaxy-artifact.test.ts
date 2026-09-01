import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const repositoryRoot = resolve(process.cwd(), "../..");
const artifactPath = resolve(
  repositoryRoot,
  "apps/web/public/v197/NUR_V197_HALO_FREE.html",
);
const bridgePath = resolve(repositoryRoot, "apps/web/src/bridge/v197CanonicalGalaxy.ts");

describe("founder-supplied exact V197 halo-free galaxy", () => {
  it("ships the Desktop artifact byte-for-byte", () => {
    expect(existsSync(artifactPath)).toBe(true);
    if (!existsSync(artifactPath)) return;

    const source = readFileSync(artifactPath);
    expect(createHash("sha256").update(source).digest("hex"))
      .toBe("315071e23bd82cad1b68179f7efc3728b274ac5b7ffcae5941ceb919efa7773a");
    const text = source.toString("utf8");
    expect(text).toContain("NUR V197 — Galaxy Rig Ambient 5D");
    expect(text).toContain("version:'V197-halo-free-2026.08'");
    expect(text).toContain("canvas.addEventListener('pointermove',onPointerMove");
    expect(text).toContain("canvas.addEventListener('wheel',onWheel");
    expect(text).toContain("canvas.addEventListener('click',onClick");
    expect(text).toContain("addEventListener('keydown',onKeyDown)");
  });

  it("mounts that untouched document instead of the modified cross-screen renderer", () => {
    const bridge = readFileSync(bridgePath, "utf8");
    expect(bridge).toContain('V197_EXACT_GALAXY_FRAME_ID = "nur-v197-halo-free-galaxy-frame"');
    expect(bridge).toContain('V197_EXACT_GALAXY_PATH = "/v197/NUR_V197_HALO_FREE.html"');
    expect(bridge).toContain("galaxyFrame.src = V197_EXACT_GALAXY_PATH");
    expect(bridge).toContain('document.querySelector<HTMLCanvasElement>("#space3d")?.remove()');
    expect(bridge).not.toContain("NUR_V197_CANONICAL_CROSS_SCREEN_LAGFREE.runtime.js");
  });
});

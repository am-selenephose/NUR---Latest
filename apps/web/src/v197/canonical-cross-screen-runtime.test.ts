import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const repositoryRoot = resolve(process.cwd(), "../..");
const pathFromRoot = (path: string) => resolve(repositoryRoot, path);
const read = (path: string) => readFileSync(pathFromRoot(path), "utf8");
const sha256 = (path: string) => createHash("sha256")
  .update(readFileSync(pathFromRoot(path)))
  .digest("hex");

const exactArtifact = "apps/web/public/v197/NUR_V197_CANONICAL_CROSS_SCREEN_LAGFREE.html";
const runtimeArtifact = "apps/web/public/v197/NUR_V197_CANONICAL_CROSS_SCREEN_LAGFREE.runtime.js";

describe("V197 canonical cross-screen celestial runtime", () => {
  it("ships the exact founder-provided Aug 29 artifact", () => {
    expect(existsSync(pathFromRoot(exactArtifact))).toBe(true);
    if (!existsSync(pathFromRoot(exactArtifact))) return;

    expect(sha256(exactArtifact))
      .toBe("d44d2a27e54a7aab93a7ab675a6cd4a9d8adfd8db6fb42531d74a433eccc017f");
    expect(read(exactArtifact))
      .toContain("NUR_V197_CANONICAL_CROSS_SCREEN_LAGFREE_2026-08-29");
  });

  it("adapts that renderer to the canonical space3d canvas", () => {
    expect(existsSync(pathFromRoot(runtimeArtifact))).toBe(true);
    if (!existsSync(pathFromRoot(runtimeArtifact))) return;

    const runtime = read(runtimeArtifact);
    expect(runtime).toContain("NUR_V197_CANONICAL_CROSS_SCREEN_LAGFREE_2026-08-29");
    expect(runtime).toContain("document.getElementById('space3d')");
    expect(runtime).toContain("nurGalaxy?.dispose?.()");
    expect(runtime).toContain("nurStarBrain?.dispose?.()");
    expect(runtime).toContain("canonical-cross-screen-lagfree-v1");
  });

  it("mounts the cross-screen renderer instead of the superseded brain runtime", () => {
    const polish = read("apps/web/src/bridge/v197Polish.ts");
    const css = read("apps/web/src/styles/v197-canonical-galaxy.css");
    expect(polish).toContain('from "./v197CanonicalGalaxy"');
    expect(polish).toContain("ensureV197CanonicalGalaxy(document)");
    expect(polish).not.toContain("ensureV197StarBrain(document)");
    expect(css).toContain("html.nur-canonical-cross-screen-runtime #nur-front-v61");
    expect(css).toContain("background-color: transparent !important");
  });
});

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
    expect(runtime).not.toContain("nurStarBrain?.dispose?.()");
    expect(runtime).toContain("canonical-cross-screen-lagfree-v1");
  });

  it("rests between expensive paints without reducing the canonical star field", () => {
    const runtime = read(runtimeArtifact);
    expect(runtime).toContain("const MAX_ADAPTIVE_RENDER_REST_MS = 180");
    expect(runtime).toContain("if(now < nextRenderAt) return");
    expect(runtime).toContain("adaptiveRenderRestMs = smoothRenderCost > targetFrameMs");
    expect(runtime).toContain("nextRenderAt = performance.now() + adaptiveRenderRestMs");
    expect(runtime).toContain("stars:particles.length");
    expect(runtime).toContain("ambientStars:ambientOrbiters.length+ambientFloaters.length+ambientFireballs.length");
  });

  it("exposes bounded depth-motion state without changing celestial geometry", () => {
    const runtime = read(runtimeArtifact);
    expect(runtime).toContain("zoom:rig.zoom");
    expect(runtime).toContain("targetZoom:rig.targetZoom");
    expect(runtime).toContain("minZoom:ZOOM_MIN");
    expect(runtime).toContain("maxZoom:ZOOM_MAX");
    expect(runtime).toContain("cameraDistance:frameBasis.cameraDistance");
    expect(runtime).toContain("projectionScale:frameBasis.rigScale/Math.max(.08,frameBasis.cameraDistance)");
    expect(runtime).toContain("activePointerCount:activePointers.size");
    expect(runtime).toContain("pinchActive:gesture.pinchActive");
  });

  it("accepts spatial input on the Systems celestial field without hijacking controls", () => {
    const runtime = read(runtimeArtifact);
    expect(runtime).toContain("const interactionControls = [");
    expect(runtime).toContain("const interactionPanelBlockers = [");
    expect(runtime).toContain("const galaxyInteractionSurfaces = '#page-systems .universe-map-panel'");
    expect(runtime).toContain("if(target.closest(interactionControls)!==null) return true");
    expect(runtime).toContain("if(target.closest(galaxyInteractionSurfaces)!==null) return false");
  });

  it("mounts the exact halo-free galaxy beside the exact supplied brain runtime", () => {
    const polish = read("apps/web/src/bridge/v197Polish.ts");
    const css = read("apps/web/src/styles/v197-canonical-galaxy.css");
    expect(polish).toContain('from "./v197CanonicalGalaxy"');
    expect(polish).toContain("ensureV197CanonicalGalaxy(document)");
    expect(polish).toContain('from "./v197StarBrain"');
    expect(polish).toContain("ensureV197StarBrain(document)");
    expect(css).toContain("html.nur-exact-halo-free-runtime #nur-front-v61");
    expect(css).toContain("html.nur-exact-halo-free-runtime #nur-v197-halo-free-galaxy-frame");
    expect(css).not.toContain("html.nur-canonical-cross-screen-runtime #nur-front-v61");
    expect(css).toContain("background-color: transparent !important");
  });
});

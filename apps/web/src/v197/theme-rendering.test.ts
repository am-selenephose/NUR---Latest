import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const repositoryRoot = resolve(process.cwd(), "../..");
const source = (path: string) => readFileSync(resolve(repositoryRoot, path), "utf8");

describe("V197 spectral rendering contract", () => {
  it("applies theme color through shared star uniforms without rebuilding a scene", () => {
    const runtime = source("apps/web/src/bridge/v197CelestialRuntime.ts");

    expect(runtime).toContain("uThemeColor: { value: THREE.Color }");
    expect(runtime).toContain("uThemeStrength: { value: number }");
    expect(runtime).toContain("uniform vec3 uThemeColor;");
    expect(runtime).toContain("uniform float uThemeStrength;");
    expect(runtime).toContain("setTheme: (color: string, strength: number) => void;");

    const start = runtime.indexOf("function applyCelestialTheme(");
    const end = runtime.indexOf("\n}\n", start) + 2;
    const implementation = runtime.slice(start, end);
    expect(start).toBeGreaterThan(-1);
    expect(implementation).toContain("controller.galaxyMaterial.uniforms.uThemeColor.value.set(color)");
    expect(implementation).toContain("controller.brainMaterial.uniforms.uThemeColor.value.set(color)");
    expect(implementation).toContain("controller.galaxyMaterial.uniforms.uThemeStrength.value = normalizedStrength");
    expect(implementation).not.toMatch(/new THREE\.(?:Scene|WebGLRenderer|BufferGeometry)/);
    expect(implementation).not.toContain("disposeController");
  });

  it("keeps original rendering at zero theme strength", () => {
    const runtime = source("apps/web/src/bridge/v197CelestialRuntime.ts");
    expect(runtime.match(/uThemeStrength:\s*\{ value: 0 \}/g)).toHaveLength(1);
    expect(runtime).toContain("mix(vColor, uThemeColor, uThemeStrength * .42)");
  });

  it("maps themes onto semantic light variables while preserving the black world", () => {
    const css = source("apps/web/src/styles/v197-holographic.css");
    const themeBlockStart = css.indexOf("html[data-nur-theme-accent]");
    const themedCss = css.slice(themeBlockStart);

    expect(themeBlockStart).toBeGreaterThan(-1);
    expect(themedCss).toContain("--nur-theme-accent");
    expect(themedCss).toContain("--nur-line-faint");
    expect(themedCss).toContain("--nur-pastel-film");
    expect(themedCss).toContain("color-mix(in srgb");
    expect(themedCss).not.toMatch(/--nur-(?:world|black|surface-\d):\s*var\(--nur-theme-accent\)/);
    expect(themedCss).not.toMatch(/background(?:-color)?:\s*var\(--nur-theme-accent\)/);
  });
});

import type { Locator } from "@playwright/test";

export type CanvasSignal = {
  lit: number;
  alpha: number;
  checksum: number;
};

export async function canvasSignal(canvas: Locator, sampleLimit = 28_000): Promise<CanvasSignal> {
  return canvas.evaluate((element: HTMLCanvasElement, limit) => {
    if (element.width < 2 || element.height < 2) return { lit: 0, alpha: 0, checksum: 0 };

    const context2d = element.getContext("2d");
    let pixels: Uint8Array | Uint8ClampedArray | null = context2d
      ? context2d.getImageData(0, 0, element.width, element.height).data
      : null;
    if (!pixels) {
      const gl = element.getContext("webgl2") ?? element.getContext("webgl");
      if (!gl) return { lit: 0, alpha: 0, checksum: 0 };
      pixels = new Uint8Array(element.width * element.height * 4);
      gl.readPixels(0, 0, element.width, element.height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
    }

    const stride = Math.max(4, Math.floor(pixels.length / limit / 4) * 4);
    let lit = 0;
    let alpha = 0;
    let checksum = 0;
    for (let index = 0; index < pixels.length; index += stride) {
      const red = pixels[index] ?? 0;
      const green = pixels[index + 1] ?? 0;
      const blue = pixels[index + 2] ?? 0;
      const opacity = pixels[index + 3] ?? 0;
      if (opacity > 8) alpha += 1;
      if (red + green + blue > 120 && opacity > 20) lit += 1;
      checksum = (checksum + red * 3 + green * 5 + blue * 7 + opacity * 11) % 2_147_483_647;
    }
    return { lit, alpha, checksum };
  }, sampleLimit);
}

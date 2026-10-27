import './engine.js';

export interface BlueprintResult {
  w: number;
  h: number;
  frames: Uint8ClampedArray[];
  fps: number;
  warnings: string[];
  anchor?: [number, number];
  footprint?: [number, number, number, number];
  type: string;
}
export interface BlueprintDef { [k: string]: unknown }

interface Api {
  render(def: BlueprintDef, opts?: { seed?: number; params?: Record<string, number> }): BlueprintResult;
}
export const Blueprint = (globalThis as unknown as { Blueprint: Api }).Blueprint;

/** Vẽ một khung của kết quả ra canvas riêng (dùng làm sprite). */
export function toCanvases(res: BlueprintResult): HTMLCanvasElement[] {
  return res.frames.map((f) => {
    const c = document.createElement('canvas');
    c.width = res.w; c.height = res.h;
    c.getContext('2d')!.putImageData(new ImageData(new Uint8ClampedArray(f), res.w, res.h), 0, 0);
    return c;
  });
}

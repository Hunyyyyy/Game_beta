import { World } from './world';

export type Step = readonly [number, number];
const SQ2 = Math.SQRT2;

class MinHeap {
  private items: number[] = [];
  constructor(private readonly key: Float32Array) {}
  get size() { return this.items.length; }
  push(n: number) {
    const a = this.items; a.push(n);
    let i = a.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (this.key[a[p]] <= this.key[a[i]]) break;
      [a[p], a[i]] = [a[i], a[p]]; i = p;
    }
  }
  pop(): number {
    const a = this.items, top = a[0], last = a.pop()!;
    if (a.length) {
      a[0] = last;
      let i = 0;
      for (;;) {
        const l = i * 2 + 1, r = l + 1; let m = i;
        if (l < a.length && this.key[a[l]] < this.key[a[m]]) m = l;
        if (r < a.length && this.key[a[r]] < this.key[a[m]]) m = r;
        if (m === i) break;
        [a[m], a[i]] = [a[i], a[m]]; i = m;
      }
    }
    return top;
  }
}

/**
 * A* 8 hướng, không cắt góc. Nếu không tới được đích, trả về đường tới ô gần đích nhất.
 * Trả về các ô cần đi qua (không gồm ô xuất phát); mảng rỗng nếu không có đường.
 */
export function findPath(world: World, sx: number, sy: number, gx: number, gy: number, maxNodes = 30000): Step[] {
  const N = world.size, total = N * N;
  if (!world.inBounds(sx, sy) || !world.inBounds(gx, gy)) return [];
  const g = new Float32Array(total).fill(Infinity);
  const f = new Float32Array(total);
  const parent = new Int32Array(total).fill(-1);
  const closed = new Uint8Array(total);
  const heap = new MinHeap(f);
  const h = (x: number, y: number) => {
    const dx = Math.abs(x - gx), dy = Math.abs(y - gy);
    return dx + dy + (SQ2 - 2) * Math.min(dx, dy);
  };
  const start = sy * N + sx, goal = gy * N + gx;
  g[start] = 0; f[start] = h(sx, sy); heap.push(start);
  let best = start, bestH = f[start], expanded = 0;

  while (heap.size && expanded < maxNodes) {
    const cur = heap.pop();
    if (closed[cur]) continue;
    closed[cur] = 1; expanded++;
    if (cur === goal) { best = cur; break; }
    const cx = cur % N, cy = (cur / N) | 0;
    const hh = h(cx, cy);
    if (hh < bestH) { bestH = hh; best = cur; }
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue;
        const nx = cx + dx, ny = cy + dy;
        if (world.isBlocked(nx, ny)) continue;
        if (dx && dy && (world.isBlocked(cx + dx, cy) || world.isBlocked(cx, cy + dy))) continue;
        const ni = ny * N + nx;
        if (closed[ni]) continue;
        const ng = g[cur] + (dx && dy ? SQ2 : 1);
        if (ng < g[ni]) { g[ni] = ng; f[ni] = ng + h(nx, ny); parent[ni] = cur; heap.push(ni); }
      }
    }
  }
  const out: Step[] = [];
  for (let n = best; n !== start && n !== -1; n = parent[n]) out.push([n % N, (n / N) | 0]);
  return out.reverse();
}

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
    const k = this.key[n];
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (this.key[a[p]] <= k) break;
      a[i] = a[p]; i = p;
    }
    a[i] = n;
  }
  pop(): number {
    const a = this.items, top = a[0], last = a.pop()!;
    if (a.length) {
      const k = this.key[last], len = a.length;
      let i = 0;
      for (;;) {
        const l = i * 2 + 1;
        if (l >= len) break;
        const r = l + 1, m = r < len && this.key[a[r]] < this.key[a[l]] ? r : l;
        if (this.key[a[m]] >= k) break;
        a[i] = a[m]; i = m;
      }
      a[i] = last;
    }
    return top;
  }
}

/**
 * Working memory of the search, kept between calls: on a map of nearly a million tiles, making and clearing four such arrays for every path
 * would cost more than the search itself. A tile belongs to the current search when its stamp equals the current number.
 */
const mem = { total: 0, g: new Float32Array(0), f: new Float32Array(0), parent: new Int32Array(0), seen: new Uint32Array(0), closed: new Uint32Array(0), gen: 0 };
function memory(total: number): typeof mem {
  if (mem.total !== total) { mem.total = total; mem.g = new Float32Array(total); mem.f = new Float32Array(total); mem.parent = new Int32Array(total); mem.seen = new Uint32Array(total); mem.closed = new Uint32Array(total); mem.gen = 0; }
  if (++mem.gen >= 0xfffffff0) { mem.seen.fill(0); mem.closed.fill(0); mem.gen = 1; }
  return mem;
}

/**
 * A* 8 hướng, không cắt góc. Nếu không tới được đích, trả về đường tới ô gần đích nhất.
 * Trả về các ô cần đi qua (không gồm ô xuất phát); mảng rỗng nếu không có đường.
 */
export function findPath(world: World, sx: number, sy: number, gx: number, gy: number, maxNodes = 30000, ours: boolean | 'foe' = false): Step[] {
  const N = world.size;
  const blocked = (x: number, y: number) => (ours && (ours === 'foe' ? world.foeGates : world.gates).size > 0 ? world.isBlockedFor(x, y, ours) : world.isBlocked(x, y)); // our people pass the shut gates
  if (!world.inBounds(sx, sy) || !world.inBounds(gx, gy)) return [];
  const { g, f, parent, seen, closed, gen } = memory(N * N);
  const heap = new MinHeap(f), nb = new Uint8Array(9);
  const h = (x: number, y: number) => {
    const dx = Math.abs(x - gx), dy = Math.abs(y - gy);
    return dx + dy + (SQ2 - 2) * Math.min(dx, dy);
  };
  const start = sy * N + sx, goal = gy * N + gx;
  g[start] = 0; f[start] = h(sx, sy); seen[start] = gen; parent[start] = -1; heap.push(start);
  let best = start, bestH = f[start], expanded = 0;

  while (heap.size && expanded < maxNodes) {
    const cur = heap.pop();
    if (closed[cur] === gen) continue;
    closed[cur] = gen; expanded++;
    if (cur === goal) { best = cur; break; }
    const cx = cur % N, cy = (cur / N) | 0;
    const hh = h(cx, cy);
    if (hh < bestH) { bestH = hh; best = cur; }
    // who is blocked among the eight neighbours, asked once each (the corner rule below reuses the answers)
    for (let k = 0; k < 9; k++) nb[k] = k === 4 ? 1 : blocked(cx + (k % 3) - 1, cy + ((k / 3) | 0) - 1) ? 1 : 0;
    const gc = g[cur];
    for (let k = 0; k < 9; k++) {
      if (nb[k]) continue;
      const dx = (k % 3) - 1, dy = ((k / 3) | 0) - 1;
      if (dx && dy && (nb[4 + dx] || nb[4 + dy * 3])) continue;
      const ni = (cy + dy) * N + cx + dx;
      if (closed[ni] === gen) continue;
      const ng = gc + (dx && dy ? SQ2 : 1);
      if (seen[ni] !== gen || ng < g[ni]) { seen[ni] = gen; g[ni] = ng; f[ni] = ng + h(cx + dx, cy + dy); parent[ni] = cur; heap.push(ni); }
    }
  }
  const out: Step[] = [];
  for (let n = best; n !== start && n !== -1; n = parent[n]) out.push([n % N, (n / N) | 0]);
  return out.reverse();
}

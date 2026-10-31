/** A random stream whose position can be read and put back, so a saved game goes on with the same dice. */
export interface Rng { (): number; getState(): number; setState(state: number): void }

export function mulberry32(seed: number): Rng {
  let a = seed >>> 0;
  const next = (() => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }) as Rng;
  next.getState = () => a;
  next.setState = (state) => { a = state >>> 0; };
  return next;
}

/** Full-avalanche mix of a 32-bit number (murmur3's finaliser): every bit of the input changes about half the bits of the output. */
export function mix32(n: number): number {
  let h = n | 0;
  h ^= h >>> 16; h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13; h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return h >>> 0;
}

/** Hash 2D -> [0,1), stable for (x, y, seed). The seed is mixed first, so seeds that lie side by side (1337, 1338) give maps that have nothing in common. */
export function hash2(x: number, y: number, seed: number): number {
  const h = mix32(Math.imul(x | 0, 0x27d4eb2d) ^ mix32(Math.imul(y | 0, 0x165667b1) + mix32(seed | 0)));
  return h / 4294967296;
}

/** A fresh seed for a new world, from the clock and the browser's (or Node's) random numbers. */
export function newSeed(): number {
  const c = (globalThis as { crypto?: { getRandomValues?: (a: Uint32Array) => Uint32Array } }).crypto;
  const r = c?.getRandomValues ? c.getRandomValues(new Uint32Array(1))[0] : Math.floor(Math.random() * 4294967296);
  return (mix32(r ^ Date.now()) % 2147483646) + 1;
}

const smooth = (t: number) => t * t * (3 - 2 * t);

export function valueNoise(x: number, y: number, seed: number): number {
  const ix = Math.floor(x), iy = Math.floor(y);
  const fx = smooth(x - ix), fy = smooth(y - iy);
  const a = hash2(ix, iy, seed), b = hash2(ix + 1, iy, seed);
  const c = hash2(ix, iy + 1, seed), d = hash2(ix + 1, iy + 1, seed);
  return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
}

export function fbm(x: number, y: number, seed: number, octaves = 3): number {
  let sum = 0, amp = 1, norm = 0, f = 1;
  for (let o = 0; o < octaves; o++) {
    sum += valueNoise(x * f, y * f, seed + o * 101) * amp;
    norm += amp; amp *= 0.5; f *= 2;
  }
  return sum / norm;
}

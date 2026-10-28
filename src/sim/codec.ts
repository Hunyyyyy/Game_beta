/**
 * Turns the simulation's objects into plain JSON and back. JSON has no Map, Set, Infinity or NaN, and a long run of identical numbers
 * (terrain, fog) should not cost one entry per tile, so those get a small tagged form here.
 * Nothing in this file knows about the game.
 */

type Json = null | boolean | number | string | Json[] | { [key: string]: Json };

/** A value that can go through JSON.stringify and JSON.parse unchanged. */
export function encode(value: unknown): Json {
  if (value === undefined || value === null) return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : { $: 'num', v: String(value) };
  if (typeof value === 'string' || typeof value === 'boolean') return value;
  if (Array.isArray(value)) return value.map(encode);
  if (value instanceof Map) return { $: 'map', v: [...value].map(([k, x]) => [encode(k), encode(x)]) };
  if (value instanceof Set) return { $: 'set', v: [...value].map(encode) };
  if (typeof value === 'object') {
    const out: { [key: string]: Json } = {};
    for (const [k, x] of Object.entries(value)) if (x !== undefined && typeof x !== 'function') out[k] = encode(x);
    return out;
  }
  throw new Error(`cannot save a ${typeof value}`);
}

export function decode<T = unknown>(json: unknown): T {
  if (Array.isArray(json)) return json.map(decode) as T;
  if (json && typeof json === 'object') {
    const o = json as { $?: string; v?: unknown };
    if (o.$ === 'num') return Number(o.v) as T;
    if (o.$ === 'map') return new Map((o.v as unknown[][]).map(([k, x]) => [decode(k), decode(x)])) as T;
    if (o.$ === 'set') return new Set((o.v as unknown[]).map(decode)) as T;
    const out: Record<string, unknown> = {};
    for (const [k, x] of Object.entries(json)) out[k] = decode(x);
    return out as T;
  }
  return json as T;
}

/** Run-length form of a byte array: [value, count, value, count, ...]. Terrain and fog are mostly long runs. */
export function packRuns(data: ArrayLike<number>): number[] {
  const out: number[] = [];
  for (let i = 0; i < data.length;) {
    let j = i + 1;
    while (j < data.length && data[j] === data[i]) j++;
    out.push(data[i], j - i);
    i = j;
  }
  return out;
}

/** Fill `target` from `packRuns` output; the length must match. */
export function unpackRuns(runs: readonly number[], target: Uint8Array): void {
  let at = 0;
  for (let i = 0; i < runs.length; i += 2) { target.fill(runs[i], at, at + runs[i + 1]); at += runs[i + 1]; }
  if (at !== target.length) throw new Error(`saved array has ${at} cells, expected ${target.length}`);
}

export const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

type Kid = Node | string | number | null | false | undefined;
interface Props {
  class?: string; text?: string; title?: string; style?: string; hidden?: boolean; disabled?: boolean; pressed?: boolean;
  onclick?: (e: MouseEvent) => void; [attr: string]: unknown;
}

/** Tiny element builder: h('button', { class: 'sm', onclick }, 'Text'). */
export function h<K extends keyof HTMLElementTagNameMap>(tag: K, props: Props = {}, ...kids: Kid[]): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (v === undefined || v === null || v === false) continue;
    if (k === 'class') el.className = String(v);
    else if (k === 'text') el.textContent = String(v);
    else if (k === 'hidden') el.hidden = !!v;
    else if (k === 'disabled') (el as unknown as HTMLButtonElement).disabled = !!v;
    else if (k === 'pressed') el.setAttribute('aria-pressed', String(!!v));
    else if (k === 'onclick') el.addEventListener('click', v as EventListener);
    else el.setAttribute(k, String(v));
  }
  for (const kid of kids) if (kid !== null && kid !== false && kid !== undefined) el.append(kid instanceof Node ? kid : String(kid));
  return el;
}

/** Copy an icon canvas into a fresh one (a canvas node can only live in one place). */
export function iconCanvas(src: HTMLCanvasElement): HTMLCanvasElement {
  const c = document.createElement('canvas'); c.width = src.width; c.height = src.height;
  c.getContext('2d')!.drawImage(src, 0, 0);
  return c;
}

export const costText = (c: Partial<Record<string, number>>, names: Record<string, string>) =>
  Object.keys(c).filter((k) => (c[k] ?? 0) > 0).map((k) => `${c[k]} ${names[k].toLowerCase()}`).join(' + ') || 'miễn phí';

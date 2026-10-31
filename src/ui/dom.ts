export const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

type Kid = Node | string | number | null | false | undefined;
interface Props {
  class?: string; text?: string; title?: string; style?: string; hidden?: boolean; disabled?: boolean; pressed?: boolean;
  onclick?: (e: MouseEvent) => void; onchange?: (e: Event) => void; [attr: string]: unknown;
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
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v as EventListener); // onclick, onchange…: any handler
    else el.setAttribute(k, String(v));
  }
  for (const kid of kids) if (kid !== null && kid !== false && kid !== undefined) el.append(kid instanceof Node ? kid : String(kid));
  return el;
}

/** The "?" button; one click handler (below) shows or hides the `.hintbody` that sits beside it in the same `.hint`. */
export const helpButton = () => h('button', { class: 'q', type: 'button', 'aria-label': 'Hướng dẫn', 'aria-expanded': 'false', text: '?' });

/** A heading with a "?" after it. The guidance stays hidden until the "?" is pressed; `tip` is its element, for text that changes. */
export function hint(label: string | HTMLElement, text: string): HTMLElement & { tip: HTMLElement } {
  const tip = h('p', { class: 'sub hintbody', hidden: true, text });
  const head = h('div', { class: 'hinthead' }, typeof label === 'string' ? h('h3', { text: label }) : label, helpButton());
  return Object.assign(h('div', { class: 'hint' }, head, tip), { tip });
}

if (typeof document !== 'undefined') document.addEventListener('click', (e) => {
  const q = (e.target as Element | null)?.closest?.('button.q');
  const body = q?.closest('.hint')?.querySelector(':scope > .hintbody') as HTMLElement | null;
  if (!q || !body) return;
  body.hidden = !body.hidden; q.setAttribute('aria-expanded', String(!body.hidden));
});

/** Copy an icon canvas into a fresh one (a canvas node can only live in one place). */
export function iconCanvas(src: HTMLCanvasElement): HTMLCanvasElement {
  const c = document.createElement('canvas'); c.width = src.width; c.height = src.height;
  c.getContext('2d')!.drawImage(src, 0, 0);
  return c;
}

export const costText = (c: Partial<Record<string, number>>, names: Record<string, string>) =>
  Object.keys(c).filter((k) => (c[k] ?? 0) > 0).map((k) => `${c[k]} ${names[k].toLowerCase()}`).join(' + ') || 'miễn phí';

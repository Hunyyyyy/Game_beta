/** Small drawn pictures of the resources, for the top bar and the lists of goods (16 × 16, one outline colour). */
const O = '#2b1d10';
const S = `stroke="${O}" stroke-width=".9" stroke-linejoin="round"`;

const ART: Record<string, string> = {
  food: `<path d="M8 5.5V2.5" stroke="#5e4026" stroke-width="1.2"/><path d="M8 3.6q3.2-2.4 5.2.2q-2.4 2.2-5.2-.2z" fill="#4f9a3a" ${S}/><circle cx="5.2" cy="10.2" r="3.6" fill="#d2483a" ${S}/><circle cx="11" cy="10.8" r="3.3" fill="#e0603f" ${S}/><circle cx="4.1" cy="9" r="1" fill="#ffd6c8"/><circle cx="10" cy="9.8" r=".9" fill="#ffd6c8"/>`,
  wood: `<rect x="1.8" y="8.6" width="12" height="5" rx="1.4" fill="#8a5a2c" ${S}/><rect x="3" y="3" width="12" height="5.6" rx="1.4" fill="#9a6a35" ${S}/><ellipse cx="3.6" cy="5.8" rx="1.9" ry="2.8" fill="#dcae6e" ${S}/><ellipse cx="3.6" cy="5.8" rx=".8" ry="1.4" fill="none" stroke="#9a6a35" stroke-width=".7"/><path d="M7 4.6h5M8 7h5M5 10.8h7" stroke="#6a4420" stroke-width=".7"/>`,
  stone: `<polygon points="1.8,12.6 2.8,7 6.4,3.6 11.6,4.4 14.2,9.4 12.4,13.2 5.2,13.4" fill="#9aa0a4" ${S}/><polygon points="2.8,7 6.4,3.6 8.6,6 5.6,9" fill="#c4c9cc"/><polygon points="14.2,9.4 12.4,13.2 8,13.3 10,9.8" fill="#6f777b"/>`,
  hide: `<path d="M3 2.8L6 4h4l3-1.2 1.4 4.2-2.2 2 1 4.4-3-1.2L8 14.2l-2.2-2-3 1.2 1-4.4-2.2-2z" fill="#a0552f" ${S}/><path d="M6.4 6.4q1.6 1 3.2 0M7 9.4q1 .8 2 0" stroke="#7a3a1c" stroke-width=".8" fill="none"/><circle cx="5.2" cy="5.4" r=".8" fill="#c9784a"/><circle cx="11" cy="9.6" r=".8" fill="#c9784a"/>`,
  bone: `<g transform="rotate(-38 8 8)"><rect x="3.4" y="6.6" width="9.2" height="2.8" fill="#e4dcc4" ${S}/><circle cx="3.2" cy="6.2" r="1.9" fill="#e4dcc4" ${S}/><circle cx="3.2" cy="9.8" r="1.9" fill="#e4dcc4" ${S}/><circle cx="12.8" cy="6.2" r="1.9" fill="#e4dcc4" ${S}/><circle cx="12.8" cy="9.8" r="1.9" fill="#e4dcc4" ${S}/><rect x="4.4" y="7.2" width="7.2" height="1.6" fill="#e4dcc4"/></g>`,
  fat: `<path d="M2.4 10.4C2.4 5.4 5 3.6 8 3.6s5.6 1.8 5.6 6.8c0 2.6-2.6 3.6-5.6 3.6s-5.6-1-5.6-3.6z" fill="#f0e2b0" ${S}/><ellipse cx="6" cy="7" rx="1.8" ry="1.1" fill="#fff8dc"/><path d="M5 11.6q3 1 6 0" stroke="#d2bf80" stroke-width=".8" fill="none"/>`,
  feather: `<path d="M13.6 2.2C6.4 2 2.8 6.6 3 13.2 9.4 13.4 13.8 9.6 13.6 2.2z" fill="#7aa0c8" ${S}/><path d="M3 13.2L11.4 4.6" stroke="${O}" stroke-width=".9"/><path d="M6 10.4l-2.4.4M8.4 8l-3 .2M10.6 6l-2.6.2" stroke="#4d6f96" stroke-width=".7"/>`,
  tusk: `<path d="M3.6 2.8C11.6 2.4 14.4 8.8 11.2 14 11.4 8.8 8.4 6.2 3.6 6z" fill="#fff6e0" ${S}/><path d="M5 4q5 .4 7 4" stroke="#d8c8a0" stroke-width=".8" fill="none"/>`,
  coin: `<path d="M1.8 12.4C1.4 6 4.6 2.6 8 2.6s6.6 3.4 6.2 9.8z" fill="#f0d8c4" ${S}/><path d="M8 12.2V3.2M5.2 12.2L4.4 4.6M10.8 12.2l.8-7.6M3 12.2l-.6-4M13 12.2l.6-4" stroke="#c89a82" stroke-width=".8"/><rect x="5.8" y="12.4" width="4.4" height="2" rx=".8" fill="#d8b8a0" ${S}/>`,
  torch: `<rect x="7" y="7.4" width="2.2" height="7.6" rx=".6" fill="#8a6238" ${S}/><path d="M8.1 .8C12.6 5 11.6 8.6 8.1 8.6S3.6 5 8.1.8z" fill="#f89628" ${S}/><path d="M8.1 4C10.2 6 9.8 7.8 8.1 7.8S6 6 8.1 4z" fill="#ffe27a"/>`,
  pop: `<circle cx="8" cy="4.8" r="3" fill="#e8c4a0" ${S}/><path d="M2.4 14.6C2.4 9 13.6 9 13.6 14.6z" fill="#b5532f" ${S}/>`,
};

/** A picture of a resource ('food', 'wood', 'stone', 'hide', 'bone', 'fat', 'feather', 'tusk', 'coin') or of 'torch' or 'pop'. */
export function resIcon(key: string): HTMLElement {
  const el = document.createElement('span');
  el.className = 'ico';
  el.setAttribute('aria-hidden', 'true');
  el.innerHTML = `<svg viewBox="0 0 16 16" width="100%" height="100%">${ART[key] ?? ''}</svg>`;
  return el;
}

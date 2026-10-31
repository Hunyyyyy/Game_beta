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
  stat_hp: `<path d="M8 14C2 9.6 1.4 5.4 4 3.8 5.8 2.7 7.4 3.6 8 5.2 8.6 3.6 10.2 2.7 12 3.8 14.6 5.4 14 9.6 8 14z" fill="#e0483c" ${S}/><path d="M4.6 5.2q.8-.8 1.8-.2" stroke="#ffd0c8" stroke-width=".9" fill="none"/>`,
  stat_atk: `<path d="M13.4 2.6L6 10" stroke="${O}" stroke-width="3.6" stroke-linecap="round"/><path d="M13.4 2.6L6 10" stroke="#d4dade" stroke-width="2" stroke-linecap="round"/><path d="M4.2 8.4l3.4 3.4" stroke="${O}" stroke-width="3" stroke-linecap="round"/><path d="M4.2 8.4l3.4 3.4" stroke="#b5532f" stroke-width="1.5" stroke-linecap="round"/><path d="M5.6 10.4L3 13" stroke="#8a6238" stroke-width="2" stroke-linecap="round"/>`,
  stat_defm: `<path d="M8 1.6l5.4 2v4.2c0 3.2-2.4 5.2-5.4 6.6-3-1.4-5.4-3.4-5.4-6.6V3.6z" fill="#7f9cc8" ${S}/><path d="M8 3.4v9M4.4 7.2h7.2" stroke="#dfe8f6" stroke-width="1.2"/>`,
  stat_defr: `<path d="M8 1.6l5.4 2v4.2c0 3.2-2.4 5.2-5.4 6.6-3-1.4-5.4-3.4-5.4-6.6V3.6z" fill="#c9a064" ${S}/><circle cx="8" cy="8" r="2.6" fill="none" stroke="#fff0cc" stroke-width="1"/><circle cx="8" cy="8" r=".9" fill="#fff0cc"/>`,
  stat_move: `<path d="M2.6 3.6L7 8l-4.4 4.4M7.6 3.6L12 8l-4.4 4.4" stroke="${O}" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round" fill="none"/><path d="M2.6 3.6L7 8l-4.4 4.4M7.6 3.6L12 8l-4.4 4.4" stroke="#5cc866" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" fill="none"/>`,
  stat_work: `<path d="M9.4 6.6L3.4 12.6" stroke="${O}" stroke-width="3.2" stroke-linecap="round"/><path d="M9.4 6.6L3.4 12.6" stroke="#9a6a35" stroke-width="1.6" stroke-linecap="round"/><rect x="7" y="2.6" width="7" height="4" rx="1" fill="#9aa0a4" transform="rotate(30 10.5 4.6)" ${S}/>`,
  stat_int: `<path d="M8 1.8a4.6 4.6 0 0 1 2.6 8.4c-.5.4-.6.8-.6 1.4H6c0-.6-.1-1-.6-1.4A4.6 4.6 0 0 1 8 1.8z" fill="#f3d65e" ${S}/><rect x="6" y="12" width="4" height="1.8" rx=".8" fill="#9aa0a4" ${S}/><path d="M6.6 5.4q1.4-1.2 2.8 0" stroke="#fff6c8" stroke-width=".9" fill="none"/>`,
  stat_aspd: `<circle cx="8" cy="9.2" r="5" fill="#e8ecef" ${S}/><path d="M8 9.2V5.8M8 9.2l2.3 1.5" stroke="${O}" stroke-width="1.3" stroke-linecap="round" fill="none"/><rect x="6.4" y="1.4" width="3.2" height="1.8" rx=".6" fill="#9aa0a4" ${S}/>`,
  stat_crit: `<path d="M8 1.4l1.6 4.2 4.4.4-3.4 2.8 1.1 4.3L8 10.9 4.3 13.1l1.1-4.3L2 6l4.4-.4z" fill="#f26a3c" ${S}/><circle cx="8" cy="8" r="1.6" fill="#fff0cc"/>`,
  stat_critd: `<path d="M8 1.2l1.4 3.6 3.8-.6-2.2 3.2 2.6 2.8-3.8-.2L8 14.8 6.2 10l-3.8.2L5 7.4 2.8 4.2l3.8.6z" fill="#c8322c" ${S}/><path d="M10.8 2.8L5.4 11.6" stroke="#fff0cc" stroke-width="1.2" stroke-linecap="round"/>`,
  stat_sta: `<path d="M9.4 1.4L3.6 9h3.8l-.9 5.6 5.9-8H8.6z" fill="#f2b232" ${S}/>`,
  role_foot: `<path d="M8 1.8l5 1.8v4c0 3-2.2 5-5 6.2-2.8-1.2-5-3.2-5-6.2v-4z" fill="#7f9cc8" ${S}/><path d="M12.6 1.6L7 8.4" stroke="${O}" stroke-width="3.2" stroke-linecap="round"/><path d="M12.6 1.6L7 8.4" stroke="#d4dade" stroke-width="1.7" stroke-linecap="round"/>`,
  role_cavalry: `<path d="M2.4 12.6c.4-3 1.6-5 4-5.8l1.4-2.8 1.6 1 2.4-.2.6 1.6-1.4 1.2c1.6.6 2.4 2.2 2.4 5H10l-.6-2.4-2.6.4-.4 2H2.4z" fill="#b5835a" ${S}/><circle cx="10.6" cy="4.8" r=".6" fill="${O}"/>`,
  role_archer: `<path d="M3.4 2.6c6 1.4 8.2 6.4 6.8 11" stroke="${O}" stroke-width="3" fill="none" stroke-linecap="round"/><path d="M3.4 2.6c6 1.4 8.2 6.4 6.8 11" stroke="#9a6a35" stroke-width="1.6" fill="none" stroke-linecap="round"/><path d="M3 13.4L13.4 3" stroke="#d4dade" stroke-width="1.2"/><path d="M13.4 3l-3.4.4 1.8 1.8z" fill="#d4dade"/>`,
  role_scout: `<path d="M1.6 8s2.4-4.6 6.4-4.6S14.4 8 14.4 8 12 12.6 8 12.6 1.6 8 1.6 8z" fill="#f1ead6" ${S}/><circle cx="8" cy="8" r="2.6" fill="#4a7a9c" ${S}/><circle cx="8" cy="8" r="1" fill="${O}"/>`,
  role_tame: `<ellipse cx="8" cy="10.4" rx="3.6" ry="3" fill="#b5835a" ${S}/><circle cx="3.6" cy="6.4" r="1.6" fill="#b5835a" ${S}/><circle cx="6.4" cy="3.8" r="1.6" fill="#b5835a" ${S}/><circle cx="9.8" cy="3.8" r="1.6" fill="#b5835a" ${S}/><circle cx="12.6" cy="6.4" r="1.6" fill="#b5835a" ${S}/>`,
  formation: `<circle cx="8" cy="3.4" r="1.7" fill="#c9a064" ${S}/><circle cx="4" cy="8" r="1.7" fill="#c9a064" ${S}/><circle cx="12" cy="8" r="1.7" fill="#c9a064" ${S}/><circle cx="2.4" cy="12.6" r="1.7" fill="#c9a064" ${S}/><circle cx="8" cy="12.6" r="1.7" fill="#c9a064" ${S}/><circle cx="13.6" cy="12.6" r="1.7" fill="#c9a064" ${S}/>`,
  clock: `<circle cx="8" cy="8.4" r="5.6" fill="#f1ead6" ${S}/><path d="M8 4.8v3.8l2.6 1.6" stroke="#2b1d10" stroke-width="1.2" fill="none" stroke-linecap="round"/><path d="M6 1.6h4" stroke="#2b1d10" stroke-width="1.4" stroke-linecap="round"/>`,
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

/** The picture of a stat ('hp', 'atk', 'defm', 'defr', 'move', 'work', 'int', 'sta'). */
export const statIcon = (stat: string): HTMLElement => resIcon(`stat_${stat}`);

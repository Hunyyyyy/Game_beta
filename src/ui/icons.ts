/** The small line icons of the lists (Lucide, drawn as SVG: they take the colour and the size of the text). Only the ones used are bundled. */
import { ChevronLeft, ChevronRight, createElement, Crosshair, Hammer, Heart, LogIn, LogOut, Megaphone, Minus, Moon, Plus, ShieldCheck, Sun, Swords, UserPlus, Users, SunMoon, Zap } from 'lucide';

const SET = { plus: Plus, minus: Minus, locate: Crosshair, callOut: LogOut, callBack: LogIn, sleep: Moon, day: Sun, both: SunMoon, hp: Heart, energy: Zap, callAll: Megaphone, equip: ShieldCheck, next: ChevronRight, prev: ChevronLeft, weapon: Swords, tool: Hammer, recruit: UserPlus, people: Users };
export type IconName = keyof typeof SET;

/** A fresh SVG icon: `size` is in pixels. */
export function icon(name: IconName, size = 16): SVGElement {
  const el = createElement(SET[name], { width: size, height: size, 'stroke-width': 2, class: 'ico-l' });
  return el as SVGElement;
}

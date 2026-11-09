import type { EventLevel } from "@/lib/types";
import { levelInfo } from "@/lib/levels";

/**
 * MapEventMarker artwork as SVG strings (used inside DOM markers).
 * LV.1 DJ booth · LV.2 club · LV.3 rave · LV.4 festival · LV.5 mega fest.
 */
const INK = "#080808";
const CREAM = "#F5F2EA";

const ICONS: Record<EventLevel, string> = {
  1: `<rect x="12" y="22" width="24" height="10" rx="2" fill="#FFAD5B" stroke="${INK}" stroke-width="2.5"/><ellipse cx="19" cy="21" rx="4" ry="1.6" fill="${INK}"/><ellipse cx="29" cy="21" rx="4" ry="1.6" fill="${INK}"/><circle cx="24" cy="14" r="4.5" fill="#B6F05C" stroke="${INK}" stroke-width="2"/>`,
  2: `<path d="M11 33 V20 L24 11 L37 20 V33 Z" fill="#A276E9" stroke="${INK}" stroke-width="2.5" stroke-linejoin="round"/><path d="M20 33 V26 a4 4 0 0 1 8 0 V33Z" fill="${INK}"/><circle cx="24" cy="19" r="3.5" fill="#d9d9d9" stroke="${INK}" stroke-width="1.6"/>`,
  3: `<rect x="9" y="16" width="10" height="17" rx="2" fill="#FF625C" stroke="${INK}" stroke-width="2.4"/><rect x="29" y="16" width="10" height="17" rx="2" fill="#FF625C" stroke="${INK}" stroke-width="2.4"/><circle cx="14" cy="22" r="2.6" fill="${INK}"/><circle cx="34" cy="22" r="2.6" fill="${INK}"/><path d="M24 10 L13 4 M24 10 L35 4 M24 10 L24 2" stroke="#B6F05C" stroke-width="2.2" stroke-linecap="round"/><circle cx="24" cy="12" r="3" fill="${CREAM}" stroke="${INK}" stroke-width="1.6"/>`,
  4: `<path d="M7 33 L12 15 L36 15 L41 33Z" fill="#FFAD5B" stroke="${INK}" stroke-width="2.5" stroke-linejoin="round"/><path d="M12 15 Q24 4 36 15" fill="#B6F05C" stroke="${INK}" stroke-width="2.5"/><rect x="18" y="21" width="12" height="7" rx="1.5" fill="${INK}"/><path d="M14 9 V3 L19 5 L14 7" fill="#B6F05C" stroke="${INK}" stroke-width="1.5"/>`,
  5: `<circle cx="24" cy="20" r="13" fill="#55BCEB" stroke="${INK}" stroke-width="2.6"/><ellipse cx="24" cy="21" rx="20" ry="5" fill="none" stroke="${INK}" stroke-width="3"/><ellipse cx="24" cy="21" rx="20" ry="5" fill="none" stroke="#B6F05C" stroke-width="1.4"/><circle cx="19" cy="17" r="3.4" fill="${CREAM}" stroke="${INK}" stroke-width="1.5"/><circle cx="29" cy="17" r="3.4" fill="${CREAM}" stroke="${INK}" stroke-width="1.5"/><circle cx="19.6" cy="17.4" r="1.4" fill="${INK}"/><circle cx="29.6" cy="17.4" r="1.4" fill="${INK}"/><path d="M19 25 Q24 28 29 25" stroke="${INK}" stroke-width="1.8" fill="none" stroke-linecap="round"/>`,
};

export const MARKER_SIZE: Record<EventLevel, number> = { 1: 34, 2: 38, 3: 44, 4: 50, 5: 58 };

export function markerSvg(level: EventLevel) {
  const c = levelInfo(level).color;
  return `<svg viewBox="0 0 48 56" width="100%" height="100%" aria-hidden="true">
    <path d="M24 54 L16 40 H32 Z" fill="${INK}"/>
    <path d="M24 50 L18.5 40 H29.5 Z" fill="${c}"/>
    <rect x="2" y="1" width="44" height="40" rx="14" fill="${c}" stroke="${INK}" stroke-width="3"/>
    <g transform="translate(0 0.5)">${ICONS[level]}</g>
  </svg>`;
}

"use client";

import { memo } from "react";
import { Alien } from "@/components/art/Alien";
import { DJS } from "@/lib/data";

/**
 * Space behind the neon globe: nebula, stars, two far planets, an occasional meteor, and a few FREAKTOPIA aliens
 * (the same DJ aliens as the rest of the site) floating outside the globe. Pure decoration: aria-hidden, no pointer
 * events, and nothing here is placed at a real location, so it can't be mistaken for an event.
 *
 * The globe's screen position and radius come in as CSS variables (--gx, --gy, --gr) set by the map on its wrapper,
 * so the halo and the aliens follow the globe without React re-renders.
 */

// Deterministic star field (same on server and client), drawn once as an SVG background.
function stars(n: number, seed: number, w = 1600, h = 1000) {
  let s = seed;
  const rnd = () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;
  let out = "";
  for (let i = 0; i < n; i++) {
    const x = Math.round(rnd() * w);
    const y = Math.round(rnd() * h);
    const r = (rnd() * 1.1 + 0.3).toFixed(2);
    const o = (rnd() * 0.6 + 0.25).toFixed(2);
    const c = rnd() > 0.85 ? (rnd() > 0.5 ? "#C3A1FF" : "#9FE8FF") : "#FFFFFF";
    out += `<circle cx="${x}" cy="${y}" r="${r}" fill="${c}" opacity="${o}"/>`;
  }
  return `url("data:image/svg+xml;utf8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" preserveAspectRatio="xMidYMid slice">${out}</svg>`)}")`;
}
const STARS_NEAR = stars(140, 7);
const STARS_FAR = stars(260, 99);

const INK = "#080A10";

function DjDeck() {
  return (
    <svg viewBox="0 0 120 50" className="absolute -bottom-1 left-1/2 w-[120%] -translate-x-1/2" aria-hidden>
      <path d="M8 14 H112 L104 46 H16 Z" fill="#2A2350" stroke={INK} strokeWidth="3" strokeLinejoin="round" />
      <path d="M16 26 H104" stroke="#FF79CD" strokeWidth="3" />
      <circle cx="34" cy="12" r="11" fill="#14102A" stroke={INK} strokeWidth="3" />
      <circle cx="86" cy="12" r="11" fill="#14102A" stroke={INK} strokeWidth="3" />
      <circle cx="34" cy="12" r="3" fill="#C1FF53" />
      <circle cx="86" cy="12" r="3" fill="#66DFFF" />
    </svg>
  );
}

function Ufo() {
  return (
    <svg viewBox="0 0 140 70" className="absolute bottom-0 left-1/2 w-[150%] -translate-x-1/2" aria-hidden>
      <path className="wm-ufo-beam" d="M48 50 L30 70 H110 L92 50 Z" fill="#C1FF53" opacity=".18" />
      <ellipse cx="70" cy="40" rx="64" ry="16" fill="#3B2C8C" stroke={INK} strokeWidth="3.5" />
      <ellipse cx="70" cy="36" rx="46" ry="9" fill="#5A43C9" stroke={INK} strokeWidth="2.5" />
      {[22, 46, 70, 94, 118].map((x, i) => (
        <circle key={x} cx={x} cy={44} r="4" fill={["#C1FF53", "#FF79CD", "#66DFFF", "#FFB45C", "#C3A1FF"][i]} stroke={INK} strokeWidth="2" />
      ))}
    </svg>
  );
}

function Headphones() {
  return (
    <svg viewBox="0 0 100 60" className="absolute left-1/2 top-[18%] w-[96%] -translate-x-1/2" aria-hidden>
      <path d="M12 46 C12 6 88 6 88 46" fill="none" stroke={INK} strokeWidth="9" strokeLinecap="round" />
      <path d="M12 46 C12 6 88 6 88 46" fill="none" stroke="#66DFFF" strokeWidth="4" strokeLinecap="round" />
      <rect x="2" y="36" width="18" height="22" rx="6" fill="#FF79CD" stroke={INK} strokeWidth="3" />
      <rect x="80" y="36" width="18" height="22" rx="6" fill="#FF79CD" stroke={INK} strokeWidth="3" />
    </svg>
  );
}

function MiniPlanet() {
  return (
    <svg viewBox="0 0 120 50" className="absolute -bottom-[30%] left-1/2 w-[130%] -translate-x-1/2" aria-hidden>
      <ellipse cx="60" cy="40" rx="54" ry="22" fill="#39FF70" stroke={INK} strokeWidth="3.5" />
      <ellipse cx="60" cy="34" rx="44" ry="12" fill="#7CFF9E" opacity=".55" />
      <circle cx="30" cy="40" r="5" fill="#1C8F45" />
      <circle cx="84" cy="44" r="4" fill="#1C8F45" />
    </svg>
  );
}

export const SpaceBackdrop = memo(function SpaceBackdrop({ calm, compact }: { calm: boolean; compact: boolean }) {
  const crew = [
    { key: "dj", cls: "wm-al-dj", look: DJS[0]?.look, extra: <DjDeck />, compactShow: true },
    { key: "ufo", cls: "wm-al-ufo", look: DJS[2]?.look, extra: <Ufo />, compactShow: false },
    { key: "phones", cls: "wm-al-phones", look: DJS[3]?.look, extra: <Headphones />, compactShow: false },
    { key: "dance", cls: "wm-al-dance", look: DJS[1]?.look, extra: <MiniPlanet />, compactShow: true },
  ];
  return (
    <div className={`wm-space${calm ? " wm-calm" : ""}`} aria-hidden data-testid="space-backdrop">
      <div className="wm-nebula" />
      <div className="wm-stars" style={{ backgroundImage: STARS_FAR }} />
      <div className="wm-stars wm-stars-near" style={{ backgroundImage: STARS_NEAR }} />
      {/* Far planets: purely decorative, small and dim, at the screen edges. */}
      <svg className="wm-far-planet wm-fp-ring" viewBox="0 0 120 80">
        <ellipse cx="60" cy="42" rx="56" ry="12" fill="none" stroke="#C3A1FF" strokeWidth="3" opacity=".7" />
        <circle cx="60" cy="40" r="24" fill="#5B2A9E" />
        <circle cx="52" cy="32" r="9" fill="#7A45C4" opacity=".7" />
        <path d="M4 42 A56 12 0 0 0 116 42" fill="none" stroke="#E4D3FF" strokeWidth="3" opacity=".8" />
      </svg>
      <svg className="wm-far-planet wm-fp-moon" viewBox="0 0 40 40">
        <circle cx="20" cy="20" r="16" fill="#1F6B8F" />
        <circle cx="14" cy="15" r="4" fill="#2C8AB5" />
        <circle cx="25" cy="25" r="3" fill="#2C8AB5" />
      </svg>
      {!calm && (
        <>
          <span className="wm-meteor" style={{ top: "12%", left: "62%", animationDelay: "3s" }} />
          <span className="wm-meteor" style={{ top: "30%", left: "18%", animationDelay: "11s" }} />
        </>
      )}
      <div className="wm-halo" />
      {crew
        .filter((c) => c.look && (!compact || c.compactShow))
        .map((c) => (
          <div key={c.key} className={`wm-alien ${c.cls}`}>
            <div className="wm-alien-in">
              <Alien look={c.look!} className="relative size-full" />
              {c.extra}
            </div>
          </div>
        ))}
    </div>
  );
});

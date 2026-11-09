/**
 * Illustrated venue plates for the demo DAOs (original vector drawings, clearly
 * labelled as illustrations — not photos of real venues). Real uploads replace them.
 * Each plate has a perspective-correct stage zone and ceiling line for the compositor.
 */
export type PlateKind = "warehouse" | "arch" | "basement" | "hall" | "yard" | "factory";

export const PLATE_GEOMETRY: Record<PlateKind, { stageZone: { x: number; y: number; w: number; h: number }; ceilingY: number; caption: string }> = {
  warehouse: { stageZone: { x: 0.3, y: 0.42, w: 0.4, h: 0.3 }, ceilingY: 0.16, caption: "Turbine hall, view from the floor towards the north wall" },
  arch: { stageZone: { x: 0.32, y: 0.45, w: 0.36, h: 0.28 }, ceilingY: 0.22, caption: "Railway arch, view from the bar towards the back wall" },
  basement: { stageZone: { x: 0.28, y: 0.46, w: 0.44, h: 0.26 }, ceilingY: 0.26, caption: "Basement floor B2, low ceiling with columns" },
  hall: { stageZone: { x: 0.3, y: 0.4, w: 0.4, h: 0.32 }, ceilingY: 0.14, caption: "Main hall from the balcony line" },
  yard: { stageZone: { x: 0.3, y: 0.44, w: 0.4, h: 0.28 }, ceilingY: 0.1, caption: "Open-air yard facing the water" },
  factory: { stageZone: { x: 0.3, y: 0.43, w: 0.4, h: 0.29 }, ceilingY: 0.18, caption: "Factory floor with overhead drying racks" },
};

const W = 1600;
const H = 1000;

export function plateSvg(kind: PlateKind): string {
  const vp = { x: W / 2, y: H * 0.46 }; // vanishing point
  const floorLines = Array.from({ length: 13 }, (_, i) => {
    const x = (i / 12) * W * 1.6 - W * 0.3;
    return `<line x1="${x}" y1="${H}" x2="${vp.x + (x - vp.x) * 0.28}" y2="${H * 0.72}" stroke="#2c2f36" stroke-width="2"/>`;
  }).join("");
  const floorRows = Array.from({ length: 7 }, (_, i) => {
    const y = H * 0.72 + (H * 0.28 * (i + 1) ** 1.6) / 7 ** 1.6;
    return `<line x1="0" y1="${y}" x2="${W}" y2="${y}" stroke="#2c2f36" stroke-width="1.5"/>`;
  }).join("");
  const grain = `<filter id="g"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="7"/><feColorMatrix values="0 0 0 0 0.5  0 0 0 0 0.5  0 0 0 0 0.5  0 0 0 0.07 0"/></filter>`;
  const label = `<text x="24" y="${H - 22}" font-family="Inter,Arial" font-size="22" fill="#F5F2EA" fill-opacity="0.55">ILLUSTRATED VENUE PLATE · DEMO · NOT A PHOTO</text>`;
  let body = "";
  switch (kind) {
    case "warehouse":
    case "factory": {
      const backWall = `<rect x="${W * 0.18}" y="${H * 0.16}" width="${W * 0.64}" height="${H * 0.56}" fill="#23262d"/>`;
      const windows = Array.from({ length: 6 }, (_, i) => `<rect x="${W * 0.22 + i * W * 0.1}" y="${H * 0.2}" width="${W * 0.07}" height="${H * 0.16}" fill="#3a4250" stroke="#14161a" stroke-width="6"/><line x1="${W * 0.22 + i * W * 0.1 + W * 0.035}" y1="${H * 0.2}" x2="${W * 0.22 + i * W * 0.1 + W * 0.035}" y2="${H * 0.36}" stroke="#14161a" stroke-width="4"/>`).join("");
      const sideL = `<polygon points="0,0 ${W * 0.18},${H * 0.16} ${W * 0.18},${H * 0.72} 0,${H}" fill="#1b1d22"/>`;
      const sideR = `<polygon points="${W},0 ${W * 0.82},${H * 0.16} ${W * 0.82},${H * 0.72} ${W},${H}" fill="#1b1d22"/>`;
      const ceiling = `<polygon points="0,0 ${W},0 ${W * 0.82},${H * 0.16} ${W * 0.18},${H * 0.16}" fill="#15171b"/>`;
      const trusses = Array.from({ length: 5 }, (_, i) => {
        const t = (i + 1) / 6;
        const y = H * 0.16 * (1 - t) + 4;
        const x0 = W * 0.18 * (1 - t);
        return `<line x1="${x0}" y1="${y}" x2="${W - x0}" y2="${y}" stroke="#3b3f47" stroke-width="${10 - i}"/>` + Array.from({ length: 12 }, (_, k) => `<line x1="${x0 + ((W - 2 * x0) * k) / 12}" y1="${y}" x2="${x0 + ((W - 2 * x0) * (k + 1)) / 12}" y2="${y + 18 - i * 2}" stroke="#3b3f47" stroke-width="3"/>`).join("");
      }).join("");
      const pillars = [0.12, 0.3, 0.7, 0.88].map((p) => {
        const near = p < 0.2 || p > 0.8;
        const w = near ? 46 : 26;
        const top = near ? 0 : H * 0.12;
        const bot = near ? H : H * 0.8;
        return `<rect x="${W * p - w / 2}" y="${top}" width="${w}" height="${bot - top}" fill="#2a2d33"/><rect x="${W * p - w / 2}" y="${top}" width="${w * 0.25}" height="${bot - top}" fill="#33373e"/>`;
      }).join("");
      const racks = kind === "factory" ? Array.from({ length: 8 }, (_, i) => `<line x1="${W * 0.25 + i * W * 0.07}" y1="${H * 0.1}" x2="${W * 0.25 + i * W * 0.07}" y2="${H * 0.3}" stroke="#4a4e57" stroke-width="3"/>`).join("") + `<line x1="${W * 0.23}" y1="${H * 0.3}" x2="${W * 0.77}" y2="${H * 0.3}" stroke="#4a4e57" stroke-width="5"/>` : "";
      body = ceiling + sideL + sideR + backWall + windows + trusses + racks + `<rect x="0" y="${H * 0.72}" width="${W}" height="${H * 0.28}" fill="#1e2025"/>` + floorLines + floorRows + pillars;
      break;
    }
    case "arch": {
      const arch = `<path d="M0 ${H} L0 ${H * 0.3} Q${W / 2} ${-H * 0.25} ${W} ${H * 0.3} L${W} ${H} Z" fill="#1c1a1a"/>`;
      const inner = `<path d="M${W * 0.18} ${H * 0.72} L${W * 0.18} ${H * 0.36} Q${W / 2} ${H * 0.02} ${W * 0.82} ${H * 0.36} L${W * 0.82} ${H * 0.72} Z" fill="#2d2622"/>`;
      const bricks = Array.from({ length: 14 }, (_, r) => Array.from({ length: 16 }, (_, c) => `<rect x="${W * 0.18 + c * W * 0.04 + (r % 2) * W * 0.02}" y="${H * 0.36 + r * H * 0.026}" width="${W * 0.038}" height="${H * 0.022}" fill="#3a2f29" opacity="${0.5 + ((r * 7 + c * 3) % 5) / 10}"/>`).join("")).join("");
      const ribs = Array.from({ length: 6 }, (_, i) => {
        const t = i / 6;
        return `<path d="M${W * 0.18 * t} ${H * 0.72 + H * 0.28 * t} L${W * 0.18 * t} ${H * 0.36 * (1 - t) + H * 0.3 * t} Q${W / 2} ${H * 0.02 * (1 - t) - H * 0.25 * t} ${W - W * 0.18 * t} ${H * 0.36 * (1 - t) + H * 0.3 * t}" fill="none" stroke="#3d3430" stroke-width="${8 + i * 3}"/>`;
      }).join("");
      body = arch + inner + `<g clip-path="url(#ac)">${bricks}</g>` + ribs + `<rect x="0" y="${H * 0.72}" width="${W}" height="${H * 0.28}" fill="#1f1c1b"/>` + floorLines + floorRows;
      body = `<clipPath id="ac"><path d="M${W * 0.18} ${H * 0.72} L${W * 0.18} ${H * 0.36} Q${W / 2} ${H * 0.02} ${W * 0.82} ${H * 0.36} L${W * 0.82} ${H * 0.72} Z"/></clipPath>` + body;
      break;
    }
    case "basement": {
      const ceiling = `<polygon points="0,0 ${W},0 ${W * 0.85},${H * 0.26} ${W * 0.15},${H * 0.26}" fill="#191b1f"/>`;
      const ducts = `<rect x="${W * 0.1}" y="${H * 0.08}" width="${W * 0.8}" height="${H * 0.05}" rx="20" fill="#2e3138"/><rect x="${W * 0.2}" y="${H * 0.17}" width="${W * 0.6}" height="${H * 0.03}" rx="12" fill="#2a2d33"/>`;
      const back = `<rect x="${W * 0.15}" y="${H * 0.26}" width="${W * 0.7}" height="${H * 0.46}" fill="#24272d"/>`;
      const sides = `<polygon points="0,0 ${W * 0.15},${H * 0.26} ${W * 0.15},${H * 0.72} 0,${H}" fill="#1c1e23"/><polygon points="${W},0 ${W * 0.85},${H * 0.26} ${W * 0.85},${H * 0.72} ${W},${H}" fill="#1c1e23"/>`;
      const cols = [0.2, 0.4, 0.6, 0.8].map((p) => `<rect x="${W * p - 22}" y="${H * 0.24}" width="44" height="${H * 0.56}" fill="#30333a"/>`).join("");
      const lines = Array.from({ length: 8 }, (_, i) => `<rect x="${W * 0.18 + i * W * 0.08}" y="${H * 0.3}" width="${W * 0.06}" height="${H * 0.008}" fill="#e8e2c8" opacity="0.25"/>`).join("");
      body = ceiling + ducts + sides + back + lines + `<rect x="0" y="${H * 0.72}" width="${W}" height="${H * 0.28}" fill="#1d1f23"/>` + floorLines + floorRows + cols;
      break;
    }
    case "hall": {
      const back = `<rect x="${W * 0.16}" y="${H * 0.14}" width="${W * 0.68}" height="${H * 0.58}" fill="#22252c"/>`;
      const balcony = `<rect x="0" y="${H * 0.3}" width="${W * 0.16}" height="${H * 0.04}" fill="#30343c"/><rect x="${W * 0.84}" y="${H * 0.3}" width="${W * 0.16}" height="${H * 0.04}" fill="#30343c"/>`;
      const panels = Array.from({ length: 10 }, (_, i) => `<rect x="${W * 0.18 + i * W * 0.064}" y="${H * 0.18}" width="${W * 0.058}" height="${H * 0.5}" fill="#272a31"/>`).join("");
      const sides = `<polygon points="0,0 ${W * 0.16},${H * 0.14} ${W * 0.16},${H * 0.72} 0,${H}" fill="#1a1c21"/><polygon points="${W},0 ${W * 0.84},${H * 0.14} ${W * 0.84},${H * 0.72} ${W},${H}" fill="#1a1c21"/>`;
      body = `<rect width="${W}" height="${H * 0.14}" fill="#141619"/>` + sides + back + panels + balcony + `<rect x="0" y="${H * 0.72}" width="${W}" height="${H * 0.28}" fill="#1f2126"/>` + floorLines + floorRows;
      break;
    }
    case "yard": {
      const sky = `<linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0d1424"/><stop offset="1" stop-color="#26324a"/></linearGradient><rect width="${W}" height="${H * 0.6}" fill="url(#sky)"/>`;
      const water = `<rect y="${H * 0.52}" width="${W}" height="${H * 0.08}" fill="#1b2638"/>` + Array.from({ length: 12 }, (_, i) => `<line x1="${(i * W) / 12}" y1="${H * 0.55 + (i % 3) * 8}" x2="${(i * W) / 12 + 60}" y2="${H * 0.55 + (i % 3) * 8}" stroke="#3b4a66" stroke-width="2"/>`).join("");
      const tower = `<rect x="${W * 0.86}" y="${H * 0.18}" width="40" height="${H * 0.36}" fill="#2b2f38"/><rect x="${W * 0.855}" y="${H * 0.15}" width="56" height="30" fill="#3a3f4a"/>`;
      const fence = Array.from({ length: 30 }, (_, i) => `<line x1="${(i * W) / 30}" y1="${H * 0.6}" x2="${(i * W) / 30}" y2="${H * 0.7}" stroke="#30343d" stroke-width="4"/>`).join("") + `<line x1="0" y1="${H * 0.62}" x2="${W}" y2="${H * 0.62}" stroke="#30343d" stroke-width="3"/>`;
      const ground = `<rect y="${H * 0.7}" width="${W}" height="${H * 0.3}" fill="#22211f"/>`;
      const stars = Array.from({ length: 40 }, (_, i) => `<circle cx="${(i * 397) % W}" cy="${(i * 131) % (H * 0.45)}" r="${1 + (i % 3) * 0.6}" fill="#F5F2EA" opacity="0.5"/>`).join("");
      body = sky + stars + water + tower + fence + ground + floorRows;
      break;
    }
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}"><defs>${grain}</defs><rect width="${W}" height="${H}" fill="#121316"/>${body}<rect width="${W}" height="${H}" filter="url(#g)"/><radialGradient id="vg" cx="0.5" cy="0.5" r="0.75"><stop offset="0.6" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity="0.6"/></radialGradient><rect width="${W}" height="${H}" fill="url(#vg)"/>${label}</svg>`;
}

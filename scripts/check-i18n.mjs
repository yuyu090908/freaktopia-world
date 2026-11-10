// Missing-key check: every locale must have exactly the keys of messages/en.json, with the same
// ICU placeholders. Run: node scripts/check-i18n.mjs  (exit code 1 on any problem)
import { readFileSync, readdirSync } from "node:fs";
const dir = new URL("../messages/", import.meta.url);
const flat = (o, p = "") => Object.entries(o).flatMap(([k, v]) => (typeof v === "string" ? [[p + k, v]] : flat(v, `${p}${k}.`)));
const vars = (s) => [...new Set([...s.matchAll(/\{(\w+)\s*[,}]/g)].map((m) => m[1]))].sort().join(",");
const en = new Map(flat(JSON.parse(readFileSync(new URL("en.json", dir)))));
let bad = 0;
for (const f of readdirSync(dir).filter((f) => f.endsWith(".json") && f !== "en.json")) {
  const loc = new Map(flat(JSON.parse(readFileSync(new URL(f, dir)))));
  const missing = [...en.keys()].filter((k) => !loc.has(k));
  const extra = [...loc.keys()].filter((k) => !en.has(k));
  const ph = [...en.keys()].filter((k) => loc.has(k) && vars(en.get(k)) !== vars(loc.get(k)));
  const empty = [...loc.entries()].filter(([, v]) => !v.trim()).map(([k]) => k);
  const n = missing.length + extra.length + ph.length + empty.length;
  bad += n;
  console.log(`${f.padEnd(11)} ${loc.size}/${en.size} keys${n ? ` · missing ${missing.length}, extra ${extra.length}, placeholder ${ph.length}, empty ${empty.length}` : " ✓"}`);
  for (const k of [...missing.slice(0, 5), ...extra.slice(0, 5), ...ph.slice(0, 5)]) console.log("   ", k);
}
process.exit(bad ? 1 : 0);

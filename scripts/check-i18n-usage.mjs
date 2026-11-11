// Used-key check: every literal key passed to a next-intl translator (t("key")) must exist in messages/en.json.
// Resolves `const x = useTranslations("ns")` / `await getTranslations("ns")` per file. Dynamic keys are skipped.
// Run: node scripts/check-i18n-usage.mjs  (exit code 1 on any missing key)
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
const flat = (o, p = "") => Object.entries(o).flatMap(([k, v]) => (typeof v === "string" ? [p + k] : [p + k, ...flat(v, `${p}${k}.`)]));
const en = new Set(flat(JSON.parse(readFileSync("messages/en.json", "utf8"))));
const walk = (d) => readdirSync(d).flatMap((f) => { const p = join(d, f); return statSync(p).isDirectory() ? (["node_modules", ".next", "tests"].includes(f) ? [] : walk(p)) : /\.(tsx?|mjs)$/.test(f) ? [p] : []; });
let bad = 0;
for (const file of [...walk("app"), ...walk("components"), ...walk("lib")]) {
  const src = readFileSync(file, "utf8");
  // Each call resolves to the nearest preceding declaration of the same variable (functions re-declare `t`).
  const decls = [...src.matchAll(/(?:const|let)\s+(\w+)\s*=\s*(?:await\s+)?(?:useTranslations|getTranslations)\(\s*(?:"([\w.]*)"|\{[^}]*namespace:\s*"([\w.]*)"[^}]*\})?\s*\)/g)].map((m) => ({ v: m[1], ns: m[2] ?? m[3] ?? "", at: m.index }));
  for (const v of new Set(decls.map((d) => d.v))) {
    const re = new RegExp(`\\b${v}(?:\\.rich|\\.markup|\\.raw)?\\(\\s*"([\\w.]+)"`, "g");
    for (const m of src.matchAll(re)) {
      const d = decls.filter((x) => x.v === v && x.at < m.index).pop();
      if (!d) continue;
      const key = d.ns ? `${d.ns}.${m[1]}` : m[1];
      if (!en.has(key)) { bad++; console.log(`${file}: ${key}`); }
    }
  }
}
console.log(bad ? `${bad} missing key(s)` : "all literal keys present ✓");
process.exit(bad ? 1 : 0);

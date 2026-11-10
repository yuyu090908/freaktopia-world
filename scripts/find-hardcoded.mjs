// Hardcoded-UI-string detector. Finds English text that is rendered without going through next-intl:
//   - JSX text:                 <h2>Tickets</h2>
//   - user-facing JSX attributes: aria-label="Close", placeholder="Search…", title="…", alt="…"
//   - user-facing object fields:  toast({ title: "Saved" }), { label: "Public", sub: "Everyone…" }
//   - metadata titles/descriptions in page files
// Reports per file and a coverage rate: translated call sites (t("…")) / (translated + hardcoded).
//
//   node scripts/find-hardcoded.mjs            summary (exit 0)
//   node scripts/find-hardcoded.mjs --list     every finding with file:line
//   node scripts/find-hardcoded.mjs --strict   exit 1 when anything is found (use in CI)
//   node scripts/find-hardcoded.mjs --json     machine-readable report
//
// A line can opt out with a trailing comment `// i18n-ignore` (brand names, demo content, developer-only pages).
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import ts from "typescript";

const ROOT = new URL("..", import.meta.url).pathname;
const DIRS = ["app", "components"];
const SKIP_DIR = /(^|\/)(api|node_modules|\.next)(\/|$)/;
const ATTRS = new Set(["kicker", "reason", "aria-label", "aria-description", "placeholder", "title", "alt", "label", "sub", "hint", "lead", "description", "subtitle", "heading", "caption", "emptyTitle", "emptyBody", "body", "cta", "message", "tooltip", "confirmLabel", "cancelLabel", "actionLabel", "srLabel"]);
const FIELDS = new Set(["title", "body", "label", "sub", "hint", "description", "placeholder", "message", "cta", "lead", "subtitle", "caption", "tooltip", "note", "blurb", "help", "empty", "heading", "tagline", "confirm", "cancel", "text", "name"]);
// Words that are the same in every language here (brand, units, music/tech terms kept in English on purpose).
const ALLOW = /^(FREAKTOPIA( WORLD)?|WORLD|DAO|DJ|DJs|LIVE|XP|LV\.?|BPM|NFT|NFTs|ETH|USDC|USD|JPY|EUR|MAP|OK|ID|URL|QR|GPS|AI|PRO|VIP|GA|FAQ|BETA|DEMO|vs\.?|Google|DeepL|MetaMask|Supabase|PostgreSQL|Vercel|Base|Polygon|Ethereum|Sepolia|Spotify|SoundCloud|Mixcloud|Instagram|TikTok|YouTube|X|Twitch|Techno|House|Drum & Bass|Psytrance|Hip-Hop|Amapiano|Disco|Ambient|Hardcore|Afro House|Garage|Footwork|km|m|h|min|s|ms|px|%|#\d*|@\w*|×|·|—|–|…|\/|\+|-|:|\|)$/;
const LETTERS = /[A-Za-z]{2,}|[\u3040-\u30ff\u4e00-\u9fff\uac00-\ud7af]/; // English words, or Japanese/Chinese/Korean left in code

const files = [];
const walk = (d) => {
  for (const f of readdirSync(d)) {
    const p = join(d, f);
    const rel = relative(ROOT, p);
    if (SKIP_DIR.test(rel)) continue;
    if (statSync(p).isDirectory()) walk(p);
    else if (/\.tsx$/.test(f) && !/\.test\.tsx$/.test(f)) files.push(p);
  }
};
for (const d of DIRS) walk(join(ROOT, d));

const lineIgnored = (src, pos) => {
  const lineEnd = src.indexOf("\n", pos);
  const line = src.slice(src.lastIndexOf("\n", pos) + 1, lineEnd === -1 ? undefined : lineEnd);
  return /i18n-ignore/.test(line);
};
const fileIgnored = (src) => /^\/\/ i18n-ignore-file/m.test(src);
const isText = (s) => {
  const v = s.replace(/\s+/g, " ").trim();
  if (!v || !LETTERS.test(v)) return false;
  if (ALLOW.test(v) || ALLOW.test(v.replace(/[:.!?]$/, ""))) return false;
  if (/^[a-z0-9_.\-/:#?=&]+$/.test(v) && /[0-9_.\-/:#?=&]/.test(v)) return false; // ids, paths, keys (plain lowercase words are still text) // ids, paths, keys, class-like tokens
  if (/^(\{x\}|[\s:·,.()#%×\-–—|/]|[A-Z]{1,3}\.?)*$/.test(v.replace(/\b(LV|XP|BPM|DAO|DJ|USD|TOP)\b/g, ""))) return false; // only placeholders and punctuation
  if (/^(https?:|mailto:|\/)/.test(v)) return false;
  return true;
};

const report = [];
let translated = 0;
for (const file of files) {
  const src = readFileSync(file, "utf8");
  const rel = relative(ROOT, file);
  if (fileIgnored(src)) continue;
  const sf = ts.createSourceFile(file, src, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const hits = [];
  const add = (node, text, kind) => {
    if (lineIgnored(src, node.getStart(sf))) return;
    const { line } = sf.getLineAndCharacterOfPosition(node.getStart(sf));
    hits.push({ line: line + 1, kind, text: text.replace(/\s+/g, " ").trim().slice(0, 90) });
  };
  const strOf = (n) => (ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n) ? n.text : ts.isTemplateExpression(n) ? n.head.text + n.templateSpans.map((s) => " {x} " + s.literal.text).join("") : null);
  const visit = (n) => {
    // t("key") / t.rich / getTranslations: count translated call sites
    if (ts.isCallExpression(n)) {
      const callee = n.expression.getText(sf);
      if (/^(t|t[A-Za-z]+|tc|ta|tp|tl|tr|td|te)(\.rich|\.raw|\.markup)?$/.test(callee) && n.arguments[0] && (ts.isStringLiteral(n.arguments[0]) || ts.isTemplateExpression(n.arguments[0]) || ts.isNoSubstitutionTemplateLiteral(n.arguments[0]))) translated++;
      // className helpers, console, Error, test ids… are never UI text
      if (/^(cn|clsx|btnClass|console\.\w+|new Error|Error|fetch|api|liveApi|daoApi|router\.\w+|href|localHref|URLSearchParams|encodeURIComponent|useDemo|getEvent|getDJ)$/.test(callee)) return;
    }
    if (ts.isJsxText(n)) {
      if (isText(n.text)) add(n, n.text, "jsx-text");
    } else if (ts.isJsxAttribute(n)) {
      const name = n.name.getText(sf);
      if (ATTRS.has(name) && n.initializer) {
        const init = ts.isJsxExpression(n.initializer) ? n.initializer.expression : n.initializer;
        const s = init && strOf(init);
        if (s != null && isText(s)) add(n, s, `attr:${name}`);
      }
      if (name === "className" || name === "style" || name.startsWith("data-") || name === "href" || name === "id" || name === "key") return;
    } else if (ts.isPropertyAssignment(n)) {
      const name = n.name.getText(sf).replace(/["']/g, "");
      const s = strOf(n.initializer);
      if (FIELDS.has(name) && s != null && isText(s) && /\s|^[A-Z]/.test(s)) add(n, s, `field:${name}`);
      if (FIELDS.has(name) && (ts.isConditionalExpression(n.initializer) || ts.isBinaryExpression(n.initializer))) {
        const sides = ts.isConditionalExpression(n.initializer) ? [n.initializer.whenTrue, n.initializer.whenFalse] : [n.initializer.right];
        for (const side of sides) {
          const v = strOf(side);
          if (v != null && isText(v)) add(side, v, `field-cond:${name}`);
        }
      }
    } else if ((ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n) || ts.isTemplateExpression(n)) && n.parent && ts.isArrayLiteralExpression(n.parent)) {
      // ["Theme", …] / labels={["Venue", "Theme"]} / const STEPS = ["Basics", …]: word-like strings in arrays usually end up on screen
      const s = strOf(n);
      if (s != null && isText(s) && /[a-z]/.test(s) && /^[A-Z]|\s/.test(s)) add(n, s, "array");
    } else if (ts.isJsxExpression(n) && n.expression && (ts.isStringLiteral(n.expression) || ts.isTemplateExpression(n.expression))) {
      const parent = n.parent;
      if (parent && (ts.isJsxElement(parent) || ts.isJsxFragment(parent))) {
        const s = strOf(n.expression);
        if (s != null && isText(s)) add(n, s, "jsx-expr");
      }
    } else if (ts.isConditionalExpression(n) || ts.isBinaryExpression(n)) {
      // {cond ? "Yes" : "No"} / {x || "Untitled"} rendered as children or as a user-facing attribute
      let parent = n.parent;
      while (parent && (ts.isParenthesizedExpression(parent) || ts.isConditionalExpression(parent) || ts.isBinaryExpression(parent) || ts.isTemplateSpan(parent) || ts.isTemplateExpression(parent))) parent = parent.parent;
      const rendered = parent && ts.isJsxExpression(parent) && parent.parent && (ts.isJsxElement(parent.parent) || ts.isJsxFragment(parent.parent) || (ts.isJsxAttribute(parent.parent) && ATTRS.has(parent.parent.name.getText(sf))));
      if (rendered && (ts.isConditionalExpression(n) || [ts.SyntaxKind.BarBarToken, ts.SyntaxKind.QuestionQuestionToken, ts.SyntaxKind.AmpersandAmpersandToken].includes(n.operatorToken.kind))) {
        for (const side of ts.isConditionalExpression(n) ? [n.whenTrue, n.whenFalse] : [n.right]) {
          const s = strOf(side);
          if (s != null && isText(s)) add(side, s, "jsx-cond");
        }
      }
    }
    ts.forEachChild(n, visit);
  };
  visit(sf);
  if (hits.length) report.push({ file: rel, hits });
}

const total = report.reduce((a, r) => a + r.hits.length, 0);
const coverage = translated + total ? (translated / (translated + total)) * 100 : 100;
const args = new Set(process.argv.slice(2));
if (args.has("--json")) {
  console.log(JSON.stringify({ translatedCallSites: translated, hardcoded: total, coverage: Number(coverage.toFixed(1)), files: report }, null, 2));
} else {
  report.sort((a, b) => b.hits.length - a.hits.length);
  for (const r of report) {
    console.log(`${String(r.hits.length).padStart(4)}  ${r.file}`);
    if (args.has("--list")) for (const h of r.hits) console.log(`        ${r.file}:${h.line}  [${h.kind}]  ${h.text}`);
  }
  console.log(`\nfiles scanned: ${files.length} · files with hardcoded UI text: ${report.length}`);
  console.log(`translated call sites: ${translated} · hardcoded strings: ${total} · UI translation coverage: ${coverage.toFixed(1)}%`);
}
process.exitCode = args.has("--strict") && total ? 1 : 0;

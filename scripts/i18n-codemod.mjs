// Moves hardcoded English UI text into messages/en.json and rewrites the component to use next-intl.
//   node scripts/i18n-codemod.mjs <namespace> <file.tsx> [more files…]
// Handles JSX text (with typed {placeholders}), user-facing JSX attributes, string branches of conditionals rendered
// as children/attributes, and user-facing object fields inside components (toast titles, option labels…).
// Text in module-level constants or helper functions outside components is reported, not changed: move it by hand.
// Only en.json is written: other languages must be added afterwards (scripts/check-i18n.mjs fails until they are).
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import ts from "typescript";

const ROOT = new URL("..", import.meta.url).pathname;
const [ns, ...inputs] = process.argv.slice(2);
if (!ns || !inputs.length) {
  console.error("usage: node scripts/i18n-codemod.mjs <namespace> <file.tsx>…");
  process.exit(2);
}
const ATTRS = new Set(["kicker", "reason", "aria-label", "aria-description", "placeholder", "title", "alt", "label", "sub", "hint", "lead", "description", "subtitle", "heading", "caption", "emptyTitle", "emptyBody", "body", "cta", "message", "tooltip", "confirmLabel", "cancelLabel", "actionLabel", "srLabel"]);
const FIELDS = new Set(["title", "body", "label", "sub", "hint", "description", "placeholder", "message", "cta", "lead", "subtitle", "caption", "tooltip", "note", "blurb", "help", "empty", "heading", "tagline", "confirm", "cancel", "text", "name"]);
const ALLOW = /^(FREAKTOPIA( WORLD)?|WORLD|DAO|DJ|DJs|LIVE|XP|LV\.?|BPM|NFT|NFTs|ETH|USDC|USD|JPY|EUR|MAP|OK|ID|URL|QR|GPS|AI|PRO|VIP|GA|FAQ|BETA|DEMO|vs\.?|Google|DeepL|MetaMask|Supabase|PostgreSQL|Vercel|Base|Polygon|Ethereum|Sepolia|Spotify|SoundCloud|Mixcloud|Instagram|TikTok|YouTube|X|Twitch|Techno|House|Drum & Bass|Psytrance|Hip-Hop|Amapiano|Disco|Ambient|Hardcore|Afro House|Garage|Footwork|km|m|h|min|s|ms|px)$/;
const isText = (s) => {
  const v = s.replace(/\s+/g, " ").trim();
  if (!v || !/[A-Za-z]{2,}|[\u3040-\u30ff\u4e00-\u9fff\uac00-\ud7af]/.test(v)) return false;
  if (ALLOW.test(v.replace(/[:.!?]$/, ""))) return false;
  if (/^[a-z0-9_.\-/:#?=&]+$/.test(v) && /[0-9_.\-/:#?=&]/.test(v)) return false; // ids, paths, keys (plain lowercase words are still text)
  if (/^(https?:|mailto:|\/)/.test(v)) return false;
  return true;
};
const ENT = { "&apos;": "'", "&quot;": '"', "&amp;": "&", "&nbsp;": " ", "&mdash;": "—", "&ndash;": "–", "&hellip;": "…", "&lt;": "<", "&gt;": ">", "&rarr;": "→", "&larr;": "←", "&middot;": "·", "&times;": "×", "&#39;": "'" };
const decode = (s) => s.replace(/&[a-z#0-9]+;/g, (m) => ENT[m] ?? m);
/** JSX whitespace rules: lines are trimmed, blank lines dropped, joined by one space. */
function jsxTextValue(raw) {
  const lines = raw.split(/\r?\n/);
  if (lines.length === 1) return decode(raw);
  const out = [];
  lines.forEach((l, i) => {
    let x = l;
    if (i > 0) x = x.replace(/^[ \t]+/, "");
    if (i < lines.length - 1) x = x.replace(/[ \t]+$/, "");
    if (x) out.push(x);
  });
  return decode(out.join(" "));
}
const icuEscape = (s) => s.replace(/'/g, "’").replace(/([{}])/g, "'$1'");

// ---- messages
const enPath = resolve(ROOT, "messages/en.json");
const en = JSON.parse(readFileSync(enPath, "utf8"));
en[ns] ??= {};
const bucket = en[ns];
const byText = new Map(Object.entries(bucket).filter(([, v]) => typeof v === "string").map(([k, v]) => [v, k]));
const added = [];
function keyFor(text) {
  if (byText.has(text)) return byText.get(text);
  const words = text.replace(/\{(\w+)\}/g, " $1 ").replace(/[’']/g, "").replace(/[^A-Za-z0-9 ]+/g, " ").trim().split(/\s+/).filter(Boolean).slice(0, 5);
  let base = words.map((w, i) => (i === 0 ? w.toLowerCase() : w[0].toUpperCase() + w.slice(1).toLowerCase())).join("") || "text";
  if (/^\d/.test(base)) base = "n" + base;
  base = base.slice(0, 36);
  let k = base;
  for (let i = 2; k in bucket; i++) k = `${base}${i}`;
  bucket[k] = text;
  byText.set(text, k);
  added.push([k, text]);
  return k;
}

// ---- program (for placeholder types)
const cfg = ts.getParsedCommandLineOfConfigFile(resolve(ROOT, "tsconfig.json"), {}, { ...ts.sys, onUnRecoverableConfigFileDiagnostic: () => {} });
const files = inputs.map((f) => resolve(ROOT, f));
const program = ts.createProgram({ rootNames: files, options: { ...cfg.options, noEmit: true } });
const checker = program.getTypeChecker();
const isPlain = (node) => {
  const t = checker.getTypeAtLocation(node);
  const parts = t.isUnion() ? t.types : [t];
  return parts.every((p) => p.flags & (ts.TypeFlags.StringLike | ts.TypeFlags.NumberLike));
};

const report = [];
for (const file of files) {
  const sf = program.getSourceFile(file);
  const src = sf.text;
  const edits = []; // {start, end, text}
  const wraps = new Map(); // module-level VariableDeclaration -> fields
  let needTu = false;
  const moduleConst = (n) => {
    for (let p = n.parent; p; p = p.parent) {
      if (ts.isFunctionLike(p)) return null;
      if (ts.isVariableDeclaration(p) && ts.isVariableStatement(p.parent.parent) && ts.isSourceFile(p.parent.parent.parent) && p.initializer && (ts.isArrayLiteralExpression(p.initializer) || ts.isObjectLiteralExpression(p.initializer) || ts.isAsExpression(p.initializer))) return p;
    }
    return null;
  };
  const hooks = new Map(); // component fn node -> async?
  const manual = [];
  const where = (n) => `${file.replace(ROOT, "")}:${sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1}`;

  const isComponentFn = (fn) => {
    const named = (n) => !!n && /^[A-Z]/.test(n);
    if (ts.isFunctionDeclaration(fn)) return named(fn.name?.text) || (!fn.name && fn.modifiers?.some((m) => m.kind === ts.SyntaxKind.DefaultKeyword));
    if (ts.isArrowFunction(fn) || ts.isFunctionExpression(fn)) {
      let p = fn.parent;
      if (ts.isCallExpression(p) && /^(memo|forwardRef|React\.memo|React\.forwardRef)$/.test(p.expression.getText(sf))) p = p.parent;
      if (ts.isVariableDeclaration(p)) return named(p.name.getText(sf));
      if (ts.isExportAssignment(p)) return true;
    }
    return false;
  };
  const componentOf = (node) => {
    for (let p = node.parent; p; p = p.parent) {
      if ((ts.isFunctionDeclaration(p) || ts.isArrowFunction(p) || ts.isFunctionExpression(p)) && isComponentFn(p)) return p;
    }
    return null;
  };
  const ignored = (node) => {
    const pos = node.getStart(sf);
    const end = src.indexOf("\n", pos);
    return /i18n-ignore/.test(src.slice(src.lastIndexOf("\n", pos) + 1, end === -1 ? undefined : end));
  };
  const call = (node, msg, values) => {
    if (ignored(node)) return null;
    const comp = componentOf(node);
    if (!comp) {
      manual.push(`${where(node)}  ${msg}`);
      return null;
    }
    hooks.set(comp, Boolean(comp.modifiers?.some((m) => m.kind === ts.SyntaxKind.AsyncKeyword)));
    const k = keyFor(msg);
    const vals = values.length ? `, { ${values.map(([n, e]) => (n === e ? n : `${n}: ${e}`)).join(", ")} }` : "";
    return `tu("${k}"${vals})`;
  };
  const strOf = (n) => (ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n) ? n.text : null);
  /** Template literal → ICU message + values, when every ${…} is a plain string/number. */
  const template = (n) => {
    if (!ts.isTemplateExpression(n)) return null;
    const used = new Set();
    const values = [];
    let msg = icuEscape(n.head.text);
    for (const span of n.templateSpans) {
      if (!isPlain(span.expression)) return null;
      const name = phName(span.expression, used);
      values.push([name, rewriteExpr(span.expression)]);
      msg += `{${name}}` + icuEscape(span.literal.text);
    }
    return { msg, values };
  };
  const phName = (e, used) => {
    let base = ts.isIdentifier(e) ? e.text : ts.isPropertyAccessExpression(e) ? e.name.text : ts.isCallExpression(e) ? (ts.isPropertyAccessExpression(e.expression) ? e.expression.name.text : e.expression.getText(sf)) : "value";
    base = base.replace(/[^A-Za-z0-9_]/g, "") || "value";
    let n = base;
    for (let i = 2; used.has(n); i++) n = `${base}${i}`;
    used.add(n);
    return n;
  };
  /** Source text of an expression with its user-facing string branches translated. */
  const rewriteExpr = (e) => {
    const parts = [];
    const branch = (side) => {
      const s = strOf(side);
      if (s != null && isText(s)) {
        const c = call(side, icuEscape(s), []);
        if (c) parts.push({ start: side.getStart(sf), end: side.end, text: c });
        return true;
      }
      const tpl = template(side);
      if (tpl && isText(tpl.msg.replace(/\{\w+\}/g, " "))) {
        const c = call(side, tpl.msg, tpl.values);
        if (c) parts.push({ start: side.getStart(sf), end: side.end, text: c });
        return true;
      }
      return false;
    };
    const visit = (n) => {
      if (ts.isConditionalExpression(n)) {
        for (const side of [n.whenTrue, n.whenFalse]) if (!branch(side)) visit(side);
        return;
      }
      if (ts.isParenthesizedExpression(n)) return visit(n.expression);
      if (ts.isBinaryExpression(n) && [ts.SyntaxKind.BarBarToken, ts.SyntaxKind.QuestionQuestionToken, ts.SyntaxKind.AmpersandAmpersandToken].includes(n.operatorToken.kind)) {
        if (!branch(n.right)) visit(n.right);
        return;
      }
      if (ts.isTemplateExpression(n) && ts.isJsxExpression(n.parent)) return; // handled by caller
      ts.forEachChild(n, visit);
    };
    visit(e);
    let out = src.slice(e.getStart(sf), e.end);
    for (const p of parts.sort((a, b) => b.start - a.start)) out = out.slice(0, p.start - e.getStart(sf)) + p.text + out.slice(p.end - e.getStart(sf));
    return out;
  };
  const containsJsx = (n) => {
    let found = false;
    const v = (x) => {
      if (found) return;
      if (ts.isJsxElement(x) || ts.isJsxSelfClosingElement(x) || ts.isJsxFragment(x)) found = true;
      else ts.forEachChild(x, v);
    };
    v(n);
    return found;
  };

  const handleChildren = (children) => {
    // segments of text + plain {expressions}
    let seg = [];
    const flush = () => {
      const s = seg;
      seg = [];
      if (!s.some((c) => ts.isJsxText(c) && isText(jsxTextValue(c.text)))) {
        // no text of its own: still translate string branches such as {busy ? "Saving…" : "Save"}
        for (const c of s) {
          if (!ts.isJsxExpression(c) || !c.expression) continue;
          const tpl = template(c.expression);
          if (tpl && isText(tpl.msg.replace(/\{\w+\}/g, " "))) {
            const k = call(c, tpl.msg, tpl.values);
            if (k) edits.push({ start: c.expression.getStart(sf), end: c.expression.end, text: k });
            continue;
          }
          const r = rewriteExpr(c.expression);
          if (r !== src.slice(c.expression.getStart(sf), c.expression.end)) edits.push({ start: c.expression.getStart(sf), end: c.expression.end, text: r });
        }
        return;
      }
      const used = new Set();
      const values = [];
      let msg = "";
      for (const c of s) {
        if (ts.isJsxText(c)) msg += icuEscape(jsxTextValue(c.text));
        else {
          const lit = strOf(c.expression);
          if (lit != null) msg += icuEscape(lit);
          else {
            const name = phName(c.expression, used);
            values.push([name, rewriteExpr(c.expression)]);
            msg += `{${name}}`;
          }
        }
      }
      const lead = /^[ \t ]/.test(msg) && !/^\s*\n/.test(s[0].getFullText?.(sf) ?? "") ? '{" "}' : "";
      const trail = /[ \t ]$/.test(msg) ? '{" "}' : "";
      const text = msg.replace(/\s+/g, " ").trim();
      const first = s[0], last = s[s.length - 1];
      const raw = (n) => src.slice(n.pos, n.end);
      const start = ts.isJsxText(first) ? first.pos + (raw(first).length - raw(first).replace(/^\s+/, "").length) : first.getStart(sf);
      const end = ts.isJsxText(last) ? last.end - (raw(last).length - raw(last).replace(/\s+$/, "").length) : last.end;
      const c = call(first, text, values);
      if (c) edits.push({ start, end, text: `{${c}}` }); // surrounding whitespace stays in the source as it was
    };
    for (const c of children) {
      if (ts.isJsxText(c)) seg.push(c);
      else if (ts.isJsxExpression(c) && c.expression && !containsJsx(c.expression) && (strOf(c.expression) != null || isPlain(c.expression))) seg.push(c);
      else flush();
    }
    flush();
  };

  const visit = (n) => {
    if (ts.isJsxElement(n) || ts.isJsxFragment(n)) handleChildren(n.children);
    if (ts.isJsxAttribute(n) && ATTRS.has(n.name.getText(sf)) && n.initializer) {
      const init = n.initializer;
      if (ts.isStringLiteral(init) && isText(init.text)) {
        const c = call(n, icuEscape(init.text), []);
        if (c) edits.push({ start: init.getStart(sf), end: init.end, text: `{${c}}` });
      } else if (ts.isJsxExpression(init) && init.expression) {
        const e = init.expression;
        const s = strOf(e);
        const tpl = template(e);
        if (s != null && isText(s)) {
          const c = call(n, icuEscape(s), []);
          if (c) edits.push({ start: init.getStart(sf), end: init.end, text: `{${c}}` });
        } else if (tpl && isText(tpl.msg.replace(/\{\w+\}/g, " "))) {
          const c = call(n, tpl.msg, tpl.values);
          if (c) edits.push({ start: e.getStart(sf), end: e.end, text: c });
        } else if (!containsJsx(e)) {
          const r = rewriteExpr(e);
          if (r !== src.slice(e.getStart(sf), e.end)) edits.push({ start: e.getStart(sf), end: e.end, text: r });
        }
      }
    }
    if (ts.isJsxExpression(n) && n.expression && (ts.isJsxElement(n.parent) || ts.isJsxFragment(n.parent)) && !isPlain(n.expression)) {
      // {cond ? "A" : <b/>}: translate the string branches in place
      const r = rewriteExpr(n.expression);
      if (r !== src.slice(n.expression.getStart(sf), n.expression.end) && !containsJsx(n.expression)) edits.push({ start: n.expression.getStart(sf), end: n.expression.end, text: r });
      else if (containsJsx(n.expression)) {
        // walk branches that are strings inside JSX-containing conditionals
        const e = n.expression;
        if (ts.isConditionalExpression(e)) for (const side of [e.whenTrue, e.whenFalse]) {
          const s = strOf(side);
          if (s != null && isText(s)) {
            const c = call(side, icuEscape(s), []);
            if (c) edits.push({ start: side.getStart(sf), end: side.end, text: c });
          }
        }
      }
    }
    if (ts.isPropertyAssignment(n)) {
      const name = n.name.getText(sf).replace(/["']/g, "");
      if (FIELDS.has(name)) {
        let inApi = false;
        for (let p = n.parent; p && !ts.isSourceFile(p); p = p.parent) if (ts.isCallExpression(p) && /(api|Api|fetch|post|send)\b/i.test(p.expression.getText(sf))) inApi = true;
        const s = strOf(n.initializer);
        const tpl = template(n.initializer);
        const modDecl = componentOf(n) ? null : moduleConst(n);
        if (modDecl && !inApi && ((s != null && isText(s) && /\s|^[A-Z]/.test(s)) || (tpl && isText(tpl.msg.replace(/\{\w+\}/g, " "))))) {
          if (!wraps.has(modDecl)) wraps.set(modDecl, []);
          wraps.get(modDecl).push({ node: n.initializer, msg: s != null ? icuEscape(s) : tpl.msg, values: s != null ? [] : tpl.values });
        } else if (!inApi && s != null && isText(s) && /\s|^[A-Z]/.test(s)) {
          const c = call(n, icuEscape(s), []);
          if (c) edits.push({ start: n.initializer.getStart(sf), end: n.initializer.end, text: c });
        } else if (!inApi && tpl && isText(tpl.msg.replace(/\{\w+\}/g, " "))) {
          const c = call(n, tpl.msg, tpl.values);
          if (c) edits.push({ start: n.initializer.getStart(sf), end: n.initializer.end, text: c });
        } else if (!inApi && (ts.isConditionalExpression(n.initializer) || ts.isBinaryExpression(n.initializer))) {
          const r = rewriteExpr(n.initializer);
          if (r !== src.slice(n.initializer.getStart(sf), n.initializer.end)) edits.push({ start: n.initializer.getStart(sf), end: n.initializer.end, text: r });
        }
      }
    }
    ts.forEachChild(n, visit);
  };
  visit(sf);

  // Module-level constants with UI text (option lists, nav items…): `const X = [...]` becomes
  // `const X = (tu: Tu) => [...]` and every use inside a component becomes `X(tu)`.
  for (const [decl, fields] of wraps) {
    const name = decl.name.getText(sf);
    const exported = decl.parent.parent.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword);
    const refs = [];
    let ok = !exported;
    const findRefs = (x) => {
      if (ts.isIdentifier(x) && x.text === name && x !== decl.name && !(ts.isPropertyAccessExpression(x.parent) && x.parent.name === x) && !ts.isPropertyAssignment(x.parent)) {
        if (ts.isTypeQueryNode(x.parent)) ok = false;
        refs.push(x);
      }
      ts.forEachChild(x, findRefs);
    };
    findRefs(sf);
    const comps = refs.map((r) => componentOf(r));
    if (comps.some((c) => !c)) ok = false;
    if (!ok) {
      for (const f of fields) manual.push(`${where(f.node)}  ${f.msg}  (in ${exported ? "exported " : ""}const ${name})`);
      continue;
    }
    const init = decl.initializer;
    const base = init.getStart(sf);
    let text = src.slice(base, init.end);
    for (const f of fields.sort((a, b) => b.node.getStart(sf) - a.node.getStart(sf))) {
      const k = keyFor(f.msg);
      const vals = f.values.length ? `, { ${f.values.map(([n2, e]) => (n2 === e ? n2 : `${n2}: ${e}`)).join(", ")} }` : "";
      text = text.slice(0, f.node.getStart(sf) - base) + `tu("${k}"${vals})` + text.slice(f.node.end - base);
    }
    const typeAnn = decl.type ? `: ${decl.type.getText(sf)}` : "";
    edits.push({ start: decl.name.end, end: init.end, text: ` = (tu: Tu)${typeAnn} => (${text})` });
    needTu = true;
    for (let i = 0; i < refs.length; i++) {
      hooks.set(comps[i], Boolean(comps[i].modifiers?.some((m) => m.kind === ts.SyntaxKind.AsyncKeyword)));
      edits.push({ start: refs[i].end, end: refs[i].end, text: "(tu)" });
    }
  }

  // hooks
  const other = [...hooks.keys()].flatMap((fn) => [...src.slice(fn.body.getStart(sf), fn.body.end).matchAll(/const tu = (?:await getTranslations|useTranslations)\("([^"]+)"\)/g)].map((m) => m[1])).filter((x) => x !== ns);
  if (other.length) {
    console.error(`${file}: already uses tu for namespace ${other[0]}, skipped`);
    continue;
  }
  let needUse = false, needGet = false;
  for (const [fn, isAsync] of hooks) {
    if (/\bconst tu = /.test(src.slice(fn.body.getStart(sf), fn.body.end).split("\n").slice(0, 3).join("\n"))) continue; // already has the hook
    const decl = isAsync ? `const tu = await getTranslations("${ns}");` : `const tu = useTranslations("${ns}");`;
    isAsync ? (needGet = true) : (needUse = true);
    if (ts.isBlock(fn.body)) edits.push({ start: fn.body.getStart(sf) + 1, end: fn.body.getStart(sf) + 1, text: `\n  ${decl}`, hook: true });
    else {
      edits.push({ start: fn.body.getStart(sf), end: fn.body.getStart(sf), text: `{\n  ${decl}\n  return (`, hook: true });
      edits.push({ start: fn.body.end, end: fn.body.end, text: `);\n}`, hook: true });
    }
  }
  // drop edits nested inside a larger edit (the larger one already rewrote them)
  edits.sort((a, b) => a.start - b.start || b.end - a.end);
  const kept = [];
  for (const e of edits) {
    const outer = kept.find((k) => !k.hook && !e.hook && e.start >= k.start && e.end <= k.end && (e.start !== k.start || e.end !== k.end));
    const dup = kept.find((k) => k.start === e.start && k.end === e.end && !k.hook && !e.hook);
    if (!outer && !dup) kept.push(e);
  }
  let out = src;
  for (const e of kept.sort((a, b) => b.start - a.start || (a.hook ? 1 : -1))) out = out.slice(0, e.start) + e.text + out.slice(e.end);
  const addImport = (name, from) => {
    const re = new RegExp(`import \\{([^}]*)\\} from "${from.replace("/", "\\/")}";`);
    const m = out.match(re);
    if (m) {
      if (!new RegExp(`\\b${name}\\b`).test(m[1])) out = out.replace(re, `import {${m[1].replace(/\s*$/, "")}, ${name} } from "${from}";`);
    } else {
      const lines = out.split("\n");
      let i = lines[0].startsWith('"use client"') ? 1 : 0;
      while (i < lines.length && lines[i].trim() === "") i++;
      lines.splice(i, 0, `import { ${name} } from "${from}";`);
      out = lines.join("\n");
    }
  };
  if (needUse) addImport("useTranslations", "next-intl");
  if (needTu && !/\btype Tu\b/.test(out)) addImport("type Tu", "@/lib/i18n/tu");
  if (needGet) addImport("getTranslations", "next-intl/server");
  if (out !== src) writeFileSync(file, out);
  report.push({ file: file.replace(ROOT, ""), changed: kept.filter((e) => !e.hook).length, manual });
}
writeFileSync(enPath, JSON.stringify(en, null, 2) + "\n");
for (const r of report) {
  console.log(`${r.file}: ${r.changed} replaced${r.manual.length ? `, ${r.manual.length} need manual work` : ""}`);
  for (const m of r.manual) console.log("   manual:", m);
}
console.log(`added ${added.length} keys to ${ns}`);

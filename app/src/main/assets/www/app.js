"use strict";
/* Kod Editör — Monaco tabanlı mobil editör */

const $ = (s) => document.querySelector(s);

// ---- Yerel depolama (Android köprüsü yoksa tarayıcıda deneme için bellek) ----
const FS = window.Android || (() => {
  const mem = { "ilk-proje/index.html": "<h1>Deneme</h1>\n<script src=\"app.js\"></script>\n", "ilk-proje/app.js": "console.log('merhaba')\n" };
  const dirs = new Set(["ilk-proje"]);
  const ok = JSON.stringify({ ok: true });
  return {
    list: () => JSON.stringify([...[...dirs].map((p) => ({ p, d: true })), ...Object.keys(mem).map((p) => ({ p, d: false }))]),
    read: (p) => mem[p] || "",
    write: (p, c) => { mem[p] = c; return ok; },
    exists: (p) => p in mem || dirs.has(p),
    mkdir: (p) => { dirs.add(p); return ok; },
    remove: (p) => { delete mem[p]; dirs.delete(p); for (const k of Object.keys(mem)) if (k.startsWith(p + "/")) delete mem[k]; return ok; },
    rename: (a, b) => { mem[b] = mem[a]; delete mem[a]; return ok; },
    toast: (m) => console.log(m),
    importFiles: () => {}, exportFile: () => {},
  };
})();

const store = {
  get(k, d) { try { const v = localStorage.getItem("ke." + k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem("ke." + k, JSON.stringify(v)); } catch (e) {} },
};

function res(r) {
  try { const j = JSON.parse(r); if (!j.ok) FS.toast(j.error || "Hata"); return j.ok; } catch (e) { return false; }
}

const LANG = {
  html: "html", htm: "html", css: "css", scss: "scss", less: "less", js: "javascript", mjs: "javascript", cjs: "javascript",
  jsx: "javascript", ts: "typescript", tsx: "typescript", json: "json", md: "markdown", py: "python", java: "java",
  kt: "kotlin", kts: "kotlin", c: "c", h: "c", cpp: "cpp", hpp: "cpp", cc: "cpp", cs: "csharp", php: "php", xml: "xml",
  svg: "xml", sql: "sql", sh: "shell", bash: "shell", yml: "yaml", yaml: "yaml", go: "go", rs: "rust", lua: "lua",
  rb: "ruby", swift: "swift", dart: "dart", bat: "bat", ps1: "powershell", ini: "ini", txt: "plaintext",
};
const ICON = { html: "🌐", htm: "🌐", css: "🎨", js: "🟨", ts: "🔷", json: "{}", md: "📝", py: "🐍", java: "☕", kt: "🟪",
  c: "©", cpp: "➕", png: "🖼", jpg: "🖼", jpeg: "🖼", svg: "🖼", gif: "🖼", txt: "📄" };
const ext = (p) => (p.split("/").pop().includes(".") ? p.split(".").pop().toLowerCase() : "");
const base = (p) => p.split("/").pop();
const dirOf = (p) => (p.includes("/") ? p.slice(0, p.lastIndexOf("/")) : "");
const join = (d, n) => (d ? d + "/" + n : n);
const langOf = (p) => LANG[ext(p)] || "plaintext";
const BINARY = /\.(png|jpe?g|gif|webp|ico|bmp|mp3|mp4|wav|ogg|zip|apk|pdf|ttf|woff2?|exe|jar)$/i;

// ---- Durum ----
let editor = null;
const models = new Map();        // yol -> monaco model
const savedVer = new Map();      // yol -> kaydedilmiş sürüm id
const timers = new Map();
let tabs = store.get("tabs", []);
let active = store.get("active", null);
let expanded = new Set(store.get("expanded", ["ilk-proje"]));
let fontSize = store.get("fontSize", 14);
let wrap = store.get("wrap", true);
let minimap = store.get("minimap", false);
let selDir = "";                 // gezginde seçili klasör (yeni dosyalar buraya)

// ---- Modal (prompt / confirm yerine) ----
function ask(title, value = "", { confirmOnly = false, okText = "Tamam" } = {}) {
  return new Promise((resolve) => {
    const m = $("#modal"), inp = $("#mInput");
    $("#mTitle").textContent = title;
    $("#mOk").textContent = okText;
    inp.classList.toggle("hidden", confirmOnly);
    inp.value = value;
    m.classList.remove("hidden");
    if (!confirmOnly) {
      setTimeout(() => {
        inp.focus();
        const dot = value.lastIndexOf(".");
        inp.setSelectionRange(0, dot > 0 ? dot : value.length);
      }, 50);
    }
    const done = (v) => { m.classList.add("hidden"); cleanup(); resolve(v); };
    const onOk = () => done(confirmOnly ? true : inp.value.trim() || null);
    const onNo = () => done(confirmOnly ? false : null);
    const onKey = (e) => { if (e.key === "Enter") onOk(); if (e.key === "Escape") onNo(); };
    function cleanup() {
      $("#mOk").removeEventListener("click", onOk); $("#mCancel").removeEventListener("click", onNo);
      inp.removeEventListener("keydown", onKey);
    }
    $("#mOk").addEventListener("click", onOk); $("#mCancel").addEventListener("click", onNo);
    inp.addEventListener("keydown", onKey);
  });
}
const validName = (n) => n && !/[\\:*?"<>|]/.test(n) && !n.split("/").some((s) => s === ".." || s === "");

// ---- Açılır menü ----
function popup(el, items, title) {
  closePops();
  el.innerHTML = (title ? `<div class="ttl">${esc(title)}</div>` : "") + items.map((it, i) =>
    it === "-" ? '<div class="sep"></div>' :
      `<button data-i="${i}" class="${it.danger ? "danger" : ""}"><span>${esc(it.t)}</span>${it.k ? `<small>${esc(it.k)}</small>` : ""}</button>`
  ).join("");
  el.classList.remove("hidden");
  el.onclick = (e) => {
    const b = e.target.closest("button[data-i]");
    if (!b) return;
    closePops();
    items[+b.dataset.i].f();
  };
}
function closePops() { $("#menu").classList.add("hidden"); $("#sheet").classList.add("hidden"); }
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
document.addEventListener("pointerdown", (e) => {
  if (!e.target.closest(".pop") && !e.target.closest("#bMenu")) closePops();
}, true);

// ---- Gezgin ----
function listAll() {
  let arr = [];
  try { arr = JSON.parse(FS.list()); } catch (e) {}
  return arr;
}
function buildTree() {
  const rootNode = { name: "", path: "", dir: true, kids: new Map() };
  for (const { p, d } of listAll()) {
    const parts = p.split("/");
    let n = rootNode;
    parts.forEach((part, i) => {
      if (!n.kids.has(part)) n.kids.set(part, { name: part, path: parts.slice(0, i + 1).join("/"), dir: i < parts.length - 1 || d, kids: new Map() });
      n = n.kids.get(part);
    });
  }
  return rootNode;
}
function renderTree() {
  const out = [];
  const walk = (node, depth) => {
    const kids = [...node.kids.values()].sort((a, b) => (b.dir - a.dir) || a.name.localeCompare(b.name, "tr"));
    for (const k of kids) {
      const open = expanded.has(k.path);
      const icon = k.dir ? (open ? "▾ 📂" : "▸ 📁") : (ICON[ext(k.name)] || "📄");
      out.push(`<div class="node${k.path === active ? " cur" : ""}" data-p="${esc(k.path)}" data-d="${k.dir ? 1 : 0}" style="padding-left:${8 + depth * 14}px">
        <span class="ic">${icon}</span><span class="nm">${esc(k.name)}</span><button class="more" data-more="1">⋯</button></div>`);
      if (k.dir && open) walk(k, depth + 1);
    }
  };
  walk(buildTree(), 0);
  $("#tree").innerHTML = out.join("") || '<div style="padding:14px;color:#858585">Henüz dosya yok</div>';
}
$("#tree").addEventListener("click", (e) => {
  const node = e.target.closest(".node");
  if (!node) return;
  const p = node.dataset.p, isDir = node.dataset.d === "1";
  if (e.target.dataset.more) return nodeMenu(p, isDir);
  if (isDir) {
    selDir = p;
    expanded.has(p) ? expanded.delete(p) : expanded.add(p);
    store.set("expanded", [...expanded]);
    renderTree();
  } else {
    selDir = dirOf(p);
    openFile(p);
    if (innerWidth < 900) toggleExplorer(false);
  }
});
$("#tree").addEventListener("contextmenu", (e) => {
  const node = e.target.closest(".node");
  if (node) { e.preventDefault(); nodeMenu(node.dataset.p, node.dataset.d === "1"); }
});

function nodeMenu(p, isDir) {
  const items = [];
  if (isDir) {
    items.push({ t: "Burada yeni dosya", f: () => newFile(p) }, { t: "Burada yeni klasör", f: () => newDir(p) },
      { t: "Buraya içe aktar", f: () => FS.importFiles(p) }, "-");
  } else {
    items.push({ t: "Aç", f: () => { openFile(p); toggleExplorer(false); } });
    if (/\.(html?|js)$/i.test(p)) items.push({ t: "Çalıştır", f: () => run(p) });
    items.push({ t: "Telefona kaydet (dışa aktar)", f: () => { saveFile(p); FS.exportFile(p); } }, "-");
  }
  items.push({ t: "Yeniden adlandır", f: () => renamePath(p) }, { t: "Kopyala", f: () => duplicate(p, isDir) },
    { t: "Sil", danger: true, f: () => removePath(p, isDir) });
  popup($("#sheet"), items, p);
}

async function newFile(dir = selDir) {
  const n = await ask(`Yeni dosya${dir ? " — " + dir + "/" : ""}`, "yeni.js");
  if (!n) return;
  if (!validName(n)) return FS.toast("Geçersiz ad");
  const p = join(dir, n);
  if (FS.exists(p)) return FS.toast("Bu dosya zaten var");
  if (res(FS.write(p, ""))) {
    if (dir) expanded.add(dir);
    renderTree(); openFile(p);
    if (innerWidth < 900) toggleExplorer(false);
  }
}
async function newDir(dir = selDir) {
  const n = await ask(`Yeni klasör${dir ? " — " + dir + "/" : ""}`, "klasor");
  if (!n) return;
  if (!validName(n)) return FS.toast("Geçersiz ad");
  const p = join(dir, n);
  if (res(FS.mkdir(p))) { expanded.add(p); if (dir) expanded.add(dir); selDir = p; store.set("expanded", [...expanded]); renderTree(); }
}
async function renamePath(p) {
  const n = await ask("Yeni ad", base(p));
  if (!n || n === base(p)) return;
  if (!validName(n)) return FS.toast("Geçersiz ad");
  saveAll();
  const to = join(dirOf(p), n);
  if (!res(FS.rename(p, to))) return;
  // Açık sekmeleri ve modelleri yeni yola taşı
  for (const [path, model] of [...models]) {
    if (path === p || path.startsWith(p + "/")) {
      const np = to + path.slice(p.length);
      models.delete(path); model.dispose();
      const i = tabs.indexOf(path);
      if (i >= 0) tabs[i] = np;
      if (active === path) active = np;
    }
  }
  if (expanded.has(p)) { expanded.delete(p); expanded.add(to); }
  persistTabs(); renderTree();
  if (active) openFile(active); else renderTabs();
}
function duplicate(p, isDir) {
  if (isDir) return FS.toast("Klasör kopyalama yok, dosyaları tek tek kopyala");
  saveFile(p);
  const e = ext(p), stem = e ? base(p).slice(0, -(e.length + 1)) : base(p);
  let i = 1, np;
  do { np = join(dirOf(p), `${stem}-kopya${i > 1 ? i : ""}${e ? "." + e : ""}`); i++; } while (FS.exists(np));
  if (res(FS.write(np, FS.read(p)))) { renderTree(); FS.toast("Kopyalandı: " + base(np)); }
}
async function removePath(p, isDir) {
  const okd = await ask(`"${base(p)}" ${isDir ? "klasörü ve içindekiler" : ""} silinsin mi?`, "", { confirmOnly: true, okText: "Sil" });
  if (!okd) return;
  if (!res(FS.remove(p))) return;
  for (const path of [...tabs]) if (path === p || path.startsWith(p + "/")) closeTab(path, true);
  renderTree();
}

window.onImported = (n) => { renderTree(); FS.toast(n ? `${n} dosya içe aktarıldı` : "Dosya alınamadı"); };

function toggleExplorer(force) {
  const ex = $("#explorer");
  const open = force === undefined ? !ex.classList.contains("open") : force;
  ex.classList.toggle("open", open);
  if (open) renderTree();
  if (editor) setTimeout(() => editor.layout(), 220);
}

// ---- Sekmeler ----
function persistTabs() { store.set("tabs", tabs); store.set("active", active); }
function isDirty(p) { const m = models.get(p); return m && savedVer.get(p) !== m.getAlternativeVersionId(); }
function renderTabs() {
  $("#tabs").innerHTML = tabs.map((p) =>
    `<div class="tab${p === active ? " on" : ""}${isDirty(p) ? " dirty" : ""}" data-p="${esc(p)}"><span>${ICON[ext(p)] || "📄"} ${esc(base(p))}</span><button class="x" data-x="1"></button></div>`
  ).join("");
  const on = $("#tabs .tab.on");
  if (on) on.scrollIntoView({ block: "nearest", inline: "nearest" });
  $("#empty").classList.toggle("hidden", !!active);
}
$("#tabs").addEventListener("click", (e) => {
  const t = e.target.closest(".tab");
  if (!t) return;
  if (e.target.dataset.x) closeTab(t.dataset.p); else openFile(t.dataset.p);
});

function getModel(p) {
  if (models.has(p)) return models.get(p);
  const uri = monaco.Uri.parse("file:///" + p.split("/").map(encodeURIComponent).join("/"));
  const existing = monaco.editor.getModel(uri);
  if (existing) existing.dispose();
  const m = monaco.editor.createModel(FS.read(p), langOf(p), uri);
  m.updateOptions({ tabSize: 2, insertSpaces: true });
  savedVer.set(p, m.getAlternativeVersionId());
  m.onDidChangeContent(() => {
    renderDirty(p);
    clearTimeout(timers.get(p));
    timers.set(p, setTimeout(() => saveFile(p), 900));
  });
  models.set(p, m);
  return m;
}
function renderDirty(p) {
  const t = [...document.querySelectorAll("#tabs .tab")].find((el) => el.dataset.p === p);
  if (t) t.classList.toggle("dirty", isDirty(p));
  if (p === active) $("#sSave").textContent = isDirty(p) ? "● Kaydedilmedi" : "✓ Kaydedildi";
}

function openFile(p) {
  if (!editor) return;
  if (BINARY.test(p)) return FS.toast("Bu dosya türü metin olarak açılamaz");
  if (!FS.exists(p)) { closeTab(p, true); return; }
  if (!tabs.includes(p)) tabs.push(p);
  active = p;
  editor.setModel(getModel(p));
  const vs = store.get("view." + p, null);
  if (vs) editor.restoreViewState(vs);
  persistTabs(); renderTabs(); renderTree();
  $("#sPath").textContent = p;
  $("#sLang").textContent = langOf(p);
  renderDirty(p);
  updatePos();
  editor.focus();
}
function closeTab(p, silent) {
  if (!silent) saveFile(p);
  const i = tabs.indexOf(p);
  if (i < 0) return;
  tabs.splice(i, 1);
  const m = models.get(p);
  if (m) { m.dispose(); models.delete(p); }
  if (active === p) {
    active = tabs[Math.min(i, tabs.length - 1)] || null;
    if (active) return openFile(active);
    editor.setModel(null);
    $("#sPath").textContent = "—"; $("#sLang").textContent = ""; $("#sPos").textContent = ""; $("#sSave").textContent = "";
  }
  persistTabs(); renderTabs(); renderTree();
}

function saveFile(p) {
  const m = models.get(p);
  if (!m) return;
  clearTimeout(timers.get(p));
  if (!isDirty(p)) return;
  if (res(FS.write(p, m.getValue()))) { savedVer.set(p, m.getAlternativeVersionId()); renderDirty(p); }
}
window.saveAll = () => {
  for (const p of models.keys()) saveFile(p);
  if (editor && active) store.set("view." + active, editor.saveViewState());
};

function updatePos() {
  if (!editor || !active) return;
  const pos = editor.getPosition();
  if (pos) $("#sPos").textContent = `Sat ${pos.lineNumber}, Süt ${pos.column}`;
}

// ---- Çalıştır / önizleme ----
const CAPTURE = `<script>(function(){
  var send=function(t,a){try{parent.postMessage({__ke:1,t:t,m:[].map.call(a,function(x){
    if(x instanceof Error)return x.stack||String(x);
    if(typeof x==='object'&&x!==null){try{return JSON.stringify(x,null,2)}catch(e){return String(x)}}
    return String(x)}).join(' ')},'*')}catch(e){}};
  ['log','info','warn','error','debug'].forEach(function(k){var o=console[k];console[k]=function(){send(k,arguments);o&&o.apply(console,arguments)}});
  window.addEventListener('error',function(e){send('error',[e.message+(e.lineno?' (satır '+e.lineno+')':'')])});
  window.addEventListener('unhandledrejection',function(e){send('error',['Promise: '+(e.reason&&e.reason.message||e.reason)])});
})();<\/script>`;
const safeScript = (s) => s.replace(/<\/script/gi, "<\\/script");

function readLive(p) { return models.has(p) ? models.get(p).getValue() : FS.read(p); }
function resolveRel(fromDir, href) {
  if (/^(https?:|data:|blob:|\/\/)/i.test(href)) return null;
  const parts = (fromDir ? fromDir.split("/") : []);
  for (const seg of href.split("?")[0].split("#")[0].split("/")) {
    if (seg === "..") parts.pop(); else if (seg && seg !== ".") parts.push(seg);
  }
  return parts.join("/");
}
function buildHtml(p) {
  const d = dirOf(p);
  let html = readLive(p);
  html = html.replace(/<link\b[^>]*?href=["']([^"']+)["'][^>]*>/gi, (tag, href) => {
    if (!/stylesheet/i.test(tag)) return tag;
    const f = resolveRel(d, href);
    return f && FS.exists(f) ? `<style data-src="${esc(href)}">\n${readLive(f)}\n</style>` : tag;
  });
  html = html.replace(/<script\b([^>]*?)src=["']([^"']+)["']([^>]*)>\s*<\/script>/gi, (tag, a, src, b) => {
    const f = resolveRel(d, src);
    return f && FS.exists(f) ? `<script${a}${b}>\n${safeScript(readLive(f))}\n<\/script>` : tag;
  });
  if (/<head[^>]*>/i.test(html)) html = html.replace(/<head[^>]*>/i, (m) => m + CAPTURE);
  else html = CAPTURE + html;
  return html;
}
let lastRun = null;
function run(p = active) {
  if (!p) return FS.toast("Önce bir dosya aç");
  saveAll();
  let target = p;
  // CSS açıksa aynı klasördeki index.html'i çalıştır
  if (/\.(css|scss)$/i.test(p)) {
    const idx = join(dirOf(p), "index.html");
    if (FS.exists(idx)) target = idx; else return FS.toast("Bu klasörde index.html yok");
  }
  const isHtml = /\.html?$/i.test(target), isJs = /\.(m?js)$/i.test(target);
  if (!isHtml && !isJs) {
    if (/\.md$/i.test(target)) return runMarkdown(target);
    return FS.toast("Şimdilik HTML, JS ve Markdown çalıştırılabiliyor");
  }
  lastRun = target;
  const pv = $("#preview");
  pv.classList.remove("hidden", "jsonly");
  pv.classList.toggle("jsonly", isJs);
  if (isJs) pv.classList.remove("noconsole");
  $("#pTitle").textContent = target;
  $("#clog").innerHTML = "";
  logLine("sys", isJs ? `▶ ${base(target)} çalıştırılıyor` : `▶ ${base(target)} yüklendi`);
  const doc = isHtml ? buildHtml(target)
    : `<!DOCTYPE html><html><head><meta charset="utf-8">${CAPTURE}</head><body><script>\n${safeScript(readLive(target))}\n<\/script></body></html>`;
  $("#frame").srcdoc = doc;
}
function runMarkdown(p) {
  lastRun = p;
  const pv = $("#preview");
  pv.classList.remove("hidden", "jsonly"); pv.classList.add("noconsole");
  $("#pTitle").textContent = p;
  $("#frame").srcdoc = `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
  <style>body{font:15px/1.6 system-ui;padding:16px 20px;max-width:760px;margin:auto;color:#222}code{background:#f2f2f2;padding:1px 4px;border-radius:3px}
  pre{background:#f2f2f2;padding:10px;overflow:auto;border-radius:6px}h1,h2{border-bottom:1px solid #eee;padding-bottom:4px}</style></head><body>${md(readLive(p))}</body></html>`;
}
// Küçük Markdown çevirici (başlık, liste, kod, kalın, italik, link)
function md(src) {
  const lines = esc(src).split("\n"); let out = "", inCode = false, inList = false;
  const inline = (s) => s.replace(/`([^`]+)`/g, "<code>$1</code>").replace(/\*\*([^*]+)\*\*/g, "<b>$1</b>")
    .replace(/\*([^*]+)\*/g, "<i>$1</i>").replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, '<a href="$2">$1</a>');
  for (const l of lines) {
    if (/^```/.test(l)) { out += inCode ? "</pre>" : "<pre>"; inCode = !inCode; continue; }
    if (inCode) { out += l + "\n"; continue; }
    const li = /^\s*[-*] (.*)/.exec(l);
    if (li) { if (!inList) { out += "<ul>"; inList = true; } out += `<li>${inline(li[1])}</li>`; continue; }
    if (inList) { out += "</ul>"; inList = false; }
    const h = /^(#{1,6}) (.*)/.exec(l);
    if (h) out += `<h${h[1].length}>${inline(h[2])}</h${h[1].length}>`;
    else if (l.trim()) out += `<p>${inline(l)}</p>`;
  }
  return out + (inList ? "</ul>" : "") + (inCode ? "</pre>" : "");
}
function logLine(type, text) {
  const div = document.createElement("div");
  div.className = type; div.textContent = text;
  const c = $("#clog"); c.appendChild(div);
  c.scrollTop = c.scrollHeight;
}
window.addEventListener("message", (e) => {
  if (e.data && e.data.__ke) logLine(e.data.t === "log" || e.data.t === "debug" ? "" : e.data.t, e.data.m);
});
function closePreview() { $("#preview").classList.add("hidden"); $("#frame").srcdoc = ""; if (editor) editor.focus(); }

// ---- Ekstra tuşlar ----
const KEYS = [
  ["⇥", () => editor.trigger("keys", "tab", null)], ["←", () => editor.trigger("keys", "cursorLeft", null)],
  ["→", () => editor.trigger("keys", "cursorRight", null)], ["↑", () => editor.trigger("keys", "cursorUp", null)],
  ["↓", () => editor.trigger("keys", "cursorDown", null)],
  ..."{}()[]<>;:=\"'/+-*!&|.,#$_`".split("").map((c) => [c, () => editor.trigger("keys", "type", { text: c })]),
  ["↶", () => editor.trigger("keys", "undo", null)], ["↷", () => editor.trigger("keys", "redo", null)],
  ["⌫", () => editor.trigger("keys", "deleteLeft", null)],
];
function renderKeys() {
  $("#keys").innerHTML = KEYS.map(([k], i) => `<button data-k="${i}">${esc(k)}</button>`).join("");
  $("#keys").addEventListener("pointerdown", (e) => {
    const b = e.target.closest("button");
    if (!b || !editor || !active) return;
    e.preventDefault(); // klavye kapanmasın
    editor.focus();
    KEYS[+b.dataset.k][1]();
  });
}

// ---- Menü ----
function action(id) { const a = editor && editor.getAction(id); if (a) { editor.focus(); a.run(); } }
function applyOptions() {
  if (!editor) return;
  editor.updateOptions({ fontSize, wordWrap: wrap ? "on" : "off", minimap: { enabled: minimap } });
  store.set("fontSize", fontSize); store.set("wrap", wrap); store.set("minimap", minimap);
}
$("#bMenu").addEventListener("click", () => {
  const m = $("#menu");
  if (!m.classList.contains("hidden")) return closePops();
  popup(m, [
    { t: "Yeni dosya", f: () => newFile() },
    { t: "Kaydet", k: "Ctrl+S", f: () => { saveAll(); FS.toast("Kaydedildi"); } },
    { t: "Çalıştır", k: "F5", f: () => run() },
    "-",
    { t: "Bul", k: "Ctrl+F", f: () => action("actions.find") },
    { t: "Bul ve değiştir", k: "Ctrl+H", f: () => action("editor.action.startFindReplaceAction") },
    { t: "Satıra git", k: "Ctrl+G", f: () => action("editor.action.gotoLine") },
    { t: "Belgeyi biçimlendir", k: "⇧⌥F", f: () => action("editor.action.formatDocument") },
    { t: "Yorum satırı yap/kaldır", k: "Ctrl+/", f: () => action("editor.action.commentLine") },
    { t: "Komut paleti", k: "F1", f: () => action("editor.action.quickCommand") },
    "-",
    { t: `Satır kaydırma: ${wrap ? "Açık" : "Kapalı"}`, f: () => { wrap = !wrap; applyOptions(); } },
    { t: `Mini harita: ${minimap ? "Açık" : "Kapalı"}`, f: () => { minimap = !minimap; applyOptions(); } },
    { t: `Yazı boyutu büyüt (${fontSize})`, f: () => { fontSize = Math.min(28, fontSize + 1); applyOptions(); } },
    { t: "Yazı boyutu küçült", f: () => { fontSize = Math.max(9, fontSize - 1); applyOptions(); } },
    "-",
    { t: "Dosya içe aktar", f: () => FS.importFiles(selDir) },
    ...(active ? [{ t: "Bu dosyayı telefona kaydet", f: () => { saveAll(); FS.exportFile(active); } }] : []),
    ...(active ? [{ t: "Sekmeyi kapat", f: () => closeTab(active) }] : []),
  ]);
});

// ---- Geri tuşu (Android) ----
window.onBack = () => {
  if (!$("#modal").classList.contains("hidden")) { $("#mCancel").click(); return true; }
  if (!$("#menu").classList.contains("hidden") || !$("#sheet").classList.contains("hidden")) { closePops(); return true; }
  if (!$("#preview").classList.contains("hidden")) { closePreview(); return true; }
  if ($("#explorer").classList.contains("open") && innerWidth < 900) { toggleExplorer(false); return true; }
  saveAll();
  return false;
};

// ---- Bağlantılar ----
$("#bExplorer").addEventListener("click", () => toggleExplorer());
$("#scrim").addEventListener("click", () => toggleExplorer(false));
$("#bRun").addEventListener("click", () => run());
$("#bNewFile").addEventListener("click", () => newFile());
$("#bNewDir").addEventListener("click", () => newDir());
$("#bImport").addEventListener("click", () => FS.importFiles(selDir));
$("#bEmptyNew").addEventListener("click", () => newFile());
$("#pClose").addEventListener("click", closePreview);
$("#pReload").addEventListener("click", () => lastRun && run(lastRun));
$("#pConsoleT").addEventListener("click", () => $("#preview").classList.toggle("noconsole"));
$("#cClear").addEventListener("click", () => { $("#clog").innerHTML = ""; });
window.addEventListener("resize", () => editor && editor.layout());
document.addEventListener("visibilitychange", () => { if (document.hidden) saveAll(); });

// ---- Monaco'yu başlat ----
renderKeys();
renderTabs();
if (typeof require === "undefined") {
  $("#loading").textContent = "Monaco bulunamadı (assets/www/monaco eksik)";
} else {
  require.config({ paths: { vs: "monaco/vs" } });
  require(["vs/editor/editor.main"], () => {
    $("#loading").classList.add("hidden");
    monaco.editor.defineTheme("ke-dark", {
      base: "vs-dark", inherit: true, rules: [],
      colors: { "editor.background": "#1e1e1e", "editorGutter.background": "#1e1e1e" },
    });
    monaco.languages.typescript.javascriptDefaults.setCompilerOptions({ allowNonTsExtensions: true, checkJs: false, target: 99 });
    editor = monaco.editor.create($("#editor"), {
      model: null, theme: "ke-dark", automaticLayout: true, fontSize, wordWrap: wrap ? "on" : "off",
      minimap: { enabled: minimap }, fontFamily: "'Cascadia Code','Fira Code','Roboto Mono',monospace", fontLigatures: true,
      lineNumbersMinChars: 3, glyphMargin: false, folding: true, scrollBeyondLastLine: false, smoothScrolling: true,
      cursorBlinking: "smooth", bracketPairColorization: { enabled: true }, guides: { bracketPairs: true },
      renderLineHighlight: "all", tabSize: 2, padding: { top: 6 }, fixedOverflowWidgets: true,
      quickSuggestions: { other: true, comments: false, strings: true }, suggestOnTriggerCharacters: true,
      autoClosingBrackets: "always", autoClosingQuotes: "always", formatOnPaste: false, stickyScroll: { enabled: false },
      scrollbar: { verticalScrollbarSize: 8, horizontalScrollbarSize: 8 },
    });
    editor.onDidChangeCursorPosition(updatePos);
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => { saveAll(); FS.toast("Kaydedildi"); });
    editor.addCommand(monaco.KeyCode.F5, () => run());
    // Önceki oturumu geri yükle
    tabs = tabs.filter((p) => FS.exists(p));
    if (active && FS.exists(active)) openFile(active);
    else if (tabs.length) openFile(tabs[0]);
    else if (FS.exists("ilk-proje/index.html")) openFile("ilk-proje/index.html");
    renderTabs();
    setInterval(() => { if (active) store.set("view." + active, editor.saveViewState()); }, 5000);
  }, (err) => {
    $("#loading").textContent = "Editör yüklenemedi: " + (err && err.message || err);
  });
}

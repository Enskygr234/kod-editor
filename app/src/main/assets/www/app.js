"use strict";
/* Kod Editör 1.1 — Monaco tabanlı mobil editör */

const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];
const NATIVE = !!window.Android;

// ---- Dosya sistemi (Android köprüsü; tarayıcıda denemek için bellek içi yedek) ----
const FS = window.Android || (() => {
  const mem = { "ilk-proje/index.html": "<h1>Deneme</h1>\n<script src=\"app.js\"></script>\n", "ilk-proje/app.js": "console.log('merhaba')\n" };
  const dirs = new Set(["ilk-proje"]);
  const ok = JSON.stringify({ ok: true });
  return {
    list: () => JSON.stringify([...[...dirs].map((p) => ({ p, d: true })), ...Object.keys(mem).map((p) => ({ p, d: false }))]),
    read: (p) => mem[p] || "",
    write: (p, c) => { mem[p] = c; p.split("/").slice(0, -1).forEach((_, i, a) => dirs.add(a.slice(0, i + 1).join("/"))); return ok; },
    exists: (p) => p in mem || dirs.has(p),
    mkdir: (p) => { dirs.add(p); return ok; },
    remove: (p) => { delete mem[p]; dirs.delete(p); for (const k of Object.keys(mem)) if (k.startsWith(p + "/")) delete mem[k]; return ok; },
    rename: (a, b) => { mem[b] = mem[a]; delete mem[a]; return ok; },
    toast: (m) => console.log("[toast]", m),
    importFiles: () => {}, exportFile: () => {},
    gitHasToken: () => false, gitSetToken: () => {}, installApk: () => {},
  };
})();

const store = {
  get(k, d) { try { const v = localStorage.getItem("ke." + k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem("ke." + k, JSON.stringify(v)); } catch (e) {} },
};
function res(r) {
  try { const j = JSON.parse(r); if (!j.ok) FS.toast(j.error || "Hata"); return j.ok; } catch (e) { return false; }
}

// ---- Arka plan işleri (arama, GitHub) ----
let reqId = 0;
const pending = new Map();
function native(op, args = {}) {
  return new Promise((resolve, reject) => {
    if (!NATIVE || !FS.call) return reject(new Error("Bu özellik yalnızca uygulamada çalışır"));
    const id = ++reqId;
    pending.set(id, { resolve, reject });
    FS.call(id, op, JSON.stringify(args));
  });
}
window.__done = (id, s) => {
  const p = pending.get(id);
  if (!p) return;
  pending.delete(id);
  let j;
  try { j = JSON.parse(s); } catch (e) { j = { ok: false, error: s }; }
  if (j.ok === false) p.reject(new Error(j.error || "Hata")); else p.resolve(j);
};

// ---- Diller ve yardımcılar ----
const LANG = {
  html: "html", htm: "html", css: "css", scss: "scss", less: "less", js: "javascript", mjs: "javascript", cjs: "javascript",
  jsx: "javascript", ts: "typescript", tsx: "typescript", json: "json", md: "markdown", py: "python", java: "java",
  kt: "kotlin", kts: "kotlin", gradle: "kotlin", c: "c", h: "c", cpp: "cpp", hpp: "cpp", cc: "cpp", cs: "csharp", php: "php",
  xml: "xml", svg: "xml", sql: "sql", sh: "shell", bash: "shell", yml: "yaml", yaml: "yaml", go: "go", rs: "rust", lua: "lua",
  rb: "ruby", swift: "swift", dart: "dart", bat: "bat", ps1: "powershell", ini: "ini", properties: "ini", toml: "ini", txt: "plaintext",
};
const ICON = { html: "🌐", htm: "🌐", css: "🎨", js: "🟨", ts: "🔷", json: "{}", md: "📝", py: "🐍", java: "☕", kt: "🟪",
  kts: "🐘", xml: "📰", yml: "⚙", yaml: "⚙", c: "©", cpp: "➕", png: "🖼", jpg: "🖼", jpeg: "🖼", svg: "🖼", gif: "🖼", txt: "📄" };
const ext = (p) => (base(p).includes(".") ? p.split(".").pop().toLowerCase() : "");
const base = (p) => p.split("/").pop();
const dirOf = (p) => (p.includes("/") ? p.slice(0, p.lastIndexOf("/")) : "");
const join = (d, n) => (d ? d + "/" + n : n);
const langOf = (p) => LANG[ext(p)] || "plaintext";
const projectOf = (p) => (p && p.includes("/") ? p.split("/")[0] : (p && FS.exists(p) && isDir(p) ? p : ""));
const BINARY = /\.(png|jpe?g|gif|webp|ico|bmp|mp3|mp4|wav|ogg|zip|apk|pdf|ttf|woff2?|exe|jar|keystore|jks|class|dex|so)$/i;
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const validName = (n) => n && !/[\\:*?"<>|]/.test(n) && !n.split("/").some((s) => s === ".." || s === "" || s === ".");
function isDir(p) { return listAll().some((e) => e.p === p && e.d); }

// ---- Ayarlar ----
const DEFAULTS = {
  theme: "dark", fontSize: 14, tabSize: 2, wrap: true, minimap: false, lineNumbers: true, keys: true,
  autosave: 900, ligatures: true, whitespace: false, sticky: false, cursor: "smooth", fontFamily: "default",
};
const S = Object.assign({}, DEFAULTS, store.get("settings", {}));
// 1.0'dan kalan ayarları taşı
if (store.get("fontSize", null)) { S.fontSize = store.get("fontSize"); store.set("fontSize", null); }

const THEMES = {
  dark: { name: "Dark+ (VS Code)", base: "vs-dark", ui: {}, rules: [], colors: { "editor.background": "#1e1e1e" } },
  light: {
    name: "Light+", base: "vs", rules: [], colors: {},
    ui: { bg: "#ffffff", side: "#f3f3f3", bar: "#e8e8e8", tab: "#ececec", line: "#dcdcdc", fg: "#333333", dim: "#6f6f6f",
      acc: "#007acc", hover: "#e8e8e8", sel: "#dfe3ef", inp: "#ffffff" },
  },
  monokai: {
    name: "Monokai", base: "vs-dark",
    ui: { bg: "#272822", side: "#1e1f1c", bar: "#1a1a17", tab: "#34352f", line: "#3e3d32", fg: "#f8f8f2", dim: "#90908a",
      acc: "#a6762a", hover: "#3e3d32", sel: "#49483e", inp: "#3e3d32" },
    p: { bg: "#272822", fg: "#f8f8f2", c: "75715e", s: "e6db74", k: "f92672", n: "ae81ff", t: "66d9ef", f: "a6e22e" },
  },
  dracula: {
    name: "Dracula", base: "vs-dark",
    ui: { bg: "#282a36", side: "#21222c", bar: "#191a21", tab: "#343746", line: "#44475a", fg: "#f8f8f2", dim: "#6272a4",
      acc: "#bd93f9", hover: "#343746", sel: "#44475a", inp: "#343746" },
    p: { bg: "#282a36", fg: "#f8f8f2", c: "6272a4", s: "f1fa8c", k: "ff79c6", n: "bd93f9", t: "8be9fd", f: "50fa7b" },
  },
  github: {
    name: "GitHub Dark", base: "vs-dark",
    ui: { bg: "#0d1117", side: "#010409", bar: "#010409", tab: "#161b22", line: "#30363d", fg: "#c9d1d9", dim: "#8b949e",
      acc: "#1f6feb", hover: "#161b22", sel: "#1f2937", inp: "#0d1117" },
    p: { bg: "#0d1117", fg: "#c9d1d9", c: "8b949e", s: "a5d6ff", k: "ff7b72", n: "79c0ff", t: "ffa657", f: "d2a8ff" },
  },
  solarized: {
    name: "Solarized Dark", base: "vs-dark",
    ui: { bg: "#002b36", side: "#00212b", bar: "#001e26", tab: "#073642", line: "#0a4552", fg: "#93a1a1", dim: "#657b83",
      acc: "#268bd2", hover: "#073642", sel: "#0a4552", inp: "#073642" },
    p: { bg: "#002b36", fg: "#93a1a1", c: "586e75", s: "2aa198", k: "859900", n: "d33682", t: "b58900", f: "268bd2" },
  },
  nord: {
    name: "Nord", base: "vs-dark",
    ui: { bg: "#2e3440", side: "#272c36", bar: "#242933", tab: "#3b4252", line: "#434c5e", fg: "#d8dee9", dim: "#7b88a1",
      acc: "#5e81ac", hover: "#3b4252", sel: "#434c5e", inp: "#3b4252" },
    p: { bg: "#2e3440", fg: "#d8dee9", c: "616e88", s: "a3be8c", k: "81a1c1", n: "b48ead", t: "8fbcbb", f: "88c0d0" },
  },
  hc: {
    name: "Yüksek kontrast", base: "hc-black", rules: [], colors: {},
    ui: { bg: "#000000", side: "#000000", bar: "#000000", tab: "#000000", line: "#6fc3df", fg: "#ffffff", dim: "#cccccc",
      acc: "#f38518", hover: "#0a0a0a", sel: "#1a1a1a", inp: "#000000" },
  },
};
function themeRules(p) {
  if (!p) return [];
  return [
    { token: "", foreground: p.fg.slice(1), background: p.bg.slice(1) },
    { token: "comment", foreground: p.c, fontStyle: "italic" },
    { token: "string", foreground: p.s }, { token: "attribute.value", foreground: p.s },
    { token: "keyword", foreground: p.k }, { token: "tag", foreground: p.k },
    { token: "number", foreground: p.n }, { token: "constant", foreground: p.n },
    { token: "type", foreground: p.t }, { token: "attribute.name", foreground: p.f },
    { token: "delimiter", foreground: p.fg.slice(1) }, { token: "identifier", foreground: p.fg.slice(1) },
  ];
}
function defineThemes() {
  for (const [id, t] of Object.entries(THEMES)) {
    const colors = t.p ? { "editor.background": t.p.bg, "editor.foreground": t.p.fg, "editorGutter.background": t.p.bg,
      "editor.lineHighlightBackground": t.ui.hover, "editorLineNumber.foreground": t.ui.dim, "editor.selectionBackground": t.ui.sel } : t.colors;
    monaco.editor.defineTheme("ke-" + id, { base: t.base, inherit: true, rules: t.rules || themeRules(t.p), colors });
  }
}
const UI_DEFAULT = { bg: "#1e1e1e", side: "#252526", bar: "#181818", tab: "#2d2d2d", line: "#333333", fg: "#cccccc", dim: "#858585",
  acc: "#007acc", hover: "#2a2d2e", sel: "#37373d", inp: "#3c3c3c" };
function applyTheme() {
  const t = THEMES[S.theme] || THEMES.dark;
  const ui = Object.assign({}, UI_DEFAULT, t.ui);
  for (const [k, v] of Object.entries(ui)) document.documentElement.style.setProperty("--" + k, v);
  document.documentElement.style.colorScheme = t.base === "vs" ? "light" : "dark";
  if (window.monaco) monaco.editor.setTheme("ke-" + (THEMES[S.theme] ? S.theme : "dark"));
}
const FONTS = {
  default: "'Cascadia Code','Fira Code','JetBrains Mono','Roboto Mono',monospace",
  roboto: "'Roboto Mono',monospace", droid: "'Droid Sans Mono','Noto Sans Mono',monospace", courier: "'Courier New',monospace",
};
function editorOptions() {
  return {
    fontSize: S.fontSize, tabSize: S.tabSize, wordWrap: S.wrap ? "on" : "off", minimap: { enabled: S.minimap },
    lineNumbers: S.lineNumbers ? "on" : "off", fontLigatures: S.ligatures, renderWhitespace: S.whitespace ? "all" : "selection",
    stickyScroll: { enabled: S.sticky }, cursorBlinking: S.cursor, fontFamily: FONTS[S.fontFamily] || FONTS.default,
  };
}
function saveSettings() {
  store.set("settings", S);
  applyTheme();
  if (editor) {
    editor.updateOptions(editorOptions());
    for (const m of models.values()) m.updateOptions({ tabSize: S.tabSize });
  }
  $("#keys").classList.toggle("hidden", !S.keys);
}

// ---- Durum ----
let editor = null;
const models = new Map();
const savedVer = new Map();
const timers = new Map();
let tabs = store.get("tabs", []);
let active = store.get("active", null);
let expanded = new Set(store.get("expanded", ["ilk-proje"]));
let selDir = "";
let view = "files";

// ---- Modal ----
function ask(title, value = "", { confirmOnly = false, okText = "Tamam", note = "", password = false } = {}) {
  return new Promise((resolve) => {
    const m = $("#modal"), inp = $("#mInput");
    $("#mTitle").textContent = title;
    $("#mNote").textContent = note;
    $("#mOk").textContent = okText;
    inp.classList.toggle("hidden", confirmOnly);
    inp.type = password ? "password" : "text";
    inp.value = value;
    m.classList.remove("hidden");
    if (!confirmOnly) setTimeout(() => {
      inp.focus();
      const dot = value.lastIndexOf(".");
      inp.setSelectionRange(0, dot > 0 ? dot : value.length);
    }, 50);
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
const confirmBox = (t, okText = "Evet", note = "") => ask(t, "", { confirmOnly: true, okText, note });

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
document.addEventListener("pointerdown", (e) => {
  if (!e.target.closest(".pop") && !e.target.closest("#bMenu")) closePops();
}, true);

// ================= GEZGİN =================
function listAll() {
  try { return JSON.parse(FS.list()); } catch (e) { return []; }
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
let gitFolders = new Set();
function renderTree() {
  const out = [];
  const walk = (node, depth) => {
    const kids = [...node.kids.values()].sort((a, b) => (b.dir - a.dir) || a.name.localeCompare(b.name, "tr"));
    for (const k of kids) {
      const open = expanded.has(k.path);
      const icon = k.dir ? (open ? "▾ 📂" : "▸ 📁") : (ICON[ext(k.name)] || "📄");
      const gitMark = depth === 0 && gitFolders.has(k.path) ? ' <small style="color:var(--dim)">🔀</small>' : "";
      out.push(`<div class="node${k.path === active ? " cur" : ""}" data-p="${esc(k.path)}" data-d="${k.dir ? 1 : 0}" style="padding-left:${8 + depth * 14}px">
        <span class="ic">${icon}</span><span class="nm">${esc(k.name)}${gitMark}</span><button class="more" data-more="1">⋯</button></div>`);
      if (k.dir && open) walk(k, depth + 1);
    }
  };
  walk(buildTree(), 0);
  $("#tree").innerHTML = out.join("") || '<div style="padding:14px;color:var(--dim)">Henüz dosya yok. 🧪 ile yeni proje aç.</div>';
}
$("#tree").addEventListener("click", (e) => {
  const node = e.target.closest(".node");
  if (!node) return;
  const p = node.dataset.p, dir = node.dataset.d === "1";
  if (e.target.dataset.more) return nodeMenu(p, dir);
  if (dir) {
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
function nodeMenu(p, dir) {
  const items = [];
  if (dir) {
    items.push({ t: "Burada yeni dosya", f: () => newFile(p) }, { t: "Burada yeni klasör", f: () => newDir(p) },
      { t: "Buraya içe aktar", f: () => FS.importFiles(p) }, { t: "Bu klasörde ara", f: () => { showPanel("search"); $("#qScope").checked = true; selDir = p; $("#qFind").focus(); } });
    if (!p.includes("/")) items.push({ t: "GitHub", f: () => { selDir = p; showPanel("git"); } });
    items.push("-");
  } else {
    items.push({ t: "Aç", f: () => { openFile(p); toggleExplorer(false); } });
    if (/\.(html?|m?js|py|md)$/i.test(p)) items.push({ t: "Çalıştır", f: () => run(p) });
    items.push({ t: "Telefona kaydet (dışa aktar)", f: () => { saveFile(p); FS.exportFile(p); } }, "-");
  }
  items.push({ t: "Yeniden adlandır", f: () => renamePath(p) }, { t: "Kopyala", f: () => duplicate(p, dir) },
    { t: "Sil", danger: true, f: () => removePath(p, dir) });
  popup($("#sheet"), items, p);
}
async function newFile(dir = selDir) {
  const n = await ask(`Yeni dosya${dir ? " — " + dir + "/" : ""}`, "yeni.js", { note: "Alt klasör için: klasor/dosya.js" });
  if (!n) return;
  if (!validName(n)) return FS.toast("Geçersiz ad");
  const p = join(dir, n);
  if (FS.exists(p)) return FS.toast("Bu dosya zaten var");
  if (res(FS.write(p, ""))) {
    let d = dirOf(p);
    while (d) { expanded.add(d); d = dirOf(d); }
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
  if (!validName(n) || n.includes("/")) return FS.toast("Geçersiz ad");
  saveAll();
  const to = join(dirOf(p), n);
  if (!res(FS.rename(p, to))) return;
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
function duplicate(p, dir) {
  if (dir) return FS.toast("Klasör kopyalama yok, dosyaları tek tek kopyala");
  saveFile(p);
  const e = ext(p), stem = e ? base(p).slice(0, -(e.length + 1)) : base(p);
  let i = 1, np;
  do { np = join(dirOf(p), `${stem}-kopya${i > 1 ? i : ""}${e ? "." + e : ""}`); i++; } while (FS.exists(np));
  if (res(FS.write(np, FS.read(p)))) { renderTree(); FS.toast("Kopyalandı: " + base(np)); }
}
async function removePath(p, dir) {
  const okd = await confirmBox(`"${base(p)}" ${dir ? "klasörü ve içindekiler" : ""} silinsin mi?`, "Sil");
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
  if (open) refreshPanel();
  if (editor) setTimeout(() => editor.layout(), 220);
}
function showPanel(v) {
  view = v;
  $$("#ptabs button[data-v]").forEach((b) => b.classList.toggle("on", b.dataset.v === v));
  $("#vFiles").classList.toggle("hidden", v !== "files");
  $("#vSearch").classList.toggle("hidden", v !== "search");
  $("#vGit").classList.toggle("hidden", v !== "git");
  $("#vPlugins").classList.toggle("hidden", v !== "plugins");
  if (!$("#explorer").classList.contains("open")) toggleExplorer(true); else refreshPanel();
}
function refreshPanel() {
  if (view === "files") renderTree();
  else if (view === "git") renderGit();
  else if (view === "plugins") renderPlugins();
  else if (view === "search") setTimeout(() => $("#qFind").focus(), 60);
}
$("#ptabs").addEventListener("click", (e) => { const b = e.target.closest("button[data-v]"); if (b) showPanel(b.dataset.v); });

// ================= YENİ PROJE (şablonlar) =================
const TEMPLATES = {
  web: {
    name: "Web sitesi (HTML/CSS/JS)",
    files: {
      "index.html": '<!DOCTYPE html>\n<html lang="tr">\n<head>\n  <meta charset="utf-8">\n  <meta name="viewport" content="width=device-width, initial-scale=1">\n  <title>Yeni Site</title>\n  <link rel="stylesheet" href="style.css">\n</head>\n<body>\n  <main>\n    <h1>Merhaba 👋</h1>\n    <p>Düzenle ve ▶ ile çalıştır.</p>\n  </main>\n  <script src="app.js"></script>\n</body>\n</html>\n',
      "style.css": "body {\n  margin: 0;\n  font-family: system-ui, sans-serif;\n  background: #f5f7fb;\n  color: #1f2937;\n}\nmain {\n  max-width: 640px;\n  margin: 40px auto;\n  padding: 0 16px;\n}\n",
      "app.js": 'console.log("Site hazır!");\n',
    },
    open: "index.html",
  },
  python: {
    name: "Python",
    files: {
      "main.py": 'from yardimci import selamla\n\n\ndef main():\n    ad = input("Adın ne? ")\n    print(selamla(ad))\n    for i in range(1, 6):\n        print(i, "x", i, "=", i * i)\n\n\nif __name__ == "__main__":\n    main()\n',
      "yardimci.py": 'def selamla(ad):\n    return f"Merhaba {ad or \'dünya\'}!"\n',
    },
    open: "main.py",
  },
  android: {
    name: "Android uygulaması (Kotlin)",
    note: "APK, GitHub Actions'ta derlenir. Gönder'den sonra 🔀 GitHub panelinden indirip kurabilirsin.",
    files: (name, pkg) => ({
      "settings.gradle.kts": 'pluginManagement { repositories { google(); mavenCentral(); gradlePluginPortal() } }\ndependencyResolutionManagement {\n    repositoriesMode.set(RepositoriesMode.FAIL_ON_PROJECT_REPOS)\n    repositories { google(); mavenCentral() }\n}\nrootProject.name = "' + name + '"\ninclude(":app")\n',
      "build.gradle.kts": 'plugins {\n    id("com.android.application") version "8.5.2" apply false\n    id("org.jetbrains.kotlin.android") version "1.9.24" apply false\n}\n',
      "gradle.properties": "org.gradle.jvmargs=-Xmx2g\nandroid.useAndroidX=true\nkotlin.code.style=official\n",
      ".gitignore": ".gradle/\nbuild/\nlocal.properties\n",
      "app/build.gradle.kts": 'plugins {\n    id("com.android.application")\n    id("org.jetbrains.kotlin.android")\n}\n\nandroid {\n    namespace = "' + pkg + '"\n    compileSdk = 34\n\n    defaultConfig {\n        applicationId = "' + pkg + '"\n        minSdk = 24\n        targetSdk = 34\n        versionCode = 1\n        versionName = "1.0"\n    }\n    compileOptions {\n        sourceCompatibility = JavaVersion.VERSION_17\n        targetCompatibility = JavaVersion.VERSION_17\n    }\n    kotlinOptions { jvmTarget = "17" }\n}\n',
      "app/src/main/AndroidManifest.xml": '<?xml version="1.0" encoding="utf-8"?>\n<manifest xmlns:android="http://schemas.android.com/apk/res/android">\n    <application\n        android:label="' + name + '"\n        android:icon="@android:drawable/sym_def_app_icon"\n        android:theme="@android:style/Theme.Material.Light.NoActionBar">\n        <activity android:name=".MainActivity" android:exported="true">\n            <intent-filter>\n                <action android:name="android.intent.action.MAIN" />\n                <category android:name="android.intent.category.LAUNCHER" />\n            </intent-filter>\n        </activity>\n    </application>\n</manifest>\n',
      ["app/src/main/java/" + pkg.replace(/\./g, "/") + "/MainActivity.kt"]: "package " + pkg + "\n\nimport android.app.Activity\nimport android.graphics.Color\nimport android.os.Bundle\nimport android.view.Gravity\nimport android.widget.Button\nimport android.widget.LinearLayout\nimport android.widget.TextView\n\nclass MainActivity : Activity() {\n    private var sayac = 0\n\n    override fun onCreate(savedInstanceState: Bundle?) {\n        super.onCreate(savedInstanceState)\n\n        val yazi = TextView(this).apply {\n            text = \"Merhaba! Kod Editör'de yapıldı 🚀\"\n            textSize = 22f\n            gravity = Gravity.CENTER\n        }\n        val dugme = Button(this).apply {\n            text = \"Tıkla\"\n            setOnClickListener {\n                sayac++\n                yazi.text = \"$sayac kez tıklandı\"\n            }\n        }\n        val kok = LinearLayout(this).apply {\n            orientation = LinearLayout.VERTICAL\n            gravity = Gravity.CENTER\n            setBackgroundColor(Color.parseColor(\"#F5F7FB\"))\n            addView(yazi)\n            addView(dugme)\n        }\n        setContentView(kok)\n    }\n}\n",
      ".github/workflows/build.yml": "name: APK derle\n\non:\n  push:\n    branches: [main]\n  workflow_dispatch:\n\njobs:\n  build:\n    runs-on: ubuntu-latest\n    steps:\n      - uses: actions/checkout@v4\n      - uses: actions/setup-java@v4\n        with:\n          distribution: temurin\n          java-version: \"17\"\n      - uses: gradle/actions/setup-gradle@v4\n        with:\n          gradle-version: \"8.9\"\n      - run: gradle assembleDebug --no-daemon\n      - uses: actions/upload-artifact@v4\n        with:\n          name: apk\n          path: app/build/outputs/apk/debug/app-debug.apk\n",
      "README.md": "# " + name + "\n\nKod Editör ile telefonda yazıldı.\n\n1. 🔀 GitHub panelinden bu klasörü bir repoya bağla\n2. **Gönder**'e bas, GitHub Actions APK'yı derler\n3. **Derleme durumu** bölümünden APK'yı indir ve kur\n",
    }),
    open: (pkg) => "app/src/main/java/" + pkg.replace(/\./g, "/") + "/MainActivity.kt",
  },
  plugin: {
    name: "Eklenti (Kod Editör için)",
    files: { "ornek-eklenti.js": null }, // aşağıda pluginTemplate ile doldurulur
    open: "ornek-eklenti.js",
  },
};
function newProject() {
  popup($("#sheet"), Object.entries(TEMPLATES).map(([id, t]) => ({ t: t.name, f: () => createProject(id) })), "Yeni proje şablonu");
}
async function createProject(id) {
  const t = TEMPLATES[id];
  if (id === "plugin") {
    const p = "eklentiler/ornek-eklenti.js";
    if (!FS.exists(p)) FS.write(p, PLUGIN_TEMPLATE);
    expanded.add("eklentiler"); renderTree(); openFile(p);
    FS.toast("Eklentiyi düzenle, sonra 🧩 panelinden aç");
    return;
  }
  let name = await ask("Proje adı", id === "android" ? "BenimUygulamam" : id === "python" ? "python-proje" : "web-proje",
    { note: t.note || "" });
  if (!name) return;
  name = name.replace(/\s+/g, "-");
  if (!validName(name) || name.includes("/")) return FS.toast("Geçersiz ad");
  if (FS.exists(name)) return FS.toast("Bu adda bir klasör var");
  let files = t.files, openP = t.open;
  if (id === "android") {
    const suffix = name.toLowerCase().replace(/[^a-z0-9]/g, "").replace(/^(\d)/, "a$1");
    const pkg = "com.kodeditor." + (suffix || "uygulama");
    files = t.files(name.replace(/[^\w ]/g, ""), pkg);
    openP = t.open(pkg);
  }
  for (const [p, c] of Object.entries(files)) FS.write(join(name, p), c);
  expanded.add(name);
  let d = dirOf(join(name, openP));
  while (d) { expanded.add(d); d = dirOf(d); }
  store.set("expanded", [...expanded]);
  selDir = name;
  renderTree();
  openFile(join(name, openP));
  if (innerWidth < 900) toggleExplorer(false);
  FS.toast(`"${name}" oluşturuldu`);
}

// ================= SEKMELER / EDİTÖR =================
function persistTabs() { store.set("tabs", tabs); store.set("active", active); }
function isDirty(p) { const m = models.get(p); return !!m && savedVer.get(p) !== m.getAlternativeVersionId(); }
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
  m.updateOptions({ tabSize: S.tabSize, insertSpaces: true });
  savedVer.set(p, m.getAlternativeVersionId());
  m.onDidChangeContent(() => {
    renderDirty(p);
    clearTimeout(timers.get(p));
    if (S.autosave > 0) timers.set(p, setTimeout(() => saveFile(p), S.autosave));
  });
  models.set(p, m);
  return m;
}
function renderDirty(p) {
  const t = $$("#tabs .tab").find((el) => el.dataset.p === p);
  if (t) t.classList.toggle("dirty", isDirty(p));
  if (p === active) $("#sSave").textContent = isDirty(p) ? "● Kaydedilmedi" : "✓";
}
function openFile(p, line, col, len) {
  if (!editor) return;
  if (BINARY.test(p)) return FS.toast("Bu dosya türü metin olarak açılamaz");
  if (!FS.exists(p)) { closeTab(p, true); return; }
  if (active && active !== p && editor.getModel()) store.set("view." + active, editor.saveViewState());
  if (!tabs.includes(p)) tabs.push(p);
  active = p;
  editor.setModel(getModel(p));
  const vs = store.get("view." + p, null);
  if (vs && !line) editor.restoreViewState(vs);
  if (line) {
    const r = { startLineNumber: line, startColumn: col || 1, endLineNumber: line, endColumn: (col || 1) + (len || 0) };
    editor.setSelection(r);
    editor.revealRangeInCenter(r);
  }
  persistTabs(); renderTabs();
  if (view === "files" && $("#explorer").classList.contains("open")) renderTree();
  $("#sPath").textContent = p;
  $("#sLang").textContent = langOf(p);
  renderDirty(p);
  updatePos();
  editor.focus();
  for (const h of hooks.open) try { h(p); } catch (e) { console.error(e); }
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
  if (editor && active && editor.getModel()) store.set("view." + active, editor.saveViewState());
};
function updatePos() {
  if (!editor || !active) return;
  const pos = editor.getPosition();
  if (pos) $("#sPos").textContent = `${pos.lineNumber}:${pos.column}`;
}
const readLive = (p) => (models.has(p) ? models.get(p).getValue() : FS.read(p));

// ================= PROJEDE ARA =================
const sOpt = store.get("searchOpt", { case: false, word: false, regex: false });
function syncToggles() {
  $("#tCase").classList.toggle("on", sOpt.case);
  $("#tWord").classList.toggle("on", sOpt.word);
  $("#tRegex").classList.toggle("on", sOpt.regex);
  store.set("searchOpt", sOpt);
}
[["#tCase", "case"], ["#tWord", "word"], ["#tRegex", "regex"]].forEach(([id, k]) =>
  $(id).addEventListener("click", () => { sOpt[k] = !sOpt[k]; syncToggles(); doSearch(); }));
let searchTimer = null, lastResults = [];
$("#qFind").addEventListener("input", () => { clearTimeout(searchTimer); searchTimer = setTimeout(doSearch, 450); });
$("#qFind").addEventListener("keydown", (e) => { if (e.key === "Enter") { clearTimeout(searchTimer); doSearch(); } });
$("#qScope").addEventListener("change", doSearch);
function searchFolder() { return $("#qScope").checked ? (projectOf(active) || selDir.split("/")[0] || "") : ""; }
async function doSearch() {
  const q = $("#qFind").value;
  if (!q) { $("#sResults").innerHTML = ""; $("#sCount").textContent = ""; lastResults = []; return; }
  saveAll();
  $("#sCount").innerHTML = '<span class="spin">◌</span>';
  try {
    const r = NATIVE ? await native("search", { q, ...sOpt, folder: searchFolder() }) : { results: jsSearch(q), truncated: false };
    lastResults = r.results;
    renderResults(r);
  } catch (e) {
    $("#sCount").textContent = "";
    $("#sResults").innerHTML = `<div class="hint" style="padding:10px">${esc(e.message)}</div>`;
  }
}
function jsSearch(q) { // tarayıcı yedeği
  const rx = makeRegex(q, false); const out = [];
  for (const { p, d } of listAll()) if (!d) readLive(p).split("\n").forEach((t, i) => {
    let m; rx.lastIndex = 0;
    while ((m = rx.exec(t)) && m[0]) out.push({ p, l: i + 1, c: m.index + 1, n: m[0].length, t });
  });
  return out;
}
function makeRegex(q, forReplace) {
  let src = sOpt.regex ? q : q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  if (sOpt.word) src = "\\b(?:" + src + ")\\b";
  return new RegExp(src, "g" + (sOpt.case ? "" : "i") + (forReplace ? "m" : ""));
}
function renderResults(r) {
  const byFile = new Map();
  for (const x of r.results) { if (!byFile.has(x.p)) byFile.set(x.p, []); byFile.get(x.p).push(x); }
  $("#sCount").textContent = r.results.length ? `${r.results.length}${r.truncated ? "+" : ""} sonuç, ${byFile.size} dosya` : "Sonuç yok";
  const html = [];
  for (const [p, list] of byFile) {
    html.push(`<div class="sf"><span>${ICON[ext(p)] || "📄"} ${esc(base(p))}</span><small>${esc(dirOf(p))} · ${list.length}</small></div>`);
    for (const x of list.slice(0, 200)) {
      const start = Math.max(0, x.c - 1 - 30);
      const pre = (start > 0 ? "…" : "") + x.t.slice(start, x.c - 1).trimStart();
      html.push(`<div class="sr" data-p="${esc(p)}" data-l="${x.l}" data-c="${x.c}" data-n="${x.n}"><b>${x.l}</b>${esc(pre)}<mark>${esc(x.t.substr(x.c - 1, x.n))}</mark>${esc(x.t.slice(x.c - 1 + x.n, x.c - 1 + x.n + 120))}</div>`);
    }
  }
  $("#sResults").innerHTML = html.join("");
}
$("#sResults").addEventListener("click", (e) => {
  const r = e.target.closest(".sr");
  if (!r) return;
  openFile(r.dataset.p, +r.dataset.l, +r.dataset.c, +r.dataset.n);
  if (innerWidth < 900) toggleExplorer(false);
});
$("#bReplAll").addEventListener("click", async () => {
  const q = $("#qFind").value, rep = $("#qRepl").value;
  if (!q || !lastResults.length) return FS.toast("Önce arama yap");
  const files = [...new Set(lastResults.map((x) => x.p))];
  if (!(await confirmBox(`${lastResults.length} eşleşme, ${files.length} dosyada "${rep}" ile değiştirilsin mi?`, "Değiştir"))) return;
  let rx;
  try { rx = makeRegex(q, true); } catch (e) { return FS.toast("Geçersiz düzenli ifade"); }
  let n = 0;
  for (const p of files) {
    const old = readLive(p);
    const neu = old.replace(rx, (...a) => { n++; return sOpt.regex ? a[0].replace(new RegExp(rx.source, rx.flags.replace("g", "")), rep) : rep; });
    if (neu === old) continue;
    const m = models.get(p);
    if (m) m.pushEditOperations([], [{ range: m.getFullModelRange(), text: neu }], () => null);
    else FS.write(p, neu);
  }
  saveAll();
  FS.toast(`${n} yer değiştirildi`);
  doSearch();
});

// ================= GITHUB =================
let gitLogin = null, runTimer = null;
const gitBusy = new Set();
async function loadLinked() {
  if (!NATIVE || !FS.gitHasToken()) { gitFolders = new Set(); return []; }
  try {
    const r = await native("linked");
    gitFolders = new Set(r.items.map((x) => x.folder));
    return r.items;
  } catch (e) { return []; }
}
function gitTarget() { return projectOf(active) || (selDir ? selDir.split("/")[0] : ""); }
async function renderGit() {
  const el = $("#gitBody");
  clearTimeout(runTimer);
  if (!NATIVE) { el.innerHTML = '<p class="hint">GitHub özellikleri yalnızca uygulamada çalışır.</p>'; return; }
  if (!FS.gitHasToken()) {
    el.innerHTML = `<div class="card"><h4>GitHub'a bağlan</h4>
      <p>Bir <b>Personal access token</b> gerekiyor. Tarayıcıda <a href="https://github.com/settings/tokens/new?scopes=repo,workflow&description=Kod%20Edit%C3%B6r">github.com/settings/tokens</a> sayfasını aç, <b>repo</b> ve <b>workflow</b> izinlerini seç, token'ı kopyala.</p>
      <div class="btns"><button class="btn" data-a="token">Token'ı yapıştır</button></div>
      <p>Token yalnızca bu telefonda, uygulamanın kendi alanında saklanır.</p></div>`;
    return;
  }
  el.innerHTML = '<p class="hint"><span class="spin">◌</span> Yükleniyor…</p>';
  try {
    if (!gitLogin) gitLogin = (await native("me")).login;
  } catch (e) {
    el.innerHTML = `<div class="card"><h4>Bağlanılamadı</h4><p>${esc(e.message)}</p>
      <div class="btns"><button class="btn" data-a="retry">Tekrar dene</button><button class="btn ghost" data-a="token">Token'ı değiştir</button></div></div>`;
    return;
  }
  const linked = await loadLinked();
  const target = gitTarget();
  const link = linked.find((x) => x.folder === target);
  let html = `<div class="card"><h4><span>👤 ${esc(gitLogin)}</span><button class="btn ghost" data-a="logout" style="padding:3px 8px">Çıkış</button></h4>
    <div class="btns"><button class="btn" data-a="clone">⤓ Repo indir (clone)</button></div></div>`;
  if (target && link) {
    html += `<div class="card" id="gitCard"><h4><span>📁 ${esc(target)}</span><small style="color:var(--dim)">${esc(link.repo)} · ${esc(link.branch)}</small></h4>
      <div id="gitStatus" class="hint"><span class="spin">◌</span> Değişiklikler kontrol ediliyor…</div></div>
      <div class="card" id="runCard"><h4>🔨 GitHub Actions derlemesi</h4><div id="runBody" class="hint"><span class="spin">◌</span></div></div>`;
  } else if (target) {
    html += `<div class="card"><h4>📁 ${esc(target)}</h4><p>Bu proje henüz GitHub'a bağlı değil.</p>
      <div class="btns"><button class="btn" data-a="linkNew">Yeni repo oluştur</button><button class="btn ghost" data-a="linkExisting">Var olan repoya bağla</button></div></div>`;
  } else {
    html += '<p class="hint">Bir proje klasöründeki dosyayı aç ya da gezginde klasör seç.</p>';
  }
  const others = linked.filter((x) => x.folder !== target);
  if (others.length) {
    html += '<div class="sgroup" style="padding-left:0">BAĞLI DİĞER PROJELER</div>' + others.map((x) =>
      `<div class="node" data-a="switch" data-f="${esc(x.folder)}"><span class="ic">🔀</span><span class="nm">${esc(x.folder)} <small style="color:var(--dim)">${esc(x.repo)}</small></span></div>`).join("");
  }
  el.innerHTML = html;
  if (target && link) { loadStatus(target); loadRuns(target); }
}
async function loadStatus(folder) {
  saveAll();
  const box = $("#gitStatus");
  try {
    const s = await native("status", { folder });
    if (!$("#gitStatus")) return;
    const list = [...s.added.map((p) => ["A", p]), ...s.modified.map((p) => ["M", p]), ...s.deleted.map((p) => ["D", p])];
    const badge = $("#gitBadge");
    badge.textContent = list.length; badge.classList.toggle("hidden", !list.length);
    box.innerHTML = (list.length
      ? `<p>${list.length} değişiklik:</p><div class="chg">${list.slice(0, 60).map(([k, p]) => `<div class="${k}">${k} ${esc(p)}</div>`).join("")}${list.length > 60 ? "<div>…</div>" : ""}</div>
         <input class="field" id="commitMsg" placeholder="Açıklama (ne değişti?)" style="width:100%;margin-top:8px">`
      : `<p>✓ Değişiklik yok · son commit ${esc(s.head || "—")}</p>`) +
      `<div class="btns">${list.length ? '<button class="btn" data-a="push">⬆ Gönder (commit + push)</button>' : ""}
        <button class="btn ghost" data-a="pull">⬇ Çek</button><button class="btn ghost" data-a="refresh">⟳</button>
        <button class="btn ghost" data-a="unlink">Bağlantıyı kaldır</button></div>`;
  } catch (e) { if (box) box.innerHTML = `<p>${esc(e.message)}</p>`; }
}
const STEP_IC = { success: "✅", failure: "❌", cancelled: "⛔", skipped: "⏭" };
async function loadRuns(folder, manual) {
  clearTimeout(runTimer);
  const body = $("#runBody");
  if (!body) return;
  try {
    const { run } = await native("runs", { folder });
    if (!$("#runBody")) return;
    if (!run) {
      body.innerHTML = `<p>Bu repoda henüz derleme yok. Android şablonuyla oluşturulan projelerde Gönder'e basınca derleme başlar.</p>`;
      return;
    }
    const going = run.status !== "completed";
    const head = going ? '<span class="spin">◌</span> Derleniyor…' : (run.conclusion === "success" ? "✅ Başarılı" : "❌ " + (run.conclusion || run.status));
    const steps = run.steps.filter((s) => !/^(Set up job|Complete job|Post )/.test(s.name)).map((s) =>
      `<div>${s.status === "completed" ? (STEP_IC[s.conclusion] || "•") : s.status === "in_progress" ? '<span class="spin">◌</span>' : "○"} ${esc(s.name)}</div>`).join("");
    const apks = run.artifacts.map((a) => `<button class="btn" data-a="apk" data-id="${a.id}">📲 ${esc(a.name)} indir ve kur (${(a.size / 1048576).toFixed(1)} MB)</button>`).join("");
    body.innerHTML = `<p><b>${head}</b> · ${esc(run.title || run.name)} (${esc(run.sha)})${run.current ? "" : " · eski commit"}</p>
      <div class="steps">${steps}</div>
      <div class="btns">${apks}<button class="btn ghost" data-a="runs">⟳ Yenile</button><button class="btn ghost" data-a="dispatch">▶ Yeniden derle</button>
      <a class="btn ghost" href="${esc(run.url)}" style="text-decoration:none">GitHub'da aç</a></div>`;
    if (going && view === "git") runTimer = setTimeout(() => loadRuns(folder), 8000);
  } catch (e) {
    body.innerHTML = `<p>${esc(e.message)}</p><div class="btns"><button class="btn ghost" data-a="runs">⟳ Yenile</button></div>`;
  }
}
async function gitAction(a, btn) {
  const target = gitTarget();
  const busy = async (label, fn) => {
    if (gitBusy.has(a)) return;
    gitBusy.add(a);
    const old = btn ? btn.innerHTML : "";
    if (btn) { btn.disabled = true; btn.innerHTML = `<span class="spin">◌</span> ${label}`; }
    try { return await fn(); } catch (e) { FS.toast(e.message); } finally {
      gitBusy.delete(a);
      if (btn && document.body.contains(btn)) { btn.disabled = false; btn.innerHTML = old; }
    }
  };
  switch (a) {
    case "token": {
      const t = await ask("GitHub token", "", { password: true, note: "ghp_… ya da github_pat_… ile başlar" });
      if (t) { FS.gitSetToken(t); gitLogin = null; renderGit(); }
      break;
    }
    case "logout":
      if (await confirmBox("GitHub token'ı bu telefondan silinsin mi?", "Sil")) { FS.gitSetToken(""); gitLogin = null; renderGit(); }
      break;
    case "retry": gitLogin = null; renderGit(); break;
    case "refresh": loadStatus(target); break;
    case "runs": loadRuns(target, true); break;
    case "switch": break;
    case "clone": return busy("Repolar alınıyor", async () => {
      const r = await native("repos");
      const items = r.items.map((x) => ({ t: (x.private ? "🔒 " : "") + x.name, f: () => doClone(x.name) }));
      items.unshift({ t: "✏ Repo adını yaz (kullanıcı/repo)…", f: async () => { const n = await ask("Repo", "kullanici/repo"); if (n) doClone(n); } });
      popup($("#sheet"), items, "Hangi repo indirilsin?");
    });
    case "linkNew": case "linkExisting": {
      const create = a === "linkNew";
      const name = await ask(create ? "Yeni repo adı" : "Repo (kullanıcı/repo)", create ? target : `${gitLogin}/${target}`);
      if (!name) return;
      let priv = true;
      if (create) priv = await confirmBox("Repo gizli (private) olsun mu?", "Gizli", "Hayır dersen herkese açık olur.");
      return busy("Bağlanıyor", async () => {
        const r = await native("link", { folder: target, repo: name, create, private: priv });
        FS.toast(`${r.repo} bağlandı${r.downloaded ? `, ${r.downloaded} dosya indirildi` : ""}`);
        renderTree(); renderGit();
      });
    }
    case "unlink":
      if (await confirmBox(`"${target}" GitHub bağlantısı kaldırılsın mı?`, "Kaldır", "Dosyaların silinmez.")) {
        await native("unlink", { folder: target }).catch((e) => FS.toast(e.message));
        renderGit();
      }
      break;
    case "push": return busy("Gönderiliyor", async () => {
      saveAll();
      const msg = ($("#commitMsg") && $("#commitMsg").value.trim()) || "Kod Editör'den güncelleme";
      const r = await native("push", { folder: target, message: msg });
      FS.toast(`✓ ${r.count} değişiklik gönderildi (${r.commit})`);
      loadStatus(target);
      setTimeout(() => loadRuns(target), 4000);
    });
    case "pull": return busy("Çekiliyor", async () => {
      saveAll();
      const r = await native("pull", { folder: target });
      FS.toast(r.msg);
      // açık sekmeleri diskten yenile
      for (const p of [...tabs]) if (p.startsWith(target + "/")) {
        const m = models.get(p);
        if (!FS.exists(p)) closeTab(p, true);
        else if (m) { m.setValue(FS.read(p)); savedVer.set(p, m.getAlternativeVersionId()); renderDirty(p); }
      }
      renderTree(); loadStatus(target);
    });
    case "dispatch": return busy("Başlatılıyor", async () => {
      await native("dispatch", { folder: target });
      FS.toast("Derleme başlatıldı");
      setTimeout(() => loadRuns(target), 3000);
    });
    case "apk": return busy("APK indiriliyor", async () => {
      const r = await native("apk", { folder: target, id: +btn.dataset.id });
      FS.installApk(r.path);
    });
  }
}
async function doClone(repo) {
  const folder = await ask("Hangi klasöre indirilsin?", repo.split("/").pop());
  if (!folder) return;
  if (!validName(folder) || folder.includes("/")) return FS.toast("Geçersiz klasör adı");
  FS.toast("İndiriliyor…");
  try {
    const r = await native("clone", { repo, folder, branch: "" });
    FS.toast(r.empty ? "Repo boş, klasör hazır" : `✓ ${r.count} dosya indirildi`);
    expanded.add(folder); selDir = folder; store.set("expanded", [...expanded]);
    await loadLinked(); renderTree();
    const readme = listAll().find((e) => !e.d && e.p.toLowerCase() === (folder + "/readme.md").toLowerCase());
    if (readme) openFile(readme.p);
    renderGit();
  } catch (e) { FS.toast(e.message); }
}
$("#gitBody").addEventListener("click", (e) => {
  const b = e.target.closest("[data-a]");
  if (!b) return;
  if (b.dataset.a === "switch") {
    selDir = b.dataset.f;
    const first = tabs.find((p) => projectOf(p) === selDir);
    if (first) openFile(first); else { active = null; renderTabs(); editor && editor.setModel(null); }
    renderGit();
    return;
  }
  gitAction(b.dataset.a, b.tagName === "BUTTON" ? b : null);
});

// ================= EKLENTİLER =================
const hooks = { open: [] };
const pluginCmds = [];
const statusItems = new Map();
const loadedPlugins = new Set();
let enabledPlugins = new Set(store.get("plugins", ["snippets", "wordcount", "texttools"]));
const API = {
  version: "1.1",
  get monaco() { return window.monaco; },
  get editor() { return editor; },
  get activeFile() { return active; },
  fs: {
    read: (p) => readLive(p), exists: (p) => FS.exists(p), list: () => listAll(),
    write: (p, c) => { const m = models.get(p); if (m) { m.setValue(c); return true; } return res(FS.write(p, c)); },
  },
  toast: (m) => FS.toast(String(m)),
  ask: (title, value) => ask(title, value || ""),
  addCommand(id, title, run) {
    pluginCmds.push({ id, title, run });
    if (editor) editor.addAction({ id: "plugin." + id, label: "🧩 " + title, run: () => run() });
  },
  setStatus(id, text) { if (text) statusItems.set(id, text); else statusItems.delete(id); $("#sPlug").textContent = [...statusItems.values()].join("  "); },
  onFileOpen(fn) { hooks.open.push(fn); },
  addSnippets(lang, list) {
    const langs = Array.isArray(lang) ? lang : [lang];
    for (const l of langs) monaco.languages.registerCompletionItemProvider(l, {
      provideCompletionItems(model, pos) {
        const w = model.getWordUntilPosition(pos);
        const range = { startLineNumber: pos.lineNumber, endLineNumber: pos.lineNumber, startColumn: w.startColumn, endColumn: w.endColumn };
        return { suggestions: list.map((s) => ({ label: s.label, kind: monaco.languages.CompletionItemKind.Snippet, insertText: s.body,
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet, documentation: s.doc || "", detail: s.detail || "Kod parçacığı", range })) };
      },
    });
  },
  selection() { const m = editor && editor.getModel(); return m ? m.getValueInRange(editor.getSelection()) : ""; },
  replaceSelection(text) { editor.executeEdits("plugin", [{ range: editor.getSelection(), text, forceMoveMarkers: true }]); editor.focus(); },
  insert(text) { API.replaceSelection(text); },
};
window.KodEditor = API;
const PLUGIN_TEMPLATE = `// @name Örnek eklenti
// @desc Komut paletine ve ⋮ menüsüne komut ekler
// Kod Editör eklenti API'si: KodEditor.addCommand, addSnippets, setStatus, onFileOpen,
// fs.read/write/list, selection(), replaceSelection(), toast(), monaco, editor

KodEditor.addCommand("tarih-ekle", "Bugünün tarihini ekle", () => {
  KodEditor.insert(new Date().toLocaleDateString("tr-TR"));
});

KodEditor.addSnippets("javascript", [
  { label: "merhaba", body: "console.log(\\"Merhaba \${1:dünya}\\");", doc: "Örnek parçacık" },
]);

KodEditor.onFileOpen((yol) => KodEditor.setStatus("ornek", "📄 " + yol.split("/").pop()));
`;
let builtinPlugins = [];
async function loadBuiltinIndex() {
  try { builtinPlugins = await (await fetch("plugins/index.json")).json(); } catch (e) { builtinPlugins = []; }
}
function userPlugins() {
  return listAll().filter((e) => !e.d && /^eklentiler\/[^/]+\.js$/.test(e.p)).map((e) => {
    const src = FS.read(e.p);
    const name = (/\/\/\s*@name\s+(.+)/.exec(src) || [])[1] || base(e.p);
    const desc = (/\/\/\s*@desc\s+(.+)/.exec(src) || [])[1] || e.p;
    return { id: "user:" + e.p, name: name.trim(), desc: desc.trim(), path: e.p };
  });
}
async function loadPlugin(id) {
  if (loadedPlugins.has(id)) return;
  let src;
  try {
    if (id.startsWith("user:")) src = FS.read(id.slice(5));
    else {
      const meta = builtinPlugins.find((p) => p.id === id);
      if (!meta) return;
      src = await (await fetch("plugins/" + meta.file)).text();
    }
    new Function("KodEditor", src + "\n//# sourceURL=" + id)(API);
    loadedPlugins.add(id);
  } catch (e) {
    FS.toast(`Eklenti hatası (${id}): ${e.message}`);
  }
}
function renderPlugins() {
  const all = [...builtinPlugins.map((p) => ({ ...p, builtin: true })), ...userPlugins()];
  $("#plBody").innerHTML = `<p class="hint">Eklentiler komut, kod parçacığı ve durum çubuğu öğesi ekler. Kendi eklentini <b>eklentiler/</b> klasörüne .js olarak yazabilirsin.</p>` +
    all.map((p) => `<div class="card plug"><div class="t"><b>${esc(p.name)}</b>${p.builtin ? "" : ' <small style="color:var(--dim)">(senin)</small>'}<p>${esc(p.desc)}</p></div>
      <label class="switch"><input type="checkbox" data-id="${esc(p.id)}" ${enabledPlugins.has(p.id) ? "checked" : ""}><span></span></label></div>`).join("") +
    `<div class="btns"><button class="btn" id="bNewPlugin">＋ Yeni eklenti yaz</button>${pluginCmds.length ? '<button class="btn ghost" id="bPluginCmds">Eklenti komutları</button>' : ""}</div>`;
}
$("#plBody").addEventListener("change", async (e) => {
  const id = e.target.dataset.id;
  if (!id) return;
  if (e.target.checked) {
    enabledPlugins.add(id); store.set("plugins", [...enabledPlugins]);
    await loadPlugin(id);
    FS.toast("Eklenti açıldı");
    renderPlugins();
  } else {
    enabledPlugins.delete(id); store.set("plugins", [...enabledPlugins]);
    if (loadedPlugins.has(id) && await confirmBox("Eklentiyi kapatmak için editör yeniden yüklenecek. Devam?", "Yeniden yükle")) {
      saveAll(); location.reload();
    }
  }
});
$("#plBody").addEventListener("click", (e) => {
  if (e.target.id === "bNewPlugin") createProject("plugin");
  if (e.target.id === "bPluginCmds") showPluginCmds();
});
function showPluginCmds() {
  if (!pluginCmds.length) return FS.toast("Açık eklentilerin komutu yok");
  popup($("#sheet"), pluginCmds.map((c) => ({ t: c.title, f: () => { editor.focus(); c.run(); } })), "🧩 Eklenti komutları");
}

// ================= AYARLAR =================
const SETTINGS_UI = [
  ["Editör", [
    ["fontSize", "Yazı boyutu", "num", 9, 30],
    ["fontFamily", "Yazı tipi", "sel", { default: "Cascadia / Fira (varsayılan)", roboto: "Roboto Mono", droid: "Droid Sans Mono", courier: "Courier" }],
    ["tabSize", "Sekme genişliği", "sel", { 2: "2 boşluk", 4: "4 boşluk", 8: "8 boşluk" }],
    ["wrap", "Satır kaydırma", "bool"],
    ["lineNumbers", "Satır numaraları", "bool"],
    ["minimap", "Mini harita", "bool"],
    ["ligatures", "Yazı tipi birleşimleri (=> !=)", "bool"],
    ["whitespace", "Boşlukları göster", "bool"],
    ["sticky", "Yapışkan kaydırma", "bool", "Fonksiyon başlığı üstte kalır"],
    ["cursor", "İmleç", "sel", { smooth: "Yumuşak", blink: "Yanıp sönen", phase: "Geçişli", solid: "Sabit" }],
  ]],
  ["Dosyalar", [
    ["autosave", "Otomatik kaydetme", "sel", { 0: "Kapalı", 500: "Hemen (0,5 sn)", 900: "1 saniye sonra", 3000: "3 saniye sonra" }],
  ]],
  ["Arayüz", [
    ["keys", "Ekstra tuş çubuğu", "bool", "Tab, oklar ve semboller"],
  ]],
];
function renderSettings() {
  const themeHtml = '<div class="sgroup">TEMA</div><div class="themes">' + Object.entries(THEMES).map(([id, t]) => {
    const ui = Object.assign({}, UI_DEFAULT, t.ui), p = t.p || { c: "6a9955", s: "ce9178", k: "569cd6", f: "dcdcaa" };
    const c = (x) => (x.startsWith("#") ? x : "#" + x);
    return `<button class="theme${S.theme === id ? " on" : ""}" data-theme="${id}"><div class="pv" style="background:${ui.bg};color:${ui.fg}">
      <span style="color:${c(t.base === "vs" ? "0000ff" : p.k)}">function</span> <span style="color:${c(t.base === "vs" ? "795e26" : p.f)}">selam</span>() {<br>
      &nbsp;<span style="color:${c(t.base === "vs" ? "a31515" : p.s)}">"merhaba"</span> <span style="color:${c(t.base === "vs" ? "008000" : p.c)}">// not</span><br>}</div>
      <div class="nm" style="background:${ui.acc}">${esc(t.name)}</div></button>`;
  }).join("") + "</div>";
  const rows = SETTINGS_UI.map(([g, list]) => `<div class="sgroup">${esc(g.toUpperCase())}</div>` + list.map(([k, label, type, a, b]) => {
    let ctl;
    if (type === "bool") ctl = `<label class="switch"><input type="checkbox" data-k="${k}" ${S[k] ? "checked" : ""}><span></span></label>`;
    else if (type === "num") ctl = `<input type="number" data-k="${k}" min="${a}" max="${b}" value="${S[k]}">`;
    else ctl = `<select data-k="${k}">${Object.entries(a).map(([v, t]) => `<option value="${v}" ${String(S[k]) === v ? "selected" : ""}>${esc(t)}</option>`).join("")}</select>`;
    const hint = type === "bool" && typeof a === "string" ? `<small>${esc(a)}</small>` : "";
    return `<div class="srowset"><div class="t"><div>${esc(label)}</div>${hint}</div>${ctl}</div>`;
  }).join("")).join("");
  $("#setBody").innerHTML = themeHtml + rows +
    `<div class="sgroup">HAKKINDA</div><div class="srowset"><div class="t"><div>Kod Editör 1.1</div><small>Monaco Editor · github.com/Enskygr234/kod-editor</small></div>
     <button class="btn ghost" id="bResetSet">Sıfırla</button></div>`;
}
$("#setBody").addEventListener("click", (e) => {
  const t = e.target.closest("[data-theme]");
  if (t) { S.theme = t.dataset.theme; saveSettings(); renderSettings(); }
  if (e.target.id === "bResetSet") { Object.assign(S, DEFAULTS); saveSettings(); renderSettings(); FS.toast("Ayarlar sıfırlandı"); }
});
$("#setBody").addEventListener("change", (e) => {
  const k = e.target.dataset.k;
  if (!k) return;
  const def = DEFAULTS[k];
  if (typeof def === "boolean") S[k] = e.target.checked;
  else if (typeof def === "number") {
    const v = Number(e.target.value);
    const lo = e.target.min ? +e.target.min : 0, hi = e.target.max ? +e.target.max : 1e9;
    S[k] = Number.isFinite(v) ? Math.max(lo, Math.min(hi, v)) : def;
  }
  else S[k] = e.target.value;
  saveSettings();
});
function openSettings() { renderSettings(); $("#settings").classList.remove("hidden"); }
$("#setClose").addEventListener("click", () => { $("#settings").classList.add("hidden"); editor && editor.focus(); });
$("#bSettings").addEventListener("click", openSettings);

// ================= ÇALIŞTIR =================
const CAPTURE = `<script>(function(){
  var send=function(t,a){try{parent.postMessage({__ke:1,t:t,m:[].map.call(a,function(x){
    if(x instanceof Error)return x.stack||String(x);
    if(typeof x==='object'&&x!==null){try{return JSON.stringify(x,null,2)}catch(e){return String(x)}}
    return String(x)}).join(' ')},'*')}catch(e){}};
  ['log','info','warn','error','debug'].forEach(function(k){var o=console[k];console[k]=function(){send(k,arguments);o&&o.apply(console,arguments)}});
  window.__keSend=send;
  window.addEventListener('error',function(e){send('error',[e.message+(e.lineno?' (satır '+e.lineno+')':'')])});
  window.addEventListener('unhandledrejection',function(e){send('error',['Promise: '+(e.reason&&e.reason.message||e.reason)])});
})();<\/script>`;
const safeScript = (s) => s.replace(/<\/script/gi, "<\\/script");
const jsonForScript = (o) => JSON.stringify(o).replace(/</g, "\\u003c").replace(/\u2028/g, "\\u2028").replace(/\u2029/g, "\\u2029");
function resolveRel(fromDir, href) {
  if (/^(https?:|data:|blob:|\/\/)/i.test(href)) return null;
  const parts = fromDir ? fromDir.split("/") : [];
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
const PYODIDE = "https://cdn.jsdelivr.net/pyodide/v0.26.4/full/";
function buildPython(p) {
  const d = dirOf(p);
  const files = {};
  for (const e of listAll()) {
    if (e.d || !(d ? e.p.startsWith(d + "/") : !e.p.includes("/"))) continue;
    const rel = d ? e.p.slice(d.length + 1) : e.p;
    if (/\.(py|txt|csv|json|md)$/i.test(rel) && rel.split("/").length <= 4) files[rel] = readLive(e.p);
  }
  const main = p.slice(d ? d.length + 1 : 0);
  return `<!DOCTYPE html><html><head><meta charset="utf-8">${CAPTURE}<script src="${PYODIDE}pyodide.js"><\/script></head><body><script>
(async function(){
  var FILES=${jsonForScript(files)}, MAIN=${jsonForScript(main)};
  var t0=Date.now();
  console.info("🐍 Python yükleniyor… (ilk seferde internet gerekir, biraz sürebilir)");
  try{
    var py=await loadPyodide({indexURL:${jsonForScript(PYODIDE)}});
    py.setStdout({batched:function(s){console.log(s)}});
    py.setStderr({batched:function(s){console.error(s)}});
    py.setStdin({stdin:function(){var r=prompt("input()");if(r!==null)__keSend('info',['› '+r]);return r===null?null:r+"\\n"}});
    var home="/home/pyodide/proje/";
    for(var k in FILES){var dir=(home+k).split("/").slice(0,-1).join("/");py.FS.mkdirTree(dir);py.FS.writeFile(home+k,FILES[k]);}
    py.FS.chdir(home);
    py.runPython("import sys; sys.path.insert(0, '"+home+"')");
    var code=FILES[MAIN];
    try{await py.loadPackagesFromImports(code,{messageCallback:function(m){console.info(m)}})}catch(e){}
    console.info("▶ "+MAIN+" ("+((Date.now()-t0)/1000).toFixed(1)+" sn)");
    await py.runPythonAsync(code,{filename:MAIN});
    console.info("✓ Bitti");
  }catch(e){
    var m=String(e&&e.message||e);
    if(/Failed to fetch|NetworkError|load/.test(m)&&typeof loadPyodide==="undefined")m="Python indirilemedi. İnternet bağlantını kontrol et.";
    console.error(m);
  }
})();
<\/script></body></html>`;
}
let lastRun = null;
function showPreview(target, mode) {
  const pv = $("#preview");
  pv.classList.remove("hidden", "jsonly", "noconsole");
  if (mode === "console") pv.classList.add("jsonly");
  if (mode === "doc") pv.classList.add("noconsole");
  $("#pTitle").textContent = target;
  $("#clog").innerHTML = "";
}
function run(p = active) {
  if (!p) return FS.toast("Önce bir dosya aç");
  saveAll();
  let target = p;
  if (/\.(css|scss)$/i.test(p)) {
    const idx = join(dirOf(p), "index.html");
    if (FS.exists(idx)) target = idx; else return FS.toast("Bu klasörde index.html yok");
  }
  if (/\.(kt|kts|java|xml|gradle)$/i.test(target)) {
    if (projectOf(target) && gitFolders.has(projectOf(target))) { selDir = projectOf(target); showPanel("git"); return FS.toast("Android projesi: Gönder'e bas, APK GitHub'da derlenir"); }
    return FS.toast("Android projesini derlemek için 🔀 GitHub panelinden repoya bağla");
  }
  lastRun = target;
  if (/\.html?$/i.test(target)) {
    showPreview(target, "html");
    logLine("sys", `▶ ${base(target)} yüklendi`);
    $("#frame").srcdoc = buildHtml(target);
  } else if (/\.m?js$/i.test(target)) {
    showPreview(target, "console");
    logLine("sys", `▶ ${base(target)} çalıştırılıyor`);
    $("#frame").srcdoc = `<!DOCTYPE html><html><head><meta charset="utf-8">${CAPTURE}</head><body><script>\n${safeScript(readLive(target))}\n<\/script></body></html>`;
  } else if (/\.py$/i.test(target)) {
    showPreview(target, "console");
    $("#frame").srcdoc = buildPython(target);
  } else if (/\.md$/i.test(target)) {
    showPreview(target, "doc");
    $("#frame").srcdoc = `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
  <style>body{font:15px/1.6 system-ui;padding:16px 20px;max-width:760px;margin:auto;color:#222}code{background:#f2f2f2;padding:1px 4px;border-radius:3px}
  pre{background:#f2f2f2;padding:10px;overflow:auto;border-radius:6px}h1,h2{border-bottom:1px solid #eee;padding-bottom:4px}</style></head><body>${md(readLive(target))}</body></html>`;
  } else {
    FS.toast("HTML, JS, Python ve Markdown çalıştırılabiliyor");
  }
}
function md(src) {
  const lines = esc(src).split("\n"); let out = "", inCode = false, inList = false;
  const inline = (s) => s.replace(/`([^`]+)`/g, "<code>$1</code>").replace(/\*\*([^*]+)\*\*/g, "<b>$1</b>")
    .replace(/\*([^*]+)\*/g, "<i>$1</i>").replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, '<a href="$2">$1</a>');
  for (const l of lines) {
    if (/^```/.test(l)) { out += inCode ? "</pre>" : "<pre>"; inCode = !inCode; continue; }
    if (inCode) { out += l + "\n"; continue; }
    const li = /^\s*(?:[-*]|\d+\.) (.*)/.exec(l);
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

// ================= EKSTRA TUŞLAR =================
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
    e.preventDefault();
    editor.focus();
    KEYS[+b.dataset.k][1]();
  });
}

// ================= MENÜ =================
function action(id) { const a = editor && editor.getAction(id); if (a) { editor.focus(); a.run(); } }
$("#bMenu").addEventListener("click", () => {
  const m = $("#menu");
  if (!m.classList.contains("hidden")) return closePops();
  popup(m, [
    { t: "Yeni proje…", f: () => newProject() },
    { t: "Yeni dosya", f: () => newFile() },
    { t: "Kaydet", k: "Ctrl+S", f: () => { saveAll(); FS.toast("Kaydedildi"); } },
    { t: "Çalıştır", k: "F5", f: () => run() },
    "-",
    { t: "Bul", k: "Ctrl+F", f: () => action("actions.find") },
    { t: "Bul ve değiştir", k: "Ctrl+H", f: () => action("editor.action.startFindReplaceAction") },
    { t: "Projede ara", k: "Ctrl+⇧F", f: () => showPanel("search") },
    { t: "Satıra git", k: "Ctrl+G", f: () => action("editor.action.gotoLine") },
    { t: "Belgeyi biçimlendir", k: "⇧⌥F", f: () => action("editor.action.formatDocument") },
    { t: "Yorum satırı yap/kaldır", k: "Ctrl+/", f: () => action("editor.action.commentLine") },
    { t: "Komut paleti", k: "F1", f: () => action("editor.action.quickCommand") },
    ...(pluginCmds.length ? [{ t: "🧩 Eklenti komutları", f: showPluginCmds }] : []),
    "-",
    { t: "🔀 GitHub", f: () => showPanel("git") },
    { t: "🧩 Eklentiler", f: () => showPanel("plugins") },
    { t: "⚙ Ayarlar ve temalar", f: openSettings },
    "-",
    { t: "Dosya içe aktar", f: () => FS.importFiles(selDir) },
    ...(active ? [{ t: "Bu dosyayı telefona kaydet", f: () => { saveAll(); FS.exportFile(active); } }] : []),
    ...(active ? [{ t: "Sekmeyi kapat", f: () => closeTab(active) }] : []),
  ]);
});

// ================= GERİ TUŞU =================
window.onBack = () => {
  if (!$("#modal").classList.contains("hidden")) { $("#mCancel").click(); return true; }
  if (!$("#menu").classList.contains("hidden") || !$("#sheet").classList.contains("hidden")) { closePops(); return true; }
  if (!$("#settings").classList.contains("hidden")) { $("#settings").classList.add("hidden"); return true; }
  if (!$("#preview").classList.contains("hidden")) { closePreview(); return true; }
  if ($("#explorer").classList.contains("open") && innerWidth < 900) { toggleExplorer(false); return true; }
  saveAll();
  return false;
};

// ================= BAĞLANTILAR =================
$("#bExplorer").addEventListener("click", () => toggleExplorer());
$("#scrim").addEventListener("click", () => toggleExplorer(false));
$("#bRun").addEventListener("click", () => run());
$("#bNewProject").addEventListener("click", newProject);
$("#bEmptyProj").addEventListener("click", newProject);
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

// ================= BAŞLAT =================
applyTheme();
renderKeys();
syncToggles();
$("#keys").classList.toggle("hidden", !S.keys);
renderTabs();
loadLinked().then(() => view === "files" && renderTree());
if (typeof require === "undefined") {
  $("#loading").textContent = "Monaco bulunamadı (assets/www/monaco eksik)";
} else {
  require.config({ paths: { vs: "monaco/vs" } });
  require(["vs/editor/editor.main"], async () => {
    $("#loading").classList.add("hidden");
    defineThemes();
    monaco.languages.typescript.javascriptDefaults.setCompilerOptions({ allowNonTsExtensions: true, checkJs: false, target: 99, allowJs: true });
    editor = monaco.editor.create($("#editor"), Object.assign({
      model: null, theme: "ke-" + (THEMES[S.theme] ? S.theme : "dark"), automaticLayout: true,
      lineNumbersMinChars: 3, glyphMargin: false, folding: true, scrollBeyondLastLine: false, smoothScrolling: true,
      bracketPairColorization: { enabled: true }, guides: { bracketPairs: true }, renderLineHighlight: "all",
      padding: { top: 6 }, fixedOverflowWidgets: true, quickSuggestions: { other: true, comments: false, strings: true },
      suggestOnTriggerCharacters: true, autoClosingBrackets: "always", autoClosingQuotes: "always", formatOnPaste: false,
      scrollbar: { verticalScrollbarSize: 8, horizontalScrollbarSize: 8 }, linkedEditing: true,
    }, editorOptions()));
    editor.onDidChangeCursorPosition(updatePos);
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => { saveAll(); FS.toast("Kaydedildi"); });
    editor.addCommand(monaco.KeyCode.F5, () => run());
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.KeyF, () => showPanel("search"));
    await loadBuiltinIndex();
    for (const id of enabledPlugins) await loadPlugin(id);
    tabs = tabs.filter((p) => FS.exists(p));
    if (active && FS.exists(active)) openFile(active);
    else if (tabs.length) openFile(tabs[0]);
    else if (FS.exists("ilk-proje/index.html")) openFile("ilk-proje/index.html");
    else { active = null; renderTabs(); }
    setInterval(() => { if (active && editor.getModel()) store.set("view." + active, editor.saveViewState()); }, 5000);
  }, (err) => {
    $("#loading").textContent = "Editör yüklenemedi: " + (err && err.message || err);
  });
}

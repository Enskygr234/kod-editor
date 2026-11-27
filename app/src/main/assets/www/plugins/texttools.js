// Metin araçları: seçim varsa seçime, yoksa tüm belgeye uygulanır
function uygula(fn) {
  const ed = KodEditor.editor, m = ed && ed.getModel();
  if (!m) return KodEditor.toast("Önce bir dosya aç");
  let r = ed.getSelection();
  if (r.isEmpty()) r = m.getFullModelRange();
  ed.executeEdits("metin-araclari", [{ range: r, text: fn(m.getValueInRange(r)) }]);
  ed.focus();
}
const satirlar = (fn) => (s) => fn(s.split("\n")).join("\n");
KodEditor.addCommand("buyuk", "BÜYÜK HARF yap", () => uygula((s) => s.toLocaleUpperCase("tr")));
KodEditor.addCommand("kucuk", "küçük harf yap", () => uygula((s) => s.toLocaleLowerCase("tr")));
KodEditor.addCommand("baslik", "Her Kelimenin İlk Harfi Büyük", () =>
  uygula((s) => s.toLocaleLowerCase("tr").replace(/(^|\s)(\p{L})/gu, (a, b, c) => b + c.toLocaleUpperCase("tr"))));
KodEditor.addCommand("sirala", "Satırları sırala (A→Z)", () => uygula(satirlar((l) => l.sort((a, b) => a.localeCompare(b, "tr")))));
KodEditor.addCommand("sirala-ters", "Satırları sırala (Z→A)", () => uygula(satirlar((l) => l.sort((a, b) => b.localeCompare(a, "tr")))));
KodEditor.addCommand("tekrar", "Tekrarlanan satırları sil", () => uygula(satirlar((l) => [...new Set(l)])));
KodEditor.addCommand("ters", "Satırları ters çevir", () => uygula(satirlar((l) => l.reverse())));
KodEditor.addCommand("bosluk", "Satır sonu boşluklarını temizle", () => uygula(satirlar((l) => l.map((x) => x.replace(/[ \t]+$/, "")))));
KodEditor.addCommand("bos-satir", "Boş satırları sil", () => uygula(satirlar((l) => l.filter((x) => x.trim()))));
KodEditor.addCommand("camel", "snake_case → camelCase", () => uygula((s) => s.replace(/_(\p{L})/gu, (a, c) => c.toUpperCase())));

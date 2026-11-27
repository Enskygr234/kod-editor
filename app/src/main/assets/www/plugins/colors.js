// Renk paleti: tek dokunuşla renk kodu ekle
const PALET = {
  "Kırmızı": "#ef4444", "Turuncu": "#f97316", "Sarı": "#eab308", "Yeşil": "#22c55e", "Turkuaz": "#14b8a6",
  "Mavi": "#3b82f6", "Lacivert": "#1e3a8a", "Mor": "#8b5cf6", "Pembe": "#ec4899", "Gri": "#6b7280",
  "Koyu": "#111827", "Açık": "#f3f4f6", "Beyaz": "#ffffff", "Siyah": "#000000",
};
KodEditor.addCommand("renk-paleti", "Renk paletinden ekle", async () => {
  const liste = Object.entries(PALET).map(([ad, kod], i) => `${i + 1}. ${ad} ${kod}`).join("  ");
  const cevap = await KodEditor.ask("Renk numarası (1-" + Object.keys(PALET).length + ")", "6");
  const kod = Object.values(PALET)[(+cevap || 0) - 1];
  if (kod) KodEditor.insert(kod); else if (cevap) KodEditor.toast("Listede yok: " + liste.slice(0, 80) + "…");
});
for (const [ad, kod] of Object.entries(PALET)) {
  KodEditor.addCommand("renk-" + kod.slice(1), "Renk: " + ad + " " + kod, () => KodEditor.insert(kod));
}

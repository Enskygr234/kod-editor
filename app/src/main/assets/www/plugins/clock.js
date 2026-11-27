// Saat ve 25 dakikalık odak sayacı
let bitis = null;
function ciz() {
  const simdi = new Date();
  let s = "🕒 " + simdi.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" });
  if (bitis) {
    const kalan = Math.max(0, Math.round((bitis - simdi) / 1000));
    s += `  🍅 ${String(Math.floor(kalan / 60)).padStart(2, "0")}:${String(kalan % 60).padStart(2, "0")}`;
    if (kalan === 0) { bitis = null; KodEditor.toast("🍅 Odak süresi bitti, mola ver!"); }
  }
  KodEditor.setStatus("saat", s);
}
setInterval(ciz, 1000);
ciz();
KodEditor.addCommand("odak-baslat", "Odak sayacını başlat (25 dk)", () => { bitis = Date.now() + 25 * 60 * 1000; ciz(); KodEditor.toast("🍅 25 dakika odak başladı"); });
KodEditor.addCommand("odak-durdur", "Odak sayacını durdur", () => { bitis = null; ciz(); });

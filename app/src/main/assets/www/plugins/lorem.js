// Örnek veri üretici
const KELIME = "lorem ipsum dolor sit amet consectetur adipiscing elit sed do eiusmod tempor incididunt ut labore et dolore magna aliqua enim ad minim veniam quis nostrud exercitation ullamco laboris nisi aliquip ex ea commodo consequat".split(" ");
const AD = ["Ahmet", "Ayşe", "Mehmet", "Zeynep", "Emre", "Elif", "Can", "Deniz", "Burak", "Selin", "Mert", "Ece"];
const SOYAD = ["Yılmaz", "Kaya", "Demir", "Şahin", "Çelik", "Yıldız", "Aydın", "Öztürk", "Arslan", "Doğan"];
const sec = (a) => a[Math.floor(Math.random() * a.length)];
function paragraf(n = 40) {
  const s = Array.from({ length: n }, () => sec(KELIME)).join(" ");
  return s[0].toUpperCase() + s.slice(1) + ".";
}
const ascii = (s) => s.toLocaleLowerCase("tr").replace(/ç/g, "c").replace(/ğ/g, "g").replace(/ı/g, "i").replace(/ö/g, "o").replace(/ş/g, "s").replace(/ü/g, "u");
KodEditor.addCommand("lorem1", "Lorem ipsum: 1 paragraf", () => KodEditor.insert(paragraf()));
KodEditor.addCommand("lorem3", "Lorem ipsum: 3 paragraf", () => KodEditor.insert([paragraf(), paragraf(), paragraf()].join("\n\n")));
KodEditor.addCommand("isim", "Rastgele isim", () => KodEditor.insert(sec(AD) + " " + sec(SOYAD)));
KodEditor.addCommand("eposta", "Rastgele e-posta", () => KodEditor.insert(ascii(sec(AD)) + "." + ascii(sec(SOYAD)) + "@ornek.com"));
KodEditor.addCommand("renk", "Rastgele renk kodu", () => KodEditor.insert("#" + Math.floor(Math.random() * 0xffffff).toString(16).padStart(6, "0")));
KodEditor.addCommand("kisiler", "Örnek kişi listesi (JSON)", () => KodEditor.insert(JSON.stringify(
  Array.from({ length: 5 }, (_, i) => { const a = sec(AD), s = sec(SOYAD); return { id: i + 1, ad: a + " " + s, eposta: ascii(a) + "@ornek.com", yas: 18 + Math.floor(Math.random() * 40) }; }), null, 2)));

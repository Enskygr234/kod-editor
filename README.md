# Kod Editör

Android için VS Code benzeri kod editörü. Editör motoru VS Code'un kendi motoru **Monaco**.

## Özellikler
- **Editör:** 40+ dilde renklendirme, otomatik tamamlama, parantez eşleştirme, bul/değiştir, biçimlendirme, komut paleti
- **📁 Dosyalar:** gezgin, sekmeler, otomatik kaydetme, içe/dışa aktarma
- **🧪 Proje şablonları:** Web (HTML/CSS/JS), Python, Android (Kotlin), Eklenti
- **▶ Çalıştır:** HTML (CSS/JS ile birlikte), JavaScript, **Python** (Pyodide, ilk seferde internet gerekir), Markdown; konsol çıktısı
- **🔍 Projede ara:** tüm dosyalarda arama ve toplu değiştirme; büyük/küçük harf, tam kelime, düzenli ifade
- **🔀 GitHub:** repo indirme (clone), değişiklikleri görme, commit + push, pull, klasörü yeni ya da var olan repoya bağlama
- **🔨 APK derleme:** Android projesi GitHub Actions'ta derlenir; adımlar uygulamada canlı görünür, APK tek dokunuşla indirilip kurulur
- **🧩 Eklentiler:** kod parçacıkları, kelime sayacı, metin araçları, lorem ipsum, renk paleti, saat/odak sayacı; `eklentiler/` klasörüne kendi eklentini yazabilirsin
- **⚙ Ayarlar:** 8 tema (Dark+, Light+, Monokai, Dracula, GitHub Dark, Solarized, Nord, Yüksek kontrast), yazı tipi ve boyutu, sekme genişliği, mini harita, otomatik kaydetme

## GitHub token
github.com/settings/tokens → **repo** ve **workflow** izinli bir token oluştur, uygulamada 🔀 panelinde yapıştır. Token yalnızca telefonda saklanır.

## Eklenti API'si
```js
// eklentiler/benim.js
// @name Benim eklentim
// @desc Ne yaptığını yaz
KodEditor.addCommand("id", "Komut adı", () => KodEditor.insert("merhaba"));
KodEditor.addSnippets("javascript", [{ label: "log", body: "console.log($1);" }]);
KodEditor.setStatus("id", "durum çubuğu yazısı");
KodEditor.onFileOpen((yol) => {});
// ayrıca: fs.read/write/list/exists, selection(), replaceSelection(), toast(), ask(), monaco, editor
```

## İndir
`apk` dalındaki **KodEditor.apk** her zaman son sürümdür.

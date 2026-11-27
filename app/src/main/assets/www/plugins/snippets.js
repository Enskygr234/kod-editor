// Kod parçacıkları: yazmaya başlayınca öneri listesinde çıkar
KodEditor.addSnippets("html", [
  { label: "!", detail: "HTML5 iskeleti", body: '<!DOCTYPE html>\n<html lang="tr">\n<head>\n\t<meta charset="utf-8">\n\t<meta name="viewport" content="width=device-width, initial-scale=1">\n\t<title>${1:Başlık}</title>\n\t<link rel="stylesheet" href="${2:style.css}">\n</head>\n<body>\n\t$0\n\t<script src="${3:app.js}"></script>\n</body>\n</html>' },
  { label: "btn", detail: "Düğme", body: '<button id="${1:btn}">${2:Tıkla}</button>' },
  { label: "form", detail: "Form", body: '<form id="${1:form}">\n\t<label>${2:Ad} <input name="${3:ad}" required></label>\n\t<button type="submit">Gönder</button>\n</form>' },
  { label: "ul", detail: "Liste", body: "<ul>\n\t<li>$1</li>\n\t<li>$2</li>\n</ul>" },
  { label: "img", detail: "Resim", body: '<img src="$1" alt="$2">' },
  { label: "a", detail: "Bağlantı", body: '<a href="${1:#}">${2:metin}</a>' },
]);
KodEditor.addSnippets(["css", "scss", "less"], [
  { label: "flex", detail: "Flex ortala", body: "display: flex;\nalign-items: center;\njustify-content: center;\ngap: ${1:8px};" },
  { label: "grid", detail: "Izgara", body: "display: grid;\ngrid-template-columns: repeat(${1:auto-fill}, minmax(${2:200px}, 1fr));\ngap: ${3:16px};" },
  { label: "media", detail: "Mobil uyum", body: "@media (max-width: ${1:600px}) {\n\t$0\n}" },
  { label: "anim", detail: "Animasyon", body: "@keyframes ${1:kaydir} {\n\tfrom { ${2:transform: translateY(20px); opacity: 0;} }\n\tto { ${3:transform: none; opacity: 1;} }\n}" },
]);
KodEditor.addSnippets(["javascript", "typescript"], [
  { label: "log", detail: "console.log", body: "console.log($1);" },
  { label: "fn", detail: "Fonksiyon", body: "function ${1:ad}(${2}) {\n\t$0\n}" },
  { label: "afn", detail: "Ok fonksiyonu", body: "const ${1:ad} = (${2}) => {\n\t$0\n};" },
  { label: "fori", detail: "for döngüsü", body: "for (let ${1:i} = 0; ${1:i} < ${2:dizi}.length; ${1:i}++) {\n\t$0\n}" },
  { label: "forof", detail: "for...of", body: "for (const ${1:oge} of ${2:dizi}) {\n\t$0\n}" },
  { label: "qs", detail: "querySelector", body: 'document.querySelector("${1:#id}")' },
  { label: "click", detail: "Tıklama olayı", body: '${1:el}.addEventListener("click", (e) => {\n\t$0\n});' },
  { label: "fetch", detail: "fetch + JSON", body: 'const ${1:veri} = await fetch("${2:https://}").then((r) => r.json());' },
  { label: "timeout", detail: "setTimeout", body: "setTimeout(() => {\n\t$0\n}, ${1:1000});" },
  { label: "ls", detail: "localStorage kaydet/oku", body: 'localStorage.setItem("${1:anahtar}", JSON.stringify(${2:deger}));\nconst ${3:oku} = JSON.parse(localStorage.getItem("${1:anahtar}") || "null");' },
]);
KodEditor.addSnippets("python", [
  { label: "def", detail: "Fonksiyon", body: "def ${1:ad}(${2}):\n    ${0:pass}" },
  { label: "main", detail: "if __name__", body: 'def main():\n    ${0:pass}\n\n\nif __name__ == "__main__":\n    main()' },
  { label: "class", detail: "Sınıf", body: "class ${1:Ad}:\n    def __init__(self${2}):\n        ${0:pass}" },
  { label: "fori", detail: "for range", body: "for ${1:i} in range(${2:10}):\n    ${0:print(i)}" },
  { label: "try", detail: "try/except", body: "try:\n    ${1:pass}\nexcept ${2:Exception} as e:\n    print(e)" },
  { label: "inp", detail: "Sayı girişi", body: '${1:sayi} = int(input("${2:Bir sayı gir: }"))' },
]);
KodEditor.addSnippets("kotlin", [
  { label: "fun", detail: "Fonksiyon", body: "fun ${1:ad}(${2}): ${3:Unit} {\n    $0\n}" },
  { label: "dataclass", detail: "Veri sınıfı", body: "data class ${1:Ad}(val ${2:id}: ${3:Int})" },
  { label: "toast", detail: "Toast mesajı", body: 'Toast.makeText(this, "${1:Merhaba}", Toast.LENGTH_SHORT).show()' },
  { label: "click", detail: "Tıklama", body: "${1:dugme}.setOnClickListener {\n    $0\n}" },
  { label: "activity", detail: "Activity", body: "class ${1:Ana}Activity : Activity() {\n    override fun onCreate(savedInstanceState: Bundle?) {\n        super.onCreate(savedInstanceState)\n        $0\n    }\n}" },
  { label: "intent", detail: "Ekran aç", body: "startActivity(Intent(this, ${1:Diger}Activity::class.java))" },
]);
KodEditor.addSnippets("java", [
  { label: "main", detail: "main metodu", body: "public static void main(String[] args) {\n\t$0\n}" },
  { label: "sout", detail: "System.out.println", body: "System.out.println($1);" },
  { label: "fori", detail: "for döngüsü", body: "for (int ${1:i} = 0; ${1:i} < ${2:n}; ${1:i}++) {\n\t$0\n}" },
]);

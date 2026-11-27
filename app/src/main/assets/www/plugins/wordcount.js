// Durum çubuğunda kelime/satır/seçim bilgisi
function guncelle() {
  const ed = KodEditor.editor, m = ed && ed.getModel();
  if (!m) return KodEditor.setStatus("wc", "");
  const sel = KodEditor.selection();
  if (sel) return KodEditor.setStatus("wc", `${sel.length} karakter seçili`);
  const metin = m.getValue();
  const kelime = (metin.match(/[\p{L}\p{N}_]+/gu) || []).length;
  KodEditor.setStatus("wc", `${m.getLineCount()} satır · ${kelime} kelime`);
}
let bekle;
const tetik = () => { clearTimeout(bekle); bekle = setTimeout(guncelle, 250); };
KodEditor.editor.onDidChangeModelContent(tetik);
KodEditor.editor.onDidChangeCursorSelection(tetik);
KodEditor.editor.onDidChangeModel(tetik);
guncelle();

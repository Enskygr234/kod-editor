package com.enskygr.kodeditor

import android.app.Activity
import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.provider.OpenableColumns
import android.webkit.JavascriptInterface
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.Toast
import androidx.webkit.WebViewAssetLoader
import org.json.JSONArray
import org.json.JSONObject
import java.io.File

class MainActivity : Activity() {

    private lateinit var web: WebView
    private lateinit var root: File
    private var importDir = ""
    private var exportPath = ""

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        root = File(filesDir, "workspace").canonicalFile.apply { mkdirs() }
        if (root.list().isNullOrEmpty()) seedWorkspace()

        val loader = WebViewAssetLoader.Builder()
            .addPathHandler("/assets/", WebViewAssetLoader.AssetsPathHandler(this))
            .build()

        web = WebView(this)
        setContentView(web)
        with(web.settings) {
            javaScriptEnabled = true
            domStorageEnabled = true
            allowFileAccess = false
            allowContentAccess = false
            textZoom = 100
        }
        web.webViewClient = object : WebViewClient() {
            override fun shouldInterceptRequest(view: WebView, request: WebResourceRequest): WebResourceResponse? =
                loader.shouldInterceptRequest(request.url)

            override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean {
                val url = request.url
                if (url.host == "appassets.androidplatform.net") return false
                // Önizlemedeki dış linkler tarayıcıda açılsın
                runCatching { startActivity(Intent(Intent.ACTION_VIEW, url)) }
                return true
            }
        }
        web.webChromeClient = WebChromeClient()
        web.addJavascriptInterface(Bridge(), "Android")
        web.loadUrl("https://appassets.androidplatform.net/assets/www/index.html")
    }

    override fun onPause() {
        super.onPause()
        web.evaluateJavascript("window.saveAll && saveAll()", null)
    }

    @Deprecated("Deprecated in Java")
    override fun onBackPressed() {
        web.evaluateJavascript("window.onBack ? onBack() : false") { result ->
            if (result != "true") {
                @Suppress("DEPRECATION")
                super.onBackPressed()
            }
        }
    }

    // ---- Dosya yolu güvenliği: her şey workspace klasörünün içinde kalmalı ----
    private fun resolve(rel: String): File {
        val f = File(root, rel.trimStart('/')).canonicalFile
        require(f.path == root.path || f.path.startsWith(root.path + File.separator)) { "Geçersiz yol" }
        return f
    }

    private fun relOf(f: File) = f.path.removePrefix(root.path).trimStart(File.separatorChar)

    private fun ok() = JSONObject().put("ok", true).toString()
    private fun err(e: Throwable) = JSONObject().put("ok", false).put("error", e.message ?: e.toString()).toString()

    inner class Bridge {
        @JavascriptInterface
        fun list(): String {
            val arr = JSONArray()
            root.walkTopDown().filter { it != root }.forEach {
                arr.put(JSONObject().put("p", relOf(it)).put("d", it.isDirectory))
            }
            return arr.toString()
        }

        @JavascriptInterface
        fun read(path: String): String = runCatching { resolve(path).readText() }.getOrDefault("")

        @JavascriptInterface
        fun write(path: String, content: String): String = runCatching {
            val f = resolve(path); f.parentFile?.mkdirs(); f.writeText(content); ok()
        }.getOrElse(::err)

        @JavascriptInterface
        fun exists(path: String): Boolean = runCatching { resolve(path).exists() }.getOrDefault(false)

        @JavascriptInterface
        fun mkdir(path: String): String = runCatching { resolve(path).mkdirs(); ok() }.getOrElse(::err)

        @JavascriptInterface
        fun remove(path: String): String = runCatching {
            val f = resolve(path); require(f != root) { "Kök silinemez" }; f.deleteRecursively(); ok()
        }.getOrElse(::err)

        @JavascriptInterface
        fun rename(from: String, to: String): String = runCatching {
            val a = resolve(from); val b = resolve(to)
            require(!b.exists()) { "Bu adda bir dosya zaten var" }
            b.parentFile?.mkdirs()
            require(a.renameTo(b)) { "Yeniden adlandırılamadı" }
            ok()
        }.getOrElse(::err)

        @JavascriptInterface
        fun toast(msg: String) = runOnUiThread { Toast.makeText(this@MainActivity, msg, Toast.LENGTH_SHORT).show() }

        @JavascriptInterface
        fun importFiles(dir: String) = runOnUiThread {
            importDir = dir
            val i = Intent(Intent.ACTION_OPEN_DOCUMENT).addCategory(Intent.CATEGORY_OPENABLE)
                .setType("*/*").putExtra(Intent.EXTRA_ALLOW_MULTIPLE, true)
            startActivityForResult(i, REQ_IMPORT)
        }

        @JavascriptInterface
        fun exportFile(path: String) = runOnUiThread {
            exportPath = path
            val i = Intent(Intent.ACTION_CREATE_DOCUMENT).addCategory(Intent.CATEGORY_OPENABLE)
                .setType("*/*").putExtra(Intent.EXTRA_TITLE, File(path).name)
            startActivityForResult(i, REQ_EXPORT)
        }
    }

    @Deprecated("Deprecated in Java")
    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        super.onActivityResult(requestCode, resultCode, data)
        if (resultCode != RESULT_OK || data == null) return
        when (requestCode) {
            REQ_IMPORT -> {
                val uris = mutableListOf<Uri>()
                data.clipData?.let { c -> for (k in 0 until c.itemCount) uris += c.getItemAt(k).uri }
                data.data?.let { if (it !in uris) uris += it }
                var n = 0
                for (u in uris) runCatching {
                    val name = displayName(u) ?: "dosya$n"
                    val target = resolve(if (importDir.isEmpty()) name else "$importDir/$name")
                    target.parentFile?.mkdirs()
                    contentResolver.openInputStream(u)!!.use { inp -> target.outputStream().use { inp.copyTo(it) } }
                    n++
                }
                web.evaluateJavascript("window.onImported && onImported($n)", null)
            }
            REQ_EXPORT -> runCatching {
                val src = resolve(exportPath)
                contentResolver.openOutputStream(data.data!!)!!.use { out -> src.inputStream().use { it.copyTo(out) } }
                Toast.makeText(this, "Kaydedildi: ${src.name}", Toast.LENGTH_SHORT).show()
            }.onFailure { Toast.makeText(this, "Dışa aktarılamadı", Toast.LENGTH_SHORT).show() }
        }
    }

    private fun displayName(u: Uri): String? =
        contentResolver.query(u, arrayOf(OpenableColumns.DISPLAY_NAME), null, null, null)?.use {
            if (it.moveToFirst()) it.getString(0)?.replace("/", "_") else null
        }

    private fun seedWorkspace() {
        val dir = File(root, "ilk-proje").apply { mkdirs() }
        File(dir, "index.html").writeText(
            """
            <!DOCTYPE html>
            <html lang="tr">
            <head>
              <meta charset="utf-8">
              <meta name="viewport" content="width=device-width, initial-scale=1">
              <title>İlk Projem</title>
              <link rel="stylesheet" href="style.css">
            </head>
            <body>
              <h1>Merhaba Kod Editör 👋</h1>
              <p>Bu sayfayı düzenle, sonra ▶ ile çalıştır.</p>
              <button id="btn">Tıkla</button>
              <p id="sayac">0 tıklama</p>
              <script src="app.js"></script>
            </body>
            </html>
            """.trimIndent() + "\n"
        )
        File(dir, "style.css").writeText(
            """
            body {
              font-family: system-ui, sans-serif;
              background: #0f172a;
              color: #e2e8f0;
              padding: 24px;
            }
            button {
              background: #007acc;
              color: white;
              border: 0;
              border-radius: 8px;
              padding: 10px 18px;
              font-size: 16px;
            }
            """.trimIndent() + "\n"
        )
        File(dir, "app.js").writeText(
            """
            let n = 0;
            document.getElementById("btn").addEventListener("click", () => {
              n++;
              document.getElementById("sayac").textContent = n + " tıklama";
              console.log("Tıklandı:", n);
            });
            """.trimIndent() + "\n"
        )
        File(root, "BENİOKU.md").writeText(
            """
            # Kod Editör

            - ☰ ile dosya gezginini aç
            - ▶ ile HTML veya JS dosyasını çalıştır
            - ⋮ menüsünde biçimlendir, bul, komut paleti ve yazı boyutu var
            - Dosyalar otomatik kaydedilir
            """.trimIndent() + "\n"
        )
    }

    companion object {
        private const val REQ_IMPORT = 41
        private const val REQ_EXPORT = 42
    }
}

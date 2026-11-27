package com.enskygr.kodeditor

import android.util.Base64
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONArray
import org.json.JSONObject
import java.io.File
import java.security.MessageDigest
import java.util.concurrent.TimeUnit
import java.util.zip.ZipInputStream

/** GitHub REST API istemcisi. */
class GitHubApi(private val token: String) {
    class ApiError(val code: Int, msg: String) : Exception(msg)

    private val client = OkHttpClient.Builder()
        .connectTimeout(20, TimeUnit.SECONDS)
        .readTimeout(90, TimeUnit.SECONDS)
        .build()
    private val jsonType = "application/json; charset=utf-8".toMediaType()

    private fun builder(path: String) = Request.Builder()
        .url(if (path.startsWith("http")) path else "https://api.github.com$path")
        .header("Authorization", "Bearer $token")
        .header("Accept", "application/vnd.github+json")
        .header("X-GitHub-Api-Version", "2022-11-28")
        .header("User-Agent", "KodEditor-Android")

    fun call(method: String, path: String, body: JSONObject? = null): String {
        val rb = body?.toString()?.toRequestBody(jsonType)
            ?: if (method == "GET") null else "{}".toRequestBody(jsonType)
        client.newCall(builder(path).method(method, rb).build()).execute().use { r ->
            val s = r.body?.string() ?: ""
            if (!r.isSuccessful) {
                val m = runCatching { JSONObject(s).optString("message") }.getOrNull().orEmpty().ifBlank { s.take(200) }
                throw ApiError(r.code, friendly(r.code, m))
            }
            return s
        }
    }

    fun obj(method: String, path: String, body: JSONObject? = null) = JSONObject(call(method, path, body).ifBlank { "{}" })
    fun arr(path: String) = JSONArray(call("GET", path))

    fun download(path: String, dest: File) {
        // OkHttp başka bir sunucuya yönlendirmede Authorization başlığını kendisi siler.
        client.newCall(builder(path).get().build()).execute().use { r ->
            if (!r.isSuccessful) throw ApiError(r.code, friendly(r.code, "İndirilemedi"))
            dest.parentFile?.mkdirs()
            dest.outputStream().use { out -> r.body!!.byteStream().copyTo(out) }
        }
    }

    private fun friendly(code: Int, m: String) = when (code) {
        401 -> "Token geçersiz ya da süresi dolmuş"
        403 -> "İzin yok: $m (token'a repo ve workflow izni verilmeli)"
        404 -> "Bulunamadı: repo adı yanlış ya da token'ın bu repoya erişimi yok"
        409 -> "Repo boş ya da çakışma var: $m"
        422 -> "GitHub isteği kabul etmedi: $m"
        else -> "GitHub hatası ($code): $m"
    }
}

/** Basit Git iş akışı: clone, durum, gönder, çek, Actions derlemeleri. */
class GitOps(private val root: File, private val stateDir: File, private val cacheDir: File, token: String) {
    private val api = GitHubApi(token)

    private data class Entry(val sha: String, val mode: String)
    private class State(
        val folder: String, val repo: String, val branch: String,
        var head: String, var tree: String, val files: MutableMap<String, Entry>,
    )

    // ---------- yardımcılar ----------
    private fun dirOf(folder: String): File {
        val f = File(root, folder).canonicalFile
        require(folder.isNotBlank() && !folder.contains('/') && f.parentFile == root) { "Geçersiz proje klasörü" }
        return f
    }

    private fun stateFile(folder: String) = File(stateDir, "$folder.json")

    private fun load(folder: String): State {
        val f = stateFile(folder)
        require(f.exists()) { "Bu klasör GitHub'a bağlı değil" }
        val j = JSONObject(f.readText())
        val files = mutableMapOf<String, Entry>()
        val fj = j.getJSONObject("files")
        for (k in fj.keys()) fj.getJSONObject(k).let { files[k] = Entry(it.getString("s"), it.getString("m")) }
        return State(folder, j.getString("repo"), j.getString("branch"), j.optString("head"), j.optString("tree"), files)
    }

    private fun save(s: State) {
        stateDir.mkdirs()
        val fj = JSONObject()
        s.files.forEach { (k, v) -> fj.put(k, JSONObject().put("s", v.sha).put("m", v.mode)) }
        stateFile(s.folder).writeText(
            JSONObject().put("repo", s.repo).put("branch", s.branch).put("head", s.head)
                .put("tree", s.tree).put("files", fj).toString()
        )
    }

    private fun blobSha(bytes: ByteArray): String {
        val md = MessageDigest.getInstance("SHA-1")
        md.update("blob ${bytes.size}\u0000".toByteArray())
        md.update(bytes)
        return md.digest().joinToString("") { "%02x".format(it) }
    }

    private fun localFiles(dir: File): Map<String, File> =
        dir.walkTopDown().onEnter { it.name != ".git" }.filter { it.isFile }
            .associateBy { it.path.removePrefix(dir.path).trimStart(File.separatorChar).replace(File.separatorChar, '/') }

    private fun remoteHead(repo: String, branch: String): String? = try {
        api.obj("GET", "/repos/$repo/git/ref/heads/$branch").getJSONObject("object").getString("sha")
    } catch (e: GitHubApi.ApiError) {
        if (e.code == 404 || e.code == 409) null else throw e
    }

    private fun treeOf(commit: String, repo: String) =
        api.obj("GET", "/repos/$repo/git/commits/$commit").getJSONObject("tree").getString("sha")

    private fun fetchTree(repo: String, tree: String): MutableMap<String, Entry> {
        val j = api.obj("GET", "/repos/$repo/git/trees/$tree?recursive=1")
        val out = mutableMapOf<String, Entry>()
        val arr = j.getJSONArray("tree")
        for (i in 0 until arr.length()) {
            val e = arr.getJSONObject(i)
            if (e.getString("type") == "blob") out[e.getString("path")] = Entry(e.getString("sha"), e.getString("mode"))
        }
        return out
    }

    private fun downloadInto(repo: String, commit: String, dest: File, skipExisting: Boolean): Int {
        val zip = File(cacheDir, "repo-${System.currentTimeMillis()}.zip")
        try {
            api.download("/repos/$repo/zipball/$commit", zip)
            dest.mkdirs()
            var n = 0
            ZipInputStream(zip.inputStream().buffered()).use { zin ->
                while (true) {
                    val e = zin.nextEntry ?: break
                    val rel = e.name.substringAfter('/', "")
                    if (rel.isEmpty() || e.isDirectory) continue
                    val out = File(dest, rel).canonicalFile
                    if (!out.path.startsWith(dest.path + File.separator)) continue // zip-slip koruması
                    if (skipExisting && out.exists()) continue
                    out.parentFile?.mkdirs()
                    out.outputStream().use { zin.copyTo(it) }
                    n++
                }
            }
            return n
        } finally {
            zip.delete()
        }
    }

    private fun ok() = JSONObject().put("ok", true)

    // ---------- işlemler ----------
    fun me(): JSONObject = ok().put("login", api.obj("GET", "/user").getString("login"))

    fun repos(): JSONObject {
        val arr = api.arr("/user/repos?per_page=100&sort=pushed&affiliation=owner,collaborator")
        val out = JSONArray()
        for (i in 0 until arr.length()) arr.getJSONObject(i).let {
            out.put(JSONObject().put("name", it.getString("full_name")).put("private", it.getBoolean("private")))
        }
        return ok().put("items", out)
    }

    fun linked(): JSONObject {
        val out = JSONArray()
        stateDir.listFiles()?.filter { it.extension == "json" }?.sortedBy { it.name }?.forEach { f ->
            runCatching {
                val j = JSONObject(f.readText())
                val folder = f.nameWithoutExtension
                if (File(root, folder).exists())
                    out.put(JSONObject().put("folder", folder).put("repo", j.getString("repo")).put("branch", j.getString("branch")))
                else f.delete()
            }
        }
        return ok().put("items", out)
    }

    fun clone(repoIn: String, branchIn: String, folder: String): JSONObject {
        val repo = repoIn.trim().removePrefix("https://github.com/").removeSuffix(".git").trim('/')
        require(Regex("^[\\w.-]+/[\\w.-]+$").matches(repo)) { "Repo adı kullanıcı/repo biçiminde olmalı" }
        val dest = dirOf(folder)
        require(!dest.exists() || dest.list().isNullOrEmpty()) { "'$folder' klasörü zaten var" }
        val info = api.obj("GET", "/repos/$repo")
        val branch = branchIn.ifBlank { info.optString("default_branch", "main") }
        val head = remoteHead(repo, branch)
        dest.mkdirs()
        val st = State(folder, info.getString("full_name"), branch, "", "", mutableMapOf())
        var n = 0
        if (head != null) {
            st.head = head
            st.tree = treeOf(head, repo)
            st.files.putAll(fetchTree(repo, st.tree))
            n = downloadInto(repo, head, dest, false)
        }
        save(st)
        return ok().put("folder", folder).put("count", n).put("repo", st.repo).put("empty", head == null)
    }

    fun link(folder: String, repoIn: String, create: Boolean, isPrivate: Boolean): JSONObject {
        val dest = dirOf(folder)
        require(dest.isDirectory) { "Klasör bulunamadı" }
        val repo: String
        val branch: String
        if (create) {
            val name = repoIn.substringAfter('/').trim()
            require(Regex("^[\\w.-]+$").matches(name)) { "Repo adında yalnızca harf, rakam, - _ . olabilir" }
            val r = api.obj("POST", "/user/repos", JSONObject().put("name", name).put("private", isPrivate).put("auto_init", false))
            repo = r.getString("full_name"); branch = r.optString("default_branch", "main").ifBlank { "main" }
        } else {
            val r = api.obj("GET", "/repos/${repoIn.trim().trim('/')}")
            repo = r.getString("full_name"); branch = r.optString("default_branch", "main")
        }
        val st = State(folder, repo, branch, "", "", mutableMapOf())
        val head = remoteHead(repo, branch)
        var n = 0
        if (head != null) {
            st.head = head; st.tree = treeOf(head, repo); st.files.putAll(fetchTree(repo, st.tree))
            n = downloadInto(repo, head, dest, true) // yereldeki dosyalar korunur
        }
        save(st)
        return ok().put("repo", repo).put("branch", branch).put("downloaded", n)
    }

    fun unlink(folder: String): JSONObject { stateFile(folder).delete(); return ok() }

    private data class Changes(val added: List<String>, val modified: List<String>, val deleted: List<String>)

    private fun changes(st: State): Changes {
        val local = localFiles(dirOf(st.folder))
        val added = mutableListOf<String>(); val modified = mutableListOf<String>()
        for ((p, f) in local) {
            val e = st.files[p]
            if (e == null) added += p else if (e.mode != "120000" && blobSha(f.readBytes()) != e.sha) modified += p
        }
        val deleted = st.files.keys.filter { it !in local }
        return Changes(added.sorted(), modified.sorted(), deleted.sorted())
    }

    fun status(folder: String): JSONObject {
        val st = load(folder)
        val c = changes(st)
        return ok().put("repo", st.repo).put("branch", st.branch).put("head", st.head.take(7))
            .put("added", JSONArray(c.added)).put("modified", JSONArray(c.modified)).put("deleted", JSONArray(c.deleted))
    }

    fun push(folder: String, messageIn: String): JSONObject {
        val st = load(folder)
        val dir = dirOf(folder)
        val c = changes(st)
        val message = messageIn.ifBlank { "Kod Editör'den güncelleme" }
        if (c.added.isEmpty() && c.modified.isEmpty() && c.deleted.isEmpty()) throw IllegalStateException("Gönderilecek değişiklik yok")
        val remote = remoteHead(st.repo, st.branch)
        if (remote != (st.head.ifBlank { null })) throw IllegalStateException("GitHub'da yeni değişiklikler var. Önce Çek'e bas.")

        val toUpload = (c.added + c.modified).toMutableList()
        // Boş repo: Git Data API çalışmaz, ilk dosyayı Contents API ile gönder
        if (st.head.isBlank()) {
            val first = toUpload.firstOrNull() ?: throw IllegalStateException("Boş repoya en az bir dosya göndermelisin")
            val bytes = File(dir, first).readBytes()
            val r = api.obj("PUT", "/repos/${st.repo}/contents/${first.split('/').joinToString("/") { java.net.URLEncoder.encode(it, "UTF-8").replace("+", "%20") }}",
                JSONObject().put("message", message).put("branch", st.branch)
                    .put("content", Base64.encodeToString(bytes, Base64.NO_WRAP)))
            val commit = r.getJSONObject("commit")
            st.head = commit.getString("sha")
            st.tree = commit.getJSONObject("tree").getString("sha")
            st.files[first] = Entry(r.getJSONObject("content").getString("sha"), "100644")
            toUpload.remove(first)
            save(st)
        }
        if (toUpload.isNotEmpty() || c.deleted.isNotEmpty()) {
            val entries = JSONArray()
            val newShas = mutableMapOf<String, String>()
            for (p in toUpload) {
                val bytes = File(dir, p).readBytes()
                val sha = api.obj("POST", "/repos/${st.repo}/git/blobs",
                    JSONObject().put("content", Base64.encodeToString(bytes, Base64.NO_WRAP)).put("encoding", "base64")).getString("sha")
                newShas[p] = sha
                entries.put(JSONObject().put("path", p).put("mode", st.files[p]?.mode ?: "100644").put("type", "blob").put("sha", sha))
            }
            for (p in c.deleted) entries.put(JSONObject().put("path", p).put("mode", st.files[p]?.mode ?: "100644").put("type", "blob").put("sha", JSONObject.NULL))
            val tree = api.obj("POST", "/repos/${st.repo}/git/trees", JSONObject().put("base_tree", st.tree).put("tree", entries)).getString("sha")
            val commit = api.obj("POST", "/repos/${st.repo}/git/commits",
                JSONObject().put("message", message).put("tree", tree).put("parents", JSONArray().put(st.head))).getString("sha")
            api.obj("PATCH", "/repos/${st.repo}/git/refs/heads/${st.branch}", JSONObject().put("sha", commit).put("force", false))
            st.head = commit; st.tree = tree
            newShas.forEach { (p, s) -> st.files[p] = Entry(s, st.files[p]?.mode ?: "100644") }
            c.deleted.forEach { st.files.remove(it) }
            save(st)
        }
        return ok().put("count", c.added.size + c.modified.size + c.deleted.size).put("commit", st.head.take(7))
    }

    fun pull(folder: String): JSONObject {
        val st = load(folder)
        val remote = remoteHead(st.repo, st.branch) ?: return ok().put("msg", "Repo henüz boş")
        if (remote == st.head) return ok().put("msg", "Zaten güncel")
        val c = changes(st)
        if (c.added.isNotEmpty() || c.modified.isNotEmpty() || c.deleted.isNotEmpty())
            throw IllegalStateException("Yerelde gönderilmemiş değişiklikler var. Önce Gönder'e bas.")
        val dir = dirOf(folder)
        dir.listFiles()?.forEach { it.deleteRecursively() }
        downloadInto(st.repo, remote, dir, false)
        st.head = remote; st.tree = treeOf(remote, st.repo)
        st.files.clear(); st.files.putAll(fetchTree(st.repo, st.tree))
        save(st)
        return ok().put("msg", "Güncellendi (${remote.take(7)})")
    }

    // ---------- GitHub Actions ----------
    fun runs(folder: String): JSONObject {
        val st = load(folder)
        val list = api.obj("GET", "/repos/${st.repo}/actions/runs?branch=${st.branch}&per_page=1").getJSONArray("workflow_runs")
        if (list.length() == 0) return ok().put("run", JSONObject.NULL)
        val r = list.getJSONObject(0)
        val id = r.getLong("id")
        val run = JSONObject().put("id", id).put("name", r.optString("name")).put("status", r.optString("status"))
            .put("conclusion", r.optString("conclusion")).put("url", r.optString("html_url"))
            .put("sha", r.optString("head_sha").take(7)).put("title", r.optString("display_title"))
            .put("current", r.optString("head_sha") == st.head)
        val steps = JSONArray()
        runCatching {
            val jobs = api.obj("GET", "/repos/${st.repo}/actions/runs/$id/jobs").getJSONArray("jobs")
            for (i in 0 until jobs.length()) {
                val s = jobs.getJSONObject(i).optJSONArray("steps") ?: continue
                for (k in 0 until s.length()) s.getJSONObject(k).let {
                    steps.put(JSONObject().put("name", it.optString("name")).put("status", it.optString("status")).put("conclusion", it.optString("conclusion")))
                }
            }
        }
        val arts = JSONArray()
        if (r.optString("status") == "completed") runCatching {
            val a = api.obj("GET", "/repos/${st.repo}/actions/runs/$id/artifacts").getJSONArray("artifacts")
            for (i in 0 until a.length()) a.getJSONObject(i).let {
                if (!it.optBoolean("expired")) arts.put(JSONObject().put("id", it.getLong("id")).put("name", it.getString("name")).put("size", it.optLong("size_in_bytes")))
            }
        }
        return ok().put("run", run.put("steps", steps).put("artifacts", arts))
    }

    fun dispatch(folder: String): JSONObject {
        val st = load(folder)
        val wf = api.obj("GET", "/repos/${st.repo}/actions/workflows").getJSONArray("workflows")
        require(wf.length() > 0) { "Repoda GitHub Actions iş akışı yok (.github/workflows)" }
        val id = wf.getJSONObject(0).getLong("id")
        api.call("POST", "/repos/${st.repo}/actions/workflows/$id/dispatches", JSONObject().put("ref", st.branch))
        return ok()
    }

    /** Artifact zip'ini indirip içindeki ilk APK'yı çıkarır. */
    fun apk(folder: String, artifactId: Long, outDir: File): File {
        val st = load(folder)
        val zip = File(cacheDir, "artifact-$artifactId.zip")
        try {
            api.download("/repos/${st.repo}/actions/artifacts/$artifactId/zip", zip)
            outDir.mkdirs()
            outDir.listFiles()?.forEach { it.delete() }
            ZipInputStream(zip.inputStream().buffered()).use { zin ->
                while (true) {
                    val e = zin.nextEntry ?: break
                    if (!e.isDirectory && e.name.endsWith(".apk", true)) {
                        val out = File(outDir, File(e.name).name)
                        out.outputStream().use { zin.copyTo(it) }
                        return out
                    }
                }
            }
            throw IllegalStateException("Artifact içinde APK bulunamadı")
        } finally {
            zip.delete()
        }
    }
}

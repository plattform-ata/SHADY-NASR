/* ==========================================================================
   drive.js — رفع وقراءة ملفات PDF من Google Drive (من المتصفح مباشرة، من غير سيرفر)
   - الأدمن: تسجيل دخول Google (OAuth، صلاحية drive.file فقط) ← رفع الملف لفولدر "ShadyNasr"
     ← مشاركته "أي حد معاه الرابط" ← حفظ الـ fileId بس في Firebase.
   - الطالب: بيحمّل الملف بالـ fileId + API Key (من غير تسجيل دخول Google) ويعرضه جوه المنصة.
   ========================================================================== */
(function () {
  "use strict";
  if (window.SNDrive) return;

  var CLIENT_ID = "860152398792-vpal7vkmm7uddclnu1dobggs61218u7i.apps.googleusercontent.com";
  var API_KEY = "AIzaSyA7leGzyVH2fOKzEFvmnPh7VBspESVHC5Y";
  var SCOPE = "https://www.googleapis.com/auth/drive.file";
  var FOLDER_NAME = "ShadyNasr";
  var API = "https://www.googleapis.com/drive/v3/";

  /* ---------- قراءة (الطالب) ----------
     كل التحميلات بتعدّي على raw(): نفس الملف بيتحمّل مرة واحدة، وأي حد يطلبه (حتى لو التحميل شغّال) يستقبل نسبة التقدّم.
     onProgress(p): p من 0 لـ 1، أو null لو الحجم مش معروف. */
  var rawCache = {};
  function sizeOf(fileId) {
    return fetch(API + "files/" + encodeURIComponent(fileId) + "?fields=size&key=" + API_KEY)
      .then(function (r) { return r.ok ? r.json() : {}; })
      .then(function (j) { return Number(j && j.size) || 0; })
      .catch(function () { return 0; });
  }
  function emit(e, p) {
    e.frac = p;
    e.subs.forEach(function (fn) { try { fn(p); } catch (x) { } });
  }
  function raw(fileId, onProgress) {
    if (!fileId) return Promise.reject(new Error("NO_ID"));
    var e = rawCache[fileId];
    if (!e) {
      e = rawCache[fileId] = { frac: 0, subs: [], done: false };
      var total = 0;
      sizeOf(fileId).then(function (n) { if (!total) total = n; });
      e.p = fetch(API + "files/" + encodeURIComponent(fileId) + "?alt=media&key=" + API_KEY).then(function (r) {
        if (!r.ok) throw new Error("HTTP_" + r.status);
        total = Number(r.headers.get("content-length")) || total;
        if (!r.body || !r.body.getReader) return r.blob();
        var rd = r.body.getReader(), chunks = [], got = 0;
        var pump = function () {
          return rd.read().then(function (x) {
            if (x.done) return new Blob(chunks);
            chunks.push(x.value); got += x.value.length;
            emit(e, total ? Math.min(0.99, got / total) : null);
            return pump();
          });
        };
        return pump();
      }).then(function (b) { e.done = true; emit(e, 1); e.subs = []; return b; });
      var cur = e;
      e.p.catch(function () { if (rawCache[fileId] === cur) delete rawCache[fileId]; });
    }
    if (onProgress) {
      if (e.done) { try { onProgress(1); } catch (x) { } }
      else { e.subs.push(onProgress); try { onProgress(e.frac || 0); } catch (x) { } }
    }
    return e.p;
  }
  function fetchBlob(fileId, onProgress) {
    return raw(fileId, onProgress).then(function (b) { return b.type === "application/pdf" ? b : new Blob([b], { type: "application/pdf" }); });
  }
  /* ملفات JSON (بنوك الأسئلة): بتتقرا بنفس الطريقة، والنتيجة بتتخزن على جهاز الطالب بالـ fileId */
  var jsonCache = {};
  function fetchJson(fileId) {
    if (!fileId) return Promise.reject(new Error("NO_ID"));
    if (jsonCache[fileId]) return jsonCache[fileId];
    var p = fetch(API + "files/" + encodeURIComponent(fileId) + "?alt=media&key=" + API_KEY)
      .then(function (r) { if (!r.ok) throw new Error("HTTP_" + r.status); return r.json(); });
    jsonCache[fileId] = p;
    p.catch(function () { delete jsonCache[fileId]; });
    return p;
  }
  /* ملفات بأي نوع (صور مثلًا): نفس القراءة لكن بنوع الملف الحقيقي */
  var typedUrls = {};
  function fetchBlobAs(fileId, mime, onProgress) {
    mime = mime || "application/octet-stream";
    return raw(fileId, onProgress).then(function (b) { return b.type === mime ? b : new Blob([b], { type: mime }); });
  }
  function blobUrlAs(fileId, mime, onProgress) {
    var k = fileId + "|" + mime;
    if (typedUrls[k]) { if (onProgress) onProgress(1); return Promise.resolve(typedUrls[k]); }
    return fetchBlobAs(fileId, mime, onProgress).then(function (b) { return (typedUrls[k] = URL.createObjectURL(b)); });
  }
  var urlCache = {};
  function blobUrl(fileId, onProgress) {
    if (urlCache[fileId]) { if (onProgress) onProgress(1); return Promise.resolve(urlCache[fileId]); }
    return fetchBlob(fileId, onProgress).then(function (b) { return (urlCache[fileId] = URL.createObjectURL(b)); });
  }
  /* هل الملف متخزّن عندنا خلاص (يفتح فورًا من غير شريط)؟ */
  function isCached(fileId) { return !!(urlCache[fileId] || (rawCache[fileId] && rawCache[fileId].done)); }

  /* ---------- تسجيل دخول Google (الأدمن) ---------- */
  var tokenClient = null, token = null, tokenExp = 0, pending = null;

  function loadGis() {
    return new Promise(function (resolve, reject) {
      if (window.google && google.accounts && google.accounts.oauth2) return resolve();
      var s = document.createElement("script");
      s.src = "https://accounts.google.com/gsi/client";
      s.async = true;
      s.onload = function () { resolve(); };
      s.onerror = function () { reject(new Error("GIS_LOAD")); };
      document.head.appendChild(s);
    });
  }

  /* لازم تتندهي من داخل ضغطة زرار (عشان المتصفح ما يمنعش نافذة Google) */
  function signIn() {
    if (token && Date.now() < tokenExp - 60000) return Promise.resolve(token);
    if (pending) return pending;
    pending = loadGis().then(function () {
      return new Promise(function (resolve, reject) {
        if (!tokenClient) {
          tokenClient = google.accounts.oauth2.initTokenClient({
            client_id: CLIENT_ID,
            scope: SCOPE,
            callback: function () { },
            error_callback: function (e) { if (tokenClient._rej) tokenClient._rej(new Error((e && e.type) || "AUTH")); }
          });
        }
        tokenClient._rej = reject;
        tokenClient.callback = function (resp) {
          if (resp && resp.access_token) {
            token = resp.access_token;
            tokenExp = Date.now() + (Number(resp.expires_in) || 3600) * 1000;
            resolve(token);
          } else reject(new Error((resp && resp.error) || "AUTH"));
        };
        tokenClient.requestAccessToken({ prompt: token ? "" : "select_account" });
      });
    });
    var clear = function () { pending = null; };
    pending.then(clear, clear);
    return pending;
  }
  function isSignedIn() { return !!token && Date.now() < tokenExp - 60000; }

  function gfetch(path, opts) {
    opts = opts || {};
    opts.headers = Object.assign({ Authorization: "Bearer " + token }, opts.headers || {});
    return fetch(path, opts).then(function (r) {
      if (!r.ok) return r.text().then(function (t) { throw new Error("DRIVE_" + r.status + ":" + t.slice(0, 200)); });
      return r.status === 204 ? null : r.json();
    });
  }

  /* ---------- فولدر المنصة ---------- */
  function folderOk(id) {
    return gfetch(API + "files/" + id + "?fields=id,trashed").then(function (f) { return !!f && !f.trashed; }).catch(function () { return false; });
  }
  function ensureFolder() {
    var saved = null;
    try { saved = localStorage.getItem("sn-drive-folder"); } catch (e) { }
    var remote = window.SNAuth && SNAuth.getDriveFolder ? SNAuth.getDriveFolder().catch(function () { return null; }) : Promise.resolve(null);
    return remote.then(function (rid) {
      var id = rid || saved;
      var check = id ? folderOk(id) : Promise.resolve(false);
      return check.then(function (ok) {
        if (ok) return id;
        var q = encodeURIComponent("name='" + FOLDER_NAME + "' and mimeType='application/vnd.google-apps.folder' and trashed=false");
        return gfetch(API + "files?q=" + q + "&fields=files(id)&spaces=drive").then(function (res) {
          if (res && res.files && res.files.length) return res.files[0].id;
          return gfetch(API + "files?fields=id", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name: FOLDER_NAME, mimeType: "application/vnd.google-apps.folder" })
          }).then(function (f) { return f.id; });
        }).then(function (fid) {
          try { localStorage.setItem("sn-drive-folder", fid); } catch (e) { }
          if (window.SNAuth && SNAuth.setDriveFolder) SNAuth.setDriveFolder(fid).catch(function () { });
          return fid;
        });
      });
    });
  }

  /* ---------- رفع ملف (resumable + شريط تقدّم) ---------- */
  function upload(file, onProgress) {
    if (!isSignedIn()) return Promise.reject(new Error("NOT_SIGNED_IN"));
    if (!file) return Promise.reject(new Error("NO_FILE"));
    var mime = file.type || "application/pdf";
    return ensureFolder().then(function (folderId) {
      return fetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&fields=id,name", {
        method: "POST",
        headers: {
          Authorization: "Bearer " + token,
          "Content-Type": "application/json; charset=UTF-8",
          "X-Upload-Content-Type": mime
        },
        body: JSON.stringify({ name: file.name, parents: [folderId], mimeType: mime })
      }).then(function (r) {
        if (!r.ok) throw new Error("DRIVE_INIT_" + r.status);
        var loc = r.headers.get("Location");
        if (!loc) throw new Error("DRIVE_NO_LOCATION");
        return new Promise(function (resolve, reject) {
          var x = new XMLHttpRequest();
          x.open("PUT", loc);
          x.setRequestHeader("Content-Type", mime);
          x.upload.onprogress = function (e) { if (e.lengthComputable && onProgress) onProgress(e.loaded / e.total); };
          x.onload = function () {
            if (x.status >= 200 && x.status < 300) {
              try { resolve(JSON.parse(x.responseText)); } catch (e) { reject(new Error("DRIVE_BAD_RESPONSE")); }
            } else reject(new Error("DRIVE_UPLOAD_" + x.status));
          };
          x.onerror = function () { reject(new Error("DRIVE_NETWORK")); };
          x.send(file);
        });
      });
    }).then(function (f) {
      return gfetch(API + "files/" + f.id + "/permissions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: "reader", type: "anyone" })
      }).then(function () { return { id: f.id, name: f.name || file.name }; });
    });
  }

  /* يرفع كائن JSON كملف على Drive (للأدمن) */
  function uploadJson(obj, name) {
    var f = new File([JSON.stringify(obj)], name || "questions.json", { type: "application/json" });
    return upload(f);
  }

  function remove(fileId) {
    if (!fileId || !isSignedIn()) return Promise.resolve(false);
    return gfetch(API + "files/" + encodeURIComponent(fileId), { method: "DELETE" }).then(function () { return true; }, function () { return false; });
  }

  window.SNDrive = { preload: loadGis, signIn: signIn, isSignedIn: isSignedIn, upload: upload, uploadJson: uploadJson, fetchJson: fetchJson, remove: remove, fetchBlob: fetchBlob, blobUrl: blobUrl, fetchBlobAs: fetchBlobAs, blobUrlAs: blobUrlAs, isCached: isCached };
})();

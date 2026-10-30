/* ==========================================================================
   sn-fast.js — تسريع قراءة البيانات الكبيرة (لوحة الأدمن)
   بيتحمّل بعد firebase.js مباشرة، وبيعدّل دوال SNAuth الموجودة من غير ما يلمس firebase.js:
   - قراءة عبر REST (مضغوطة gzip وأسرع بكتير من websocket للبيانات الكبيرة)،
     ولو اتأخرت 8 ثواني أو فشلت بيشغّل قراءة الـ SDK بالتوازي، وأول واحدة تخلص بتكسب.
   - مفيش تعليق للأبد: كل قراءة ليها مهلة (60 ث).
   - نفس الطلب لو اتطلب مرتين في نفس الوقت بيتبعت مرة واحدة.
   - كاش محلي (IndexedDB) لعرض اللوحة فورًا في المرات الجاية: SNAuth.cacheGet / cacheSet / cacheClear
   ========================================================================== */
(function () {
  "use strict";
  if (!window.SNAuth || typeof firebase === "undefined") return;
  var A = window.SNAuth;
  var db = firebase.database();
  var BASE = String((firebase.app().options || {}).databaseURL || "").replace(/\/+$/, "");
  var inflight = {};

  function withTimeout(p, ms, tag) {
    return new Promise(function (resolve, reject) {
      var t = setTimeout(function () { reject(new Error(tag || "TIMEOUT")); }, ms);
      p.then(function (v) { clearTimeout(t); resolve(v); }, function (e) { clearTimeout(t); reject(e); });
    });
  }

  function restGet(path, ms) {
    var ctl = typeof AbortController === "function" ? new AbortController() : null;
    var t = ctl ? setTimeout(function () { ctl.abort(); }, ms) : null;
    return fetch(BASE + "/" + path + ".json", { cache: "no-store", signal: ctl ? ctl.signal : undefined })
      .then(function (r) { if (!r.ok) throw new Error("REST_" + r.status); return r.json(); })
      .then(function (v) { if (t) clearTimeout(t); return v; }, function (e) { if (t) clearTimeout(t); throw e; });
  }

  function raceGet(path) {
    return new Promise(function (resolve, reject) {
      var done = false, fails = 0, sdkStarted = false, hedge;
      function ok(v) { if (!done) { done = true; clearTimeout(hedge); resolve(v); } }
      function bad(e) { fails++; if (fails >= 2 && !done) { done = true; clearTimeout(hedge); reject(e); } }
      function startSdk() {
        if (sdkStarted) return;
        sdkStarted = true;
        withTimeout(db.ref(path).get(), 60000, "SDK_TIMEOUT").then(function (s) { ok(s.exists() ? s.val() : null); }, bad);
      }
      hedge = setTimeout(startSdk, 8000);
      restGet(path, 60000).then(ok, function (e) { startSdk(); bad(e); });
    });
  }

  /* opts.fresh = تجاهل الطلب الجاري وابعت طلب جديد (بعد تعديل/تحديث يدوي) */
  function fastGet(path, opts) {
    if (!(opts && opts.fresh) && inflight[path]) return inflight[path];
    var p = raceGet(path);
    inflight[path] = p;
    var clear = function () { if (inflight[path] === p) delete inflight[path]; };
    p.then(clear, clear);
    return p;
  }

  A.fastGet = fastGet;
  A.fetchAllUsers = function (o) { return fastGet("users", o).then(function (v) { return v ? Object.values(v) : []; }); };
  A.fetchAllGrades = function (o) { return fastGet("grades", o).then(function (v) { return v || {}; }); };
  A.fetchAllUserData = function (o) { return fastGet("userData", o).then(function (v) { return v || {}; }); };
  A.fetchEssaySubmissions = function (o) { return fastGet("essaySubmissions", o).then(function (v) { return v ? Object.values(v) : []; }); };

  /* ---------- كاش محلي (IndexedDB) ---------- */
  var IDB = "sn-admin-cache";
  function idb() {
    return new Promise(function (res, rej) {
      try {
        var r = indexedDB.open(IDB, 1);
        r.onupgradeneeded = function () { r.result.createObjectStore("kv"); };
        r.onsuccess = function () { res(r.result); };
        r.onerror = function () { rej(r.error); };
      } catch (e) { rej(e); }
    });
  }
  A.cacheGet = function (k) {
    return idb().then(function (d) {
      return new Promise(function (res) {
        var q = d.transaction("kv").objectStore("kv").get(k);
        q.onsuccess = function () { res(q.result || null); };
        q.onerror = function () { res(null); };
      });
    }).catch(function () { return null; });
  };
  A.cacheSet = function (k, v) {
    return idb().then(function (d) {
      return new Promise(function (res) {
        var t = d.transaction("kv", "readwrite");
        t.objectStore("kv").put(v, k);
        t.oncomplete = t.onerror = t.onabort = function () { res(); };
      });
    }).catch(function () { });
  };
  A.cacheClear = function () {
    try { indexedDB.deleteDatabase(IDB); } catch (e) { }
  };
})();

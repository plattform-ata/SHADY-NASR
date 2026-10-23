/* ==========================================================================
   grade-access.js — أكواد الصفوف الدراسية (كود الدخول لكل صف)
   - الأدمن بيحدد/بيعدّل/بيحفظ كود لكل صف من الإعدادات > "أكواد الصفوف".
   - الطالب: قبل ما يدخل لوحته (بعد تسجيل الدخول، أو إنشاء حساب، أو إضافة/تبديل حساب،
     أو لما المنصة تكون مقفولة) لازم يكتب كود صفه الدراسي المسجّل بيه.
   - الكود نفسه مش متخزّن للطلاب، بس بصمته (SHA-256 + salt) في Firebase: gradeAccessCodes/<grade>
     والأدمن بيحتفظ بالنص الأصلي في adminSettings.gradeCodes عشان يشوفه من أي جهاز.
   - لو مفيش كود محفوظ لصف معيّن: الصف ده بيدخل عادي (الميزة مش مفعّلة عليه).
   يتحمّل في studenti.html (بوابة الطالب) وفي admin.html (واجهة الحفظ) بعد firebase.js.
   ========================================================================== */
(function () {
  "use strict";

  var PATH = "gradeAccessCodes";
  var GRADES = ["prep1", "prep2", "prep3", "secondary1", "secondary2", "secondary3"];
  var NAMES = {
    prep1: "الصف الأول الإعدادي", prep2: "الصف الثاني الإعدادي", prep3: "الصف الثالث الإعدادي",
    secondary1: "الصف الأول الثانوي", secondary2: "الصف الثاني الثانوي", secondary3: "الصف الثالث الثانوي"
  };
  var OK_KEY = "shadynasr-gc-ok";
  var STAMP_KEY = "shadynasr-login-at";
  var HAS_KEY = "shadynasr-gc-has:";

  /* ---------- أدوات مشتركة ---------- */
  function normalize(c) { return String(c || "").trim().toUpperCase().replace(/[\s\-]/g, ""); }
  function isValid(c) { return /^[A-Z0-9]{4,12}$/.test(c); }
  function db() { try { return window.firebase && firebase.apps && firebase.apps.length ? firebase.database() : null; } catch (e) { return null; } }
  function toHex(buf) { return Array.prototype.map.call(new Uint8Array(buf), function (b) { return ("0" + b.toString(16)).slice(-2); }).join(""); }
  function newSalt() { var a = new Uint8Array(12); crypto.getRandomValues(a); return toHex(a); }
  async function hashCode(grade, code, salt) {
    if (!(window.crypto && crypto.subtle)) throw new Error("NO_CRYPTO");
    var data = new TextEncoder().encode(salt + ":" + grade + ":" + normalize(code));
    return toHex(await crypto.subtle.digest("SHA-256", data));
  }
  function randomCode() {
    var chars = "23456789ABCDEFGHJKMNPQRSTUVWXYZ"; // من غير الحروف المتشابهة (0/O و1/I/L)
    var buf = new Uint32Array(6); crypto.getRandomValues(buf);
    return Array.prototype.map.call(buf, function (n) { return chars[n % chars.length]; }).join("");
  }

  /* ---------- واجهة الأدمن: حفظ وقراءة ---------- */
  async function loadAdmin() {
    var st = await SNAuth.getAdminSettings();
    return (st && st.gradeCodes) || {};
  }
  /* codes: { prep1: "ABC123", ... } — الفاضي = الصف ده من غير كود */
  async function saveAll(codes) {
    var d = db();
    if (!d) throw new Error("NO_DB");
    var plain = {}, remote = {}, now = Date.now();
    for (var i = 0; i < GRADES.length; i++) {
      var g = GRADES[i], c = normalize(codes[g]);
      if (!c) continue;
      if (!isValid(c)) throw new Error("INVALID:" + g);
      var salt = newSalt();
      plain[g] = c;
      remote[g] = { hash: await hashCode(g, c, salt), salt: salt, updatedAt: now };
    }
    await d.ref(PATH).set(Object.keys(remote).length ? remote : null);
    await SNAuth.saveAdminSettings({ gradeCodes: plain });
    return plain;
  }

  /* ---------- بوابة الطالب ---------- */
  async function fetchGrade(grade) {
    var d = db();
    if (!d) throw new Error("NO_DB");
    var snap = await d.ref(PATH + "/" + grade).once("value");
    var v = snap.val();
    return v && v.hash && v.salt ? v : null;
  }
  async function verify(node, grade, code) {
    return (await hashCode(grade, code, node.salt)) === node.hash;
  }

  function initGate() {
    if (!/studenti(\.html)?$/i.test(location.pathname)) return;
    var session = null;
    try { session = JSON.parse(localStorage.getItem("shadynasr-current-user")); } catch (e) { session = null; }
    if (!session || !session.id || session.role === "admin" || !NAMES[session.grade]) return;

    var html = document.documentElement;
    var screen = null, node = null, fails = 0, blockedUntil = 0, busy = false;
    var grade = session.grade;
    var marker = function () {
      var stamp = "0"; try { stamp = localStorage.getItem(STAMP_KEY) || "0"; } catch (e) { }
      return session.id + ":" + stamp + ":" + grade;
    };
    var verified = function () { try { return localStorage.getItem(OK_KEY) === marker(); } catch (e) { return false; } };
    var markOk = function () { try { localStorage.setItem(OK_KEY, marker()); } catch (e) { } };
    if (verified()) return;

    html.classList.add("sn-gc-pending");

    function injectStyle() {
      if (document.getElementById("snGcStyle")) return;
      var st = document.createElement("style");
      st.id = "snGcStyle";
      st.textContent =
        "#snGradeGate{position:fixed;inset:0;z-index:2147483001;display:flex;align-items:center;justify-content:center;padding:20px;overflow:auto;background:var(--bg,#f4eee0);color:var(--text,#1c2b3a);font-family:Tajawal,Cairo,system-ui,sans-serif}" +
        "#snGradeGate .gc{width:min(440px,100%);background:var(--surface-glass,#fff);border:1px solid var(--surface-glass-border,rgba(0,0,0,.1));border-radius:22px;padding:26px 22px;box-shadow:0 20px 60px rgba(0,0,0,.18);text-align:center}" +
        "#snGradeGate .gc__ico{width:64px;height:64px;margin:0 auto 12px;border-radius:50%;display:grid;place-items:center;background:var(--accent,#c8902e);color:#fff}" +
        "#snGradeGate .gc__ico svg{width:30px;height:30px}" +
        "#snGradeGate h2{margin:0 0 6px;font-family:Cairo,Tajawal,sans-serif;font-size:1.3rem}" +
        "#snGradeGate p{margin:0 0 14px;opacity:.85;line-height:1.7;font-size:.95rem}" +
        "#snGradeGate .gc__grade{display:inline-block;margin:0 0 14px;padding:5px 14px;border-radius:999px;background:rgba(127,127,127,.14);font-weight:700;font-size:.9rem}" +
        "#snGradeGate .gc__code{width:100%;box-sizing:border-box;text-align:center;direction:ltr;text-transform:uppercase;letter-spacing:.3em;font-size:1.4rem;font-weight:700;padding:13px 10px;border-radius:14px;border:1.5px solid var(--surface-glass-border,rgba(0,0,0,.2));background:transparent;color:inherit;font-family:inherit}" +
        "#snGradeGate .gc__code:focus{outline:2px solid var(--accent,#c8902e);outline-offset:1px}" +
        "#snGradeGate .gc__btn{width:100%;margin-top:10px;padding:13px;border-radius:14px;border:0;cursor:pointer;font:inherit;font-weight:700;font-size:1rem;background:var(--accent,#c8902e);color:#fff}" +
        "#snGradeGate .gc__btn:disabled{opacity:.5;cursor:not-allowed}" +
        "#snGradeGate .gc__err{color:#d23b3b;font-weight:700;margin:10px 0 0;min-height:1.2em;font-size:.92rem}" +
        "#snGradeGate .gc__out{margin-top:10px;background:none;border:0;color:inherit;opacity:.7;text-decoration:underline;cursor:pointer;font:inherit;font-size:.85rem}";
      document.head.appendChild(st);
    }

    var $ = function (s) { return screen && screen.querySelector(s); };
    var setErr = function (m) { var e = $("#snGcErr"); if (e) e.textContent = m || ""; };

    function build(state) {
      injectStyle();
      if (screen) screen.remove();
      screen = document.createElement("div");
      screen.id = "snGradeGate";
      screen.dir = "rtl";
      screen.setAttribute("role", "dialog");
      screen.setAttribute("aria-modal", "true");
      var ico = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3 5 6v6c0 4.5 3 7.5 7 9 4-1.5 7-4.5 7-9V6Z"/><path d="m9 12 2 2 4-4"/></svg>';
      var body = state === "loading"
        ? "<p>ثواني بنجهّز التحقق...</p>"
        : state === "error"
          ? '<p>تعذر الاتصال بالخادم للتحقق من كود الصف. اتأكد من النت وجرّب تاني.</p><button class="gc__btn" id="snGcRetry" type="button">إعادة المحاولة</button>'
          : '<p>اكتب كود صفك الدراسي اللي إدارة المنصة إدّتهولك عشان تدخل.</p>' +
            '<input class="gc__code" id="snGcCode" type="text" maxlength="12" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="••••••" aria-label="كود الصف" />' +
            '<button class="gc__btn" id="snGcGo" type="button" disabled>دخول</button>';
      screen.innerHTML = '<div class="gc"><div class="gc__ico" aria-hidden="true">' + ico + "</div><h2>كود الصف الدراسي</h2>" +
        '<span class="gc__grade">' + NAMES[grade] + "</span>" + body +
        '<p class="gc__err" id="snGcErr" role="alert"></p><button class="gc__out" id="snGcOut" type="button">تسجيل الخروج</button></div>';
      document.body.appendChild(screen);
      $("#snGcOut").addEventListener("click", logout);
      var retry = $("#snGcRetry"); if (retry) retry.addEventListener("click", start);
      var input = $("#snGcCode"), go = $("#snGcGo");
      if (input) {
        input.addEventListener("input", function () {
          input.value = normalize(input.value).replace(/[^A-Z0-9]/g, "").slice(0, 12);
          go.disabled = input.value.length < 4; setErr("");
        });
        input.addEventListener("keydown", function (e) { if (e.key === "Enter" && !go.disabled) submit(input.value); });
        go.addEventListener("click", function () { submit(input.value); });
        setTimeout(function () { try { input.focus(); } catch (e) { } }, 50);
      }
    }

    function release() {
      html.classList.remove("sn-gc-pending");
      if (screen) { screen.remove(); screen = null; }
    }
    function logout() {
      try { localStorage.removeItem("shadynasr-auth"); localStorage.removeItem("shadynasr-current-user"); } catch (e) { }
      window.location.replace("index.html");
    }

    async function submit(raw) {
      if (busy || !node) return;
      var wait = blockedUntil - Date.now();
      if (wait > 0) { setErr("محاولات كتير غلط. جرّب تاني بعد " + Math.ceil(wait / 1000) + " ثانية."); return; }
      busy = true;
      try {
        var ok = false;
        try { ok = await verify(node, grade, raw); } catch (e) { setErr("المتصفح ده مش بيدعم التحقق الآمن، جرّب Chrome أو Safari."); return; }
        if (!ok) {
          fails++;
          if (fails >= 5) { fails = 0; blockedUntil = Date.now() + 60000; setErr("الكود غلط. استنى دقيقة قبل المحاولة الجاية."); }
          else setErr("الكود غلط، راجع كود صفك أو اسأل الإدارة.");
          var i = $("#snGcCode"); if (i) { i.value = ""; $("#snGcGo").disabled = true; }
          return;
        }
        markOk(); release();
      } finally { busy = false; }
    }

    async function waitForFirebase() {
      for (var i = 0; i < 40; i++) { if (db()) return true; await new Promise(function (r) { setTimeout(r, 200); }); }
      return false;
    }

    async function start() {
      var cached = null; try { cached = localStorage.getItem(HAS_KEY + grade); } catch (e) { }
      if (!screen) build("loading");
      try {
        if (!(await waitForFirebase())) throw new Error("NO_DB");
        node = await fetchGrade(grade);
        try { localStorage.setItem(HAS_KEY + grade, node ? "1" : "0"); } catch (e) { }
        if (!node) { markOk(); release(); return; } // مفيش كود للصف ده
        build("code");
      } catch (e) {
        if (cached === "0") { release(); return; } // آخر مرة كان من غير كود وإحنا أوفلاين
        build("error");
      }
    }

    /* تبديل/إضافة حساب من تبويب تاني: نفحص من جديد */
    window.addEventListener("storage", function (e) {
      if (e.key === "shadynasr-current-user" || e.key === STAMP_KEY) window.location.reload();
    });

    if (document.body) start(); else document.addEventListener("DOMContentLoaded", start);
  }

  window.SNGradeAccess = {
    GRADES: GRADES, NAMES: NAMES, normalize: normalize, isValid: isValid,
    randomCode: randomCode, loadAdmin: loadAdmin, saveAll: saveAll
  };
  initGate();
})();

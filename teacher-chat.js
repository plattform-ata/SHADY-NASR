/* ==========================================================================
   teacher-chat.js — شات المدرس والطالب بشكل واتساب (صفحة كاملة)
   Firebase Realtime Database (مشروع shady-nasr-chat) — الرسايل بتتمسح بعد أسبوع
   - الطالب: بيفتح محادثته من زرار + (hub.js) أو window.SNTeacherChat.open()
   - المدرس: زرار شات في الأدمن بيفتح صندوق الرسايل (قايمة الطلبة + المحادثة)
   ========================================================================== */
(function () {
  "use strict";

  var CFG = {
    apiKey: "AIzaSyBQLKT30wwTp_uqefQBaF8_fU-_98cUChE",
    authDomain: "shady-nasr-chat.firebaseapp.com",
    databaseURL: "https://shady-nasr-chat-default-rtdb.firebaseio.com",
    projectId: "shady-nasr-chat",
    storageBucket: "shady-nasr-chat.firebasestorage.app",
    messagingSenderId: "892419799693",
    appId: "1:892419799693:web:21dd330e27e792101d40c4"
  };

  /* false = من غير Firebase Authentication (زي الشات القديم، بس محتاج الـ Rules المفتوحة في database.rules.json)
     true  = بحماية أقوى، محتاج تفعّل Authentication ← Anonymous وتستخدم database.rules.secure.json */
  var USE_AUTH = false;

  var WEEK = 7 * 24 * 60 * 60 * 1000;
  var MAX_LEN = 1000;
  var SDK = "https://www.gstatic.com/firebasejs/10.12.2/";
  var FLAG = "snchat-claimed-", TFLAG = "snchat-teacher-", PURGE_KEY = "snchat-purged-at";

  /* ---------- المستخدم الحالي ---------- */
  var me = null;
  try { me = JSON.parse(localStorage.getItem("shadynasr-current-user")); } catch (e) {}
  if (!me || !me.id) return;
  var IS_TEACHER = me.role === "admin";
  var TID = String(me.id).replace(/[.#$\[\]\/]/g, "_");
  var MINE = IS_TEACHER ? "t" : "s";
  var OTHER_READ = IS_TEACHER ? "sReadAt" : "tReadAt";

  /* ---------- Firebase ---------- */
  var app = null, auth = null, db = null, fbReady = null;

  function loadScript(src) {
    return new Promise(function (res, rej) {
      var s = document.createElement("script");
      s.src = src; s.onload = res;
      s.onerror = function () { rej(new Error("تعذر تحميل " + src)); };
      document.head.appendChild(s);
    });
  }
  function ensureFirebase() {
    if (fbReady) return fbReady;
    var p = Promise.resolve()
      .then(function () { return window.firebase && firebase.initializeApp ? 0 : loadScript(SDK + "firebase-app-compat.js"); })
      .then(function () { return firebase.database ? 0 : loadScript(SDK + "firebase-database-compat.js"); })
      .then(function () { return !USE_AUTH || firebase.auth ? 0 : loadScript(SDK + "firebase-auth-compat.js"); })
      .then(function () {
        try { app = firebase.app("shady-chat"); } catch (e) { app = firebase.initializeApp(CFG, "shady-chat"); }
        auth = USE_AUTH ? app.auth() : null;
        db = app.database();
        if (!IS_TEACHER) db.goOffline();
      });
    fbReady = p;
    p.catch(function () { if (fbReady === p) fbReady = null; });
    return p;
  }
  function waitAuth() {
    return new Promise(function (res) { var un = auth.onAuthStateChanged(function (u) { un(); res(u); }); });
  }
  function noop() {}
  function denied(e) { return !!e && (e.code === "PERMISSION_DENIED" || /permission_denied/i.test(e.message || "")); }
  function TS() { return firebase.database.ServerValue.TIMESTAMP; }
  function INC(n) { return firebase.database.ServerValue.increment(n); }

  /* رسالة مفهومة لكل خطأ */
  function explain(e) {
    var c = (e && (e.code || e.message)) || "";
    var soon = "الشات لسه بيتجهز. جرّب كمان شوية أو كلّم المدرس.";
    if (/configuration-not-found/.test(c)) return IS_TEACHER ? "خدمة Authentication لسه متفعّلتش في مشروع Firebase. افتح Authentication واضغط Get started، وبعدين فعّل Anonymous من Sign-in method." : soon;
    if (/operation-not-allowed|admin-restricted/.test(c)) return IS_TEACHER ? "فعّل Anonymous من Authentication ← Sign-in method." : soon;
    if (c === "no-key") return "مفتاح المدرس مش متحط في admin.html.";
    if (c === "linked") return "المحادثة دي مربوطة بجهاز تاني. اطلب من المدرس يفك الربط وجرّب تاني.";
    if (!USE_AUTH && denied(e)) return IS_TEACHER ? "الـ Rules في Firebase رافضة الوصول. الصق ملف database.rules.json في Realtime Database ← Rules واضغط Publish." : soon;
    if (denied(e)) return IS_TEACHER ? "المفتاح مش مطابق للي في الداتابيز. راجع secrets/teacher والـ Rules." : "المحادثة دي مربوطة بجهاز تاني. اطلب من المدرس يفك الربط.";
    if (/network/.test(c)) return "مفيش اتصال بالنت.";
    return "مقدرناش نوصّل الشات. اتأكد من النت وجرّب تاني.";
  }

  /* ---------- أدوات ---------- */
  function h(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  function fmtTime(t) { try { return new Date(t).toLocaleTimeString("ar-EG", { hour: "numeric", minute: "2-digit" }); } catch (e) { return ""; } }
  function dayKey(t) { var d = new Date(t); return d.getFullYear() + "-" + d.getMonth() + "-" + d.getDate(); }
  function dayLabel(t) {
    var now = Date.now();
    if (dayKey(t) === dayKey(now)) return "النهارده";
    if (dayKey(t) === dayKey(now - 86400000)) return "امبارح";
    try { return new Date(t).toLocaleDateString("ar-EG", { weekday: "long", day: "numeric", month: "long" }); } catch (e) { return ""; }
  }
  function listTime(t) {
    if (!t) return "";
    if (dayKey(t) === dayKey(Date.now())) return fmtTime(t);
    if (dayKey(t) === dayKey(Date.now() - 86400000)) return "امبارح";
    try { return new Date(t).toLocaleDateString("ar-EG", { day: "numeric", month: "numeric" }); } catch (e) { return ""; }
  }
  function isMobile() { return window.matchMedia && matchMedia("(max-width: 899px)").matches; }

  var TICK = {
    clock: '<svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="5.8" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M8 4.8V8l2 1.4" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>',
    sent: '<svg viewBox="0 0 18 11" aria-hidden="true"><path d="M1 5.8 4.5 9.3 12.5 1.5" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    read: '<svg viewBox="0 0 18 11" aria-hidden="true"><path d="M1 5.8 4.5 9.3 12.5 1.5M5.5 5.8 9 9.3 17 1.5" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>'
  };
  var IC = {
    back: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 5l7 7-7 7"/></svg>',
    close: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>',
    send: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M22 2 11 13M22 2l-7 20-4-9-9-4z"/></svg>',
    dots: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="12" cy="5" r="1.9"/><circle cx="12" cy="12" r="1.9"/><circle cx="12" cy="19" r="1.9"/></svg>',
    search: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="6.5"/><path d="M20 20l-4-4"/></svg>',
    down: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>',
    image: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="3" fill="currentColor" fill-opacity=".14"/><circle cx="9" cy="9.5" r="1.8"/><path d="M4 17.5 9.5 12l4 4 2.5-2.5L20 17.5"/></svg>',
    download: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 4v11M7 11l5 5 5-5M5 20h14"/></svg>',
    lock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>',
    unlink: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10 13a5 5 0 0 0 7 0l2-2a5 5 0 0 0-7-7l-1 1M14 11a5 5 0 0 0-7 0l-2 2a5 5 0 0 0 7 7l1-1M4 4l16 16"/></svg>',
    trash: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/></svg>',
    teacher: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="9" cy="9.5" r="3.2" fill="currentColor" fill-opacity=".25"/><path d="M3 20.5a6 6 0 0 1 12 0" fill="currentColor" fill-opacity=".25"/><path d="M14.8 3.5h4.4A1.8 1.8 0 0 1 21 5.3v3.4a1.8 1.8 0 0 1-1.8 1.8h-1.4l-2.2 2v-2h-.8a1.8 1.8 0 0 1-1.8-1.8V5.3a1.8 1.8 0 0 1 1.8-1.8z" fill="currentColor" fill-opacity=".25"/></svg>',
    chat: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 5.5h10a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2H9.5L6 17.5v-3H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2z" fill="currentColor" fill-opacity=".22"/><path d="M19 9.5h1a2 2 0 0 1 2 2v4.5a2 2 0 0 1-2 2h-.5v2.5L16 18h-3.5"/></svg>',
    warn: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3 2.5 20h19z" fill="currentColor" fill-opacity=".18"/><path d="M12 10v4.5M12 17.5h.01"/></svg>'
  };

  /* ---------- التصميم ---------- */
  var css = [
    "html.wa-lock,html.wa-lock body{overflow:hidden}",

    /* ألوان وقيم صفحة الشات: نفس لغة صفحة الـ AI في المنصة */
    ".wa,.wa-fab{--acc:var(--accent,#2c8097);--acc-2:color-mix(in srgb,var(--acc) 85%,#fff);--acc-1:color-mix(in srgb,var(--acc) 62%,#000);--c-bg:#fff;--c-side:#f0f4f9;--c-field:#f0f4f9;--c-ink:#1f1f1f;--c-mute:#5f6368;--c-line:rgba(0,0,0,.1);--c-hover:rgba(0,0,0,.06);--c-active:color-mix(in srgb,var(--acc) 16%,transparent);--c-card:#fff;--c-border:rgba(16,24,40,.1);--c-shadow:0 1px 2px rgba(16,24,40,.05),0 8px 24px rgba(16,24,40,.06)}",
    ":root[data-theme='dark'] .wa,:root[data-theme='dark'] .wa-fab{--c-bg:#131314;--c-side:#1e1f20;--c-field:#1e1f20;--c-ink:#e3e3e3;--c-mute:#9aa0a6;--c-line:rgba(255,255,255,.12);--c-hover:rgba(255,255,255,.08);--c-active:color-mix(in srgb,var(--acc) 30%,transparent);--c-card:#1b1c1e;--c-border:rgba(255,255,255,.1);--c-shadow:0 1px 2px rgba(0,0,0,.4),0 8px 24px rgba(0,0,0,.35)}",

    /* زرار المدرس العايم في الأدمن */
    ".wa-fab{position:fixed;left:max(16px,env(safe-area-inset-left));bottom:calc(16px + env(safe-area-inset-bottom,0px));z-index:40;width:54px;height:54px;border-radius:50%;border:2px solid var(--bg);background:linear-gradient(135deg,var(--acc-2),var(--acc-1));color:#fff;display:grid;place-items:center;cursor:pointer;padding:0;box-shadow:0 8px 22px color-mix(in srgb,var(--acc) 38%,transparent);transition:transform .2s var(--ease,ease)}",
    ".wa-fab:hover{transform:scale(1.07)}",
    ".wa-fab:focus-visible{outline:2px solid var(--acc);outline-offset:3px}",
    ".wa-fab svg{width:27px;height:27px}",
    "@media (max-width:979px){.wa-fab{bottom:calc(96px + env(safe-area-inset-bottom,0px));z-index:55}}",
    ".wa-badge{position:absolute;top:-5px;inset-inline-end:-5px;min-width:20px;height:20px;padding:0 5px;box-sizing:border-box;border-radius:10px;background:var(--ink);color:var(--bg);border:2px solid var(--bg);font-size:.68rem;font-weight:800;display:grid;place-items:center}",
    ".wa-badge[hidden]{display:none}",

    /* الصفحة */
    ".wa{position:fixed;left:0;right:0;top:0;bottom:0;z-index:1300;background:var(--c-bg);color:var(--c-ink);direction:rtl;font-family:inherit;animation:wa-in .22s ease}",
    ".wa[hidden]{display:none}",
    "@keyframes wa-in{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:none}}",
    ".wa *{box-sizing:border-box}",
    ".wa-app{display:flex;width:100%;height:100%;overflow:hidden}",
    ".wa-side{flex:none;width:min(360px,34vw);display:flex;flex-direction:column;background:var(--c-side);border-inline-end:1px solid var(--c-border);min-height:0}",
    ".wa-main{flex:1;min-width:0;position:relative;display:flex;flex-direction:column;min-height:0;background:var(--c-bg)}",
    ".wa-chat{flex:1;min-height:0;display:flex;flex-direction:column;position:relative}",
    ".wa-main[data-has='0'] .wa-chat{display:none}",
    ".wa-main[data-has='1'] .wa-empty{display:none}",

    /* الهيدر */
    ".wa-bar{flex:none;display:flex;align-items:center;gap:10px;min-height:62px;padding:8px 12px;padding-top:calc(8px + env(safe-area-inset-top,0px));background:var(--c-bg);color:var(--c-ink);border-bottom:1px solid var(--c-border)}",
    ".wa-side .wa-bar{background:transparent}",
    ".wa-ic{flex:none;width:42px;height:42px;border-radius:50%;border:0;background:transparent;color:var(--c-ink);cursor:pointer;display:grid;place-items:center;text-decoration:none;transition:background .15s ease}",
    ".wa-ic:hover{background:var(--c-hover)}",
    ".wa-ic:focus-visible{outline:2px solid var(--acc);outline-offset:-2px}",
    ".wa-ic svg{width:22px;height:22px}",
    ".wa-ic[hidden]{display:none}",
    ".wa-av{flex:none;width:42px;height:42px;border-radius:50%;display:grid;place-items:center;background:var(--c-active);color:var(--acc);font-family:var(--font-display);font-weight:800;font-size:1.05rem}",
    ".wa-av svg{width:24px;height:24px}",
    ".wa-who{flex:1;min-width:0;line-height:1.4}",
    ".wa-who strong{display:block;font-size:1.02rem;font-weight:800;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}",
    ".wa-who small{display:block;font-size:.76rem;color:var(--c-mute);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}",
    ".wa-title{flex:1;margin:0;padding-inline-start:4px;font-family:var(--font-display);font-size:1.1rem;font-weight:800}",

    /* قايمة ⋮ */
    ".wa-menuwrap{position:relative}",
    ".wa-menu{position:absolute;top:calc(100% + 6px);inset-inline-end:0;z-index:5;min-width:210px;padding:6px;border-radius:16px;background:var(--c-card);color:var(--c-ink);border:1px solid var(--c-border);box-shadow:var(--c-shadow)}",
    ".wa-menu[hidden]{display:none}",
    ".wa-menu button{display:flex;align-items:center;gap:10px;width:100%;padding:10px 12px;border:0;border-radius:10px;background:transparent;color:inherit;font:inherit;font-size:.9rem;font-weight:700;cursor:pointer;text-align:start;transition:background .12s ease}",
    ".wa-menu button:hover{background:var(--c-hover)}",
    ".wa-menu svg{width:18px;height:18px;color:var(--c-mute)}",

    /* قايمة الطلبة */
    ".wa-search{flex:none;padding:12px 12px 6px}",
    ".wa-search label{display:flex;align-items:center;gap:10px;height:44px;padding:0 16px;border-radius:999px;background:var(--c-card);border:1px solid var(--c-border);color:var(--c-mute);transition:border-color .15s ease,box-shadow .15s ease}",
    ".wa-search label:focus-within{border-color:var(--acc);box-shadow:0 0 0 3px color-mix(in srgb,var(--acc) 18%,transparent)}",
    ".wa-search svg{width:18px;height:18px;flex:none}",
    ".wa-search input{flex:1;min-width:0;border:0;outline:0;background:transparent;color:var(--c-ink);font:inherit;font-size:.92rem}",
    ".wa-threads{flex:1;min-height:0;overflow-y:auto;overscroll-behavior:contain;padding:6px 8px;display:flex;flex-direction:column;gap:2px;scrollbar-width:thin;scrollbar-color:var(--c-line) transparent}",
    ".wa-th{display:flex;align-items:center;gap:12px;width:100%;padding:10px 12px;border:0;background:transparent;color:inherit;font:inherit;text-align:start;cursor:pointer;border-radius:16px;transition:background .12s ease}",
    ".wa-th:hover{background:var(--c-hover)}",
    ".wa-th.is-active{background:var(--c-active)}",
    ".wa-th .wa-av{width:48px;height:48px}",
    ".wa-tm{flex:1;min-width:0}",
    ".wa-tn{display:flex;align-items:center;gap:8px;font-weight:800;font-size:.95rem}",
    ".wa-tn span{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}",
    ".wa-tn em{flex:none;font-style:normal;font-size:.66rem;font-weight:700;padding:1px 9px;border-radius:99px;background:var(--c-hover);color:var(--c-mute)}",
    ".wa-tl{display:flex;align-items:center;gap:4px;margin-top:3px;font-size:.84rem;color:var(--c-mute);min-width:0}",
    ".wa-tl span{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}",
    ".wa-tl .wa-tick{flex:none}",
    ".wa-th.is-unread .wa-tl{color:var(--c-ink);font-weight:700}",
    ".wa-tr{flex:none;display:flex;flex-direction:column;align-items:flex-end;gap:6px;font-size:.7rem;color:var(--c-mute)}",
    ".wa-th.is-unread .wa-tr>span:first-child{color:var(--acc);font-weight:800}",
    ".wa-cnt{min-width:21px;height:21px;padding:0 6px;border-radius:11px;background:linear-gradient(135deg,var(--acc-2),var(--acc-1));color:#fff;font-weight:800;font-size:.72rem;display:grid;place-items:center}",

    ".wa-empty{flex:1;display:grid;place-content:center;justify-items:center;gap:12px;padding:30px;text-align:center;color:var(--c-mute)}",
    ".wa-empty .wa-bigico{width:96px;height:96px;border-radius:50%;display:grid;place-items:center;background:var(--c-active);color:var(--acc)}",
    ".wa-empty .wa-bigico svg{width:48px;height:48px}",
    ".wa-empty h3{margin:0;font-family:var(--font-display);font-size:1.3rem;color:var(--c-ink)}",
    ".wa-empty p{margin:0;font-size:.92rem;line-height:1.8}",

    /* الرسايل */
    ".wa-chat>.wa-bar{position:relative;z-index:2}",
    ".wa-msgs{position:relative;flex:1;min-height:0;overflow-y:auto;overscroll-behavior:contain;padding:12px 14px;display:flex;flex-direction:column;scrollbar-width:thin;scrollbar-color:var(--c-line) transparent}",
    ".wa-note{align-self:center;display:flex;align-items:center;gap:7px;max-width:92%;margin:6px 0 12px;padding:7px 16px;border-radius:999px;background:var(--c-field);color:var(--c-mute);font-size:.76rem;font-weight:700;line-height:1.6;text-align:center}",
    ".wa-note svg{width:14px;height:14px;flex:none}",
    ".wa-day{align-self:center;margin:14px 0 8px;padding:5px 16px;border-radius:999px;background:var(--c-field);color:var(--c-mute);font-size:.76rem;font-weight:700}",
    ".wa-m{display:flex;max-width:82%;margin-top:3px;animation:wa-pop .2s ease}",
    "@keyframes wa-pop{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}",
    ".wa-m.has-tail{margin-top:10px}",
    ".wa-m.is-own{align-self:flex-start}",
    ".wa-m.is-other{align-self:flex-end}",
    ".wa-b{position:relative;padding:8px 14px 7px;border-radius:20px;font-size:.97rem;line-height:1.7;min-width:70px}",
    ".wa-m.is-own .wa-b{background:color-mix(in srgb,var(--acc) 12%,var(--c-bg));border:1px solid color-mix(in srgb,var(--acc) 22%,transparent)}",
    ".wa-m.is-other .wa-b{background:var(--c-card);border:1px solid var(--c-border)}",
    ".wa-m.is-own.is-end .wa-b{border-bottom-right-radius:6px}",
    ".wa-m.is-other.is-end .wa-b{border-bottom-left-radius:6px}",
    ".wa-txt{white-space:pre-wrap;overflow-wrap:anywhere}",
    ".wa-b::after{content:'';display:table;clear:both}",
    ".wa-meta{float:inline-end;display:inline-flex;align-items:center;gap:4px;margin-inline-start:12px;margin-top:6px;font-size:.68rem;color:var(--c-mute);line-height:1}",
    ".wa-tick{display:inline-flex;color:var(--c-mute)}",
    ".wa-tick svg{width:15px;height:11px}",
    ".wa-tick.is-clock svg{width:12px;height:12px}",
    ".wa-tick.is-read{color:var(--acc)}",
    ".wa-hint{align-self:center;margin-top:10px;padding:7px 18px;border-radius:999px;background:var(--c-field);color:var(--c-mute);font-size:.82rem;font-weight:700;text-align:center}",

    /* الصور */
    ".wa-b.has-img{padding:4px}",
    ".wa-b.has-img .wa-txt{display:block;padding:6px 9px 0}",
    ".wa-b.has-img .wa-meta{margin-inline-end:6px;margin-bottom:3px}",
    ".wa-figure{display:block;position:relative;width:220px;height:180px;max-width:100%;padding:0;border:0;border-radius:16px;overflow:hidden;background:var(--c-hover);cursor:zoom-in}",
    ".wa-img{display:block;width:100%;height:100%;object-fit:cover}",
    ".wa-b.has-img.no-cap .wa-meta{position:absolute;inset-inline-end:10px;bottom:9px;float:none;margin:0;padding:3px 9px;border-radius:999px;background:rgba(0,0,0,.5);color:#fff}",
    ".wa-b.has-img.no-cap .wa-tick{color:#fff}",
    ".wa-b.has-img.no-cap .wa-tick.is-read{color:var(--acc-2)}",

    /* حالات: تحميل / خطأ */
    ".wa-state{position:relative;flex:1;display:grid;place-content:center;justify-items:center;gap:10px;padding:24px;text-align:center;color:var(--c-mute);font-size:.9rem;line-height:1.8}",
    ".wa-state[hidden]{display:none}",
    ".wa-state b{color:var(--c-ink);font-size:1rem}",
    ".wa-state small{opacity:.75;direction:ltr;font-size:.72rem}",
    ".wa-state span.wa-sx{max-width:340px}",
    ".wa-ico{width:64px;height:64px;border-radius:50%;display:grid;place-items:center;background:var(--c-active);color:var(--acc)}",
    ".wa-ico svg{width:30px;height:30px}",
    ".wa-spin{width:34px;height:34px;border-radius:50%;border:3px solid var(--c-line);border-top-color:var(--acc);animation:wa-rot .8s linear infinite}",
    "@keyframes wa-rot{to{transform:rotate(360deg)}}",
    ".wa-btn{height:44px;padding:0 26px;border-radius:999px;border:0;background:linear-gradient(135deg,var(--acc-2),var(--acc-1));color:#fff;font:inherit;font-size:.92rem;font-weight:800;cursor:pointer}",

    ".wa-down{position:absolute;inset-inline-start:16px;bottom:84px;z-index:3;width:42px;height:42px;border-radius:50%;border:1px solid var(--c-border);background:var(--c-card);color:var(--c-mute);box-shadow:var(--c-shadow);cursor:pointer;display:grid;place-items:center}",
    ".wa-down[hidden]{display:none}",
    ".wa-down svg{width:22px;height:22px}",

    /* خانة الكتابة (كبسولة زي صفحة الـ AI) */
    ".wa-composer{position:relative;flex:none;padding:6px 12px calc(8px + env(safe-area-inset-bottom,0px));background:var(--c-bg)}",
    ".wa-field{display:flex;align-items:flex-end;gap:4px;border-radius:28px;background:var(--c-card);border:1px solid var(--c-border);box-shadow:var(--c-shadow);padding:6px 6px;transition:border-color .15s ease,box-shadow .15s ease}",
    ".wa-field:focus-within{border-color:var(--acc);box-shadow:0 0 0 3px color-mix(in srgb,var(--acc) 18%,transparent)}",
    ".wa-input{flex:1;min-width:0;border:0;outline:0;resize:none;background:none;color:var(--c-ink);font:inherit;font-size:1rem;line-height:1.5;padding:10px 6px;max-height:140px}",
    ".wa-input::placeholder{color:var(--c-mute)}",
    ".wa-attach{flex:none;width:42px;height:42px;border-radius:50%;border:0;background:transparent;color:var(--c-mute);display:grid;place-items:center;cursor:pointer;transition:background .15s ease,color .15s ease}",
    ".wa-attach:hover{background:var(--c-hover);color:var(--acc)}",
    ".wa-attach svg{width:23px;height:23px}",
    ".wa-send{flex:none;width:42px;height:42px;border-radius:50%;border:0;background:linear-gradient(135deg,var(--acc-2),var(--acc-1));color:#fff;display:grid;place-items:center;cursor:pointer;transition:transform .15s ease,opacity .15s ease}",
    ".wa-send:active{transform:scale(.92)}",
    ".wa-send[disabled]{opacity:.4;cursor:default}",
    ".wa-send svg{width:20px;height:20px;transform:scaleX(-1)}",

    /* معاينة الصورة قبل الإرسال */
    ".wa-prev{position:absolute;inset:0;z-index:7;display:flex;flex-direction:column;background:var(--c-bg)}",
    ".wa-prev[hidden]{display:none}",
    ".wa-prev .wa-bar strong{font-size:1.02rem;font-weight:800}",
    ".wa-prev__img{flex:1;min-height:0;position:relative;background:var(--c-side)}",
    ".wa-prev__img img{position:absolute;top:16px;left:16px;width:calc(100% - 32px);height:calc(100% - 32px);object-fit:contain}",

    /* عارض الصورة */
    ".wa-view{position:absolute;inset:0;z-index:20;background:rgba(10,12,14,.96);animation:wa-in .18s ease}",
    ".wa-view__stage{position:absolute;top:calc(64px + env(safe-area-inset-top,0px));left:12px;right:12px;bottom:calc(12px + env(safe-area-inset-bottom,0px));display:flex;align-items:center;justify-content:center}",
    ".wa-view[hidden]{display:none}",
    ".wa-view__bar{position:absolute;top:0;left:0;right:0;display:flex;justify-content:space-between;gap:8px;padding:8px 12px;padding-top:calc(8px + env(safe-area-inset-top,0px));z-index:2}",
    ".wa-view .wa-ic{color:#fff;background:rgba(255,255,255,.14)}",
    ".wa-view .wa-ic:hover{background:rgba(255,255,255,.26)}",
    ".wa-view img{width:100%;height:100%;object-fit:contain;transition:filter .3s ease}",
    ".wa-view img.is-thumb{filter:blur(3px)}",
    ".wa-view .wa-spin{position:absolute;border-color:rgba(255,255,255,.25);border-top-color:#fff}",

    ".wa-toast{position:absolute;left:50%;bottom:92px;z-index:30;transform:translate(-50%,10px);max-width:88%;padding:10px 20px;border-radius:999px;background:var(--c-ink);color:var(--c-bg);font-size:.84rem;font-weight:700;opacity:0;pointer-events:none;transition:opacity .2s ease,transform .2s ease;text-align:center}",
    ".wa-toast.is-on{opacity:1;transform:translate(-50%,0)}",

    "@media (max-width:899px){.wa-side{width:100%;border-inline-end:0}.wa-app[data-pane='list'] .wa-main{display:none}.wa-app[data-pane='chat'] .wa-side{display:none}.wa-empty{display:none}.wa-m{max-width:88%}}",
    "@media (min-width:900px){.wa-chat .wa-msgs{padding:16px 6%}.wa-composer{padding-inline:6%}.wa-app[data-mode='teacher'] .wa-back{display:none}}",
    "@media (prefers-reduced-motion:reduce){.wa,.wa-m,.wa-spin,.wa-view{animation:none}.wa-send,.wa-toast{transition:none}}"
  ].join("");

  /* ---------- الحالة ---------- */
  var els = {}, built = false, opened = false, lastFocus = null, depth = 0, silentPops = 0, vvBound = false;
  var q = null, metaRef = null, presRef = null, list = [], byKey = {}, pending = {}, curTid = null, curMeta = null;
  var lastSend = 0, unread = 0, connectTry = 0, toastT = null, sepRaf = 0, pane = "list";
  var threadsRef = null, threadsData = [], threadsLoaded = false, presOn = false;

  function setUnread(n) {
    unread = n || 0;
    if (els.badge) { els.badge.textContent = unread > 99 ? "99+" : String(unread); els.badge.hidden = !unread; }
    try { document.dispatchEvent(new CustomEvent("snchat:unread", { detail: { count: unread } })); } catch (e) {}
  }
  function toast(msg) {
    if (!els.toast) return;
    els.toast.textContent = msg; els.toast.classList.add("is-on");
    clearTimeout(toastT); toastT = setTimeout(function () { els.toast.classList.remove("is-on"); }, 2600);
  }

  /* ---------- البناء ---------- */
  function build() {
    if (built) return;
    built = true;
    var st = h("style"); st.textContent = css; document.head.appendChild(st);

    var root = h("div", "wa"); root.hidden = true; root.setAttribute("role", "dialog"); root.setAttribute("aria-modal", "true"); root.setAttribute("aria-label", IS_TEACHER ? "رسايل الطلبة" : "المحادثة مع المدرس");
    var side = IS_TEACHER ?
      '<aside class="wa-side">' +
        '<header class="wa-bar"><button type="button" class="wa-ic" data-act="close" aria-label="إغلاق">' + IC.back + '</button><h2 class="wa-title">رسايل الطلبة</h2></header>' +
        '<div class="wa-search"><label>' + IC.search + '<input type="search" data-el="search" placeholder="دوّر على طالب" aria-label="بحث"></label></div>' +
        '<div class="wa-threads" data-el="threads"></div>' +
      "</aside>" : "";
    var empty = IS_TEACHER ? '<div class="wa-empty"><div class="wa-bigico">' + IC.chat + '</div><h3>رسايل الطلبة</h3><p>اختار محادثة من القايمة عشان تشوف الرسايل وتردّ عليها.</p></div>' : "";
    root.innerHTML =
      '<div class="wa-app" data-mode="' + (IS_TEACHER ? "teacher" : "student") + '" data-pane="' + (IS_TEACHER ? "list" : "chat") + '">' +
        side +
        '<section class="wa-main" data-has="' + (IS_TEACHER ? "0" : "1") + '">' + empty +
          '<div class="wa-chat">' +
            '<header class="wa-bar">' +
              '<button type="button" class="wa-ic wa-back" data-act="back" aria-label="رجوع">' + IC.back + "</button>" +
              '<span class="wa-av" data-el="av"></span>' +
              '<div class="wa-who"><strong data-el="title"></strong><small data-el="sub"></small></div>' +
              (IS_TEACHER ? '<div class="wa-menuwrap"><button type="button" class="wa-ic" data-act="menu" aria-label="المزيد" aria-haspopup="menu">' + IC.dots + '</button>' +
                '<div class="wa-menu" data-el="menu" role="menu" hidden>' +
                  (USE_AUTH ? '<button type="button" role="menuitem" data-act="unlink">' + IC.unlink + "فك ربط جهاز الطالب</button>" : "") +
                  '<button type="button" role="menuitem" data-act="del">' + IC.trash + "مسح المحادثة</button></div></div>" : "") +
            "</header>" +
            '<div class="wa-msgs" data-el="msgs" role="log" aria-live="polite"><div class="wa-note">' + IC.lock + "الرسايل بتتمسح تلقائي بعد أسبوع</div></div>" +
            '<div class="wa-state" data-el="state" hidden></div>' +
            '<button type="button" class="wa-down" data-el="down" data-act="down" aria-label="لآخر المحادثة" hidden>' + IC.down + "</button>" +
            '<div class="wa-composer"><div class="wa-field">' +
              '<button type="button" class="wa-attach" data-act="attach" aria-label="إرسال صورة" title="إرسال صورة">' + IC.image + "</button>" +
              '<input type="file" accept="image/*" data-el="file" hidden>' +
              '<textarea class="wa-input" data-el="input" rows="1" maxlength="' + MAX_LEN + '" placeholder="اكتب رسالة" aria-label="رسالة" dir="auto"></textarea>' +
              '<button type="button" class="wa-send" data-el="send" data-act="send" aria-label="إرسال" disabled>' + IC.send + "</button>" +
            "</div></div>" +
            '<div class="wa-prev" data-el="prev" hidden>' +
              '<header class="wa-bar"><button type="button" class="wa-ic" data-act="prevclose" aria-label="إلغاء">' + IC.close + '</button><strong>إرسال صورة</strong></header>' +
              '<div class="wa-prev__img"><img data-el="prevImg" alt="معاينة"></div>' +
              '<div class="wa-composer"><div class="wa-field"><textarea class="wa-input" data-el="prevCap" rows="1" maxlength="' + MAX_LEN + '" placeholder="أضف تعليق (اختياري)" dir="auto" aria-label="تعليق"></textarea>' +
              '<button type="button" class="wa-send" data-act="sendimg" aria-label="إرسال الصورة">' + IC.send + "</button></div></div>" +
            "</div>" +
          "</div>" +
        "</section>" +
      "</div>" +
      '<div class="wa-view" data-el="viewer" hidden>' +
        '<div class="wa-view__bar"><button type="button" class="wa-ic" data-act="vclose" aria-label="إغلاق">' + IC.close + '</button>' +
        '<a class="wa-ic" data-el="vdl" download="shady-chat.jpg" aria-label="تحميل الصورة" hidden>' + IC.download + "</a></div>" +
        '<div class="wa-view__stage"><div class="wa-spin" data-el="vspin"></div><img data-el="vimg" alt="الصورة"></div>' +
      "</div>" +
      '<div class="wa-toast" data-el="toast" role="status"></div>';
    document.body.appendChild(root);
    els.root = root;
    root.querySelectorAll("[data-el]").forEach(function (n) { els[n.dataset.el] = n; });
    els.app = root.querySelector(".wa-app");
    els.main = root.querySelector(".wa-main");
    els.note = root.querySelector(".wa-note");

    root.addEventListener("click", function (e) {
      var b = e.target.closest("[data-act]");
      if (els.menu && !els.menu.hidden && !(b && b.dataset.act === "menu")) els.menu.hidden = true;
      if (!b) return;
      var a = b.dataset.act;
      if (a === "close") closeUI();
      else if (a === "back") onBack();
      else if (a === "send") send();
      else if (a === "menu") els.menu.hidden = !els.menu.hidden;
      else if (a === "unlink") unlinkStudent();
      else if (a === "del") deleteConv();
      else if (a === "down") scrollEnd(true);
      else if (a === "attach") els.file.click();
      else if (a === "prevclose") closePreview();
      else if (a === "sendimg") sendImage();
      else if (a === "vclose") closeViewer();
    });
    document.addEventListener("keydown", function (e) {
      if (e.key !== "Escape" || !opened) return;
      if (!els.viewer.hidden) closeViewer();
      else if (!els.prev.hidden) closePreview();
      else closeUI();
    });
    els.file.addEventListener("change", onFile);
    els.prevCap.addEventListener("keydown", function (e) {
      var touch = window.matchMedia && matchMedia("(hover: none)").matches;
      if (e.key === "Enter" && !e.shiftKey && !touch) { e.preventDefault(); sendImage(); }
    });
    window.addEventListener("popstate", onPop);

    els.input.addEventListener("input", function () {
      els.input.style.height = "auto";
      els.input.style.height = Math.min(els.input.scrollHeight, 130) + "px";
      els.send.disabled = !els.input.value.trim();
    });
    els.input.addEventListener("keydown", function (e) {
      var touch = window.matchMedia && matchMedia("(hover: none)").matches;
      if (e.key === "Enter" && !e.shiftKey && !touch) { e.preventDefault(); send(); }
    });
    els.msgs.addEventListener("scroll", function () {
      var far = els.msgs.scrollHeight - els.msgs.scrollTop - els.msgs.clientHeight > 320;
      els.down.hidden = !far;
    });
    if (els.search) els.search.addEventListener("input", renderThreads);

    if (IS_TEACHER) {
      var fab = h("button", "wa-fab"); fab.type = "button"; fab.setAttribute("aria-label", "رسايل الطلبة");
      fab.innerHTML = IC.chat + '<span class="wa-badge" hidden>0</span>';
      document.body.appendChild(fab);
      els.badge = fab.querySelector(".wa-badge");
      fab.addEventListener("click", open);
    }
  }

  /* ---------- مقاس الشاشة مع الكيبورد (موبايل) ---------- */
  function fit() {
    if (!els.root || !window.visualViewport) return;
    var vv = window.visualViewport;
    els.root.style.top = vv.offsetTop + "px";
    els.root.style.bottom = "auto";
    els.root.style.height = vv.height + "px";
  }
  function bindViewport() {
    if (vvBound || !window.visualViewport) return;
    vvBound = true;
    visualViewport.addEventListener("resize", function () { if (opened) { fit(); } });
    visualViewport.addEventListener("scroll", function () { if (opened) fit(); });
  }

  /* ---------- رأس المحادثة ---------- */
  function setHead(title, sub, avatar) {
    els.title.textContent = title;
    els.sub.textContent = sub || "";
    els.av.innerHTML = "";
    if (avatar === "teacher") els.av.innerHTML = IC.teacher; else els.av.textContent = avatar || "";
  }

  /* ---------- حالات (تحميل / خطأ / فاضية) ---------- */
  function setState(kind, msg, code, retry) {
    var s = els.state; s.innerHTML = ""; s.dataset.kind = kind || "";
    if (!kind) { s.hidden = true; els.msgs.hidden = false; return; }
    s.hidden = false; els.msgs.hidden = true;
    if (kind === "loading") { s.appendChild(h("div", "wa-spin")); s.appendChild(h("span", "", "بنوصّل المحادثة…")); }
    else if (kind === "empty") {
      var i = h("div", "wa-ico"); i.innerHTML = IS_TEACHER ? IC.chat : IC.teacher; s.appendChild(i);
      s.appendChild(h("b", "", IS_TEACHER ? "مفيش رسايل لسه" : "ابدأ محادثتك مع المدرس"));
      s.appendChild(h("span", "wa-sx", IS_TEACHER ? "ابعت أول رسالة للطالب." : "اكتب سؤالك وهتلاقي الرد هنا."));
    } else {
      var e = h("div", "wa-ico"); e.innerHTML = IC.warn; s.appendChild(e);
      s.appendChild(h("b", "", "في مشكلة"));
      s.appendChild(h("span", "wa-sx", msg || "حاول تاني بعد شوية."));
      if (code) s.appendChild(h("small", "", "[" + code + "]"));
      if (retry) { var rb = h("button", "wa-btn", "حاول تاني"); rb.type = "button"; rb.addEventListener("click", retry); s.appendChild(rb); }
    }
  }
  function updateEmpty() {
    var k = els.state.dataset.kind;
    if (k === "error" || k === "loading") return;
    setState("");
    var hint = els.msgs.querySelector(".wa-hint");
    if (list.length) { if (hint) hint.remove(); }
    else if (!hint) els.msgs.appendChild(h("div", "wa-hint", IS_TEACHER ? "مفيش رسايل لسه. ابعت أول رسالة." : "اكتب سؤالك للمدرس وهتلاقي الرد هنا."));
  }

  /* ---------- الرسايل ---------- */
  function detachChat() {
    if (q) { try { q.off(); } catch (e) {} q = null; }
    if (metaRef) { try { metaRef.off(); } catch (e) {} metaRef = null; }
    if (presRef) { try { presRef.off(); } catch (e) {} presRef = null; }
  }
  function clearMsgs() {
    detachChat();
    list = []; byKey = {}; pending = {}; curMeta = null;
    els.msgs.querySelectorAll(".wa-m,.wa-day,.wa-hint").forEach(function (n) { n.remove(); });
  }

  function tickState(it) {
    if (it.from !== MINE) return "";
    if (pending[it.key]) return "clock";
    var r = curMeta && curMeta[OTHER_READ];
    return r && r >= it.ts ? "read" : "sent";
  }
  function paintTick(el, state) {
    if (!el) return;
    el.className = "wa-tick" + (state === "read" ? " is-read" : state === "clock" ? " is-clock" : "");
    el.innerHTML = TICK[state] || "";
  }
  function updateTicks() { list.forEach(function (it) { if (it.from === MINE) paintTick(it.tick, tickState(it)); }); }

  function bubble(key, m) {
    var own = m.from === MINE;
    var w = h("div", "wa-m " + (own ? "is-own" : "is-other"));
    var b = h("div", "wa-b");
    if (m.thumb) {
      b.className += " has-img" + (m.text ? "" : " no-cap");
      var fig = h("button", "wa-figure"); fig.type = "button"; fig.setAttribute("aria-label", "فتح الصورة");
      if (m.w && m.h) {
        var maxW = Math.min(260, Math.round(window.innerWidth * 0.62)), k = Math.min(1, maxW / m.w, 340 / m.h);
        fig.style.width = Math.max(60, Math.round(m.w * k)) + "px";
        fig.style.height = Math.max(40, Math.round(m.h * k)) + "px";
      }
      var im = h("img", "wa-img"); im.alt = "صورة"; im.src = m.thumb; im.draggable = false;
      fig.appendChild(im);
      fig.addEventListener("click", function () { openViewer(key, m.thumb); });
      b.appendChild(fig);
    }
    if (m.text) { var t = h("span", "wa-txt", m.text); t.setAttribute("dir", "auto"); b.appendChild(t); }
    var meta = h("span", "wa-meta");
    var tm = h("time", "", fmtTime(m.ts));
    meta.appendChild(tm);
    var tick = null;
    if (own) { tick = h("span", "wa-tick"); meta.appendChild(tick); }
    b.appendChild(meta); w.appendChild(b);
    return { el: w, time: tm, tick: tick };
  }

  function renumber() {
    cancelAnimationFrame(sepRaf);
    sepRaf = requestAnimationFrame(function () {
      els.msgs.querySelectorAll(".wa-day").forEach(function (n) { n.remove(); });
      var lastDay = "", prev = null;
      list.forEach(function (it) {
        var d = dayKey(it.ts);
        if (d !== lastDay) { lastDay = d; els.msgs.insertBefore(h("div", "wa-day", dayLabel(it.ts)), it.el); prev = null; }
        var tail = !prev || prev.from !== it.from || it.ts - prev.ts > 5 * 60000;
        it.el.classList.toggle("has-tail", tail);
        prev = it;
      });
      list.forEach(function (it, i) {
        var nx = list[i + 1];
        it.el.classList.toggle("is-end", !nx || nx.from !== it.from || nx.ts - it.ts > 5 * 60000 || dayKey(nx.ts) !== dayKey(it.ts));
      });
    });
  }
  function scrollEnd(smooth) {
    var t = els.msgs.scrollHeight + 999;
    if (smooth && els.msgs.scrollTo) els.msgs.scrollTo({ top: t, behavior: "smooth" }); else els.msgs.scrollTop = t;
  }

  /* ترتيب ثابت: الأقدم فوق (الوقت أولاً، وبعدين مفتاح الرسالة لو الوقت واحد) */
  function cmp(a, b) { return (a.ts - b.ts) || (a.key < b.key ? -1 : a.key > b.key ? 1 : 0); }
  function putInOrder(it) {
    var i = list.indexOf(it);
    if (i > -1) list.splice(i, 1);
    var j = list.length;
    while (j > 0 && cmp(list[j - 1], it) > 0) j--;
    list.splice(j, 0, it);
    var nxt = list[j + 1];
    els.msgs.insertBefore(it.el, nxt ? nxt.el : null);
    renumber();
  }

  function cleared(t) { return !!(curMeta && curMeta.clearedAt && t <= curMeta.clearedAt); }

  function addMsg(key, m) {
    if (!m || (typeof m.text !== "string" && !m.thumb)) return;
    if (cleared(m.ts || 0)) return;
    if (byKey[key]) { updateMsg(key, m); return; }
    var near = els.msgs.scrollHeight - els.msgs.scrollTop - els.msgs.clientHeight < 160;
    var bb = bubble(key, m);
    var it = { key: key, ts: m.ts || Date.now(), from: m.from, el: bb.el, time: bb.time, tick: bb.tick };
    byKey[key] = it;
    putInOrder(it);
    paintTick(it.tick, tickState(it));
    updateEmpty();
    if (near || m.from === MINE) scrollEnd(false);
  }
  function updateMsg(key, m) {
    var it = byKey[key]; if (!it || !m) return;
    var old = it.ts;
    it.ts = m.ts || it.ts;
    it.time.textContent = fmtTime(it.ts);
    paintTick(it.tick, tickState(it));
    if (it.ts !== old) {
      var near = els.msgs.scrollHeight - els.msgs.scrollTop - els.msgs.clientHeight < 160;
      putInOrder(it);
      if (near || it.from === MINE) scrollEnd(false);
    }
  }

  function removeMsg(key) {
    var it = byKey[key]; if (!it) return;
    it.el.remove(); delete byKey[key];
    list = list.filter(function (x) { return x.key !== key; });
    renumber(); updateEmpty();
  }

  function markRead() {
    if (!db || !curTid || !opened) return;
    var p = "threads/" + curTid + "/", up = {};
    if (IS_TEACHER) { up[p + "tUnread"] = 0; up[p + "tReadAt"] = TS(); }
    else { up[p + "sUnread"] = 0; up[p + "sReadAt"] = TS(); }
    db.ref().update(up).catch(noop);
    if (!IS_TEACHER) setUnread(0);
  }

  function setPresence(v) {
    if (IS_TEACHER) return;
    var txt = "بيرد في أقرب وقت";
    if (v && v.on) txt = "متصل الآن";
    else if (v && v.at) {
      var d = dayKey(v.at) === dayKey(Date.now()) ? "النهارده " : (dayKey(v.at) === dayKey(Date.now() - 86400000) ? "امبارح " : "");
      txt = "آخر ظهور " + d + fmtTime(v.at);
    }
    els.sub.textContent = txt;
  }

  function attachChat(tid) {
    curTid = tid;
    var cut = Date.now() - WEEK;
    q = db.ref("messages/" + tid).orderByChild("ts").startAt(cut).limitToLast(100);
    q.on("child_added", function (s) { addMsg(s.key, s.val()); }, onListenError);
    q.on("child_changed", function (s) { updateMsg(s.key, s.val()); });
    q.on("child_moved", function (s) { updateMsg(s.key, s.val()); });
    q.on("child_removed", function (s) { removeMsg(s.key); });
    q.once("value").then(function () { setTimeout(updateEmpty, 0); setTimeout(function () { scrollEnd(false); }, 40); }, noop);

    metaRef = db.ref("threads/" + tid);
    metaRef.on("value", function (s) {
      curMeta = s.val() || {};
      if (curMeta.clearedAt) list.filter(function (it) { return it.ts <= curMeta.clearedAt; }).forEach(function (it) { removeMsg(it.key); });
      updateTicks();
      if ((IS_TEACHER ? curMeta.tUnread : curMeta.sUnread) > 0) markRead();
    }, noop);

    if (!IS_TEACHER) {
      presRef = db.ref("presence/teacher");
      presRef.on("value", function (s) { setPresence(s.val()); }, noop);
    }
    purgeThread(tid);
    if (window.matchMedia && matchMedia("(pointer:fine)").matches) els.input.focus();
  }

  function purgeThread(tid) {
    var cut = Date.now() - WEEK - 60000;
    db.ref("messages/" + tid).orderByChild("ts").endAt(cut).limitToFirst(200).once("value").then(function (s) {
      var up = {}, n = 0;
      s.forEach(function (c) { up["messages/" + tid + "/" + c.key] = null; if (c.val() && c.val().thumb) up["images/" + tid + "/" + c.key] = null; n++; });
      if (n) return db.ref().update(up);
    }).catch(noop);
  }

  function onListenError(err) {
    if (USE_AUTH && !IS_TEACHER && denied(err) && connectTry < 1) {
      connectTry++;
      try { localStorage.removeItem(FLAG + TID); } catch (e) {}
      clearMsgs(); openStudent(true);
      return;
    }
    setState("error", explain(err), err && err.code, IS_TEACHER ? null : function () { connectTry = 0; clearMsgs(); openStudent(); });
  }

  /* ---------- الصور: ضغط + معاينة + عرض ---------- */
  var IMG_FULL_MAX = 400000, THUMB_MAX = 22000, pendingImg = null;

  function readImage(file) {
    return new Promise(function (res, rej) {
      var url = URL.createObjectURL(file), im = new Image();
      im.onload = function () { URL.revokeObjectURL(url); res(im); };
      im.onerror = function () { URL.revokeObjectURL(url); rej(new Error("bad-image")); };
      im.src = url;
    });
  }
  function toJpeg(im, max, quality) {
    var w = im.naturalWidth, hh = im.naturalHeight, k = Math.min(1, max / Math.max(w, hh));
    var cw = Math.max(1, Math.round(w * k)), ch = Math.max(1, Math.round(hh * k));
    var c = document.createElement("canvas"); c.width = cw; c.height = ch;
    var x = c.getContext("2d"); x.fillStyle = "#fff"; x.fillRect(0, 0, cw, ch); x.drawImage(im, 0, 0, cw, ch);
    return { url: c.toDataURL("image/jpeg", quality), w: cw, h: ch };
  }
  function prepareImage(file) {
    if (!file || !/^image\//.test(file.type)) return Promise.reject(new Error("not-image"));
    if (file.size > 30 * 1024 * 1024) return Promise.reject(new Error("too-big"));
    return readImage(file).then(function (im) {
      var steps = [[1280, 0.72], [1024, 0.62], [800, 0.55], [640, 0.5]], full = null, i;
      for (i = 0; i < steps.length; i++) { full = toJpeg(im, steps[i][0], steps[i][1]); if (full.url.length <= IMG_FULL_MAX) break; }
      if (!full || full.url.length > IMG_FULL_MAX) throw new Error("too-big");
      var th = toJpeg(im, 280, 0.55);
      if (th.url.length > THUMB_MAX) th = toJpeg(im, 200, 0.45);
      if (th.url.length > THUMB_MAX) throw new Error("too-big");
      return { full: full.url, thumb: th.url, w: full.w, h: full.h };
    });
  }
  function onFile() {
    var f = els.file.files && els.file.files[0];
    els.file.value = "";
    if (!f || !curTid) return;
    toast("بنجهّز الصورة…");
    prepareImage(f).then(function (img) {
      pendingImg = img;
      els.prevImg.src = img.thumb.length ? img.full : "";
      els.prevCap.value = "";
      els.prev.hidden = false;
      setTimeout(function () { els.prevCap.focus(); }, 50);
    }).catch(function (e) {
      var m = e && e.message;
      toast(m === "not-image" ? "اختار صورة بس." : m === "too-big" ? "الصورة كبيرة قوي، جرّب صورة أصغر." : "الصورة دي مش مدعومة. جرّب JPG أو PNG.");
    });
  }
  function closePreview() { pendingImg = null; els.prev.hidden = true; els.prevImg.removeAttribute("src"); }

  function openViewer(key, thumb) {
    var tid = curTid;
    els.vimg.src = thumb; els.vimg.classList.add("is-thumb");
    els.vspin.hidden = false; els.vdl.hidden = true; els.viewer.hidden = false;
    db.ref("images/" + tid + "/" + key).once("value").then(function (s) {
      var v = s.val();
      if (els.viewer.hidden) return;
      if (v) { els.vimg.src = v; els.vimg.classList.remove("is-thumb"); els.vdl.href = v; els.vdl.hidden = false; }
      else toast("الصورة اتمسحت.");
      els.vspin.hidden = true;
    }).catch(function () { els.vspin.hidden = true; toast("تعذر تحميل الصورة."); });
  }
  function closeViewer() { els.viewer.hidden = true; els.vimg.removeAttribute("src"); }

  /* ---------- الإرسال ---------- */
  function threadFields(up, preview) {
    var p = "threads/" + curTid + "/";
    up[p + "last"] = preview.slice(0, 120);
    up[p + "lastAt"] = TS();
    up[p + "lastFrom"] = MINE;
    if (IS_TEACHER) { up[p + "sUnread"] = INC(1); up[p + "tUnread"] = 0; }
    else {
      up[p + "name"] = String(me.fullName || "طالب").slice(0, 80);
      up[p + "grade"] = String(me.grade || "").slice(0, 40);
      up[p + "tUnread"] = INC(1);
    }
  }
  function sendImage() {
    if (!db || !curTid || !pendingImg) return;
    if (Date.now() - lastSend < 900) return;
    lastSend = Date.now();
    var cap = els.prevCap.value.trim().slice(0, MAX_LEN), im = pendingImg;
    var key = db.ref("messages/" + curTid).push().key, up = {};
    var msg = { from: MINE, thumb: im.thumb, w: im.w, h: im.h, ts: TS() };
    if (cap) msg.text = cap;
    up["messages/" + curTid + "/" + key] = msg;
    up["images/" + curTid + "/" + key] = im.full;
    threadFields(up, cap ? "📷 " + cap : "📷 صورة");
    pending[key] = true;
    closePreview();
    db.ref().update(up).then(function () {
      delete pending[key];
      var it = byKey[key]; if (it) paintTick(it.tick, tickState(it));
    }).catch(function (e) {
      delete pending[key]; removeMsg(key);
      toast(USE_AUTH && !IS_TEACHER && denied(e) ? "الصورة ماتبعتتش. اقفل الشات وافتحه تاني." : "الصورة ماتبعتتش، اتأكد من النت وجرّب تاني.");
    });
  }

  function send() {
    if (!db || !curTid) return;
    var text = els.input.value.trim().slice(0, MAX_LEN);
    if (!text) return;
    if (Date.now() - lastSend < 600) return;
    lastSend = Date.now();

    var key = db.ref("messages/" + curTid).push().key;
    var up = {};
    up["messages/" + curTid + "/" + key] = { from: MINE, text: text, ts: TS() };
    threadFields(up, text);
    pending[key] = true;
    els.input.value = ""; els.input.style.height = "auto"; els.send.disabled = true;
    db.ref().update(up).then(function () {
      delete pending[key];
      var it = byKey[key]; if (it) paintTick(it.tick, tickState(it));
    }).catch(function (e) {
      delete pending[key];
      removeMsg(key);
      els.input.value = text; els.send.disabled = false;
      if (USE_AUTH && !IS_TEACHER && denied(e)) { try { localStorage.removeItem(FLAG + TID); } catch (x) {} toast("الرسالة ماتبعتتش. اقفل الشات وافتحه تاني."); }
      else toast("الرسالة ماتبعتتش، اتأكد من النت وجرّب تاني.");
    });
  }

  /* ==================== جهة الطالب ==================== */
  function ensureStudentAuth() {
    if (!USE_AUTH) return Promise.resolve({ uid: "anon" });
    return waitAuth().then(function (u) { return u || auth.signInAnonymously().then(function (c) { return c.user; }); });
  }
  function claim(uid) {
    if (!USE_AUTH) { try { localStorage.setItem(FLAG + TID, "anon"); } catch (e) {} return Promise.resolve(); }
    if (localStorage.getItem(FLAG + TID) === uid) return Promise.resolve();
    var ref = db.ref("owners/" + TID);
    function ok() { try { localStorage.setItem(FLAG + TID, uid); } catch (e) {} }
    return ref.set(uid).then(ok, function (e) {
      if (!denied(e)) throw e;
      return ref.once("value").then(function (s) { if (s.val() === uid) ok(); else throw new Error("linked"); },
        function (e2) { if (denied(e2)) throw new Error("linked"); throw e2; });
    });
  }
  function openStudent(isRetry) {
    if (!isRetry) connectTry = 0;
    setHead("المدرس", "بيرد في أقرب وقت", "teacher");
    setState("loading");
    ensureFirebase().then(ensureStudentAuth).then(function (u) {
      db.goOnline();
      return claim(u.uid);
    }).then(function () {
      if (!opened) return;
      setState("");
      attachChat(TID);
      setTimeout(updateEmpty, 700);
    }).catch(function (e) {
      console.error("[SNChat]", e);
      setState("error", explain(e), e && (e.code || e.message), function () { openStudent(); });
    });
  }

  var lastCheck = 0;
  function checkUnread() {
    if (IS_TEACHER || opened || Date.now() - lastCheck < 60000) return;
    var claimed = null; try { claimed = localStorage.getItem(FLAG + TID); } catch (e) {}
    if (!claimed) return;
    lastCheck = Date.now();
    ensureFirebase().then(function () { return USE_AUTH ? waitAuth() : { uid: "anon" }; }).then(function (u) {
      if (!u || opened) return;
      db.goOnline();
      return db.ref("threads/" + TID + "/sUnread").once("value").then(function (s) { setUnread(s.val() > 0 ? s.val() : 0); });
    }).catch(noop).then(function () { if (!opened && db) { try { db.goOffline(); } catch (e) {} } });
  }

  /* ==================== جهة المدرس ==================== */
  function ensureTeacher() {
    if (!USE_AUTH) return ensureFirebase();
    return ensureFirebase().then(waitAuth).then(function (u) {
      return u || auth.signInAnonymously().then(function (c) { return c.user; });
    }).then(function (u) {
      var key = window.SN_TEACHER_KEY;
      if (!key) throw new Error("no-key");
      var done = null; try { done = localStorage.getItem(TFLAG + u.uid); } catch (e) {}
      if (done === key) return;
      return db.ref("teachers/" + u.uid).set({ k: key }).then(function () { try { localStorage.setItem(TFLAG + u.uid, key); } catch (e) {} });
    });
  }
  function goPresent() {
    if (presOn) return; presOn = true;
    var ref = db.ref("presence/teacher");
    db.ref(".info/connected").on("value", function (s) {
      if (!s.val()) return;
      ref.onDisconnect().set({ on: false, at: TS() }).then(function () { return ref.set({ on: true, at: TS() }); }).catch(noop);
    });
  }
  function teacherError(e) {
    console.error("[SNChat]", e);
    threadsRef = null;
    if (!opened) return;
    els.threads.innerHTML = "";
    var st = h("div", "wa-state");
    var ic = h("div", "wa-ico"); ic.innerHTML = IC.warn; st.appendChild(ic);
    st.appendChild(h("b", "", "في مشكلة"));
    st.appendChild(h("span", "wa-sx", explain(e)));
    var code = e && (e.code || e.message); if (code) st.appendChild(h("small", "", "[" + code + "]"));
    var rb = h("button", "wa-btn", "حاول تاني"); rb.type = "button"; rb.addEventListener("click", function () { openTeacher(); });
    st.appendChild(rb); els.threads.appendChild(st);
  }

  function startTeacher() {
    if (threadsRef) return;
    goPresent();
    threadsRef = db.ref("threads").orderByChild("lastAt").limitToLast(150);
    threadsRef.on("value", function (s) {
      var arr = [];
      s.forEach(function (c) { var v = c.val(); if (v && v.lastAt && !(v.clearedAt && v.clearedAt >= v.lastAt)) arr.push({ id: c.key, v: v }); });
      arr.sort(function (a, b) { return b.v.lastAt - a.v.lastAt; });
      threadsData = arr; threadsLoaded = true;
      setUnread(arr.filter(function (t) { return t.v.tUnread > 0; }).length);
      if (opened) renderThreads();
      purgeAll();
    }, teacherError);
  }
  function purgeAll() {
    var last = 0; try { last = +localStorage.getItem(PURGE_KEY) || 0; } catch (e) {}
    if (Date.now() - last < 6 * 3600 * 1000) return;
    try { localStorage.setItem(PURGE_KEY, String(Date.now())); } catch (e) {}
    var cut = Date.now() - WEEK - 60000;
    threadsData.forEach(function (t) { purgeThread(t.id); if (t.v.lastAt < cut) db.ref("threads/" + t.id).remove().catch(noop); });
  }

  function renderThreads() {
    var box = els.threads; if (!box) return;
    var term = (els.search.value || "").trim().toLowerCase();
    box.innerHTML = "";
    if (!threadsLoaded) { var ld = h("div", "wa-state"); ld.appendChild(h("div", "wa-spin")); ld.appendChild(h("span", "", "بنحمّل المحادثات…")); box.appendChild(ld); return; }
    var rows = threadsData.filter(function (t) { return !term || String(t.v.name || "").toLowerCase().indexOf(term) > -1; });
    if (!rows.length) {
      var e = h("div", "wa-state");
      e.appendChild(h("b", "", term ? "مفيش نتايج" : "مفيش محادثات لسه"));
      e.appendChild(h("span", "wa-sx", term ? "جرّب اسم تاني." : "هتظهر هنا لما أي طالب يبعتلك رسالة."));
      box.appendChild(e); return;
    }
    rows.forEach(function (t) {
      var v = t.v, un = v.tUnread > 0;
      var b = h("button", "wa-th" + (un ? " is-unread" : "") + (t.id === curTid ? " is-active" : "")); b.type = "button";
      var av = h("span", "wa-av", String(v.name || "؟").trim().charAt(0) || "؟");
      var mid = h("div", "wa-tm");
      var nm = h("div", "wa-tn"); nm.appendChild(h("span", "", v.name || "طالب")); if (v.grade) nm.appendChild(h("em", "", v.grade));
      var ln = h("div", "wa-tl");
      if (v.lastFrom === "t") { var tk = h("span", "wa-tick"); paintTick(tk, v.sReadAt && v.sReadAt >= v.lastAt ? "read" : "sent"); ln.appendChild(tk); }
      var lt = h("span", "", v.last || ""); lt.setAttribute("dir", "auto"); ln.appendChild(lt);
      mid.appendChild(nm); mid.appendChild(ln);
      var tr = h("div", "wa-tr"); tr.appendChild(h("span", "", listTime(v.lastAt)));
      if (un) tr.appendChild(h("span", "wa-cnt", v.tUnread > 99 ? "99+" : String(v.tUnread)));
      b.appendChild(av); b.appendChild(mid); b.appendChild(tr);
      b.addEventListener("click", function () { openConv(t.id, v); });
      box.appendChild(b);
    });
  }

  function setPane(p) {
    pane = p;
    els.app.dataset.pane = p;
    els.main.dataset.has = (p === "chat" || (IS_TEACHER && curTid)) ? "1" : "0";
  }
  function showList() {
    clearMsgs(); curTid = null;
    els.main.dataset.has = "0";
    setPane("list");
    renderThreads();
  }
  function openConv(tid, meta) {
    if (tid === curTid && !isMobile()) return;
    clearMsgs();
    setHead(meta.name || "طالب", meta.grade || "", String(meta.name || "؟").trim().charAt(0) || "؟");
    curTid = tid;
    els.main.dataset.has = "1";
    setState("");
    if (isMobile() && pane !== "chat") pushState();
    setPane("chat");
    renderThreads();
    attachChat(tid);
  }
  function unlinkStudent() {
    if (!curTid || !confirm("تفك ربط جهاز الطالب؟ هيقدر يربط جهاز جديد بالمحادثة دي.")) return;
    db.ref("owners/" + curTid).remove().then(function () { toast("اتفك الربط. الطالب يفتح الشات من جهازه الجديد."); }, function () { toast("تعذر فك الربط."); });
  }
  function deleteConv() {
    if (!curTid || !confirm("تمسح المحادثة دي بالكامل؟ مش هتتسترجع.")) return;
    var done = function () { if (isMobile() && depth > 1) history.back(); else showList(); toast("اتمسحت المحادثة."); };
    var fail = function () { toast("تعذر المسح."); };
    if (USE_AUTH) {
      var up = {}; up["messages/" + curTid] = null; up["threads/" + curTid] = null; up["images/" + curTid] = null;
      db.ref().update(up).then(done, fail);
    } else {
      /* من غير Authentication: المسح بعلامة وقت (الرسايل القديمة بتختفي عند الاتنين وبتتمسح فعلياً بعد أسبوع) */
      db.ref("threads/" + curTid).update({ clearedAt: TS(), last: "" }).then(done, fail);
    }
  }

  function openTeacher() {
    showList();
    ensureTeacher().then(function () { startTeacher(); renderThreads(); }).catch(teacherError);
  }

  /* ---------- التنقل (زرار الرجوع في الموبايل) ---------- */
  function pushState() { try { history.pushState({ snwa: 1 }, ""); depth++; } catch (e) {} }
  function onPop() {
    if (silentPops > 0) { silentPops--; return; }
    if (!opened) return;
    depth = Math.max(0, depth - 1);
    if (depth === 0) hideUI();
    else if (IS_TEACHER) showList();
  }
  function onBack() {
    if (IS_TEACHER && isMobile() && pane === "chat") { if (depth > 1) history.back(); else showList(); }
    else closeUI();
  }

  /* ---------- فتح وقفل ---------- */
  function open() {
    build(); bindViewport();
    lastFocus = document.activeElement;
    opened = true;
    els.root.hidden = false;
    document.documentElement.classList.add("wa-lock");
    pushState(); fit();
    if (IS_TEACHER) openTeacher();
    else { setPane("chat"); openStudent(); }
  }
  function hideUI() {
    if (!built || !opened) return;
    opened = false;
    els.root.hidden = true;
    document.documentElement.classList.remove("wa-lock");
    clearMsgs(); curTid = null; setState("");
    closePreview(); closeViewer();
    if (els.menu) els.menu.hidden = true;
    if (!IS_TEACHER && db) { try { db.goOffline(); } catch (e) {} }
    if (lastFocus && lastFocus.focus) { try { lastFocus.focus(); } catch (e) {} }
  }
  function closeUI() {
    var d = depth;
    hideUI();
    if (d > 0) { silentPops = 1; depth = 0; try { history.go(-d); } catch (e) { silentPops = 0; } }
  }

  /* ---------- مسح داتابيز الشات (بيتنادى من firebase.js مع "مسح كل بيانات المنصة") ---------- */
  function tidOf(id) { return String(id).replace(/[.#$\[\]\/]/g, "_"); }
  function removePaths(paths) {
    var failed = [];
    return ensureFirebase().then(function () { return USE_AUTH ? ensureTeacher() : null; }).then(function () {
      var arm = USE_AUTH ? Promise.resolve() : db.ref("wipe/token").set(String(window.SN_TEACHER_KEY || "")).catch(function () { failed.push("chat:wipe-token"); });
      return arm.then(function () {
        return Promise.all(paths.map(function (pth) { return db.ref(pth).remove().catch(function () { failed.push("chat:" + pth); }); }));
      }).then(function () { if (!USE_AUTH) return db.ref("wipe/token").remove().catch(noop); });
    }).then(function () { return { failed: failed }; }, function (e) { console.error("[SNChat]", e); return { failed: ["chat:" + ((e && (e.code || e.message)) || "error")] }; });
  }
  function wipeAll() {
    return removePaths(["threads", "messages", "images"].concat(USE_AUTH ? ["owners"] : [])).then(function (r) {
      try { Object.keys(localStorage).forEach(function (k) { if (k.indexOf(FLAG) === 0 || k === PURGE_KEY) localStorage.removeItem(k); }); } catch (e) {}
      return r;
    });
  }
  function deleteStudent(id) {
    var t = tidOf(id);
    return removePaths(["threads/" + t, "messages/" + t, "images/" + t].concat(USE_AUTH ? ["owners/" + t] : []));
  }

  window.SNTeacherChat = { wipeAll: wipeAll, deleteStudent: deleteStudent, open: open, close: closeUI, isTeacher: IS_TEACHER, checkUnread: checkUnread, getUnread: function () { return unread; } };

  function boot() {
    if (IS_TEACHER) {
      build();
      ensureTeacher().then(startTeacher).catch(function (e) { console.error("[SNChat]", e); });
    } else setTimeout(checkUnread, 3500);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();

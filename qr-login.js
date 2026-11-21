/* ==========================================================================
   qr-login.js — الدخول السريع بالـ QR + أجهزة الدخول
   --------------------------------------------------------------------------
   يتحمّل في صفحتين:
   - login.html   : زرار "الدخول بـ QR" (كاميرا أو صورة من المعرض) ثم طلب موافقة.
   - studenti.html: (1) بيسجّل الجهاز الحالي في قايمة الأجهزة،
                    (2) بيظهر نافذة موافقة/رفض لما حد يحاول يدخل بحسابك،
                    (3) بيملا كارت "الدخول السريع والأجهزة" في الإعدادات.
   نودات Firebase الجديدة:
     (الـ QR نفسه مش متخزن في أي مكان: بيتحسب من بيانات حساب الطالب — id + email + createdAt)
     devices/{uid}/{deviceId}  = { name, kind, os, browser, via, createdAt, lastSeen }
     loginRequests/{uid}/{id}  = { status: pending|approved|denied, device, createdAt, expiresAt }
   ========================================================================== */
(function () {
  "use strict";
  if (window.SNQR) return;

  var LS_DEV = "shadynasr-device-id";
  var LS_VIA = "shadynasr-login-via";
  var LS_LAST_REQ = "shadynasr-qr-last-req";
  var REQ_TTL = 2 * 60 * 1000;          // الطلب صالح دقيقتين
  var REQ_COOLDOWN = 15 * 1000;         // أقل مدة بين طلبين من نفس الجهاز
  var STALE_DEVICE_MS = 60 * 24 * 3600 * 1000; // جهاز ما ظهرش من 60 يوم بيتشال من القايمة
  var JSQR_CDNS = [
    "https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.js",
    "https://fastly.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.js"
  ];
  var QRGEN_CDNS = [
    "https://cdn.jsdelivr.net/npm/qrcode-generator@1.4.4/qrcode.js",
    "https://fastly.jsdelivr.net/npm/qrcode-generator@1.4.4/qrcode.js"
  ];

  /* ======================= أدوات عامة ======================= */
  function $(s, r) { return (r || document).querySelector(s); }
  function esc(v) { return String(v == null ? "" : v).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function getDb() { try { if (window.firebase && firebase.apps && firebase.apps.length) return firebase.database(); } catch (e) { /* ignore */ } return null; }
  function toast(msg, err) { if (window.snDialog && window.snDialog.toast) window.snDialog.toast(msg, { error: !!err, ms: 4200 }); }
  function sessionUser() {
    try {
      var s = JSON.parse(localStorage.getItem("shadynasr-current-user"));
      return s && s.id && localStorage.getItem("shadynasr-auth") ? s : null;
    } catch (e) { return null; }
  }
  function sessionStamp() { try { return localStorage.getItem("shadynasr-login-at") || "legacy"; } catch (e) { return "legacy"; } }

  function loadScript(src) {
    return new Promise(function (resolve, reject) {
      var s = document.createElement("script");
      s.src = src; s.async = true;
      s.onload = resolve;
      s.onerror = function () { s.remove(); reject(new Error("LOAD_FAILED")); };
      document.head.appendChild(s);
    });
  }
  async function ensureLib(globalName, urls) {
    if (window[globalName]) return window[globalName];
    for (var i = 0; i < urls.length; i++) {
      try { await loadScript(urls[i]); } catch (e) { /* نجرّب اللي بعده */ }
      if (window[globalName]) return window[globalName];
    }
    throw new Error("LIB_FAILED");
  }

  async function sha256Hex(str) {
    var buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(str));
    return Array.from(new Uint8Array(buf)).map(function (b) { return b.toString(16).padStart(2, "0"); }).join("");
  }
  function randHex(n) {
    var a = new Uint8Array(n); crypto.getRandomValues(a);
    return Array.from(a).map(function (b) { return b.toString(16).padStart(2, "0"); }).join("");
  }
  function b64uEncode(str) {
    var bytes = new TextEncoder().encode(str), bin = "";
    for (var i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  }
  function b64uDecode(s) {
    s = String(s).replace(/-/g, "+").replace(/_/g, "/");
    while (s.length % 4) s += "=";
    var bin = atob(s), bytes = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new TextDecoder().decode(bytes);
  }
  /* كود الـ QR بيتحسب من بيانات تسجيل الطالب الثابتة (id + email + createdAt):
     نفس الطالب = نفس الكود دايمًا، وكل طالب ليه كود مختلف، ومفيش حاجة تتخزن أو تتجدد.
     مقصود إننا ماستخدمناش كلمة السر عشان تغييرها ما يغيّرش الـ QR. */
  async function qrCodeFor(uid, email, createdAt) {
    var raw = ["SNQR1", String(uid), String(email || "").trim().toLowerCase(), String(createdAt || "")].join("|");
    var buf = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(raw)));
    var bin = ""; for (var i = 0; i < buf.length; i++) bin += String.fromCharCode(buf[i]);
    return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  }
  async function loadQrCode(uid) {
    var db = getDb();
    var r = await Promise.all([db.ref("users/" + uid + "/email").get(), db.ref("users/" + uid + "/createdAt").get()]);
    if (!r[0].exists()) throw new Error("NO_USER");
    return qrCodeFor(uid, r[0].val(), r[1].exists() ? r[1].val() : "");
  }
  function sameStr(a, b) {
    a = String(a); b = String(b);
    if (a.length !== b.length) return false;
    var d = 0; for (var i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
    return d === 0;
  }
  function randSecret() {
    var a = new Uint8Array(24); crypto.getRandomValues(a);
    var bin = ""; for (var i = 0; i < a.length; i++) bin += String.fromCharCode(a[i]);
    return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  }

  /* محتوى الـ QR: SNQR1.<uid بـ base64url>.<السر> — ASCII بس، فمفيش مشاكل ترميز */
  function makePayload(uid, secret) { return "SNQR1." + b64uEncode(uid) + "." + secret; }
  function parsePayload(text) {
    var parts = String(text || "").trim().split(".");
    if (parts.length !== 3 || parts[0] !== "SNQR1" || !parts[1] || !/^[A-Za-z0-9_-]{20,64}$/.test(parts[2])) return null;
    try { var uid = b64uDecode(parts[1]); return uid ? { uid: uid, secret: parts[2] } : null; } catch (e) { return null; }
  }

  function deviceInfo() {
    var ua = navigator.userAgent || "", os = "جهاز", br = "المتصفح", kind = "desktop";
    if (/Android/i.test(ua)) os = "Android";
    else if (/iPhone|iPod/i.test(ua)) os = "iOS";
    else if (/iPad/i.test(ua)) os = "iPadOS";
    else if (/Macintosh/i.test(ua)) os = navigator.maxTouchPoints > 1 ? "iPadOS" : "macOS";
    else if (/Windows/i.test(ua)) os = "Windows";
    else if (/CrOS/i.test(ua)) os = "ChromeOS";
    else if (/Linux/i.test(ua)) os = "Linux";
    if (/Edg\//.test(ua)) br = "Edge";
    else if (/OPR\/|Opera/.test(ua)) br = "Opera";
    else if (/SamsungBrowser/.test(ua)) br = "Samsung Internet";
    else if (/Firefox|FxiOS/.test(ua)) br = "Firefox";
    else if (/CriOS|Chrome/.test(ua)) br = "Chrome";
    else if (/Safari/.test(ua)) br = "Safari";
    if (os === "iPadOS" || (os === "Android" && !/Mobile/i.test(ua))) kind = "tablet";
    else if (/iPhone|iPod|Android/i.test(ua)) kind = "mobile";
    return { os: os, browser: br, kind: kind, name: br + " — " + os };
  }
  var KIND_AR = { mobile: "موبايل", tablet: "تابلت", desktop: "كمبيوتر" };

  function myDeviceId() {
    try {
      var d = localStorage.getItem(LS_DEV);
      if (!d) { d = "d" + Date.now().toString(36) + randHex(4); localStorage.setItem(LS_DEV, d); }
      return d;
    } catch (e) { return "d-temp"; }
  }
  function ago(ts) {
    var s = Math.max(0, (Date.now() - Number(ts || 0)) / 1000);
    if (s < 90) return "دلوقتي";
    var m = Math.floor(s / 60); if (m < 60) return "من " + m + " دقيقة";
    var h = Math.floor(m / 60); if (h < 24) return "من " + h + " ساعة";
    var d = Math.floor(h / 24); return "من " + d + " يوم";
  }
  function clock(ts) { try { return new Date(ts).toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" }); } catch (e) { return ""; } }
  function mmss(ms) { var s = Math.max(0, Math.ceil(ms / 1000)); return String(Math.floor(s / 60)).padStart(2, "0") + ":" + String(s % 60).padStart(2, "0"); }

  /* ======================= أيقونات ======================= */
  var SV = 'viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"';
  var ICON = {
    qr: '<svg ' + SV + '><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><path d="M14 14h3v3h-3zM20 14v3M14 20h3M20 20h1"/></svg>',
    shield: '<svg ' + SV + '><path d="M12 3 4.5 6v5.5c0 4.4 3.1 8.2 7.5 9.5 4.4-1.3 7.5-5.1 7.5-9.5V6Z"/><path d="M12 8.5v4M12 15.7v.01"/></svg>',
    mobile: '<svg ' + SV + '><rect x="7" y="2.5" width="10" height="19" rx="2.5"/><path d="M11 18.5h2"/></svg>',
    tablet: '<svg ' + SV + '><rect x="4" y="3" width="16" height="18" rx="2.5"/><path d="M11 18h2"/></svg>',
    desktop: '<svg ' + SV + '><rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8 20h8M12 16v4"/></svg>',
    check: '<svg ' + SV + '><circle cx="12" cy="12" r="9"/><path d="m8 12.5 2.8 2.8L16 9.5"/></svg>',
    x: '<svg ' + SV + '><circle cx="12" cy="12" r="9"/><path d="m9 9 6 6M15 9l-6 6"/></svg>',
    clock: '<svg ' + SV + '><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
    image: '<svg ' + SV + '><rect x="3" y="4" width="18" height="16" rx="3"/><circle cx="9" cy="10" r="2"/><path d="m21 16-5-5-8 9"/></svg>',
    out: '<svg ' + SV + '><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="M16 17l5-5-5-5"/><path d="M21 12H9"/></svg>'
  };

  /* ======================= الـ CSS (متغيّرات المنصة + احتياطي) ======================= */
  function injectCss() {
    if (document.getElementById("snQrCss")) return;
    var st = document.createElement("style");
    st.id = "snQrCss";
    st.textContent =
      ".sn-qr .modal{max-width:420px;width:calc(100% - 28px);text-align:center}" +
      ".sn-qr .modal__icon svg{width:26px;height:26px}" +
      ".sn-qr__info{margin:14px 0 10px;border:1px solid color-mix(in srgb,currentColor 16%,transparent);border-radius:14px;overflow:hidden;text-align:start}" +
      ".sn-qr__row{display:flex;gap:10px;align-items:center;justify-content:space-between;padding:10px 14px;font-size:.92rem}" +
      ".sn-qr__row+.sn-qr__row{border-top:1px solid color-mix(in srgb,currentColor 12%,transparent)}" +
      ".sn-qr__row span{opacity:.65;font-size:.84rem}.sn-qr__row strong{font-weight:700;text-align:end}" +
      ".sn-qr__timer{display:inline-flex;align-items:center;gap:6px;font-size:.85rem;opacity:.8;margin:2px 0 6px}" +
      ".sn-qr__timer svg{width:16px;height:16px}.sn-qr__timer b{font-variant-numeric:tabular-nums;direction:ltr}" +
      ".sn-qr__cam{position:relative;border-radius:18px;overflow:hidden;background:#0b0f12;aspect-ratio:1/1;max-width:300px;margin:14px auto 8px}" +
      ".sn-qr__cam video{width:100%;height:100%;object-fit:cover;display:block}" +
      ".sn-qr__frame{position:absolute;inset:15%;border:3px solid rgba(255,255,255,.92);border-radius:20px;box-shadow:0 0 0 999px rgba(0,0,0,.38);pointer-events:none}" +
      ".sn-qr__msg{min-height:1.4em;font-size:.88rem;margin:6px 0 2px;opacity:.9}.sn-qr__msg.is-err{color:#d64545;opacity:1}" +
      ".sn-qr__spin{display:inline-block;width:34px;height:34px;border-radius:50%;border:3px solid color-mix(in srgb,var(--accent,#2c8097) 25%,transparent);border-top-color:var(--accent,#2c8097);animation:snQrSpin .8s linear infinite;margin:10px 0 4px}" +
      "@keyframes snQrSpin{to{transform:rotate(360deg)}}" +
      ".sn-qr .modal__actions{flex-wrap:wrap}.sn-qr .modal__actions .btn{display:inline-flex;align-items:center;justify-content:center;gap:8px}" +
      ".sn-qr .modal__actions .btn svg{width:18px;height:18px}" +
      ".sn-qr-login{margin-top:2px;width:100%;display:inline-flex;align-items:center;justify-content:center;gap:9px}" +
      ".sn-qr-login svg{width:19px;height:19px}.sn-qr-or{display:flex;align-items:center;gap:10px;margin:2px 0;font-size:.8rem;opacity:.6}" +
      ".sn-qr-or::before,.sn-qr-or::after{content:'';flex:1;height:1px;background:currentColor;opacity:.25}" +
      ".qr-muted{font-size:.88rem;opacity:.75;line-height:1.7;margin:6px 0}" +
      ".qr-warn{font-size:.82rem;line-height:1.7;margin:10px 0;padding:10px 12px;border-radius:12px;background:color-mix(in srgb,#e1a21b 14%,transparent);border:1px solid color-mix(in srgb,#e1a21b 40%,transparent)}" +
      ".qr-img{display:block;width:100%;max-width:260px;margin:12px auto;border-radius:18px;box-shadow:0 6px 24px rgba(0,0,0,.14)}" +
      ".qr-btns{display:flex;flex-wrap:wrap;gap:8px;margin-top:10px}" +
      ".qr-sec{margin:20px 0 8px;font-size:1rem}" +
      ".qr-dev{display:flex;align-items:center;gap:12px;padding:12px 14px;margin-top:8px;border-radius:14px;border:1px solid color-mix(in srgb,currentColor 15%,transparent)}" +
      ".qr-dev.is-me{border-color:color-mix(in srgb,var(--accent,#2c8097) 55%,transparent);background:color-mix(in srgb,var(--accent,#2c8097) 7%,transparent)}" +
      ".qr-dev__ico{flex:none;width:40px;height:40px;border-radius:12px;display:grid;place-items:center;background:color-mix(in srgb,var(--accent,#2c8097) 14%,transparent);color:var(--accent,#2c8097)}" +
      ".qr-dev__ico svg{width:22px;height:22px}.qr-dev__txt{flex:1;min-width:0}.qr-dev__txt strong{display:block;font-size:.95rem}" +
      ".qr-dev__txt small{display:block;opacity:.7;font-size:.78rem;line-height:1.6}" +
      ".qr-tag{display:inline-block;margin-inline-start:6px;padding:1px 8px;border-radius:99px;font-size:.7rem;font-weight:700;background:var(--accent,#2c8097);color:#fff;vertical-align:middle}" +
      ".qr-dev__out{flex:none;border:0;background:transparent;color:#d64545;cursor:pointer;padding:8px;border-radius:10px}" +
      ".qr-dev__out:hover{background:color-mix(in srgb,#d64545 12%,transparent)}.qr-dev__out svg{width:20px;height:20px;display:block}";
    document.head.appendChild(st);
  }

  /* ======================= نوافذ بتصميم المنصة ======================= */
  var locks = 0, prevOverflow = "";
  function makeOverlay(extraCls) {
    var ov = document.createElement("div");
    ov.className = "modal-overlay sn-dialog sn-qr" + (extraCls ? " " + extraCls : "");
    var box = document.createElement("div");
    box.className = "modal";
    box.setAttribute("role", "dialog");
    box.setAttribute("aria-modal", "true");
    ov.appendChild(box);
    return { ov: ov, box: box };
  }
  function showOverlay(ov) {
    injectCss();
    if (!locks) { prevOverflow = document.body.style.overflow; document.body.style.overflow = "hidden"; }
    locks++;
    document.body.appendChild(ov);
    requestAnimationFrame(function () { ov.classList.add("is-open"); });
  }
  function hideOverlay(ov) {
    ov.classList.remove("is-open");
    setTimeout(function () { ov.remove(); }, 220);
    locks = Math.max(0, locks - 1);
    if (!locks) document.body.style.overflow = prevOverflow;
  }

  /* ==========================================================================
     (1) صفحة الطالب: تسجيل الجهاز + مراقبة الطلبات + كارت الإعدادات
     ========================================================================== */
  var curUid = null, registered = false, offs = [], hbTimer = null, lastBeat = 0;

  function deviceRef(uid) { return getDb().ref("devices/" + uid + "/" + myDeviceId()); }

  function kick() {
    var id = curUid;
    registered = false;
    try {
      localStorage.removeItem("shadynasr-auth");
      localStorage.removeItem("shadynasr-current-user");
      if (id && window.SNAuth && SNAuth.wipeLocalUserData) SNAuth.wipeLocalUserData(id);
    } catch (e) { /* ignore */ }
    window.location.replace("login.html");
  }

  async function ensureRegistered(uid) {
    var db = getDb(), ref = deviceRef(uid), flagKey = "shadynasr-device-reg:" + uid, stamp = sessionStamp();
    var snap = await ref.get();
    if (snap.exists()) {
      try { localStorage.setItem(flagKey, stamp); } catch (e) { /* ignore */ }
      return true;
    }
    // الجهاز كان متسجّل في نفس جلسة الدخول وبعدين اتشال من جهاز تاني: نطلّعه
    var flagged = false;
    try { flagged = localStorage.getItem(flagKey) === stamp; } catch (e) { /* ignore */ }
    if (flagged) { kick(); return false; }
    var info = deviceInfo(), now = Date.now(), via = "password";
    try { if (localStorage.getItem(LS_VIA) === "qr:" + stamp) via = "qr"; } catch (e) { /* ignore */ }
    await ref.set({ name: info.name, kind: info.kind, os: info.os, browser: info.browser, via: via, createdAt: now, lastSeen: now });
    try { localStorage.setItem(flagKey, stamp); } catch (e) { /* ignore */ }
    return true;
  }

  function beat() {
    if (!curUid || !registered) return;
    lastBeat = Date.now();
    try { deviceRef(curUid).transaction(function (cur) { return cur ? Object.assign({}, cur, { lastSeen: Date.now() }) : undefined; }); } catch (e) { /* ignore */ }
  }

  function watchOwnDevice(uid) {
    var ref = deviceRef(uid);
    var h = ref.on("value", function (snap) {
      if (snap.exists() || !registered) return;
      // نتأكد من السيرفر قبل ما نطلّع الطالب (مش من كاش الاتصال)
      ref.get().then(function (s2) { if (!s2.exists() && registered) kick(); }).catch(function () { /* ignore */ });
    });
    offs.push(function () { ref.off("value", h); });
    hbTimer = setInterval(beat, 5 * 60 * 1000);
    document.addEventListener("visibilitychange", function () {
      if (document.visibilityState === "visible" && Date.now() - lastBeat > 2 * 60 * 1000) beat();
    });
  }

  /* لما الطالب يعمل تسجيل خروج عادي: بنشيل الجهاز من القايمة (محاولة بدون انتظار) */
  function dropMyDevice() {
    var uid = curUid, db = getDb();
    if (!uid || !db) return;
    curUid = null; registered = false;
    offs.forEach(function (f) { try { f(); } catch (e) { /* ignore */ } });
    offs = []; clearInterval(hbTimer);
    try {
      var url = String(db.app.options.databaseURL).replace(/\/$/, "") + "/devices/" + encodeURIComponent(uid) + "/" + encodeURIComponent(myDeviceId()) + ".json";
      fetch(url, { method: "DELETE", keepalive: true });
    } catch (e) { /* ignore */ }
  }
  (function hookLogout() {
    try {
      var rm = Storage.prototype.removeItem, clr = Storage.prototype.clear;
      Storage.prototype.removeItem = function (k) {
        if (this === window.localStorage && k === "shadynasr-auth") { try { dropMyDevice(); } catch (e) { /* ignore */ } }
        return rm.apply(this, arguments);
      };
      Storage.prototype.clear = function () {
        if (this === window.localStorage) { try { dropMyDevice(); } catch (e) { /* ignore */ } }
        return clr.apply(this, arguments);
      };
    } catch (e) { /* ignore */ }
  })();

  /* ---------- نافذة الموافقة / الرفض ---------- */
  var approval = null; // { reqId, close }

  function showApproval(uid, reqId, r) {
    if (approval) { if (approval.reqId === reqId) return; approval.close(true); }
    var d = r.device || {}, ui = makeOverlay("sn-qr--ask");
    var ov = ui.ov, box = ui.box, done = false, tick = null;
    box.setAttribute("aria-labelledby", "snQrAskT");
    box.innerHTML =
      '<span class="modal__icon modal__icon--danger" aria-hidden="true">' + ICON.shield + '</span>' +
      '<h3 id="snQrAskT">في حد بيحاول يدخل بحسابك</h3>' +
      '<p>لو ده إنت، وافق عشان الجهاز الجديد يدخل. لو مش إنت، اضغط «لا، مش أنا» فورًا.</p>' +
      '<div class="sn-qr__info">' +
      '<div class="sn-qr__row"><span>الجهاز</span><strong>' + esc(d.name || "جهاز غير معروف") + '</strong></div>' +
      '<div class="sn-qr__row"><span>النوع</span><strong>' + esc(KIND_AR[d.kind] || "—") + '</strong></div>' +
      '<div class="sn-qr__row"><span>الطريقة</span><strong>QR الدخول السريع</strong></div>' +
      '<div class="sn-qr__row"><span>الوقت</span><strong>' + esc(clock(r.createdAt)) + '</strong></div>' +
      '</div>' +
      '<div class="sn-qr__timer">' + ICON.clock + '<span>الطلب بينتهي بعد <b id="snQrAskLeft">--:--</b></span></div>' +
      '<div class="modal__actions"><button type="button" class="btn btn--accent" data-act="ok">أيوه، ده أنا</button>' +
      '<button type="button" class="btn btn--sn-danger" data-act="no">لا، مش أنا</button></div>';

    var ref = getDb().ref("loginRequests/" + uid + "/" + reqId);
    function close(silent) {
      if (done) return; done = true;
      clearInterval(tick);
      if (approval && approval.reqId === reqId) approval = null;
      hideOverlay(ov);
    }
    async function answer(status) {
      if (done) return;
      var btns = box.querySelectorAll("button"); btns.forEach(function (b) { b.disabled = true; });
      try {
        var snap = await ref.get();
        if (!snap.exists() || snap.val().status !== "pending" || Date.now() > Number(snap.val().expiresAt || 0)) {
          toast("الطلب ده انتهى أو اتردّ عليه قبل كده.", true); close(true); return;
        }
        await ref.update({ status: status, answeredAt: Date.now(), answeredBy: myDeviceId() });
        if (status === "approved") toast("تمت الموافقة ✓ الجهاز الجديد هيدخل دلوقتي.");
        else toast("اترفض الطلب. لو صورة الـ QR وقعت مع حد، جدّدها من الإعدادات.");
        close(true);
      } catch (e) {
        btns.forEach(function (b) { b.disabled = false; });
        toast("تعذر إرسال ردّك، جرّب تاني.", true);
      }
    }
    box.addEventListener("click", function (e) {
      var b = e.target.closest("[data-act]"); if (!b) return;
      answer(b.getAttribute("data-act") === "ok" ? "approved" : "denied");
    });
    var left = $("#snQrAskLeft", box);
    function paint() {
      var ms = Number(r.expiresAt || 0) - Date.now();
      if (ms <= 0) { close(true); return; }
      left.textContent = mmss(ms);
    }
    paint(); tick = setInterval(paint, 1000);
    approval = { reqId: reqId, close: close };
    showOverlay(ov);
    try { if (navigator.vibrate) navigator.vibrate([220, 100, 220]); } catch (e) { /* ignore */ }
    setTimeout(function () { var ok = $('[data-act="ok"]', box); if (ok) try { ok.focus({ preventScroll: true }); } catch (e) { /* ignore */ } }, 80);
  }

  function watchRequests(uid) {
    var ref = getDb().ref("loginRequests/" + uid);
    var h = ref.on("value", function (snap) {
      var all = snap.val() || {}, now = Date.now(), newest = null;
      Object.keys(all).forEach(function (rid) {
        var r = all[rid];
        if (!r || typeof r !== "object") return;
        if (now > Number(r.expiresAt || 0) + 60000) { ref.child(rid).remove().catch(function () { /* ignore */ }); return; }
        if (r.status === "pending" && now < Number(r.expiresAt || 0)) {
          if (!newest || r.createdAt > newest.r.createdAt) newest = { rid: rid, r: r };
        } else if (approval && approval.reqId === rid) {
          approval.close(true); // اتردّ عليه من جهاز تاني
        }
      });
      if (newest) showApproval(uid, newest.rid, newest.r);
      else if (approval && !all[approval.reqId]) approval.close(true);
    }, function () { /* لو القراءة مش مسموحة منعملش حاجة */ });
    offs.push(function () { ref.off("value", h); });
  }

  /* ---------- كارت الـ QR في الإعدادات ---------- */
  async function drawQrCard(text, name) {
    await ensureLib("qrcode", QRGEN_CDNS);
    var qr = window.qrcode(0, "M"); qr.addData(text); qr.make();
    var n = qr.getModuleCount(), quiet = 3, W = 900, H = 1120;
    var accent = (getComputedStyle(document.documentElement).getPropertyValue("--accent") || "").trim() || "#2c8097";
    var c = document.createElement("canvas"); c.width = W; c.height = H;
    var x = c.getContext("2d");
    function rr(px, py, w, h, r) { x.beginPath(); x.moveTo(px + r, py); x.arcTo(px + w, py, px + w, py + h, r); x.arcTo(px + w, py + h, px, py + h, r); x.arcTo(px, py + h, px, py, r); x.arcTo(px, py, px + w, py, r); x.closePath(); }
    var g = x.createLinearGradient(0, 0, W, H); g.addColorStop(0, accent); g.addColorStop(1, "#10222b");
    x.fillStyle = g; x.fillRect(0, 0, W, H);
    x.fillStyle = "#fff"; rr(50, 50, W - 100, H - 100, 48); x.fill();
    x.direction = "rtl"; x.textAlign = "center"; x.textBaseline = "alphabetic";
    x.fillStyle = "#10222b"; x.font = "800 50px Cairo, Tajawal, Arial, sans-serif";
    x.fillText("الدخول السريع بالـ QR", W / 2, 165);
    x.fillStyle = accent; x.font = "700 34px Cairo, Tajawal, Arial, sans-serif";
    x.fillText("Shady Nasr English Platform", W / 2, 218);
    var size = 640, cell = size / (n + quiet * 2), ox = (W - size) / 2, oy = 262;
    x.fillStyle = "#fff"; x.fillRect(ox, oy, size, size);
    x.fillStyle = "#10222b";
    for (var r = 0; r < n; r++) for (var col = 0; col < n; col++) {
      if (qr.isDark(r, col)) x.fillRect(Math.floor(ox + (col + quiet) * cell), Math.floor(oy + (r + quiet) * cell), Math.ceil(cell), Math.ceil(cell));
    }
    x.fillStyle = "#10222b"; x.font = "700 40px Cairo, Tajawal, Arial, sans-serif";
    x.fillText(name || "حسابي", W / 2, oy + size + 80);
    x.fillStyle = "#b53a3a"; x.font = "600 29px Cairo, Tajawal, Arial, sans-serif";
    x.fillText("ماتشاركش الصورة دي مع حد — دي مفتاح حسابك", W / 2, oy + size + 140);
    x.fillStyle = "#5b6b73"; x.font = "500 26px Cairo, Tajawal, Arial, sans-serif";
    x.fillText("امسحها من صفحة الدخول، وهتوصلك رسالة تأكيد على جهازك", W / 2, oy + size + 190);
    return c;
  }

  async function saveImage(canvas) {
    var blob = await new Promise(function (res) { canvas.toBlob(res, "image/png"); });
    if (!blob) throw new Error("NO_BLOB");
    /* حفظ مباشر على الجهاز (تحميل الملف) — مش نافذة مشاركة */
    var a = document.createElement("a");
    if (!("download" in a)) throw new Error("NO_DOWNLOAD");
    a.href = URL.createObjectURL(blob); a.download = "shady-nasr-qr-login.png";
    a.style.display = "none";
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 8000);
    toast("اتحفظت صورة الـ QR على جهازك ✓");
  }

  /* الـ QR ثابت ومبني على بيانات حساب الطالب (شوف qrCodeFor) */
  var qrCanvas = null;
  async function renderQrBox(uid) {
    var box = $("#qrBox"); if (!box) return;
    box.innerHTML = '<p class="qr-muted">بنجهّز الـ QR بتاعك…</p>';
    try {
      var code = await loadQrCode(uid);
      qrCanvas = await drawQrCard(makePayload(uid, code), (sessionUser() || {}).fullName || "");
    } catch (e) {
      box.innerHTML = '<p class="qr-muted">تعذر تحميل الـ QR. اتأكد من النت وجرّب تاني.</p><div class="qr-btns"><button type="button" class="btn btn--ghost" id="qrRetry">إعادة المحاولة</button></div>';
      return;
    }
    box.innerHTML =
      '<p class="qr-muted">ده الـ QR الخاص بحسابك، مبني على بيانات تسجيل دخولك، وهو ثابت ومش بيتغيّر. امسحه من صفحة الدخول على أي جهاز تاني (بالكاميرا أو من صورة في المعرض)، وهتوصلك رسالة تأكيد على أجهزتك المسجّل بيها الدخول.</p>' +
      '<img class="qr-img" id="qrImg" alt="QR الدخول السريع بحسابك" />' +
      '<div class="qr-warn">ماتشاركش الصورة دي مع حد. أي حد معاه الصورة يقدر يطلب دخول بحسابك، بس مش هيدخل غير لو إنت وافقت من جهازك.</div>' +
      '<div class="qr-btns"><button type="button" class="btn btn--accent" id="qrSave">حفظ الصورة</button></div>';
    $("#qrImg", box).src = qrCanvas.toDataURL("image/png");
  }
  async function onQrBoxClick(e) {
    var b = e.target.closest("button"); if (!b || !curUid) return;
    if (b.id === "qrRetry") renderQrBox(curUid);
    else if (b.id === "qrSave" && qrCanvas) {
      try { await saveImage(qrCanvas); } catch (err) { toast("اضغط ضغطة مطوّلة على الصورة واختار «حفظ الصورة».", true); }
    }
  }

  /* ---------- قايمة الأجهزة ---------- */
  function renderDevices(list) {
    var box = $("#qrDevices"); if (!box) return;
    var me = myDeviceId(), now = Date.now();
    var arr = Object.keys(list || {}).map(function (k) { return Object.assign({ id: k }, list[k]); })
      .filter(function (d) {
        if (d.id !== me && now - Number(d.lastSeen || 0) > STALE_DEVICE_MS) { try { getDb().ref("devices/" + curUid + "/" + d.id).remove(); } catch (e) { /* ignore */ } return false; }
        return true;
      })
      .sort(function (a, b) { return (b.id === me) - (a.id === me) || Number(b.lastSeen || 0) - Number(a.lastSeen || 0); });
    if (!arr.length) { box.innerHTML = '<p class="qr-muted">مفيش أجهزة متسجّلة لسه.</p>'; return; }
    var others = arr.filter(function (d) { return d.id !== me; }).length;
    box.innerHTML = arr.map(function (d) {
      var mine = d.id === me, kind = ICON[d.kind] ? d.kind : "desktop";
      return '<div class="qr-dev' + (mine ? " is-me" : "") + '"><span class="qr-dev__ico">' + ICON[kind] + '</span>' +
        '<div class="qr-dev__txt"><strong>' + esc(d.name || "جهاز") + (mine ? '<span class="qr-tag">الجهاز ده</span>' : "") + '</strong>' +
        '<small>' + esc(KIND_AR[d.kind] || "") + " • " + (d.via === "qr" ? "دخل بالـ QR" : "دخل بكلمة المرور") + '</small>' +
        '<small>' + (mine ? "شغّال دلوقتي" : "آخر ظهور " + esc(ago(d.lastSeen))) + " • دخل " + esc(ago(d.createdAt)) + '</small></div>' +
        (mine ? "" : '<button type="button" class="qr-dev__out" data-out="' + esc(d.id) + '" aria-label="تسجيل خروج الجهاز ده" title="تسجيل خروج الجهاز ده">' + ICON.out + '</button>') + '</div>';
    }).join("") + (others ? '<div class="qr-btns"><button type="button" class="btn btn--sn-danger" data-out-all="1">تسجيل خروج من كل الأجهزة التانية (' + others + ')</button></div>' : "");
  }
  async function logoutAllOthers() {
    var uid = curUid, db = getDb(), me = myDeviceId();
    var ok = window.snDialog ? await window.snDialog.confirm({ icon: "logout", tone: "danger", title: "تسجيل خروج من كل الأجهزة التانية", message: "كل الأجهزة غير الجهاز ده هتتسجّل خروجها من حسابك أول ما تفتح المنصة. الجهاز ده هيفضل داخل.", confirmText: "تسجيل خروج الكل", cancelText: "إلغاء" }) : true;
    if (!ok) return;
    try {
      var snap = await db.ref("devices/" + uid).get(), upd = {};
      Object.keys(snap.val() || {}).forEach(function (k) { if (k !== me) upd["devices/" + uid + "/" + k] = null; });
      upd["loginRequests/" + uid] = null; // أي طلب دخول لسه معلّق يتلغي كمان
      await db.ref().update(upd);
      toast("تم تسجيل خروج كل الأجهزة التانية ✓");
    } catch (err) { toast("تعذر تسجيل الخروج، جرّب تاني.", true); }
  }
  async function onDevicesClick(e) {
    if (e.target.closest("[data-out-all]")) { if (curUid) logoutAllOthers(); return; }
    var b = e.target.closest("[data-out]"); if (!b || !curUid) return;
    var devId = b.getAttribute("data-out");
    var ok = window.snDialog ? await window.snDialog.confirm({ icon: "logout", tone: "danger", title: "تسجيل خروج الجهاز", message: "الجهاز ده هيتسجّل خروجه من حسابك أول ما يفتح المنصة.", confirmText: "تسجيل خروج", cancelText: "إلغاء" }) : true;
    if (!ok) return;
    try { await getDb().ref("devices/" + curUid + "/" + devId).remove(); toast("تم تسجيل خروج الجهاز ✓"); }
    catch (err) { toast("تعذر تسجيل الخروج، جرّب تاني.", true); }
  }
  function watchDevices(uid) {
    var ref = getDb().ref("devices/" + uid);
    var h = ref.on("value", function (snap) { renderDevices(snap.val() || {}); }, function () {
      var box = $("#qrDevices"); if (box) box.innerHTML = '<p class="qr-muted">تعذر تحميل قايمة الأجهزة.</p>';
    });
    offs.push(function () { ref.off("value", h); });
  }

  async function initStudent() {
    var s = sessionUser();
    if (!s || s.role === "admin" || !getDb()) return;
    injectCss();
    curUid = s.id;
    try {
      if (!(await ensureRegistered(s.id))) return;
      registered = true;
      beat();
      watchOwnDevice(s.id);
      watchRequests(s.id);
      var qb = $("#qrBox"), dv = $("#qrDevices");
      if (qb) qb.addEventListener("click", onQrBoxClick);
      if (dv) dv.addEventListener("click", onDevicesClick);
      watchDevices(s.id);
      renderQrBox(s.id).catch(function () { /* ignore */ });
    } catch (e) {
      console.warn("[SNQR] init failed", e);
    }
  }

  /* ==========================================================================
     (2) صفحة الدخول: القارئ (كاميرا / معرض) + طلب الموافقة
     ========================================================================== */
  var scanner = null;

  function decodeImageFile(file) {
    return new Promise(function (resolve, reject) {
      function fromSource(src, w0, h0, cleanup) {
        var found = null, sizes = [1400, 900, 600];
        for (var i = 0; i < sizes.length && !found; i++) {
          var sc = Math.min(1, sizes[i] / Math.max(w0, h0)), w = Math.max(1, Math.round(w0 * sc)), h = Math.max(1, Math.round(h0 * sc));
          var cv = document.createElement("canvas"); cv.width = w; cv.height = h;
          var cx = cv.getContext("2d", { willReadFrequently: true });
          cx.fillStyle = "#fff"; cx.fillRect(0, 0, w, h);
          cx.drawImage(src, 0, 0, w, h);
          var r = window.jsQR(cx.getImageData(0, 0, w, h).data, w, h, { inversionAttempts: "attemptBoth" });
          if (r && r.data) found = r.data;
        }
        if (cleanup) cleanup();
        resolve(found);
      }
      if (window.createImageBitmap) {
        createImageBitmap(file).then(function (bmp) { fromSource(bmp, bmp.width, bmp.height, function () { try { bmp.close(); } catch (e) { /* ignore */ } }); })
          .catch(function () { viaImg(); });
      } else viaImg();
      function viaImg() {
        var url = URL.createObjectURL(file), img = new Image();
        img.onload = function () { fromSource(img, img.naturalWidth, img.naturalHeight, function () { URL.revokeObjectURL(url); }); };
        img.onerror = function () { URL.revokeObjectURL(url); reject(new Error("BAD_IMAGE")); };
        img.src = url;
      }
    });
  }

  function openScanner() {
    if (scanner) return;
    var ui = makeOverlay("sn-qr--scan"), ov = ui.ov, box = ui.box;
    box.setAttribute("aria-labelledby", "snQrScanT");
    var stream = null, stopped = false, timer = null, unsub = null, countdown = null, finished = false;
    var canvas = document.createElement("canvas"), ctx = canvas.getContext("2d", { willReadFrequently: true });
    var video = null, msg = null;

    function stopCam() {
      stopped = true; clearTimeout(timer);
      if (stream) { stream.getTracks().forEach(function (t) { t.stop(); }); stream = null; }
    }
    function close() {
      stopCam(); clearInterval(countdown);
      if (unsub) { try { unsub(); } catch (e) { /* ignore */ } unsub = null; }
      scanner = null; hideOverlay(ov);
    }
    scanner = { close: close };

    function scanView(note) {
      stopped = false; finished = false;
      box.innerHTML =
        '<span class="modal__icon" aria-hidden="true">' + ICON.qr + '</span>' +
        '<h3 id="snQrScanT">الدخول بـ QR</h3>' +
        '<p>وجّه الكاميرا ناحية الـ QR بتاع حسابك، أو اختار صورته من المعرض.</p>' +
        '<div class="sn-qr__cam" id="snQrCam"><video playsinline muted></video><span class="sn-qr__frame"></span></div>' +
        '<div class="sn-qr__msg" aria-live="polite"></div>' +
        '<div class="modal__actions"><button type="button" class="btn btn--accent" data-act="pick">' + ICON.image + '<span>اختار صورة من المعرض</span></button>' +
        '<button type="button" class="btn btn--ghost" data-act="close">إلغاء</button></div>' +
        '<input type="file" accept="image/*" hidden />';
      video = $("video", box); msg = $(".sn-qr__msg", box);
      if (note) setMsg(note, true);
      startCam();
    }
    function setMsg(t, err) { if (!msg) return; msg.textContent = t || ""; msg.classList.toggle("is-err", !!err); }
    function noCam(t) { var cam = $("#snQrCam", box); if (cam) cam.hidden = true; setMsg(t, false); }

    async function startCam() {
      try { await ensureLib("jsQR", JSQR_CDNS); } catch (e) { setMsg("تعذر تحميل قارئ الـ QR. اتأكد من النت وجرّب تاني.", true); return; }
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) { noCam("الكاميرا مش متاحة على المتصفح ده — اختار صورة من المعرض."); return; }
      try { stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" } }, audio: false }); }
      catch (e) { noCam(e && e.name === "NotAllowedError" ? "محتاج إذن الكاميرا — اسمح بيه من المتصفح، أو اختار صورة من المعرض." : "الكاميرا مش شغالة — اختار صورة من المعرض."); return; }
      if (stopped) { stream.getTracks().forEach(function (t) { t.stop(); }); stream = null; return; }
      video.srcObject = stream;
      try { await video.play(); } catch (e) { /* ignore */ }
      tick();
    }
    function tick() {
      if (stopped || !video) return;
      if (video.readyState >= 2 && video.videoWidth) {
        var w = Math.min(640, video.videoWidth), h = Math.round(video.videoHeight * w / video.videoWidth);
        canvas.width = w; canvas.height = h;
        ctx.drawImage(video, 0, 0, w, h);
        var r = window.jsQR(ctx.getImageData(0, 0, w, h).data, w, h, { inversionAttempts: "dontInvert" });
        if (r && r.data && onText(r.data)) return;
      }
      timer = setTimeout(tick, 140);
    }
    /* بيرجّع true لو الـ QR بتاعنا وبدأ الطلب */
    function onText(text) {
      var p = parsePayload(text);
      if (!p) { setMsg("ده مش QR بتاع المنصة. جرّب QR حسابك.", true); return false; }
      stopCam(); startRequest(p); return true;
    }

    /* ---------- بعد قراءة الـ QR: تحقق ثم طلب موافقة ---------- */
    function busyView(title, text) {
      box.innerHTML = '<span class="modal__icon" aria-hidden="true">' + ICON.shield + '</span><h3>' + esc(title) + '</h3><p>' + esc(text) + '</p><span class="sn-qr__spin" role="status"></span>';
    }
    function endView(icon, title, text, retry) {
      clearInterval(countdown);
      box.innerHTML = '<span class="modal__icon' + (icon === "x" ? " modal__icon--danger" : "") + '" aria-hidden="true">' + ICON[icon] + '</span><h3>' + esc(title) + '</h3><p>' + esc(text) + '</p>' +
        '<div class="modal__actions">' + (retry ? '<button type="button" class="btn btn--accent" data-act="again">حاول تاني</button>' : "") +
        '<button type="button" class="btn btn--ghost" data-act="close">إغلاق</button></div>';
    }

    async function startRequest(p) {
      var db = getDb();
      busyView("بنتأكد من الـ QR…", "ثواني وهنكمّل.");
      try {
        var res = await Promise.all([db.ref("users/" + p.uid + "/createdAt").get(), db.ref("users/" + p.uid + "/role").get(), db.ref("users/" + p.uid + "/email").get()]);
        if (!res[2].exists()) return endView("x", "الحساب مش موجود", "الـ QR ده تابع لحساب مش موجود دلوقتي.", true);
        if (res[1].exists() && res[1].val() === "admin") return endView("x", "مش متاح", "الدخول بالـ QR للطلاب بس.", false);
        var expected = await qrCodeFor(p.uid, res[2].val(), res[0].exists() ? res[0].val() : "");
        if (!sameStr(expected, p.secret)) return endView("x", "الـ QR ده مش شغال", "ده QR غلط أو مش بتاع الحساب ده. استخدم صورة الـ QR من صفحة «حسابي».", true);
      } catch (e) { return endView("x", "تعذر التحقق", "اتأكد من النت وجرّب تاني.", true); }

      var last = Number(localStorage.getItem(LS_LAST_REQ) || 0);
      if (Date.now() - last < REQ_COOLDOWN) return endView("clock", "استنى شوية", "ابعت طلب جديد بعد لحظات.", true);

      var info = deviceInfo(), ref = db.ref("loginRequests/" + p.uid).push(), now = Date.now(), expiresAt = now + REQ_TTL;
      try {
        await ref.set({ status: "pending", device: { name: info.name, kind: info.kind, os: info.os, browser: info.browser }, createdAt: now, expiresAt: expiresAt });
        localStorage.setItem(LS_LAST_REQ, String(now));
      } catch (e) { return endView("x", "تعذر إرسال الطلب", "جرّب تاني بعد لحظات.", true); }

      box.innerHTML =
        '<span class="modal__icon" aria-hidden="true">' + ICON.shield + '</span>' +
        '<h3>في انتظار موافقتك</h3>' +
        '<p>بعتنا رسالة تأكيد لأجهزتك المسجّل بيها الدخول. افتح المنصة على جهازك التاني ووافق على الطلب.</p>' +
        '<span class="sn-qr__spin" role="status"></span>' +
        '<div class="sn-qr__timer">' + ICON.clock + '<span>الطلب بينتهي بعد <b id="snQrLeft">--:--</b></span></div>' +
        '<div class="modal__actions"><button type="button" class="btn btn--ghost" data-act="cancel">إلغاء الطلب</button></div>';
      var left = $("#snQrLeft", box);
      function paint() { var ms = expiresAt - Date.now(); if (ms <= 0) { expire(); return; } left.textContent = mmss(ms); }
      function expire() { if (finished) return; finished = true; try { ref.remove(); } catch (e) { /* ignore */ } endView("clock", "انتهت المهلة", "محدش وافق على الطلب في الوقت المحدد.", true); if (unsub) { unsub(); unsub = null; } }
      paint(); countdown = setInterval(paint, 1000);
      scanner.cancelRequest = function () { finished = true; try { ref.remove(); } catch (e) { /* ignore */ } };

      var h = ref.on("value", function (snap) {
        if (finished) return;
        var v = snap.val();
        if (!v) { finished = true; endView("x", "الطلب اتلغى", "اتلغى الطلب من الجهاز التاني.", true); return; }
        if (v.status === "approved") {
          finished = true; clearInterval(countdown);
          busyView("تمت الموافقة ✓", "جاري تسجيل دخولك…");
          completeLogin(p.uid, ref).catch(function () { endView("x", "تعذر تسجيل الدخول", "جرّب تاني من الأول.", true); });
        } else if (v.status === "denied") {
          finished = true; try { ref.remove(); } catch (e) { /* ignore */ }
          endView("x", "اترفض الطلب", "صاحب الحساب رفض الدخول من الجهاز ده.", false);
        }
      });
      unsub = function () { ref.off("value", h); };
    }

    async function completeLogin(uid, reqRef) {
      var snap = await getDb().ref("users/" + uid).get();
      var user = snap.exists() ? snap.val() : null;
      if (!user || user.role === "admin") throw new Error("NO_USER");
      try { if (window.SNAuth && SNAuth.syncAccountGeneration) SNAuth.syncAccountGeneration(user, false); } catch (e) { /* ignore */ }
      var stamp = String(Date.now());
      localStorage.setItem("shadynasr-auth", "1");
      localStorage.setItem("shadynasr-login-at", stamp);
      localStorage.setItem(LS_VIA, "qr:" + stamp);
      localStorage.setItem("shadynasr-current-user", JSON.stringify({ id: user.id || uid, fullName: user.fullName, email: user.email, grade: user.grade, role: user.role || "student" }));
      try {
        var raw = JSON.parse(localStorage.getItem("shadynasr-db-users")), users = Array.isArray(raw) ? raw : [];
        var idx = users.findIndex(function (u) { return u.id === user.id; });
        if (idx >= 0) users[idx] = user; else users.push(user);
        localStorage.setItem("shadynasr-db-users", JSON.stringify(users));
      } catch (e) { /* الكاش اختياري */ }
      try { await reqRef.remove(); } catch (e) { /* ignore */ }
      window.location.replace("studenti.html");
    }

    /* ---------- الأزرار ---------- */
    box.addEventListener("click", function (e) {
      var b = e.target.closest("[data-act]"); if (!b) return;
      var act = b.getAttribute("data-act");
      if (act === "close") close();
      else if (act === "cancel") { if (scanner && scanner.cancelRequest) scanner.cancelRequest(); close(); }
      else if (act === "again") { if (unsub) { unsub(); unsub = null; } clearInterval(countdown); scanView(); }
      else if (act === "pick") { var f = $("input[type=file]", box); if (f) f.click(); }
    });
    box.addEventListener("change", async function (e) {
      var f = e.target && e.target.type === "file" ? e.target.files && e.target.files[0] : null;
      if (!f) return;
      e.target.value = "";
      setMsg("بنقرا الصورة…", false);
      try {
        await ensureLib("jsQR", JSQR_CDNS);
        var text = await decodeImageFile(f);
        if (!text) { setMsg("مش لاقي QR واضح في الصورة. جرّب صورة أوضح.", true); return; }
        stopCam();
        if (!onText(text)) { stopped = false; startCam(); }
      } catch (err) { setMsg("تعذر قراءة الصورة. جرّب صورة تانية.", true); }
    });
    document.addEventListener("keydown", function esc1(e) { if (!scanner) { document.removeEventListener("keydown", esc1, true); return; } if (e.key === "Escape") { if (scanner.cancelRequest) scanner.cancelRequest(); close(); } }, true);

    showOverlay(ov);
    scanView();
  }

  function initLogin() {
    var btn = document.getElementById("qrLoginBtn");
    if (!btn) return false;
    injectCss();
    btn.addEventListener("click", openScanner);
    return true;
  }

  function boot() { if (!initLogin()) initStudent(); }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();

  window.SNQR = { parsePayload: parsePayload, makePayload: makePayload, qrCodeFor: qrCodeFor };
})();

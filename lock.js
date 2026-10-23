/* ==========================================================================
   lock.js — شاشة قفل المنصة في صفحة الطالب (studenti.html)
   - الأدمن بيقفل المنصة من الإعدادات بكود من 10 أرقام (أو QR بنفس الكود).
   - أي طالب (داخل بحساب موجود أو لسه عامل حساب جديد) لازم يدخل الكود أو يعمل scan
     قبل ما يشوف لوحة الطالب. لو الكود غلط ما يدخلش.
   - متابعة لحظية: لو الأدمن قفل والطالب فاتح المنصة، الشاشة بتظهر فورًا؛ ولو فتح القفل بتختفي.
   - الكود نفسه مش متخزّن في قاعدة البيانات، بس بصمته (hash) — الفحص بيتم في متصفح الطالب.
   يتحمّل في studenti.html بعد firebase.js وقبل باقي السكريبتات.
   ========================================================================== */
(() => {
  "use strict";

  let session = null;
  try { session = JSON.parse(localStorage.getItem("shadynasr-current-user")); } catch (e) { session = null; }
  if (!session || !session.id || session.role === "admin") return;
  if (!window.SNAuth || !SNAuth.watchPlatformLock) return;

  const CACHE_KEY = "shadynasr-lock-cache";
  const okKey = () => "shadynasr-lock-ok:" + session.id;
  const MAX_FAILS = 5;
  const COOLDOWN_MS = 60 * 1000;
  const JSQR_SRC = "https://cdnjs.cloudflare.com/ajax/libs/jsQR/1.4.0/jsQR.min.js";

  let lock = null;
  let screen = null;
  let stream = null;
  let scanning = false;
  let fails = 0;
  let blockedUntil = 0;
  let busy = false;
  let checkedRemote = null; // lockId اللي اتأكدنا من سيرفر إن الطالب دخل كوده

  const html = document.documentElement;
  const $ = (s, r) => (r || screen).querySelector(s);
  const needLock = () => {
    if (!lock || !lock.active) return false;
    try { return localStorage.getItem(okKey()) !== lock.lockId; } catch (e) { return true; }
  };

  /* ---------- شكل الشاشة ---------- */
  function injectStyle() {
    if (document.getElementById("snLockStyle")) return;
    const st = document.createElement("style");
    st.id = "snLockStyle";
    st.textContent =
      "#snLockScreen{position:fixed;inset:0;z-index:2147483000;display:flex;align-items:center;justify-content:center;padding:20px;overflow:auto;" +
      "background:var(--bg,#f4eee0);color:var(--text,#1c2b3a);font-family:Tajawal,Cairo,system-ui,sans-serif}" +
      "#snLockScreen .lk{width:min(440px,100%);background:var(--surface-glass,#fff);border:1px solid var(--surface-glass-border,rgba(0,0,0,.1));" +
      "border-radius:22px;padding:26px 22px;box-shadow:0 20px 60px rgba(0,0,0,.18);text-align:center}" +
      "#snLockScreen .lk__ico{width:64px;height:64px;margin:0 auto 12px;border-radius:50%;display:grid;place-items:center;background:var(--accent,#c8902e);color:#fff}" +
      "#snLockScreen .lk__ico svg{width:30px;height:30px}" +
      "#snLockScreen h2{margin:0 0 6px;font-family:Cairo,Tajawal,sans-serif;font-size:1.3rem}" +
      "#snLockScreen p{margin:0 0 14px;opacity:.85;line-height:1.7;font-size:.95rem}" +
      "#snLockScreen .lk__code{width:100%;box-sizing:border-box;text-align:center;direction:ltr;letter-spacing:.35em;font-size:1.4rem;font-weight:700;padding:13px 10px;" +
      "border-radius:14px;border:1.5px solid var(--surface-glass-border,rgba(0,0,0,.2));background:transparent;color:inherit;font-family:inherit}" +
      "#snLockScreen .lk__code:focus{outline:2px solid var(--accent,#c8902e);outline-offset:1px}" +
      "#snLockScreen .lk__btn{width:100%;margin-top:10px;padding:13px;border-radius:14px;border:0;cursor:pointer;font:inherit;font-weight:700;font-size:1rem;" +
      "background:var(--accent,#c8902e);color:#fff}" +
      "#snLockScreen .lk__btn:disabled{opacity:.5;cursor:not-allowed}" +
      "#snLockScreen .lk__btn--ghost{background:transparent;color:inherit;border:1.5px solid var(--surface-glass-border,rgba(0,0,0,.25))}" +
      "#snLockScreen .lk__row{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:8px}" +
      "#snLockScreen .lk__opt{display:flex;flex-direction:column;align-items:center;gap:6px;padding:14px 8px;border-radius:16px;border:1.5px solid var(--surface-glass-border,rgba(0,0,0,.25));background:transparent;color:inherit;font:inherit;font-weight:700;cursor:pointer}" +
      "#snLockScreen .lk__opt:hover,#snLockScreen .lk__opt:focus-visible{border-color:var(--accent,#c8902e);outline:none}" +
      "#snLockScreen .lk__opt svg{width:28px;height:28px;color:var(--accent,#c8902e)}" +
      "#snLockScreen .lk__or{margin:14px 0 2px;opacity:.6;font-size:.85rem}" +
      "#snLockScreen .lk__cam{display:none;margin-top:12px;border-radius:14px;overflow:hidden;background:#000;position:relative}" +
      "#snLockScreen .lk__cam.is-on{display:block}" +
      "#snLockScreen .lk__cam video{width:100%;display:block;max-height:300px;object-fit:cover}" +
      "#snLockScreen .lk__err{color:#d23b3b;font-weight:700;margin:10px 0 0;min-height:1.2em;font-size:.92rem}" +
      "#snLockScreen .lk__warn{margin:14px 0 0;font-size:.8rem;opacity:.75;line-height:1.6}" +
      "#snLockModal{z-index:5}" +
      "#snLockModal .lk__mbody{text-align:start;font-size:.95rem}" +
      "#snLockModal .lk__mbody p{margin:0 0 10px}" +
      "#snLockModal .lk__mbody ol{margin:8px 0 10px;padding-inline-start:22px;line-height:1.9}" +
      "#snLockModal .lk__i{width:1.05em;height:1.05em;vertical-align:-.17em;margin-inline:2px}" +
      "#snLockModal .modal__actions{flex-wrap:wrap}" +
      "#snLockScreen .lk__out{margin-top:10px;background:none;border:0;color:inherit;opacity:.7;text-decoration:underline;cursor:pointer;font:inherit;font-size:.85rem}";
    document.head.appendChild(st);
  }

  function buildScreen() {
    if (screen) return;
    injectStyle();
    screen = document.createElement("div");
    screen.id = "snLockScreen";
    screen.setAttribute("role", "dialog");
    screen.setAttribute("aria-modal", "true");
    screen.dir = "rtl";
    screen.innerHTML =
      '<div class="lk">' +
      '<div class="lk__ico" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg></div>' +
      "<h2>المنصة مقفولة</h2>" +
      "<p>اكتب كود الدخول المكوّن من 10 أرقام اللي إدارة المنصة إدّتهولك، أو افتح الكاميرا وامسح الـ QR.</p>" +
      '<input class="lk__code" id="snLockCode" type="text" inputmode="numeric" pattern="[0-9]*" maxlength="10" autocomplete="off" placeholder="••••••••••" aria-label="كود الدخول" />' +
      '<button class="lk__btn" id="snLockGo" type="button" disabled>دخول</button>' +
      '<div class="lk__or">أو امسح الـ QR</div>' +
      '<div class="lk__row"><button class="lk__opt" id="snLockScan" type="button">' + ICON.cam + "<span>الكاميرا</span></button>" +
      '<button class="lk__opt" id="snLockPick" type="button">' + ICON.img + "<span>من المعرض</span></button></div>" +
      '<input type="file" id="snLockFile" accept="image/*" hidden />' +
      '<div class="lk__cam" id="snLockCam"><video id="snLockVideo" playsinline muted></video></div>' +
      '<p class="lk__err" id="snLockErr" role="alert"></p>' +
      '<p class="lk__warn">لو ما دخلتش الكود خلال 30 يوم من قفل المنصة (أو من تسجيل حسابك لو سجّلت بعد القفل) هيتم مسح حسابك وكل بياناتك نهائيًا.</p>' +
      '<button class="lk__out" id="snLockOut" type="button">تسجيل الخروج</button>' +
      "</div>" +
      '<div class="modal-overlay sn-dialog" id="snLockModal" hidden><div class="modal" role="alertdialog" aria-modal="true" aria-labelledby="snLockMTitle">' +
      '<span class="modal__icon" id="snLockMIcon" aria-hidden="true"></span><h3 id="snLockMTitle"></h3><div class="lk__mbody" id="snLockMBody"></div>' +
      '<div class="modal__actions"><button class="btn btn--ghost" id="snLockMGo" type="button" hidden></button>' +
      '<button class="btn btn--accent" id="snLockMOk" type="button"></button><button class="btn btn--ghost" id="snLockMNo" type="button"></button></div></div></div>';
    document.body.appendChild(screen);

    const input = $("#snLockCode");
    const go = $("#snLockGo");
    input.addEventListener("input", () => {
      input.value = input.value.replace(/\D/g, "").slice(0, 10);
      go.disabled = input.value.length !== 10;
      setErr("");
    });
    input.addEventListener("keydown", (e) => { if (e.key === "Enter" && input.value.length === 10) submit(input.value); });
    go.addEventListener("click", () => submit(input.value));
    $("#snLockScan").addEventListener("click", async () => {
      if (scanning) { stopScan(); return; }
      if (await askPermission("camera")) startScan();
    });
    $("#snLockPick").addEventListener("click", async () => {
      if (await askPermission("photos")) $("#snLockFile").click();
    });
    $("#snLockFile").addEventListener("change", (e) => {
      const f = e.target.files && e.target.files[0];
      e.target.value = "";
      if (f) scanImageFile(f);
    });
    $("#snLockOut").addEventListener("click", logout);
  }

  const setErr = (msg) => { const e = screen && $("#snLockErr"); if (e) e.textContent = msg || ""; };

  function showScreen() {
    buildScreen();
    html.classList.add("sn-lock-pending");
    screen.hidden = false;
    document.body.style.overflow = "hidden";
  }

  function hideScreen() {
    stopScan();
    html.classList.remove("sn-lock-pending");
    document.body.style.overflow = "";
    if (screen) { screen.remove(); screen = null; }
  }

  function apply() {
    if (needLock()) showScreen(); else hideScreen();
  }

  function logout() {
    try {
      localStorage.removeItem("shadynasr-auth");
      localStorage.removeItem("shadynasr-current-user");
    } catch (e) { /* ignore */ }
    window.location.replace("index.html");
  }

  /* ---------- التحقق من الكود ---------- */
  async function submit(raw) {
    const code = String(raw || "").replace(/\D/g, "");
    if (busy || !lock) return;
    if (code.length !== 10) { setErr("الكود لازم يكون 10 أرقام."); return; }
    const wait = blockedUntil - Date.now();
    if (wait > 0) { setErr("محاولات كتير غلط. جرّب تاني بعد " + Math.ceil(wait / 1000) + " ثانية."); return; }
    busy = true;
    try {
      const ok = await SNAuth.verifyPlatformLockCode(lock, code);
      if (!ok) {
        fails++;
        if (fails >= MAX_FAILS) { fails = 0; blockedUntil = Date.now() + COOLDOWN_MS; setErr("الكود غلط. استنى دقيقة قبل المحاولة الجاية."); }
        else setErr("الكود غلط، راجع الكود أو اطلب كود جديد من الإدارة.");
        const input = screen && $("#snLockCode");
        if (input) { input.value = ""; const g = $("#snLockGo"); if (g) g.disabled = true; }
        return;
      }
      fails = 0;
      try { localStorage.setItem(okKey(), lock.lockId); } catch (e) { /* ignore */ }
      try { await SNAuth.markLockOk(session.id, lock.lockId); } catch (e) { /* الدخول المحلي كفاية، والأدمن بيتأكد من السيرفر قبل أي مسح */ }
      apply();
    } finally {
      busy = false;
    }
  }

  /* ---------- مسح QR بالكاميرا ---------- */
  function loadJsQR() {
    return new Promise((resolve, reject) => {
      if (window.jsQR) return resolve();
      const s = document.createElement("script");
      s.src = JSQR_SRC;
      s.async = true;
      s.onload = () => (window.jsQR ? resolve() : reject(new Error("NO_JSQR")));
      s.onerror = () => reject(new Error("LOAD_FAILED"));
      document.head.appendChild(s);
    });
  }

  /* ---------- نافذة طلب الإذن (بتظهر قبل رسالة المتصفح) ---------- */
  const SV = (p) => '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' + p + "</svg>";
  const ICON = {
    cam: SV('<path d="M4 8h3l1.6-2.4h6.8L17 8h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1Z"/><circle cx="12" cy="13" r="3.6"/>'),
    img: SV('<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="1.8"/><path d="m21 16-5-5-9 9"/>'),
    lock: SV('<rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>'),
  };
  const LOCK_I = ICON.lock.replace("<svg ", '<svg class="lk__i" ');

  function modal(opts) {
    return new Promise((resolve) => {
      const m = $("#snLockModal");
      $("#snLockMTitle").textContent = opts.title;
      $("#snLockMIcon").innerHTML = ICON[opts.icon] || ICON.lock;
      $("#snLockMBody").innerHTML = opts.html;
      const ok = $("#snLockMOk"), no = $("#snLockMNo");
      const go = $("#snLockMGo");
      ok.textContent = opts.ok;
      no.textContent = opts.no;
      go.hidden = !opts.extra;
      go.onclick = null;
      if (opts.extra) { go.textContent = opts.extra.text; go.onclick = opts.extra.fn; }
      m.hidden = false;
      m.classList.add("is-open");
      const done = (v) => { m.hidden = true; m.classList.remove("is-open"); ok.onclick = no.onclick = go.onclick = null; go.hidden = true; resolve(v); };
      ok.onclick = () => done(true);
      no.onclick = () => done(false);
    });
  }

  /* المتصفح مش بيسمح لأي موقع يفتح صفحة إعداداته مباشرة، فبنعرض خطوات مخصوصة لجهاز الطالب
     + أقرب زرار ممكن (نسخ رابط إعدادات الموقع على الكمبيوتر / محاولة فتح إعدادات المتصفح على أندرويد) */
  function platformInfo() {
    const ua = navigator.userAgent || "";
    const ios = /iPad|iPhone|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
    const android = /Android/i.test(ua);
    let pkg = "com.android.chrome";
    if (/SamsungBrowser/i.test(ua)) pkg = "com.sec.android.app.sbrowser";
    else if (/Firefox|FxiOS/i.test(ua)) pkg = "org.mozilla.firefox";
    else if (/EdgA/i.test(ua)) pkg = "com.microsoft.emmx";
    const edge = /Edg\//.test(ua);
    return { ios, android, pkg, edge };
  }

  function helpModal(kind) {
    const cam = kind === "camera";
    const what = cam ? "الكاميرا" : "الصور";
    const p = platformInfo();
    let steps, extra = null, note = "";
    if (p.ios) {
      steps = ["افتح تطبيق «الإعدادات» (Settings) في الآيفون.", "انزل لحد اسم المتصفح (Safari مثلًا) وافتحه.", "افتح «" + (cam ? "الكاميرا" : "الصور") + "» واختار «سماح» (Allow) أو «اسأل».", "أو من Safari نفسه: اضغط «aA» في شريط العنوان ← «إعدادات الموقع» ← «" + what + "» ← سماح."];
      note = "آيفون مش بيسمح بفتح الإعدادات من جوه الموقع، فلازم تفتحها بإيدك.";
    } else if (p.android) {
      steps = ["اضغط على أيقونة القفل " + LOCK_I + " جنب عنوان الموقع.", "اختار «الأذونات» (Permissions).", "افتح «" + what + "» واختار «سماح» (Allow).", "ارجع هنا واضغط «حاول تاني»."];
      extra = {
        text: "افتح إعدادات المتصفح",
        fn: () => {
          const t0 = Date.now();
          const hint = () => { if (!document.hidden && Date.now() - t0 > 1200) { const n = $("#snLockMBody"); if (n && !n.querySelector(".lk__fail")) n.insertAdjacentHTML("beforeend", '<p class="lk__fail" style="color:#d23b3b;font-weight:700">الجهاز منع فتح الإعدادات من هنا — اتبع الخطوات اللي فوق.</p>'); } };
          try { window.location.href = "intent:package:" + p.pkg + "#Intent;action=android.settings.APPLICATION_DETAILS_SETTINGS;end"; } catch (e) { /* ignore */ }
          setTimeout(hint, 1500);
        },
      };
      note = "زرار «افتح إعدادات المتصفح» محاولة، وبعض الأجهزة بتمنعها — لو ماتفتحتش اتبع الخطوات.";
    } else {
      const scheme = p.edge ? "edge" : "chrome";
      const link = scheme + "://settings/content/siteDetails?site=" + encodeURIComponent(location.origin);
      steps = ["اضغط على أيقونة القفل " + LOCK_I + " (أو أيقونة الإعدادات) جنب عنوان الموقع.", "اختار «إعدادات الموقع» (Site settings).", "خلّي «" + what + "» على «سماح» (Allow).", "ارجع هنا واضغط «حاول تاني»."];
      if (/Chrome|Edg/.test(navigator.userAgent) && !/Firefox/.test(navigator.userAgent)) {
        extra = {
          text: "نسخ رابط إعدادات الموقع",
          fn: async () => {
            let ok = false;
            try { await navigator.clipboard.writeText(link); ok = true; } catch (e) { ok = false; }
            const n = $("#snLockMBody");
            if (n) n.insertAdjacentHTML("beforeend", '<p style="font-weight:700">' + (ok ? "اتنسخ الرابط — الصقه في شريط العنوان واضغط Enter." : "انسخ الرابط ده والصقه في شريط العنوان:") + '</p><p dir="ltr" style="word-break:break-all;font-size:.8rem;opacity:.8">' + link.replace(/[<>&"]/g, "") + "</p>");
          },
        };
      }
    }
    return modal({
      title: "إذن " + what + " مقفول",
      icon: cam ? "cam" : "img",
      html: "<p>المتصفح منع الوصول لـ" + what + ". عشان تفعّله:</p><ol>" + steps.map((x) => "<li>" + x + "</li>").join("") + "</ol>" +
        (note ? '<p style="font-size:.82rem;opacity:.75">' + note + "</p>" : "") + "<p>ولو مش عايز تفعّله، اكتب الكود يدويًا.</p>",
      ok: "حاول تاني",
      no: "إغلاق",
      extra,
    });
  }

  let askedPhotos = false;
  async function askPermission(kind) {
    if (!screen) return false;
    setErr("");
    if (kind === "camera") {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) { setErr("الكاميرا مش متاحة على المتصفح ده. اكتب الكود يدويًا."); return false; }
      let state = "prompt";
      try { if (navigator.permissions && navigator.permissions.query) state = (await navigator.permissions.query({ name: "camera" })).state; } catch (e) { state = "prompt"; }
      if (state === "granted") return true;
      if (state === "denied") return (await helpModal("camera")) ? askPermission("camera") : false;
      return modal({
        title: "السماح باستخدام الكاميرا",
        icon: "cam",
        html: "<p>المنصة محتاجة إذن الكاميرا عشان تمسح الـ QR. هتظهرلك رسالة من المتصفح بعد ما تضغط «السماح» — اختار «سماح» (Allow).</p>",
        ok: "السماح",
        no: "مش دلوقتي",
      });
    }
    if (askedPhotos) return true;
    const ok = await modal({
      title: "السماح بالوصول للصور",
      icon: "img",
      html: "<p>هتختار صورة الـ QR من جهازك. لو المتصفح سألك عن إذن الصور أو الملفات اختار «سماح» (Allow). الصورة بتتقرا على جهازك بس ومبتتبعتش لأي مكان.</p>",
      ok: "السماح واختيار صورة",
      no: "مش دلوقتي",
    });
    askedPhotos = ok;
    return ok;
  }

  /* ---------- قراءة QR من صورة في المعرض ---------- */
  async function scanImageFile(file) {
    if (!screen) return;
    setErr("");
    let bmp = null;
    try { bmp = await createImageBitmap(file); } catch (e) {
      try {
        const url = URL.createObjectURL(file);
        bmp = await new Promise((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = rej; im.src = url; });
      } catch (e2) { bmp = null; }
    }
    if (!bmp) { setErr("ما قدرناش نقرا الصورة دي. جرّب صورة تانية."); return; }
    const w = bmp.width || bmp.naturalWidth, h = bmp.height || bmp.naturalHeight;
    const k = Math.min(1, 1600 / Math.max(w, h));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(w * k);
    canvas.height = Math.round(h * k);
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    ctx.drawImage(bmp, 0, 0, canvas.width, canvas.height);
    let text = "";
    try {
      if ("BarcodeDetector" in window) {
        const found = await new BarcodeDetector({ formats: ["qr_code"] }).detect(canvas);
        if (found && found.length) text = found[0].rawValue || "";
      }
    } catch (e) { /* نجرّب jsQR */ }
    if (!text) {
      try {
        await loadJsQR();
        const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const r = window.jsQR(img.data, img.width, img.height, { inversionAttempts: "attemptBoth" });
        if (r && r.data) text = r.data;
      } catch (e) { setErr("ما قدرناش نحمّل قارئ الـ QR (محتاج نت). اكتب الكود يدويًا."); return; }
    }
    const m = String(text).match(/\d{10}/);
    if (!m) { setErr("ما لقيناش QR صالح في الصورة دي. اختار صورة أوضح أو اكتب الكود."); return; }
    submit(m[0]);
  }

  async function startScan() {
    if (!screen) return;
    setErr("");
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setErr("الكاميرا مش متاحة على المتصفح ده. اكتب الكود يدويًا.");
      return;
    }
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" } }, audio: false });
    } catch (e) {
      if (e && (e.name === "NotAllowedError" || e.name === "SecurityError")) {
        if (screen && (await helpModal("camera"))) { startScan(); }
      } else {
        setErr("ما قدرناش نفتح الكاميرا. تأكد إن مفيش تطبيق تاني بيستخدمها أو اكتب الكود يدويًا.");
      }
      return;
    }
    if (!screen) { stopStream(); return; }
    const video = $("#snLockVideo");
    video.srcObject = stream;
    $("#snLockCam").classList.add("is-on");
    $("#snLockScan").querySelector("span").textContent = "إغلاق الكاميرا";
    try { await video.play(); } catch (e) { /* ignore */ }
    scanning = true;

    let detector = null;
    if ("BarcodeDetector" in window) {
      try { detector = new BarcodeDetector({ formats: ["qr_code"] }); } catch (e) { detector = null; }
    }
    if (!detector) {
      try { await loadJsQR(); } catch (e) {
        stopScan();
        setErr("ما قدرناش نحمّل قارئ الـ QR (محتاج نت). اكتب الكود يدويًا.");
        return;
      }
    }
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d", { willReadFrequently: true });

    const tick = async () => {
      if (!scanning || !screen) return;
      let text = "";
      try {
        if (video.readyState >= 2 && video.videoWidth) {
          if (detector) {
            const found = await detector.detect(video);
            if (found && found.length) text = found[0].rawValue || "";
          } else {
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const r = window.jsQR(img.data, img.width, img.height);
            if (r && r.data) text = r.data;
          }
        }
      } catch (e) { /* نكمّل */ }
      const m = String(text).match(/\d{10}/);
      if (m) {
        stopScan();
        submit(m[0]);
        return;
      }
      setTimeout(tick, 250);
    };
    tick();
  }

  function stopStream() {
    if (stream) { stream.getTracks().forEach((t) => t.stop()); stream = null; }
  }

  function stopScan() {
    scanning = false;
    stopStream();
    if (screen) {
      const cam = $("#snLockCam");
      const btn = $("#snLockScan");
      if (cam) cam.classList.remove("is-on");
      if (btn) btn.querySelector("span").textContent = "الكاميرا";
    }
  }

  /* ---------- متابعة حالة القفل لحظيًا ---------- */
  function onLock(data) {
    lock = data && data.active && data.lockId && data.codeHash ? data : null;
    try {
      if (lock) localStorage.setItem(CACHE_KEY, JSON.stringify({ active: true, lockId: lock.lockId, lockedAt: lock.lockedAt }));
      else localStorage.removeItem(CACHE_KEY);
    } catch (e) { /* ignore */ }

    if (!needLock()) { apply(); return; }
    // ممكن الطالب يكون دخل الكود من جهاز تاني: نتأكد من حسابه (قيمة صغيرة) قبل ما نعرض الشاشة
    if (checkedRemote === lock.lockId) { apply(); return; }
    const id = lock.lockId;
    apply();
    SNAuth.fetchLockOk(session.id).then((v) => {
      checkedRemote = id;
      if (v === id) { try { localStorage.setItem(okKey(), id); } catch (e) { /* ignore */ } }
      if (lock && lock.lockId === id) apply();
    }).catch(() => {});
  }

  try {
    SNAuth.watchPlatformLock(onLock, () => { /* مفيش نت/صلاحيات: نسيب الحالة المحفوظة زي ما هي */ });
  } catch (e) { /* ignore */ }
})();

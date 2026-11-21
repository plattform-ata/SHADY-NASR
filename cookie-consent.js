/* ==========================================================================
   cookie-consent.js — بانر الموافقة على الكوكيز والتخزين المحلي
   - ملف واحد بدون أي مكتبات خارجية، ويحقن الـ CSS والـ HTML بنفسه.
   - بياخد ألوان وخطوط الموقع من shared.css (--bg, --ink, --brand ...).
   - الاختيار بيتحفظ في localStorage تحت المفتاح "shadynasr-cookie-consent".
   - أزرار "قبول الكل" و"رفض الكل" و"تخصيص" بنفس الحجم والأهمية،
     وزرار X بيقفل البانر ويكمّل من غير موافقة على الاختياري.
   - مفيش أي أداة اختيارية بتتحمّل قبل الموافقة (راجع الأمثلة تحت).

   الاستخدام في كل صفحة قبل </body>:
     <script src="cookie-consent.js" defer></script>

   لينك "إعدادات الكوكيز" في الفوتر (أي عنصر بالخاصية دي بيفتح الإعدادات):
     <a href="#" data-cookie-settings>إعدادات الكوكيز</a>

   لو ضفت أداة إحصائيات مستقبلاً، حمّلها بس بعد الموافقة:
     function loadAnalytics() { ...حمّل السكريبت هنا... }
     if (SNCookieConsent.has("analytics")) loadAnalytics();
     document.addEventListener("sncookieconsent", function (e) {
       if (e.detail.choices.analytics) loadAnalytics();
     });
   ========================================================================== */
(function () {
  "use strict";
  if (window.SNCookieConsent) return;

  /* ------------------------------ الإعدادات ------------------------------ */
  var STORAGE_KEY = "shadynasr-cookie-consent";
  var VERSION = 1; // ارفعه لما تغيّر الفئات، عشان البانر يظهر تاني للكل
  var VALID_MONTHS = 12; // الغارانتي: ماتسألش تاني قبل 6 شهور على الأقل
  var POLICY_URL = "privacy.html#cookies";
  var SHOW_FLOATING_BUTTON = false; // true = زرار صغير ثابت لفتح الإعدادات

  var CATEGORIES = [
    {
      id: "necessary",
      locked: true,
      title: "ضرورية",
      desc: "تسجيل الدخول، وحفظ جلستك، وتفضيلاتك مثل اللغة والثيم. المنصة لا تعمل بدونها."
    },
    {
      id: "analytics",
      locked: false,
      title: "إحصائيات وتحسين الأداء",
      desc: "تساعدنا على فهم استخدام المنصة لتحسينها. لا نستخدم أي أداة إحصائيات حاليًا، وإن فعّلناها لن تعمل إلا بموافقتك."
    }
  ];

  /* ------------------------------- التخزين ------------------------------- */
  var current = null;

  function readRecord() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      var r = JSON.parse(raw);
      if (!r || r.v !== VERSION || !r.t || !r.c) return null;
      var maxAge = VALID_MONTHS * 30 * 24 * 60 * 60 * 1000;
      if (Date.now() - r.t > maxAge) return null;
      return r;
    } catch (e) {
      return null;
    }
  }

  function defaultChoices() {
    var c = {};
    CATEGORIES.forEach(function (cat) {
      c[cat.id] = !!cat.locked;
    });
    return c;
  }

  function save(choices, how) {
    choices.necessary = true;
    var rec = { v: VERSION, t: Date.now(), how: how, c: choices };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(rec));
    } catch (e) {}
    current = rec;
    try {
      document.dispatchEvent(
        new CustomEvent("sncookieconsent", { detail: { choices: choices, how: how, time: rec.t } })
      );
    } catch (e) {}
  }

  /* --------------------------------- CSS --------------------------------- */
  var CSS = [
    ".sn-cc{position:fixed;z-index:10000;left:12px;right:12px;bottom:calc(12px + env(safe-area-inset-bottom,0px));margin:0 auto;max-width:760px;",
    "background:var(--surface-glass,#fbf8ef);color:var(--ink,#0f2d35);border:1px solid var(--surface-glass-border,rgba(15,45,53,.14));",
    "border-radius:var(--radius-lg,22px);padding:20px 22px 18px;box-shadow:0 12px 40px rgba(11,33,40,.22);",
    "font-family:var(--font-body,'Tajawal','Cairo',system-ui,sans-serif);font-size:15px;line-height:1.75;direction:rtl;text-align:right;",
    "max-height:calc(100dvh - 24px);overflow-y:auto;transition:opacity .25s ease,transform .25s ease}",
    ".sn-cc[hidden]{display:none}",
    ".sn-cc.sn-cc-in{animation:sn-cc-up .3s ease both}",
    "@keyframes sn-cc-up{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:none}}",
    "@media (prefers-reduced-motion:reduce){.sn-cc.sn-cc-in{animation:none}}",
    ".sn-cc h2{margin:0 0 6px;padding-inline-end:36px;font-family:var(--font-display,'Cairo','Tajawal',system-ui,sans-serif);font-size:18px;font-weight:800;color:var(--brand-strong,#0f2d35);line-height:1.4}",
    ".sn-cc p{margin:0}",
    ".sn-cc a{color:var(--brand,#1d5260);text-decoration:underline;text-underline-offset:3px;font-weight:700}",
    ".sn-cc-x{position:absolute;top:10px;inset-inline-end:10px;width:36px;height:36px;border:0;border-radius:50%;background:transparent;color:var(--ink-soft,#4d6a71);font-size:22px;line-height:1;cursor:pointer}",
    ".sn-cc-x:hover{background:var(--bg-soft,#e8e1ce)}",
    ".sn-cc-actions{display:flex;flex-wrap:wrap;gap:10px;margin-top:14px}",
    ".sn-cc-btn{flex:1 1 140px;min-height:44px;padding:8px 18px;border-radius:var(--radius-pill,999px);font:inherit;font-weight:800;cursor:pointer;",
    "border:1.5px solid var(--brand,#1d5260);background:var(--brand,#1d5260);color:var(--bg,#f4eee0)}",
    ".sn-cc-btn.sn-cc-ghost{background:transparent;color:var(--brand,#1d5260)}",
    ".sn-cc-btn:hover{filter:brightness(1.08)}",
    ".sn-cc button:focus-visible,.sn-cc a:focus-visible,.sn-cc input:focus-visible+.sn-cc-sw{outline:3px solid var(--accent,#2c8097);outline-offset:2px}",
    ".sn-cc-details{margin-top:14px;border-top:1px solid var(--surface-glass-border,rgba(15,45,53,.14))}",
    ".sn-cc-row{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;padding:12px 0;border-bottom:1px solid var(--surface-glass-border,rgba(15,45,53,.14))}",
    ".sn-cc-row strong{display:block;font-weight:800}",
    ".sn-cc-row span.sn-cc-d{display:block;color:var(--ink-soft,#4d6a71);font-size:14px}",
    ".sn-cc-tg{position:relative;flex:none;margin-top:2px;cursor:pointer}",
    ".sn-cc-tg input{position:absolute;opacity:0;inset:0;width:100%;height:100%;margin:0;cursor:pointer}",
    ".sn-cc-sw{display:block;width:46px;height:26px;border-radius:999px;background:var(--ink-soft,#4d6a71);opacity:.55;position:relative;transition:background .2s,opacity .2s}",
    ".sn-cc-sw::after{content:'';position:absolute;top:3px;inset-inline-start:3px;width:20px;height:20px;border-radius:50%;background:var(--bg,#fff);transition:inset-inline-start .2s}",
    ".sn-cc-tg input:checked+.sn-cc-sw{background:var(--brand,#1d5260);opacity:1}",
    ".sn-cc-tg input:checked+.sn-cc-sw::after{inset-inline-start:23px}",
    ".sn-cc-tg input:disabled{cursor:not-allowed}",
    ".sn-cc-tg input:disabled+.sn-cc-sw{opacity:.85}",
    ".sn-cc-float{position:fixed;z-index:9999;inset-inline-start:12px;bottom:calc(12px + env(safe-area-inset-bottom,0px));min-height:40px;padding:6px 14px;border-radius:999px;",
    "border:1px solid var(--surface-glass-border,rgba(15,45,53,.14));background:var(--surface-glass,#fbf8ef);color:var(--ink,#0f2d35);font:700 13px var(--font-body,system-ui,sans-serif);cursor:pointer}"
  ].join("");

  /* --------------------------------- UI ---------------------------------- */
  var root = null;
  var floatBtn = null;

  function esc(s) {
    return String(s).replace(/[&<>"]/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
    });
  }

  function injectStyle() {
    if (document.getElementById("sn-cc-style")) return;
    var st = document.createElement("style");
    st.id = "sn-cc-style";
    st.textContent = CSS;
    document.head.appendChild(st);
  }

  function build() {
    if (root) return;
    injectStyle();
    root = document.createElement("div");
    root.className = "sn-cc";
    root.setAttribute("role", "dialog");
    root.setAttribute("aria-modal", "false");
    root.setAttribute("aria-labelledby", "sn-cc-title");
    root.setAttribute("aria-describedby", "sn-cc-text");
    root.setAttribute("dir", "rtl");
    root.setAttribute("lang", "ar");
    root.hidden = true;

    var rows = CATEGORIES.map(function (c) {
      return (
        '<div class="sn-cc-row"><div><strong>' + esc(c.title) + '</strong><span class="sn-cc-d">' + esc(c.desc) + "</span></div>" +
        '<label class="sn-cc-tg"><input type="checkbox" data-cat="' + esc(c.id) + '"' +
        (c.locked ? " checked disabled" : "") +
        ' aria-label="' + esc(c.title) + '"><span class="sn-cc-sw"></span></label></div>'
      );
    }).join("");

    root.innerHTML =
      '<button type="button" class="sn-cc-x" data-act="dismiss" aria-label="إغلاق والمتابعة بدون قبول الاختياري" title="إغلاق والمتابعة بدون قبول الاختياري">&times;</button>' +
      '<h2 id="sn-cc-title" tabindex="-1">خصوصيتك على المنصة</h2>' +
      '<p id="sn-cc-text">نستخدم تخزينًا تقنيًا ضروريًا لتشغيل حسابك وحفظ تفضيلاتك. أي استخدام اختياري، مثل الإحصائيات، لا يبدأ إلا بموافقتك، وتقدر تغيّر اختيارك في أي وقت. التفاصيل في <a href="' + esc(POLICY_URL) + '">سياسة الخصوصية والكوكيز</a>.</p>' +
      '<div class="sn-cc-details" hidden>' + rows + "</div>" +
      '<div class="sn-cc-actions">' +
      '<button type="button" class="sn-cc-btn" data-act="accept">قبول الكل</button>' +
      '<button type="button" class="sn-cc-btn" data-act="reject">رفض الكل</button>' +
      '<button type="button" class="sn-cc-btn sn-cc-ghost" data-act="customize" aria-expanded="false">تخصيص</button>' +
      "</div>";

    root.addEventListener("click", onClick);
    document.body.appendChild(root);
  }

  function setDetails(open) {
    var d = root.querySelector(".sn-cc-details");
    var b = root.querySelector('[data-act="customize"]');
    d.hidden = !open;
    b.setAttribute("aria-expanded", open ? "true" : "false");
    b.textContent = open ? "حفظ اختياراتي" : "تخصيص";
    b.setAttribute("data-act", open ? "save" : "customize");
  }

  function syncToggles() {
    var ch = current ? current.c : defaultChoices();
    root.querySelectorAll("input[data-cat]").forEach(function (i) {
      i.checked = !!ch[i.getAttribute("data-cat")];
    });
  }

  function readToggles() {
    var c = defaultChoices();
    root.querySelectorAll("input[data-cat]").forEach(function (i) {
      var id = i.getAttribute("data-cat");
      if (id !== "necessary") c[id] = i.checked;
    });
    return c;
  }

  function allChoices(val) {
    var c = defaultChoices();
    CATEGORIES.forEach(function (cat) {
      if (!cat.locked) c[cat.id] = val;
    });
    return c;
  }

  function onClick(e) {
    var btn = e.target.closest("[data-act]");
    if (!btn) return;
    var act = btn.getAttribute("data-act");
    if (act === "accept") finish(allChoices(true), "accept");
    else if (act === "reject") finish(allChoices(false), "reject");
    else if (act === "dismiss") finish(allChoices(false), "dismiss");
    else if (act === "customize") setDetails(true);
    else if (act === "save") finish(readToggles(), "custom");
  }

  function finish(choices, how) {
    save(choices, how);
    root.hidden = true;
    root.classList.remove("sn-cc-in");
    if (floatBtn) floatBtn.hidden = false;
  }

  function show(focus) {
    build();
    syncToggles();
    setDetails(false);
    root.hidden = false;
    root.classList.remove("sn-cc-in");
    void root.offsetWidth;
    root.classList.add("sn-cc-in");
    if (floatBtn) floatBtn.hidden = true;
    if (focus) {
      var t = root.querySelector("#sn-cc-title");
      if (t) t.focus();
    }
  }

  function buildFloating() {
    if (!SHOW_FLOATING_BUTTON || floatBtn) return;
    injectStyle();
    floatBtn = document.createElement("button");
    floatBtn.type = "button";
    floatBtn.className = "sn-cc-float";
    floatBtn.textContent = "إعدادات الكوكيز";
    floatBtn.hidden = true;
    floatBtn.addEventListener("click", function () {
      show(true);
    });
    document.body.appendChild(floatBtn);
  }

  /* ------------------------------- الواجهة ------------------------------- */
  window.SNCookieConsent = {
    get: function () {
      return current ? JSON.parse(JSON.stringify(current)) : null;
    },
    has: function (cat) {
      if (cat === "necessary") return true;
      return !!(current && current.c && current.c[cat] === true);
    },
    open: function () {
      show(true);
    },
    reset: function () {
      try {
        localStorage.removeItem(STORAGE_KEY);
      } catch (e) {}
      current = null;
      show(true);
    }
  };

  function init() {
    current = readRecord();
    buildFloating();
    if (!current) show(false);
    else if (floatBtn) floatBtn.hidden = false;
    document.addEventListener("click", function (e) {
      var a = e.target.closest && e.target.closest("[data-cookie-settings]");
      if (a) {
        e.preventDefault();
        show(true);
      }
    });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();

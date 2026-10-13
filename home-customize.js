/* ==========================================================================
   home-customize.js — تخصيص الصفحة الرئيسية للطالب (زي تطبيقات الموبايل)
   - زرار "تعديل": بيظهر علامة (−) على كل مربع + زرار (+) عائم.
   - (−) بتشيل المربع من الرئيسية. (+) بتفتح قائمة بالمربعات اللي اتشالت بس، والضغط على أي واحد بيرجّعه.
   - اللي موجود فعلًا في الرئيسية مش بيظهر جوه قائمة (+). و(+) مش بتظهر غير في وضع التعديل.
   - الاختيار بيتحفظ على الجهاز لكل طالب، وبيتزامن أونلاين (لو Firebase شغّال).
   - عربي/إنجليزي: أسماء المربعات والأزرار بتتغيّر مع لغة المنصة.
   يتحمّل في studenti.html بعد home.js.
   ========================================================================== */
(function () {
  "use strict";

  var $ = function (s, r) { return (r || document).querySelector(s); };
  var isEn = function () { return document.documentElement.lang === "en"; };

  var UI = {
    edit:   ["تعديل", "Edit"],
    done:   ["تم", "Done"],
    remove: ["إزالة من الرئيسية", "Remove from home"],
    add:    ["إضافة مربع", "Add a widget"],
    sheet:  ["إضافة للرئيسية", "Add to home"],
    empty:  ["كل المربعات موجودة في الرئيسية بالفعل.", "All widgets are already on your home page."],
    close:  ["إغلاق", "Close"]
  };
  var ICON_EDIT = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>';
  var ICON_DONE = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';
  function t(k) { return UI[k][isEn() ? 1 : 0]; }

  /* المربعات اللي ينفع تتشال/تترجّع (الاسم عربي | إنجليزي) */
  var WIDGETS = [
    { k: "lesson",       ar: "كمّل من حيث وقفت", en: "Continue where you left off", get: function () { return $('#homeGrid .home-tile[data-go="lesson"]'); } },
    { k: "leaderboard",  ar: "لوحة الصدارة",     en: "Leaderboard",                 get: function () { return $('#homeGrid .home-tile[data-go="leaderboard"]'); } },
    { k: "grades",       ar: "آخر الدرجات",      en: "Latest grades",               get: function () { return $('#homeGrid .home-tile[data-go="grades"]'); } },
    { k: "progress",     ar: "تقدّمك",           en: "Your progress",               get: function () { return $('#homeGrid .home-tile[data-go="progress"]'); } },
    { k: "honors",       ar: "الأوائل",          en: "Top students",                get: function () { return $('#homeGrid .home-tile[data-go="honors"]'); } },
    { k: "teachernotes", ar: "ملاحظات الأستاذ",  en: "Teacher's notes",             get: function () { return $('#homeGrid .home-tile[data-go="teachernotes"]'); } },
    { k: "chart",        ar: "تطوّر مستواك (الرسم البياني)", en: "Your progress chart", get: function () { return $("#homeProgressChart"); } },
    { k: "ann",          ar: "آخر إعلان",        en: "Latest announcement",         get: function () { return $("#homeAnn"); } },
    { k: "identity",     ar: "بطاقة الاسم والصف", en: "Name & grade card",          get: function () { return $("#homeIdentityStrip"); } },
    { k: "quote",        ar: "نصيحة اليوم",      en: "Tip of the day",              get: function () { return $("#homeQuote"); } }
  ];
  function wname(w) { return isEn() ? w.en : w.ar; }

  /* ------------------------------------------------------------ ستايل */
  var css = [
    ".snhc-removed{display:none !important}",
    ".snhc-edit-btn{position:absolute;top:0;inset-inline-end:0;z-index:3;width:46px;height:46px;padding:0;border-radius:50%;border:2px solid var(--accent);background:var(--accent);color:var(--accent-ink);display:inline-flex;align-items:center;justify-content:center;cursor:pointer;box-shadow:0 4px 14px rgba(0,0,0,.22);transition:transform .15s ease}",
    ".snhc-edit-btn:active{transform:scale(.94)}",
    ".snhc-edit-btn svg{width:22px;height:22px;display:block}",
    ".snhc-edit-btn.is-on{background:var(--surface-glass);color:var(--accent)}",
    ".snhc-edit-btn:focus-visible{outline:2px solid var(--accent);outline-offset:2px}",
    ".home-hello{position:relative;margin-bottom:30px}",
    ".home-hello__title{padding-inline-end:60px}",
    ".home-hello .home-identity-strip{margin-top:30px;width:100%;box-sizing:border-box}",
    ".snhc-editing .snhc-widget{position:relative;animation:snhcWiggle .45s ease-in-out infinite alternate}",
    "@keyframes snhcWiggle{from{transform:rotate(-.35deg)}to{transform:rotate(.35deg)}}",
    "@media (prefers-reduced-motion:reduce){.snhc-editing .snhc-widget{animation:none}}",
    ".snhc-minus{position:absolute;top:8px;left:8px;z-index:4;width:28px;height:28px;border-radius:50%;border:0;background:#e5484d;color:#fff;font:700 20px/1 var(--font-body,inherit);display:none;align-items:center;justify-content:center;cursor:pointer;box-shadow:0 2px 8px rgba(0,0,0,.25);padding:0}",
    ".snhc-editing .snhc-minus{display:flex}",
    ".snhc-fab{position:fixed;left:max(16px,env(safe-area-inset-left,0px));right:auto;bottom:calc(96px + env(safe-area-inset-bottom,0px));z-index:40;width:56px;height:56px;border-radius:50%;border:0;background:var(--accent);color:var(--accent-ink);font:400 32px/1 var(--font-body,inherit);display:none;align-items:center;justify-content:center;cursor:pointer;box-shadow:0 8px 22px rgba(0,0,0,.28)}",
    ".snhc-editing .snhc-fab{display:flex}",
    /* الموبايل: أيقونة المحادثة على اليمين، وزرار (+) على الشمال (نفس الارتفاع فوق الشريط السفلي) */
    "@media (max-width:979px){html .dash-wa.dash-chat-fab{left:auto !important;right:max(16px,env(safe-area-inset-right,0px)) !important}}",
    /* الكمبيوتر: (+) على الشمال فوق أيقونة المحادثة مباشرة (مش على القايمة الجانبية) */
    "@media (min-width:980px){.snhc-fab{left:max(14px,env(safe-area-inset-left,0px));bottom:calc(16px + 52px + 14px + env(safe-area-inset-bottom,0px))}}",
    ".snhc-sheet{position:fixed;inset:0;z-index:200;display:flex;align-items:flex-end;justify-content:center;background:rgba(0,0,0,.45)}",
    ".snhc-sheet[hidden]{display:none}",
    ".snhc-sheet__box{width:min(520px,100%);max-height:70vh;overflow:auto;background:var(--surface-glass);color:var(--ink);border-radius:22px 22px 0 0;padding:18px 18px calc(18px + env(safe-area-inset-bottom,0px))}",
    ".snhc-sheet__head{display:flex;align-items:center;justify-content:space-between;margin-bottom:12px}",
    ".snhc-sheet__head h3{margin:0;font-size:1.05rem}",
    ".snhc-sheet__x{border:0;background:transparent;color:var(--ink-soft);font-size:1.4rem;cursor:pointer;line-height:1}",
    ".snhc-item{display:flex;align-items:center;gap:12px;width:100%;border:1px solid var(--surface-glass-border);background:transparent;color:var(--ink);padding:12px 14px;border-radius:14px;margin-bottom:8px;font:inherit;font-weight:700;cursor:pointer;text-align:start}",
    ".snhc-item__plus{width:26px;height:26px;border-radius:50%;background:var(--accent);color:var(--accent-ink);display:inline-flex;align-items:center;justify-content:center;font-size:18px;line-height:1;flex:none}",
    ".snhc-empty{color:var(--ink-soft);text-align:center;padding:18px 6px;margin:0}"
  ].join("\n");
  var st = document.createElement("style");
  st.textContent = css;
  document.head.appendChild(st);

  /* ------------------------------------------------------------ تخزين */
  function session() { try { return JSON.parse(localStorage.getItem("shadynasr-current-user")); } catch (e) { return null; } }
  var me = session();
  if (!me || !me.id || me.role === "admin") return;
  var KEY = "shadynasr-home-hidden:" + me.id;

  function loadLocal() {
    try {
      var raw = localStorage.getItem(KEY);
      if (raw == null) return null;
      var a = JSON.parse(raw);
      return Array.isArray(a) ? a : [];
    } catch (e) { return null; }
  }
  var hidden = {};
  (loadLocal() || []).forEach(function (k) { hidden[k] = 1; });

  var saveTimer = 0;
  function save() {
    var list = Object.keys(hidden);
    try { localStorage.setItem(KEY, JSON.stringify(list)); } catch (e) { }
    clearTimeout(saveTimer);
    saveTimer = setTimeout(function () {
      if (window.SNAuth && SNAuth.saveUserFields) {
        Promise.resolve(SNAuth.saveUserFields(me.id, { homeHidden: list })).catch(function () { });
      }
    }, 600);
  }

  /* ------------------------------------------------------------ تطبيق */
  var editing = false;
  var panel, editBtn, fab, sheet, sheetList;

  function apply() {
    WIDGETS.forEach(function (w) {
      var el = w.get();
      if (!el) return;
      el.classList.add("snhc-widget");
      el.classList.toggle("snhc-removed", !!hidden[w.k]);
      el.dataset.snhcKey = w.k;
      if (!el.querySelector(":scope > .snhc-minus")) {
        var m = document.createElement("span");
        m.className = "snhc-minus";
        m.setAttribute("role", "button");
        m.setAttribute("tabindex", "0");
        m.setAttribute("aria-label", t("remove"));
        m.textContent = "\u2212";
        el.appendChild(m);
      }
    });
    refreshLabels();
  }

  function refreshLabels() {
    if (editBtn) {
      editBtn.innerHTML = editing ? ICON_DONE : ICON_EDIT;
      editBtn.setAttribute("aria-label", editing ? t("done") : t("edit"));
      editBtn.title = editing ? t("done") : t("edit");
    }
    if (fab) fab.setAttribute("aria-label", t("add"));
    document.querySelectorAll(".snhc-minus").forEach(function (m) { m.setAttribute("aria-label", t("remove")); });
    if (sheet && !sheet.hidden) renderSheet();
  }

  function setEditing(on) {
    editing = on;
    document.body.classList.toggle("snhc-editing", on);
    if (editBtn) editBtn.classList.toggle("is-on", on);
    if (!on) closeSheet();
    refreshLabels();
  }

  function removeWidget(k) { hidden[k] = 1; save(); apply(); }
  function restoreWidget(k) { delete hidden[k]; save(); apply(); }

  /* ------------------------------------------------------------ قائمة (+) */
  function renderSheet() {
    var items = WIDGETS.filter(function (w) { return hidden[w.k]; });
    sheet.querySelector("h3").textContent = t("sheet");
    sheet.querySelector(".snhc-sheet__x").setAttribute("aria-label", t("close"));
    sheetList.innerHTML = items.length
      ? items.map(function (w) {
        return '<button type="button" class="snhc-item" data-k="' + w.k + '"><span class="snhc-item__plus">+</span><span>' + wname(w) + "</span></button>";
      }).join("")
      : '<p class="snhc-empty">' + t("empty") + "</p>";
  }
  function openSheet() { renderSheet(); sheet.hidden = false; }
  function closeSheet() { if (sheet) sheet.hidden = true; }

  /* ------------------------------------------------------------ بناء الواجهة */
  function build() {
    panel = $('.dash-panel[data-panel="home"]');
    var hello = $(".home-hello");
    if (!panel || !hello || !$("#homeGrid")) return;

    editBtn = document.createElement("button");
    editBtn.type = "button";
    editBtn.className = "snhc-edit-btn";
    editBtn.addEventListener("click", function () { setEditing(!editing); });
    hello.appendChild(editBtn);

    fab = document.createElement("button");
    fab.type = "button";
    fab.className = "snhc-fab";
    fab.textContent = "+";
    fab.addEventListener("click", openSheet);
    panel.appendChild(fab);

    sheet = document.createElement("div");
    sheet.className = "snhc-sheet";
    sheet.hidden = true;
    sheet.innerHTML = '<div class="snhc-sheet__box"><div class="snhc-sheet__head"><h3></h3><button type="button" class="snhc-sheet__x">&times;</button></div><div class="snhc-sheet__list"></div></div>';
    sheetList = sheet.querySelector(".snhc-sheet__list");
    sheet.addEventListener("click", function (e) {
      if (e.target === sheet || e.target.closest(".snhc-sheet__x")) { closeSheet(); return; }
      var it = e.target.closest(".snhc-item");
      if (!it) return;
      restoreWidget(it.dataset.k);
      renderSheet();
    });
    document.body.appendChild(sheet);

    /* في وضع التعديل: الضغط على أي مربع ما بيفتحش صفحته، و(−) بتشيله */
    panel.addEventListener("click", function (e) {
      if (!editing) return;
      var minus = e.target.closest(".snhc-minus");
      var w = e.target.closest(".snhc-widget");
      if (!w) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      if (minus) removeWidget(w.dataset.snhcKey);
    }, true);
    panel.addEventListener("keydown", function (e) {
      if (!editing || (e.key !== "Enter" && e.key !== " ")) return;
      var minus = e.target.closest && e.target.closest(".snhc-minus");
      if (!minus) return;
      e.preventDefault();
      removeWidget(minus.closest(".snhc-widget").dataset.snhcKey);
    });

    /* الرئيسية بتتعاد رسمها (home.js) وبتتحمّل عناصرها متأخر: نطبّق تاني */
    var raf = 0;
    var again = function () { cancelAnimationFrame(raf); raf = requestAnimationFrame(apply); };
    new MutationObserver(again).observe($("#homeGrid"), { childList: true });
    new MutationObserver(again).observe(panel, { childList: true });

    /* خروج من وضع التعديل لما الطالب يسيب الرئيسية */
    new MutationObserver(function () { if (!panel.classList.contains("is-active") && editing) setEditing(false); })
      .observe(panel, { attributes: true, attributeFilter: ["class"] });

    /* تغيير اللغة */
    new MutationObserver(refreshLabels).observe(document.documentElement, { attributes: true, attributeFilter: ["lang"] });

    apply();
    setEditing(false);

    /* مزامنة من الأونلاين لو الجهاز ده مفيهوش اختيار محفوظ */
    if (loadLocal() === null && window.SNAuth && SNAuth.findUserByEmail && me.email) {
      Promise.resolve(SNAuth.findUserByEmail(me.email)).then(function (u) {
        if (u && Array.isArray(u.homeHidden) && loadLocal() === null) {
          hidden = {};
          u.homeHidden.forEach(function (k) { hidden[String(k)] = 1; });
          try { localStorage.setItem(KEY, JSON.stringify(Object.keys(hidden))); } catch (e) { }
          apply();
        }
      }).catch(function () { });
    }
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", function () { setTimeout(build, 0); });
  else setTimeout(build, 0);
})();

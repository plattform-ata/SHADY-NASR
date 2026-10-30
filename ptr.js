/* ==========================================================================
   ptr.js — "اسحب للتحديث" بشكل المنصة (بدل دايرة التحديث بتاعة المتصفح)
   - لوحة غامقة بتنزل من فوق مع سحب الصفحة، فيها أيقونة سهمين دايريين بتكبر وتلف
   - نص "اسحب للتحديث" ← "اترك للتحديث" ← "جاري التحديث…" + آخر وقت تحديث
   - بيمنع دايرة التحديث الأصلية في المتصفح (overscroll-behavior)
   - يشتغل بس لما الصفحة (وأي قايمة بتتحرّك جواها) تكون في أولها
   ملاحظة: لو صفحة عايزة تحديث من غير إعادة تحميل، تعرّف window.SNPtrRefresh = async () => {...}
   بيتحمّل في أي صفحة: <script defer src="ptr.js"></script>
   ========================================================================== */
(function () {
  "use strict";
  if (window.__snPtr) return;
  window.__snPtr = true;

  var THRESHOLD = 100;      // المسافة (px) اللي بعدها بيبقى "اترك للتحديث"
  var MAX_PULL = 190;       // أقصى نزول للوحة
  var HOLD = 120;           // ارتفاع اللوحة وهي بتحدّث
  var RESIST = 0.6;        // مقاومة السحب
  var KEY = "sn-ptr-last";

  var isEn = function () { return document.documentElement.lang === "en"; };
  var TX = {
    ar: { pull: "اسحب للتحديث", release: "اترك للتحديث", busy: "جاري التحديث…", last: "آخر تحديث: ", now: "دلوقتي", min: function (n) { return "من " + n + " دقيقة"; }, hr: function (n) { return "من " + n + " ساعة"; }, never: "" },
    en: { pull: "Pull to refresh", release: "Release to refresh", busy: "Refreshing…", last: "Last updated: ", now: "just now", min: function (n) { return n + " min ago"; }, hr: function (n) { return n + " h ago"; }, never: "" }
  };
  var tx = function () { return isEn() ? TX.en : TX.ar; };

  function lastText() {
    var t = Number(sessionStorage.getItem(KEY)) || 0;
    if (!t) return "";
    var m = Math.floor((Date.now() - t) / 60000), L = tx();
    return L.last + (m < 1 ? L.now : m < 60 ? L.min(m) : L.hr(Math.floor(m / 60)));
  }
  try { if (!sessionStorage.getItem(KEY)) sessionStorage.setItem(KEY, String(Date.now())); } catch (e) { }

  /* ---------- ستايل + عناصر ---------- */
  var st = document.createElement("style");
  st.textContent =
    "html,body{overscroll-behavior-y:contain}" +
    ".sn-ptr{position:fixed;top:0;left:0;right:0;height:0;z-index:2147483000;overflow:hidden;pointer-events:none;" +
    "background:linear-gradient(180deg,#0b2a31,#133f4a);color:#fff;border-radius:0 0 26px 26px;" +
    "box-shadow:0 10px 30px rgba(0,0,0,.28);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;" +
    "padding-top:env(safe-area-inset-top,0px);box-sizing:border-box;will-change:height}" +
    ".sn-ptr.is-anim{transition:height .26s cubic-bezier(.2,.8,.2,1)}" +
    ".sn-ptr__ico{width:52px;height:52px;flex:none;will-change:transform}" +
    ".sn-ptr__ico svg{width:100%;height:100%;display:block}" +
    ".sn-ptr.is-spin .sn-ptr__ico svg{animation:snPtrSpin .9s linear infinite}" +
    "@keyframes snPtrSpin{to{transform:rotate(360deg)}}" +
    ".sn-ptr__t{font-weight:800;font-size:.98rem;line-height:1.2;text-align:center;font-family:var(--font-display,inherit)}" +
    ".sn-ptr__s{font-weight:600;font-size:.8rem;opacity:.82;line-height:1.2;text-align:center;min-height:1em}" +
    "@media (prefers-reduced-motion:reduce){.sn-ptr.is-spin .sn-ptr__ico svg{animation-duration:2.4s}}";
  document.head.appendChild(st);

  var box = document.createElement("div");
  box.className = "sn-ptr";
  box.setAttribute("aria-hidden", "true");
  box.innerHTML =
    '<div class="sn-ptr__ico"><svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">' +
    '<path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/>' +
    '<path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/></svg></div>' +
    '<div class="sn-ptr__t"></div><div class="sn-ptr__s"></div>';
  var ico = box.querySelector(".sn-ptr__ico"), tEl = box.querySelector(".sn-ptr__t"), sEl = box.querySelector(".sn-ptr__s");
  function mount() { if (!box.parentNode) document.body.appendChild(box); }
  if (document.body) mount(); else document.addEventListener("DOMContentLoaded", mount);

  /* ---------- منطق السحب ---------- */
  var sx = 0, sy = 0, tracking = false, pulling = false, busy = false, pull = 0;

  /* الصفحة (وأي قايمة بتتحرّك جواها) لازم تكون في أولها */
  function atTop(el) {
    for (; el && el !== document.body && el !== document.documentElement; el = el.parentElement) {
      var cs = getComputedStyle(el);
      if ((cs.overflowY === "auto" || cs.overflowY === "scroll") && el.scrollHeight > el.clientHeight + 1 && el.scrollTop > 0) return false;
    }
    var se = document.scrollingElement || document.documentElement;
    return (window.pageYOffset || se.scrollTop || 0) <= 0;
  }
  function blocked(el) {
    return !!(el.closest && el.closest("input,textarea,select,[contenteditable=true],.modal-overlay,.sn-pk,[data-no-ptr],video,canvas"));
  }

  function paint(h, ready) {
    box.style.height = h + "px";
    var p = Math.min(1, h / THRESHOLD);
    var scale = 0.45 + 0.55 * p;
    ico.style.transform = box.classList.contains("is-spin") ? "scale(" + scale + ")" : "rotate(" + Math.round(h * 2.4) + "deg) scale(" + scale + ")";
    var t = tx();
    tEl.textContent = busy ? t.busy : ready ? t.release : t.pull;
    sEl.textContent = lastText();
    tEl.style.opacity = sEl.style.opacity = String(Math.max(0, Math.min(1, (h - 46) / 50)));
  }

  function reset() {
    box.classList.add("is-anim");
    box.classList.remove("is-spin");
    ico.style.transform = "";
    box.style.height = "0px";
    pull = 0; pulling = false; tracking = false;
  }

  async function refresh() {
    busy = true;
    box.classList.add("is-anim", "is-spin");
    paint(HOLD, true);
    try { sessionStorage.setItem(KEY, String(Date.now())); } catch (e) { }
    try {
      if (typeof window.SNPtrRefresh === "function") {
        await window.SNPtrRefresh();
        busy = false; reset();
      } else {
        setTimeout(function () { location.reload(); }, 450);
      }
    } catch (e) { busy = false; reset(); }
  }

  document.addEventListener("touchstart", function (e) {
    if (busy || e.touches.length !== 1 || blocked(e.target)) { tracking = false; return; }
    if (!atTop(e.target)) { tracking = false; return; }
    sx = e.touches[0].clientX; sy = e.touches[0].clientY;
    tracking = true; pulling = false;
    box.classList.remove("is-anim");
  }, { passive: true });

  document.addEventListener("touchmove", function (e) {
    if (!tracking || busy) return;
    var dx = e.touches[0].clientX - sx, dy = e.touches[0].clientY - sy;
    if (!pulling) {
      if (dy < -4) { tracking = false; return; }                        // بيسكرول لفوق
      if (dy < 10) return;
      if (Math.abs(dx) > dy * 0.8) { tracking = false; return; }          // حركة أفقية
      if (!atTop(e.target)) { tracking = false; return; }
      pulling = true;
    }
    if (e.cancelable) e.preventDefault();
    pull = Math.min(MAX_PULL, Math.max(0, (dy - 10) * RESIST));
    var ready = pull >= THRESHOLD;
    box.classList.toggle("is-spin", ready);
    paint(pull, ready);
  }, { passive: false });

  function end() {
    if (!tracking) return;
    if (pulling && pull >= THRESHOLD) refresh(); else if (pulling) reset();
    tracking = false; pulling = false;
  }
  document.addEventListener("touchend", end, { passive: true });
  document.addEventListener("touchcancel", function () { if (pulling && !busy) reset(); tracking = false; }, { passive: true });

  window.SNPtr = { refresh: refresh };
})();

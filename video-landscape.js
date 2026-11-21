/* ==========================================================================
   video-landscape.js — فيديوهات الدروس والقصة: ملء الشاشة بالعرض (أفقي) مش بالطول
   - الفيديو بيتفتح عادي زي ما هو. أول ما الطالب يضغط ملء الشاشة (زرار يوتيوب أو أي iframe)،
     بنقفل اتجاه الشاشة على الوضع الأفقي، ولما يخرج من ملء الشاشة بنرجّع الاتجاه حر.
   - screen.orientation.lock شغال على أندرويد/كروم وأغلب المتصفحات. آيفون (سفاري) مش بيسمح بقفل الاتجاه
     من الويب، وهناك الفيديو بيتفتح في مشغّل آيفون وبيلف مع لفّ الجوال.
   ========================================================================== */
(() => {
  "use strict";
  const so = screen.orientation;
  const fsEl = () => document.fullscreenElement || document.webkitFullscreenElement || null;
  let locked = false;

  function isVideoFs(el) {
    if (!el) return false;
    if (el.tagName === "IFRAME" || el.tagName === "VIDEO") return true;
    return !!(el.querySelector && el.querySelector("iframe, video"));
  }
  async function onChange() {
    const el = fsEl();
    if (el && isVideoFs(el)) {
      if (so && so.lock) {
        try { await so.lock("landscape"); locked = true; } catch (e) { /* المتصفح مش بيدعم/رفض: نسيب الاتجاه زي ما هو */ }
      }
    } else if (locked) {
      locked = false;
      try { so.unlock(); } catch (e) { /* ignore */ }
    }
  }
  document.addEventListener("fullscreenchange", onChange);
  document.addEventListener("webkitfullscreenchange", onChange);

  /* أي iframe فيديو يتضاف بعد كده لازم يسمح بملء الشاشة */
  new MutationObserver((list) => {
    list.forEach((m) => m.addedNodes.forEach((n) => {
      if (n.nodeType !== 1) return;
      (n.tagName === "IFRAME" ? [n] : Array.from(n.querySelectorAll ? n.querySelectorAll("iframe") : [])).forEach((f) => {
        const a = f.getAttribute("allow") || "";
        if (!/fullscreen/.test(a)) f.setAttribute("allow", (a ? a + "; " : "") + "fullscreen; autoplay; encrypted-media; picture-in-picture");
        f.setAttribute("allowfullscreen", "");
      });
    }));
  }).observe(document.documentElement, { childList: true, subtree: true });
})();

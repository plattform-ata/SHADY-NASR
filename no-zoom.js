/* ==========================================================================
   no-zoom.js — تثبيت المنصة: ممنوع الزووم بالإصبعين أو بالضغط مرتين أو Ctrl+عجلة الماوس.
   تكبير/تصغير المحتوى يفضل متاح من إعدادات المتصفح نفسه (مش من جوه المنصة).
   بيتحمّل في كل الصفحات بعد الـ viewport meta.
   ========================================================================== */
(function () {
  "use strict";
  if (window.__snNoZoom) return;
  window.__snNoZoom = true;

  var CONTENT = "width=device-width, initial-scale=1, minimum-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover";
  var meta = document.querySelector('meta[name="viewport"]');
  if (!meta) { meta = document.createElement("meta"); meta.name = "viewport"; document.head.appendChild(meta); }
  if (meta.getAttribute("content") !== CONTENT) meta.setAttribute("content", CONTENT);

  /* pan فقط (سكرول عادي) — من غير pinch-zoom ولا double-tap-zoom */
  var st = document.createElement("style");
  st.textContent = "html,body{touch-action:pan-x pan-y}input,textarea,select{touch-action:manipulation}";
  document.head.appendChild(st);

  var stop = function (e) { if (e.cancelable) e.preventDefault(); };

  /* iOS Safari بيتجاهل user-scalable=no، فبنمنع أحداث الـ gesture */
  ["gesturestart", "gesturechange", "gestureend"].forEach(function (t) { document.addEventListener(t, stop, { passive: false }); });

  /* لمستين أو أكتر = محاولة pinch */
  document.addEventListener("touchmove", function (e) { if (e.touches && e.touches.length > 1) stop(e); }, { passive: false });

  /* Ctrl + عجلة الماوس / pinch على التراك باد */
  window.addEventListener("wheel", function (e) { if (e.ctrlKey) stop(e); }, { passive: false });

  /* Ctrl/Cmd + (+ / - / =  / 0) */
  window.addEventListener("keydown", function (e) {
    if ((e.ctrlKey || e.metaKey) && ["+", "-", "=", "_", "0", "Add", "Subtract"].indexOf(e.key) > -1) stop(e);
  });
})();

/* ==========================================================================
   protect.js — حماية المحتوى في منصة الطالب (بيتحمّل في studenti.html)
   - بيمنع تحديد ونسخ النصوص في كل المنصة (الدروس، الأسئلة، الشات، الامتحانات...).
   - الكتابة والتحديد جوه خانات الإدخال (input / textarea) شغّالين عادي.
   - مش بيشتغل على حساب الأدمن، عشان الأدمن يقدر ينسخ ويعدّل براحته.
   ========================================================================== */
(function () {
  "use strict";
  try {
    var u = JSON.parse(localStorage.getItem("shadynasr-current-user"));
    if (u && u.role === "admin") return;
  } catch (e) { }

  var EDITABLE = "input,textarea,select,[contenteditable]:not([contenteditable='false']),.allow-select";

  var st = document.createElement("style");
  st.id = "protectCss";
  st.textContent =
    "*{-webkit-user-select:none;user-select:none;-webkit-touch-callout:none}" +
    "input,textarea,select,[contenteditable]:not([contenteditable='false']),.allow-select{-webkit-user-select:text;user-select:text}" +
    "img,canvas,svg{-webkit-user-drag:none;user-drag:none}" +
    "@media print{html{display:none!important}}";
  (document.head || document.documentElement).appendChild(st);

  function el(n) { return n && n.nodeType === 3 ? n.parentElement : n; }
  function editable(n) { n = el(n); return !!(n && n.closest && n.closest(EDITABLE)); }

  ["copy", "cut", "selectstart", "dragstart", "contextmenu"].forEach(function (type) {
    document.addEventListener(type, function (ev) {
      var t = (type === "copy" || type === "cut") ? document.activeElement : ev.target;
      if (!editable(t)) ev.preventDefault();
    }, true);
  });

  document.addEventListener("keydown", function (ev) {
    var k = String(ev.key || "").toLowerCase(), mod = ev.ctrlKey || ev.metaKey;
    if (ev.key === "F12" || (mod && ev.shiftKey && (k === "i" || k === "j" || k === "c"))) return ev.preventDefault();
    if (!mod) return;
    if (k === "s" || k === "p" || k === "u") return ev.preventDefault();
    if ((k === "a" || k === "c" || k === "x") && !editable(document.activeElement)) ev.preventDefault();
  }, true);
})();

/* ==========================================================================
   liquid.js — تأثير Liquid Glass (شكل iOS) على كل المنصة
   - مطفي افتراضيًا. الطالب بيفعّله من الإعدادات، وبيتحفظ على جهازه.
   - لما يتفعّل: html[data-liquid="on"] والستايل في shared.css بيتولّى الباقي.
   - لازم يتحمّل في <head> بدون defer عشان يتطبّق قبل ظهور الصفحة.
   ========================================================================== */
(function () {
  "use strict";
  var K_ON = "shadynasr-liquid-on", K_LV = "shadynasr-liquid-level";
  var root = document.documentElement;

  function get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function set(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }

  function level() {
    var n = parseInt(get(K_LV), 10);
    return isFinite(n) ? Math.min(100, Math.max(0, n)) : 60;
  }
  function isOn() { return get(K_ON) === "1"; }

  // أجهزة ضعيفة (رامات/معالج قليل أو توفير بيانات): وضع خفيف تلقائي
  var WEAK = (navigator.deviceMemory && navigator.deviceMemory <= 4) ||
             (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4) ||
             (navigator.connection && navigator.connection.saveData) || false;

  function apply() {
    var on = isOn(), lv = level();
    root.setAttribute("data-liquid", on ? "on" : "off");
    if (on && WEAK) root.setAttribute("data-lg-lite", "1"); else root.removeAttribute("data-lg-lite");
    if (on) {
      root.style.setProperty("--lg-blur", (8 + lv * 0.12).toFixed(1) + "px");   // 8 → 20px
      root.style.setProperty("--lg-tint", (60 - lv * 0.32).toFixed(0) + "%");   // شفافية الزجاج
      root.style.setProperty("--lg-rim", (0.35 + lv * 0.006).toFixed(2));       // لمعة الحواف
    } else {
      ["--lg-blur", "--lg-tint", "--lg-rim"].forEach(function (p) { root.style.removeProperty(p); });
    }
  }

  window.snLiquid = {
    isOn: isOn,
    level: level,
    setOn: function (v) { set(K_ON, v ? "1" : "0"); apply(); },
    setLevel: function (n) { set(K_LV, String(Math.min(100, Math.max(0, Math.round(n))))); apply(); }
  };

  apply();
  window.addEventListener("storage", function (e) { if (e.key === K_ON || e.key === K_LV) apply(); });
})();

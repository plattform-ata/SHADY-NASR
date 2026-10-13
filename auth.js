/* ==========================================================================
   auth.js — حارس صفحات ما قبل الدخول (index / login / admin-verify)
   لو المستخدم مسجّل دخول بالفعل:
   - فتح عادي للصفحة (رابط/كتابة عنوان)  -> تحويل فوري (replace) للوحة تحكمه.
   - وصل للصفحة بزرار الرجوع/التقدّم    -> history.back() تاني، يعني الصفحة دي
     بتتخطّى ومش بتظهر، لحد ما يخرج من الموقع (أو المتصفح لو مفيش حاجة قبله).
   لازم يتحمّل في <head> بدون defer عشان يشتغل قبل ما الصفحة تظهر.
   ========================================================================== */
(function () {
  "use strict";
  var page = (window.location.pathname.split("/").pop() || "index.html").toLowerCase();
  if (["", "index.html", "login.html", "admin-verify.html"].indexOf(page) === -1) return;

  function getSession() {
    try {
      var s = JSON.parse(localStorage.getItem("shadynasr-current-user"));
      return s && localStorage.getItem("shadynasr-auth") ? s : null;
    } catch (e) {
      return null;
    }
  }

  function cameFromHistory() {
    try {
      var nav = performance.getEntriesByType("navigation")[0];
      return !!nav && nav.type === "back_forward";
    } catch (e) {
      return false;
    }
  }

  function guard(fromBfcache) {
    var s = getSession();
    if (!s) return;
    document.documentElement.style.visibility = "hidden"; // نمنع ومضة الصفحة
    var target = s.role === "admin" ? "admin.html" : "studenti.html";
    if ((fromBfcache || cameFromHistory()) && window.history.length > 1) {
      window.history.back();
      // لو الرجوع ما حصلش (مفيش صفحة قبلها) نحوّله للوحة بدل ما يفضل على صفحة فاضية
      setTimeout(function () {
        window.location.replace(target);
      }, 400);
    } else {
      window.location.replace(target);
    }
  }

  guard(false);
  // الصفحة رجعت من الكاش (bfcache) في الموبايل: السكريبت ما بيشتغلش تاني، فنفحص هنا
  window.addEventListener("pageshow", function (e) {
    if (e.persisted) guard(true);
  });
})();

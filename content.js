/* ==========================================================================
   content.js — محتوى المنصة اللي الأدمن بيضيفه (وحدات + دروس + فصول قصة)
   كله بيتخزن في Firebase: courseContent/{id} =
     { id, kind: "unit"|"lesson"|"story", grade, number, title, desc, term (1|2 — للوحدة وفصل القصة),
       unitId (للدرس — الدرس بيتبع ترم وحدته), videoUrl, pdfFileId, pdfName, bankCount, bankUpdatedAt, createdAt, updatedAt }
   وأسئلة الامتحانات/الشيتات في مسار منفصل: questionBanks/{key}
     key = "u_" + id (امتحان الوحدة) | "l_" + id (شيت الدرس) | "s_" + id (امتحان فصل القصة)
   مفيش أي وحدات أو دروس أو فصول جاهزة في الكود — كله بيضيفه الأدمن من لوحة التحكم.
   - الطالب: dashboard.js بيبني الوحدات والدروس والقصة من البيانات دي.
   - الأدمن: content-admin.js.
   ========================================================================== */
(function () {
  "use strict";
  if (window.SNContent) return;

  var CACHE_KEY = "sn-course-content";
  var TERM_KEY = "sn-term-config";
  var TERMS = [{ id: 1, name: "الترم الأول" }, { id: 2, name: "الترم الثاني" }];

  /* ترم العنصر: أي وحدة/فصل قصة من غير ترم (اتضافت قبل الميزة دي) بتتحسب ترم أول */
  function termOf(item) { return item && Number(item.term) === 2 ? 2 : 1; }
  function termName(t) { return Number(t) === 2 ? "الترم الثاني" : "الترم الأول"; }
  /* اللي بيظهر للطلاب: 1 أو 2 أو 3 (= الترمين مع بعض) */
  function termLabel(t) { return Number(t) === 3 ? "الترم الأول والثاني" : termName(t); }
  function normT(v) { v = Number(v); return v === 2 || v === 3 ? v : 1; }
  function pad2(n) { return (n < 10 ? "0" : "") + n; }
  function todayStr() { var d = new Date(); return d.getFullYear() + "-" + pad2(d.getMonth() + 1) + "-" + pad2(d.getDate()); }

  /* إعدادات الترم (آخر نسخة محفوظة على الجهاز، وبتتحدّث من Firebase):
     { term, perGrade, grades: {gradeId: term}, auto: { enabled, date: "YYYY-MM-DD", to } } */
  function readConfig() {
    try {
      var c = JSON.parse(localStorage.getItem(TERM_KEY));
      if (c && typeof c === "object") return c;
    } catch (e) { }
    try { if (Number(localStorage.getItem("sn-active-term")) === 2) return { term: 2 }; } catch (e) { }
    return { term: 1 };
  }
  function setConfig(c) { try { localStorage.setItem(TERM_KEY, JSON.stringify(c && typeof c === "object" ? c : { term: 1 })); } catch (e) { } }

  /* الترم الظاهر فعليًا لصف معيّن: التبديل التلقائي (لو التاريخ جه) ← التخصيص لكل صف ← الترم العام */
  function effectiveTerm(grade, cfg) {
    cfg = cfg || readConfig();
    var a = cfg.auto;
    if (a && a.enabled && a.date && todayStr() >= a.date) return normT(a.to);
    if (cfg.perGrade && cfg.grades && cfg.grades[grade] != null) return normT(cfg.grades[grade]);
    return normT(cfg.term);
  }
  function isVisible(item, term) { return Number(term) === 3 || termOf(item) === Number(term); }
  function signature() { return GRADES.map(function (g) { return effectiveTerm(g.id); }).join(""); }

  /* متابعة التغيير: من الأدمن (لحظيًا) ومن التاريخ (كل دقيقة وعند الرجوع للتطبيق). cb(true) لما الظاهر يتغيّر */
  function watchTerm(cb) {
    var last = signature(), tries = 0;
    function check() { var s = signature(); var ch = s !== last; last = s; if (ch) cb(true); }
    function start() {
      if (window.SNAuth && SNAuth.watchTermConfig) {
        try { SNAuth.watchTermConfig(function (c) { if (c) setConfig(c); check(); }, function () { }); } catch (e) { }
        return;
      }
      if (++tries < 50) setTimeout(start, 200);
    }
    start();
    setInterval(check, 60000);
    document.addEventListener("visibilitychange", function () { if (!document.hidden) check(); });
  }

  var GRADES = [
    { id: "prep1", name: "الصف الأول الإعدادي" },
    { id: "prep2", name: "الصف الثاني الإعدادي" },
    { id: "prep3", name: "الصف الثالث الإعدادي" },
    { id: "secondary1", name: "الصف الأول الثانوي" },
    { id: "secondary2", name: "الصف الثاني الثانوي" },
    { id: "secondary3", name: "الصف الثالث الثانوي" }
  ];

  /* مفتاح بنك الأسئلة حسب نوع العنصر */
  function bankKey(kind, id) {
    return (kind === "unit" ? "u_" : kind === "story" ? "s_" : "l_") + id;
  }

  function readCache() {
    try { var v = JSON.parse(localStorage.getItem(CACHE_KEY)); return Array.isArray(v) ? v : []; } catch (e) { return []; }
  }
  function writeCache(list) {
    try { localStorage.setItem(CACHE_KEY, JSON.stringify(list)); } catch (e) { }
  }

  /* متابعة لحظية: أول استدعاء بيجي من الكاش المحلي فورًا، وبعدها من Firebase */
  function watch(cb) {
    var tries = 0;
    function start() {
      if (window.SNAuth && SNAuth.watchCourseContent) {
        try {
          SNAuth.watchCourseContent(function (list) { writeCache(list); cb(list); }, function () { });
        } catch (e) { }
        return;
      }
      if (++tries < 50) setTimeout(start, 200);
    }
    start();
  }

  window.SNContent = { GRADES: GRADES, TERMS: TERMS, bankKey: bankKey, cached: readCache, watch: watch, termOf: termOf, termName: termName, termLabel: termLabel, todayStr: todayStr, effectiveTerm: effectiveTerm, isVisible: isVisible, setConfig: setConfig, getConfig: readConfig, watchTerm: watchTerm };
})();

/* ==========================================================================
   exams-admin.js — وحدة الامتحانات للأدمن (بتتحمّل في admin.html بعد exams.js)
   الشاشات:  list (امتحانات / تسليمات)  →  setup  →  builder  →  review (تصحيح) → PDF
   - Builder: مربع (+) في النص لقالب فارغ، وزرار عائم (+) بيفتح قايمة جانبية بأنواع الأسئلة
     + مولّد دُفعي (نوع + عدد → قسم بعنوان جاهز وبلوكات أسئلة).
   - التصحيح: MCQ بيتصحح تلقائيًا (مقترح)، والباقي يدوي، والأدمن بيحدد الدرجة الكاملة والنهائية.
   - بعد الحفظ: الدرجة بتتسجّل في grades/{studentId}/exams فتظهر في سجل درجات الطالب.
   ========================================================================== */
(function () {
  "use strict";
  var X = window.SNExams;
  if (!X) return;

  var esc = X.esc;
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  var ctx = { getUsers: function () { return []; }, toast: function (m, bad) { if (window.snDialog && window.snDialog.toast) window.snDialog.toast(m, { error: !!bad }); }, session: null };
  var root, bound = false;

  var S = {
    tab: "exams", view: "list", loaded: false, exams: [], subs: {},
    exam: null, dirty: false, saveTimer: 0, drawer: false, errs: [],
    pick: { type: "mcq", count: 10, header: X.typeOf("mcq").header },
    fExam: "all", q: "", fDate: "", fTerm: "all", grade: null, more: {}, gStatus: {}, defTerm: 1,
    cur: null   // { exam, sub, manualFinal }
  };

  /* ------------------------------------------------------------ مساعدات */
  function toast(m, bad) { ctx.toast(m, !!bad); }
  function gradeFull(grade, track) {
    var g = X.GRADE_NAMES[grade] || "";
    var t = String(grade || "").indexOf("secondary") === 0 && track && track !== "all" ? X.TRACK_NAMES[track] : "";
    return g && t ? g + " — " + t : g;
  }
  function uname(sub) {
    if (sub.studentName) return sub.studentName;
    var u = (ctx.getUsers() || []).filter(function (x) { return x && x.id === sub.studentId; })[0];
    return u ? u.fullName : "طالب";
  }
  function examById(id) { return S.exams.filter(function (e) { return e.id === id; })[0]; }
  function subList() {
    var out = [];
    Object.keys(S.subs || {}).forEach(function (eid) {
      var m = S.subs[eid] || {};
      Object.keys(m).forEach(function (uid) { if (m[uid]) out.push({ examId: eid, studentId: uid, sub: m[uid] }); });
    });
    return out.sort(function (a, b) { return String(b.sub.submittedAt || "").localeCompare(String(a.sub.submittedAt || "")); });
  }
  function pendingCount() { return subList().filter(function (r) { return r.sub.status !== "graded"; }).length; }
  function subCounts(examId) {
    var m = S.subs[examId] || {}, t = 0, g = 0;
    Object.keys(m).forEach(function (u) { if (m[u]) { t++; if (m[u].status === "graded") g++; } });
    return { total: t, graded: g };
  }
  function secOf(id) { return S.exam && S.exam.sections.filter(function (s) { return s.id === id; })[0]; }
  function qOf(sec, id) { return sec && sec.questions.filter(function (q) { return q.id === id; })[0]; }

  /* زرار بيطلب تأكيد (ضغطتين) قبل أي حذف */
  function armed(btn, label) {
    if (btn.dataset.armed) return true;
    var old = btn.textContent;
    btn.dataset.armed = "1"; btn.textContent = label || "تأكيد؟";
    setTimeout(function () { if (btn.isConnected) { delete btn.dataset.armed; btn.textContent = old; } }, 4000);
    return false;
  }

  /* ------------------------------------------------------------ تحميل */
  function load() {
    return Promise.all([
      SNAuth.fetchExams().catch(function () { return []; }),
      SNAuth.fetchAllExamSubmissions().catch(function () { return {}; }),
      Promise.resolve(SNAuth.getTermConfig ? SNAuth.getTermConfig() : null).catch(function () { return null; })
    ]).then(function (res) {
      S.defTerm = res[2] && Number(res[2].term) === 2 ? 2 : 1;
      S.exams = (res[0] || []).map(X.normalizeExam).sort(function (a, b) { return String(b.createdAt || "").localeCompare(String(a.createdAt || "")); });
      S.subs = res[1] || {};
      S.loaded = true;
    });
  }

  function open() {
    root = $("#exmAdminRoot");
    if (!root) return;
    bind();
    if (S.view === "builder" || S.view === "setup") return render();
    root.innerHTML = '<p class="exm-empty">جاري التحميل…</p>';
    load().then(function () { if (S.view === "review" && S.cur) renderReview(); else { S.view = "list"; render(); } });
  }

  /* ------------------------------------------------------------ القايمة: الصفوف ← صفحة كل صف */
  var GRADE_KEYS = Object.keys(X.GRADE_NAMES);
  var TERM_NAMES = { 1: "الترم الأول", 2: "الترم الثاني" };
  var MONTHS = ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"];
  var WEEK = ["س", "ح", "ن", "ث", "ر", "خ", "ج"];   // السبت أولًا
  function svgI(d, cls) { return '<svg class="' + (cls || "exm-ico") + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + d + "</svg>"; }
  var I = {
    fwd: svgI('<path d="m15 6-6 6 6 6"/>'), back: svgI('<path d="m9 6 6 6-6 6"/>'),
    cal: svgI('<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M8 3v4M16 3v4M3 10h18"/>'),
    search: svgI('<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>'),
    qr: svgI('<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><path d="M14 14h3v3h-3zM20 14v.01M14 20h3M20 17v4"/>'),
    lock: svgI('<rect x="5" y="11" width="14" height="10" rx="2.5"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>'),
    globe: svgI('<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3.2 3 14.8 0 18M12 3c-3 3.2-3 14.8 0 18"/>'),
    copy: svgI('<rect x="9" y="9" width="11" height="11" rx="2.5"/><path d="M5 15V6a2 2 0 0 1 2-2h8"/>'),
    dl: svgI('<path d="M12 4v11M7 11l5 5 5-5M5 20h14"/>'),
    x: svgI('<path d="M6 6l12 12M18 6 6 18"/>')
  };
  function nAr(n) { return Number(n).toLocaleString("ar-EG", { useGrouping: false }); }

  function dayKey(v) {
    if (!v) return "";
    var d = new Date(v); if (isNaN(d.getTime())) return "";
    var p = function (n) { return (n < 10 ? "0" : "") + n; };
    return d.getFullYear() + "-" + p(d.getMonth() + 1) + "-" + p(d.getDate());
  }
  function dayLabel(k) {
    try { return new Date(k + "T00:00:00").toLocaleDateString("ar-EG", { day: "numeric", month: "short", year: "numeric" }); } catch (e) { return k; }
  }
  function subGrade(r) { var e = examById(r.examId); return r.sub.grade || (e && e.grade) || ""; }
  function filterActive() { return !!(S.q.trim() || S.fDate || (S.tab === "exams" && S.fTerm !== "all") || (S.tab === "subs" && S.fExam !== "all")); }
  function resetFilters() { S.q = ""; S.fDate = ""; S.fTerm = "all"; S.fExam = "all"; S.gStatus = {}; S.more = {}; }

  function examMatches(e) {
    var q = S.q.trim().toLowerCase();
    if (q) {
      var qc = X.normCode(q), hit = String(e.title || "").toLowerCase().indexOf(q) > -1 || (qc && X.normCode(e.code).indexOf(qc) > -1);
      if (!hit) return false;
    }
    if (S.fTerm !== "all" && (e.term ? String(e.term) : "none") !== S.fTerm) return false;
    if (S.fDate && dayKey(e.publishedAt) !== S.fDate) return false;
    return true;
  }
  function subMatches(r) {
    var e = examById(r.examId), q = S.q.trim().toLowerCase();
    if (S.fExam !== "all" && r.examId !== S.fExam) return false;
    if (q && (uname(r.sub) + " " + (e ? e.title : r.sub.examTitle || "")).toLowerCase().indexOf(q) < 0) return false;
    if (S.fDate && dayKey(r.sub.submittedAt) !== S.fDate) return false;
    return true;
  }

  /* ---- كارت الامتحان ---- */
  function examRow(e) {
    var c = subCounts(e.id), id = esc(e.id), more = !!S.more[e.id];
    var st = e.status === "published" ? '<span class="exm-pill exm-pill--ok">منشور</span>' : e.status === "closed" ? '<span class="exm-pill">مغلق</span>' : '<span class="exm-pill exm-pill--warn">مسودة</span>';
    var facts = [X.countQuestions(e) + " سؤال", X.totalPoints(e) + " درجة"];
    if (e.durationMin > 0) facts.push(e.durationMin + " دقيقة");
    var sec = String(e.grade || "").indexOf("secondary") === 0 && e.track && e.track !== "all" ? X.TRACK_NAMES[e.track] : "";
    if (sec) facts.push(sec);
    if (e.term) facts.push(TERM_NAMES[e.term]);
    var when = e.publishedAt ? "نُشر " + X.fmtDate(e.publishedAt) : "لم يُنشر بعد";
    var priv = X.isPrivate(e);
    var acc = priv ? '<span class="exm-pill exm-pill--lock">' + I.lock + " خاص</span>" : '<span class="exm-pill">' + I.globe + " عام</span>";
    var code = e.code
      ? '<button type="button" class="exm-codechip" data-act="qr" data-id="' + id + '" aria-label="عرض رمز الامتحان وQR">' + I.qr + '<span dir="ltr">' + esc(X.fmtCode(e.code)) + "</span></button>"
      : '<button type="button" class="exm-codechip" data-act="genCode" data-id="' + id + '">' + I.qr + "<span>إنشاء رمز</span></button>";
    var prog = c.total ? '<div class="exm-prog"><div class="exm-prog__bar"><i style="width:' + Math.round((c.graded / c.total) * 100) + '%"></i></div><span>اتصحّح ' + c.graded + " من " + c.total + "</span></div>" : '<div class="exm-prog"><span>مفيش تسليمات لسه</span></div>';
    var extra = "";
    if (e.status === "published") extra += '<button type="button" class="exm-btn" data-act="setStatus" data-id="' + id + '" data-st="closed">إغلاق الامتحان</button>';
    if (e.status === "closed") extra += '<button type="button" class="exm-btn" data-act="setStatus" data-id="' + id + '" data-st="published">إعادة فتح</button>';
    extra += '<button type="button" class="exm-btn" data-act="paper" data-id="' + id + '">ملف PDF</button>' +
      '<button type="button" class="exm-btn exm-btn--danger" data-act="delExam" data-id="' + id + '">حذف</button>';
    return '<article class="exm-ex"><div class="exm-ex__top"><h4 class="exm-ex__title" dir="auto">' + esc(e.title || "بدون عنوان") + "</h4>" + st + "</div>" +
      '<div class="exm-ex__tags">' + acc + code + "</div>" +
      '<p class="exm-facts">' + facts.map(function (f) { return "<span>" + esc(f) + "</span>"; }).join("") + "</p>" +
      '<p class="exm-when">' + esc(when) + "</p>" + prog +
      '<div class="exm-ex__acts"><button type="button" class="exm-btn exm-btn--accent" data-act="edit" data-id="' + id + '">تعديل</button>' +
      '<button type="button" class="exm-btn" data-act="subsOf" data-id="' + id + '">التسليمات (' + c.total + ')</button>' +
      '<button type="button" class="exm-btn exm-btn--icon" data-act="more" data-id="' + id + '" aria-expanded="' + more + '" aria-label="خيارات أخرى">⋯</button></div>' +
      (more ? '<div class="exm-ex__more">' + extra + "</div>" : "") + "</article>";
  }

  /* ---- صف التسليم ---- */
  function subRow(r) {
    var e = examById(r.examId), s = r.sub, graded = s.status === "graded";
    return '<article class="exm-sr" role="button" tabindex="0" data-act="review" data-e="' + esc(r.examId) + '" data-u="' + esc(r.studentId) + '">' +
      '<div class="exm-sr__main"><strong class="exm-sr__name" dir="auto">' + esc(uname(s)) + '</strong><span class="exm-sr__exam" dir="auto">' + esc(e ? e.title : s.examTitle || "امتحان") + '</span><span class="exm-sr__date">' + esc(X.fmtDateTime(s.submittedAt)) + "</span></div>" +
      '<div class="exm-sr__side">' + (graded
        ? '<span class="exm-pill exm-pill--ok">' + esc(s.finalScore) + " / " + esc(s.outOf) + '</span><button type="button" class="exm-btn exm-btn--sm" data-act="pdf" data-e="' + esc(r.examId) + '" data-u="' + esc(r.studentId) + '">PDF</button>'
        : '<span class="exm-pill exm-pill--warn">بانتظار التصحيح</span>') + "</div></article>";
  }

  /* ---- الشاشة الرئيسية: الصفوف الدراسية ---- */
  function tabsHtml() {
    var pc = pendingCount(), isEx = S.tab === "exams";
    return '<div class="exm-tabs" role="tablist"><button type="button" role="tab" aria-selected="' + isEx + '" class="exm-tab' + (isEx ? " is-active" : "") + '" data-act="tab" data-t="exams">الامتحانات</button>' +
      '<button type="button" role="tab" aria-selected="' + !isEx + '" class="exm-tab' + (!isEx ? " is-active" : "") + '" data-act="tab" data-t="subs">التسليمات والمراجعة' + (pc ? '<span class="exm-tab__badge">' + pc + "</span>" : "") + "</button></div>";
  }
  function gradeRow(g) {
    var isEx = S.tab === "exams", exs = S.exams.filter(function (e) { return e.grade === g; });
    var subs = subList().filter(function (r) { return subGrade(r) === g; });
    var pend = subs.filter(function (r) { return r.sub.status !== "graded"; }).length;
    var n = isEx ? exs.length : subs.length, drafts = exs.filter(function (e) { return e.status === "draft"; }).length;
    var line = isEx ? (n ? n + " امتحان" + (drafts ? " — منهم " + drafts + " مسودة" : "") : "مفيش امتحانات لسه") : (n ? n + " تسليم" : "مفيش تسليمات لسه");
    return '<button type="button" class="exm-gr' + (n ? "" : " is-empty") + '" data-act="openGrade" data-g="' + g + '">' +
      '<span class="exm-gr__num">' + n + "</span>" +
      '<span class="exm-gr__main"><strong>' + esc(X.GRADE_NAMES[g]) + "</strong><small>" + esc(line) + "</small></span>" +
      (!isEx && pend ? '<span class="exm-grp__alert">' + pend + " بانتظار التصحيح</span>" : "") + I.fwd + "</button>";
  }
  function renderHome() {
    root.innerHTML = '<div class="exm-root"><div class="exm-head"><h2>إدارة الامتحانات</h2><button type="button" class="exm-btn exm-btn--accent" data-act="new">+ امتحان جديد</button></div>' +
      tabsHtml() + '<div class="exm-groups">' + GRADE_KEYS.map(gradeRow).join("") + "</div></div>";
  }

  /* ---- صفحة الصف الدراسي (كل الامتحانات / التسليمات بتاعته) ---- */
  function gradeBodyHtml() {
    var g = S.grade, isEx = S.tab === "exams";
    if (isEx) {
      var list = S.exams.filter(function (e) { return e.grade === g && examMatches(e); });
      return list.length ? list.map(examRow).join("") : '<p class="exm-empty">' + (filterActive() ? "مفيش نتايج مطابقة للبحث أو الفلتر." : "مفيش امتحانات في الصف ده لسه.") + "</p>";
    }
    var all = subList().filter(function (r) { return subGrade(r) === g && subMatches(r); });
    var pend = all.filter(function (r) { return r.sub.status !== "graded"; }).length, st = S.gStatus[g] || "all";
    var chips = [["all", "الكل", all.length], ["pending", "بانتظار التصحيح", pend], ["graded", "اتصحّحت", all.length - pend]].map(function (c) {
      return '<button type="button" class="exm-chip' + (st === c[0] ? " is-active" : "") + '" data-act="gst" data-g="' + g + '" data-v="' + c[0] + '">' + c[1] + " <b>" + c[2] + "</b></button>";
    }).join("");
    var shown = all.filter(function (r) { return st === "pending" ? r.sub.status !== "graded" : st === "graded" ? r.sub.status === "graded" : true; });
    return '<div class="exm-chips">' + chips + "</div>" + (shown.length ? shown.map(subRow).join("") : '<p class="exm-empty">' + (filterActive() || st !== "all" ? "مفيش تسليمات في الاختيار ده." : "مفيش تسليمات في الصف ده لسه.") + "</p>");
  }
  function paintListBody() { var el = $("#exmListBody"); if (el) el.innerHTML = gradeBodyHtml(); }

  function renderGradePage() {
    var g = S.grade, isEx = S.tab === "exams";
    var tools = '<div class="exm-tools"><div class="exm-search"><input class="exm-input exm-input--pill" type="search" data-fl="q" dir="rtl" value="' + esc(S.q) + '" placeholder="' +
      (isEx ? "ابحث باسم الامتحان أو الرمز" : "ابحث باسم الطالب أو الامتحان") + '" aria-label="بحث" />' + I.search + "</div>" +
      '<div class="exm-datebtn' + (S.fDate ? " has-value" : "") + '"><button type="button" class="exm-datebtn__face" data-act="cal" aria-haspopup="dialog" aria-label="' + (isEx ? "اختيار تاريخ النشر" : "اختيار تاريخ التسليم") + '">' + I.cal + (S.fDate ? "<span>" + esc(dayLabel(S.fDate)) + "</span>" : "") + "</button>" +
      (S.fDate ? '<button type="button" class="exm-datebtn__clear" data-act="clearDate" aria-label="مسح التاريخ">×</button>' : "") + "</div></div>";
    var chips = "";
    if (isEx) {
      var mine = S.exams.filter(function (e) { return e.grade === g; }), n1 = 0, n2 = 0, n0 = 0;
      mine.forEach(function (e) { if (Number(e.term) === 1) n1++; else if (Number(e.term) === 2) n2++; else n0++; });
      var defs = [["all", "الكل", mine.length], ["1", "الترم الأول", n1], ["2", "الترم الثاني", n2]];
      if (n0) defs.push(["none", "بدون ترم", n0]);
      chips = '<div class="exm-chips">' + defs.map(function (c) {
        return '<button type="button" class="exm-chip' + (S.fTerm === c[0] ? " is-active" : "") + '" data-act="fterm" data-v="' + c[0] + '">' + c[1] + " <b>" + c[2] + "</b></button>";
      }).join("") + "</div>";
    } else if (S.fExam !== "all") {
      var fe = examById(S.fExam);
      chips = '<div class="exm-chips"><button type="button" class="exm-chip is-active" data-act="clearExam">الامتحان: ' + esc(fe ? fe.title : "—") + " ×</button></div>";
    }
    root.innerHTML = '<div class="exm-root"><div class="exm-head"><button type="button" class="exm-btn exm-btn--ghost" data-act="backGrades">' + I.back + " كل الصفوف</button>" +
      '<button type="button" class="exm-btn exm-btn--accent" data-act="new" data-g="' + g + '">+ امتحان جديد</button></div>' +
      '<h2 class="exm-gp__title">' + esc(X.GRADE_NAMES[g]) + "</h2>" + tabsHtml() + tools + chips + '<div id="exmListBody" class="exm-groups">' + gradeBodyHtml() + "</div></div>";
  }

  function renderList() { if (S.grade && X.GRADE_NAMES[S.grade]) renderGradePage(); else { S.grade = null; renderHome(); } }

  /* ---- تقويم اختيار التاريخ (بنفس ستايل المنصة) ---- */
  function markSet() {
    var set = {};
    if (S.tab === "exams") S.exams.forEach(function (e) { if (e.grade === S.grade && e.publishedAt) set[dayKey(e.publishedAt)] = 1; });
    else subList().forEach(function (r) { if (subGrade(r) === S.grade) set[dayKey(r.sub.submittedAt)] = 1; });
    return set;
  }
  function openCalendar() {
    var base = S.fDate ? new Date(S.fDate + "T00:00:00") : new Date(), cal = { y: base.getFullYear(), m: base.getMonth() };
    var marks = markSet(), todayK = dayKey(Date.now()), p2 = function (n) { return (n < 10 ? "0" : "") + n; };
    function grid() {
      var first = new Date(cal.y, cal.m, 1), lead = (first.getDay() + 1) % 7, start = new Date(cal.y, cal.m, 1 - lead), cells = "";
      for (var i = 0; i < 42; i++) {
        var d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
        var k = d.getFullYear() + "-" + p2(d.getMonth() + 1) + "-" + p2(d.getDate());
        cells += '<button type="button" class="exm-cal__day' + (d.getMonth() !== cal.m ? " is-out" : "") + (k === todayK ? " is-today" : "") + (k === S.fDate ? " is-sel" : "") + (marks[k] ? " has-mark" : "") +
          '" data-cal="pick" data-d="' + k + '" aria-label="' + esc(dayLabel(k)) + '">' + nAr(d.getDate()) + "</button>";
      }
      return cells;
    }
    function body() {
      return '<div class="exm-cal__nav"><button type="button" class="exm-iconbtn" data-cal="prev" aria-label="الشهر اللي قبله">' + I.back + "</button>" +
        '<strong class="exm-cal__title">' + MONTHS[cal.m] + " " + nAr(cal.y) + '</strong><button type="button" class="exm-iconbtn" data-cal="next" aria-label="الشهر اللي بعده">' + I.fwd + "</button></div>" +
        '<div class="exm-cal__week" aria-hidden="true">' + WEEK.map(function (w) { return "<span>" + w + "</span>"; }).join("") + "</div>" +
        '<div class="exm-cal__grid">' + grid() + "</div>" +
        '<p class="exm-cal__hint"><i></i> أيام فيها ' + (S.tab === "exams" ? "امتحانات اتنشرت" : "تسليمات") + "</p>" +
        '<div class="exm-cal__foot"><button type="button" class="exm-btn exm-btn--ghost" data-cal="clear">مسح التاريخ</button><button type="button" class="exm-btn" data-cal="today">اليوم</button><button type="button" class="exm-btn exm-btn--accent" data-close="1">إغلاق</button></div>';
    }
    var m = X.modal('<div class="exm-modal__head"><h3>' + (S.tab === "exams" ? "تاريخ النشر" : "تاريخ التسليم") + '</h3><button type="button" class="exm-iconbtn" data-close="1" aria-label="إغلاق">' + I.x + '</button></div><div class="exm-cal__body">' + body() + "</div>", { label: "اختيار التاريخ", cls: "exm-cal" });
    var host = $(".exm-cal__body", m.el);
    m.el.addEventListener("click", function (ev) {
      var b = ev.target.closest("[data-cal]"); if (!b) return;
      var a = b.dataset.cal;
      if (a === "prev") { cal.m--; if (cal.m < 0) { cal.m = 11; cal.y--; } host.innerHTML = body(); return; }
      if (a === "next") { cal.m++; if (cal.m > 11) { cal.m = 0; cal.y++; } host.innerHTML = body(); return; }
      if (a === "pick") S.fDate = b.dataset.d;
      else if (a === "today") S.fDate = todayK;
      else if (a === "clear") S.fDate = "";
      m.close(); render();
    });
  }

  /* ---- رمز الامتحان + QR ---- */
  function copyText(t) {
    if (navigator.clipboard && navigator.clipboard.writeText) return navigator.clipboard.writeText(t);
    return new Promise(function (res, rej) {
      var ta = document.createElement("textarea"); ta.value = t; ta.style.cssText = "position:fixed;opacity:0"; document.body.appendChild(ta); ta.select();
      try { document.execCommand("copy") ? res() : rej(); } catch (e) { rej(e); } document.body.removeChild(ta);
    });
  }
  function qrModel(text) { var q = qrcode(0, "M"); q.addData(text); q.make(); return q; }
  function qrSvg(q) {
    var n = q.getModuleCount(), m = 4, size = n + 2 * m, d = "";
    for (var r = 0; r < n; r++) for (var c = 0; c < n; c++) if (q.isDark(r, c)) d += "M" + (c + m) + " " + (r + m) + "h1v1h-1z";
    return '<svg viewBox="0 0 ' + size + " " + size + '" shape-rendering="crispEdges" role="img" aria-label="QR code للامتحان"><rect width="' + size + '" height="' + size + '" fill="#fff"/><path d="' + d + '" fill="#111"/></svg>';
  }
  function qrDownload(q, name) {
    var n = q.getModuleCount(), m = 4, size = n + 2 * m, scale = Math.max(4, Math.floor(1024 / size)), cv = document.createElement("canvas");
    cv.width = cv.height = size * scale;
    var g = cv.getContext("2d"); g.fillStyle = "#fff"; g.fillRect(0, 0, cv.width, cv.height); g.fillStyle = "#111";
    for (var r = 0; r < n; r++) for (var c = 0; c < n; c++) if (q.isDark(r, c)) g.fillRect((c + m) * scale, (r + m) * scale, scale, scale);
    cv.toBlob(function (blob) {
      if (!blob) return toast("تعذّر إنشاء الصورة", true);
      var a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click();
      setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
    }, "image/png");
  }
  function openQr(ex) {
    if (typeof ex === "string") ex = examById(ex);
    if (!ex || !ex.code) return toast("الامتحان ده ملوش رمز لسه", true);
    X.loadScript("exams-qr-gen.js?v=1").then(function () {
      var url = X.shareUrl(ex.code), q = qrModel(url), priv = X.isPrivate(ex);
      var html = '<div class="exm-modal__head"><h3>رمز الامتحان</h3><button type="button" class="exm-iconbtn" data-close="1" aria-label="إغلاق">' + I.x + "</button></div>" +
        '<p class="exm-qrm__title" dir="auto">' + esc(ex.title || "امتحان") + "</p>" +
        '<div class="exm-qrm__qr">' + qrSvg(q) + "</div>" +
        '<div class="exm-qrm__code" dir="ltr">' + esc(X.fmtCode(ex.code)) + "</div>" +
        '<p class="exm-sub exm-qrm__hint">' + (priv ? "الامتحان خاص: مش هيظهر للطلاب غير بالرمز ده أو بمسح الـ QR." : "الامتحان عام وبيظهر لكل طلاب الصف، والرمز ده بديل لو حبّيت توزّعه.") + "</p>" +
        '<div class="exm-qrm__acts"><button type="button" class="exm-btn" data-q="code">' + I.copy + ' نسخ الرمز</button><button type="button" class="exm-btn" data-q="link">' + I.copy + ' نسخ الرابط</button>' +
        '<button type="button" class="exm-btn exm-btn--accent" data-q="png">' + I.dl + " تنزيل QR</button></div>";
      var m = X.modal(html, { label: "رمز الامتحان وQR", cls: "exm-qrm" });
      m.el.addEventListener("click", function (ev) {
        var b = ev.target.closest("[data-q]"); if (!b) return;
        if (b.dataset.q === "png") return qrDownload(q, "exam-" + ex.code + ".png");
        var txt = b.dataset.q === "code" ? X.fmtCode(ex.code) : url;
        copyText(txt).then(function () { toast(b.dataset.q === "code" ? "تم نسخ الرمز" : "تم نسخ الرابط"); }).catch(function () { toast("تعذّر النسخ", true); });
      });
    }).catch(function () { toast("تعذّر تحميل مولّد الـ QR — اتأكد إن ملف exams-qr-gen.js مرفوع", true); });
  }
  function ensureCode(id) {
    var e = examById(id); if (!e) return Promise.resolve(null);
    if (e.code) return Promise.resolve(e);
    var code = X.makeCode(S.exams.map(function (x) { return x.code; }));
    return Promise.resolve(SNAuth.updateExamFields(id, { code: code })).then(function () { e.code = code; return e; });
  }

  /* ------------------------------------------------------------ إنشاء الامتحان */
  function settingsFields(e) {
    var gradeOpts = Object.keys(X.GRADE_NAMES).map(function (k) { return '<option value="' + k + '"' + (e.grade === k ? " selected" : "") + ">" + X.GRADE_NAMES[k] + "</option>"; }).join("");
    var trackOpts = ["all", "general", "bacc"].map(function (k) { return '<option value="' + k + '"' + ((e.track || "all") === k ? " selected" : "") + ">" + X.TRACK_NAMES[k] + "</option>"; }).join("");
    var sec = String(e.grade || "").indexOf("secondary") === 0;
    return '<div class="exm-field"><label>عنوان الامتحان</label><input class="exm-input" dir="auto" data-ef="title" value="' + esc(e.title) + '" placeholder="مثال: امتحان الوحدة الأولى" /></div>' +
      '<div class="exm-grid2"><div class="exm-field"><label>الصف المستهدف</label><select class="exm-select" data-ef="grade"><option value="">اختار الصف</option>' + gradeOpts + "</select></div>" +
      '<div class="exm-field" id="exmTrackField"' + (sec ? "" : " hidden") + '><label>المسار (للثانوي)</label><select class="exm-select" data-ef="track">' + trackOpts + "</select></div></div>" +
      '<div class="exm-grid2"><div class="exm-field"><label>الترم</label><select class="exm-select" data-ef="term"><option value="">غير محدد</option><option value="1"' + (Number(e.term) === 1 ? " selected" : "") + '>الترم الأول</option><option value="2"' + (Number(e.term) === 2 ? " selected" : "") + '>الترم الثاني</option></select></div>' +
      '<div class="exm-field"><label>المدة بالدقائق (0 = بدون مؤقّت)</label><input class="exm-input" type="number" min="0" max="300" data-ef="durationMin" value="' + esc(e.durationMin == null ? 30 : e.durationMin) + '" /></div></div>' +
      accessField(e) + codeField(e) +
      '<div class="exm-field"><label>تعليمات للطلاب (اختياري)</label><textarea class="exm-textarea" data-ef="instructions">' + esc(e.instructions) + "</textarea></div>";
  }

  function accessField(e) {
    var priv = X.isPrivate(e);
    function seg(v, t, d) { var on = (v === "private") === priv; return '<button type="button" role="radio" aria-checked="' + on + '" class="exm-seg__btn' + (on ? " is-active" : "") + '" data-act="setAccess" data-v="' + v + '"><strong>' + t + "</strong><small>" + d + "</small></button>"; }
    return '<div class="exm-field"><label>إتاحة الامتحان</label><div class="exm-seg" role="radiogroup" aria-label="إتاحة الامتحان" id="exmAccessSeg">' +
      seg("public", "عام", "يظهر لكل طلاب الصف") + seg("private", "خاص", "بالرمز أو QR بس") + "</div></div>";
  }
  function codeField(e) {
    if (!e.code) return "";
    return '<div class="exm-field"><label>رمز الامتحان</label><div class="exm-coderow"><span class="exm-coderow__code" dir="ltr">' + esc(X.fmtCode(e.code)) + '</span>' +
      '<button type="button" class="exm-btn exm-btn--sm" data-act="qrCur">' + I.qr + " عرض QR</button></div></div>";
  }
  function paintAccess() {
    var priv = X.isPrivate(S.exam);
    $$("#exmAccessSeg .exm-seg__btn").forEach(function (b) { var on = (b.dataset.v === "private") === priv; b.classList.toggle("is-active", on); b.setAttribute("aria-checked", on); });
  }

  function renderSetup() {
    root.innerHTML = '<div class="exm-root"><div class="exm-head"><h2>امتحان جديد</h2></div>' +
      '<div class="exm-card">' + settingsFields(S.exam) + '<div class="exm-row" style="justify-content:flex-start"><button type="button" class="exm-btn exm-btn--accent" data-act="setupNext">التالي: بناء الأسئلة</button><button type="button" class="exm-btn" data-act="cancel">إلغاء</button></div></div></div>';
  }

  /* ------------------------------------------------------------ Builder */
  function qBlock(sec, q, no) {
    var T = X.typeOf(sec.type), ids = 'data-s="' + esc(sec.id) + '" data-q="' + esc(q.id) + '"', body;
    if (sec.type === "mcq") {
      body = '<div class="exm-opts">' + X.LETTERS.map(function (L) {
        return '<div class="exm-field"><b>' + L + '</b><input class="exm-input" dir="auto" ' + ids + ' data-o="' + L + '" value="' + esc((q.options || {})[L]) + '" placeholder="الاختيار ' + L + '" /></div>';
      }).join("") + "</div>" +
        '<div class="exm-field"><label>الإجابة الصحيحة</label><select class="exm-select" ' + ids + ' data-f="answer"><option value="">اختار</option>' +
        X.LETTERS.map(function (L) { return '<option value="' + L + '"' + (q.answer === L ? " selected" : "") + ">" + L + "</option>"; }).join("") + "</select></div>";
    } else if (sec.type === "correction") {
      body = '<div class="exm-field"><label>الجملة الصحيحة (مطلوبة — عشان تقدر تصحّح بيها بعدين)</label><textarea class="exm-textarea" dir="auto" ' + ids + ' data-f="answer">' + esc(q.answer) + "</textarea></div>";
    } else {
      body = "";
    }
    return '<div class="exm-qb"><div class="exm-qb__head"><span class="exm-q__no">' + no + '</span><span class="exm-sub">' + T.ar + '</span><span style="margin-inline-start:auto"></span>' +
      '<label class="exm-score-in">الدرجة <input class="exm-input exm-pts" type="number" min="0" step="0.5" ' + ids + ' data-f="points" value="' + esc(q.points) + '" /></label>' +
      '<button type="button" class="exm-btn exm-btn--danger" data-act="delQ" ' + ids + ' aria-label="حذف السؤال">×</button></div>' +
      '<div class="exm-field"><label>' + T.textLabel + '</label><textarea class="exm-textarea" dir="auto" ' + ids + ' data-f="text">' + esc(q.text) + "</textarea></div>" + body + "</div>";
  }

  function sectionHtml(sec, startNo) {
    var typeOpts = X.TYPES.map(function (t) { return '<option value="' + t.k + '"' + (sec.type === t.k ? " selected" : "") + ">" + t.ar + "</option>"; }).join("");
    return '<section class="exm-sec" data-sec="' + esc(sec.id) + '"><div class="exm-sec__top">' +
      '<div class="exm-field"><label>عنوان القسم / التعليمات</label><input class="exm-input" dir="auto" data-sh="' + esc(sec.id) + '" value="' + esc(sec.header) + '" /></div>' +
      '<div class="exm-field"><label>النوع</label><select class="exm-select" data-stype="' + esc(sec.id) + '">' + typeOpts + "</select></div>" +
      '<button type="button" class="exm-btn exm-btn--danger" data-act="delSec" data-s="' + esc(sec.id) + '">حذف القسم</button></div>' +
      sec.questions.map(function (q, i) { return qBlock(sec, q, startNo + i); }).join("") +
      '<button type="button" class="exm-btn" data-act="addQ" data-s="' + esc(sec.id) + '">+ إضافة سؤال لنفس القسم</button></section>';
  }

  function drawerHtml() {
    var p = S.pick;
    return '<div class="exm-scrim" id="exmScrim" data-act="closeDrawer"' + (S.drawer ? "" : " hidden") + "></div>" +
      '<aside class="exm-drawer" id="exmDrawer" aria-label="أنواع الأسئلة"' + (S.drawer ? "" : " hidden") + ">" +
      '<div class="exm-drawer__head"><h3>إضافة أسئلة</h3><button type="button" class="exm-btn" data-act="closeDrawer" aria-label="إغلاق">×</button></div>' +
      '<p class="exm-sub">اختار نوع الأسئلة واكتب العدد، وهنولّد لك قسم جاهز بعنوانه وكل بلوكات الأسئلة.</p>' +
      X.TYPES.map(function (t) {
        return '<button type="button" class="exm-type' + (p.type === t.k ? " is-picked" : "") + '" data-act="pickType" data-t="' + t.k + '"><span class="exm-type__dot">' + (t.k === "mcq" ? "A" : t.ar.charAt(0)) + "</span>" + t.ar + "</button>";
      }).join("") +
      '<div class="exm-field"><label>عدد الأسئلة</label><div class="exm-qty"><button type="button" data-act="qty" data-d="-1" aria-label="أقل">−</button><input class="exm-input" id="exmQty" type="number" min="1" max="50" value="' + esc(p.count) + '" /><button type="button" data-act="qty" data-d="1" aria-label="أكثر">+</button></div></div>' +
      '<div class="exm-field"><label>عنوان القسم (جاهز وتقدر تعدّله)</label><input class="exm-input" id="exmPickHeader" dir="auto" value="' + esc(p.header) + '" /></div>' +
      '<button type="button" class="exm-btn exm-btn--accent" data-act="generate">توليد الأسئلة</button></aside>';
  }

  function renderBuilder() {
    var e = S.exam, no = 1;
    var secs = e.sections.map(function (s) { var h = sectionHtml(s, no); no += s.questions.length; return h; }).join("");
    var blank = '<div class="exm-blank"><button type="button" class="exm-blank__plus" data-act="blankPlus" aria-label="إنشاء قالب امتحان فارغ">+</button><div><strong>ابدأ بقالب امتحان فارغ</strong><p class="exm-sub">أو استخدم الزرار العائم (+) تحت لتوليد أسئلة بالنوع والعدد.</p></div></div>';
    var cnt = subCounts(e.id).total;
    root.innerHTML = '<div class="exm-root">' +
      '<div class="exm-total"><div><strong>' + esc(e.title || "امتحان جديد") + '</strong> <span class="exm-pill ' + (e.status === "published" ? "exm-pill--ok" : "exm-pill--warn") + '">' + (e.status === "published" ? "منشور" : e.status === "closed" ? "مغلق" : "مسودة") + "</span>" +
      '<div class="exm-savestate" id="exmSaveState">' + (S.dirty ? "تعديلات غير محفوظة" : "") + '</div></div>' +
      '<div class="exm-row"><span class="exm-pill" id="exmTotal">' + X.totalPoints(e) + " درجة · " + X.countQuestions(e) + ' سؤال</span>' +
      '<button type="button" class="exm-btn" data-act="saveNow">حفظ</button>' +
      '<button type="button" class="exm-btn exm-btn--accent" data-act="publish">' + (e.status === "draft" ? "نشر الامتحان" : "حفظ التعديلات") + '</button>' +
      '<button type="button" class="exm-btn" data-act="backList">رجوع</button></div></div>' +
      (cnt ? '<div class="exm-note">فيه ' + cnt + " تسليم على الامتحان ده — تعديل الأسئلة أو الإجابات الصحيحة هيأثّر على التصحيح.</div>" : "") +
      (S.errs.length ? '<div class="exm-note" role="alert"><strong>راجع الآتي قبل النشر:</strong><br>' + S.errs.map(esc).join("<br>") + "</div>" : "") +
      '<details class="exm-card"><summary><strong>إعدادات الامتحان</strong></summary><div style="display:flex;flex-direction:column;gap:12px;margin-top:12px">' + settingsFields(e) + "</div></details>" +
      (e.sections.length ? secs : blank) + "</div>" +
      '<button type="button" class="exm-fab' + (S.drawer ? " is-open" : "") + '" id="exmFab" data-act="fab" aria-label="إضافة أسئلة" aria-expanded="' + (S.drawer ? "true" : "false") + '">+</button>' + drawerHtml();
  }

  function markDirty() {
    S.dirty = true;
    var el = $("#exmSaveState"); if (el) el.textContent = "تعديلات غير محفوظة";
    clearTimeout(S.saveTimer);
    S.saveTimer = setTimeout(function () { save(true); }, 2500);
  }
  function updateTotal() {
    var el = $("#exmTotal"); if (el && S.exam) el.textContent = X.totalPoints(S.exam) + " درجة · " + X.countQuestions(S.exam) + " سؤال";
  }
  function paintDrawer() {
    var d = $("#exmDrawer"), sc = $("#exmScrim"), f = $("#exmFab");
    if (d) d.hidden = !S.drawer;
    if (sc) sc.hidden = !S.drawer;
    if (f) { f.classList.toggle("is-open", S.drawer); f.setAttribute("aria-expanded", S.drawer ? "true" : "false"); }
    $$(".exm-type", root).forEach(function (b) { b.classList.toggle("is-picked", b.dataset.t === S.pick.type); });
    var h = $("#exmPickHeader"); if (h) h.value = S.pick.header;
    var q = $("#exmQty"); if (q) q.value = S.pick.count;
  }

  function save(silent) {
    if (!S.exam) return Promise.resolve(false);
    clearTimeout(S.saveTimer);
    S.exam.maxMarks = X.totalPoints(S.exam);
    S.exam.updatedAt = new Date().toISOString();
    var el = $("#exmSaveState"); if (el) el.textContent = "جاري الحفظ…";
    return Promise.resolve(SNAuth.saveExam(S.exam)).then(function (id) {
      S.exam.id = id; S.dirty = false;
      var copy = X.normalizeExam(X.clean(S.exam));
      var i = S.exams.map(function (x) { return x.id; }).indexOf(id);
      if (i < 0) S.exams.unshift(copy); else S.exams[i] = copy;
      var el2 = $("#exmSaveState"); if (el2) el2.textContent = "تم الحفظ ✓";
      if (!silent) toast("تم حفظ الامتحان");
      return true;
    }).catch(function () {
      var el3 = $("#exmSaveState"); if (el3) el3.textContent = "تعذّر الحفظ";
      toast("تعذّر الحفظ — راجع النت وصلاحيات Firebase", true);
      return false;
    });
  }

  function publish() {
    var e = S.exam;
    S.errs = X.validate(e);
    if (S.errs.length) { renderBuilder(); window.scrollTo(0, 0); return; }
    var wasDraft = e.status === "draft";
    if (wasDraft) { e.status = "published"; e.publishedAt = new Date().toISOString(); }
    save(true).then(function (ok) {
      if (!ok) { if (wasDraft) { e.status = "draft"; delete e.publishedAt; } return; }
      var priv = X.isPrivate(e), snap = X.clean(e);
      toast(wasDraft ? (priv ? "تم نشر الامتحان — وزّع الرمز أو الـ QR على الطلاب" : "تم نشر الامتحان — هيظهر لطلاب " + (X.GRADE_NAMES[e.grade] || "") + " فورًا") : "تم حفظ التعديلات");
      S.grade = e.grade || S.grade;
      backToList().then(function () { if (wasDraft && priv) openQr(snap); });
    });
  }

  function backToList() {
    S.exam = null; S.errs = []; S.drawer = false; S.view = "list"; S.tab = "exams";
    root.innerHTML = '<p class="exm-empty">جاري التحميل…</p>';
    return load().then(render);
  }

  function editExam(id) {
    var base = examById(id);
    if (!base) return;
    Promise.resolve(SNAuth.fetchExamKeys(id)).then(function (keys) {
      var e = X.normalizeExam(X.clean(base));
      if (!e.code) e.code = X.makeCode(S.exams.map(function (x) { return x.code; }));
      if (!e.access) e.access = "public";
      e.sections.forEach(function (s) { s.questions.forEach(function (q) { q.answer = keys && keys[q.id] != null ? keys[q.id] : ""; }); });
      S.exam = e; S.errs = []; S.dirty = false; S.drawer = false; S.view = "builder";
      render(); window.scrollTo(0, 0);
    }).catch(function () { toast("تعذّر تحميل مفاتيح الإجابة — مش هنفتح الامتحان للتعديل عشان ما تضيعش", true); });
  }

  /* ------------------------------------------------------------ المراجعة والتصحيح */
  function openReview(examId, uid) {
    var e = examById(examId), sub = S.subs[examId] && S.subs[examId][uid];
    if (!e || !sub) return;
    Promise.resolve(SNAuth.fetchExamKeys(examId)).catch(function () { return {}; }).then(function (keys) {
      var ex = X.normalizeExam(X.clean(e));
      ex.sections.forEach(function (s) { s.questions.forEach(function (q) { q.answer = keys && keys[q.id] != null ? keys[q.id] : ""; }); });
      S.cur = { exam: ex, sub: sub, uid: uid, manualFinal: sub.status === "graded" };
      S.view = "review";
      renderReview(); window.scrollTo(0, 0);
    });
  }

  function initialScore(row, sub) {
    var saved = sub.scores && sub.scores[row.q.id];
    if (saved != null) return { v: saved, auto: false };
    var sg = X.suggestScore(row, (sub.answers || {})[row.q.id], row.q.answer);
    return sg == null ? { v: "", auto: false } : { v: sg, auto: true };
  }

  function renderReview() {
    var c = S.cur, e = c.exam, sub = c.sub, rows = X.flatten(e), last = null, html = "";
    rows.forEach(function (r) {
      var q = r.q, ans = (sub.answers || {})[q.id] || "", sc = initialScore(r, sub), cls = "", shown, key = "";
      if (r.section !== last) { last = r.section; html += '<h3 class="exm-sec__head" dir="auto">' + esc(r.header) + "</h3>"; }
      if (r.type === "mcq") {
        var ok = ans && ans === q.answer;
        cls = ans ? (ok ? " exm-ans--ok" : " exm-ans--bad") : "";
        shown = ans ? ans + " — " + ((q.options || {})[ans] || "") : "— من غير إجابة —";
        key = q.answer ? '<div class="exm-key">الإجابة الصحيحة: <b>' + esc(q.answer) + "</b> — " + esc((q.options || {})[q.answer]) + "</div>" : "";
      } else {
        shown = ans || "— من غير إجابة —";
        key = q.answer ? '<div class="exm-key" dir="auto">الإجابة النموذجية: ' + esc(q.answer) + "</div>" : "";
      }
      html += '<article class="exm-card"><div class="exm-row"><span class="exm-q__no">' + r.no + '</span><span class="exm-score-in"><input class="exm-input" type="number" step="0.5" min="0" max="' + esc(q.points) + '" data-sc="' + esc(q.id) + '" data-max="' + esc(q.points) + '" value="' + esc(sc.v) + '" /> / ' + esc(q.points) + (sc.auto ? ' <span class="exm-pill">مقترح</span>' : "") + "</span></div>" +
        '<p class="exm-q__text" dir="auto">' + esc(q.text) + '</p><p class="exm-ans' + cls + '" dir="auto">' + esc(shown) + "</p>" + key + "</article>";
    });
    var rawMax = X.totalPoints(e);
    var outOf = sub.outOf != null ? sub.outOf : (e.maxMarks || rawMax);
    var graded = sub.status === "graded";
    root.innerHTML = '<div class="exm-root"><div class="exm-head"><button type="button" class="exm-btn" data-act="backSubs">رجوع للتسليمات</button>' +
      '<span class="exm-pill ' + (graded ? "exm-pill--ok" : "exm-pill--warn") + '">' + (graded ? "اتصحّح" : "بانتظار التصحيح") + "</span></div>" +
      '<div class="exm-card"><h3 class="exm-title">' + esc(uname(sub)) + '</h3><div class="exm-meta"><span class="exm-pill">' + esc(e.title) + '</span><span class="exm-pill">' + esc(gradeFull(sub.grade, sub.track) || "—") + '</span><span class="exm-pill">سُلّم: ' + esc(X.fmtDateTime(sub.submittedAt)) + "</span></div></div>" +
      html +
      '<div class="exm-card"><h3 class="exm-title">الدرجة النهائية</h3><div class="exm-final">' +
      '<div class="exm-field"><label>مجموع الأسئلة</label><div class="exm-title"><span id="exmRaw">0</span> / <span id="exmRawMax">' + rawMax + "</span></div></div>" +
      '<div class="exm-field"><label>الدرجة الكاملة للامتحان</label><input class="exm-input" type="number" min="1" step="0.5" id="exmOutOf" value="' + esc(outOf) + '" /></div>' +
      '<div class="exm-field"><label>الدرجة النهائية للطالب</label><input class="exm-input" type="number" min="0" step="0.5" id="exmFinal" value="' + esc(sub.finalScore != null ? sub.finalScore : "") + '" /></div></div>' +
      '<p class="exm-sub">الدرجة النهائية بتتحسب تلقائيًا (المجموع ÷ مجموع الأسئلة × الدرجة الكاملة)، وتقدر تعدّلها بإيدك.</p>' +
      '<div class="exm-field"><label>ملاحظات للطالب (اختياري)</label><textarea class="exm-textarea" dir="auto" id="exmFb">' + esc(sub.feedback || "") + "</textarea></div>" +
      '<div class="exm-row" style="justify-content:flex-start"><button type="button" class="exm-btn exm-btn--accent" data-act="saveGrade">' + (graded ? "تحديث الدرجة" : "حفظ الدرجة") + "</button>" +
      '<button type="button" class="exm-btn" data-act="pdfCur"' + (graded ? "" : " disabled") + ">تصدير / طباعة PDF</button></div>" +
      (graded ? "" : '<p class="exm-sub">الـ PDF بيتفعّل بعد حفظ الدرجة.</p>') + "</div></div>";
    recalc(false);
  }

  function recalc(fromFinal) {
    var c = S.cur; if (!c) return;
    var raw = 0;
    $$("[data-sc]", root).forEach(function (i) { raw += X.num(i.value, 0); });
    raw = X.round1(raw);
    var rawMax = X.totalPoints(c.exam) || 1, outOf = X.num($("#exmOutOf").value, rawMax);
    $("#exmRaw").textContent = raw;
    if (fromFinal) c.manualFinal = true;
    if (!c.manualFinal) $("#exmFinal").value = X.round1((raw / rawMax) * outOf);
  }

  function saveGrade() {
    var c = S.cur, e = c.exam, sub = c.sub, scores = {}, bad = "";
    $$("[data-sc]", root).forEach(function (i) {
      var v = i.value === "" ? 0 : parseFloat(i.value), mx = X.num(i.dataset.max, 0);
      if (!isFinite(v) || v < 0 || v > mx) bad = "درجة السؤال لازم تكون بين 0 و " + mx;
      scores[i.dataset.sc] = v;
    });
    var rawMax = X.totalPoints(e), outOf = parseFloat($("#exmOutOf").value), fin = parseFloat($("#exmFinal").value);
    if (!bad && !(outOf > 0)) bad = "الدرجة الكاملة لازم تكون أكبر من صفر";
    if (!bad && (!isFinite(fin) || fin < 0 || fin > outOf)) bad = "الدرجة النهائية لازم تكون بين 0 و " + outOf;
    if (bad) { toast(bad, true); return; }
    var raw = X.round1(Object.keys(scores).reduce(function (t, k) { return t + scores[k]; }, 0));
    var now = new Date().toISOString();
    var fields = { scores: scores, rawTotal: raw, rawMax: rawMax, outOf: outOf, finalScore: fin, feedback: $("#exmFb").value.trim(), status: "graded", gradedAt: now, gradedBy: ctx.session ? ctx.session.id : "admin" };
    var btn = $('[data-act="saveGrade"]', root); if (btn) btn.disabled = true;
    Promise.resolve(SNAuth.updateExamSubmission(e.id, c.uid, fields)).then(function () {
      /* تسجيل الدرجة في سجل درجات الطالب (قسم "الامتحانات") */
      var entry = { title: e.title, examId: "exam-" + e.id, score: fin, outOf: outOf, at: now, date: X.fmtDate(now), feedback: fields.feedback };
      if (sub.gradeKey) return SNAuth.setGradeEntry(c.uid, "exams", sub.gradeKey, entry);
      return Promise.resolve(SNAuth.addGradeEntry(c.uid, "exams", entry)).then(function (key) {
        fields.gradeKey = key;
        return SNAuth.updateExamSubmission(e.id, c.uid, { gradeKey: key });
      });
    }).then(function () {
      Object.keys(fields).forEach(function (k) { sub[k] = fields[k]; });
      S.subs[e.id][c.uid] = sub;
      toast("تم حفظ الدرجة وتسجيلها في سجل الطالب");
      renderReview();
    }).catch(function () {
      if (btn) btn.disabled = false;
      toast("تعذّر الحفظ — راجع النت وصلاحيات Firebase", true);
    });
  }

  /* ------------------------------------------------------------ تصدير / طباعة PDF */
  function sheetHtml(e, sub) {
    var rows = X.flatten(e), last = null, body = "";
    var pct = sub.outOf > 0 ? Math.round((sub.finalScore / sub.outOf) * 100) : 0, lv = X.levelFor(pct);
    rows.forEach(function (r) {
      var q = r.q, ans = (sub.answers || {})[q.id] || "", got = sub.scores && sub.scores[q.id] != null ? sub.scores[q.id] : 0, shown, key = "";
      if (r.section !== last) { last = r.section; body += '<h3 dir="auto">' + esc(r.header) + "</h3>"; }
      if (r.type === "mcq") {
        shown = ans ? ans + " — " + ((q.options || {})[ans] || "") : "— بدون إجابة —";
        key = q.answer ? "الإجابة الصحيحة: " + esc(q.answer) + " — " + esc((q.options || {})[q.answer]) : "";
      } else {
        shown = ans || "— بدون إجابة —";
        key = q.answer ? "الإجابة النموذجية: " + esc(q.answer) : "";
      }
      body += '<div class="q"><div class="qh"><b>' + r.no + ".</b><span class=\"sc\">" + esc(got) + " / " + esc(q.points) + '</span></div><div class="qt" dir="auto">' + esc(q.text) + '</div><div class="a" dir="auto">' + esc(shown) + "</div>" + (key ? '<div class="k" dir="auto">' + key + "</div>" : "") + "</div>";
    });
    return '<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>' + esc(uname(sub) + " — " + e.title) + "</title><style>" +
      "@page{size:A4;margin:14mm}*{box-sizing:border-box}body{font-family:'Segoe UI',Tahoma,Arial,sans-serif;color:#111;font-size:13px;line-height:1.7;margin:0}" +
      "header{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid #1d5260;padding-bottom:10px;margin-bottom:12px}" +
      "h1{margin:0;font-size:20px;color:#1d5260}h2{margin:2px 0 0;font-size:15px}h3{margin:16px 0 6px;font-size:14px;color:#1d5260}" +
      ".tot{text-align:center;border:2px solid #1d5260;border-radius:10px;padding:6px 16px}.tot b{display:block;font-size:24px}" +
      "table{width:100%;border-collapse:collapse;margin-bottom:8px}td{border:1px solid #bbb;padding:5px 8px}td.l{background:#f1f1f1;width:22%;font-weight:700}" +
      ".q{border:1px solid #ccc;border-radius:8px;padding:8px 10px;margin:6px 0;break-inside:avoid}.qh{display:flex;justify-content:space-between}.sc{font-weight:700}" +
      ".qt{white-space:pre-wrap;margin:2px 0}.a{background:#f4f4f4;border-radius:6px;padding:6px 8px;white-space:pre-wrap}.k{color:#555;font-size:12px;margin-top:4px}" +
      ".fb{border:1px dashed #888;border-radius:8px;padding:8px 10px;margin-top:12px}footer{margin-top:18px;color:#666;font-size:11px;text-align:center}" +
      "</style></head><body><header><div><h1>Mr. Shady Nasr</h1><h2>" + esc(e.title) + '</h2></div><div class="tot"><b>' + esc(sub.finalScore) + " / " + esc(sub.outOf) + "</b>" + pct + "% · " + lv.label + "</div></header>" +
      "<table><tr><td class=\"l\">الطالب</td><td>" + esc(uname(sub)) + '</td><td class="l">الصف</td><td>' + esc(gradeFull(sub.grade, sub.track) || "—") + "</td></tr>" +
      '<tr><td class="l">تاريخ التسليم</td><td>' + esc(X.fmtDateTime(sub.submittedAt)) + '</td><td class="l">تاريخ التصحيح</td><td>' + esc(sub.gradedAt ? X.fmtDateTime(sub.gradedAt) : "—") + "</td></tr></table>" +
      body + (sub.feedback ? '<div class="fb"><b>ملاحظات الأستاذ:</b> ' + esc(sub.feedback) + "</div>" : "") +
      "<footer>تمت الطباعة في " + esc(X.fmtDate(new Date().toISOString())) + "</footer></body></html>";
  }

  function printHtml(html) {
    var f = document.createElement("iframe");
    f.setAttribute("aria-hidden", "true");
    f.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden";
    document.body.appendChild(f);
    var d = f.contentWindow.document; d.open(); d.write(html); d.close();
    var done = false;
    function go() {
      if (done) return; done = true;
      try { f.contentWindow.focus(); f.contentWindow.print(); } catch (err) { toast("تعذّر فتح نافذة الطباعة", true); }
      setTimeout(function () { if (f.parentNode) f.parentNode.removeChild(f); }, 60000);
    }
    f.onload = function () { setTimeout(go, 150); };
    setTimeout(go, 900);
  }

  function exportPdf(examId, uid) {
    var e = examById(examId), sub = S.subs[examId] && S.subs[examId][uid];
    if (!e || !sub) return;
    if (sub.status !== "graded") { toast("صحّح الامتحان واحفظ الدرجة الأول", true); return; }
    Promise.resolve(SNAuth.fetchExamKeys(examId)).catch(function () { return {}; }).then(function (keys) {
      var ex = X.normalizeExam(X.clean(e));
      ex.sections.forEach(function (s) { s.questions.forEach(function (q) { q.answer = keys && keys[q.id] != null ? keys[q.id] : ""; }); });
      var html = sheetHtml(ex, sub);
      if (window.SNPdf) window.SNPdf.openHtml(html, { title: uname(sub) + " — " + e.title, filename: "exam-" + uname(sub) + "-" + e.title + ".pdf" });
      else printHtml(html);
    });
  }

  /* ملف الامتحان نفسه (الأسئلة بس) كـ PDF جوه المنصة */
  function examPaper(examId) {
    var e = examById(examId);
    if (!e) return;
    var ex = X.normalizeExam(X.clean(e));
    if (!window.SNPdf) { toast("عارض الملفات مش متاح", true); return; }
    window.SNPdf.openHtml(X.paperHtml(ex), { title: e.title || "الامتحان", filename: (e.title || "exam") + ".pdf" });
  }

  /* ------------------------------------------------------------ تشغيل الشاشات */
  function render() {
    if (!root) return;
    if (S.view === "setup") return renderSetup();
    if (S.view === "builder") return renderBuilder();
    if (S.view === "review") return renderReview();
    renderList();
  }

  function newExam(grade) {
    S.exam = {
      id: SNAuth.newExamId(), title: "", grade: grade || "", track: "all", term: S.defTerm, durationMin: 30, instructions: "",
      code: X.makeCode(S.exams.map(function (x) { return x.code; })), access: "public",
      status: "draft", maxMarks: 0, sections: [], createdAt: new Date().toISOString(), createdBy: ctx.session ? ctx.session.id : "admin"
    };
    S.errs = []; S.dirty = false; S.view = "setup";
    render(); window.scrollTo(0, 0);
  }

  function bind() {
    if (bound) return; bound = true;

    root.addEventListener("click", function (ev) {
      var b = ev.target.closest("[data-act]");
      if (!b) return;
      var a = b.dataset.act, s, q;
      if (a === "new") return newExam(b.dataset.g);
      if (a === "tab") { S.tab = b.dataset.t; S.q = ""; S.fDate = ""; S.fTerm = "all"; S.fExam = "all"; return render(); }
      if (a === "openGrade") { S.grade = b.dataset.g; resetFilters(); render(); return window.scrollTo(0, 0); }
      if (a === "backGrades") { S.grade = null; resetFilters(); render(); return window.scrollTo(0, 0); }
      if (a === "cal") return openCalendar();
      if (a === "qr") return openQr(b.dataset.id);
      if (a === "genCode") return ensureCode(b.dataset.id).then(function (e) { if (e) { render(); openQr(e); } }).catch(function () { toast("تعذّر إنشاء الرمز", true); });
      if (a === "qrCur") return openQr(S.exam);
      if (a === "setAccess") { S.exam.access = b.dataset.v; paintAccess(); if (S.view === "builder") markDirty(); return; }
      if (a === "fterm") { S.fTerm = b.dataset.v; return render(); }
      if (a === "gst") { S.gStatus[b.dataset.g] = b.dataset.v; return paintListBody(); }
      if (a === "more") { S.more[b.dataset.id] = !S.more[b.dataset.id]; return paintListBody(); }
      if (a === "clearExam") { S.fExam = "all"; return render(); }
      if (a === "clearDate") { S.fDate = ""; return render(); }
      if (a === "edit") return editExam(b.dataset.id);
      if (a === "subsOf") { var se = examById(b.dataset.id); S.tab = "subs"; S.fExam = b.dataset.id; S.q = ""; S.fDate = ""; if (se) { S.grade = se.grade; S.gStatus[se.grade] = "all"; } return render(); }
      if (a === "setStatus") {
        var st = b.dataset.st;
        return Promise.resolve(SNAuth.updateExamFields(b.dataset.id, { status: st })).then(function () {
          var e = examById(b.dataset.id); if (e) e.status = st;
          toast(st === "closed" ? "تم إغلاق الامتحان" : "تم فتح الامتحان للطلاب"); render();
        }).catch(function () { toast("تعذّر التحديث", true); });
      }
      if (a === "delExam") {
        if (!armed(b, "تأكيد الحذف؟")) return;
        return Promise.resolve(SNAuth.deleteExam(b.dataset.id)).then(function () {
          S.exams = S.exams.filter(function (x) { return x.id !== b.dataset.id; }); delete S.subs[b.dataset.id];
          toast("تم حذف الامتحان وتسليماته"); render();
        }).catch(function () { toast("تعذّر الحذف", true); });
      }
      if (a === "review") { if (ev.target.closest('[data-act="pdf"]')) return; return openReview(b.dataset.e, b.dataset.u); }
      if (a === "pdf") { ev.stopPropagation(); return exportPdf(b.dataset.e, b.dataset.u); }
      if (a === "backSubs") { S.view = "list"; S.tab = "subs"; S.cur = null; return render(); }
      if (a === "saveGrade") return saveGrade();
      if (a === "pdfCur") return exportPdf(S.cur.exam.id, S.cur.uid);
      if (a === "paper") return examPaper(b.dataset.id);

      /* setup */
      if (a === "cancel") { S.exam = null; S.view = "list"; return render(); }
      if (a === "setupNext") {
        var errs = [];
        if (!String(S.exam.title).trim()) errs.push("اكتب عنوان الامتحان");
        if (!S.exam.grade) errs.push("اختار الصف المستهدف");
        if (errs.length) return toast(errs.join(" — "), true);
        S.exam.durationMin = X.num(S.exam.durationMin, 0);
        return save(true).then(function (ok) { if (ok) { S.view = "builder"; render(); window.scrollTo(0, 0); } });
      }

      /* builder */
      if (a === "backList") { if (S.dirty) save(true).then(backToList); else backToList(); return; }
      if (a === "saveNow") return save(false);
      if (a === "publish") return publish();
      if (a === "blankPlus") { S.exam.sections.push(X.generate("mcq", 1, "")); markDirty(); return renderBuilder(); }
      if (a === "fab") { S.drawer = !S.drawer; return paintDrawer(); }
      if (a === "closeDrawer") { S.drawer = false; return paintDrawer(); }
      if (a === "pickType") { S.pick.type = b.dataset.t; S.pick.header = X.typeOf(b.dataset.t).header; return paintDrawer(); }
      if (a === "qty") { S.pick.count = Math.max(1, Math.min(50, (parseInt($("#exmQty").value, 10) || 1) + parseInt(b.dataset.d, 10))); return paintDrawer(); }
      if (a === "generate") {
        var n = Math.max(1, Math.min(50, parseInt($("#exmQty").value, 10) || 1));
        S.pick.count = n; S.pick.header = $("#exmPickHeader").value;
        S.exam.sections.push(X.generate(S.pick.type, n, S.pick.header));
        S.drawer = false; markDirty(); renderBuilder();
        var secs = $$(".exm-sec", root); if (secs.length) secs[secs.length - 1].scrollIntoView({ behavior: "smooth", block: "start" });
        return toast("تم توليد " + n + " سؤال");
      }
      if (a === "addQ") { s = secOf(b.dataset.s); if (s) { s.questions.push(X.blankQuestion(s.type)); markDirty(); renderBuilder(); } return; }
      if (a === "delQ") {
        s = secOf(b.dataset.s); if (!s) return;
        s.questions = s.questions.filter(function (x) { return x.id !== b.dataset.q; });
        if (!s.questions.length) S.exam.sections = S.exam.sections.filter(function (x) { return x.id !== s.id; });
        markDirty(); return renderBuilder();
      }
      if (a === "delSec") {
        if (!armed(b, "تأكيد؟")) return;
        S.exam.sections = S.exam.sections.filter(function (x) { return x.id !== b.dataset.s; });
        markDirty(); return renderBuilder();
      }
    });

    root.addEventListener("keydown", function (ev) {
      if ((ev.key === "Enter" || ev.key === " ") && ev.target.matches && ev.target.matches('.exm-sr[data-act="review"]')) { ev.preventDefault(); ev.target.click(); }
    });

    root.addEventListener("input", function (ev) {
      var t = ev.target, d = t.dataset || {}, s, q;
      if (d.fl === "q") { S.q = t.value; return paintListBody(); }
      if (d.ef) {
        S.exam[d.ef] = d.ef === "durationMin" ? X.num(t.value, 0) : d.ef === "term" ? (t.value === "" ? null : Number(t.value)) : t.value;
        if (d.ef === "grade") { var tf = $("#exmTrackField"); if (tf) tf.hidden = String(t.value).indexOf("secondary") !== 0; if (String(t.value).indexOf("secondary") !== 0) S.exam.track = "all"; }
        if (S.view === "builder") markDirty();
        return;
      }
      if (d.sh) { s = secOf(d.sh); if (s) { s.header = t.value; markDirty(); } return; }
      if (d.q) {
        s = secOf(d.s); q = qOf(s, d.q); if (!q) return;
        if (d.o) q.options[d.o] = t.value;
        else if (d.f === "points") { q.points = t.value === "" ? "" : X.num(t.value, 0); updateTotal(); }
        else if (d.f) q[d.f] = t.value;
        return markDirty();
      }
      if (t.id === "exmQty") { S.pick.count = parseInt(t.value, 10) || 1; return; }
      if (t.id === "exmPickHeader") { S.pick.header = t.value; return; }
      if (d.sc !== undefined || t.id === "exmOutOf") return recalc(false);
      if (t.id === "exmFinal") return recalc(true);
    });

    root.addEventListener("change", function (ev) {
      var t = ev.target, d = t.dataset || {};
      if (d.stype) { var s = secOf(d.stype); if (s) { X.retype(s, t.value); if (!s.header || X.TYPES.some(function (x) { return x.header === s.header; })) s.header = X.typeOf(t.value).header; markDirty(); renderBuilder(); } return; }
    });
  }

  window.SNExamsAdmin = {
    setContext: function (c) { Object.keys(c || {}).forEach(function (k) { ctx[k] = c[k]; }); },
    open: open
  };
})();

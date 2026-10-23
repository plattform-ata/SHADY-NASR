/* ==========================================================================
   exams-student.js — وحدة الامتحانات للطالب (بتتحمّل في studenti.html بعد exams.js)
   - لوحة "الامتحانات" (الأيقونة الخامسة): جديد / بانتظار التصحيح / اتصحّح.
   - بانر أحمر بارز في الرئيسية + عدّاد على الأيقونة، بس لما يكون فيه امتحان منشور لصف الطالب ولسه ماتسلّمش.
   - حل الامتحان بمؤقّت + حفظ تلقائي للإجابات على الجهاز + تسليم مرة واحدة بس.
   - الدرجة بتتسجّل في سجل الدرجات (قسم "الامتحانات") لما الأدمن يصحّح (من exams-admin.js).
   ========================================================================== */
(function () {
  "use strict";
  var X = window.SNExams;
  if (!X) return;

  var $ = function (s, r) { return (r || document).querySelector(s); };
  var esc = X.esc;

  function session() { try { return JSON.parse(localStorage.getItem("shadynasr-current-user")); } catch (e) { return null; } }
  var me = session();
  if (!me || !me.id || me.role === "admin") return;

  var ICON_ALERT = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 4h6v3H9z"/><path d="M15 5h2a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h2"/><path d="M12 11v4M12 18h.01"/></svg>';

  var S = { exams: [], subs: {}, user: me, view: "list", curId: null, answers: {}, startedAt: 0, timer: 0, confirm: false, flash: "", flashBad: false, sending: false };
  var root, panel;

  /* ------------------------------------------------------------ مساعدات */
  function find(id) { return S.exams.filter(function (e) { return e.id === id; })[0]; }
  function cur() { return find(S.curId); }
  function pending() { return S.exams.filter(function (e) { return e.status === "published" && !S.subs[e.id]; }); }
  function draftKey(id) { return "shadynasr-exam-draft:" + me.id + ":" + id; }
  function loadDraft(id) { try { return JSON.parse(localStorage.getItem(draftKey(id))) || {}; } catch (e) { return {}; } }
  function saveDraft() {
    if (!S.curId) return;
    try { localStorage.setItem(draftKey(S.curId), JSON.stringify({ answers: S.answers, startedAt: S.startedAt })); } catch (e) { }
  }
  function clearDraft(id) { try { localStorage.removeItem(draftKey(id)); } catch (e) { } }
  function mmss(sec) { var m = Math.floor(sec / 60), s = sec % 60; return (m < 10 ? "0" : "") + m + ":" + (s < 10 ? "0" : "") + s; }

  /* ------------------------------------------------------------ تحميل */
  function refreshSubs() {
    return Promise.all(S.exams.map(function (e) {
      return Promise.resolve(SNAuth.fetchExamSubmission(e.id, me.id))
        .then(function (s) { S.subs[e.id] = s; })
        .catch(function () { });
    }));
  }

  function onExams(list) {
    S.exams = (list || []).map(X.normalizeExam)
      .filter(function (e) { return e && e.id && e.status !== "draft" && X.matches(e, S.user); })
      .sort(function (a, b) { return String(b.publishedAt || "").localeCompare(String(a.publishedAt || "")); });
    refreshSubs().then(function () {
      if (S.view !== "take") render();
      paintAlert();
    });
  }

  function boot() {
    var p = Promise.resolve(me.email && SNAuth.findUserByEmail ? SNAuth.findUserByEmail(me.email) : null).catch(function () { return null; });
    p.then(function (u) {
      if (u) S.user = { id: me.id, email: me.email, fullName: u.fullName || me.fullName, grade: u.grade || me.grade, track: u.track };
      SNAuth.watchExams(onExams);
    });
  }

  /* ------------------------------------------------------------ البانر الأحمر + العدّاد */
  function setDot(n) {
    var btn = $('.dash-tabbar [data-target="examhub"]');
    if (!btn) return;
    var d = $(".exm-dot", btn);
    if (!d) { d = document.createElement("span"); d.className = "exm-dot"; btn.appendChild(d); }
    d.textContent = n > 9 ? "9+" : String(n);
    d.hidden = !n;
  }
  function goExams() {
    var btn = $('.dash-tabbar [data-target="examhub"]') || $('.dash-nav__link[data-target="examhub"]');
    if (btn) btn.click();
  }
  function paintAlert() {
    var p = pending();
    var b = $("#examAlert");
    setDot(p.length);
    if (!p.length) { if (b) b.hidden = true; return; }
    if (!b) {
      var home = $('.dash-panel[data-panel="home"]');
      if (!home) return;
      b = document.createElement("button");
      b.type = "button"; b.id = "examAlert"; b.className = "exm-alert";
      b.setAttribute("role", "alert");
      b.innerHTML = '<span class="exm-alert__icon">' + ICON_ALERT + '</span>' +
        '<span class="exm-alert__text"><span class="exm-alert__label"></span><strong class="exm-alert__title"></strong></span>' +
        '<span class="exm-alert__go">ابدأ الآن</span>';
      b.addEventListener("click", goExams);
      var hello = $(".home-hello", home);
      if (hello) hello.insertAdjacentElement("afterend", b); else home.insertBefore(b, home.firstChild);
    }
    $(".exm-alert__label", b).textContent = p.length > 1 ? "عندك " + p.length + " امتحانات جديدة — لازم تخلّصها دلوقتي" : "امتحان جديد — لازم تحلّه دلوقتي";
    $(".exm-alert__title", b).textContent = p[0].title;
    b.hidden = false;
  }

  /* ------------------------------------------------------------ القايمة */
  function examCard(e, mode) {
    var sub = S.subs[e.id];
    var meta = '<div class="exm-meta">' +
      '<span class="exm-pill">' + X.countQuestions(e) + ' سؤال</span>' +
      '<span class="exm-pill">' + X.totalPoints(e) + ' درجة</span>' +
      (e.durationMin > 0 ? '<span class="exm-pill">' + e.durationMin + ' دقيقة</span>' : "") +
      "</div>";
    var act = "";
    if (mode === "new") {
      act = '<button type="button" class="exm-btn exm-btn--red" data-act="start" data-id="' + esc(e.id) + '">ابدأ الامتحان</button>';
    } else if (mode === "wait") {
      act = '<span class="exm-pill exm-pill--warn">اتسلّم · بانتظار التصحيح</span>';
    } else if (mode === "done") {
      var pct = sub.outOf > 0 ? Math.round((sub.finalScore / sub.outOf) * 100) : 0;
      act = '<span class="exm-pill exm-pill--ok">' + esc(sub.finalScore) + " / " + esc(sub.outOf) + " · " + pct + '%</span>' +
        '<button type="button" class="exm-btn" data-act="result" data-id="' + esc(e.id) + '">التفاصيل</button>';
    } else {
      act = '<span class="exm-pill">انتهى — لم يُسلَّم</span>';
    }
    return '<article class="exm-card' + (mode === "new" ? " exm-card--new" : "") + '">' +
      '<div class="exm-row"><h3 class="exm-title">' + esc(e.title) + "</h3></div>" + meta +
      (e.instructions && mode === "new" ? '<p class="exm-sub">' + esc(e.instructions) + "</p>" : "") +
      '<div class="exm-row">' + act + "</div></article>";
  }

  function renderList() {
    var pend = pending();
    var wait = S.exams.filter(function (e) { return S.subs[e.id] && S.subs[e.id].status !== "graded"; });
    var done = S.exams.filter(function (e) { return S.subs[e.id] && S.subs[e.id].status === "graded"; });
    var missed = S.exams.filter(function (e) { return e.status === "closed" && !S.subs[e.id]; });
    var html = '<div class="exm-head"><h2>الامتحانات</h2></div>';
    if (S.flash) html += '<div class="exm-note" role="status">' + esc(S.flash) + "</div>";
    if (!S.exams.length) html += '<p class="exm-empty">مفيش امتحانات لصفك دلوقتي.</p>';
    if (pend.length) html += '<h3 class="exm-sec__head">امتحانات جديدة</h3>' + pend.map(function (e) { return examCard(e, "new"); }).join("");
    if (wait.length) html += '<h3 class="exm-sec__head">بانتظار التصحيح</h3>' + wait.map(function (e) { return examCard(e, "wait"); }).join("");
    if (done.length) html += '<h3 class="exm-sec__head">اتصحّحت</h3>' + done.map(function (e) { return examCard(e, "done"); }).join("");
    if (missed.length) html += '<h3 class="exm-sec__head">امتحانات مغلقة</h3>' + missed.map(function (e) { return examCard(e, "missed"); }).join("");
    root.innerHTML = '<div class="exm-root">' + html + "</div>";
  }

  /* ------------------------------------------------------------ حل الامتحان */
  function answeredCount(e) {
    return X.flatten(e).filter(function (r) { return String(S.answers[r.q.id] || "").trim() !== ""; }).length;
  }

  function questionHtml(r) {
    var q = r.q, a = S.answers[q.id] || "", body = "";
    if (r.type === "mcq") {
      body = X.LETTERS.map(function (L) {
        return '<label class="exm-opt"><input type="radio" name="q_' + esc(q.id) + '" data-qa="' + esc(q.id) + '" value="' + L + '"' + (a === L ? " checked" : "") + ' /><b>' + L + '</b><span dir="auto">' + esc((q.options || {})[L]) + "</span></label>";
      }).join("");
    } else {
      body = '<textarea class="exm-textarea" dir="auto" data-qa="' + esc(q.id) + '" placeholder="اكتب إجابتك هنا…">' + esc(a) + "</textarea>";
    }
    return '<article class="exm-card exm-q"><div class="exm-row"><span class="exm-q__no">' + r.no + '</span><span class="exm-q__pts">' + esc(q.points) + " درجة</span></div>" +
      '<p class="exm-q__text" dir="auto">' + esc(q.text) + "</p>" + body + "</article>";
  }

  function renderTake() {
    var e = cur();
    if (!e) { S.view = "list"; return render(); }
    var lastSec = null, html = "";
    X.flatten(e).forEach(function (r) {
      if (r.section !== lastSec) { lastSec = r.section; html += '<h3 class="exm-sec__head" dir="auto">' + esc(r.header) + "</h3>"; }
      html += questionHtml(r);
    });
    var total = X.countQuestions(e);
    var foot = S.confirm
      ? '<div class="exm-card"><p class="exm-title">متأكد إنك عايز تسلّم؟ مش هتقدر تعدّل بعد كده.</p>' +
        (answeredCount(e) < total ? '<p class="exm-sub">لسه فيه أسئلة من غير إجابة.</p>' : "") +
        '<div class="exm-confirm"><button type="button" class="exm-btn exm-btn--red" data-act="doSubmit"' + (S.sending ? " disabled" : "") + '>تأكيد التسليم</button><button type="button" class="exm-btn" data-act="cancelSubmit">رجوع للأسئلة</button></div></div>'
      : '<button type="button" class="exm-btn exm-btn--accent" data-act="askSubmit">تسليم الامتحان</button>';
    root.innerHTML = '<div class="exm-root">' +
      '<div class="exm-taking__bar"><div><strong>' + esc(e.title) + '</strong><div class="exm-sub">أجبت على <span id="exmAnswered">' + answeredCount(e) + "</span> من " + total + "</div></div>" +
      (e.durationMin > 0 ? '<span class="exm-timer" id="exmTimer" aria-live="off">--:--</span>' : "") + "</div>" +
      (S.flash ? '<div class="exm-note" role="alert">' + esc(S.flash) + "</div>" : "") +
      html + foot +
      '<button type="button" class="exm-btn" data-act="leave">حفظ والرجوع للقائمة</button></div>';
  }

  function startTimer() {
    clearInterval(S.timer);
    var e = cur();
    if (!e || !(e.durationMin > 0)) return;
    var end = S.startedAt + e.durationMin * 60000;
    function tick() {
      var left = Math.max(0, Math.round((end - Date.now()) / 1000));
      var el = $("#exmTimer");
      if (el) { el.textContent = mmss(left); el.classList.toggle("is-low", left <= 60); }
      if (left <= 0) { clearInterval(S.timer); submit(true); }
    }
    tick();
    S.timer = setInterval(tick, 1000);
  }

  function start(id) {
    var e = find(id);
    if (!e || e.status !== "published" || S.subs[id]) return;
    var d = loadDraft(id);
    S.curId = id; S.answers = d.answers || {}; S.startedAt = d.startedAt || Date.now();
    S.confirm = false; S.flash = ""; S.view = "take";
    saveDraft();
    render();
    startTimer();
    window.scrollTo(0, 0);
  }

  function submit(auto) {
    var e = cur();
    if (!e || S.sending) return;
    S.sending = true;
    clearInterval(S.timer);
    var answers = {};
    X.flatten(e).forEach(function (r) { answers[r.q.id] = String(S.answers[r.q.id] == null ? "" : S.answers[r.q.id]).trim(); });
    var data = {
      examId: e.id, examTitle: e.title, studentId: me.id,
      studentName: S.user.fullName || me.fullName || "", grade: S.user.grade || "", track: S.user.track || "",
      answers: answers, submittedAt: new Date().toISOString(), status: "submitted"
    };
    Promise.resolve(SNAuth.saveExamSubmission(e.id, me.id, data)).then(function (ok) {
      S.sending = false;
      clearDraft(e.id);
      if (ok) S.subs[e.id] = data;
      S.flash = ok
        ? (auto ? "انتهى الوقت وتم تسليم إجاباتك تلقائيًا. هتظهر درجتك بعد التصحيح." : "تم تسليم الامتحان بنجاح. هتظهر درجتك بعد تصحيح الأستاذ.")
        : "الامتحان ده اتسلّم قبل كده.";
      S.view = "list"; S.curId = null; S.confirm = false;
      render(); paintAlert(); window.scrollTo(0, 0);
      if (!ok) refreshSubs().then(function () { render(); paintAlert(); });
    }).catch(function () {
      S.sending = false;
      S.flash = "تعذّر التسليم — اتأكد من النت وجرّب تاني (إجاباتك محفوظة).";
      render();
      startTimer();
    });
  }

  /* ------------------------------------------------------------ النتيجة */
  function renderResult() {
    var e = cur(), sub = e && S.subs[e.id];
    if (!e || !sub) { S.view = "list"; return render(); }
    var pct = sub.outOf > 0 ? Math.round((sub.finalScore / sub.outOf) * 100) : 0;
    var lv = X.levelFor(pct), scores = sub.scores || {}, ans = sub.answers || {};
    var rows = X.flatten(e).map(function (r) {
      var got = scores[r.q.id];
      return '<article class="exm-card"><div class="exm-row"><span class="exm-q__no">' + r.no + '</span><span class="exm-pill">' + (got == null ? 0 : esc(got)) + " / " + esc(r.q.points) + "</span></div>" +
        '<p class="exm-q__text" dir="auto">' + esc(r.q.text) + '</p><p class="exm-ans" dir="auto">' + (esc(ans[r.q.id]) || "— من غير إجابة —") + "</p></article>";
    }).join("");
    root.innerHTML = '<div class="exm-root"><button type="button" class="exm-btn" data-act="back">رجوع</button>' +
      '<div class="exm-card exm-result"><h3 class="exm-title">' + esc(e.title) + '</h3><div class="exm-result__score">' + esc(sub.finalScore) + " / " + esc(sub.outOf) +
      '</div><span class="exm-pill exm-pill--ok">' + pct + "% · " + lv.label + "</span>" +
      (sub.feedback ? '<p class="exm-sub">ملاحظات الأستاذ: ' + esc(sub.feedback) + "</p>" : "") +
      '<div style="margin-top:12px"><button type="button" class="exm-btn exm-btn--accent" data-act="resultPdf">فتح النتيجة كملف PDF</button></div></div>' + rows + "</div>";
  }

  function openResultPdf() {
    var e = cur(), sub = e && S.subs[e.id];
    if (!e || !sub || !window.SNPdf) return;
    var ex = X.normalizeExam(X.clean(e));
    window.SNPdf.openHtml(X.sheetHtml(ex, sub, { name: me.fullName || sub.studentName || "", gradeLabel: X.GRADE_NAMES[me.grade || sub.grade] || "" }),
      { title: e.title, filename: "result-" + e.title + ".pdf" });
  }

  function render() {
    if (!root) return;
    if (S.view === "take") return renderTake();
    if (S.view === "result") return renderResult();
    renderList();
  }

  /* ------------------------------------------------------------ الأحداث */
  function bind() {
    root.addEventListener("click", function (ev) {
      var b = ev.target.closest("[data-act]");
      if (!b) return;
      var act = b.dataset.act;
      if (act === "start") start(b.dataset.id);
      else if (act === "result") { S.curId = b.dataset.id; S.view = "result"; render(); window.scrollTo(0, 0); }
      else if (act === "resultPdf") openResultPdf();
      else if (act === "back") { S.view = "list"; S.curId = null; render(); }
      else if (act === "askSubmit") { S.confirm = true; S.flash = ""; render(); window.scrollTo(0, document.body.scrollHeight); }
      else if (act === "cancelSubmit") { S.confirm = false; render(); }
      else if (act === "doSubmit") submit(false);
      else if (act === "leave") { clearInterval(S.timer); saveDraft(); S.view = "list"; S.curId = null; S.flash = ""; render(); }
    });
    var onAns = function (ev) {
      var t = ev.target;
      if (!t.dataset || !t.dataset.qa) return;
      S.answers[t.dataset.qa] = t.value;
      saveDraft();
      var e = cur(), el = $("#exmAnswered");
      if (e && el) el.textContent = answeredCount(e);
    };
    root.addEventListener("input", onAns);
    root.addEventListener("change", onAns);

    /* كل ما الطالب يفتح اللوحة نحدّث حالة تسليماته (عشان تظهر الدرجة بعد التصحيح) */
    var was = panel.classList.contains("is-active");
    new MutationObserver(function () {
      var on = panel.classList.contains("is-active");
      if (on && !was && S.view !== "take") refreshSubs().then(function () { render(); paintAlert(); });
      was = on;
    }).observe(panel, { attributes: true, attributeFilter: ["class"] });
  }

  function init() {
    root = $("#exmStudentRoot");
    panel = $('.dash-panel[data-panel="examhub"]');
    if (!root || !panel) return;
    bind();
    render();
    var tries = 0;
    (function wait() {
      if (window.SNAuth && SNAuth.watchExams) return boot();
      if (++tries < 80) setTimeout(wait, 125);
    })();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();

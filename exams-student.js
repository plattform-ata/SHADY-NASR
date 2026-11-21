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

  /* رابط/QR الامتحان: studenti.html?exam=CODE — بنحفظ الرمز فورًا (حتى لو الطالب لسه هيسجّل دخول) وبنشيله من الرابط */
  var LINK_KEY = "shadynasr-exam-link";
  (function captureLink() {
    try {
      var m = location.search.match(/[?&]exam=([A-Za-z0-9-]+)/i);
      if (!m) return;
      localStorage.setItem(LINK_KEY, X.normCode(m[1]));
      var q = location.search.replace(/([?&])exam=[^&]*&?/i, "$1").replace(/[?&]$/, "");
      history.replaceState(null, "", location.pathname + q + location.hash);
    } catch (e) { }
  })();

  function session() { try { return JSON.parse(localStorage.getItem("shadynasr-current-user")); } catch (e) { return null; } }
  var me = session();
  if (!me || !me.id || me.role === "admin") return;

  var ICON_ALERT = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 4h6v3H9z"/><path d="M15 5h2a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h2"/><path d="M12 11v4M12 18h.01"/></svg>';

  var S = { all: [], unlocks: {}, exams: [], subs: {}, user: me, view: "list", curId: null, answers: {}, startedAt: 0, timer: 0, confirm: false, flash: "", flashBad: false, sending: false, open: {} };
  var root, panel, joinDlg = null;

  /* زرار الرجوع الموحّد: سهم جوه دايرة + الاسم */
  function backBtn(act, label) {
    return '<button type="button" class="exm-back" data-act="' + act + '"><span class="exm-back__ico">' + ICON_ARROW + "</span><span>" + esc(label) + "</span></button>";
  }

  /* نظام الرجوع (زرار الموبايل / المتصفح): فتح تحذير أو نتيجة بيسجّل خطوة، والرجوع بيرجّعك لقايمة الامتحانات.
     وأثناء الحل الرجوع ممنوع (الخروج = تسليم تلقائي). */
  var level = 0;   // 0 = القايمة، 1 = جوه شاشة فرعية (تحذير / حل / نتيجة)
  function pushLevel() {
    if (level) return;
    level = 1;
    try { var b = Object.assign({}, history.state || {}); b.snExmS = 1; history.pushState(b, ""); } catch (e) { }
  }
  function toList() { S.view = "list"; S.curId = null; S.confirm = false; render(); window.scrollTo(0, 0); }
  function goBack() {
    if (level && history.state && history.state.snExmS === 1) { history.back(); return; }
    level = 0; toList();
  }
  function onPop(ev) {
    var target = (ev.state && ev.state.snExmS) || 0;
    setTimeout(function () {
      if (!panel || !panel.classList.contains("is-active")) return;
      if (S.view === "take") {
        if (target < level) {
          try { var b = Object.assign({}, history.state || {}); b.snExmS = 1; history.pushState(b, ""); } catch (e) { }
          var n = $("#exmBackNote");
          if (n) { n.hidden = false; clearTimeout(S.noteT); S.noteT = setTimeout(function () { n.hidden = true; }, 3500); }
        }
        return;
      }
      if (target < level) { level = 0; toList(); }
      else if (target > level) { try { history.back(); } catch (e) { } }   // خطوة قديمة فاضية: نتخطّاها
    }, 0);
  }

  var ICON_QR = '<svg class="exm-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><path d="M14 14h3v3h-3zM20 14v.01M14 20h3M20 17v4"/></svg>';
  var ICON_CAM = '<svg class="exm-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 8h3l1.6-2.4h6.8L17 8h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z"/><circle cx="12" cy="13" r="3.6"/></svg>';
  var ICON_IMG = '<svg class="exm-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="3"/><circle cx="9" cy="10" r="1.6"/><path d="m4 18 5-5 4 4 3-3 4 4"/></svg>';
  var ICON_CHEV = '<svg class="exm-ico exm-xc__chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>';
  var ICON_ARROW = '<svg class="exm-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>';
  var ICON_X = '<svg class="exm-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>';

  /* ------------------------------------------------------------ مساعدات */
  /* الامتحان الخاص مش بيظهر غير لو الطالب فتحه بالرمز/QR (أو سلّمه قبل كده) */
  function isVisible(e) { return !X.isPrivate(e) || !!S.unlocks[e.id] || !!S.subs[e.id]; }
  function applyVisible() { S.exams = S.all.filter(isVisible); }
  function unlockKey() { return "shadynasr-exam-unlocks:" + me.id; }
  function localUnlocks() { try { return JSON.parse(localStorage.getItem(unlockKey())) || {}; } catch (e) { return {}; } }
  function saveLocalUnlock(id) { try { var m = localUnlocks(); m[id] = new Date().toISOString(); localStorage.setItem(unlockKey(), JSON.stringify(m)); } catch (e) { } }
  function loadUnlocks() {
    return Promise.resolve(SNAuth.fetchExamUnlocks ? SNAuth.fetchExamUnlocks(me.id) : {}).catch(function () { return {}; })
      .then(function (m) { S.unlocks = Object.assign({}, localUnlocks(), m || {}); });
  }
  function find(id) { return S.exams.filter(function (e) { return e.id === id; })[0]; }
  function cur() { return find(S.curId); }
  function pending() { return S.exams.filter(function (e) { return e.status === "published" && !S.subs[e.id]; }); }
  /* الإشعارات (البانر الأحمر + عدّاد الأيقونة) للامتحانات العامة بس — الامتحان الخاص مابيطلعش فيها حتى لو الطالب فتحه بالرمز */
  function alertable() { return pending().filter(function (e) { return !X.isPrivate(e); }); }
  function draftKey(id) { return "shadynasr-exam-draft:" + me.id + ":" + id; }
  function loadDraft(id) { try { return JSON.parse(localStorage.getItem(draftKey(id))) || {}; } catch (e) { return {}; } }
  function saveDraft() {
    if (!S.curId) return;
    try { localStorage.setItem(draftKey(S.curId), JSON.stringify({ answers: S.answers, startedAt: S.startedAt })); } catch (e) { }
  }
  function clearDraft(id) { try { localStorage.removeItem(draftKey(id)); } catch (e) { } }
  /* علامة "خرج من المنصة أثناء الامتحان": بتفضل محفوظة لحد ما التسليم ينجح (حتى لو التطبيق اتقفل أو النت وقع) */
  function leftKey(id) { return "shadynasr-exam-left:" + me.id + ":" + id; }
  function markLeft(id) { try { localStorage.setItem(leftKey(id), String(Date.now())); } catch (e) { } }
  function wasLeft(id) { try { return !!localStorage.getItem(leftKey(id)); } catch (e) { return false; } }
  function clearLeft(id) { try { localStorage.removeItem(leftKey(id)); } catch (e) { } }
  function mmss(sec) { var m = Math.floor(sec / 60), s = sec % 60; return (m < 10 ? "0" : "") + m + ":" + (s < 10 ? "0" : "") + s; }

  /* ------------------------------------------------------------ تحميل */
  function refreshSubs() {
    return Promise.all(S.all.map(function (e) {
      return Promise.resolve(SNAuth.fetchExamSubmission(e.id, me.id))
        .then(function (s) { S.subs[e.id] = s; })
        .catch(function () { });
    }));
  }

  /* ------------------------------------------------------------ التصحيح التلقائي (Shady AI) */
  var GRADER_URL = "https://shady-grader.nasr-platform.workers.dev";   /* ← حط هنا رابط الـ Worker بتاع التصحيح (grader-worker.js). فاضي = التصحيح بإيد الأستاذ زي الأول */
  var gradeAsked = {}, gradeTries = {};

  function requestGrade(examId) {
    if (!GRADER_URL || !examId || gradeAsked[examId]) return Promise.resolve();
    gradeAsked[examId] = 1;
    gradeTries[examId] = (gradeTries[examId] || 0) + 1;
    return fetch(GRADER_URL, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "grade", examId: examId, studentId: me.id }) })
      .then(function (r) { return r.json().catch(function () { return {}; }); })
      .then(function (res) {
        if (res && res.status === "grading" && gradeTries[examId] < 6) { setTimeout(function () { gradeAsked[examId] = 0; requestGrade(examId); }, 8000); }
        else if (!(res && res.ok)) gradeAsked[examId] = gradeTries[examId] < 3 ? 0 : 1;   // فشل: نحاول تاني بعدين (لحد 3 مرات)، وبعدها الأستاذ يصحّح
        return refreshSubs();
      })
      .then(function () {
        var sub = S.subs[examId];
        applyVisible();
        if (sub && sub.status === "graded" && S.view !== "take") {
          S.flash = "اتصحّح امتحانك! درجتك: " + sub.finalScore + " / " + sub.outOf;
          render(); paintAlert();
        }
      })
      .catch(function () { gradeAsked[examId] = 0; });
  }
  /* أي تسليم لسه متصححش → نطلب تصحيحه (آمن لو اتطلب أكتر من مرة: الـ Worker بيصحّح مرة واحدة بس) */
  function autoGradePending() {
    if (!GRADER_URL) return;
    S.all.forEach(function (e) { var sub = S.subs[e.id]; if (sub && sub.status !== "graded") requestGrade(e.id); });
  }

  function onExams(list) {
    S.all = (list || []).map(X.normalizeExam)
      .filter(function (e) { return e && e.id && e.status !== "draft" && X.matches(e, S.user); })
      .sort(function (a, b) { return String(b.publishedAt || "").localeCompare(String(a.publishedAt || "")); });
    Promise.all([loadUnlocks(), refreshSubs()]).then(function () {
      applyVisible();
      checkLeft();
      if (S.view !== "take") render();
      paintAlert();
      processLink();
      autoGradePending();
    });
  }

  /* أي امتحان الطالب خرج منه ومااتسلّمش → يتسلّم تلقائيًا بالإجابات المحفوظة */
  function checkLeft() {
    if (S.sending || S.view === "take") return;
    var hit = null;
    S.exams.forEach(function (e) {
      if (S.subs[e.id]) { clearLeft(e.id); return; }
      if (!hit && wasLeft(e.id)) hit = e;
    });
    if (!hit) return;
    var d = loadDraft(hit.id);
    S.curId = hit.id; S.answers = d.answers || {}; S.startedAt = d.startedAt || Date.now();
    submit("left");
  }

  function onLeave() {
    if (S.view !== "take" || !S.curId || S.sending) return;
    markLeft(S.curId);
    saveDraft();
    submit("left");
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
    var p = alertable();
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
      act = '<span class="exm-pill exm-pill--warn">' + (GRADER_URL ? "اتسلّم · بيتصحّح دلوقتي…" : "اتسلّم · بانتظار التصحيح") + "</span>";
    } else if (mode === "done") {
      var pct = sub.outOf > 0 ? Math.round((sub.finalScore / sub.outOf) * 100) : 0;
      act = '<span class="exm-pill exm-pill--ok">' + esc(sub.finalScore) + " / " + esc(sub.outOf) + " · " + pct + '%</span>' +
        '<button type="button" class="exm-btn" data-act="result" data-id="' + esc(e.id) + '">التفاصيل</button>';
    } else {
      act = '<span class="exm-pill">انتهى — لم يُسلَّم</span>';
    }
    var dv = e.publishedAt || e.createdAt, date = dv ? X.fmtDate(dv) : "", isOpen = !!S.open[e.id], id = esc(e.id);
    return '<article class="exm-card exm-xc' + (mode === "new" ? " exm-card--new" : "") + (isOpen ? " is-open" : "") + '">' +
      '<button type="button" class="exm-xc__head" data-act="toggle" data-id="' + id + '" aria-expanded="' + isOpen + '" aria-controls="exmc-' + id + '">' +
      '<span class="exm-xc__text"><strong class="exm-title"><bdi>' + esc(e.title) + "</bdi></strong>" + (date ? '<small class="exm-xc__date">' + esc(date) + "</small>" : "") + "</span>" + ICON_CHEV + "</button>" +
      '<div class="exm-xc__panel" id="exmc-' + id + '"><div class="exm-xc__inner"><div class="exm-xc__details">' + meta +
      (e.instructions ? '<p class="exm-sub">' + esc(e.instructions) + "</p>" : "") +
      '<div class="exm-row">' + act + "</div></div></div></div></article>";
  }

  /* كارت ظاهر في صفحة الامتحانات: كتابة الرمز بإيدك، أو مسح QR بالكاميرا، أو صورة فيها QR */
  function joinCardHtml() {
    return '<section class="exm-joincard" aria-label="فتح امتحان بالرمز">' +
      '<div class="exm-joincard__head"><span class="exm-joincard__ico">' + ICON_QR + '</span><div><strong>عندك رمز أو QR لامتحان؟</strong><small>اكتب الرمز بإيدك أو امسح الـ QR بالكاميرا</small></div></div>' +
      '<div class="exm-joincard__row"><input class="exm-input exm-input--code" id="exmJoinInline" dir="ltr" inputmode="text" autocapitalize="characters" autocomplete="off" autocorrect="off" spellcheck="false" maxlength="8" placeholder="ABC-123" value="' + esc(S.joinDraft || "") + '" aria-label="رمز الامتحان" />' +
      '<button type="button" class="exm-btn exm-btn--accent" data-act="joinGo">فتح</button></div>' +
      '<p class="exm-join__msg" id="exmJoinInlineMsg" role="alert" hidden></p>' +
      '<div class="exm-joincard__or"><span>أو</span></div>' +
      '<div class="exm-joincard__acts"><button type="button" class="exm-btn" data-act="joinScan">' + ICON_CAM + " مسح QR بالكاميرا</button>" +
      '<button type="button" class="exm-btn" data-act="joinPick">' + ICON_IMG + " صورة فيها QR</button></div></section>";
  }
  function inlineSay(t) { var m = $("#exmJoinInlineMsg"); if (m) { m.textContent = t || ""; m.hidden = !t; } }
  function joinInline() {
    var inp = $("#exmJoinInline"), res = joinByCode(inp ? inp.value : S.joinDraft);
    if (!res.ok) return inlineSay(res.msg);
    S.joinDraft = ""; showJoined(res);
  }

  function renderList() {
    var pend = pending();
    var wait = S.exams.filter(function (e) { return S.subs[e.id] && S.subs[e.id].status !== "graded"; });
    var done = S.exams.filter(function (e) { return S.subs[e.id] && S.subs[e.id].status === "graded"; });
    var missed = S.exams.filter(function (e) { return e.status === "closed" && !S.subs[e.id]; });
    var html = '<div class="exm-head"><h2>الامتحانات</h2></div>' + joinCardHtml();
    if (S.flash) html += '<div class="exm-note" role="status">' + esc(S.flash) + "</div>";
    if (!S.exams.length) html += '<div class="exm-empty-card"><p class="exm-empty">مفيش امتحانات لصفك دلوقتي.</p><p class="exm-sub">لو الأستاذ إدّاك رمز امتحان أو QR، اكتب الرمز في الخانة اللي فوق أو امسح الـ QR عشان يتفتحلك.</p></div>';
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
      '<div class="exm-note" role="note">ممنوع الخروج من المنصة أثناء الامتحان — لو خرجت هيتسلّم تلقائيًا.</div>' +
      '<div class="exm-note" id="exmBackNote" role="alert" hidden>ممنوع الرجوع أثناء الامتحان — سلّم الامتحان الأول وبعدها تقدر ترجع.</div>' +
      (S.flash ? '<div class="exm-note" role="alert">' + esc(S.flash) + "</div>" : "") +
      html + foot + "</div>";
  }

  function renderWarn() {
    var e = cur();
    if (!e) { S.view = "list"; return render(); }
    var items = [
      ["الخروج من المنصة = تسليم فوري", "لو فتحت تطبيق تاني، أو رجعت للشاشة الرئيسية، أو غيّرت التاب، أو قفلت الشاشة، الامتحان بيتسلّم فورًا بالإجابات اللي كتبتها لحد وقتها."],
      ["التسليم نهائي", "بعد التسليم مش هتقدر ترجع تكمّل أو تعيد الامتحان."],
      ["الوقت شغّال طول الامتحان", "العدّاد مش بيقف حتى لو خرجت."],
      ["اتأكد من النت", "اتأكد إن النت شغّال وإن مفيش حاجة هتقاطعك قبل ما تبدأ."]
    ];
    root.innerHTML = '<div class="exm-root">' + backBtn("cancelStart", "رجوع") + '<div class="exm-card exm-warn2" role="alertdialog" aria-labelledby="exmWarnT">' +
      '<div class="exm-warn2__hero"><span class="exm-warn2__ico">' + ICON_ALERT + '</span><div><h3 class="exm-title" id="exmWarnT">قبل ما تبدأ الامتحان</h3><p class="exm-sub"><strong><bdi>' + esc(e.title) + "</bdi></strong></p></div></div>" +
      '<ol class="exm-warn2__list">' + items.map(function (it, i) {
        return '<li><span class="exm-warn2__n">' + (i + 1) + '</span><div><strong>' + it[0] + "</strong><p>" + it[1] + "</p></div></li>";
      }).join("") + "</ol>" +
      '<button type="button" class="exm-btn exm-btn--red exm-warn2__go" data-act="confirmStart">فاهم، ابدأ الامتحان</button></div></div>';
  }

  function warn(id) {
    var e = find(id);
    if (!e || e.status !== "published" || S.subs[id]) return;
    pushLevel();
    S.curId = id; S.view = "warn"; S.flash = "";
    render();
    window.scrollTo(0, 0);
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
      clearLeft(e.id);
      if (ok) { S.subs[e.id] = data; requestGrade(e.id); }
      var later = GRADER_URL ? "بيتصحّح دلوقتي، وهتظهر درجتك خلال لحظات." : "هتظهر درجتك بعد التصحيح.";
      S.flash = ok
        ? (auto === "left" ? "الامتحان اتسلّم تلقائيًا لأنك خرجت من المنصة أثناء الحل. " + later
          : auto ? "انتهى الوقت وتم تسليم إجاباتك تلقائيًا. " + later : "تم تسليم الامتحان بنجاح. " + later)
        : "الامتحان ده اتسلّم قبل كده.";
      level = 0;
      S.view = "list"; S.curId = null; S.confirm = false;
      render(); paintAlert(); window.scrollTo(0, 0);
      if (!ok) refreshSubs().then(function () { applyVisible(); render(); paintAlert(); });
      setTimeout(checkLeft, 0);
    }).catch(function () {
      S.sending = false;
      if (auto === "left") {
        level = 0;
        S.view = "list"; S.curId = null; S.confirm = false;
        S.flash = "خرجت من المنصة أثناء الامتحان — هيتسلّم تلقائيًا أول ما النت يرجع.";
        render();
        return;
      }
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
        '<p class="exm-q__text" dir="auto">' + esc(r.q.text) + '</p><p class="exm-ans" dir="auto">' + (esc(ans[r.q.id]) || "— من غير إجابة —") + "</p>" +
        (sub.aiNotes && sub.aiNotes[r.q.id] ? '<p class="exm-sub" dir="auto">ملاحظة: ' + esc(sub.aiNotes[r.q.id]) + "</p>" : "") + "</article>";
    }).join("");
    root.innerHTML = '<div class="exm-root">' + backBtn("back", "رجوع") + '' +
      '<div class="exm-card exm-result"><h3 class="exm-title">' + esc(e.title) + '</h3><div class="exm-result__score">' + esc(sub.finalScore) + " / " + esc(sub.outOf) +
      '</div><span class="exm-pill exm-pill--ok">' + pct + "% · " + lv.label + "</span>" +
      (sub.feedback ? '<p class="exm-sub">' + (sub.gradedBy === "ai" ? "تقييم Shady AI: " : "ملاحظات الأستاذ: ") + esc(sub.feedback) + "</p>" : "") +
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
    if (S.view === "warn") return renderWarn();
    if (S.view === "result") return renderResult();
    renderList();
  }


  /* ------------------------------------------------------------ فتح امتحان بالرمز / QR */
  function joinByCode(raw) {
    var code = X.codeFromText(raw);
    if (code.length < 4) return { ok: false, msg: "اكتب الرمز كامل الأول." };
    var e = S.all.filter(function (x) { return X.normCode(x.code) === code; })[0];
    if (!e) return { ok: false, msg: "الرمز ده مش مظبوط، أو الامتحان مش متاح لصفك." };
    if (S.subs[e.id]) return { ok: true, id: e.id, msg: "انت سلّمت الامتحان ده قبل كده — هتلاقيه في القايمة." };
    if (e.status === "closed") return { ok: false, msg: "الامتحان ده اتقفل ومبقاش متاح." };
    if (S.unlocks[e.id] || !X.isPrivate(e)) return { ok: true, id: e.id, msg: "الامتحان ده ظاهر عندك بالفعل: " + e.title };
    S.unlocks[e.id] = new Date().toISOString();
    saveLocalUnlock(e.id);
    Promise.resolve(SNAuth.unlockExam ? SNAuth.unlockExam(me.id, e.id) : false).catch(function () { });
    applyVisible();
    return { ok: true, id: e.id, msg: "تم فتح الامتحان: " + e.title };
  }
  function showJoined(res) {
    S.flash = res.msg; S.view = "list"; S.curId = null;
    render(); paintAlert();
    goExams();
    setTimeout(function () { window.scrollTo(0, 0); }, 50);
  }
  /* رابط/QR اتفتح بيه الموقع: نفتح الامتحان تلقائيًا */
  function processLink() {
    var code = ""; try { code = localStorage.getItem(LINK_KEY) || ""; } catch (e) { }
    if (!code || S.view === "take") return;
    try { localStorage.removeItem(LINK_KEY); } catch (e2) { }
    var res = joinByCode(code);
    showJoined(res.ok ? res : { msg: res.msg });
  }

  function decodeFrom(src, det) {
    if (det) return det.detect(src).then(function (c) { return c && c[0] ? c[0].rawValue : null; }).catch(function () { return null; });
    return Promise.resolve().then(function () {
      var w = src.videoWidth || src.naturalWidth || src.width, h = src.videoHeight || src.naturalHeight || src.height;
      if (!w || !h) return null;
      var k = Math.min(1, 900 / Math.max(w, h)), cv = document.createElement("canvas");
      cv.width = Math.round(w * k); cv.height = Math.round(h * k);
      var g = cv.getContext("2d", { willReadFrequently: true }); g.drawImage(src, 0, 0, cv.width, cv.height);
      var d = g.getImageData(0, 0, cv.width, cv.height), r = window.jsQR && window.jsQR(d.data, d.width, d.height);
      return r ? r.data : null;
    });
  }
  function getDetector() {
    try { if ("BarcodeDetector" in window) return new window.BarcodeDetector({ formats: ["qr_code"] }); } catch (e) { }
    return null;
  }
  function withDecoder() {
    var det = getDetector();
    if (det) return Promise.resolve(det);
    return X.loadScript("exams-qr-scan.js?v=1").then(function () { return null; });
  }

  /* نافذة فتح الامتحان بالرمز — 3 أوضاع منفصلة:
     code: خانة كتابة الرمز (الكيبورد بيظهر هنا بس، والنافذة بتتوسّط في المساحة الظاهرة فوق الكيبورد)
     scan: الكاميرا بس — من غير خانة كتابة ومن غير كيبورد
     pick: اختيار صورة من المعرض — من غير خانة كتابة ومن غير كيبورد */
  function openJoin(mode) {
    if (joinDlg || S.view === "take") return;
    mode = mode === "scan" || mode === "pick" ? mode : "code";
    var html = '<div class="exm-modal__head"><h3>فتح امتحان بالرمز</h3><button type="button" class="exm-iconbtn" data-close="1" aria-label="إغلاق">' + ICON_X + "</button></div>" +
      '<div id="exmJoinBody"></div><input type="file" accept="image/*" id="exmJoinFile" hidden />';
    var stream = null, raf = 0, scanning = false, cur = "", dlg = null;

    function stopScan() {
      scanning = false; cancelAnimationFrame(raf);
      if (stream) { stream.getTracks().forEach(function (t) { t.stop(); }); stream = null; }
      var v = dlg && $("#exmScanVideo", dlg.el); if (v) v.srcObject = null;
    }

    /* وضع الكتابة: النافذة في نص المساحة الظاهرة (فوق الكيبورد) */
    function place() {
      if (!dlg || cur !== "code") return;
      var vv = window.visualViewport, sh = dlg.el, st = sh.style;
      var H = vv ? vv.height : window.innerHeight, top0 = vv ? vv.offsetTop : 0;
      st.position = "fixed"; st.left = "50%"; st.right = "auto"; st.bottom = "auto"; st.transform = "translateX(-50%)"; st.animation = "none";
      st.width = "min(94vw, 460px)"; st.maxHeight = Math.max(220, H - 24) + "px"; st.overflowY = "auto"; st.borderRadius = "20px";
      st.top = Math.round(top0 + Math.max(12, (H - sh.offsetHeight) / 2)) + "px";
    }
    function unplace() {
      if (!dlg) return;
      var st = dlg.el.style;
      ["position", "left", "right", "bottom", "transform", "animation", "width", "maxHeight", "overflowY", "borderRadius", "top"].forEach(function (k) { st[k] = ""; });
    }
    function onVV() { place(); }
    var vv = window.visualViewport;
    if (vv) { vv.addEventListener("resize", onVV); vv.addEventListener("scroll", onVV); }

    dlg = X.modal(html, {
      label: "فتح امتحان بالرمز", cls: "exm-join",
      onClose: function () { stopScan(); if (vv) { vv.removeEventListener("resize", onVV); vv.removeEventListener("scroll", onVV); } joinDlg = null; }
    });
    joinDlg = dlg;
    var body = $("#exmJoinBody", dlg.el), fileEl = $("#exmJoinFile", dlg.el);

    function say(t, ok) { var m = $("#exmJoinMsg", dlg.el); if (!m) return; m.textContent = t || ""; m.hidden = !t; m.classList.toggle("is-ok", !!ok); }
    var MSG = '<p class="exm-join__msg" id="exmJoinMsg" role="alert" hidden></p>';
    function bodyHtml(m) {
      if (m === "scan") return '<p class="exm-sub">وجّه الكاميرا ناحية الـ QR وهيتفتح الامتحان لوحده.</p>' +
        '<div class="exm-scan" id="exmScan"><video id="exmScanVideo" playsinline muted></video><span class="exm-scan__frame" aria-hidden="true"></span></div>' + MSG +
        '<div class="exm-join__alt"><button type="button" class="exm-btn" data-j="toPick">' + ICON_IMG + ' اختيار صورة</button><button type="button" class="exm-btn" data-j="toCode">اكتب الرمز بدل كده</button></div>';
      if (m === "pick") return '<p class="exm-sub">اختار صورة فيها الـ QR من المعرض وهيتفتح الامتحان لوحده.</p>' + MSG +
        '<div class="exm-join__alt"><button type="button" class="exm-btn exm-btn--accent" data-j="pick">' + ICON_IMG + ' اختيار صورة</button><button type="button" class="exm-btn" data-j="toScan">' + ICON_CAM + ' مسح بالكاميرا</button><button type="button" class="exm-btn" data-j="toCode">اكتب الرمز بدل كده</button></div>';
      return '<p class="exm-sub">اكتب رمز الامتحان اللي الأستاذ إدّاهولك.</p>' +
        '<div class="exm-join__row"><input class="exm-input exm-input--code" id="exmJoinInput" data-autofocus="1" dir="ltr" inputmode="text" autocapitalize="characters" autocomplete="off" autocorrect="off" spellcheck="false" maxlength="8" placeholder="XXX-XXX" aria-label="رمز الامتحان" />' +
        '<button type="button" class="exm-btn exm-btn--accent" data-j="go">فتح</button></div>' + MSG +
        '<div class="exm-join__alt"><button type="button" class="exm-btn" data-j="toScan">' + ICON_CAM + ' مسح QR بالكاميرا</button><button type="button" class="exm-btn" data-j="toPick">' + ICON_IMG + " اختيار صورة</button></div>";
    }
    function setMode(m) {
      if (m !== "scan") stopScan();
      if (document.activeElement && document.activeElement.blur && m !== "code") { try { document.activeElement.blur(); } catch (e) { } }
      cur = m;
      body.innerHTML = bodyHtml(m);
      if (m === "code") {
        var inp = $("#exmJoinInput", dlg.el);
        inp.addEventListener("input", function () {
          var raw = X.normCode(inp.value).slice(0, 6);
          inp.value = raw.length > 3 ? raw.slice(0, 3) + "-" + raw.slice(3) : raw; say("");
        });
        inp.addEventListener("keydown", function (ev) { if (ev.key === "Enter") { ev.preventDefault(); submitCode(inp.value); } });
        place();
        try { inp.focus(); } catch (e) { }
        setTimeout(place, 120); setTimeout(place, 350);
      } else unplace();
    }
    function submitCode(raw) {
      var res = joinByCode(raw);
      if (!res.ok) return say(res.msg);
      dlg.close(); showJoined(res);
    }
    function onText(t) {
      if (!t) return false;
      var code = X.codeFromText(t);
      submitCode(code);
      return true;
    }
    function startScan() {
      setMode("scan"); say("");
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) return say("الكاميرا مش متاحة في المتصفح ده. اختار صورة أو اكتب الرمز.");
      withDecoder().then(function (det) {
        return navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" } }, audio: false }).then(function (st) {
          if (cur !== "scan" || !joinDlg) { st.getTracks().forEach(function (t) { t.stop(); }); return; }
          stream = st; scanning = true;
          var v = $("#exmScanVideo", dlg.el); v.srcObject = st;
          return v.play().then(function () {
            var last = 0;
            (function loop(ts) {
              if (!scanning) return;
              if (ts - last > 120 && v.readyState >= 2) {
                last = ts;
                decodeFrom(v, det).then(function (t) { if (scanning && t && onText(t)) stopScan(); });
              }
              raf = requestAnimationFrame(loop);
            })(0);
          });
        });
      }).catch(function (err) {
        stopScan();
        say(err && err.name === "NotAllowedError" ? "لازم تسمح للموقع باستخدام الكاميرا. أو اختار صورة فيها الـ QR." : "تعذّر تشغيل الكاميرا. اختار صورة أو اكتب الرمز.");
      });
    }
    function startPick() { setMode("pick"); fileEl.click(); }
    function fromFile(file) {
      if (!file) return;
      say("جاري قراءة الصورة…", true);
      var url = URL.createObjectURL(file), img = new Image();
      img.onload = function () {
        withDecoder().then(function (det) { return decodeFrom(img, det); }).then(function (t) {
          URL.revokeObjectURL(url);
          if (!t || !onText(t)) say("ماقدرتش ألاقي QR واضح في الصورة. جرّب صورة أوضح أو اكتب الرمز.");
        }).catch(function () { URL.revokeObjectURL(url); say("تعذّر قراءة الصورة."); });
      };
      img.onerror = function () { URL.revokeObjectURL(url); say("الصورة دي مش مفهومة."); };
      img.src = url;
    }
    dlg.el.addEventListener("click", function (ev) {
      var b = ev.target.closest("[data-j]"); if (!b) return;
      var j = b.dataset.j;
      if (j === "go") { var inp = $("#exmJoinInput", dlg.el); submitCode(inp ? inp.value : ""); }
      else if (j === "toScan") startScan();
      else if (j === "toPick") startPick();
      else if (j === "pick") fileEl.click();
      else if (j === "toCode") setMode("code");
    });
    fileEl.addEventListener("change", function (ev) { fromFile(ev.target.files && ev.target.files[0]); ev.target.value = ""; });

    if (mode === "scan") startScan();
    else if (mode === "pick") startPick();
    else setMode("code");
  }

  /* ------------------------------------------------------------ الأحداث */
  function injectStyle() {
    if (document.getElementById("exmProCss")) return;
    var st = document.createElement("style"); st.id = "exmProCss";
    st.textContent =
      ".exm-joincard{display:grid;gap:12px;padding:16px;margin:4px 0 20px;border-radius:16px;border:1px solid var(--surface-glass-border);background:var(--surface-glass)}" +
      ".exm-joincard__head{display:flex;align-items:center;gap:12px}.exm-joincard__head strong{display:block;font-size:1rem}.exm-joincard__head small{display:block;margin-top:2px;color:var(--ink-soft);font-size:.82rem}" +
      ".exm-joincard__ico{flex:none;display:grid;place-items:center;width:42px;height:42px;border-radius:12px;background:color-mix(in srgb,var(--accent) 14%,transparent);color:var(--accent)}.exm-joincard__ico .exm-ico{width:22px;height:22px}" +
      ".exm-joincard__row{display:flex;gap:10px}.exm-joincard__row .exm-input{flex:1;min-width:0;text-align:center;letter-spacing:.16em;font-weight:800;font-size:1.05rem}.exm-joincard__row .exm-btn{min-width:84px}" +
      ".exm-joincard__or{display:flex;align-items:center;gap:10px;color:var(--ink-soft);font-size:.8rem}.exm-joincard__or:before,.exm-joincard__or:after{content:'';flex:1;height:1px;background:var(--surface-glass-border)}" +
      ".exm-joincard__acts{display:grid;grid-template-columns:1fr 1fr;gap:10px}.exm-joincard__acts .exm-btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;min-height:46px}" +
      "@media(max-width:440px){.exm-joincard__acts{grid-template-columns:1fr}}" +
      ".exm-join__alt{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px;margin-top:12px}.exm-join__alt .exm-btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;min-height:46px}" +
      ".exm-warn2{display:grid;gap:18px;padding:20px;border-radius:18px;border:1px solid color-mix(in srgb,#d9534f 38%,var(--surface-glass-border));background:var(--surface-glass)}" +
      ".exm-warn2__hero{display:flex;align-items:center;gap:14px}.exm-warn2__hero h3{margin:0 0 2px}.exm-warn2__hero .exm-sub{margin:0}" +
      ".exm-warn2__ico{flex:none;display:grid;place-items:center;width:48px;height:48px;border-radius:14px;background:color-mix(in srgb,#d9534f 16%,transparent);color:#d9534f}.exm-warn2__ico .exm-ico,.exm-warn2__ico svg{width:26px;height:26px}" +
      ".exm-warn2__list{list-style:none;margin:0;padding:0;display:grid;gap:12px}.exm-warn2__list li{display:flex;gap:12px;align-items:flex-start;padding:12px 14px;border-radius:12px;background:color-mix(in srgb,var(--ink) 4%,transparent)}" +
      ".exm-warn2__n{flex:none;display:grid;place-items:center;width:26px;height:26px;border-radius:50%;background:var(--ink);color:var(--bg);font-size:.8rem;font-weight:800}" +
      ".exm-warn2__list strong{display:block;font-size:.95rem}.exm-warn2__list p{margin:3px 0 0;color:var(--ink-soft);font-size:.85rem;line-height:1.6}" +
      ".exm-warn2__go{width:100%;min-height:48px;font-size:1rem}";
    document.head.appendChild(st);
  }

  function bind() {
    injectStyle();
    window.addEventListener("popstate", onPop);
    root.addEventListener("click", function (ev) {
      var b = ev.target.closest("[data-act]");
      if (!b) return;
      var act = b.dataset.act;
      if (act === "toggle") {
        var tid = b.dataset.id; S.open[tid] = !S.open[tid];
        var card = b.closest(".exm-xc"); if (card) card.classList.toggle("is-open", !!S.open[tid]);
        b.setAttribute("aria-expanded", String(!!S.open[tid]));
      }
      else if (act === "join") openJoin();
      else if (act === "joinGo") joinInline();
      else if (act === "joinScan") openJoin("scan");
      else if (act === "joinPick") openJoin("pick");
      else if (act === "start") warn(b.dataset.id);
      else if (act === "confirmStart") start(S.curId);
      else if (act === "cancelStart") goBack();
      else if (act === "result") { pushLevel(); S.curId = b.dataset.id; S.view = "result"; render(); window.scrollTo(0, 0); }
      else if (act === "resultPdf") openResultPdf();
      else if (act === "back") goBack();
      else if (act === "askSubmit") { S.confirm = true; S.flash = ""; render(); window.scrollTo(0, document.body.scrollHeight); }
      else if (act === "cancelSubmit") { S.confirm = false; render(); }
      else if (act === "doSubmit") submit(false);

    });
    root.addEventListener("input", function (ev) {
      if (ev.target.id !== "exmJoinInline") return;
      var raw = X.normCode(ev.target.value).slice(0, 6);
      ev.target.value = raw.length > 3 ? raw.slice(0, 3) + "-" + raw.slice(3) : raw;
      S.joinDraft = ev.target.value; inlineSay("");
    });
    root.addEventListener("keydown", function (ev) { if (ev.key === "Enter" && ev.target.id === "exmJoinInline") { ev.preventDefault(); joinInline(); } });
    root.addEventListener("focusin", function (ev) {
      var t = ev.target; if (t.id !== "exmJoinInline") return;
      setTimeout(function () { try { t.scrollIntoView({ block: "center", behavior: "smooth" }); } catch (e) { } }, 320);
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
      if (on && !was && S.view !== "take") refreshSubs().then(function () { applyVisible(); render(); paintAlert(); autoGradePending(); });
      was = on;
    }).observe(panel, { attributes: true, attributeFilter: ["class"] });
  }

  /* الخروج من المنصة أثناء الامتحان = تسليم تلقائي */
  document.addEventListener("visibilitychange", function () { if (document.hidden) onLeave(); else checkLeft(); });
  window.addEventListener("pagehide", onLeave);
  window.addEventListener("online", checkLeft);
  if (window.matchMedia && window.matchMedia("(hover: hover) and (pointer: fine)").matches) {
    window.addEventListener("blur", function () {
      setTimeout(function () { if (!document.hasFocus() && !document.hidden) onLeave(); }, 400);
    });
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

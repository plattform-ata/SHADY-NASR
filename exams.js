/* ==========================================================================
   exams.js — الطبقة المشتركة لوحدة الامتحانات (بتتحمّل في studenti.html و admin.html)
   فيها: أنواع الأسئلة، مولّد الأسئلة الدُفعي، التحقق قبل النشر، التقدير، وأدوات صغيرة.
   التخزين نفسه (Firebase) في firebase.js: exams / examKeys / examSubmissions.

   نموذج البيانات:
   Exam = {
     id, title, grade: "prep1".."secondary3", track: "all"|"general"|"bacc", term: 1|2,
     code: "K7M4QX" (رمز الامتحان)، access: "public" (يظهر لكل طلاب الصف) | "private" (بالرمز أو QR بس),
     durationMin, instructions, status: "draft"|"published"|"closed",
     maxMarks, createdAt, publishedAt,
     sections: [ Section ]
   }
   Section  = { id, type, header, questions: [ Question ] }
   Question = { id, text, points, options?: {A,B,C,D}, answer? }   // answer بيتخزّن في examKeys بس
   Submission (examSubmissions/{examId}/{studentId}) = {
     examId, examTitle, studentId, studentName, grade, answers: { [qid]: string },
     submittedAt, status: "submitted"|"graded",
     // بعد التصحيح:
     scores: { [qid]: number }, rawTotal, rawMax, outOf, finalScore, feedback, gradedAt, gradedBy, gradeKey
   }
   ========================================================================== */
(function () {
  "use strict";

  var GRADE_NAMES = {
    prep1: "الصف الأول الإعدادي", prep2: "الصف الثاني الإعدادي", prep3: "الصف الثالث الإعدادي",
    secondary1: "الصف الأول الثانوي", secondary2: "الصف الثاني الثانوي", secondary3: "الصف الثالث الثانوي"
  };
  var TRACK_NAMES = { all: "كل المسارات", general: "ثانوية عامة", bacc: "بكالوريا" };

  /* أنواع الأسئلة: العنوان الجاهز (header) بيتملّى تلقائيًا في المولّد */
  var TYPES = [
    { k: "mcq",          ar: "اختيار من متعدد", header: "Choose the correct answer:",                          textLabel: "نص السؤال" },
    { k: "conversation", ar: "محادثة",           header: "Complete the conversation:",                          textLabel: "نص المحادثة (سيب فراغات ____)" },
    { k: "essay",        ar: "مقال / فقرة",      header: "Write a paragraph about:",                            textLabel: "موضوع الكتابة" },
    { k: "vocab",        ar: "معاني كلمات",      header: "Write the meaning of the following words:",           textLabel: "الكلمة" },
    { k: "correction",   ar: "تصحيح أخطاء",      header: "Correct the mistakes in the following sentences:",    textLabel: "الجملة الخاطئة" },
    { k: "translation",  ar: "ترجمة",            header: "Translate the following sentences:",                  textLabel: "الجملة المطلوب ترجمتها" }
  ];
  function typeOf(k) { for (var i = 0; i < TYPES.length; i++) if (TYPES[i].k === k) return TYPES[i]; return TYPES[0]; }

  var LETTERS = ["A", "B", "C", "D"];

  function uid(p) { return p + Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
  function esc(v) {
    return String(v == null ? "" : v).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function clean(o) { return JSON.parse(JSON.stringify(o)); }
  function num(v, d) { var n = parseFloat(v); return isFinite(n) ? n : (d || 0); }
  function round1(n) { return Math.round(n * 10) / 10; }

  /* Firebase بيرجّع المصفوفات أحيانًا ككائنات، وبيشيل الفاضي: نرجّعها لشكل ثابت */
  function arr(x) {
    if (Array.isArray(x)) return x.filter(function (v) { return v != null; });
    if (!x) return [];
    return Object.keys(x).sort(function (a, b) { return (+a) - (+b); }).map(function (k) { return x[k]; });
  }
  function normalizeExam(e) {
    if (!e) return e;
    e.sections = arr(e.sections).map(function (s) {
      s.questions = arr(s.questions).map(function (q) {
        if (q.options && !Array.isArray(q.options)) q.options = { A: q.options.A || "", B: q.options.B || "", C: q.options.C || "", D: q.options.D || "" };
        return q;
      });
      return s;
    });
    return e;
  }

  /* ---------------- المولّد ---------------- */
  function blankQuestion(type) {
    var q = { id: uid("q"), text: "", points: 1, answer: "" };
    if (type === "mcq") q.options = { A: "", B: "", C: "", D: "" };
    return q;
  }
  /* مولّد الأسئلة الدُفعي: النوع + العدد (+ عنوان اختياري) -> قسم جاهز فيه N بلوك */
  function generate(type, count, header) {
    var n = Math.max(1, Math.min(50, parseInt(count, 10) || 1));
    var qs = [];
    for (var i = 0; i < n; i++) qs.push(blankQuestion(type));
    return { id: uid("s"), type: type, header: header || typeOf(type).header, questions: qs };
  }
  /* تغيير نوع قسم موجود: نضيف/نشيل حقول الاختيارات ونحافظ على النصوص */
  function retype(section, type) {
    section.type = type;
    section.questions.forEach(function (q) {
      if (type === "mcq") { if (!q.options) q.options = { A: "", B: "", C: "", D: "" }; if (LETTERS.indexOf(q.answer) < 0) q.answer = ""; }
      else { delete q.options; if (LETTERS.indexOf(q.answer) > -1 && q.answer.length === 1) q.answer = ""; }
    });
    return section;
  }

  /* ---------------- حسابات ---------------- */
  function flatten(exam) {
    var out = [], no = 0;
    arr(exam && exam.sections).forEach(function (s) {
      arr(s.questions).forEach(function (q) {
        no++;
        out.push({ q: q, section: s, type: s.type, header: s.header, no: no });
      });
    });
    return out;
  }
  function totalPoints(exam) {
    return round1(flatten(exam).reduce(function (t, r) { return t + num(r.q.points, 0); }, 0));
  }
  function countQuestions(exam) { return flatten(exam).length; }

  function norm(s) { return String(s == null ? "" : s).toLowerCase().replace(/[\s\u200f\u200e]+/g, " ").replace(/[.,!?;:"'()]/g, "").trim(); }

  /* اقتراح درجة: MCQ تلقائي (مطابقة الحرف) • الباقي مطابقة نص حرفية مع الإجابة النموذجية */
  function suggestScore(row, answer, key) {
    var p = num(row.q.points, 0);
    if (answer == null || answer === "" || key == null || key === "") return null;
    if (row.type === "mcq") return String(answer) === String(key) ? p : 0;
    return norm(answer) === norm(key) ? p : null;
  }

  /* ---------------- التحقق قبل النشر ---------------- */
  function validate(exam) {
    var errs = [];
    if (!String(exam.title || "").trim()) errs.push("اكتب عنوان الامتحان");
    if (!exam.grade) errs.push("اختار الصف المستهدف");
    var rows = flatten(exam);
    if (!rows.length) errs.push("ضيف سؤال واحد على الأقل");
    rows.forEach(function (r) {
      var tag = "سؤال " + r.no + ": ";
      if (!String(r.q.text || "").trim()) errs.push(tag + "نص السؤال فاضي");
      if (!(num(r.q.points, 0) > 0)) errs.push(tag + "الدرجة لازم تكون أكبر من صفر");
      if (r.type === "correction" && !String(r.q.answer || "").trim()) errs.push(tag + "اكتب الجملة الصحيحة");
      if (r.type === "mcq") {
        LETTERS.forEach(function (L) { if (!String((r.q.options || {})[L] || "").trim()) errs.push(tag + "الاختيار " + L + " فاضي"); });
        if (LETTERS.indexOf(r.q.answer) < 0) errs.push(tag + "حدد الإجابة الصحيحة");
      }
    });
    return errs.slice(0, 12);
  }

  /* ---------------- تقدير + مطابقة الطالب ---------------- */
  function levelFor(p) {
    if (p >= 90) return { level: "excellent", label: "ممتاز" };
    if (p >= 80) return { level: "verygood", label: "جيد جدًا" };
    if (p >= 70) return { level: "good", label: "جيد" };
    if (p >= 50) return { level: "fair", label: "مقبول" };
    return { level: "weak", label: "ضعيف" };
  }
  function matches(exam, user) {
    if (!exam || !user) return false;
    if (exam.grade !== user.grade) return false;
    if (exam.track && exam.track !== "all" && String(user.grade || "").indexOf("secondary") === 0) {
      return user.track === exam.track;
    }
    return true;
  }
  function fmtDate(v) {
    try { return new Date(v).toLocaleDateString("ar-EG", { day: "numeric", month: "long", year: "numeric" }); } catch (e) { return ""; }
  }
  function fmtDateTime(v) {
    try { return new Date(v).toLocaleString("ar-EG", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }); } catch (e) { return ""; }
  }

  /* ---------------- ملف الامتحان / النتيجة كـ HTML (بيتحوّل PDF ويتفتح جوه المنصة) ---------------- */
  var SHEET_CSS =
    "*{box-sizing:border-box}body{font-family:'Segoe UI',Tahoma,Arial,sans-serif;color:#111;font-size:13px;line-height:1.7;margin:0}" +
    "header{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid #1d5260;padding-bottom:10px;margin-bottom:12px}" +
    "h1{margin:0;font-size:20px;color:#1d5260}h2{margin:2px 0 0;font-size:15px}h3{margin:16px 0 6px;font-size:14px;color:#1d5260}" +
    ".tot{text-align:center;border:2px solid #1d5260;border-radius:10px;padding:6px 16px}.tot b{display:block;font-size:24px}" +
    "table{width:100%;border-collapse:collapse;margin-bottom:8px}td{border:1px solid #bbb;padding:5px 8px}td.l{background:#f1f1f1;width:22%;font-weight:700}" +
    ".q{border:1px solid #ccc;border-radius:8px;padding:8px 10px;margin:6px 0}.qh{display:flex;justify-content:space-between}.sc{font-weight:700}" +
    ".qt{white-space:pre-wrap;margin:2px 0}.a{background:#f4f4f4;border-radius:6px;padding:6px 8px;white-space:pre-wrap}.k{color:#555;font-size:12px;margin-top:4px}" +
    ".o{margin:4px 0;direction:ltr;text-align:left}.line{border-bottom:1px solid #999;height:26px}" +
    ".fb{border:1px dashed #888;border-radius:8px;padding:8px 10px;margin-top:12px}footer{margin-top:18px;color:#666;font-size:11px;text-align:center}";

  /* sub = null  → ورقة الامتحان فاضية (أسئلة بس) • sub موجود → النتيجة بإجابات الطالب (والإجابة النموذجية لو q.answer موجودة) */
  function sheetHtml(e, sub, o) {
    o = o || {};
    var paper = !sub, rows = flatten(e), last = null, body = "";
    var pct = 0, lv = { label: "" };
    if (!paper) { pct = sub.outOf > 0 ? Math.round((sub.finalScore / sub.outOf) * 100) : 0; lv = levelFor(pct); }
    rows.forEach(function (r) {
      var q = r.q, block;
      if (r.section !== last) { last = r.section; body += '<h3 dir="auto">' + esc(r.header) + "</h3>"; }
      if (paper) {
        var opts = r.type === "mcq"
          ? '<div class="o">' + LETTERS.map(function (L) { return "<div>" + L + ") " + esc((q.options || {})[L]) + "</div>"; }).join("") + "</div>"
          : '<div class="line"></div><div class="line"></div>';
        block = '<div class="q"><div class="qh"><b>' + r.no + '.</b><span class="sc">' + esc(q.points) + ' درجة</span></div><div class="qt" dir="auto">' + esc(q.text) + "</div>" + opts + "</div>";
      } else {
        var ans = (sub.answers || {})[q.id] || "", got = sub.scores && sub.scores[q.id] != null ? sub.scores[q.id] : 0, shown, key = "";
        if (r.type === "mcq") {
          shown = ans ? ans + " — " + ((q.options || {})[ans] || "") : "— بدون إجابة —";
          key = q.answer ? "الإجابة الصحيحة: " + esc(q.answer) + " — " + esc((q.options || {})[q.answer]) : "";
        } else {
          shown = ans || "— بدون إجابة —";
          key = q.answer ? "الإجابة النموذجية: " + esc(q.answer) : "";
        }
        block = '<div class="q"><div class="qh"><b>' + r.no + '.</b><span class="sc">' + esc(got) + " / " + esc(q.points) + '</span></div><div class="qt" dir="auto">' + esc(q.text) + '</div><div class="a" dir="auto">' + esc(shown) + "</div>" + (key ? '<div class="k" dir="auto">' + key + "</div>" : "") + "</div>";
      }
      body += block;
    });
    var head = paper
      ? '<header><div><h1>Mr. Shady Nasr</h1><h2>' + esc(e.title) + '</h2></div><div class="tot"><b>' + esc(totalPoints(e)) + "</b>الدرجة الكلية</div></header>" +
        "<table><tr><td class=\"l\">الاسم</td><td></td><td class=\"l\">الصف</td><td>" + esc(GRADE_NAMES[e.grade] || "") + "</td></tr></table>"
      : '<header><div><h1>Mr. Shady Nasr</h1><h2>' + esc(e.title) + '</h2></div><div class="tot"><b>' + esc(sub.finalScore) + " / " + esc(sub.outOf) + "</b>" + pct + "% · " + lv.label + "</div></header>" +
        '<table><tr><td class="l">الطالب</td><td>' + esc(o.name || sub.studentName || "") + '</td><td class="l">الصف</td><td>' + esc(o.gradeLabel || GRADE_NAMES[sub.grade] || "—") + "</td></tr>" +
        '<tr><td class="l">تاريخ التسليم</td><td>' + esc(fmtDateTime(sub.submittedAt)) + '</td><td class="l">تاريخ التصحيح</td><td>' + esc(sub.gradedAt ? fmtDateTime(sub.gradedAt) : "—") + "</td></tr></table>";
    return '<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>' + esc(e.title) + "</title><style>" + SHEET_CSS + "</style></head><body>" +
      head + body + (!paper && sub.feedback ? '<div class="fb"><b>ملاحظات الأستاذ:</b> ' + esc(sub.feedback) + "</div>" : "") +
      "<footer>" + esc(fmtDate(new Date().toISOString())) + "</footer></body></html>";
  }
  function paperHtml(e) { return sheetHtml(e, null, {}); }


  /* ---------------- رمز الامتحان (ID) + رابط/QR ---------------- */
  var CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";   // من غير I O 0 1 عشان ما يتلخبطوش
  function makeCode(used) {
    var taken = {}; arr(used).forEach(function (c) { if (c) taken[String(c).toUpperCase()] = 1; });
    for (var t = 0; t < 60; t++) {
      var s = "", buf = null;
      try { buf = new Uint8Array(6); (window.crypto || window.msCrypto).getRandomValues(buf); } catch (e) { buf = null; }
      for (var i = 0; i < 6; i++) s += CODE_CHARS.charAt((buf ? buf[i] : Math.floor(Math.random() * 256)) % CODE_CHARS.length);
      if (!taken[s]) return s;
    }
    return s;
  }
  function normCode(v) { return String(v == null ? "" : v).toUpperCase().replace(/[^A-Z0-9]/g, ""); }
  function fmtCode(c) { c = normCode(c); return c.length === 6 ? c.slice(0, 3) + "-" + c.slice(3) : c; }
  function shareUrl(code) {
    try { return new URL("studenti.html?exam=" + normCode(code), location.href).href; }
    catch (e) { return location.origin + "/studenti.html?exam=" + normCode(code); }
  }
  /* بياخد نص QR (رابط كامل أو الرمز نفسه) ويرجّع الرمز نضيف */
  function codeFromText(t) {
    t = String(t == null ? "" : t).trim();
    var m = t.match(/[?&#]exam=([A-Za-z0-9-]+)/i);
    return normCode(m ? m[1] : t);
  }
  function isPrivate(e) { return !!e && e.access === "private"; }

  /* ---------------- نافذة منبثقة (شيت من تحت على الموبايل / بطاقة في النص على الكمبيوتر) ---------------- */
  var modalDepth = 0;
  function modal(html, o) {
    o = o || {};
    var wrap = document.createElement("div");
    wrap.className = "exm-modal";
    wrap.innerHTML = '<div class="exm-modal__scrim" data-close="1"></div>' +
      '<div class="exm-modal__sheet' + (o.cls ? " " + o.cls : "") + '" role="dialog" aria-modal="true" aria-label="' + esc(o.label || "") + '" tabindex="-1">' +
      '<span class="exm-modal__grab" aria-hidden="true"></span>' + html + "</div>";
    document.body.appendChild(wrap);
    modalDepth++; document.documentElement.classList.add("exm-lock");
    var sheet = wrap.querySelector(".exm-modal__sheet"), prev = document.activeElement, closed = false;
    function onKey(ev) { if (ev.key === "Escape") { ev.stopPropagation(); close(); } }
    function close() {
      if (closed) return; closed = true;
      document.removeEventListener("keydown", onKey, true);
      if (wrap.parentNode) wrap.parentNode.removeChild(wrap);
      modalDepth = Math.max(0, modalDepth - 1);
      if (!modalDepth) document.documentElement.classList.remove("exm-lock");
      if (o.onClose) try { o.onClose(); } catch (e) { }
      if (prev && prev.focus) try { prev.focus(); } catch (e2) { }
    }
    wrap.addEventListener("click", function (ev) { if (ev.target.closest("[data-close]")) close(); });
    document.addEventListener("keydown", onKey, true);
    requestAnimationFrame(function () {
      wrap.classList.add("is-in");
      var f = sheet.querySelector("[data-autofocus]") || sheet;
      try { f.focus({ preventScroll: true }); } catch (e) { }
    });
    return { el: sheet, close: close };
  }

  /* تحميل مكتبة عند الحاجة بس (QR) */
  var loaded = {};
  function loadScript(src) {
    if (loaded[src]) return loaded[src];
    loaded[src] = new Promise(function (res, rej) {
      var s = document.createElement("script"); s.src = src; s.async = true;
      s.onload = function () { res(); };
      s.onerror = function () { delete loaded[src]; rej(new Error("load " + src)); };
      document.head.appendChild(s);
    });
    return loaded[src];
  }

  window.SNExams = {
    GRADE_NAMES: GRADE_NAMES, TRACK_NAMES: TRACK_NAMES, TYPES: TYPES, LETTERS: LETTERS,
    typeOf: typeOf, uid: uid, esc: esc, clean: clean, num: num, round1: round1, arr: arr,
    normalizeExam: normalizeExam, blankQuestion: blankQuestion, generate: generate, retype: retype,
    flatten: flatten, totalPoints: totalPoints, countQuestions: countQuestions,
    suggestScore: suggestScore, validate: validate, levelFor: levelFor, matches: matches,
    fmtDate: fmtDate, fmtDateTime: fmtDateTime, sheetHtml: sheetHtml, paperHtml: paperHtml,
    makeCode: makeCode, normCode: normCode, fmtCode: fmtCode, shareUrl: shareUrl, codeFromText: codeFromText, isPrivate: isPrivate,
    modal: modal, loadScript: loadScript
  };
})();

/* ==========================================================================
   exams.js — الطبقة المشتركة لوحدة الامتحانات (بتتحمّل في studenti.html و admin.html)
   فيها: أنواع الأسئلة، مولّد الأسئلة الدُفعي، التحقق قبل النشر، التقدير، وأدوات صغيرة.
   التخزين نفسه (Firebase) في firebase.js: exams / examKeys / examSubmissions.

   نموذج البيانات:
   Exam = {
     id, title, grade: "prep1".."secondary3", track: "all"|"general"|"bacc",
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

  window.SNExams = {
    GRADE_NAMES: GRADE_NAMES, TRACK_NAMES: TRACK_NAMES, TYPES: TYPES, LETTERS: LETTERS,
    typeOf: typeOf, uid: uid, esc: esc, clean: clean, num: num, round1: round1, arr: arr,
    normalizeExam: normalizeExam, blankQuestion: blankQuestion, generate: generate, retype: retype,
    flatten: flatten, totalPoints: totalPoints, countQuestions: countQuestions,
    suggestScore: suggestScore, validate: validate, levelFor: levelFor, matches: matches,
    fmtDate: fmtDate, fmtDateTime: fmtDateTime
  };
})();

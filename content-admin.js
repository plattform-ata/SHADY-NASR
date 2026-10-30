/* ==========================================================================
   content-admin.js — قسم "الدروس والقصة" في لوحة الأدمن
   الأدمن بيختار الصف ← النوع (وحدة / درس / قصة):
   - وحدة: اسم الوحدة + رقمها + ملف أسئلة امتحان الوحدة.
   - درس: بيتربط بوحدة ضافها الأدمن، + فيديو + PDF + ملف أسئلة شيت الدرس
     (واختياريًا ملف أسئلة امتحان الوحدة).
   - فصل قصة: عنوان + فيديو + PDF + ملف أسئلة امتحان الفصل (20 سؤال عشوائي لكل طالب).
   كل وحدة وفصل قصة ليهم ترم (الأول / التاني)، والدرس بيتبع ترم وحدته. الترم اللي يظهر للطلاب بيتحدد من الإعدادات ← «ترم الطلاب».
   مفيش أي وحدات أو دروس جاهزة — كله من هنا. أسئلة الامتحانات بتتقرا من ملف (.js أو .json
   بنفس شكل ملفات questions-unitN.js) وبتتخزن في Firebase: questionBanks/{key}.
   بيتحمّل في admin.html بعد firebase.js و drive.js و content.js.
   ========================================================================== */
(function () {
  "use strict";

  var root = null, items = [], grade = "", kind = "unit", editingId = null, busy = false, loaded = false;
  var termFilter = 0;        // فلتر العرض في القايمة: 0 = الكل، 1 = الترم الأول، 2 = الترم الثاني
  var formTerm = 1;          // الترم المختار في فورم الإضافة/التعديل
  var pending = {};          // أسئلة اتقرت من ملفات ولسه ما اتحفظتش: { own, unit }
  var LABEL = { unit: "وحدة", lesson: "درس", story: "فصل قصة" };

  function esc(v) { return String(v == null ? "" : v).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function $(s) { return root && root.querySelector(s); }
  function gradeName(id) { var g = window.SNContent.GRADES.filter(function (x) { return x.id === id; })[0]; return g ? g.name : id; }
  function bankKeyOf(it) { return window.SNContent.bankKey(it.kind, it.id); }
  function unitsOf(g) {
    return items.filter(function (i) { return i.kind === "unit" && i.grade === g; })
      .sort(function (a, b) { return (Number(a.number) || 0) - (Number(b.number) || 0); });
  }
  function unitById(id) { return items.filter(function (i) { return i.kind === "unit" && i.id === id; })[0] || null; }
  /* الترم: الوحدة وفصل القصة ليهم ترم، والدرس بيتبع وحدته */
  function termName(n) { return window.SNContent.termName(n); }
  function termOfItem(it) {
    if (!it) return 1;
    if (it.kind === "lesson") { var u = unitById(it.unitId); return u ? window.SNContent.termOf(u) : 1; }
    return window.SNContent.termOf(it);
  }

  /* يوتيوب بيتحوّل لرابط موحّد (بيتشغّل جوه المنصة)، ورابط فيديو درايف بيتحوّل لرابط المعاينة */
  function normVideo(u) {
    u = String(u || "").trim();
    var y = u.match(/(?:youtube\.com\/(?:embed\/|watch\?(?:[^#]*&)?v=|shorts\/|live\/)|youtu\.be\/)([\w-]{11})/);
    if (y) return "https://www.youtube.com/watch?v=" + y[1];
    var m = u.match(/drive\.google\.com\/file\/d\/([\w-]+)/);
    if (m) return "https://drive.google.com/file/d/" + m[1] + "/preview";
    return u;
  }

  function injectStyle() {
    if (document.getElementById("cmCss")) return;
    var F = ".cm-form .form-field";
    var st = document.createElement("style");
    st.id = "cmCss";
    st.textContent =
      ".cm-stack{display:flex;flex-direction:column;gap:16px;padding-bottom:90px}" +
      ".cm-row{display:flex;align-items:center;gap:10px;flex-wrap:wrap}" +
      ".cm-chips{display:flex;flex-wrap:wrap;gap:8px}" +
      ".cm-chip{padding:9px 16px;border-radius:999px;border:1.5px solid var(--surface-glass-border,rgba(127,127,127,.35));background:transparent;color:inherit;font:inherit;font-weight:700;cursor:pointer}" +
      ".cm-chip.is-on{background:var(--accent,#c8902e);border-color:var(--accent,#c8902e);color:var(--accent-ink,#fff)}" +
      ".cm-item{display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;padding:12px 14px;border:1px solid var(--surface-glass-border,rgba(127,127,127,.3));border-radius:14px}" +
      ".cm-item__t{font-weight:800;margin:0 0 4px}" +
      ".cm-pill{display:inline-block;margin-inline-end:6px;margin-block:2px;padding:2px 10px;border-radius:999px;font-size:.76rem;font-weight:700;background:rgba(127,127,127,.15)}" +
      ".cm-pill--ok{background:rgba(48,164,108,.18);color:#1f8a57}.cm-pill--no{background:rgba(229,72,77,.15);color:#c62a2f}" +
      ".cm-hint{margin:0;font-size:.86rem;opacity:.75;line-height:1.7}" +
      ".cm-bar{height:8px;border-radius:99px;background:rgba(127,127,127,.2);overflow:hidden}.cm-bar>i{display:block;height:100%;width:0;background:var(--accent,#c8902e);transition:width .15s}" +
      ".cm-msg{padding:10px 12px;border-radius:12px;font-weight:700;font-size:.9rem}.cm-msg--ok{background:rgba(48,164,108,.16);color:#1f8a57}.cm-msg--err{background:rgba(229,72,77,.14);color:#c62a2f}" +
      ".cm-form{display:flex;flex-direction:column;gap:14px}" +
      F + "{margin:0;display:flex;flex-direction:column;gap:7px}" +
      F + ">label:not(.cm-file){font-weight:700;font-size:.9rem}" +
      ".cm-grid2{display:grid;grid-template-columns:1fr 1fr;gap:12px}@media(max-width:560px){.cm-grid2{grid-template-columns:1fr}}" +
      /* كل الحقول بنفس الشكل (بما فيها الرابط والاختيارات) */
      F + " input[type=text]," + F + " input[type=url]," + F + " input[type=number]," + F + " select{" +
        "width:100%;box-sizing:border-box;min-height:48px;padding:11px 16px;border-radius:16px;font:inherit;color:inherit;" +
        "background:var(--surface-input,rgba(127,127,127,.12));border:1.5px solid var(--surface-glass-border,rgba(127,127,127,.28));" +
        "outline:none;transition:border-color .15s,box-shadow .15s}" +
      F + " input::placeholder{opacity:.5}" +
      F + " input[type=url]{direction:ltr;text-align:left}" +
      F + " input:focus," + F + " select:focus{border-color:var(--accent,#c8902e);box-shadow:0 0 0 3px rgba(200,144,46,.22)}" +
      /* زرار اختيار الملف */
      ".cm-form .cm-file{position:relative;display:flex;align-items:center;gap:12px;min-height:56px;padding:8px 10px;border-radius:16px;cursor:pointer;" +
        "border:1.5px dashed var(--surface-glass-border,rgba(127,127,127,.45));background:var(--surface-input,rgba(127,127,127,.08));transition:border-color .15s,background .15s}" +
      ".cm-form .cm-file:hover,.cm-form .cm-file:focus-within{border-color:var(--accent,#c8902e);background:rgba(200,144,46,.08)}" +
      ".cm-file__input{position:absolute;inset:0;width:100%;height:100%;opacity:0;cursor:pointer}" +
      ".cm-file__btn{flex:none;padding:9px 18px;border-radius:12px;background:var(--accent,#c8902e);color:var(--accent-ink,#fff);font-weight:800;font-size:.9rem}" +
      ".cm-file__name{flex:1;min-width:0;font-size:.88rem;opacity:.8;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}" +
      ".cm-file.is-set .cm-file__name{opacity:1;font-weight:700}" +
      ".cm-file-status{margin:0;font-size:.84rem;font-weight:700;line-height:1.6}.cm-file-status.ok{color:#1f8a57}.cm-file-status.err{color:#c62a2f}";
    document.head.appendChild(st);
  }

  /* ---------- قراءة ملف أسئلة (.js أو .json) ---------- */
  function str(v) { return v == null ? "" : String(v).trim(); }

  function toIndex(ans, options) {
    if (typeof ans === "number" && ans >= 0 && ans < options.length) return ans;
    var s = str(ans);
    if (/^[0-3]$/.test(s)) return Number(s);
    if (/^[a-dA-D]$/.test(s)) return s.toLowerCase().charCodeAt(0) - 97;
    var at = options.indexOf(s);
    return at;
  }

  /* بيرجّع { mcq, correction, bad } بالشكل اللي المنصة فاهمه */
  function normalizeBank(raw, prefix) {
    var mcqIn = [], corIn = [];
    if (Array.isArray(raw)) mcqIn = raw;
    else if (raw && typeof raw === "object") {
      mcqIn = raw.mcq || raw.mcqs || raw.questions || [];
      corIn = raw.correction || raw.corrections || [];
    }
    if (!Array.isArray(mcqIn)) mcqIn = Object.keys(mcqIn).map(function (k) { return mcqIn[k]; });
    if (!Array.isArray(corIn)) corIn = Object.keys(corIn).map(function (k) { return corIn[k]; });
    var used = {}, bad = 0, mcq = [], correction = [];
    function uid(given, tag, i) {
      var id = str(given).replace(/[.#$\[\]\/]/g, "-");
      if (!id || used[id]) id = prefix + tag + (i + 1);
      while (used[id]) id += "_";
      used[id] = 1;
      return id;
    }
    mcqIn.forEach(function (q, i) {
      if (!q) { bad++; return; }
      var text = str(q.q || q.question || q.text);
      var opts = q.options || q.choices || [];
      if (!Array.isArray(opts)) opts = Object.keys(opts).map(function (k) { return opts[k]; });
      opts = opts.map(str);
      var a = toIndex(q.answer != null ? q.answer : q.correctIndex != null ? q.correctIndex : q.correct, opts);
      if (!text || opts.length !== 4 || opts.some(function (o) { return !o; }) || a < 0 || a > 3) { bad++; return; }
      mcq.push({ id: uid(q.id, "m", i), type: "mcq", q: text, options: opts, answer: a });
    });
    corIn.forEach(function (q, i) {
      if (!q) { bad++; return; }
      var sentence = str(q.sentence), wrong = str(q.wrong);
      var ans = q.answers != null ? q.answers : q.answer;
      if (!Array.isArray(ans)) ans = ans == null ? [] : [ans];
      ans = ans.map(str).filter(Boolean);
      if (!sentence || !wrong || !ans.length) { bad++; return; }
      correction.push({ id: uid(q.id, "c", i), type: "correct", sentence: sentence, wrong: wrong, answers: ans });
    });
    return { mcq: mcq, correction: correction, bad: bad };
  }

  function parseBankText(text, fileName) {
    var raw = null, usedKey = "";
    text = String(text || "").replace(/^\uFEFF/, "");
    if (/\.json$/i.test(fileName)) {
      raw = JSON.parse(text);
    } else {
      try {
        var fake = { QUESTION_BANK: {} };
        new Function("window", "self", "globalThis", "var QUESTION_BANK = window.QUESTION_BANK;\n" + text)(fake, fake, fake);
        var keys = Object.keys(fake.QUESTION_BANK || {});
        if (keys.length) { usedKey = keys[0]; raw = fake.QUESTION_BANK[usedKey]; }
      } catch (e) { raw = null; }
      if (!raw) { try { raw = JSON.parse(text); } catch (e) { raw = null; } }
      if (!raw) { try { raw = new Function("return (" + text + ");")(); } catch (e) { raw = null; } }
    }
    if (!raw) throw new Error("FORMAT");
    return { raw: raw, usedKey: usedKey };
  }

  function readBankFile(file, prefix) {
    return new Promise(function (resolve, reject) {
      var r = new FileReader();
      r.onerror = function () { reject(new Error("READ")); };
      r.onload = function () {
        try {
          var p = parseBankText(r.result, file.name);
          var b = normalizeBank(p.raw, prefix);
          if (!b.mcq.length && !b.correction.length) throw new Error("EMPTY");
          b.usedKey = p.usedKey;
          resolve(b);
        } catch (e) { reject(e); }
      };
      r.readAsText(file, "utf-8");
    });
  }

  function bankSummary(b) {
    return "تم قراءة " + b.mcq.length + " سؤال اختيار من متعدد" + (b.correction.length ? " + " + b.correction.length + " سؤال تصحيح" : "") +
      (b.bad ? " (وتم تجاهل " + b.bad + " سؤال شكله ناقص)" : "") + " ✓";
  }

  /* ---------- بيانات ---------- */
  function load() {
    if (!(window.SNAuth && SNAuth.fetchCourseContent)) return Promise.resolve();
    var cfgP = SNAuth.getTermConfig ? SNAuth.getTermConfig().then(function (c) { SNContent.setConfig(c); }).catch(function () { }) : Promise.resolve();
    return Promise.all([cfgP, SNAuth.fetchCourseContent().then(function (l) { items = l || []; loaded = true; }).catch(function () { loaded = true; })]);
  }
  function listFor() {
    var list = items.filter(function (i) { return i.kind === kind && i.grade === grade; });
    var um = {};
    unitsOf(grade).forEach(function (u) { um[u.id] = Number(u.number) || 0; });
    return list.sort(function (a, b) {
      if (kind === "lesson") {
        var d = (um[a.unitId] == null ? 999 : um[a.unitId]) - (um[b.unitId] == null ? 999 : um[b.unitId]);
        if (d) return d;
      }
      return (Number(a.number) || 0) - (Number(b.number) || 0) || String(a.createdAt || "").localeCompare(String(b.createdAt || ""));
    });
  }
  function visibleList() {
    var l = listFor();
    return termFilter ? l.filter(function (i) { return termOfItem(i) === termFilter; }) : l;
  }
  function nextNumber(unitId) {
    var n = 0;
    listFor().forEach(function (i) { if (kind !== "lesson" || i.unitId === unitId) n = Math.max(n, Number(i.number) || 0); });
    return n + 1;
  }
  function find(id) { return items.filter(function (i) { return i.id === id; })[0] || null; }

  function msg(text, err) {
    var m = $("#cmMsg");
    if (!m) return;
    m.className = "cm-msg " + (err ? "cm-msg--err" : "cm-msg--ok");
    m.textContent = text;
    m.hidden = !text;
  }

  /* ---------- رسم ---------- */
  function driveCard() {
    var on = window.SNDrive && SNDrive.isSignedIn();
    return '<div class="dash-card"><div class="cm-row" style="justify-content:space-between">' +
      '<div><h3 style="margin:0">الوحدات والدروس والقصة</h3></div>' +
      '<button type="button" class="btn ' + (on ? "btn--ghost" : "btn--accent") + '" id="cmDrive">' + (on ? "Google Drive متصل ✓" : "ربط Google Drive") + "</button></div></div>";
  }

  /* شريط الترم فوق القايمة: فلتر العرض + الترم الظاهر للطلاب دلوقتي */
  function termBar() {
    var chips = [[0, "الكل"], [1, "الترم الأول"], [2, "الترم الثاني"]].map(function (x) {
      return '<button type="button" class="cm-chip' + (termFilter === x[0] ? " is-on" : "") + '" data-tf="' + x[0] + '">' + x[1] + "</button>";
    }).join("");
    return '<div class="dash-card"><div class="cm-chips">' + chips + "</div>" +
      '<p class="cm-hint" style="margin:12px 0 0">الظاهر لطلاب ' + esc(gradeName(grade)) + ' دلوقتي: <strong>' + window.SNContent.termLabel(window.SNContent.effectiveTerm(grade)) + "</strong> — بيتغيّر من الإعدادات ← «ترم الطلاب».</p></div>";
  }

  function pill(ok, label) { return '<span class="cm-pill ' + (ok ? "cm-pill--ok" : "cm-pill--no") + '">' + label + " " + (ok ? "✓" : "✗") + "</span>"; }

  function listHtml() {
    var list = visibleList();
    if (!list.length) {
      var what = kind === "unit" ? "وحدات" : kind === "lesson" ? "دروس" : "فصول";
      return '<p class="cm-hint">مفيش ' + what + (termFilter ? " في " + termName(termFilter) : " مضافة") + " لسه.</p>";
    }
    return list.map(function (i) {
      var unit = kind === "lesson" ? unitById(i.unitId) : null;
      var tags = "";
      var tm = termOfItem(i), shown = window.SNContent.isVisible({ term: tm }, window.SNContent.effectiveTerm(i.grade));
      tags += '<span class="cm-pill' + (shown ? " cm-pill--ok" : "") + '" title="' + (shown ? "ظاهر للطلاب حاليًا" : "مخفي عن الطلاب حاليًا") + '">' + termName(tm) + (shown ? " · ظاهر للطلاب" : " · مخفي حاليًا") + "</span>";
      if (kind === "lesson") tags += unit ? '<span class="cm-pill">الوحدة ' + esc(unit.number) + "</span>" : '<span class="cm-pill cm-pill--no">وحدتها اتحذفت — عدّلها واختار وحدة</span>';
      if (kind !== "unit") tags += pill(!!i.videoUrl, "فيديو") + pill(!!i.pdfFileId, "PDF");
      tags += pill(!!i.bankCount, kind === "unit" ? "امتحان الوحدة" : kind === "lesson" ? "الشيت" : "امتحان الفصل") +
        (i.bankCount ? '<span class="cm-pill">' + esc(i.bankCount) + " سؤال</span>" : "");
      var title = kind === "unit" ? "الوحدة " + esc(i.number) + ": " + esc(i.title) : esc(i.number) + ". " + esc(i.title);
      return '<div class="cm-item"><div><p class="cm-item__t">' + title + "</p><div>" + tags + "</div></div>" +
        '<div class="cm-row"><button type="button" class="btn btn--ghost" data-edit="' + esc(i.id) + '">تعديل</button>' +
        '<button type="button" class="btn btn--ghost" data-del="' + esc(i.id) + '" style="color:#c62a2f">حذف</button></div></div>';
    }).join("");
  }

  /* حقل اختيار ملف بشكل موحّد (بدل زرار المتصفح الافتراضي) */
  function fileField(id, label, accept, current, hint, statusId) {
    return '<div class="form-field"><label for="' + id + '">' + label + "</label>" +
      '<label class="cm-file' + (current ? " is-set" : "") + '"><input class="cm-file__input" type="file" id="' + id + '" accept="' + accept + '" />' +
      '<span class="cm-file__btn">اختيار ملف</span><span class="cm-file__name" id="' + id + 'Name">' + esc(current || "لم يتم اختيار ملف") + "</span></label>" +
      (statusId ? '<p class="cm-file-status" id="' + statusId + '"></p>' : "") +
      "</div>";
  }

  function bankCurrent(it) { return it && it.bankCount ? "الأسئلة الحالية: " + it.bankCount + " سؤال" : ""; }

  function formHtml() {
    var cur = editingId === "new" ? null : find(editingId);
    var v = cur || {};
    var units = unitsOf(grade);
    var unitId = v.unitId || (units[0] && units[0].id) || "";
    var html = '<form class="cm-form" id="cmForm" novalidate><h3 style="margin:0">' + (cur ? "تعديل" : "إضافة") + " " + LABEL[kind] + " — " + esc(gradeName(grade)) + "</h3>";

    if (kind === "lesson") {
      html += '<div class="form-field"><label for="cmUnit">الوحدة</label><select id="cmUnit" data-enhance>' +
        units.map(function (u) { return '<option value="' + esc(u.id) + '"' + (u.id === unitId ? " selected" : "") + ">الوحدة " + esc(u.number) + " — " + esc(u.title) + "</option>"; }).join("") + "</select></div>";
    }

    var termField = "";
    if (kind === "lesson") {
      termField = '<p class="cm-hint" id="cmTermHint">الدرس بيتبع ترم وحدته: <strong>' + termName(termOfItem({ kind: "unit", term: (unitById(unitId) || {}).term })) + "</strong></p>";
    } else {
      termField = '<div class="form-field"><label>الترم</label><div class="cm-chips" id="cmTermChips">' +
        window.SNContent.TERMS.map(function (x) { return '<button type="button" class="cm-chip' + (formTerm === x.id ? " is-on" : "") + '" data-term="' + x.id + '">' + x.name + "</button>"; }).join("") + "</div></div>";
    }
    var tLabel = kind === "unit" ? "اسم الوحدة" : kind === "lesson" ? "عنوان الدرس" : "عنوان الفصل";
    var nLabel = kind === "unit" ? "رقم الوحدة" : "الترتيب";
    html += '<div class="cm-grid2"><div class="form-field"><label for="cmTitle">' + tLabel + '</label>' +
      '<input type="text" id="cmTitle" maxlength="120" value="' + esc(v.title || "") + '" /></div>' +
      '<div class="form-field"><label for="cmNumber">' + nLabel + '</label><input type="number" id="cmNumber" min="1" max="99" value="' + esc(v.number || nextNumber(unitId)) + '" /></div></div>' +
      '<div class="form-field"><label for="cmDesc">وصف قصير (اختياري)</label><input type="text" id="cmDesc" maxlength="160" value="' + esc(v.desc || "") + '" /></div>';

    html += termField;

    if (kind !== "unit") {
      html += '<div class="form-field"><label for="cmVideo">رابط فيديو الشرح (YouTube أو Google Drive)</label>' +
        '<input type="url" id="cmVideo" dir="ltr" placeholder="https://www.youtube.com/watch?v=..." value="' + esc(v.videoUrl || "") + '" />' +
        '</div>' +
        fileField("cmPdf", "ملف PDF " + (kind === "lesson" ? "للدرس" : "للقصة"), "application/pdf,.pdf", v.pdfFileId ? "الملف الحالي: " + (v.pdfName || v.pdfFileId) : "", v.pdfFileId ? "اختار ملف جديد لو عايز تستبدله." : "", "");
    }

    var ownLabel = kind === "unit" ? "ملف أسئلة امتحان الوحدة" : kind === "lesson" ? "ملف أسئلة شيت الدرس" : "ملف أسئلة امتحان الفصل (20 سؤال عشوائي لكل طالب)";
    var ownHint = "";
    html += fileField("cmBank", ownLabel, ".js,.json,application/json,text/javascript", bankCurrent(cur), "", "cmBankStatus");

    if (kind === "lesson") {
      var u0 = unitById(unitId);
      html += fileField("cmUnitBank", "ملف أسئلة امتحان الوحدة (اختياري)", ".js,.json,application/json,text/javascript", bankCurrent(u0),
        "", "cmUnitBankStatus");
    }

    html += '<div class="cm-bar" id="cmBar" hidden><i></i></div><div class="cm-msg" id="cmMsg" hidden></div>' +
      '<div class="cm-row"><button type="submit" class="btn btn--accent" id="cmSave">حفظ</button>' +
      '<button type="button" class="btn btn--ghost" id="cmCancel">إلغاء</button></div></form>';
    return html;
  }

  function render() {
    var G = window.SNContent.GRADES;
    var h = '<div class="cm-stack">' + driveCard() + '<div class="dash-card"><div class="cm-chips">' +
      G.map(function (g) { return '<button type="button" class="cm-chip' + (g.id === grade ? " is-on" : "") + '" data-grade="' + g.id + '">' + esc(g.name) + "</button>"; }).join("") + "</div></div>";
    if (grade) {
      h += '<div class="dash-card"><div class="cm-chips">' +
        ["unit", "lesson", "story"].map(function (k) { return '<button type="button" class="cm-chip' + (kind === k ? " is-on" : "") + '" data-kind="' + k + '">' + (k === "unit" ? "وحدة" : k === "lesson" ? "درس" : "قصة") + "</button>"; }).join("") + "</div></div>";
      if (kind === "lesson" && !editingId && loaded && !unitsOf(grade).length) {
        h += '<div class="dash-card"><p class="cm-hint">مفيش وحدات لسه.</p></div>';
      } else {
        var plural = kind === "unit" ? "الوحدات" : kind === "lesson" ? "الدروس" : "فصول القصة";
        h += (editingId ? "" : termBar()) + '<div class="dash-card">' + (editingId ? formHtml() :
          '<div class="cm-row" style="justify-content:space-between;margin-bottom:12px"><h3 style="margin:0">' + plural + " — " + esc(gradeName(grade)) + '</h3><button type="button" class="btn btn--accent" id="cmAdd">+ إضافة ' + LABEL[kind] + "</button></div>" +
          '<div class="cm-stack" style="gap:10px;padding:0">' + (loaded ? listHtml() : '<p class="cm-hint">جاري التحميل…</p>') + "</div>") + "</div>";
      }
    }
    root.innerHTML = h + "</div>";
    if (typeof window.initCustomSelects === "function") try { window.initCustomSelects(); } catch (e) { }
    bind();
  }

  function bindBank(inputId, statusId, slot, prefix) {
    var inp = $("#" + inputId);
    if (!inp) return;
    inp.addEventListener("change", function () {
      var f = inp.files[0], nm = $("#" + inputId + "Name"), st = $("#" + statusId);
      pending[slot] = null;
      if (st) { st.textContent = ""; st.className = "cm-file-status"; }
      if (!f) { if (nm) nm.textContent = "لم يتم اختيار ملف"; inp.parentNode.classList.remove("is-set"); return; }
      if (nm) nm.textContent = f.name;
      inp.parentNode.classList.add("is-set");
      var pre = typeof prefix === "function" ? prefix() : prefix;
      readBankFile(f, pre).then(function (b) {
        pending[slot] = b;
        if (st) { st.textContent = bankSummary(b) + (b.usedKey ? " (من «" + b.usedKey + "»)" : ""); st.className = "cm-file-status ok"; }
      }).catch(function (e) {
        var t = String(e && e.message || e);
        if (st) {
          st.textContent = t === "EMPTY" ? "الملف مفيهوش أسئلة صالحة (كل سؤال اختيار لازم يكون له 4 اختيارات وإجابة صحيحة)." : "تعذر قراءة الملف. لازم يكون .js بنفس شكل ملفات الأسئلة أو .json.";
          st.className = "cm-file-status err";
        }
        inp.value = ""; if (nm) nm.textContent = "لم يتم اختيار ملف"; inp.parentNode.classList.remove("is-set");
      });
    });
  }

  function bind() {
    root.querySelectorAll("[data-grade]").forEach(function (b) {
      b.addEventListener("click", function () { if (busy) return; grade = b.dataset.grade; editingId = null; render(); });
    });
    root.querySelectorAll("[data-kind]").forEach(function (b) {
      b.addEventListener("click", function () { if (busy) return; kind = b.dataset.kind; editingId = null; render(); });
    });
    var d = $("#cmDrive");
    if (d) d.addEventListener("click", function () {
      SNDrive.signIn().then(function () { render(); }).catch(function () { notify("تعذر تسجيل الدخول بـ Google."); });
    });
    var add = $("#cmAdd");
    if (add) add.addEventListener("click", function () { pending = {}; editingId = "new"; formTerm = termFilter || (window.SNContent.effectiveTerm(grade) === 2 ? 2 : 1); render(); });
    root.querySelectorAll("[data-edit]").forEach(function (b) { b.addEventListener("click", function () { pending = {}; editingId = b.dataset.edit; formTerm = termOfItem(find(b.dataset.edit)); render(); }); });
    root.querySelectorAll("[data-tf]").forEach(function (b) {
      b.addEventListener("click", function () { termFilter = Number(b.dataset.tf) || 0; render(); });
    });
    root.querySelectorAll("[data-del]").forEach(function (b) { b.addEventListener("click", function () { remove(b.dataset.del); }); });
    var form = $("#cmForm");
    if (form) {
      form.addEventListener("submit", function (e) { e.preventDefault(); save(); });
      $("#cmCancel").addEventListener("click", function () { if (busy) return; editingId = null; render(); });
      var pdf = $("#cmPdf");
      if (pdf) pdf.addEventListener("change", function () {
        var nm = $("#cmPdfName");
        if (nm) nm.textContent = pdf.files[0] ? pdf.files[0].name : "لم يتم اختيار ملف";
        pdf.parentNode.classList.toggle("is-set", !!pdf.files[0]);
      });
      bindBank("cmBank", "cmBankStatus", "own", function () { return window.SNContent.bankKey(kind, "x").charAt(0) + "-"; });
      bindBank("cmUnitBank", "cmUnitBankStatus", "unit", "u-");
      root.querySelectorAll("[data-term]").forEach(function (b) {
        b.addEventListener("click", function () {
          formTerm = Number(b.dataset.term) === 2 ? 2 : 1;
          root.querySelectorAll("[data-term]").forEach(function (x) { x.classList.toggle("is-on", x === b); });
        });
      });
      var u = $("#cmUnit");
      if (u) u.addEventListener("change", function () {
        var th = $("#cmTermHint");
        if (th) th.innerHTML = "الدرس بيتبع ترم وحدته: <strong>" + termName(termOfItem(unitById(u.value) ? { kind: "unit", term: unitById(u.value).term } : null)) + "</strong>";
        if (editingId === "new") $("#cmNumber").value = nextNumber(u.value);
        var un = unitById(u.value), nm = $("#cmUnitBankName");
        if (nm && !(($("#cmUnitBank") || {}).files || [])[0]) nm.textContent = bankCurrentShort(un);
      });
    }
  }
  function bankCurrentShort(un) { return un && un.bankCount ? "الأسئلة الحالية: " + un.bankCount + " سؤال" : "لم يتم اختيار ملف"; }

  /* ---------- حفظ ---------- */
  function setBusy(on, text) {
    busy = on;
    var b = $("#cmSave");
    if (b) { b.disabled = on; b.textContent = on ? (text || "جاري الحفظ…") : "حفظ"; }
  }
  function progress(p) {
    var bar = $("#cmBar");
    if (!bar) return;
    bar.hidden = false;
    bar.firstChild.style.width = Math.round(p * 100) + "%";
  }

  /* يحفظ بنك أسئلة على Firebase ويحدّث العنصر (عدد الأسئلة + وقت التحديث عشان كاش الطلاب يتجدد) */
  /* بنك الأسئلة بيتحفظ كملف JSON على Google Drive (مش في قاعدة البيانات) — في Firebase بنخزّن معرّف الملف وعدد الأسئلة بس */
  function storeBank(it, bank) {
    var now = new Date().toISOString();
    var clean = { mcq: bank.mcq, correction: bank.correction, updatedAt: now };
    var oldId = it.bankFileId || "";
    return SNDrive.uploadJson(clean, "questions-" + bankKeyOf(it) + ".json").then(function (up) {
      it.bankFileId = up.id;
      it.bankCount = bank.mcq.length + bank.correction.length;
      it.bankUpdatedAt = now;
      return SNAuth.saveCourseItem(it).then(function () { if (oldId) SNDrive.remove(oldId); });
    });
  }

  function save() {
    if (busy) return;
    var cur = editingId === "new" ? null : find(editingId);
    var title = $("#cmTitle").value.trim();
    var videoEl = $("#cmVideo"), pdfEl = $("#cmPdf"), unitEl = $("#cmUnit");
    var video = videoEl ? normVideo(videoEl.value) : "";
    var file = pdfEl ? (pdfEl.files[0] || null) : null;
    if (!title) return msg("اكتب " + (kind === "unit" ? "اسم الوحدة" : "العنوان") + " الأول.", true);
    if (kind === "lesson" && !(unitEl && unitEl.value)) return msg("اختار الوحدة الأول.", true);
    if (video && !/^https?:\/\//i.test(video)) return msg("رابط الفيديو لازم يبدأ بـ https://", true);
    if (/youtube\.com|youtu\.be/i.test(video) && !/youtube\.com\/watch\?v=[\w-]{11}/.test(video)) return msg("رابط يوتيوب مش مفهوم. انسخ رابط الفيديو نفسه (مش القناة أو القايمة).", true);
    if (file) {
      if (!/pdf$/i.test(file.type) && !/\.pdf$/i.test(file.name)) return msg("الملف لازم يكون PDF.", true);
    }
    if (kind !== "unit" && !cur && !file && !video) return msg("ضيف فيديو أو PDF على الأقل.", true);
    if ($("#cmBank") && $("#cmBank").files[0] && !pending.own) return msg("ملف الأسئلة لسه ما اتقراش أو فيه مشكلة — شوف الرسالة تحت الحقل.", true);
    if ($("#cmUnitBank") && $("#cmUnitBank").files[0] && !pending.unit) return msg("ملف أسئلة الوحدة فيه مشكلة — شوف الرسالة تحت الحقل.", true);
    if (kind === "story" && pending.own && pending.own.mcq.length < 20) return msg("امتحان الفصل محتاج 20 سؤال اختيار من متعدد على الأقل (الملف فيه " + pending.own.mcq.length + ").", true);

    var number = Math.max(1, parseInt($("#cmNumber").value, 10) || 1);
    var dup = listFor().filter(function (i) { return i.id !== (cur && cur.id) && Number(i.number) === number && (kind !== "lesson" || i.unitId === unitEl.value); })[0];
    if (dup && kind === "unit") return msg("فيه وحدة تانية رقمها " + number + " في نفس الصف. غيّر الرقم.", true);

    var now = new Date().toISOString();
    var item = cur ? Object.assign({}, cur) : { id: null, kind: kind, grade: grade, createdAt: now };
    item.title = title;
    item.desc = $("#cmDesc").value.trim();
    item.number = number;
    item.updatedAt = now;
    if (kind !== "lesson") item.term = formTerm === 2 ? 2 : 1;
    if (kind !== "unit") item.videoUrl = video;
    if (kind === "lesson") item.unitId = unitEl.value;
    var oldFile = cur && file ? cur.pdfFileId : "";

    msg("");
    setBusy(true, file || pending.own || pending.unit ? "جاري رفع الملفات…" : "جاري الحفظ…");
    /* signIn لازم يبدأ من نفس ضغطة الزرار (قبل أي انتظار) */
    var auth = (file || pending.own || pending.unit) ? SNDrive.signIn() : Promise.resolve();
    auth.then(function () { return file ? SNDrive.upload(file, progress) : null; })
      .then(function (up) {
        if (up) { item.pdfFileId = up.id; item.pdfName = up.name; }
        setBusy(true, "جاري الحفظ…");
        return SNAuth.saveCourseItem(item);
      })
      .then(function (id) {
        item.id = id;
        return pending.own ? storeBank(item, pending.own) : null;
      })
      .then(function () {
        if (kind === "lesson" && pending.unit) {
          var un = unitById(item.unitId);
          if (un) return storeBank(Object.assign({}, un), pending.unit);
        }
        return null;
      })
      .then(function () {
        if (oldFile) SNDrive.remove(oldFile);
        pending = {};
        return load();
      })
      .then(function () { editingId = null; busy = false; render(); })
      .catch(function (e) {
        setBusy(false);
        var t = String(e && e.message || e);
        msg(/AUTH|popup|NOT_SIGNED/i.test(t) ? "لازم تسجّل دخول Google وتوافق عشان الملف يترفع." : "تعذر الحفظ: " + t, true);
      });
  }

  /* ---------- حذف (الوحدة بتمسح دروسها كمان) ---------- */
  function removeOne(it) {
    var p = Promise.resolve();
    if (it.pdfFileId) p = p.then(function () { return SNDrive.remove(it.pdfFileId); });
    if (it.bankFileId) p = p.then(function () { return SNDrive.remove(it.bankFileId); });
    return p
      .then(function () { return SNAuth.deleteCourseItem(it.id); });
  }

  function notify(text) {
    if (window.snDialog && snDialog.toast) snDialog.toast(text); else msg(text, true);
  }
  function askDelete(title, kids, hasFiles) {
    var m = "هيتحذف «" + title + "» نهائيًا" + (kids ? " مع " + kids + " درس" : "") + (hasFiles ? " وملفاته من Google Drive" : "") + ".";
    if (window.snDialog && snDialog.confirm) return snDialog.confirm({ icon: "trash", title: "تأكيد الحذف", message: m, confirmText: "حذف", cancelText: "إلغاء", tone: "danger" });
    return Promise.resolve(false);
  }

  function remove(id) {
    var it = find(id);
    if (!it || busy) return;
    var kids = it.kind === "unit" ? items.filter(function (i) { return i.kind === "lesson" && i.unitId === it.id; }) : [];
    var all = [it].concat(kids);
    var hasPdf = all.some(function (x) { return x.pdfFileId || x.bankFileId; });
    askDelete(it.title, kids.length, hasPdf).then(function (ok) { if (ok) doRemove(all, hasPdf); });
  }

  function doRemove(all, hasPdf) {
    var auth = hasPdf ? SNDrive.signIn().catch(function () { }) : Promise.resolve();
    busy = true;
    auth.then(function () {
      return all.reduce(function (p, x) { return p.then(function () { return removeOne(x); }); }, Promise.resolve());
    })
      .then(load)
      .then(function () { busy = false; render(); })
      .catch(function () { busy = false; notify("تعذر الحذف، حاول تاني."); });
  }

  function open() {
    root = document.getElementById("cmAdminRoot");
    if (!root || !window.SNContent) return;
    injectStyle();
    if (window.SNDrive && SNDrive.preload) SNDrive.preload().catch(function () { });
    render();
    load().then(function () { if (!busy && !editingId) render(); });
  }

  window.SNContentAdmin = { open: open };
})();

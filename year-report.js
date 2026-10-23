/* ==========================================================================
   year-report.js — ملفات العام الدراسي للطالب (بعد ما الأدمن يرقّي الطلاب لنهاية العام)
   - إشعار: نافذة أول مرة + نقطة على الجرس + كارت في الرئيسية + بند في "المزيد".
   - صفحة "ملفات الأعوام الدراسية": لكل عام 3 ملفات PDF: الدرجات / الملاحظات / الرسوم البيانية.
   - الـ PDF بيتولّد على جهاز الطالب (html2canvas + jsPDF بيتحمّلوا وقت الحاجة بس).
   يتحمّل في studenti.html بعد dashboard.js.
   ========================================================================== */
(function () {
  "use strict";

  var $ = function (s, r) { return (r || document).querySelector(s); };
  var isEn = function () { return document.documentElement.lang === "en"; };
  function t(ar, en) { return isEn() ? en : ar; }
  function esc(v) { return String(v == null ? "" : v).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }

  var GRADES = {
    prep1: ["الصف الأول الإعدادي", "Prep 1"], prep2: ["الصف الثاني الإعدادي", "Prep 2"], prep3: ["الصف الثالث الإعدادي", "Prep 3"],
    secondary1: ["الصف الأول الثانوي", "Secondary 1"], secondary2: ["الصف الثاني الثانوي", "Secondary 2"], secondary3: ["الصف الثالث الثانوي", "Secondary 3"]
  };
  function gname(g) { var x = GRADES[g]; return x ? x[isEn() ? 1 : 0] : ""; }

  var me = null;
  try { me = JSON.parse(localStorage.getItem("shadynasr-current-user")); } catch (e) { }
  if (!me || !me.id || me.role === "admin") return;
  var SEEN_KEY = "shadynasr-yr-seen:" + me.id;

  function seenList() { try { var a = JSON.parse(localStorage.getItem(SEEN_KEY)); return Array.isArray(a) ? a : []; } catch (e) { return []; } }
  function markSeen(keys) {
    var s = seenList();
    keys.forEach(function (k) { if (s.indexOf(k) < 0) s.push(k); });
    try { localStorage.setItem(SEEN_KEY, JSON.stringify(s)); } catch (e) { }
  }

  var reports = [];
  function unseen() { var s = seenList(); return reports.filter(function (r) { return s.indexOf(r.key) < 0; }); }

  /* ------------------------------------------------------------ ستايل */
  var css = [
    "#annBell{position:relative}",
    ".yr-dot{position:absolute;top:8px;inset-inline-end:8px;width:11px;height:11px;border-radius:50%;background:#e5484d;box-shadow:0 0 0 2px var(--bg,#fff);pointer-events:none}",
    ".yr-modal p{line-height:1.7}",
    ".yr-btn[disabled]{opacity:.6;cursor:wait}",
    ".yr-pop{position:fixed;z-index:250;min-width:230px;background:var(--surface-glass,#fff);color:var(--ink,#222);border:1px solid var(--surface-glass-border,#ddd);border-radius:16px;padding:8px;box-shadow:0 12px 32px rgba(0,0,0,.25)}",
    ".yr-pop[hidden]{display:none}",
    ".yr-pop button{display:flex;align-items:center;gap:10px;width:100%;border:0;background:transparent;color:inherit;font:inherit;font-weight:700;text-align:start;padding:11px 12px;border-radius:10px;cursor:pointer}",
    ".yr-pop button:hover{background:var(--bg-soft,rgba(0,0,0,.05))}",
    ".yr-pop .yr-pop__dot{width:9px;height:9px;border-radius:50%;background:#e5484d;flex:none}",
    ".yf-list{display:grid;gap:16px}",
    ".yf-card{padding:18px;border-radius:var(--radius-lg,18px);background:var(--surface-glass,#fff);border:1px solid var(--surface-glass-border,#ddd)}",
    ".yf-card h3{margin:0 0 4px;font-size:1.1rem}",
    ".yf-card__sub{margin:0 0 14px;color:var(--ink-soft,#666);font-size:.9rem}",
    ".yf-new{display:inline-block;margin-inline-start:8px;padding:2px 10px;border-radius:999px;background:#e5484d;color:#fff;font-size:.72rem;font-weight:800;vertical-align:middle}",
    ".yf-files{display:grid;gap:10px;grid-template-columns:repeat(auto-fit,minmax(190px,1fr))}",
    ".yf-file{display:flex;align-items:center;gap:10px;padding:13px 14px;border-radius:14px;border:1px solid var(--surface-glass-border,#ddd);background:transparent;color:inherit;font:inherit;font-weight:700;cursor:pointer;text-align:start}",
    ".yf-file:hover{border-color:var(--accent)}",
    ".yf-file[disabled]{opacity:.6;cursor:wait}",
    ".yf-file svg{width:24px;height:24px;color:var(--accent);flex:none}",
    ".yf-file small{display:block;font-weight:500;color:var(--ink-soft,#777);font-size:.78rem}",
    ".yf-empty{padding:30px 10px;text-align:center;color:var(--ink-soft,#777)}"
  ].join("\n");
  var st = document.createElement("style");
  st.textContent = css;
  document.head.appendChild(st);

  var ICON_CAP = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 10 12 5 2 10l10 5 10-5Z"/><path d="M6 12v5c3 2 9 2 12 0v-5"/></svg>';
  var ICON_DOC = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8Z"/><path d="M14 3v5h5"/><path d="M9 13h6M9 17h4"/></svg>';
  var ICON_NOTE = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 4h14a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-7l-5 4v-4H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z"/><path d="M8 9h8M8 12.5h5"/></svg>';
  var ICON_CHART = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3v18h18"/><path d="M7 15l4-5 3 3 5-7"/></svg>';

  /* ------------------------------------------------------------ فتح الصفحة */
  function openFiles() {
    var link = document.querySelector('.dash-nav__link[data-target="yearfiles"]');
    if (link) link.click();
    renderPanel();
    markSeen(reports.map(function (r) { return r.key; }));
    refreshNotify();
  }

  /* ------------------------------------------------------------ إشعارات */
  var modal, pop, banner, dot, bypass = false;

  function ensureUi() {
    var bell = $("#annBell");
    if (bell && !dot) { dot = document.createElement("i"); dot.className = "yr-dot"; dot.hidden = true; bell.appendChild(dot); }

    if (!modal) {
      modal = document.createElement("div");
      modal.className = "modal-overlay yr-modal"; modal.hidden = true;
      modal.innerHTML = '<div class="modal" role="dialog" aria-modal="true"><span class="modal__icon" aria-hidden="true">' + ICON_CAP + '</span><h3></h3><p></p><div class="modal__actions"><button type="button" class="btn btn--accent" data-yr="open"></button><button type="button" class="btn btn--ghost" data-yr="later"></button></div></div>';
      modal.addEventListener("click", function (e) {
        if (e.target === modal || e.target.closest('[data-yr="later"]')) { closeYr(); return; }
        if (e.target.closest('[data-yr="open"]')) { closeYr(); openFiles(); }
      });
      document.body.appendChild(modal);
    }

    if (!pop) {
      pop = document.createElement("div");
      pop.className = "yr-pop"; pop.hidden = true;
      pop.innerHTML = '<button type="button" data-yr="files"><span class="yr-pop__dot"></span><span></span></button><button type="button" data-yr="ann"><span></span></button>';
      pop.addEventListener("click", function (e) {
        var b = e.target.closest("button"); if (!b) return;
        pop.hidden = true;
        if (b.dataset.yr === "files") openFiles();
        else { bypass = true; try { $("#annBell").click(); } finally { bypass = false; } }
      });
      document.body.appendChild(pop);
      document.addEventListener("click", function (e) { if (!pop.hidden && !e.target.closest(".yr-pop") && !e.target.closest("#annBell")) pop.hidden = true; });
      if (bell) {
        bell.addEventListener("click", function (e) {
          if (bypass || !unseen().length) return;
          e.preventDefault(); e.stopImmediatePropagation();
          var r = bell.getBoundingClientRect();
          pop.querySelector('[data-yr="files"] span:last-child').textContent = t("ملفات عامك الدراسي", "Your school-year files");
          pop.querySelector('[data-yr="ann"] span').textContent = t("الإعلانات والتنبيهات", "Announcements");
          pop.style.top = (r.bottom + 8) + "px";
          pop.style.insetInlineStart = "auto";
          pop.style.left = Math.max(8, Math.min(window.innerWidth - 250, r.left)) + "px";
          pop.hidden = !pop.hidden;
        }, true);
      }
    }
  }

  function refreshNotify() {
    var n = unseen();
    if (dot) dot.hidden = !n.length;
    if (banner) { banner.remove(); banner = null; }
    var home = $("#homeGrid");
    if (n.length && home) {
      banner = document.createElement("button");
      banner.type = "button";
      banner.className = "home-ann";
      banner.innerHTML = '<span class="home-ann__icon" aria-hidden="true">' + ICON_CAP + '</span><span class="home-ann__text"><span class="home-ann__label">' + esc(t("انتهى العام الدراسي", "School year ended")) + '</span><strong class="home-ann__title">' + esc(t("ملفاتك الدراسية جاهزة", "Your files are ready")) + '</strong><span class="home-ann__snippet">' + esc(t("درجات وملاحظات ورسوم بيانية — اضغط لفتحها", "Grades, notes and charts — tap to open")) + '</span></span>';
      banner.addEventListener("click", openFiles);
      home.parentNode.insertBefore(banner, home);
    }
  }

  function showModalOnce() {
    var n = unseen(); if (!n.length) return;
    var r = n[0];
    modal.querySelector("h3").textContent = t("انتهى العام الدراسي " + r.label, "School year " + r.label + " has ended");
    var to = gname(me.grade) || gname(r.gradeTo);
    modal.querySelector("p").textContent = t(
      "مبروك الترقية" + (to ? " لـ " + to : "") + "! جهّزنالك ملفات عامك الدراسي: ملف الدرجات، ملف الملاحظات، وملف الرسوم البيانية.",
      "Congratulations on moving up" + (to ? " to " + to : "") + "! Your files are ready: grades, notes and charts.");
    modal.querySelector('[data-yr="open"]').textContent = t("افتح الملفات", "Open files");
    modal.querySelector('[data-yr="later"]').textContent = t("لاحقًا", "Later");
    modal.hidden = false;
    requestAnimationFrame(function () { modal.classList.add("is-open"); });
  }
  function closeYr() {
    modal.classList.remove("is-open");
    setTimeout(function () { modal.hidden = true; }, 220);
  }

  /* ------------------------------------------------------------ صفحة الملفات */
  function renderPanel() {
    document.querySelectorAll("[data-yf-label]").forEach(function (el) { el.textContent = t("ملفات الأعوام الدراسية", "School-year files"); });
    var box = $("#yfList"); if (!box) return;
    var s = seenList();
    var cur = '<article class="yf-card"><h3>' + esc(t("ملفي الحالي", "My current file")) + "</h3>" +
      '<p class="yf-card__sub">' + esc(t("درجاتك وملاحظات الأستاذ وإحصائياتك لحد دلوقتي — بيتحدّث كل مرة تفتحه", "Your grades, teacher notes and stats so far — refreshed each time you open it")) + "</p>" +
      '<div class="yf-files">' +
      fileBtn("cur", "grades", ICON_DOC, t("ملف الدرجات", "Grades file")) +
      fileBtn("cur", "notes", ICON_NOTE, t("ملف الملاحظات", "Notes file")) +
      fileBtn("cur", "charts", ICON_CHART, t("ملف الرسوم البيانية", "Charts file")) +
      "</div></article>";
    if (!reports.length) {
      box.innerHTML = cur + '<div class="yf-empty">' + esc(t("لسه مفيش ملفات أعوام دراسية. هتظهر هنا لما ينتهي العام الدراسي.", "No school-year files yet. They will appear here when the year ends.")) + "</div>";
      return;
    }
    box.innerHTML = cur + reports.map(function (r, i) {
      var isNew = s.indexOf(r.key) < 0;
      var gl = gname(r.gradeFrom);
      var gradesCount = countEntries(r.grades), notesCount = (r.notes || []).length;
      return '<article class="yf-card"><h3>' + esc(t("العام الدراسي ", "School year ")) + esc(r.label) + (isNew ? '<span class="yf-new">' + esc(t("جديد", "New")) + "</span>" : "") + "</h3>" +
        '<p class="yf-card__sub">' + esc(gl) + (gl ? " · " : "") + esc(t("النقاط: ", "Points: ")) + (Number(r.points) || 0) + " · " + esc(t("درجات: ", "Grades: ")) + gradesCount + " · " + esc(t("ملاحظات: ", "Notes: ")) + notesCount + "</p>" +
        '<div class="yf-files">' +
        fileBtn(i, "grades", ICON_DOC, t("ملف الدرجات", "Grades file")) +
        fileBtn(i, "notes", ICON_NOTE, t("ملف الملاحظات", "Notes file")) +
        fileBtn(i, "charts", ICON_CHART, t("ملف الرسوم البيانية", "Charts file")) +
        "</div></article>";
    }).join("");
  }
  function fileBtn(i, kind, icon, label) {
    return '<button type="button" class="yf-file" data-i="' + i + '" data-kind="' + kind + '">' + icon + "<span>" + esc(label) + "<small>PDF</small></span></button>";
  }

  /* ------------------------------------------------------------ تطبيع البيانات (زي الأدمن) */
  function num(v) { return typeof v === "number" && isFinite(v) ? v : null; }
  function pctOf(e) {
    var p = num(e.percent); if (p == null) p = num(e.percentage);
    if (p != null) return p;
    var sc = num(e.score), tot = num(e.total); if (tot == null) tot = num(e.max); if (tot == null) tot = num(e.outOf); if (tot == null) tot = num(e.maxScore);
    if (sc != null && tot) return (sc / tot) * 100;
    return null;
  }
  function entryTs(e) {
    var raw = e.createdAt || e.date || e.timestamp || e.submittedAt || e.at || 0;
    var n = typeof raw === "number" ? raw : Date.parse(raw);
    return isFinite(n) ? n : 0;
  }
  function entryTitle(e, cat) { return e.title || e.unitTitle || e.examTitle || e.name || e.label || cat; }
  function classify(cat, e) {
    if (cat === "weekly") return "sheets";
    var hay = [e.type, e.kind, e.source, e.section, e.category, e.title, e.unitTitle, e.examTitle, e.name, e.label].join(" ");
    if (/story|قصة|القصة|chapter|فصل|الفصل/i.test(hay)) return "story";
    return "exams";
  }
  function flatten(all) {
    var out = { exams: [], sheets: [], story: [] };
    Object.keys(all || {}).forEach(function (cat) {
      var bucket = all[cat] || {};
      Object.keys(bucket).forEach(function (k) {
        var e = bucket[k];
        if (e && typeof e === "object") out[classify(cat, e)].push({ title: entryTitle(e, cat), pct: pctOf(e), ts: entryTs(e), e: e });
      });
    });
    Object.keys(out).forEach(function (g) { out[g].sort(function (a, b) { return a.ts - b.ts; }); });
    return out;
  }
  function countEntries(all) { var f = flatten(all); return f.exams.length + f.sheets.length + f.story.length; }
  function avg(list) {
    var v = list.map(function (x) { return x.pct; }).filter(function (x) { return x != null; });
    return v.length ? Math.round(v.reduce(function (a, b) { return a + b; }, 0) / v.length) : null;
  }
  function fmtDate(ts) {
    if (!ts) return "—";
    try { return new Date(ts).toLocaleDateString(isEn() ? "en-GB" : "ar-EG", { day: "numeric", month: "short", year: "numeric" }); } catch (e) { return "—"; }
  }
  function monthLabel(ts) {
    try { return new Date(ts).toLocaleDateString(isEn() ? "en-GB" : "ar-EG", { month: "long", year: "numeric" }); } catch (e) { return ""; }
  }
  function hours(sec) { var h = Math.round((Number(sec) || 0) / 360) / 10; return h; }

  var NOTE_TYPES = { warning: ["تحذير", "Warning", "#e5484d"], advice: ["نصيحة", "Advice", "#2c8097"], encourage: ["تشجيع", "Encouragement", "#2f9e5b"], alert: ["تنبيه", "Alert", "#d98a1c"] };

  /* ------------------------------------------------------------ ألوان */
  function cssVar(name, fb) {
    try { var v = getComputedStyle(document.documentElement).getPropertyValue(name).trim(); return v || fb; } catch (e) { return fb; }
  }
  function colors() {
    return { accent: cssVar("--accent", "#2c8097"), brand: cssVar("--brand", "#1d5260"), ink: "#1b2b30", soft: "#5d6b70", line: "#dfe6e8", bg: "#f4f7f8" };
  }

  /* ------------------------------------------------------------ مكوّنات HTML للـ PDF */
  function sectionTitle(txt, C) { return '<h2 style="margin:18px 0 8px;font-size:20px;font-weight:800;color:' + C.brand + ';border-inline-start:5px solid ' + C.accent + ';padding-inline-start:10px">' + esc(txt) + "</h2>"; }
  function tiles(list, C) {
    return '<div style="display:flex;flex-wrap:wrap;gap:10px;margin:6px 0 4px">' + list.map(function (x) {
      return '<div style="flex:1 1 140px;min-width:140px;background:' + C.bg + ';border:1px solid ' + C.line + ';border-radius:12px;padding:12px 14px;text-align:center"><div style="font-size:24px;font-weight:800;color:' + C.accent + '">' + esc(x[0]) + '</div><div style="font-size:13px;color:' + C.soft + '">' + esc(x[1]) + "</div></div>";
    }).join("") + "</div>";
  }
  function barRow(label, pct, C, right) {
    var p = pct == null ? 0 : Math.max(0, Math.min(100, pct));
    var col = pct == null ? C.line : pct >= 85 ? "#2f9e5b" : pct >= 70 ? C.accent : pct >= 50 ? "#d98a1c" : "#e5484d";
    return '<div style="display:flex;align-items:center;gap:10px;margin:7px 0"><div style="flex:0 0 190px;font-size:14px;font-weight:700;color:' + C.ink + ';line-height:1.4">' + esc(label) + '</div><div style="flex:1;height:18px;background:' + C.bg + ';border:1px solid ' + C.line + ';border-radius:9px;overflow:hidden"><div style="width:' + p + "%;height:100%;background:" + col + '"></div></div><div style="flex:0 0 52px;text-align:end;font-size:14px;font-weight:800;color:' + C.ink + '">' + esc(right != null ? right : (pct == null ? "—" : Math.round(pct) + "%")) + "</div></div>";
  }
  function donut(parts, C, centerTop, centerBottom) {
    var total = parts.reduce(function (a, p) { return a + p.value; }, 0);
    var R = 70, CIRC = 2 * Math.PI * R, off = 0, segs = "";
    if (total) {
      parts.forEach(function (p) {
        if (!p.value) return;
        var len = (p.value / total) * CIRC;
        segs += '<circle cx="90" cy="90" r="' + R + '" fill="none" stroke="' + p.color + '" stroke-width="26" stroke-dasharray="' + len + " " + (CIRC - len) + '" stroke-dashoffset="' + (-off) + '" transform="rotate(-90 90 90)"/>';
        off += len;
      });
    } else segs = '<circle cx="90" cy="90" r="' + R + '" fill="none" stroke="' + C.line + '" stroke-width="26"/>';
    var legend = parts.map(function (p) {
      return '<div style="display:flex;align-items:center;gap:8px;margin:6px 0;font-size:14px"><span style="width:14px;height:14px;border-radius:4px;background:' + p.color + ';display:inline-block"></span><span style="font-weight:700">' + esc(p.label) + '</span><span style="color:' + C.soft + '">' + p.value + "</span></div>";
    }).join("");
    return '<div style="display:flex;align-items:center;gap:26px;margin:8px 0"><div style="position:relative;width:180px;height:180px;flex:none"><svg width="180" height="180" viewBox="0 0 180 180">' + segs + '</svg><div style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center"><div style="font-size:26px;font-weight:800;color:' + C.ink + '">' + esc(centerTop) + '</div><div style="font-size:12px;color:' + C.soft + '">' + esc(centerBottom) + '</div></div></div><div>' + legend + "</div></div>";
  }
  function lineChart(points, C) {
    if (points.length < 2) return '<div style="color:' + C.soft + ';padding:8px 0">' + esc(t("محتاج درجتين على الأقل لرسم التطوّر.", "At least two grades are needed to draw the trend.")) + "</div>";
    var W = 640, H = 190, pad = 10;
    var xs = points.map(function (p, i) { return pad + (i * (W - 2 * pad)) / (points.length - 1); });
    var ys = points.map(function (p) { return pad + (1 - Math.max(0, Math.min(100, p.pct)) / 100) * (H - 2 * pad); });
    var d = xs.map(function (x, i) { return (i ? "L" : "M") + x.toFixed(1) + " " + ys[i].toFixed(1); }).join(" ");
    var grid = [0, 50, 100].map(function (v) { var y = pad + (1 - v / 100) * (H - 2 * pad); return '<line x1="0" x2="' + W + '" y1="' + y + '" y2="' + y + '" stroke="' + C.line + '" stroke-width="1"/>'; }).join("");
    var dots = xs.map(function (x, i) { return '<circle cx="' + x.toFixed(1) + '" cy="' + ys[i].toFixed(1) + '" r="4" fill="' + C.accent + '"/>'; }).join("");
    return '<div style="display:flex;gap:8px;align-items:stretch;direction:ltr"><div style="display:flex;flex-direction:column;justify-content:space-between;height:' + (H - 2 * pad) + 'px;margin-top:' + pad + 'px;font-size:11px;color:' + C.soft + '"><span>100%</span><span>50%</span><span>0%</span></div><svg width="' + W + '" height="' + H + '" viewBox="0 0 ' + W + " " + H + '" style="flex:1;max-width:' + W + 'px">' + grid + '<path d="' + d + '" fill="none" stroke="' + C.accent + '" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"/>' + dots + "</svg></div>" +
      '<div style="display:flex;justify-content:space-between;font-size:12px;color:' + C.soft + ';margin-top:4px"><span>' + esc(fmtDate(points[0].ts)) + "</span><span>" + esc(fmtDate(points[points.length - 1].ts)) + "</span></div>";
  }
  function columns(items, C) {
    var max = Math.max.apply(null, items.map(function (x) { return x.value; }).concat([1]));
    return '<div style="display:flex;align-items:flex-end;gap:8px;height:150px;margin-top:6px;border-bottom:1px solid ' + C.line + '">' + items.map(function (x) {
      return '<div style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;height:100%"><div style="font-size:12px;font-weight:800;color:' + C.ink + '">' + x.value + '</div><div style="width:70%;max-width:44px;height:' + Math.round((x.value / max) * 110) + 'px;background:' + C.accent + ';border-radius:6px 6px 0 0;min-height:2px"></div></div>';
    }).join("") + '</div><div style="display:flex;gap:8px;margin-top:5px">' + items.map(function (x) { return '<div style="flex:1;text-align:center;font-size:11px;color:' + C.soft + ';line-height:1.3">' + esc(x.label) + "</div>"; }).join("") + "</div>";
  }
  function chartBox(title, inner, C) {
    return '<div style="border:1px solid ' + C.line + ';border-radius:14px;padding:14px 16px;margin:12px 0"><div style="font-size:16px;font-weight:800;color:' + C.brand + ';margin-bottom:6px">' + esc(title) + "</div>" + inner + "</div>";
  }

  /* ------------------------------------------------------------ محتوى الملفات الثلاثة */
  function gradeLabel(pct) { return pct == null ? "—" : Math.round(pct) + "%"; }

  function buildGrades(r, C) {
    var f = flatten(r.grades), blocks = [];
    var all = f.exams.concat(f.sheets, f.story);
    var vals = all.map(function (x) { return x.pct; }).filter(function (x) { return x != null; });
    blocks.push(tiles([
      [avg(all) == null ? "—" : avg(all) + "%", t("المتوسط العام", "Overall average")],
      [String(all.length), t("عدد الدرجات", "Total grades")],
      [vals.length ? Math.round(Math.max.apply(null, vals)) + "%" : "—", t("أعلى درجة", "Highest")],
      [vals.length ? Math.round(Math.min.apply(null, vals)) + "%" : "—", t("أقل درجة", "Lowest")]
    ], C));
    [["exams", t("درجات الامتحانات", "Exam grades")], ["sheets", t("درجات الشيتات", "Sheet grades")], ["story", t("امتحانات فصول القصة", "Story chapter exams")]].forEach(function (g) {
      var list = f[g[0]].slice().sort(function (a, b) { return b.ts - a.ts; });
      var a = avg(list);
      blocks.push(sectionTitle(g[1] + (a != null ? " — " + t("المتوسط ", "avg ") + a + "%" : ""), C));
      if (!list.length) { blocks.push('<div style="color:' + C.soft + ';padding:4px 2px 8px">' + esc(t("مفيش درجات مسجّلة.", "No grades recorded.")) + "</div>"); return; }
      blocks.push('<div style="display:flex;gap:10px;padding:8px 12px;background:' + C.brand + ';color:#fff;border-radius:8px;font-size:13px;font-weight:700"><div style="flex:1">' + esc(t("العنوان", "Title")) + '</div><div style="flex:0 0 120px;text-align:center">' + esc(t("التاريخ", "Date")) + '</div><div style="flex:0 0 70px;text-align:center">' + esc(t("الدرجة", "Score")) + "</div></div>");
      list.forEach(function (x, i) {
        blocks.push('<div style="display:flex;gap:10px;padding:8px 12px;border-bottom:1px solid ' + C.line + ';font-size:14px;background:' + (i % 2 ? "#fff" : C.bg) + '"><div style="flex:1;font-weight:600">' + esc(x.title) + '</div><div style="flex:0 0 120px;text-align:center;color:' + C.soft + '">' + esc(fmtDate(x.ts)) + '</div><div style="flex:0 0 70px;text-align:center;font-weight:800;color:' + C.ink + '">' + esc(gradeLabel(x.pct)) + "</div></div>");
      });
    });
    return blocks;
  }

  function buildNotes(r, C) {
    var notes = (r.notes || []).slice().sort(function (a, b) { return (Number(b.createdAt) || 0) - (Number(a.createdAt) || 0); });
    var blocks = [];
    var counts = {}; notes.forEach(function (n) { counts[n.type] = (counts[n.type] || 0) + 1; });
    blocks.push(tiles([[String(notes.length), t("إجمالي الملاحظات", "Total notes")]].concat(Object.keys(NOTE_TYPES).map(function (k) { return [String(counts[k] || 0), NOTE_TYPES[k][isEn() ? 1 : 0]]; })), C));
    if (!notes.length) { blocks.push('<div style="padding:24px 4px;color:' + C.soft + '">' + esc(t("مفيش ملاحظات اتسجّلت العام ده.", "No notes were recorded this year.")) + "</div>"); return blocks; }
    var lastMonth = "";
    notes.forEach(function (n) {
      var m = monthLabel(Number(n.createdAt) || 0);
      if (m !== lastMonth) { blocks.push(sectionTitle(m, C)); lastMonth = m; }
      var ty = NOTE_TYPES[n.type] || [n.type || "—", n.type || "—", C.accent];
      blocks.push('<div style="border:1px solid ' + C.line + ';border-inline-start:5px solid ' + ty[2] + ';border-radius:10px;padding:10px 14px;margin:8px 0;background:#fff"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:5px"><span style="background:' + ty[2] + ';color:#fff;border-radius:999px;padding:2px 12px;font-size:12px;font-weight:800">' + esc(ty[isEn() ? 1 : 0]) + '</span><span style="font-size:12px;color:' + C.soft + '">' + esc(fmtDate(Number(n.createdAt) || 0)) + '</span></div><div style="font-size:14px;line-height:1.8;white-space:pre-wrap">' + esc(n.text || "") + "</div></div>");
    });
    return blocks;
  }

  function buildCharts(r, C) {
    var s = r.stats || {}, f = flatten(r.grades), blocks = [];
    var all = f.exams.concat(f.sheets, f.story).filter(function (x) { return x.pct != null; }).sort(function (a, b) { return a.ts - b.ts; });
    var days = (s.visitDays || []);
    blocks.push(tiles([
      [String(Number(r.points) || 0), t("النقاط", "Points")],
      [String(s.lessonsDone || 0), t("دروس مكتملة", "Lessons done")],
      [hours(s.learningSeconds) + " " + t("س", "h"), t("وقت التعلّم", "Learning time")],
      [String(days.length), t("أيام الدخول", "Days active")],
      [String((r.badges || []).length), t("الشارات", "Badges")],
      [avg(all) == null ? "—" : avg(all) + "%", t("متوسط الدرجات", "Average")]
    ], C));

    /* 1) متوسط كل نوع */
    var cats = [["exams", t("الامتحانات", "Exams")], ["sheets", t("الشيتات", "Sheets")], ["story", t("امتحانات القصة", "Story exams")]];
    blocks.push(chartBox(t("متوسط الدرجات لكل نوع", "Average grade by type"), cats.map(function (c) { return barRow(c[1] + " (" + f[c[0]].length + ")", avg(f[c[0]]), C); }).join(""), C));

    /* 2) تطوّر المستوى */
    blocks.push(chartBox(t("تطوّر مستواك خلال العام", "Your level over the year"), lineChart(all, C), C));

    /* 3) توزيع التقديرات */
    var bands = [
      { label: t("ممتاز (85% فأكتر)", "Excellent (85%+)"), color: "#2f9e5b", value: all.filter(function (x) { return x.pct >= 85; }).length },
      { label: t("جيد (70–84%)", "Good (70–84%)"), color: C.accent, value: all.filter(function (x) { return x.pct >= 70 && x.pct < 85; }).length },
      { label: t("مقبول (50–69%)", "Pass (50–69%)"), color: "#d98a1c", value: all.filter(function (x) { return x.pct >= 50 && x.pct < 70; }).length },
      { label: t("محتاج مجهود (أقل من 50%)", "Needs work (<50%)"), color: "#e5484d", value: all.filter(function (x) { return x.pct < 50; }).length }
    ];
    blocks.push(chartBox(t("توزيع التقديرات", "Grade distribution"), donut(bands, C, String(all.length), t("درجة", "grades")), C));

    /* 4) درجة كل امتحان/شيت (آخر 14) */
    var last = all.slice(-14).reverse();
    blocks.push(chartBox(t("درجة كل امتحان وشيت (آخر " + last.length + ")", "Each exam & sheet (latest " + last.length + ")"), last.length ? last.map(function (x) { return barRow(x.title, x.pct, C); }).join("") : '<div style="color:' + C.soft + '">' + esc(t("مفيش درجات.", "No grades.")) + "</div>", C));

    /* 5) أيام الدخول لكل شهر */
    var byMonth = {};
    days.forEach(function (d) { var k = String(d).slice(0, 7); if (/^\d{4}-\d{2}$/.test(k)) byMonth[k] = (byMonth[k] || 0) + 1; });
    var mk = Object.keys(byMonth).sort();
    blocks.push(chartBox(t("أيام الدخول في كل شهر", "Active days per month"), mk.length ? columns(mk.map(function (k) { return { label: monthLabel(Date.parse(k + "-01")), value: byMonth[k] }; }), C) : '<div style="color:' + C.soft + '">' + esc(t("مفيش بيانات دخول.", "No activity data.")) + "</div>", C));

    /* 6) النشاط في الأقسام */
    var act = [[t("دروس مكتملة", "Lessons"), s.lessonsDone || 0], [t("فصول القصة", "Story chapters"), s.storyDone || 0], [t("امتحانات", "Exams"), s.examsDone || 0], [t("امتحانات القصة", "Story exams"), s.storyExamsDone || 0], [t("شيتات", "Sheets"), s.sheetsDone || 0]];
    var mx = Math.max.apply(null, act.map(function (a) { return a[1]; }).concat([1]));
    blocks.push(chartBox(t("نشاطك في الأقسام", "Your activity by section"), act.map(function (a) { return barRow(a[0], (a[1] / mx) * 100, C, String(a[1])); }).join(""), C));
    return blocks;
  }

  /* ------------------------------------------------------------ توليد الـ PDF */
  var PW = 794, PH = 1123;
  function loadScript(src) {
    return new Promise(function (res, rej) {
      var s = document.createElement("script");
      s.src = src; s.onload = res; s.onerror = function () { rej(new Error("LOAD_FAIL")); };
      document.head.appendChild(s);
    });
  }
  async function ensureLibs() {
    if (!window.html2canvas) await loadScript("https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js");
    if (!(window.jspdf && window.jspdf.jsPDF)) await loadScript("https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js");
  }
  function brandName() { var el = $(".brand__name, .dash-brand__name, .navbar__brand span"); return (el && el.textContent.trim()) || "Shady Nasr English Platform"; }

  async function makePdf(r, kind) {
    await ensureLibs();
    if (document.fonts && document.fonts.ready) { try { await document.fonts.ready; } catch (e) { } }
    var C = colors();
    var titles = { grades: t("ملف الدرجات", "Grades file"), notes: t("ملف الملاحظات", "Notes file"), charts: t("ملف الرسوم البيانية", "Charts file") };
    var blocks = kind === "grades" ? buildGrades(r, C) : kind === "notes" ? buildNotes(r, C) : buildCharts(r, C);
    var student = (r.studentName || me.fullName || "");
    var family = getComputedStyle(document.body).fontFamily;
    var rtl = !isEn();

    var host = document.createElement("div");
    host.style.cssText = "position:absolute;left:-99999px;top:0;width:" + PW + "px;direction:" + (rtl ? "rtl" : "ltr") + ";font-family:" + family + ";letter-spacing:0;color:" + C.ink;
    document.body.appendChild(host);

    var pages = [];
    function newPage() {
      var p = document.createElement("div");
      p.style.cssText = "width:" + PW + "px;height:" + PH + "px;box-sizing:border-box;padding:0 40px 54px;background:#fff;position:relative;overflow:hidden;margin-bottom:20px";
      p.innerHTML = '<div style="margin:0 -40px 14px;padding:18px 40px;background:' + C.brand + ';color:#fff;display:flex;justify-content:space-between;align-items:center"><div><div style="font-size:22px;font-weight:800">' + esc(titles[kind]) + '</div><div style="font-size:13px;opacity:.85;margin-top:2px">' + esc(brandName()) + '</div></div><div style="text-align:end"><div style="font-size:16px;font-weight:800">' + esc(student) + '</div><div style="font-size:12px;opacity:.9">' + esc(gname(r.gradeFrom)) + " · " + esc(t("العام الدراسي ", "School year ")) + esc(r.label) + '</div></div></div><div data-body></div><div data-foot style="position:absolute;bottom:16px;left:0;right:0;text-align:center;font-size:11px;color:' + C.soft + '"></div>';
      host.appendChild(p); pages.push(p);
      return p;
    }
    var page = newPage(), body = page.querySelector("[data-body]");
    blocks.forEach(function (html) {
      var holder = document.createElement("div");
      holder.innerHTML = html;
      var el = holder.firstElementChild || holder;
      body.appendChild(el);
      if (page.scrollHeight > page.clientHeight + 1 && body.children.length > 1) {
        body.removeChild(el);
        page = newPage(); body = page.querySelector("[data-body]");
        body.appendChild(el);
      }
    });
    pages.forEach(function (p, i) { p.querySelector("[data-foot]").textContent = (i + 1) + " / " + pages.length; });

    try {
      var doc = new window.jspdf.jsPDF({ unit: "mm", format: "a4", orientation: "portrait", compress: true });
      for (var i = 0; i < pages.length; i++) {
        var canvas = await window.html2canvas(pages[i], { scale: 2, backgroundColor: "#ffffff", useCORS: true, logging: false });
        if (i) doc.addPage();
        doc.addImage(canvas.toDataURL("image/jpeg", 0.92), "JPEG", 0, 0, 210, 297);
      }
      var fname = kind + "-" + String(r.label).replace("/", "-") + "-" + String(me.id).replace(/[^A-Za-z0-9_-]/g, "").slice(0, 12) + ".pdf";
      if (window.SNPdf) await window.SNPdf.open({ blob: doc.output("blob"), title: titles[kind] + " — " + r.label, filename: fname, mime: "application/pdf" });
      else doc.save(fname);
    } finally { host.remove(); }
  }

  /* ------------------------------------------------------------ تشغيل */
  function bindPanel() {
    var list = $("#yfList"); if (!list) return;
    list.addEventListener("click", async function (e) {
      var b = e.target.closest(".yf-file"); if (!b || b.disabled) return;
      var isCur = b.dataset.i === "cur";
      var r = isCur ? null : reports[Number(b.dataset.i)];
      if (!isCur && !r) return;
      b.disabled = true;
      var small = b.querySelector("small"), old = small ? small.textContent : "";
      if (small) small.textContent = t("جاري التجهيز…", "Preparing…");
      try {
        if (isCur) { r = await SNAuth.fetchStudentSnapshot(me.id); r.studentName = r.studentName || me.fullName || ""; }
        await makePdf(r, b.dataset.kind); if (small) small.textContent = old;
      }
      catch (err) {
        console.error(err);
        if (small) small.textContent = t("تعذر التجهيز — اتأكد من النت وحاول تاني", "Failed — check your connection and retry");
        setTimeout(function () { if (small) small.textContent = old; }, 3500);
      } finally { b.disabled = false; }
    });
    document.querySelectorAll('.dash-nav__link[data-target="yearfiles"]').forEach(function (link) {
      link.addEventListener("click", function () { renderPanel(); markSeen(reports.map(function (r) { return r.key; })); refreshNotify(); });
    });
  }

  function whenAuth(cb, tries) {
    if (window.SNAuth && SNAuth.fetchYearReports) return cb();
    if ((tries || 0) > 60) return;
    setTimeout(function () { whenAuth(cb, (tries || 0) + 1); }, 250);
  }

  function start() {
    ensureUi(); bindPanel(); renderPanel();
    whenAuth(function () {
      Promise.resolve(SNAuth.fetchYearReports(me.id)).then(function (list) {
        reports = (Array.isArray(list) ? list : []).filter(function (r) { return r && (!r.uid || r.uid === me.id); });
        renderPanel(); refreshNotify(); showModalOnce();
      }).catch(function () { });
    });
    new MutationObserver(function () { if (unseen().length && !banner) refreshNotify(); }).observe(document.body, { childList: true, subtree: true });
    new MutationObserver(function () { renderPanel(); }).observe(document.documentElement, { attributes: true, attributeFilter: ["lang"] });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", function () { setTimeout(start, 300); });
  else setTimeout(start, 300);
})();

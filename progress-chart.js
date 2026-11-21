/* ==========================================================================
   progress-chart.js — رسم بياني ناعم (منحنى + تعبئة متدرّجة + خطوط رأسية + توهّج)
   بيتبنى بالكامل على بيانات Firebase الحقيقية:
     - الطالب (الصفحة الرئيسية):  grades/{id}  +  userData/{id}/visitDays
     - الأدمن (نظرة عامة):        grades (كل الطلاب) + userData (كل الطلاب) + users/createdAt
   الألوان كلها من متغيّرات المنصة (--accent / --ink / --surface-glass ...)
   فبتتغيّر مع ألوان الأدمن والدارك مود تلقائيًا.
   ========================================================================== */
(function () {
  "use strict";
  if (window.SNChart) return;

  var DAY = 864e5;
  var MAX_BACK_DAYS = 365;
  var uid = 0;

  var MONTHS_AR = ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"];
  var MONTHS_EN = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  function isEn() { return /^en/i.test(document.documentElement.lang || ""); }
  function L(ar, en) { return isEn() ? en : ar; }
  function monthName(m) { return (isEn() ? MONTHS_EN : MONTHS_AR)[m]; }
  function esc(v) { return String(v == null ? "" : v).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }

  /* ------------------------------------------------------------------ ستايل */
  var css = [
    ".snc{--snc-up:#2f8f5b;--snc-down:#c25b4d}",
    ":root[data-theme=dark] .snc{--snc-up:#81c784;--snc-down:#e57f73}",
    ".snc--home{margin:18px 0}",
    ".snc__head{display:flex;justify-content:space-between;align-items:flex-start;gap:12px 18px;flex-wrap:wrap;margin-bottom:10px}",
    ".snc__title{margin:0 0 8px !important}",
    ".snc__now{display:flex;align-items:baseline;gap:10px;flex-wrap:wrap}",
    ".snc__value{font-family:var(--font-display);font-size:2rem;font-weight:800;line-height:1;color:var(--ink)}",
    ".snc__delta{font-size:.82rem;font-weight:700;color:var(--ink-soft)}",
    ".snc__delta.is-up{color:var(--snc-up)}",
    ".snc__delta.is-down{color:var(--snc-down)}",
    ".snc__sub{margin:6px 0 0;font-size:.82rem;color:var(--ink-soft)}",
    ".snc__tabs{display:flex;gap:6px;flex-wrap:wrap}",
    ".snc__tab{border:1px solid var(--surface-glass-border);background:transparent;color:var(--ink-soft);padding:6px 13px;border-radius:var(--radius-pill);font:inherit;font-size:.84rem;font-weight:700;cursor:pointer;transition:background .2s,color .2s,border-color .2s}",
    ".snc__tab:hover{color:var(--ink)}",
    ".snc__tab.is-on{background:var(--accent);border-color:var(--accent);color:var(--accent-ink)}",
    ".snc__tab:focus-visible{outline:2px solid var(--accent);outline-offset:2px}",
    ".snc__plot{position:relative;direction:ltr;height:210px;touch-action:pan-y;user-select:none;-webkit-user-select:none}",
    ".snc__canvas{position:absolute;inset:0}",
    ".snc__svg{display:block;width:100%;height:100%;overflow:visible}",
    ".snc__grid{stroke:var(--surface-glass-border);stroke-width:1;stroke-dasharray:3 5}",
    ".snc__axis{fill:var(--ink-soft);font-size:11px;font-family:var(--font-body)}",
    ".snc__line{fill:none;stroke:var(--accent);stroke-width:2.4;stroke-linecap:round;stroke-linejoin:round;filter:drop-shadow(0 0 6px color-mix(in srgb,var(--accent) 65%,transparent))}",
    ".snc__line.is-anim{stroke-dasharray:1;stroke-dashoffset:1;animation:sncDraw .9s var(--ease,ease) forwards}",
    "@keyframes sncDraw{to{stroke-dashoffset:0}}",
    "@media (prefers-reduced-motion:reduce){.snc__line.is-anim{animation:none;stroke-dasharray:none;stroke-dashoffset:0}}",
    ".snc__line2{fill:none;stroke:var(--ink-soft);stroke-width:1.8;stroke-dasharray:5 5;stroke-linecap:round;stroke-linejoin:round;opacity:.85}",
    ".snc__legend{display:inline-flex;align-items:center;gap:6px;margin-inline-start:10px;font-size:.78rem;color:var(--ink-soft)}",
    ".snc__legend i{display:inline-block;width:18px;border-top:2px dashed var(--ink-soft)}",
    ".snc__guide{stroke:var(--accent);stroke-width:1;opacity:.55}",
    ".snc__dot{fill:var(--surface-glass);stroke:var(--accent);stroke-width:2.4}",
    ".snc__tip{position:absolute;top:0;z-index:2;pointer-events:none;padding:6px 10px;border-radius:10px;background:var(--ink);color:var(--bg);font-size:.8rem;line-height:1.35;white-space:nowrap;box-shadow:0 6px 18px rgba(0,0,0,.18);direction:rtl;text-align:center}",
    ".snc__tip b{display:block;font-size:.95rem}",
    ".snc__tip span{opacity:.75;font-size:.74rem}",
    ".snc__msg{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;text-align:center;padding:0 24px;color:var(--ink-soft);font-size:.9rem;direction:rtl}"
  ].join("\n");
  (function injectCss() {
    if (document.getElementById("snc-style")) return;
    var st = document.createElement("style");
    st.id = "snc-style";
    st.textContent = css;
    document.head.appendChild(st);
  })();

  /* ------------------------------------------------------------ أدوات بيانات */
  function dayKey(d) { return d.getFullYear() + "-" + (d.getMonth() + 1) + "-" + d.getDate(); }
  function startOfDay(ms) { var d = new Date(ms); return new Date(d.getFullYear(), d.getMonth(), d.getDate()); }

  function parseTs(raw) {
    if (raw == null || raw === "") return null;
    var n = typeof raw === "number" ? raw : Date.parse(raw);
    return isFinite(n) && n > 0 ? n : null;
  }
  function parseDayString(s) { // "YYYY-MM-DD" بالتوقيت المحلي
    var m = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(String(s));
    return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])).getTime() : null;
  }
  function numOrNull(v) {
    if (v == null || v === "") return null;
    var n = Number(v);
    return isFinite(n) ? n : null;
  }
  function pctOf(e) {
    var p = numOrNull(e.percent);
    if (p == null) p = numOrNull(e.percentage);
    if (p == null) {
      var sc = numOrNull(e.score);
      var tot = numOrNull(e.outOf);
      if (tot == null) tot = numOrNull(e.total);
      if (tot == null) tot = numOrNull(e.max);
      if (tot == null) tot = numOrNull(e.maxScore);
      if (sc != null && tot) p = (sc / tot) * 100;
    }
    return p == null ? null : Math.max(0, Math.min(100, p));
  }
  function entryTs(e) { return parseTs(e.at || e.submittedAt || e.createdAt || e.timestamp || e.date); }

  /* grades/{id} = { mcq:{..}, weekly:{..}, essay:{..} }  ->  [{t, v}] */
  function gradeEntries(gradesOfOne, out) {
    out = out || [];
    Object.keys(gradesOfOne || {}).forEach(function (cat) {
      var bucket = gradesOfOne[cat];
      if (!bucket || typeof bucket !== "object") return;
      Object.keys(bucket).forEach(function (k) {
        var e = bucket[k];
        if (!e || typeof e !== "object") return;
        var t = entryTs(e), v = pctOf(e);
        if (t != null && v != null) out.push({ t: t, v: v });
      });
    });
    return out;
  }

  /* مدى الأيام: من أول بيانات (على الأقل آخر 30 يوم) لحد النهارده */
  function buildDays(firstMs) {
    var today = startOfDay(Date.now());
    var minStart = new Date(today); minStart.setDate(minStart.getDate() - 29);
    var capStart = new Date(today); capStart.setDate(capStart.getDate() - MAX_BACK_DAYS);
    var start = firstMs != null ? startOfDay(firstMs) : minStart;
    if (start > minStart) start = minStart;
    if (start < capStart) start = capStart;
    var days = [], idx = {}, cur = new Date(start);
    while (cur <= today) {
      idx[dayKey(cur)] = days.length;
      days.push(cur.getTime());
      cur = new Date(cur.getFullYear(), cur.getMonth(), cur.getDate() + 1);
    }
    return { days: days, idx: idx };
  }
  function firstOf(list) {
    var m = null;
    list.forEach(function (t) { if (t != null && (m == null || t < m)) m = t; });
    return m;
  }

  /* متوسط الدرجات في نافذة (win) يوم — لو مفيش درجات في النافذة بنكمّل بآخر قيمة */
  function windowAvg(entries, win) {
    var R = buildDays(firstOf(entries.map(function (x) { return x.t; })));
    var sum = new Array(R.days.length).fill(0), cnt = new Array(R.days.length).fill(0);
    entries.forEach(function (x) {
      var i = R.idx[dayKey(new Date(x.t))];
      if (i != null) { sum[i] += x.v; cnt[i] += 1; }
    });
    var vals = [], prev = null, any = false;
    for (var i = 0; i < R.days.length; i++) {
      var s = 0, c = 0;
      for (var j = Math.max(0, i - win + 1); j <= i; j++) { s += sum[j]; c += cnt[j]; }
      if (c) { prev = s / c; any = true; }
      vals.push(any ? prev : null);
    }
    return { t: R.days, v: vals, has: entries.length > 0 };
  }

  /* عدد أيام النشاط في آخر 7 أيام (0..7) لطالب واحد */
  function activeDaysPerWeek(dayStrings) {
    var stamps = dayStrings.map(parseDayString).filter(function (x) { return x != null; });
    var R = buildDays(firstOf(stamps));
    var on = {};
    stamps.forEach(function (t) { on[dayKey(new Date(t))] = 1; });
    var flags = R.days.map(function (t) { return on[dayKey(new Date(t))] ? 1 : 0; });
    var vals = flags.map(function (_, i) {
      var s = 0;
      for (var j = Math.max(0, i - 6); j <= i; j++) s += flags[j];
      return s;
    });
    return { t: R.days, v: vals, has: stamps.length > 0 };
  }

  /* عدد الطلاب النشطين في اليوم (متوسط متحرّك 7 أيام) — من visitDays لكل الطلاب */
  function activeStudentsAvg(perStudentDays) {
    var all = [];
    perStudentDays.forEach(function (arr) { arr.forEach(function (s) { var t = parseDayString(s); if (t != null) all.push({ t: t, id: arr._id }); }); });
    var R = buildDays(firstOf(all.map(function (x) { return x.t; })));
    var daily = new Array(R.days.length).fill(0);
    var seen = {};
    all.forEach(function (x) {
      var key = x.id + "|" + dayKey(new Date(x.t));
      if (seen[key]) return;
      seen[key] = 1;
      var i = R.idx[dayKey(new Date(x.t))];
      if (i != null) daily[i] += 1;
    });
    var vals = daily.map(function (_, i) {
      var s = 0, n = 0;
      for (var j = Math.max(0, i - 6); j <= i; j++) { s += daily[j]; n += 1; }
      return s / n;
    });
    return { t: R.days, v: vals, has: all.length > 0 };
  }

  /* إجمالي الطلاب المسجّلين عبر الزمن */
  function cumulativeCount(stamps) {
    stamps = stamps.filter(function (x) { return x != null; });
    var R = buildDays(firstOf(stamps));
    var base = 0, add = new Array(R.days.length).fill(0);
    stamps.forEach(function (t) {
      var i = R.idx[dayKey(new Date(t))];
      if (i == null) base += 1; else add[i] += 1;
    });
    var run = base, vals = add.map(function (a) { run += a; return run; });
    return { t: R.days, v: vals, has: stamps.length > 0 };
  }

  /* ------------------------------------------------------------------ رسم */
  // منحنى ناعم بدون تجاوز للقيم (monotone cubic)
  function smoothPath(pts) {
    var n = pts.length;
    if (n < 2) return "";
    var dx = [], m = [], t = [], i;
    for (i = 0; i < n - 1; i++) {
      dx[i] = pts[i + 1].x - pts[i].x || 1e-6;
      m[i] = (pts[i + 1].y - pts[i].y) / dx[i];
    }
    t[0] = m[0]; t[n - 1] = m[n - 2];
    for (i = 1; i < n - 1; i++) t[i] = m[i - 1] * m[i] <= 0 ? 0 : (m[i - 1] + m[i]) / 2;
    for (i = 0; i < n - 1; i++) {
      if (m[i] === 0) { t[i] = 0; t[i + 1] = 0; continue; }
      var a = t[i] / m[i], b = t[i + 1] / m[i], s = a * a + b * b;
      if (s > 9) { var k = 3 / Math.sqrt(s); t[i] = k * a * m[i]; t[i + 1] = k * b * m[i]; }
    }
    var d = "M" + pts[0].x.toFixed(1) + "," + pts[0].y.toFixed(1);
    for (i = 0; i < n - 1; i++) {
      var h = dx[i] / 3;
      d += "C" + (pts[i].x + h).toFixed(1) + "," + (pts[i].y + t[i] * h).toFixed(1) + " " +
        (pts[i + 1].x - h).toFixed(1) + "," + (pts[i + 1].y - t[i + 1] * h).toFixed(1) + " " +
        pts[i + 1].x.toFixed(1) + "," + pts[i + 1].y.toFixed(1);
    }
    return d;
  }

  function fmtDateLong(ms) {
    var d = new Date(ms);
    return d.getDate() + " " + monthName(d.getMonth()) + " " + d.getFullYear();
  }
  function fmtTrim(v, dec) { return String(Math.round(v * Math.pow(10, dec)) / Math.pow(10, dec)); }

  function xTicks(ts, W) {
    var N = ts.length, out = [], i;
    if (N < 2) return out;
    var spanDays = N - 1;
    if (spanDays > 75) {
      var firsts = [];
      for (i = 1; i < N; i++) if (new Date(ts[i]).getDate() === 1) firsts.push(i);
      var step = Math.max(1, Math.ceil(firsts.length / Math.max(3, Math.floor(W / 70))));
      firsts.forEach(function (ix, k) { if (k % step === 0) out.push({ i: ix, label: monthName(new Date(ts[ix]).getMonth()) }); });
    } else {
      var every = Math.max(1, Math.ceil(spanDays / Math.max(3, Math.floor(W / 80))));
      for (i = 0; i < N; i += every) {
        var d = new Date(ts[i]);
        out.push({ i: i, label: d.getDate() + " " + monthName(d.getMonth()) });
      }
    }
    return out;
  }

  /* -------------------------------------------------------------- المكوّن
     SNChart.mount(el, { title, tabs: [{ id, label, sub, yMax, dec, unit, pct, series }] })
       series = { t:[ms...], v:[number|null...], has:boolean }   (أو null أثناء التحميل)
     بيرجّع { update(tabId, series), fail(tabId, msg), redraw() } */
  function mount(el, opts) {
    var id = "snc" + (++uid);
    var tabs = (opts.tabs || []).map(function (t) { return Object.assign({ state: "loading", series: null, dec: 0, unit: "", pct: false }, t); });
    var active = tabs.length ? tabs[0].id : null;
    var animateNext = true;

    el.classList.add("snc");
    el.innerHTML =
      '<div class="snc__head"><div class="snc__lead">' +
      '<h3 class="snc__title">' + esc(opts.title || "") + "</h3>" +
      '<div class="snc__now"><strong class="snc__value">—</strong><span class="snc__delta"></span></div>' +
      '<p class="snc__sub"></p></div>' +
      '<div class="snc__tabs" role="tablist"></div></div>' +
      '<div class="snc__plot"><div class="snc__canvas"></div><div class="snc__tip" hidden></div></div>';

    var elTabs = el.querySelector(".snc__tabs");
    var elValue = el.querySelector(".snc__value");
    var elDelta = el.querySelector(".snc__delta");
    var elSub = el.querySelector(".snc__sub");
    var plot = el.querySelector(".snc__plot");
    var canvas = el.querySelector(".snc__canvas");
    var tip = el.querySelector(".snc__tip");

    if (tabs.length < 2) elTabs.hidden = true;
    elTabs.innerHTML = tabs.map(function (t) {
      return '<button type="button" class="snc__tab" role="tab" data-tab="' + esc(t.id) + '">' + esc(t.label) + "</button>";
    }).join("");
    elTabs.addEventListener("click", function (e) {
      var b = e.target.closest("[data-tab]");
      if (!b || b.dataset.tab === active) return;
      active = b.dataset.tab;
      animateNext = true;
      draw();
    });

    function cur() { return tabs.filter(function (t) { return t.id === active; })[0]; }
    function fmtVal(tab, v) { return tab.pct ? Math.round(v) + "%" : fmtTrim(v, tab.dec) + (tab.unit ? " " + tab.unit : ""); }

    function setMessage(text) {
      canvas.innerHTML = '<div class="snc__msg">' + esc(text) + "</div>";
      elValue.textContent = "—";
      elDelta.textContent = ""; elDelta.className = "snc__delta";
    }

    function draw() {
      var tab = cur();
      if (!tab) return;
      [].forEach.call(elTabs.children, function (b) {
        var on = b.dataset.tab === tab.id;
        b.classList.toggle("is-on", on);
        b.setAttribute("aria-selected", on ? "true" : "false");
      });
      elSub.textContent = tab.sub || "";
      if (tab.overlay && tab.overlay.has) {
        var lg = document.createElement("span");
        lg.className = "snc__legend";
        lg.innerHTML = "<i></i>" + esc(tab.overlayLabel || "");
        elSub.appendChild(lg);
      }
      tip.hidden = true;

      if (tab.state === "loading") return setMessage(L("جاري تحميل البيانات…", "Loading data…"));
      if (tab.state === "error") return setMessage(tab.error || L("تعذّر تحميل البيانات.", "Couldn't load data."));
      var S = tab.series;
      if (!S || !S.has) return setMessage(tab.empty || L("لسه مفيش بيانات كفاية لرسم المنحنى.", "Not enough data yet."));

      var W = plot.clientWidth, H = plot.clientHeight;
      if (!W || !H) return; // مخفي حاليًا — ResizeObserver هيعيد الرسم لما يظهر
      var padT = 16, padB = 26, padX = 2;
      var iw = W - padX * 2, ih = H - padT - padB, N = S.t.length;
      var maxV = 0;
      S.v.forEach(function (v) { if (v != null && v > maxV) maxV = v; });
      var yMax = tab.yMax || Math.max(1, Math.ceil(maxV * 1.15 * 10) / 10);
      var xAt = function (i) { return padX + (N > 1 ? i / (N - 1) : 0.5) * iw; };
      var yAt = function (v) { return padT + ih - (Math.max(0, Math.min(v, yMax)) / yMax) * ih; };

      var pts = [];
      S.v.forEach(function (v, i) { if (v != null) pts.push({ x: xAt(i), y: yAt(v), i: i, v: v }); });
      if (!pts.length) return setMessage(tab.empty || L("لسه مفيش بيانات كفاية لرسم المنحنى.", "Not enough data yet."));

      var opts2 = [];
      if (tab.overlay && tab.overlay.has) {
        var om = {};
        tab.overlay.t.forEach(function (tt, k) { if (tab.overlay.v[k] != null) om[dayKey(new Date(tt))] = tab.overlay.v[k]; });
        S.t.forEach(function (tt, k) { var ov = om[dayKey(new Date(tt))]; if (ov != null) opts2.push({ x: xAt(k), y: yAt(ov), i: k, v: ov }); });
      }
      var line2 = opts2.length > 1 ? smoothPath(opts2) : "";
      var line = smoothPath(pts);
      var base = (padT + ih).toFixed(1);
      var area = pts.length > 1
        ? line + "L" + pts[pts.length - 1].x.toFixed(1) + "," + base + "L" + pts[0].x.toFixed(1) + "," + base + "Z"
        : "";

      var grid = [0, 1, 2, 3].map(function (k) {
        var y = (padT + (ih / 3) * k).toFixed(1);
        return '<line class="snc__grid" x1="0" x2="' + W + '" y1="' + y + '" y2="' + y + '"/>';
      }).join("");
      var ticks = xTicks(S.t, W).map(function (t) {
        var x = xAt(t.i), anchor = x < 24 ? "start" : x > W - 24 ? "end" : "middle";
        return '<text class="snc__axis" x="' + x.toFixed(1) + '" y="' + (H - 6) + '" text-anchor="' + anchor + '">' + esc(t.label) + "</text>";
      }).join("");

      var gid = id + "g", pid = id + "p", cid = id + "c";
      canvas.innerHTML =
        '<svg class="snc__svg" viewBox="0 0 ' + W + " " + H + '" role="img" aria-label="' + esc(opts.title || "") + '">' +
        "<defs>" +
        '<linearGradient id="' + gid + '" x1="0" y1="0" x2="0" y2="1">' +
        '<stop offset="0" style="stop-color:var(--accent);stop-opacity:.5"/>' +
        '<stop offset="1" style="stop-color:var(--accent);stop-opacity:.04"/></linearGradient>' +
        '<pattern id="' + pid + '" patternUnits="userSpaceOnUse" width="7" height="10"><rect width="3" height="10" style="fill:var(--accent)" opacity=".28"/></pattern>' +
        '<clipPath id="' + cid + '"><path d="' + area + '"/></clipPath></defs>' +
        grid +
        (area ? '<path d="' + area + '" fill="url(#' + gid + ')"/>' +
          '<rect x="0" y="' + padT + '" width="' + W + '" height="' + ih + '" fill="url(#' + pid + ')" clip-path="url(#' + cid + ')"/>' : "") +
        '<path class="snc__line' + (animateNext ? " is-anim" : "") + '" d="' + (line || "M" + pts[0].x + "," + pts[0].y) + '" pathLength="1"/>' +
        (line2 ? '<path class="snc__line2" d="' + line2 + '"/>' : "") +
        (pts.length === 1 ? '<circle class="snc__dot" cx="' + pts[0].x.toFixed(1) + '" cy="' + pts[0].y.toFixed(1) + '" r="5"/>' : "") +
        ticks +
        '<line class="snc__guide" x1="0" x2="0" y1="' + padT + '" y2="' + (padT + ih) + '" visibility="hidden"/>' +
        '<circle class="snc__dot" r="5" cx="0" cy="0" visibility="hidden"/>' +
        "</svg>";
      animateNext = false;

      // الرقم الحالي + الفرق
      var last = pts[pts.length - 1];
      elValue.textContent = fmtVal(tab, last.v);
      var ref = null, refIdx = last.i - 30;
      if (refIdx >= 0 && S.v[refIdx] != null) ref = { i: refIdx, v: S.v[refIdx] };
      else if (pts[0].i < last.i) ref = pts[0];
      elDelta.className = "snc__delta";
      elDelta.textContent = "";
      if (ref) {
        var diff = last.v - ref.v;
        var small = Math.abs(diff) < (tab.pct ? 0.5 : Math.pow(10, -tab.dec) / 2);
        var amount = tab.pct ? Math.round(Math.abs(diff)) + "%" : fmtTrim(Math.abs(diff), tab.dec) + (tab.unit ? " " + tab.unit : "");
        var when = last.i - ref.i >= 28 ? L("عن آخر 30 يوم", "vs last 30 days") : L("منذ أول بيانات", "since first data");
        if (small) elDelta.textContent = L("ثابت ", "Steady ") + when;
        else {
          elDelta.classList.add(diff > 0 ? "is-up" : "is-down");
          elDelta.textContent = (diff > 0 ? "▲ " : "▼ ") + amount + " " + when;
        }
      }

      // التفاعل: نقطة + خط إرشادي + تلميح
      var svg = canvas.firstChild;
      var guide = svg.querySelector(".snc__guide");
      var dot = svg.querySelectorAll(".snc__dot");
      dot = dot[dot.length - 1];
      function show(clientX) {
        var rect = plot.getBoundingClientRect();
        var x = clientX - rect.left;
        var i = Math.round(((x - padX) / iw) * (N - 1));
        var best = null, bd = 1e9;
        pts.forEach(function (p) { var d = Math.abs(p.i - i); if (d < bd) { bd = d; best = p; } });
        if (!best) return;
        guide.setAttribute("x1", best.x); guide.setAttribute("x2", best.x); guide.setAttribute("visibility", "visible");
        dot.setAttribute("cx", best.x); dot.setAttribute("cy", best.y); dot.setAttribute("visibility", "visible");
        var oh = "";
        opts2.forEach(function (o) { if (o.i === best.i) oh = "<span>" + esc(tab.overlayLabel || "") + ": " + esc(fmtVal(tab, o.v)) + "</span>"; });
        tip.innerHTML = "<b>" + esc(fmtVal(tab, best.v)) + "</b><span>" + esc(fmtDateLong(S.t[best.i])) + "</span>" + oh;
        tip.hidden = false;
        var tw = tip.offsetWidth;
        tip.style.left = Math.max(0, Math.min(W - tw, best.x - tw / 2)) + "px";
      }
      function hide() {
        guide.setAttribute("visibility", "hidden"); dot.setAttribute("visibility", "hidden"); tip.hidden = true;
      }
      plot.onpointermove = function (e) { show(e.clientX); };
      plot.onpointerdown = function (e) { show(e.clientX); };
      plot.onpointerleave = hide;
    }

    var ro = null;
    if (window.ResizeObserver) {
      var lastW = 0;
      ro = new ResizeObserver(function () {
        var w = plot.clientWidth;
        if (w && w !== lastW) { lastW = w; draw(); }
      });
      ro.observe(plot);
    } else {
      window.addEventListener("resize", draw);
    }

    draw();

    return {
      update: function (tabId, series) {
        tabs.forEach(function (t) { if (t.id === tabId) { t.series = series; t.state = "ready"; } });
        if (tabId === active) { animateNext = true; draw(); }
      },
      setOverlay: function (tabId, series, label) {
        tabs.forEach(function (t) { if (t.id === tabId) { t.overlay = series; t.overlayLabel = label; } });
        if (tabId === active) draw();
      },
      fail: function (tabId, msg) {
        tabs.forEach(function (t) { if (t.id === tabId) { t.state = "error"; t.error = msg; } });
        if (tabId === active) draw();
      },
      redraw: draw
    };
  }

  /* ================================================================
     الطالب: الصفحة الرئيسية — بيانات الطالب نفسه من Firebase
     ================================================================ */
  function readJson(key) { try { return JSON.parse(localStorage.getItem(key)); } catch (e) { return null; } }
  function asArray(v) { return Array.isArray(v) ? v : v && typeof v === "object" ? Object.keys(v).map(function (k) { return v[k]; }) : []; }

  function initStudentHome() {
    var grid = document.getElementById("homeGrid");
    if (!grid || !window.SNAuth || !SNAuth.fetchGrades) return;
    var s = readJson("shadynasr-current-user");
    if (!s || !s.id || s.role === "admin") return;

    var card = document.createElement("article");
    card.className = "dash-card snc--home";
    card.id = "homeProgressChart";
    grid.parentNode.insertBefore(card, grid.nextSibling);

    var ctrl = mount(card, {
      title: L("تطوّر مستواك", "Your progress"),
      tabs: [
        { id: "grades", label: L("الدرجات", "Grades"), sub: L("متوسط درجاتك في آخر 14 يوم (امتحانات + شيتات)", "Your average score over the last 14 days (exams + sheets)"), yMax: 100, pct: true, empty: L("هتظهر هنا بعد أول امتحان أو شيت تسلّمه.", "This appears after you submit your first exam or sheet.") },
        { id: "activity", label: L("النشاط", "Activity"), sub: L("عدد الأيام اللي دخلت فيها المنصة في كل أسبوع", "Days you visited the platform each week"), yMax: 7, dec: 1, unit: L("يوم", "days"), empty: L("لسه مفيش أيام دخول مسجّلة.", "No visits recorded yet.") }
      ]
    });

    var busy = false, lastLoad = 0;
    function load(force) {
      if (busy || (!force && Date.now() - lastLoad < 45000)) return;
      busy = true;
      Promise.all([SNAuth.fetchGrades(s.id), SNAuth.userDataGet ? SNAuth.userDataGet(s.id) : Promise.resolve({})])
        .then(function (res) {
          var entries = gradeEntries(res[0]);
          var data = res[1] || {};
          var localDays = readJson("bloom-visit-days-" + s.id) || [];
          var days = Array.from(new Set(asArray(data.visitDays).concat(asArray(localDays)).map(String)));
          ctrl.update("grades", windowAvg(entries, 14));
          ctrl.update("activity", activeDaysPerWeek(days));
          if (SNAuth.fetchClassAvg && s.grade) {
            SNAuth.fetchClassAvg(s.grade).then(function (o) {
              var cs = unpackSeries(o);
              if (cs && cs.has) ctrl.setOverlay("grades", cs, L("متوسط الصف", "Class average"));
            }).catch(function () { });
          }
          lastLoad = Date.now();
        })
        .catch(function () {
          var msg = L("تعذّر تحميل بياناتك — اتأكد من الاتصال وحاول تاني.", "Couldn't load your data — check your connection.");
          ctrl.fail("grades", msg); ctrl.fail("activity", msg);
        })
        .then(function () { busy = false; });
    }

    var panel = document.querySelector('.dash-panel[data-panel="home"]');
    if (panel && window.MutationObserver) {
      new MutationObserver(function () { if (panel.classList.contains("is-active")) load(false); })
        .observe(panel, { attributes: true, attributeFilter: ["class"] });
    }
    document.addEventListener("visibilitychange", function () {
      if (document.visibilityState === "visible" && panel && panel.classList.contains("is-active")) load(false);
    });
    load(true);
  }

  /* ================================================================
     الأدمن: نظرة عامة — بيانات كل الطلاب
     ctx = { students: [...users], grades: {uid: {...}}, userData: () => Promise<{uid:{...}}> }
     ================================================================ */
  function mountAdminOverview(el, ctx) {
    var list = ctx.students || [];
    var ids = {};
    list.forEach(function (u) { ids[u.id] = 1; });

    var entries = [];
    Object.keys(ctx.grades || {}).forEach(function (uid) { if (ids[uid]) gradeEntries(ctx.grades[uid], entries); });

    var ctrl = mount(el, {
      title: L("حركة المنصة عبر الزمن", "Platform activity over time"),
      tabs: [
        { id: "grades", label: L("متوسط الدرجات", "Average score"), sub: L("متوسط درجات كل الطلاب في آخر 14 يوم", "Average score across all students, last 14 days"), yMax: 100, pct: true, empty: L("لسه مفيش درجات مسجّلة.", "No grades recorded yet.") },
        { id: "active", label: L("النشاط", "Activity"), sub: L("عدد الطلاب النشطين يوميًا (متوسط أسبوع)", "Daily active students (7-day average)"), dec: 1, unit: L("طالب", "students"), empty: L("لسه مفيش أيام دخول مسجّلة.", "No visits recorded yet.") },
        { id: "growth", label: L("التسجيلات", "Sign-ups"), sub: L("إجمالي الطلاب المسجّلين على المنصة", "Total registered students"), unit: L("طالب", "students"), empty: L("لسه مفيش طلاب.", "No students yet.") }
      ]
    });

    ctrl.update("grades", windowAvg(entries, 14));
    ctrl.update("growth", cumulativeCount(list.map(function (u) { return parseTs(u.createdAt); })));

    Promise.resolve(ctx.userData ? ctx.userData() : {})
      .then(function (all) {
        var per = [];
        Object.keys(all || {}).forEach(function (uid) {
          if (!ids[uid]) return;
          var d = all[uid] || {};
          var arr = asArray(d.visitDays).map(String);
          arr._id = uid;
          per.push(arr);
        });
        ctrl.update("active", activeStudentsAvg(per));
      })
      .catch(function () {
        ctrl.fail("active", L("تعذّر تحميل بيانات النشاط — راجع صلاحيات Firebase على userData.", "Couldn't load activity — check Firebase rules for userData."));
      });
    return ctrl;
  }

  /* ================================================================
     متوسط الصف: الأدمن بيحسبه وينشره، والطالب بيقراه (من غير ما يشوف درجات حد)
     ================================================================ */
  function packSeries(s) {
    var d0 = new Date(s.t[0]);
    return { y: d0.getFullYear(), m: d0.getMonth() + 1, d: d0.getDate(), v: s.v.map(function (x) { return x == null ? -1 : Math.round(x * 10) / 10; }) };
  }
  function unpackSeries(o) {
    if (!o || !Array.isArray(o.v) && typeof o.v !== "object") return null;
    var arr = Array.isArray(o.v) ? o.v : Object.keys(o.v).sort(function (a, b) { return a - b; }).map(function (k) { return o.v[k]; });
    var t = [], v = [], any = false;
    for (var i = 0; i < arr.length; i++) {
      t.push(new Date(Number(o.y), Number(o.m) - 1, Number(o.d) + i).getTime());
      var x = Number(arr[i]);
      if (isFinite(x) && x >= 0) { v.push(x); any = true; } else v.push(null);
    }
    return { t: t, v: v, has: any };
  }
  function publishClassAverages(students, grades) {
    if (!window.SNAuth || !SNAuth.saveClassAvg) return;
    var last = Number(localStorage.getItem("snc-avg-published") || 0);
    if (Date.now() - last < 10 * 60 * 1000) return;
    var byGrade = {};
    (students || []).forEach(function (u) { if (u && u.grade) (byGrade[u.grade] = byGrade[u.grade] || []).push(u.id); });
    var jobs = Object.keys(byGrade).map(function (g) {
      var entries = [];
      byGrade[g].forEach(function (id) { gradeEntries((grades || {})[id] || {}, entries); });
      if (!entries.length) return Promise.resolve();
      return SNAuth.saveClassAvg(g, packSeries(windowAvg(entries, 14)));
    });
    Promise.all(jobs).then(function () { localStorage.setItem("snc-avg-published", String(Date.now())); }).catch(function () { });
  }

  /* ================================================================
     الأدمن: ملف طالب معيّن — نفس دياجرام الطالب لكن لطالب واحد
     ctx = { grades: {…grades/{id}}, userData: {…userData/{id}} }
     ================================================================ */
  function mountStudent(el, ctx) {
    var entries = gradeEntries(ctx.grades || {});
    var data = ctx.userData || {};
    var days = Array.from(new Set(asArray(data.visitDays).map(String)));
    var ctrl = mount(el, {
      title: L("تطوّر مستوى الطالب", "Student progress"),
      tabs: [
        { id: "grades", label: L("الدرجات", "Grades"), sub: L("متوسط درجات الطالب في آخر 14 يوم (امتحانات + شيتات)", "Student's average score over the last 14 days (exams + sheets)"), yMax: 100, pct: true, empty: L("لسه مفيش درجات للطالب ده.", "No grades for this student yet.") },
        { id: "activity", label: L("النشاط", "Activity"), sub: L("عدد الأيام اللي دخل فيها الطالب المنصة في كل أسبوع", "Days the student visited the platform each week"), yMax: 7, dec: 1, unit: L("يوم", "days"), empty: L("لسه مفيش نشاط للطالب ده.", "No activity for this student yet.") }
      ]
    });
    ctrl.update("grades", windowAvg(entries, 14));
    ctrl.update("activity", activeDaysPerWeek(days));
    return ctrl;
  }

  window.SNChart = { mount: mount, mountAdminOverview: mountAdminOverview, mountStudent: mountStudent, publishClassAverages: publishClassAverages, helpers: { windowAvg: windowAvg, gradeEntries: gradeEntries, pctOf: pctOf } };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", initStudentHome);
  else initStudentHome();
})();

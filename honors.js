/* ==========================================================================
   honors.js — قسم "الأوائل" في لوحة الطالب
   1) أوائل امتحان الوحدة: جدول (الاسم + الدرجة) لأعلى 10 طلاب (أو أكتر لو في تعادل)
      في آخر امتحان وحدة بيمتحنه طلاب صفّ الطالب. بيتحسب من درجات Firebase الحقيقية.
   2) أوائل الدروس: صور بيرفعها الأستاذ من لوحة الأدمن، متقسّمة حسب الشهور.
      شهر -> عناوين الصور -> صفحة الصورة + زرار تنزيل.
   يتحمّل في studenti.html بعد settings.js.
   ========================================================================== */
(() => {
  "use strict";

  const EXT = {
    ar: {
      dash_nav_honors: "الأوائل",
      hn_intro: "شوف أوائل الامتحانات في صفّك الدراسي.",
      hn_unit_title: "أوائل امتحان الوحدة", hn_unit_sub: "ترتيب الطلاب في آخر امتحان وحدة",
      hn_lessons_title: "أوائل الدروس", hn_lessons_sub: "صور الأوائل مقسّمة حسب الشهور",
      hn_back: "رجوع",
      hn_loading: "جاري التحميل…", hn_err: "تعذّر التحميل — جرّب تاني بعد شوية.",
      hn_unit_empty: "لسه مفيش طلاب امتحنوا امتحان وحدة في صفّك.",
      hn_lessons_empty: "لسه مفيش صور أوائل منشورة لصفّك.",
      hn_col_name: "الاسم", hn_col_score: "الدرجة",
      hn_top_note: "أعلى الطلاب درجة في آخر امتحان وحدة (أفضل محاولة لكل طالب).",
      hn_you: "أنت", hn_pics: "صور", hn_pic: "صورة",
      hn_download: "تنزيل الصورة", hn_img_fail: "تعذّر تحميل الصورة.",
    },
    en: {
      dash_nav_honors: "Top students",
      hn_intro: "See the top students in your grade.",
      hn_unit_title: "Unit exam toppers", hn_unit_sub: "Ranking of the latest unit exam",
      hn_lessons_title: "Lesson toppers", hn_lessons_sub: "Top-student pictures grouped by month",
      hn_back: "Back",
      hn_loading: "Loading…", hn_err: "Couldn't load — please try again shortly.",
      hn_unit_empty: "No student in your grade has taken a unit exam yet.",
      hn_lessons_empty: "No top-student pictures have been published for your grade yet.",
      hn_col_name: "Name", hn_col_score: "Score",
      hn_top_note: "Highest scores in the latest unit exam (best attempt per student).",
      hn_you: "You", hn_pics: "pictures", hn_pic: "picture",
      hn_download: "Download image", hn_img_fail: "Couldn't load the image.",
    },
  };
  if (typeof I18N !== "undefined") {
    Object.assign(I18N.ar, EXT.ar);
    Object.assign(I18N.en, EXT.en);
  }

  const lang = () => (document.documentElement.lang === "en" ? "en" : "ar");
  const tr = (k) => (EXT[lang()] && EXT[lang()][k]) || EXT.ar[k] || k;
  const esc = (v) => String(v == null ? "" : v).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const num = (v) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
  const getSession = () => { try { return JSON.parse(localStorage.getItem("shadynasr-current-user")); } catch { return null; } };

  const TOP_N = 10;
  const MEDALS = ["🥇", "🥈", "🥉"];

  // حالة الصفحة: view = hub | unit | months | month | image
  const st = { view: "hub", month: null, honor: null, honors: null, unit: null, unitLoaded: false, token: 0 };
  
  const $ = (s) => document.querySelector(s);

  function monthLabel(key) {
    const m = /^(\d{4})-(\d{2})$/.exec(String(key || ""));
    if (!m) return String(key || "—");
    const d = new Date(Number(m[1]), Number(m[2]) - 1, 1);
    const name = d.toLocaleDateString(lang() === "en" ? "en-US" : "ar-EG", { month: "long" });
    return name + " " + m[1];
  }

  function setTitle(text) {
    const t = $("#dashPanelTitle");
    if (t && text) t.textContent = text;
  }
  function hubTitle() {
    const el = document.querySelector('.dash-nav__link[data-target="honors"] span');
    return el ? el.textContent : tr("dash_nav_honors");
  }

  function show(view) {
    st.view = view;
    const hub = $("#hnHub"), sub = $("#hnSub");
    if (!hub || !sub) return;
    hub.hidden = view !== "hub";
    sub.hidden = view === "hub";
    const main = document.getElementById("dashMain");
    if (main) main.scrollTo({ top: 0, behavior: "instant" });
  }

  function body(html) { const b = $("#hnBody"); if (b) b.innerHTML = html; }
  const loading = () => body('<div class="an-empty">' + esc(tr("hn_loading")) + "</div>");
  const empty = (k) => body('<div class="an-empty">' + esc(tr(k)) + "</div>");

  /* ================= 1) أوائل امتحان الوحدة ================= */
  async function computeUnitBoard() {
    const s = getSession();
    if (!s || !window.SNAuth) throw new Error("NO_USER");
    const [users, all] = await Promise.all([SNAuth.fetchUsersByGrade(s.grade), SNAuth.fetchAllGrades()]);
    const students = (users || []).filter((u) => u && u.id && u.role !== "admin");

    // unitKey -> { number, title, rows: { uid: best } }
    const units = {};
    students.forEach((u) => {
      const mcq = ((all || {})[u.id] || {}).mcq || {};
      Object.values(mcq).forEach((e) => {
        if (!e || !e.examId) return;
        const idm = /^(.+)-attempt-\d+$/.exec(String(e.examId));
        const tm = /امتحان الوحدة\s*(\d+)\s*:?\s*(.*)$/.exec(String(e.title || ""));
        if (!idm || !tm) return;
        const outOf = num(e.outOf), score = num(e.score);
        if (outOf <= 0) return;
        const key = idm[1];
        const unit = units[key] || (units[key] = { number: num(tm[1]), title: (tm[2] || "").trim(), rows: {} });
        const pct = score / outOf;
        const cur = unit.rows[u.id];
        const at = Date.parse(e.at) || 0;
        if (!cur || pct > cur.pct || (pct === cur.pct && at && at < cur.at)) {
          unit.rows[u.id] = { id: u.id, name: u.fullName || "—", score, outOf, pct, at };
        }
      });
    });

    const list = Object.values(units);
    if (!list.length) return null;
    // آخر امتحان وحدة = أعلى رقم وحدة اتمتحنت (ولو تعادل: اللي امتحنه طلاب أكتر)
    list.sort((a, b) => b.number - a.number || Object.keys(b.rows).length - Object.keys(a.rows).length);
    const last = list[0];
    const ranked = Object.values(last.rows).sort((a, b) => b.pct - a.pct || b.score - a.score || a.at - b.at || String(a.name).localeCompare(String(b.name), "ar"));
    // أعلى 10 + أي حد متعادل مع العاشر
    let cut = Math.min(TOP_N, ranked.length);
    while (cut < ranked.length && ranked[cut].pct === ranked[TOP_N - 1].pct && ranked[cut].score === ranked[TOP_N - 1].score) cut++;
    return { number: last.number, title: last.title, rows: ranked.slice(0, cut), total: ranked.length };
  }

  function renderUnit(data) {
    if (!data) { empty("hn_unit_empty"); return; }
    const me = (getSession() || {}).id;
    const rows = data.rows.map((r, i) => {
      const medal = MEDALS[i] || String(i + 1);
      const pctTxt = Math.round(r.pct * 100) + "%";
      return '<tr class="' + (r.id === me ? "is-you" : "") + '">' +
        '<td class="hn-rank">' + medal + "</td>" +
        '<td class="hn-name">' + esc(r.name) + (r.id === me ? ' <span class="hn-you">' + esc(tr("hn_you")) + "</span>" : "") + "</td>" +
        '<td class="hn-score"><strong>' + esc(r.score + " / " + r.outOf) + "</strong><small>" + pctTxt + "</small></td></tr>";
    }).join("");
    body(
      '<div class="dash-card hn-card">' +
        '<h3 class="hn-card__title">' + esc((lang() === "en" ? "Unit " : "الوحدة ") + data.number + (data.title ? ": " + data.title : "")) + "</h3>" +
        '<p class="dash-tool-card__hint">' + esc(tr("hn_top_note")) + "</p>" +
        '<div class="hn-table-wrap"><table class="hn-table"><thead><tr><th class="hn-rank">#</th><th>' + esc(tr("hn_col_name")) + "</th><th>" + esc(tr("hn_col_score")) + "</th></tr></thead><tbody>" + rows + "</tbody></table></div>" +
      "</div>"
    );
  }

  async function openUnit() {
    show("unit");
    setTitle(tr("hn_unit_title"));
    loading();
    const my = ++st.token;
    try {
      const data = await computeUnitBoard();
      if (my !== st.token) return;
      st.unit = data;
      st.unitLoaded = true;
      renderUnit(data);
    } catch (err) {
      if (my !== st.token) return;
      console.warn("تعذر تحميل أوائل الوحدة", err);
      empty("hn_err");
    }
  }

  /* ================= 2) أوائل الدروس (صور) ================= */
  async function loadHonors() {
    const s = getSession();
    const all = await SNAuth.fetchHonors();
    return (all || []).filter((h) => h && h.id && h.grade === (s && s.grade));
  }

  function byMonth(list) {
    const map = {};
    list.forEach((h) => { (map[h.month || "—"] = map[h.month || "—"] || []).push(h); });
    return Object.keys(map).sort().reverse().map((k) => ({ key: k, items: map[k].sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || ""))) }));
  }

  const IMG_ICO = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="16" rx="3"/><circle cx="9" cy="10" r="2"/><path d="m21 16-5-5-8 9"/></svg>';
  const CAL_ICO = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="5" width="16" height="16" rx="2"/><path d="M8 3v4M16 3v4M4 10h16"/></svg>';

  function renderMonths() {
    const groups = byMonth(st.honors || []);
    if (!groups.length) { empty("hn_lessons_empty"); return; }
    body('<div class="set-tiles">' + groups.map((g) =>
      '<button type="button" class="set-tile" data-hn-month="' + esc(g.key) + '"><span class="set-tile__ico">' + CAL_ICO + "</span><strong>" + esc(monthLabel(g.key)) +
      "</strong><small>" + g.items.length + " " + esc(tr(g.items.length === 1 ? "hn_pic" : "hn_pics")) + "</small></button>"
    ).join("") + "</div>");
  }

  function renderMonth(key) {
    const g = byMonth(st.honors || []).find((x) => x.key === key);
    if (!g) { renderMonths(); st.view = "months"; return; }
    body('<div class="set-tiles">' + g.items.map((h) =>
      '<button type="button" class="set-tile" data-hn-img="' + esc(h.id) + '"><span class="set-tile__ico">' + IMG_ICO + "</span><strong dir=\"auto\">" + esc(h.title) + "</strong></button>"
    ).join("") + "</div>");
  }

  async function openLessons() {
    show("months");
    setTitle(tr("hn_lessons_title"));
    loading();
    const my = ++st.token;
    try {
      st.honors = await loadHonors();
      if (my !== st.token) return;
      renderMonths();
    } catch (err) {
      if (my !== st.token) return;
      console.warn("تعذر تحميل صور الأوائل", err);
      empty("hn_err");
    }
  }

  function openMonth(key) {
    st.month = key;
    show("month");
    setTitle(monthLabel(key));
    renderMonth(key);
  }

  async function downloadImage(dataUrl, title) {
    try {
      const blob = await (await fetch(dataUrl)).blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = (String(title || "image").replace(/[\\/:*?"<>|]+/g, " ").trim() || "image") + ".jpg";
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
    } catch {
      // احتياطي: نفتح الصورة عادي (تقدر تضغط عليها ضغطة طويلة وتحفظها)
      const a = document.createElement("a");
      a.href = dataUrl; a.download = "image.jpg"; a.click();
    }
  }

  async function openImage(id) {
    const h = (st.honors || []).find((x) => x.id === id);
    if (!h) return;
    st.honor = h;
    show("image");
    setTitle(h.title);
    loading();
    const my = ++st.token;
    try {
      const url = await SNAuth.fetchHonorImage(id);
      if (my !== st.token) return;
      if (!url || !/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(url)) { empty("hn_img_fail"); return; }
      body(
        '<div class="dash-card hn-view">' +
          '<h3 class="hn-card__title" dir="auto">' + esc(h.title) + "</h3>" +
          '<img class="hn-view__img" alt="' + esc(h.title) + '" />' +
          '<button type="button" class="btn btn--accent hn-view__dl" id="hnDownload">' + esc(tr("hn_download")) + "</button>" +
        "</div>"
      );
      const img = document.querySelector(".hn-view__img");
      img.src = url; // بنحط المصدر بعد التحقق، مش جوه الـ HTML
      $("#hnDownload").addEventListener("click", () => downloadImage(url, h.title));
    } catch (err) {
      if (my !== st.token) return;
      console.warn("تعذر تحميل الصورة", err);
      empty("hn_img_fail");
    }
  }

  /* ================= التنقل ================= */
  function goHub() {
    st.token++;
    show("hub");
    setTitle(hubTitle());
  }

  function back() {
    switch (st.view) {
      case "image": show("month"); setTitle(monthLabel(st.month)); renderMonth(st.month); break;
      case "month": show("months"); setTitle(tr("hn_lessons_title")); renderMonths(); break;
      default: goHub();
    }
  }

  function rerender() {
    if (st.view === "unit" && st.unitLoaded) { setTitle(tr("hn_unit_title")); renderUnit(st.unit); }
    else if (st.view === "months") { setTitle(tr("hn_lessons_title")); renderMonths(); }
    else if (st.view === "month") { setTitle(monthLabel(st.month)); renderMonth(st.month); }
    else if (st.view === "image" && st.honor) { openImage(st.honor.id); }
    else if (st.view === "hub") setTitle(hubTitle());
  }

  document.addEventListener("DOMContentLoaded", () => {
    const panel = document.querySelector('[data-panel="honors"]');
    if (!panel) return;

    panel.querySelectorAll("[data-hn-open]").forEach((b) => b.addEventListener("click", () => {
      if (b.dataset.hnOpen === "unit") openUnit(); else openLessons();
    }));
    $("#hnBack").addEventListener("click", back);
    $("#hnBody").addEventListener("click", (e) => {
      const m = e.target.closest("[data-hn-month]");
      if (m) { openMonth(m.dataset.hnMonth); return; }
      const i = e.target.closest("[data-hn-img]");
      if (i) openImage(i.dataset.hnImg);
    });

    // كل مرة تتفتح "الأوائل" تبدأ بالصفحة الرئيسية بتاعتها
    let was = panel.classList.contains("is-active");
    new MutationObserver(() => {
      const now = panel.classList.contains("is-active");
      if (now && !was) { st.token++; show("hub"); }
      was = now;
    }).observe(panel, { attributes: true, attributeFilter: ["class"] });

    // إعادة رسم لما اللغة تتغير
    if (typeof window.applyLanguage === "function") {
      const orig = window.applyLanguage;
      window.applyLanguage = function () {
        const r = orig.apply(this, arguments);
        if (panel.classList.contains("is-active")) rerender();
        return r;
      };
    }
  });
})();

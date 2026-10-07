/* ==========================================================================
   admin-notes.js — ملاحظات الأستاذ للطالب (تحذير / نصيحة / تشجيع / تنبيه)
   - بتوصل لحظيًا من Firebase (adminNotes/{id}).
   - قسم "ملاحظات الأستاذ" في لوحة الطالب (مربع في الرئيسية + رابط في القائمة)
     بيفتح صفحة فيها كل الملاحظات، وفوقها فلتر بالنوع وفلتر بالشهر.
   - في الإشعارات: عدّاد الجرس وعدّاد "المزيد" بيزيد بالملاحظات الجديدة،
     وكارت صغير في قسم الإعلانات بيفتح صفحة الملاحظات، وتنبيه (toast) لحظة الوصول.
   يتحمّل في studenti.html بعد announcements.js.
   ========================================================================== */
(() => {
  "use strict";

  const TYPES = {
    warning:   { ar: "تحذير", en: "Warning",     color: "#d64545", icon: '<path d="M12 3 2 20h20L12 3Z"/><path d="M12 10v4M12 17.5v.01"/>' },
    advice:    { ar: "نصيحة", en: "Advice",      color: "#2c8097", icon: '<path d="M9 18h6M10 21h4"/><path d="M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3Z"/>' },
    encourage: { ar: "تشجيع", en: "Encouragement", color: "#2f8a5b", icon: '<path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9L12 3Z"/>' },
    alert:     { ar: "تنبيه", en: "Alert",       color: "#d98a1c", icon: '<path d="M6 8a6 6 0 0 1 12 0c0 7 3 8 3 8H3s3-1 3-8"/><path d="M10.3 20a2 2 0 0 0 3.4 0"/>' },
  };
  const TXT = {
    ar: {
      nav: "ملاحظات الأستاذ", intro: "كل الملاحظات اللي بعتها لك الأستاذ: تحذيرات، نصايح، تشجيع وتنبيهات.",
      f_type: "النوع", f_month: "الشهر", all_types: "كل الأنواع", all_months: "كل الشهور",
      empty: "لسه مفيش ملاحظات من الأستاذ.", empty_f: "مفيش ملاحظات بالفلتر ده.",
      from: "من الأستاذ", fresh: "جديد", tile_none: "لسه مفيش ملاحظات.", tile_new: "ملاحظة جديدة", tile_all: "ملاحظة", open: "افتح الصفحة",
      toast: "ملاحظة جديدة من الأستاذ: ", ann_card: "عندك ملاحظات جديدة من الأستاذ", ann_go: "افتح صفحة الملاحظات",
    },
    en: {
      nav: "Teacher's notes", intro: "All the notes your teacher sent you: warnings, advice, encouragement and alerts.",
      f_type: "Type", f_month: "Month", all_types: "All types", all_months: "All months",
      empty: "No notes from your teacher yet.", empty_f: "No notes match this filter.",
      from: "From your teacher", fresh: "New", tile_none: "No notes yet.", tile_new: "new note(s)", tile_all: "note(s)", open: "Open page",
      toast: "New note from your teacher: ", ann_card: "You have new notes from your teacher", ann_go: "Open the notes page",
    },
  };
  if (typeof I18N !== "undefined") {
    I18N.ar.dash_nav_teachernotes = TXT.ar.nav;
    I18N.en.dash_nav_teachernotes = TXT.en.nav;
  }
  const lang = () => (document.documentElement.lang === "en" ? "en" : "ar");
  const tr = (k) => TXT[lang()][k] || TXT.ar[k] || k;
  const typeName = (k) => (TYPES[k] || TYPES.advice)[lang()];
  const esc = (v) => String(v == null ? "" : v).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  let notes = [];
  let seen = new Set();
  let first = true;
  let uid = null;
  const flt = { type: "", month: "" };
  const ann = {};
  const written = {};

  const seenKey = () => "shadynasr-adminnote-seen:" + uid; // بينتهي بـ ":id" فبيتمسح مع بيانات الطالب لو اتحذف
  function loadSeen() { try { seen = new Set(JSON.parse(localStorage.getItem(seenKey())) || []); } catch (e) { seen = new Set(); } }
  function saveSeen() { try { localStorage.setItem(seenKey(), JSON.stringify([...seen])); } catch (e) { /* ignore */ } }
  const unseen = () => notes.filter((n) => !seen.has(n.id)).length;
  const panel = () => document.querySelector('[data-panel="teachernotes"]');
  const panelOpen = () => { const p = panel(); return !!(p && p.classList.contains("is-active")); };

  const monthKey = (ts) => { const d = new Date(Number(ts) || 0); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0"); };
  function monthLabel(key) {
    const m = /^(\d{4})-(\d{2})$/.exec(String(key || ""));
    if (!m) return String(key || "—");
    const d = new Date(Number(m[1]), Number(m[2]) - 1, 1);
    return d.toLocaleDateString(lang() === "en" ? "en-US" : "ar-EG", { month: "long" }) + " " + m[1];
  }
  function fmt(ts) {
    const t = Number(ts);
    return t > 0 ? new Date(t).toLocaleString(lang() === "en" ? "en-US" : "ar-EG", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }) : "";
  }

  /* ---------- العدّادات (الجرس + المزيد) ---------- */
  function readBadge(el) { return el.hidden ? 0 : (parseInt(el.textContent, 10) || 0); }
  function applyBadge(el) {
    if (!el) return;
    const total = (ann[el.id] || 0) + unseen();
    written[el.id] = { text: String(total), hidden: total <= 0 };
    el.textContent = String(total);
    el.hidden = total <= 0;
  }
  function watchBadge(el) {
    if (!el) return;
    ann[el.id] = readBadge(el);
    new MutationObserver(() => {
      const w = written[el.id];
      if (w && el.hidden === w.hidden && el.textContent === w.text) return;
      ann[el.id] = readBadge(el);
      applyBadge(el);
    }).observe(el, { attributes: true, attributeFilter: ["hidden"], childList: true, characterData: true, subtree: true });
  }
  function refreshBadges() {
    applyBadge(document.getElementById("annBellBadge"));
    applyBadge(document.getElementById("annMoreBadge"));
  }

  /* ---------- ملخّص مربع الرئيسية ---------- */
  function summary() {
    const u = unseen();
    if (u) return u + " " + tr("tile_new");
    return notes.length ? notes.length + " " + tr("tile_all") : tr("tile_none");
  }
  window.snTeacherNotes = { summary };
  function refreshTile() {
    const el = document.querySelector(".home-tile--teachernotes .home-tile__body");
    if (el) el.innerHTML = '<span class="home-lesson__sub">' + esc(summary()) + "</span>";
  }

  /* ---------- كارت صغير في قسم الإعلانات ---------- */
  function injectStyle() {
    if (document.getElementById("adminNotesCss")) return;
    const s = document.createElement("style");
    s.id = "adminNotesCss";
    s.textContent =
      ".tn-filters{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:16px}" +
      "@media(max-width:480px){.tn-filters{grid-template-columns:1fr}}" +
      ".tn-filters .form-field{margin:0}" +
      ".tn-list{display:grid;gap:12px}" +
      ".an-card--note{border-inline-start:4px solid var(--nc)}" +
      ".an-card--note .an-card__icon{color:var(--nc);background:color-mix(in srgb,var(--nc) 14%,transparent)}" +
      ".tn-ann{width:100%;margin-bottom:12px;text-align:start;cursor:pointer;font:inherit;color:inherit}" +
      ".tn-ann[hidden]{display:none}";
    document.head.appendChild(s);
  }
  function renderAnnCard() {
    let b = document.getElementById("tnAnnCard");
    const list = document.getElementById("annList");
    if (!b) {
      if (!list || !list.parentNode) return;
      b = document.createElement("button");
      b.type = "button";
      b.id = "tnAnnCard";
      b.className = "an-card an-card--note tn-ann";
      b.style.setProperty("--nc", TYPES.advice.color);
      b.addEventListener("click", () => { const l = document.querySelector('.dash-nav__link[data-target="teachernotes"]'); if (l) l.click(); });
      list.parentNode.insertBefore(b, list);
    }
    const u = unseen();
    b.hidden = !u;
    b.innerHTML = '<div class="an-card__head"><span class="an-card__icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' + TYPES.advice.icon + "</svg></span>" +
      '<div class="an-card__meta"><strong class="an-card__title">' + esc(tr("ann_card")) + " (" + u + ")</strong>" +
      '<span class="an-card__sub">' + esc(tr("ann_go")) + "</span></div></div>";
  }

  /* ---------- صفحة الملاحظات ---------- */
  function buildFilters() {
    const t = document.getElementById("tnType"), m = document.getElementById("tnMonth");
    if (!t || !m) return;
    t.innerHTML = '<option value="">' + esc(tr("all_types")) + "</option>" + Object.keys(TYPES).map((k) => '<option value="' + k + '">' + esc(typeName(k)) + "</option>").join("");
    const months = [...new Set(notes.map((n) => monthKey(n.createdAt)))].sort().reverse();
    m.innerHTML = '<option value="">' + esc(tr("all_months")) + "</option>" + months.map((k) => '<option value="' + k + '">' + esc(monthLabel(k)) + "</option>").join("");
    if (!months.includes(flt.month)) flt.month = "";
    t.value = flt.type; m.value = flt.month;
    const lt = document.querySelector('label[for="tnType"]'), lm = document.querySelector('label[for="tnMonth"]');
    if (lt) lt.textContent = tr("f_type");
    if (lm) lm.textContent = tr("f_month");
    const intro = document.getElementById("tnIntro");
    if (intro) intro.textContent = tr("intro");
  }
  function renderList() {
    const host = document.getElementById("tnList");
    if (!host) return;
    const rows = notes
      .filter((n) => (!flt.type || n.type === flt.type) && (!flt.month || monthKey(n.createdAt) === flt.month))
      .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    if (!rows.length) { host.innerHTML = '<div class="an-empty">' + esc(tr(notes.length ? "empty_f" : "empty")) + "</div>"; return; }
    host.innerHTML = rows.map((n) => {
      const t = TYPES[n.type] || TYPES.advice;
      const isNew = !seen.has(n.id);
      return '<article class="an-card an-card--note' + (isNew ? " is-new" : "") + '" style="--nc:' + t.color + '">' +
        '<div class="an-card__head"><span class="an-card__icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' + t.icon + "</svg></span>" +
        '<div class="an-card__meta"><strong class="an-card__title">' + esc(typeName(n.type)) + '</strong><span class="an-card__sub">' + esc(tr("from")) + " · " + esc(fmt(n.createdAt)) + "</span></div>" +
        (isNew ? '<span class="an-new">' + esc(tr("fresh")) + "</span>" : "") + "</div>" +
        '<p class="an-card__body" dir="auto">' + esc(n.text) + "</p></article>";
    }).join("");
  }
  function renderPage() { buildFilters(); renderList(); }

  function markAllSeen() {
    let changed = false;
    notes.forEach((n) => { if (!seen.has(n.id)) { seen.add(n.id); changed = true; } });
    if (changed) { saveSeen(); refreshBadges(); renderAnnCard(); refreshTile(); }
  }

  function onData(list) {
    const prev = new Set(notes.map((n) => n.id));
    notes = (list || []).filter((n) => n && n.id && n.text);
    if (!first) {
      const fresh = notes.filter((n) => !prev.has(n.id) && !seen.has(n.id));
      if (fresh.length && window.snDialog && window.snDialog.toast) {
        window.snDialog.toast(tr("toast") + typeName(fresh[fresh.length - 1].type));
      }
    }
    first = false;
    renderPage();
    refreshBadges();
    renderAnnCard();
    refreshTile();
    if (panelOpen()) setTimeout(() => { if (panelOpen()) { markAllSeen(); } }, 2000);
  }

  function setTitle() {
    const t = document.getElementById("dashPanelTitle");
    if (t) t.textContent = tr("nav");
  }

  document.addEventListener("DOMContentLoaded", () => {
    let s = null;
    try { s = JSON.parse(localStorage.getItem("shadynasr-current-user")); } catch (e) { /* ignore */ }
    if (!s || !s.id || s.role === "admin" || !window.SNAuth || !SNAuth.watchAdminNotes) return;
    uid = s.id;
    loadSeen();
    injectStyle();
    watchBadge(document.getElementById("annBellBadge"));
    watchBadge(document.getElementById("annMoreBadge"));

    const t = document.getElementById("tnType"), m = document.getElementById("tnMonth");
    if (t) t.addEventListener("change", () => { flt.type = t.value; renderList(); });
    if (m) m.addEventListener("change", () => { flt.month = m.value; renderList(); });

    const p = panel();
    if (p) {
      let was = p.classList.contains("is-active");
      new MutationObserver(() => {
        const now = p.classList.contains("is-active");
        if (now && !was) {
          flt.type = ""; flt.month = "";
          setTitle(); renderPage();
          // نسيب علامة "جديد" ثانيتين قبل ما نعتبر الملاحظات اتشافت
          setTimeout(() => { if (panelOpen()) markAllSeen(); }, 2000);
        }
        was = now;
      }).observe(p, { attributes: true, attributeFilter: ["class"] });
    }

    if (typeof window.applyLanguage === "function") {
      const orig = window.applyLanguage;
      window.applyLanguage = function () {
        const r = orig.apply(this, arguments);
        renderPage(); renderAnnCard(); refreshTile();
        if (panelOpen()) setTitle();
        return r;
      };
    }

    SNAuth.watchAdminNotes(uid, onData, () => {});
  });
})();

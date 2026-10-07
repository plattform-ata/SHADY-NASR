/* ==========================================================================
   announcements.js — الإعلانات والتنبيهات في لوحة الطالب
   - جرس جنب دايرة الحساب + عدّاد للإعلانات اللي لسه ما اتشافتش
   - صفحة "الإعلانات" (جزء من أقسام "المزيد")
   - شريط "آخر إعلان" في الصفحة الرئيسية
   - الإعلان بيوصل لكل الطلاب (target = "all") أو لصف معيّن (target = مفتاح الصف)
   يتحمّل في studenti.html بعد home.js.
   ========================================================================== */
(() => {
  "use strict";

  const EXT = {
    ar: {
      dash_nav_announcements: "الإعلانات",
      ann_intro: "إعلانات وتنبيهات من إدارة المنصة: مواعيد الامتحانات، الحصص الإضافية، ورسائل التشجيع.",
      ann_empty: "مفيش إعلانات حاليًا.",
      ann_loading: "جاري التحميل…",
      ann_error: "تعذر تحميل الإعلانات. حاول مرة تانية بعد شوية.",
      ann_new: "جديد",
      ann_home_new: "إعلان جديد",
      ann_home_last: "آخر إعلان",
      ann_updated: "معدّل",
      ann_t_general: "عام", ann_t_exam: "ميعاد امتحان", ann_t_extra: "حصة إضافية", ann_t_motivation: "رسالة تشجيع",
      ann_aria: "الإعلانات والتنبيهات",
    },
    en: {
      dash_nav_announcements: "Announcements",
      ann_intro: "Announcements and alerts from the platform: exam dates, extra classes and encouragement messages.",
      ann_empty: "No announcements right now.",
      ann_loading: "Loading…",
      ann_error: "Couldn't load announcements. Please try again later.",
      ann_new: "New",
      ann_home_new: "New announcement",
      ann_home_last: "Latest announcement",
      ann_updated: "edited",
      ann_t_general: "General", ann_t_exam: "Exam date", ann_t_extra: "Extra class", ann_t_motivation: "Encouragement",
      ann_aria: "Announcements and alerts",
    },
  };
  if (typeof I18N !== "undefined") {
    Object.assign(I18N.ar, EXT.ar);
    Object.assign(I18N.en, EXT.en);
  }

  const $ = (s, r = document) => r.querySelector(s);
  const curLang = () => (document.documentElement.lang === "en" ? "en" : "ar");
  const tr = (k) => (EXT[curLang()] && EXT[curLang()][k]) || EXT.ar[k] || k;
  const esc = (v) => String(v == null ? "" : v).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  function getSession() {
    try { return JSON.parse(localStorage.getItem("shadynasr-current-user")); } catch { return null; }
  }

  const ICONS = {
    general: '<path d="M3 11v2a1 1 0 0 0 1 1h2l5 4V6L6 10H4a1 1 0 0 0-1 1Z"/><path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 6a9 9 0 0 1 0 12"/>',
    exam: '<rect x="4" y="5" width="16" height="16" rx="2"/><path d="M8 3v4M16 3v4M4 10h16"/>',
    extra: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    motivation: '<path d="m12 3 2.6 5.6 6.1.7-4.5 4.2 1.2 6L12 16.6 6.6 19.5l1.2-6L3.3 9.3l6.1-.7Z"/>',
  };
  const svg = (type) => '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' + (ICONS[type] || ICONS.general) + "</svg>";

  const state = { list: null, error: false, seen: 0, fresh: new Set() };

  const SEEN_KEY = () => { const s = getSession(); return "shadynasr-ann-seen:" + (s && s.id ? s.id : "guest"); };
  const loadSeen = () => { try { return Number(localStorage.getItem(SEEN_KEY())) || 0; } catch { return 0; } };
  const saveSeen = (t) => { try { localStorage.setItem(SEEN_KEY(), String(t)); } catch { /* ignore */ } };

  const ts = (a) => { const t = Date.parse(a.createdAt); return Number.isFinite(t) ? t : 0; };
  // الإعلان المعدّل بيتحسب جديد تاني
  const latestTs = (a) => { const u = Date.parse(a.updatedAt); return Math.max(ts(a), Number.isFinite(u) ? u : 0); };
  const typeOf = (a) => (ICONS[a.type] ? a.type : "general");

  const fmtDate = (v) => {
    const t = Date.parse(v);
    return Number.isFinite(t) ? new Date(t).toLocaleDateString(curLang() === "en" ? "en-GB" : "ar-EG", { year: "numeric", month: "short", day: "numeric" }) : "";
  };

  function visibleToMe(list) {
    const s = getSession();
    const grade = s && s.grade;
    return (list || [])
      .filter((a) => a && a.title && (!a.target || a.target === "all" || a.target === grade))
      .sort((a, b) => latestTs(b) - latestTs(a));
  }

  const panelActive = () => { const p = $('[data-panel="announcements"]'); return !!(p && p.classList.contains("is-active")); };

  /* ---------- رسم ---------- */
  function renderBadges(unread) {
    const bell = $("#annBell");
    const b1 = $("#annBellBadge");
    const b2 = $("#annMoreBadge");
    const label = unread > 9 ? "9+" : String(unread);
    [b1, b2].forEach((b) => { if (b) { b.hidden = unread === 0; b.textContent = label; } });
    if (bell) bell.classList.toggle("has-unread", unread > 0);
  }

  function renderList(list) {
    const box = $("#annList");
    if (!box) return;
    if (state.error) { box.innerHTML = '<div class="an-empty">' + esc(tr("ann_error")) + "</div>"; return; }
    if (state.list == null) { box.innerHTML = '<div class="an-empty">' + esc(tr("ann_loading")) + "</div>"; return; }
    if (!list.length) { box.innerHTML = '<div class="an-empty">' + esc(tr("ann_empty")) + "</div>"; return; }
    box.innerHTML = list.map((a) => {
      const type = typeOf(a);
      const isNew = state.fresh.has(a.id);
      return '<article class="an-card an-card--' + type + (isNew ? " is-new" : "") + '">' +
        '<div class="an-card__head"><span class="an-card__icon" aria-hidden="true">' + svg(type) + "</span>" +
        '<div class="an-card__meta"><strong class="an-card__title">' + esc(a.title) + "</strong>" +
        '<span class="an-card__sub">' + esc(tr("ann_t_" + type)) + " · " + esc(fmtDate(a.createdAt)) + (a.updatedAt ? " · " + esc(tr("ann_updated")) : "") + "</span></div>" +
        (isNew ? '<span class="an-new">' + esc(tr("ann_new")) + "</span>" : "") + "</div>" +
        '<p class="an-card__body" dir="auto">' + esc(a.body) + "</p></article>";
    }).join("");
  }

  function renderHomeStrip(list, unread) {
    const strip = $("#homeAnn");
    if (!strip) return;
    if (!list.length) { strip.hidden = true; return; }
    const a = list[0];
    strip.hidden = false;
    const icon = $(".home-ann__icon", strip);
    if (icon) icon.innerHTML = svg(typeOf(a));
    $("#homeAnnLabel").textContent = unread > 0 ? tr("ann_home_new") : tr("ann_home_last");
    $("#homeAnnTitle").textContent = a.title;
    $("#homeAnnSnippet").textContent = a.body || "";
  }

  function render() {
    const list = visibleToMe(state.list);
    const unread = list.filter((a) => latestTs(a) > state.seen).length;
    renderBadges(unread);
    renderList(list);
    renderHomeStrip(list, unread);
  }

  /* ---------- "اتشاف": بنسجّل آخر وقت فتح فيه الطالب صفحة الإعلانات ---------- */
  function markSeen() {
    const list = visibleToMe(state.list);
    if (!list.length) return;
    const newest = Math.max(...list.map(latestTs));
    // الكروت الجديدة تفضل متعلّمة بـ "جديد" طول الزيارة دي
    list.forEach((a) => { if (latestTs(a) > state.seen) state.fresh.add(a.id); });
    if (newest > state.seen) { state.seen = newest; saveSeen(newest); }
  }

  function onData(list) {
    state.list = list;
    state.error = false;
    if (panelActive()) markSeen();
    render();
  }

  function onError() {
    state.error = true;
    render();
  }

  /* ---------- تنقّل ---------- */
  function openPanel() {
    const link = $('.dash-nav__link[data-target="announcements"]');
    if (link) link.click();
  }

  function init() {
    if (!$("#annList")) return;
    state.seen = loadSeen();
    render();

    const bell = $("#annBell");
    if (bell) { bell.setAttribute("aria-label", tr("ann_aria")); bell.addEventListener("click", openPanel); }
    const strip = $("#homeAnn");
    if (strip) strip.addEventListener("click", openPanel);

    // لما صفحة الإعلانات تتفتح: نعلّم الإعلانات كمتشافة، ولما تتقفل نشيل علامة "جديد"
    const panel = $('[data-panel="announcements"]');
    if (panel) {
      let was = false;
      new MutationObserver(() => {
        const now = panelActive();
        if (now && !was) { markSeen(); render(); }
        if (!now && was) { state.fresh.clear(); render(); }
        was = now;
      }).observe(panel, { attributes: true, attributeFilter: ["class"] });
    }

    // متابعة لحظية من Firebase (الإعلان الجديد بيظهر من غير ما الطالب يعمل ريفريش)
    if (window.SNAuth && SNAuth.watchAnnouncements) {
      try { SNAuth.watchAnnouncements(onData, onError); } catch { onError(); }
    } else {
      onError();
    }

    // إعادة الرسم عند تغيير اللغة
    if (typeof applyLanguage === "function") {
      const orig = applyLanguage;
      window.applyLanguage = function (lang) {
        const r = orig.apply(this, arguments);
        render();
        return r;
      };
    }
  }

  document.addEventListener("DOMContentLoaded", init);
})();

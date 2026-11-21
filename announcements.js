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
      ann_intro: "",
      ann_empty: "مفيش إعلانات حاليًا.",
      ann_loading: "جاري التحميل…",
      ann_error: "تعذر تحميل الإعلانات. حاول مرة تانية بعد شوية.",
      ann_new: "جديد",
      ann_home_new: "إعلان جديد",
      ann_home_last: "آخر إعلان",
      ann_updated: "معدّل",
      ann_t_general: "عام", ann_t_exam: "ميعاد امتحان", ann_t_extra: "حصة إضافية", ann_t_motivation: "رسالة تشجيع",
      ann_aria: "الإعلانات والتنبيهات",
      ann_t_certificate: "شهادة تقدير", ann_cert_view: "عرض الشهادة", ann_cert_download: "تحميل الشهادة", ann_cert_fail: "تعذر فتح الشهادة — حاول تاني بعد شوية",
    },
    en: {
      dash_nav_announcements: "Announcements",
      ann_intro: "",
      ann_empty: "No announcements right now.",
      ann_loading: "Loading…",
      ann_error: "Couldn't load announcements. Please try again later.",
      ann_new: "New",
      ann_home_new: "New announcement",
      ann_home_last: "Latest announcement",
      ann_updated: "edited",
      ann_t_general: "General", ann_t_exam: "Exam date", ann_t_extra: "Extra class", ann_t_motivation: "Encouragement",
      ann_aria: "Announcements and alerts",
      ann_t_certificate: "Certificate", ann_cert_view: "View certificate", ann_cert_download: "Download certificate", ann_cert_fail: "Couldn't open the certificate. Please try again later.",
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
    certificate: '<circle cx="12" cy="9" r="5.5"/><path d="M8.6 13.6 7 21l5-3 5 3-1.6-7.4"/><path d="m10 9 1.4 1.4L14.2 7.6"/>',
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
      .filter((a) => !a.to || (s && a.to === s.id))
      .sort((a, b) => latestTs(b) - latestTs(a));
  }

  const panelActive = () => { const p = $('[data-panel="announcements"]'); return !!(p && p.classList.contains("is-active")); };

  /* ---------- رسم ---------- */
  function renderBadges(unread) {
    // عدّاد الجرس بقى في notifications.js؛ هنا بس عدّاد قسم "الإعلانات" في قايمة المزيد
    const b2 = $("#annMoreBadge");
    const label = unread > 9 ? "9+" : String(unread);
    if (b2) { b2.hidden = unread === 0; b2.textContent = label; }
  }

  const filesOf = (a) => { const f = a && a.files; return !f ? [] : (Array.isArray(f) ? f : Object.keys(f).map((k) => f[k])).filter(Boolean); };
  const fileIcon = (type) => '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    (/^image\//.test(type) ? '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="1.8"/><path d="m21 16-5-5-9 9"/>' : '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8Z"/><path d="M14 3v5h5M9 13h6M9 17h6"/>') + "</svg>";
  function filesHtml(a) {
    const fs = filesOf(a);
    if (!fs.length) return "";
    return '<div class="an-files">' + fs.map((f) =>
      '<button type="button" class="an-file an-file--doc" data-ann="' + esc(a.id) + '" data-fid="' + esc(f.id) + '" data-name="' + esc(f.name) + '" data-type="' + esc(f.type) + '" data-drive="' + esc(f.driveId || "") + '">' +
      (window.SNTransfer ? window.SNTransfer.fileLabel(f.name, f.size, fileIcon(f.type)) : fileIcon(f.type) + "<span>" + esc(f.name) + "</span>") + "</button>").join("") + "</div>";
  }

  const certHtml = (a) => !a || !a.cert ? "" :
    '<div class="an-files">' +
    '<button type="button" class="an-file an-cert-btn" data-cert="' + esc(a.cert) + '" data-act="view">' + fileIcon("image/png") + "<span>" + esc(tr("ann_cert_view")) + "</span></button>" +
    '<button type="button" class="an-file an-cert-btn" data-cert="' + esc(a.cert) + '" data-act="download"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3v12m0 0 4-4m-4 4-4-4M5 20h14"/></svg><span>' + esc(tr("ann_cert_download")) + "</span></button></div>";
  const certCache = {};
  function getCert(id) {
    if (!certCache[id]) {
      certCache[id] = SNAuth.fetchCertificate(id).then((r) => { if (!r) throw new Error("NO_CERT"); return r; });
      certCache[id].catch(() => { delete certCache[id]; });
    }
    return certCache[id];
  }

  function injectFilesStyle() {
    if (document.getElementById("annFilesCss")) return;
    const st = document.createElement("style");
    st.id = "annFilesCss";
    st.textContent = ".an-files{display:flex;flex-wrap:wrap;gap:8px;margin-top:12px}.an-file{display:inline-flex;align-items:center;gap:8px;max-width:100%;white-space:nowrap;padding:8px 14px;border-radius:999px;border:1.5px solid var(--accent,#c8902e);background:transparent;color:inherit;font:inherit;font-weight:700;font-size:.9rem;cursor:pointer}.an-file span{overflow:hidden;text-overflow:ellipsis}.an-file svg{flex:none}.an-file:hover{background:rgba(200,144,46,.12)}.an-file--doc{display:flex;width:100%;border-radius:16px;padding:11px 14px;text-align:start;font-weight:500;font-size:.88rem}.an-file--doc .sn-fl{flex:1}.an-cert-btn{flex:1;justify-content:center}.an-file[disabled]{opacity:.6;cursor:progress}.an-card--certificate .an-card__icon{color:#b9770e;background:rgba(185,119,14,.14)}";
    document.head.appendChild(st);
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
        '<p class="an-card__body" dir="auto">' + esc(a.body) + "</p>" + filesHtml(a) + certHtml(a) + "</article>";
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
    injectFilesStyle();
    $("#annList").addEventListener("click", async (e) => {
      const cb = e.target.closest(".an-cert-btn");
      if (cb) {
        if (cb.disabled) return;
        cb.disabled = true;
        try {
          if (!window.SNCert || !window.SNAuth || !SNAuth.fetchCertificate) throw new Error("NO_CERT_MODULE");
          if (cb.dataset.act === "download") await SNCert.download(await getCert(cb.dataset.cert));
          else SNCert.open(getCert(cb.dataset.cert)); /* النافذة بتتفتح فورًا، والشهادة بتظهر لما تجهز */
        } catch (err) {
          if (window.snDialog && snDialog.toast) snDialog.toast(tr("ann_cert_fail"), { error: true });
        }
        cb.disabled = false;
        return;
      }
      const b = e.target.closest(".an-file");
      if (!b || b.disabled) return;
      b.disabled = true;
      try {
        if (b.dataset.drive) {
          if (!window.SNDrive) throw new Error("NO_DRIVE");
          /* النافذة بتتفتح فورًا وفيها شريط التحميل */
          await window.SNPdf.open({ driveId: b.dataset.drive, title: b.dataset.name, filename: b.dataset.name, mime: b.dataset.type });
        } else {
          await window.SNPdf.open({
            title: b.dataset.name, filename: b.dataset.name, mime: b.dataset.type,
            load: async () => {
              const f = await SNAuth.fetchAnnouncementFile(b.dataset.ann, b.dataset.fid);
              if (!f || !f.data) throw new Error("NO_FILE");
              return (await fetch(f.data)).blob();
            }
          });
        }
      } catch (err) {
        if (window.SNPdf && SNPdf.toast) SNPdf.toast("تعذر فتح المرفق — حاول تاني بعد شوية");
      }
      b.disabled = false;
    });
    render();

    // الجرس بيفتح نافذة الإشعارات (notifications.js) مش صفحة الإعلانات
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

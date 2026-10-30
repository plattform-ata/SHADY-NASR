/* ==========================================================================
   notifications.js — إشعارات الطالب (نافذة منبثقة من الجرس)
   - الجرس بيفتح نافذة فيها آخر الإشعارات (مش بيودّي لصفحة الإعلانات).
   - الإشعارات: إعلان جديد/معدّل • صور أوائل جديدة • امتحان جديد • امتحان اتصحّح • درجة جديدة.
   - الإشعار بيفضل ثابت في القايمة لحد ما تعدّي عليه مدة (TTL_DAYS) وبعدها بيتشال لوحده.
   - العدّاد على الجرس = الإشعارات اللي أحدث من آخر مرة الطالب فتح فيها النافذة.
   - الضغط على أي إشعار بيفتح القسم المرتبط بيه.
   - صفحة "الإعلانات" بتفضل فيها إعلانات الأدمن بس.
   يتحمّل في studenti.html بعد announcements.js.
   ========================================================================== */
(() => {
  "use strict";

  const TTL_DAYS = 14;          // الإشعار بيختفي بعد كام يوم
  const MAX_ITEMS = 30;         // أقصى عدد إشعارات في النافذة
  const REFRESH_MS = 90 * 1000; // أقل فاصل بين تحديثين للدرجات/الامتحانات

  const STR = {
    ar: {
      title: "الإشعارات", empty: "مفيش إشعارات جديدة.", close: "إغلاق", aria: "الإشعارات",
      all_ann: "كل الإعلانات",
      ann_new: "إعلان جديد", ann_edit: "تم تعديل إعلان",
      honor: "صورة أوائل جديدة", exam_new: "امتحان جديد", exam_done: "تم تصحيح امتحانك",
      grade: "درجة جديدة", exam_graded_sub: "شوف درجتك",
      now: "دلوقتي",
    },
    en: {
      title: "Notifications", empty: "No new notifications.", close: "Close", aria: "Notifications",
      all_ann: "All announcements",
      ann_new: "New announcement", ann_edit: "Announcement updated",
      honor: "New top-student picture", exam_new: "New exam", exam_done: "Your exam was graded",
      grade: "New grade", exam_graded_sub: "See your score",
      now: "just now",
    },
  };

  const $ = (s, r = document) => r.querySelector(s);
  const lang = () => (document.documentElement.lang === "en" ? "en" : "ar");
  const tr = (k) => (STR[lang()] && STR[lang()][k]) || STR.ar[k] || k;
  const esc = (v) => String(v == null ? "" : v).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const session = () => { try { return JSON.parse(localStorage.getItem("shadynasr-current-user")); } catch { return null; } };

  const me = session();
  if (!me || !me.id || me.role === "admin") return;

  const SEEN_KEY = "shadynasr-notif-seen:" + me.id;
  const REG_KEY = "shadynasr-notif-reg:" + me.id;

  const lsGet = (k) => { try { return localStorage.getItem(k); } catch { return null; } };
  const lsSet = (k, v) => { try { localStorage.setItem(k, v); } catch { /* ignore */ } };

  let seen = Number(lsGet(SEEN_KEY));
  if (!Number.isFinite(seen) || !lsGet(SEEN_KEY)) { seen = Date.now(); lsSet(SEEN_KEY, String(seen)); } // أول مرة: ما نغرقش الطالب بإشعارات قديمة
  let reg = {};
  try { reg = JSON.parse(lsGet(REG_KEY)) || {}; } catch { reg = {}; }
  const saveReg = () => lsSet(REG_KEY, JSON.stringify(reg));

  /* لو الداتا مفيهاش وقت: بنسجّل أول مرة شفناها. أول تشغيل لكل مصدر بنعتبر الموجود قديم (0) */
  function firstSeen(source, id) {
    const k = source + ":" + id;
    if (reg[k] == null) { reg[k] = reg["init:" + source] ? Date.now() : 0; }
    return reg[k];
  }
  function markInit(source) { if (!reg["init:" + source]) { reg["init:" + source] = 1; } saveReg(); }

  const src = { ann: [], honor: [], exam: [], examDone: [], grade: [] };
  const fresh = new Set(); // الإشعارات اللي كانت "جديدة" وقت فتح النافذة
  let open = false, popEl = null, backEl = null;

  const timeOf = (v) => { const t = Date.parse(v); return Number.isFinite(t) ? t : 0; };
  const myGrade = () => (session() || me).grade;

  /* ---------------------------------------------------------------- مصادر */
  function setAnnouncements(list) {
    const g = myGrade();
    src.ann = (list || [])
      .filter((a) => a && a.title && (!a.target || a.target === "all" || a.target === g))
      .map((a) => {
        const created = timeOf(a.createdAt), upd = timeOf(a.updatedAt);
        const ts = Math.max(created, upd);
        return { id: "ann:" + a.id + ":" + ts, ts, kind: "ann", go: "announcements", label: upd > created ? "ann_edit" : "ann_new", text: a.title };
      });
    emit();
  }

  async function loadHonors() {
    if (!window.SNAuth || !SNAuth.fetchHonors) return;
    const g = myGrade();
    const all = await SNAuth.fetchHonors();
    src.honor = (all || []).filter((h) => h && h.id && h.grade === g).map((h) => ({
      id: "honor:" + h.id, ts: timeOf(h.createdAt) || firstSeen("honor", h.id), kind: "honor", go: "honors", label: "honor", text: h.title || "",
    }));
    markInit("honor");
  }

  const examForMe = (e) => {
    if (!e || !e.id) return false;
    const st = String(e.status || "").toLowerCase();
    if (st === "draft" || st === "hidden" || e.published === false) return false;
    const g = myGrade(), eg = e.grade != null ? e.grade : e.grades;
    if (eg == null || eg === "" || eg === "all") return true;
    return Array.isArray(eg) ? eg.indexOf(g) > -1 || eg.indexOf("all") > -1 : String(eg) === g;
  };
  const examTitle = (e) => e.title || e.name || "";

  let exams = [];
  function setExams(list) {
    exams = (list || []).filter(examForMe);
    src.exam = exams.map((e) => ({
      id: "exam:" + e.id,
      ts: timeOf(e.createdAt || e.publishedAt || e.at) || firstSeen("exam", e.id),
      kind: "exam", go: "examhub", label: "exam_new", text: examTitle(e),
    }));
    markInit("exam");
    emit();
    loadExamResults();
  }

  const GRADED = { graded: 1, corrected: 1, reviewed: 1, marked: 1, done: 1 };
  let resBusy = false;
  async function loadExamResults() {
    if (resBusy || !window.SNAuth || !SNAuth.fetchExamSubmission) return;
    resBusy = true;
    try {
      const recent = exams.slice().sort((a, b) => timeOf(b.createdAt) - timeOf(a.createdAt)).slice(0, 8);
      const out = [];
      for (const e of recent) {
        let sub = null;
        try { sub = await SNAuth.fetchExamSubmission(e.id, me.id); } catch { /* ignore */ }
        if (!sub) continue;
        const gt = timeOf(sub.gradedAt || sub.correctedAt || sub.reviewedAt || sub.markedAt);
        const isGraded = gt > 0 || GRADED[String(sub.status || "").toLowerCase()] || sub.graded === true || sub.corrected === true;
        if (!isGraded) continue;
        out.push({ id: "examDone:" + e.id, ts: gt || timeOf(sub.updatedAt) || firstSeen("examDone", e.id), kind: "exam", go: "examhub", label: "exam_done", text: examTitle(e), sub: "exam_graded_sub" });
      }
      src.examDone = out;
      markInit("examDone");
    } finally { resBusy = false; }
    emit();
  }

  let gradeBusy = false;
  async function loadGrades() {
    if (gradeBusy || !window.SNAuth || !SNAuth.fetchGrades) return;
    gradeBusy = true;
    try {
      const all = (await SNAuth.fetchGrades(me.id)) || {};
      const out = [];
      Object.keys(all).forEach((cat) => {
        const bucket = all[cat] || {};
        Object.keys(bucket).forEach((k) => {
          const e = bucket[k];
          if (!e || typeof e !== "object") return;
          const ts = timeOf(e.at || e.submittedAt || e.gradedAt);
          if (!ts) return;
          const score = e.score != null && e.outOf ? e.score + "/" + e.outOf : "";
          out.push({ id: "grade:" + cat + ":" + k, ts, kind: "grade", go: "grades", label: "grade", text: e.title || "", sub: score, subRaw: true });
        });
      });
      src.grade = out;
    } catch { /* ignore */ } finally { gradeBusy = false; }
    emit();
  }

  let lastRefresh = 0;
  function refreshAll(force) {
    const now = Date.now();
    if (!force && now - lastRefresh < REFRESH_MS) return;
    lastRefresh = now;
    Promise.resolve(loadHonors()).catch(() => { }).then(emit);
    loadGrades();
    loadExamResults();
  }

  /* ---------------------------------------------------------------- تجميع */
  function items() {
    const cutoff = Date.now() - TTL_DAYS * 86400000;
    const doneIds = new Set(src.examDone.map((x) => x.id.slice(9)));
    // لو الدرجة اتحسبت من التصحيح نفسه ما نكرّرش الإشعار
    return [].concat(src.ann, src.honor, src.exam, src.examDone, src.grade)
      .filter((n) => n.ts > cutoff)
      .filter((n) => !(n.id.indexOf("exam:") === 0 && doneIds.has(n.id.slice(5))))
      .sort((a, b) => b.ts - a.ts)
      .slice(0, MAX_ITEMS);
  }
  const unreadCount = () => items().filter((n) => n.ts > seen).length;

  function paintBadge() {
    const bell = $("#annBell"), b = $("#annBellBadge");
    const n = unreadCount();
    if (b) { b.hidden = n === 0; b.textContent = n > 9 ? "9+" : String(n); }
    if (bell) bell.classList.toggle("has-unread", n > 0);
  }

  function emit() {
    paintBadge();
    if (open) renderList();
  }

  /* ---------------------------------------------------------------- واجهة */
  const ICON = {
    ann: '<path d="M3 11v2a1 1 0 0 0 1 1h2l5 4V6L6 10H4a1 1 0 0 0-1 1Z"/><path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 6a9 9 0 0 1 0 12"/>',
    honor: '<circle cx="12" cy="9" r="5"/><path d="M8.5 13.5 7 21l5-3 5 3-1.5-7.5"/>',
    exam: '<path d="M9 4h6v3H9z"/><path d="M15 5h2a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h2"/><path d="m9 14 2 2 4-4"/>',
    grade: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
  };
  const svg = (k) => '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (ICON[k] || ICON.ann) + "</svg>";

  function ago(ts) {
    const diff = Math.round((ts - Date.now()) / 1000);
    const a = Math.abs(diff);
    if (a < 45) return tr("now");
    try {
      const rtf = new Intl.RelativeTimeFormat(lang() === "en" ? "en" : "ar-EG", { numeric: "auto" });
      if (a < 3600) return rtf.format(Math.round(diff / 60), "minute");
      if (a < 86400) return rtf.format(Math.round(diff / 3600), "hour");
      return rtf.format(Math.round(diff / 86400), "day");
    } catch { return new Date(ts).toLocaleDateString(); }
  }

  function injectStyle() {
    if ($("#snNotifCss")) return;
    const st = document.createElement("style");
    st.id = "snNotifCss";
    st.textContent = [
      ".snn-back{position:fixed;inset:0;z-index:300;background:transparent}",
      ".snn-back[hidden],.snn-pop[hidden]{display:none}",
      ".snn-pop{position:fixed;z-index:301;width:min(380px,calc(100vw - 24px));max-height:min(70vh,520px);display:flex;flex-direction:column;background:var(--surface-glass);color:var(--ink);border:1px solid var(--surface-glass-border);border-radius:18px;box-shadow:0 18px 44px rgba(0,0,0,.28);overflow:hidden;animation:snnIn .16s ease-out}",
      "@keyframes snnIn{from{opacity:0;transform:translateY(-6px) scale(.98)}to{opacity:1;transform:none}}",
      "@media (prefers-reduced-motion:reduce){.snn-pop{animation:none}}",
      ".snn-head{display:flex;align-items:center;justify-content:space-between;padding:14px 16px 10px;border-bottom:1px solid var(--surface-glass-border)}",
      ".snn-head h3{margin:0;font-size:1rem}",
      ".snn-x{border:0;background:transparent;color:var(--ink-soft);font-size:1.4rem;line-height:1;cursor:pointer;padding:0 4px}",
      ".snn-list{overflow:auto;padding:8px;overscroll-behavior:contain}",
      ".snn-item{display:flex;align-items:flex-start;gap:12px;width:100%;border:0;background:transparent;color:inherit;font:inherit;text-align:start;padding:10px;border-radius:12px;cursor:pointer;position:relative}",
      ".snn-item:hover,.snn-item:focus-visible{background:rgba(127,127,127,.12);outline:none}",
      ".snn-item.is-new{background:rgba(200,144,46,.12)}",
      ".snn-ico{flex:none;width:36px;height:36px;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;background:var(--accent);color:var(--accent-ink)}",
      ".snn-ico svg{width:18px;height:18px}",
      ".snn-body{min-width:0;flex:1}",
      ".snn-label{display:block;font-weight:800;font-size:.9rem}",
      ".snn-text{display:block;font-size:.88rem;color:var(--ink-soft);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}",
      ".snn-time{display:block;font-size:.76rem;color:var(--ink-soft);margin-top:2px}",
      ".snn-dot{flex:none;width:9px;height:9px;border-radius:50%;background:#e5484d;margin-top:6px}",
      ".snn-empty{margin:0;padding:26px 8px;text-align:center;color:var(--ink-soft)}",
      ".snn-foot{border-top:1px solid var(--surface-glass-border);padding:8px}",
      ".snn-all{width:100%;border:0;background:transparent;color:var(--accent);font:inherit;font-weight:800;padding:10px;border-radius:12px;cursor:pointer}",
      ".snn-all:hover{background:rgba(127,127,127,.12)}",
    ].join("\n");
    document.head.appendChild(st);
  }

  function renderList() {
    if (!popEl) return;
    $(".snn-head h3", popEl).textContent = tr("title");
    $(".snn-x", popEl).setAttribute("aria-label", tr("close"));
    $(".snn-all", popEl).textContent = tr("all_ann");
    const list = items();
    $(".snn-list", popEl).innerHTML = list.length
      ? list.map((n) => {
        const sub = n.sub ? (n.subRaw ? n.sub : tr(n.sub)) : "";
        return '<button type="button" class="snn-item' + (fresh.has(n.id) ? " is-new" : "") + '" data-go="' + esc(n.go) + '">' +
          '<span class="snn-ico">' + svg(n.kind) + "</span>" +
          '<span class="snn-body"><span class="snn-label">' + esc(tr(n.label)) + "</span>" +
          (n.text ? '<span class="snn-text" dir="auto">' + esc(n.text) + (sub ? " · " + esc(sub) : "") + "</span>" : (sub ? '<span class="snn-text">' + esc(sub) + "</span>" : "")) +
          '<span class="snn-time">' + esc(ago(n.ts)) + "</span></span>" +
          (fresh.has(n.id) ? '<span class="snn-dot" aria-hidden="true"></span>' : "") + "</button>";
      }).join("")
      : '<p class="snn-empty">' + esc(tr("empty")) + "</p>";
  }

  function place() {
    const bell = $("#annBell");
    if (!bell || !popEl) return;
    const r = bell.getBoundingClientRect();
    const w = Math.min(380, window.innerWidth - 24);
    const rtl = getComputedStyle(document.documentElement).direction === "rtl";
    let left = rtl ? r.left : r.right - w;
    left = Math.max(12, Math.min(left, window.innerWidth - w - 12));
    popEl.style.top = Math.round(r.bottom + 10) + "px";
    popEl.style.left = Math.round(left) + "px";
  }

  function build() {
    injectStyle();
    backEl = document.createElement("div");
    backEl.className = "snn-back";
    backEl.hidden = true;
    popEl = document.createElement("div");
    popEl.className = "snn-pop";
    popEl.hidden = true;
    popEl.setAttribute("role", "dialog");
    popEl.innerHTML = '<div class="snn-head"><h3></h3><button type="button" class="snn-x">&times;</button></div><div class="snn-list"></div><div class="snn-foot"><button type="button" class="snn-all"></button></div>';
    document.body.appendChild(backEl);
    document.body.appendChild(popEl);
    backEl.addEventListener("click", close);
    popEl.addEventListener("click", (e) => {
      if (e.target.closest(".snn-x")) { close(); return; }
      const goBtn = e.target.closest("[data-go]") || (e.target.closest(".snn-all") && { dataset: { go: "announcements" } });
      if (!goBtn) return;
      const target = goBtn.dataset.go;
      close();
      const link = $('.dash-nav__link[data-target="' + target + '"]');
      if (link) link.click();
    });
    document.addEventListener("keydown", (e) => { if (open && e.key === "Escape") close(); });
    window.addEventListener("resize", () => { if (open) place(); });
    window.addEventListener("popstate", () => { if (open) close(); });
  }

  function openPop() {
    if (open) { close(); return; }
    open = true;
    // نثبّت اللي كان جديد عشان يفضل متعلّم طول ما النافذة مفتوحة
    fresh.clear();
    items().forEach((n) => { if (n.ts > seen) fresh.add(n.id); });
    renderList();
    backEl.hidden = false;
    popEl.hidden = false;
    place();
    seen = Date.now();
    lsSet(SEEN_KEY, String(seen));
    paintBadge();
    const bell = $("#annBell");
    if (bell) bell.setAttribute("aria-expanded", "true");
    refreshAll(true); // تحديث الدرجات والامتحانات والأوائل أول ما تتفتح
  }
  function close() {
    if (!open) return;
    open = false;
    backEl.hidden = true;
    popEl.hidden = true;
    fresh.clear();
    const bell = $("#annBell");
    if (bell) bell.setAttribute("aria-expanded", "false");
  }

  function init() {
    const bell = $("#annBell");
    if (!bell || !window.SNAuth) return;
    build();
    bell.setAttribute("aria-label", tr("aria"));
    bell.setAttribute("aria-haspopup", "dialog");
    bell.setAttribute("aria-expanded", "false");
    bell.addEventListener("click", (e) => { e.preventDefault(); e.stopPropagation(); openPop(); });

    // إعلانات: متابعة لحظية
    if (SNAuth.watchAnnouncements) { try { SNAuth.watchAnnouncements(setAnnouncements, () => { }); } catch { /* ignore */ } }
    // امتحانات: متابعة لحظية (الامتحان الجديد بيظهر من غير ريفرش)
    if (SNAuth.watchExams) { try { SNAuth.watchExams(setExams); } catch { /* ignore */ } }
    refreshAll(true);
    setInterval(() => refreshAll(false), REFRESH_MS * 2);
    document.addEventListener("visibilitychange", () => { if (!document.hidden) refreshAll(false); });

    // تغيير اللغة
    new MutationObserver(() => { bell.setAttribute("aria-label", tr("aria")); if (open) renderList(); })
      .observe(document.documentElement, { attributes: true, attributeFilter: ["lang"] });
  }

  document.addEventListener("DOMContentLoaded", () => setTimeout(init, 0));
})();

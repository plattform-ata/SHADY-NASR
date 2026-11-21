/* ==========================================================================
   home-v2.js — الصفحة الرئيسية (index.html)
   - حركة دخول الهيرو بعد السبلاش + parallax خفيف مع الماوس
   - قسم "أوائل المنصة": أول 3 في كل صف من Firebase (بيانات حقيقية)
   - قصاصات ورق (confetti) لما القسم يظهر في الشاشة
   لازم يتحمّل بعد shared.js وقبل سكريبت AuthUI.init() اللي في آخر الصفحة.
   ========================================================================== */
(() => {
  "use strict";

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const lang = () => (document.documentElement.lang === "en" ? "en" : "ar");
  const esc = (v) => String(v == null ? "" : v).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  /* ---------- ترجمات (بتتضاف على قاموس I18N بتاع shared.js) ---------- */
  const EXT = {
    ar: {
      nav_champs: "الأوائل", hero_scroll_aria: "انزل لتحت",
      champs_eyebrow: "لوحة الشرف", champs_title: "أوائل المنصة",
      champs_desc: "اختار مرحلتك وصفك وشوف المتصدرين بالنقاط",
      champs_prep: "الإعدادية", champs_sec: "الثانوية",
      champs_g1: "الصف الأول", champs_g2: "الصف الثاني", champs_g3: "الصف الثالث",
      champs_rank1: "المركز الأول", champs_rank2: "المركز الثاني", champs_rank3: "المركز الثالث",
      champs_pts: "نقطة", champs_slot_empty: "مكان فاضي",
      champs_empty: "لسه مفيش متصدرين في الصف ده — كن أول واحد!",
      champs_err: "مقدرناش نحمّل الأوائل دلوقتي. جرّب بعد شوية.",
    },
    en: {
      nav_champs: "Top students", hero_scroll_aria: "Scroll down",
      champs_eyebrow: "Hall of fame", champs_title: "Platform top students",
      champs_desc: "Pick your stage and grade to see the leaders by points",
      champs_prep: "Preparatory", champs_sec: "Secondary",
      champs_g1: "Grade 1", champs_g2: "Grade 2", champs_g3: "Grade 3",
      champs_rank1: "1st place", champs_rank2: "2nd place", champs_rank3: "3rd place",
      champs_pts: "pts", champs_slot_empty: "Open spot",
      champs_empty: "No leaders in this grade yet — be the first!",
      champs_err: "Couldn't load the top students right now. Try again shortly.",
    },
  };
  if (typeof I18N !== "undefined") {
    Object.assign(I18N.ar, EXT.ar);
    Object.assign(I18N.en, EXT.en);
  }
  const tr = (k) => (EXT[lang()] && EXT[lang()][k]) || EXT.ar[k] || k;

  /* ======================================================================
     1) الهيرو: بنستنى السبلاش يخلص وبعدين العناصر تدخل بالحركة
     ====================================================================== */
  function heroGate() {
    const hero = $(".hero--full");
    if (!hero) return;
    const root = document.documentElement;
    root.classList.add("hero-wait");
    let done = false;
    const go = () => { if (done) return; done = true; root.classList.remove("hero-wait"); hero.classList.add("is-ready"); };
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    const base = window.snLaunch && window.snLaunch.done ? window.snLaunch.done : Promise.resolve();
    // لو دايرة التحميل لسه ظاهرة نستنّاها، وإلا نبدأ فورًا
    base.then(() => wait($("#siteSplash") ? 1500 : 120)).then(go);
    setTimeout(go, 7000); // أمان: مهما حصل الهيرو يظهر
  }

  /* parallax خفيف للصورة والشرائح مع حركة الماوس (على الأجهزة اللي فيها ماوس بس) */
  function heroParallax() {
    const hero = $(".hero--full");
    const vis = $(".hero__visual");
    if (!hero || !vis || !window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;
    let tx = 0, ty = 0, cx = 0, cy = 0, raf = 0;
    const loop = () => {
      cx += (tx - cx) * 0.08;
      cy += (ty - cy) * 0.08;
      vis.style.setProperty("--px", cx.toFixed(3));
      vis.style.setProperty("--py", cy.toFixed(3));
      raf = Math.abs(tx - cx) > 0.001 || Math.abs(ty - cy) > 0.001 ? requestAnimationFrame(loop) : 0;
    };
    const kick = () => { if (!raf) raf = requestAnimationFrame(loop); };
    hero.addEventListener("pointermove", (e) => {
      const r = hero.getBoundingClientRect();
      tx = ((e.clientX - r.left) / r.width - 0.5) * 2;
      ty = ((e.clientY - r.top) / r.height - 0.5) * 2;
      kick();
    });
    hero.addEventListener("pointerleave", () => { tx = 0; ty = 0; kick(); });
  }

  /* ======================================================================
     2) Firebase (خفيف): بنقرا فهرس publicRank/{grade} (أول 3 بالنقاط) مش كل الطلاب
        publicRank/{grade}/{id} = { n: الاسم, p: النقاط }  ← بيتحدّث لحظة ما النقاط تتغيّر (firebase.js)
        الصور بتتحمّل من users/{id}/photoURL للـ 3 بس وبتتخزّن 6 ساعات.
        topStudentsMeta = { updatedAt, lockUntil, ver }: تحديث دوري (12 ساعة) يعيد بناء الفهرس كله
        كشبكة أمان (أول زائر بياخد "قفل" ويعمله). الصفحة بتتحدّث لوحدها كل دقيقة.
     ====================================================================== */
  const ALL_GRADES = ["prep1", "prep2", "prep3", "secondary1", "secondary2", "secondary3"];
  const GRADES = { prep: ALL_GRADES.slice(0, 3), secondary: ALL_GRADES.slice(3) };
  const TTL = 12 * 60 * 60 * 1000;
  const REFRESH_MS = 60 * 1000; // تحديث تلقائي كل دقيقة
  const DB_URL = "https://shady-nasr-default-rtdb.europe-west1.firebasedatabase.app";
  const VER = 4; // لو غيّرت طريقة الحساب ارفع الرقم ده: أول زائر هيعيد الحساب فورًا
  const LS = "sn-top-ph-v1";
  const state = { stage: "prep", grade: 1, meta: null, token: 0, checked: false, started: false, visible: false, last: 0, sig: "" };

  const validPhoto = (u) => typeof u === "string" && u.length < 60000 && /^data:image\/(?:jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(u);
  const shortName = (full) => String(full || "").trim().split(/\s+/).slice(0, 2).join(" ").slice(0, 28) || "—";
  const withTimeout = (p, ms) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error("TIMEOUT")), ms))]);
  const fmt = (n) => new Intl.NumberFormat("en-US").format(Number(n) || 0);

  /* كاش صور الأوائل (الصورة بتتحمّل من users/{id}/photoURL مرة كل 6 ساعات) */
  const PH_TTL = 6 * 60 * 60 * 1000;
  const readPh = () => { try { return JSON.parse(localStorage.getItem(LS)) || {}; } catch (e) { return {}; } };
  const writePh = (c) => {
    try {
      const ks = Object.keys(c);
      if (ks.length > 30) ks.sort((a, b) => c[a].t - c[b].t).slice(0, ks.length - 30).forEach((k) => delete c[k]);
      localStorage.setItem(LS, JSON.stringify(c));
    } catch (e) { /* ممتلئ — عادي */ }
  };

  let dbPromise = null;
  function getDb() {
    if (dbPromise) return dbPromise;
    dbPromise = (async () => {
      const ready = () => window.firebase && firebase.apps && firebase.apps.length && window.SNAuth;
      if (!ready() && typeof ensureSNAuth === "function") await withTimeout(ensureSNAuth(), 15000);
      if (!(window.firebase && firebase.apps && firebase.apps.length)) throw new Error("NO_FIREBASE");
      return firebase.database();
    })();
    dbPromise.catch(() => { dbPromise = null; });
    return dbPromise;
  }

  /* الصفحة الرئيسية للزوّار: بنقفل اتصال Firebase بعد ما نخلّص عشان حد الـ 100 اتصال في الخطة المجانية.
     مهم: ما نقفلش الاتصال والعمليات شغّالة (قراءة users ممكن تاخد ثواني) — عشان كده في عدّاد hold. */
  let offTimer = 0, hold = 0;
  const scheduleOff = (ms) => {
    clearTimeout(offTimer);
    if (hold > 0) return;
    offTimer = setTimeout(() => { if (hold > 0) return; try { firebase.database().goOffline(); } catch (e) { /* ignore */ } }, ms);
  };
  /* بعد goOffline() الاتصال بياخد لحظات يرجع؛ get() قبل ما يرجع بيفشل بـ "Client is offline"
     (ده كان سبب إن الأوائل ما بتحمّلش عند تغيير الصف أو في التحديث الدوري). فبنستنى الاتصال الأول. */
  function waitConnected(db) {
    return new Promise((resolve) => {
      let done = false, h = null, tm = null;
      const r = db.ref(".info/connected");
      const fin = () => { if (done) return; done = true; clearTimeout(tm); try { r.off("value", h); } catch (e) { /* ignore */ } resolve(); };
      h = r.on("value", (s) => { if (s.val() === true) fin(); });
      tm = setTimeout(fin, 8000);
    });
  }
  async function dbRef(path) {
    const db = await getDb();
    clearTimeout(offTimer);
    try { db.goOnline(); } catch (e) { /* ignore */ }
    await waitConnected(db);
    return path ? db.ref(path) : db.ref();
  }

  /* قراءة خفيفة بـ REST (من غير اتصال WebSocket دايم): بتشتغل فورًا ومش بتتأثر بـ goOffline */
  async function rest(path, params) {
    const qs = params ? "?" + Object.keys(params).map((k) => k + "=" + encodeURIComponent(params[k])).join("&") : "";
    const ctl = new AbortController();
    const tm = setTimeout(() => ctl.abort(), 12000);
    try {
      const r = await fetch(DB_URL + "/" + path + ".json" + qs, { cache: "no-store", signal: ctl.signal });
      if (!r.ok) throw new Error("HTTP " + r.status);
      return await r.json();
    } finally { clearTimeout(tm); }
  }
  async function op(fn) {
    hold++;
    clearTimeout(offTimer);
    try { return await fn(); } finally { hold--; scheduleOff(4000); }
  }

  async function getMeta(force) {
    if (state.meta && !force) return state.meta;
    const v = await rest("topStudentsMeta");
    state.meta = v && typeof v === "object" ? v : {};
    return state.meta;
  }

  async function attachPhotos(list) {
    const cache = readPh();
    const now = Date.now();
    let dirty = false;
    await Promise.all(list.map(async (x) => {
      if (x.ph !== undefined) return; // الصورة جاية مع بيانات الطالب أصلًا
      const hit = cache[x.id];
      if (hit && now - hit.t < PH_TTL) { x.ph = hit.ph || null; return; }
      try {
        const v = await rest("users/" + encodeURIComponent(x.id) + "/photoURL");
        x.ph = validPhoto(v) ? v : null;
        cache[x.id] = { t: now, ph: x.ph };
        dirty = true;
      } catch (e) { x.ph = hit ? hit.ph || null : null; }
    }));
    if (dirty) writePh(cache);
  }

  /* لو الفهرس فاضي/مش مقروء: نجيب طلاب الصف مباشرة (نفس طريقة صفحة الطلاب) ونرتّب محليًا */
  async function fetchGradeFromUsers(gk) {
    let users;
    try {
      const v = await rest("users", { orderBy: '"grade"', equalTo: '"' + gk + '"' });
      users = v && typeof v === "object" ? Object.values(v) : [];
    } catch (e) {
      users = await op(async () => { await dbRef("users"); return withTimeout(SNAuth.fetchUsersByGrade(gk), 30000); });
    }
    return users
      .filter((u) => u && typeof u === "object" && u.role !== "admin" && u.id)
      .map((u) => ({ id: u.id, n: shortName(u.fullName), p: Math.round(Number(u.points) || 0), ph: validPhoto(u.photoURL) ? u.photoURL : null, t: String(u.createdAt || "") }));
  }

  /* أول 3 في الصف: من فهرس publicRank (خفيف)، ولو فاضي بنجيب الطلاب مباشرة */
  async function fetchGrade(gk) {
    let list = [];
    try {
      const v = await rest("publicRank/" + gk);
      if (v && typeof v === "object") {
        list = Object.keys(v).filter((id) => v[id] && typeof v[id] === "object")
          .map((id) => ({ id, n: String(v[id].n || "").slice(0, 40) || "—", p: Number(v[id].p) || 0 }));
      }
    } catch (e) { console.warn("[SNTop] تعذّر قراءة publicRank:", e && e.message); }
    if (!list.length) list = await fetchGradeFromUsers(gk);
    list.sort((a, b) => b.p - a.p || String(a.t || "").localeCompare(String(b.t || "")) || a.n.localeCompare(b.n));
    const top = list.slice(0, 3);
    await attachPhotos(top);
    return top;
  }

  /* الفهرس الكامل: publicRank/{grade}/{id} = { n, p } لكل طالب (مش أدمن) */
  function computeRank(users) {
    const tree = {};
    (users || []).forEach((u) => {
      if (!u || typeof u !== "object" || u.role === "admin" || !u.id || ALL_GRADES.indexOf(u.grade) < 0) return;
      (tree[u.grade] || (tree[u.grade] = {}))[u.id] = { n: shortName(u.fullName), p: Math.round(Number(u.points) || 0) };
    });
    return tree;
  }

  /* نفس منطق لوحة الصدارة في الأدمن واللوحة: كل مستخدم مش أدمن، مرتّبين بالنقاط (حتى لو صفر) */
  function computeTop(users) {
    const by = {};
    ALL_GRADES.forEach((g) => (by[g] = []));
    (users || []).forEach((u) => {
      if (!u || typeof u !== "object" || u.role === "admin") return;
      if (!by[u.grade]) return;
      by[u.grade].push({ n: shortName(u.fullName), p: Math.round(Number(u.points) || 0), ph: validPhoto(u.photoURL) ? u.photoURL : null, t: String(u.createdAt || "") });
    });
    const out = {};
    ALL_GRADES.forEach((g) => { by[g].sort((a, b) => b.p - a.p || a.t.localeCompare(b.t)); out[g] = by[g].slice(0, 3); });
    return out;
  }
  /* نفس دالة الأدمن بالظبط: SNAuth.fetchAllUsers() */
  async function readUsers() {
    await dbRef("users");
    if (window.SNAuth && typeof SNAuth.fetchAllUsers === "function") return withTimeout(SNAuth.fetchAllUsers(), 60000);
    const s = await withTimeout((await dbRef("users")).get(), 60000);
    return s.exists() ? Object.values(s.val() || {}) : [];
  }

  /* إعادة حساب القايمة (مرة كل 12 ساعة فقط، وزائر واحد بس بياخد القفل) */
  async function maybeRebuild(force) {
    const meta = await getMeta();
    if (!force && meta.updatedAt && meta.ver === VER && Date.now() - Number(meta.updatedAt) < TTL) return false;
    return op(async () => {
      let won = false;
      try {
        const r = await (await dbRef("topStudentsMeta/lockUntil")).transaction((cur) => (cur && cur > Date.now() ? undefined : Date.now() + 120000));
        won = !!(r && r.committed);
      } catch (e) { console.warn("[SNTop] تعذّر أخذ القفل:", e && e.message); return false; }
      if (!won) return false;
      try {
        const tree = computeRank(await readUsers());
        const now = Date.now();
        await (await dbRef()).update({
          publicRank: Object.keys(tree).length ? tree : null,
          topStudents: null, // نسخة قديمة من التصميم الأول
          "topStudentsMeta/updatedAt": now,
          "topStudentsMeta/lockUntil": 0,
          "topStudentsMeta/ver": VER,
        });
        state.meta = { updatedAt: now, lockUntil: 0, ver: VER };
        return true;
      } catch (e) {
        console.warn("[SNTop] فشل حساب الأوائل:", e && e.message);
        try { await (await dbRef("topStudentsMeta/lockUntil")).set(0); } catch (_) { /* ignore */ }
        return false;
      }
    });
  }

  /* ألوان المنصة: الصفحة الرئيسية ما كانتش بتحمّل Firebase، فكانت بتاخد اللون من الكاش بس */
  async function refreshTheme() {
    const HEX = /^#[0-9a-f]{6}$/i;
    const ok = (t) => t && ["ink", "brand", "accent", "accentSoft", "bg", "bgSoft"].every((k) => HEX.test(t[k] || ""));
    try {
      await (async () => {
        const t = await rest("siteTheme");
        try { if (ok(t)) localStorage.setItem("shadynasr-site-theme", JSON.stringify(t)); else localStorage.removeItem("shadynasr-site-theme"); } catch (e) { /* ignore */ }
        if (window.snUserTheme && window.snUserTheme.revert) window.snUserTheme.revert();
      })();
    } catch (e) { /* مش مشكلة: بنكمّل بالكاش */ }
  }

  /* ======================================================================
     3) رسم المنصة
     ====================================================================== */
  const medal = (n) => '<svg class="pmedal" viewBox="0 0 32 40" aria-hidden="true"><use href="#sn-medal-' + n + '"/></svg>';
  const wreath = (cls) => '<svg class="pwreath' + (cls ? " " + cls : "") + '" viewBox="0 0 60 120" aria-hidden="true"><use href="#sn-laurel"/></svg>';

  function slotHTML(rank, e) {
    const has = !!e;
    const avatar = has && e.ph
      ? '<span class="pav" style="background-image:url(\'' + e.ph + '\')"></span>'
      : '<span class="pav"><svg viewBox="0 0 24 24" aria-hidden="true"><use href="#sn-user"/></svg></span>';
    const crown = rank === 1 && has ? '<span class="pcrown" aria-hidden="true"><svg viewBox="0 0 64 46"><use href="#sn-crown"/></svg></span>' : "";
    return (
      '<div class="pslot pslot--' + rank + (has ? "" : " is-empty") + '" data-rank="' + rank + '">' +
        '<div class="pcard">' +
          '<span class="ptag">' + esc(tr("champs_rank" + rank)) + "</span>" +
          '<div class="pavwrap">' + crown + avatar + "</div>" +
          '<div class="pname">' + medal(rank) + '<span class="pname__t">' + (has ? esc(e.n || "—") : esc(tr("champs_slot_empty"))) + "</span></div>" +
          '<span class="ppts"><svg viewBox="0 0 24 24" aria-hidden="true"><use href="#sn-star5"/></svg><b>' + (has ? fmt(e.p) : "—") + "</b><i>" + esc(tr("champs_pts")) + "</i></span>" +
        "</div>" +
        '<div class="plinth"><div class="pnum">' + wreath("") + '<span class="pnum__n">' + rank + "</span>" + wreath("pwreath--r") + "</div></div>" +
      "</div>"
    );
  }

  const setNote = (txt) => { const n = $("#champsNote"); if (n) n.textContent = txt || ""; };

  function render(list, loading) {
    const el = $("#podium");
    if (!el) return;
    el.classList.toggle("is-loading", !!loading);
    el.innerHTML = [2, 1, 3].map((r) => slotHTML(r, list[r - 1])).join("");
  }

  async function show(silent) {
    const gk = GRADES[state.stage][state.grade - 1];
    const token = ++state.token;
    state.last = Date.now();
    if (!silent) { state.sig = ""; render([], true); setNote(""); }
    try {
      const list = await fetchGrade(gk);
      if (token !== state.token) return;
      const sig = gk + JSON.stringify(list.map((x) => [x.n, x.p, x.ph ? x.ph.length : 0]));
      if (!silent || sig !== state.sig) render(list, false);
      state.sig = sig;
      setNote(list.length ? "" : tr("champs_empty"));
      if (!state.checked) {
        state.checked = true;
        maybeRebuild().then((ok) => { if (ok) show(true); }).catch(() => {});
      }
    } catch (e) {
      console.warn("[SNTop] تعذّر تحميل الأوائل:", e && e.message);
      if (token !== state.token) return;
      if (!silent) { render([], false); setNote(tr("champs_err")); }
    }
  }

  function initTabs() {
    $$(".ctab[data-stage]").forEach((b) => b.addEventListener("click", () => {
      state.stage = b.dataset.stage;
      $$(".ctab[data-stage]").forEach((x) => { const on = x === b; x.classList.toggle("is-active", on); x.setAttribute("aria-selected", on ? "true" : "false"); });
      show();
    }));
    $$(".ctab[data-grade]").forEach((b) => b.addEventListener("click", () => {
      state.grade = Number(b.dataset.grade) || 1;
      $$(".ctab[data-grade]").forEach((x) => { const on = x === b; x.classList.toggle("is-active", on); x.setAttribute("aria-selected", on ? "true" : "false"); });
      show();
    }));
  }

  /* ======================================================================
     4) قصاصات الورق
     ====================================================================== */
  function initConfetti() {
    const sec = $("#champions");
    const cv = $("#champsConfetti");
    if (!sec || !cv || !("IntersectionObserver" in window)) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let raf = 0, parts = [], last = 0, lastFire = 0, W = 0, H = 0;
    const ctx = cv.getContext("2d");

    function fire() {
      const r = cv.getBoundingClientRect();
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      W = r.width; H = r.height;
      cv.width = Math.round(W * dpr);
      cv.height = Math.round(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const cs = getComputedStyle(document.documentElement);
      const pal = [cs.getPropertyValue("--sunset-500").trim() || "#2c8097", cs.getPropertyValue("--sunset-300").trim() || "#8fcfd2", "#f5c542", "#ffd75e", "#ffffff", "#cfd6e2", "#e0a96d", "#ff7a7a"];
      const n = Math.round(Math.min(200, Math.max(90, W / 7)));
      parts = [];
      for (let i = 0; i < n; i++) {
        const top = i % 3 === 0;
        let x, y, vx, vy;
        if (top) { x = Math.random() * W; y = -20 - Math.random() * H * 0.35; vx = (Math.random() - 0.5) * 2; vy = 1 + Math.random() * 2; }
        else {
          const left = i % 2 === 0;
          const span = Math.min(W, 1180);
          x = W / 2 + (left ? -1 : 1) * span * 0.4;
          y = H - 230;
          vx = (left ? 1 : -1) * (2 + Math.random() * 7);
          vy = -(11 + Math.random() * 10);
        }
        parts.push({
          x, y, vx, vy, w: 6 + Math.random() * 7, h: 9 + Math.random() * 9,
          rot: Math.random() * 6.28, vr: (Math.random() - 0.5) * 0.35,
          tilt: Math.random() * 6.28, vt: 0.08 + Math.random() * 0.18, ph: Math.random() * 6.28,
          color: pal[(Math.random() * pal.length) | 0], life: 0, max: 260 + Math.random() * 200, round: Math.random() < 0.18,
        });
      }
      last = performance.now();
      if (!raf) raf = requestAnimationFrame(tick);
    }

    function tick(now) {
      const k = Math.min(2.5, (now - last) / 16.67);
      last = now;
      ctx.clearRect(0, 0, W, H);
      parts = parts.filter((p) => p.life < p.max && p.y < H + 10);
      for (const p of parts) {
        p.vx *= Math.pow(0.982, k);
        p.vy = (p.vy + 0.17 * k) * Math.pow(0.963, k);
        p.x += p.vx * k + Math.sin(p.life * 0.08 + p.ph) * 0.6 * k;
        p.y += p.vy * k;
        p.rot += p.vr * k;
        p.tilt += p.vt * k;
        p.life += k;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.scale(1, Math.cos(p.tilt));
        // بتخفت تدريجيًا وهي نازلة (من غير قصّ مفاجئ) وفي آخر عمرها
        ctx.globalAlpha = Math.min(p.life > p.max - 60 ? Math.max(0, (p.max - p.life) / 60) : 1, Math.max(0, Math.min(1, (H - p.y) / 220)));
        ctx.fillStyle = p.color;
        if (p.round) { ctx.beginPath(); ctx.arc(0, 0, p.w / 2, 0, 6.283); ctx.fill(); }
        else ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        ctx.restore();
      }
      if (parts.length) raf = requestAnimationFrame(tick);
      else { raf = 0; ctx.clearRect(0, 0, W, H); }
    }

    new IntersectionObserver((entries) => {
      entries.forEach((en) => {
        if (!en.isIntersecting || document.hidden) return;
        const now = Date.now();
        if (now - lastFire < 9000) return;
        lastFire = now;
        fire();
      });
    }, { threshold: 0.3 }).observe(sec);
  }

  /* ======================================================================
     تشغيل
     ====================================================================== */
  function startData() {
    if (state.started) return;
    state.started = true;
    show();
    refreshTheme();
    // تحديث تلقائي كل دقيقة طول ما القسم قدام الزائر (القراءة صغيرة جدًا)
    const sec = $("#champions");
    if (sec && "IntersectionObserver" in window) {
      new IntersectionObserver((en) => {
        state.visible = en.some((x) => x.isIntersecting);
        if (state.visible && Date.now() - state.last > 10000) show(true);
      }, { threshold: 0.1 }).observe(sec);
    }
    setInterval(() => { if (state.visible && !document.hidden) show(true); }, REFRESH_MS);
    document.addEventListener("visibilitychange", () => { if (!document.hidden && state.visible && Date.now() - state.last > 10000) show(true); });
  }

  function init() {
    heroGate();
    heroParallax();
    initTabs();
    render([], true);
    initConfetti();
    const sec = $("#champions");
    if (sec && "IntersectionObserver" in window) {
      const io = new IntersectionObserver((en) => { if (en.some((x) => x.isIntersecting)) { io.disconnect(); startData(); } }, { rootMargin: "1400px 0px" });
      io.observe(sec);
    } else startData();
    // لو الزائر ما نزلش لتحت، نجيب لون المنصة برضه بعد ما الصفحة تهدا
    window.addEventListener("load", () => setTimeout(() => { if (!state.started) { refreshTheme(); } }, 2500));
  }

  /* للأدمن: SNTop.refresh() من الكونسول بيعيد حساب الأوائل فورًا */
  window.SNTop = {
    refresh: async () => { const ok = await maybeRebuild(true); if (ok) show(); return ok; },
    /* تشخيص: SNTop.debug() في الكونسول بيقول فين المشكلة (قراءة/كتابة، قيم الصف، ومين هيظهر في كل صف) */
    debug: async () => {
      const out = {};
      const msg = (e) => String((e && e.message) || e);
      await op(async () => {
        try { const m = await (await dbRef("topStudentsMeta")).get(); out.قراءة_topStudentsMeta = "تمام"; out.meta = m.exists() ? m.val() : null; } catch (e) { out.قراءة_topStudentsMeta = msg(e); }
        try { const r = await dbRef("topStudentsMeta/dbgPing"); await r.set(Date.now()); await r.remove(); out.كتابة_topStudentsMeta = "تمام"; } catch (e) { out.كتابة_topStudentsMeta = msg(e); }
        try {
          const users = await readUsers();
          out.قراءة_users = "تمام"; out.إجمالي_المستخدمين = users.length;
          out.قيم_الصف_الموجودة = {};
          users.forEach((u) => { const g = (u && u.grade) || "(بدون صف)"; out.قيم_الصف_الموجودة[g] = (out.قيم_الصف_الموجودة[g] || 0) + 1; });
          const top = computeTop(users);
          out.اللي_هيظهر = {};
          ALL_GRADES.forEach((g) => { out.اللي_هيظهر[g] = top[g].map((x) => x.n + " (" + x.p + ")"); });
        } catch (e) { out.قراءة_users = msg(e); }
      });
      console.log("[SNTop] " + JSON.stringify(out, null, 2));
      return out;
    },
  };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();

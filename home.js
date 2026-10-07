/* ==========================================================================
   home.js — صفحة "الرئيسية" في لوحة الطالب + صورة البروفايل
   يتحمّل في studenti.html بعد dashboard.js.
   ========================================================================== */
(() => {
  "use strict";

  /* ---------- ترجمات (بتتضاف على قاموس I18N الموجود في shared.js) ---------- */
  const EXT = {
    ar: {
      dash_nav_home: "الرئيسية", dash_nav_more: "المزيد", more_intro: "كل أقسام المنصة في مكان واحد — اضغط على أي قسم عشان تفتحه.", dash_nav_courses: "الدروس", dash_nav_story: "القصة",
      dash_nav_progress: "التقدم الأكاديمي", dash_nav_grades: "سجل الدرجات",
      dash_nav_productivity: "أدوات الإنتاجية", dash_nav_leaderboard: "لوحة الصدارة",
      dash_nav_profile: "الملف الشخصي", dash_logout: "تسجيل الخروج", dash_tagline: "لوحة تحكم الطالب",
      home_intro: "ملخّص سريع لكل حاجة في المنصة — اضغط على أي مربع عشان تفتح صفحته.",
      home_hello: "أهلًا", home_open: "افتح الصفحة", tile_honors: "الأوائل", tile_honors_body: "أوائل امتحان الوحدة وصور أوائل الدروس.",
      tile_lesson: "كمّل من حيث وقفت", tile_lesson_sub: "آخر درس فتحته", tile_lesson_empty: "لسه ما فتحتش أي درس — ابدأ من صفحة الدروس.", tile_lesson_go: "كمّل الدرس",
      tile_board: "لوحة الصدارة", tile_board_empty: "لسه مفيش طلاب في الترتيب.", pts: "نقطة",
      tile_grades: "آخر الدرجات", tile_grades_empty: "لسه مفيش درجات مسجّلة.", tile_loading: "جاري التحميل…",
      tile_progress: "تقدّمك", st_overall: "الإنجاز الكلي", st_lessons: "درس مكتمل", st_streak: "أيام متتالية", st_points: "نقطة",
      tile_notes: "ملاحظات الأستاذ", tile_notes_body: "تحذيرات ونصايح وتشجيع من الأستاذ.",
      avatar_title: "صورة الملف الشخصي",
      avatar_hint: "اختار صورة واضحة لوشّك — هتظهر جنب اسمك في المنصة وفي لوحة الصدارة.",
      avatar_choose: "اختيار صورة", avatar_remove: "حذف الصورة",
      avatar_saved: "تم حفظ الصورة", avatar_removed: "تم حذف الصورة.",
      avatar_bad: "المتصفح مش قادر يفتح الصورة دي. جرّب صورة تانية أو صيغة تانية.", avatar_big: "الصورة كبيرة قوي (الحد الأقصى 30 ميجا).",
      avatar_local_only: "الصورة اتحفظت على جهازك بس — تعذّر حفظها أونلاين.",
    },
    en: {
      dash_nav_home: "Home", dash_nav_more: "More", more_intro: "All the platform sections in one place — tap any section to open it.", dash_nav_courses: "Lessons", dash_nav_story: "Story",
      dash_nav_progress: "Academic progress", dash_nav_grades: "Grades",
      dash_nav_productivity: "Productivity tools", dash_nav_leaderboard: "Leaderboard",
      dash_nav_profile: "Profile", dash_logout: "Log out", dash_tagline: "Student dashboard",
      home_intro: "A quick summary of everything on the platform — tap any square to open its page.",
      home_hello: "Hello", home_open: "Open page", tile_honors: "Top students", tile_honors_body: "Unit exam toppers and lesson toppers.",
      tile_lesson: "Continue where you left off", tile_lesson_sub: "The last lesson you opened", tile_lesson_empty: "You haven't opened a lesson yet — start from the Lessons page.", tile_lesson_go: "Continue lesson",
      tile_board: "Leaderboard", tile_board_empty: "No students on the board yet.", pts: "pts",
      tile_grades: "Latest grades", tile_grades_empty: "No grades recorded yet.", tile_loading: "Loading…",
      tile_progress: "Your progress", st_overall: "Overall progress", st_lessons: "Lessons done", st_streak: "Day streak", st_points: "Points",
      tile_notes: "Teacher's notes", tile_notes_body: "Warnings, advice and encouragement from your teacher.",
      avatar_title: "Profile picture",
      avatar_hint: "Pick a clear photo of yourself — it appears next to your name and on the leaderboard.",
      avatar_choose: "Choose a photo", avatar_remove: "Remove photo",
      avatar_saved: "Photo saved", avatar_removed: "Photo removed.",
      avatar_bad: "Your browser can't open this image. Try another photo or format.", avatar_big: "Image is too large (30 MB max).",
      avatar_local_only: "Photo saved on this device only — couldn't save it online.",
    },
  };
  if (typeof I18N !== "undefined") {
    Object.assign(I18N.ar, EXT.ar);
    Object.assign(I18N.en, EXT.en);
  }

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const curLang = () => (document.documentElement.lang === "en" ? "en" : "ar");
  const tr = (k) => (EXT[curLang()] && EXT[curLang()][k]) || EXT.ar[k] || k;
  const esc = (v) => String(v == null ? "" : v).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  function getSession() {
    try { return JSON.parse(localStorage.getItem("shadynasr-current-user")); } catch { return null; }
  }

  const state = { board: null, grades: null, lastLoad: 0 };

  const GRADE_NAMES = {
    prep1: "الصف الأول الإعدادي", prep2: "الصف الثاني الإعدادي", prep3: "الصف الثالث الإعدادي",
    secondary1: "الصف الأول الثانوي", secondary2: "الصف الثاني الثانوي", secondary3: "الصف الثالث الثانوي",
  };

  const STUDY_QUOTES = [
    { text: "إنما الأعمال بالنيات، وإنما لكل امرئ ما نوى.", source: "حديث شريف — متفق عليه" },
    { text: "من سلك طريقًا يلتمس فيه علمًا سهّل الله له به طريقًا إلى الجنة.", source: "حديث شريف — رواه مسلم" },
    { text: "من يرد الله به خيرًا يفقهه في الدين.", source: "حديث شريف — متفق عليه" },
    { text: "خيركم من تعلم القرآن وعلمه.", source: "حديث شريف — رواه البخاري" },
    { text: "احرص على ما ينفعك، واستعن بالله ولا تعجز.", source: "حديث شريف — رواه مسلم" },
    { text: "لا تحقرن من المعروف شيئًا.", source: "حديث شريف — رواه مسلم" },
    { text: "العلم لا يُعطيك بعضه حتى تعطيه كلك.", source: "نصيحة للمذاكرة" },
    { text: "ابدأ بخطوة صغيرة، فالإنجاز الكبير يتكوّن من خطوات متتابعة.", source: "نصيحة للمذاكرة" },
    { text: "راجع قليلًا كل يوم، ولا تجعل المذاكرة تتراكم عليك.", source: "نصيحة للمذاكرة" },
    { text: "الفهم أولًا، ثم الحفظ، ثم التدريب.", source: "نصيحة للمذاكرة" },
    { text: "كل سؤال تخطئ فيه يعلّمك شيئًا جديدًا.", source: "نصيحة للمذاكرة" },
    { text: "لا تقارن بدايتك بمنتصف طريق شخص آخر.", source: "نصيحة للمذاكرة" },
    { text: "اكتب ما تتعلمه بيدك، فالكتابة تثبّت الفكرة.", source: "نصيحة للمذاكرة" },
    { text: "قسّم الدرس إلى أجزاء، وستجد الصعب أسهل مما توقعت.", source: "نصيحة للمذاكرة" },
    { text: "التركيز لمدة قصيرة أفضل من ساعات طويلة بلا انتباه.", source: "نصيحة للمذاكرة" },
    { text: "اسأل عندما لا تفهم، فالسؤال بداية التقدم.", source: "نصيحة للمذاكرة" },
    { text: "احتفل بتقدمك الصغير، فهو دليل أنك تتحرك إلى الأمام.", source: "نصيحة للمذاكرة" },
    { text: "لا تخف من الامتحان؛ اجعله فرصة تعرف بها ما تحتاج إلى مراجعته.", source: "نصيحة للمذاكرة" },
    { text: "النوم الجيد جزء من المذاكرة وليس عكسها.", source: "نصيحة للمذاكرة" },
    { text: "أغلق المشتتات أثناء المذاكرة، وأعطِ وقتك لما ينفعك.", source: "نصيحة للمذاكرة" },
    { text: "التكرار الذكي أقوى من الحفظ السريع.", source: "نصيحة للمذاكرة" },
    { text: "اجعل لكل جلسة مذاكرة هدفًا واضحًا.", source: "نصيحة للمذاكرة" },
    { text: "إذا تعبت، خذ استراحة قصيرة ثم عد إلى هدفك.", source: "نصيحة للمذاكرة" },
    { text: "النجاح لا يحتاج إلى الكمال، بل إلى الاستمرار.", source: "نصيحة للمذاكرة" },
    { text: "اقرأ السؤال بهدوء قبل أن تختار الإجابة.", source: "نصيحة للامتحان" },
    { text: "ابدأ بالأسئلة التي تعرفها، ثم ارجع إلى الأسئلة الأصعب.", source: "نصيحة للامتحان" },
    { text: "راجع أخطاءك بعد الامتحان، فهي خريطة طريقك القادمة.", source: "نصيحة للامتحان" },
    { text: "لا تترك إجابة بلا محاولة إذا كنت تستطيع التفكير فيها.", source: "نصيحة للامتحان" },
    { text: "نظّم وقتك بين القراءة والحل والمراجعة.", source: "نصيحة للامتحان" },
    { text: "ثقتك بنفسك تنمو كلما التزمت بخطتك.", source: "نصيحة للمذاكرة" },
    { text: "لا تجعل درجة واحدة تحدد نظرتك إلى نفسك.", source: "نصيحة للمذاكرة" },
    { text: "كل يوم تذاكر فيه يقربك من هدفك.", source: "نصيحة للمذاكرة" },
    { text: "تعلم كلمة جديدة واستخدمها في جملة من عندك.", source: "نصيحة للإنجليزية" },
    { text: "استمع للإنجليزية يوميًا ولو لدقائق قليلة.", source: "نصيحة للإنجليزية" },
    { text: "اقرأ بصوت عالٍ لتقوي النطق والثقة.", source: "نصيحة للإنجليزية" },
    { text: "لا تنتظر أن تعرف كل الكلمات حتى تفهم المعنى العام.", source: "نصيحة للإنجليزية" },
    { text: "استخدم الخطأ كمعلم، لا كسبب للتوقف.", source: "نصيحة للإنجليزية" },
    { text: "تقدمك الحقيقي يظهر في الأشياء التي أصبحت تفعلها بسهولة.", source: "نصيحة للمذاكرة" },
    { text: "ضع هاتفك بعيدًا أثناء جلسة التركيز.", source: "نصيحة للمذاكرة" },
    { text: "المذاكرة المنتظمة تصنع فرقًا أكبر من الحماس المؤقت.", source: "نصيحة للمذاكرة" },
    { text: "اكتب ملخصًا قصيرًا بعد كل درس.", source: "نصيحة للمذاكرة" },
    { text: "علّم غيرك ما فهمته، وستكتشف أنك فهمته أكثر.", source: "نصيحة للمذاكرة" },
    { text: "خصص وقتًا لمراجعة الكلمات القديمة مع الكلمات الجديدة.", source: "نصيحة للإنجليزية" },
    { text: "لا تؤجل سؤال اليوم إلى نهاية الأسبوع.", source: "نصيحة للمذاكرة" },
    { text: "الهدف الواضح يجعل وقت المذاكرة أكثر قيمة.", source: "نصيحة للمذاكرة" },
    { text: "كن صبورًا مع نفسك، فالتعلم رحلة.", source: "نصيحة للمذاكرة" },
    { text: "ابدأ الآن بما تستطيع، فالبداية أهم من انتظار الوقت المثالي.", source: "نصيحة للمذاكرة" },
    { text: "استمر، حتى لو كان تقدمك بطيئًا؛ البطء مع الاستمرار يصل.", source: "نصيحة للمذاكرة" },
    { text: "اجعل علمك سببًا في نفع نفسك ومن حولك.", source: "نصيحة للمذاكرة" },
    { text: "كل مراجعة جديدة تجعل ذاكرتك أقوى.", source: "نصيحة للمذاكرة" },
    { text: "أنت قادر على التعلم ما دمت مستمرًا في المحاولة.", source: "رسالة تحفيزية" },
  ];

  /* ================= الصورة الشخصية ================= */
  const AV_KEY = (id) => "shadynasr-avatar:" + id;
  // نقبل بس صورة JPEG مضغوطة (Base64) عشان أي قيمة غريبة من قاعدة البيانات ما تتحطّش في الـ CSS
  const validPhoto = (u) => typeof u === "string" && u.length < 250000 && /^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(u);
  let myPhoto = null;

  function paint(el, url) {
    if (!el) return;
    if (url && validPhoto(url)) {
      el.style.backgroundImage = 'url("' + url + '")';
      el.setAttribute("data-has-photo", "");
    } else {
      el.style.backgroundImage = "";
      el.removeAttribute("data-has-photo");
    }
  }

  function applyMyPhoto() {
    paint($("#dashAvatar"), myPhoto);
    const da = $("#dashAvatar");
    if (da) { const s0 = getSession(); da.textContent = !myPhoto && s0 && s0.fullName ? s0.fullName.trim().charAt(0).toUpperCase() : ""; }
    paint($("#profileAvatarPreview"), myPhoto);
    const rm = $("#avatarRemoveBtn");
    if (rm) rm.hidden = !myPhoto;
    const prev = $("#profileAvatarPreview");
    if (prev && !myPhoto) {
      const s = getSession();
      prev.textContent = s && s.fullName ? s.fullName.trim().charAt(0).toUpperCase() : "";
    } else if (prev) prev.textContent = "";
  }

  function setStatus(msg, isError) {
    const el = $("#avatarStatus");
    if (!el) return;
    el.textContent = msg || "";
    el.classList.toggle("is-error", !!isError);
  }

  /* أي صيغة صورة يقدر المتصفح يفتحها (JPG, PNG, WebP, GIF, BMP, AVIF, SVG, HEIC على سفاري...)
     بتتحوّل دايمًا لـ JPEG مربع 256px قبل الحفظ. */
  function loadBitmap(file) {
    if (window.createImageBitmap) {
      // imageOrientation بيصلّح اتجاه صور الموبايل (EXIF) تلقائيًا
      return createImageBitmap(file, { imageOrientation: "from-image" })
        .then((b) => ({ src: b, w: b.width, h: b.height, done: () => b.close && b.close() }))
        .catch(() => loadImg(file));
    }
    return loadImg(file);
  }
  function loadImg(file) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        URL.revokeObjectURL(url);
        // SVG ساعات بيكون من غير أبعاد صريحة
        resolve({ src: img, w: img.naturalWidth || 512, h: img.naturalHeight || 512, done() {} });
      };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("BAD_IMAGE")); };
      img.src = url;
    });
  }

  async function fileToAvatar(file) {
    const bm = await loadBitmap(file);
    if (!bm.w || !bm.h) throw new Error("BAD_IMAGE");
    const S = 256;
    const c = document.createElement("canvas");
    c.width = c.height = S;
    const m = Math.min(bm.w, bm.h);
    const ctx = c.getContext("2d");
    ctx.fillStyle = "#fff"; // الـ JPEG مالوش شفافية: من غير ده أي جزء شفاف في الصورة بيطلع أسود
    ctx.fillRect(0, 0, S, S);
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(bm.src, (bm.w - m) / 2, (bm.h - m) / 2, m, m, 0, 0, S, S);
    bm.done();
    return c.toDataURL("image/jpeg", 0.85);
  }

  async function savePhoto(dataUrl) {
    const s = getSession();
    if (!s) return;
    try {
      if (dataUrl) localStorage.setItem(AV_KEY(s.id), dataUrl);
      else localStorage.removeItem(AV_KEY(s.id));
    } catch { /* مساحة التخزين المحلي ممتلئة — مش مشكلة */ }
    if (!window.SNAuth) throw new Error("NO_REMOTE");
    await SNAuth.saveUserFields(s.id, { photoURL: dataUrl || null });
  }

  async function onPickPhoto(e) {
    const file = e.target.files && e.target.files[0];
    e.target.value = "";
    if (!file) return;
    // مفيش فحص على النوع: بعض الأجهزة بتدّي type فاضي (HEIC مثلًا). لو المتصفح فتحها يبقى تمام، وإلا هيرجّع رسالة الخطأ تحت.
    if (file.size > 30 * 1024 * 1024) return setStatus(tr("avatar_big"), true);
    try {
      const data = await fileToAvatar(file);
      myPhoto = data;
      applyMyPhoto();
      try {
        await savePhoto(data);
        setStatus(tr("avatar_saved"), false);
      } catch {
        setStatus(tr("avatar_local_only"), true);
      }
      state.board = null; loadBoard();
    } catch {
      setStatus(tr("avatar_bad"), true);
    }
  }

  async function onRemovePhoto() {
    myPhoto = null;
    applyMyPhoto();
    try { await savePhoto(null); setStatus(tr("avatar_removed"), false); }
    catch { setStatus(tr("avatar_local_only"), true); }
    state.board = null; loadBoard();
  }

  async function loadMyPhoto() {
    const s = getSession();
    if (!s) return;
    try {
      const cached = localStorage.getItem(AV_KEY(s.id));
      if (validPhoto(cached)) { myPhoto = cached; applyMyPhoto(); }
    } catch { /* ignore */ }
    if (!window.SNAuth || !s.email) return;
    try {
      const u = await SNAuth.findUserByEmail(s.email);
      if (u && validPhoto(u.photoURL)) {
        myPhoto = u.photoURL;
        try { localStorage.setItem(AV_KEY(s.id), myPhoto); } catch { /* ignore */ }
        applyMyPhoto();
        renderHome();
      }
    } catch { /* offline */ }
  }

  /* ================= آخر درس اتفتح ================= */
  const LESSON_KEY = (id) => "shadynasr-last-lesson:" + id;

  function trackLessonClicks() {
    document.addEventListener("click", (e) => {
      const card = e.target.closest && e.target.closest("#coursesGrid .chapter-card");
      const s = getSession();
      if (!card || !s || card.disabled || card.getAttribute("aria-disabled") === "true") return;
      const cards = $$("#coursesGrid .chapter-card");
      const titleEl = $(".chapter-card__title", card);
      const label = (titleEl ? titleEl.textContent : card.textContent).trim();
      try {
        localStorage.setItem(LESSON_KEY(s.id), JSON.stringify({ index: cards.indexOf(card), label }));
      } catch { /* ignore */ }
    }, true);
  }

  function getLastLesson() {
    const s = getSession();
    if (!s) return null;
    try { return JSON.parse(localStorage.getItem(LESSON_KEY(s.id))); } catch { return null; }
  }

  /* ================= البيانات الحقيقية (Firebase) ================= */
  async function loadBoard() {
    const s = getSession();
    if (!s || !window.SNAuth) return;
    try {
      const users = await SNAuth.fetchUsersByGrade(s.grade);
      state.board = users
        .filter((u) => u && u.role !== "admin")
        .sort((a, b) => (Number(b.points) || 0) - (Number(a.points) || 0))
        .slice(0, 4);
    } catch { state.board = []; }
    renderHome();
  }

  function toTs(e) {
    const raw = e.createdAt || e.date || e.timestamp || e.submittedAt || e.at || 0;
    const n = typeof raw === "number" ? raw : Date.parse(raw);
    return Number.isFinite(n) ? n : 0;
  }

  function gradeValue(e) {
    const num = (v) => (typeof v === "number" && Number.isFinite(v) ? v : null);
    const pct = num(e.percent) ?? num(e.percentage);
    if (pct != null) return Math.round(pct) + "%";
    const score = num(e.score);
    const total = num(e.total) ?? num(e.max) ?? num(e.outOf) ?? num(e.maxScore);
    if (score != null && total) return Math.round((score / total) * 100) + "%";
    if (score != null) return String(score);
    return e.grade != null ? String(e.grade) : "—";
  }

  async function loadGrades() {
    const s = getSession();
    if (!s || !window.SNAuth) return;
    try {
      const all = await SNAuth.fetchGrades(s.id);
      const flat = [];
      Object.keys(all || {}).forEach((cat) => {
        Object.keys(all[cat] || {}).forEach((key) => {
          const e = all[cat][key];
          if (e && typeof e === "object") flat.push({ key, ts: toTs(e), title: e.title || e.unitTitle || e.examTitle || e.name || e.label || cat, value: gradeValue(e) });
        });
      });
      flat.sort((a, b) => b.ts - a.ts || (a.key < b.key ? 1 : -1));
      state.grades = flat.slice(0, 4);
    } catch { state.grades = []; }
    renderHome();
  }

  function refreshData(force) {
    if (!force && Date.now() - state.lastLoad < 30000) return;
    state.lastLoad = Date.now();
    loadBoard();
    loadGrades();
  }

  /* ================= رسم صفحة الرئيسية ================= */
  const ICON = {
    lesson: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5V5.25A2.25 2.25 0 0 1 6.25 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5v-1Z"/><path d="M20 18H6.5a2.5 2.5 0 0 0-2.5 2.5"/></svg>',
    board: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 21h8M12 17v4M7 4h10v4a5 5 0 0 1-10 0V4Z"/><path d="M7 5H4a3 3 0 0 0 3 5M17 5h3a3 3 0 0 1-3 5"/></svg>',
    grades: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 3h6v4H9z"/><rect x="5" y="7" width="14" height="14" rx="2"/><path d="M9 13h6M9 17h4"/></svg>',
    progress: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3v18h18"/><path d="M7 15l4-5 3 3 5-7"/></svg>',
    honors: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="9" r="5"/><path d="M8.5 13.5 7 21l5-3 5 3-1.5-7.5"/></svg>',
    arrow: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 6l-6 6 6 6"/></svg>',
  };

  ICON.notes = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 4h14a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-7l-5 4v-4H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z"/><path d="M8 9h8M8 12.5h5"/></svg>';

  function tile(go, icon, title, body, cta) {
    return '<button type="button" class="home-tile home-tile--' + go + '" data-go="' + go + '">' +
      '<span class="home-tile__head"><span class="home-tile__icon" aria-hidden="true">' + icon + '</span><span class="home-tile__title">' + esc(title) + '</span></span>' +
      '<span class="home-tile__body">' + body + '</span>' +
      '<span class="home-tile__cta">' + esc(cta) + ICON.arrow + '</span></button>';
  }

  const initial = (n) => (n ? String(n).trim().charAt(0).toUpperCase() : "?");
  const txt = (sel) => { const el = $(sel); return el ? el.textContent.trim() : "0"; };

  function renderHomeIdentity(user) {
    const name = $("#homeIdentityName");
    const grade = $("#homeIdentityGrade");
    if (name) name.textContent = user && user.fullName ? user.fullName : "—";
    if (grade) grade.textContent = user && GRADE_NAMES[user.grade] ? GRADE_NAMES[user.grade] : "—";
  }

  function renderStudyQuote() {
    const text = $("#homeQuoteText");
    const source = $("#homeQuoteSource");
    if (!text || !source) return;
    const key = "shadynasr-last-study-quote";
    const previous = Number(localStorage.getItem(key));
    const next = Number.isInteger(previous) ? (previous + 1) % STUDY_QUOTES.length : Math.floor(Math.random() * STUDY_QUOTES.length);
    const quote = STUDY_QUOTES[next];
    localStorage.setItem(key, String(next));
    text.textContent = quote.text;
    source.textContent = quote.source;
  }

  function renderHome() {
    const grid = $("#homeGrid");
    if (!grid) return;
    const s = getSession();

    renderHomeIdentity(s);
    renderStudyQuote();

    const hello = $("#homeHello");
    if (hello) hello.textContent = tr("home_hello") + (s && s.fullName ? "، " + s.fullName.trim().split(/\s+/)[0] : "");

    // 1) آخر درس
    const last = getLastLesson();
    const lessonBody = last && last.label
      ? '<span class="home-lesson__label">' + esc(last.label) + '</span><span class="home-lesson__sub">' + esc(tr("tile_lesson_sub")) + '</span>'
      : '<span class="home-tile__empty">' + esc(tr("tile_lesson_empty")) + '</span>';

    // 2) لوحة الصدارة (أول 4)
    let boardBody;
    if (state.board == null) boardBody = '<span class="home-tile__empty">' + esc(tr("tile_loading")) + '</span>';
    else if (!state.board.length) boardBody = '<span class="home-tile__empty">' + esc(tr("tile_board_empty")) + '</span>';
    else boardBody = state.board.map((u, i) => {
      const photo = s && u.id === s.id && myPhoto ? myPhoto : u.photoURL;
      const ok = validPhoto(photo);
      return '<span class="home-row"><span class="home-row__rank">' + (i + 1) + '</span>' +
        '<span class="dash-leaderboard__avatar"' + (ok ? ' data-has-photo style="background-image:url(&quot;' + photo + '&quot;)"' : '') + '>' + esc(initial(u.fullName)) + '</span>' +
        '<span class="home-row__name">' + esc(u.fullName) + '</span>' +
        '<span class="home-row__value">' + (Number(u.points) || 0) + ' ' + esc(tr("pts")) + '</span></span>';
    }).join("");

    // 3) آخر الدرجات
    let gradesBody;
    if (state.grades == null) gradesBody = '<span class="home-tile__empty">' + esc(tr("tile_loading")) + '</span>';
    else if (!state.grades.length) gradesBody = '<span class="home-tile__empty">' + esc(tr("tile_grades_empty")) + '</span>';
    else gradesBody = state.grades.map((g) =>
      '<span class="home-row"><span class="home-row__name">' + esc(g.title) + '</span><span class="home-row__value">' + esc(g.value) + '</span></span>'
    ).join("");

    // 4) التقدم (بيقرأ نفس الأرقام اللي في صفحة التقدم الأكاديمي)
    const stat = (v, l) => '<span class="home-mini-stat"><strong>' + esc(v) + '</strong><span>' + esc(tr(l)) + '</span></span>';
    const progressBody = '<span class="home-mini-stats">' +
      stat(txt("#statOverall"), "st_overall") + stat(txt("#statLessons"), "st_lessons") +
      stat(txt("#statStreak"), "st_streak") + stat(txt("#profilePoints"), "st_points") + '</span>';

    grid.innerHTML =
      tile("lesson", ICON.lesson, tr("tile_lesson"), lessonBody, tr("tile_lesson_go")) +
      tile("leaderboard", ICON.board, tr("tile_board"), boardBody, tr("home_open")) +
      tile("grades", ICON.grades, tr("tile_grades"), gradesBody, tr("home_open")) +
      tile("progress", ICON.progress, tr("tile_progress"), progressBody, tr("home_open")) +
      tile("honors", ICON.honors, tr("tile_honors"), '<span class="home-lesson__sub">' + esc(tr("tile_honors_body")) + "</span>", tr("home_open")) +
      tile("teachernotes", ICON.notes, tr("tile_notes"), '<span class="home-lesson__sub">' + esc(window.snTeacherNotes ? window.snTeacherNotes.summary() : tr("tile_notes_body")) + "</span>", tr("home_open"));
  }

  /* ================= التنقّل ================= */
  let navigated = false;

  function closeSidebar() {
    const sb = $("#dashSidebar");
    if (sb) sb.classList.remove("is-open");
    const bd = $("#dashSidebarBackdrop");
    if (bd) bd.hidden = true;
    const mb = $("#dashMenuBtn");
    if (mb) mb.setAttribute("aria-expanded", "false");
  }

  function showHome() {
    $$(".dash-panel").forEach((p) => p.classList.toggle("is-active", p.dataset.panel === "home"));
    $$(".dash-nav__link").forEach((l) => l.classList.toggle("is-active", l.dataset.target === "home"));
    const title = $("#dashPanelTitle");
    if (title) title.textContent = tr("dash_nav_home");
    closeSidebar();
    renderHome();
    refreshData(false);
  }

  function go(target) {
    const link = $('.dash-nav__link[data-target="' + target + '"]');
    if (link) link.click();
  }

  function resumeLesson() {
    go("courses");
    const last = getLastLesson();
    if (!last) return;
    setTimeout(() => {
      const card = $$("#coursesGrid .chapter-card")[last.index];
      const t = card && $(".chapter-card__title", card);
      if (card && (!t || t.textContent.trim() === last.label)) card.click();
    }, 60);
  }

  function initNav() {
    // زرار "الرئيسية": بنتعامل معاه إحنا، من غير ما نلمس منطق dashboard.js
    document.addEventListener("click", (e) => {
      const el = e.target.closest && e.target.closest("[data-target]");
      if (!el) return;
      navigated = true;
      if (el.dataset.target === "home") {
        e.stopImmediatePropagation();
        showHome();
      }
    }, true);

    // أي صفحة تانية تتفتح تقفل الرئيسية
    const homePanel = $('[data-panel="home"]');
    const obs = new MutationObserver((muts) => {
      muts.forEach((m) => {
        const p = m.target;
        if (p !== homePanel && p.classList.contains("is-active") && homePanel.classList.contains("is-active")) {
          homePanel.classList.remove("is-active");
        }
      });
    });
    $$(".dash-panel").forEach((p) => { if (p !== homePanel) obs.observe(p, { attributes: true, attributeFilter: ["class"] }); });

    $("#homeGrid").addEventListener("click", (e) => {
      const t = e.target.closest(".home-tile");
      if (!t) return;
      if (t.dataset.go === "lesson") resumeLesson();
      else go(t.dataset.go);
    });

    // أول ما الصفحة تفتح تبقى الرئيسية (لو المستخدم لسه ما داسش على حاجة)
    const ensureDefault = () => {
      if (navigated) return;
      const active = $$(".dash-panel.is-active");
      if (!(active.length === 1 && active[0] === homePanel)) showHome();
    };
    window.addEventListener("load", () => { ensureDefault(); setTimeout(ensureDefault, 800); });

    // الأرقام في مربع "تقدّمك" تتحدّث لوحدها لما dashboard.js يحسبها
    let raf = 0;
    const statObs = new MutationObserver(() => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(renderHome);
    });
    ["#statOverall", "#statLessons", "#statStreak", "#profilePoints"].forEach((sel) => {
      const el = $(sel);
      if (el) statObs.observe(el, { childList: true, characterData: true, subtree: true });
    });
  }

  /* ================= تشغيل ================= */
  document.addEventListener("DOMContentLoaded", () => {
    if (!$("#homeGrid")) return;

    const splash = $("#studentSplash");
    if (splash) {
      // الدايرة بتبدأ بعد ما سبلاش الافتتاح (شعار ← موجة ← الاسم) يخلص، وبعدها ندخل المنصة.
      const afterLaunch = window.snLaunch ? window.snLaunch.done : Promise.resolve();
      afterLaunch.then(() => {
        window.setTimeout(() => {
          splash.classList.add("is-done");
          window.setTimeout(() => splash.remove(), 500);
        }, 1700);
      });
    }

    // إعادة رسم الرئيسية عند تغيير اللغة
    if (typeof applyLanguage === "function") {
      const orig = applyLanguage;
      window.applyLanguage = function (lang) {
        orig(lang);
        renderHome();
        const active = $(".dash-nav__link.is-active");
        const title = $("#dashPanelTitle");
        if (active && title && $('[data-panel="home"]').classList.contains("is-active")) title.textContent = tr("dash_nav_home");
      };
    }
    // دلوقتي القاموس اتوسّع: نطبّق الترجمة على اللغة الحالية
    if (typeof applyTranslations === "function") applyTranslations(curLang());

    // shared.js مابيشغّلش المظهر/اللغة تلقائيًا في لوحة الطالب (AuthUI.init مش بيتنادى هنا)،
    // فبنربط زرايرهم إحنا هنا — بعد ما غلّفنا applyLanguage فوق.
    if (typeof initTheme === "function") initTheme();
    if (typeof initLang === "function") initLang();

    trackLessonClicks();
    initNav();
    renderHome();
    refreshData(true);

    const input = $("#avatarInput");
    if (input) input.addEventListener("change", onPickPhoto);
    const rm = $("#avatarRemoveBtn");
    if (rm) rm.addEventListener("click", onRemovePhoto);
    applyMyPhoto();
    loadMyPhoto();
  });
})();
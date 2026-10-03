/* dashboard.js — Student Dashboard (studenti.html) only.
   Estratto da shared.js: questa logica (auth-guard + redirect, lesson engine,
   grafici, leaderboard, pomodoro, note, badge...) riguarda SOLO studenti.html.
   Va caricato con <script defer src="dashboard.js"></script> DOPO shared.js,
   solo dentro studenti.html — mai in index.html / login.html / admin.html,
   altrimenti l'auth-guard reindirizza subito a login.html su ogni pagina. */

/* ==========================================================================
   Student Dashboard (studenti.html) logic
   ========================================================================== */
/* ==========================================================================
   Shady Nasr — Student Dashboard script
   Reuses the same localStorage keys as assets/js/app.js (kept in sync
   manually since app.js keeps its helpers private inside its own IIFE).
   Prototype only: real data (courses, grades, leaderboard) is mocked here
   and should be swapped for API calls once a backend exists.
   ========================================================================== */

(() => {
  "use strict";

  const STORAGE_AUTH = "shadynasr-auth";
  const STORAGE_CURRENT_USER = "shadynasr-current-user";
  const STORAGE_BLUR = "shadynasr-blur-level";
  const DB_KEY = "shadynasr-db-users";

  const INLINE_ICONS = {
    check: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12 4 4L19 6"/></svg>',
    lock: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="10" width="14" height="10" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></svg>',
    edit: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m4 16-.8 4.8L8 20l11-11-4-4L4 16Z"/><path d="m13.5 6.5 4 4"/></svg>',
    star: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9L12 3Z"/></svg>',
    warning: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 2.7 20h18.6L12 3Z"/><path d="M12 9v5M12 17h.01"/></svg>',
  };

  const INLINE_ICONS_LOCK_BIG = INLINE_ICONS.lock;

  const inlineIcon = (name, label = "") => `<span class="inline-status-icon inline-status-icon--${name}"${label ? ` aria-label="${label}"` : ""}>${INLINE_ICONS[name]}</span>`;

  const GRADE_LABELS = {
    prep1: "الصف الأول الإعدادي",
    prep2: "الصف الثاني الإعدادي",
    prep3: "الصف الثالث الإعدادي",
    secondary1: "الصف الأول الثانوي",
    secondary2: "الصف الثاني الثانوي",
    secondary3: "الصف الثالث الثانوي",
  };

  // --- Storage helpers (mirrors app.js) ---------------------------------
  function getUsers() {
    try {
      const raw = JSON.parse(localStorage.getItem(DB_KEY));
      return Array.isArray(raw) ? raw : [];
    } catch {
      return [];
    }
  }

  function saveUsers(users) {
    localStorage.setItem(DB_KEY, JSON.stringify(users));
  }

  function getSessionUser() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_CURRENT_USER));
    } catch {
      return null;
    }
  }

  /** بيانات المستخدم الحالي الكاملة (السن، النوع، النقط، البادجات...) من الكاش المحلي، بعد ما اتزامن مع Firebase في الإقلاع. */
  function getFullCurrentUser() {
    const session = getSessionUser();
    if (!session) return null;

    const users = getUsers();
    let user = users.find((u) => u.id === session.id || u.email === session.email);

    if (!user) {
      // نسخة الجلسة الخفيفة بس متاحة (مثلاً أول تحميل قبل ما تكتمل المزامنة) — بيانات ناقصة مؤقتًا.
      user = { ...session };
    }
    user.points = Number.isFinite(user.points) ? user.points : 0;
    user.badges = Array.isArray(user.badges) ? user.badges : [];
    return user;
  }

  function persistUser(updated) {
    const users = getUsers();
    const idx = users.findIndex((u) => u.id === updated.id);
    if (idx >= 0) {
      users[idx] = updated;
      saveUsers(users);
    }
    // Keep the lightweight session cache in sync (name/grade shown across the site).
    if (getSessionUser()) {
      localStorage.setItem(
        STORAGE_CURRENT_USER,
        JSON.stringify({ id: updated.id, fullName: updated.fullName, email: updated.email, grade: updated.grade, role: updated.role || "student" })
      );
    }
  }

  function initials(name) {
    return (name || "?").trim().charAt(0).toUpperCase();
  }

  /** كتابة في Firebase في الخلفية (userData/{id}/{path}). لو فشلت، البيانات تفضل محفوظة محليًا. */
  function syncSet(user, path, value) {
    if (!window.SNAuth || !window.SNAuth.userDataSet || !user) return;
    window.SNAuth.userDataSet(user.id, path, value).catch((err) =>
      console.warn("تعذر حفظ " + path + " في Firebase", err)
    );
  }

  // قواعد النقط (غيّري الأرقام من هنا لو حابة): بتتحسب وتتخزن في Firebase وبتظهر في لوحة المتصدرين.
  const POINTS_PER_NEW_LESSON = 5;
  const POINTS_FOR_PASSING_UNIT = 20;

  /** بيضيف نقط/بادج للطالب الحالي ويحفظهم في users/{id} (نفس مكان لوحة المتصدرين). */
  function awardPoints(amount, badgeId) {
    const full = getFullCurrentUser();
    if (!full) return;
    full.points = (Number.isFinite(full.points) ? full.points : 0) + (amount || 0);
    full.badges = Array.isArray(full.badges) ? full.badges : [];
    if (badgeId && !full.badges.includes(badgeId)) full.badges.push(badgeId);
    persistUser(full);
    if (window.SNAuth && window.SNAuth.saveUserFields) {
      window.SNAuth.saveUserFields(full.id, { points: full.points, badges: full.badges }).catch((err) =>
        console.warn("تعذر حفظ النقط في Firebase", err)
      );
    }
    renderPointsAndBadges(full);
  }

  // --- Sidebar navigation -------------------------------------------------
  function initNav() {
    const links = document.querySelectorAll(".dash-nav__link");
    const panels = document.querySelectorAll(".dash-panel");
    const title = document.getElementById("dashPanelTitle");
    const sidebar = document.getElementById("dashSidebar");
    const backdrop = document.getElementById("dashSidebarBackdrop");
    const menuBtn = document.getElementById("dashMenuBtn");

    function activate(target) {
      links.forEach((l) => l.classList.toggle("is-active", l.dataset.target === target));
      panels.forEach((p) => p.classList.toggle("is-active", p.dataset.panel === target));
      const activeLink = Array.from(links).find((l) => l.dataset.target === target);
      if (activeLink && title) title.textContent = activeLink.querySelector("span").textContent;
      closeSidebar();
      pushPanelState({ targetPanel: target, titleText: title ? title.textContent : "", navTarget: target });
    }

    function openSidebar() {
      sidebar?.classList.add("is-open");
      document.documentElement.classList.add("dash-sidebar-open");
      backdrop && (backdrop.hidden = false);
      menuBtn?.setAttribute("aria-expanded", "true");
    }

    function closeSidebar() {
      sidebar?.classList.remove("is-open");
      document.documentElement.classList.remove("dash-sidebar-open");
      backdrop && (backdrop.hidden = true);
      menuBtn?.setAttribute("aria-expanded", "false");
    }

    // أول قسم (الرئيسية) هو بداية السجل: الرجوع منه يطلّع المستخدم من الموقع
    const homeLink = Array.from(links).find((l) => l.dataset.target === "home");
    currentPanelState = { targetPanel: "home", titleText: title ? title.textContent : "", navTarget: "home" };
    history.replaceState({ snPanel: currentPanelState }, "");
    window.addEventListener("popstate", (e) => {
      const st = (e.state && e.state.snPanel) || { targetPanel: "home", titleText: homeLink ? homeLink.querySelector("span").textContent : "", navTarget: "home" };
      currentPanelState = st;
      showPanel(st.targetPanel, st.titleText, st.navTarget);
      closeSidebar();
    });

    links.forEach((link) => link.addEventListener("click", () => activate(link.dataset.target)));
    document.querySelectorAll("[data-target='profile']").forEach((el) => {
      if (!el.classList.contains("dash-nav__link")) el.addEventListener("click", () => activate("profile"));
    });

    menuBtn?.addEventListener("click", () => {
      sidebar?.classList.contains("is-open") ? closeSidebar() : openSidebar();
    });
    backdrop?.addEventListener("click", closeSidebar);
    document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeSidebar(); });
    window.addEventListener("resize", () => { if (window.innerWidth >= 980) closeSidebar(); });
  }

  function initLogout() {
    document.getElementById("dashLogoutBtn")?.addEventListener("click", async () => {
      const ar = document.documentElement.lang !== "en";
      const dlg = {
        icon: "logout",
        tone: "danger",
        title: ar ? "تسجيل الخروج" : "Log out",
        message: ar ? "هتخرج من حسابك على الجهاز ده. متأكد إنك عايز تسجّل الخروج؟" : "You will be signed out of your account on this device. Are you sure?",
        confirmText: ar ? "تسجيل الخروج" : "Log out",
        cancelText: ar ? "رجوع" : "Stay signed in",
      };
      const sure = window.snDialog ? await window.snDialog.confirm(dlg) : window.confirm(dlg.message);
      if (!sure) return;
      localStorage.removeItem(STORAGE_AUTH);
      localStorage.removeItem(STORAGE_CURRENT_USER);
      window.location.replace("index.html");
    });
  }

  // --- Top bar / identity --------------------------------------------------
  function renderIdentity(user) {
    const nameEl = document.getElementById("dashUserName");
    const gradeEl = document.getElementById("dashUserGrade");
    const avatarEl = document.getElementById("dashAvatar");
    if (nameEl) nameEl.textContent = user.fullName;
    if (gradeEl) gradeEl.textContent = GRADE_LABELS[user.grade] || "طالب";
    if (avatarEl) avatarEl.textContent = "";
  }

  // --- تنقّل عام بين لوحات الصفحة (يُستخدم مع محرك الدروس/الامتحانات) --------
  // --- سجل المتصفح (زرار الرجوع) بين أقسام اللوحة -------------------------
  function showPanel(targetPanel, titleText, navTarget) {
    document.querySelectorAll(".dash-panel").forEach((p) => p.classList.toggle("is-active", p.dataset.panel === targetPanel));
    document.querySelectorAll(".dash-nav__link").forEach((l) => l.classList.toggle("is-active", l.dataset.target === (navTarget || targetPanel)));
    const title = document.getElementById("dashPanelTitle");
    if (title && titleText) title.textContent = titleText;
    document.getElementById("dashMain")?.scrollTo({ top: 0, behavior: "instant" });
  }

  let currentPanelState = null;
  function pushPanelState(state) {
    if (currentPanelState && currentPanelState.targetPanel === state.targetPanel && currentPanelState.titleText === state.titleText) return;
    currentPanelState = state;
    history.pushState({ snPanel: state }, "");
  }

  // تنقّل عام بين لوحات الصفحة (يُستخدم مع محرك الدروس/الامتحانات)
  function goToPanel(targetPanel, titleText, navTarget) {
    showPanel(targetPanel, titleText, navTarget);
    pushPanelState({ targetPanel, titleText, navTarget });
  }

  // --- الكورسات -------------------------------------------------------------
  function renderCourses(user) {
    renderLessonsList(user.grade, user);
  }

  // --- محرك عرض الدروس والامتحانات -------------------------------------------
  /** Prototype data — replace with API results once a backend exists.
   *  Each lesson: { id, number, title, desc, videoUrl, text[] (or pdfUrl),
   *  worksheetUrl, optionalExam, vocabExam }. Each exam: { id, title, questions[] }.
   *  A question is either MCQ — { id, type:"mcq", q, options[], correctIndex } — auto-graded,
   *  or essay — { id, type:"essay", q } — saved for manual grading by an admin. */
  const LESSON_DATA = {
    prep1: [
      {
        id: "prep1-l1",
        number: 1,
        title: "Present Simple Tense",
        desc: "المضارع البسيط: الحقائق والعادات اليومية.",
        videoUrl: "",
        worksheetUrl: "",
        text: [
          "We use the Present Simple tense to talk about facts, habits, and things that are always true. For example: \"I play football every Friday.\" or \"The sun rises in the east.\"",
          "With he/she/it, we add -s or -es to the verb: \"She plays tennis.\" \"He watches TV every night.\"",
        ],
        optionalExam: {
          id: "prep1-l1-optional",
          title: "امتحان اختياري شامل — Present Simple",
          questions: [
            { id: "q1", type: "mcq", q: "Choose the correct sentence.", options: ["She play football.", "She plays football.", "She playing football.", "She played football."], correctIndex: 1 },
            { id: "q2", type: "mcq", q: "My brother ____ to school every day.", options: ["go", "goes", "going", "gone"], correctIndex: 1 },
            { id: "q3", type: "mcq", q: "He ____ (watch) TV every night.", options: ["watch", "watches", "watching", "watched"], correctIndex: 1 },
            { id: "q4", type: "mcq", q: "Choose the negative form: \"She doesn't ____ coffee.\"", options: ["like", "likes", "liking", "liked"], correctIndex: 0 },
            { id: "q5", type: "essay", q: "اكتب جملتين بصيغة المضارع البسيط عن روتينك اليومي (Write two Present Simple sentences about your daily routine)." },
          ],
        },
        vocabExam: {
          id: "prep1-l1-vocab",
          title: "امتحان معاني الكلمات — Present Simple Vocabulary",
          questions: [
            { id: "q1", type: "mcq", q: "What does \"habit\" mean?", options: ["a place", "something you do regularly", "a food", "a color"], correctIndex: 1 },
            { id: "q2", type: "mcq", q: "\"Rises\" in \"The sun rises\" means:", options: ["goes down", "goes up", "stays still", "disappears"], correctIndex: 1 },
            { id: "q3", type: "mcq", q: "\"Every day\" means:", options: ["once", "never", "each day", "last day"], correctIndex: 2 },
            { id: "q4", type: "mcq", q: "The opposite of \"always\" is:", options: ["often", "sometimes", "never", "usually"], correctIndex: 2 },
          ],
        },
      },
      {
        id: "prep1-l2",
        number: 2,
        title: "Family & Daily Routine Vocabulary",
        desc: "مفردات الأسرة والروتين اليومي.",
        videoUrl: "",
        worksheetUrl: "",
        text: [
          "Learning family words helps you talk about people you love: mother, father, brother, sister, grandmother, grandfather.",
          "Daily routine words describe what you do every day: wake up, brush your teeth, have breakfast, go to school, do homework, go to bed.",
        ],
        optionalExam: {
          id: "prep1-l2-optional",
          title: "امتحان اختياري شامل — Family & Routine",
          questions: [
            { id: "q1", type: "mcq", q: "Your father's mother is your ____.", options: ["aunt", "grandmother", "sister", "cousin"], correctIndex: 1 },
            { id: "q2", type: "mcq", q: "What do you do first in the morning?", options: ["go to bed", "wake up", "have dinner", "do homework"], correctIndex: 1 },
            { id: "q3", type: "mcq", q: "\"Brush your teeth\" happens:", options: ["once a year", "in the morning and at night", "only on Friday", "never"], correctIndex: 1 },
            { id: "q4", type: "mcq", q: "Your mother's sister is your ____.", options: ["aunt", "uncle", "cousin", "niece"], correctIndex: 0 },
            { id: "q5", type: "essay", q: "صف روتينك اليومي في 2-3 جمل بالإنجليزية (Describe your daily routine in 2-3 English sentences)." },
          ],
        },
        vocabExam: {
          id: "prep1-l2-vocab",
          title: "امتحان معاني الكلمات — Family & Routine",
          questions: [
            { id: "q1", type: "mcq", q: "\"Sibling\" means:", options: ["a parent", "a brother or sister", "a teacher", "a friend"], correctIndex: 1 },
            { id: "q2", type: "mcq", q: "\"Homework\" means:", options: ["school work done at home", "a type of food", "a game", "a holiday"], correctIndex: 0 },
            { id: "q3", type: "mcq", q: "\"Grandfather\" is your:", options: ["father's or mother's father", "father's brother", "your son", "your uncle"], correctIndex: 0 },
            { id: "q4", type: "mcq", q: "\"Routine\" means:", options: ["a surprise", "things you do regularly", "a vacation", "a mistake"], correctIndex: 1 },
          ],
        },
      },
    ],
    prep2: [
      {
        id: "prep2-l1",
        number: 1,
        title: "Past Simple Tense",
        desc: "الماضي البسيط: أحداث انتهت في الماضي.",
        videoUrl: "",
        worksheetUrl: "",
        text: [
          "We use the Past Simple to talk about finished actions in the past. Regular verbs add -ed: \"She walked to school yesterday.\"",
          "Irregular verbs change form: go → went, eat → ate, see → saw. Example: \"They went to the museum last week.\"",
        ],
        optionalExam: {
          id: "prep2-l1-optional",
          title: "امتحان اختياري شامل — Past Simple",
          questions: [
            { id: "q1", type: "mcq", q: "Yesterday, I ____ (walk) to the park.", options: ["walk", "walked", "walking", "walks"], correctIndex: 1 },
            { id: "q2", type: "mcq", q: "Choose the correct past form of \"go\".", options: ["goed", "went", "gone", "going"], correctIndex: 1 },
            { id: "q3", type: "mcq", q: "They ____ (see) a good film last night.", options: ["see", "saw", "seen", "seeing"], correctIndex: 1 },
            { id: "q4", type: "mcq", q: "Which sentence is in the Past Simple?", options: ["She plays tennis.", "She played tennis.", "She is playing tennis.", "She will play tennis."], correctIndex: 1 },
            { id: "q5", type: "essay", q: "اكتب فقرة قصيرة (3 جمل) عن يوم أمس باستخدام الماضي البسيط (Write a short 3-sentence paragraph about yesterday using the Past Simple)." },
          ],
        },
        vocabExam: {
          id: "prep2-l1-vocab",
          title: "امتحان معاني الكلمات — Past Simple Vocabulary",
          questions: [
            { id: "q1", type: "mcq", q: "\"Yesterday\" means:", options: ["tomorrow", "the day before today", "today", "next week"], correctIndex: 1 },
            { id: "q2", type: "mcq", q: "\"Museum\" is a place where you:", options: ["buy food", "see historical objects", "sleep", "swim"], correctIndex: 1 },
            { id: "q3", type: "mcq", q: "The past form of \"eat\" is:", options: ["eated", "ate", "eaten", "eating"], correctIndex: 1 },
            { id: "q4", type: "mcq", q: "\"Finished\" means:", options: ["still happening", "completed", "starting", "planned"], correctIndex: 1 },
          ],
        },
      },
      {
        id: "prep2-l2",
        number: 2,
        title: "Adjectives & Comparatives",
        desc: "الصفات وصيغ المقارنة بين شيئين.",
        videoUrl: "",
        worksheetUrl: "",
        text: [
          "Adjectives describe nouns: \"a tall boy\", \"a beautiful garden\". Comparative adjectives compare two things: \"taller\", \"more beautiful\".",
          "Short adjectives usually add -er: tall → taller. Long adjectives use \"more\": beautiful → more beautiful.",
        ],
        optionalExam: {
          id: "prep2-l2-optional",
          title: "امتحان اختياري شامل — Comparatives",
          questions: [
            { id: "q1", type: "mcq", q: "Cairo is ____ than my village.", options: ["big", "bigger", "biggest", "more big"], correctIndex: 1 },
            { id: "q2", type: "mcq", q: "This book is ____ than that one.", options: ["interesting", "more interesting", "interestinger", "most interesting"], correctIndex: 1 },
            { id: "q3", type: "mcq", q: "Choose the correct comparative of \"happy\".", options: ["happyer", "more happy", "happier", "happiest"], correctIndex: 2 },
            { id: "q4", type: "mcq", q: "Which sentence is correct?", options: ["She is more taller than me.", "She is taller than me.", "She is tall than me.", "She is the tall than me."], correctIndex: 1 },
            { id: "q5", type: "essay", q: "قارن بين مدينتين تعرفهما باستخدام صفات المقارنة (Compare two cities you know using comparative adjectives)." },
          ],
        },
        vocabExam: {
          id: "prep2-l2-vocab",
          title: "امتحان معاني الكلمات — Adjectives",
          questions: [
            { id: "q1", type: "mcq", q: "\"Beautiful\" means:", options: ["ugly", "pretty / attractive", "boring", "small"], correctIndex: 1 },
            { id: "q2", type: "mcq", q: "The opposite of \"tall\" is:", options: ["short", "wide", "heavy", "fast"], correctIndex: 0 },
            { id: "q3", type: "mcq", q: "\"Compare\" means:", options: ["to ignore", "to look at differences and similarities", "to forget", "to build"], correctIndex: 1 },
            { id: "q4", type: "mcq", q: "\"Interesting\" describes something that is:", options: ["boring", "exciting to learn about", "difficult", "expensive"], correctIndex: 1 },
          ],
        },
      },
    ],
    prep3: [
      {
        id: "prep3-l1",
        number: 1,
        title: "Present Perfect Tense",
        desc: "المضارع التام وربط الماضي بالحاضر.",
        videoUrl: "",
        worksheetUrl: "",
        text: [
          "We use the Present Perfect to talk about actions that happened at an unspecified time before now, or that connect the past to the present: \"I have visited Cairo three times.\"",
          "Form: have/has + past participle. Example: \"She has finished her homework.\" \"They have never been to Alexandria.\"",
        ],
        optionalExam: {
          id: "prep3-l1-optional",
          title: "امتحان اختياري شامل — Present Perfect",
          questions: [
            { id: "q1", type: "mcq", q: "She ____ (finish) her project already.", options: ["finish", "finished", "has finished", "finishing"], correctIndex: 2 },
            { id: "q2", type: "mcq", q: "Choose the correct sentence.", options: ["I have never been to Paris.", "I have never went to Paris.", "I never have been to Paris.", "I have never being to Paris."], correctIndex: 0 },
            { id: "q3", type: "mcq", q: "Which auxiliary goes with he/she/it in the Present Perfect?", options: ["have", "has", "had", "having"], correctIndex: 1 },
            { id: "q4", type: "mcq", q: "Choose the past participle of \"write\".", options: ["wrote", "written", "writing", "writes"], correctIndex: 1 },
            { id: "q5", type: "essay", q: "اكتب 3 جمل عن إنجازات حققتها حتى الآن باستخدام Present Perfect (Write 3 sentences about achievements you have made so far using the Present Perfect)." },
          ],
        },
        vocabExam: {
          id: "prep3-l1-vocab",
          title: "امتحان معاني الكلمات — Present Perfect Vocabulary",
          questions: [
            { id: "q1", type: "mcq", q: "\"Achievement\" means:", options: ["a mistake", "something you have successfully done", "a question", "a place"], correctIndex: 1 },
            { id: "q2", type: "mcq", q: "\"Already\" means:", options: ["not yet", "before now / sooner than expected", "never", "tomorrow"], correctIndex: 1 },
            { id: "q3", type: "mcq", q: "The past participle of \"see\" is:", options: ["saw", "seen", "seeing", "sees"], correctIndex: 1 },
            { id: "q4", type: "mcq", q: "\"Connect\" means:", options: ["to separate", "to join or link", "to destroy", "to hide"], correctIndex: 1 },
          ],
        },
      },
      {
        id: "prep3-l2",
        number: 2,
        title: "Persuasive Writing Basics",
        desc: "أساسيات الكتابة الإقناعية.",
        videoUrl: "",
        worksheetUrl: "",
        text: [
          "Persuasive writing tries to convince the reader to agree with an opinion. Good persuasive writing uses clear reasons and examples.",
          "Useful phrases: \"I strongly believe that...\", \"For these reasons...\", \"In conclusion...\". Always support your opinion with evidence.",
        ],
        optionalExam: {
          id: "prep3-l2-optional",
          title: "امتحان اختياري شامل — Persuasive Writing",
          questions: [
            { id: "q1", type: "mcq", q: "The purpose of persuasive writing is to:", options: ["entertain only", "convince the reader", "describe a place", "tell a story"], correctIndex: 1 },
            { id: "q2", type: "mcq", q: "Which phrase introduces a strong opinion?", options: ["Maybe, I don't know...", "I strongly believe that...", "It's not important...", "I'm not sure..."], correctIndex: 1 },
            { id: "q3", type: "mcq", q: "A good persuasive paragraph should include:", options: ["only opinions", "reasons and evidence", "no examples", "random facts"], correctIndex: 1 },
            { id: "q4", type: "mcq", q: "Which sentence best concludes a persuasive paragraph?", options: ["Anyway, forget it.", "In conclusion, schools should start later.", "I don't care.", "Maybe not."], correctIndex: 1 },
            { id: "q5", type: "essay", q: "اكتب فقرة إقناعية قصيرة (4-5 جمل) عن رأيك في أهمية القراءة (Write a short persuasive paragraph, 4-5 sentences, about the importance of reading)." },
          ],
        },
        vocabExam: {
          id: "prep3-l2-vocab",
          title: "امتحان معاني الكلمات — Persuasive Vocabulary",
          questions: [
            { id: "q1", type: "mcq", q: "\"Convince\" means:", options: ["to confuse", "to make someone believe something", "to ignore", "to forget"], correctIndex: 1 },
            { id: "q2", type: "mcq", q: "\"Evidence\" means:", options: ["a guess", "proof or facts that support an idea", "a question", "an opinion only"], correctIndex: 1 },
            { id: "q3", type: "mcq", q: "\"Conclusion\" is:", options: ["the beginning of a text", "the final part that sums up ideas", "a random sentence", "a question"], correctIndex: 1 },
            { id: "q4", type: "mcq", q: "The opposite of \"strongly\" (as in \"strongly believe\") is:", options: ["firmly", "weakly / slightly", "clearly", "confidently"], correctIndex: 1 },
          ],
        },
      },
    ],
  };

  // --- نظام الوحدات: امتحان واحد لكل وحدة، بأسئلة مختلفة لكل طالب ------------
  /** كل وحدة فيها دروس (فيديو + PDF + شيت) وبعدها امتحان الوحدة. الطالب مش بيفتح
   *  الوحدة اللي بعدها إلا لما ينجح (75%+) في امتحان الوحدة الحالية.
   *  الأسئلة بتيجي من بنك الأسئلة (window.QUESTION_BANK[bankKey]) اللي في ملف questions-*.js. */
  const PASS_PERCENT = 70; // النجاح (وقفل الإعادة) من 70% فما فوق

  const UNIT_DATA = {
    prep1: [
      {
        id: "prep1-u1",
        number: 1,
        title: "Life in a digital world",
        desc: "الوحدة الأولى: الحياة في العالم الرقمي",
        bankKey: "unit1",
        lessons: [
          { id: "prep1-u1-l1", number: 1, title: "Lesson 1", desc: "الدرس الأول من الوحدة", videoUrl: "", pdfUrl: "", worksheetUrl: "" },
          { id: "prep1-u1-l2", number: 2, title: "Lesson 2", desc: "الدرس الثاني من الوحدة", videoUrl: "", pdfUrl: "", worksheetUrl: "" },
          { id: "prep1-u1-l3", number: 3, title: "Lesson 3", desc: "الدرس الثالث من الوحدة", videoUrl: "", pdfUrl: "", worksheetUrl: "" },
        ],
      },
      {
        id: "prep1-u2",
        number: 2,
        title: "Learning to learn",
        desc: "الوحدة الثانية: تعلّم كيف تتعلّم",
        bankKey: "unit2",
        lessons: [
          { id: "prep1-u2-l1", number: 1, title: "Lesson 1", desc: "الدرس الأول من الوحدة", videoUrl: "", pdfUrl: "", worksheetUrl: "" },
          { id: "prep1-u2-l2", number: 2, title: "Lesson 2", desc: "الدرس الثاني من الوحدة", videoUrl: "", pdfUrl: "", worksheetUrl: "" },
          { id: "prep1-u2-l3", number: 3, title: "Lesson 3", desc: "الدرس الثالث من الوحدة", videoUrl: "", pdfUrl: "", worksheetUrl: "" },
        ],
      },
      {
        id: "prep1-u3",
        number: 3,
        title: "Role models",
        desc: "الوحدة الثالثة: القدوة والنماذج الملهمة",
        bankKey: "unit3",
        lessons: [
          { id: "prep1-u3-l1", number: 1, title: "Lesson 1", desc: "الدرس الأول من الوحدة", videoUrl: "", pdfUrl: "", worksheetUrl: "" },
          { id: "prep1-u3-l2", number: 2, title: "Lesson 2", desc: "الدرس الثاني من الوحدة", videoUrl: "", pdfUrl: "", worksheetUrl: "" },
          { id: "prep1-u3-l3", number: 3, title: "Lesson 3", desc: "الدرس الثالث من الوحدة", videoUrl: "", pdfUrl: "", worksheetUrl: "" },
        ],
      },
    ],
  };
  Object.values(UNIT_DATA).forEach((units) => units.forEach((u) => u.lessons.forEach((l) => { l.unitId = u.id; })));

  // اكتبوا كلمات كل شيت هنا: { prompt: "المعنى بالعربي", answers: ["English answer"] }.
  // يمكن وضع أكثر من إجابة صحيحة للكلمة عند الحاجة.
  const SHEET_VOCABULARY = {};

  /** عدد أسئلة الامتحان لكل طالب: 30 للإعدادي و50 للثانوي. */
  function questionsPerExam(gradeId) {
    return String(gradeId).startsWith("prep") ? 30 : 50;
  }

  // مولّد أرقام عشوائية ثابت (seeded): نفس الطالب + نفس الوحدة + نفس المحاولة = نفس الأسئلة دايمًا.
  function seededRng(str) {
    let h = 1779033703 ^ str.length;
    for (let i = 0; i < str.length; i += 1) {
      h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
      h = (h << 13) | (h >>> 19);
    }
    let a = (Math.imul(h ^ (h >>> 16), 2246822507) ^ Math.imul(h ^ (h >>> 13), 3266489909)) >>> 0;
    return function () {
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function shuffled(arr, rng) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i -= 1) {
      const j = Math.floor(rng() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function escapeHTML(str) {
    return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  // --- تقدّم الوحدات (بيتخزن محليًا وعلى Firebase عشان يفضل لو الطالب غيّر الجهاز) ---
  function getUnitProgress() {
    const u = getFullCurrentUser();
    const raw = u && u.unitProgress && typeof u.unitProgress === "object" ? u.unitProgress : {};
    // النجاح بيتحدد من أفضل نسبة (70%+) مش بس من علامة passed القديمة
    const out = {};
    Object.keys(raw).forEach((id) => {
      const p = raw[id] || {};
      out[id] = { ...p, passed: !!(p.passed || Number(p.bestPercent) >= PASS_PERCENT) };
    });
    return out;
  }

  function mergeUnitProgress(a, b) {
    const out = { ...(a || {}) };
    Object.keys(b || {}).forEach((id) => {
      const x = out[id];
      const y = b[id];
      if (!x) { out[id] = y; return; }
      out[id] = {
        passed: !!(x.passed || y.passed),
        attempts: Math.max(x.attempts || 0, y.attempts || 0),
        bestPercent: Math.max(x.bestPercent || 0, y.bestPercent || 0),
        lastPercent: (x.attempts || 0) >= (y.attempts || 0) ? x.lastPercent : y.lastPercent,
        seen: Array.from(new Set([...(x.seen || []), ...(y.seen || [])])),
      };
    });
    return out;
  }

  function saveUnitProgress(progress) {
    const full = getFullCurrentUser();
    if (!full) return;
    full.unitProgress = progress;
    persistUser(full);
    if (window.SNAuth && typeof window.SNAuth.saveUnitProgress === "function") {
      window.SNAuth.saveUnitProgress(full.id, progress).catch((err) => console.warn("تعذر حفظ تقدّم الوحدة على Firebase", err));
    }
  }

  function isUnitUnlocked(units, index) {
    if (index === 0) return true;
    const prev = getUnitProgress()[units[index - 1].id];
    return !!(prev && prev.passed);
  }


  // --- خطوات إكمال الدرس: فيديو كامل + فتح الـPDF + اجتياز الشيت ------------------
  /** الدرس بيتحسب "مكتمل" لما الطالب: يشوف الفيديو كامل (من غير تقديم) + يفتح ملف الدرس + ينجح في الشيت.
   *  - الدرس التاني مبيفتحش إلا بعد اكتمال اللي قبله، وامتحان الوحدة مبيفتحش إلا بعد اكتمال كل دروسها.
   *  - أي عنصر لسه مالوش رابط (videoUrl/pdfUrl/worksheetUrl فاضي) مش بيتطلب، عشان الطالب ميتعطلش لحد ما ترفعي المحتوى. */
  const LESSON_STEP_NAMES = ["video", "pdf", "sheet"];
  const SHEET_PASS_PERCENT = 70;

  function lessonStepsKey(user) {
    return `sn-lesson-steps-${user.id}`;
  }

  function getLessonSteps(user) {
    try {
      const o = JSON.parse(localStorage.getItem(lessonStepsKey(user)));
      return o && typeof o === "object" && !Array.isArray(o) ? o : {};
    } catch {
      return {};
    }
  }

  function mergeLessonSteps(a, b) {
    const out = {};
    [a || {}, b || {}].forEach((src) => {
      Object.keys(src).forEach((id) => {
        const st = src[id] || {};
        out[id] = out[id] || {};
        LESSON_STEP_NAMES.forEach((k) => { if (st[k]) out[id][k] = true; });
      });
    });
    return out;
  }

  function isStepRequired(lesson, step) {
    if (step === "video") return !!lesson.videoUrl;
    if (step === "pdf") return !!(lesson.pdfUrl || lesson.text);
    return !!(lesson.unitId || lesson.worksheetUrl || lesson.sheet);
  }

  /** شيت الدرس مبيتفتحش إلا بعد ما الطالب يشوف فيديو الدرس كامل (الدرس اللي مالوش فيديو لسه مش بيتقفل). */
  function isSheetUnlocked(user, lesson) {
    if (!isStepRequired(lesson, "video")) return true;
    if (!user) return false;
    return !!((getLessonSteps(user)[lesson.id] || {}).video);
  }

  function sheetSubmissionKey(user, lesson) {
    return `sn-sheet-submission-${user.id}-${lesson.id}`;
  }

  function getSheetSubmission(user, lesson) {
    try {
      const value = JSON.parse(localStorage.getItem(sheetSubmissionKey(user, lesson)));
      return value && typeof value === "object" ? value : null;
    } catch {
      return null;
    }
  }

  function isSheetPassed(user, lesson) {
    const submission = getSheetSubmission(user, lesson);
    return !!(submission && Number(submission.percent) >= SHEET_PASS_PERCENT);
  }

  function isLessonDone(user, lesson) {
    const st = getLessonSteps(user)[lesson.id] || {};
    const stepsDone = LESSON_STEP_NAMES.every((k) => !isStepRequired(lesson, k) || st[k]);
    return stepsDone && (!lesson.unitId || isSheetPassed(user, lesson));
  }

  function lessonStepsCount(user, lesson) {
    const st = getLessonSteps(user)[lesson.id] || {};
    const req = LESSON_STEP_NAMES.filter((k) => isStepRequired(lesson, k));
    return { done: req.filter((k) => st[k]).length, total: req.length };
  }

  /** الدرس متاح لو الوحدة مفتوحة، وهو الأول أو اللي قبله مكتمل (أو الطالب أصلًا نجح في امتحان الوحدة). */
  function isLessonAvailable(units, unitIndex, lessonIndex, user) {
    if (!isUnitUnlocked(units, unitIndex)) return false;
    if (lessonIndex === 0) return true;
    const unit = units[unitIndex];
    const p = getUnitProgress()[unit.id];
    if (p && p.passed) return true;
    return isLessonDone(user, unit.lessons[lessonIndex - 1]);
  }

  function markLessonStep(user, lessonId, step) {
    if (!user) return;
    const all = getLessonSteps(user);
    if (all[lessonId] && all[lessonId][step]) return;
    all[lessonId] = { ...(all[lessonId] || {}), [step]: true };
    localStorage.setItem(lessonStepsKey(user), JSON.stringify(all));
    syncSet(user, "lessonSteps", all);
    if (activeLesson && activeLesson.id === lessonId) refreshLessonStepBadges(activeLesson, user);
    if (activeLessonsGrade) renderLessonsList(activeLessonsGrade, user);
  }

  function refreshLessonStepBadges(lesson, user) {
    const grid = document.getElementById("lessonItemsGrid");
    if (!grid) return;
    const st = getLessonSteps(user)[lesson.id] || {};
    [["video", "video"], ["text", "pdf"], ["sheet", "sheet"]].forEach(([item, step]) => {
      const el = grid.querySelector(`[data-item="${item}"]`);
      if (!el) return;
      el.querySelectorAll(".lesson-item__status--step").forEach((n) => n.remove());
      if (st[step]) el.insertAdjacentHTML("beforeend", `<span class="lesson-item__status lesson-item__status--step">${inlineIcon("check")} تم</span>`);
    });

    const sheetEl = grid.querySelector('[data-item="sheet"]');
    if (sheetEl) {
      const locked = !isSheetUnlocked(user, lesson);
      sheetEl.classList.toggle("is-locked", locked);
      sheetEl.querySelectorAll(".lesson-item__status--lock").forEach((n) => n.remove());
      if (locked) sheetEl.insertAdjacentHTML("beforeend", `<span class="lesson-item__status lesson-item__status--lock">${inlineIcon("lock")} شاهد الفيديو أولًا</span>`);
    }
  }

  // --- متابعة مشاهدة فيديو يوتيوب: لازم يتشاف كامل من غير تقديم -------------------
  let ytApiPromise = null;
  let activeVideoTracker = null;

  function parseYouTubeId(url) {
    const m = String(url || "").match(/(?:youtube\.com\/(?:embed\/|watch\?(?:[^#]*&)?v=|shorts\/|live\/)|youtu\.be\/)([\w-]{11})/);
    return m ? m[1] : null;
  }

  function loadYouTubeApi() {
    if (window.YT && window.YT.Player) return Promise.resolve();
    if (ytApiPromise) return ytApiPromise;
    ytApiPromise = new Promise((resolve) => {
      const prev = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => {
        if (typeof prev === "function") prev();
        resolve();
      };
      const tag = document.createElement("script");
      tag.src = "https://www.youtube.com/iframe_api";
      document.head.appendChild(tag);
    });
    return ytApiPromise;
  }

  function stopVideoTracker() {
    if (!activeVideoTracker) return;
    clearInterval(activeVideoTracker.timer);
    try { activeVideoTracker.player.destroy(); } catch { /* المشغّل اتقفل خلاص */ }
    activeVideoTracker = null;
  }

  const VIDEO_MIN_COVERAGE = 0.9; // لازم 90% من ثواني الفيديو تتشاف فعلًا (بيسمح بفروق التحميل/التوقف البسيطة)

  function startYouTubeTracking(videoId, lesson, user, onComplete, hostId = "ytPlayerHost") {
    stopVideoTracker();
    loadYouTubeApi().then(() => {
      if (!document.getElementById(hostId)) return;
      const seen = new Set();
      let last = null;
      const note = (html) => { const el = document.getElementById("videoTrackNote"); if (el) el.innerHTML = html; };
      const player = new window.YT.Player(hostId, {
        videoId,
        playerVars: { rel: 0, modestbranding: 1, playsinline: 1, disablekb: 1 },
        events: {
          onStateChange: (e) => {
            if (e.data === window.YT.PlayerState.PLAYING) last = player.getCurrentTime();
            else last = null;
            if (e.data === window.YT.PlayerState.ENDED) {
              const dur = player.getDuration() || 0;
              const cover = dur ? seen.size / dur : 0;
              if (cover >= VIDEO_MIN_COVERAGE) {
                if (typeof onComplete === "function") onComplete();
                else markLessonStep(user, lesson.id, "video");
                note(`${inlineIcon("check")} أحسنت! شفت الفيديو كامل وتم احتسابه.`);
              } else {
                note(`${inlineIcon("warning")} الفيديو لم يُحتسب: شاهدت ${Math.round(cover * 100)}% فقط. لازم تشوفه كامل من غير تقديم — ابدأ من أول.`);
                try { player.seekTo(0); player.pauseVideo(); } catch { /* تجاهل */ }
                seen.clear();
              }
            }
          },
        },
      });
      const timer = window.setInterval(() => {
        let playing = false;
        try { playing = player.getPlayerState() === window.YT.PlayerState.PLAYING; } catch { return; }
        if (!playing) return;
        const cur = player.getCurrentTime();
        if (last !== null) {
          const delta = cur - last;
          // تقدّم طبيعي (لحد سرعة 2x) بس بيتحسب؛ أي قفزة/تقديم بيتجاهل.
          if (delta > 0 && delta <= 1.2) {
            for (let t = Math.floor(last); t <= Math.floor(cur); t += 1) seen.add(t);
          }
        }
        last = cur;
        const dur = player.getDuration() || 0;
        if (dur) note(`تتم متابعة مشاهدتك… ${Math.min(100, Math.round((seen.size / dur) * 100))}% — لا تقدّم الفيديو، لازم يتشاف كامل.`);
      }, 500);
      activeVideoTracker = { timer, player };
    });
  }

  // --- قائمة الوحدات والدروس وامتحان كل وحدة ---------------------------------
  function renderUnitsList(gradeId, user) {
    activeLessonsGrade = gradeId;
    const unitList = UNIT_DATA[gradeId] || [];
    const units = activeUnitId ? unitList.filter((unit) => unit.id === activeUnitId) : unitList;
    const grid = document.getElementById("coursesGrid");
    const intro = document.getElementById("coursesIntro");
    if (!grid) return;

    if (!activeUnitId) {
      if (intro) intro.textContent = `وحدات ${GRADE_LABELS[gradeId] || ""} — اختر وحدة لعرض دروسها وامتحانها.`;
      const progress = getUnitProgress();
      const arrowIcon = `<svg class="chapter-card__arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6l6 6-6 6"/></svg>`;
      grid.innerHTML = unitList.map((unit, index) => {
        const unlocked = isUnitUnlocked(unitList, index);
        const state = progress[unit.id] || {};
        return `<li><button type="button" class="chapter-card unit-card" data-unit-open="${unit.id}"${unlocked ? "" : ' disabled aria-disabled="true"'}>
          <span class="chapter-card__number">${String(unit.number).padStart(2, "0")}</span>
          <span class="chapter-card__body"><span class="chapter-card__title">الوحدة ${unit.number}: ${escapeHTML(unit.title)}</span>
          <p class="chapter-card__desc">${unlocked ? escapeHTML(unit.desc) : `${inlineIcon("lock")} اجتز امتحان الوحدة السابقة لفتحها`}</p></span>
          ${state.passed ? `<span class="chapter-card__status">${inlineIcon("check")} ${state.bestPercent}%</span>` : ""}${arrowIcon}
        </button></li>`;
      }).join("");
      grid.querySelectorAll("[data-unit-open]").forEach((card) => card.addEventListener("click", () => {
        if (card.disabled) return;
        activeUnitId = card.dataset.unitOpen;
        renderUnitsList(gradeId, user);
      }));
      return;
    }

    if (intro) intro.innerHTML = `<button type="button" class="chapter-content__back unit-back" id="unitBackBtn"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m15 6-6 6 6 6"/></svg>رجوع للوحدات</button><span>محتوى الوحدة المختارة — النجاح من ${PASS_PERCENT}%</span>`;

    const visited = getLessonProgress(user);
    const progress = getUnitProgress();
    const arrowIcon = `<svg class="chapter-card__arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6l6 6-6 6"/></svg>`;

    grid.innerHTML = units
      .map((unit, ui) => {
        const unitIndex = unitList.findIndex((item) => item.id === unit.id);
        const unlocked = isUnitUnlocked(unitList, unitIndex);
        const p = progress[unit.id] || {};
        const lock = unlocked ? "" : ' disabled aria-disabled="true" style="opacity:.55;cursor:not-allowed"';
        const heading = `
        <li style="list-style:none;margin:${ui ? "26px" : "6px"} 0 8px;font-weight:700">
          الوحدة ${unit.number}: ${escapeHTML(unit.title)} ${p.passed ? inlineIcon("check") : ""} ${unlocked ? "" : inlineIcon("lock")}
          ${unlocked ? "" : `<div style="font-weight:400;font-size:.85em;opacity:.8">اجتز امتحان الوحدة السابقة لفتح هذه الوحدة.</div>`}
        </li>`;
        const lessonLockFor = (li) => (isLessonAvailable(unitList, unitIndex, li, user) ? "" : ' disabled aria-disabled="true" style="opacity:.55;cursor:not-allowed"');
        const lessonStatus = (lesson) => {
          const c = lessonStepsCount(user, lesson);
          if (c.total && c.done === c.total) return `<span class="chapter-card__status">${inlineIcon("check")} مكتمل</span>`;
          if (c.done) return `<span class="chapter-card__status">${c.done}/${c.total} من المطلوب</span>`;
          return "";
        };
        const lessons = unit.lessons
          .map(
            (lesson, li) => `
        <li>
          <button type="button" class="chapter-card" data-lesson-id="${lesson.id}" data-unit-id="${unit.id}"${lessonLockFor(li)}>
            <span class="chapter-card__number">${String(lesson.number).padStart(2, "0")}</span>
            <span class="chapter-card__body">
              <span class="chapter-card__title">${escapeHTML(lesson.title)}</span>
              <p class="chapter-card__desc">${unlocked && lessonLockFor(li) ? `${inlineIcon("lock")} أكمل الدرس السابق أولًا (فيديو كامل + PDF + شيت)` : escapeHTML(lesson.desc)}</p>
            </span>
            ${lessonStatus(lesson)}
            ${arrowIcon}
          </button>
        </li>`
          )
          .join("");
        let examStatus = "";
        if (p.passed) examStatus = `<span class="chapter-card__status">${inlineIcon("check")} نجحت (${p.bestPercent}%)</span>`;
        else if (p.attempts) examStatus = `<span class="chapter-card__status">آخر نتيجة ${p.lastPercent}% — أعد المحاولة</span>`;
        const lessonsDone = unit.lessons.every((l) => isLessonDone(user, l));
        const examLock = unlocked && lessonsDone ? "" : ' disabled aria-disabled="true" style="opacity:.55;cursor:not-allowed"';
        const examDesc = unlocked && !lessonsDone
          ? `${inlineIcon("lock")} أكمل دروس الوحدة كلها (فيديو كامل + PDF + شيت لكل درس) لفتح الامتحان`
          : `${questionsPerExam(gradeId)} سؤال — النجاح من ${PASS_PERCENT}% فما فوق`;
        const exam = `
        <li>
          <button type="button" class="chapter-card" data-exam-unit="${unit.id}"${examLock}>
            <span class="chapter-card__number">${inlineIcon("star")}</span>
            <span class="chapter-card__body">
              <span class="chapter-card__title">امتحان الوحدة ${unit.number}</span>
              <p class="chapter-card__desc">${examDesc}</p>
            </span>
            ${examStatus}
            ${arrowIcon}
          </button>
        </li>`;
        return heading + lessons + exam;
      })
      .join("");

    grid.querySelectorAll("[data-lesson-id]").forEach((card) => {
      card.addEventListener("click", () => {
        if (card.disabled) return;
        const unit = units.find((u) => u.id === card.dataset.unitId);
        const lesson = unit && unit.lessons.find((l) => l.id === card.dataset.lessonId);
        if (lesson) openLessonPage(lesson, user);
      });
    });
    grid.querySelectorAll("[data-exam-unit]").forEach((card) => {
      card.addEventListener("click", () => {
        if (card.disabled) return;
        const unit = units.find((u) => u.id === card.dataset.examUnit);
        if (unit) openUnitExam(unit, user);
      });
    });
    document.getElementById("unitBackBtn")?.addEventListener("click", () => {
      activeUnitId = null;
      renderUnitsList(gradeId, user);
    });
  }

  // --- توليد امتحان الوحدة (أسئلة + ترتيب + ترتيب الاختيارات مختلف لكل طالب) ---
  function attemptStorageKey(user, unit) {
    return `sn-unit-attempt-${user.id}-${unit.id}`;
  }

  function createAttempt(user, unit, bank, prog) {
    const n = (prog.attempts || 0) + 1;
    const rng = seededRng(`${user.id}|${unit.id}|${n}`);
    const total = questionsPerExam(user.grade);
    const seen = new Set(prog.seen || []);
    const mcqAll = bank.mcq || [];
    const corAll = bank.correction || [];
    const ratio = mcqAll.length / Math.max(1, mcqAll.length + corAll.length);
    let mcqN = Math.min(mcqAll.length, Math.round(total * ratio));
    const corN = Math.min(corAll.length, total - mcqN);
    mcqN = Math.min(mcqAll.length, total - corN);

    // بنفضّل الأسئلة اللي الطالب ماشافهاش في محاولات قبل كده، ولو مافيش كفاية بنكمّل من اللي شافها.
    const pick = (all, count) => {
      const fresh = shuffled(all.filter((q) => !seen.has(q.id)), rng);
      const old = shuffled(all.filter((q) => seen.has(q.id)), rng);
      return fresh.concat(old).slice(0, count);
    };
    const items = shuffled(
      [
        ...pick(mcqAll, mcqN).map((q) => ({ id: q.id, perm: shuffled([0, 1, 2, 3], rng) })),
        ...pick(corAll, corN).map((q) => ({ id: q.id, perm: null })),
      ],
      rng
    );
    const attempt = { attempt: n, items };
    localStorage.setItem(attemptStorageKey(user, unit), JSON.stringify(attempt));
    return attempt;
  }

  function loadAttempt(user, unit) {
    try {
      const a = JSON.parse(localStorage.getItem(attemptStorageKey(user, unit)));
      return a && Array.isArray(a.items) ? a : null;
    } catch {
      return null;
    }
  }

  function resolveAttempt(attempt, bank) {
    const byId = new Map([...(bank.mcq || []), ...(bank.correction || [])].map((q) => [q.id, q]));
    return attempt.items
      .map((it) => {
        const q = byId.get(it.id);
        if (!q) return null;
        if (q.type === "mcq") {
          return { id: q.id, type: "mcq", q: escapeHTML(q.q), options: it.perm.map((i) => escapeHTML(q.options[i])), correctIndex: it.perm.indexOf(q.answer) };
        }
        return { id: q.id, type: "correct", sentence: q.sentence, wrong: q.wrong, answers: q.answers };
      })
      .filter(Boolean);
  }

  function normAnswer(str) {
    return String(str || "")
      .toLowerCase()
      .replace(/[\u2019\u2018`]/g, "'")
      .replace(/[.!?,;:]+$/g, "")
      .replace(/\s+/g, " ")
      .trim();
  }

  /** الطالب بيكتب الكلمة/العبارة المصحّحة، أو الجملة كاملة بعد التصحيح — الاتنين مقبولين. */
  function isCorrectionRight(q, input) {
    const given = normAnswer(input);
    if (!given) return false;
    const ok = new Set();
    q.answers.forEach((a) => {
      ok.add(normAnswer(a));
      ok.add(normAnswer(q.sentence.replace(q.wrong, a)));
    });
    return ok.has(given);
  }

  function buildUnitQuestionHTML(q, index) {
    if (q.type === "mcq") return buildQuestionHTML(q, index);
    return `
      <div class="exam-question" data-question-id="${q.id}" data-type="correct" dir="ltr">
        <div class="exam-question__head">
          <span class="exam-question__number">${index + 1}</span>
          <span class="exam-question__type">${inlineIcon("edit")} صحّح الخطأ</span>
        </div>
        <p class="exam-question__prompt">${escapeHTML(q.sentence)}</p>
        <input type="text" class="exam-question__input" name="${q.id}" autocomplete="off" autocapitalize="off" spellcheck="false" dir="ltr" placeholder="Write the correct word or phrase" />
        <p class="exam-question__hint" dir="rtl">حدّد الكلمة الخاطئة بنفسك واكتب تصحيحها (أو اكتب الجملة كاملة بعد التصحيح).</p>
      </div>`;
  }

  function setExamBackLabel(text) {
    const btn = document.getElementById("examBackBtn");
    if (btn && btn.lastChild) btn.lastChild.textContent = ` ${text}`;
  }

  function openUnitExam(unit, user) {
    const unitList = UNIT_DATA[user.grade] || [];
    const unitIndex = unitList.findIndex((u) => u.id === unit.id);
    if ((unitIndex > 0 && !isUnitUnlocked(unitList, unitIndex)) || !unit.lessons.every((l) => isLessonDone(user, l))) return;
    const titleEl = document.getElementById("examTitle");
    const subtitleEl = document.getElementById("examSubtitle");
    const form = document.getElementById("examForm");
    const actions = document.getElementById("examActions");
    const result = document.getElementById("examResult");
    if (!titleEl || !form || !actions || !result) return;

    activeLesson = null;
    setExamBackLabel("رجوع للوحدات");
    titleEl.textContent = `امتحان الوحدة ${unit.number}: ${unit.title}`;
    result.hidden = true;
    result.innerHTML = "";
    form.onsubmit = null;
    form.innerHTML = "";

    const bank = window.QUESTION_BANK && window.QUESTION_BANK[unit.bankKey];
    const prog = getUnitProgress()[unit.id] || {};

    if (prog.passed) {
      subtitleEl.textContent = "تم اجتياز هذا الامتحان";
      actions.hidden = true;
      result.hidden = false;
      result.innerHTML = `<p class="exam-result__score">${prog.bestPercent}%</p><p class="exam-result__label">${inlineIcon("check")} نجحت في امتحان هذه الوحدة</p>`;
      goToPanel("exam", `امتحان: ${unit.title}`);
      return;
    }
    if (!bank || !(bank.mcq || []).length) {
      subtitleEl.textContent = "أسئلة هذه الوحدة لم تُضف بعد";
      actions.hidden = true;
      form.innerHTML = `<p>سيتم إضافة أسئلة هذه الوحدة قريبًا.</p>`;
      goToPanel("exam", `امتحان: ${unit.title}`);
      return;
    }

    const attempt = loadAttempt(user, unit) || createAttempt(user, unit, bank, prog);
    const questions = resolveAttempt(attempt, bank);
    subtitleEl.textContent = `${questions.length} سؤال — النجاح من ${PASS_PERCENT}% فما فوق`;
    form.innerHTML = questions.map((q, i) => buildUnitQuestionHTML(q, i)).join("");
    actions.hidden = false;
    form.onsubmit = (e) => {
      e.preventDefault();
      if (!form.reportValidity()) return;
      gradeUnitExam(unit, user, questions, attempt, form, actions, result);
    };
    goToPanel("exam", `امتحان: ${unit.title}`);
  }

  function gradeUnitExam(unit, user, questions, attempt, form, actions, result) {
    const fd = new FormData(form);
    let correct = 0;
    questions.forEach((q) => {
      const row = form.querySelector(`[data-question-id="${q.id}"]`);
      const val = fd.get(q.id);
      const ok = q.type === "mcq" ? val !== null && Number(val) === q.correctIndex : isCorrectionRight(q, val);
      if (ok) correct += 1;
      if (!row) return;
      row.querySelectorAll("input").forEach((input) => { input.disabled = true; });
      row.classList.add(ok ? "is-correct" : "is-incorrect");
      row.insertAdjacentHTML("beforeend", `<span class="exam-question__verdict">${ok ? `${inlineIcon("check")} إجابة صحيحة` : "إجابة غير صحيحة"}</span>`);
    });

    const percent = Math.round((correct / questions.length) * 100);
    const passed = percent >= PASS_PERCENT;
    const all = getUnitProgress();
    const prev = all[unit.id] || {};
    all[unit.id] = {
      passed: !!(prev.passed || passed),
      attempts: attempt.attempt,
      bestPercent: Math.max(prev.bestPercent || 0, percent),
      lastPercent: percent,
      seen: Array.from(new Set([...(prev.seen || []), ...attempt.items.map((it) => it.id)])),
    };
    saveUnitProgress(all);
    recordMcqGrade(user, `امتحان الوحدة ${unit.number}: ${unit.title}`, `${unit.id}-attempt-${attempt.attempt}`, correct, questions.length);
    if (passed && !prev.passed) awardPoints(POINTS_FOR_PASSING_UNIT, "grammar-star");
    localStorage.removeItem(attemptStorageKey(user, unit));
    renderUnitsList(activeLessonsGrade, user);

    actions.hidden = true;
    result.hidden = false;
    result.innerHTML = `
      <p class="exam-result__score">${correct}/${questions.length} (${percent}%)</p>
      <p class="exam-result__label">${passed ? `${inlineIcon("check")} مبروك! نجحت في امتحان الوحدة` : `لم تصل لنسبة النجاح (${PASS_PERCENT}% أو أكثر). راجع الدروس وحاول مرة أخرى.`}</p>
      <button type="button" class="btn btn--accent" id="unitExamNextBtn">${passed ? "العودة للوحدات" : "إعادة الامتحان بأسئلة جديدة"}</button>`;
    document.getElementById("unitExamNextBtn").addEventListener("click", () => {
      if (passed) goToPanel("courses", "الدروس");
      else openUnitExam(unit, user);
    });
    document.getElementById("dashMain")?.scrollTo({ top: 0, behavior: "instant" });
  }

  // Remembers where "back" should go while drilling into lessons/exam sub-panels.
  let activeLessonsGrade = null;
  let activeLesson = null;
  let activeUnitId = null;

  function lessonProgressKey(user) {
    return `bloom-lessons-progress-${user.id}`;
  }

  function getLessonProgress(user) {
    try {
      const raw = JSON.parse(localStorage.getItem(lessonProgressKey(user)));
      return Array.isArray(raw) ? raw : [];
    } catch {
      return [];
    }
  }

  function markLessonVisited(user, lessonId) {
    const visited = getLessonProgress(user);
    if (!visited.includes(lessonId)) {
      visited.push(lessonId);
      localStorage.setItem(lessonProgressKey(user), JSON.stringify(visited));
      syncSet(user, "lessonsProgress", visited);
      awardPoints(POINTS_PER_NEW_LESSON);
      renderProgressStats(user);
      renderLessonsDonut(user);
    }
  }

  function examSubmissionKey(user, examId) {
    return `bloom-exam-${user.id}-${examId}`;
  }

  function getExamSubmission(user, examId) {
    try {
      return JSON.parse(localStorage.getItem(examSubmissionKey(user, examId)));
    } catch {
      return null;
    }
  }

  function saveExamSubmission(user, examId, data) {
    localStorage.setItem(examSubmissionKey(user, examId), JSON.stringify(data));
    syncSet(user, "exams/" + examId, data);
  }

  /** Shared "table" simulating a database of essay answers waiting for an admin to grade manually. */
  const ESSAY_SUBMISSIONS_KEY = "bloom-essay-submissions";

  function appendEssaySubmission(entry) {
    let list = [];
    try {
      const raw = JSON.parse(localStorage.getItem(ESSAY_SUBMISSIONS_KEY));
      if (Array.isArray(raw)) list = raw;
    } catch {
      /* start fresh */
    }
    list.push(entry);
    localStorage.setItem(ESSAY_SUBMISSIONS_KEY, JSON.stringify(list));
    // الجدول الحقيقي المشترك اللي الأدمن هيصحّح منه.
    if (window.SNAuth && window.SNAuth.pushEssaySubmission) {
      window.SNAuth.pushEssaySubmission(entry).catch((err) =>
        console.warn("تعذر حفظ إجابة المقال في Firebase", err)
      );
    }
  }

  // --- قائمة دروس الصف --------------------------------------------------------
  function renderLessonsList(gradeId, user) {
    if (UNIT_DATA[gradeId]) return renderUnitsList(gradeId, user);
    activeLessonsGrade = gradeId;
    const lessons = LESSON_DATA[gradeId] || [];
    const grid = document.getElementById("coursesGrid");
    const intro = document.getElementById("coursesIntro");
    if (!grid) return;

    if (intro) intro.textContent = `دروس ${GRADE_LABELS[gradeId] || ""} — افتح أي درس لتبدأ.`;

    const visited = getLessonProgress(user);
    const arrowIcon = `<svg class="chapter-card__arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6l6 6-6 6"/></svg>`;

    grid.innerHTML = lessons
      .map((lesson) => {
        const isVisited = visited.includes(lesson.id);
        return `
        <li>
          <button type="button" class="chapter-card" data-lesson-id="${lesson.id}">
            <span class="chapter-card__number">${String(lesson.number).padStart(2, "0")}</span>
            <span class="chapter-card__body">
              <span class="chapter-card__title">${lesson.title}</span>
              <p class="chapter-card__desc">${lesson.desc}</p>
            </span>
            ${isVisited ? `<span class="chapter-card__status">${inlineIcon("check")} تمّت الزيارة</span>` : ""}
            ${arrowIcon}
          </button>
        </li>`;
      })
      .join("");

    grid.querySelectorAll(".chapter-card").forEach((card) => {
      card.addEventListener("click", () => {
        const lesson = lessons.find((l) => l.id === card.dataset.lessonId);
        if (lesson) openLessonPage(lesson, user);
      });
    });
  }

  // --- صفحة الدرس (5 عناصر) ---------------------------------------------------
  const LESSON_ITEM_ICONS = {
    video: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="5" width="15" height="14" rx="2"/><path d="M17 10l5-3v10l-5-3"/></svg>`,
    text: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19V5a2 2 0 0 1 2-2h11.5v16H6a2 2 0 0 0-2 2Z"/><path d="M6 21h13.5V19"/></svg>`,
    exam: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 3h6v4H9z"/><rect x="5" y="7" width="14" height="14" rx="2"/><path d="M9 13h6M9 17h4"/></svg>`,
    vocab: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5V5.25A2.25 2.25 0 0 1 6.25 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5v-1Z"/></svg>`,
    sheet: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 3v5h5"/><path d="M6 3h8l5 5v13H6z"/><path d="M9 13h6M9 17h6"/></svg>`,
  };

  function examStatusBadge(user, exam) {
    const submission = getExamSubmission(user, exam.id);
    if (!submission) return `<span class="lesson-item__status lesson-item__status--pending">لم يُحل بعد</span>`;
    if (submission.mcqTotal > 0) {
      return `<span class="lesson-item__status">${submission.mcqCorrect}/${submission.mcqTotal}</span>`;
    }
    return `<span class="lesson-item__status">تم الإرسال</span>`;
  }

  function openLessonPage(lesson, user) {
    activeLesson = lesson;
    markLessonVisited(user, lesson.id);
    renderLessonsList(activeLessonsGrade, user);

    const titleEl = document.getElementById("lessonHeadTitle");
    const subtitleEl = document.getElementById("lessonHeadSubtitle");
    const grid = document.getElementById("lessonItemsGrid");
    if (titleEl) titleEl.textContent = `الدرس ${lesson.number}: ${lesson.title}`;
    if (subtitleEl) subtitleEl.textContent = lesson.desc;

    if (grid) {
      grid.innerHTML = `
        <button type="button" class="lesson-item lesson-item--video" data-item="video">
          <span class="lesson-item__icon">${LESSON_ITEM_ICONS.video}</span>
          <span class="lesson-item__body">
            <span class="lesson-item__title">فيديو الشرح</span>
            <span class="lesson-item__desc">شرح مرئي لمحتوى الدرس</span>
          </span>
        </button>
        <button type="button" class="lesson-item lesson-item--text" data-item="text">
          <span class="lesson-item__icon">${LESSON_ITEM_ICONS.text}</span>
          <span class="lesson-item__body">
            <span class="lesson-item__title">${lesson.pdfUrl ? "ملف الدرس (PDF)" : "نص الدرس"}</span>
            <span class="lesson-item__desc">${lesson.pdfUrl ? "فتح ملف PDF" : "قراءة شرح الدرس كاملًا"}</span>
          </span>
        </button>
        ${lesson.optionalExam ? `        <button type="button" class="lesson-item lesson-item--exam" data-item="optionalExam">
          <span class="lesson-item__icon">${LESSON_ITEM_ICONS.exam}</span>
          <span class="lesson-item__body">
            <span class="lesson-item__title">امتحان اختياري</span>
            <span class="lesson-item__desc">امتحان شامل على الدرس (غير إلزامي)</span>
          </span>
          ${examStatusBadge(user, lesson.optionalExam)}
        </button>
        <button type="button" class="lesson-item lesson-item--vocab" data-item="vocabExam">
          <span class="lesson-item__icon">${LESSON_ITEM_ICONS.vocab}</span>
          <span class="lesson-item__body">
            <span class="lesson-item__title">امتحان معاني الكلمات</span>
            <span class="lesson-item__desc">اختبار قصير على مفردات الدرس</span>
          </span>
          ${examStatusBadge(user, lesson.vocabExam)}
        </button>` : ""}
        <button type="button" class="lesson-item lesson-item--sheet" data-item="sheet">
          <span class="lesson-item__icon">${LESSON_ITEM_ICONS.sheet}</span>
          <span class="lesson-item__body">
            <span class="lesson-item__title">شيت الدرس</span>
            <span class="lesson-item__desc">ورقة تدريبات للطباعة أو التحميل</span>
          </span>
        </button>`;

      refreshLessonStepBadges(lesson, user);
      grid.querySelector('[data-item="video"]').addEventListener("click", () => openViewer("video", lesson));
      grid.querySelector('[data-item="text"]').addEventListener("click", () => openViewer("text", lesson));
      grid.querySelector('[data-item="sheet"]').addEventListener("click", () => openViewer("sheet", lesson));
      if (lesson.optionalExam) {
        grid.querySelector('[data-item="optionalExam"]').addEventListener("click", () => openExam(lesson.optionalExam, lesson, user));
        grid.querySelector('[data-item="vocabExam"]').addEventListener("click", () => openExam(lesson.vocabExam, lesson, user));
      }
    }

    goToPanel("lesson", `الدرس: ${lesson.title}`);
  }

  async function initPdfViewer(url, body, onFirstPage) {
    const canvas = body.querySelector("#lessonPdfCanvas");
    const loading = body.querySelector("#lessonPdfLoading");
    const pageLabel = body.querySelector("#lessonPdfPage");
    const previous = body.querySelector("#lessonPdfPrevious");
    const next = body.querySelector("#lessonPdfNext");
    if (!canvas || !pageLabel || !previous || !next) return;

    if (!window.pdfjsLib) {
      if (loading) loading.textContent = "تعذر تحميل قارئ PDF. استخدم زر فتح الملف الكامل.";
      return;
    }

    window.pdfjsLib.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
    let documentProxy;
    let pageNumber = 1;
    let rendering = false;

    const updateControls = () => {
      pageLabel.textContent = `${pageNumber} / ${documentProxy ? documentProxy.numPages : "…"}`;
      previous.hidden = pageNumber <= 1;
      next.hidden = !documentProxy || pageNumber >= documentProxy.numPages;
    };

    const renderPage = async () => {
      if (!documentProxy || rendering) return;
      rendering = true;
      try {
        const page = await documentProxy.getPage(pageNumber);
        const baseViewport = page.getViewport({ scale: 1 });
        const availableWidth = Math.max(body.clientWidth - 24, 280);
        const scale = Math.min(1.6, availableWidth / baseViewport.width);
        const viewport = page.getViewport({ scale });
        const context = canvas.getContext("2d");
        canvas.width = Math.ceil(viewport.width);
        canvas.height = Math.ceil(viewport.height);
        await page.render({ canvasContext: context, viewport }).promise;
        if (loading) loading.hidden = true;
        if (pageNumber === 1 && typeof onFirstPage === "function") onFirstPage();
        updateControls();
      } catch (error) {
        if (loading) loading.textContent = "تعذر عرض الصفحة. استخدم زر فتح الملف الكامل.";
        console.error("PDF render failed", error);
      } finally {
        rendering = false;
      }
    };

    previous.addEventListener("click", () => {
      if (pageNumber > 1) { pageNumber -= 1; renderPage(); }
    });
    next.addEventListener("click", () => {
      if (documentProxy && pageNumber < documentProxy.numPages) { pageNumber += 1; renderPage(); }
    });

    try {
      documentProxy = await window.pdfjsLib.getDocument({ url }).promise;
      updateControls();
      renderPage();
    } catch (error) {
      if (loading) loading.textContent = "تعذر تحميل ملف PDF. استخدم زر فتح الملف الكامل.";
      console.error("PDF load failed", error);
    }
  }

  // --- نافذة عرض عامة (فيديو / نص / شيت) --------------------------------------
  function openViewer(type, lesson) {
    const modal = document.getElementById("viewerModal");
    const title = document.getElementById("viewerModalTitle");
    const body = document.getElementById("viewerModalBody");
    if (!modal || !title || !body) return;

    const placeholder = (icon, message) => `
      <div class="chapter-placeholder">
        <span class="chapter-placeholder__icon">${icon}</span>
        <p>${message}</p>
      </div>`;

    if (type === "video") {
      title.textContent = "فيديو الشرح";
      const ytId = parseYouTubeId(lesson.videoUrl);
      const viewer = getFullCurrentUser();
      const alreadyDone = !!(viewer && (getLessonSteps(viewer)[lesson.id] || {}).video);
      if (!lesson.videoUrl) {
        body.innerHTML = placeholder(LESSON_ITEM_ICONS.video, "سيتم إضافة فيديو شرح هذا الدرس قريبًا.");
      } else if (ytId) {
        body.innerHTML = `<div class="chapter-video"><div id="ytPlayerHost"></div></div>
          <p id="videoTrackNote" class="exam-question__hint" style="margin-top:10px">${alreadyDone ? `${inlineIcon("check")} سبق وأكملت مشاهدة هذا الفيديو.` : `${inlineIcon("warning")} لازم تشوف الفيديو كامل من غير تقديم عشان الدرس يتحسب.`}</p>`;
        startYouTubeTracking(ytId, lesson, viewer);
      } else {
        // رابط مش يوتيوب: مفيش طريقة نتأكد من المشاهدة، فبنعتمد على تأكيد الطالب.
        body.innerHTML = `<div class="chapter-video"><iframe src="${lesson.videoUrl}" title="فيديو شرح الدرس" allowfullscreen loading="lazy"></iframe></div>
          <p class="exam-question__hint" style="margin-top:10px">${alreadyDone ? `${inlineIcon("check")} سبق وأكملت مشاهدة هذا الفيديو.` : `<button type="button" class="btn btn--accent" id="videoDoneBtn">${inlineIcon("check")} خلّصت مشاهدة الفيديو كامل</button>`}</p>`;
        document.getElementById("videoDoneBtn")?.addEventListener("click", () => {
          markLessonStep(viewer, lesson.id, "video");
          const n = document.getElementById("videoDoneBtn");
          if (n && n.parentElement) n.parentElement.innerHTML = `${inlineIcon("check")} تم احتساب الفيديو.`;
        });
      }
    } else if (type === "text") {
      title.textContent = lesson.pdfUrl ? "ملف الدرس (PDF)" : "نص الدرس";
      if (lesson.pdfUrl) {
        markLessonStep(getFullCurrentUser(), lesson.id, "pdf");
        body.innerHTML = `<div class="lesson-pdf-viewer">
          <div class="lesson-pdf-toolbar" dir="ltr">
            <button type="button" class="lesson-pdf-nav" id="lessonPdfPrevious" aria-label="الصفحة السابقة">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m15 18-6-6 6-6"/></svg>
            </button>
            <span id="lessonPdfPage">1 / …</span>
            <button type="button" class="lesson-pdf-nav" id="lessonPdfNext" aria-label="الصفحة التالية">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 18 6-6-6-6"/></svg>
            </button>
            <a class="lesson-pdf-open" href="${escapeHTML(lesson.pdfUrl)}" target="_blank" rel="noopener">فتح الملف الكامل</a>
          </div>
          <p id="lessonPdfLoading" class="exam-question__hint">جاري تحميل الصفحة الأولى…</p>
          <canvas id="lessonPdfCanvas" aria-label="صفحة PDF"></canvas>
        </div>`;
        requestAnimationFrame(() => initPdfViewer(lesson.pdfUrl, body));
      } else {
        body.innerHTML = lesson.text
          ? `<div class="chapter-story-text">${lesson.text.map((p) => `<p>${p}</p>`).join("")}</div>`
          : placeholder(LESSON_ITEM_ICONS.text, "سيتم إضافة ملف هذا الدرس قريبًا.");
        if (lesson.text) markLessonStep(getFullCurrentUser(), lesson.id, "pdf");
      }
    } else if (type === "sheet") {
      title.textContent = "شيت الدرس";
      if (!isSheetUnlocked(getFullCurrentUser(), lesson)) {
        body.innerHTML = `${placeholder(INLINE_ICONS_LOCK_BIG, "شيت الدرس هيتفتح بعد ما تشوف فيديو الشرح كامل من غير تقديم.")}
          <p style="text-align:center;margin-top:14px"><button type="button" class="btn btn--accent" id="sheetGoVideoBtn">شاهد الفيديو الآن</button></p>`;
        document.getElementById("sheetGoVideoBtn")?.addEventListener("click", () => openViewer("video", lesson));
      } else if (lesson.unitId) {
        modal.hidden = true;
        openSheetExam(lesson, getFullCurrentUser());
        return;
      } else if (lesson.worksheetUrl) {
        window.open(lesson.worksheetUrl, "_blank", "noopener");
        markLessonStep(getFullCurrentUser(), lesson.id, "sheet");
        body.innerHTML = placeholder(LESSON_ITEM_ICONS.sheet, "تم فتح شيت الدرس في تبويب جديد.");
      } else {
        body.innerHTML = placeholder(LESSON_ITEM_ICONS.sheet, "سيتم إضافة شيت هذا الدرس قريبًا.");
      }
    }

    modal.hidden = false;
    requestAnimationFrame(() => modal.classList.add("is-open"));
  }

  function getUnitForLesson(lesson) {
    for (const units of Object.values(UNIT_DATA)) {
      const unit = units.find((item) => item.id === lesson.unitId);
      if (unit) return unit;
    }
    return null;
  }

  function getSheetVocabulary(lesson) {
    const values = SHEET_VOCABULARY[lesson.id] || lesson.vocabulary || [];
    return Array.from({ length: 15 }, (_, index) => values[index] || { prompt: "", answers: [] });
  }

  function getSheetQuestions(lesson, user) {
    const unit = getUnitForLesson(lesson);
    const bank = unit && window.QUESTION_BANK ? window.QUESTION_BANK[unit.bankKey] : null;
    if (!bank) return { mcq: [], correction: [], vocabulary: getSheetVocabulary(lesson) };
    const rng = seededRng(`${user.id}:${lesson.id}:sheet`);
    const mcq = shuffled(bank.mcq || [], rng).slice(0, 8).map((q, index) => ({
      ...q,
      id: `sheet-${lesson.id}-mcq-${index}`,
      correctIndex: q.correctIndex == null ? q.answer : q.correctIndex,
    }));
    const correction = shuffled(bank.correction || [], rng).slice(0, 2).map((q, index) => ({
      ...q,
      id: `sheet-${lesson.id}-correction-${index}`,
    }));
    return { mcq, correction, vocabulary: getSheetVocabulary(lesson) };
  }

  function sheetSubmissionPercent(score, total) {
    return total ? Math.round((score / total) * 100) : 0;
  }

  function editDistance(a, b) {
    const row = Array.from({ length: b.length + 1 }, (_, index) => index);
    for (let i = 1; i <= a.length; i += 1) {
      let previous = row[0];
      row[0] = i;
      for (let j = 1; j <= b.length; j += 1) {
        const current = row[j];
        row[j] = a[i - 1] === b[j - 1]
          ? previous
          : Math.min(previous + 1, row[j - 1] + 1, current + 1);
        previous = current;
      }
    }
    return row[b.length];
  }

  function gradeVocabularyEntry(entry, input) {
    const given = normAnswer(input).replace(/[^a-z0-9 ]/g, "");
    if (!given || !entry.answers || !entry.answers.length) return 0;
    const best = Math.min(...entry.answers.map((answer) => editDistance(given, normAnswer(answer).replace(/[^a-z0-9 ]/g, ""))));
    if (best === 0) return 1;
    if (best <= 2) return 0.5;
    return 0;
  }

  function buildSheetCorrectionHTML(question, index) {
    return `<div class="exam-question" data-sheet-question="${question.id}" data-type="correction" dir="ltr">
      <div class="exam-question__head"><span class="exam-question__number">${index + 1}</span><span class="exam-question__type">${inlineIcon("edit")} صحّح الخطأ</span></div>
      <p class="exam-question__prompt">${escapeHTML(question.sentence)}</p>
      <input type="text" class="exam-question__input" name="${question.id}" required autocomplete="off" spellcheck="false" dir="ltr" placeholder="Write the correction" />
    </div>`;
  }

  function buildSheetVocabularyHTML(entry, index) {
    return `<label class="sheet-vocabulary-row">
      <span class="sheet-vocabulary-number">${index + 1}</span>
      <span class="sheet-vocabulary-prompt">${escapeHTML(entry.prompt || `كلمة ${index + 1}`)}</span>
      <input type="text" name="sheet-vocab-${index}" autocomplete="off" autocapitalize="off" spellcheck="false" dir="ltr" placeholder="English answer"${entry.prompt ? " required" : ""} />
    </label>`;
  }

  function gradeSheet(lesson, user, sheet, form) {
    const data = new FormData(form);
    let score = 0;
    const answers = {};
    sheet.mcq.forEach((question) => {
      const selected = data.get(question.id);
      answers[question.id] = selected === null ? null : Number(selected);
      if (answers[question.id] === question.correctIndex) score += 1;
    });
    sheet.correction.forEach((question) => {
      const answer = String(data.get(question.id) || "").trim();
      answers[question.id] = answer;
      if (isCorrectionRight(question, answer)) score += 1;
    });
    const vocabularyScores = sheet.vocabulary.map((entry, index) => {
      const value = gradeVocabularyEntry(entry, data.get(`sheet-vocab-${index}`));
      answers[`vocab-${index}`] = String(data.get(`sheet-vocab-${index}`) || "");
      score += value;
      return value;
    });
    const total = sheet.mcq.length + sheet.correction.length + sheet.vocabulary.length;
    const submittedAt = new Date().toISOString();
    const submission = {
      title: `شيت الدرس: ${lesson.title}`,
      lessonId: lesson.id,
      lessonTitle: lesson.title,
      answers,
      vocabularyScores,
      score,
      total,
      outOf: total,
      percent: sheetSubmissionPercent(score, total),
      date: formatArabicDate(submittedAt),
      submittedAt,
    };
    localStorage.setItem(sheetSubmissionKey(user, lesson), JSON.stringify(submission));
    syncSet(user, `sheetSubmissions/${lesson.id}`, submission);
    GRADE_CATEGORIES[2].entries.unshift({
      title: submission.title,
      date: submission.date,
      at: submission.submittedAt,
      score: submission.score,
      outOf: submission.total,
    });
    refreshGradesViews();
    if (window.SNAuth && window.SNAuth.addGradeEntry) {
      window.SNAuth.addGradeEntry(user.id, "weekly", submission).catch((err) => console.warn("تعذر حفظ درجة الشيت في Firebase", err));
    }
    if (submission.percent >= SHEET_PASS_PERCENT) markLessonStep(user, lesson.id, "sheet");
    return submission;
  }

  function showSheetResult(result, submission) {
    result.hidden = false;
    const passed = submission.percent >= SHEET_PASS_PERCENT;
    result.innerHTML = `<p class="exam-result__score">${submission.percent}%</p>
      <p class="exam-result__label">${passed ? `${inlineIcon("check")} نجحت في الشيت` : `تحتاج إلى ${SHEET_PASS_PERCENT}% أو أكثر لفتح الدرس التالي`}</p>
      <p class="exam-result__note">الدرجة: ${submission.score}/${submission.total} — نصف الدرجة يُحسب عند خطأ حرف أو حرفين في الكلمة.</p>`;
  }

  function openSheetExam(lesson, user) {
    if (!user) return;
    const title = document.getElementById("examTitle");
    const subtitle = document.getElementById("examSubtitle");
    const form = document.getElementById("examForm");
    const actions = document.getElementById("examActions");
    const result = document.getElementById("examResult");
    if (!title || !subtitle || !form || !actions || !result) return;
    const sheet = getSheetQuestions(lesson, user);
    const previous = getSheetSubmission(user, lesson);
    setExamBackLabel("رجوع للدرس");
    if (previous && Number(previous.percent) >= SHEET_PASS_PERCENT) {
      // نجح بأكتر من 70%: الشيت بيتقفل ومبيتعادش
      title.textContent = `شيت الدرس: ${lesson.title}`;
      subtitle.textContent = "تم اجتياز هذا الشيت";
      form.innerHTML = "";
      form.onsubmit = null;
      actions.hidden = true;
      showSheetResult(result, previous);
      goToPanel("exam", `شيت: ${lesson.title}`);
      return;
    }
    title.textContent = `شيت الدرس: ${lesson.title}`;
    subtitle.textContent = "10 أسئلة: 8 اختيار من متعدد + 2 تصحيح خطأ + 15 كلمة";
    form.innerHTML = `<div class="sheet-section-title">الأسئلة</div>${sheet.mcq.map((q, i) => buildQuestionHTML({ ...q, correctIndex: q.correctIndex }, i)).join("")}${sheet.correction.map((q, i) => buildSheetCorrectionHTML(q, i + sheet.mcq.length)).join("")}
      <div class="sheet-section-title">معاني الكلمات</div><p class="exam-question__hint">اكتب المقابل الإنجليزي. الإجابة الصحيحة تأخذ درجة كاملة، والخطأ في حرف أو حرفين يأخذ نصف درجة.</p><div class="sheet-vocabulary-grid">${sheet.vocabulary.map(buildSheetVocabularyHTML).join("")}</div>`;
    actions.hidden = false;
    result.hidden = true;
    result.innerHTML = "";
    if (previous && previous.percent < SHEET_PASS_PERCENT) {
      result.hidden = false;
      result.innerHTML = `<p class="exam-result__note">آخر نتيجة: ${previous.percent}%. أعد الحل للحصول على ${SHEET_PASS_PERCENT}% أو أكثر.</p>`;
    }
    form.onsubmit = (event) => {
      event.preventDefault();
      if (!form.reportValidity()) return;
      const submission = gradeSheet(lesson, user, sheet, form);
      form.querySelectorAll("input").forEach((input) => { input.disabled = true; });
      actions.hidden = true;
      showSheetResult(result, submission);
    };
    goToPanel("exam", `شيت: ${lesson.title}`);
  }

  // --- محرك امتحانات MCQs + الأسئلة المقالية -----------------------------------
  function buildQuestionHTML(q, index) {
    if (q.type === "essay") {
      return `
        <div class="exam-question" data-question-id="${q.id}" data-type="essay" dir="ltr">
          <div class="exam-question__head">
            <span class="exam-question__number">${index + 1}</span>
            <span class="exam-question__type">${inlineIcon("edit")} سؤال مقالي</span>
          </div>
          <p class="exam-question__prompt">${q.q}</p>
          <textarea name="${q.id}" dir="ltr" placeholder="اكتب إجابتك هنا…"></textarea>
          <p class="exam-question__hint" dir="rtl">يتم حفظ هذه الإجابة لتصحيحها يدويًا بواسطة المعلّم.</p>
        </div>`;
    }
    const options = q.options
      .map(
        (opt, i) => `
        <label class="exam-option">
          <input type="radio" name="${q.id}" value="${i}" required />
          <span>${opt}</span>
        </label>`
      )
      .join("");
    return `
      <div class="exam-question" data-question-id="${q.id}" data-type="mcq" dir="ltr">
        <div class="exam-question__head">
          <span class="exam-question__number">${index + 1}</span>
        </div>
        <p class="exam-question__prompt">${q.q}</p>
        <div class="exam-options">${options}</div>
      </div>`;
  }

  /** Renders the exam either fresh (editable) or, if already submitted, as a locked review with the score and a per-question verdict. */
  function openExam(exam, lesson, user) {
    const titleEl = document.getElementById("examTitle");
    const subtitleEl = document.getElementById("examSubtitle");
    const form = document.getElementById("examForm");
    const actions = document.getElementById("examActions");
    const result = document.getElementById("examResult");
    if (!titleEl || !form || !actions || !result) return;

    setExamBackLabel("رجوع للدرس");
    titleEl.textContent = exam.title;
    subtitleEl.textContent = `${exam.questions.length} أسئلة — الدرس: ${lesson.title}`;
    result.hidden = true;
    result.innerHTML = "";

    const existing = getExamSubmission(user, exam.id);

    form.innerHTML = exam.questions.map((q, i) => buildQuestionHTML(q, i)).join("");
    form.onsubmit = null;

    if (existing) {
      lockExamView(exam, form, actions, result, existing);
    } else {
      actions.hidden = false;
      form.onsubmit = (e) => {
        e.preventDefault();
        if (!form.reportValidity()) return;
        const submission = gradeExam(exam, lesson, user, form);
        lockExamView(exam, form, actions, result, submission);
      };
    }

    goToPanel("exam", `امتحان: ${exam.title}`);
  }

  function gradeExam(exam, lesson, user, form) {
    const formData = new FormData(form);
    let mcqCorrect = 0;
    let mcqTotal = 0;
    const mcqAnswers = {};
    const essayAnswers = {};

    exam.questions.forEach((q) => {
      if (q.type === "mcq") {
        mcqTotal += 1;
        const chosen = formData.get(q.id);
        const chosenIndex = chosen === null ? null : Number(chosen);
        mcqAnswers[q.id] = chosenIndex;
        if (chosenIndex === q.correctIndex) mcqCorrect += 1;
      } else if (q.type === "essay") {
        const text = String(formData.get(q.id) || "").trim();
        essayAnswers[q.id] = text;
        if (text) {
          appendEssaySubmission({
            userId: user.id,
            userName: user.fullName,
            grade: user.grade,
            lessonId: lesson.id,
            lessonTitle: lesson.title,
            examId: exam.id,
            examTitle: exam.title,
            questionId: q.id,
            questionText: q.q,
            answerText: text,
            submittedAt: new Date().toISOString(),
            status: "بانتظار التصحيح",
            adminGrade: null,
          });
        }
      }
    });

    const submission = { mcqAnswers, essayAnswers, mcqCorrect, mcqTotal, submittedAt: new Date().toISOString() };
    saveExamSubmission(user, exam.id, submission);
    recordMcqGrade(user, exam.title, exam.id, submission.mcqCorrect, submission.mcqTotal);
    return submission;
  }

  /** Disables all inputs, restores the saved answers, marks each MCQ question correct/incorrect, and shows the final score — used both right after submission and when reopening an already-solved exam. */
  function lockExamView(exam, form, actions, result, submission) {
    exam.questions.forEach((q) => {
      const row = form.querySelector(`[data-question-id="${q.id}"]`);
      if (!row) return;

      if (q.type === "mcq") {
        const chosenIndex = submission.mcqAnswers ? submission.mcqAnswers[q.id] : null;
        row.querySelectorAll("input[type=radio]").forEach((input) => {
          input.disabled = true;
          if (Number(input.value) === chosenIndex) input.checked = true;
        });
        const isCorrect = chosenIndex === q.correctIndex;
        row.classList.add(isCorrect ? "is-correct" : "is-incorrect");
        row.insertAdjacentHTML(
          "beforeend",
          `<span class="exam-question__verdict">${isCorrect ? `${inlineIcon("check")} إجابة صحيحة` : "إجابة غير صحيحة"}</span>`
        );
      } else if (q.type === "essay") {
        const textarea = row.querySelector("textarea");
        if (textarea) {
          textarea.value = submission.essayAnswers ? submission.essayAnswers[q.id] || "" : "";
          textarea.disabled = true;
        }
        row.classList.add("is-pending");
        row.insertAdjacentHTML("beforeend", `<span class="exam-question__verdict">بانتظار تصحيح المعلّم</span>`);
      }
    });

    actions.hidden = true;

    if (submission.mcqTotal > 0) {
      result.hidden = false;
      result.innerHTML = `
        <p class="exam-result__score">${submission.mcqCorrect}/${submission.mcqTotal}</p>
        <p class="exam-result__label">نتيجتك في الأسئلة الاختيارية</p>
        ${Object.keys(submission.essayAnswers || {}).length ? `<p class="exam-result__note">تم إرسال الأسئلة المقالية للمعلّم لتصحيحها يدويًا.</p>` : ""}`;
    } else {
      result.hidden = false;
      result.innerHTML = `<p class="exam-result__label">تم إرسال إجاباتك بنجاح وستُصحَّح يدويًا من قِبل المعلّم.</p>`;
    }
  }

  function initLessonEngine(user) {
    document.getElementById("lessonsBackBtn")?.addEventListener("click", () => goToPanel("courses", "الدروس"));
    document.getElementById("lessonPageBackBtn")?.addEventListener("click", () => {
      goToPanel("courses", "الدروس");
    });
    document.getElementById("examBackBtn")?.addEventListener("click", () => {
      if (activeLesson) openLessonPage(activeLesson, user);
      else goToPanel("courses", "الدروس");
    });

    const viewerModal = document.getElementById("viewerModal");
    if (viewerModal) {
      viewerModal.addEventListener("click", (e) => {
        if (e.target === viewerModal) closeViewerModal();
      });
      document.getElementById("viewerModalCloseBtn")?.addEventListener("click", closeViewerModal);
    }
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && viewerModal && !viewerModal.hidden) closeViewerModal();
    });
  }

  function closeViewerModal() {
    const modal = document.getElementById("viewerModal");
    if (!modal) return;
    stopVideoTracker();
    modal.classList.remove("is-open");
    window.setTimeout(() => {
      modal.hidden = true;
      const body = document.getElementById("viewerModalBody");
      if (body) body.innerHTML = "";
    }, 200);
  }

  // --- القصة (فصول القصة الخاصة بكل صف دراسي) -------------------------------
  /** Prototype data — replace with API results once a backend exists.
   *  Each chapter: { id, number, title, desc, story[], videoUrl, examUrl }.
   *  `story` holds the written chapter text; if a real PDF is preferred instead,
   *  set `storyPdfUrl` and it will open in a new tab instead of the text view.
   *  `videoUrl`/`examUrl` are left empty until real content/links are ready —
   *  the UI shows a friendly "قريبًا" placeholder for whichever is missing. */
  const STORY_DATA = {
    prep1: {
      title: "Ben's First Day",
      subtitle: "قصة الصف الأول الإعدادي — مستوى مبتدئ",
      chapters: [
        {
          id: "prep1-c1",
          number: 1,
          title: "A New School",
          desc: "بن يبدأ يومه الأول في مدرسة جديدة ويتعرّف على صديق جديد.",
          videoUrl: "",
          examUrl: "",
          story: [
            "Ben is eleven years old. Today is his first day at a new school. He feels a little nervous, but also excited.",
            "His mother walks with him to the school gate. \"Good luck, Ben!\" she says with a smile.",
            "Ben takes a deep breath and walks through the gate. A tall boy waves at him and says, \"Hi! My name is Omar. Are you new here?\"",
          ],
        },
        {
          id: "prep1-c2",
          number: 2,
          title: "The New Friend",
          desc: "عمر يأخذ بن في جولة بالمدرسة ويصبحان صديقين.",
          videoUrl: "",
          examUrl: "",
          story: [
            "Omar shows Ben around the school. They visit the library, the science lab, and the big playground.",
            "\"Do you like football?\" Omar asks. \"Yes, I love it!\" Ben answers happily.",
            "At lunchtime, they sit together and share their sandwiches. Ben starts to feel at home.",
          ],
        },
        {
          id: "prep1-c3",
          number: 3,
          title: "The English Class",
          desc: "بن يقدّم نفسه أمام زملائه في حصة اللغة الإنجليزية.",
          videoUrl: "",
          examUrl: "",
          story: [
            "In the English class, the teacher, Mr. Adel, asks the students to introduce themselves.",
            "Ben stands up and says, \"My name is Ben. I am eleven years old. I like reading and football.\"",
            "The class claps, and Ben smiles. He is not nervous anymore.",
          ],
        },
        {
          id: "prep1-c4",
          number: 4,
          title: "A Great Day",
          desc: "نهاية يوم رائع يعود فيه بن لبيته سعيدًا بصديقه الجديد.",
          videoUrl: "",
          examUrl: "",
          story: [
            "At the end of the day, Ben walks home with Omar. \"See you tomorrow!\" Omar says.",
            "Ben tells his mother about his new school and his new friend.",
            "\"It was a great day,\" Ben says with a big smile. \"I can't wait for tomorrow.\"",
          ],
        },
      ],
    },
    prep2: {
      title: "The Mystery of the Old Library",
      subtitle: "قصة الصف الثاني الإعدادي — مستوى متوسط",
      chapters: [
        {
          id: "prep2-c1",
          number: 1,
          title: "A Strange Noise",
          desc: "ليلى تسمع صوتًا غريبًا في مكتبة المدرسة القديمة.",
          videoUrl: "",
          examUrl: "",
          story: [
            "Last Tuesday, Laila stayed at school late to finish a project. The old library was quiet and almost empty.",
            "Suddenly, she heard a strange noise coming from behind the tall bookshelves.",
            "Her heart beat faster. She decided to find out what was making the sound.",
          ],
        },
        {
          id: "prep2-c2",
          number: 2,
          title: "The Hidden Door",
          desc: "ليلى تكتشف بابًا خشبيًا صغيرًا خلف أحد الرفوف.",
          videoUrl: "",
          examUrl: "",
          story: [
            "Laila walked slowly between the shelves. Behind an old history book, she found a small wooden door.",
            "It was covered in dust and looked like it hadn't been opened for years.",
            "She pushed the door gently, and it creaked open, revealing a narrow staircase.",
          ],
        },
        {
          id: "prep2-c3",
          number: 3,
          title: "A Room Full of Secrets",
          desc: "غرفة مخفية مليئة بخرائط ورسائل قديمة عمرها خمسون عامًا.",
          videoUrl: "",
          examUrl: "",
          story: [
            "At the bottom of the stairs, Laila discovered a hidden room full of old maps and letters.",
            "The letters were written by students who had studied at the school more than fifty years ago.",
            "She realized she had found a piece of the school's forgotten history.",
          ],
        },
        {
          id: "prep2-c4",
          number: 4,
          title: "Sharing the Discovery",
          desc: "ليلى تخبر معلمتها فتتحول الغرفة إلى متحف صغير للمدرسة.",
          videoUrl: "",
          examUrl: "",
          story: [
            "The next morning, Laila told her teacher about the hidden room.",
            "The teacher was amazed and decided to turn it into a small school museum.",
            "Thanks to Laila's curiosity, the whole school learned about its own history.",
          ],
        },
      ],
    },
    prep3: {
      title: "The Last Train to Cairo",
      subtitle: "قصة الصف الثالث الإعدادي — مستوى متقدم",
      chapters: [
        {
          id: "prep3-c1",
          number: 1,
          title: "A Difficult Decision",
          desc: "يوسف يقرر ترك قريته والسفر للدراسة في القاهرة.",
          videoUrl: "",
          examUrl: "",
          story: [
            "Youssef had always dreamed of studying engineering in Cairo, but leaving his hometown was not an easy decision.",
            "His family had built their entire life in a small village, and moving away felt like leaving everything behind.",
            "Still, he knew that this opportunity might never come again.",
          ],
        },
        {
          id: "prep3-c2",
          number: 2,
          title: "Missing the Train",
          desc: "يوسف يفوّت القطار الأول وينتظر آخر قطار لليلة.",
          videoUrl: "",
          examUrl: "",
          story: [
            "On the morning of his journey, Youssef overslept and rushed to the station, only to see the train pulling away.",
            "He stood on the platform, breathless and disappointed, wondering if he had lost his only chance.",
            "An old station worker noticed him and said, \"There's still one more train tonight — the last one to Cairo.\"",
          ],
        },
        {
          id: "prep3-c3",
          number: 3,
          title: "A Conversation with a Stranger",
          desc: "حوار مع رجل غريب يمنح يوسف ثقة أكبر بقراره.",
          videoUrl: "",
          examUrl: "",
          story: [
            "While waiting for the last train, Youssef met an elderly man who had once been a teacher.",
            "They talked for hours about ambition, patience, and the courage it takes to start over in a new city.",
            "By the time the train arrived, Youssef felt more confident about the path ahead of him.",
          ],
        },
        {
          id: "prep3-c4",
          number: 4,
          title: "Arriving in Cairo",
          desc: "وصول يوسف أخيرًا إلى القاهرة وبداية رحلته الجديدة.",
          videoUrl: "",
          examUrl: "",
          story: [
            "When Youssef finally reached Cairo, the city was louder and busier than anything he had imagined.",
            "He remembered the old man's words and reminded himself that every big journey begins with a single step.",
            "With his suitcase in hand, he walked toward his new university, ready for whatever came next.",
          ],
        },
      ],
    },
  };

  function storyProgressKey(user) {
    return `bloom-story-progress-${user.id}`;
  }

  function storyStepsKey(user) {
    return `sn-story-steps-${user.id}`;
  }

  function getStorySteps(user) {
    try {
      const value = JSON.parse(localStorage.getItem(storyStepsKey(user)));
      return value && typeof value === "object" && !Array.isArray(value) ? value : {};
    } catch {
      return {};
    }
  }

  function markStoryStep(user, chapterId, step) {
    const steps = getStorySteps(user);
    steps[chapterId] = { ...(steps[chapterId] || {}), [step]: true };
    localStorage.setItem(storyStepsKey(user), JSON.stringify(steps));
    syncSet(user, "storySteps", steps);
  }

  function isStoryChapterDone(chapter, user) {
    const steps = getStorySteps(user)[chapter.id] || {};
    const videoDone = !chapter.videoUrl || steps.video;
    const pdfDone = !chapter.storyPdfUrl || steps.pdf;
    const exam = getStoryExamSubmission(user, chapter.id);
    return !!(videoDone && pdfDone && exam && Number(exam.percent) >= STORY_PASS_PERCENT);
  }

  function getStoryProgress(user) {
    try {
      const raw = JSON.parse(localStorage.getItem(storyProgressKey(user)));
      return Array.isArray(raw) ? raw : [];
    } catch {
      return [];
    }
  }

  function markChapterVisited(user, chapterId) {
    const visited = getStoryProgress(user);
    if (!visited.includes(chapterId)) {
      visited.push(chapterId);
      localStorage.setItem(storyProgressKey(user), JSON.stringify(visited));
      syncSet(user, "storyProgress", visited);
    }
  }

  const STORY_PASS_PERCENT = 70;

  function storyExamKey(user, chapterId) {
    return `sn-story-exam-${user.id}-${chapterId}`;
  }

  function getStoryExamSubmission(user, chapterId) {
    try {
      const value = JSON.parse(localStorage.getItem(storyExamKey(user, chapterId)));
      return value && typeof value === "object" ? value : null;
    } catch {
      return null;
    }
  }

  function isChapterUnlocked(story, index, user) {
    if (index === 0) return true;
    return isStoryChapterDone(story.chapters[index - 1], user);
  }

  function renderStoryChapters(gradeId, user) {
    const story = STORY_DATA[gradeId];
    const grid = document.getElementById("storyChaptersGrid");
    const titleEl = document.getElementById("storyHeadTitle");
    const subtitleEl = document.getElementById("storyHeadSubtitle");
    if (!story || !grid) return;

    if (titleEl) titleEl.textContent = story.title;
    if (subtitleEl) subtitleEl.textContent = story.subtitle;

    const visited = getStoryProgress(user);
    const arrowIcon = `<svg class="chapter-card__arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6l6 6-6 6"/></svg>`;

    grid.innerHTML = story.chapters
      .map((ch, index) => {
        const isVisited = visited.includes(ch.id);
        const unlocked = isChapterUnlocked(story, index, user);
        const submission = getStoryExamSubmission(user, ch.id);
        const lock = unlocked ? "" : ' disabled aria-disabled="true"';
        return `
        <li>
          <button type="button" class="chapter-card" data-chapter-id="${ch.id}"${lock}>
            <span class="chapter-card__number">${String(ch.number).padStart(2, "0")}</span>
            <span class="chapter-card__body">
              <span class="chapter-card__title">${ch.title}</span>
              <p class="chapter-card__desc">${unlocked ? ch.desc : `${inlineIcon("lock")} اجتز امتحان الفصل السابق بنسبة ${STORY_PASS_PERCENT}% أو أكثر`}</p>
            </span>
            ${isVisited ? `<span class="chapter-card__status">${inlineIcon("check")} تمّت المشاهدة</span>` : ""}
            ${submission ? `<span class="chapter-card__status">${submission.percent}%</span>` : ""}
            ${arrowIcon}
          </button>
        </li>`;
      })
      .join("");

    // Wire chapter clicks each time the grid is re-rendered (grade switch).
    grid.querySelectorAll(".chapter-card").forEach((card) => {
      card.addEventListener("click", () => {
        const chapter = story.chapters.find((c) => c.id === card.dataset.chapterId);
        if (chapter) openChapterModal(chapter, gradeId, user);
      });
    });
  }

  // --- نافذة خيارات الفصل ------------------------------------------------
  const CHAPTER_OPTION_ICONS = {
    video: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="5" width="15" height="14" rx="2"/><path d="M17 10l5-3v10l-5-3"/></svg>`,
    story: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19V5a2 2 0 0 1 2-2h11.5v16H6a2 2 0 0 0-2 2Z"/><path d="M6 21h13.5V19"/></svg>`,
    exam: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 3h6v4H9z"/><rect x="5" y="7" width="14" height="14" rx="2"/><path d="M9 13h6M9 17h4"/></svg>`,
  };

  function openChapterModal(chapter, gradeId, user) {
    const modal = document.getElementById("chapterModal");
    const optionsView = document.getElementById("chapterOptionsView");
    const contentView = document.getElementById("chapterContentView");
    const title = document.getElementById("chapterModalTitle");
    const list = document.getElementById("chapterOptionsList");
    if (!modal || !optionsView || !contentView || !title || !list) return;

    title.textContent = `الفصل ${chapter.number}: ${chapter.title}`;

    list.innerHTML = `
      <button type="button" class="chapter-option chapter-option--video" data-option="video">
        <span class="chapter-option__icon">${CHAPTER_OPTION_ICONS.video}</span>
        <span class="chapter-option__body">
          <span class="chapter-option__title">فيديو شرح الفصل</span>
          <span class="chapter-option__desc">شرح مرئي لأحداث ومفردات الفصل</span>
        </span>
        <svg class="chapter-option__chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6l6 6-6 6"/></svg>
      </button>
      <button type="button" class="chapter-option chapter-option--story" data-option="story">
        <span class="chapter-option__icon">${CHAPTER_OPTION_ICONS.story}</span>
        <span class="chapter-option__body">
          <span class="chapter-option__title">القصة مكتوبة</span>
          <span class="chapter-option__desc">${chapter.storyPdfUrl ? "فتح نسخة PDF من الفصل" : "قراءة نص الفصل كاملًا"}</span>
        </span>
        <svg class="chapter-option__chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6l6 6-6 6"/></svg>
      </button>
      <button type="button" class="chapter-option chapter-option--exam" data-option="exam">
        <span class="chapter-option__icon">${CHAPTER_OPTION_ICONS.exam}</span>
        <span class="chapter-option__body">
          <span class="chapter-option__title">امتحان الفصل</span>
          <span class="chapter-option__desc">20 سؤالًا — النجاح بأكثر من 70% لفتح الفصل التالي</span>
        </span>
        <svg class="chapter-option__chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6l6 6-6 6"/></svg>
      </button>`;

    list.querySelectorAll(".chapter-option").forEach((btn) => {
      btn.addEventListener("click", () => {
        markChapterVisited(user, chapter.id);
        renderStoryChapters(gradeId, user);
        showChapterContent(btn.dataset.option, chapter, user);
      });
    });

    optionsView.hidden = false;
    contentView.hidden = true;
    modal.hidden = false;
    requestAnimationFrame(() => modal.classList.add("is-open"));
  }

  function closeChapterModal() {
    const modal = document.getElementById("chapterModal");
    if (!modal) return;
    modal.classList.remove("is-open");
    window.setTimeout(() => {
      modal.hidden = true;
      // Empty video iframes so playback stops once the modal is closed.
      const body = document.getElementById("chapterContentBody");
      if (body) body.innerHTML = "";
    }, 200);
  }

  function openStoryExam(chapter, user) {
    const contentTitle = document.getElementById("chapterContentTitle");
    const body = document.getElementById("chapterContentBody");
    if (!contentTitle || !body) return;

    contentTitle.textContent = `امتحان الفصل ${chapter.number}: ${chapter.title}`;
    const questions = (chapter.examQuestions || []).slice(0, 20).map((question, index) => ({
      ...question,
      id: question.id || `${chapter.id}-q${index + 1}`,
      correctIndex: question.correctIndex == null ? question.answer : question.correctIndex,
    }));

    if (questions.length !== 20) {
      body.innerHTML = `<div class="chapter-placeholder">
        <span class="chapter-placeholder__icon">${CHAPTER_OPTION_ICONS.exam}</span>
        <p>امتحان هذا الفصل يحتاج 20 سؤال اختيار من متعدد داخل بيانات الفصل قبل تفعيله.</p>
      </div>`;
      return;
    }

    const previous = getStoryExamSubmission(user, chapter.id);
    body.innerHTML = `<form class="exam-form story-exam-form" id="storyExamForm" novalidate>
      <p class="exam-question__hint">20 سؤال اختيار من متعدد — النجاح من ${STORY_PASS_PERCENT}% فما فوق.</p>
      ${questions.map((question, index) => buildQuestionHTML(question, index)).join("")}
      <div class="exam-actions" id="storyExamActions"><button type="submit" class="btn btn--accent">تسليم امتحان الفصل</button></div>
      <div class="exam-result" id="storyExamResult" hidden></div>
    </form>`;

    const form = document.getElementById("storyExamForm");
    const actions = document.getElementById("storyExamActions");
    const result = document.getElementById("storyExamResult");
    const showResult = (submission) => {
      const passed = Number(submission.percent) >= STORY_PASS_PERCENT;
      result.hidden = false;
      result.innerHTML = `<p class="exam-result__score">${submission.percent}%</p>
        <p class="exam-result__label">${passed ? `${inlineIcon("check")} نجحت في امتحان الفصل` : `تحتاج إلى ${STORY_PASS_PERCENT}% أو أكثر لفتح الفصل التالي`}</p>
        <p class="exam-result__note">${submission.correct}/${submission.total} إجابة صحيحة</p>`;
    };

    if (previous && Number(previous.percent) >= STORY_PASS_PERCENT) {
      form.querySelectorAll("input").forEach((input) => { input.disabled = true; });
      actions.hidden = true;
      showResult(previous);
      return;
    }

    if (previous) showResult(previous);
    form.onsubmit = (event) => {
      event.preventDefault();
      if (!form.reportValidity()) return;
      const data = new FormData(form);
      const correct = questions.reduce((total, question) => total + (Number(data.get(question.id)) === Number(question.correctIndex) ? 1 : 0), 0);
      const submission = {
        chapterId: chapter.id,
        chapterTitle: chapter.title,
        correct,
        total: questions.length,
        percent: Math.round((correct / questions.length) * 100),
        at: new Date().toISOString(),
      };
      localStorage.setItem(storyExamKey(user, chapter.id), JSON.stringify(submission));
      syncSet(user, `storyExams/${chapter.id}`, submission);
      if (window.SNAuth && window.SNAuth.addGradeEntry) {
        const gradeEntry = {
          title: `امتحان القصة: ${chapter.title}`,
          examId: `story-${chapter.id}`,
          date: formatArabicDate(submission.at),
          at: submission.at,
          score: correct,
          outOf: questions.length,
        };
        GRADE_CATEGORIES[1].entries.unshift(gradeEntry);
        refreshGradesViews();
        window.SNAuth.addGradeEntry(user.id, "mcq", gradeEntry).catch((err) => console.warn("تعذر حفظ درجة امتحان القصة في Firebase", err));
      }
      form.querySelectorAll("input").forEach((input) => { input.disabled = true; });
      actions.hidden = true;
      showResult(submission);
      if (submission.percent >= STORY_PASS_PERCENT) renderStoryChapters(user.grade, user);
    };
  }

  function showChapterContent(type, chapter, user) {
    const optionsView = document.getElementById("chapterOptionsView");
    const contentView = document.getElementById("chapterContentView");
    const contentTitle = document.getElementById("chapterContentTitle");
    const body = document.getElementById("chapterContentBody");
    if (!optionsView || !contentView || !contentTitle || !body) return;

    const placeholder = (message) => `
      <div class="chapter-placeholder">
        <span class="chapter-placeholder__icon">${CHAPTER_OPTION_ICONS[type]}</span>
        <p>${message}</p>
      </div>`;

    if (type === "video") {
      contentTitle.textContent = "فيديو شرح الفصل";
      const ytId = parseYouTubeId(chapter.videoUrl);
      if (!chapter.videoUrl) {
        body.innerHTML = placeholder("سيتم إضافة فيديو شرح هذا الفصل قريبًا.");
      } else if (ytId) {
        body.innerHTML = `<div class="chapter-video"><div id="storyYtPlayerHost"></div></div>
          <p id="storyVideoTrackNote" class="exam-question__hint" style="margin-top:10px">${inlineIcon("warning")} شاهد الفيديو كاملًا من غير تقديم.</p>`;
        const storyPlayer = { ...chapter, id: chapter.id };
        loadYouTubeApi().then(() => {
          const host = document.getElementById("storyYtPlayerHost");
          if (!host) return;
          const previousHost = document.getElementById("ytPlayerHost");
          if (previousHost) previousHost.id = "storyYtPlayerHost";
          startYouTubeTracking(ytId, storyPlayer, user, () => {
            markStoryStep(user, chapter.id, "video");
            renderStoryChapters(user.grade, user);
            const note = document.getElementById("storyVideoTrackNote");
            if (note) note.innerHTML = `${inlineIcon("check")} تم احتساب مشاهدة الفيديو كاملًا.`;
          }, "storyYtPlayerHost");
        });
      } else {
        body.innerHTML = `<div class="chapter-video"><iframe src="${escapeHTML(chapter.videoUrl)}" title="فيديو شرح الفصل" allowfullscreen loading="lazy"></iframe></div>
          <p class="exam-question__hint" style="margin-top:10px"><button type="button" class="btn btn--accent" id="storyVideoDoneBtn">${inlineIcon("check")} خلّصت مشاهدة الفيديو كامل</button></p>`;
        document.getElementById("storyVideoDoneBtn")?.addEventListener("click", () => {
          markStoryStep(user, chapter.id, "video");
          renderStoryChapters(user.grade, user);
          const button = document.getElementById("storyVideoDoneBtn");
          if (button) button.parentElement.innerHTML = `${inlineIcon("check")} تم احتساب الفيديو.`;
        });
      }
    } else if (type === "story") {
      contentTitle.textContent = "القصة مكتوبة";
      if (chapter.storyPdfUrl) {
        body.innerHTML = `<div class="lesson-pdf-viewer">
          <div class="lesson-pdf-toolbar" dir="ltr">
            <button type="button" class="lesson-pdf-nav" id="storyPdfPrevious" aria-label="الصفحة السابقة"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m15 18-6-6 6-6"/></svg></button>
            <span id="storyPdfPage">1 / …</span>
            <button type="button" class="lesson-pdf-nav" id="storyPdfNext" aria-label="الصفحة التالية"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 18 6-6-6-6"/></svg></button>
          </div>
          <p id="storyPdfLoading" class="exam-question__hint">جاري تحميل الصفحة الأولى…</p>
          <canvas id="storyPdfCanvas" aria-label="صفحة PDF القصة"></canvas>
        </div>`;
        const storyPdfBody = body;
        const canvas = storyPdfBody.querySelector("#storyPdfCanvas");
        canvas.id = "lessonPdfCanvas";
        storyPdfBody.querySelector("#storyPdfPrevious").id = "lessonPdfPrevious";
        storyPdfBody.querySelector("#storyPdfNext").id = "lessonPdfNext";
        storyPdfBody.querySelector("#storyPdfPage").id = "lessonPdfPage";
        storyPdfBody.querySelector("#storyPdfLoading").id = "lessonPdfLoading";
        requestAnimationFrame(() => initPdfViewer(chapter.storyPdfUrl, body, () => {
          markStoryStep(user, chapter.id, "pdf");
          renderStoryChapters(user.grade, user);
        }));
      } else {
        body.innerHTML = `<div class="chapter-story-text">${chapter.story.map((p) => `<p>${p}</p>`).join("")}</div>`;
        markStoryStep(user, chapter.id, "pdf");
      }
    } else if (type === "exam") {
      openStoryExam(chapter, user);
      return;
    }

    optionsView.hidden = true;
    contentView.hidden = false;
  }

  function initStorySection(user) {
    const tabs = document.querySelectorAll("#storyTabs .dash-tab");
    const modal = document.getElementById("chapterModal");
    if (!tabs.length || !modal) return;

    const own = Array.from(tabs).find((tab) => tab.dataset.grade === user.grade);
    tabs.forEach((tab) => {
      tab.hidden = tab !== own;
    });
    if (!own) return;

    tabs.forEach((tab) => {
      tab.addEventListener("click", () => {
        tabs.forEach((t) => {
          t.classList.toggle("is-active", t === tab);
          t.setAttribute("aria-selected", String(t === tab));
        });
        renderStoryChapters(tab.dataset.grade, user);
      });
    });

    // Open on the student's own grade by default, like the leaderboard tabs.
    own.classList.add("is-active");
    own.setAttribute("aria-selected", "true");
    renderStoryChapters(own.dataset.grade, user);

    document.getElementById("chapterModalCloseBtn")?.addEventListener("click", closeChapterModal);
    document.getElementById("chapterContentBackBtn")?.addEventListener("click", () => {
      document.getElementById("chapterOptionsView").hidden = false;
      document.getElementById("chapterContentView").hidden = true;
      document.getElementById("chapterContentBody").innerHTML = "";
    });
    modal.addEventListener("click", (e) => {
      if (e.target === modal) closeChapterModal();
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && !modal.hidden) closeChapterModal();
    });
  }

  // --- سجل الدرجات (مقسّم إلى 3 أقسام) -----------------------------------------
  /** سجل الدرجات الحقيقي: الأقسام بتتملّى من Firebase (grades/{id}/{category}).
   *  درجات الاختيار من متعدد بتتسجل تلقائيًا أول ما الطالب يسلّم أي امتحان؛ المقالي والشيتات الأسبوعية بيضيفها الأدمن. */
  const GRADE_CATEGORIES = [
    { id: "lessons", label: "امتحانات الدروس", entries: [] },
    { id: "story", label: "امتحانات القصة", entries: [] },
    { id: "weekly", label: "الشيتات", entries: [] },
  ];

  function formatArabicDate(iso) {
    try {
      return new Date(iso).toLocaleDateString("ar-EG", { day: "numeric", month: "long", year: "numeric" });
    } catch {
      return "";
    }
  }

  function applyRemoteGrades(remote) {
    const normalize = (node) => node
      .map((e) => ({ ...e, outOf: Number(e.outOf ?? e.total ?? e.maxScore), score: Number(e.score) }))
      .filter((e) => e && Number.isFinite(e.score) && Number.isFinite(e.outOf) && e.outOf > 0)
      .map((e) => ({ ...e, date: e.date || formatArabicDate(e.at || e.submittedAt) }))
      .sort((x, y) => String(y.at || y.submittedAt || "").localeCompare(String(x.at || x.submittedAt || "")));
    const mcq = normalize(remote && remote.mcq ? Object.values(remote.mcq) : []);
    const story = mcq.filter((entry) => String(entry.examId || "").startsWith("story-") || String(entry.title || "").includes("القصة"));
    const lessons = mcq.filter((entry) => !story.includes(entry));
    const weekly = normalize(remote && remote.weekly ? Object.values(remote.weekly) : []);
    GRADE_CATEGORIES[0].entries = lessons;
    GRADE_CATEGORIES[1].entries = story;
    GRADE_CATEGORIES[2].entries = weekly;
  }

  function refreshGradesViews() {
    renderGradesBarChart();
    const active = document.querySelector("#gradesTabs .dash-tab.is-active");
    renderGradesCategory(active ? active.dataset.category : GRADE_CATEGORIES[0].id);
  }

  /** بيسجّل درجة الاختيار من متعدد فعليًا في قاعدة البيانات أول ما الطالب يسلّم الامتحان. */
  function recordMcqGrade(user, title, examId, score, outOf) {
    if (!outOf) return;
    const at = new Date().toISOString();
    const entry = { title, examId, date: formatArabicDate(at), at, score, outOf };
    GRADE_CATEGORIES[0].entries.unshift(entry);
    if (window.SNAuth && window.SNAuth.addGradeEntry) {
      window.SNAuth.addGradeEntry(user.id, "mcq", entry).catch((err) =>
        console.warn("تعذر حفظ الدرجة في Firebase", err)
      );
    }
    refreshGradesViews();
  }

  function percentOf(entry) {
    return Math.round((entry.score / entry.outOf) * 100);
  }

  function levelFor(percent) {
    if (percent >= 90) return { level: "excellent", label: "ممتاز" };
    if (percent >= 75) return { level: "verygood", label: "جيد جدًا" };
    return { level: "good", label: "جيد" };
  }

  function categoryAverage(category) {
    if (!category.entries.length) return 0;
    const total = category.entries.reduce((sum, e) => sum + percentOf(e), 0);
    return Math.round(total / category.entries.length);
  }

  function renderGradesCategory(categoryId) {
    const log = document.getElementById("gradesLog");
    const avgEl = document.getElementById("gradesCategoryAverage");
    if (!log) return;

    const category = GRADE_CATEGORIES.find((c) => c.id === categoryId) || GRADE_CATEGORIES[0];

    if (avgEl) {
      avgEl.innerHTML = `متوسط "${category.label}": <strong>${categoryAverage(category)}%</strong>`;
    }

    if (!category.entries.length) {
      log.innerHTML = `<p class="dash-todo-empty">لا توجد نتائج مسجّلة في هذا القسم بعد.</p>`;
      return;
    }

    log.innerHTML = category.entries
      .map((e) => {
        const percent = percentOf(e);
        const { level, label } = levelFor(percent);
        return `
      <div class="dash-log__row">
        <div class="dash-log__main">
          <p class="dash-log__title">${e.title}</p>
          <span class="dash-log__date">${e.date}</span>
        </div>
        <span class="dash-log__score">${e.score}/${e.outOf}</span>
        <span class="dash-log__grade dash-log__grade--${level}">${label}</span>
      </div>`;
      })
      .join("");
  }

  function initGradesTabs() {
    const tabs = document.querySelectorAll("#gradesTabs .dash-tab");
    if (!tabs.length) return;

    tabs.forEach((tab) => {
      tab.addEventListener("click", () => {
        tabs.forEach((t) => {
          t.classList.toggle("is-active", t === tab);
          t.setAttribute("aria-selected", String(t === tab));
        });
        renderGradesCategory(tab.dataset.category);
      });
    });

    renderGradesCategory(tabs[0].dataset.category);
  }

  // --- رسم بياني: إنجاز الدروس ومتوسط الدرجات -----------------------------------
  /** إحصائيات الدروس الحقيقية: الدروس اللي الطالب فتحها فعلاً من إجمالي دروس صفه. */
  function computeLessonStats(user) {
    const units = UNIT_DATA[user.grade];
    const lessons = units ? units.flatMap((u) => u.lessons) : LESSON_DATA[user.grade] || [];
    const done = units
      ? lessons.filter((lesson) => isLessonDone(user, lesson)).length
      : getLessonProgress(user).filter((id) => lessons.some((lesson) => lesson.id === id)).length;
    const total = lessons.length;
    return { done, total, percent: total ? Math.round((done / total) * 100) : 0 };
  }

  function renderLessonsDonut(user) {
    const circle = document.getElementById("lessonsDonut");
    const percentText = document.getElementById("lessonsDonutPercent");
    const legend = document.getElementById("lessonsDonutLegend");
    if (!circle) return;

    const { done, total, percent } = computeLessonStats(user);
    const circumference = 2 * Math.PI * 54;
    circle.setAttribute("stroke-dasharray", `${(percent / 100) * circumference} ${circumference}`);
    if (percentText) percentText.textContent = `${percent}%`;
    if (legend) legend.textContent = `${done} من ${total} درسًا`;
  }

  // --- وقت التعلّم وأيام الدخول المتتالية (حقيقية ومتخزنة في Firebase) ---
  const learning = { seconds: 0, dirty: false };
  let visitDays = [];

  function todayKey(d = new Date()) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }

  function computeStreak(days) {
    const set = new Set(days);
    let streak = 0;
    const cursor = new Date();
    while (set.has(todayKey(cursor))) {
      streak += 1;
      cursor.setDate(cursor.getDate() - 1);
    }
    return streak;
  }

  function formatLearningTime(sec) {
    return sec < 3600 ? `${Math.floor(sec / 60)} د` : `${(sec / 3600).toFixed(1)} س`;
  }

  function renderProgressStats(user) {
    const { done, percent } = computeLessonStats(user);
    const set = (id, text) => {
      const el = document.getElementById(id);
      if (el) el.textContent = text;
    };
    set("statOverall", `${percent}%`);
    set("statLessons", String(done));
    set("statHours", formatLearningTime(learning.seconds));
    set("statStreak", String(computeStreak(visitDays)));
    renderRealSkills(user);
  }

  function renderRealSkills(user) {
    const lessons = UNIT_DATA[user.grade] ? UNIT_DATA[user.grade].flatMap((unit) => unit.lessons) : LESSON_DATA[user.grade] || [];
    const lessonPercent = computeLessonStats(user).percent;
    const sheetLessons = lessons.filter((lesson) => lesson.unitId);
    const passedSheets = sheetLessons.filter((lesson) => isSheetPassed(user, lesson)).length;
    const sheetPercent = sheetLessons.length ? Math.round((passedSheets / sheetLessons.length) * 100) : 0;
    const examEntries = GRADE_CATEGORIES.flatMap((category) => category.entries);
    const examPercent = examEntries.length ? Math.round(examEntries.reduce((sum, entry) => sum + percentOf(entry), 0) / examEntries.length) : 0;
    const story = STORY_DATA[user.grade];
    const storyVisited = story ? getStoryProgress(user).filter((id) => story.chapters.some((chapter) => chapter.id === id)).length : 0;
    const storyPercent = story ? Math.round((storyVisited / story.chapters.length) * 100) : 0;
    const weeklyPercent = Math.min(100, Math.round((computeStreak(visitDays) / 7) * 100));
    const values = { lessonPercent, sheetPercent, examPercent, storyPercent, weeklyPercent };
    Object.entries(values).forEach(([key, value]) => {
      const fill = document.querySelector(`[data-skill="${key}"] .progress-fill`);
      const valueEl = document.querySelector(`[data-skill="${key}"] .skill-percent`);
      if (fill) fill.style.width = `${value}%`;
      if (valueEl) valueEl.textContent = `${value}%`;
    });
  }

  function loadLearningLocal(user) {
    learning.seconds = parseInt(localStorage.getItem(`bloom-learning-seconds-${user.id}`), 10) || 0;
    try {
      const raw = JSON.parse(localStorage.getItem(`bloom-visit-days-${user.id}`));
      visitDays = Array.isArray(raw) ? raw : [];
    } catch {
      visitDays = [];
    }
  }

  function initLearningStats(user) {
    const secKey = `bloom-learning-seconds-${user.id}`;
    const daysKey = `bloom-visit-days-${user.id}`;
    loadLearningLocal(user);

    const today = todayKey();
    if (!visitDays.includes(today)) {
      visitDays = visitDays.concat(today).slice(-120);
      localStorage.setItem(daysKey, JSON.stringify(visitDays));
      syncSet(user, "visitDays", visitDays);
    }

    function flush() {
      if (!learning.dirty) return;
      learning.dirty = false;
      localStorage.setItem(secKey, String(learning.seconds));
      syncSet(user, "learningSeconds", learning.seconds);
    }

    // بنعدّ الوقت بس والتاب ظاهر قدام الطالب.
    setInterval(() => {
      if (document.visibilityState !== "visible") return;
      learning.seconds += 10;
      learning.dirty = true;
      renderProgressStats(user);
    }, 10000);
    setInterval(flush, 60000);
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") flush();
    });
    window.addEventListener("pagehide", flush);

    renderProgressStats(user);
    if (computeStreak(visitDays) >= 7) awardBadgeOnce("week-streak");
  }

  function awardBadgeOnce(badgeId) {
    const full = getFullCurrentUser();
    if (full && !(full.badges || []).includes(badgeId)) awardPoints(0, badgeId);
  }

  /** بيسحب بيانات الطالب من Firebase ويدمجها مع المحلي (اتحاد للتقدم، والبعيد هو الأصل للمهام والملاحظات). */
  async function hydrateFromRemote(user) {
    if (!window.SNAuth || !window.SNAuth.userDataGet) return;
    const [data, grades] = await Promise.all([window.SNAuth.userDataGet(user.id), window.SNAuth.fetchGrades(user.id)]);

    const readLocal = (key, fallback) => {
      try {
        const v = JSON.parse(localStorage.getItem(key));
        return v === null || v === undefined ? fallback : v;
      } catch {
        return fallback;
      }
    };
    const asArray = (v) => (Array.isArray(v) ? v : v && typeof v === "object" ? Object.values(v) : []);

    [
      ["lessonsProgress", lessonProgressKey(user)],
      ["storyProgress", storyProgressKey(user)],
    ].forEach(([path, key]) => {
      const remote = asArray(data[path]);
      const merged = Array.from(new Set([...remote, ...readLocal(key, [])]));
      localStorage.setItem(key, JSON.stringify(merged));
      if (merged.length !== remote.length) syncSet(user, path, merged);
    });

    {
      const stepsKey = lessonStepsKey(user);
      const merged = mergeLessonSteps(readLocal(stepsKey, {}), data.lessonSteps);
      localStorage.setItem(stepsKey, JSON.stringify(merged));
      if (JSON.stringify(merged) !== JSON.stringify(mergeLessonSteps({}, data.lessonSteps))) syncSet(user, "lessonSteps", merged);
    }

    const remoteStoryExams = data.storyExams || {};
    Object.entries(remoteStoryExams).forEach(([chapterId, submission]) => {
      if (!submission || !Number.isFinite(Number(submission.percent))) return;
      const local = readLocal(storyExamKey(user, chapterId), null);
      if (!local || Number(submission.percent) >= Number(local.percent)) {
        localStorage.setItem(storyExamKey(user, chapterId), JSON.stringify(submission));
      }
    });

    {
      // نتائج امتحان القصة المحلية اللي لسه ما وصلتش Firebase (مثلًا النت كان قاطع وقت التسليم)
      const prefix = `sn-story-exam-${user.id}-`;
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (!k || !k.startsWith(prefix)) continue;
        const chapterId = k.slice(prefix.length);
        const local = readLocal(k, null);
        const remote = remoteStoryExams[chapterId];
        if (local && Number.isFinite(Number(local.percent)) && (!remote || Number(local.percent) > Number(remote.percent))) {
          syncSet(user, `storyExams/${chapterId}`, local);
        }
      }
    }

    const localStorySteps = readLocal(storyStepsKey(user), {});
    const remoteStorySteps = data.storySteps || {};
    const mergedStorySteps = { ...localStorySteps };
    Object.entries(remoteStorySteps).forEach(([chapterId, steps]) => {
      mergedStorySteps[chapterId] = { ...(mergedStorySteps[chapterId] || {}), ...(steps || {}) };
    });
    localStorage.setItem(storyStepsKey(user), JSON.stringify(mergedStorySteps));
    if (JSON.stringify(mergedStorySteps) !== JSON.stringify(remoteStorySteps)) syncSet(user, "storySteps", mergedStorySteps);

    const remoteSheets = data.sheetSubmissions || {};
    Object.entries(remoteSheets).forEach(([lessonId, submission]) => {
      if (!submission || !Number.isFinite(Number(submission.percent))) return;
      const lesson = Object.values(UNIT_DATA).flatMap((units) => units.flatMap((unit) => unit.lessons)).find((item) => item.id === lessonId);
      if (!lesson) return;
      const local = getSheetSubmission(user, lesson);
      if (!local || Number(submission.percent) >= Number(local.percent)) {
        localStorage.setItem(sheetSubmissionKey(user, lesson), JSON.stringify(submission));
      }
    });

    {
      // نتائج الشيتات المحلية اللي لسه ما وصلتش Firebase
      Object.values(UNIT_DATA).flatMap((units) => units.flatMap((unit) => unit.lessons)).forEach((lesson) => {
        const local = getSheetSubmission(user, lesson);
        const remote = remoteSheets[lesson.id];
        if (local && Number.isFinite(Number(local.percent)) && (!remote || Number(local.percent) > Number(remote.percent))) {
          syncSet(user, `sheetSubmissions/${lesson.id}`, local);
        }
      });
    }

    const todosKey = `bloom-todos-${user.id}`;
    if (data.todos) localStorage.setItem(todosKey, JSON.stringify(asArray(data.todos)));
    else if (readLocal(todosKey, []).length) syncSet(user, "todos", readLocal(todosKey, []));

    const notesKey = `bloom-notes-${user.id}`;
    if (typeof data.notes === "string") localStorage.setItem(notesKey, data.notes);
    else if (localStorage.getItem(notesKey)) syncSet(user, "notes", localStorage.getItem(notesKey));

    const remoteExams = data.exams || {};
    Object.keys(remoteExams).forEach((id) => localStorage.setItem(examSubmissionKey(user, id), JSON.stringify(remoteExams[id])));
    const prefix = `bloom-exam-${user.id}-`;
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(prefix) && !remoteExams[k.slice(prefix.length)]) {
        syncSet(user, "exams/" + k.slice(prefix.length), readLocal(k, null));
      }
    }

    const secKey = `bloom-learning-seconds-${user.id}`;
    const seconds = Math.max(parseInt(localStorage.getItem(secKey), 10) || 0, Number(data.learningSeconds) || 0);
    localStorage.setItem(secKey, String(seconds));
    const daysKey = `bloom-visit-days-${user.id}`;
    const days = Array.from(new Set([...asArray(data.visitDays), ...readLocal(daysKey, [])])).sort().slice(-120);
    localStorage.setItem(daysKey, JSON.stringify(days));

    applyRemoteGrades(grades);
  }

  function renderGradesBarChart() {
    const chart = document.getElementById("gradesBarChart");
    if (!chart) return;

    const available = GRADE_CATEGORIES.filter((category) => category.entries.length);
    if (!available.length) {
      chart.innerHTML = `<p class="dash-todo-empty">لا توجد درجات فعلية لعرضها بعد.</p>`;
      return;
    }

    chart.innerHTML = available.map((c) => {
      const avg = categoryAverage(c);
      return `
        <div class="dash-bar">
          <span class="dash-bar__value">${avg}%</span>
          <span class="dash-bar__col" style="height:${avg}%"></span>
          <span class="dash-bar__label">${c.label}</span>
        </div>`;
    }).join("");
  }

  // --- أدوات الإنتاجية --------------------------------------------------------
  function initTodo(user) {
    const KEY = `bloom-todos-${user.id}`;
    const list = document.getElementById("todoList");
    const form = document.getElementById("todoForm");
    const input = document.getElementById("todoInput");
    if (!list || !form || !input) return;

    function read() {
      try {
        const raw = JSON.parse(localStorage.getItem(KEY));
        return Array.isArray(raw) ? raw : [];
      } catch {
        return [];
      }
    }
    function write(items) {
      localStorage.setItem(KEY, JSON.stringify(items));
      syncSet(user, "todos", items);
    }
    function render() {
      const items = read();
      if (!items.length) {
        list.innerHTML = `<li class="dash-todo-empty" style="list-style:none;">لا توجد مهام بعد — أضف أول مهمة لك</li>`;
        return;
      }
      list.innerHTML = items
        .map(
          (t, i) => `
        <li class="${t.done ? "is-done" : ""}" data-index="${i}">
          <input type="checkbox" ${t.done ? "checked" : ""} data-action="toggle" aria-label="تحديد كمكتملة" />
          <span>${t.text}</span>
          <button type="button" class="dash-todo-list__remove" data-action="remove" aria-label="حذف المهمة">${inlineIcon("warning")}</button>
        </li>`
        )
        .join("");
    }

    list.addEventListener("sn-refresh", render);
    list.addEventListener("click", (e) => {
      const li = e.target.closest("li[data-index]");
      if (!li) return;
      const items = read();
      const idx = Number(li.dataset.index);
      if (e.target.dataset.action === "remove") {
        items.splice(idx, 1);
        write(items);
        render();
      } else if (e.target.dataset.action === "toggle") {
        if (items[idx]) items[idx].done = e.target.checked;
        write(items);
        render();
      }
    });

    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const text = input.value.trim();
      if (!text) return;
      const items = read();
      items.unshift({ text, done: false });
      write(items);
      input.value = "";
      render();
    });

    render();
  }

  function initPomodoro() {
    const display = document.getElementById("pomodoroDisplay");
    const startBtn = document.getElementById("pomodoroStartBtn");
    const resetBtn = document.getElementById("pomodoroResetBtn");
    if (!display || !startBtn || !resetBtn) return;

    const DURATION = 25 * 60;
    let remaining = DURATION;
    let timer = null;

    function format(s) {
      const m = Math.floor(s / 60).toString().padStart(2, "0");
      const sec = (s % 60).toString().padStart(2, "0");
      return `${m}:${sec}`;
    }
    function render() {
      display.textContent = format(remaining);
    }

    startBtn.addEventListener("click", () => {
      if (timer) {
        clearInterval(timer);
        timer = null;
        startBtn.textContent = "استئناف";
        return;
      }
      startBtn.textContent = "إيقاف مؤقت";
      timer = setInterval(() => {
        remaining = Math.max(0, remaining - 1);
        render();
        if (remaining === 0) {
          clearInterval(timer);
          timer = null;
          startBtn.textContent = "ابدأ";
        }
      }, 1000);
    });

    resetBtn.addEventListener("click", () => {
      clearInterval(timer);
      timer = null;
      remaining = DURATION;
      startBtn.textContent = "ابدأ";
      render();
    });

    render();
  }

  function initNotes(user) {
    const KEY = `bloom-notes-${user.id}`;
    const area = document.getElementById("notesArea");
    const savedHint = document.getElementById("notesSavedHint");
    if (!area) return;

    area.value = localStorage.getItem(KEY) || "";
    let saveTimer = null;
    area.addEventListener("input", () => {
      clearTimeout(saveTimer);
      saveTimer = setTimeout(() => {
        localStorage.setItem(KEY, area.value);
        syncSet(user, "notes", area.value);
        if (savedHint) {
          savedHint.hidden = false;
          clearTimeout(savedHint._hideTimer);
          savedHint._hideTimer = setTimeout(() => (savedHint.hidden = true), 1500);
        }
      }, 500);
    });
  }

  function overallGradeAverage() {
    if (!GRADE_CATEGORIES.length) return 0;
    const total = GRADE_CATEGORIES.reduce((sum, c) => sum + categoryAverage(c), 0);
    return Math.round(total / GRADE_CATEGORIES.length);
  }

  // --- لوحة الصدارة (لكل صف دراسي، حسب النقاط والدرجات معًا) ---------------------
  /** score = points + (متوسط الدرجات% × 2) — وزن بسيط يمزج الاجتهاد اليومي (نقاط) بالأداء الفعلي (درجات). بيانات تجريبية لكل صف. */
  /* لوحة المتصدرين الحقيقية: بترتب طلاب نفس الصف حسب النقط المخزّنة فعليًا في Firebase. */
  async function renderLeaderboardGrade(gradeId, user) {
    const list = document.getElementById("leaderboardList");
    if (!list) return;

    list.innerHTML = `<li class="dash-leaderboard__row">جاري التحميل...</li>`;

    if (!window.SNAuth) {
      list.innerHTML = `<li class="dash-leaderboard__row">تعذر الاتصال بقاعدة البيانات</li>`;
      return;
    }

    let rows = [];
    try {
      const gradeUsers = await window.SNAuth.fetchUsersByGrade(gradeId);
      rows = gradeUsers
        .filter((u) => u.role !== "admin")
        .map((u) => ({
          name: u.id === user.id ? `${u.fullName} (أنت)` : u.fullName,
          points: Number(u.points) || 0,
          isYou: u.id === user.id,
        }));
    } catch (err) {
      list.innerHTML = `<li class="dash-leaderboard__row">تعذر تحميل لوحة المتصدرين، حاول تاني</li>`;
      return;
    }

    if (!rows.length) {
      list.innerHTML = `<li class="dash-leaderboard__row">لسه مفيش طلاب مسجلين في الصف ده</li>`;
      return;
    }

    rows.sort((a, b) => b.points - a.points);

    list.innerHTML = rows
      .map(
        (r, i) => `
      <li class="dash-leaderboard__row${r.isYou ? " is-you" : ""}">
        <span class="dash-leaderboard__rank">${i + 1}</span>
        <span class="dash-leaderboard__avatar">${initials(r.name)}</span>
        <span class="dash-leaderboard__name">${r.name}</span>
        <span class="dash-leaderboard__points">${r.points} نقطة</span>
      </li>`
      )
      .join("");
  }

  function initLeaderboard(user) {
    const tabsWrap = document.getElementById("leaderboardTabs");
    const tabs = document.querySelectorAll("#leaderboardTabs .dash-tab");
    if (!tabs.length) return;

    const own = Array.from(tabs).find((t) => t.dataset.grade === user.grade);

    // الطالب بيشوف لوحة صفه الدراسي بس: بنشيل باقي التابات من الصفحة خالص.
    if (own) {
      const gradeName = own.textContent.trim();
      const gradeLabel = document.getElementById("leaderboardGradeName");
      if (gradeLabel) {
        gradeLabel.textContent = gradeName;
        gradeLabel.hidden = false;
      }
      if (tabsWrap) tabsWrap.remove();
      renderLeaderboardGrade(own.dataset.grade, user);
      return;
    }

    // احتياطي: لو الحساب مالوش صف معروف (مثلًا حساب أدمن بيفتح الصفحة)، نسيب التابات شغالة زي الأول.
    tabs.forEach((tab) => {
      tab.addEventListener("click", () => {
        tabs.forEach((t) => {
          t.classList.toggle("is-active", t === tab);
          t.setAttribute("aria-selected", String(t === tab));
        });
        renderLeaderboardGrade(tab.dataset.grade, user);
      });
    });
    tabs[0].classList.add("is-active");
    tabs[0].setAttribute("aria-selected", "true");
    renderLeaderboardGrade(tabs[0].dataset.grade, user);
  }

  // --- الملف الشخصي: نموذج التعديل --------------------------------------------
  function initProfileForm(user) {
    const form = document.getElementById("profileForm");
    if (!form) return;

    // للعرض فقط — الطالب لا يقدر يعدّل بياناته من هنا.
    form.fullName.value = user.fullName || "";
    form.email.value = user.email || "";
    form.age.value = user.age || "";
    form.grade.value = user.grade || "prep1";
    const genderRadio = form.querySelector(`input[name="gender"][value="${user.gender}"]`);
    if (genderRadio) genderRadio.checked = true;
  }

  // --- الملف الشخصي: تحكم Liquid Blur -------------------------------------------
  function initBlurControl() {
    const range = document.getElementById("blurRange");
    const valueEl = document.getElementById("blurValue");
    if (!range || !valueEl) return;

    const root = document.documentElement;
    const saved = parseInt(localStorage.getItem(STORAGE_BLUR), 10);
    const initial = Number.isFinite(saved) ? Math.min(Math.max(saved, 0), 30) : 18;

    range.value = String(initial);
    valueEl.textContent = `${initial}px`;

    range.addEventListener("input", () => {
      const px = Number(range.value);
      root.style.setProperty("--blur", `${px}px`);
      localStorage.setItem(STORAGE_BLUR, String(px));
      valueEl.textContent = `${px}px`;
    });
  }

  // --- الملف الشخصي: النقاط والشارات التفاعلية (Dynamic Badges) -------------------
  const TIER_META = {
    bronze: { label: "برونزية", colors: ["#cd7f32", "#8a5a22"] },
    silver: { label: "فضية", colors: ["#dfe6ee", "#9aa5b1"] },
    gold: { label: "ذهبية", colors: ["#e0c071", "#e0a53a"] },
    diamond: { label: "ماسية", colors: ["#a7c9e0", "#4f7fb8"] },
  };

  /** `path` is plain SVG path data (no <circle>/<rect>) so the exact same string draws both the inline <svg> chip and the downloadable canvas image via Path2D. */
  const BADGE_CATALOG = [
    { id: "welcome", label: "عضو جديد", tier: "bronze", path: "M12 2 15 9l7 1-5 5 1.5 7-6.5-3.5L5.5 22 7 15l-5-5 7-1z" },
    { id: "week-streak", label: "أسبوع متواصل", tier: "silver", path: "M13 2 3 14h7l-1 8 10-12h-7l1-8Z" },
    { id: "grammar-star", label: "نجم القواعد", tier: "gold", path: "M7 8a5 5 0 1 1 10 0 5 5 0 0 1-10 0Z M8.5 13 7 22l5-3 5 3-1.5-9Z" },
    { id: "perfect-attendance", label: "حضور مثالي", tier: "gold", path: "M12 2a10 10 0 1 0 0.001 0Z M7.5 12.5l3 3 6-6.5" },
    { id: "top-speaker", label: "بطل المحادثة", tier: "diamond", path: "M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H7" },
  ];

  function downloadBadgeImage(badge, studentName) {
    const size = 640;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");
    const [c1, c2] = TIER_META[badge.tier].colors;
    const cx = size / 2;
    const cy = size / 2 - 30;
    const radius = 180;

    ctx.fillStyle = "#0b2128";
    ctx.fillRect(0, 0, size, size);

    const ringGrad = ctx.createLinearGradient(cx - radius, cy - radius, cx + radius, cy + radius);
    ringGrad.addColorStop(0, c1);
    ringGrad.addColorStop(1, c2);
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.fillStyle = ringGrad;
    ctx.fill();

    ctx.beginPath();
    ctx.arc(cx, cy, radius - 16, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(255,255,255,0.14)";
    ctx.fill();

    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(6, 6);
    ctx.translate(-12, -12);
    ctx.strokeStyle = "#f4eee0";
    ctx.lineWidth = 2;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    try {
      ctx.stroke(new Path2D(badge.path));
    } catch {
      /* very old browsers without multi-subpath Path2D — icon is skipped, badge text still renders */
    }
    ctx.restore();

    ctx.textAlign = "center";
    ctx.fillStyle = "#f4eee0";
    ctx.font = "bold 36px Tajawal, Arial, sans-serif";
    ctx.fillText(badge.label, cx, cy + radius + 62);

    ctx.fillStyle = "#3c90a8";
    ctx.font = "bold 22px Tajawal, Arial, sans-serif";
    ctx.fillText(`شارة ${TIER_META[badge.tier].label}`, cx, cy + radius + 98);

    ctx.fillStyle = "rgba(255,248,223,0.65)";
    ctx.font = "18px Tajawal, Arial, sans-serif";
    ctx.fillText(`${studentName} — ${(window.snBrand && window.snBrand.name()) || "Shady Nasr"}`, cx, size - 34);

    const link = document.createElement("a");
    link.download = `bloom-badge-${badge.id}.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
  }

  function renderPointsAndBadges(user) {
    const pointsEl = document.getElementById("profilePoints");
    const grid = document.getElementById("badgesGrid");
    if (pointsEl) pointsEl.textContent = String(user.points);
    if (!grid) return;

    grid.innerHTML = BADGE_CATALOG.map((b) => {
      const earned = user.badges.includes(b.id);
      const tier = TIER_META[b.tier];
      return `
        <button
          type="button"
          class="dash-badge dash-badge--${b.tier}${earned ? "" : " is-locked"}"
          data-badge-id="${b.id}"
          ${earned ? "" : "disabled"}
          title="${earned ? "اضغط لتحميل الشارة كصورة" : "لم تُكتسب بعد"}"
        >
          <span class="dash-badge__icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="${b.path}"/></svg>
          </span>
          <span class="dash-badge__info">
            <span class="dash-badge__label">${b.label}</span>
            <span class="dash-badge__tier">شارة ${tier.label}</span>
          </span>
          ${
            earned
              ? `<svg class="dash-badge__download" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12m0 0-4-4m4 4 4-4M4 21h16"/></svg>`
              : `<svg class="dash-badge__download" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>`
          }
        </button>`;
    }).join("");

    grid.querySelectorAll(".dash-badge:not(.is-locked)").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const badge = BADGE_CATALOG.find((b) => b.id === btn.dataset.badgeId);
        if (!badge) return;
        const ar = document.documentElement.lang !== "en";
        const msg = ar ? `هل تريد تحميل شارة "${badge.label}" كصورة؟` : `Do you want to download the "${badge.label}" badge as an image?`;
        const yes = window.snDialog
          ? await window.snDialog.confirm({ icon: "download", title: ar ? "تحميل الشارة" : "Download badge", message: msg, confirmText: ar ? "تحميل" : "Download", cancelText: ar ? "إلغاء" : "Cancel" })
          : window.confirm(msg);
        if (!yes) return;
        downloadBadgeImage(badge, user.fullName);
      });
    });
  }

  // --- init -----------------------------------------------------------------
  document.addEventListener("DOMContentLoaded", () => {
    const session = getSessionUser();

    // مفيش تسجيل دخول؟ رجّعه لصفحة الدخول بدل ما يشوف بيانات وهمية.
    if (!session) {
      window.location.replace("login.html");
      return;
    }

    // الأدمن له لوحة تحكمه الخاصة — منعرضش عليه لوحة الطالب.
    if (session.role === "admin") {
      window.location.replace("admin.html");
      return;
    }

    const user = getFullCurrentUser();
    if (!user) {
      window.location.replace("login.html");
      return;
    }

    // الصفحة بتتعرض فورًا من آخر نسخة محفوظة (مافيش أي انتظار على الشبكة هنا)،
    // عشان الفتح يحس إنه سريع زي الأول، من غير أي لاج محسوس.
    initNav();
    initLogout();
    renderIdentity(user);
    renderCourses(user);
    initLessonEngine(user);
    initStorySection(user);
    renderLessonsDonut(user);
    renderGradesBarChart();
    initGradesTabs();
    initTodo(user);
    initPomodoro();
    initNotes(user);
    initLeaderboard(user);
    initProfileForm(user);
    initBlurControl();
    renderPointsAndBadges(user);
    initLearningStats(user);

    // بعد ما الصفحة اتعرضت، مزامنة هادئة في الخلفية مع Firebase عشان لو حاجة
    // اتغيّرت في بياناتك (من جهاز تاني مثلًا) تتحدّث من غير ما توقّف عرض الصفحة.
    if (window.SNAuth) {
      window.SNAuth.findUserByEmail(session.email)
        .then((fresh) => {
          if (!fresh) return;
          const mergedProgress = mergeUnitProgress(getUnitProgress(), fresh.unitProgress);
          fresh.unitProgress = mergedProgress;
          persistUser(fresh);
          if (window.SNAuth && typeof window.SNAuth.saveUnitProgress === "function" && Object.keys(mergedProgress).length) {
            window.SNAuth.saveUnitProgress(fresh.id, mergedProgress).catch(() => {});
          }
          const updated = getFullCurrentUser();
          renderIdentity(updated);
          renderPointsAndBadges(updated);
          renderCourses(updated);
          return hydrateFromRemote(updated).then(() => {
            // بعد سحب البيانات الحقيقية، نعيد رسم كل حاجة بيها.
            loadLearningLocal(updated);
            renderCourses(updated);
            renderLessonsDonut(updated);
            renderProgressStats(updated);
            const storyTab = document.querySelector("#storyTabs .dash-tab.is-active");
            if (storyTab) renderStoryChapters(storyTab.dataset.grade, updated);
            refreshGradesViews();
            const todoList = document.getElementById("todoList");
            if (todoList) todoList.dispatchEvent(new Event("sn-refresh"));
            const notes = document.getElementById("notesArea");
            if (notes && document.activeElement !== notes) notes.value = localStorage.getItem(`bloom-notes-${updated.id}`) || "";
          });
        })
        .catch((err) => console.warn("تعذر تحديث بيانات المستخدم من Firebase في الخلفية", err));
    }
  });
})();

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
      tile_board: "لوحة الصدارة", tile_board_empty: "لسه مفيش طلاب في الترتيب.", pts: "نقطة", board_points: "النقاط", board_time: "الوقت",
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
      tile_board: "Leaderboard", tile_board_empty: "No students on the board yet.", pts: "pts", board_points: "Points", board_time: "Time",
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

  const state = { board: null, grades: null, lastLoad: 0, boardMode: "points" };

  const GRADE_NAMES = {
    prep1: "الصف الأول الإعدادي", prep2: "الصف الثاني الإعدادي", prep3: "الصف الثالث الإعدادي",
    secondary1: "الصف الأول الثانوي", secondary2: "الصف الثاني الثانوي", secondary3: "الصف الثالث الثانوي",
  };

  /* ================= الجمل التحفيزية (عربي + English) =================
     type: ayah (آية) | hadith (حديث) | advice (نصيحة مذاكرة) | exam (نصيحة امتحان) | english (نصيحة إنجليزي) | motive (كلمة تحفيز)
     الآيات والأحاديث: اتأكد من النص من المصحف/كتب الحديث قبل أي تعديل. */
  const Q = (type, ar, en, srcAr, srcEn) => ({ type, ar, en, srcAr, srcEn });
  const QUOTE_LABELS = {
    ayah: ["آية اليوم", "Verse of the day"],
    hadith: ["حديث اليوم", "Hadith of the day"],
    advice: ["نصيحة اليوم", "Tip of the day"],
    exam: ["نصيحة للامتحان", "Exam tip"],
    english: ["نصيحة للإنجليزية", "English tip"],
    motive: ["كلمة تحفيز", "Daily motivation"],
  };

  const STUDY_QUOTES = [
    /* ---------- آيات من القرآن الكريم ---------- */
    Q("ayah", "وَقُل رَّبِّ زِدْنِي عِلْمًا", "And say: My Lord, increase me in knowledge.", "سورة طه — الآية 114", "Surah Ta-Ha 20:114"),
    Q("ayah", "هَلْ يَسْتَوِي الَّذِينَ يَعْلَمُونَ وَالَّذِينَ لَا يَعْلَمُونَ", "Are those who know equal to those who do not know?", "سورة الزمر — الآية 9", "Surah Az-Zumar 39:9"),
    Q("ayah", "يَرْفَعِ اللَّهُ الَّذِينَ آمَنُوا مِنكُمْ وَالَّذِينَ أُوتُوا الْعِلْمَ دَرَجَاتٍ", "Allah will raise those who believe among you, and those who were given knowledge, by degrees.", "سورة المجادلة — الآية 11", "Surah Al-Mujadila 58:11"),
    Q("ayah", "اقْرَأْ بِاسْمِ رَبِّكَ الَّذِي خَلَقَ", "Read in the name of your Lord who created.", "سورة العلق — الآية 1", "Surah Al-Alaq 96:1"),
    Q("ayah", "الَّذِي عَلَّمَ بِالْقَلَمِ ۝ عَلَّمَ الْإِنسَانَ مَا لَمْ يَعْلَمْ", "Who taught by the pen — taught man that which he did not know.", "سورة العلق — الآيتان 4 و5", "Surah Al-Alaq 96:4-5"),
    Q("ayah", "وَأَن لَّيْسَ لِلْإِنسَانِ إِلَّا مَا سَعَىٰ", "And that man will have only what he strives for.", "سورة النجم — الآية 39", "Surah An-Najm 53:39"),
    Q("ayah", "فَإِنَّ مَعَ الْعُسْرِ يُسْرًا ۝ إِنَّ مَعَ الْعُسْرِ يُسْرًا", "Indeed, with hardship comes ease. Indeed, with hardship comes ease.", "سورة الشرح — الآيتان 5 و6", "Surah Ash-Sharh 94:5-6"),
    Q("ayah", "لَا يُكَلِّفُ اللَّهُ نَفْسًا إِلَّا وُسْعَهَا", "Allah does not burden a soul beyond its capacity.", "سورة البقرة — الآية 286", "Surah Al-Baqarah 2:286"),
    Q("ayah", "وَمَن يَتَوَكَّلْ عَلَى اللَّهِ فَهُوَ حَسْبُهُ", "And whoever relies upon Allah — then He is sufficient for him.", "سورة الطلاق — الآية 3", "Surah At-Talaq 65:3"),
    Q("ayah", "وَاصْبِرْ فَإِنَّ اللَّهَ لَا يُضِيعُ أَجْرَ الْمُحْسِنِينَ", "And be patient, for indeed Allah does not allow the reward of those who do good to be lost.", "سورة هود — الآية 115", "Surah Hud 11:115"),
    Q("ayah", "فَإِذَا عَزَمْتَ فَتَوَكَّلْ عَلَى اللَّهِ", "And when you have decided, then rely upon Allah.", "سورة آل عمران — الآية 159", "Surah Al Imran 3:159"),
    Q("ayah", "إِنَّمَا يَخْشَى اللَّهَ مِنْ عِبَادِهِ الْعُلَمَاءُ", "Only those of His servants who have knowledge truly fear Allah.", "سورة فاطر — الآية 28", "Surah Fatir 35:28"),
    Q("ayah", "فَاسْتَبِقُوا الْخَيْرَاتِ", "So race to all that is good.", "سورة البقرة — الآية 148", "Surah Al-Baqarah 2:148"),
    Q("ayah", "وَلَا تَهِنُوا وَلَا تَحْزَنُوا وَأَنتُمُ الْأَعْلَوْنَ إِن كُنتُم مُّؤْمِنِينَ", "Do not weaken and do not grieve, for you will be superior if you are true believers.", "سورة آل عمران — الآية 139", "Surah Al Imran 3:139"),
    Q("ayah", "فَمَن يَعْمَلْ مِثْقَالَ ذَرَّةٍ خَيْرًا يَرَهُ", "So whoever does an atom's weight of good will see it.", "سورة الزلزلة — الآية 7", "Surah Az-Zalzalah 99:7"),
    Q("ayah", "إِنَّ اللَّهَ مَعَ الصَّابِرِينَ", "Indeed, Allah is with the patient.", "سورة البقرة — الآية 153", "Surah Al-Baqarah 2:153"),
    Q("ayah", "رَبِّ اشْرَحْ لِي صَدْرِي ۝ وَيَسِّرْ لِي أَمْرِي", "My Lord, expand for me my chest and ease for me my task.", "سورة طه — الآيتان 25 و26 (دعاء مناسب قبل الامتحان)", "Surah Ta-Ha 20:25-26 (a good dua before an exam)"),
    Q("ayah", "وَاتَّقُوا اللَّهَ ۖ وَيُعَلِّمُكُمُ اللَّهُ", "And be mindful of Allah, and Allah teaches you.", "سورة البقرة — الآية 282", "Surah Al-Baqarah 2:282"),
    Q("ayah", "وَالَّذِينَ جَاهَدُوا فِينَا لَنَهْدِيَنَّهُمْ سُبُلَنَا", "And those who strive for Us — We will surely guide them to Our ways.", "سورة العنكبوت — الآية 69", "Surah Al-Ankabut 29:69"),
    Q("ayah", "إِنَّ اللَّهَ لَا يُغَيِّرُ مَا بِقَوْمٍ حَتَّىٰ يُغَيِّرُوا مَا بِأَنفُسِهِمْ", "Indeed, Allah will not change the condition of a people until they change what is within themselves.", "سورة الرعد — الآية 11", "Surah Ar-Ra'd 13:11"),
    Q("ayah", "وَقُلِ اعْمَلُوا فَسَيَرَى اللَّهُ عَمَلَكُمْ وَرَسُولُهُ وَالْمُؤْمِنُونَ", "And say: Do [good] deeds, for Allah will see your deeds, and so will His Messenger and the believers.", "سورة التوبة — الآية 105", "Surah At-Tawbah 9:105"),

    /* ---------- أحاديث شريفة ---------- */
    Q("hadith", "إنما الأعمال بالنيات، وإنما لكل امرئ ما نوى.", "Actions are judged by intentions, and everyone will get what they intended.", "حديث شريف — متفق عليه", "Hadith — Bukhari & Muslim"),
    Q("hadith", "من سلك طريقًا يلتمس فيه علمًا سهّل الله له به طريقًا إلى الجنة.", "Whoever takes a path in search of knowledge, Allah makes easy for him a path to Paradise.", "حديث شريف — رواه مسلم", "Hadith — Sahih Muslim"),
    Q("hadith", "من يرد الله به خيرًا يفقهه في الدين.", "When Allah wants good for someone, He gives him understanding of the religion.", "حديث شريف — متفق عليه", "Hadith — Bukhari & Muslim"),
    Q("hadith", "خيركم من تعلم القرآن وعلمه.", "The best of you are those who learn the Quran and teach it.", "حديث شريف — رواه البخاري", "Hadith — Sahih al-Bukhari"),
    Q("hadith", "احرص على ما ينفعك، واستعن بالله ولا تعجز.", "Strive for what benefits you, seek Allah's help, and do not give up.", "حديث شريف — رواه مسلم", "Hadith — Sahih Muslim"),
    Q("hadith", "لا تحقرن من المعروف شيئًا.", "Never look down on any act of kindness, however small.", "حديث شريف — رواه مسلم", "Hadith — Sahih Muslim"),
    Q("hadith", "أحب الأعمال إلى الله أدومها وإن قل.", "The most beloved deeds to Allah are the most consistent ones, even if they are small.", "حديث شريف — متفق عليه", "Hadith — Bukhari & Muslim"),
    Q("hadith", "نعمتان مغبون فيهما كثير من الناس: الصحة والفراغ.", "There are two blessings that many people lose out on: health and free time.", "حديث شريف — رواه البخاري", "Hadith — Sahih al-Bukhari"),
    Q("hadith", "إذا مات ابن آدم انقطع عمله إلا من ثلاث: صدقة جارية، أو علم ينتفع به، أو ولد صالح يدعو له.", "When a person dies, his deeds end except three: ongoing charity, beneficial knowledge, or a righteous child who prays for him.", "حديث شريف — رواه مسلم", "Hadith — Sahih Muslim"),
    Q("hadith", "إن الله كتب الإحسان على كل شيء.", "Allah has prescribed excellence in everything.", "حديث شريف — رواه مسلم", "Hadith — Sahih Muslim"),
    Q("hadith", "من دلّ على خير فله مثل أجر فاعله.", "Whoever guides someone to good will have a reward like the one who does it.", "حديث شريف — رواه مسلم", "Hadith — Sahih Muslim"),
    Q("hadith", "إن الله يحب إذا عمل أحدكم عملًا أن يتقنه.", "Allah loves that when one of you does a job, he does it with excellence.", "حديث شريف — رواه البيهقي وحسّنه الألباني", "Hadith — Al-Bayhaqi (graded hasan)"),

    /* ---------- نصائح للمذاكرة ---------- */
    Q("advice", "العلم لا يُعطيك بعضه حتى تعطيه كلك.", "Knowledge won't give you part of itself until you give it all of you.", "نصيحة للمذاكرة", "Study tip"),
    Q("advice", "ابدأ بخطوة صغيرة، فالإنجاز الكبير يتكوّن من خطوات متتابعة.", "Start with a small step; big achievements are made of many small steps.", "نصيحة للمذاكرة", "Study tip"),
    Q("advice", "راجع قليلًا كل يوم، ولا تجعل المذاكرة تتراكم عليك.", "Review a little every day, and don't let your studying pile up.", "نصيحة للمذاكرة", "Study tip"),
    Q("advice", "الفهم أولًا، ثم الحفظ، ثم التدريب.", "Understanding first, then memorizing, then practice.", "نصيحة للمذاكرة", "Study tip"),
    Q("advice", "كل سؤال تخطئ فيه يعلّمك شيئًا جديدًا.", "Every question you get wrong teaches you something new.", "نصيحة للمذاكرة", "Study tip"),
    Q("advice", "لا تقارن بدايتك بمنتصف طريق شخص آخر.", "Don't compare your beginning to the middle of someone else's journey.", "نصيحة للمذاكرة", "Study tip"),
    Q("advice", "اكتب ما تتعلمه بيدك، فالكتابة تثبّت الفكرة.", "Write down what you learn by hand; writing makes ideas stick.", "نصيحة للمذاكرة", "Study tip"),
    Q("advice", "قسّم الدرس إلى أجزاء، وستجد الصعب أسهل مما توقعت.", "Break the lesson into parts, and the hard becomes easier than you expected.", "نصيحة للمذاكرة", "Study tip"),
    Q("advice", "التركيز لمدة قصيرة أفضل من ساعات طويلة بلا انتباه.", "Short, focused study beats long hours without attention.", "نصيحة للمذاكرة", "Study tip"),
    Q("advice", "اسأل عندما لا تفهم، فالسؤال بداية التقدم.", "Ask when you don't understand; a question is the start of progress.", "نصيحة للمذاكرة", "Study tip"),
    Q("advice", "احتفل بتقدمك الصغير، فهو دليل أنك تتحرك إلى الأمام.", "Celebrate your small progress; it proves you are moving forward.", "نصيحة للمذاكرة", "Study tip"),
    Q("advice", "لا تخف من الامتحان؛ اجعله فرصة تعرف بها ما تحتاج إلى مراجعته.", "Don't fear the exam; use it as a chance to find out what you need to review.", "نصيحة للمذاكرة", "Study tip"),
    Q("advice", "النوم الجيد جزء من المذاكرة وليس عكسها.", "Good sleep is part of studying, not the opposite of it.", "نصيحة للمذاكرة", "Study tip"),
    Q("advice", "أغلق المشتتات أثناء المذاكرة، وأعطِ وقتك لما ينفعك.", "Turn off distractions while studying and give your time to what benefits you.", "نصيحة للمذاكرة", "Study tip"),
    Q("advice", "التكرار الذكي أقوى من الحفظ السريع.", "Smart repetition is stronger than fast memorizing.", "نصيحة للمذاكرة", "Study tip"),
    Q("advice", "اجعل لكل جلسة مذاكرة هدفًا واضحًا.", "Give every study session a clear goal.", "نصيحة للمذاكرة", "Study tip"),
    Q("advice", "إذا تعبت، خذ استراحة قصيرة ثم عد إلى هدفك.", "If you get tired, take a short break, then come back to your goal.", "نصيحة للمذاكرة", "Study tip"),
    Q("advice", "النجاح لا يحتاج إلى الكمال، بل إلى الاستمرار.", "Success doesn't need perfection; it needs persistence.", "نصيحة للمذاكرة", "Study tip"),
    Q("advice", "ثقتك بنفسك تنمو كلما التزمت بخطتك.", "Your confidence grows every time you stick to your plan.", "نصيحة للمذاكرة", "Study tip"),
    Q("advice", "لا تجعل درجة واحدة تحدد نظرتك إلى نفسك.", "Don't let a single grade define how you see yourself.", "نصيحة للمذاكرة", "Study tip"),
    Q("advice", "كل يوم تذاكر فيه يقربك من هدفك.", "Every day you study brings you closer to your goal.", "نصيحة للمذاكرة", "Study tip"),
    Q("advice", "تقدمك الحقيقي يظهر في الأشياء التي أصبحت تفعلها بسهولة.", "Your real progress shows in the things that have become easy for you.", "نصيحة للمذاكرة", "Study tip"),
    Q("advice", "ضع هاتفك بعيدًا أثناء جلسة التركيز.", "Keep your phone away during a focus session.", "نصيحة للمذاكرة", "Study tip"),
    Q("advice", "المذاكرة المنتظمة تصنع فرقًا أكبر من الحماس المؤقت.", "Regular studying makes a bigger difference than temporary enthusiasm.", "نصيحة للمذاكرة", "Study tip"),
    Q("advice", "اكتب ملخصًا قصيرًا بعد كل درس.", "Write a short summary after every lesson.", "نصيحة للمذاكرة", "Study tip"),
    Q("advice", "علّم غيرك ما فهمته، وستكتشف أنك فهمته أكثر.", "Teach others what you understood, and you'll find you understand it even better.", "نصيحة للمذاكرة", "Study tip"),
    Q("advice", "لا تؤجل سؤال اليوم إلى نهاية الأسبوع.", "Don't postpone today's question until the end of the week.", "نصيحة للمذاكرة", "Study tip"),
    Q("advice", "الهدف الواضح يجعل وقت المذاكرة أكثر قيمة.", "A clear goal makes your study time more valuable.", "نصيحة للمذاكرة", "Study tip"),
    Q("advice", "كن صبورًا مع نفسك، فالتعلم رحلة.", "Be patient with yourself; learning is a journey.", "نصيحة للمذاكرة", "Study tip"),
    Q("advice", "ابدأ الآن بما تستطيع، فالبداية أهم من انتظار الوقت المثالي.", "Start now with what you can; beginning matters more than waiting for the perfect time.", "نصيحة للمذاكرة", "Study tip"),
    Q("advice", "استمر، حتى لو كان تقدمك بطيئًا؛ البطء مع الاستمرار يصل.", "Keep going, even if your progress is slow; slow and steady still arrives.", "نصيحة للمذاكرة", "Study tip"),
    Q("advice", "اجعل علمك سببًا في نفع نفسك ومن حولك.", "Let your knowledge benefit you and the people around you.", "نصيحة للمذاكرة", "Study tip"),
    Q("advice", "كل مراجعة جديدة تجعل ذاكرتك أقوى.", "Every new review makes your memory stronger.", "نصيحة للمذاكرة", "Study tip"),
    Q("advice", "حدد مادة واحدة لكل جلسة، ولا تشتت نفسك بين مواد كثيرة.", "Pick one subject per session instead of scattering yourself across many.", "نصيحة للمذاكرة", "Study tip"),
    Q("advice", "ذاكر المادة الأصعب أول اليوم عندما يكون ذهنك صافيًا.", "Study the hardest subject first, while your mind is fresh.", "نصيحة للمذاكرة", "Study tip"),
    Q("advice", "ضع جدولًا أسبوعيًا بسيطًا والتزم به.", "Make a simple weekly schedule and stick to it.", "نصيحة للمذاكرة", "Study tip"),
    Q("advice", "اختبر نفسك كثيرًا؛ الاسترجاع من الذاكرة أقوى من إعادة القراءة.", "Quiz yourself often; recalling from memory is stronger than rereading.", "نصيحة للمذاكرة", "Study tip"),
    Q("advice", "ذاكر في مكان مضيء ومرتب، واجعل زجاجة الماء بجانبك.", "Study in a bright, tidy place, and keep a bottle of water beside you.", "نصيحة للمذاكرة", "Study tip"),
    Q("advice", "نظّم ملاحظاتك بعناوين وألوان تساعدك على المراجعة السريعة.", "Organize your notes with headings and colors for quick review.", "نصيحة للمذاكرة", "Study tip"),
    Q("advice", "خطأ اليوم في التمرين أفضل من خطأ غدًا في الامتحان.", "A mistake today in practice is better than a mistake tomorrow in the exam.", "نصيحة للمذاكرة", "Study tip"),
    Q("advice", "اطلب المساعدة مبكرًا، ولا تنتظر حتى تتراكم الأسئلة.", "Ask for help early; don't wait until your questions pile up.", "نصيحة للمذاكرة", "Study tip"),
    Q("advice", "كافئ نفسك بعد إنهاء هدفك لتحافظ على حماسك.", "Reward yourself after reaching a goal to keep your motivation.", "نصيحة للمذاكرة", "Study tip"),
    Q("advice", "المذاكرة مع زميل مجتهد تضاعف الفائدة، بشرط أن تبقيا على الهدف.", "Studying with a hard-working friend multiplies the benefit, as long as you both stay on target.", "نصيحة للمذاكرة", "Study tip"),

    /* ---------- نصائح للامتحان ---------- */
    Q("exam", "اقرأ السؤال بهدوء قبل أن تختار الإجابة.", "Read the question calmly before you choose the answer.", "نصيحة للامتحان", "Exam tip"),
    Q("exam", "ابدأ بالأسئلة التي تعرفها، ثم ارجع إلى الأسئلة الأصعب.", "Start with the questions you know, then return to the harder ones.", "نصيحة للامتحان", "Exam tip"),
    Q("exam", "راجع أخطاءك بعد الامتحان، فهي خريطة طريقك القادمة.", "Review your mistakes after the exam; they are the map for your next steps.", "نصيحة للامتحان", "Exam tip"),
    Q("exam", "لا تترك إجابة بلا محاولة إذا كنت تستطيع التفكير فيها.", "Don't leave an answer blank if you can think it through.", "نصيحة للامتحان", "Exam tip"),
    Q("exam", "نظّم وقتك بين القراءة والحل والمراجعة.", "Divide your time between reading, solving, and reviewing.", "نصيحة للامتحان", "Exam tip"),
    Q("exam", "إذا لم تعرف إجابة سؤال، علّم عليه وانتقل، ثم عد إليه.", "If you don't know an answer, mark it, move on, and come back to it.", "نصيحة للامتحان", "Exam tip"),
    Q("exam", "راجع إجاباتك قبل التسليم، فكثير من الأخطاء تُكتشف في المراجعة.", "Review your answers before submitting; many mistakes are found during review.", "نصيحة للامتحان", "Exam tip"),
    Q("exam", "تنفّس بعمق قبل أن تبدأ، فالهدوء يساعدك على التذكّر.", "Take a deep breath before you start; calm helps you remember.", "نصيحة للامتحان", "Exam tip"),
    Q("exam", "انتبه للكلمات المفتاحية في السؤال مثل: ليس، كل، دائمًا.", "Watch for key words in the question such as not, all, and always.", "نصيحة للامتحان", "Exam tip"),

    /* ---------- نصائح للإنجليزية ---------- */
    Q("english", "تعلم كلمة جديدة واستخدمها في جملة من عندك.", "Learn a new word and use it in a sentence of your own.", "نصيحة للإنجليزية", "English tip"),
    Q("english", "استمع للإنجليزية يوميًا ولو لدقائق قليلة.", "Listen to English every day, even for a few minutes.", "نصيحة للإنجليزية", "English tip"),
    Q("english", "اقرأ بصوت عالٍ لتقوي النطق والثقة.", "Read aloud to strengthen your pronunciation and confidence.", "نصيحة للإنجليزية", "English tip"),
    Q("english", "لا تنتظر أن تعرف كل الكلمات حتى تفهم المعنى العام.", "Don't wait to know every word before you understand the general meaning.", "نصيحة للإنجليزية", "English tip"),
    Q("english", "استخدم الخطأ كمعلم، لا كسبب للتوقف.", "Use a mistake as a teacher, not as a reason to stop.", "نصيحة للإنجليزية", "English tip"),
    Q("english", "خصص وقتًا لمراجعة الكلمات القديمة مع الكلمات الجديدة.", "Set aside time to review old words along with new ones.", "نصيحة للإنجليزية", "English tip"),
    Q("english", "اكتب كل كلمة جديدة في دفتر صغير مع جملة تشرحها.", "Write each new word in a small notebook with a sentence that explains it.", "نصيحة للإنجليزية", "English tip"),
    Q("english", "شاهد فيديو قصيرًا بالإنجليزية مع الترجمة، ثم أعده بدونها.", "Watch a short English video with subtitles, then watch it again without them.", "نصيحة للإنجليزية", "English tip"),
    Q("english", "تكلّم بالإنجليزية ولو مع نفسك، فالتدريب يبني الطلاقة.", "Speak English even to yourself; practice builds fluency.", "نصيحة للإنجليزية", "English tip"),
    Q("english", "تعلّم الكلمات داخل جمل، لا كلمات منفصلة.", "Learn words inside sentences, not as separate words.", "نصيحة للإنجليزية", "English tip"),
    Q("english", "اقرأ قصة قصيرة بالإنجليزية كل أسبوع.", "Read one short English story every week.", "نصيحة للإنجليزية", "English tip"),
    Q("english", "راجع قاعدة الدرس بأمثلة من عندك، فالمثال يثبّت القاعدة.", "Review each grammar rule with examples of your own; an example makes the rule stick.", "نصيحة للإنجليزية", "English tip"),

    /* ---------- كلمات تحفيز ---------- */
    Q("motive", "أنت قادر على التعلم ما دمت مستمرًا في المحاولة.", "You are capable of learning as long as you keep trying.", "رسالة تحفيزية", "Motivation"),
    Q("motive", "كل خبير كان يومًا ما مبتدئًا.", "Every expert was once a beginner.", "كلمة تحفيز", "Motivation"),
    Q("motive", "الحلم وحده لا يكفي؛ الخطة والعمل يحوّلانه إلى حقيقة.", "A dream alone isn't enough; a plan and hard work turn it into reality.", "كلمة تحفيز", "Motivation"),
    Q("motive", "لا يهم أن تكون بطيئًا ما دمت لا تتوقف.", "It doesn't matter how slowly you go, as long as you don't stop.", "كلمة تحفيز", "Motivation"),
    Q("motive", "النجاح مجموع جهود صغيرة تتكرر كل يوم.", "Success is the sum of small efforts repeated day after day.", "كلمة تحفيز", "Motivation"),
    Q("motive", "ما تفعله اليوم يصنع من ستكون غدًا.", "What you do today shapes who you will be tomorrow.", "كلمة تحفيز", "Motivation"),
    Q("motive", "التعب مؤقت، والنتيجة تبقى.", "Tiredness is temporary; the result lasts.", "كلمة تحفيز", "Motivation"),
    Q("motive", "لا تستسلم الآن؛ أنت أقرب مما تظن.", "Don't give up now; you are closer than you think.", "كلمة تحفيز", "Motivation"),
    Q("motive", "الانضباط يوصلك إلى حيث لا يوصلك الحماس وحده.", "Discipline takes you where motivation alone cannot.", "كلمة تحفيز", "Motivation"),
    Q("motive", "الفشل خطوة على طريق النجاح، وليس نهاية الطريق.", "Failure is a step on the road to success, not the end of the road.", "كلمة تحفيز", "Motivation"),
    Q("motive", "ثق في نفسك، فنصف الطريق ثقة.", "Believe in yourself; half the journey is confidence.", "كلمة تحفيز", "Motivation"),
    Q("motive", "ابدأ من حيث أنت، واستخدم ما لديك، وافعل ما تستطيع.", "Start where you are. Use what you have. Do what you can.", "يُنسب إلى آرثر آش", "Attributed to Arthur Ashe"),
    Q("motive", "التعليم أقوى سلاح يمكنك استخدامه لتغيير العالم.", "Education is the most powerful weapon you can use to change the world.", "يُنسب إلى نيلسون مانديلا", "Attributed to Nelson Mandela"),
    Q("motive", "الاستثمار في المعرفة يعطي أفضل العوائد.", "An investment in knowledge pays the best interest.", "يُنسب إلى بنجامين فرانكلين", "Attributed to Benjamin Franklin"),
  ];

  /* ================= الصورة الشخصية ================= */
  const AV_KEY = (id) => "shadynasr-avatar:" + id;
  // نقبل بس صورة JPEG مضغوطة (Base64) عشان أي قيمة غريبة من قاعدة البيانات ما تتحطّش في الـ CSS
  const validPhoto = (u) => typeof u === "string" && u.length < 250000 && /^data:image\/(?:jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(u);
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

  /* الضغط بقى في SNAuth.compressAvatar: مربع 128x128 WebP ≤ 8KB (يقبل أي صيغة صور بيدعمها المتصفح) */
  async function fileToAvatar(file) {
    if (!window.SNAuth || !SNAuth.compressAvatar) throw new Error("NO_TOOLS");
    return SNAuth.compressAvatar(file);
  }

  async function savePhoto(dataUrl) {
    const s = getSession();
    if (!s) return;
    try {
      if (dataUrl) localStorage.setItem(AV_KEY(s.id), dataUrl);
      else localStorage.removeItem(AV_KEY(s.id));
    } catch { /* مساحة التخزين المحلي ممتلئة — مش مشكلة */ }
    if (!window.SNAuth) throw new Error("NO_REMOTE");
    await SNAuth.saveUserPhoto(s.id, dataUrl || null); // userPhotos/{id} + users/{id}.photoV
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
      // الجديد: userPhotos/{id} حسب photoV؛ القديم (قبل الترحيل): photoURL جوه users
      const remote = u && u.photoV ? await SNAuth.fetchUserPhoto(s.id, u.photoV) : (u && u.photoURL);
      if (validPhoto(remote)) {
        myPhoto = remote;
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
      /* طلاب صفّه من publicProfiles (كاش 3 دقايق في SNAuth) — بنرتّب منهم أول 5 بالنقاط أو بالوقت على المنصة */
      const users = await SNAuth.fetchUsersByGrade(s.grade);
      state.board = (users || []).filter((u) => u && u.role !== "admin");
    } catch {
      try { state.board = SNAuth.fetchGradeBoard ? ((await SNAuth.fetchGradeBoard(s.grade)) || []) : []; }
      catch { state.board = []; }
    }
    renderHome();
  }

  function boardTime(sec) {
    const v = Math.max(0, Math.floor(Number(sec) || 0));
    const hh = Math.floor(v / 3600), mm = Math.floor((v % 3600) / 60);
    return hh ? hh + ((curLang() === "en") ? " h " : " س ") + mm + ((curLang() === "en") ? " m" : " د") : mm + ((curLang() === "en") ? " m" : " د");
  }
  function topBoard(mode) {
    const pts = (u) => Number(u.points) || 0, secs = (u) => Number(u.learningSeconds) || 0;
    return state.board.slice().sort((a, b) => mode === "time"
      ? (secs(b) - secs(a) || pts(b) - pts(a)) : (pts(b) - pts(a) || secs(b) - secs(a))).slice(0, 5);
  }
  function setBoardMode(mode, fromEvent) {
    if (mode !== "points" && mode !== "time") return;
    if (state.boardMode === mode) return;
    state.boardMode = mode;
    renderHome();
    if (!fromEvent) window.dispatchEvent(new CustomEvent("sn:board-mode", { detail: { mode } }));
  }
  window.addEventListener("sn:board-mode", (e) => setBoardMode(e.detail && e.detail.mode, true));

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
      /* المرحلة 4: الرئيسية بتحمّل studentSummary بس (~1KB). الكاش بيظهر فورًا ثم بيتحدّث. */
      const fromSummary = (sum) => (sum && Array.isArray(sum.l) ? sum.l.map((x) => ({ key: x.k, ts: x.ts || 0, title: x.t, value: x.d })) : null);
      const cached = SNAuth.peekStudentSummary ? fromSummary(SNAuth.peekStudentSummary(s.id)) : null;
      if (cached && state.grades == null) { state.grades = cached.slice(0, 4); renderHome(); }
      const fresh = SNAuth.getStudentSummary ? fromSummary(await SNAuth.getStudentSummary(s.id)) : null;
      if (fresh) { state.grades = fresh.slice(0, 4); renderHome(); return; }
      /* لسه مفيش ملخص (قبل تشغيل backfillSummaries): آخر 4 درجات من كل قسم بدل السجل كله */
      const all = SNAuth.fetchRecentGrades ? await SNAuth.fetchRecentGrades(s.id, 4) : await SNAuth.fetchGrades(s.id);
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

  let quoteShift = 0;
  try { quoteShift = Number(sessionStorage.getItem("shadynasr-quote-shift")) || 0; } catch (e) { /* لا شيء */ }

  /* جملة اليوم: بتتغيّر كل يوم لوحدها بترتيب متنوّع (آية / حديث / نصيحة...)، وزرار ↻ يجيب اللي بعدها */
  function quoteIndex() {
    const n = STUDY_QUOTES.length;
    const step = [17, 19, 23, 29, 31, 37, 41].find((s) => n % s !== 0) || 1;
    const d = new Date();
    const day = Math.floor(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 86400000);
    return (((day + quoteShift) * step) % n + n) % n;
  }

  function renderStudyQuote() {
    const box = $("#homeQuote");
    const text = $("#homeQuoteText");
    const source = $("#homeQuoteSource");
    if (!box || !text || !source) return;
    const q = STUDY_QUOTES[quoteIndex()];
    const lab = QUOTE_LABELS[q.type] || QUOTE_LABELS.advice;

    box.setAttribute("data-no-i18n", "");     // الكارت بالعربي والإنجليزي أصلًا — ما نترجمهوش تاني
    box.setAttribute("data-qtype", q.type);
    const label = box.querySelector(".home-quote__label");
    if (label) label.textContent = lab[0] + " · " + lab[1];

    text.textContent = q.ar;
    text.setAttribute("dir", "rtl");
    text.setAttribute("lang", "ar");

    let en = $("#homeQuoteTextEn");
    if (!en) {
      en = document.createElement("p");
      en.id = "homeQuoteTextEn";
      en.className = "home-quote__en";
      en.setAttribute("dir", "ltr");
      en.setAttribute("lang", "en");
      text.insertAdjacentElement("afterend", en);
    }
    en.textContent = q.en;
    source.textContent = q.srcAr + " · " + q.srcEn;

    if (!$("#homeQuoteNext")) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.id = "homeQuoteNext";
      btn.className = "home-quote__next";
      btn.setAttribute("aria-label", "Next quote");
      btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 11a8 8 0 1 0-2.3 5.7"/><path d="M20 4v7h-7"/></svg>';
      btn.addEventListener("click", () => {
        quoteShift += 1;
        try { sessionStorage.setItem("shadynasr-quote-shift", String(quoteShift)); } catch (e) { /* لا شيء */ }
        renderStudyQuote();
      });
      box.appendChild(btn);
    }
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

    // 2) لوحة الصدارة (أول 5 + زرار نقاط / وقت)
    let boardBody;
    const mode = state.boardMode;
    const toggle = '<span class="home-toggle" role="tablist">' +
      ["points", "time"].map((m) => '<span class="home-toggle__btn' + (mode === m ? " is-active" : "") + '" role="tab" tabindex="0" aria-selected="' + (mode === m) + '" data-board-mode="' + m + '">' + esc(tr(m === "points" ? "board_points" : "board_time")) + "</span>").join("") + "</span>";
    if (state.board == null) boardBody = '<span class="home-tile__empty">' + esc(tr("tile_loading")) + '</span>';
    else if (!state.board.length) boardBody = '<span class="home-tile__empty">' + esc(tr("tile_board_empty")) + '</span>';
    else boardBody = toggle + topBoard(mode).map((u, i) => {
      const photo = s && u.id === s.id && myPhoto ? myPhoto : u.photoURL;
      const ok = validPhoto(photo);
      return '<span class="home-row"><span class="home-row__rank">' + (i + 1) + '</span>' +
        '<span class="dash-leaderboard__avatar"' + (ok ? ' data-has-photo style="background-image:url(&quot;' + photo + '&quot;)"' : (u.photoV ? ' data-av-uid="' + esc(u.id) + '" data-av-v="' + esc(u.photoV) + '"' : '')) + '>' + esc(initial(u.fullName)) + '</span>' +
        '<span class="home-row__name">' + esc(u.fullName) + '</span>' +
        '<span class="home-row__value">' + (mode === "time" ? esc(boardTime(u.learningSeconds)) : (Number(u.points) || 0) + ' ' + esc(tr("pts"))) + '</span></span>';
    }).join("");
    if (state.board != null && !state.board.length) boardBody = toggle + boardBody;

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

    /* زرار نقاط / وقت جوه مربع الصدارة: بيبدّل النوع من غير ما يفتح الصفحة */
    $("#homeGrid").addEventListener("click", (e) => {
      const b = e.target.closest && e.target.closest("[data-board-mode]");
      if (!b) return;
      e.stopPropagation();
      setBoardMode(b.dataset.boardMode);
    }, true);
    $("#homeGrid").addEventListener("keydown", (e) => {
      const b = e.target.closest && e.target.closest("[data-board-mode]");
      if (!b || (e.key !== "Enter" && e.key !== " ")) return;
      e.preventDefault(); e.stopPropagation();
      setBoardMode(b.dataset.boardMode);
    });
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
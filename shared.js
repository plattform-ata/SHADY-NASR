/* ==========================================================================
   shared.js — logica UI condivisa (tema, lingua, form password, auth steps)
   Le chiamate reali a Firebase / EmailJS vanno agganciate dove indicato TODO.
   ========================================================================== */

/* --- لو المستخدم مسجّل دخول بالفعل وفتح الصفحة الرئيسية (index.html)، نوجّهه فورًا
   للوحة تحكمه (studenti.html أو admin.html) بدل ما يشوف صفحة الهبوط تاني في كل مرة.
   الفحص بيتنفّذ فورًا (مش جوه DOMContentLoaded) عشان يحصل أسرع ما يمكن ويقلل ومضة
   ظهور صفحة index قبل التحويل. */
/* حماية الصفحات اللي قبل الدخول بقت في auth.js */

/* --- Tema chiaro/scuro --- */
function initTheme() {
  const root = document.documentElement;
  const saved = localStorage.getItem("theme");
  if (saved) root.setAttribute("data-theme", saved);

  const btns = document.querySelectorAll(".theme-btn");
  if (!btns.length) return;
  btns.forEach((btn) => {
    if (btn.dataset.themeBound) return; // منع الربط المزدوج (كان بيخلّي الزرار يبدّل مرتين ويرجع زي ما كان)
    btn.dataset.themeBound = "1";
    btn.addEventListener("click", () => {
      const next = root.getAttribute("data-theme") === "dark" ? "light" : "dark";
      root.setAttribute("data-theme", next);
      localStorage.setItem("theme", next);
    });
  });
}

/* --- Lingua AR/EN: dizionario i18n + swap testi/dir/lang --- */
const I18N = {
  ar: {
    skip_link: "تخطى إلى المحتوى",
    nav_home: "الرئيسية",
    nav_prep: "الإعدادية",
    nav_secondary: "الثانوية",
    nav_teacher: "الأستاذ",
    lang_aria: "تغيير اللغة",
    theme_aria: "تغيير المظهر",
    menu_theme_title: "تغيير المظهر",
    menu_theme_sub: "فاتح أو غامق",
    menu_lang_title: "تغيير اللغة",
    login_btn: "تسجيل الدخول",
    start_free_btn: "ابدأ مجانًا",
    hero_eyebrow: "منصة تعليم اللغة الإنجليزية",
    hero_title: 'اتعلم إنجليزي صح مع <em>الأستاذ Shady Nasr</em>',
    hero_desc: "دروس تفاعلية لكل مراحل الإعدادي والثانوي، بمتابعة مباشرة وتمارين وامتحانات تتابع مستواك خطوة بخطوة.",
    hero_cta_start: "ابدأ دلوقتي",
    hero_cta_view: "شوف الفصول الدراسية",
    hero_card_title: "متابعة أسبوعية لمستواك",
    hero_card_desc: "كل ما تخلّص درس وتحل الامتحان بتاعه، بنحدّثلك تقدمك أول بأول",
    progress_grammar: "القواعد",
    progress_vocab: "المفردات",
    progress_listening: "الاستماع",
    video_play_aria: "تشغيل الفيديو",
    video_badge: "فيديو تعريفي",
    teacher_eyebrow: "مين الأستاذ بتاعك",
    teacher_role: "مدرّس لغة إنجليزية — إعدادي وثانوي",
    teacher_bio: "بخبرة سنين في تبسيط قواعد اللغة الإنجليزية للطلبة، وبناء منهج تفاعلي يوصل الفكرة من غير تعقيد، مع متابعة لصفحة كل طالب لحد ما يوصل لمستوى ممتاز.",
    badge_1: "منهج مبسّط لكل المراحل الدراسية",
    badge_2: "فيديوهات شرح ودروس PDF لكل درس",
    badge_3: "امتحانات تفاعلية ومتابعة أسبوعية",
    join_btn: "انضم للمنصة",
    stats_eyebrow: "بالأرقام",
    stats_title: "منصة بيثق فيها آلاف الطلبة",
    stat_students: "طالب مسجّل",
    stat_success: "نسبة نجاح الطلبة",
    stat_experience: "سنوات خبرة",
    stat_satisfaction: "نسبة رضا أولياء الأمور",
    prep_eyebrow: "المرحلة الإعدادية",
    choose_grade_title: "اختار صفك الدراسي",
    prep_desc: "كل صف فيه دروس وفيديوهات وامتحانات مخصّصة — دوس على صفك عشان تشوف المحتوى",
    prep1_title: "الصف الأول الإعدادي",
    prep1_desc: "الأساسيات: القواعد والمفردات الأولى في رحلتك مع الإنجليزي",
    prep2_title: "الصف الثاني الإعدادي",
    prep2_desc: "قواعد أعمق وقصص قراءة تبني حصيلتك اللغوية",
    prep3_title: "الصف الثالث الإعدادي",
    prep3_desc: "مراجعة شاملة واستعداد كامل لامتحان الشهادة الإعدادية",
    view_lessons: "شوف الدروس",
    secondary_eyebrow: "المرحلة الثانوية",
    secondary_desc: "نفس نظام الدروس والامتحانات، بمستوى مناسب لكل سنة ثانوي",
    sec1_title: "الصف الأول الثانوي",
    sec1_desc: "بداية مرحلة جديدة بمستوى أعلى من القواعد والتعبير",
    sec2_title: "الصف الثاني الثانوي",
    sec2_desc: "تعميق المهارات استعدادًا للسنة النهائية",
    sec3_title: "الصف الثالث الثانوي",
    sec3_desc: "مراجعة نهائية شاملة واستعداد كامل للامتحان النهائي",
    footer_text: "© 2026 Shady Nasr English Platform. كل الحقوق محفوظة.",
    footer_desc: "تم تصميم هذه المنصة عشان تساعد الطالب على إتقان اللغة الإنجليزية في كل مراحل الإعدادي والثانوي.",
    footer_pages_title: "الصفحات",
    footer_help: "المساعدة",
    footer_register: "انشاء حساب جديد",
    footer_social_title: "السوشيال ميديا",
    footer_facebook: "فيسبوك",
    footer_instagram: "انستجرام",
    footer_youtube: "يوتيوب",

    promo_eyebrow: "مواعيد الحصص والسناتر",
    promo_title: "حمل جدول المواعيد الكامل أو استعرض المواعيد المتاحة",
    promo_desc: "تعرف على أوقات وأماكن التواجد في جميع السناتر لكل المراحل الدراسية.",
    promo_btn_schedule: "جدول المواعيد",
    promo_btn_contact: "حجز واستفسار",
    install_app_btn: "حمّل التطبيق",
    back_home: "الرئيسية",

    schedule_title: "مواعيد الصفوف الدراسية",
    schedule_desc: "يمكنك استعراض الجدول، اضغط عليه لتكبيره أو حمله مباشرة على جهازك",
    schedule_file_name: "جدول مواعيد مستر شادي نصر",
    schedule_download_btn: "تحميل جدول المواعيد PDF / صورة",
    lightbox_close_aria: "إغلاق",
    centers_schedule_title: "مواعيد كل سنتر على حدة",
    centers_schedule_desc: "اختار السنتر القريب منك وشوف الصفوف والمواعيد المتاحة فيه",

    contact_eyebrow: "لنبدأ بالتواصل المباشر",
    contact_title: "لديك استفسار؟<br />تواصل معنا بسهولة.",
    contact_desc: "شاركنا استفسارك أو المرحلة الدراسية المهتم بها، وسنرد عليك بكافة التفاصيل والمواعيد المتاحة في السناتر.",
    field_fullname_placeholder: "الاسم بالكامل",
    field_inquiry: "أخبرنا عن الاستفسار",
    field_inquiry_placeholder: "ما الذي تريد الاستفسار عنه؟ (السناتر، المواعيد، الأونلاين...)",
    contact_submit_btn: "إرسال التفاصيل عبر واتساب",
    contact_submit_hint: "بالضغط على إرسال ستفتح رسالة واتساب جاهزة بالتفاصيل اللي أدخلتها.",
    contact_wa_greeting: "السلام عليكم، أنا",
    contact_wa_grade: "الصف الدراسي",
    contact_wa_inquiry: "الاستفسار",

    page_title_login: "تسجيل الدخول — Shady Nasr English Platform",
    auth_title_login: "أهلاً بيك تاني",
    auth_title_register: "ابدأ رحلتك معنا",
    auth_subtitle: "سجّل دخولك عشان تكمّل دروسك",
    auth_tab_login: "تسجيل الدخول",
    auth_tab_register: "إنشاء حساب",
    field_email: "البريد الإلكتروني",
    field_password: "كلمة المرور",
    field_fullname: "الاسم بالكامل",
    field_age: "السن",
    field_grade: "الصف الدراسي",
    field_gender: "النوع",
    gender_male: "ذكر",
    gender_female: "أنثى",
    option_choose_grade: "اختر الصف",
    hint_min_chars: "6 أحرف على الأقل",
    btn_continue: "متابعة",
    btn_create_account: "إنشاء الحساب",
    btn_back: "رجوع",
    btn_confirm_code: "تأكيد الكود",
    btn_resend: "إعادة الإرسال",
    otp_title: "أدخل كود التحقق",
    otp_subtitle_login: "بعتنالك كود مكوّن من 6 أرقام على إيميلك",
    otp_subtitle_register: "أكّد إيميلك بالكود اللي وصلك عشان تفعّل حسابك",
    otp_not_received: "مستلمتش الكود؟",
    otp_resend_success: "تمت إعادة الإرسال",
    otp_spam_hint: "لو الكود مجاش، دوّر عليه في فولدر الرسائل غير المرغوب فيها (Spam)، لأن كود تسجيل الدخول ممكن يوصل هناك بس.",
    forgot_link: "نسيت كلمة المرور؟",
    forgot_title: "استعادة كلمة المرور",
    forgot_subtitle: "اكتب الإيميل اللي مسجّل بيه وهنبعتلك كود تحقق",
    forgot_send_code: "إرسال الكود",
    forgot_otp_subtitle: "بعتنالك كود مكوّن من 6 أرقام على إيميلك لاستعادة كلمة المرور",
    forgot_spam_hint: "لو الكود مجاش، دوّر عليه في فولدر الرسائل غير المرغوب فيها (Spam).",
    forgot_new_title: "كلمة المرور الجديدة",
    forgot_new_subtitle: "اكتب كلمة المرور الجديدة وأكّدها",
    field_new_password: "كلمة المرور الجديدة",
    field_confirm_password: "تأكيد كلمة المرور",
    btn_save_password: "حفظ ودخول المنصة",
    reset_err_not_found: "الإيميل ده مش مسجّل عندنا على المنصة",
    reset_err_admin: "الحساب ده مش متاح له استعادة كلمة المرور من هنا",
    reset_err_send: "تعذر إرسال الكود، حاول تاني بعد لحظات",
    reset_err_code_len: "اكتب الكود كامل (6 أرقام)",
    reset_err_expired: "الكود منتهي الصلاحية، اضغط إعادة الإرسال",
    reset_err_wrong: "الكود غلط، حاول تاني",
    reset_err_too_many: "محاولات كتير غلط. اطلب كود جديد بالضغط على إعادة الإرسال",
    reset_err_no_otp: "مفيش كود صالح، اضغط إعادة الإرسال",
    reset_err_short: "كلمة المرور لازم تكون 6 أحرف على الأقل",
    reset_err_mismatch: "كلمتا المرور مش متطابقتين",
    reset_err_generic: "حصل خطأ، حاول تاني",
    brand_update_msg: "فيه تحديث جديد للمنصة (الاسم / اللوجو)",
    brand_update_btn: "تحديث",
    success_title: "تم تسجيل الدخول بنجاح",
    success_subtitle: "جاري تحويلك للمنصة...",
    aria_show_password: "إظهار كلمة المرور",
  },
  en: {
    skip_link: "Skip to content",
    nav_home: "Home",
    nav_prep: "Prep Stage",
    nav_secondary: "Secondary Stage",
    nav_teacher: "Teacher",
    lang_aria: "Change language",
    theme_aria: "Toggle theme",
    menu_theme_title: "Toggle theme",
    menu_theme_sub: "Light or dark",
    menu_lang_title: "Change language",
    login_btn: "Log In",
    start_free_btn: "Start Free",
    hero_eyebrow: "English Language Learning Platform",
    hero_title: 'Learn English right with <em>Mr. Shady Nasr</em>',
    hero_desc: "Interactive lessons for every prep and secondary stage, with live tracking, exercises, and exams that follow your progress step by step.",
    hero_cta_start: "Get Started Now",
    hero_cta_view: "View the Classes",
    hero_card_title: "Weekly Progress Tracking",
    hero_card_desc: "As soon as you finish a lesson and its exam, we update your progress right away",
    progress_grammar: "Grammar",
    progress_vocab: "Vocabulary",
    progress_listening: "Listening",
    video_play_aria: "Play video",
    video_badge: "Intro Video",
    teacher_eyebrow: "Meet Your Teacher",
    teacher_role: "English Language Teacher — Prep & Secondary",
    teacher_bio: "With years of experience simplifying English grammar for students, building an interactive curriculum that delivers ideas without complexity, and tracking every student's page until they reach an excellent level.",
    badge_1: "Simplified curriculum for every school stage",
    badge_2: "Explanation videos and PDF lessons for every lesson",
    badge_3: "Interactive exams and weekly tracking",
    join_btn: "Join the Platform",
    stats_eyebrow: "By the Numbers",
    stats_title: "A platform trusted by thousands of students",
    stat_students: "Registered Students",
    stat_success: "Student Success Rate",
    stat_experience: "Years of Experience",
    stat_satisfaction: "Parent Satisfaction Rate",
    prep_eyebrow: "Prep Stage",
    choose_grade_title: "Choose Your Grade",
    prep_desc: "Every grade has dedicated lessons, videos, and exams — tap your grade to see the content",
    prep1_title: "1st Prep Grade",
    prep1_desc: "The basics: grammar and your first vocabulary in your English journey",
    prep2_title: "2nd Prep Grade",
    prep2_desc: "Deeper grammar and reading stories that build your vocabulary",
    prep3_title: "3rd Prep Grade",
    prep3_desc: "Comprehensive review and full preparation for the prep certificate exam",
    view_lessons: "View Lessons",
    secondary_eyebrow: "Secondary Stage",
    secondary_desc: "The same lesson and exam system, at a level suited to every secondary year",
    sec1_title: "1st Secondary Grade",
    sec1_desc: "The start of a new stage with a higher level of grammar and expression",
    sec2_title: "2nd Secondary Grade",
    sec2_desc: "Deepening skills in preparation for the final year",
    sec3_title: "3rd Secondary Grade",
    sec3_desc: "Final comprehensive review and full preparation for the final exam",
    footer_text: "© 2026 Shady Nasr English Platform. All rights reserved.",
    footer_desc: "This platform is designed to help students master English across every prep and secondary stage.",
    footer_pages_title: "Pages",
    footer_help: "Help",
    footer_register: "Create New Account",
    footer_social_title: "Social Media",
    footer_facebook: "Facebook",
    footer_instagram: "Instagram",
    footer_youtube: "YouTube",

    promo_eyebrow: "Class & Center Schedule",
    promo_title: "Download the Full Schedule or Browse Available Times",
    promo_desc: "See the times and locations of every center, for all school stages.",
    promo_btn_schedule: "View Schedule",
    promo_btn_contact: "Book & Inquire",
    install_app_btn: "Install App",
    back_home: "Home",

    schedule_title: "Class Schedule",
    schedule_desc: "Browse the schedule — click it to zoom in or download it to your device",
    schedule_file_name: "Mr. Shady Nasr's Schedule",
    schedule_download_btn: "Download Schedule PDF / Image",
    lightbox_close_aria: "Close",
    centers_schedule_title: "Schedule for Each Center",
    centers_schedule_desc: "Pick the center closest to you and see its grades and available times",

    contact_eyebrow: "Let's Talk Directly",
    contact_title: "Have a question?<br />Get in touch easily.",
    contact_desc: "Tell us what you'd like to know or which grade you're interested in, and we'll reply with all the details and available times at our centers.",
    field_fullname_placeholder: "Full name",
    field_inquiry: "Tell us about your inquiry",
    field_inquiry_placeholder: "What would you like to ask about? (centers, schedule, online classes...)",
    contact_submit_btn: "Send via WhatsApp",
    contact_submit_hint: "Tapping send will open a ready-made WhatsApp message with the details you entered.",
    contact_wa_greeting: "Hello, I'm",
    contact_wa_grade: "Grade",
    contact_wa_inquiry: "Inquiry",

    page_title_login: "Login — Shady Nasr English Platform",
    auth_title_login: "Welcome Back",
    auth_title_register: "Start Your Journey With Us",
    auth_subtitle: "Log in to continue your lessons",
    auth_tab_login: "Log In",
    auth_tab_register: "Create Account",
    field_email: "Email",
    field_password: "Password",
    field_fullname: "Full Name",
    field_age: "Age",
    field_grade: "Grade",
    field_gender: "Gender",
    gender_male: "Male",
    gender_female: "Female",
    option_choose_grade: "Choose Your Grade",
    hint_min_chars: "At least 6 characters",
    btn_continue: "Continue",
    btn_create_account: "Create Account",
    btn_back: "Back",
    btn_confirm_code: "Confirm Code",
    btn_resend: "Resend",
    otp_title: "Enter Verification Code",
    otp_subtitle_login: "We sent a 6-digit code to your email",
    otp_subtitle_register: "Confirm your email with the code you received to activate your account",
    otp_not_received: "Didn't receive the code?",
    otp_resend_success: "Sent again",
    otp_spam_hint: "If the code doesn't show up, check your Spam/Junk folder — the login code email may land there only.",
    forgot_link: "Forgot password?",
    forgot_title: "Reset Password",
    forgot_subtitle: "Enter the email you registered with and we'll send you a verification code",
    forgot_send_code: "Send Code",
    forgot_otp_subtitle: "We sent a 6-digit code to your email to reset your password",
    forgot_spam_hint: "If the code doesn't show up, check your Spam/Junk folder.",
    forgot_new_title: "New Password",
    forgot_new_subtitle: "Enter your new password and confirm it",
    field_new_password: "New password",
    field_confirm_password: "Confirm password",
    btn_save_password: "Save & Enter Platform",
    reset_err_not_found: "This email is not registered on the platform",
    reset_err_admin: "Password reset isn't available for this account here",
    reset_err_send: "Couldn't send the code, please try again in a moment",
    reset_err_code_len: "Enter the full code (6 digits)",
    reset_err_expired: "The code has expired, press Resend",
    reset_err_wrong: "Wrong code, try again",
    reset_err_too_many: "Too many wrong attempts. Request a new code with Resend",
    reset_err_no_otp: "No valid code found, press Resend",
    reset_err_short: "Password must be at least 6 characters",
    reset_err_mismatch: "Passwords don't match",
    reset_err_generic: "Something went wrong, try again",
    brand_update_msg: "A new platform update is available (name / logo)",
    brand_update_btn: "Update",
    success_title: "Logged In Successfully",
    success_subtitle: "Redirecting you to the platform...",
    aria_show_password: "Show password",
  },
};

/* Restituisce il testo tradotto per la lingua corrente (fallback: arabo) */
function t(key) {
  const lang = document.documentElement.lang === "en" ? "en" : "ar";
  return (I18N[lang] && I18N[lang][key]) || (I18N.ar && I18N.ar[key]) || key;
}

function applyTranslations(lang) {
  const dict = I18N[lang] || I18N.ar;

  document.querySelectorAll("[data-i18n]").forEach((el) => {
    const key = el.dataset.i18n;
    if (dict[key] == null) return;
    if (el.hasAttribute("data-i18n-html")) el.innerHTML = dict[key];
    else el.textContent = dict[key];
  });

  document.querySelectorAll("[data-i18n-aria]").forEach((el) => {
    const key = el.dataset.i18nAria;
    if (dict[key] != null) el.setAttribute("aria-label", dict[key]);
  });

  document.querySelectorAll("[data-i18n-label]").forEach((el) => {
    const key = el.dataset.i18nLabel;
    if (dict[key] != null) el.label = dict[key];
  });

  document.querySelectorAll("[data-i18n-placeholder]").forEach((el) => {
    const key = el.dataset.i18nPlaceholder;
    if (dict[key] != null) el.setAttribute("placeholder", dict[key]);
  });

  // Ricostruisce i pannelli delle custom-select con i testi nella lingua nuova.
  document.querySelectorAll("[data-custom-select]").forEach((wrapper) => {
    if (wrapper._refreshCustomSelect) wrapper._refreshCustomSelect();
  });

  // Ridisegna i carousel dei sub-item già aperti/generati con la lingua corrente.
  document.querySelectorAll(".grade-carousel__track").forEach((track) => {
    if (track.dataset.populated) populateCarousel(track);
  });

  // Titolo h1 della pagina di login (dipende anche dal tab attivo) e sottotitolo OTP dinamico.
  if (document.getElementById("authTitle")) updateAuthTitle();
  const otpSubtitle = document.getElementById("otpSubtitle");
  if (otpSubtitle) otpSubtitle.textContent = t(`otp_subtitle_${authOtpFlow}`);

  // إعادة رسم جداول السناتر باللغة الجديدة
  if (document.getElementById("centersScheduleGrid")) renderCentersSchedule();
}

function applyLanguage(lang) {
  document.documentElement.lang = lang;
  document.documentElement.dir = lang === "ar" ? "rtl" : "ltr";
  document.querySelectorAll(".lang-btn .lang-code").forEach((el) => {
    el.textContent = lang === "ar" ? "EN" : "AR";
  });
  applyTranslations(lang);
}

/* Aggiorna il titolo h1 dello step credenziali in base al tab attivo + lingua corrente */
function updateAuthTitle() {
  const titleEl = document.getElementById("authTitle");
  if (!titleEl) return;
  const activeTab = document.querySelector(".auth-tab.is-active");
  const tabName = activeTab ? activeTab.dataset.tab : "login";
  titleEl.textContent = t(tabName === "register" ? "auth_title_register" : "auth_title_login");
}

/* Traccia se lo step OTP corrente appartiene al flusso login o register, per ri-tradurlo al volo */
let authOtpFlow = "login";

function initLang() {
  const saved = localStorage.getItem("lang");
  if (saved) applyLanguage(saved);

  const btns = document.querySelectorAll(".lang-btn");
  if (!btns.length) return;
  btns.forEach((btn) => {
    if (btn.dataset.langBound) return; // منع الربط المزدوج
    btn.dataset.langBound = "1";
    btn.addEventListener("click", () => {
      const next = document.documentElement.lang === "ar" ? "en" : "ar";
      applyLanguage(next);
      localStorage.setItem("lang", next);
    });
  });
}

/* --- Custom select: dropdown personalizzato per <select data-enhance> (stile coerente col sito) --- */
function buildCustomSelectUI(select) {
  const wrapper = select.closest("[data-custom-select]");
  if (!wrapper || wrapper.querySelector(".custom-select__trigger")) return;

  const trigger = document.createElement("button");
  trigger.type = "button";
  trigger.className = "custom-select__trigger";
  trigger.setAttribute("aria-haspopup", "listbox");
  trigger.setAttribute("aria-expanded", "false");
  trigger.tabIndex = -1; // la tastiera/accessibilità restano sul <select> reale

  trigger.innerHTML =
    '<span class="custom-select__value"></span>' +
    '<svg class="custom-select__chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m6 9 6 6 6-6"/></svg>';
  const valueSpan = trigger.querySelector(".custom-select__value");

  const panel = document.createElement("ul");
  panel.className = "custom-select__panel";
  panel.setAttribute("role", "listbox");
  panel.hidden = true;

  // نفس سلوك الـ select الحقيقي: input ثم change (لوحة الأدمن بتسمع على input)
  function choose(value) {
    if (select.value === value) return;
    nativeSet(value);
    syncValue();
    select.dispatchEvent(new Event("input", { bubbles: true }));
    select.dispatchEvent(new Event("change", { bubbles: true }));
  }

  function appendOption(opt) {
    const li = document.createElement("li");
    li.className = "custom-select__option";
    li.setAttribute("role", "option");
    li.dataset.value = opt.value;
    li.textContent = opt.textContent;
    li.addEventListener("click", () => {
      choose(opt.value);
      closePanel();
    });
    panel.appendChild(li);
  }

  function renderOptions() {
    panel.innerHTML = "";
    Array.from(select.children).forEach((node) => {
      if (node.tagName === "OPTGROUP") {
        const groupLabel = document.createElement("li");
        groupLabel.className = "custom-select__group";
        groupLabel.textContent = node.label;
        panel.appendChild(groupLabel);
        Array.from(node.children).forEach(appendOption);
      } else if (node.tagName === "OPTION" && !(node.disabled && !node.value)) {
        appendOption(node); // بنتخطى بس الـ placeholder المعطّل (القيمة الفاضية المسموحة زي "كل الصفوف" بتظهر)
      }
    });
  }

  function syncValue() {
    const selectedOption = select.options[select.selectedIndex];
    valueSpan.textContent = selectedOption ? selectedOption.textContent : "";
    valueSpan.classList.toggle("is-placeholder", !select.value);
    panel.querySelectorAll(".custom-select__option").forEach((li) => {
      li.classList.toggle("is-selected", li.dataset.value === select.value);
    });
  }

  // على الموبايل (للقوائم المعلّمة data-sheet) القايمة بتفتح كنافذة بتصميم المنصة بدل قايمة معلّقة
  function useSheet() {
    return wrapper.hasAttribute("data-sheet") && window.snDialog && window.snDialog.pick &&
      window.matchMedia && window.matchMedia("(max-width: 700px)").matches;
  }
  function labelText() {
    const l = select.id && document.querySelector('label[for="' + select.id + '"]');
    return (l && l.textContent.trim()) || select.getAttribute("aria-label") || "";
  }

  function openPanel() {
    if (useSheet()) {
      const items = Array.from(panel.querySelectorAll(".custom-select__option")).map((li) => ({ value: li.dataset.value, label: li.textContent }));
      trigger.setAttribute("aria-expanded", "true");
      window.snDialog.pick({ title: labelText(), options: items, value: select.value }).then((v) => {
        trigger.setAttribute("aria-expanded", "false");
        if (v != null) choose(v);
      });
      return;
    }
    panel.hidden = false;
    wrapper.classList.add("is-open");
    trigger.setAttribute("aria-expanded", "true");
  }
  function closePanel() {
    panel.hidden = true;
    wrapper.classList.remove("is-open");
    trigger.setAttribute("aria-expanded", "false");
  }

  trigger.addEventListener("click", () => {
    if (panel.hidden) openPanel();
    else closePanel();
  });

  document.addEventListener("click", (e) => {
    if (!wrapper.contains(e.target)) closePanel();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closePanel();
  });

  // لما الكود يغيّر select.value أو الـ options برمجيًا، الشكل لازم يتحدّث
  const valueDesc = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value");
  function nativeSet(v) { valueDesc.set.call(select, v); }
  try {
    Object.defineProperty(select, "value", {
      configurable: true,
      get() { return valueDesc.get.call(select); },
      set(v) { valueDesc.set.call(select, v); syncValue(); },
    });
  } catch (e) { /* مش مشكلة: التحديث هيحصل مع أول change */ }
  try {
    new MutationObserver(() => { renderOptions(); syncValue(); }).observe(select, { childList: true, subtree: true });
  } catch (e) {}
  select.addEventListener("change", syncValue);
  select.addEventListener("blur", closePanel);

  renderOptions();
  syncValue();

  wrapper.appendChild(trigger);
  wrapper.appendChild(panel);

  // Richiamata quando le traduzioni cambiano lingua (i testi delle option/optgroup sono già aggiornati)
  wrapper._refreshCustomSelect = () => {
    renderOptions();
    syncValue();
  };
}

function initCustomSelects() {
  document.querySelectorAll("select[data-enhance]").forEach((select) => {
    // select مش جوه غلاف: نلفّه بنفسنا (لوحة الأدمن) ونفتحه كنافذة على الموبايل
    if (!select.closest("[data-custom-select]")) {
      const wrap = document.createElement("div");
      wrap.className = "custom-select custom-select--auto";
      wrap.setAttribute("data-custom-select", "");
      wrap.setAttribute("data-sheet", "");
      select.parentNode.insertBefore(wrap, select);
      wrap.appendChild(select);
      select.classList.add("custom-select__native");
    }
    buildCustomSelectUI(select);
  });
}

/* --- Mostra/nascondi password --- */
function initPasswordToggles() {
  document.querySelectorAll(".password-toggle").forEach((btn) => {
    btn.addEventListener("click", () => {
      const input = document.getElementById(btn.dataset.toggleFor);
      if (!input) return;
      const showing = input.type === "text";
      input.type = showing ? "password" : "text";
      btn.classList.toggle("is-visible", !showing);
    });
  });
}

/* --- OTP: خانة واحدة (تقبل اللصق/النسخ) — بنشيل أي حاجة مش رقم ونقصّ على 6 --- */
function initOtpBoxes() {
  const input = document.getElementById("otpCode");
  if (!input) return;
  input.addEventListener("input", () => {
    const clean = input.value.replace(/\D/g, "").slice(0, 6);
    if (input.value !== clean) input.value = clean;
  });
}

/* --- Navigazione tra tab login/registrati --- */
function activateAuthTab(tabName) {
  const tabs = document.querySelectorAll(".auth-tab");
  if (!tabs.length) return;
  let matched = false;
  tabs.forEach((t) => {
    const isMatch = t.dataset.tab === tabName;
    if (isMatch) matched = true;
    t.classList.toggle("is-active", isMatch);
    t.setAttribute("aria-selected", isMatch ? "true" : "false");
  });
  if (!matched) return; // nome non valido: non tocca lo stato attuale
  document.querySelectorAll(".auth-form[data-panel]").forEach((panel) => {
    panel.hidden = panel.dataset.panel !== tabName;
  });

  // Titolo dinamico in base al tab e alla lingua corrente (es. "أهلاً بيك تاني" / "Welcome Back")
  updateAuthTitle();
}

function initAuthTabs() {
  const tabs = document.querySelectorAll(".auth-tab");
  if (!tabs.length) return;

  tabs.forEach((tab) => {
    tab.addEventListener("click", () => activateAuthTab(tab.dataset.tab));
  });

  // Apre il tab giusto in base all'hash dell'URL (es. login.html#register)
  const requested = window.location.hash.replace("#", "");
  if (requested === "login" || requested === "register") {
    activateAuthTab(requested);
  }
}

/* --- Navigazione tra step (credenziali -> otp -> successo) --- */
function goToStep(name) {
  document.querySelectorAll(".auth-step").forEach((step) => {
    step.classList.toggle("is-active", step.dataset.step === name);
  });
}

function initAuthSteps() {
  const loginForm = document.getElementById("loginForm");
  const registerForm = document.getElementById("registerForm");
  const otpForm = document.getElementById("otpForm");
  const otpBack = document.getElementById("otpBack");
  const otpResend = document.getElementById("otpResend");
  const otpSubtitle = document.getElementById("otpSubtitle");

  // بيانات الجلسة الجارية لخطوة التحقق بالكود: مين، وأنهي مسار (دخول ولا حساب جديد).
  let pendingAuth = null;

  function setFormError(el, msg) {
    if (!el) return;
    if (!msg) {
      el.hidden = true;
      el.textContent = "";
      return;
    }
    el.textContent = msg;
    el.hidden = false;
  }

  function setSubmitLoading(form, loading) {
    const btn = form.querySelector("button[type=submit]");
    if (!btn) return;
    if (!btn.dataset.originalText) btn.dataset.originalText = btn.textContent;
    btn.disabled = loading;
    btn.textContent = loading ? "جاري التحميل..." : btn.dataset.originalText;
  }

  function getOtpErrorMessage(err) {
    if (err && err.message === "EMAIL_SEND_FAILED") {
      if (window.location.protocol === "file:") {
        return "الموقع مفتوح كملف مباشر، وEmailJS يرفض إرسال الكود بهذه الطريقة. شغّله عبر localhost أو ارفعه على الدومين أولًا.";
      }
      if (String(err.code).toLowerCase().includes("origin") || String(err.code) === "403") {
        return "تم فتح شاشة الكود، لكن EmailJS رفض الموقع الحالي. أضف الدومين في Allowed Origins داخل EmailJS.";
      }
      if (String(err.code) === "400" || String(err.code) === "422") {
        return "تم فتح شاشة الكود، لكن إعدادات EmailJS أو بيانات القالب غير صحيحة. راجع Service ID وTemplate ID ومتغيرات القالب.";
      }
      return "تم فتح شاشة الكود، لكن تعذر إرسال الإيميل. اضغط إعادة الإرسال أو راجع إعدادات EmailJS.";
    }
    if (err && (String(err.message).includes("PERMISSION_DENIED") || err.code === "PERMISSION_DENIED")) {
      return "تم فتح شاشة الكود، لكن Firebase رفض حفظ الكود. راجع صلاحيات Realtime Database.";
    }
    return "تم فتح شاشة الكود، لكن حصل خطأ أثناء إرسال الكود. اضغط إعادة الإرسال وحاول تاني.";
  }

  /* تخزين نسخة خفيفة من الجلسة + كاش كامل لبيانات المستخدم، عشان studenti.html يلاقيها جاهزة فورًا */
  function cacheUserAndRedirect(user) {
    localStorage.setItem("shadynasr-auth", "1");
    localStorage.setItem(
      "shadynasr-current-user",
      JSON.stringify({ id: user.id, fullName: user.fullName, email: user.email, grade: user.grade, role: user.role || "student" })
    );
    try {
      const raw = JSON.parse(localStorage.getItem("shadynasr-db-users"));
      const users = Array.isArray(raw) ? raw : [];
      const idx = users.findIndex((u) => u.id === user.id);
      if (idx >= 0) users[idx] = user;
      else users.push(user);
      localStorage.setItem("shadynasr-db-users", JSON.stringify(users));
    } catch {
      /* لو الكاش المحلي فيه مشكلة، مش مؤثر: studenti.html هيجيب البيانات من Firebase تاني */
    }

    window.location.replace(user.role === "admin" ? "admin.html" : "studenti.html");
  }

  if (loginForm) {
    loginForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const errorEl = document.getElementById("loginError");
      setFormError(errorEl, "");

      if (!window.SNAuth) {
        setFormError(errorEl, "تعذر الاتصال بالخادم، حاول تاني بعد لحظات");
        return;
      }

      const email = loginForm.email.value.trim();
      const password = loginForm.password.value;

      setSubmitLoading(loginForm, true);
      try {
        const user = await window.SNAuth.verifyLogin(email, password);

        // الأدمن: مفيش كود على إيميله العادي. بنحوّله لصفحة admin-verify.html اللي
        // بتبعت الكود على "إيميل تحقق الأدمن" المحدد في إعدادات لوحة الأدمن.
        if (user.role === "admin") {
          sessionStorage.setItem(
            "shadynasr-admin-pending",
            JSON.stringify({ id: user.id, email: user.email, fullName: user.fullName, ts: Date.now() })
          );
          window.location.replace("admin-verify.html");
          return;
        }

        pendingAuth = { email: user.email, name: user.fullName, flow: "login" };
        authOtpFlow = "login";
        otpSubtitle.textContent = t("otp_subtitle_login");
        goToStep("otp");
        try {
          await window.SNAuth.requestOtp(user.email, user.fullName, "login");
        } catch (otpErr) {
          setFormError(document.getElementById("otpError"), getOtpErrorMessage(otpErr));
        }
      } catch (err) {
        const msg =
          err && (err.message === "NOT_FOUND" || err.message === "WRONG_PASSWORD")
            ? "الإيميل أو كلمة المرور غير صحيحة"
            : "حصل خطأ أثناء تسجيل الدخول، حاول تاني";
        setFormError(errorEl, msg);
      } finally {
        setSubmitLoading(loginForm, false);
      }
    });
  }

  if (registerForm) {
    registerForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const errorEl = document.getElementById("registerError");
      setFormError(errorEl, "");

      if (!window.SNAuth) {
        setFormError(errorEl, "تعذر الاتصال بالخادم، حاول تاني بعد لحظات");
        return;
      }

      const fd = new FormData(registerForm);
      const data = {
        fullName: String(fd.get("name") || "").trim(),
        email: String(fd.get("email") || "").trim(),
        password: fd.get("password"),
        age: fd.get("age"),
        grade: fd.get("grade"),
        track: fd.get("track") || "",
        gender: fd.get("gender"),
      };

      setSubmitLoading(registerForm, true);
      try {
        const user = await window.SNAuth.createUser(data);
        pendingAuth = { email: user.email, name: user.fullName, flow: "register" };
        authOtpFlow = "register";
        otpSubtitle.textContent = t("otp_subtitle_register");
        goToStep("otp");
        try {
          await window.SNAuth.requestOtp(user.email, user.fullName, "register");
        } catch (otpErr) {
          setFormError(document.getElementById("otpError"), getOtpErrorMessage(otpErr));
        }
      } catch (err) {
        const msg = err && err.message === "EMAIL_EXISTS" ? "في حساب مسجّل بالإيميل ده بالفعل" : "حصل خطأ أثناء إنشاء الحساب، حاول تاني";
        setFormError(errorEl, msg);
      } finally {
        setSubmitLoading(registerForm, false);
      }
    });
  }

  if (otpForm) {
    otpForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const errorEl = document.getElementById("otpError");
      setFormError(errorEl, "");

      if (!pendingAuth || !window.SNAuth) {
        goToStep("credentials");
        return;
      }

      const code = (document.getElementById("otpCode").value || "").replace(/\D/g, "");
      if (code.length !== 6) {
        setFormError(errorEl, "اكتب الكود كامل (6 أرقام)");
        return;
      }

      setSubmitLoading(otpForm, true);
      try {
        await window.SNAuth.verifyOtpCode(pendingAuth.email, code);
        const user = await window.SNAuth.markVerifiedAndFetch(pendingAuth.email);
        goToStep("success");
        setTimeout(() => cacheUserAndRedirect(user), 900);
      } catch (err) {
        const msg =
          err && err.message === "EXPIRED"
            ? "الكود منتهي الصلاحية، اضغط إعادة الإرسال"
            : err && err.message === "WRONG_CODE"
            ? "الكود غلط، حاول تاني"
            : "حصل خطأ أثناء التحقق، حاول تاني";
        setFormError(errorEl, msg);
      } finally {
        setSubmitLoading(otpForm, false);
      }
    });
  }

  /* ===== استعادة كلمة المرور: إيميل -> كود -> كلمة مرور جديدة -> دخول المنصة ===== */
  let pendingReset = null; // { email, name, code }

  const forgotLink = document.getElementById("forgotLink");
  const forgotEmailForm = document.getElementById("forgotEmailForm");
  const forgotOtpForm = document.getElementById("forgotOtpForm");
  const forgotNewForm = document.getElementById("forgotNewForm");
  const forgotResend = document.getElementById("forgotResend");
  const forgotCodeInput = document.getElementById("forgotCode");

  if (forgotCodeInput) {
    forgotCodeInput.addEventListener("input", () => {
      const clean = forgotCodeInput.value.replace(/\D/g, "").slice(0, 6);
      if (forgotCodeInput.value !== clean) forgotCodeInput.value = clean;
    });
  }

  if (forgotLink) {
    forgotLink.addEventListener("click", () => {
      const loginEmail = loginForm && loginForm.email ? loginForm.email.value.trim() : "";
      document.getElementById("forgotEmail").value = loginEmail;
      setFormError(document.getElementById("forgotEmailError"), "");
      pendingReset = null;
      goToStep("forgot-email");
    });
  }

  const forgotEmailBack = document.getElementById("forgotEmailBack");
  if (forgotEmailBack) forgotEmailBack.addEventListener("click", () => goToStep("credentials"));

  const forgotOtpBack = document.getElementById("forgotOtpBack");
  if (forgotOtpBack) forgotOtpBack.addEventListener("click", () => {
    pendingReset = null;
    goToStep("forgot-email");
  });

  if (forgotEmailForm) {
    forgotEmailForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const errorEl = document.getElementById("forgotEmailError");
      setFormError(errorEl, "");
      if (!window.SNAuth) {
        setFormError(errorEl, t("reset_err_send"));
        return;
      }
      const email = forgotEmailForm.email.value.trim();
      setSubmitLoading(forgotEmailForm, true);
      try {
        // نتأكد إن الإيميل مسجّل *قبل* ما نبعت أي كود
        const user = await window.SNAuth.findUserByEmail(email);
        if (!user) {
          setFormError(errorEl, t("reset_err_not_found"));
          return;
        }
        if (user.role === "admin") {
          setFormError(errorEl, t("reset_err_admin"));
          return;
        }
        await window.SNAuth.requestOtp(user.email, user.fullName, "reset");
        pendingReset = { email: user.email, name: user.fullName, code: null };
        forgotOtpForm.reset();
        setFormError(document.getElementById("forgotOtpError"), "");
        goToStep("forgot-otp");
      } catch (err) {
        setFormError(errorEl, t("reset_err_send"));
      } finally {
        setSubmitLoading(forgotEmailForm, false);
      }
    });
  }

  if (forgotOtpForm) {
    forgotOtpForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const errorEl = document.getElementById("forgotOtpError");
      setFormError(errorEl, "");
      if (!pendingReset || !window.SNAuth) {
        goToStep("forgot-email");
        return;
      }
      const code = (forgotCodeInput.value || "").replace(/\D/g, "");
      if (code.length !== 6) {
        setFormError(errorEl, t("reset_err_code_len"));
        return;
      }
      setSubmitLoading(forgotOtpForm, true);
      try {
        await window.SNAuth.checkResetCode(pendingReset.email, code);
        pendingReset.code = code;
        forgotNewForm.reset();
        setFormError(document.getElementById("forgotNewError"), "");
        goToStep("forgot-new");
      } catch (err) {
        const m = err && err.message;
        setFormError(
          errorEl,
          m === "EXPIRED" ? t("reset_err_expired")
            : m === "WRONG_CODE" ? t("reset_err_wrong")
            : m === "TOO_MANY_ATTEMPTS" ? t("reset_err_too_many")
            : m === "NO_OTP" ? t("reset_err_no_otp")
            : t("reset_err_generic")
        );
      } finally {
        setSubmitLoading(forgotOtpForm, false);
      }
    });
  }

  if (forgotNewForm) {
    forgotNewForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const errorEl = document.getElementById("forgotNewError");
      setFormError(errorEl, "");
      if (!pendingReset || !pendingReset.code || !window.SNAuth) {
        goToStep("forgot-email");
        return;
      }
      const pw = forgotNewForm.password.value;
      const confirmPw = forgotNewForm.confirm.value;
      if (pw.length < 6) {
        setFormError(errorEl, t("reset_err_short"));
        return;
      }
      if (pw !== confirmPw) {
        setFormError(errorEl, t("reset_err_mismatch"));
        return;
      }
      setSubmitLoading(forgotNewForm, true);
      try {
        const user = await window.SNAuth.resetPasswordWithOtp(pendingReset.email, pw);
        pendingReset = null;
        goToStep("success");
        setTimeout(() => cacheUserAndRedirect(user), 900);
      } catch (err) {
        const m = err && err.message;
        if (m === "EXPIRED" || m === "NO_OTP" || m === "WRONG_CODE" || m === "TOO_MANY_ATTEMPTS") {
          // الكود اتلغى/انتهى قبل الحفظ: يرجع لخطوة الكود
          setFormError(document.getElementById("forgotOtpError"), t(m === "EXPIRED" ? "reset_err_expired" : "reset_err_no_otp"));
          pendingReset.code = null;
          goToStep("forgot-otp");
        } else {
          setFormError(errorEl, m === "ADMIN_NOT_ALLOWED" ? t("reset_err_admin") : t("reset_err_generic"));
        }
      } finally {
        setSubmitLoading(forgotNewForm, false);
      }
    });
  }

  if (forgotResend) {
    forgotResend.addEventListener("click", async () => {
      if (!pendingReset || !window.SNAuth) return;
      forgotResend.disabled = true;
      const errorEl = document.getElementById("forgotOtpError");
      try {
        await window.SNAuth.requestOtp(pendingReset.email, pendingReset.name, "reset");
        setFormError(errorEl, "");
        forgotResend.textContent = t("otp_resend_success");
      } catch {
        forgotResend.textContent = t("reset_err_generic");
      } finally {
        setTimeout(() => { forgotResend.textContent = t("btn_resend"); }, 2500);
        setTimeout(() => { forgotResend.disabled = false; }, 30000); // مهلة 30 ثانية بين كل إرسال
      }
    });
  }

  if (otpBack) {
    otpBack.addEventListener("click", () => {
      pendingAuth = null;
      goToStep("credentials");
    });
  }

  if (otpResend) {
    otpResend.addEventListener("click", async () => {
      if (!pendingAuth || !window.SNAuth) return;
      otpResend.disabled = true;
      try {
        await window.SNAuth.requestOtp(pendingAuth.email, pendingAuth.name, pendingAuth.flow);
        otpResend.textContent = t("otp_resend_success");
      } catch {
        otpResend.textContent = "حصل خطأ، حاول تاني";
      } finally {
        setTimeout(() => {
          otpResend.textContent = t("btn_resend");
          otpResend.disabled = false;
        }, 2500);
      }
    });
  }
}

/* --- Mobile menu (hamburger + off-canvas panel) --- */
function initMobileMenu() {
  const toggle = document.getElementById("menuToggle");
  const panel = document.getElementById("mobileMenu");
  const overlay = document.getElementById("mobileMenuOverlay");
  const closeBtn = document.getElementById("mobileMenuClose");
  if (!toggle || !panel || !overlay) return;

  function open() {
    panel.classList.add("is-open");
    overlay.classList.add("is-open");
    document.body.style.overflow = "hidden";
  }
  function close() {
    panel.classList.remove("is-open");
    overlay.classList.remove("is-open");
    document.body.style.overflow = "";
  }

  toggle.addEventListener("click", open);
  overlay.addEventListener("click", close);
  if (closeBtn) closeBtn.addEventListener("click", close);
  panel.querySelectorAll("a").forEach((a) => a.addEventListener("click", close));
  window.addEventListener("resize", () => {
    if (window.innerWidth >= 900) close();
  });
}

/* --- Scroll progress bar (شريط تقدّم القراءة فوق الـ navbar) --- */
function initScrollProgress() {
  const bar = document.getElementById("navProgress");
  if (!bar) return;

  function update() {
    const scrollTop = window.scrollY || document.documentElement.scrollTop;
    const docHeight = document.documentElement.scrollHeight - window.innerHeight;
    const pct = docHeight > 0 ? (scrollTop / docHeight) * 100 : 0;
    bar.style.width = Math.min(100, Math.max(0, pct)) + "%";
  }

  update();
  window.addEventListener("scroll", update, { passive: true });
  window.addEventListener("resize", update);
}

const AuthUI = {
  init() {
    initTheme();
    initLang();
    initPasswordToggles();
    initCustomSelects();
    initOtpBoxes();
    initAuthTabs();
    initAuthSteps();
    initScrollProgress();
    initMobileMenu();
  },
};

/* ==========================================================================
   Grade squares: sub-item carousel (index.html)
   ========================================================================== */

const SUBITEM_ICONS = [
  '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"/><path d="M14 2v6h6"/>',
  '<circle cx="12" cy="12" r="10"/><path d="m10 8 6 4-6 4Z"/>',
  '<path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/>',
  '<path d="M9 11l3 3 8-8"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>',
  '<path d="M12 2a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v1a7 7 0 0 1-14 0v-1M12 18v4M8 22h8"/>',
  '<path d="M9 9a3 3 0 1 1 4 2.8c-.6.3-1 1-1 1.7V14"/><circle cx="12" cy="17.5" r=".6" fill="currentColor"/><circle cx="12" cy="12" r="10"/>',
  '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20M4 19.5A2.5 2.5 0 0 0 6.5 22H20V2H6.5A2.5 2.5 0 0 0 4 4.5v15Z"/>',
  '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20M4 19.5A2.5 2.5 0 0 0 6.5 22H20V2H6.5A2.5 2.5 0 0 0 4 4.5v15Z"/><path d="m9 11 2 2 3-3"/>',
  '<path d="M21 11.5a8.4 8.4 0 0 1-9 8.4A9 9 0 1 1 21 11.5Z"/><path d="M9 9a3 3 0 1 1 4 2.8c-.6.3-1 1-1 1.7"/><circle cx="12" cy="17" r=".6" fill="currentColor"/>',
];

const SUBITEM_LABELS = {
  ar: [
    "الدروس PDF",
    "شرح فيديوهات مفصلة للدروس",
    "امتحان على كل درس",
    "شيت متابعة أسبوعية",
    "تسميع كلمات",
    "امتحانات تفاعلية على المنصة",
    "شرح القصة PDF",
    "امتحانات على القصة",
    "أسئلة تفاعلية على المنصة",
  ],
  en: [
    "PDF Lessons",
    "Detailed video explanations for lessons",
    "Exam for every lesson",
    "Weekly tracking sheet",
    "Vocabulary recitation",
    "Interactive exams on the platform",
    "Story explanation PDF",
    "Story exams",
    "Interactive questions on the platform",
  ],
};

function getSubitems() {
  const lang = document.documentElement.lang === "en" ? "en" : "ar";
  return SUBITEM_ICONS.map((icon, i) => ({ icon, label: SUBITEM_LABELS[lang][i] }));
}

function renderSubitemCard(item) {
  return `<a class="subitem-card" href="login.html">
    <svg class="subitem-card__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">${item.icon}</svg>
    <span class="subitem-card__label">${item.label}</span>
  </a>`;
}

function populateCarousel(track) {
  // Gli elementi vengono duplicati una volta per ottenere un loop orizzontale continuo (infinito).
  const html = getSubitems().map(renderSubitemCard).join("");
  track.innerHTML = html + html;
  track.dataset.populated = "true";
}

function initGradeCards() {
  document.querySelectorAll("[data-grade-btn]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const stage = btn.dataset.stage;
      const grade = btn.dataset.grade;
      const key = `${stage}-${grade}`;
      const grid = btn.closest(".grades-grid");
      const carousel = grid.querySelector(`[data-carousel="${key}"]`);
      const isOpen = btn.classList.contains("is-open");

      // Chiude tutte le altre card/carousel dello stesso stage
      grid.querySelectorAll("[data-grade-btn]").forEach((b) => b.classList.remove("is-open"));
      grid.querySelectorAll(".grade-carousel").forEach((c) => (c.hidden = true));

      if (!isOpen) {
        btn.classList.add("is-open");
        populateCarousel(carousel.querySelector(".grade-carousel__track"));
        carousel.hidden = false;
      }
    });
  });
}

/* --- Video player (hero/teacher promo) --- */
function initVideoPlayer() {
  const wrap = document.getElementById("videoPlayer");
  const video = document.getElementById("promoVideo");
  const playBtn = document.getElementById("videoPlayBtn");
  if (!wrap || !video || !playBtn) return;

  playBtn.addEventListener("click", () => {
    wrap.classList.add("is-playing");
    video.setAttribute("controls", "");
    video.play();
  });

  video.addEventListener("pause", () => wrap.classList.remove("is-playing"));
  video.addEventListener("ended", () => wrap.classList.remove("is-playing"));
};

const GradesUI = {
  init() {
    initGradeCards();
    initVideoPlayer();
    initStatsCounter();
  },
};

/* --- Stats: count-up animato, si ripete ogni volta che la sezione rientra in vista --- */
function initStatsCounter() {
  const statsSection = document.querySelector(".stats");
  if (!statsSection) return;

  const DURATION = 3200; // ms — animazione volutamente lenta

  function animateValue(el) {
    const target = parseInt(el.dataset.countTo, 10);
    const prefix = el.dataset.prefix || "";
    const suffix = el.dataset.suffix || "";
    const start = performance.now();

    function tick(now) {
      const progress = Math.min((now - start) / DURATION, 1);
      const eased = 1 - Math.pow(1 - progress, 3); // ease-out
      const value = Math.round(target * eased);
      el.textContent = `${prefix}${value}${suffix}`;
      if (progress < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          statsSection.querySelectorAll("[data-count-to]").forEach(animateValue);
        }
      });
    },
    { threshold: 0.4 }
  );

  observer.observe(statsSection);
}
/* ==========================================================================
   Page views: schedule + contact "pages" that swap in place on index.html
   (no popups, no extra files — the navbar and footer stay put)
   ========================================================================== */

const VIEW_HASHES = ["schedule", "contact"];

function showView(name, opts) {
  opts = opts || {};
  const views = document.querySelectorAll(".site-view");
  if (!views.length) return;

  views.forEach((view) => {
    const match = view.dataset.view === name;
    view.hidden = !match;
    view.classList.toggle("is-active", match);
  });

  if (opts.scrollTop !== false) {
    window.scrollTo({ top: 0, behavior: "auto" });
  }
}

function scrollToSectionId(id) {
  const el = document.getElementById(id);
  if (!el) return;
  const navEl = document.querySelector(".navbar");
  const navH = navEl ? navEl.offsetHeight : 0;
  const y = el.getBoundingClientRect().top + window.scrollY - navH - 12;
  window.scrollTo({ top: Math.max(0, y), behavior: "smooth" });
}

function currentHash() {
  return window.location.hash.replace("#", "");
}

/* Bottoni "جدول المواعيد" / "حجز واستفسار" / أزرار الرجوع — يبدّلوا الـ view من غير ريلود */
function initViewLinks() {
  document.querySelectorAll("[data-view-link]").forEach((el) => {
    el.addEventListener("click", (e) => {
      e.preventDefault();
      const target = el.dataset.viewLink;
      showView(target);
      if (target === "home") {
        history.pushState({ view: "home" }, "", window.location.pathname + window.location.search);
      } else {
        history.pushState({ view: target }, "", "#" + target);
      }
    });
  });
}

/* روابط الأنكور العادية (الرئيسية، الإعدادية، الثانوية، الأستاذ...) لازم ترجّع صفحة الرئيسية الأول لو المستخدم في صفحة الجدول/الاستفسار */
function initAnchorLinks() {
  document.addEventListener("click", (e) => {
    const a = e.target.closest("a[href]");
    if (!a || a.hasAttribute("data-view-link")) return;

    const href = a.getAttribute("href");
    const hashIdx = href.indexOf("#");
    if (hashIdx === -1) return;

    const hash = href.slice(hashIdx + 1);
    if (!hash || VIEW_HASHES.includes(hash)) return;

    const targetEl = document.getElementById(hash);
    const homeView = document.getElementById("view-home");
    if (!targetEl || !homeView || !homeView.contains(targetEl)) return;

    e.preventDefault();
    showView("home", { scrollTop: false });
    history.pushState({ view: "home" }, "", "#" + hash);
    requestAnimationFrame(() => scrollToSectionId(hash));
  });
}

function initViewHistory() {
  window.addEventListener("popstate", () => {
    const hash = currentHash();
    if (VIEW_HASHES.includes(hash)) {
      showView(hash);
    } else {
      showView("home", { scrollTop: false });
      if (hash) requestAnimationFrame(() => scrollToSectionId(hash));
    }
  });
}

function initViewRouter() {
  if (!document.querySelector(".site-view")) return;

  const initial = currentHash();
  showView(VIEW_HASHES.includes(initial) ? initial : "home", { scrollTop: false });

  initViewLinks();
  initAnchorLinks();
  initViewHistory();
}

/* --- Lightbox: تكبير صورة جدول المواعيد --- */
function initScheduleLightbox() {
  const openBtn = document.getElementById("scheduleOpenBtn");
  const lightbox = document.getElementById("scheduleLightbox");
  const closeBtn = document.getElementById("scheduleLightboxClose");
  if (!openBtn || !lightbox || !closeBtn) return;

  function open() {
    lightbox.hidden = false;
    requestAnimationFrame(() => lightbox.classList.add("is-open"));
    document.body.style.overflow = "hidden";
  }
  function close() {
    lightbox.classList.remove("is-open");
    document.body.style.overflow = "";
    setTimeout(() => {
      lightbox.hidden = true;
    }, 250);
  }

  openBtn.addEventListener("click", open);
  closeBtn.addEventListener("click", close);
  lightbox.addEventListener("click", (e) => {
    if (e.target === lightbox) close();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !lightbox.hidden) close();
  });
}

/* --- فورم الاستفسار: يبني رسالة واتساب جاهزة من بيانات الفورم --- */
function initContactForm() {
  const form = document.getElementById("contactForm");
  if (!form) return;

  form.addEventListener("submit", (e) => {
    e.preventDefault();

    const name = form.name.value.trim();
    const gradeSelect = form.grade;
    const gradeOption = gradeSelect.options[gradeSelect.selectedIndex];
    const gradeText = gradeOption && gradeOption.value ? gradeOption.textContent.trim() : "";
    const message = form.message.value.trim();

    const lines = [
      `${t("contact_wa_greeting")} ${name || "—"}`,
      gradeText ? `${t("contact_wa_grade")}: ${gradeText}` : null,
      message ? `${t("contact_wa_inquiry")}: ${message}` : null,
    ].filter(Boolean);

    const url = "https://wa.me/201097221867?text=" + encodeURIComponent(lines.join("\n"));
    window.open(url, "_blank", "noopener");
  });
}

/* --- تحميل صورة الجدول فعليًا على الجهاز (أندرويد + آيفون + كمبيوتر) --- */
function initScheduleDownload() {
  const link = document.getElementById("scheduleDownloadBtn");
  if (!link) return;

  const url = link.getAttribute("href");
  const filename = link.getAttribute("download") || "schedule.jpg";
  const isHttp = location.protocol === "http:" || location.protocol === "https:";
  const ua = navigator.userAgent || "";
  const isIOS = /iPad|iPhone|iPod/.test(ua) || (ua.includes("Macintosh") && navigator.maxTouchPoints > 1);
  // متصفحات داخل التطبيقات (فيسبوك/إنستجرام/واتساب...) بتمنع التحميل المباشر
  const isInApp = /FBAN|FBAV|Instagram|WhatsApp|Line\/|Snapchat|TikTok|MicroMessenger/i.test(ua);

  // بنجهّز الصورة (blob) من أول ما الصفحة تفتح عشان الضغطة تشتغل فورًا
  // (آيفون بيشترط إن الـ share يتنفّذ مباشرة من ضغطة المستخدم)
  let blobPromise = null;
  const getBlob = () => {
    if (!blobPromise) {
      blobPromise = fetch(url).then((r) => {
        if (!r.ok) throw new Error("fetch failed");
        return r.blob();
      });
      blobPromise.catch(() => { blobPromise = null; });
    }
    return blobPromise;
  };
  let blobReady = null;
  if (isHttp) getBlob().then((b) => { blobReady = b; }).catch(() => {});

  function toast(msg) {
    if (window.snDialog && window.snDialog.toast) window.snDialog.toast(msg);
  }

  // لو مفيش طريقة تحميل مباشرة: نفتح الصورة كبيرة ونقول للطالب يحفظها بالضغط المطوّل
  function manualSave() {
    const openBtn = document.getElementById("scheduleOpenBtn");
    if (openBtn) openBtn.click();
    toast("اضغط ضغطة مطوّلة على الصورة واختار «حفظ الصورة»");
  }

  function triggerDownload(blob) {
    const blobUrl = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = blobUrl;
    a.download = filename;
    a.style.display = "none";
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(blobUrl), 10000);
  }

  link.addEventListener("click", (e) => {
    // صفحة محلية (file://) أو متصفح داخل تطبيق: التحميل المباشر مش مضمون
    if (!isHttp) {
      if (isIOS || isInApp) { e.preventDefault(); manualSave(); }
      return; // غير كده بنسيب <a download> الطبيعي
    }
    e.preventDefault();

    const blob = blobReady;
    if (!blob) {
      // الصورة لسه بتتحمّل أو فشلت: نحاول تاني
      getBlob().then(triggerDownload).catch(() => { isIOS || isInApp ? manualSave() : (location.href = url); });
      return;
    }

    // آيفون: الـ share sheet هو الطريق الوحيد لحفظ الصورة في الصور/الملفات
    if (isIOS && navigator.canShare && navigator.share) {
      const file = new File([blob], "schedule.jpg", { type: blob.type || "image/jpeg" });
      if (navigator.canShare({ files: [file] })) {
        navigator.share({ files: [file], title: filename }).catch((err) => {
          if (err && err.name !== "AbortError") manualSave(); // AbortError = الطالب قفل القائمة بنفسه
        });
        return;
      }
    }
    if (isIOS || isInApp) return manualSave();

    // أندرويد + كمبيوتر: تحميل مباشر
    triggerDownload(blob);
  });
}

/* --- بيانات جدول المواعيد مقسّمة على كل سنتر (متحدّثة من صورة الجدول الجديدة) --- */
const CENTERS_SCHEDULE = {
  ar: [
    {
      center: "سنتر توتال ستارز",
      rows: [
        { grade: "الصف الأول الإعدادي", day: "الإثنين والخميس", time: "6:00" },
        { grade: "الصف الثاني الإعدادي", day: "الإثنين والخميس", time: "7:00" },
        { grade: "الصف الثالث الإعدادي", day: "الأحد والأربعاء", time: "10:00" },
        { grade: "الصف الأول الثانوي", day: "الإثنين والخميس", time: "5:00" },
      ],
    },
    {
      center: "سنتر الحرية",
      rows: [
        { grade: "الصف الأول الإعدادي", day: "الأحد والأربعاء", time: "5:00" },
        { grade: "الصف الثاني الإعدادي", day: "الأحد والأربعاء", time: "6:30" },
        { grade: "الصف الثالث الإعدادي", day: "السبت والثلاثاء", time: "12:00" },
        { grade: "الصف الثاني الثانوي", day: "السبت والثلاثاء", time: "6:00" },
      ],
    },
    {
      center: "سنتر وان",
      rows: [
        { grade: "الصف الأول الإعدادي", day: "الإثنين والخميس", time: "4:00" },
        { grade: "الصف الثاني الإعدادي", day: "الإثنين والخميس", time: "3:00" },
        { grade: "الصف الثالث الإعدادي", day: "السبت والثلاثاء", time: "11:00" },
        { grade: "الصف الأول الثانوي", day: "الإثنين والخميس", time: "1:30" },
        { grade: "الصف الثاني الثانوي", day: "الإثنين والخميس", time: "12:30" },
        { grade: "الصف الثالث الثانوي", day: "الإثنين والخميس", time: "10:00" },
      ],
    },
    {
      center: "سنتر برافو",
      rows: [
        { grade: "الصف الأول الإعدادي", day: "السبت والثلاثاء", time: "4:00" },
        { grade: "الصف الثاني الإعدادي", day: "السبت والثلاثاء", time: "5:00" },
        { grade: "الصف الثالث الإعدادي", day: "السبت والثلاثاء", time: "2:00" },
        { grade: "الصف الأول الثانوي", day: "السبت والثلاثاء", time: "3:00" },
      ],
    },
  ],
  en: [
    {
      center: "Total Stars Center",
      rows: [
        { grade: "1st Prep", day: "Monday & Thursday", time: "6:00" },
        { grade: "2nd Prep", day: "Monday & Thursday", time: "7:00" },
        { grade: "3rd Prep", day: "Sunday & Wednesday", time: "10:00" },
        { grade: "1st Secondary", day: "Monday & Thursday", time: "5:00" },
      ],
    },
    {
      center: "Al-Horreya Center",
      rows: [
        { grade: "1st Prep", day: "Sunday & Wednesday", time: "5:00" },
        { grade: "2nd Prep", day: "Sunday & Wednesday", time: "6:30" },
        { grade: "3rd Prep", day: "Saturday & Tuesday", time: "12:00" },
        { grade: "2nd Secondary", day: "Saturday & Tuesday", time: "6:00" },
      ],
    },
    {
      center: "One Center",
      rows: [
        { grade: "1st Prep", day: "Monday & Thursday", time: "4:00" },
        { grade: "2nd Prep", day: "Monday & Thursday", time: "3:00" },
        { grade: "3rd Prep", day: "Saturday & Tuesday", time: "11:00" },
        { grade: "1st Secondary", day: "Monday & Thursday", time: "1:30" },
        { grade: "2nd Secondary", day: "Monday & Thursday", time: "12:30" },
        { grade: "3rd Secondary", day: "Monday & Thursday", time: "10:00" },
      ],
    },
    {
      center: "Bravo Center",
      rows: [
        { grade: "1st Prep", day: "Saturday & Tuesday", time: "4:00" },
        { grade: "2nd Prep", day: "Saturday & Tuesday", time: "5:00" },
        { grade: "3rd Prep", day: "Saturday & Tuesday", time: "2:00" },
        { grade: "1st Secondary", day: "Saturday & Tuesday", time: "3:00" },
      ],
    },
  ],
};

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/* --- يرسم جدول كل سنتر مباشرة جوه صفحة المواعيد (بدل ما يتحمّل كملف) --- */
function renderCentersSchedule() {
  const grid = document.getElementById("centersScheduleGrid");
  if (!grid) return;

  const isAr = document.documentElement.lang !== "en";
  const centers = CENTERS_SCHEDULE[isAr ? "ar" : "en"];
  const colGrade = isAr ? "الصف الدراسي" : "Grade";
  const colDay = isAr ? "الأيام" : "Days";
  const colTime = isAr ? "الوقت" : "Time";
  const pinIcon =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 21s7-6.1 7-11a7 7 0 1 0-14 0c0 4.9 7 11 7 11Z"/><circle cx="12" cy="10" r="2.5"/></svg>';

  grid.innerHTML = centers
    .map(
      (c) => `
    <article class="center-card">
      <div class="center-card__head">${pinIcon}<span>${escapeHtml(c.center)}</span></div>
      <table>
        <thead>
          <tr><th>${colGrade}</th><th>${colDay}</th><th>${colTime}</th></tr>
        </thead>
        <tbody>
          ${c.rows
            .map(
              (r) => `<tr><td>${escapeHtml(r.grade)}</td><td>${escapeHtml(r.day)}</td><td>${escapeHtml(r.time)}</td></tr>`
            )
            .join("\n          ")}
        </tbody>
      </table>
    </article>`
    )
    .join("\n");
}

const PagesUI = {
  init() {
    initViewRouter();
    initScheduleLightbox();
    initScheduleDownload();
    renderCentersSchedule();
    initContactForm();
  },
};


/* ==========================================================================
   سبلاش الافتتاح: شعار ← موجة بلون المنصة ← اسم المنصة ← دايرة التحميل ← المنصة
   بيظهر مرة واحدة في كل جلسة (sessionStorage). window.snLaunch.done = Promise بيخلص
   لما سبلاش الافتتاح يخلص (home.js بيستناه قبل ما يشغّل دايرة التحميل بتاعت الطالب).
   ========================================================================== */
(() => {
  const LAUNCH_MS = 3000; // مدة سبلاش الافتتاح قبل ما يختفي ونبدأ الدايرة
  const RING_MS = 1700; // مدة الدايرة في الصفحة الرئيسية (صفحة الطالب بيتحكم فيها home.js)

  const launch = document.getElementById("launchSplash");
  const siteSplash = document.getElementById("siteSplash"); // دايرة الصفحة الرئيسية
  const studentSplash = document.getElementById("studentSplash"); // دايرة صفحة الطالب

  let resolveDone;
  window.snLaunch = { done: new Promise((r) => (resolveDone = r)) };

  const releaseRings = () => {
    [siteSplash, studentSplash].forEach((el) => el && el.classList.remove("is-held"));
  };

  let seen = false;
  try {
    seen = !!sessionStorage.getItem("sn_launch_seen");
  } catch {}

  // تخطّي: اتفتح قبل كده في الجلسة، أو الصفحة مالهاش سبلاش.
  // (مبنتخطاش لو الجهاز مفعّل "تقليل الحركة"، عشان السبلاش يظهر على التليفون والكمبيوتر الاتنين.)
  if (!launch || seen) {
    if (launch) launch.remove();
    if (siteSplash) siteSplash.remove();
    releaseRings();
    resolveDone();
    return;
  }

  try {
    sessionStorage.setItem("sn_launch_seen", "1");
  } catch {}

  window.setTimeout(() => {
    launch.classList.add("is-leaving");
    releaseRings(); // الدايرة تبدأ تتحرك مع اختفاء السبلاش
    resolveDone();
    window.setTimeout(() => launch.remove(), 500);

    if (siteSplash) {
      window.setTimeout(() => {
        siteSplash.classList.add("is-done");
        window.setTimeout(() => siteSplash.remove(), 500);
      }, RING_MS);
    }
  }, LAUNCH_MS);
})();


/* موجة الضغط: بتشتغل على أي زرار/لينك/كارت قابل للضغط في كل الصفحات اللي فيها shared.js.
   وظيفة الزرار (الضغطة الفعلية) بتتأجّل لحد ما الموجة تملا الزرار كله، وبعدها تتنفّذ. */
(function () {
  var RISE_MS = 340;   // وقت طلوع الموجة (لازم يساوي touch-wave-rise في shared.css)
  var TOTAL_MS = 700;  // وقت تنضيف عناصر الموجة
  var WAVE_SELECTOR = [
    "button", "a[href]", "summary", "[role=button]", "[role=tab]", "[onclick]", "[data-tab]",
    ".btn", ".icon-btn", ".dash-nav__link", ".dash-tab", ".grade-card", ".chapter-card",
    ".home-tile", ".lesson-item", ".chapter-option", ".subitem-card", ".lesson-pdf-nav",
    ".auth-tab", ".gender-option"
  ].join(",");
  var NO_DELAY = ".gender-option, [data-no-wave-delay]"; // عناصر اختيار: موجة بس من غير تأخير للوظيفة

  // أزرار/مربعات الصفحة الرئيسية في لوحة الطالب: من غير موجة ومن غير تأخير (بتشتغل فورًا)
  var NO_WAVE_AREA = '.dash-panel[data-panel="home"], #homeGrid, .home-grid, .home-tile';

  function findTarget(e) {
    var t = e.target;
    var el = t && t.closest ? t.closest(WAVE_SELECTOR) : null;
    if (el && el.closest(NO_WAVE_AREA)) return null;
    return el;
  }

  function isDisabled(el) {
    return el.disabled || el.getAttribute("aria-disabled") === "true";
  }

  function startWave(el) {
    if (isDisabled(el)) return false;
    var rect = el.getBoundingClientRect();
    if (rect.width < 8 || rect.height < 8 || rect.height > window.innerHeight * 0.8) return false;

    var old = el.querySelector(":scope > .touch-wave");
    if (old) old.remove();
    el.classList.remove("is-waving");
    void el.offsetWidth; // إعادة تشغيل الأنيميشن لو اتضغط تاني بسرعة

    var madeRelative = false;
    if (window.getComputedStyle(el).position === "static") {
      el.style.position = "relative";
      madeRelative = true;
    }
    var wave = document.createElement("span");
    wave.className = "touch-wave";
    wave.setAttribute("aria-hidden", "true");
    el.appendChild(wave);
    el.classList.add("is-waving");
    el.__waveStart = performance.now();

    window.setTimeout(function () {
      wave.remove();
      el.classList.remove("is-waving");
      if (madeRelative) el.style.position = "";
      el.__waveStart = 0;
    }, TOTAL_MS);
    return true;
  }

  // الموجة تبدأ لحظة الضغط بالماوس. على اللمس بنستنى لحظة صغيرة وبنلغيها لو الصباع بدأ يسحب (سكرول)،
  // عشان الموجة والتأثيرات ما تتدخلش في تمرير الصفحة على الموبايل.
  var touchTimer = null;
  var touchStart = null;
  function cancelTouchWave() {
    if (touchTimer) { window.clearTimeout(touchTimer); touchTimer = null; }
  }
  function clearRunningWaves() {
    document.querySelectorAll(".touch-wave").forEach(function (w) {
      var host = w.parentElement;
      w.remove();
      if (host) { host.classList.remove("is-waving"); host.__waveStart = 0; }
    });
  }
  document.addEventListener("pointerdown", function (e) {
    var el = findTarget(e);
    if (!el) return;
    if (e.pointerType === "touch") {
      cancelTouchWave();
      touchStart = { x: e.clientX, y: e.clientY };
      touchTimer = window.setTimeout(function () { touchTimer = null; startWave(el); }, 90);
    } else {
      startWave(el);
    }
  }, { capture: true, passive: true });
  document.addEventListener("pointermove", function (e) {
    if (touchTimer && touchStart && Math.hypot(e.clientX - touchStart.x, e.clientY - touchStart.y) > 8) cancelTouchWave();
  }, { capture: true, passive: true });
  document.addEventListener("pointercancel", function () { cancelTouchWave(); clearRunningWaves(); }, { capture: true, passive: true });
  document.addEventListener("scroll", cancelTouchWave, { capture: true, passive: true });

  // الوظيفة الفعلية: بتستنى لحد ما الموجة تخلص
  document.addEventListener("click", function (e) {
    cancelTouchWave();
    var el = findTarget(e);
    if (!el || isDisabled(el)) return;
    if (el.__waveRelease) return; // الضغطة اللي بنعيدها بعد الموجة: سيبها تعدّي

    var started = el.__waveStart ? true : startWave(el); // كيبورد (Enter/Space) من غير pointerdown
    if (!started || el.matches(NO_DELAY)) return;

    var remaining = RISE_MS - (performance.now() - el.__waveStart);
    if (remaining <= 0) return; // الموجة خلصت أصلًا (ضغطة طويلة): نفّذ فورًا

    e.preventDefault();
    e.stopImmediatePropagation();
    if (el.__wavePending) return; // تجاهل الضغطات المكررة أثناء الموجة
    el.__wavePending = true;

    window.setTimeout(function () {
      el.__wavePending = false;
      if (!el.isConnected || isDisabled(el)) return;
      el.__waveRelease = true;
      try { el.click(); } finally { el.__waveRelease = false; }
    }, remaining);
  }, true);
})();

/* ==========================================================================
   PWA: تسجيل الـ service worker + زرار "حمّل التطبيق"
   (أي عنصر عليه data-install-app بيظهر لما التثبيت يبقى متاح، ويختفي لو المنصة مفتوحة كتطبيق)
   ========================================================================== */
(function () {
  if ("serviceWorker" in navigator && (location.protocol === "https:" || location.hostname === "localhost")) {
    window.addEventListener("load", function () {
      navigator.serviceWorker.register("sw.js").catch(function () {});
    });
  }

  /* ----- تذكير التثبيت: أول ما الطالب يدخل المنصة، وبعدها كل 5 دقايق طول ما التطبيق مش متثبّت ----- */
  var EVERY_MS = 5 * 60 * 1000;   // الفاصل بين كل ظهور وظهور
  var CHECK_MS = 15 * 1000;       // كل قد إيه نفحص هل جه الميعاد
  var LAST_KEY = "sn_install_last";
  var INSTALLED_KEY = "sn_app_installed";
  var TAG = "install";

  var ua = navigator.userAgent || "";
  var deferred = null;            // حدث التثبيت التلقائي (أندرويد/كروم/كمبيوتر)
  var capable = false;            // اتأكدنا إن المتصفح بيدعم التثبيت (حتى لو الحدث اتستهلك)
  var ready = false;              // السبلاش خلص
  var showing = false;
  var timer = null;

  var isIOS = /iphone|ipad|ipod/i.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  // متصفحات أندرويد اللي مبتبعتش حدث التثبيت (زي فايرفوكس): بنشرح الخطوات يدوي.
  // كروم/سامسونج/إيدج بيبعتوه، فلو مجاش يبقى التطبيق متثبّت بالفعل.
  var manualOnly = isIOS || (/android/i.test(ua) && !/chrome|crios|samsungbrowser|edga|opr\//i.test(ua));

  function isStandalone() {
    try {
      return ["standalone", "minimal-ui", "window-controls-overlay"].some(function (m) {
        return window.matchMedia("(display-mode: " + m + ")").matches;
      }) || navigator.standalone === true;
    } catch (e) { return false; }
  }
  function getKey(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function setKey(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  function delKey(k) { try { localStorage.removeItem(k); } catch (e) {} }
  function installed() { return isStandalone() || getKey(INSTALLED_KEY) === "1"; }
  function canInstall() { return !installed() && (!!deferred || capable || manualOnly); }
  function isAr() { return document.documentElement.lang !== "en"; }

  function setHidden(v) {
    document.querySelectorAll("[data-install-app]").forEach(function (b) { b.hidden = v; });
  }
  function markInstalled() {
    setKey(INSTALLED_KEY, "1");
    deferred = null;
    setHidden(true);
    if (window.snDialog && window.snDialog.closeByTag) window.snDialog.closeByTag(TAG);
    if (timer) { clearInterval(timer); timer = null; }
  }

  // أول ظهور في كل جلسة (لكل منطقة: الموقع / لوحة الطالب) بيبقى فورًا، وبعدها كل 5 دقايق
  var AREA_KEY = "sn_install_first:" + (/studenti/i.test(location.pathname) ? "dash" : "site");
  function dueNow() {
    var first = true;
    try { first = !sessionStorage.getItem(AREA_KEY); } catch (e) {}
    if (first) return true;
    return Date.now() - (Number(getKey(LAST_KEY)) || 0) >= EVERY_MS;
  }
  function stamp() { setKey(LAST_KEY, String(Date.now())); }

  /* خطوات التثبيت اليدوي (آيفون / أي متصفح مبيدّيش زرار تثبيت تلقائي) */
  function showHowTo() {
    var ar = isAr();
    var dlg = {
      tag: TAG,
      icon: "download",
      title: ar ? "تثبيت التطبيق" : "Install the app",
      message: isIOS
        ? (ar
            ? "عشان تثبّت التطبيق: اضغط زرار المشاركة في Safari، وبعدها اختار «إضافة إلى الشاشة الرئيسية»."
            : "To install the app: tap the Share button in Safari, then choose “Add to Home Screen”.")
        : (ar
            ? "عشان تثبّت التطبيق: افتح قائمة المتصفح (⋮) واختار «تثبيت التطبيق» أو «إضافة إلى الشاشة الرئيسية»."
            : "To install the app: open the browser menu (⋮) and choose “Install app” or “Add to Home screen”."),
      confirmText: ar ? "تمام" : "OK"
    };
    if (window.snDialog) return window.snDialog.alert(dlg);
    window.alert(dlg.message);
    return Promise.resolve();
  }

  function install() {
    if (deferred) {
      var p = deferred;
      deferred = null;
      p.prompt();
      return p.userChoice.then(function (c) {
        if (c && c.outcome === "accepted") markInstalled();
      }).catch(function () {});
    }
    return showHowTo();
  }

  /* نافذة "حمّل التطبيق" بتصميم المنصة */
  function show() {
    showing = true;
    try { sessionStorage.setItem(AREA_KEY, "1"); } catch (e) {}
    stamp();
    function done() { showing = false; stamp(); }
    var ar = isAr();
    if (!deferred) {
      // آيفون / متصفح من غير تثبيت تلقائي: نعرض الخطوات مباشرة
      showHowTo().then(done, done);
      return;
    }
    window.snDialog.confirm({
      tag: TAG,
      icon: "download",
      title: ar ? "حمّل التطبيق" : "Install the app",
      message: ar
        ? "ثبّت منصة " + ((window.snBrand && window.snBrand.name()) || "Shady Nasr") + " على شاشتك الرئيسية عشان تفتحها بضغطة واحدة وتتابع دروسك وإعلانات الأستاذ بسهولة."
        : "Add the " + ((window.snBrand && window.snBrand.name()) || "Shady Nasr") + " platform to your home screen to open it in one tap and follow your lessons and announcements easily.",
      confirmText: ar ? "تحميل التطبيق" : "Install app",
      cancelText: ar ? "مش دلوقتي" : "Not now"
    }).then(function (yes) {
      done();
      if (yes) install();
    }, done);
  }

  function tick() {
    if (!ready || showing) return;
    if (!canInstall() || !window.snDialog) return;
    if (document.visibilityState !== "visible") return;
    // ما نقاطعش الطالب لو في نافذة تانية مفتوحة (امتحان، فيديو، تأكيد...)
    if (document.querySelector(".modal-overlay:not([hidden])")) return;
    if (!dueNow()) return;
    show();
  }

  /* نستنى سبلاش الافتتاح ودايرة التحميل يخلصوا، وبعدها نبدأ التذكير */
  function whenSplashesDone(cb) {
    var launchDone = window.snLaunch && window.snLaunch.done ? window.snLaunch.done : Promise.resolve();
    launchDone.then(function () {
      var tries = 0;
      (function wait() {
        var ring = document.getElementById("studentSplash") || document.getElementById("siteSplash");
        if (ring && document.body.contains(ring) && tries++ < 60) { setTimeout(wait, 300); return; }
        setTimeout(cb, 700);
      })();
    });
  }

  window.addEventListener("beforeinstallprompt", function (e) {
    e.preventDefault();
    deferred = e;
    capable = true;
    delKey(INSTALLED_KEY); // الحدث ده معناه إن التطبيق مش متثبّت دلوقتي (مثلًا اتشال بعد التثبيت)
    if (!isStandalone()) setHidden(false);
    tick();
  });
  window.addEventListener("appinstalled", markInstalled);
  try {
    var mq = window.matchMedia("(display-mode: standalone)");
    var onMode = function (ev) { if (ev.matches) markInstalled(); };
    if (mq.addEventListener) mq.addEventListener("change", onMode); else if (mq.addListener) mq.addListener(onMode);
  } catch (e) {}

  document.addEventListener("DOMContentLoaded", function () {
    if (isStandalone()) setKey(INSTALLED_KEY, "1");
    // كروم على أندرويد بيقدر يقول لو التطبيق متثبّت (محتاج related_applications في الـ manifest)
    if (navigator.getInstalledRelatedApps) {
      navigator.getInstalledRelatedApps().then(function (apps) {
        if (apps && apps.length) markInstalled();
      }).catch(function () {});
    }
    // زرار "حمّل التطبيق" ظاهر طول ما المنصة مش متثبّتة (لو التثبيت التلقائي مش متاح بيشرح الخطوات)
    setHidden(installed());
    document.querySelectorAll("[data-install-app]").forEach(function (btn) {
      btn.addEventListener("click", function () { install(); });
    });

    // لوحة الأدمن وصفحات الدخول/التحقق مش للتذكير
    if (/admin|login/i.test(location.pathname)) return;
    whenSplashesDone(function () {
      ready = true;
      tick();
      timer = setInterval(tick, CHECK_MS);
      document.addEventListener("visibilitychange", tick);
    });
  });
})();


/* ==========================================================================
   شبكة أمان للتمرير على الموبايل: لو أي قايمة/نافذة قفلت التمرير (overflow:hidden على body أو
   html.dash-sidebar-open) وبعدين اتقفلت من غير ما تفك القفل، بنفكّه تلقائيًا أول ما الطالب يلمس الشاشة.
   ========================================================================== */
(function () {
  function unlockStuckScroll() {
    var de = document.documentElement;
    var body = document.body;
    if (!body) return;

    var sidebar = document.getElementById("dashSidebar");
    if (de.classList.contains("dash-sidebar-open") && !(sidebar && sidebar.classList.contains("is-open"))) {
      de.classList.remove("dash-sidebar-open");
    }

    if (body.style.overflow === "hidden" || de.style.overflow === "hidden") {
      var lightbox = document.getElementById("scheduleLightbox");
      var busy =
        document.querySelector("#mobileMenu.is-open") ||
        (lightbox && !lightbox.hidden) ||
        document.querySelector(".modal-overlay:not([hidden]), #viewerModal:not([hidden])");
      if (!busy) {
        body.style.overflow = "";
        de.style.overflow = "";
      }
    }
  }
  ["pointerdown", "touchstart"].forEach(function (ev) {
    document.addEventListener(ev, unlockStuckScroll, { capture: true, passive: true });
  });
  ["pageshow", "popstate", "hashchange"].forEach(function (ev) {
    window.addEventListener(ev, unlockStuckScroll);
  });
  document.addEventListener("visibilitychange", unlockStuckScroll);
})();


/* ==========================================================================
   ألوان المنصة المتغيّرة (الأدمن بيحددها من لوحة التحكم وبتتخزن في Firebase: siteTheme)
   - بتتطبق فورًا من الكاش المحلي (من غير ومضة)، وبعدين بتتحدّث من Firebase.
   - 6 ألوان: ink / brand / accent / accentSoft / bg / bgSoft
   ========================================================================== */
(function () {
  "use strict";
  var KEY = "shadynasr-site-theme";
  var HEX = /^#[0-9a-f]{6}$/i;

  function rgb(h) { return [1, 3, 5].map(function (i) { return parseInt(h.substr(i, 2), 16); }); }
  function hex(a) { return "#" + a.map(function (v) { return Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0"); }).join(""); }
  function mix(a, b, t) { var x = rgb(a), y = rgb(b); return hex(x.map(function (v, i) { return v + (y[i] - v) * t; })); }
  // نص مقروء فوق لون معيّن (غامق فوق الألوان الفاتحة، وأبيض فوق الغامقة)
  function lum(h) {
    var c = rgb(h).map(function (v) { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); });
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  }
  function onColor(bg, dark, light) { return lum(bg) > 0.45 ? dark : light; }

  function css(t) {
    var ink = t.ink, brand = t.brand, acc = t.accent, accSoft = t.accentSoft, bg = t.bg, bgSoft = t.bgSoft;
    var accDark = mix(acc, "#000000", 0.18);
    var accLight = mix(acc, "#ffffff", 0.35);
    var light =
      ":root{--berry-950:" + ink + ";--berry-900:" + mix(ink, brand, 0.4) + ";--berry-800:" + brand +
      ";--berry-700:" + mix(brand, acc, 0.5) + ";--berry-500:" + mix(acc, "#ffffff", 0.12) +
      ";--vanilla:" + bg + ";--vanilla-dim:" + bgSoft +
      ";--sunset-500:" + acc + ";--sunset-600:" + accDark + ";--sunset-300:" + accSoft +
      ";--ink:" + ink + ";--ink-soft:" + mix(ink, bg, 0.35) + ";--surface-glass:" + mix(bg, "#ffffff", 0.55) +
      ";--accent-ink:" + onColor(acc, ink, "#ffffff") + ";--overlay:rgba(" + rgb(mix(ink, "#000000", 0.3)).join(",") + ",0.55);}";
    var dark =
      ':root[data-theme="dark"]{--bg:' + mix(ink, "#000000", 0.04) + ";--bg-soft:" + mix(ink, "#000000", 0.25) +
      ";--ink:" + bg + ";--ink-soft:" + mix(bg, ink, 0.35) + ";--surface-glass:" + mix(ink, brand, 0.3) +
      ";--brand:" + bg + ";--sunset-500:" + accLight + ";--sunset-600:" + mix(accLight, "#000000", 0.12) +
      ";--accent:" + accLight + ";--accent-ink:" + onColor(accLight, mix(ink, "#000000", 0.3), "#ffffff") + ";--overlay:rgba(0,0,0,0.62);--blob-a:" + mix(brand, acc, 0.5) + ";--blob-b:" + brand + ";}";
    return light + dark;
  }

  function valid(t) {
    return t && ["ink", "brand", "accent", "accentSoft", "bg", "bgSoft"].every(function (k) { return HEX.test(t[k] || ""); });
  }

  function apply(t) {
    var el = document.getElementById("sn-site-theme");
    if (!valid(t)) { if (el) el.remove(); return; }
    if (!el) {
      el = document.createElement("style");
      el.id = "sn-site-theme";
      (document.head || document.documentElement).appendChild(el);
    }
    el.textContent = css(t);
  }

  window.applySiteTheme = apply;

  /* ألوان الطالب الشخصية: بتتخزن لكل طالب لوحده (على جهازه + Firebase) وبتغلب على ألوان الأدمن.
     لو الطالب مسحها، بيرجع لألوان المنصة اللي الأدمن حاططها. الأدمن نفسه مش بيتأثر بيها. */
  var UKEY = "shadynasr-user-theme:";
  function me() {
    try {
      var u = JSON.parse(localStorage.getItem("shadynasr-current-user"));
      return u && u.id && u.role !== "admin" && localStorage.getItem("shadynasr-auth") ? u : null;
    } catch (e) { return null; }
  }
  function readUser() {
    var u = me();
    if (!u) return null;
    try { var t = JSON.parse(localStorage.getItem(UKEY + u.id)); return valid(t) ? t : null; } catch (e) { return null; }
  }
  function readSite() {
    try { var t = JSON.parse(localStorage.getItem(KEY)); return valid(t) ? t : null; } catch (e) { return null; }
  }
  function pick() { return readUser() || readSite(); }
  function pickShape(t) { var o = {}; ["ink", "brand", "accent", "accentSoft", "bg", "bgSoft"].forEach(function (k) { o[k] = t[k]; }); return o; }

  window.snUserTheme = {
    get: readUser,
    site: readSite,
    // معاينة فورية من غير حفظ
    preview: function (t) { if (valid(t)) apply(t); },
    // الرجوع للألوان المحفوظة (بتلغي المعاينة)
    revert: function () { apply(pick()); },
    save: function (t) {
      var u = me();
      if (!u || !valid(t)) return Promise.reject(new Error("NO_USER"));
      t = pickShape(t);
      try { localStorage.setItem(UKEY + u.id, JSON.stringify(t)); } catch (e) {}
      apply(t);
      if (window.SNAuth && window.SNAuth.saveUserFields) {
        return window.SNAuth.saveUserFields(u.id, { themeColors: t });
      }
      return Promise.resolve();
    },
    clear: function () {
      var u = me();
      if (!u) return Promise.resolve();
      try { localStorage.removeItem(UKEY + u.id); } catch (e) {}
      apply(readSite());
      if (window.SNAuth && window.SNAuth.saveUserFields) {
        return window.SNAuth.saveUserFields(u.id, { themeColors: null });
      }
      return Promise.resolve();
    },
    // مزامنة من Firebase لو الطالب فتح من جهاز تاني
    syncFromServer: function () {
      var u = me();
      if (!u || !u.email || !window.SNAuth || !window.SNAuth.findUserByEmail) return Promise.resolve();
      return window.SNAuth.findUserByEmail(u.email).then(function (rec) {
        var t = rec && rec.themeColors;
        try {
          if (valid(t)) { localStorage.setItem(UKEY + u.id, JSON.stringify(pickShape(t))); apply(pickShape(t)); }
          else if (readUser()) { localStorage.removeItem(UKEY + u.id); apply(readSite()); }
        } catch (e) {}
      }).catch(function () {});
    }
  };

  try { apply(pick()); } catch (e) {}

  function refresh() {
    if (!window.SNAuth || !window.SNAuth.fetchSiteTheme) return;
    window.SNAuth.fetchSiteTheme().then(function (t) {
      if (valid(t)) localStorage.setItem(KEY, JSON.stringify(t)); else localStorage.removeItem(KEY);
      apply(pick()); // ألوان الطالب (لو عنده) بتفضل أقوى من ألوان الأدمن
    }).catch(function () {});
  }
  window.addEventListener("load", function () { setTimeout(refresh, 50); });
})();


/* ==========================================================================
   هوية المنصة (اسم + لوجو): الأدمن بيحددهم من إعدادات المنصة وبيتخزنوا في Firebase (siteBranding)
   - بتتطبق فورًا من الكاش المحلي (من غير ومضة)، وبعدين بنقارن رقم الإصدار بتاع Firebase.
   - لو الطالب عنده نسخة قديمة: بيظهر شريط ثابت فوق "تحديث" لحد ما يضغط عليه.
   - بتتغير في: الهيدر، لوجو صفحة الدخول/اللوحات، أيقونة التبويب، عنوان الصفحة، النصوص المترجمة.
   ========================================================================== */
(function () {
  "use strict";
  var KEY = "shadynasr-site-branding";
  var DEF_FULL = "Shady Nasr English Platform";
  var LOGO_RE = /shady-nasr-logo/;
  var isAdminPage = /admin/i.test(window.location.pathname.split("/").pop() || "");
  var orig = { ar: {}, en: {} };

  function qsa(sel) { return Array.prototype.slice.call(document.querySelectorAll(sel)); }
  function read() {
    try { var b = JSON.parse(localStorage.getItem(KEY)); return b && typeof b === "object" ? b : null; } catch (e) { return null; }
  }
  function store(b) {
    try { localStorage.setItem(KEY, JSON.stringify(b)); }
    catch (e) { try { localStorage.setItem(KEY, JSON.stringify({ name: b.name, tagline: b.tagline, version: b.version, logo: "" })); } catch (e2) {} }
  }

  /* النصوص المترجمة اللي فيها اسم المنصة */
  function patchI18N(name) {
    if (typeof I18N === "undefined") return;
    ["ar", "en"].forEach(function (l) {
      var d = I18N[l];
      if (!d) return;
      Object.keys(d).forEach(function (k) {
        var v = d[k];
        if (typeof v !== "string") return;
        var base = orig[l][k] != null ? orig[l][k] : v;
        if (base.indexOf(DEF_FULL) === -1) return;
        orig[l][k] = base;
        d[k] = name ? base.split(DEF_FULL).join(name) : base;
      });
    });
    try { applyTranslations(document.documentElement.lang === "en" ? "en" : "ar"); } catch (e) {}
  }

  function mimeOf(src) { var m = /^data:([^;,]+)/.exec(src || ""); return m ? m[1] : ""; }

  function setLogos(src) {
    qsa("img").forEach(function (i) {
      var s = i.getAttribute("src") || "";
      if ((i.classList.contains("brand__mark") || LOGO_RE.test(s)) && s !== src) i.setAttribute("src", src);
    });
    var mime = mimeOf(src);
    qsa('link[rel~="icon"], link[rel="apple-touch-icon"]').forEach(function (l) {
      if (l.getAttribute("href") !== src) l.setAttribute("href", src);
      if (mime && l.getAttribute("rel") !== "apple-touch-icon") l.setAttribute("type", mime);
    });
  }

  function applyDom(b) {
    if (!b) return;
    var name = String(b.name || "").trim();
    var tag = String(b.tagline || "").trim();
    if (name) {
      qsa(".brand__name").forEach(function (el) { if (el.textContent !== name) el.textContent = name; });
      qsa("img.brand__mark").forEach(function (i) { if (i.alt !== name) i.alt = name; });
      qsa('meta[name="apple-mobile-web-app-title"]').forEach(function (m) { m.setAttribute("content", name); });
      if (document.title.indexOf(DEF_FULL) !== -1) document.title = document.title.split(DEF_FULL).join(name);
    }
    if (tag && !isAdminPage) qsa(".brand__tagline").forEach(function (el) { if (el.textContent !== tag) el.textContent = tag; });
    if (b.logo) setLogos(b.logo);
  }

  function apply(b) {
    if (!b) return;
    patchI18N(String(b.name || "").trim());
    applyDom(b);
  }

  /* عناصر بتتضاف بعد التحميل (لوحة الطالب بتترسم بالجافاسكريبت): نطبّق عليها برضه */
  function watch() {
    var queued = false;
    try {
      new MutationObserver(function () {
        if (queued) return;
        queued = true;
        requestAnimationFrame(function () { queued = false; applyDom(read()); });
      }).observe(document.documentElement, { childList: true, subtree: true });
    } catch (e) {}
  }

  function pull(meta) {
    var base = { name: meta.name || "", tagline: meta.tagline || "", version: Number(meta.version) || 0, logo: "" };
    if (!meta.hasLogo || !window.SNAuth || !window.SNAuth.fetchSiteBrandingLogo) return Promise.resolve(base);
    return window.SNAuth.fetchSiteBrandingLogo().then(function (data) { base.logo = data || ""; return base; });
  }

  function tr(k, fallback) { try { return t(k); } catch (e) { return fallback; } }

  function clearCaches() {
    var jobs = [];
    try { if (window.caches) jobs.push(caches.keys().then(function (ks) { return Promise.all(ks.map(function (k) { return caches.delete(k); })); })); } catch (e) {}
    try { if (navigator.serviceWorker) jobs.push(navigator.serviceWorker.getRegistration().then(function (r) { return r && r.update(); })); } catch (e) {}
    return Promise.race([Promise.all(jobs), new Promise(function (r) { setTimeout(r, 1500); })]);
  }

  function showBanner(meta) {
    if (document.getElementById("sn-upd")) return;
    if (!document.getElementById("sn-upd-css")) {
      var st = document.createElement("style");
      st.id = "sn-upd-css";
      st.textContent =
        "#sn-upd{position:fixed;top:0;left:0;right:0;z-index:2147483000;display:flex;align-items:center;justify-content:center;gap:12px;" +
        "padding:calc(env(safe-area-inset-top,0px) + 8px) 14px 8px;background:var(--accent,#2c8097);color:var(--accent-ink,#fff);" +
        "font-weight:700;font-size:.85rem;line-height:1.4;box-shadow:0 2px 12px rgba(0,0,0,.22)}" +
        "#sn-upd button{border:0;border-radius:999px;padding:7px 18px;font:inherit;font-weight:800;cursor:pointer;" +
        "background:var(--accent-ink,#fff);color:var(--accent,#2c8097);flex:none}" +
        "#sn-upd button:disabled{opacity:.6;cursor:default}" +
        "html.sn-has-upd{padding-top:var(--sn-upd-h,48px)}" +
        "html.sn-has-upd .navbar,html.sn-has-upd .dash-topbar,html.sn-has-upd .auth-topbar{top:var(--sn-upd-h,48px)!important}";
      document.head.appendChild(st);
    }
    var bar = document.createElement("div");
    bar.id = "sn-upd";
    bar.setAttribute("role", "status");
    var msg = document.createElement("span");
    msg.textContent = tr("brand_update_msg", "فيه تحديث جديد للمنصة");
    var btn = document.createElement("button");
    btn.type = "button";
    btn.textContent = tr("brand_update_btn", "تحديث");
    bar.appendChild(msg);
    bar.appendChild(btn);
    document.body.appendChild(bar);
    document.documentElement.style.setProperty("--sn-upd-h", bar.offsetHeight + "px");
    document.documentElement.classList.add("sn-has-upd");

    btn.addEventListener("click", function () {
      btn.disabled = true;
      pull(meta).then(function (b) {
        store(b);
        return clearCaches();
      }).then(function () {
        window.location.reload();
      }).catch(function () { btn.disabled = false; });
    });
  }

  function refresh() {
    if (!window.SNAuth || !window.SNAuth.fetchSiteBranding) return;
    window.SNAuth.fetchSiteBranding().then(function (meta) {
      var cached = read();
      if (!meta) return;
      var ver = Number(meta.version) || 0;
      if (cached && (Number(cached.version) || 0) === ver) return;
      if (!cached) {
        // أول مرة (مفيش نسخة قديمة تتحدّث): نطبّق من غير شريط
        pull(meta).then(function (b) { store(b); apply(b); }).catch(function () {});
      } else if (isAdminPage) {
        pull(meta).then(function (b) { store(b); window.location.reload(); }).catch(function () {});
      } else {
        showBanner(meta);
      }
    }).catch(function () {});
  }

  window.snBrand = {
    read: read,
    store: store,
    apply: apply,
    name: function () { var b = read(); return (b && b.name) || "Shady Nasr"; },
  };

  var cached0 = read();
  if (cached0) {
    patchI18N(String(cached0.name || "").trim());
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", function () { applyDom(read()); });
    else applyDom(cached0);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", watch);
  else watch();
  window.addEventListener("load", function () { setTimeout(refresh, 80); });
})();


/* ==========================================================================
   نوافذ التأكيد والتنبيه بتصميم المنصة (بديل confirm / alert بتوع المتصفح)
   الاستخدام:
     const ok = await snDialog.confirm({ title, message, confirmText, cancelText, tone: "danger", icon: "logout" });
     await snDialog.alert({ title, message, confirmText, icon: "info" });
   الألوان كلها من متغيّرات المنصة (var(--accent) / var(--bg) ...) فبتتغيّر مع ألوان الأدمن والدارك مود.
   ========================================================================== */
(function () {
  "use strict";
  var SV = 'viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"';
  var ICONS = {
    info: '<svg ' + SV + '><circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 7.5v.01"/></svg>',
    warn: '<svg ' + SV + '><path d="M12 3 2.5 20h19Z"/><path d="M12 10v4M12 17.2v.01"/></svg>',
    logout: '<svg ' + SV + '><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="M16 17l5-5-5-5"/><path d="M21 12H9"/></svg>',
    download: '<svg ' + SV + '><path d="M12 3v12M7 10l5 5 5-5M5 21h14"/></svg>',
    trash: '<svg ' + SV + '><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/></svg>'
  };
  var uid = 0;
  var open = [];            // النوافذ المفتوحة حاليًا (عشان نقدر نقفلها من برّه ونعرف لو في نافذة مفتوحة)
  var prevOverflow = "";

  function show(o, withCancel) {
    o = o || {};
    var ar = document.documentElement.lang !== "en";
    var danger = o.tone === "danger";
    return new Promise(function (resolve) {
      var prev = document.activeElement;
      var id = "snDlg" + (++uid);

      var ov = document.createElement("div");
      ov.className = "modal-overlay sn-dialog";

      var box = document.createElement("div");
      box.className = "modal";
      box.setAttribute("role", withCancel ? "alertdialog" : "dialog");
      box.setAttribute("aria-modal", "true");
      box.setAttribute("aria-labelledby", id + "t");
      box.setAttribute("aria-describedby", id + "m");

      var icon = document.createElement("span");
      icon.className = "modal__icon" + (danger ? " modal__icon--danger" : "");
      icon.setAttribute("aria-hidden", "true");
      icon.innerHTML = ICONS[o.icon] || ICONS[danger ? "warn" : "info"];

      var h = document.createElement("h3");
      h.id = id + "t";
      h.textContent = o.title || "";

      var p = document.createElement("p");
      p.id = id + "m";
      p.textContent = o.message || "";

      var actions = document.createElement("div");
      actions.className = "modal__actions";

      var ok = document.createElement("button");
      ok.type = "button";
      ok.className = "btn " + (danger ? "btn--sn-danger" : "btn--accent");
      ok.textContent = o.confirmText || (ar ? "تأكيد" : "Confirm");
      actions.appendChild(ok);

      var cancel = null;
      if (withCancel) {
        cancel = document.createElement("button");
        cancel.type = "button";
        cancel.className = "btn btn--ghost";
        cancel.textContent = o.cancelText || (ar ? "إلغاء" : "Cancel");
        actions.appendChild(cancel);
      }

      box.appendChild(icon);
      box.appendChild(h);
      if (o.message) box.appendChild(p);
      box.appendChild(actions);
      ov.appendChild(box);

      var done = false;
      function close(v) {
        if (done) return;
        done = true;
        open = open.filter(function (x) { return x.close !== close; });
        if (!open.length) document.body.style.overflow = prevOverflow;
        document.removeEventListener("keydown", onKey, true);
        ov.classList.remove("is-open");
        setTimeout(function () { ov.remove(); }, 220);
        if (prev && prev.focus) { try { prev.focus(); } catch (e) {} }
        resolve(v);
      }
      function onKey(e) {
        if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); close(withCancel ? false : true); return; }
        if (e.key === "Tab") {
          var items = cancel ? [ok, cancel] : [ok];
          var i = items.indexOf(document.activeElement);
          e.preventDefault();
          items[(i + (e.shiftKey ? items.length - 1 : 1)) % items.length].focus();
        }
      }

      ok.addEventListener("click", function () { close(true); });
      if (cancel) cancel.addEventListener("click", function () { close(false); });
      ov.addEventListener("click", function (e) { if (e.target === ov) close(withCancel ? false : true); });
      document.addEventListener("keydown", onKey, true);

      if (!open.length) { prevOverflow = document.body.style.overflow; document.body.style.overflow = "hidden"; }
      open.push({ tag: o.tag || "", close: close, withCancel: withCancel });
      document.body.appendChild(ov);
      requestAnimationFrame(function () {
        ov.classList.add("is-open");
        // في الإجراءات الخطرة التركيز يبدأ على "إلغاء" عشان الضغطة بالغلط ما تنفّذش حاجة
        (danger && cancel ? cancel : ok).focus();
      });
    });
  }

  /* ---------- قايمة اختيار بتصميم المنصة (بديل قايمة الموبايل الافتراضية) ---------- */
  function pick(o) {
    o = o || {};
    var ar = document.documentElement.lang !== "en";
    return new Promise(function (resolve) {
      var prev = document.activeElement;
      var ov = document.createElement("div");
      ov.className = "modal-overlay sn-dialog sn-pick";
      var box = document.createElement("div");
      box.className = "modal";
      box.setAttribute("role", "dialog");
      box.setAttribute("aria-modal", "true");
      if (o.title) {
        var h = document.createElement("h3");
        h.textContent = o.title;
        box.appendChild(h);
      }
      var ul = document.createElement("ul");
      ul.className = "sn-pick__list";
      ul.setAttribute("role", "listbox");
      (o.options || []).forEach(function (it) {
        var li = document.createElement("li");
        var b = document.createElement("button");
        b.type = "button";
        b.className = "sn-pick__item" + (String(it.value) === String(o.value) ? " is-selected" : "");
        b.setAttribute("role", "option");
        b.setAttribute("aria-selected", String(it.value) === String(o.value));
        var dot = document.createElement("span");
        dot.className = "sn-pick__dot";
        dot.setAttribute("aria-hidden", "true");
        var tx = document.createElement("span");
        tx.className = "sn-pick__text";
        tx.textContent = it.label;
        b.appendChild(tx);
        b.appendChild(dot);
        b.addEventListener("click", function () { close(it.value); });
        li.appendChild(b);
        ul.appendChild(li);
      });
      box.appendChild(ul);
      var cancel = document.createElement("button");
      cancel.type = "button";
      cancel.className = "btn btn--ghost sn-pick__cancel";
      cancel.textContent = o.cancelText || (ar ? "إلغاء" : "Cancel");
      cancel.addEventListener("click", function () { close(null); });
      box.appendChild(cancel);
      ov.appendChild(box);

      var done = false;
      function close(v) {
        if (done) return;
        done = true;
        open = open.filter(function (x) { return x.close !== close; });
        if (!open.length) document.body.style.overflow = prevOverflow;
        document.removeEventListener("keydown", onKey, true);
        ov.classList.remove("is-open");
        setTimeout(function () { ov.remove(); }, 220);
        if (prev && prev.focus) { try { prev.focus(); } catch (e) {} }
        resolve(v);
      }
      function onKey(e) { if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); close(null); } }
      ov.addEventListener("click", function (e) { if (e.target === ov) close(null); });
      document.addEventListener("keydown", onKey, true);

      if (!open.length) { prevOverflow = document.body.style.overflow; document.body.style.overflow = "hidden"; }
      open.push({ tag: "pick", close: close, withCancel: true });
      document.body.appendChild(ov);
      requestAnimationFrame(function () {
        ov.classList.add("is-open");
        var sel = ul.querySelector(".is-selected") || ul.querySelector("button");
        if (sel) { try { sel.scrollIntoView({ block: "center" }); sel.focus({ preventScroll: true }); } catch (e) {} }
      });
    });
  }

  /* ---------- منتقي الألوان بتصميم المنصة (بديل نافذة الألوان بتاعة النظام) ---------- */
  function hsv2rgb(h, s, v) {
    var f = function (n) { var k = (n + h / 60) % 6; return v - v * s * Math.max(0, Math.min(k, 4 - k, 1)); };
    return [f(5), f(3), f(1)].map(function (x) { return Math.round(x * 255); });
  }
  function rgb2hsv(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    var mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn, h = 0;
    if (d) {
      if (mx === r) h = ((g - b) / d) % 6; else if (mx === g) h = (b - r) / d + 2; else h = (r - g) / d + 4;
      h *= 60; if (h < 0) h += 360;
    }
    return [h, mx ? d / mx : 0, mx];
  }
  function toHex(rgb) { return "#" + rgb.map(function (x) { return x.toString(16).padStart(2, "0"); }).join(""); }
  function fromHex(h) { return [1, 3, 5].map(function (i) { return parseInt(h.substr(i, 2), 16); }); }
  var QUICK = ["#c0392b", "#d35400", "#e1a21b", "#2f8a5b", "#1f8f86", "#2c8097", "#2f6bc4", "#6a45a8", "#b03a5b", "#4f6a8a", "#1a1f26", "#ffffff"];

  function color(o) {
    o = o || {};
    var ar = document.documentElement.lang !== "en";
    var start = /^#[0-9a-f]{6}$/i.test(o.value || "") ? o.value.toLowerCase() : "#2c8097";
    return new Promise(function (resolve) {
      var prev = document.activeElement;
      var hsv = rgb2hsv.apply(null, fromHex(start));
      var ov = document.createElement("div");
      ov.className = "modal-overlay sn-dialog sn-color";
      var box = document.createElement("div");
      box.className = "modal";
      box.setAttribute("role", "dialog");
      box.setAttribute("aria-modal", "true");

      var h3 = document.createElement("h3");
      h3.textContent = o.title || (ar ? "اختار اللون" : "Pick a color");
      box.appendChild(h3);

      var sv = document.createElement("div");
      sv.className = "sn-color__sv";
      sv.setAttribute("aria-label", ar ? "الدرجة والسطوع" : "Saturation and brightness");
      var svThumb = document.createElement("span");
      svThumb.className = "sn-color__thumb";
      sv.appendChild(svThumb);
      box.appendChild(sv);

      var hue = document.createElement("div");
      hue.className = "sn-color__hue";
      hue.setAttribute("aria-label", ar ? "درجة اللون" : "Hue");
      var hueThumb = document.createElement("span");
      hueThumb.className = "sn-color__thumb";
      hue.appendChild(hueThumb);
      box.appendChild(hue);

      var row = document.createElement("div");
      row.className = "sn-color__row";
      var chip = document.createElement("span");
      chip.className = "sn-color__chip";
      var hexIn = document.createElement("input");
      hexIn.type = "text";
      hexIn.className = "sn-color__hex";
      hexIn.maxLength = 7;
      hexIn.dir = "ltr";
      hexIn.spellcheck = false;
      hexIn.autocapitalize = "off";
      hexIn.setAttribute("aria-label", "HEX");
      row.appendChild(chip);
      row.appendChild(hexIn);
      box.appendChild(row);

      var sw = document.createElement("div");
      sw.className = "sn-color__swatches";
      QUICK.forEach(function (c) {
        var b = document.createElement("button");
        b.type = "button";
        b.style.background = c;
        b.setAttribute("aria-label", c);
        b.addEventListener("click", function () { hsv = rgb2hsv.apply(null, fromHex(c)); paint(true); });
        sw.appendChild(b);
      });
      box.appendChild(sw);

      var actions = document.createElement("div");
      actions.className = "modal__actions sn-color__actions";
      var ok = document.createElement("button");
      ok.type = "button"; ok.className = "btn btn--accent"; ok.textContent = o.confirmText || (ar ? "تطبيق" : "Apply");
      var cancel = document.createElement("button");
      cancel.type = "button"; cancel.className = "btn btn--ghost"; cancel.textContent = o.cancelText || (ar ? "إلغاء" : "Cancel");
      actions.appendChild(ok); actions.appendChild(cancel);
      box.appendChild(actions);
      ov.appendChild(box);

      function cur() { return toHex(hsv2rgb(hsv[0], hsv[1], hsv[2])); }
      function paint(emit, skipHex) {
        var hx = cur();
        sv.style.background = "linear-gradient(to top,#000,transparent),linear-gradient(to right,#fff,hsl(" + hsv[0] + ",100%,50%))";
        svThumb.style.insetInlineStart = "auto";
        svThumb.style.left = (hsv[1] * 100) + "%";
        svThumb.style.top = ((1 - hsv[2]) * 100) + "%";
        svThumb.style.background = hx;
        hueThumb.style.left = (hsv[0] / 360 * 100) + "%";
        hueThumb.style.background = "hsl(" + hsv[0] + ",100%,50%)";
        chip.style.background = hx;
        if (!skipHex) hexIn.value = hx;
        if (emit && o.onInput) { try { o.onInput(hx); } catch (e) {} }
      }
      // السحب بالإصبع/الماوس
      function drag(el, fn) {
        function move(e) { var r = el.getBoundingClientRect(); fn(Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)), Math.min(1, Math.max(0, (e.clientY - r.top) / r.height))); paint(true); }
        el.addEventListener("pointerdown", function (e) {
          e.preventDefault();
          try { el.setPointerCapture(e.pointerId); } catch (x) {}
          move(e);
          var mv = function (ev) { move(ev); };
          var up = function () { el.removeEventListener("pointermove", mv); el.removeEventListener("pointerup", up); el.removeEventListener("pointercancel", up); };
          el.addEventListener("pointermove", mv); el.addEventListener("pointerup", up); el.addEventListener("pointercancel", up);
        });
      }
      drag(sv, function (x, y) { hsv[1] = x; hsv[2] = 1 - y; });
      drag(hue, function (x) { hsv[0] = x * 359.99; });
      hexIn.addEventListener("input", function () {
        var v = hexIn.value.trim();
        if (v && v.charAt(0) !== "#") v = "#" + v;
        if (/^#[0-9a-f]{6}$/i.test(v)) { hsv = rgb2hsv.apply(null, fromHex(v.toLowerCase())); paint(true, true); }
      });

      var done = false;
      function close(v) {
        if (done) return;
        done = true;
        open = open.filter(function (x) { return x.close !== close; });
        if (!open.length) document.body.style.overflow = prevOverflow;
        document.removeEventListener("keydown", onKey, true);
        ov.classList.remove("is-open");
        setTimeout(function () { ov.remove(); }, 220);
        if (prev && prev.focus) { try { prev.focus(); } catch (e) {} }
        resolve(v);
      }
      function onKey(e) {
        if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); close(null); }
        else if (e.key === "Enter" && document.activeElement === hexIn) { e.preventDefault(); close(cur()); }
      }
      ok.addEventListener("click", function () { close(cur()); });
      cancel.addEventListener("click", function () { close(null); });
      ov.addEventListener("click", function (e) { if (e.target === ov) close(null); });
      document.addEventListener("keydown", onKey, true);

      if (!open.length) { prevOverflow = document.body.style.overflow; document.body.style.overflow = "hidden"; }
      open.push({ tag: "color", close: close, withCancel: true });
      document.body.appendChild(ov);
      paint(false);
      requestAnimationFrame(function () { ov.classList.add("is-open"); ok.focus({ preventScroll: true }); });
    });
  }

  var toastEl = null, toastTimer = null;
  function toast(msg, o) {
    o = o || {};
    if (!toastEl) {
      toastEl = document.createElement("div");
      toastEl.className = "sn-toast";
      toastEl.setAttribute("aria-live", "polite");
      toastEl.appendChild(document.createElement("span"));
      document.body.appendChild(toastEl);
    }
    toastEl.firstChild.textContent = msg;
    toastEl.classList.toggle("is-error", !!o.error);
    toastEl.classList.add("is-show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toastEl.classList.remove("is-show"); }, o.ms || 4000);
  }

  window.snDialog = {
    confirm: function (o) { return show(o, true); },
    alert: function (o) { return show(o, false); },
    toast: toast,
    pick: pick,
    color: color,
    isOpen: function () { return open.length > 0; },
    closeByTag: function (tag) {
      open.filter(function (x) { return x.tag === tag; }).forEach(function (x) { x.close(x.withCancel ? false : true); });
    }
  };
})();

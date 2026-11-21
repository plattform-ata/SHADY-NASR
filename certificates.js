/* ==========================================================================
   certificates.js — شهادات التقدير الشهرية + نافذة عرض الصور (شهادة / شارة)
   - SNCert.render(rec)  : بيرسم الشهادة كصورة (Canvas) بالإنجليزي، باسم الطالب ولوجو المنصة
   - SNCert.open(rec)    : بيفتح الشهادة في نافذة بنفس ستايل الموقع، فيها قايمة ⋮ (تحميل / طباعة / مشاركة)
   - SNCert.view(opts)   : نفس النافذة لأي صورة بتتولّد (بنستخدمها للشارات)
   السجل: { id, name, rank, gain, bonus, month: "YYYY-MM", createdAt }
   ========================================================================== */
(function () {
  "use strict";
  if (window.SNCert) return;

  var LOGO_SRC = "shady-nasr-logo.png";
  var TEACHER = "Mr. Shady Nasr";
  var PLATFORM = "SHADY NASR PLATFORM";
  var W = 2000, H = 1550;
  var SCRIPT = '"Pinyon Script", "Great Vibes", "Segoe Script", cursive';
  var SERIF = '"Cormorant Garamond", Georgia, "Times New Roman", serif';
  var ARABIC_NAME = '"Katibeh", "Aref Ruqaa", "Amiri", "Cairo", serif';
  var INK = "#16465c", INK2 = "#2c6a85", SOFT = "#5f7f8c";
  var SANS = '"Poppins", "Cairo", "Segoe UI", Arial, sans-serif';
  var ARABIC = '"Cairo", "Tajawal", "Segoe UI", Arial, sans-serif';

  var curLang = function () { return document.documentElement.lang === "en" ? "en" : "ar"; };
  var TXT = {
    ar: { cert: "شهادة تقدير", more: "المزيد", close: "إغلاق", download: "تحميل الصورة", print: "طباعة", share: "مشاركة",
      loading: "جاري تجهيز الصورة…", fail: "تعذر تجهيز الصورة — حاول تاني بعد شوية", saved: "اتحمّلت الصورة على جهازك",
      noShare: "المشاركة مش متاحة على الجهاز ده — اتحمّلت الصورة بدلًا منها", printFail: "تعذرت الطباعة — حمّل الصورة واطبعها" },
    en: { cert: "Certificate of appreciation", more: "More", close: "Close", download: "Download image", print: "Print", share: "Share",
      loading: "Preparing the image…", fail: "Couldn't prepare the image. Please try again.", saved: "Image saved to your device",
      noShare: "Sharing isn't available on this device — the image was downloaded instead", printFail: "Printing failed — download the image and print it" }
  };
  var tx = function (k) { return (TXT[curLang()] || TXT.ar)[k] || k; };

  /* ---------- أدوات صغيرة ---------- */
  var MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  function monthLabel(m) {
    var p = String(m || "").split("-");
    var i = Number(p[1]) - 1;
    return (MONTHS[i] || "") + (p[0] ? " " + p[0] : "");
  }
  function dateLabel(v) {
    var d = new Date(v || Date.now());
    if (isNaN(d.getTime())) d = new Date();
    return d.getDate() + " " + MONTHS[d.getMonth()] + " " + d.getFullYear();
  }
  function slug(s) { return String(s || "").replace(/[^\w\u0600-\u06FF]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40) || "certificate"; }

  /* ---------- التشكيل التلقائي للأسماء العربي ----------
     - لو الاسم فيه تشكيل أصلًا (الأدمن كتبه) بنسيبه زي ما هو.
     - غير كده بنشكّل الكلمات الموجودة في القاموس بس (تشكيل متأكد منه)،
       والكلمة اللي مش في القاموس بتفضل زي ما هي بدل ما نغلط فيها. */
  var NAMES_TASHKEEL = {"الحي": "الْحَيّ", "عبدالحي": "عَبْدُ الْحَيّ", "محمد": "مُحَمَّد", "احمد": "أَحْمَد", "محمود": "مَحْمُود", "مصطفي": "مُصْطَفَى", "ابراهيم": "إِبْرَاهِيم", "اسماعيل": "إِسْمَاعِيل", "يوسف": "يُوسُف", "عمر": "عُمَر", "علي": "عَلِيّ", "عثمان": "عُثْمَان", "خالد": "خَالِد", "كريم": "كَرِيم", "طارق": "طَارِق", "ياسر": "يَاسِر", "حسن": "حَسَن", "حسين": "حُسَيْن", "حسام": "حُسَام", "ايمن": "أَيْمَن", "اسامه": "أُسَامَة", "عمرو": "عَمْرو", "امير": "أَمِير", "انور": "أَنْوَر", "اشرف": "أَشْرَف", "اكرم": "أَكْرَم", "امجد": "أَمْجَد", "ايهاب": "إِيهَاب", "اسلام": "إِسْلَام", "باسل": "بَاسِل", "بدر": "بَدْر", "براء": "بَرَاء", "بسام": "بَسَّام", "تامر": "تَامِر", "تميم": "تَمِيم", "توفيق": "تَوْفِيق", "ثابت": "ثَابِت", "جابر": "جَابِر", "جلال": "جَلَال", "جهاد": "جِهَاد", "حازم": "حَازِم", "حاتم": "حَاتِم", "حامد": "حَامِد", "حمدي": "حَمْدِي", "حمزه": "حَمْزَة", "خليل": "خَلِيل", "خيري": "خَيْرِي", "داود": "دَاوُد", "داوود": "دَاوُود", "رافت": "رَأْفَت", "رائد": "رَائِد", "ربيع": "رَبِيع", "رجب": "رَجَب", "رشاد": "رَشَاد", "رضا": "رِضَا", "رمضان": "رَمَضَان", "رياض": "رِيَاض", "زكريا": "زَكَرِيَّا", "زكي": "زَكِي", "زين": "زَيْن", "سالم": "سَالِم", "سراج": "سِرَاج", "سعد": "سَعْد", "سعيد": "سَعِيد", "سلطان": "سُلْطَان", "سليم": "سَلِيم", "سليمان": "سُلَيْمَان", "سمير": "سَمِير", "سهيل": "سُهَيْل", "شريف": "شَرِيف", "شعبان": "شَعْبَان", "شهاب": "شِهَاب", "صالح": "صَالِح", "صبري": "صَبْرِي", "صفوت": "صَفْوَت", "ضياء": "ضِيَاء", "طلعت": "طَلْعَت", "طه": "طَه", "عادل": "عَادِل", "عاصم": "عَاصِم", "عاطف": "عَاطِف", "عامر": "عَامِر", "عباس": "عَبَّاس", "عبيد": "عُبَيْد", "عدنان": "عَدْنَان", "عزت": "عِزَّت", "عصام": "عِصَام", "عطيه": "عَطِيَّة", "علاء": "عَلَاء", "عماد": "عِمَاد", "عمار": "عَمَّار", "عوض": "عَوَض", "غسان": "غَسَّان", "فادي": "فَادِي", "فارس": "فَارِس", "فتحي": "فَتْحِي", "فهد": "فَهْد", "فوزي": "فَوْزِي", "فؤاد": "فُؤَاد", "قاسم": "قَاسِم", "كامل": "كَامِل", "ماجد": "مَاجِد", "مالك": "مَالِك", "مجدي": "مَجْدِي", "محسن": "مُحْسِن", "مدحت": "مِدْحَت", "مراد": "مُرَاد", "مرسي": "مُرْسِي", "مسعد": "مَسْعَد", "مسعود": "مَسْعُود", "معاذ": "مُعَاذ", "معتز": "مُعْتَز", "ممدوح": "مَمْدُوح", "منذر": "مُنْذِر", "منصور": "مَنْصُور", "منير": "مُنِير", "مهدي": "مَهْدِي", "مؤمن": "مُؤْمِن", "ناجي": "نَاجِي", "ناصر": "نَاصِر", "نبيل": "نَبِيل", "نصر": "نَصْر", "نعمان": "نُعْمَان", "هادي": "هَادِي", "هاشم": "هَاشِم", "هلال": "هِلَال", "همام": "هُمَام", "هيثم": "هَيْثَم", "وليد": "وَلِيد", "وجدي": "وَجْدِي", "ياسين": "يَاسِين", "يزن": "يَزَن", "يسري": "يُسْرِي", "يونس": "يُونُس", "يحيي": "يَحْيَى", "ادم": "آدَم", "موسي": "مُوسَى", "عيسي": "عِيسَى", "هشام": "هِشَام", "صلاح": "صَلَاح", "جمال": "جَمَال", "كمال": "كَمَال", "نور": "نُور", "سيف": "سَيْف", "سيد": "سَيِّد", "وسام": "وَسَام", "ثروت": "ثَرْوَت", "جمعه": "جُمْعَة", "عرفه": "عَرَفَة", "بكر": "بَكْر", "ابو": "أَبُو", "ماهر": "مَاهِر", "شادي": "شَادِي", "سامح": "سَامِح", "سامي": "سَامِي", "رامي": "رَامِي", "هاني": "هَانِي", "وائل": "وَائِل", "باسم": "بَاسِم", "مروان": "مَرْوَان", "مازن": "مَازِن", "زياد": "زِيَاد", "بلال": "بِلَال", "انس": "أَنَس", "عبده": "عَبْدُه", "اياد": "إِيَاد", "اياس": "إِيَاس", "ايوب": "أَيُّوب", "نوح": "نُوح", "سامر": "سَامِر", "مجاهد": "مُجَاهِد", "حبيب": "حَبِيب", "رامز": "رَامِز", "فاطمه": "فَاطِمَة", "مريم": "مَرْيَم", "ساره": "سَارَة", "مني": "مُنَى", "منه": "مِنَّة", "هدي": "هُدَى", "رنا": "رَنَا", "دينا": "دِينَا", "ندي": "نَدَى", "نهي": "نُهَى", "ياسمين": "يَاسْمِين", "اسماء": "أَسْمَاء", "عائشه": "عَائِشَة", "خديجه": "خَدِيجَة", "زينب": "زَيْنَب", "امل": "أَمَل", "ايمان": "إِيمَان", "هبه": "هِبَة", "شيماء": "شَيْمَاء", "رحمه": "رَحْمَة", "جنه": "جَنَّة", "سلمي": "سَلْمَى", "ليلي": "لَيْلَى", "اميره": "أَمِيرَة", "ايه": "آيَة", "الاء": "آلَاء", "بسمه": "بَسْمَة", "ثريا": "ثُرَيَّا", "جميله": "جَمِيلَة", "حبيبه": "حَبِيبَة", "حنان": "حَنَان", "خلود": "خُلُود", "رباب": "رَبَاب", "رشا": "رَشَا", "رضوي": "رَضْوَى", "زهره": "زَهْرَة", "سلوي": "سَلْوَى", "سندس": "سُنْدُس", "سهي": "سُهَى", "سوسن": "سَوْسَن", "صفاء": "صَفَاء", "صفيه": "صَفِيَّة", "ضحي": "ضُحَى", "عفاف": "عَفَاف", "غاده": "غَادَة", "فرح": "فَرَح", "فريده": "فَرِيدَة", "لبني": "لُبْنَى", "مها": "مَهَا", "مروه": "مَرْوَة", "نجلاء": "نَجْلَاء", "نجوي": "نَجْوَى", "نسمه": "نَسْمَة", "نشوي": "نَشْوَى", "هاله": "هَالَة", "هاجر": "هَاجَر", "هند": "هِنْد", "وفاء": "وَفَاء", "ولاء": "وَلَاء", "يارا": "يَارَا", "دعاء": "دُعَاء", "سمر": "سَمَر", "سميه": "سُمَيَّة", "شهد": "شَهْد", "ملك": "مَلَك", "جني": "جَنَى", "لجين": "لُجَيْن", "روان": "رَوَان", "تقي": "تُقَى", "نهال": "نِهَال", "هنا": "هَنَا", "لين": "لِين", "ليان": "لِيَان", "مرام": "مَرَام", "مي": "مَي", "ميار": "مَيَار", "رحاب": "رِحَاب", "رغد": "رَغَد", "ريهام": "رِيهَام", "شروق": "شُرُوق", "اسراء": "إِسْرَاء", "علا": "عُلَا", "علياء": "عُلْيَاء", "عبير": "عَبِير", "اروي": "أَرْوَى", "رقيه": "رُقَيَّة", "هدير": "هَدِير", "ريم": "رِيم", "نادين": "نَادِين", "يمني": "يُمْنَى", "حور": "حُور", "حياه": "حَيَاة", "رنيم": "رَنِيم", "تسنيم": "تَسْنِيم", "عزه": "عَزَّة", "هناء": "هَنَاء", "سعاد": "سُعَاد", "سميره": "سَمِيرَة", "لمياء": "لَمْيَاء", "زينه": "زَيْنَة", "جمانه": "جُمَانَة", "امال": "آمَال", "اماني": "أَمَانِي", "امينه": "أَمِينَة", "ماجده": "مَاجِدَة", "رانيا": "رَانِيَا", "الشرقاوي": "الشَّرْقَاوِي", "السيد": "السَّيِّد", "النجار": "النَّجَّار", "الجمال": "الْجَمَال", "الشافعي": "الشَّافِعِي", "المصري": "الْمِصْرِي", "الصاوي": "الصَّاوِي", "الدسوقي": "الدَّسُوقِي", "البدوي": "الْبَدَوِي", "الحداد": "الْحَدَّاد", "السعيد": "السَّعِيد", "العربي": "الْعَرَبِي", "الجندي": "الْجُنْدِي", "الشريف": "الشَّرِيف", "الطحان": "الطَّحَّان", "الخولي": "الْخَوْلِي", "البنا": "الْبَنَّا", "العطار": "الْعَطَّار", "الصياد": "الصَّيَّاد", "الفقي": "الْفَقِي", "الشاذلي": "الشَّاذِلِي", "الحسيني": "الْحُسَيْنِي", "الهواري": "الْهَوَّارِي", "الزيات": "الزَّيَّات", "القاضي": "الْقَاضِي", "الباز": "الْبَاز", "الشاعر": "الشَّاعِر", "الملاح": "الْمَلَّاح", "الحلواني": "الْحَلْوَانِي", "العدوي": "الْعَدَوِي", "الجزار": "الْجَزَّار", "السقا": "السَّقَّا", "الشامي": "الشَّامِي", "الحلبي": "الْحَلَبِي", "المغربي": "الْمَغْرِبِي", "الصعيدي": "الصَّعِيدِي", "المنشاوي": "الْمَنْشَاوِي", "المنياوي": "الْمِنْيَاوِي", "الاسيوطي": "الْأَسْيُوطِي", "الاسكندراني": "الْإِسْكَنْدَرَانِي", "القاهري": "الْقَاهِرِي", "الغزالي": "الْغَزَالِي", "المهدي": "الْمَهْدِي", "الجوهري": "الْجَوْهَرِي", "الخطيب": "الْخَطِيب", "الشناوي": "الشِّنَاوِي", "الحريري": "الْحَرِيرِي", "العقاد": "الْعَقَّاد", "الحسن": "الْحَسَن", "الدين": "الدِّين", "الاسلام": "الْإِسْلَام", "الله": "اللَّه", "الرحمن": "الرَّحْمَن", "الرحيم": "الرَّحِيم", "العزيز": "الْعَزِيز", "الكريم": "الْكَرِيم", "الفتاح": "الْفَتَّاح", "الحميد": "الْحَمِيد", "المنعم": "الْمُنْعِم", "القادر": "الْقَادِر", "الناصر": "النَّاصِر", "السلام": "السَّلَام", "الحكيم": "الْحَكِيم", "الهادي": "الْهَادِي", "الرازق": "الرَّازِق", "الرزاق": "الرَّزَّاق", "الحليم": "الْحَلِيم", "الجواد": "الْجَوَّاد", "الغني": "الْغَنِي", "الباسط": "الْبَاسِط", "المجيد": "الْمَجِيد", "المعطي": "الْمُعْطِي", "الوهاب": "الْوَهَّاب", "الستار": "السَّتَّار", "الصبور": "الصَّبُور", "الباقي": "الْبَاقِي", "اللطيف": "اللَّطِيف", "الخالق": "الْخَالِق", "المحسن": "الْمُحْسِن", "الرؤوف": "الرَّؤُوف", "الودود": "الْوَدُود", "الواحد": "الْوَاحِد", "الجليل": "الْجَلِيل", "الشافي": "الشَّافِي", "السميع": "السَّمِيع", "البصير": "الْبَصِير", "الغفار": "الْغَفَّار", "العليم": "الْعَلِيم", "القوي": "الْقَوِي", "الملك": "الْمَلِك", "الباري": "الْبَارِي", "النبي": "النَّبِي", "التواب": "التَّوَّاب", "المعبود": "الْمَعْبُود", "الموجود": "الْمَوْجُود", "الحافظ": "الْحَافِظ", "الظاهر": "الظَّاهِر", "العال": "الْعَال", "الصمد": "الصَّمَد", "المقصود": "الْمَقْصُود", "عبدالله": "عَبْدُ اللَّه", "عبدالرحمن": "عَبْدُ الرَّحْمَن", "عبدالرحيم": "عَبْدُ الرَّحِيم", "عبدالعزيز": "عَبْدُ الْعَزِيز", "عبدالكريم": "عَبْدُ الْكَرِيم", "عبدالفتاح": "عَبْدُ الْفَتَّاح", "عبدالحميد": "عَبْدُ الْحَمِيد", "عبدالمنعم": "عَبْدُ الْمُنْعِم", "عبدالقادر": "عَبْدُ الْقَادِر", "عبدالناصر": "عَبْدُ النَّاصِر", "عبدالسلام": "عَبْدُ السَّلَام", "عبدالحكيم": "عَبْدُ الْحَكِيم", "عبدالهادي": "عَبْدُ الْهَادِي", "عبدالرازق": "عَبْدُ الرَّازِق", "عبدالرزاق": "عَبْدُ الرَّزَّاق", "عبدالحليم": "عَبْدُ الْحَلِيم", "عبدالجواد": "عَبْدُ الْجَوَّاد", "عبدالغني": "عَبْدُ الْغَنِي", "عبدالباسط": "عَبْدُ الْبَاسِط", "عبدالمجيد": "عَبْدُ الْمَجِيد", "عبدالمعطي": "عَبْدُ الْمُعْطِي", "عبدالوهاب": "عَبْدُ الْوَهَّاب", "عبدالستار": "عَبْدُ السَّتَّار", "عبدالصبور": "عَبْدُ الصَّبُور", "عبدالباقي": "عَبْدُ الْبَاقِي", "عبداللطيف": "عَبْدُ اللَّطِيف", "عبدالخالق": "عَبْدُ الْخَالِق", "عبدالمحسن": "عَبْدُ الْمُحْسِن", "عبدالرؤوف": "عَبْدُ الرَّؤُوف", "عبدالودود": "عَبْدُ الْوَدُود", "عبدالواحد": "عَبْدُ الْوَاحِد", "عبدالجليل": "عَبْدُ الْجَلِيل", "عبدالشافي": "عَبْدُ الشَّافِي", "عبدالسميع": "عَبْدُ السَّمِيع", "عبدالبصير": "عَبْدُ الْبَصِير", "عبدالغفار": "عَبْدُ الْغَفَّار", "عبدالعليم": "عَبْدُ الْعَلِيم", "عبدالقوي": "عَبْدُ الْقَوِي", "عبدالملك": "عَبْدُ الْمَلِك", "عبدالباري": "عَبْدُ الْبَارِي", "عبدالنبي": "عَبْدُ النَّبِي", "عبدالتواب": "عَبْدُ التَّوَّاب", "عبدالمعبود": "عَبْدُ الْمَعْبُود", "عبدالموجود": "عَبْدُ الْمَوْجُود", "عبدالحافظ": "عَبْدُ الْحَافِظ", "عبدالظاهر": "عَبْدُ الظَّاهِر", "عبدالعال": "عَبْدُ الْعَال", "عبدالصمد": "عَبْدُ الصَّمَد", "عبدالمقصود": "عَبْدُ الْمَقْصُود", "الرحمان": "الرَّحْمَن", "عبدالرحمان": "عَبْدُ الرَّحْمَن"};
  var HARAKAT_RE = /[\u064B-\u0652\u0670]/;
  function normKey(w) { return w.replace(/[\u064B-\u0652\u0670\u0640]/g, "").replace(/[أإآٱ]/g, "ا").replace(/ى/g, "ي").replace(/ة/g, "ه"); }
  function tashkeel(name) {
    var s = String(name || "").trim();
    if (!s || HARAKAT_RE.test(s)) return s;
    var out = [], afterAbd = false, unknown = [];
    s.split(/\s+/).forEach(function (w) {
      var k = normKey(w), v = NAMES_TASHKEEL[k];
      if (k === "عبد") { out.push("عَبْدُ"); afterAbd = true; return; }
      if (v) { if (afterAbd && !/[يى]$/.test(v)) v += "\u0650"; out.push(v); } else { out.push(w); unknown.push(w); }
      afterAbd = false;
    });
    if (unknown.length && window.console && console.warn) console.warn("SNCert: no tashkeel for ->", unknown.join(" "));
    return out.join(" ");
  }
  /* لإضافة أسماء جديدة من أي مكان: SNCert.addNames({ "اسم": "اسْم" }) */
  function addNames(map) { Object.keys(map || {}).forEach(function (k) { NAMES_TASHKEEL[normKey(k)] = map[k]; }); }
  var hasArabic = function (s) { return /[\u0600-\u06FF]/.test(String(s || "")); };

  var fontsP = null;
  function ensureFonts() {
    if (fontsP) return fontsP;
    if (!document.getElementById("snCertFonts")) {
      var l = document.createElement("link");
      l.id = "snCertFonts"; l.rel = "stylesheet";
      l.href = "https://fonts.googleapis.com/css2?family=Pinyon+Script&family=Cormorant+Garamond:ital,wght@1,500;1,600;1,700&family=Katibeh&family=Cairo:wght@600;800&display=swap";
      document.head.appendChild(l);
    }
    var loads = ["italic 500 30px 'Cormorant Garamond'", "italic 600 30px 'Cormorant Garamond'", "italic 700 30px 'Cormorant Garamond'", "400 60px 'Pinyon Script'", "400 60px Katibeh", "800 40px Cairo"]
      .map(function (f) { return document.fonts && document.fonts.load ? document.fonts.load(f).catch(function () { }) : Promise.resolve(); });
    var timeout = new Promise(function (r) { setTimeout(r, 3500); });
    fontsP = Promise.race([Promise.all(loads), timeout]);
    return fontsP;
  }

  var logoP = null;
  function loadLogo() {
    if (logoP) return logoP;
    logoP = new Promise(function (res) {
      var im = new Image();
      im.onload = function () { res(im); };
      im.onerror = function () { res(null); };
      im.src = LOGO_SRC;
    });
    return logoP;
  }

  function roundPoly(ctx, pts, r) {
    var n = pts.length;
    ctx.beginPath();
    for (var i = 0; i < n; i++) {
      var p0 = pts[(i - 1 + n) % n], p1 = pts[i], p2 = pts[(i + 1) % n];
      var d1 = Math.hypot(p0.x - p1.x, p0.y - p1.y), d2 = Math.hypot(p2.x - p1.x, p2.y - p1.y);
      var d = Math.min(r, d1 / 2, d2 / 2);
      var a = { x: p1.x + (p0.x - p1.x) / d1 * d, y: p1.y + (p0.y - p1.y) / d1 * d };
      var b = { x: p1.x + (p2.x - p1.x) / d2 * d, y: p1.y + (p2.y - p1.y) / d2 * d };
      if (i) ctx.lineTo(a.x, a.y); else ctx.moveTo(a.x, a.y);
      ctx.quadraticCurveTo(p1.x, p1.y, b.x, b.y);
    }
    ctx.closePath();
  }
  function lin(ctx, x0, y0, x1, y1, stops) {
    var g = ctx.createLinearGradient(x0, y0, x1, y1);
    stops.forEach(function (s, i) { g.addColorStop(i / (stops.length - 1), s); });
    return g;
  }
  var GOLD = ["#fbe38e", "#d9a23a", "#a9741c", "#e8bb55", "#fbe38e"];
  var MAROON = ["#4a070c", "#8f1a21", "#5e0b11"];
  var BLACK = ["#161616", "#2d2d2d", "#171717"];

  function wrap(ctx, text, maxW) {
    var words = String(text).split(/\s+/), lines = [], cur = "";
    words.forEach(function (w) {
      var t = cur ? cur + " " + w : w;
      if (ctx.measureText(t).width > maxW && cur) { lines.push(cur); cur = w; } else cur = t;
    });
    if (cur) lines.push(cur);
    return lines;
  }
  function spaced(ctx, text, x, y, sp, align) {
    var chars = String(text).split(""), widths = chars.map(function (c) { return ctx.measureText(c).width; });
    var total = widths.reduce(function (a, b) { return a + b; }, 0) + sp * (chars.length - 1);
    var cx = align === "right" ? x - total : align === "center" ? x - total / 2 : x;
    ctx.textAlign = "left";
    chars.forEach(function (c, i) { ctx.fillText(c, cx, y); cx += widths[i] + sp; });
    return total;
  }

  function laurel(ctx, cx, cy, r, color, leaf, count) {
    ctx.fillStyle = color;
    for (var s = -1; s <= 1; s += 2) {
      for (var i = 0; i < count; i++) {
        var t = i / (count - 1), a = (0.5 + 0.95 * t) * Math.PI / 2 + 0.05; // من تحت لفوق
        var ang = s < 0 ? Math.PI - a + 0.0 : a; // يمين/شمال
        var px = cx + r * Math.cos(ang), py = cy + r * Math.sin(ang);
        ctx.save();
        ctx.translate(px, py);
        ctx.rotate(ang + (s < 0 ? -1 : 1) * (Math.PI / 2 + 0.55));
        ctx.beginPath();
        ctx.ellipse(0, 0, leaf * 0.55, leaf * 0.22, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    }
  }

  function rosette(ctx, cx, cy, R, label, logo) {
    // الشريط الذهبي اللي تحت الوردة
    [-1, 1].forEach(function (s) {
      ctx.save();
      ctx.translate(cx + s * 22, cy + R * 0.55);
      ctx.rotate(s * 0.22);
      ctx.beginPath();
      ctx.moveTo(-52, 0); ctx.lineTo(52, 0); ctx.lineTo(52, 270); ctx.lineTo(0, 225); ctx.lineTo(-52, 270); ctx.closePath();
      ctx.fillStyle = lin(ctx, -52, 0, 52, 270, ["#f7d56e", "#c58a22", "#e9bb4f"]);
      ctx.fill();
      ctx.restore();
    });
    // الوردة المسنّنة
    ctx.beginPath();
    for (var a = 0; a <= Math.PI * 2 + 0.01; a += 0.02) {
      var rr = R * (1 + 0.055 * Math.cos(a * 30));
      var x = cx + rr * Math.cos(a), y = cy + rr * Math.sin(a);
      if (a === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fillStyle = lin(ctx, cx - R, cy - R, cx + R, cy + R, GOLD);
    ctx.fill();
    ctx.lineWidth = 4; ctx.strokeStyle = "rgba(110,70,10,.55)"; ctx.stroke();
    ctx.beginPath(); ctx.arc(cx, cy, R * 0.8, 0, Math.PI * 2);
    ctx.lineWidth = 6; ctx.strokeStyle = "#8d5e12"; ctx.stroke();
    ctx.beginPath(); ctx.arc(cx, cy, R * 0.74, 0, Math.PI * 2);
    ctx.fillStyle = lin(ctx, cx, cy - R, cx, cy + R, ["#2c2c2c", "#111"]);
    ctx.fill();
    laurel(ctx, cx, cy + 6, R * 0.58, "#e3b64c", R * 0.2, 9);
    ctx.fillStyle = lin(ctx, cx, cy - 60, cx, cy + 60, ["#fbe38e", "#d49a2c"]);
    ctx.font = "800 " + Math.round(R * 0.8) + "px " + SANS;
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText(String(label), cx, cy - R * 0.04);
  }

  /* ---------- الختم الأزرق (TOP 5 OF THE MONTH) ---------- */
  function seal(ctx, cx, cy, R) {
    ctx.save();
    ctx.beginPath();
    for (var a = 0; a <= Math.PI * 2 + 0.01; a += 0.02) {
      var rr = R * (1 + 0.045 * Math.cos(a * 24));
      var x = cx + rr * Math.cos(a), y = cy + rr * Math.sin(a);
      if (a === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fillStyle = lin(ctx, cx - R, cy - R, cx + R, cy + R, [INK2, INK, INK]);
    ctx.fill();
    ctx.beginPath(); ctx.arc(cx, cy, R * 0.82, 0, Math.PI * 2);
    ctx.lineWidth = 3; ctx.strokeStyle = "rgba(255,255,255,.75)"; ctx.stroke();
    laurel(ctx, cx, cy + 4, R * 0.62, "rgba(255,255,255,.4)", R * 0.2, 7);
    ctx.fillStyle = "#fff"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.font = "italic 700 " + Math.round(R * 0.46) + "px " + SERIF; ctx.fillText("Top 5", cx, cy - R * 0.1);
    ctx.font = "italic 600 " + Math.round(R * 0.22) + "px " + SERIF; ctx.fillText("of the month", cx, cy + R * 0.3);
    ctx.restore();
  }

  function diamond(ctx, cx, cy, r) {
    ctx.beginPath();
    ctx.moveTo(cx, cy - r); ctx.lineTo(cx + r, cy); ctx.lineTo(cx, cy + r); ctx.lineTo(cx - r, cy); ctx.closePath();
    ctx.fill();
  }

  /* ---------- رسم الشهادة ---------- */
  function drawCertificate(rec, logo) {
    var c = document.createElement("canvas");
    c.width = W; c.height = H;
    var ctx = c.getContext("2d");
    var cx = W / 2;

    // الورقة: أبيض دافي بتدرّج خفيف
    var bg = ctx.createRadialGradient(cx, H / 2, 200, cx, H / 2, 1250);
    bg.addColorStop(0, "#ffffff"); bg.addColorStop(1, "#f9f5ea");
    ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);

    // الإطار الأزرق المزدوج
    ctx.strokeStyle = INK; ctx.lineWidth = 10; ctx.strokeRect(60, 60, W - 120, H - 120);
    ctx.lineWidth = 3; ctx.strokeRect(92, 92, W - 184, H - 184);
    ctx.fillStyle = INK;
    [[92, 92], [W - 92, 92], [92, H - 92], [W - 92, H - 92]].forEach(function (p) { diamond(ctx, p[0], p[1], 14); });

    // اللوجو في الأعلى
    var LR = 118, LY = 250;
    ctx.beginPath(); ctx.arc(cx, LY, LR + 14, 0, Math.PI * 2);
    ctx.fillStyle = "#fff"; ctx.fill(); ctx.lineWidth = 5; ctx.strokeStyle = INK; ctx.stroke();
    if (logo) {
      ctx.save();
      ctx.beginPath(); ctx.arc(cx, LY, LR, 0, Math.PI * 2); ctx.clip();
      var box = LR * 2, k = Math.max(box / logo.width, box / logo.height);
      ctx.drawImage(logo, cx - logo.width * k / 2, LY - logo.height * k / 2, logo.width * k, logo.height * k);
      ctx.restore();
    }

    // العنوان
    ctx.textBaseline = "alphabetic"; ctx.textAlign = "center"; ctx.fillStyle = INK;
    var ts = 132; ctx.font = "italic 700 " + ts + "px " + SERIF;
    while (ctx.measureText("Certificate of Appreciation").width > 1500 && ts > 70) { ts -= 4; ctx.font = "italic 700 " + ts + "px " + SERIF; }
    ctx.fillText("Certificate of Appreciation", cx, 535);

    // فاصل بخط ومعيّن
    ctx.strokeStyle = INK2; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(cx - 300, 588); ctx.lineTo(cx - 34, 588); ctx.moveTo(cx + 34, 588); ctx.lineTo(cx + 300, 588); ctx.stroke();
    ctx.fillStyle = INK2; diamond(ctx, cx, 588, 11);

    ctx.fillStyle = SOFT; ctx.font = "italic 500 48px " + SERIF;
    ctx.fillText("Proudly presented to", cx, 658);

    // الاسم بالخط الإيطالي
    var name = String(rec.name || "Student Name").trim();
    var arabic = hasArabic(name), maxNameW = 1500, size = arabic ? 165 : 230;
    if (arabic) name = tashkeel(name);
    var fam = arabic ? ARABIC_NAME : SCRIPT, wt = "400 ";
    ctx.font = wt + size + "px " + fam;
    while (ctx.measureText(name).width > maxNameW && size > 60) { size -= 4; ctx.font = wt + size + "px " + fam; }
    ctx.fillStyle = INK; ctx.textAlign = "center";
    if (arabic) ctx.direction = "rtl";
    ctx.fillText(name, cx, arabic ? 850 : 885);
    ctx.direction = "ltr";
    ctx.strokeStyle = INK2; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.moveTo(cx - 640, 942); ctx.lineTo(cx + 640, 942); ctx.stroke();

    ctx.fillStyle = INK2; ctx.font = "italic 600 46px " + SERIF;
    ctx.fillText("Rank " + (rec.rank || 1) + "  ·  " + monthLabel(rec.month), cx, 1008);

    // النص
    ctx.fillStyle = "#37505c"; ctx.font = "italic 500 41px " + SERIF;
    var body = "Awarded in recognition of outstanding effort, steady progress and a real passion for learning English. " +
      "Ranked No. " + (rec.rank || 1) + " among all students on the platform in " + monthLabel(rec.month) +
      (rec.gain ? ", with " + rec.gain + " points earned this month" : "") + ". " +
      "A bonus of " + (rec.bonus || 50) + " points has been added to the student's account. Keep shining!";
    var lines = wrap(ctx, body, 1320), y = 1074;
    lines.forEach(function (ln) { ctx.fillText(ln, cx, y); y += 52; });

    // الفوتر: التاريخ — الختم — التوقيع
    var fy = 1345, DX = 450, SX = W - 450;
    ctx.strokeStyle = INK; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.moveTo(DX - 190, fy); ctx.lineTo(DX + 190, fy); ctx.moveTo(SX - 190, fy); ctx.lineTo(SX + 190, fy); ctx.stroke();
    ctx.fillStyle = INK; ctx.font = "italic 600 42px " + SERIF;
    ctx.fillText(dateLabel(rec.createdAt), DX, fy - 18);
    ctx.fillStyle = SOFT; ctx.font = "italic 500 34px " + SERIF;
    ctx.fillText("Date", DX, fy + 46); ctx.fillText("Signature", SX, fy + 46);
    var ss = 96; ctx.font = "400 " + ss + "px " + SCRIPT;
    while (ctx.measureText(TEACHER).width > 360 && ss > 30) { ss -= 2; ctx.font = "400 " + ss + "px " + SCRIPT; }
    ctx.fillStyle = INK; ctx.fillText(TEACHER, SX, fy - 20);
    seal(ctx, cx, fy - 16, 76);

    ctx.fillStyle = SOFT; ctx.font = "italic 500 30px " + SERIF;
    ctx.fillText("Shady Nasr Platform", cx, fy + 100);
    return c;
  }

  function render(rec) {
    return Promise.all([ensureFonts(), loadLogo()]).then(function (r) { return drawCertificate(rec || {}, r[1]); });
  }

  /* ---------- نافذة العرض (بنفس ستايل نوافذ الموقع) ---------- */
  function injectCss() {
    if (document.getElementById("snCertCss")) return;
    var st = document.createElement("style");
    st.id = "snCertCss";
    st.textContent =
      ".modal--cert{max-width:min(980px,96vw);padding:14px 14px 16px;text-align:start;display:flex;flex-direction:column;gap:12px;max-height:94vh}" +
      ".sn-cert__bar{display:flex;align-items:center;gap:8px;position:relative;padding-inline:6px}" +
      ".sn-cert__title{flex:1;min-width:0;font-family:var(--font-display);font-weight:800;font-size:1rem;color:var(--ink);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}" +
      ".sn-cert__btn{width:38px;height:38px;border-radius:50%;border:none;background:transparent;color:var(--ink-soft);display:grid;place-items:center;cursor:pointer;transition:background .2s var(--ease),color .2s var(--ease)}" +
      ".sn-cert__btn:hover,.sn-cert__btn[aria-expanded=true]{background:var(--surface-glass-border);color:var(--ink)}" +
      ".sn-cert__btn:focus-visible{outline:2px solid var(--accent);outline-offset:2px}" +
      ".sn-cert__btn svg{width:20px;height:20px}" +
      ".sn-cert__menu{position:absolute;top:calc(100% + 6px);inset-inline-end:44px;z-index:5;min-width:210px;padding:6px;border-radius:var(--radius-md);background:var(--surface-glass);border:1px solid var(--surface-glass-border);box-shadow:0 18px 44px rgba(0,0,0,.28);display:flex;flex-direction:column;gap:2px;transform-origin:top;animation:snCertPop .16s var(--ease)}" +
      ".sn-cert__menu[hidden]{display:none}" +
      "@keyframes snCertPop{from{opacity:0;transform:translateY(-6px) scale(.97)}to{opacity:1;transform:none}}" +
      ".sn-cert__item{display:flex;align-items:center;gap:12px;width:100%;padding:11px 12px;border:none;border-radius:10px;background:transparent;color:var(--ink);font:inherit;font-weight:700;font-size:.92rem;text-align:start;cursor:pointer}" +
      ".sn-cert__item:hover,.sn-cert__item:focus-visible{background:var(--surface-glass-border);outline:none}" +
      ".sn-cert__item svg{width:19px;height:19px;flex:none;color:var(--accent)}" +
      ".sn-cert__stage{flex:1;min-height:0;display:grid;place-items:center;border-radius:var(--radius-md);background:var(--bg-soft);padding:10px;overflow:auto;position:relative;min-height:300px}" +
      ".sn-cert__stage img{display:block;max-width:100%;max-height:calc(94vh - 120px);height:auto;border-radius:8px;box-shadow:0 14px 40px rgba(0,0,0,.25);-webkit-user-drag:none}" +
      ".sn-cert__load{color:var(--ink-soft);font-weight:700;padding:60px 10px}" +
      ".sn-cert__bar .modal__close{position:static}" +
      /* موبايل: نافذة بتطلع من تحت (Bottom sheet) بدل كارت صغير مضغوط في النص */
      "@media (max-width:720px){" +
      ".modal-overlay--cert{display:flex;align-items:flex-end;justify-content:center;padding:0!important;overflow:hidden}" +
      ".modal-overlay--cert .modal--cert{width:100%;max-width:520px;height:88vh;height:88dvh;max-height:none;gap:0;padding:0 0 env(safe-area-inset-bottom,0px);" +
      "border-radius:26px 26px 0 0;transform:translateY(105%);transition:transform .35s cubic-bezier(.2,.9,.3,1)}" +
      ".modal-overlay--cert.is-open .modal--cert{transform:none}" +
      ".modal--cert::before{content:'';flex:none;width:42px;height:4px;border-radius:9px;background:var(--surface-glass-border);margin:9px auto 0}" +
      ".modal--cert .sn-cert__bar{padding:12px 16px 10px}" +
      ".modal--cert .sn-cert__btn{border:1px solid var(--surface-glass-border);background:var(--surface-glass);color:var(--ink)}" +
      ".modal--cert .sn-cert__stage{margin:0 12px 12px;padding:12px;min-height:0;border-radius:18px;border:1px solid var(--surface-glass-border);background:var(--surface-glass)}" +
      ".modal--cert .sn-cert__stage img{max-height:calc(88dvh - 150px)}" +
      ".modal--cert .sn-cert__menu{inset-inline-end:16px}" +
      "}";
    document.head.appendChild(st);
  }
  var IC = {
    more: '<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="5" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="12" cy="19" r="2"/></svg>',
    close: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18"/></svg>',
    dl: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12m0 0 4-4m-4 4-4-4M5 20h14"/></svg>',
    pr: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 9V3h10v6M7 17H5a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2h-2"/><rect x="7" y="14" width="10" height="7" rx="1"/></svg>',
    sh: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8.6 13.5 6.8 4m0-11-6.8 4"/></svg>'
  };
  var toast = function (m, err) { if (window.snDialog && snDialog.toast) snDialog.toast(m, { error: !!err }); };

  function canvasBlob(c) {
    return new Promise(function (res, rej) { c.toBlob(function (b) { b ? res(b) : rej(new Error("BLOB")); }, "image/png"); });
  }
  function saveBlob(blob, filename) {
    var u = URL.createObjectURL(blob), a = document.createElement("a");
    a.href = u; a.download = filename; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(u); }, 4000);
  }
  function printUrl(url) {
    return new Promise(function (resolve, reject) {
      var f = document.createElement("iframe");
      f.style.cssText = "position:fixed;width:0;height:0;border:0;opacity:0;pointer-events:none";
      f.onload = function () {
        try {
          var w = f.contentWindow;
          var im = w.document.querySelector("img");
          var go = function () { w.focus(); w.print(); setTimeout(function () { f.remove(); }, 2000); resolve(); };
          if (im && !im.complete) { im.onload = go; im.onerror = function () { f.remove(); reject(new Error("IMG")); }; } else go();
        } catch (e) { f.remove(); reject(e); }
      };
      f.srcdoc = '<!doctype html><html><head><style>@page{size:landscape;margin:0}html,body{margin:0;height:100%}img{display:block;width:100%;height:100%;object-fit:contain}</style></head><body><img src="' + url + '"></body></html>';
      document.body.appendChild(f);
    });
  }

  /* opts: { title, filename, render: () => Promise<canvas>, shareText } */
  function view(opts) {
    injectCss();
    var prevFocus = document.activeElement;
    var ov = document.createElement("div");
    ov.className = "modal-overlay modal-overlay--cert";
    ov.innerHTML =
      '<div class="modal modal--cert" role="dialog" aria-modal="true" aria-label="' + (opts.title || tx("cert")).replace(/"/g, "&quot;") + '">' +
      '<div class="sn-cert__bar"><strong class="sn-cert__title"></strong>' +
      '<button type="button" class="sn-cert__btn" data-more aria-haspopup="menu" aria-expanded="false" aria-label="' + tx("more") + '">' + IC.more + "</button>" +
      '<button type="button" class="sn-cert__btn" data-x aria-label="' + tx("close") + '">' + IC.close + "</button>" +
      '<div class="sn-cert__menu" role="menu" hidden>' +
      '<button type="button" class="sn-cert__item" role="menuitem" data-act="download">' + IC.dl + "<span>" + tx("download") + "</span></button>" +
      '<button type="button" class="sn-cert__item" role="menuitem" data-act="print">' + IC.pr + "<span>" + tx("print") + "</span></button>" +
      '<button type="button" class="sn-cert__item" role="menuitem" data-act="share">' + IC.sh + "<span>" + tx("share") + "</span></button>" +
      "</div></div>" +
      '<div class="sn-cert__stage"><div class="sn-cert__load">' + tx("loading") + "</div></div></div>";
    ov.querySelector(".sn-cert__title").textContent = opts.title || tx("cert");
    var menu = ov.querySelector(".sn-cert__menu"), more = ov.querySelector("[data-more]"), stage = ov.querySelector(".sn-cert__stage");
    var blob = null, url = null, closed = false;

    function setMenu(on) { menu.hidden = !on; more.setAttribute("aria-expanded", on ? "true" : "false"); if (on) { var f = menu.querySelector(".sn-cert__item"); if (f) f.focus(); } }
    function close() {
      if (closed) return; closed = true;
      document.removeEventListener("keydown", onKey, true);
      ov.classList.remove("is-open");
      document.body.style.overflow = prevOverflow;
      setTimeout(function () { ov.remove(); if (url) URL.revokeObjectURL(url); }, 240);
      if (prevFocus && prevFocus.focus) { try { prevFocus.focus(); } catch (e) { } }
    }
    function onKey(e) {
      if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); if (!menu.hidden) { setMenu(false); more.focus(); } else close(); }
    }
    var prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    ov.addEventListener("click", function (e) {
      if (e.target === ov) return close();
      if (e.target.closest("[data-x]")) return close();
      if (e.target.closest("[data-more]")) return setMenu(menu.hidden);
      var it = e.target.closest("[data-act]");
      if (it) { setMenu(false); return act(it.dataset.act); }
      if (!e.target.closest(".sn-cert__menu")) setMenu(false);
    });
    document.addEventListener("keydown", onKey, true);

    function act(a) {
      if (!blob) return;
      var filename = opts.filename || "certificate.png";
      if (a === "download") { saveBlob(blob, filename); toast(tx("saved")); }
      else if (a === "print") { printUrl(url).catch(function () { toast(tx("printFail"), true); }); }
      else if (a === "share") {
        var file = new File([blob], filename, { type: "image/png" });
        var data = { files: [file], title: opts.title || tx("cert"), text: opts.shareText || "" };
        if (navigator.canShare && navigator.canShare(data) && navigator.share) {
          navigator.share(data).catch(function (e) { if (e && e.name !== "AbortError") { saveBlob(blob, filename); toast(tx("noShare")); } });
        } else { saveBlob(blob, filename); toast(tx("noShare")); }
      }
    }

    document.body.appendChild(ov);
    requestAnimationFrame(function () { ov.classList.add("is-open"); });

    var ld = null;
    if (window.SNTransfer) {
      stage.innerHTML = "";
      ld = window.SNTransfer.loader(stage, tx("loading"));
    }
    Promise.resolve().then(opts.render).then(canvasBlob).then(function (b) {
      if (closed) { if (ld) ld.cancel(); return; }
      blob = b; url = URL.createObjectURL(b);
      var im = new Image();
      im.alt = opts.title || ""; im.draggable = false; im.src = url;
      if (ld) {
        ld.set(0.9);
        ld.done(function () { stage.querySelectorAll(".sn-cert__load").forEach(function (n) { n.remove(); }); stage.appendChild(im); });
      } else { stage.innerHTML = ""; stage.appendChild(im); }
    }).catch(function () {
      if (closed) { if (ld) ld.cancel(); return; }
      if (ld) ld.fail(null, tx("fail")); else stage.innerHTML = '<div class="sn-cert__load">' + tx("fail") + "</div>";
    });
    return { close: close };
  }

  function open(rec) {
    /* rec ممكن يبقى Promise: النافذة تتفتح فورًا وتستنى البيانات */
    if (rec && typeof rec.then === "function") {
      return view({
        title: tx("cert"),
        filename: "Certificate.png",
        shareText: "Certificate of Appreciation",
        render: function () { return rec.then(render); }
      });
    }
    var nm = rec && rec.name ? rec.name : "";
    return view({
      title: tx("cert") + (rec && rec.month ? " — " + monthLabel(rec.month) : ""),
      filename: "Certificate-" + slug(nm) + "-" + (rec && rec.month || "") + ".png",
      shareText: "Certificate of Appreciation — " + monthLabel(rec && rec.month),
      render: function () { return render(rec); }
    });
  }
  function download(rec) {
    return render(rec).then(canvasBlob).then(function (b) {
      saveBlob(b, "Certificate-" + slug(rec && rec.name) + "-" + (rec && rec.month || "") + ".png");
      toast(tx("saved"));
    }).catch(function () { toast(tx("fail"), true); });
  }

  window.SNCert = {
    render: render, open: open, view: view, download: download, monthLabel: monthLabel, hasArabic: hasArabic, tashkeel: tashkeel, addNames: addNames,
    ensureFonts: ensureFonts, loadLogo: loadLogo, canvasBlob: canvasBlob, saveBlob: saveBlob, slug: slug
  };
})();

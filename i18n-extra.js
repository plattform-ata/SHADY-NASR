/* ==========================================================================
   i18n-extra.js — ترجمة إنجليزي لكل النصوص العربي اللي مالهاش مفتاح في قاموس shared.js
   (نصوص ثابتة في الـ HTML + نصوص بتتولّد من JavaScript زي الرسائل والعناوين).
   الفكرة: لما اللغة تبقى إنجليزي بنترجم أي نص عربي بيظهر في الصفحة (وأي نص جديد يظهر بعدين)
   من القاموس تحت، ولما ترجع عربي بنرجّع النص الأصلي. مفيش حاجة في باقي الملفات اتغيّرت.
   لإضافة ترجمة جديدة: ضيف سطر [ "العربي", "English" ] في PAIRS.
   - {0} {1} = أرقام. - {*0} = أي كلمة/نص (بيفضل زي ما هو).
   - الكلمة الواحدة أو المفتاح القصير (3 حروف أو أقل) بيتترجم بس لو النص كله هو المفتاح.
   يتحمّل في studenti.html و admin.html.
   ========================================================================== */
(function () {
  "use strict";
  var PAIRS = [
[
"لوحة تحكم الطالب | Shady Nasr English Platform",
"Student dashboard | Shady Nasr English Platform"
],
[
"Shady Nasr English Platform — الصفحة الرئيسية",
"Shady Nasr English Platform — Home"
],
[
"أدوات صغيرة تساعدك على تنظيم مذاكرتك — بياناتك تُحفظ على جهازك فقط.",
"Small tools to help you organize your study — your data is saved on your device only."
],
[
"أضف مهمة جديدة… مثال: مراجعة الدرس السادس",
"Add a new task… e.g. Review lesson six"
],
[
"أيام دخول متتالية",
"Consecutive login days"
],
[
"إضافة",
"Add"
],
[
"إعادة ضبط",
"Reset"
],
[
"إكمال الدروس",
"Lesson completion"
],
[
"إنجاز الدروس",
"Lessons progress"
],
[
"ابدأ",
"Start"
],
[
"اجتياز الشيتات",
"Sheets passed"
],
[
"اختر ما تريد فتحه من هذا الفصل",
"Choose what you want to open from this chapter"
],
[
"اضغط على أي شارة مكتسبة لتحميلها كصورة ومشاركتها.",
"Tap any earned badge to download it as an image and share it."
],
[
"اضغط على أي شارة مكتسبة لتحميلها كصورة.",
"Tap any earned badge to download it as an image."
],
[
"اعمل بتركيز لمدة 25 دقيقة ثم خذ استراحة قصيرة.",
"Focus for 25 minutes, then take a short break."
],
[
"الإعلانات والتنبيهات",
"Announcements & alerts"
],
[
"الاسم الكامل",
"Full name"
],
[
"الالتزام الأسبوعي",
"Weekly commitment"
],
[
"التنقل الرئيسي",
"Main navigation"
],
[
"الدخول المستمر",
"Login streak"
],
[
"الدرجات النهائية",
"Perfect scores"
],
[
"الشهر",
"Month"
],
[
"الشيتات",
"Sheets"
],
[
"الملاحظات",
"Notes"
],
[
"امتحانات الدروس",
"Lesson exams"
],
[
"امتحانات القصة",
"Story exams"
],
[
"بياناتك",
"Your details"
],
[
"تابع قصة صفّك الدراسي مقسّمة إلى فصول بالترتيب، وافتح أي فصل لتشاهد شرحه بالفيديو أو تقرأ نصّه أو تخوض امتحانه الاختياري.",
"Follow your grade's story, split into chapters in order. Open any chapter to watch its video, read its text, or take its optional exam."
],
[
"تبديل المظهر",
"Toggle theme"
],
[
"ترتيب الطلاب في صفك الدراسي حسب النقاط.",
"Students in your grade ranked by points."
],
[
"تسليم الامتحان",
"Submit exam"
],
[
"تواصل معنا — WebShark",
"Contact us — WebShark"
],
[
"درسًا مكتملًا",
"lessons completed"
],
[
"دروس صفّك الدراسي — افتح أي درس لتبدأ.",
"Your grade's lessons — open any lesson to start."
],
[
"دي بياناتك الشخصية للاطّلاع فقط — لو حابب تعدّل فيها تواصل مع إدارة المنصة.",
"These are your personal details, view only — to change them, contact the platform admin."
],
[
"رسم بياني: إنجاز الدروس ومتوسط الدرجات",
"Chart: lessons progress and average scores"
],
[
"فتح القائمة",
"Open menu"
],
[
"قائمة المهام",
"To-do list"
],
[
"قراءة القصة",
"Read the story"
],
[
"كل الملاحظات اللي بعتها لك الأستاذ: تحذيرات، نصايح، تشجيع وتنبيهات.",
"All the notes your teacher sent you: warnings, advice, encouragement and alerts."
],
[
"مؤشرات التقدم الفعلية",
"Actual progress indicators"
],
[
"مؤقّت التركيز (بومودورو)",
"Focus timer (Pomodoro)"
],
[
"متوسط الامتحانات",
"Exams average"
],
[
"متوسط الدرجات حسب نوع التقييم",
"Average score by assessment type"
],
[
"محادثة مع Mr. Shady Nasr",
"Chat with Mr. Shady Nasr"
],
[
"ملاحظة جديدة",
"New note"
],
[
"نتائج تقييماتك مقسّمة حسب نوع الاختبار.",
"Your assessment results by type of test."
],
[
"نسبة إنجاز الدروس",
"Lessons completion rate"
],
[
"نسبة الإنجاز الكلي",
"Overall progress"
],
[
"نصيحة اليوم",
"Tip of the day"
],
[
"نظرة عامة على أدائك ومهاراتك اللغوية هذا الفصل.",
"An overview of your performance and language skills this term."
],
[
"نقاطك وشاراتك",
"Your points & badges"
],
[
"وقت التعلّم",
"Learning time"
],
[
"الصف الأول الإعدادي",
"Grade 7 (Prep 1)"
],
[
"الصف الثاني الإعدادي",
"Grade 8 (Prep 2)"
],
[
"الصف الثالث الإعدادي",
"Grade 9 (Prep 3)"
],
[
"الصف الأول الثانوي",
"Grade 10 (Secondary 1)"
],
[
"الصف الثاني الثانوي",
"Grade 11 (Secondary 2)"
],
[
"الصف الثالث الثانوي",
"Grade 12 (Secondary 3)"
],
[
"جاري التحميل…",
"Loading…"
],
[
"جاري التحميل...",
"Loading..."
],
[
"{0} من {1} درسًا",
"{0} of {1} lessons"
],
[
"{0} س",
"{0} h"
],
[
"{0} د",
"{0} min"
],
[
"{0} أسئلة — الدرس:",
"{0} questions — Lesson:"
],
[
"أحسنت! شفت الفيديو كامل وتم احتسابه.",
"Well done! You watched the full video and it was counted."
],
[
"تم احتساب الفيديو.",
"Video counted."
],
[
"تم احتساب مشاهدة الفيديو كاملًا.",
"Full video view counted."
],
[
"أكمل دروس الوحدة كلها (فيديو كامل + PDF + شيت لكل درس) لفتح الامتحان",
"Complete all the unit's lessons (full video + PDF + sheet for each lesson) to unlock the exam"
],
[
"الفيديو لم يُحتسب: شاهدت {0}% فقط. لازم تشوفه كامل من غير تقديم — ابدأ من أول.",
"Video not counted: you watched only {0}%. You must watch it fully without skipping — start again."
],
[
"شيت الدرس هيتفتح بعد ما تشوف فيديو الشرح كامل من غير تقديم.",
"The lesson sheet unlocks after you watch the full explanation video without skipping."
],
[
"{0} سؤال — النجاح من {1}% فما فوق",
"{0} questions — pass mark {1}% or above"
],
[
"(أنت)",
"(you)"
],
[
"10 أسئلة: 8 اختيار من متعدد + 2 تصحيح خطأ + 15 كلمة",
"10 questions: 8 multiple choice + 2 error correction + 15 words"
],
[
"{0} درجات نهائية",
"{0} perfect scores"
],
[
"{0} أيام متواصلة",
"{0} consecutive days"
],
[
"{0} يوم متواصل",
"{0} consecutive days"
],
[
"{0} درجة نهائية",
"{0} perfect scores"
],
[
"14 يوم متواصل",
"14 consecutive days"
],
[
"3 أيام متواصلة",
"3 consecutive days"
],
[
"7 أيام متواصلة",
"7 consecutive days"
],
[
"30 يوم متواصل",
"30 consecutive days"
],
[
"60 يوم متواصل",
"60 consecutive days"
],
[
"3 درجات نهائية",
"3 perfect scores"
],
[
"5 درجات نهائية",
"5 perfect scores"
],
[
"10 درجات نهائية",
"10 perfect scores"
],
[
"20 درجة نهائية",
"20 perfect scores"
],
[
"إعادة الامتحان",
"Retake exam"
],
[
"إعادة الامتحان بأسئلة جديدة",
"Retake exam with new questions"
],
[
"إعادة الشيت",
"Retake sheet"
],
[
"امتحان هذا",
"This exam"
],
[
"فيديو شرح الفصل",
"Chapter explanation video"
],
[
"فيديو شرح الدرس",
"Lesson explanation video"
],
[
"الأسئلة الصح ({0}):",
"Correct questions ({0}):"
],
[
"الكلمات:",
"Words:"
],
[
"صح",
"correct"
],
[
"غلط",
"wrong"
],
[
"غلط من",
"wrong out of"
],
[
"الأسئلة",
"Questions"
],
[
"تعذر الاتصال بقاعدة البيانات",
"Couldn't connect to the database"
],
[
"تعذر تحميل لوحة المتصدرين، حاول تاني",
"Couldn't load the leaderboard, try again"
],
[
"لسه مفيش طلاب مسجلين في الصف ده",
"No students registered in this grade yet"
],
[
"لا توجد مهام بعد — أضف أول مهمة لك",
"No tasks yet — add your first task"
],
[
"لا توجد درجات فعلية لعرضها بعد.",
"No actual grades to show yet."
],
[
"لا توجد نتائج مسجّلة في هذا القسم بعد.",
"No results recorded in this section yet."
],
[
"تم إرسال إجاباتك بنجاح وستُصحَّح يدويًا من قِبل المعلّم.",
"Your answers were submitted and will be graded manually by the teacher."
],
[
"آخر نتيجة: {0}%. أعد الحل للحصول على {1}% أو أكثر.",
"Last result: {0}%. Retry to get {1}% or more."
],
[
"نجحت في امتحان هذه الوحدة",
"You passed this unit's exam"
],
[
"سيتم إضافة أسئلة هذه الوحدة قريبًا.",
"This unit's questions will be added soon."
],
[
"{0}/{1} من المطلوب",
"{0}/{1} required"
],
[
"مكتمل",
"Completed"
],
[
"نجحت ({0}%)",
"Passed ({0}%)"
],
[
"آخر نتيجة {0}% — أعد المحاولة",
"Last result {0}% — try again"
],
[
"بانتظار تصحيح المعلّم",
"Awaiting teacher's grading"
],
[
"بانتظار التصحيح",
"Awaiting grading"
],
[
"شاهد الفيديو أولًا",
"Watch the video first"
],
[
"لم يُحل بعد",
"Not solved yet"
],
[
"تم",
"Done"
],
[
"تم الإرسال",
"Submitted"
],
[
"✓ صح",
"✓ Correct"
],
[
"½ نص درجة",
"½ half mark"
],
[
"✗ غلط",
"✗ Wrong"
],
[
"نص درجة",
"half mark"
],
[
"{0}/{1} إجابة صحيحة",
"{0}/{1} correct answers"
],
[
"الدرجة: {0}/{1} — نصف الدرجة يُحسب عند خطأ حرف أو حرفين في الكلمة.",
"Score: {0}/{1} — half a mark is given for a one- or two-letter spelling mistake."
],
[
"العودة للوحدات",
"Back to units"
],
[
"رجوع للوحدات",
"Back to units"
],
[
"رجوع للدرس",
"Back to lesson"
],
[
"أسئلة هذه الوحدة لم تُضف بعد",
"This unit's questions haven't been added yet"
],
[
"أول درجة نهائية",
"First perfect score"
],
[
"إجابة غير صحيحة",
"Incorrect answer"
],
[
"ادخل المنصة كل يوم ورا بعض عشان تفتح شارات الدخول المستمر.",
"Log in every day in a row to unlock the login-streak badges."
],
[
"اكتب إجابتك هنا…",
"Write your answer here…"
],
[
"إيقاف مؤقت",
"Pause"
],
[
"استئناف",
"Resume"
],
[
"الدرس {0}:",
"Lesson {0}:"
],
[
"الدرس الأول من الوحدة",
"First lesson of the unit"
],
[
"الدرس الثاني من الوحدة",
"Second lesson of the unit"
],
[
"الدرس الثالث من الوحدة",
"Third lesson of the unit"
],
[
"الدرس:",
"Lesson:"
],
[
"الصفحة التالية",
"Next page"
],
[
"الصفحة السابقة",
"Previous page"
],
[
"الفصل {0}:",
"Chapter {0}:"
],
[
"القصة مكتوبة",
"The written story"
],
[
"المعنى بالعربي",
"Meaning in Arabic"
],
[
"الماضي البسيط: أحداث انتهت في الماضي.",
"Past Simple: events that finished in the past."
],
[
"المضارع البسيط: الحقائق والعادات اليومية.",
"Present Simple: facts and daily habits."
],
[
"المضارع التام وربط الماضي بالحاضر.",
"Present Perfect: linking the past to the present."
],
[
"الصفات وصيغ المقارنة بين شيئين.",
"Adjectives and comparatives between two things."
],
[
"مفردات الأسرة والروتين اليومي.",
"Family and daily routine vocabulary."
],
[
"أساسيات الكتابة الإقناعية.",
"Persuasive writing basics."
],
[
"الوحدة الأولى: الحياة في العالم الرقمي",
"Unit 1: Life in the digital world"
],
[
"الوحدة الثانية: تعلّم كيف تتعلّم",
"Unit 2: Learning how to learn"
],
[
"الوحدة الثالثة: القدوة والنماذج الملهمة",
"Unit 3: Role models and inspiring figures"
],
[
"الوحدة {0}:",
"Unit {0}:"
],
[
"امتحان اختياري شامل",
"Comprehensive optional exam"
],
[
"امتحان معاني الكلمات",
"Vocabulary meanings exam"
],
[
"امتحان الفصل {0}:",
"Chapter {0} exam:"
],
[
"امتحان القصة:",
"Story exam:"
],
[
"امتحان الوحدة {0}:",
"Unit {0} exam:"
],
[
"امتحان:",
"Exam:"
],
[
"امتحان الوحدة",
"Unit exam"
],
[
"برونزية",
"Bronze"
],
[
"فضية",
"Silver"
],
[
"ذهبية",
"Gold"
],
[
"ماسية",
"Diamond"
],
[
"كريستالية",
"Crystal"
],
[
"شارة {*0}",
"{*0} badge"
],
[
"بن يبدأ يومه الأول في مدرسة جديدة ويتعرّف على صديق جديد.",
"Ben starts his first day at a new school and meets a new friend."
],
[
"بن يقدّم نفسه أمام زملائه في حصة اللغة الإنجليزية.",
"Ben introduces himself to his classmates in English class."
],
[
"عمر يأخذ بن في جولة بالمدرسة ويصبحان صديقين.",
"Omar takes Ben on a tour of the school and they become friends."
],
[
"نهاية يوم رائع يعود فيه بن لبيته سعيدًا بصديقه الجديد.",
"The end of a great day: Ben goes home happy with his new friend."
],
[
"غرفة مخفية مليئة بخرائط ورسائل قديمة عمرها خمسون عامًا.",
"A hidden room full of maps and fifty-year-old letters."
],
[
"ليلى تخبر معلمتها فتتحول الغرفة إلى متحف صغير للمدرسة.",
"Layla tells her teacher, and the room becomes a small school museum."
],
[
"ليلى تسمع صوتًا غريبًا في مكتبة المدرسة القديمة.",
"Layla hears a strange sound in the old school library."
],
[
"ليلى تكتشف بابًا خشبيًا صغيرًا خلف أحد الرفوف.",
"Layla discovers a small wooden door behind a shelf."
],
[
"حوار مع رجل غريب يمنح يوسف ثقة أكبر بقراره.",
"A talk with a stranger gives Youssef more confidence in his decision."
],
[
"وصول يوسف أخيرًا إلى القاهرة وبداية رحلته الجديدة.",
"Youssef finally arrives in Cairo and begins his new journey."
],
[
"يوسف يفوّت القطار الأول وينتظر آخر قطار لليلة.",
"Youssef misses the first train and waits for the last train of the night."
],
[
"يوسف يقرر ترك قريته والسفر للدراسة في القاهرة.",
"Youssef decides to leave his village and travel to Cairo to study."
],
[
"قصة الصف الأول الإعدادي — مستوى مبتدئ",
"Grade 7 story — beginner level"
],
[
"قصة الصف الثاني الإعدادي — مستوى متوسط",
"Grade 8 story — intermediate level"
],
[
"قصة الصف الثالث الإعدادي — مستوى متقدم",
"Grade 9 story — advanced level"
],
[
"تتم متابعة مشاهدتك… {0}% — لا تقدّم الفيديو، لازم يتشاف كامل.",
"Tracking your viewing… {0}% — don't skip ahead, the video must be watched fully."
],
[
"تحديد كمكتملة",
"Mark as completed"
],
[
"تحميل",
"Download"
],
[
"تحميل الشارة",
"Download badge"
],
[
"تعذر تحديث بيانات المستخدم من Firebase في الخلفية",
"Couldn't refresh user data from Firebase in the background"
],
[
"تعذر تحميل قارئ PDF. استخدم زر فتح الملف الكامل.",
"Couldn't load the PDF viewer. Use the open full file button."
],
[
"تعذر تحميل ملف PDF. استخدم زر فتح الملف الكامل.",
"Couldn't load the PDF file. Use the open full file button."
],
[
"تعذر عرض الصفحة. استخدم زر فتح الملف الكامل.",
"Couldn't display the page. Use the open full file button."
],
[
"تعذر حفظ إجابة المقال في Firebase",
"Couldn't save the essay answer to Firebase"
],
[
"تعذر حفظ الدرجة في Firebase",
"Couldn't save the grade to Firebase"
],
[
"تعذر حفظ النقط في Firebase",
"Couldn't save the points to Firebase"
],
[
"تعذر حفظ تقدّم الوحدة على Firebase",
"Couldn't save unit progress to Firebase"
],
[
"تعذر حفظ درجة الشيت في Firebase",
"Couldn't save the sheet grade to Firebase"
],
[
"تعذر حفظ درجة امتحان القصة في Firebase",
"Couldn't save the story exam grade to Firebase"
],
[
"تم اجتياز هذا الامتحان",
"You passed this exam"
],
[
"تم اجتياز هذا الشيت",
"You passed this sheet"
],
[
"تم فتح شيت الدرس في تبويب جديد.",
"The lesson sheet opened in a new tab."
],
[
"جيد جدًا",
"Very good"
],
[
"جيد",
"Good"
],
[
"ممتاز",
"Excellent"
],
[
"مقبول",
"Acceptable"
],
[
"ضعيف",
"Weak"
],
[
"حذف المهمة",
"Delete task"
],
[
"درجة نهائية",
"Perfect score"
],
[
"دروس {*0} — افتح أي درس لتبدأ.",
"{*0} lessons — open any lesson to start."
],
[
"وحدات {*0} — اختر وحدة لعرض دروسها وامتحانها.",
"{*0} units — pick a unit to see its lessons and exam."
],
[
"سيتم إضافة شيت هذا الدرس قريبًا.",
"This lesson's sheet will be added soon."
],
[
"سيتم إضافة فيديو شرح هذا الدرس قريبًا.",
"This lesson's explanation video will be added soon."
],
[
"سيتم إضافة فيديو شرح هذا الفصل قريبًا.",
"This chapter's explanation video will be added soon."
],
[
"سيتم إضافة ملف هذا الدرس قريبًا.",
"This lesson's file will be added soon."
],
[
"شيت الدرس",
"Lesson sheet"
],
[
"شيت الدرس:",
"Lesson sheet:"
],
[
"شيت:",
"Sheet:"
],
[
"صفحة PDF",
"PDF page"
],
[
"صفحة PDF القصة",
"Story PDF page"
],
[
"فتح ملف PDF",
"Open PDF file"
],
[
"فتح نسخة PDF من الفصل",
"Open the chapter's PDF copy"
],
[
"فيديو الشرح",
"Explanation video"
],
[
"قراءة شرح الدرس كاملًا",
"Read the full lesson explanation"
],
[
"قراءة نص الفصل كاملًا",
"Read the full chapter text"
],
[
"قريبًا",
"Soon"
],
[
"متوسط \"{*0}\":",
"Average \"{*0}\":"
],
[
"ملف الدرس (PDF)",
"Lesson file (PDF)"
],
[
"نص الدرس",
"Lesson text"
],
[
"هات الدرجة النهائية في امتحانات الوحدات والدروس والشيتات (كل امتحان بيتحسب مرة واحدة).",
"Get the full mark in unit exams, lesson exams and sheets (each exam counts once)."
],
[
"هتخرج من حسابك على الجهاز ده. متأكد إنك عايز تسجّل الخروج؟",
"You'll be logged out of your account on this device. Are you sure you want to log out?"
],
[
"هل تريد تحميل شارة \"{*0}\" كصورة؟",
"Do you want to download the \"{*0}\" badge as an image?"
],
[
"يوم",
"day"
],
[
"طالب",
"students"
],
[
"درسًا",
"lessons"
],
[
"أخضر",
"Green"
],
[
"أزرق",
"Blue"
],
[
"أغمق قليلًا",
"Slightly darker"
],
[
"ألوان المنصة",
"Platform colors"
],
[
"اتحفظت على جهازك بس — تعذّر حفظها أونلاين.",
"Saved on your device only — couldn't save online."
],
[
"اختار الألوان اللي تريحك — بتظهر عندك إنت بس وبتتحفظ على حسابك، والدارك مود بيتولّد تلقائيًا من نفس الألوان.",
"Pick the colors you like — they show for you only and are saved to your account. Dark mode is generated automatically from the same colors."
],
[
"الأصلي (أزرق مخضر)",
"Original (teal)"
],
[
"الأغمق",
"Darkest"
],
[
"الإعدادات",
"Settings"
],
[
"الرجوع لألوان المنصة",
"Back to platform colors"
],
[
"العنصر النشط",
"Active item"
],
[
"الفاتحة",
"Light"
],
[
"اللون الأساسي",
"Primary color"
],
[
"المظهر واللغة والتطبيق",
"Appearance, language & app"
],
[
"المظهر واللغة",
"Appearance & language"
],
[
"الهوية",
"Identity"
],
[
"بتستخدم ألوان المنصة الأصلية.",
"Using the original platform colors."
],
[
"بتستخدم ألوانك الخاصة.",
"Using your own colors."
],
[
"برتقالي ترابي",
"Earthy orange"
],
[
"بنفسجي",
"Purple"
],
[
"تحكّم في مظهر المنصة ولغتها وتثبيتها كتطبيق على جهازك.",
"Control the platform's look and language, and install it as an app on your device."
],
[
"تم حفظ ألوانك",
"Your colors were saved"
],
[
"تمييز فاتح",
"Light highlight"
],
[
"تيل غامق",
"Dark teal"
],
[
"ثبّت المنصة على شاشتك الرئيسية",
"Install the platform on your home screen"
],
[
"ثيمات وألوان خاصة بيك",
"Themes and colors just for you"
],
[
"حفظ الألوان",
"Save colors"
],
[
"خلفية الحقول والكروت",
"Fields and cards background"
],
[
"خلفية الصفحة",
"Page background"
],
[
"رجعت ألوان المنصة",
"Platform colors restored"
],
[
"رجوع للإعدادات",
"Back to settings"
],
[
"رمادي أردوازي",
"Slate gray"
],
[
"سجّل دخولك الأول.",
"Log in first."
],
[
"عنابي",
"Burgundy"
],
[
"فاتح/غامق، اللغة، تحميل التطبيق",
"Light/dark, language, install app"
],
[
"قوة التأثير",
"Effect strength"
],
[
"لمسات وخلفيات",
"Accents & backgrounds"
],
[
"لون التمييز (الأزرار)",
"Accent color (buttons)"
],
[
"لون النصوص والعناوين",
"Text and headings color"
],
[
"مظهر الزجاج السائل بتاع iOS على كل المنصة",
"iOS liquid-glass look across the whole platform"
],
[
"معاينة — لسه ما اتحفظتش.",
"Preview — not saved yet."
],
[
"لوحة تحكم الأدمن — Shady Nasr English Platform",
"Admin dashboard — Shady Nasr English Platform"
],
[
"لوحة تحكم الأدمن",
"Admin dashboard"
],
[
"أهلاً يا أدمن — ده ملخص سريع لكل الطلاب المسجلين على المنصة.",
"Hello admin — here's a quick summary of all students registered on the platform."
],
[
"أهلاً يا {*0}",
"Hello {*0}"
],
[
"أهلاً يا",
"Hello"
],
[
"اختار الصف الدراسي عشان تشوف طلابه، أو ابحث عن أي طالب بالاسم أو الإيميل في كل الصفوف. اضغط على الطالب عشان تشوف ملفه الكامل.",
"Pick a grade to see its students, or search any student by name or email across all grades. Tap a student to see their full profile."
],
[
"رسائل الطلاب بتوصلك هنا لحظيًا. اضغط على أي محادثة عشان تفتحها، واضغط على صورة الطالب جوّه المحادثة عشان تشوف ملفه الكامل.",
"Student messages reach you here instantly. Tap any chat to open it, and tap the student's photo inside the chat to see their full profile."
],
[
"إجابات الطلاب المقالية. اكتب الدرجة وملاحظاتك واحفظ — الدرجة بتتسجّل في سجل درجات الطالب.",
"Students' essay answers. Enter the score and your feedback, then save — the score is recorded in the student's grade log."
],
[
"اكتب إعلان أو تنبيه (ميعاد امتحان، حصة إضافية، رسالة تشجيع) وهيظهر للطلاب في الصفحة الرئيسية وفي الجرس. تقدر تبعته لكل الطلاب أو لصف معيّن، وتعدّله أو تحذفه وقت ما تحب.",
"Write an announcement or alert (exam date, extra class, encouragement) and it will show to students on the home page and in the bell. Send it to all students or a specific grade, and edit or delete it any time."
],
[
"ارفع صور الأوائل (صورة أو أكتر مرة واحدة) واكتب لكل صورة عنوانها، واختار السنة الدراسية اللي هتظهر لها. الطالب بيشوف الصور متقسّمة حسب شهر النشر، وبيقدر ينزّلها.",
"Upload the toppers' photos (one or more at once), add a title for each photo, and choose the grade it appears for. Students see the photos grouped by publishing month and can download them."
],
[
"ده الإيميل اللي بتدخل بيه صفحة تسجيل الدخول. لازم تكتب كلمة المرور الحالية للتأكيد.",
"This is the email you use on the login page. You must enter your current password to confirm."
],
[
"كود التحقق عند تسجيل دخول الأدمن بيتبعت على الإيميل ده. لو سبته فاضي هيتبعت على إيميل تسجيل الدخول نفسه.",
"The admin login verification code is sent to this email. If you leave it empty it's sent to the login email itself."
],
[
"غيّر الألوان الرئيسية وشوف المعاينة فورًا. لما تضغط «حفظ وتطبيق على المنصة» بتتسجّل في Firebase وبتظهر لكل الطلاب والزوار (الدارك مود بيتولّد تلقائيًا من نفس الألوان).",
"Change the main colors and see the preview instantly. When you press “Save & apply to platform” they're stored in Firebase and shown to all students and visitors (dark mode is generated automatically from the same colors)."
],
[
"ثيمات جاهزة (اضغط على أي ثيم لتطبيقه، وبعدين تقدر تعدّل ألوانه بإيدك)",
"Ready-made themes (tap any theme to apply it, then fine-tune its colors by hand)"
],
[
"اكتب اسم المنصة بإيدك واختار لوجو من صور جهازك. التغيير بيظهر لكل الطلاب والزوار، وبيظهرلهم شريط «تحديث» فوق الشاشة لحد ما يضغطوا عليه.",
"Type the platform name and choose a logo from your device's photos. The change shows for all students and visitors, with an “Update” bar at the top of the screen until they tap it."
],
[
"الكلام اللي تحت الاسم في الهيدر (اختياري)",
"The text under the name in the header (optional)"
],
[
"الصورة بتتصغّر تلقائيًا. الأفضل PNG بخلفية شفافة.",
"The image is resized automatically. PNG with a transparent background works best."
],
[
"هيرجع اللوجو الأصلي لما تضغط «حفظ وتطبيق على المنصة».",
"The original logo is restored when you press “Save & apply to platform”."
],
[
"الصورة جاهزة — اضغط «حفظ وتطبيق على المنصة».",
"Image ready — press “Save & apply to platform”."
],
[
"حفظ وتطبيق على المنصة",
"Save & apply to platform"
],
[
"الرجوع للاسم واللوجو الأصليين",
"Restore original name and logo"
],
[
"الرجوع للوجو الأصلي",
"Restore original logo"
],
[
"هيرجع اسم المنصة واللوجو للأصليين عند كل الطلاب.",
"The platform name and logo will revert to the originals for all students."
],
[
"هترجع كل ألوان المنصة للألوان الأصلية عند كل الطلاب.",
"All platform colors will revert to the originals for all students."
],
[
"هتتحذف الملاحظة دي وتختفي من عند الطالب.",
"This note will be deleted and disappear from the student's view."
],
[
"الإعلان هيتشال من عند كل الطلاب. متأكد؟",
"The announcement will be removed for all students. Are you sure?"
],
[
"الصورة هتتشال من عند كل الطلاب. متأكد؟",
"The photo will be removed for all students. Are you sure?"
],
[
"هتتغير كلمة مرور {*0} فورًا.",
"{*0}'s password will change immediately."
],
[
"هيتم حذف حساب {*0} وكل درجاته ومقالاته وتقدّمه نهائيًا من قاعدة البيانات، وهيتسجّل خروجه تلقائيًا لو فاتح المنصة. مينفعش الرجوع فيه.",
"{*0}'s account and all their grades, essays and progress will be permanently deleted from the database, and they'll be logged out automatically if they have the platform open. This cannot be undone."
],
[
"بعد التغيير هتسجّل دخول بالإيميل الجديد: {*0}",
"After the change you'll log in with the new email: {*0}"
],
[
"هيتبعت الكود على إيميل الدخول",
"The code will be sent to the login email"
],
[
"الملاحظة بتوصل للطالب على طول وبتظهر له في الإشعارات.",
"The note reaches the student immediately and appears in their notifications."
],
[
"اتبعتت الملاحظة للطالب",
"Note sent to the student"
],
[
"اكتب الملاحظة الأول",
"Write the note first"
],
[
"اكتب الملاحظة للطالب هنا…",
"Write the note to the student here…"
],
[
"اكتب التفاصيل هنا…",
"Write the details here…"
],
[
"اكتب عنوان لكل صورة.",
"Write a title for each photo."
],
[
"اكتب عنوان ونص الإعلان.",
"Write the announcement's title and text."
],
[
"اختار صورة واحدة على الأقل.",
"Choose at least one photo."
],
[
"اختار طالب من القايمة عشان تفتح المحادثة",
"Pick a student from the list to open the chat"
],
[
"اختيار صور من الجهاز",
"Choose photos from device"
],
[
"اختيار صورة من الجهاز",
"Choose a photo from device"
],
[
"ابحث بالاسم أو الإيميل في كل الصفوف…",
"Search by name or email across all grades…"
],
[
"ابحث بالاسم أو الإيميل…",
"Search by name or email…"
],
[
"ابحث عن طالب…",
"Search for a student…"
],
[
"ابحث في {*0}",
"Search in {*0}"
],
[
"آخر المسجّلين",
"Latest registrations"
],
[
"أعلى 5 طلاب نقاطًا",
"Top 5 students by points"
],
[
"الطلاب حسب الصف",
"Students by grade"
],
[
"أيام الدخول",
"Login days"
],
[
"إجراءات الأدمن",
"Admin actions"
],
[
"إجمالي الطلاب",
"Total students"
],
[
"إجمالي النقاط",
"Total points"
],
[
"إخفاء",
"Hide"
],
[
"إرسال للطالب",
"Send to student"
],
[
"إزالة",
"Remove"
],
[
"إعلان جديد",
"New announcement"
],
[
"إلغاء التعديل",
"Cancel editing"
],
[
"إيميل مفعّل",
"Email verified"
],
[
"إيميل غير مفعّل",
"Email not verified"
],
[
"إيميلات مفعّلة",
"Verified emails"
],
[
"الإيميل مفعّل",
"Email verified"
],
[
"اتصحح",
"Graded"
],
[
"اتصححت",
"Was graded"
],
[
"لسه ما اتصححتش",
"Not graded yet"
],
[
"لم يُصحَّح",
"Not graded"
],
[
"في الانتظار",
"Pending"
],
[
"اتنشر",
"Published"
],
[
"اتنشرت صورة جديدة في قسم الأوائل:",
"A new photo was published in the Toppers section:"
],
[
"ادخل شوفها ونزّلها.",
"Go take a look and download it."
],
[
"ادخل شوفهم ونزّلهم.",
"Go take a look and download them."
],
[
"استلام كود دخول الأدمن",
"Receive admin login code"
],
[
"اسم المنصة واللوجو",
"Platform name & logo"
],
[
"اسم المنصة",
"Platform name"
],
[
"الأحدث تسجيلًا",
"Newest registered"
],
[
"الأقدم تسجيلًا",
"Oldest registered"
],
[
"الأكثر نقاطًا",
"Most points"
],
[
"الاسم (أ → ي)",
"Name (A → Z)"
],
[
"الألوان الأصلية",
"Original colors"
],
[
"الإعلانات المنشورة",
"Published announcements"
],
[
"الإعلانات",
"Announcements"
],
[
"الإيميل ده مستخدم في حساب تاني",
"This email is used by another account"
],
[
"الإيميل الجديد",
"New email"
],
[
"الإيميل",
"Email"
],
[
"الاسم الظاهر",
"Display name"
],
[
"الاسم",
"Name"
],
[
"التأكيد مش مطابق",
"Confirmation doesn't match"
],
[
"الترتيب",
"Sort"
],
[
"الحالة",
"Status"
],
[
"الدرجات",
"Grades"
],
[
"الدرجة لازم تكون بين 0 و",
"The score must be between 0 and"
],
[
"الدرجة",
"Score"
],
[
"الدور",
"Role"
],
[
"الدروس المكتملة",
"Lessons completed"
],
[
"الرجوع للأصلي",
"Restore original"
],
[
"الرجوع للألوان الأصلية",
"Restore original colors"
],
[
"السنة الدراسية",
"Grade"
],
[
"الشارات",
"Badges"
],
[
"الصف",
"Grade"
],
[
"الصور المنشورة",
"Published photos"
],
[
"الصور",
"Photos"
],
[
"الصورة دي مش مدعومة، جرّب PNG أو JPG.",
"This image isn't supported, try PNG or JPG."
],
[
"الصورة كبيرة قوي، جرّب صورة أبسط أو أصغر.",
"The image is too large, try a simpler or smaller one."
],
[
"كبيرة قوي (الحد 25 ميجا).",
"is too large (25 MB limit)."
],
[
"مش صورة — اتجاهل.",
"is not an image — skipped."
],
[
"الطلاب",
"Students"
],
[
"العمر",
"Age"
],
[
"القائمة",
"Menu"
],
[
"الكل",
"All"
],
[
"المتوسط:",
"Average:"
],
[
"المحادثات",
"Chats"
],
[
"المسار",
"Track"
],
[
"المعرّف (ID)",
"ID"
],
[
"المقالات",
"Essays"
],
[
"النقاط",
"Points"
],
[
"امتحانات فصول القصة",
"Story chapter exams"
],
[
"امتحانات مسجّلة",
"Recorded exams"
],
[
"بدون تاريخ",
"No date"
],
[
"بكالوريا:",
"Baccalaureate:"
],
[
"بكالوريا",
"Baccalaureate"
],
[
"ثانوية عامة:",
"General secondary:"
],
[
"ثانوية عامة",
"General secondary"
],
[
"بيانات الأدمن",
"Admin details"
],
[
"بيانات الحساب",
"Account details"
],
[
"تأكيد كلمة المرور الجديدة",
"Confirm new password"
],
[
"تأكيد",
"Confirm"
],
[
"إلغاء",
"Cancel"
],
[
"تاريخ التسجيل",
"Registration date"
],
[
"تثبيت المنصة كتطبيق",
"Install the platform as an app"
],
[
"تحديث التصحيح",
"Update grading"
],
[
"حفظ الدرجة",
"Save score"
],
[
"تحذير",
"Warning"
],
[
"تشجيع",
"Encouragement"
],
[
"نصيحة",
"Advice"
],
[
"تنبيه",
"Alert"
],
[
"تسجيلات آخر 7 أيام",
"Sign-ups in the last 7 days"
],
[
"تصحيح المقالات",
"Essay grading"
],
[
"تصدير Excel",
"Export Excel"
],
[
"تعديل الإعلان",
"Edit announcement"
],
[
"تعديل النقاط (القيمة الجديدة)",
"Edit points (new value)"
],
[
"تعديل",
"Edit"
],
[
"تعذر الإرسال — راجع صلاحيات Firebase",
"Couldn't send — check Firebase permissions"
],
[
"تعذر التحديث",
"Couldn't update"
],
[
"تعذر التغيير — راجع صلاحيات Firebase",
"Couldn't change — check Firebase permissions"
],
[
"تعذر التغيير",
"Couldn't change"
],
[
"تعذر الحذف — راجع صلاحيات Firebase",
"Couldn't delete — check Firebase permissions"
],
[
"تعذر الحذف",
"Couldn't delete"
],
[
"تعذر الحفظ — راجع صلاحيات Firebase",
"Couldn't save — check Firebase permissions"
],
[
"تعذر الحفظ — راجع قواعد Firebase",
"Couldn't save — check Firebase rules"
],
[
"تعذر الحفظ",
"Couldn't save"
],
[
"تعذر النشر — راجع قواعد Firebase",
"Couldn't publish — check Firebase rules"
],
[
"تعذر تحميل الإعلانات",
"Couldn't load announcements"
],
[
"تعذر تحميل البيانات من Firebase — راجع الاتصال وصلاحيات Realtime Database.",
"Couldn't load data from Firebase — check the connection and Realtime Database permissions."
],
[
"تعذر تحميل البيانات",
"Couldn't load data"
],
[
"تعذر تحميل الصور — راجع قواعد Firebase",
"Couldn't load photos — check Firebase rules"
],
[
"تعذر تحميل الصورة",
"Couldn't load the photo"
],
[
"تعذر تحميل المقالات — راجع صلاحيات Firebase",
"Couldn't load essays — check Firebase permissions"
],
[
"تعذر قراءة الصورة",
"Couldn't read the image"
],
[
"تعذّر تجهيز النسخة الاحتياطية",
"Couldn't prepare the backup"
],
[
"تعذّر تحميل مكتبة الإكسل — جرّب زرار JSON",
"Couldn't load the Excel library — try the JSON button"
],
[
"تغيير إيميل الدخول",
"Change login email"
],
[
"تغيير كلمة مرور الأدمن",
"Change admin password"
],
[
"تغيير كلمة المرور",
"Change password"
],
[
"تغيير",
"Change"
],
[
"تقرير PDF",
"PDF report"
],
[
"تقرير الطالب",
"Student report"
],
[
"تقرير بتاريخ",
"Report date"
],
[
"المتصفح منع النافذة — اسمح بالنوافذ المنبثقة وجرّب تاني",
"Pop-up blocked — allow pop-ups and try again"
],
[
"جاري تجهيز التقرير…",
"Preparing the report…"
],
[
"تطوّر المستوى",
"Progress"
],
[
"تم التحديث",
"Updated"
],
[
"تم تحديث النقاط",
"Points updated"
],
[
"تم تحميل النسخة الاحتياطية",
"Backup downloaded"
],
[
"تم تعديل الإعلان",
"Announcement updated"
],
[
"تم تغيير إيميل الدخول",
"Login email changed"
],
[
"تم تغيير كلمة المرور",
"Password changed"
],
[
"تم حذف الإعلان",
"Announcement deleted"
],
[
"تم حذف الصورة",
"Photo deleted"
],
[
"تم حذف الطالب",
"Student deleted"
],
[
"تم حفظ إعدادات المنصة وتطبيقها",
"Platform settings saved and applied"
],
[
"تم حفظ إيميل التحقق",
"Verification email saved"
],
[
"تم حفظ الألوان وتطبيقها على المنصة",
"Colors saved and applied to the platform"
],
[
"تم حفظ الاسم",
"Name saved"
],
[
"تم حفظ التصحيح",
"Grading saved"
],
[
"تم نشر الإعلان للطلاب",
"Announcement published to students"
],
[
"تم نشر الصورة للطلاب",
"Photo published to students"
],
[
"تم نشر",
"Published"
],
[
"ثيمات وألوان لكل الطلاب",
"Themes & colors for all students"
],
[
"جاري التجهيز...",
"Preparing..."
],
[
"جاري تحميل البيانات…",
"Loading data…"
],
[
"جاري تحميل المحادثات…",
"Loading chats…"
],
[
"جاري تحميل بيانات الطالب…",
"Loading student data…"
],
[
"حذف الإعلان",
"Delete announcement"
],
[
"حذف الصورة",
"Delete photo"
],
[
"حذف الطالب نهائيًا",
"Delete student permanently"
],
[
"حذف الطالب",
"Delete student"
],
[
"حذف الملاحظة",
"Delete note"
],
[
"حذف نهائي",
"Delete permanently"
],
[
"حذف",
"Delete"
],
[
"عرض",
"View"
],
[
"حصة إضافية",
"Extra class"
],
[
"حفظ إيميل التحقق",
"Save verification email"
],
[
"حفظ الاسم",
"Save name"
],
[
"حفظ التعديل",
"Save changes"
],
[
"حفظ النقاط",
"Save points"
],
[
"درجات الامتحانات",
"Exam grades"
],
[
"درجات الشيتات",
"Sheet grades"
],
[
"درجات مسجّلة",
"Recorded grades"
],
[
"دروس مكتملة",
"Lessons completed"
],
[
"ده نفس الإيميل الحالي",
"This is the same as the current email"
],
[
"رجعت الألوان الأصلية",
"Original colors restored"
],
[
"رجعت الهوية الأصلية",
"Original identity restored"
],
[
"رجوع للأصلي",
"Restore original"
],
[
"← رجوع لقائمة الطلاب",
"← Back to student list"
],
[
"← رجوع للصفوف",
"← Back to grades"
],
[
"← رجوع لملف {*0}",
"← Back to {*0}'s profile"
],
[
"رجوع لقائمة الطلاب",
"Back to student list"
],
[
"رجوع للصفوف",
"Back to grades"
],
[
"رسالة تشجيع",
"Encouragement message"
],
[
"رفع صور الأوائل",
"Upload toppers' photos"
],
[
"سجل الملاحظات (حسب الشهر)",
"Notes log (by month)"
],
[
"صور جديدة في الأوائل",
"New photos in Toppers"
],
[
"صورة جديدة في الأوائل",
"New photo in Toppers"
],
[
"صور جديدة في قسم الأوائل ({*0})",
"New photos in the Toppers section ({*0})"
],
[
"صور للطلاب",
"Photos for students"
],
[
"عام",
"General"
],
[
"ميعاد امتحان",
"Exam date"
],
[
"عدد النتائج: {0} من {1} طالب",
"Results: {0} of {1} students"
],
[
"عرض البيانات الخام لتقدّم الطالب (userData)",
"Show raw student progress data (userData)"
],
[
"عنوان الإعلان",
"Announcement title"
],
[
"عنوان الصورة (مثال: أوائل امتحان الدرس الثالث)",
"Photo title (e.g. Lesson 3 exam toppers)"
],
[
"غالبًا قواعد Firebase (Rules) بتمنع قراءة users — راجع الرسالة اللي فوق.",
"Firebase Rules are probably blocking reads on users — see the message above."
],
[
"كل الطلاب",
"All students"
],
[
"كل بيانات التسجيل",
"All registration data"
],
[
"كلمة المرور الجديدة لازم 6 حروف على الأقل",
"The new password must be at least 6 characters"
],
[
"كلمة المرور الجديدة (6 حروف على الأقل)",
"New password (at least 6 characters)"
],
[
"كلمة المرور الحالية غير صحيحة",
"The current password is incorrect"
],
[
"كلمة المرور الحالية",
"Current password"
],
[
"كلمة المرور لازم 6 حروف على الأقل",
"Password must be at least 6 characters"
],
[
"كلمة مرور الأدمن",
"Admin password"
],
[
"كلمة مرور جديدة للطالب",
"New password for the student"
],
[
"6 حروف على الأقل",
"At least 6 characters"
],
[
"لسه مبعتّش ملاحظات للطالب ده",
"You haven't sent this student any notes yet"
],
[
"لسه مفيش إعلانات منشورة",
"No announcements published yet"
],
[
"لسه مفيش درجات",
"No grades yet"
],
[
"لسه مفيش صور منشورة",
"No photos published yet"
],
[
"لسه مفيش طلاب مسجّلين في الصف ده",
"No students registered in this grade yet"
],
[
"لسه مفيش طلاب",
"No students yet"
],
[
"لوجو المنصة",
"Platform logo"
],
[
"متوسط الدرجات",
"Average score"
],
[
"متوسط النقاط للطالب",
"Average points per student"
],
[
"مثال: امتحان الوحدة الأولى يوم السبت",
"e.g. Unit 1 exam on Saturday"
],
[
"مفيش طلاب مطابقين للبحث",
"No students match the search"
],
[
"مفيش مقالات في القسم ده",
"No essays in this section"
],
[
"مفيش مقالات",
"No essays"
],
[
"مفيش ملاحظات في الشهر ده",
"No notes this month"
],
[
"مفيش ملاحظات",
"No notes"
],
[
"مقالات الطالب",
"Student essays"
],
[
"مقال",
"Essay"
],
[
"ملاحظاتك للطالب",
"Your feedback to the student"
],
[
"ملاحظات الأستاذ",
"Teacher's notes"
],
[
"ملاحظة للطالب",
"Note to the student"
],
[
"ملاحظة",
"Note"
],
[
"{0} ملاحظة",
"{0} notes"
],
[
"من غير تغيير،",
"without changes,"
],
[
"نسخة احتياطية Excel",
"Backup Excel"
],
[
"نسخة احتياطية JSON",
"Backup JSON"
],
[
"نشر الإعلان",
"Publish announcement"
],
[
"نشر للطلاب",
"Publish to students"
],
[
"نص الإعلان",
"Announcement text"
],
[
"نظرة عامة",
"Overview"
],
[
"نعم",
"Yes"
],
[
"لا",
"No"
],
[
"يظهر لـ",
"Shown to"
],
[
"طلاب بدأوا يجمعوا نقاط",
"Students who started earning points"
],
[
"نقطة",
"pts"
],
[
"أدمن",
"Admin"
],
[
"الأدمن",
"Admin"
],
[
"ذكر",
"Male"
],
[
"أنثى",
"Female"
],
[
"المرحلة الإعدادية",
"Preparatory stage"
],
[
"المرحلة الثانوية",
"Secondary stage"
],
[
"قوائم الاختيار بشكل المنصة",
"Platform-styled select menus"
],
[
"إيميل استلام الكود",
"Code recipient email"
],
[
"إيميل تسجيل دخول الأدمن",
"Admin login email"
],
[
"إيميل كود التحقق (دخول الأدمن)",
"Verification code email (admin login)"
],
[
"إيميل كود التحقق",
"Verification code email"
],
[
"إيميل تسجيل الدخول",
"Login email"
],
[
"التليفون",
"Phone"
],
[
"تغيير اللغة",
"Change language"
],
[
"م",
"#"
],
[
"امتحانات",
"Exams"
],
[
"د",
"min"
],
[
"س",
"h"
],
[
"من",
"of"
],
["الرئيسية", "Home"],
["النوع", "Gender"],
["البريد الإلكتروني", "Email"],
["السن", "Age"],
["الصف الدراسي", "Grade"],
["الملف الشخصي", "Profile"],
["إغلاق", "Close"],
["الأوائل", "Toppers"],
["تحديث", "Refresh"],
["اختار القسم اللي عايز تعدّله.", "Choose the section you want to edit."],
["كلمة المرور", "Password"],
["إعدادات المنصة", "Platform settings"],
["رجوع", "Back"],
["اختيار صورة", "Choose a photo"],
["رجوع للدروس", "Back to lessons"],
["رجوع لخيارات الفصل", "Back to chapter options"],
["تسجيل الخروج", "Log out"],
["تواصل معنا", "Contact us"],
["الدروس", "Lessons"],
["القصة", "Story"],
["الحسابات", "Accounts"],
["لوحة الصدارة", "Leaderboard"],
["سجل الدرجات", "Grades"],
["المزيد", "More"]
];

  var ARB = "\\u0600-\\u06FF";
  var HAS_AR = /[\u0600-\u06FF]/;
  var exact = Object.create(null);
  var rules = [];

  function esc(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }
  PAIRS.forEach(function (p) {
    var ar = p[0].replace(/\s+/g, " ").trim(), en = p[1];
    var hasPh = /\{\*?\d\}/.test(ar);
    exact[ar] = en;
    if (!hasPh && (ar.length <= 3 || ar.indexOf(" ") < 0)) return; // كلمة واحدة أو مفتاح قصير: مطابقة كاملة بس
    var src = esc(ar).replace(/\\\{\\\*(\d)\\\}$/, "(.+)").replace(/\\\{\\\*(\d)\\\}/g, "(.+?)").replace(/\\\{(\d)\\\}/g, "(\\d[\\d.,]*)");
    try {
      rules.push({ len: ar.length, re: new RegExp("(?<![" + ARB + "])" + src + "(?![" + ARB + "])", "g"), en: en });
    } catch (e) { /* متصفح قديم من غير lookbehind */
      rules.push({ len: ar.length, re: new RegExp(src, "g"), en: en });
    }
  });
  rules.sort(function (a, b) { return b.len - a.len; });

  function translate(str) {
    if (!str || !HAS_AR.test(str)) return str;
    var lead = str.match(/^\s*/)[0], trail = str.match(/\s*$/)[0];
    var core = str.replace(/\s+/g, " ").trim();
    if (exact[core] != null) return lead + exact[core] + trail;
    var out = core;
    for (var i = 0; i < rules.length; i++) {
      out = out.replace(rules[i].re, function () {
        var g = arguments, en = rules[i].en;
        return en.replace(/\{\*?(\d)\}/g, function (x, n) { return g[+n + 1]; });
      });
      if (!HAS_AR.test(out)) break;
    }
    return out === core ? str : lead + out + trail;
  }

  var ATTRS = ["placeholder", "aria-label", "title", "alt"];
  var SKIP = { SCRIPT: 1, STYLE: 1, TEXTAREA: 1, CODE: 1, PRE: 1, NOSCRIPT: 1 };
  var tracked = new Set();           // نودز/عناصر اتترجمت
  var nodeMap = new WeakMap();       // text node -> {ar, en}
  var attrMap = new WeakMap();       // element -> {attr: {ar, en}}
  var lang = function () { return document.documentElement.lang === "en" ? "en" : "ar"; };

  function doText(n) {
    var p = n.parentNode;
    if (!p || SKIP[p.nodeName]) return;
    var cur = n.nodeValue, t = nodeMap.get(n);
    if (t && t.en === cur) return;              // ده نص إحنا كتبناه
    if (!HAS_AR.test(cur)) return;
    var en = translate(cur);
    if (en !== cur) { nodeMap.set(n, { ar: cur, en: en }); tracked.add(n); n.nodeValue = en; }
  }
  function doAttrs(el) {
    if (!el.getAttribute) return;
    for (var i = 0; i < ATTRS.length; i++) {
      var a = ATTRS[i], v = el.getAttribute(a);
      if (!v || !HAS_AR.test(v)) continue;
      var m = attrMap.get(el) || {}, t = m[a];
      if (t && t.en === v) continue;
      var en = translate(v);
      if (en !== v) { m[a] = { ar: v, en: en }; attrMap.set(el, m); tracked.add(el); el.setAttribute(a, en); }
    }
  }
  function walk(root) {
    if (!root) return;
    if (root.nodeType === 3) { doText(root); return; }
    if (root.nodeType !== 1 || SKIP[root.nodeName]) return;
    doAttrs(root);
    for (var c = root.firstChild; c; c = c.nextSibling) walk(c);
  }

  var titleAr = null;
  function doTitle() {
    var t = document.title;
    if (!HAS_AR.test(t)) return;
    var en = translate(t);
    if (en !== t) { titleAr = t; document.title = en; }
  }

  function restore() {
    tracked.forEach(function (x) {
      if (x.nodeType === 3) {
        var t = nodeMap.get(x);
        if (t && x.nodeValue === t.en) x.nodeValue = t.ar;
      } else {
        var m = attrMap.get(x);
        if (m) Object.keys(m).forEach(function (a) { if (x.getAttribute(a) === m[a].en) x.setAttribute(a, m[a].ar); });
      }
    });
    tracked.clear();
    if (titleAr) { document.title = titleAr; titleAr = null; }
  }

  var obs = null;
  function onMutations(list) {
    if (lang() !== "en") return;
    list.forEach(function (m) {
      if (m.type === "characterData") doText(m.target);
      else if (m.type === "attributes") doAttrs(m.target);
      else m.addedNodes.forEach(walk);
    });
  }
  function run() {
    if (!document.body) return;
    if (lang() === "en") { walk(document.body); doTitle(); }
    else restore();
  }
  function init() {
    run();
    obs = new MutationObserver(onMutations);
    obs.observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ATTRS });
    new MutationObserver(run).observe(document.documentElement, { attributes: true, attributeFilter: ["lang"] });
    window.addEventListener("load", run);
    // ترجمة تانية بعد ما الصفحة تستقر (السبلاش والبيانات المتأخرة)
    setTimeout(run, 1200);
  }
  window.SNI18n = { translate: translate, run: run };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
})();

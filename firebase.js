/* ==========================================================================
   firebase.js — الربط الحقيقي بين الموقع و Firebase Realtime Database + EmailJS
   ==========================================================================
   ده الملف المسؤول عن:
   - إنشاء حساب طالب حقيقي وتخزينه في قاعدة البيانات (Realtime Database)
   - تسجيل الدخول والتحقق من الإيميل/الباسورد الحقيقيين
   - توليد كود تحقق (OTP) حقيقي، تخزينه مؤقتًا، وإرساله فعليًا على الإيميل عبر EmailJS
   - جلب بيانات الطلاب (للوحة المتصدرين لاحقًا، ولوحة تحكم الأدمن مستقبلًا)

   ملاحظة أمان مهمة:
   الموقع ده استاتيك (من غير سيرفر خاص بينا)، فكلمة السر بتتحول لبصمة (hash) بطريقة
   SHA-256 في متصفح الطالب نفسه قبل ما تتخزن، بدل ما تتخزن كنص صريح. ده أفضل من
   تخزينها زي ما هي، لكنه مش بديل كامل لنظام مصادقة حقيقي زي Firebase Authentication.
   لازم كمان تضبط "Realtime Database Rules" في لوحة تحكم Firebase عشان محدش يقدر
   يقرا/يعدّل بيانات المستخدمين مباشرة من برا الموقع.

   ملفات لازم تحمّل السكريبتات دي قبله بالترتيب ده في أي صفحة بتستخدمه:
     <script src="https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js"></script>
     <script src="https://www.gstatic.com/firebasejs/10.12.2/firebase-database-compat.js"></script>
     <script src="https://cdn.jsdelivr.net/npm/@emailjs/browser@3/dist/email.min.js"></script>
     <script src="firebase.js"></script>
   ========================================================================== */

(() => {
  "use strict";

  const firebaseConfig = {
  apiKey: "AIzaSyCydGaALkH_w2idhwn384r_4_pfLS-5wLY",
  authDomain: "shady-nasr.firebaseapp.com",
  databaseURL: "https://shady-nasr-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "shady-nasr",
  storageBucket: "shady-nasr.firebasestorage.app",
  messagingSenderId: "860152398792",
  appId: "1:860152398792:web:24f86c7af29b454e1736fd",
  measurementId: "G-VPT33BDSGG",
};

  const EMAILJS_PUBLIC_KEY = "qVVctir3JzIeYqnxY";
  const EMAILJS_SERVICE_ID = "service_oqco85o";
  const EMAILJS_TEMPLATE_ID = "template_xzyzvd2";
  const OTP_TTL_MS = 10 * 60 * 1000; // الكود صالح 10 دقايق

  if (typeof firebase === "undefined") {
    console.error(
      "Firebase SDK مش محمّل. لازم تضيف سكريبتات firebase-app-compat.js و firebase-database-compat.js قبل firebase.js."
    );
    return;
  }

  if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);
  const db = firebase.database();

  if (window.emailjs && typeof emailjs.init === "function") {
    // نسخة @emailjs/browser@3 بتستنى الـ Public Key كنص مباشر (الـ object ده لنسخة v4 بس)،
    // ولو اتبعت object بيرفض الطلب بـ "Public Key is invalid".
    emailjs.init(EMAILJS_PUBLIC_KEY);
  }

  /* --- تحويل الإيميل لمفتاح صالح كمسار في Realtime Database (ممنوع فيه . # $ [ ] /) --- */
  function emailToKey(email) {
    return String(email).trim().toLowerCase().replace(/[.#$[\]/]/g, "_");
  }

  /* --- بصمة SHA-256 لكلمة السر (مش مشفرة بالكامل زي backend حقيقي، لكن أأمن من نص صريح) --- */
  async function hashPassword(password) {
    const enc = new TextEncoder().encode(password);
    const buf = await crypto.subtle.digest("SHA-256", enc);
    return Array.from(new Uint8Array(buf))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  }

  function generateOtp() {
    // crypto.getRandomValues بدل Math.random: الكود ده بيحمي الحساب فمينفعش يكون متوقَّع.
    const buf = new Uint32Array(1);
    crypto.getRandomValues(buf);
    return String(100000 + (buf[0] % 900000));
  }

  /* --- إرسال كود التحقق فعليًا عبر EmailJS، باستخدام نفس متغيرات التمبلت الموجود --- */
  /* اسم المنصة اللي الأدمن كتبه (من الكاش المحلي) أو الاسم الأصلي */
  function brandName() {
    try {
      const b = JSON.parse(localStorage.getItem("shadynasr-site-branding"));
      if (b && b.name) return String(b.name);
    } catch (e) { /* مش مشكلة */ }
    return "Shady Nasr English Platform";
  }

  /* تحميل مكتبة EmailJS بنفسنا لو الصفحة ما حمّلتهاش (نت ضعيف / CDN متحجوب على جهاز الطالب) */
  const EMAILJS_CDNS = [
    "https://cdn.jsdelivr.net/npm/@emailjs/browser@3/dist/email.min.js",
    "https://fastly.jsdelivr.net/npm/@emailjs/browser@3/dist/email.min.js",
    "https://unpkg.com/@emailjs/browser@3/dist/email.min.js",
  ];
  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = src;
      s.async = true;
      s.onload = resolve;
      s.onerror = () => { s.remove(); reject(new Error("LOAD_FAILED")); };
      document.head.appendChild(s);
    });
  }
  async function ensureEmailJs() {
    if (window.emailjs && typeof window.emailjs.send === "function") return;
    for (const src of EMAILJS_CDNS) {
      try { await loadScript(src); } catch (e) { /* نجرّب اللي بعده */ }
      if (window.emailjs && typeof window.emailjs.send === "function") break;
    }
    if (!window.emailjs) throw new Error("EMAILJS_NOT_LOADED");
    try { window.emailjs.init(EMAILJS_PUBLIC_KEY); } catch (e) { /* المفتاح بيتبعت مع الإرسال برضه */ }
  }
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));

  async function sendOtpEmail({ toEmail, name, code, flow }) {
    await ensureEmailJs();
    const params = {
      to_email: toEmail,
      "to-email": toEmail,
      email: toEmail,
      name: name || toEmail,
      platform_name: brandName(),
      time: new Date().toLocaleString("ar-EG", { dateStyle: "medium", timeStyle: "short" }),
      code: code,
      otp_code: "كود التحقق: " + code,
      "otp-code": code,
      title: flow === "reset" ? "كود استعادة كلمة المرور" : "كود التحقق من الحساب",
    };
    // المفتاح بيتبعت مع كل إرسال (مش بنعتمد على init بس)، ومحاولة تانية لو النت قطع لحظة أو EmailJS رد بـ 429/5xx
    try {
      return await emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, params, EMAILJS_PUBLIC_KEY);
    } catch (err) {
      const st = err && typeof err.status === "number" ? err.status : -1;
      if (st === 0 || st === 429 || st >= 500) {
        await wait(1300);
        return emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, params, EMAILJS_PUBLIC_KEY);
      }
      throw err;
    }
  }

  /* --- قراءة العقدة المخزّنة تحت مفتاح الإيميل كما هي (حتى لو تخص إيميل تاني بنفس المفتاح) --- */
  async function readUserRecord(email) {
    const snap = await db.ref("users/" + emailToKey(email)).get();
    return snap.exists() ? snap.val() : null;
  }

  /* emailToKey بتحوّل . # $ [ ] / إلى _ فإيميلين مختلفين (a.b@x.com و a_b@x.com) ممكن يطلعوا نفس المفتاح.
     فبنقارن الإيميل الحقيقي المخزّن في الحساب بالإيميل المطلوب قبل ما نعتبره نفس الشخص. */
  function sameEmail(record, email) {
    if (!record || !record.email) return true; // حساب قديم من غير حقل email: نعامله زي ما كان
    return String(record.email).trim().toLowerCase() === String(email).trim().toLowerCase();
  }

  async function findUserByEmail(email) {
    const record = await readUserRecord(email);
    return record && sameEmail(record, email) ? record : null;
  }

  /* --- تجهيز بيانات حساب جديد *بدون ما يتحفظ* في قاعدة البيانات.
         الحساب مش بيتسجّل غير بعد ما الطالب يكتب كود التحقق الصحيح (commitRegistration). --- */
  async function prepareRegistration({ fullName, email, password, age, grade, gender, track }) {
    const cleanEmail = String(email).trim().toLowerCase();
    const key = emailToKey(cleanEmail);

    // حساب قديم اتعمل ومتفعّلش أبدًا (emailVerified === false) بنعتبره مش مسجّل
    const existing = await readUserRecord(cleanEmail);
    if (existing && existing.emailVerified !== false) throw new Error("EMAIL_EXISTS"); // نفس الإيميل أو مفتاح متصادم: الاتنين مرفوضين

    const passwordHash = await hashPassword(password);
    return {
      id: key,
      fullName: String(fullName).trim(),
      email: cleanEmail,
      passwordHash,
      age: Number(age) || null,
      grade,
      // المسار للثانوي بس: "general" (ثانوية عامة) أو "bacc" (بكالوريا) — نفس محتوى الصف في الحالتين لحد ما يتفصل
      track: String(grade || "").indexOf("secondary") === 0 ? (track === "bacc" ? "bacc" : "general") : null,
      gender,
      role: "student",
      points: 0,
      badges: [],
      emailVerified: true,
      createdAt: new Date().toISOString(),
    };
  }

  /* --- مسح أي بيانات تقدّم/درجات/مقالات باقية لنفس الـ id (بدون لمس عقدة users) --- */
  async function purgeOrphanData(id) {
    if (!id) return;
    const tasks = [
      db.ref("userData/" + id).remove(),
      db.ref("grades/" + id).remove(),
    ];
    try {
      const essays = await db.ref("essaySubmissions").get();
      if (essays.exists()) {
        const all = essays.val();
        Object.keys(all).forEach((k) => {
          const x = all[k] || {};
          if ([x.userId, x.studentId, x.uid, x.user].indexOf(id) > -1) tasks.push(db.ref("essaySubmissions/" + k).remove());
        });
      }
    } catch (e) { /* لو القراءة مش مسموحة نكمّل */ }
    await Promise.all(tasks);
  }

  /* --- بعد كود التحقق الصحيح: تسجيل الطالب فعليًا (قاعدة البيانات + لوحة الأدمن + لوحة الصدارة) --- */
  async function commitRegistration(user) {
    if (!user || !user.id) throw new Error("NO_PENDING");
    const existing = await readUserRecord(user.email);
    if (existing && existing.emailVerified !== false) throw new Error("EMAIL_EXISTS");
    const finalUser = { ...user, emailVerified: true, createdAt: new Date().toISOString() };
    // حساب جديد لازم يبدأ من الصفر: لو فيه بيانات يتيمة باقية من حساب قديم بنفس الإيميل
    // (اتمسح users/ بس من Firebase Console مثلًا) بنمسحها قبل ما نكتب الحساب الجديد.
    await purgeOrphanData(user.id);
    await db.ref("users/" + user.id).set(finalUser);
    aliveCache[user.id] = Promise.resolve(true);
    return finalUser;
  }

  /* --- تسجيل الدخول: التحقق من الإيميل وبصمة كلمة السر، وبيرجّع بيانات المستخدم --- */
  async function verifyLogin(email, password) {
    const user = await findUserByEmail(email);
    if (!user) throw new Error("NOT_FOUND");
    const hash = await hashPassword(password);
    if (hash !== user.passwordHash) throw new Error("WRONG_PASSWORD");
    return user;
  }

  /* --- توليد كود تحقق، تخزينه مؤقتًا في قاعدة البيانات، وبعته فعليًا على الإيميل --- */
  async function requestOtp(email, name, flow) {
    const key = emailToKey(email);
    const code = generateOtp();
    const expiresAt = Date.now() + OTP_TTL_MS;
    await db.ref("otps/" + key).set({ code, expiresAt, flow: flow || "login", attempts: 0 });
    try {
      await sendOtpEmail({ toEmail: email, name, code, flow });
    } catch (emailErr) {
      console.error("[SNAuth.requestOtp] فشل إرسال إيميل كود التحقق عبر EmailJS:", emailErr);
      const err = new Error("EMAIL_SEND_FAILED");
      err.code =
        emailErr && emailErr.message === "EMAILJS_NOT_LOADED" ? "NOT_LOADED"
        : emailErr && emailErr.status === 0 ? "NETWORK"
        : emailErr && (emailErr.status || emailErr.code) || "EMAILJS_ERROR";
      err.cause = emailErr;
      throw err;
    }
    return true;
  }

  /* --- التحقق من الكود اللي كتبه المستخدم مقابل اللي مخزّن --- */
  async function verifyOtpCode(email, inputCode) {
    const key = emailToKey(email);
    const snap = await db.ref("otps/" + key).get();
    if (!snap.exists()) throw new Error("NO_OTP");
    const { code, expiresAt } = snap.val();
    if (Date.now() > Number(expiresAt)) {
      await db.ref("otps/" + key).remove();
      throw new Error("EXPIRED");
    }
    if (String(inputCode).trim() !== String(code)) throw new Error("WRONG_CODE");
    await db.ref("otps/" + key).remove();
    return true;
  }

  /* --- بعد نجاح الكود: تفعيل الإيميل (لو أول مرة) وإرجاع أحدث نسخة من بيانات المستخدم --- */
  async function markVerifiedAndFetch(email) {
    const key = emailToKey(email);
    await db.ref("users/" + key + "/emailVerified").set(true);
    const snap = await db.ref("users/" + key).get();
    if (!snap.exists()) throw new Error("NOT_FOUND");
    return snap.val();
  }

  /* --- كل الطلاب المسجلين في صف معيّن (تُستخدم في لوحة المتصدرين، ولوحة تحكم الأدمن لاحقًا) --- */
  async function fetchUsersByGrade(grade) {
    try {
      const snap = await db.ref("users").orderByChild("grade").equalTo(grade).get();
      if (!snap.exists()) return [];
      return Object.values(snap.val());
    } catch (queryError) {
      // يعمل حتى لو كانت قواعد Firebase لا تحتوي على index للـ grade.
      console.warn("تعذر استخدام استعلام الصف، سيتم استخدام قراءة الطلاب ثم الفلترة محليًا", queryError);
      const users = await fetchAllUsers();
      return users.filter((user) => user && user.grade === grade);
    }
  }

  /* --- كل المستخدمين المسجلين (للوحة تحكم الأدمن لاحقًا) --- */
  async function fetchAllUsers() {
    const snap = await db.ref("users").get();
    if (!snap.exists()) return [];
    return Object.values(snap.val());
  }

  /* --- هل الطالب لسه موجود؟ بنتأكد مرة واحدة من السيرفر ونخزّن النتيجة،
         وأي كتابة لطالب اتمسح بتتلغي (عشان ما يترجعش كحساب فاضي). --- */
  const aliveCache = {};
  function userAlive(id) {
    if (!aliveCache[id]) {
      aliveCache[id] = db.ref("users/" + id + "/email").get()
        .then((s) => s.exists())
        .catch(() => true); // لو مفيش نت منحذفش حاجة بالغلط
    }
    return aliveCache[id];
  }

  /* --- حفظ أي تعديل على بيانات مستخدم موجود (نقط، بادجات، بروفايل...) --- */
  async function saveUserRemote(user) {
    if (!user || !user.id) return;
    if (!(await userAlive(user.id))) return;
    await db.ref("users/" + user.id).set(user);
  }

  /* --- حفظ تقدّم الوحدات فقط (بدون لمس باقي بيانات المستخدم) --- */
  async function saveUnitProgress(userId, progress) {
    if (!userId) return;
    if (!(await userAlive(userId))) return;
    await db.ref("users/" + userId + "/unitProgress").set(progress || {});
  }

  /* --- بيانات تقدّم الطالب (دروس، قصة، مهام، ملاحظات، وقت التعلّم، أيام الدخول)
     تحت userData/{id}/... عشان تفضل موجودة لو فتح من جهاز تاني. --- */
  async function userDataGet(id) {
    const snap = await db.ref("userData/" + id).get();
    return snap.exists() ? snap.val() : {};
  }

  async function userDataSet(id, path, value) {
    if (!(await userAlive(id))) return;
    await db.ref("userData/" + id + "/" + path).set(value);
  }

  /* --- النقط والبادجات (نفس عقدة users/{id} اللي بتقراها لوحة المتصدرين) --- */
  async function saveUserFields(id, fields) {
    if (!id) return;
    if (!(await userAlive(id))) return;
    await db.ref("users/" + id).update(fields);
  }

  /* --- إجابات المقال: جدول مشترك essaySubmissions عشان الأدمن يصحّحها --- */
  async function pushEssaySubmission(entry) {
    const ref = db.ref("essaySubmissions").push();
    await ref.set({ ...entry, id: ref.key });
    return ref.key;
  }

  /* --- سجل الدرجات الحقيقي: grades/{id}/{mcq|essay|weekly}/{pushId} --- */
  async function addGradeEntry(id, category, entry) {
    const ref = db.ref("grades/" + id + "/" + category).push();
    await ref.set(entry);
    return ref.key;
  }

  /* --- تحديث درجة موجودة (زي تصحيح مقال) بمفتاحها: grades/{id}/{category}/{key} --- */
  async function setGradeEntry(id, category, key, entry) {
    if (!id || !category || !key) return;
    await db.ref("grades/" + id + "/" + category + "/" + key).set(entry);
  }

  async function fetchGrades(id) {
    const snap = await db.ref("grades/" + id).get();
    return snap.exists() ? snap.val() : {};
  }

  /* ==========================================================================
     أدوات لوحة تحكم الأدمن
     ========================================================================== */

  /* --- إعدادات الأدمن (إيميل استلام كود التحقق...) --- */
  async function getAdminSettings() {
    const snap = await db.ref("adminSettings").get();
    return snap.exists() ? snap.val() : {};
  }
  async function saveAdminSettings(fields) {
    await db.ref("adminSettings").update(fields);
  }

  /* --- ألوان المنصة (بتتطبق على كل الصفحات) --- */
  async function fetchSiteTheme() {
    const snap = await db.ref("siteTheme").get();
    return snap.exists() ? snap.val() : null;
  }
  async function saveSiteTheme(theme) {
    if (!theme) await db.ref("siteTheme").remove();
    else await db.ref("siteTheme").set({ ...theme, updatedAt: new Date().toISOString() });
  }

  /* --- هوية المنصة: الاسم + اللوجو ---
     siteBranding      = { name, tagline, hasLogo, version }   (خفيفة، كل الصفحات بتقراها)
     siteBrandingLogo  = { data }  (صورة اللوجو كـ data URL، بتتجاب بس لما version يتغيّر) */
  async function fetchSiteBranding() {
    const snap = await db.ref("siteBranding").get();
    return snap.exists() ? snap.val() : null;
  }
  async function fetchSiteBrandingLogo() {
    const snap = await db.ref("siteBrandingLogo/data").get();
    return snap.exists() ? snap.val() : "";
  }
  /* logo: undefined = سيب اللوجو زي ما هو، "" = شيله، أو data URL جديد */
  async function saveSiteBranding({ name, tagline, logo }) {
    let hasLogo;
    if (typeof logo === "string" && logo) {
      await db.ref("siteBrandingLogo").set({ data: logo });
      hasLogo = true;
    } else if (logo === "") {
      await db.ref("siteBrandingLogo").remove();
      hasLogo = false;
    } else {
      const cur = await fetchSiteBranding();
      hasLogo = !!(cur && cur.hasLogo);
    }
    const version = Date.now();
    await db.ref("siteBranding").set({
      name: String(name || "").trim(),
      tagline: String(tagline || "").trim(),
      hasLogo,
      version,
    });
    return { version, hasLogo };
  }

  /* --- متوسط درجات الصف (بيحسبه الأدمن وبينشره هنا؛ الطالب بيقرأ المتوسط بس مش درجات زمايله) --- */
  async function saveClassAvg(grade, data) {
    if (!grade) return;
    await db.ref("classAvg/" + grade).set(data);
  }
  async function fetchClassAvg(grade) {
    if (!grade) return null;
    const snap = await db.ref("classAvg/" + grade).get();
    return snap.exists() ? snap.val() : null;
  }

  /* --- كل درجات / بيانات كل الطلاب مرة واحدة (للإحصائيات) --- */
  async function fetchAllGrades() {
    const snap = await db.ref("grades").get();
    return snap.exists() ? snap.val() : {};
  }
  async function fetchAllUserData() {
    const snap = await db.ref("userData").get();
    return snap.exists() ? snap.val() : {};
  }

  /* --- حذف طالب نهائيًا من كل العقد (حسابه، تقدّمه، درجاته، مقالاته، أكواد التحقق) --- */
  async function deleteUserCompletely(id) {
    if (!id) return;
    aliveCache[id] = Promise.resolve(false);
    // الحساب الأول: عشان صفحة الطالب تلقط الحذف فورًا وتخرّجه
    await db.ref("users/" + id).remove();
    const tasks = [
      db.ref("userData/" + id).remove(),
      db.ref("grades/" + id).remove(),
      db.ref("otps/" + id).remove(),
      db.ref("adminNotes/" + id).remove(),
      db.ref("chatMeta/" + id).remove(),
      db.ref("chatMessages/" + id).remove(),
      db.ref("chatFiles/" + id).remove(),
      db.ref("yearReports/" + id).remove(),
    ];
    // مقالات الطالب في الجدول المشترك
    const essays = await db.ref("essaySubmissions").get();
    if (essays.exists()) {
      const all = essays.val();
      Object.keys(all).forEach((k) => {
        const x = all[k] || {};
        if ([x.userId, x.studentId, x.uid, x.user].indexOf(id) > -1) tasks.push(db.ref("essaySubmissions/" + k).remove());
      });
    }
    await Promise.all(tasks);
  }

  /* --- نهاية العام الدراسي: ترقية كل الطلاب للصف اللي بعده وتصفير بياناتهم (نقط، شارات، تقدّم، درجات، مقالات، ملاحظات الأدمن).
         قبل التصفير بنحفظ لكل طالب "ملف عام دراسي" في yearReports/{id}/{yearKey} (درجات + ملاحظات + إحصائيات التقدّم)،
         والطالب بيوصله إشعار ويفتح منه ملفات PDF (درجات / ملاحظات / رسوم بيانية).
         الحساب نفسه (الاسم/الإيميل/كلمة المرور/الصورة) والمحادثات بيفضلوا زي ما هم.
         طلاب تالتة ثانوي: opts.graduates = "keep" (يفضلوا في صفهم) أو "delete" (يتحذفوا نهائيًا). --- */
  function countDoneAny(obj) {
    if (!obj) return 0;
    if (Array.isArray(obj)) return obj.filter(Boolean).length;
    if (typeof obj === "object") {
      return Object.keys(obj).filter((k) => {
        const v = obj[k];
        return v === true || (v && typeof v === "object" && (v.done || v.completed || v.complete || v.status === "done" || v.status === "completed"));
      }).length;
    }
    return 0;
  }
  function pickAny(obj, keys) { for (let i = 0; i < keys.length; i++) if (obj && obj[keys[i]] != null) return obj[keys[i]]; return null; }

  async function promoteAllStudents(opts) {
    const NEXT = { prep1: "prep2", prep2: "prep3", prep3: "secondary1", secondary1: "secondary2", secondary2: "secondary3" };
    const deleteGraduates = !!(opts && opts.graduates === "delete");
    const dropArchive = !!(opts && opts.dropArchive); // لتوفير المساحة: مسح ملفات الأعوام (القديمة) وعدم حفظ ملف العام الجديد
    const read = async (path) => { try { const s = await db.ref(path).get(); return s.exists() ? s.val() : {}; } catch (e) { return {}; } };
    const users = await read("users");
    const [allGrades, allNotes, allData, allReports] = await Promise.all([read("grades"), read("adminNotes"), read("userData"), read("yearReports")]);
    const now = new Date();
    const startYear = now.getMonth() >= 7 ? now.getFullYear() : now.getFullYear() - 1;
    const yearLabel = startYear + "/" + (startYear + 1);
    const stamp = now.toISOString();
    const updates = {};
    const toDelete = [];
    let promoted = 0, stayed = 0, archived = 0;
    Object.keys(users).forEach((id) => {
      const u = users[id];
      if (!u || u.role === "admin") return;
      if (u.grade === "secondary3" && deleteGraduates) { toDelete.push(id); return; }
      const toGrade = NEXT[u.grade] || u.grade;
      if (NEXT[u.grade]) { updates["users/" + id + "/grade"] = toGrade; promoted++; } else { stayed++; }

      /* --- حفظ ملف العام الدراسي قبل التصفير (بس لو فيه بيانات فعلًا) --- */
      const ud = allData[id] || {};
      const grades = allGrades[id] || null;
      const notes = allNotes[id] ? Object.keys(allNotes[id]).map((k) => ({ id: k, ...allNotes[id][k] })) : [];
      const days = pickAny(ud, ["loginDays", "activeDays", "visitDays", "daysLogged", "streakDays"]);
      const visitDays = Array.isArray(days) ? days.map(String) : (days && typeof days === "object" ? Object.keys(days).filter((k) => days[k]) : []);
      let lessonsDone = countDoneAny(ud.lessonsProgress);
      if (!lessonsDone) lessonsDone = countDoneAny(pickAny(ud, ["completedLessons", "lessonsDone", "lessons", "courses"]));
      if (!lessonsDone && u.unitProgress) lessonsDone = countDoneAny(u.unitProgress);
      const stats = {
        lessonsDone,
        storyDone: countDoneAny(ud.storyProgress),
        examsDone: ud.exams ? Object.keys(ud.exams).length : 0,
        storyExamsDone: ud.storyExams ? Object.keys(ud.storyExams).length : 0,
        sheetsDone: ud.sheetSubmissions ? Object.keys(ud.sheetSubmissions).length : 0,
        learningSeconds: Number(ud.learningSeconds) || 0,
        visitDays,
      };
      const hasData = !!grades || notes.length || (Number(u.points) || 0) > 0 || (u.badges && u.badges.length) ||
        stats.lessonsDone || stats.storyDone || stats.examsDone || stats.storyExamsDone || stats.sheetsDone || stats.learningSeconds || visitDays.length;
      if (hasData && !dropArchive) {
        const existing = allReports[id] || {};
        let key = "y" + startYear, n = 2;
        while (existing[key]) key = "y" + startYear + "-" + n++;
        updates["yearReports/" + id + "/" + key] = {
          key, uid: id, label: yearLabel, createdAt: stamp,
          gradeFrom: u.grade || "", gradeTo: toGrade, track: u.track || null,
          points: Number(u.points) || 0,
          badges: Array.isArray(u.badges) ? u.badges : [],
          stats, grades, notes,
        };
        archived++;
      }

      updates["users/" + id + "/points"] = 0;
      updates["users/" + id + "/badges"] = null;
      updates["users/" + id + "/unitProgress"] = null;
      updates["users/" + id + "/yearReset"] = stamp;
      updates["userData/" + id] = null;
      updates["grades/" + id] = null;
      updates["adminNotes/" + id] = null;
    });
    if (Object.keys(updates).length) {
      updates["essaySubmissions"] = null;
      updates["classAvg"] = null;
      if (dropArchive) updates["yearReports"] = null;
      await db.ref().update(updates);
    }
    for (const id of toDelete) await deleteUserCompletely(id);
    return { promoted, stayed, deleted: toDelete.length, archived };
  }

  /* --- ملفات الأعوام الدراسية للطالب (الأحدث أولًا) --- */
  async function fetchYearReports(id) {
    if (!id) return [];
    const snap = await db.ref("yearReports/" + id).get();
    if (!snap.exists()) return [];
    const v = snap.val();
    return Object.keys(v).map((k) => v[k]).filter(Boolean).sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
  }

  /* --- مسح كل بيانات الطالب المحفوظة على الجهاز (تقدّم، وقت تعلّم، أيام دخول، امتحانات، مهام، ملاحظات...).
         المفاتيح كلها بتنتهي بـ id الطالب أو بتحتويه بين شرطتين، فبنمسح بالمطابقة الدقيقة عشان ما نلمسش بيانات طالب تاني. --- */
  function wipeLocalUserData(id) {
    if (!id) return;
    try {
      const doomed = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (!k || k === "shadynasr-db-users" || k === "shadynasr-current-user" || k === "shadynasr-auth") continue;
        if (k.endsWith("-" + id) || k.endsWith(":" + id) || k.indexOf("-" + id + "-") > -1) doomed.push(k);
      }
      doomed.forEach((k) => localStorage.removeItem(k));
    } catch (e) { /* ignore */ }
  }

  /* --- كل حساب له تاريخ إنشاء. لو الحساب اتمسح واتعمل من جديد بنفس الإيميل (نفس الـ id) يبقى تاريخ الإنشاء
         اتغيّر، فنمسح بيانات الحساب القديم من الجهاز عشان ما ترجعش للحساب الجديد. --- */
  function syncAccountGeneration(user, isNewAccount) {
    if (!user || !user.id) return;
    try {
      const gk = "shadynasr-account-gen:" + user.id;
      const prev = localStorage.getItem(gk);
      const cur = String(user.createdAt || "");
      if (isNewAccount || (prev && cur && prev !== cur)) wipeLocalUserData(user.id);
      if (cur) localStorage.setItem(gk, cur);
    } catch (e) { /* ignore */ }
  }

  /* --- لو الأدمن مسح الطالب وهو فاتح المنصة: خروج تلقائي --- */
  function startSessionWatch() {
    let s = null;
    try {
      s = JSON.parse(localStorage.getItem("shadynasr-current-user"));
      if (!s || !s.id || s.role === "admin" || !localStorage.getItem("shadynasr-auth")) return;
    } catch (e) { return; }
    const id = s.id;
    let done = false;
    function kickOut() {
      if (done) return;
      done = true;
      aliveCache[id] = Promise.resolve(false);
      wipeLocalUserData(id);
      try {
        localStorage.removeItem("shadynasr-auth");
        localStorage.removeItem("shadynasr-current-user");
        localStorage.removeItem("shadynasr-user-theme:" + id);
        localStorage.removeItem("shadynasr-avatar:" + id);
        localStorage.removeItem("shadynasr-last-lesson:" + id);
        localStorage.removeItem("shadynasr-ann-seen:" + id);
        localStorage.removeItem("shadynasr-account-gen:" + id);
        // نشيل الطالب من الكاش المحلي لقائمة المستخدمين
        const raw = JSON.parse(localStorage.getItem("shadynasr-db-users"));
        if (Array.isArray(raw)) {
          localStorage.setItem("shadynasr-db-users", JSON.stringify(raw.filter((u) => u && u.id !== id)));
        }
      } catch (e) { /* ignore */ }
      // الطالب اتمسح: يرجع للصفحة الرئيسية مش صفحة الدخول
      window.location.replace("index.html");
    }
    /* الأدمن عمل ترقية/تصفير لنهاية العام: نمسح بيانات الجهاز القديمة (من غير الثيم والصورة) ونحدّث الصف ونعيد التحميل مرة واحدة */
    db.ref("users/" + id + "/yearReset").on("value", (snap) => {
      if (!snap.exists()) return;
      const stamp = String(snap.val());
      const rk = "shadynasr-year-reset:" + id;
      let prev = null;
      try { prev = localStorage.getItem(rk); } catch (e) { return; }
      if (prev === stamp) return;
      db.ref("users/" + id).get().then((us) => {
        const u = us.exists() ? us.val() : null;
        if (!u) return;
        try {
          const keep = ["shadynasr-user-theme:", "shadynasr-avatar:", "shadynasr-home-hidden:", "shadynasr-account-gen:", "shadynasr-year-reset:", "shadynasr-yr-seen:"];
          const doomed = [];
          for (let i = 0; i < localStorage.length; i++) {
            const k = localStorage.key(i);
            if (!k || k === "shadynasr-db-users" || k === "shadynasr-current-user" || k === "shadynasr-auth") continue;
            if (keep.some((p) => k.indexOf(p) === 0)) continue;
            if (k.endsWith("-" + id) || k.endsWith(":" + id) || k.indexOf("-" + id + "-") > -1) doomed.push(k);
          }
          doomed.forEach((k) => localStorage.removeItem(k));
          localStorage.setItem(rk, stamp);
          const cur = JSON.parse(localStorage.getItem("shadynasr-current-user"));
          if (cur && cur.id === id) { cur.grade = u.grade; localStorage.setItem("shadynasr-current-user", JSON.stringify(cur)); }
          const raw = JSON.parse(localStorage.getItem("shadynasr-db-users"));
          if (Array.isArray(raw)) {
            localStorage.setItem("shadynasr-db-users", JSON.stringify(raw.map((x) => (x && x.id === id ? { ...x, grade: u.grade, points: 0, badges: [], unitProgress: {} } : x))));
          }
        } catch (e) { /* ignore */ }
        window.location.reload();
      }).catch(() => {});
    });
    db.ref("users/" + id + "/email").on("value", (snap) => {
      if (snap.exists()) return;
      // نتأكد من السيرفر قبل ما نطرده (ما نعتمدش على كاش الاتصال)
      db.ref("users/" + id + "/email").get().then((s2) => { if (!s2.exists()) kickOut(); }).catch(() => {});
    });
  }
  startSessionWatch();

  /* --- تغيير كلمة سر أي مستخدم (بنفس طريقة التخزين المعتادة) --- */
  async function setUserPassword(id, newPassword) {
    const passwordHash = await hashPassword(newPassword);
    await db.ref("users/" + id + "/passwordHash").set(passwordHash);
  }

  /* --- تغيير إيميل تسجيل الدخول: المفتاح هو الإيميل نفسه فلازم ننقل العقدة --- */
  async function changeUserEmail(oldId, newEmail) {
    const cleanEmail = String(newEmail).trim().toLowerCase();
    const newKey = emailToKey(cleanEmail);
    if (newKey === oldId) return { id: oldId, email: cleanEmail };
    if (await readUserRecord(cleanEmail)) throw new Error("EMAIL_EXISTS");
    const snap = await db.ref("users/" + oldId).get();
    if (!snap.exists()) throw new Error("NOT_FOUND");
    const user = { ...snap.val(), id: newKey, email: cleanEmail };
    await db.ref("users/" + newKey).set(user);
    await db.ref("users/" + oldId).remove();
    return user;
  }

  /* --- المقالات: قراءة وتصحيح --- */
  async function fetchEssaySubmissions() {
    const snap = await db.ref("essaySubmissions").get();
    return snap.exists() ? Object.values(snap.val()) : [];
  }
  async function updateEssaySubmission(id, fields) {
    await db.ref("essaySubmissions/" + id).update(fields);
  }

  /* ==========================================================================
     الإعلانات والتنبيهات: announcements/{id}
     { title, body, type: general|exam|extra|motivation, target: "all" أو مفتاح الصف, createdAt, updatedAt }
     ========================================================================== */
  async function fetchAnnouncements() {
    const snap = await db.ref("announcements").get();
    return snap.exists() ? Object.values(snap.val()) : [];
  }
  /* --- متابعة لحظية: أي إعلان جديد/معدّل/محذوف بيوصل فورًا (بيرجّع دالة لإيقاف المتابعة) --- */
  function watchAnnouncements(onData, onError) {
    const ref = db.ref("announcements");
    const handler = (snap) => onData(snap.exists() ? Object.values(snap.val()) : []);
    ref.on("value", handler, (err) => { if (onError) onError(err); });
    return () => ref.off("value", handler);
  }
  /* مرفقات الإعلان (صور/PDF): announcementFiles/{annId}/{fileId} = { name, type, size, data(dataURL) }
     والإعلان نفسه فيه files = [{ id, name, type, size }] (بيانات خفيفة) — الملف بيتحمّل لما الطالب يفتحه بس */
  async function saveAnnFiles(annId, files) {
    const meta = [];
    for (const f of files || []) {
      await db.ref("announcementFiles/" + annId + "/" + f.id).set({ name: f.name, type: f.type, size: f.size, data: f.data });
      meta.push({ id: f.id, name: f.name, type: f.type, size: f.size });
    }
    return meta;
  }
  async function fetchAnnouncementFile(annId, fileId) {
    if (!annId || !fileId) return null;
    const snap = await db.ref("announcementFiles/" + annId + "/" + fileId).get();
    return snap.exists() ? snap.val() : null;
  }
  async function pushAnnouncement(entry, newFiles) {
    const ref = db.ref("announcements").push();
    const files = await saveAnnFiles(ref.key, newFiles); // الملفات الأول، وبعدها الإعلان يظهر للطلاب
    const data = { ...entry, id: ref.key };
    if (files.length) data.files = files;
    await ref.set(data);
    return ref.key;
  }
  async function updateAnnouncement(id, fields, newFiles, removedIds) {
    if (!id) return;
    const added = await saveAnnFiles(id, newFiles);
    const data = { ...fields };
    if (Array.isArray(data.files) || added.length) data.files = (Array.isArray(data.files) ? data.files : []).concat(added);
    await db.ref("announcements/" + id).update(data);
    for (const fid of removedIds || []) await db.ref("announcementFiles/" + id + "/" + fid).remove();
  }
  async function deleteAnnouncement(id) {
    if (!id) return;
    await db.ref("announcements/" + id).remove();
    await db.ref("announcementFiles/" + id).remove();
  }

  /* ==========================================================================
     ملاحظات الأدمن للطالب: adminNotes/{studentId}/{noteId}
     { id, type: warning|advice|encourage|alert, text, createdAt, by }
     الطالب بيستلمها لحظيًا (watchAdminNotes) وبتظهر في نظام الإشعارات.
     ========================================================================== */
  async function pushAdminNote(studentId, entry) {
    if (!studentId) return;
    const ref = db.ref("adminNotes/" + studentId).push();
    await ref.set({ ...entry, id: ref.key });
    return ref.key;
  }
  async function deleteAdminNote(studentId, noteId) {
    if (!studentId || !noteId) return;
    await db.ref("adminNotes/" + studentId + "/" + noteId).remove();
  }
  async function fetchAdminNotes(studentId) {
    const snap = await db.ref("adminNotes/" + studentId).get();
    return snap.exists() ? Object.values(snap.val()) : [];
  }
  function watchAdminNotes(studentId, onData, onError) {
    const ref = db.ref("adminNotes/" + studentId);
    const handler = (snap) => onData(snap.exists() ? Object.values(snap.val()) : []);
    ref.on("value", handler, (err) => { if (onError) onError(err); });
    return () => ref.off("value", handler);
  }

  /* ==========================================================================
     استعادة كلمة المرور (نسيت كلمة المرور)
     الخطوات: requestOtp(email, name, "reset") -> checkResetCode -> resetPasswordWithOtp
     ========================================================================== */
  const MAX_OTP_ATTEMPTS = 5; // بعد 5 محاولات غلط الكود بيتلغي ولازم يطلب كود جديد

  async function readResetOtp(key) {
    const ref = db.ref("otps/" + key);
    const snap = await ref.get();
    if (!snap.exists()) throw new Error("NO_OTP");
    const otp = snap.val();
    if (otp.flow !== "reset") throw new Error("NO_OTP"); // كود الدخول ما ينفعش لاستعادة الباسورد
    if (Date.now() > Number(otp.expiresAt)) {
      await ref.remove();
      throw new Error("EXPIRED");
    }
    return { ref, otp };
  }

  /* --- يتحقق من الكود من غير ما يمسحه (عشان نعيد التحقق منه وقت حفظ الباسورد الجديد) --- */
  async function checkResetCode(email, inputCode) {
    const key = emailToKey(email);
    const { ref, otp } = await readResetOtp(key);
    if (String(inputCode).trim() !== String(otp.code)) {
      const attempts = Number(otp.attempts || 0) + 1;
      if (attempts >= MAX_OTP_ATTEMPTS) {
        await ref.remove();
        throw new Error("TOO_MANY_ATTEMPTS");
      }
      await ref.child("attempts").set(attempts);
      throw new Error("WRONG_CODE");
    }
    await ref.child("verified").set(true); // الكود اتأكد مرة واحدة هنا بس
    return true;
  }

  /* --- بعد ما الكود اتأكد في checkResetCode: يحفظ بصمة الباسورد الجديد، يمسح الكود، ويرجّع بيانات المستخدم --- */
  async function resetPasswordWithOtp(email, newPassword) {
    if (!newPassword || String(newPassword).length < 6) throw new Error("WEAK_PASSWORD");
    const key = emailToKey(email);
    const { otp } = await readResetOtp(key);
    if (otp.verified !== true) throw new Error("NO_OTP");
    const user = await findUserByEmail(email);
    if (!user) throw new Error("NOT_FOUND");
    if (user.role === "admin") throw new Error("ADMIN_NOT_ALLOWED");
    const passwordHash = await hashPassword(newPassword);
    await db.ref("users/" + key + "/passwordHash").set(passwordHash);
    await db.ref("users/" + key + "/emailVerified").set(true); // أثبت إنه صاحب الإيميل بالكود
    await db.ref("otps/" + key).remove();
    const snap = await db.ref("users/" + key).get();
    return snap.val();
  }

  /* ==========================================================================
     أوائل الدروس (صور يرفعها الأدمن): honors/{id} = { id, title, grade, month: "YYYY-MM", createdAt }
     والصورة نفسها (Base64 JPEG) في honorImages/{id} عشان القايمة تفضل خفيفة.
     ========================================================================== */
  async function fetchHonors() {
    const snap = await db.ref("honors").get();
    return snap.exists() ? Object.values(snap.val()) : [];
  }
  async function fetchHonorImage(id) {
    if (!id) return null;
    const snap = await db.ref("honorImages/" + id).get();
    return snap.exists() ? snap.val() : null;
  }
  async function pushHonor(meta, dataUrl) {
    const ref = db.ref("honors").push();
    const id = ref.key;
    await db.ref("honorImages/" + id).set(dataUrl); // الصورة الأول، وبعدها العنوان يظهر للطلاب
    await ref.set({ ...meta, id });
    return id;
  }
  async function deleteHonor(id) {
    if (!id) return;
    await db.ref("honors/" + id).remove();
    await db.ref("honorImages/" + id).remove();
  }

  /* ==========================================================================
     الامتحانات: exams/{id} (من غير الإجابات) • examKeys/{id} (مفاتيح الإجابة، للأدمن بس)
     • examSubmissions/{examId}/{studentId} (تسليم واحد لكل طالب)
     ========================================================================== */
  function examArr(v) { return v ? Object.keys(v).map((k) => v[k]) : []; }

  function newExamId() { return db.ref("exams").push().key; }

  async function fetchExams() {
    const snap = await db.ref("exams").get();
    return snap.exists() ? examArr(snap.val()) : [];
  }

  /* متابعة حيّة: أول ما الأدمن ينشر امتحان يوصل للطلاب من غير ريفرش */
  function watchExams(cb) {
    const ref = db.ref("exams");
    const h = ref.on("value", (snap) => cb(snap.exists() ? examArr(snap.val()) : []), () => cb([]));
    return () => ref.off("value", h);
  }

  /* بنفصل مفاتيح الإجابة عن الامتحان عشان الطالب ما يقراش الإجابات الصح */
  async function saveExam(exam) {
    const id = exam.id || newExamId();
    const pub = JSON.parse(JSON.stringify({ ...exam, id }));
    const keys = {};
    (pub.sections || []).forEach((s) => (s.questions || []).forEach((q) => {
      if (q.answer != null && String(q.answer) !== "") keys[q.id] = String(q.answer);
      delete q.answer;
    }));
    await db.ref("exams/" + id).set(pub);
    await db.ref("examKeys/" + id).set(Object.keys(keys).length ? keys : null);
    return id;
  }

  async function fetchExamKeys(id) {
    const snap = await db.ref("examKeys/" + id).get();
    return snap.exists() ? snap.val() : {};
  }

  async function deleteExam(id) {
    if (!id) return;
    await db.ref("exams/" + id).remove();
    await db.ref("examKeys/" + id).remove();
    await db.ref("examSubmissions/" + id).remove();
  }

  async function fetchExamSubmission(examId, studentId) {
    const snap = await db.ref("examSubmissions/" + examId + "/" + studentId).get();
    return snap.exists() ? snap.val() : null;
  }

  /* كل التسليمات: { examId: { studentId: submission } } */
  async function fetchAllExamSubmissions() {
    const snap = await db.ref("examSubmissions").get();
    return snap.exists() ? snap.val() : {};
  }

  /* التسليم بيتكتب مرة واحدة بس (transaction) — لو اتسلّم قبل كده ما يتكتبش فوقه */
  async function saveExamSubmission(examId, studentId, data) {
    const clean = JSON.parse(JSON.stringify(data));
    const res = await db.ref("examSubmissions/" + examId + "/" + studentId)
      .transaction((cur) => (cur ? undefined : clean));
    return !!res.committed;
  }

  /* تعديل خفيف (زي الحالة) من غير ما نلمس مفاتيح الإجابة */
  async function updateExamFields(id, fields) {
    await db.ref("exams/" + id).update(JSON.parse(JSON.stringify(fields)));
  }

  async function updateExamSubmission(examId, studentId, fields) {
    await db.ref("examSubmissions/" + examId + "/" + studentId).update(JSON.parse(JSON.stringify(fields)));
  }

  /* --- قفل المنصة: الأدمن بيقفل صفحة الطلاب بكود من 10 أرقام (أو QR بنفس الكود).
         platformLock = { active, lockId, lockedAt, codeHash }  (الكود نفسه ما بيتخزنش، بس بصمته)
         users/{id}/lockOk = lockId  (الطالب دخل الكود الصح في القفلة دي)
         لو طالب فضل مدخلش الكود 30 يوم من القفل (أو من تسجيله لو سجّل بعد القفل) بيتمسح بالكامل. --- */
  const LOCK_DAYS = 30;
  const lockHash = (lockId, code) => hashPassword(lockId + ":" + String(code));
  async function fetchPlatformLock() {
    const snap = await db.ref("platformLock").get();
    return snap.exists() ? snap.val() : null;
  }
  function watchPlatformLock(onData, onErr) {
    const ref = db.ref("platformLock");
    const cb = ref.on("value", (s) => onData(s.exists() ? s.val() : null), (e) => { if (onErr) onErr(e); });
    return () => ref.off("value", cb);
  }
  async function activatePlatformLock(code) {
    if (!/^\d{10}$/.test(String(code))) throw new Error("BAD_CODE");
    const lockId = "L" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    const lock = { active: true, lockId, lockedAt: Date.now(), codeHash: await lockHash(lockId, code) };
    await db.ref("platformLock").set(lock);
    return lock;
  }
  async function deactivatePlatformLock() { await db.ref("platformLock").remove(); }
  async function verifyPlatformLockCode(lock, code) {
    if (!lock || !lock.active || !/^\d{10}$/.test(String(code))) return false;
    return (await lockHash(lock.lockId, code)) === lock.codeHash;
  }
  async function markLockOk(id, lockId) { if (id && lockId) await db.ref("users/" + id + "/lockOk").set(lockId); }
  async function fetchLockOk(id) {
    const snap = await db.ref("users/" + id + "/lockOk").get();
    return snap.exists() ? snap.val() : null;
  }
  /* الأدمن بيشغّلها: بتمسح كل طالب عدّى 30 يوم من غير ما يدخل الكود. بترجّع عدد اللي اتمسحوا */
  async function sweepExpiredLock(users) {
    const lock = await fetchPlatformLock();
    if (!lock || !lock.active) return 0;
    const now = Date.now();
    let n = 0;
    for (const u of users || []) {
      if (!u || !u.id || u.role === "admin") continue;
      if (u.lockOk === lock.lockId) continue;
      const created = Date.parse(u.createdAt);
      const base = Number.isFinite(created) && created > lock.lockedAt ? created : lock.lockedAt;
      if (now < base + LOCK_DAYS * 864e5) continue;
      try {
        if ((await fetchLockOk(u.id)) === lock.lockId) continue; // تأكيد أخير من السيرفر
        await deleteUserCompletely(u.id);
        n++;
      } catch (e) { /* نكمّل على الباقي */ }
    }
    return n;
  }

  /* ==========================================================================
     أكواد الصفوف (إنشاء حساب جديد): gradeCodes/{grade} = { hash, updatedAt }  — الكود نفسه عند الأدمن في adminSettings/gradeCodes
     صف من غير كود = التسجيل فيه مفتوح. الفحص بيتم في المتصفح (grade-codes.js).
     ========================================================================== */
  const GRADE_KEYS = ["prep1", "prep2", "prep3", "secondary1", "secondary2", "secondary3"];
  const normGradeCode = (c) => String(c == null ? "" : c).trim().replace(/\s+/g, "").replace(/[\u0660-\u0669]/g, (d) => String(d.charCodeAt(0) - 0x660));
  const validGradeCode = (c) => /^[A-Za-z0-9]{6,20}$/.test(normGradeCode(c));
  const gradeCodeHash = (grade, code) => hashPassword("gc:" + grade + ":" + normGradeCode(code).toLowerCase());
  async function getGradeCodes() { // الصفوف اللي ليها كود (الـ hash بس). null = مقدرناش نقرا
    try { const s = await db.ref("gradeCodes").get(); return s.exists() ? s.val() : {}; } catch (e) { return null; }
  }
  async function verifyGradeCode(grade, code) {
    const all = await getGradeCodes();
    if (all === null) throw new Error("NETWORK");
    const g = all[grade];
    if (!g || !g.hash) return true;
    const c = normGradeCode(code);
    if (!c) return false;
    return (await gradeCodeHash(grade, c)) === g.hash;
  }
  async function getGradeCodesAdmin() {
    const s = await db.ref("adminSettings/gradeCodes").get();
    return s.exists() ? s.val() : {};
  }
  /* map = { prep1: "abc12345", prep2: "" (شيل الكود) } — الصف اللي مش في الـ map بيفضل زي ما هو */
  async function saveGradeCodes(map) {
    const up = {}, stamp = new Date().toISOString();
    for (const g of Object.keys(map || {})) {
      if (GRADE_KEYS.indexOf(g) < 0) continue;
      const c = normGradeCode(map[g]);
      if (!c) { up["gradeCodes/" + g] = null; up["adminSettings/gradeCodes/" + g] = null; continue; }
      if (!validGradeCode(c)) throw new Error("BAD_CODE:" + g);
      up["gradeCodes/" + g] = { hash: await gradeCodeHash(g, c), updatedAt: stamp };
      up["adminSettings/gradeCodes/" + g] = c;
    }
    await db.ref().update(up);
  }
  function randomGradeCode() {
    const A = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let out = "";
    while (out.length < 8) {
      const a = new Uint8Array(16);
      crypto.getRandomValues(a);
      for (let i = 0; i < a.length && out.length < 8; i++) if (a[i] < 224) out += A[a[i] % 32];
    }
    return out;
  }

  /* ملف الطالب الحالي (نفس شكل ملف العام الدراسي، بيانات لحظية) */
  async function fetchStudentSnapshot(id) {
    if (!id) throw new Error("NO_ID");
    const [user, grades, ud, notes] = await Promise.all([
      db.ref("users/" + id).get().then((s) => (s.exists() ? s.val() : {})).catch(() => ({})),
      fetchGrades(id).catch(() => ({})),
      userDataGet(id).catch(() => ({})),
      fetchAdminNotes(id).catch(() => []),
    ]);
    const data = ud || {};
    const days = pickAny(data, ["loginDays", "activeDays", "visitDays", "daysLogged", "streakDays"]);
    const visitDays = Array.isArray(days) ? days.map(String) : (days && typeof days === "object" ? Object.keys(days).filter((k) => days[k]) : []);
    let lessonsDone = countDoneAny(data.lessonsProgress);
    if (!lessonsDone) lessonsDone = countDoneAny(pickAny(data, ["completedLessons", "lessonsDone", "lessons", "courses"]));
    if (!lessonsDone && user.unitProgress) lessonsDone = countDoneAny(user.unitProgress);
    const now = new Date();
    const start = now.getMonth() >= 7 ? now.getFullYear() : now.getFullYear() - 1;
    return {
      key: "current", uid: id, current: true,
      studentName: user.fullName || "",
      label: start + "/" + (start + 1),
      createdAt: now.toISOString(),
      gradeFrom: user.grade || "", gradeTo: user.grade || "", track: user.track || null,
      points: Number(user.points) || 0,
      badges: Array.isArray(user.badges) ? user.badges : [],
      stats: {
        lessonsDone,
        storyDone: countDoneAny(data.storyProgress),
        examsDone: data.exams ? Object.keys(data.exams).length : 0,
        storyExamsDone: data.storyExams ? Object.keys(data.storyExams).length : 0,
        sheetsDone: data.sheetSubmissions ? Object.keys(data.sheetSubmissions).length : 0,
        learningSeconds: Number(data.learningSeconds) || 0,
        visitDays,
      },
      grades: grades && Object.keys(grades).length ? grades : null,
      notes: Array.isArray(notes) ? notes : [],
    };
  }

  /* ==========================================================================
     صورة الملف الشخصي
     - compressAvatar: بتقصّ الصورة مربع وتصغّرها (128px) وتضغطها WebP/JPEG لحد ~8KB.
     - saveUserPhoto : بتحفظها في users/{id}/photoURL (نفس المكان اللي لوحة الصدارة بتقرا منه).
     - fetchUserPhoto: بتقراها من الأونلاين.
     ========================================================================== */
  async function loadBitmap(file) {
    if (window.createImageBitmap) {
      try { return await createImageBitmap(file, { imageOrientation: "from-image" }); } catch (e) { /* نجرّب الطريقة التانية */ }
    }
    const url = URL.createObjectURL(file);
    try {
      return await new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error("BAD_IMAGE"));
        img.src = url;
      });
    } finally { setTimeout(() => URL.revokeObjectURL(url), 5000); }
  }

  async function compressAvatar(file) {
    if (!file) throw new Error("NO_FILE");
    const bmp = await loadBitmap(file);
    const sw = bmp.width || bmp.naturalWidth, sh = bmp.height || bmp.naturalHeight;
    if (!sw || !sh) throw new Error("BAD_IMAGE");
    const side = Math.min(sw, sh), sx = (sw - side) / 2, sy = (sh - side) / 2;
    const MAX_BYTES = 8 * 1024;
    const bytesOf = (d) => Math.floor((d.length - d.indexOf(",") - 1) * 0.75);
    let best = null;
    for (const size of [128, 112, 96, 80, 64]) {
      const c = document.createElement("canvas");
      c.width = c.height = size;
      const ctx = c.getContext("2d");
      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, size, size);
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(bmp, sx, sy, side, side, 0, 0, size, size);
      for (const q of [0.85, 0.7, 0.55, 0.4, 0.3]) {
        let d = c.toDataURL("image/webp", q);
        if (!/^data:image\/webp/.test(d)) d = c.toDataURL("image/jpeg", q); // متصفحات مبتعملش WebP
        best = d;
        if (bytesOf(d) <= MAX_BYTES) return d;
      }
    }
    if (bmp.close) { try { bmp.close(); } catch (e) { /* ignore */ } }
    if (best && bytesOf(best) <= 20 * 1024) return best;
    throw new Error("TOO_BIG");
  }

  async function saveUserPhoto(id, dataUrl) {
    if (!id) throw new Error("NO_ID");
    await db.ref("users/" + id).update({ photoURL: dataUrl || null, photoV: dataUrl ? Date.now() : null });
  }

  async function fetchUserPhoto(id) {
    if (!id) return null;
    const snap = await db.ref("users/" + id + "/photoURL").get();
    return snap.exists() ? snap.val() : null;
  }

  window.SNAuth = {
    compressAvatar, saveUserPhoto, fetchUserPhoto,
    wipeLocalUserData,
    syncAccountGeneration,
    fetchHonors,
    fetchHonorImage,
    pushHonor,
    deleteHonor,
    fetchAnnouncements,
    watchAnnouncements,
    pushAnnouncement,
    updateAnnouncement,
    deleteAnnouncement,
    fetchAnnouncementFile,
    pushAdminNote,
    deleteAdminNote,
    fetchAdminNotes,
    watchAdminNotes,
    getAdminSettings,
    saveAdminSettings,
    fetchSiteTheme,
    fetchSiteBranding,
    fetchSiteBrandingLogo,
    saveSiteBranding,
    saveSiteTheme,
    fetchAllGrades,
    saveClassAvg,
    fetchClassAvg,
    fetchAllUserData,
    deleteUserCompletely,
    fetchPlatformLock,
    watchPlatformLock,
    activatePlatformLock,
    deactivatePlatformLock,
    verifyPlatformLockCode,
    markLockOk,
    fetchLockOk,
    sweepExpiredLock,
    promoteAllStudents,
    GRADE_KEYS,
    validGradeCode,
    getGradeCodes,
    verifyGradeCode,
    getGradeCodesAdmin,
    saveGradeCodes,
    randomGradeCode,
    fetchStudentSnapshot,
    fetchYearReports,
    setUserPassword,
    changeUserEmail,
    fetchEssaySubmissions,
    updateEssaySubmission,
    userDataGet,
    userDataSet,
    saveUserFields,
    pushEssaySubmission,
    addGradeEntry,
    setGradeEntry,
    fetchGrades,
    emailToKey,
    hashPassword,
    verifyLogin,
    prepareRegistration,
    commitRegistration,
    requestOtp,
    checkResetCode,
    resetPasswordWithOtp,
    verifyOtpCode,
    markVerifiedAndFetch,
    findUserByEmail,
    fetchUsersByGrade,
    fetchAllUsers,
    saveUserRemote,
    saveUnitProgress,
    newExamId,
    fetchExams,
    watchExams,
    saveExam,
    fetchExamKeys,
    deleteExam,
    fetchExamSubmission,
    fetchAllExamSubmissions,
    saveExamSubmission,
    updateExamSubmission,
    updateExamFields,
  };
})();

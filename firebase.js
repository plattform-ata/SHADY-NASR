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

  async function sendOtpEmail({ toEmail, name, code, flow }) {
    if (!window.emailjs) throw new Error("EMAILJS_NOT_LOADED");
    return emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, {
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
    });
  }

  async function findUserByEmail(email) {
    const key = emailToKey(email);
    const snap = await db.ref("users/" + key).get();
    return snap.exists() ? snap.val() : null;
  }

  /* --- إنشاء حساب طالب حقيقي جديد --- */
  async function createUser({ fullName, email, password, age, grade, gender, track }) {
    const cleanEmail = String(email).trim().toLowerCase();
    const key = emailToKey(cleanEmail);

    const existing = await findUserByEmail(cleanEmail);
    if (existing) throw new Error("EMAIL_EXISTS");

    const passwordHash = await hashPassword(password);
    const user = {
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
      emailVerified: false,
      createdAt: new Date().toISOString(),
    };

    await db.ref("users/" + key).set(user);
    return user;
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
      err.code = emailErr && (emailErr.status || emailErr.code) || "EMAILJS_ERROR";
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

  /* --- حفظ أي تعديل على بيانات مستخدم موجود (نقط، بادجات، بروفايل...) --- */
  async function saveUserRemote(user) {
    if (!user || !user.id) return;
    await db.ref("users/" + user.id).set(user);
  }

  /* --- حفظ تقدّم الوحدات فقط (بدون لمس باقي بيانات المستخدم) --- */
  async function saveUnitProgress(userId, progress) {
    if (!userId) return;
    await db.ref("users/" + userId + "/unitProgress").set(progress || {});
  }

  /* --- بيانات تقدّم الطالب (دروس، قصة، مهام، ملاحظات، وقت التعلّم، أيام الدخول)
     تحت userData/{id}/... عشان تفضل موجودة لو فتح من جهاز تاني. --- */
  async function userDataGet(id) {
    const snap = await db.ref("userData/" + id).get();
    return snap.exists() ? snap.val() : {};
  }

  async function userDataSet(id, path, value) {
    await db.ref("userData/" + id + "/" + path).set(value);
  }

  /* --- النقط والبادجات (نفس عقدة users/{id} اللي بتقراها لوحة المتصدرين) --- */
  async function saveUserFields(id, fields) {
    if (!id) return;
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

  /* --- كل درجات / بيانات كل الطلاب مرة واحدة (للإحصائيات) --- */
  async function fetchAllGrades() {
    const snap = await db.ref("grades").get();
    return snap.exists() ? snap.val() : {};
  }
  async function fetchAllUserData() {
    const snap = await db.ref("userData").get();
    return snap.exists() ? snap.val() : {};
  }

  /* --- حذف طالب نهائيًا من كل العقد --- */
  async function deleteUserCompletely(id) {
    if (!id) return;
    await Promise.all([
      db.ref("users/" + id).remove(),
      db.ref("userData/" + id).remove(),
      db.ref("grades/" + id).remove(),
    ]);
  }

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
    if (await findUserByEmail(cleanEmail)) throw new Error("EMAIL_EXISTS");
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
  async function pushAnnouncement(entry) {
    const ref = db.ref("announcements").push();
    await ref.set({ ...entry, id: ref.key });
    return ref.key;
  }
  async function updateAnnouncement(id, fields) {
    if (!id) return;
    await db.ref("announcements/" + id).update(fields);
  }
  async function deleteAnnouncement(id) {
    if (!id) return;
    await db.ref("announcements/" + id).remove();
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

  window.SNAuth = {
    fetchHonors,
    fetchHonorImage,
    pushHonor,
    deleteHonor,
    fetchAnnouncements,
    watchAnnouncements,
    pushAnnouncement,
    updateAnnouncement,
    deleteAnnouncement,
    getAdminSettings,
    saveAdminSettings,
    fetchSiteTheme,
    fetchSiteBranding,
    fetchSiteBrandingLogo,
    saveSiteBranding,
    saveSiteTheme,
    fetchAllGrades,
    fetchAllUserData,
    deleteUserCompletely,
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
    createUser,
    verifyLogin,
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
  };
})();

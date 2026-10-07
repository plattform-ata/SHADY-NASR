/* ==========================================================================
   accounts.js — الحسابات على الجهاز (تبديل بين أكتر من حساب + إضافة حساب جديد)
   - مربع "الحسابات" في أقسام "المزيد": بيعرض كل الحسابات المفعّلة على الجهاز ده
   - تبديل سريع بين الحسابات من غير ما تكتب الإيميل والباسورد تاني
   - تحت المربعات: إضافة حساب جديد، أو تسجيل دخول بحساب موجود (الاتنين بكود تحقق)
   - كل حساب بياناته منفصلة تمامًا (الـ id بتاعه هو الإيميل)، وبعد التبديل الصفحة بتتحمّل من الأول
   شروط الحساب الجديد:
   - الإيميل لازم يكون مختلف عن أي حساب على الجهاز (وعن أي حساب مسجّل في المنصة)
   - كلمة المرور لازم تكون مختلفة عن كلمات مرور باقي الحسابات على الجهاز
   - الاسم والسن ممكن يتشابهوا
   يتحمّل في studenti.html بعد announcements.js.
   ========================================================================== */
(() => {
  "use strict";

  const LIST_KEY = "shadynasr-accounts";
  const MAX_ACCOUNTS = 5;
  const COOLDOWN_S = 30;

  const EXT = {
    ar: {
      dash_nav_accounts: "الحسابات",
      acc_intro: "الحسابات المسجّل دخولها على الجهاز ده. اضغط على أي حساب عشان تتنقّل له، أو ضيف حساب جديد.",
      acc_current: "الحالي",
      acc_switch: "تبديل",
      acc_remove: "إزالة من الجهاز",
      acc_add: "إضافة حساب جديد",
      acc_login: "دخول بحساب موجود",
      acc_back: "رجوع",
      acc_full: "وصلت للحد الأقصى (5 حسابات). شيل حساب الأول عشان تضيف غيره.",
      acc_add_title: "إنشاء حساب جديد",
      acc_add_hint: "الإيميل وكلمة المرور لازم يكونوا مختلفين عن حساباتك التانية على الجهاز. الاسم والسن ممكن يتشابهوا.",
      acc_login_title: "تسجيل الدخول بحساب موجود",
      acc_name: "الاسم الكامل (بالعربي)",
      acc_email: "البريد الإلكتروني",
      acc_pass: "كلمة المرور",
      acc_age: "السن",
      acc_grade: "الصف الدراسي",
      acc_track: "المسار",
      acc_track_general: "ثانوية عامة",
      acc_track_bacc: "بكالوريا",
      acc_gender: "النوع",
      acc_male: "ذكر",
      acc_female: "أنثى",
      acc_submit_add: "إنشاء الحساب وإرسال الكود",
      acc_submit_login: "دخول وإرسال الكود",
      acc_otp_title: "كود التحقق",
      acc_otp_sent: "بعتنا كود من 6 أرقام على",
      acc_otp_confirm: "تأكيد",
      acc_resend: "إعادة الإرسال",
      acc_wait: "استنى {n} ثانية",
      acc_sending: "جاري التحميل…",
      acc_ok_sent: "اتبعت الكود على الإيميل.",
      acc_err_name: "الاسم لازم يتكتب بالحروف العربية بس.",
      acc_err_email: "اكتب إيميل صحيح.",
      acc_err_pass: "كلمة المرور لازم تكون 6 حروف أو أرقام على الأقل.",
      acc_err_age: "اكتب سن صحيح.",
      acc_err_required: "كمّل كل البيانات.",
      acc_err_email_saved: "الإيميل ده موجود بالفعل على الجهاز. استخدم إيميل مختلف.",
      acc_err_same_pass: "كلمة المرور دي مستخدمة في حساب تاني على الجهاز. اختار كلمة مختلفة.",
      acc_err_exists: "في حساب مسجّل بالإيميل ده بالفعل. جرّب \"دخول بحساب موجود\".",
      acc_err_wrong: "الإيميل أو كلمة المرور غير صحيحة.",
      acc_err_admin: "حسابات الأدمن بتدخل من صفحة الدخول العادية.",
      acc_err_saved: "الحساب ده مضاف بالفعل. اضغط عليه من القايمة للتبديل.",
      acc_err_code: "اكتب الكود كامل (6 أرقام).",
      acc_err_wrong_code: "الكود غلط، حاول تاني.",
      acc_err_expired: "الكود منتهي الصلاحية، اضغط إعادة الإرسال.",
      acc_err_send: "تعذر إرسال الكود، اضغط إعادة الإرسال أو حاول بعد لحظات.",
      acc_err_net: "حصل خطأ، اتأكد من النت وحاول تاني.",
      acc_gone: "الحساب ده اتمسح من المنصة واتشال من الجهاز.",
      acc_changed: "بيانات الدخول للحساب ده اتغيّرت. سجّل الدخول بيه من جديد.",
      acc_confirm_remove: "هتشيل الحساب ده من الجهاز؟ هتحتاج تسجّل دخول بيه تاني بكود تحقق لو عايزه تاني. بياناته على المنصة مش هتتأثر.",
      acc_yes: "إزالة",
      acc_no: "إلغاء",
    },
    en: {
      dash_nav_accounts: "Accounts",
      acc_intro: "Accounts signed in on this device. Tap one to switch, or add a new account.",
      acc_current: "Current",
      acc_switch: "Switch",
      acc_remove: "Remove from device",
      acc_add: "Add new account",
      acc_login: "Sign in to existing",
      acc_back: "Back",
      acc_full: "Limit reached (5 accounts). Remove one first to add another.",
      acc_add_title: "Create a new account",
      acc_add_hint: "Email and password must differ from your other accounts on this device. Name and age may be the same.",
      acc_login_title: "Sign in to an existing account",
      acc_name: "Full name (Arabic)",
      acc_email: "Email",
      acc_pass: "Password",
      acc_age: "Age",
      acc_grade: "Grade",
      acc_track: "Track",
      acc_track_general: "General",
      acc_track_bacc: "Baccalaureate",
      acc_gender: "Gender",
      acc_male: "Male",
      acc_female: "Female",
      acc_submit_add: "Create account and send code",
      acc_submit_login: "Sign in and send code",
      acc_otp_title: "Verification code",
      acc_otp_sent: "We sent a 6-digit code to",
      acc_otp_confirm: "Confirm",
      acc_resend: "Resend",
      acc_wait: "Wait {n}s",
      acc_sending: "Loading…",
      acc_ok_sent: "Code sent to your email.",
      acc_err_name: "The name must be written in Arabic letters only.",
      acc_err_email: "Enter a valid email.",
      acc_err_pass: "Password must be at least 6 characters.",
      acc_err_age: "Enter a valid age.",
      acc_err_required: "Please fill in all fields.",
      acc_err_email_saved: "This email is already on this device. Use a different one.",
      acc_err_same_pass: "This password is used by another account on this device. Choose a different one.",
      acc_err_exists: "An account with this email already exists. Try \"Sign in to existing\".",
      acc_err_wrong: "Incorrect email or password.",
      acc_err_admin: "Admin accounts sign in from the normal login page.",
      acc_err_saved: "This account is already added. Tap it in the list to switch.",
      acc_err_code: "Enter the full 6-digit code.",
      acc_err_wrong_code: "Wrong code, try again.",
      acc_err_expired: "The code has expired, press Resend.",
      acc_err_send: "Couldn't send the code. Press Resend or try again shortly.",
      acc_err_net: "Something went wrong. Check your connection and try again.",
      acc_gone: "This account was deleted from the platform and removed from the device.",
      acc_changed: "This account's login details changed. Please sign in again.",
      acc_confirm_remove: "Remove this account from the device? You'll need a verification code to sign in again. Its data on the platform isn't affected.",
      acc_yes: "Remove",
      acc_no: "Cancel",
    },
  };
  if (typeof I18N !== "undefined") {
    Object.assign(I18N.ar, EXT.ar);
    Object.assign(I18N.en, EXT.en);
  }

  const GRADES = {
    prep1: ["الصف الأول الإعدادي", "1st Prep"],
    prep2: ["الصف الثاني الإعدادي", "2nd Prep"],
    prep3: ["الصف الثالث الإعدادي", "3rd Prep"],
    secondary1: ["الصف الأول الثانوي", "1st Secondary"],
    secondary2: ["الصف الثاني الثانوي", "2nd Secondary"],
    secondary3: ["الصف الثالث الثانوي", "3rd Secondary"],
  };
  const ARABIC_NAME_OK = /^[\u0621-\u063A\u0641-\u064A\u064B-\u0652\u0670\u0640 ]+$/;
  const NON_ARABIC_NAME = /[^\u0621-\u063A\u0641-\u064A\u064B-\u0652\u0670\u0640 ]/g;

  const $ = (s, r = document) => r.querySelector(s);
  const curLang = () => (document.documentElement.lang === "en" ? "en" : "ar");
  const tr = (k) => (EXT[curLang()] && EXT[curLang()][k]) || EXT.ar[k] || k;
  const esc = (v) => String(v == null ? "" : v).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const gradeLabel = (g) => (GRADES[g] ? GRADES[g][curLang() === "en" ? 1 : 0] : "");

  /* ---------- التخزين ---------- */
  function getSession() {
    try { return JSON.parse(localStorage.getItem("shadynasr-current-user")); } catch { return null; }
  }
  function readList() {
    try {
      const raw = JSON.parse(localStorage.getItem(LIST_KEY));
      return Array.isArray(raw) ? raw.filter((a) => a && a.id && a.email) : [];
    } catch { return []; }
  }
  function writeList(list) {
    try { localStorage.setItem(LIST_KEY, JSON.stringify(list)); } catch { /* ignore */ }
  }
  function cachedUser(id) {
    try {
      const raw = JSON.parse(localStorage.getItem("shadynasr-db-users"));
      return (Array.isArray(raw) ? raw : []).find((u) => u && u.id === id) || null;
    } catch { return null; }
  }
  function toRecord(u) {
    return { id: u.id, fullName: u.fullName, email: u.email, grade: u.grade, createdAt: u.createdAt || "", ph: u.passwordHash || "" };
  }
  function upsert(u) {
    if (!u || !u.id || u.role === "admin") return;
    const list = readList();
    const rec = toRecord(u);
    const i = list.findIndex((a) => a.id === rec.id);
    if (i >= 0) list[i] = { ...list[i], ...rec, ph: rec.ph || list[i].ph };
    else list.push(rec);
    writeList(list);
  }
  function removeAccount(id) {
    if (!id) return;
    writeList(readList().filter((a) => a.id !== id));
  }

  /* الحساب الحالي لازم يكون دايمًا في القايمة (حتى لو دخل من صفحة الدخول العادية) */
  function ensureCurrent() {
    const s = getSession();
    if (!s || !s.id || s.role === "admin" || !localStorage.getItem("shadynasr-auth")) return;
    const full = cachedUser(s.id) || s;
    upsert({ ...full, id: s.id, fullName: s.fullName || full.fullName, email: s.email || full.email, grade: s.grade || full.grade });
  }

  /* تثبيت حساب كجلسة حالية (نفس اللي بتعمله صفحة الدخول) ثم إعادة تحميل اللوحة */
  function activateAndReload(user) {
    try { if (window.SNAuth && SNAuth.syncAccountGeneration) SNAuth.syncAccountGeneration(user, false); } catch { /* ignore */ }
    upsert(user);
    localStorage.setItem("shadynasr-auth", "1");
    localStorage.setItem("shadynasr-current-user", JSON.stringify({ id: user.id, fullName: user.fullName, email: user.email, grade: user.grade, role: user.role || "student" }));
    try {
      const raw = JSON.parse(localStorage.getItem("shadynasr-db-users"));
      const users = Array.isArray(raw) ? raw : [];
      const i = users.findIndex((u) => u.id === user.id);
      if (i >= 0) users[i] = user; else users.push(user);
      localStorage.setItem("shadynasr-db-users", JSON.stringify(users));
    } catch { /* studenti.html هيجيب البيانات من Firebase */ }
    window.location.replace("studenti.html");
  }

  /* ---------- الحالة ---------- */
  const S = { view: "list", busy: false, msg: "", type: "err", pending: null, left: 0, timer: null, prefill: "" };

  const root = () => $("#accRoot");
  function setMsg(text, type) {
    S.msg = text || "";
    S.type = type || "err";
    const m = $("#accMsg");
    if (m) { m.textContent = S.msg; m.hidden = !S.msg; m.dataset.type = S.type; }
  }
  function setBusy(b) {
    S.busy = b;
    const r = root();
    if (!r) return;
    r.querySelectorAll("button[type=submit], [data-act]").forEach((el) => { el.disabled = b; });
  }

  const initials = (name) => {
    const parts = String(name || "").trim().split(/\s+/).filter(Boolean);
    return (parts[0] ? parts[0][0] : "") + (parts[1] ? parts[1][0] : "");
  };
  function avatarOf(a) {
    try {
      const v = localStorage.getItem("shadynasr-avatar:" + a.id);
      if (v && /^(data:image\/|https?:)/.test(v)) return '<span class="acc-av" style="background-image:url(\'' + esc(v) + '\')"></span>';
    } catch { /* ignore */ }
    return '<span class="acc-av">' + esc(initials(a.fullName)) + "</span>";
  }

  /* ---------- الرسم ---------- */
  function viewList() {
    const list = readList();
    const cur = (getSession() || {}).id;
    const cards = list.map((a) => {
      const isCur = a.id === cur;
      return '<div class="acc-card' + (isCur ? " is-current" : "") + '">' +
        '<button type="button" class="acc-card__main" data-act="switch" data-id="' + esc(a.id) + '"' + (isCur ? " disabled" : "") + ">" +
        avatarOf(a) +
        '<strong class="acc-card__name">' + esc(a.fullName) + "</strong>" +
        '<span class="acc-card__sub">' + esc(gradeLabel(a.grade)) + "</span>" +
        '<span class="acc-card__tag">' + esc(isCur ? tr("acc_current") : tr("acc_switch")) + "</span></button>" +
        (isCur ? "" : '<button type="button" class="acc-card__x" data-act="remove" data-id="' + esc(a.id) + '" aria-label="' + esc(tr("acc_remove")) + '" title="' + esc(tr("acc_remove")) + '">×</button>') +
        "</div>";
    }).join("");
    const full = list.length >= MAX_ACCOUNTS;
    return '<div class="acc-grid">' + cards + "</div>" +
      '<div class="acc-actions">' +
      '<button type="button" class="btn btn--accent" data-act="show-add"' + (full ? " disabled" : "") + ">" + esc(tr("acc_add")) + "</button>" +
      '<button type="button" class="btn btn--ghost" data-act="show-login"' + (full ? " disabled" : "") + ">" + esc(tr("acc_login")) + "</button></div>" +
      (full ? '<p class="acc-note">' + esc(tr("acc_full")) + "</p>" : "");
  }

  function field(id, name, label, type, extra) {
    return '<div class="form-field"><label for="' + id + '">' + esc(label) + '</label><input id="' + id + '" name="' + name + '" type="' + type + '" ' + (extra || "") + " /></div>";
  }
  function select(id, name, label, opts) {
    return '<div class="form-field"><label for="' + id + '">' + esc(label) + '</label><select id="' + id + '" name="' + name + '" data-enhance>' +
      opts.map((o) => '<option value="' + esc(o[0]) + '">' + esc(o[1]) + "</option>").join("") + "</select></div>";
  }

  function viewAdd() {
    const gradeOpts = Object.keys(GRADES).map((g) => [g, gradeLabel(g)]);
    return '<h3 class="acc-title">' + esc(tr("acc_add_title")) + '</h3><p class="acc-note">' + esc(tr("acc_add_hint")) + "</p>" +
      '<form class="auth-form acc-form" data-form="add" novalidate>' +
      field("accName", "name", tr("acc_name"), "text", 'dir="rtl" lang="ar" autocomplete="off"') +
      field("accEmail", "email", tr("acc_email"), "email", 'autocomplete="off" dir="ltr"') +
      field("accPass", "password", tr("acc_pass"), "password", 'autocomplete="new-password" minlength="6"') +
      field("accAge", "age", tr("acc_age"), "number", 'min="5" max="80" inputmode="numeric"') +
      select("accGrade", "grade", tr("acc_grade"), gradeOpts) +
      '<div id="accTrackWrap" hidden>' + select("accTrack", "track", tr("acc_track"), [["general", tr("acc_track_general")], ["bacc", tr("acc_track_bacc")]]) + "</div>" +
      select("accGender", "gender", tr("acc_gender"), [["male", tr("acc_male")], ["female", tr("acc_female")]]) +
      '<div class="acc-actions"><button type="submit" class="btn btn--accent">' + esc(tr("acc_submit_add")) + "</button>" +
      '<button type="button" class="btn btn--ghost" data-act="back">' + esc(tr("acc_back")) + "</button></div></form>";
  }

  function viewLogin() {
    return '<h3 class="acc-title">' + esc(tr("acc_login_title")) + "</h3>" +
      '<form class="auth-form acc-form" data-form="login" novalidate>' +
      field("accEmail", "email", tr("acc_email"), "email", 'autocomplete="off" dir="ltr" value="' + esc(S.prefill) + '"') +
      field("accPass", "password", tr("acc_pass"), "password", 'autocomplete="current-password"') +
      '<div class="acc-actions"><button type="submit" class="btn btn--accent">' + esc(tr("acc_submit_login")) + "</button>" +
      '<button type="button" class="btn btn--ghost" data-act="back">' + esc(tr("acc_back")) + "</button></div></form>";
  }

  function viewOtp() {
    const email = S.pending ? S.pending.email : "";
    return '<h3 class="acc-title">' + esc(tr("acc_otp_title")) + '</h3><p class="acc-note">' + esc(tr("acc_otp_sent")) + ' <bdi dir="ltr">' + esc(email) + "</bdi></p>" +
      '<form class="auth-form acc-form" data-form="otp" novalidate>' +
      field("accCode", "code", tr("acc_otp_title"), "text", 'inputmode="numeric" maxlength="6" autocomplete="one-time-code" dir="ltr"') +
      '<div class="acc-actions"><button type="submit" class="btn btn--accent">' + esc(tr("acc_otp_confirm")) + "</button>" +
      '<button type="button" class="btn btn--ghost" id="accResend" data-act="resend"></button>' +
      '<button type="button" class="btn btn--ghost" data-act="back">' + esc(tr("acc_back")) + "</button></div></form>";
  }

  function render() {
    const r = root();
    if (!r) return;
    const body = S.view === "add" ? viewAdd() : S.view === "login" ? viewLogin() : S.view === "otp" ? viewOtp() : viewList();
    r.innerHTML = '<div id="accMsg" class="acc-msg" role="alert" hidden></div>' + body;
    setMsg(S.msg, S.type);
    updateResend();
    // قوائم الاختيار بنفس تصميم المنصة (نافذة الاختيار بدل قايمة المتصفح)
    try { if (typeof initCustomSelects === "function") initCustomSelects(); } catch { /* ignore */ }
    const g = $("#accGrade");
    if (g) g.addEventListener("change", syncTrack);
    const n = $("#accName");
    if (n) n.addEventListener("input", () => { n.value = n.value.replace(NON_ARABIC_NAME, "").replace(/ {2,}/g, " "); });
    const c = $("#accCode");
    if (c) { c.addEventListener("input", () => { c.value = c.value.replace(/\D/g, "").slice(0, 6); }); c.focus(); }
  }
  function syncTrack() {
    const g = $("#accGrade"), w = $("#accTrackWrap");
    if (g && w) w.hidden = String(g.value).indexOf("secondary") !== 0;
  }
  function go(view, msg, type) {
    S.view = view;
    S.msg = msg || "";
    S.type = type || "err";
    render();
  }

  /* ---------- كود التحقق ---------- */
  function updateResend() {
    const b = $("#accResend");
    if (!b) return;
    b.disabled = S.busy || S.left > 0;
    b.textContent = S.left > 0 ? tr("acc_wait").replace("{n}", S.left) : tr("acc_resend");
  }
  function startCooldown() {
    clearInterval(S.timer);
    S.left = COOLDOWN_S;
    updateResend();
    S.timer = setInterval(() => {
      S.left -= 1;
      if (S.left <= 0) { S.left = 0; clearInterval(S.timer); }
      updateResend();
    }, 1000);
  }
  async function sendCode() {
    const p = S.pending;
    if (!p) return;
    try {
      await SNAuth.requestOtp(p.email, p.name, p.flow);
      setMsg(tr("acc_ok_sent"), "ok");
    } catch (e) {
      console.error("[accounts] OTP", e);
      setMsg(tr("acc_err_send"));
    }
    startCooldown();
  }

  /* ---------- العمليات ---------- */
  async function doSwitch(id) {
    const acc = readList().find((a) => a.id === id);
    if (!acc || !window.SNAuth) return;
    setMsg(tr("acc_sending"), "ok");
    setBusy(true);
    try {
      const fresh = await SNAuth.findUserByEmail(acc.email);
      if (!fresh || fresh.role === "admin" || fresh.emailVerified === false) {
        removeAccount(id);
        S.view = "list";
        render();
        setMsg(tr("acc_gone"));
        return;
      }
      if (acc.ph && fresh.passwordHash !== acc.ph) {
        // الباسورد اتغيّر (من الأدمن أو من استعادة كلمة المرور): لازم دخول جديد بكود
        removeAccount(id);
        S.prefill = acc.email;
        go("login", tr("acc_changed"));
        return;
      }
      activateAndReload(fresh);
    } catch (e) {
      console.warn("[accounts] switch", e);
      setBusy(false);
      setMsg(tr("acc_err_net"));
    }
  }

  async function doRemove(id) {
    const msg = tr("acc_confirm_remove");
    let ok;
    if (window.snDialog && snDialog.confirm) {
      ok = await snDialog.confirm({ title: tr("acc_remove"), message: msg, confirmText: tr("acc_yes"), cancelText: tr("acc_no"), tone: "danger", icon: "logout" });
    } else {
      ok = window.confirm(msg);
    }
    if (!ok) return;
    removeAccount(id);
    render();
  }

  async function submitAdd(f) {
    const fd = new FormData(f);
    const name = String(fd.get("name") || "").replace(/ {2,}/g, " ").trim();
    const email = String(fd.get("email") || "").trim().toLowerCase();
    const password = String(fd.get("password") || "");
    const age = Number(fd.get("age"));
    const grade = String(fd.get("grade") || "");
    const gender = String(fd.get("gender") || "");
    const track = String(fd.get("track") || "");

    if (!name || !email || !password || !fd.get("age")) return setMsg(tr("acc_err_required"));
    if (!ARABIC_NAME_OK.test(name)) return setMsg(tr("acc_err_name"));
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return setMsg(tr("acc_err_email"));
    if (password.length < 6) return setMsg(tr("acc_err_pass"));
    if (!(age >= 5 && age <= 80)) return setMsg(tr("acc_err_age"));

    const saved = readList();
    if (saved.some((a) => String(a.email).toLowerCase() === email)) return setMsg(tr("acc_err_email_saved"));

    setMsg("");
    setBusy(true);
    try {
      const hash = await SNAuth.hashPassword(password);
      if (saved.some((a) => a.ph && a.ph === hash)) { setMsg(tr("acc_err_same_pass")); return; }
      const reg = await SNAuth.prepareRegistration({ fullName: name, email, password, age, grade, gender, track });
      S.pending = { flow: "register", reg, email: reg.email, name: reg.fullName };
      setBusy(false);
      go("otp");
      setBusy(true);
      await sendCode();
    } catch (e) {
      setMsg(e && e.message === "EMAIL_EXISTS" ? tr("acc_err_exists") : tr("acc_err_net"));
    } finally {
      setBusy(false);
      updateResend();
    }
  }

  async function submitLogin(f) {
    const fd = new FormData(f);
    const email = String(fd.get("email") || "").trim().toLowerCase();
    const password = String(fd.get("password") || "");
    if (!email || !password) return setMsg(tr("acc_err_required"));
    if (readList().some((a) => String(a.email).toLowerCase() === email)) return setMsg(tr("acc_err_saved"));

    setMsg("");
    setBusy(true);
    try {
      const user = await SNAuth.verifyLogin(email, password);
      if (user.role === "admin") { setMsg(tr("acc_err_admin")); return; }
      S.pending = { flow: "login", email: user.email, name: user.fullName };
      setBusy(false);
      go("otp");
      setBusy(true);
      await sendCode();
    } catch (e) {
      setMsg(e && (e.message === "NOT_FOUND" || e.message === "WRONG_PASSWORD") ? tr("acc_err_wrong") : tr("acc_err_net"));
    } finally {
      setBusy(false);
      updateResend();
    }
  }

  async function submitOtp(f) {
    const code = String(new FormData(f).get("code") || "").replace(/\D/g, "");
    if (code.length !== 6) return setMsg(tr("acc_err_code"));
    const p = S.pending;
    if (!p) return go("list");
    setMsg("");
    setBusy(true);
    try {
      await SNAuth.verifyOtpCode(p.email, code);
      const user = p.flow === "register" ? await SNAuth.commitRegistration(p.reg) : await SNAuth.markVerifiedAndFetch(p.email);
      S.pending = null;
      activateAndReload(user);
    } catch (e) {
      const m = e && e.message;
      setBusy(false);
      setMsg(m === "EXPIRED" ? tr("acc_err_expired") : m === "WRONG_CODE" ? tr("acc_err_wrong_code") : m === "EMAIL_EXISTS" ? tr("acc_err_exists") : tr("acc_err_net"));
    }
  }

  /* ---------- أحداث ---------- */
  function onClick(e) {
    const el = e.target.closest("[data-act]");
    if (!el || S.busy) return;
    const act = el.dataset.act;
    if (act === "switch") doSwitch(el.dataset.id);
    else if (act === "remove") doRemove(el.dataset.id);
    else if (act === "show-add") { S.pending = null; go("add"); syncTrack(); }
    else if (act === "show-login") { S.pending = null; S.prefill = ""; go("login"); }
    else if (act === "back") { S.pending = null; go("list"); }
    else if (act === "resend" && S.left === 0) { setBusy(true); sendCode().finally(() => { setBusy(false); updateResend(); }); }
  }
  function onSubmit(e) {
    const f = e.target.closest("form[data-form]");
    if (!f) return;
    e.preventDefault();
    if (S.busy || !window.SNAuth) return;
    const kind = f.dataset.form;
    if (kind === "add") submitAdd(f);
    else if (kind === "login") submitLogin(f);
    else if (kind === "otp") submitOtp(f);
  }

  /* ---------- تنسيق ---------- */
  function injectCss() {
    if ($("#accCss")) return;
    const st = document.createElement("style");
    st.id = "accCss";
    st.textContent = `
.acc-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:12px;margin-bottom:16px}
.acc-card{position:relative;aspect-ratio:1/1;border-radius:18px;background:var(--surface-glass);border:1px solid var(--surface-glass-border);color:var(--ink);overflow:hidden}
.acc-card.is-current{border:2px solid var(--accent)}
.acc-card__main{all:unset;box-sizing:border-box;width:100%;height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;padding:12px;text-align:center;cursor:pointer}
.acc-card__main:disabled{cursor:default}
.acc-card__main:not(:disabled):hover{background:var(--surface-glass-border)}
.acc-card__main:focus-visible{outline:2px solid var(--accent);outline-offset:-4px}
.acc-av{width:52px;height:52px;border-radius:50%;background:var(--accent) center/cover no-repeat;color:var(--accent-ink);display:grid;place-items:center;font-weight:700;font-size:1.05rem}
.acc-card__name{font-size:.95rem;line-height:1.3;max-width:100%;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical}
.acc-card__sub{font-size:.78rem;color:var(--ink-soft)}
.acc-card__tag{font-size:.75rem;padding:2px 10px;border-radius:999px;border:1px solid var(--surface-glass-border);color:var(--ink-soft)}
.acc-card.is-current .acc-card__tag{background:var(--accent);color:var(--accent-ink);border-color:transparent}
.acc-card__x{all:unset;position:absolute;top:6px;inset-inline-start:6px;width:26px;height:26px;display:grid;place-items:center;border-radius:50%;font-size:1.1rem;line-height:1;color:var(--ink-soft);cursor:pointer}
.acc-card__x:hover{background:var(--surface-glass-border);color:var(--ink)}
.acc-actions{display:flex;flex-wrap:wrap;gap:10px;margin-top:8px}
.acc-title{margin:0 0 6px}
.acc-note{color:var(--ink-soft);font-size:.88rem;margin:6px 0 12px}
.acc-form{max-width:460px}
.acc-msg{margin-bottom:12px;padding:10px 14px;border-radius:12px;font-size:.9rem;border:1px solid var(--surface-glass-border);background:var(--surface-glass)}
.acc-msg[data-type="err"]{border-color:#d9534f;color:#d9534f}
.acc-msg[data-type="ok"]{border-color:#2e9e6b;color:#2e9e6b}
.acc-msg[hidden]{display:none}
@media (min-width:980px){
.acc-grid{grid-template-columns:repeat(auto-fill,minmax(230px,250px));gap:18px;margin-bottom:22px}
.acc-card{border-radius:22px}
.acc-card__main{gap:9px;padding:18px}
.acc-av{width:84px;height:84px;font-size:1.6rem}
.acc-card__name{font-size:1.15rem}
.acc-card__sub{font-size:.9rem}
.acc-card__tag{font-size:.88rem;padding:5px 16px}
.acc-card__x{top:10px;width:34px;height:34px;font-size:1.4rem}
.acc-actions .btn{min-height:48px;padding-inline:26px;font-size:1rem}
}
`;
    document.head.appendChild(st);
  }

  function init() {
    const r = root();
    if (!r) return;
    injectCss();
    ensureCurrent();
    r.addEventListener("click", onClick);
    r.addEventListener("submit", onSubmit);
    render();

    // كل ما القسم يتفتح نحدّث القايمة (ممكن حساب اتضاف أو اتشال)
    const panel = $('[data-panel="accounts"]');
    if (panel) {
      let was = false;
      new MutationObserver(() => {
        const now = panel.classList.contains("is-active");
        if (now && !was && S.view === "list") { ensureCurrent(); render(); }
        was = now;
      }).observe(panel, { attributes: true, attributeFilter: ["class"] });
    }

    if (typeof window.applyLanguage === "function") {
      const orig = window.applyLanguage;
      window.applyLanguage = function () {
        const res = orig.apply(this, arguments);
        render();
        return res;
      };
    }
  }

  window.SNAccounts = { remove: removeAccount, list: readList };
  document.addEventListener("DOMContentLoaded", init);
})();

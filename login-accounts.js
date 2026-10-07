/* ==========================================================================
   login-accounts.js — "المتابعة بحساب مسجّل" في صفحة الدخول (login.html)
   - لو الجهاز فيه حسابات اتسجّل بيها قبل كده، بيظهر زرار فوق فورم الدخول
   - الطالب بيختار حسابه من القايمة (من غير ما يكتب الإيميل أو الباسورد)
   - بنبعت كود تحقق على إيميل الحساب، ولما يكتبه بيدخل
   - زرار ← يشيل الحساب من القايمة على الجهاز، و"استخدام حساب آخر" يرجّع للفورم العادي
   القايمة (shadynasr-accounts) بتتملّي من قسم "الحسابات" في لوحة الطالب.
   يتحمّل في login.html بعد shared.js (defer).
   ========================================================================== */
(() => {
  "use strict";

  const LIST_KEY = "shadynasr-accounts";
  const COOLDOWN_S = 30;

  const T = {
    ar: {
      btn: "المتابعة بحساب مسجّل",
      or: "أو",
      pick_title: "اختار حسابك",
      pick_sub: "الحسابات اللي سجّلت بيها دخول على الجهاز ده",
      other: "استخدام حساب آخر",
      home: "الرجوع للصفحة الرئيسية",
      remove: "إزالة من الجهاز",
      back: "رجوع",
      otp_title: "أدخل كود التحقق",
      otp_sub: "بعتنالك كود مكوّن من 6 أرقام على",
      confirm: "تأكيد",
      not_received: "مستلمتش الكود؟",
      resend: "إعادة الإرسال",
      wait: "استنى {n} ثانية",
      spam: "لو الكود مجاش، دوّر عليه في فولدر الرسائل غير المرغوب فيها (Spam).",
      loading: "جاري التحميل…",
      e_gone: "الحساب ده اتمسح من المنصة واتشال من الجهاز.",
      e_changed: "بيانات الدخول للحساب ده اتغيّرت. سجّل الدخول بالإيميل وكلمة المرور.",
      e_admin: "حسابات الأدمن بتدخل بالإيميل وكلمة المرور.",
      e_send: "تعذر إرسال الكود، اضغط إعادة الإرسال أو حاول بعد لحظات.",
      e_net: "حصل خطأ، اتأكد من النت وحاول تاني.",
      e_code: "اكتب الكود كامل (6 أرقام)",
      e_wrong: "الكود غلط، حاول تاني",
      e_expired: "الكود منتهي الصلاحية، اضغط إعادة الإرسال",
      confirm_remove: "تشيل الحساب ده من الجهاز؟",
    },
    en: {
      btn: "Continue with a saved account",
      or: "or",
      pick_title: "Choose your account",
      pick_sub: "Accounts you've signed in with on this device",
      other: "Use another account",
      home: "Back to home page",
      remove: "Remove from device",
      back: "Back",
      otp_title: "Enter the verification code",
      otp_sub: "We sent a 6-digit code to",
      confirm: "Confirm",
      not_received: "Didn't get the code?",
      resend: "Resend",
      wait: "Wait {n}s",
      spam: "If the code doesn't arrive, check your Spam folder.",
      loading: "Loading…",
      e_gone: "This account was deleted from the platform and removed from the device.",
      e_changed: "This account's login details changed. Please sign in with email and password.",
      e_admin: "Admin accounts sign in with email and password.",
      e_send: "Couldn't send the code. Press Resend or try again shortly.",
      e_net: "Something went wrong. Check your connection and try again.",
      e_code: "Enter the full 6-digit code",
      e_wrong: "Wrong code, try again",
      e_expired: "The code has expired, press Resend",
      confirm_remove: "Remove this account from the device?",
    },
  };

  const $ = (s, r = document) => r.querySelector(s);
  const lang = () => (document.documentElement.lang === "en" ? "en" : "ar");
  const t = (k) => T[lang()][k] || T.ar[k] || k;
  const esc = (v) => String(v == null ? "" : v).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  const readList = () => {
    try {
      const raw = JSON.parse(localStorage.getItem(LIST_KEY));
      return Array.isArray(raw) ? raw.filter((a) => a && a.id && a.email) : [];
    } catch { return []; }
  };
  const writeList = (l) => { try { localStorage.setItem(LIST_KEY, JSON.stringify(l)); } catch { /* ignore */ } };
  const removeAccount = (id) => writeList(readList().filter((a) => a.id !== id));

  function step(name) {
    if (typeof window.goToStep === "function") return window.goToStep(name);
    document.querySelectorAll(".auth-step").forEach((s) => s.classList.toggle("is-active", s.dataset.step === name));
  }

  const S = { acc: null, left: 0, timer: null, busy: false, choose: false };
  const HOME = "index.html";

  const initials = (n) => {
    const p = String(n || "").trim().split(/\s+/).filter(Boolean);
    return (p[0] ? p[0][0] : "") + (p[1] ? p[1][0] : "");
  };
  function avatar(a) {
    try {
      const v = localStorage.getItem("shadynasr-avatar:" + a.id);
      if (v && /^(data:image\/|https?:)/.test(v)) return '<span class="la-av" style="background-image:url(\'' + esc(v) + '\')"></span>';
    } catch { /* ignore */ }
    return '<span class="la-av">' + esc(initials(a.fullName)) + "</span>";
  }

  /* ---------- بناء الواجهة ---------- */
  function injectCss() {
    if ($("#laCss")) return;
    const st = document.createElement("style");
    st.id = "laCss";
    st.textContent = `
.la-open{display:flex;align-items:center;justify-content:center;gap:10px;width:100%}
.la-open svg{width:20px;height:20px}
.la-or{display:flex;align-items:center;gap:12px;color:var(--ink-soft);font-size:.85rem;margin:2px 0}
.la-or::before,.la-or::after{content:"";flex:1;height:1px;background:var(--surface-glass-border)}
.la-list{display:flex;flex-direction:column;gap:10px;margin:14px 0}
.la-row{position:relative;display:flex;align-items:center;border-radius:16px;background:var(--surface-glass);border:1px solid var(--surface-glass-border)}
.la-row__main{all:unset;box-sizing:border-box;flex:1;min-width:0;display:flex;align-items:center;gap:12px;padding:12px 14px;cursor:pointer;color:var(--ink);border-radius:16px}
.la-row__main:hover{background:var(--surface-glass-border)}
.la-row__main:focus-visible{outline:2px solid var(--accent);outline-offset:-3px}
.la-row__main:disabled{opacity:.6;cursor:default}
.la-av{flex:none;width:42px;height:42px;border-radius:50%;background:var(--accent) center/cover no-repeat;color:var(--accent-ink);display:grid;place-items:center;font-weight:700}
.la-txt{min-width:0;display:flex;flex-direction:column;text-align:start}
.la-txt strong{font-size:.98rem;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.la-txt small{color:var(--ink-soft);direction:ltr;text-align:start;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.la-x{all:unset;flex:none;width:30px;height:30px;margin-inline-end:8px;display:grid;place-items:center;border-radius:50%;font-size:1.2rem;color:var(--ink-soft);cursor:pointer}
.la-x:hover{background:var(--surface-glass-border);color:var(--ink)}
.la-other{width:100%}
`;
    document.head.appendChild(st);
  }

  const USER_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M4 20c1.5-4 5-6 8-6s6.5 2 8 6"/></svg>';
  const BACK_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>';

  function buildSteps() {
    const card = $(".auth-card");
    if (!card || $('[data-step="saved-pick"]')) return;
    const pick = document.createElement("div");
    pick.className = "auth-step";
    pick.dataset.step = "saved-pick";
    pick.innerHTML =
      '<button class="auth-back" type="button" id="laPickBack">' + BACK_ICON + '<span id="laPickBackT"></span></button>' +
      '<div class="auth-card__head" style="text-align:start"><h3 id="laPickTitle"></h3><p class="modal__subtitle" id="laPickSub"></p></div>' +
      '<p class="form-error" id="laPickError" hidden></p>' +
      '<div class="la-list" id="laList"></div>' +
      '<div style="display:flex;flex-direction:column;gap:10px">' +
      '<button class="btn btn--accent la-other" type="button" id="laOther"></button>' +
      '<button class="btn btn--ghost la-other" type="button" id="laHome"></button></div>';

    const otp = document.createElement("div");
    otp.className = "auth-step";
    otp.dataset.step = "saved-otp";
    otp.innerHTML =
      '<button class="auth-back" type="button" id="laOtpBack">' + BACK_ICON + '<span id="laOtpBackT"></span></button>' +
      '<div class="auth-card__head" style="text-align:start"><h3 id="laOtpTitle"></h3><p class="modal__subtitle" id="laOtpSub"></p></div>' +
      '<form class="auth-form" id="laOtpForm" novalidate>' +
      '<div class="form-field otp-field"><label class="sr-only" for="laCode" id="laCodeLbl"></label>' +
      '<input class="otp-code" type="text" id="laCode" name="otp" inputmode="numeric" autocomplete="one-time-code" pattern="[0-9]*" maxlength="6" placeholder="••••••" /></div>' +
      '<p class="otp-spam-hint" id="laSpam"></p>' +
      '<p class="form-error" id="laOtpError" hidden></p>' +
      '<button class="btn btn--accent" type="submit" id="laConfirm"></button></form>' +
      '<p class="otp-resend"><span id="laNotRec"></span> <button class="link-btn" type="button" id="laResend"></button></p>';

    const anchor = $('[data-step="otp"]', card);
    if (anchor && anchor.parentNode) {
      anchor.parentNode.insertBefore(pick, anchor);
      anchor.parentNode.insertBefore(otp, anchor);
    } else {
      card.appendChild(pick);
      card.appendChild(otp);
    }

    $("#laPickBack").addEventListener("click", () => { if (S.choose) window.location.replace(HOME); else step("credentials"); });
    $("#laHome").addEventListener("click", () => window.location.replace(HOME));
    $("#laOther").addEventListener("click", () => step("credentials"));
    $("#laOtpBack").addEventListener("click", () => { S.acc = null; openPicker(); });
    $("#laResend").addEventListener("click", () => { if (!S.left && !S.busy) sendCode(); });
    $("#laOtpForm").addEventListener("submit", submitOtp);
    $("#laCode").addEventListener("input", (e) => { e.target.value = e.target.value.replace(/\D/g, "").slice(0, 6); });
    $("#laList").addEventListener("click", onListClick);
  }

  function addEntryButton() {
    const form = $("#loginForm");
    if (!form || $("#laOpen")) return;
    const wrap = document.createElement("div");
    wrap.id = "laOpen";
    wrap.style.cssText = "display:flex;flex-direction:column;gap:12px";
    wrap.innerHTML = '<button type="button" class="btn btn--ghost la-open" id="laOpenBtn">' + USER_ICON + '<span id="laOpenT"></span></button><div class="la-or"><span id="laOrT"></span></div>';
    form.insertBefore(wrap, form.firstChild);
    $("#laOpenBtn").addEventListener("click", openPicker);
  }

  function refreshTexts() {
    const set = (id, k) => { const el = $("#" + id); if (el) el.textContent = t(k); };
    set("laOpenT", "btn"); set("laOrT", "or");
    set("laPickBackT", "back"); set("laPickTitle", "pick_title"); set("laPickSub", "pick_sub"); set("laOther", "other"); set("laHome", "home");
    set("laOtpBackT", "back"); set("laOtpTitle", "otp_title"); set("laCodeLbl", "otp_title"); set("laSpam", "spam");
    set("laConfirm", "confirm"); set("laNotRec", "not_received");
    if (S.acc) { const s = $("#laOtpSub"); if (s) s.innerHTML = esc(t("otp_sub")) + ' <bdi dir="ltr">' + esc(S.acc.email) + "</bdi>"; }
    updateResend();
    const entry = $("#laOpen");
    if (entry) entry.hidden = readList().length === 0;
  }

  function setErr(id, msg) {
    const el = $("#" + id);
    if (!el) return;
    el.textContent = msg || "";
    el.hidden = !msg;
  }

  /* ---------- اختيار الحساب ---------- */
  function renderList() {
    const list = readList();
    const box = $("#laList");
    if (!box) return;
    box.innerHTML = list.map((a) =>
      '<div class="la-row"><button type="button" class="la-row__main" data-id="' + esc(a.id) + '">' + avatar(a) +
      '<span class="la-txt"><strong>' + esc(a.fullName) + "</strong><small>" + esc(a.email) + "</small></span></button>" +
      '<button type="button" class="la-x" data-rm="' + esc(a.id) + '" aria-label="' + esc(t("remove")) + '" title="' + esc(t("remove")) + '">×</button></div>'
    ).join("");
  }

  function openPicker() {
    if (!readList().length) { refreshTexts(); step("credentials"); return; }
    setErr("laPickError", "");
    renderList();
    refreshTexts();
    step("saved-pick");
  }

  function backToForm(email, msg) {
    refreshTexts();
    const tab = $('.auth-tab[data-tab="login"]');
    if (tab) tab.click();
    step("credentials");
    const em = $("#loginEmail");
    if (em && email) em.value = email;
    const er = $("#loginError");
    if (er && msg) { er.textContent = msg; er.hidden = false; }
  }

  async function onListClick(e) {
    if (S.busy) return;
    const rm = e.target.closest("[data-rm]");
    if (rm) {
      if (!window.confirm(t("confirm_remove"))) return;
      removeAccount(rm.dataset.rm);
      if (!readList().length) { if (S.choose) { window.location.replace(HOME); return; } refreshTexts(); step("credentials"); } else renderList();
      return;
    }
    const main = e.target.closest(".la-row__main");
    if (!main) return;
    const acc = readList().find((a) => a.id === main.dataset.id);
    if (!acc || !window.SNAuth) return;

    S.busy = true;
    main.disabled = true;
    setErr("laPickError", "");
    try {
      const fresh = await SNAuth.findUserByEmail(acc.email);
      if (!fresh || fresh.emailVerified === false) {
        removeAccount(acc.id);
        renderList();
        setErr("laPickError", t("e_gone"));
        if (!readList().length) { if (S.choose) { window.location.replace(HOME); return; } refreshTexts(); step("credentials"); }
        return;
      }
      if (fresh.role === "admin") { setErr("laPickError", t("e_admin")); return; }
      if (acc.ph && fresh.passwordHash !== acc.ph) {
        removeAccount(acc.id);
        backToForm(acc.email, t("e_changed"));
        return;
      }
      S.acc = { id: fresh.id, email: fresh.email, name: fresh.fullName };
      $("#laCode").value = "";
      setErr("laOtpError", "");
      refreshTexts();
      step("saved-otp");
      S.busy = false;
      await sendCode();
    } catch (err) {
      console.warn("[login-accounts]", err);
      setErr("laPickError", t("e_net"));
    } finally {
      S.busy = false;
      main.disabled = false;
    }
  }

  /* ---------- كود التحقق ---------- */
  function updateResend() {
    const b = $("#laResend");
    if (!b) return;
    b.disabled = S.busy || S.left > 0;
    b.textContent = S.left > 0 ? t("wait").replace("{n}", S.left) : t("resend");
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
    if (!S.acc) return;
    try {
      await SNAuth.requestOtp(S.acc.email, S.acc.name, "login");
      setErr("laOtpError", "");
    } catch (e) {
      console.error("[login-accounts] OTP", e);
      setErr("laOtpError", t("e_send"));
    }
    startCooldown();
  }

  async function submitOtp(e) {
    e.preventDefault();
    if (S.busy || !S.acc || !window.SNAuth) return;
    const code = ($("#laCode").value || "").replace(/\D/g, "");
    if (code.length !== 6) { setErr("laOtpError", t("e_code")); return; }
    setErr("laOtpError", "");
    S.busy = true;
    const btn = $("#laConfirm");
    btn.disabled = true;
    try {
      await SNAuth.verifyOtpCode(S.acc.email, code);
      const user = await SNAuth.markVerifiedAndFetch(S.acc.email);
      if (user.role === "admin") throw new Error("ADMIN");
      finish(user);
    } catch (err) {
      const m = err && err.message;
      setErr("laOtpError", m === "EXPIRED" ? t("e_expired") : m === "WRONG_CODE" ? t("e_wrong") : m === "ADMIN" ? t("e_admin") : t("e_net"));
      S.busy = false;
      btn.disabled = false;
    }
  }

  /* نفس اللي بتعمله صفحة الدخول العادية بعد نجاح الكود */
  function finish(user) {
    try { if (window.SNAuth && SNAuth.syncAccountGeneration) SNAuth.syncAccountGeneration(user, false); } catch { /* ignore */ }
    localStorage.setItem("shadynasr-auth", "1");
    localStorage.setItem("shadynasr-current-user", JSON.stringify({ id: user.id, fullName: user.fullName, email: user.email, grade: user.grade, role: user.role || "student" }));
    try {
      const raw = JSON.parse(localStorage.getItem("shadynasr-db-users"));
      const users = Array.isArray(raw) ? raw : [];
      const i = users.findIndex((u) => u.id === user.id);
      if (i >= 0) users[i] = user; else users.push(user);
      localStorage.setItem("shadynasr-db-users", JSON.stringify(users));
    } catch { /* studenti.html هيجيب البيانات من Firebase */ }
    const list = readList();
    const rec = { id: user.id, fullName: user.fullName, email: user.email, grade: user.grade, createdAt: user.createdAt || "", ph: user.passwordHash || "" };
    const i = list.findIndex((a) => a.id === rec.id);
    if (i >= 0) list[i] = { ...list[i], ...rec }; else list.push(rec);
    writeList(list);
    window.location.replace("studenti.html");
  }

  function init() {
    if (!$("#loginForm")) return;
    injectCss();
    buildSteps();
    addEntryButton();
    refreshTexts();
    // جاي من تسجيل الخروج: نعرض الحسابات المحفوظة الأول (ولو مفيش حسابات نروح للرئيسية)
    try { S.choose = new URLSearchParams(window.location.search).get("choose") === "1"; } catch { /* ignore */ }
    if (S.choose) {
      if (readList().length) openPicker();
      else { window.location.replace(HOME); return; }
    }
    const lt = $("#langToggle");
    if (lt) lt.addEventListener("click", () => setTimeout(() => { refreshTexts(); if ($('[data-step="saved-pick"]').classList.contains("is-active")) renderList(); }, 0));
  }

  document.addEventListener("DOMContentLoaded", init);
})();

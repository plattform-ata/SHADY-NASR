/* ==========================================================================
   grade-codes.js — كود الصف في "إنشاء حساب" (login.html)
   - كل صف دراسي ليه كود (الأدمن بيحدده من الإعدادات → "أكواد الصفوف")
   - الطالب بيختار صفه فبتظهر خانة "كود الصف"، ومينفعش ينشئ الحساب من غير الكود الصح
   - صف مفيش له كود = التسجيل فيه مفتوح
   يتحمّل في login.html بعد shared.js.
   ========================================================================== */
(() => {
  "use strict";

  const T = {
    ar: { label: "كود الصف", hint: "اطلب كود صفك من الأستاذ", ph: "اكتب كود الصف", wrong: "كود الصف غلط", need: "اكتب كود الصف", net: "تعذر التحقق من الكود، اتأكد من النت وحاول تاني" },
    en: { label: "Grade code", hint: "Ask your teacher for your grade's code", ph: "Enter the grade code", wrong: "Wrong grade code", need: "Enter the grade code", net: "Couldn't verify the code. Check your connection and try again." },
  };
  const lang = () => (document.documentElement.lang === "en" ? "en" : "ar");
  const t = (k) => T[lang()][k];
  const $ = (s, r) => (r || document).querySelector(s);

  let codes = null; // { grade: {hash} }
  let field, input, errEl;

  function build(form) {
    if ($("#regGradeCodeField")) return;
    const picker = $("#gradePicker", form);
    const host = picker ? picker.closest(".form-field") : null;
    field = document.createElement("div");
    field.className = "form-field";
    field.id = "regGradeCodeField";
    field.hidden = true;
    field.innerHTML =
      '<label for="regGradeCode" id="regGradeCodeLbl"></label>' +
      '<input type="text" id="regGradeCode" name="gradeCode" autocomplete="off" autocapitalize="characters" spellcheck="false" dir="ltr" maxlength="24" />' +
      '<p class="form-hint" id="regGradeCodeHint"></p>' +
      '<p class="form-error" id="regGradeCodeErr" hidden></p>';
    if (host) host.insertAdjacentElement("afterend", field); else form.insertBefore(field, $("#registerError", form));
    input = $("#regGradeCode", field);
    errEl = $("#regGradeCodeErr", field);
    input.addEventListener("input", () => setErr(""));
    texts();
  }
  function texts() {
    if (!field) return;
    $("#regGradeCodeLbl", field).textContent = t("label");
    $("#regGradeCodeHint", field).textContent = t("hint");
    input.placeholder = t("ph");
  }
  function setErr(m) { if (!errEl) return; errEl.textContent = m || ""; errEl.hidden = !m; }

  const needsCode = (g) => !!(g && codes && codes[g] && codes[g].hash);
  function sync(form) {
    const g = (form.elements.grade && form.elements.grade.value) || "";
    const need = needsCode(g);
    field.hidden = !need;
    input.required = need;
    if (!need) { input.value = ""; setErr(""); }
  }
  async function load() {
    if (!window.SNAuth || !SNAuth.getGradeCodes) return null;
    const c = await SNAuth.getGradeCodes();
    if (c) codes = c;
    return c;
  }

  function init() {
    const form = $("#registerForm");
    if (!form) return;
    build(form);
    const refresh = () => sync(form);
    form.addEventListener("change", refresh);
    let lastG = "";
    setInterval(() => { const g = form.elements.grade ? form.elements.grade.value : ""; if (g !== lastG) { lastG = g; refresh(); } }, 300);

    let tries = 0;
    (function boot() {
      if (window.SNAuth && SNAuth.getGradeCodes) load().then(refresh).catch(() => {});
      else if (tries++ < 40) setTimeout(boot, 250);
    })();

    let passed = false;
    /* بنعترض الإرسال قبل ما shared.js ينشئ الحساب، نتحقق من الكود، وبعدين نعيد الإرسال */
    form.addEventListener("submit", async (e) => {
      if (passed) { passed = false; return; }
      e.preventDefault();
      e.stopImmediatePropagation();
      setErr("");
      const btn = $("button[type=submit]", form);
      try {
        if (!codes) await load();
        const g = form.elements.grade.value;
        if (!needsCode(g)) { sync(form); passed = true; form.requestSubmit(); return; }
        if (!String(input.value).trim()) { setErr(t("need")); input.focus(); return; }
        if (btn) btn.disabled = true;
        if (!(await SNAuth.verifyGradeCode(g, input.value))) { setErr(t("wrong")); input.focus(); return; }
        passed = true;
        form.requestSubmit();
      } catch (err) {
        console.warn("[grade-codes]", err);
        setErr(t("net"));
        field.hidden = false;
      } finally {
        if (btn && !passed) btn.disabled = false;
      }
    }, true);

    const lt = $("#langToggle");
    if (lt) lt.addEventListener("click", () => setTimeout(texts, 0));
  }

  document.addEventListener("DOMContentLoaded", init);
})();

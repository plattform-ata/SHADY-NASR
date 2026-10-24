/* ==========================================================================
   grade-codes.js — خانة "كود الصف" في إنشاء حساب جديد (login.html)
   - بيضيف خانة كود الصف تحت اختيار الصف الدراسي.
   - قبل إنشاء الحساب بيتحقق من الكود عن طريق SNAuth.verifyGradeCode (firebase.js)
     اللي بيقارن بصمة الكود مع gradeCodes/<grade> في Firebase.
   - لو الصف ملوش كود محفوظ: التسجيل فيه مفتوح (الخانة تتساب فاضية).
   بيتحمّل في login.html بعد shared.js.
   ========================================================================== */
(function () {
  "use strict";

  var form = null, input = null, errEl = null, verified = false, busy = false;

  function showError(msg) {
    if (!errEl) return;
    errEl.textContent = msg || "";
    errEl.hidden = !msg;
  }

  function build() {
    form = document.getElementById("registerForm");
    if (!form || document.getElementById("regGradeCode")) return;
    var gradeField = document.getElementById("gradePicker");
    gradeField = gradeField && gradeField.closest(".form-field");
    if (!gradeField) return;

    errEl = document.getElementById("registerError");

    var wrap = document.createElement("div");
    wrap.className = "form-field";
    wrap.innerHTML =
      '<label for="regGradeCode">كود الصف</label>' +
      '<input type="text" id="regGradeCode" name="gradeCode" autocomplete="off" ' +
      'autocapitalize="characters" spellcheck="false" maxlength="20" dir="ltr" />' +
      '<p class="form-hint">اطلب كود صفك من الأستاذ</p>';
    gradeField.insertAdjacentElement("afterend", wrap);

    input = wrap.querySelector("input");
    input.addEventListener("input", function () {
      input.value = input.value.replace(/[^A-Za-z0-9\u0660-\u0669]/g, "");
      showError("");
    });

    /* لو غيّر الصف نشيل رسالة الخطأ القديمة */
    var sel = document.getElementById("regGrade");
    if (sel) sel.addEventListener("change", function () { showError(""); });

    /* capture على document عشان نسبق مستمع الإرسال بتاع shared.js */
    document.addEventListener("submit", onSubmit, true);
  }

  async function onSubmit(e) {
    if (e.target !== form) return;

    /* التحقق خلص قبل كده: سيب الإرسال يكمّل عادي لـ shared.js */
    if (verified) { verified = false; return; }

    e.preventDefault();
    e.stopImmediatePropagation();
    if (busy) return;

    var grade = (document.getElementById("regGrade") || {}).value || "";
    if (!grade) return;

    if (!window.SNAuth || typeof SNAuth.verifyGradeCode !== "function") {
      showError("تعذر الاتصال بالخادم، حاول تاني بعد لحظات");
      return;
    }

    busy = true;
    var btn = form.querySelector("button[type=submit]");
    if (btn) btn.disabled = true;
    try {
      var ok = await SNAuth.verifyGradeCode(grade, input ? input.value : "");
      if (!ok) {
        showError("كود الصف غلط");
        if (input) input.focus();
        return;
      }
      showError("");
      verified = true;
      if (typeof form.requestSubmit === "function") form.requestSubmit();
      else form.dispatchEvent(new Event("submit", { cancelable: true, bubbles: true }));
    } catch (err) {
      verified = false;
      showError("تعذر التحقق من كود الصف، اتأكد من النت وحاول تاني");
    } finally {
      busy = false;
      if (btn) btn.disabled = false;
    }
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", build);
  else build();
})();

/* ==========================================================================
   ui-pickers.js — قوايم اختيار بستايل المنصة (بدل القوايم الأصلية بتاعة المتصفح)
   1) أي <select> عادي (من غير data-enhance) بيتحوّل لزرار بيفتح نافذة فيها الاختيارات
      (نفس شكل نافذة "النوع": عنوان + اختيارات بدايرة + إلغاء). القيمة والأحداث (input/change) زي ما هي،
      فأي كود شغّال على الـ select بيكمّل من غير تعديل.
   2) مجموعات الأزرار (الصف الدراسي / وحدة-درس-قصة) جوّه قسم "الدروس والقصة" بتتحوّل لنفس القايمة؛
      الاختيار بيضغط على الزرار الأصلي فمنطق الصفحة ما بيتغيّرش.
   بيتحمّل في admin.html (وينفع في أي صفحة تانية) بعد باقي السكربتات.
   ========================================================================== */
(function () {
  "use strict";
  if (window.SNPick) return;

  var lang = function () { return document.documentElement.lang === "en" ? "en" : "ar"; };
  var TX = { ar: { cancel: "إلغاء", choose: "اختار", grade: "الصف الدراسي", type: "النوع", pickGrade: "اختار الصف الدراسي" }, en: { cancel: "Cancel", choose: "Choose", grade: "Grade", type: "Type", pickGrade: "Choose a grade" } };
  var tx = function (k) { return (TX[lang()] || TX.ar)[k]; };
  var CHEV = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>';

  function css() {
    if (document.getElementById("snPkCss")) return;
    var st = document.createElement("style");
    st.id = "snPkCss";
    st.textContent =
      ".sn-pk-btn{display:flex;align-items:center;justify-content:space-between;gap:10px;box-sizing:border-box;width:100%;min-height:44px;padding:0 14px;border-radius:var(--radius-md,14px);border:1px solid var(--surface-glass-border);background:var(--bg-soft);color:var(--ink);font:inherit;font-weight:700;font-size:.95rem;text-align:start;cursor:pointer;transition:border-color .2s,box-shadow .2s}" +
      ".sn-pk-btn:hover{border-color:var(--accent)}" +
      ".sn-pk-btn:focus-visible{outline:2px solid var(--accent);outline-offset:2px}" +
      ".sn-pk-btn[disabled]{opacity:.55;cursor:not-allowed}" +
      ".sn-pk-btn__txt{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}" +
      ".sn-pk-btn.is-empty .sn-pk-btn__txt{color:var(--ink-soft);font-weight:600}" +
      ".sn-pk-btn svg{flex:none;color:var(--ink-soft)}" +
      ".sn-pk{max-width:min(440px,92vw);padding:20px 16px 16px;display:flex;flex-direction:column;gap:12px;max-height:88vh}" +
      ".sn-pk__title{margin:0;text-align:center;font-family:var(--font-display);font-weight:800;font-size:1.05rem;color:var(--ink)}" +
      ".sn-pk__list{display:flex;flex-direction:column;gap:8px;overflow:auto;padding:2px}" +
      ".sn-pk__opt{display:flex;align-items:center;justify-content:space-between;gap:12px;width:100%;padding:14px 16px;border-radius:var(--radius-md,14px);border:1.5px solid var(--surface-glass-border);background:var(--bg-soft);color:var(--ink);font:inherit;font-weight:700;font-size:.95rem;text-align:start;cursor:pointer;transition:background .15s,border-color .15s}" +
      ".sn-pk__opt:hover{border-color:var(--accent)}" +
      ".sn-pk__opt:focus-visible{outline:2px solid var(--accent);outline-offset:2px}" +
      ".sn-pk__opt[aria-checked=true]{background:var(--surface-glass,#fff);border-color:var(--brand,var(--accent));box-shadow:0 0 0 1px var(--brand,var(--accent)) inset}" +
      ".sn-pk__opt[disabled]{opacity:.45;cursor:not-allowed}" +
      ".sn-pk__lbl{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis}" +
      ".sn-pk__radio{width:22px;height:22px;flex:none;border-radius:50%;border:2px solid var(--ink-soft);display:grid;place-items:center;box-sizing:border-box}" +
      ".sn-pk__opt[aria-checked=true] .sn-pk__radio{border-color:var(--brand,var(--accent))}" +
      ".sn-pk__opt[aria-checked=true] .sn-pk__radio::after{content:\"\";width:10px;height:10px;border-radius:50%;background:var(--brand,var(--accent))}" +
      ".sn-pk__cancel{width:100%;justify-content:center}" +
      "[data-sn-chips]>button:not(.sn-pk-btn){display:none!important}[data-sn-chips]{display:block!important}";
    document.head.appendChild(st);
  }

  var escAttr = function (s) { return String(s == null ? "" : s).replace(/"/g, "&quot;"); };

  /* ---------- النافذة ---------- */
  function openPicker(o) {
    css();
    var prev = document.activeElement, closed = false;
    var ov = document.createElement("div");
    ov.className = "modal-overlay";
    ov.innerHTML = '<div class="modal sn-pk" role="dialog" aria-modal="true" aria-label="' + escAttr(o.title) + '"><h3 class="sn-pk__title"></h3><div class="sn-pk__list" role="radiogroup"></div><button type="button" class="btn btn--ghost sn-pk__cancel"></button></div>';
    ov.querySelector(".sn-pk__title").textContent = o.title;
    ov.querySelector(".sn-pk__cancel").textContent = tx("cancel");
    var list = ov.querySelector(".sn-pk__list");
    o.options.forEach(function (op, i) {
      var b = document.createElement("button");
      b.type = "button"; b.className = "sn-pk__opt"; b.setAttribute("role", "radio"); b.dataset.i = i;
      b.setAttribute("aria-checked", String(i === o.index));
      if (op.disabled) b.disabled = true;
      b.innerHTML = '<span class="sn-pk__lbl"></span><span class="sn-pk__radio" aria-hidden="true"></span>';
      b.firstChild.textContent = op.label;
      list.appendChild(b);
    });
    var prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function close() {
      if (closed) return; closed = true;
      document.removeEventListener("keydown", onKey, true);
      ov.classList.remove("is-open");
      document.body.style.overflow = prevOverflow;
      setTimeout(function () { ov.remove(); }, 240);
      if (prev && prev.focus) { try { prev.focus(); } catch (e) { } }
    }
    function pick(i) { var op = o.options[i]; if (!op || op.disabled) return; close(); o.onPick(i, op); }
    function onKey(e) {
      if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); close(); return; }
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        var items = [].slice.call(list.querySelectorAll(".sn-pk__opt:not([disabled])"));
        var at = items.indexOf(document.activeElement);
        var next = items[(at + (e.key === "ArrowDown" ? 1 : -1) + items.length) % items.length];
        if (next) { e.preventDefault(); next.focus(); }
      }
    }
    ov.addEventListener("click", function (e) {
      if (e.target === ov || e.target.closest(".sn-pk__cancel")) return close();
      var b = e.target.closest(".sn-pk__opt");
      if (b) pick(Number(b.dataset.i));
    });
    document.addEventListener("keydown", onKey, true);
    document.body.appendChild(ov);
    requestAnimationFrame(function () {
      ov.classList.add("is-open");
      var cur = list.querySelector('[aria-checked="true"]') || list.querySelector(".sn-pk__opt:not([disabled])");
      if (cur) { cur.focus(); if (cur.scrollIntoView) cur.scrollIntoView({ block: "nearest" }); }
    });
    return { close: close };
  }

  /* ---------- 1) select عادي ---------- */
  var selects = [];
  function selTitle(sel) {
    var t = sel.getAttribute("aria-label") || sel.getAttribute("data-title") || sel.getAttribute("title");
    if (!t && sel.id) { var l = document.querySelector('label[for="' + sel.id + '"]'); if (l) t = l.textContent; }
    return (t || tx("choose")).trim();
  }
  function enhanceSelect(sel) {
    if (sel.dataset.snPk || sel.multiple || sel.size > 1 || sel.hasAttribute("data-enhance") || sel.hasAttribute("data-native")) return;
    sel.dataset.snPk = "1";
    css();
    var cs = getComputedStyle(sel), parentFlex = /flex/.test(getComputedStyle(sel.parentNode).display);
    var btn = document.createElement("button");
    btn.type = "button";
    btn.className = "sn-pk-btn";
    btn.innerHTML = '<span class="sn-pk-btn__txt"></span>' + CHEV;
    if (parentFlex) {
      btn.style.flex = cs.flexGrow + " " + cs.flexShrink + " " + cs.flexBasis;
      btn.style.width = "auto"; btn.style.minWidth = "150px";
    }
    sel.parentNode.insertBefore(btn, sel);
    sel.style.setProperty("display", "none", "important");
    var rec = { sel: sel, btn: btn, last: null };
    function sync() {
      var o = sel.options[sel.selectedIndex];
      var key = (o ? o.text : "") + "|" + sel.selectedIndex + "|" + sel.options.length + "|" + sel.disabled + "|" + sel.hidden;
      if (key === rec.last) return;
      rec.last = key;
      btn.querySelector(".sn-pk-btn__txt").textContent = o ? o.text : "";
      btn.classList.toggle("is-empty", !o || o.value === "");
      btn.disabled = sel.disabled;
      btn.hidden = sel.hidden;
    }
    rec.sync = sync;
    btn.addEventListener("click", function () {
      if (sel.disabled) return;
      var opts = [].map.call(sel.options, function (o) { return { value: o.value, label: o.text, disabled: o.disabled }; });
      openPicker({
        title: selTitle(sel), options: opts, index: sel.selectedIndex,
        onPick: function (i) {
          sel.selectedIndex = i;
          sel.dispatchEvent(new Event("input", { bubbles: true }));
          sel.dispatchEvent(new Event("change", { bubbles: true }));
          sync();
        }
      });
    });
    sel.addEventListener("change", sync);
    selects.push(rec);
    sync();
  }

  /* ---------- 2) مجموعات أزرار (الصف / النوع) في قسم الدروس والقصة ---------- */
  var ACTIVE_TOKEN = /(^|[-_])(active|on|selected|current|checked)$/;
  function isOn(b) {
    if (b.getAttribute("aria-selected") === "true" || b.getAttribute("aria-pressed") === "true") return true;
    var ac = b.getAttribute("aria-current"); if (ac && ac !== "false") return true;
    return String(b.className || "").split(/\s+/).some(function (t) { return ACTIVE_TOKEN.test(t); });
  }
  var chips = [];
  var normCls = function (b) { return String(b.className || "").split(/\s+/).filter(function (t) { return t && !ACTIVE_TOKEN.test(t); }).sort().join(" "); };
  function chipTitle(btns) {
    var all = btns.map(function (b) { return b.textContent; }).join(" ");
    if (/الصف/.test(all)) return tx("grade");
    if (/وحدة|درس|قصة|unit|lesson|story/i.test(all)) return tx("type");
    return tx("choose");
  }
  function chipPlaceholder(btns) {
    var all = btns.map(function (b) { return b.textContent; }).join(" ");
    return /الصف/.test(all) ? tx("pickGrade") : tx("choose");
  }
  var kidsOf = function (c) { return [].slice.call(c.children).filter(function (k) { return k.tagName === "BUTTON" && !k.classList.contains("sn-pk-btn"); }); };
  function enhanceChips(c) {
    if (c.dataset.snChips || c.closest(".modal,.modal-overlay")) return;
    var kids = kidsOf(c);
    if (kids.length < 3 || kids.length !== c.children.length) return;
    if (!kids.every(function (k) { return k.textContent.trim(); })) return;
    if (kids.filter(isOn).length > 1) return;
    /* لازم الأزرار تكون بنفس الشكل (زي أزرار الفلترة)، مش أزرار إجراءات مختلفة */
    var cls = normCls(kids[0]);
    if (!kids.every(function (k) { return normCls(k) === cls; })) return;
    c.dataset.snChips = "1";
    css();
    var btn = document.createElement("button");
    btn.type = "button"; btn.className = "sn-pk-btn";
    btn.innerHTML = '<span class="sn-pk-btn__txt"></span>' + CHEV;
    c.insertBefore(btn, c.firstChild);
    var rec = { chips: c, btn: btn, last: null };
    rec.sync = function () {
      if (btn.parentNode !== c) c.insertBefore(btn, c.firstChild);
      var ks = kidsOf(c), on = ks.filter(isOn)[0];
      var key = (on ? on.textContent : "") + "|" + ks.length;
      if (key === rec.last) return;
      rec.last = key;
      btn.querySelector(".sn-pk-btn__txt").textContent = on ? on.textContent.trim() : chipPlaceholder(ks);
      btn.classList.toggle("is-empty", !on);
    };
    btn.addEventListener("click", function () {
      var ks = kidsOf(c);
      openPicker({
        title: c.getAttribute("aria-label") || chipTitle(ks),
        options: ks.map(function (k) { return { label: k.textContent.trim(), disabled: k.disabled }; }),
        index: ks.indexOf(ks.filter(isOn)[0]),
        onPick: function (i) { ks[i].click(); setTimeout(rec.sync, 60); setTimeout(rec.sync, 400); }
      });
    });
    chips.push(rec);
    rec.sync();
  }

  /* ---------- مسح + متابعة ---------- */
  function scan(root) {
    root = root && root.querySelectorAll ? root : document;
    [].forEach.call(root.querySelectorAll("select"), enhanceSelect);
    if (root.tagName === "SELECT") enhanceSelect(root);
    var cm = document.getElementById("cmAdminRoot") || document.getElementById("panel-courseContent");
    if (cm) [].forEach.call(cm.querySelectorAll("div,nav,ul,section"), enhanceChips);
  }
  function tick() {
    selects = selects.filter(function (r) { if (!document.contains(r.sel)) { r.btn.remove(); return false; } r.sync(); return true; });
    chips = chips.filter(function (r) { if (!document.contains(r.chips)) { r.btn.remove(); return false; } r.sync(); return true; });
  }
  var pending = false;
  function schedule() { if (pending) return; pending = true; requestAnimationFrame(function () { pending = false; scan(document); }); }

  function init() {
    scan(document);
    new MutationObserver(schedule).observe(document.body, { childList: true, subtree: true });
    setInterval(tick, 400);
  }
  window.SNPick = { open: openPicker, scan: scan };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
})();

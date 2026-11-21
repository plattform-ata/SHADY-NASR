/* ==========================================================================
   word-pop.js — دايرة "نطق الكلمات" فوق دايرة Shady AI
   - نافذة: خانة إنجليزي بس + زرار استمع (speechSynthesis) + سرعة عادية/بطيئة + آخر الكلمات
   - ملف واحد فيه الـ CSS والـ HTML، وكل الألوان من متغيرات المنصة (--accent, --bg, --ink …)
   ========================================================================== */
(function () {
  "use strict";

  var TTS = "speechSynthesis" in window && "SpeechSynthesisUtterance" in window;
  var NON_EN = /[^A-Za-z' \-]/g;               /* حروف إنجليزي ومسافة وفاصلة علوية وشرطة بس */
  var RATES = { normal: 0.9, slow: 0.55 };
  var MAX_RECENT = 6;

  var css = [
    /* --- الدايرة --- */
    ".wp-fab{position:fixed;left:max(16px,env(safe-area-inset-left));bottom:calc(156px + env(safe-area-inset-bottom,0px));z-index:40;width:48px;height:48px;border-radius:50%;display:grid;place-items:center;",
    "background:var(--accent);color:var(--accent-ink);border:2px solid var(--bg,#f4eee0);cursor:pointer;padding:0;transition:transform .2s var(--ease,ease)}",
    ".wp-fab:hover{transform:scale(1.08)}",
    ".wp-fab:focus-visible{outline:2px solid var(--accent);outline-offset:3px}",
    ".wp-fab svg{width:26px;height:26px}",

    /* --- النافذة --- */
    ".wp-overlay{position:fixed;inset:0;z-index:2000;display:grid;place-items:center;padding:16px;background:rgba(0,0,0,.5);",
    "opacity:0;visibility:hidden;transition:opacity .2s ease,visibility .2s}",
    ".wp-overlay.is-open{opacity:1;visibility:visible}",
    ".wp-box{width:min(420px,100%);border-radius:20px;background:var(--bg);color:var(--ink);border:1px solid var(--surface-glass-border);",
    "box-shadow:0 24px 60px rgba(0,0,0,.28);overflow:hidden;transform:translateY(14px) scale(.97);transition:transform .25s var(--ease,ease)}",
    ".wp-overlay.is-open .wp-box{transform:none}",

    /* رأس النافذة بلون المنصة */
    ".wp-head{position:relative;display:flex;align-items:center;gap:14px;padding:22px 20px;background:var(--accent);color:var(--accent-ink)}",
    ".wp-badge{flex:none;width:52px;height:52px;border-radius:16px;display:grid;place-items:center;background:color-mix(in srgb,var(--accent-ink) 16%,transparent)}",
    ".wp-badge svg{width:30px;height:30px}",
    ".wp-ht{flex:1;min-width:0}",
    ".wp-title{margin:0;font-family:var(--font-display);font-size:1.15rem;font-weight:800;line-height:1.3;color:inherit}",
    ".wp-sub{margin:3px 0 0;font-size:.8rem;line-height:1.5;opacity:.85}",
    ".wp-close{flex:none;align-self:flex-start;width:34px;height:34px;border-radius:10px;border:0;background:color-mix(in srgb,var(--accent-ink) 14%,transparent);color:inherit;cursor:pointer;display:grid;place-items:center;transition:background .15s ease}",
    ".wp-close:hover{background:color-mix(in srgb,var(--accent-ink) 26%,transparent)}",
    ".wp-close:focus-visible{outline:2px solid var(--accent-ink);outline-offset:2px}",
    ".wp-close svg{width:15px;height:15px}",

    ".wp-body{padding:20px;display:grid;gap:16px}",

    /* الخانة */
    ".wp-field{position:relative}",
    ".wp-input{width:100%;box-sizing:border-box;height:60px;padding:0 48px 0 18px;border-radius:14px;border:1.5px solid var(--surface-glass-border);background:var(--surface-glass);",
    "color:var(--ink);font:inherit;font-family:var(--font-display);font-size:1.4rem;font-weight:700;text-align:left;direction:ltr;transition:border-color .15s ease,box-shadow .15s ease}",
    ".wp-input::placeholder{color:var(--ink-soft);font-weight:500;font-size:1.05rem;opacity:.75}",
    ".wp-input:focus-visible{outline:none;border-color:var(--accent);box-shadow:0 0 0 4px color-mix(in srgb,var(--accent) 16%,transparent)}",
    ".wp-clear{position:absolute;top:50%;right:12px;transform:translateY(-50%);width:28px;height:28px;border-radius:50%;border:0;cursor:pointer;display:none;place-items:center;",
    "background:color-mix(in srgb,var(--ink) 10%,transparent);color:var(--ink-soft)}",
    ".wp-clear:hover{background:color-mix(in srgb,var(--ink) 18%,transparent);color:var(--ink)}",
    ".wp-clear svg{width:12px;height:12px}",
    ".wp-field.has-text .wp-clear{display:grid}",

    /* زرار الاستماع */
    ".wp-act{height:56px;border-radius:14px;border:0;background:var(--accent);color:var(--accent-ink);font:inherit;font-size:1rem;font-weight:800;",
    "display:flex;align-items:center;justify-content:center;gap:10px;cursor:pointer;transition:background .15s ease,transform .15s ease}",
    ".wp-act:hover{background:color-mix(in srgb,var(--accent) 88%,var(--ink))}",
    ".wp-act:active{transform:scale(.98)}",
    ".wp-act:focus-visible{outline:2px solid var(--accent);outline-offset:3px}",
    ".wp-act[disabled]{opacity:.45;cursor:not-allowed}",
    ".wp-act svg{width:22px;height:22px;flex:none}",
    ".wp-eq{display:none;align-items:center;gap:3px;height:20px}",
    ".wp-eq i{display:block;width:3px;height:100%;border-radius:3px;background:currentColor;transform-origin:center;animation:wp-eq .8s ease-in-out infinite}",
    ".wp-eq i:nth-child(2){animation-delay:.15s}.wp-eq i:nth-child(3){animation-delay:.3s}.wp-eq i:nth-child(4){animation-delay:.45s}",
    "@keyframes wp-eq{0%,100%{transform:scaleY(.3)}50%{transform:scaleY(1)}}",
    ".wp-act.is-on .wp-eq{display:flex}",
    ".wp-act.is-on svg{display:none}",

    /* السرعة */
    ".wp-seg{display:grid;grid-template-columns:1fr 1fr;padding:4px;gap:4px;border-radius:12px;background:color-mix(in srgb,var(--ink) 7%,transparent)}",
    ".wp-seg button{border:0;background:transparent;border-radius:9px;padding:9px 12px;font:inherit;font-size:.85rem;font-weight:700;color:var(--ink-soft);cursor:pointer;",
    "display:flex;align-items:center;justify-content:center;gap:7px;transition:background .15s ease,color .15s ease}",
    ".wp-seg button svg{width:16px;height:16px}",
    ".wp-seg button.is-active{background:var(--surface-glass);color:var(--ink);box-shadow:0 1px 3px rgba(0,0,0,.14)}",

    /* آخر الكلمات */
    ".wp-recent[hidden]{display:none}",
    ".wp-recent h4{margin:0 0 8px;font-size:.76rem;font-weight:800;color:var(--ink-soft);letter-spacing:.02em}",
    ".wp-chips{display:flex;flex-wrap:wrap;gap:8px;direction:ltr}",
    ".wp-chip{border:1px solid var(--surface-glass-border);background:var(--surface-glass);color:var(--ink);border-radius:99px;padding:6px 14px;font:inherit;font-family:var(--font-display);",
    "font-size:.85rem;font-weight:700;cursor:pointer;transition:border-color .15s ease,background .15s ease}",
    ".wp-chip:hover{border-color:var(--accent);background:color-mix(in srgb,var(--accent) 10%,transparent)}",

    /* الرسائل */
    ".wp-status{padding:10px 14px;border-radius:12px;background:color-mix(in srgb,var(--ink) 6%,transparent);font-size:.82rem;font-weight:600;line-height:1.6;color:var(--ink-soft)}",
    ".wp-status:empty{display:none}",
    ".wp-status.is-err{color:var(--ink);border:1px solid var(--surface-glass-border)}",

    "@media (max-width:420px){.wp-head{padding:18px 16px}.wp-body{padding:16px}.wp-input{height:56px;font-size:1.25rem}}",
    "@media (prefers-reduced-motion:reduce){.wp-fab,.wp-box,.wp-overlay,.wp-act,.wp-seg button,.wp-input{transition:none}.wp-eq i{animation:none}}",
    "@media (min-width:980px){.wp-fab{width:52px;height:52px;bottom:80px}}"
  ].join("");

  var I = {
    /* حرف A + موجات صوت = نطق */
    say: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2.5 19 8 5l5.5 14M4.6 14h6.8"/><path d="M16.2 9.6a3.6 3.6 0 0 1 0 5"/><path d="M19.2 7a7.4 7.4 0 0 1 0 10"/></svg>',
    spk: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M11 5 6 9H3v6h3l5 4z"/><path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13"/></svg>',
    x: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>',
    gauge: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
    slow: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>'
  };

  var els = {}, voice = null, lastFocus = null, speed = "normal", clearT = null, recent = [];

  function setStatus(msg, isErr, autoClear) {
    clearTimeout(clearT);
    els.status.textContent = msg || "";
    els.status.classList.toggle("is-err", !!isErr);
    if (autoClear) clearT = setTimeout(function () { setStatus(""); }, autoClear);
  }

  function sanitize(v) { return v.replace(NON_EN, ""); }
  function syncField() { els.field.classList.toggle("has-text", !!els.input.value); }

  function onInput() {
    var raw = els.input.value, clean = sanitize(raw);
    if (raw !== clean) {
      var pos = els.input.selectionStart - (raw.length - clean.length);
      els.input.value = clean;
      try { els.input.setSelectionRange(Math.max(0, pos), Math.max(0, pos)); } catch (e) {}
      setStatus("اكتب بالإنجليزي بس، الحروف العربي والأرقام والرموز مش مسموحة.", true, 2500);
    } else if (els.status.classList.contains("is-err")) {
      setStatus("");
    }
    syncField();
  }

  /* ---------- النطق ---------- */
  function pickVoice() {
    if (!TTS) return;
    var l = window.speechSynthesis.getVoices() || [];
    voice = l.filter(function (v) { return /^en[-_]US$/i.test(v.lang); })[0] ||
            l.filter(function (v) { return /^en/i.test(v.lang); })[0] || null;
  }

  function setSpeaking(on) {
    els.speak.classList.toggle("is-on", on);
    els.speakLabel.textContent = on ? "بينطق…" : "استمع";
  }

  function addRecent(w) {
    var k = w.toLowerCase();
    recent = recent.filter(function (x) { return x.toLowerCase() !== k; });
    recent.unshift(w);
    if (recent.length > MAX_RECENT) recent.length = MAX_RECENT;
    els.chips.innerHTML = "";
    recent.forEach(function (x) {
      var b = document.createElement("button");
      b.type = "button";
      b.className = "wp-chip";
      b.textContent = x;
      b.addEventListener("click", function () { els.input.value = x; syncField(); speak(); });
      els.chips.appendChild(b);
    });
    els.recent.hidden = false;
  }

  function speak() {
    var text = sanitize(els.input.value).replace(/\s+/g, " ").trim();
    if (!TTS) { setStatus("المتصفح ده مش بيدعم النطق.", true); return; }
    if (!text) { setStatus("اكتب كلمة بالإنجليزي الأول وبعدين اضغط استمع.", true); els.input.focus(); return; }
    var synth = window.speechSynthesis;
    synth.cancel();
    var u = new SpeechSynthesisUtterance(text);
    u.lang = voice ? voice.lang : "en-US";
    if (voice) u.voice = voice;
    u.rate = RATES[speed];
    u.onstart = function () { setSpeaking(true); setStatus(""); };
    u.onend = u.onerror = function () { setSpeaking(false); };
    synth.speak(u);
    addRecent(text);
  }

  /* ---------- فتح وقفل ---------- */
  function open() {
    lastFocus = document.activeElement;
    els.overlay.classList.add("is-open");
    els.overlay.setAttribute("aria-hidden", "false");
    setTimeout(function () { els.input.focus(); }, 80);
  }
  function close() {
    if (TTS) window.speechSynthesis.cancel();
    setSpeaking(false);
    els.overlay.classList.remove("is-open");
    els.overlay.setAttribute("aria-hidden", "true");
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }

  /* ---------- مكان الدايرة فوق دايرة الـ AI ---------- */
  function place() {
    var ai = document.getElementById("chatFab");
    if (!ai || !els.fab) return;
    var r = ai.getBoundingClientRect();
    if (!r.width || !r.height) return;
    els.fab.style.width = r.width + "px";
    els.fab.style.height = r.height + "px";
    els.fab.style.left = Math.round(r.left) + "px";
    els.fab.style.bottom = Math.max(0, Math.round(document.documentElement.clientHeight - r.top + 12)) + "px";
  }

  /* ---------- البناء ---------- */
  function build() {
    if (document.getElementById("wordPopFab")) return;
    var st = document.createElement("style");
    st.textContent = css;
    document.head.appendChild(st);

    var fab = document.createElement("button");
    fab.type = "button";
    fab.id = "wordPopFab";
    fab.className = "wp-fab";
    fab.setAttribute("aria-label", "نطق الكلمات الإنجليزي");
    fab.title = "نطق الكلمات";
    fab.innerHTML = I.say;

    var ov = document.createElement("div");
    ov.className = "wp-overlay";
    ov.setAttribute("aria-hidden", "true");
    ov.innerHTML =
      '<div class="wp-box" role="dialog" aria-modal="true" aria-labelledby="wpTitle">' +
        '<div class="wp-head">' +
          '<span class="wp-badge">' + I.say + "</span>" +
          '<div class="wp-ht"><h3 class="wp-title" id="wpTitle">نطق الكلمات</h3><p class="wp-sub">اكتب أي كلمة إنجليزي واسمع نطقها الصحيح</p></div>' +
          '<button type="button" class="wp-close" aria-label="إغلاق">' + I.x + "</button>" +
        "</div>" +
        '<div class="wp-body">' +
          '<div class="wp-field" id="wpField">' +
            '<input class="wp-input" id="wpInput" type="text" lang="en" dir="ltr" maxlength="60" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" inputmode="text" placeholder="Type an English word" aria-label="English word">' +
            '<button type="button" class="wp-clear" id="wpClear" aria-label="مسح">' + I.x + "</button>" +
          "</div>" +
          '<button type="button" class="wp-act" id="wpSpeak">' + I.spk +
            '<span class="wp-eq" aria-hidden="true"><i></i><i></i><i></i><i></i></span><span id="wpSpeakLabel">استمع</span></button>' +
          '<div class="wp-seg" role="group" aria-label="سرعة النطق">' +
            '<button type="button" data-speed="normal" class="is-active">' + I.gauge + "عادية</button>" +
            '<button type="button" data-speed="slow">' + I.slow + "بطيئة</button>" +
          "</div>" +
          '<div class="wp-recent" id="wpRecent" hidden><h4>آخر كلمات سمعتها</h4><div class="wp-chips" id="wpChips"></div></div>' +
          '<div class="wp-status" id="wpStatus" role="status" aria-live="polite"></div>' +
        "</div>" +
      "</div>";

    document.body.appendChild(ov);
    document.body.appendChild(fab);

    els.fab = fab; els.overlay = ov;
    els.field = ov.querySelector("#wpField");
    els.input = ov.querySelector("#wpInput");
    els.speak = ov.querySelector("#wpSpeak");
    els.speakLabel = ov.querySelector("#wpSpeakLabel");
    els.status = ov.querySelector("#wpStatus");
    els.recent = ov.querySelector("#wpRecent");
    els.chips = ov.querySelector("#wpChips");

    if (!TTS) { els.speak.disabled = true; setStatus("النطق مش مدعوم في المتصفح ده.", true); }

    fab.addEventListener("click", open);
    ov.querySelector(".wp-close").addEventListener("click", close);
    ov.addEventListener("mousedown", function (e) { if (e.target === ov) close(); });
    els.speak.addEventListener("click", speak);
    ov.querySelector("#wpClear").addEventListener("click", function () {
      els.input.value = ""; syncField(); setStatus(""); els.input.focus();
    });
    els.input.addEventListener("input", onInput);
    els.input.addEventListener("keydown", function (e) { if (e.key === "Enter") { e.preventDefault(); speak(); } });
    ov.querySelectorAll(".wp-seg button").forEach(function (b) {
      b.addEventListener("click", function () {
        speed = b.dataset.speed;
        ov.querySelectorAll(".wp-seg button").forEach(function (x) { x.classList.toggle("is-active", x === b); });
        if (els.input.value.trim()) speak();
      });
    });
    document.addEventListener("keydown", function (e) { if (e.key === "Escape" && ov.classList.contains("is-open")) close(); });

    if (TTS) { pickVoice(); window.speechSynthesis.addEventListener("voiceschanged", pickVoice); }

    place();
    window.addEventListener("resize", place);
    window.addEventListener("orientationchange", place);
    window.addEventListener("load", place);
    setTimeout(place, 400);
    setTimeout(place, 1500);
    setInterval(place, 800);
    var ai = document.getElementById("chatFab");
    if (ai && window.ResizeObserver) new ResizeObserver(place).observe(ai);
    if (ai && window.MutationObserver) new MutationObserver(place).observe(ai, { attributes: true, attributeFilter: ["style", "class", "hidden"] });
    if (window.visualViewport) window.visualViewport.addEventListener("resize", place);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", build);
  else build();
})();

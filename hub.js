/* ==========================================================================
   hub.js — زرار "+" الواحد اللي بيفتح: Shady AI / المدرس / نطق الكلمات
   - بيحل مكان دايرة الـ AI (#chatFab بتفضل موجودة بس مخفية، والـ AI بيتفتح بالضغط عليها من الكود)
   - نافذة نطق الكلمات جوه الملف ده، وشات المدرس في teacher-chat.js (window.SNTeacherChat)
   - كل الألوان من متغيرات المنصة (--accent, --bg, --ink …)
   ========================================================================== */
(function () {
  "use strict";

  var TTS = "speechSynthesis" in window && "SpeechSynthesisUtterance" in window;
  var NON_EN = /[^A-Za-z' \-]/g;
  var RATES = { normal: 0.9, slow: 0.55 };
  var MAX_RECENT = 6;

  var I = {
    plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>',
    ai: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10 4l1.9 5.1L17 11l-5.1 1.9L10 18l-1.9-5.1L3 11l5.1-1.9z" fill="currentColor" fill-opacity=".22"/><path d="M18 3v4M16 5h4M19 16v4M17 18h4"/></svg>',
    chat: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="9" cy="9.5" r="3.2" fill="currentColor" fill-opacity=".22"/><path d="M3 20.5a6 6 0 0 1 12 0" fill="currentColor" fill-opacity=".22"/><path d="M14.8 3.5h4.4A1.8 1.8 0 0 1 21 5.3v3.4a1.8 1.8 0 0 1-1.8 1.8h-1.4l-2.2 2v-2h-.8a1.8 1.8 0 0 1-1.8-1.8V5.3a1.8 1.8 0 0 1 1.8-1.8z" fill="currentColor" fill-opacity=".22"/></svg>',
    say: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2.5 19 8 5l5.5 14M4.6 14h6.8"/><path d="M16.2 9.6a3.6 3.6 0 0 1 0 5"/><path d="M19.2 7a7.4 7.4 0 0 1 0 10"/></svg>',
    spk: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M11 5 6 9H3v6h3l5 4z"/><path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13"/></svg>',
    x: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>',
    gauge: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
    slow: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>'
  };

  var css = [
    /* إخفاء دايرة الـ AI القديمة (بتفضل في الصفحة عشان نفتحها من الكود) */
    "#chatFab{opacity:0!important;pointer-events:none!important}",

    /* نفس ألوان وقيم صفحة الـ AI */
    ".hub,.wp-overlay{--acc:var(--accent,#2c8097);--acc-2:color-mix(in srgb,var(--acc) 85%,#fff);--acc-1:color-mix(in srgb,var(--acc) 62%,#000);--c-bg:#fff;--c-field:#f0f4f9;--c-ink:#1f1f1f;--c-mute:#5f6368;--c-line:rgba(0,0,0,.1);--c-hover:rgba(0,0,0,.06);--c-active:color-mix(in srgb,var(--acc) 16%,transparent);--c-card:#fff;--c-border:rgba(16,24,40,.1);--c-shadow:0 1px 2px rgba(16,24,40,.05),0 8px 24px rgba(16,24,40,.06)}",
    ":root[data-theme='dark'] .hub,:root[data-theme='dark'] .wp-overlay{--c-bg:#131314;--c-field:#1e1f20;--c-ink:#e3e3e3;--c-mute:#9aa0a6;--c-line:rgba(255,255,255,.12);--c-hover:rgba(255,255,255,.08);--c-active:color-mix(in srgb,var(--acc) 30%,transparent);--c-card:#1b1c1e;--c-border:rgba(255,255,255,.1);--c-shadow:0 1px 2px rgba(0,0,0,.4),0 8px 24px rgba(0,0,0,.35)}",

    /* --- زرار + والقايمة --- */
    ".hub{direction:ltr;position:fixed;left:max(16px,env(safe-area-inset-left));bottom:calc(96px + env(safe-area-inset-bottom,0px));z-index:45;width:52px;height:52px}",
    "@media (min-width:980px){.hub{bottom:16px}}",
    ".hub__scrim{position:fixed;inset:0;z-index:0;background:color-mix(in srgb,var(--c-bg) 68%,transparent);-webkit-backdrop-filter:blur(6px);backdrop-filter:blur(6px);opacity:0;visibility:hidden;transition:opacity .25s ease,visibility .25s}",
    ".hub.is-open .hub__scrim{opacity:1;visibility:visible}",
    ".hub__main{position:relative;z-index:2;width:100%;height:100%;border-radius:50%;border:0;padding:0;display:grid;place-items:center;cursor:pointer;background:linear-gradient(135deg,var(--acc-2),var(--acc-1));color:#fff;",
    "box-shadow:0 8px 22px color-mix(in srgb,var(--acc) 40%,transparent);transition:background .3s ease,color .3s ease,box-shadow .3s ease,transform .2s ease;animation:hub-in .55s cubic-bezier(.34,1.56,.64,1) both}",
    "@keyframes hub-in{from{transform:scale(0)}to{transform:scale(1)}}",
    ".hub__main:active{transform:scale(.93)}",
    ".hub__main:focus-visible{outline:2px solid var(--acc);outline-offset:3px}",
    ".hub__main svg{width:54%;height:54%;transition:transform .5s cubic-bezier(.34,1.56,.64,1)}",
    ".hub.is-open .hub__main{background:var(--c-ink);color:var(--c-bg);box-shadow:var(--c-shadow)}",
    ".hub.is-open .hub__main svg{transform:rotate(135deg)}",
    ".hub__menu{position:absolute;z-index:1;left:0;bottom:calc(100% + 16px);display:flex;flex-direction:column-reverse;align-items:flex-start;gap:12px;pointer-events:none}",
    ".hub.is-open .hub__menu{pointer-events:auto}",
    ".hub__item{display:flex;align-items:center;gap:10px;border:0;background:transparent;padding:0;cursor:pointer;color:var(--c-ink);font:inherit;",
    "opacity:0;transform:translateY(22px) scale(.6);transform-origin:left bottom;transition:opacity .18s ease,transform .3s ease;transition-delay:calc((2 - var(--i)) * 30ms)}",
    ".hub.is-open .hub__item{opacity:1;transform:none;transition:opacity .25s ease,transform .45s cubic-bezier(.34,1.56,.64,1);transition-delay:calc(var(--i) * 65ms)}",
    ".hub__ic{position:relative;flex:none;width:48px;height:48px;border-radius:50%;display:grid;place-items:center;background:linear-gradient(135deg,var(--acc-2),var(--acc-1));color:#fff;box-shadow:0 6px 16px color-mix(in srgb,var(--acc) 34%,transparent);transition:transform .2s ease,box-shadow .2s ease}",
    ".hub__ic svg{width:23px;height:23px}",
    ".hub__item:hover .hub__ic,.hub__item:focus-visible .hub__ic{transform:scale(1.08);box-shadow:0 8px 20px color-mix(in srgb,var(--acc) 48%,transparent)}",
    ".hub__item:focus-visible{outline:none}",
    ".hub__lb{direction:rtl;padding:9px 18px;border-radius:999px;background:var(--c-card);color:var(--c-ink);border:1px solid var(--c-border);box-shadow:var(--c-shadow);font-size:.9rem;font-weight:800;white-space:nowrap}",
    ".hub__item:hover .hub__lb,.hub__item:focus-visible .hub__lb{border-color:var(--acc)}",
    ".hub__dot{position:absolute;top:-2px;right:-2px;min-width:16px;height:16px;padding:0 4px;box-sizing:border-box;border-radius:8px;background:var(--c-ink);color:var(--c-bg);border:2px solid var(--c-bg);font-size:.62rem;font-weight:800;display:grid;place-items:center}",
    ".hub__dot[hidden]{display:none}",
    ".hub__main .hub__dot{top:-3px;right:-3px;min-width:18px;height:18px}",
    ".hub.is-open .hub__main .hub__dot{display:none}",
    /* لما الزرار يبقى في يمين الشاشة: القايمة والكبسولات تتفتح ناحية الشمال بدل ما تطلع برّه الشاشة */
    ".hub.is-end .hub__menu{left:auto;right:0;align-items:flex-end}",
    ".hub.is-end .hub__item{flex-direction:row-reverse;transform-origin:right bottom}",
    ".hub__lb{max-width:calc(100vw - 96px);overflow:hidden;text-overflow:ellipsis}",

    /* --- نافذة نطق الكلمات --- */
    ".wp-overlay{position:fixed;inset:0;z-index:2000;display:grid;place-items:center;padding:16px;background:rgba(0,0,0,.45);opacity:0;visibility:hidden;transition:opacity .2s ease,visibility .2s}",
    ".wp-overlay.is-open{opacity:1;visibility:visible}",
    ".wp-box{width:min(420px,100%);border-radius:24px;background:var(--c-bg);color:var(--c-ink);border:1px solid var(--c-border);box-shadow:var(--c-shadow);overflow:hidden;transform:translateY(14px) scale(.97);transition:transform .25s var(--ease,ease)}",
    ".wp-overlay.is-open .wp-box{transform:none}",
    ".wp-head{display:flex;align-items:center;gap:14px;padding:18px 18px 14px 14px;border-bottom:1px solid var(--c-border)}",
    ".wp-badge{flex:none;width:50px;height:50px;border-radius:16px;display:grid;place-items:center;background:var(--c-active);color:var(--acc)}",
    ".wp-badge svg{width:28px;height:28px}",
    ".wp-ht{flex:1;min-width:0}",
    ".wp-title{margin:0;font-family:var(--font-display);font-size:1.1rem;font-weight:800;line-height:1.3;color:var(--c-ink)}",
    ".wp-sub{margin:3px 0 0;font-size:.8rem;line-height:1.5;color:var(--c-mute)}",
    ".wp-close{flex:none;align-self:flex-start;width:36px;height:36px;border-radius:50%;border:0;background:transparent;color:var(--c-mute);cursor:pointer;display:grid;place-items:center;transition:background .15s ease,color .15s ease}",
    ".wp-close:hover{background:var(--c-hover);color:var(--c-ink)}",
    ".wp-close:focus-visible{outline:2px solid var(--acc);outline-offset:2px}",
    ".wp-close svg{width:15px;height:15px}",
    ".wp-body{padding:18px 20px 20px;display:grid;gap:16px}",
    ".wp-field{position:relative}",
    ".wp-input{width:100%;box-sizing:border-box;height:60px;padding:0 48px 0 18px;border-radius:18px;border:1px solid var(--c-border);background:var(--c-field);color:var(--c-ink);font:inherit;font-family:var(--font-display);font-size:1.4rem;font-weight:700;text-align:left;direction:ltr;transition:border-color .15s ease,box-shadow .15s ease}",
    ".wp-input::placeholder{color:var(--c-mute);font-weight:500;font-size:1.05rem;opacity:.8}",
    ".wp-input:focus-visible{outline:none;border-color:var(--acc);box-shadow:0 0 0 3px color-mix(in srgb,var(--acc) 18%,transparent)}",
    ".wp-clear{position:absolute;top:50%;right:12px;transform:translateY(-50%);width:28px;height:28px;border-radius:50%;border:0;cursor:pointer;display:none;place-items:center;background:var(--c-hover);color:var(--c-mute)}",
    ".wp-clear:hover{color:var(--c-ink)}",
    ".wp-clear svg{width:12px;height:12px}",
    ".wp-field.has-text .wp-clear{display:grid}",
    ".wp-act{height:54px;border-radius:999px;border:0;background:linear-gradient(135deg,var(--acc-2),var(--acc-1));color:#fff;font:inherit;font-size:1rem;font-weight:800;display:flex;align-items:center;justify-content:center;gap:10px;cursor:pointer;transition:transform .15s ease,opacity .15s ease}",
    ".wp-act:active{transform:scale(.98)}",
    ".wp-act:focus-visible{outline:2px solid var(--acc);outline-offset:3px}",
    ".wp-act[disabled]{opacity:.45;cursor:not-allowed}",
    ".wp-act svg{width:22px;height:22px;flex:none}",
    ".wp-eq{display:none;align-items:center;gap:3px;height:20px}",
    ".wp-eq i{display:block;width:3px;height:100%;border-radius:3px;background:currentColor;transform-origin:center;animation:wp-eq .8s ease-in-out infinite}",
    ".wp-eq i:nth-child(2){animation-delay:.15s}.wp-eq i:nth-child(3){animation-delay:.3s}.wp-eq i:nth-child(4){animation-delay:.45s}",
    "@keyframes wp-eq{0%,100%{transform:scaleY(.3)}50%{transform:scaleY(1)}}",
    ".wp-act.is-on .wp-eq{display:flex}",
    ".wp-act.is-on svg{display:none}",
    ".wp-seg{display:grid;grid-template-columns:1fr 1fr;padding:4px;gap:4px;border-radius:999px;background:var(--c-hover)}",
    ".wp-seg button{border:0;background:transparent;border-radius:999px;padding:9px 12px;font:inherit;font-size:.85rem;font-weight:700;color:var(--c-mute);cursor:pointer;display:flex;align-items:center;justify-content:center;gap:7px;transition:background .15s ease,color .15s ease}",
    ".wp-seg button svg{width:16px;height:16px}",
    ".wp-seg button.is-active{background:var(--c-card);color:var(--c-ink);box-shadow:0 1px 3px rgba(0,0,0,.12)}",
    ".wp-recent[hidden]{display:none}",
    ".wp-recent h4{margin:0 0 8px;font-size:.78rem;font-weight:800;color:var(--c-mute)}",
    ".wp-chips{display:flex;flex-wrap:wrap;gap:8px;direction:ltr}",
    ".wp-chip{border:1px solid var(--c-border);background:var(--c-field);color:var(--c-ink);border-radius:999px;padding:7px 15px;font:inherit;font-family:var(--font-display);font-size:.85rem;font-weight:700;cursor:pointer;transition:border-color .15s ease,background .15s ease,transform .15s ease}",
    ".wp-chip:hover{border-color:var(--acc);background:var(--c-active);transform:translateY(-1px)}",
    ".wp-status{padding:10px 16px;border-radius:14px;background:var(--c-field);font-size:.82rem;font-weight:700;line-height:1.6;color:var(--c-mute)}",
    ".wp-status:empty{display:none}",
    ".wp-status.is-err{color:var(--c-ink);border:1px solid var(--c-border)}",
    "@media (max-width:420px){.wp-head{padding:14px}.wp-body{padding:16px}.wp-input{height:56px;font-size:1.25rem}}",
    "@media (prefers-reduced-motion:reduce){.hub__main,.hub__item,.hub__scrim,.hub__main svg,.wp-box,.wp-overlay,.wp-act,.wp-seg button,.wp-input{transition:none;animation:none}.wp-eq i{animation:none}}"
  ].join("");

  var hub = {}, W = {}, wBuilt = false, voice = null, wLast = null, speed = "normal", clearT = null, recent = [];

  /* ==================== الـ hub ==================== */
  function isOpen() { return hub.root.classList.contains("is-open"); }
  function setOpen(on) {
    hub.root.classList.toggle("is-open", on);
    hub.main.setAttribute("aria-expanded", on ? "true" : "false");
    hub.menu.setAttribute("aria-hidden", on ? "false" : "true");
    hub.items.forEach(function (b) { b.tabIndex = on ? 0 : -1; });
    if (on) { try { if (window.SNTeacherChat) SNTeacherChat.checkUnread(); } catch (e) {} setTimeout(function () { hub.items[0].focus(); }, 60); }
  }

  function item(i, icon, label, onClick) {
    var b = document.createElement("button");
    b.type = "button"; b.className = "hub__item"; b.style.setProperty("--i", i);
    b.setAttribute("role", "menuitem"); b.tabIndex = -1;
    b.innerHTML = '<span class="hub__ic">' + icon + '<span class="hub__dot" hidden></span></span><span class="hub__lb">' + label + "</span>";
    b.addEventListener("click", function () { setOpen(false); setTimeout(onClick, 180); });
    return b;
  }

  function setBadge(n) {
    var txt = n > 9 ? "9+" : String(n);
    [hub.main.querySelector(".hub__dot"), hub.teacherItem.querySelector(".hub__dot")].forEach(function (d) {
      if (!d) return;
      d.hidden = !n; d.textContent = txt;
    });
  }

  function openAI() {
    var f = document.getElementById("chatFab");
    if (f) f.click();
  }
  function openTeacherChat() {
    if (window.SNTeacherChat) SNTeacherChat.open();
    else alert("شات المدرس مش متاح دلوقتي.");
  }

  function place() {
    var ai = document.getElementById("chatFab");
    if (!ai || !hub.root) return;
    var r = ai.getBoundingClientRect();
    if (!r.width || !r.height) return;
    hub.root.style.width = r.width + "px";
    hub.root.style.height = r.height + "px";
    hub.root.style.left = Math.round(r.left) + "px";
    hub.root.style.bottom = Math.max(0, Math.round(document.documentElement.clientHeight - r.bottom)) + "px";
    hub.root.classList.toggle("is-end", (r.left + r.width / 2) > document.documentElement.clientWidth / 2);
  }

  function buildHub() {
    var st = document.createElement("style"); st.textContent = css; document.head.appendChild(st);

    var root = document.createElement("div");
    root.className = "hub"; root.id = "snHub";
    root.innerHTML =
      '<div class="hub__scrim"></div>' +
      '<div class="hub__menu" role="menu" aria-label="الأدوات" aria-hidden="true"></div>' +
      '<button type="button" class="hub__main" aria-haspopup="menu" aria-expanded="false" aria-label="القايمة">' + I.plus + '<span class="hub__dot" hidden></span></button>';
    document.body.appendChild(root);

    hub.root = root;
    hub.main = root.querySelector(".hub__main");
    hub.menu = root.querySelector(".hub__menu");

    var ai = item(0, I.ai, "اسأل Shady AI", openAI);
    var tc = item(1, I.chat, "كلّم المدرس", openTeacherChat);
    var wd = item(2, I.say, "نطق الكلمات", openWords);
    hub.teacherItem = tc;
    hub.items = [ai, tc, wd];
    hub.items.forEach(function (b) { hub.menu.appendChild(b); });

    hub.main.addEventListener("click", function () { setOpen(!isOpen()); });
    root.querySelector(".hub__scrim").addEventListener("click", function () { setOpen(false); hub.main.focus(); });
    document.addEventListener("keydown", function (e) {
      if (!isOpen()) return;
      if (e.key === "Escape") { setOpen(false); hub.main.focus(); }
      if (e.key === "ArrowUp" || e.key === "ArrowDown") {
        e.preventDefault();
        var i = hub.items.indexOf(document.activeElement);
        var n = e.key === "ArrowUp" ? i + 1 : i - 1;
        hub.items[(n + hub.items.length) % hub.items.length].focus();
      }
    });
    document.addEventListener("snchat:unread", function (e) { setBadge((e.detail && e.detail.count) || 0); });
    if (window.SNTeacherChat && SNTeacherChat.getUnread) setBadge(SNTeacherChat.getUnread());

    place();
    window.addEventListener("resize", place);
    window.addEventListener("orientationchange", place);
    window.addEventListener("load", place);
    setTimeout(place, 400); setTimeout(place, 1500); setInterval(place, 800);
    var f = document.getElementById("chatFab");
    if (f && window.ResizeObserver) new ResizeObserver(place).observe(f);
    if (f && window.MutationObserver) new MutationObserver(place).observe(f, { attributes: true, attributeFilter: ["style", "class", "hidden"] });
    if (window.visualViewport) window.visualViewport.addEventListener("resize", place);
  }

  /* ==================== نافذة نطق الكلمات ==================== */
  function setStatus(msg, isErr, autoClear) {
    clearTimeout(clearT);
    W.status.textContent = msg || "";
    W.status.classList.toggle("is-err", !!isErr);
    if (autoClear) clearT = setTimeout(function () { setStatus(""); }, autoClear);
  }
  function sanitize(v) { return v.replace(NON_EN, ""); }
  function syncField() { W.field.classList.toggle("has-text", !!W.input.value); }

  function onInput() {
    var raw = W.input.value, clean = sanitize(raw);
    if (raw !== clean) {
      var pos = W.input.selectionStart - (raw.length - clean.length);
      W.input.value = clean;
      try { W.input.setSelectionRange(Math.max(0, pos), Math.max(0, pos)); } catch (e) {}
      setStatus("اكتب بالإنجليزي بس، الحروف العربي والأرقام والرموز مش مسموحة.", true, 2500);
    } else if (W.status.classList.contains("is-err")) setStatus("");
    syncField();
  }

  function pickVoice() {
    if (!TTS) return;
    var l = window.speechSynthesis.getVoices() || [];
    voice = l.filter(function (v) { return /^en[-_]US$/i.test(v.lang); })[0] || l.filter(function (v) { return /^en/i.test(v.lang); })[0] || null;
  }
  function setSpeaking(on) {
    W.speak.classList.toggle("is-on", on);
    W.speakLabel.textContent = on ? "بينطق…" : "استمع";
  }
  function addRecent(w) {
    var k = w.toLowerCase();
    recent = recent.filter(function (x) { return x.toLowerCase() !== k; });
    recent.unshift(w);
    if (recent.length > MAX_RECENT) recent.length = MAX_RECENT;
    W.chips.innerHTML = "";
    recent.forEach(function (x) {
      var b = document.createElement("button");
      b.type = "button"; b.className = "wp-chip"; b.textContent = x;
      b.addEventListener("click", function () { W.input.value = x; syncField(); speak(); });
      W.chips.appendChild(b);
    });
    W.recent.hidden = false;
  }
  function speak() {
    var text = sanitize(W.input.value).replace(/\s+/g, " ").trim();
    if (!TTS) { setStatus("المتصفح ده مش بيدعم النطق.", true); return; }
    if (!text) { setStatus("اكتب كلمة بالإنجليزي الأول وبعدين اضغط استمع.", true); W.input.focus(); return; }
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

  function buildWords() {
    wBuilt = true;
    var ov = document.createElement("div");
    ov.className = "wp-overlay"; ov.setAttribute("aria-hidden", "true");
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
          '<button type="button" class="wp-act" id="wpSpeak">' + I.spk + '<span class="wp-eq" aria-hidden="true"><i></i><i></i><i></i><i></i></span><span id="wpSpeakLabel">استمع</span></button>' +
          '<div class="wp-seg" role="group" aria-label="سرعة النطق"><button type="button" data-speed="normal" class="is-active">' + I.gauge + 'عادية</button><button type="button" data-speed="slow">' + I.slow + "بطيئة</button></div>" +
          '<div class="wp-recent" id="wpRecent" hidden><h4>آخر كلمات سمعتها</h4><div class="wp-chips" id="wpChips"></div></div>' +
          '<div class="wp-status" id="wpStatus" role="status" aria-live="polite"></div>' +
        "</div>" +
      "</div>";
    document.body.appendChild(ov);

    W.overlay = ov;
    W.field = ov.querySelector("#wpField");
    W.input = ov.querySelector("#wpInput");
    W.speak = ov.querySelector("#wpSpeak");
    W.speakLabel = ov.querySelector("#wpSpeakLabel");
    W.status = ov.querySelector("#wpStatus");
    W.recent = ov.querySelector("#wpRecent");
    W.chips = ov.querySelector("#wpChips");

    if (!TTS) { W.speak.disabled = true; setStatus("النطق مش مدعوم في المتصفح ده.", true); }

    ov.querySelector(".wp-close").addEventListener("click", closeWords);
    ov.addEventListener("mousedown", function (e) { if (e.target === ov) closeWords(); });
    W.speak.addEventListener("click", speak);
    ov.querySelector("#wpClear").addEventListener("click", function () { W.input.value = ""; syncField(); setStatus(""); W.input.focus(); });
    W.input.addEventListener("input", onInput);
    W.input.addEventListener("keydown", function (e) { if (e.key === "Enter") { e.preventDefault(); speak(); } });
    ov.querySelectorAll(".wp-seg button").forEach(function (b) {
      b.addEventListener("click", function () {
        speed = b.dataset.speed;
        ov.querySelectorAll(".wp-seg button").forEach(function (x) { x.classList.toggle("is-active", x === b); });
        if (W.input.value.trim()) speak();
      });
    });
    document.addEventListener("keydown", function (e) { if (e.key === "Escape" && ov.classList.contains("is-open")) closeWords(); });
    if (TTS) { pickVoice(); window.speechSynthesis.addEventListener("voiceschanged", pickVoice); }
  }

  function openWords() {
    if (!wBuilt) buildWords();
    wLast = document.activeElement;
    W.overlay.classList.add("is-open");
    W.overlay.setAttribute("aria-hidden", "false");
    setTimeout(function () { W.input.focus(); }, 80);
  }
  function closeWords() {
    if (TTS) window.speechSynthesis.cancel();
    setSpeaking(false);
    W.overlay.classList.remove("is-open");
    W.overlay.setAttribute("aria-hidden", "true");
    if (wLast && wLast.focus) { try { wLast.focus(); } catch (e) {} }
  }

  function boot() { if (!document.getElementById("snHub")) buildHub(); }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();

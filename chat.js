/* ==========================================================================
   chat.js — مساعد الذكاء الاصطناعي للطالب (Shady AI)
   --------------------------------------------------------------------------
   - المحادثة مع الـ AI بس (Groq API) — مفيش محادثة مع المدرس.
   - سجل المحادثات (محادثات كتير) بيتحفظ على جهاز الطالب بس (localStorage)،
     مش في قاعدة البيانات، ومفصول لكل طالب (حسب الـ id بتاعه).
   - الشكل: قايمة جانبية بالمحادثات (درج في الموبايل / عمود ثابت في الكمبيوتر) + صفحة المحادثة.
   - صفحة الأدمن مبقاش فيها شات. SNChat تحت متسابة كـ no-op عشان أي كود قديم ميبوظش.
   ========================================================================== */
(function () {
  "use strict";

  var GROQ_API_KEY = "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";
  var GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";

  /* الموديل القديم (llama-3.3-70b-versatile) اتقفل في 16 أغسطس 2026.
     بنجرّب الموديلات دي بالترتيب، وبنفتكر أول واحد اشتغل. */
  var MODELS = [
    { id: "openai/gpt-oss-120b", extra: { reasoning_effort: "low" } },
    { id: "openai/gpt-oss-120b", extra: {} },
    { id: "openai/gpt-oss-20b", extra: { reasoning_effort: "low" } }
  ];
  var modelIdx = 0;

  var AI_NAME = "Shady AI";
  var KEEP = 80;        // أقصى عدد رسايل في المحادثة الواحدة
  var MAX_CHATS = 40;   // أقصى عدد محادثات محفوظة
  var CONTEXT = 14;     // عدد آخر رسايل بتتبعت للـ AI كسياق

  var SPARK = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2.5l1.9 5.3a3 3 0 0 0 1.8 1.8l5.3 1.9-5.3 1.9a3 3 0 0 0-1.8 1.8L12 20.5l-1.9-5.3a3 3 0 0 0-1.8-1.8L3 11.5l5.3-1.9a3 3 0 0 0 1.8-1.8z"/><path d="M19 3l.7 1.8L21.5 5.5l-1.8.7L19 8l-.7-1.8-1.8-.7 1.8-.7z" opacity=".8"/></svg>';
  var SEND = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M22 2 11 13M22 2l-7 20-4-9-9-4 20-7Z"/></svg>';
  var STOP = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="5" y="5" width="14" height="14" rx="3"/></svg>';
  var COPY = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V6a2 2 0 0 1 2-2h9"/></svg>';
  var MENU = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h16"/></svg>';
  var PANEL = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="3"/><path d="M9 4v16"/></svg>';
  var NEWCHAT = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>';
  var SEARCH = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>';
  var CLOSE = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>';
  var TRASH = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3"/></svg>';

  var SUGGESTIONS = [
    "اشرحلي زمن المضارع البسيط",
    "صحّحلي الجملة دي: He go to school yesterday",
    "ايه الفرق بين much و many؟",
    "اديني 5 كلمات جديدة مع أمثلة",
    "ساعدني أكتب مقال عن مدرستي"
  ];

  function $(s, r) { return (r || document).querySelector(s); }
  function esc(v) { return String(v == null ? "" : v).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
  function isDesktop() { return window.matchMedia("(min-width: 900px)").matches; }

  /* ======================= Markdown خفيف (آمن: بنعمل escape الأول) ======================= */
  function inline(s) {
    s = esc(s);
    s = s.replace(/`([^`\n]+)`/g, "<code>$1</code>");
    s = s.replace(/\*\*([^*\n]+)\*\*/g, "<strong>$1</strong>");
    s = s.replace(/(^|[\s(>])\*([^*\n]+)\*(?=[\s).,!?:؛،]|$)/g, "$1<em>$2</em>");
    s = s.replace(/(https?:\/\/[^\s<]+[^\s<.,;:!?)\]])/g, '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>');
    return s;
  }
  function renderMd(text) {
    var out = [], parts = String(text || "").split(/```/);
    parts.forEach(function (seg, i) {
      if (i % 2 === 1) {
        out.push("<pre><code>" + esc(seg.replace(/^[a-zA-Z0-9+#-]*\n/, "").replace(/\n$/, "")) + "</code></pre>");
        return;
      }
      var lines = seg.split("\n"), list = null, para = [];
      function flushPara() { if (para.length) { out.push("<p>" + para.join("<br>") + "</p>"); para = []; } }
      function flushList() { if (list) { out.push("<" + list.t + ">" + list.items.join("") + "</" + list.t + ">"); list = null; } }
      lines.forEach(function (ln) {
        var m;
        if (!ln.trim()) { flushPara(); flushList(); return; }
        if ((m = ln.match(/^\s{0,3}#{1,4}\s+(.*)$/))) { flushPara(); flushList(); out.push("<h4>" + inline(m[1]) + "</h4>"); return; }
        if ((m = ln.match(/^\s*[-*•]\s+(.*)$/))) { flushPara(); if (!list || list.t !== "ul") { flushList(); list = { t: "ul", items: [] }; } list.items.push("<li>" + inline(m[1]) + "</li>"); return; }
        if ((m = ln.match(/^\s*\d+[.)]\s+(.*)$/))) { flushPara(); if (!list || list.t !== "ol") { flushList(); list = { t: "ol", items: [] }; } list.items.push("<li>" + inline(m[1]) + "</li>"); return; }
        flushList(); para.push(inline(ln));
      });
      flushPara(); flushList();
    });
    return out.join("");
  }

  /* ======================= التخزين المحلي (على جهاز الطالب بس) ======================= */
  function session() {
    try {
      var s = JSON.parse(localStorage.getItem("shadynasr-current-user"));
      return s && s.id && localStorage.getItem("shadynasr-auth") ? s : null;
    } catch (e) { return null; }
  }
  function keyAll(id) { return "shadynasr-ai-chats-" + id; }
  function keyOld(id) { return "shadynasr-ai-chat-" + id; }   // الشكل القديم (محادثة واحدة)
  function okMsg(m) { return m && typeof m.content === "string" && (m.role === "user" || m.role === "assistant"); }

  function loadChats(id) {
    var arr = [];
    try {
      var a = JSON.parse(localStorage.getItem(keyAll(id)) || "[]");
      if (Array.isArray(a)) {
        arr = a.filter(function (c) { return c && c.id && Array.isArray(c.msgs); }).map(function (c) {
          return { id: String(c.id), title: String(c.title || ""), at: c.at || Date.now(), msgs: c.msgs.filter(okMsg) };
        }).filter(function (c) { return c.msgs.length; });
      }
    } catch (e) { arr = []; }
    // نقل المحادثة القديمة (لو موجودة) كمحادثة في السجل
    try {
      var old = JSON.parse(localStorage.getItem(keyOld(id)) || "null");
      if (Array.isArray(old)) {
        var ms = old.filter(okMsg);
        if (ms.length) {
          var first = ms.filter(function (m) { return m.role === "user"; })[0];
          arr.push({ id: uid(), title: first ? titleOf(first.content) : "محادثة سابقة", at: ms[ms.length - 1].at || Date.now(), msgs: ms });
        }
        persist(id, arr);
        localStorage.removeItem(keyOld(id));
      }
    } catch (e) { /* ignore */ }
    arr.sort(function (a, b) { return b.at - a.at; });
    return arr;
  }
  function persist(id, chats) {
    var data = chats.filter(function (c) { return c.msgs.length; }).sort(function (a, b) { return b.at - a.at; }).slice(0, MAX_CHATS)
      .map(function (c) { return { id: c.id, title: c.title, at: c.at, msgs: c.msgs.slice(-KEEP) }; });
    try { localStorage.setItem(keyAll(id), JSON.stringify(data)); }
    catch (e) {
      // التخزين ممتلي: نشيل أقدم محادثة ونجرّب مرة تانية
      try { data.pop(); localStorage.setItem(keyAll(id), JSON.stringify(data)); } catch (e2) { /* نكمّل من غير حفظ */ }
    }
  }
  function save() { if (S) persist(S.id, S.chats); }
  function titleOf(t) { t = String(t || "").replace(/\s+/g, " ").trim(); return t.length > 46 ? t.slice(0, 46) + "…" : (t || "محادثة جديدة"); }

  /* ======================= الواجهة ======================= */
  var ov = null, els = {}, S = null;

  function build() {
    if (ov) return;
    ov = document.createElement("div");
    ov.className = "chat-ov";
    ov.hidden = true;
    ov.setAttribute("role", "dialog");
    ov.setAttribute("aria-modal", "true");
    ov.setAttribute("aria-label", AI_NAME);
    ov.innerHTML =
      '<div class="chat-app" id="chatApp" data-side="closed">' +
      '<div class="chat-scrim" id="chatScrim"></div>' +
      '<aside class="chat-side" id="chatSide" aria-label="المحادثات">' +
      '<div class="chat-side__top"><span class="chat-brand"><span class="chat-brand__ico">' + SPARK + '</span>' + AI_NAME + '</span>' +
      '<button type="button" class="chat-ico" id="chatSideClose" aria-label="قفل القايمة">' + PANEL + '</button></div>' +
      '<label class="chat-search">' + SEARCH + '<input id="chatSearch" type="search" placeholder="دوّر في المحادثات" autocomplete="off" aria-label="بحث في المحادثات"></label>' +
      '<button type="button" class="chat-new" id="chatNew">' + NEWCHAT + '<span>محادثة جديدة</span></button>' +
      '<div class="chat-side__label">المحادثات</div>' +
      '<nav class="chat-hist" id="chatHist"></nav>' +
      '<button type="button" class="chat-user" id="chatExit"><span class="chat-user__av" id="chatUserAv"></span><span class="chat-user__t"><strong id="chatUserName"></strong><small>الرجوع للمنصة</small></span></button>' +
      '</aside>' +
      '<main class="chat-main" id="chatMain">' +
      '<header class="chat-head">' +
      '<button type="button" class="chat-ico" id="chatMenu" aria-label="المحادثات">' + MENU + '</button>' +
      '<div class="chat-title">' + AI_NAME + '</div>' +
      '<button type="button" class="chat-ico" id="chatNew2" aria-label="محادثة جديدة" title="محادثة جديدة">' + NEWCHAT + '</button>' +
      '<button type="button" class="chat-ico" id="chatClose" aria-label="رجوع للمنصة" title="رجوع للمنصة">' + CLOSE + '</button>' +
      '</header>' +
      '<div class="chat-body" id="chatBody"><div class="chat-list" id="chatMsgs"></div></div>' +
      '<footer class="chat-bar"><div class="chat-bar__in">' +
      '<div class="chat-field"><textarea id="chatInput" rows="1" placeholder="اسأل Shady AI" dir="auto" aria-label="رسالة"></textarea>' +
      '<button type="button" class="chat-send" id="chatSend" aria-label="إرسال">' + SEND + '</button></div>' +
      '<div class="chat-note">الردود بتتعمل بالذكاء الاصطناعي وممكن تحتوي على أخطاء — راجع المهم مع المدرس. المحادثات محفوظة على جهازك بس.</div>' +
      '</div></footer>' +
      '<div class="chat-toast" id="chatToast" hidden></div>' +
      '</main></div>';
    document.body.appendChild(ov);
    els = {
      app: $("#chatApp", ov), main: $("#chatMain", ov), body: $("#chatBody", ov), list: $("#chatMsgs", ov),
      input: $("#chatInput", ov), send: $("#chatSend", ov), toast: $("#chatToast", ov),
      hist: $("#chatHist", ov), search: $("#chatSearch", ov)
    };

    $("#chatClose", ov).addEventListener("click", function () { close(true); });
    $("#chatExit", ov).addEventListener("click", function () { close(true); });
    $("#chatMenu", ov).addEventListener("click", function () { setSide(els.app.dataset.side !== "open"); });
    $("#chatSideClose", ov).addEventListener("click", function () { setSide(false); });
    $("#chatScrim", ov).addEventListener("click", function () { setSide(false); });
    $("#chatNew", ov).addEventListener("click", newChat);
    $("#chatNew2", ov).addEventListener("click", newChat);
    els.search.addEventListener("input", function () { if (S) { S.q = els.search.value; renderHist(); } });
    els.send.addEventListener("click", function () { if (S && S.busy) stop(); else sendText(); });
    els.input.addEventListener("input", autosize);
    els.input.addEventListener("keydown", function (e) {
      if (e.key === "Enter" && !e.shiftKey && window.matchMedia("(pointer:fine)").matches) { e.preventDefault(); sendText(); }
    });
    document.addEventListener("keydown", function (e) { if (e.key === "Escape" && ov && !ov.hidden) close(true); });
    window.addEventListener("popstate", function () { if (ov && !ov.hidden) close(false); });
  }

  function setSide(open) { els.app.dataset.side = open ? "open" : "closed"; }
  function autosize() {
    var t = els.input;
    t.style.height = "auto";
    t.style.height = Math.min(t.scrollHeight, 140) + "px";
  }
  var toastT = null;
  function toast(msg) {
    /* إشعار المنصة الموحّد؛ والقديم بس احتياطي لو shared.js ما اتحمّلش */
    if (window.snDialog && window.snDialog.toast) { window.snDialog.toast(msg, { ms: 2400 }); return; }
    els.toast.textContent = msg; els.toast.hidden = false;
    clearTimeout(toastT);
    toastT = setTimeout(function () { els.toast.hidden = true; }, 2600);
  }
  function scrollDown(force) {
    var b = els.body;
    if (force || b.scrollHeight - b.scrollTop - b.clientHeight < 160) b.scrollTop = b.scrollHeight;
  }
  function copyText(t) {
    function fallback() {
      var ta = document.createElement("textarea");
      ta.value = t; ta.style.position = "fixed"; ta.style.opacity = "0";
      document.body.appendChild(ta); ta.select();
      try { document.execCommand("copy"); toast("اتنسخ ✓"); } catch (e) { toast("تعذر النسخ."); }
      ta.remove();
    }
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(t).then(function () { toast("اتنسخ ✓"); }, fallback);
    else fallback();
  }

  /* ---------- القايمة الجانبية ---------- */
  function renderHist() {
    var q = (S.q || "").trim().toLowerCase();
    var items = S.chats.filter(function (c) {
      if (!q) return true;
      return c.title.toLowerCase().indexOf(q) !== -1 || c.msgs.some(function (m) { return m.content.toLowerCase().indexOf(q) !== -1; });
    });
    els.hist.innerHTML = "";
    if (!items.length) {
      var e = document.createElement("div");
      e.className = "chat-hist__empty";
      e.textContent = q ? "مفيش نتايج." : "لسه مفيش محادثات.";
      els.hist.appendChild(e);
      return;
    }
    items.forEach(function (c) {
      var row = document.createElement("div");
      row.className = "chat-h" + (S.cur && S.cur.id === c.id ? " is-active" : "");
      var b = document.createElement("button");
      b.type = "button"; b.className = "chat-h__t"; b.textContent = c.title || "محادثة";
      b.setAttribute("dir", "auto");
      b.addEventListener("click", function () { openChat(c.id); });
      var x = document.createElement("button");
      x.type = "button"; x.className = "chat-h__x"; x.innerHTML = TRASH;
      x.setAttribute("aria-label", "مسح المحادثة"); x.title = "مسح المحادثة";
      x.addEventListener("click", function (ev) { ev.stopPropagation(); removeChat(c.id); });
      row.appendChild(b); row.appendChild(x);
      els.hist.appendChild(row);
    });
  }

  function newChat() {
    if (!S) return;
    if (S.busy) { stop(); S.req = null; setBusy(false); }
    if (!(S.cur && !S.cur.msgs.length)) S.cur = { id: uid(), title: "", at: Date.now(), msgs: [] };
    S.q = ""; els.search.value = "";
    render(); renderHist();
    if (!isDesktop()) setSide(false);
    if (window.matchMedia("(pointer:fine)").matches) els.input.focus();
  }
  function openChat(id) {
    if (!S) return;
    var c = S.chats.filter(function (x) { return x.id === id; })[0];
    if (!c) return;
    if (S.busy) { stop(); S.req = null; setBusy(false); }
    S.cur = c;
    render(); renderHist(); scrollDown(true);
    if (!isDesktop()) setSide(false);
  }
  async function removeChat(id) {
    if (!S) return;
    var ok = window.snDialog
      ? await window.snDialog.confirm({ icon: "trash", tone: "danger", title: "مسح المحادثة", message: "هتتمسح المحادثة دي من على جهازك.", confirmText: "مسح", cancelText: "إلغاء" })
      : window.confirm("تمسح المحادثة دي من على جهازك؟");
    if (!ok || !S) return;
    var wasCur = S.cur && S.cur.id === id;
    if (wasCur && S.busy) { stop(); S.req = null; setBusy(false); }
    S.chats = S.chats.filter(function (c) { return c.id !== id; });
    save();
    if (wasCur) { S.cur = { id: uid(), title: "", at: Date.now(), msgs: [] }; render(); }
    renderHist();
  }

  /* ---------- شاشة المحادثة ---------- */
  function hero() {
    var firstName = S.name ? String(S.name).trim().split(/\s+/)[0] : "";
    var d = document.createElement("div");
    d.className = "chat-hero";
    d.innerHTML = '<div class="chat-hero__orb">' + SPARK + "</div>" +
      "<h3>أهلاً " + esc(firstName) + " 👋</h3>" +
      "<h2>نبدأ منين؟</h2>" +
      '<div class="chat-chips"></div>';
    var chips = $(".chat-chips", d);
    SUGGESTIONS.forEach(function (t) {
      var b = document.createElement("button");
      b.type = "button"; b.className = "chat-chip"; b.textContent = t;
      b.addEventListener("click", function () { send(t); });
      chips.appendChild(b);
    });
    return d;
  }

  function rowFor(m, opts) {
    opts = opts || {};
    var me = m.role === "user";
    var row = document.createElement("div");
    row.className = "chat-row " + (me ? "chat-row--me" : "chat-row--ai") + (m.err ? " chat-row--err" : "");
    row.dataset.id = m.id;
    var bubble = document.createElement("div");
    bubble.className = "chat-bubble";
    var text = document.createElement("div");
    text.className = "chat-text";
    text.setAttribute("dir", "auto");
    if (me) text.innerHTML = renderMd(m.content).replace(/^<p>|<\/p>$/g, "");
    else text.innerHTML = renderMd(m.content);
    bubble.appendChild(text);
    if (!me && !opts.typing && !m.err) {
      var act = document.createElement("div");
      act.className = "chat-actions";
      var cp = document.createElement("button");
      cp.type = "button"; cp.className = "chat-copy"; cp.setAttribute("aria-label", "نسخ"); cp.title = "نسخ"; cp.innerHTML = COPY;
      cp.addEventListener("click", function () { copyText(m.content); });
      act.appendChild(cp);
      bubble.appendChild(act);
    }
    if (!me) {
      var av = document.createElement("span");
      av.className = "chat-mini"; av.innerHTML = SPARK;
      row.appendChild(av);
    }
    row.appendChild(bubble);
    return row;
  }

  function render() {
    var empty = !S.cur.msgs.length;
    els.main.classList.toggle("is-empty", empty);
    els.list.innerHTML = "";
    if (empty) { els.list.appendChild(hero()); return; }
    S.cur.msgs.forEach(function (m) {
      var row = rowFor(m);
      if (m.err) addRetry(row, m);
      els.list.appendChild(row);
    });
  }

  function addRetry(row, m) {
    var bubble = $(".chat-bubble", row);
    if (!bubble) return;
    var b = document.createElement("button");
    b.type = "button"; b.className = "chat-retry"; b.textContent = "حاول تاني";
    b.addEventListener("click", function () {
      if (!S || S.busy) return;
      var chat = S.cur;
      chat.msgs = chat.msgs.filter(function (x) { return x.id !== m.id; });
      save(); render(); ask();
    });
    bubble.appendChild(b);
  }

  function setBusy(b) {
    S.busy = b;
    els.send.innerHTML = b ? STOP : SEND;
    if (b) els.send.setAttribute("data-stop", "1"); else els.send.removeAttribute("data-stop");
    els.send.setAttribute("aria-label", b ? "إيقاف" : "إرسال");
  }

  /* ======================= الإرسال والـ AI ======================= */
  function systemPrompt() {
    return "You are \"Shady AI\", a friendly and expert English-language tutor inside the Mr. Shady Nasr learning platform for Egyptian school students. " +
      "The student's name is " + (S.name || "the student") + ". " +
      "Reply in simple Egyptian Arabic (عامية مصرية بسيطة) and use English for examples, vocabulary and corrections, unless the student writes entirely in English — then answer in English. " +
      "Explain step by step with short clear examples. When correcting a sentence, show the corrected version and briefly say why. " +
      "Keep answers concise and well formatted (short paragraphs, bullet points, **bold** for key terms). " +
      "Stay focused on learning, especially English; politely redirect unrelated or inappropriate requests. " +
      "Do not do the student's entire homework silently — guide them and explain. Never invent facts about the teacher, grades or the platform.";
  }

  function sendText() {
    var v = els.input.value.trim();
    if (!v) return;
    els.input.value = ""; autosize();
    send(v);
  }

  function send(text) {
    if (!S || S.busy) return;
    text = String(text || "").trim();
    if (!text) return;
    if (text.length > 4000) { toast("الرسالة طويلة قوي — اختصرها شوية."); return; }
    var chat = S.cur;
    if (!chat.msgs.length) {
      chat.title = titleOf(text);
      if (S.chats.indexOf(chat) === -1) S.chats.unshift(chat);
    }
    chat.msgs.push({ id: uid(), role: "user", content: text, at: Date.now() });
    chat.at = Date.now();
    save(); render(); renderHist(); scrollDown(true);
    ask();
  }

  function stop() { if (S && S.ctrl) S.ctrl.abort(); }

  function ask() {
    var sess = S, chat = S.cur;
    var history = chat.msgs.filter(function (m) { return !m.err; }).slice(-CONTEXT).map(function (m) { return { role: m.role, content: m.content }; });
    var base = [{ role: "system", content: systemPrompt() }].concat(history);

    var m = { id: uid(), role: "assistant", content: "", at: Date.now() };
    var row = rowFor(m, { typing: true });
    var textEl = $(".chat-text", row);
    textEl.innerHTML = '<span class="chat-typing" aria-label="بيكتب"><i></i><i></i><i></i></span>';
    els.list.appendChild(row);
    scrollDown(true);

    var token = uid();
    sess.req = token;
    sess.ctrl = new AbortController();
    setBusy(true);
    var got = false, finished = false;
    var active = function () { return S === sess && sess.cur === chat; };

    function finish(errMsg) {
      if (finished) return; finished = true;
      var mine = sess.req === token;
      if (mine) { sess.ctrl = null; sess.req = null; if (S === sess) setBusy(false); }
      if (errMsg && !m.content) { m.content = errMsg; m.err = true; }
      if (!m.content) { if (active()) row.remove(); return; }
      m.at = Date.now();
      chat.msgs.push(m);
      chat.at = Date.now();
      if (sess.chats.indexOf(chat) === -1) { if (!chat.title) chat.title = titleOf(chat.msgs[0] && chat.msgs[0].content); sess.chats.unshift(chat); }
      persist(sess.id, sess.chats);
      if (active()) { render(); scrollDown(true); }
      if (S === sess) renderHist();
    }

    function request(i) {
      var cfg = MODELS[i];
      var payload = { model: cfg.id, messages: base, temperature: 0.6, max_completion_tokens: 2000, stream: true };
      Object.keys(cfg.extra).forEach(function (k) { payload[k] = cfg.extra[k]; });
      return fetch(GROQ_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": "Bearer " + GROQ_API_KEY },
        body: JSON.stringify(payload),
        signal: sess.ctrl.signal
      }).then(function (res) {
        if (res.ok) { modelIdx = i; return res; }
        // الموديل مش متاح / الباراميتر مرفوض: نجرّب اللي بعده
        if ([400, 404, 410, 422].indexOf(res.status) !== -1 && i + 1 < MODELS.length) return request(i + 1);
        return res.text().then(function (body) {
          try { console.warn("[Shady AI] Groq error", res.status, body); } catch (e) { /* ignore */ }
          var msg = res.status === 429 ? "في ضغط كبير دلوقتي، استنى لحظات وجرّب تاني." :
            (res.status === 401 || res.status === 403) ? "مشكلة في إعدادات المساعد (المفتاح). بلّغ المدرس." :
            "حصلت مشكلة وأنا بجهّز الرد. جرّب تاني.";
          throw { friendly: msg };
        });
      });
    }

    request(modelIdx).then(function (res) {
      var reader = res.body.getReader(), dec = new TextDecoder(), buf = "";
      function pump() {
        return reader.read().then(function (r) {
          if (r.done) return;
          buf += dec.decode(r.value, { stream: true });
          var lines = buf.split("\n"); buf = lines.pop();
          lines.forEach(function (ln) {
            ln = ln.trim();
            if (ln.indexOf("data:") !== 0) return;
            var d = ln.slice(5).trim();
            if (!d || d === "[DONE]") return;
            try {
              var j = JSON.parse(d), t = j.choices && j.choices[0] && j.choices[0].delta && j.choices[0].delta.content;
              if (t) {
                got = true; m.content += t;
                if (active()) { textEl.innerHTML = renderMd(m.content); textEl.classList.add("chat-caret"); scrollDown(false); }
              }
            } catch (e) { /* سطر ناقص */ }
          });
          return pump();
        });
      }
      return pump();
    }).then(function () {
      textEl.classList.remove("chat-caret");
      finish(got ? null : "ملقيتش رد. جرّب تاني.");
    }).catch(function (e) {
      if (e && e.name === "AbortError") { finish(null); return; }
      finish((e && e.friendly) || "تعذر الاتصال بالمساعد. اتأكد من النت وجرّب تاني.");
    });
  }

  /* ======================= فتح / قفل ======================= */
  function open(sess) {
    build();
    if (!ov.hidden) return;
    var name = sess.fullName || sess.name || "";
    S = { id: sess.id, name: name, chats: loadChats(sess.id), cur: { id: uid(), title: "", at: Date.now(), msgs: [] }, busy: false, ctrl: null, req: null, q: "" };
    $("#chatUserName", ov).textContent = name || "حسابي";
    $("#chatUserAv", ov).textContent = (String(name).trim().charAt(0) || "؟");
    els.search.value = "";
    setSide(isDesktop());
    render(); renderHist();
    ov.hidden = false;
    document.documentElement.classList.add("chat-lock");
    try { history.pushState({ snchat: 1 }, ""); S.pushed = true; } catch (e) { /* ignore */ }
    setBusy(false);
    setTimeout(function () { scrollDown(true); if (window.matchMedia("(pointer:fine)").matches) els.input.focus(); }, 40);
  }

  function close(viaUi) {
    if (!ov || ov.hidden) return;
    if (S && S.ctrl) S.ctrl.abort();
    ov.hidden = true;
    document.documentElement.classList.remove("chat-lock");
    var pushed = S && S.pushed;
    S = null;
    if (viaUi && pushed) { try { history.back(); } catch (e) { /* ignore */ } }
  }

  var ready = false;
  function initStudent() {
    var fab = document.getElementById("chatFab");
    if (!fab || ready) return;
    ready = true;
    var s = session();
    if (!s || s.role === "admin") { fab.hidden = true; return; }
    fab.setAttribute("aria-label", "اسأل " + AI_NAME);
    fab.addEventListener("click", function () { var cur = session(); if (cur) open(cur); });
  }

  /* صفحة الأدمن مبقاش فيها شات — الدوال دي فاضية عشان أي استدعاء قديم ميعملش error */
  window.SNChat = { initAdminList: function () { }, refreshList: function () { }, openAdmin: function () { } };

  document.addEventListener("DOMContentLoaded", initStudent);
  if (document.readyState !== "loading") initStudent();
})();

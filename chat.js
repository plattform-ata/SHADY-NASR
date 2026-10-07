/* ==========================================================================
   chat.js — محادثات لحظية بين الطالب والأدمن (Firebase Realtime Database)
   --------------------------------------------------------------------------
   الهيكل في قاعدة البيانات:
     chatMeta/{studentId}      = { name, lastText, lastAt, lastFrom, unreadAdmin, unreadStudent,
                                    adminReadAt, studentReadAt }        (خفيفة، قايمة المحادثات)
     chatMessages/{studentId}/{msgId} = { id, from: "student"|"admin", text?, at, file?: {name,type,size} }
     chatFiles/{studentId}/{msgId}    = data URL للملف (بيتحمّل لما الرسالة تظهر/يتضغط عليها)

   الاستخدام:
     - صفحة الطالب: زرار id="chatFab" (بيتفعّل تلقائيًا).
     - صفحة الأدمن: SNChat.initAdminList({ listEl, searchEl, getUser, getSubtitle, onProfile, onTotal })
   ========================================================================== */
(function () {
  "use strict";
  if (typeof firebase === "undefined") return;

  var ADMIN_NAME = "Mr. Shady Nasr";
  var ADMIN_PHOTO = "shady-nasr.jpg";
  var ADMIN_SUB = "مدرس اللغة الإنجليزية";
  var WELCOME = "أهلاً 👋 أساعدك إزاي؟";
  var PAGE = 25; // عدد الرسايل في كل دفعة (آخر دفعة الأول، وكل ما تطلع لفوق تتحمّل دفعة أقدم)
  var MAX_BYTES = 9 * 1024 * 1024;
  var STORE_MIN = 3 * 1024 * 1024;    // الملفات (غير الصور) الأكبر من كده بتتخزّن في Firebase Storage
  var STORE_MAX = 100 * 1024 * 1024;  // أقصى حجم في Storage // حد الملف الواحد (Base64 جوّه Realtime Database)

  var REPLY_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 14 4 9l5-5"/><path d="M4 9h10a6 6 0 0 1 6 6v3"/></svg>';
  function db() { return firebase.database(); }
  function TS() { return firebase.database.ServerValue.TIMESTAMP; }
  function $(s, r) { return (r || document).querySelector(s); }
  function esc(v) { return String(v == null ? "" : v).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function validPhoto(u) { return typeof u === "string" && u.length < 250000 && /^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(u); }
  function initial(n) { return n ? String(n).trim().charAt(0).toUpperCase() : "?"; }
  function fmtTime(ts) { return new Date(ts).toLocaleTimeString("ar-EG", { hour: "numeric", minute: "2-digit" }); }
  function dayKey(ts) { var d = new Date(ts); return d.getFullYear() + "-" + d.getMonth() + "-" + d.getDate(); }
  function dayDiff(ts) {
    var d = new Date(ts), n = new Date();
    return Math.round((new Date(n.getFullYear(), n.getMonth(), n.getDate()) - new Date(d.getFullYear(), d.getMonth(), d.getDate())) / 864e5);
  }
  function dayLabel(ts) {
    var k = dayDiff(ts);
    if (k === 0) return "اليوم";
    if (k === 1) return "إمبارح";
    return new Date(ts).toLocaleDateString("ar-EG", { day: "numeric", month: "long", year: "numeric" });
  }
  function listTime(ts) {
    var k = dayDiff(ts);
    if (k === 0) return fmtTime(ts);
    if (k === 1) return "إمبارح";
    return new Date(ts).toLocaleDateString("ar-EG", { day: "numeric", month: "numeric", year: "2-digit" });
  }
  function fmtSize(b) {
    b = Number(b) || 0;
    if (b < 1024) return b + " B";
    if (b < 1048576) return (b / 1024).toFixed(0) + " KB";
    return (b / 1048576).toFixed(1) + " MB";
  }
  function kindOf(type) {
    type = String(type || "");
    if (type.indexOf("image/") === 0) return "image";
    if (type.indexOf("video/") === 0) return "video";
    if (type.indexOf("audio/") === 0) return "audio";
    return "file";
  }
  function previewOf(m) {
    if (m.file) {
      var k = kindOf(m.file.type);
      return k === "image" ? "📷 صورة" : k === "video" ? "🎥 فيديو" : k === "audio" ? (/^voice-/.test(m.file.name || "") ? "🎤 رسالة صوتية" : "🎵 صوت") : "📎 " + (m.file.name || "ملف");
    }
    return m.text || "";
  }
  function linkify(escaped) {
    return escaped.replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>').replace(/\n/g, "<br>");
  }
  var TICK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path class="c1" d="M3.5 12.5l4.5 4.5L17 8"/><path class="c2" d="M10 15.5l1.5 1.5L21 7.5"/></svg>';

  /* ======================= نافذة المحادثة ======================= */
  var ov = null, els = {}, st = null;

  function build() {
    if (ov) return;
    ov = document.createElement("div");
    ov.className = "chat-ov";
    ov.hidden = true;
    ov.setAttribute("role", "dialog");
    ov.setAttribute("aria-modal", "true");
    ov.innerHTML =
      '<div class="chat-shell">' +
      '<header class="chat-head">' +
      '<button type="button" class="chat-back" aria-label="رجوع"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg></button>' +
      '<button type="button" class="chat-peer"><span class="chat-av" id="chatPeerAv"></span><span class="chat-peer__t"><strong id="chatPeerName"></strong><small id="chatPeerSub"></small></span></button>' +
      "</header>" +
      '<div class="chat-body" id="chatBody"><div class="chat-list" id="chatMsgs"></div>' +
      '<div class="chat-down-wrap"><button type="button" class="chat-down" id="chatDown" aria-label="النزول لآخر الرسائل" hidden><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg></button></div></div>' +
      '<div class="chat-pend" id="chatPend" hidden><span class="chat-spin"></span><span>جاري إرسال الملف…</span></div>' +
      '<div class="chat-reply" id="chatReply" hidden><span class="chat-reply__t"><strong id="chatReplyName"></strong><span id="chatReplyTxt" dir="auto"></span></span><button type="button" class="chat-reply__x" aria-label="إلغاء الرد"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18"/></svg></button></div>' +
      '<footer class="chat-bar">' +
      '<div class="chat-rec" id="chatRec" hidden><button type="button" class="chat-rec__cancel" aria-label="إلغاء التسجيل"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3"/></svg></button><span class="chat-rec__dot"></span><span class="chat-rec__time" id="chatRecT">0:00</span><span class="chat-rec__hint">بيسجّل…</span></div>' +
      '<div class="chat-field">' +
      '<button type="button" class="chat-attach" aria-label="إرفاق ملف"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m21.4 11.1-9.2 9.2a6 6 0 0 1-8.5-8.5l9.2-9.2a4 4 0 0 1 5.7 5.7l-9.2 9.2a2 2 0 0 1-2.8-2.8l8.5-8.5"/></svg></button>' +
      '<textarea id="chatInput" rows="1" placeholder="اكتب رسالة" dir="auto" aria-label="رسالة"></textarea>' +
      "</div>" +
      '<button type="button" class="chat-send chat-mic" id="chatMic" aria-label="تسجيل رسالة صوتية" hidden><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/></svg></button>' +
      '<button type="button" class="chat-send" aria-label="إرسال"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 2 11 13M22 2l-7 20-4-9-9-4 20-7Z"/></svg></button>' +
      "</footer>" +
      '<input type="file" id="chatFile" multiple hidden />' +
      '<input type="file" id="chatGal" accept="image/*,video/*" multiple hidden />' +
      '<input type="file" id="chatCam" accept="image/*" capture="environment" hidden />' +
      '<input type="file" id="chatAud" accept="audio/*" multiple hidden />' +
      '<div class="chat-prev" id="chatPrev" hidden>' +
      '<div class="chat-prev__top"><button type="button" class="chat-prev__x" aria-label="إلغاء"><svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\"><path d=\"M6 6l12 12M18 6 6 18\"/></svg></button><span class="chat-prev__count" id="chatPrevCount"></span><button type="button" class="chat-prev__edit" id="chatPrevEdit" hidden><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg><span>تعديل</span></button></div>' +
      '<div class="chat-prev__stage" id="chatPrevStage"></div>' +
      '<div class="chat-prev__strip" id="chatPrevStrip"></div>' +
      '<div class="chat-prev__bar"><textarea id="chatCap" rows="1" placeholder="اكتب رسالة على الصورة…" dir="auto" aria-label="تعليق"></textarea>' +
      '<button type="button" class="chat-send chat-prev__send" aria-label="إرسال"><svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M22 2 11 13M22 2l-7 20-4-9-9-4 20-7Z\"/></svg><span class="chat-prev__n" id="chatPrevN"></span></button></div>' +
      "</div>" +
      '<div class="chat-sheet" id="chatSheet" hidden><div class="chat-sheet__bg"></div><div class="chat-sheet__box" id="chatSheetBox"></div></div>' +
      '<div class="chat-toast" id="chatToast" hidden></div>' +
      "</div>" +
      '<div class="chat-lightbox" id="chatLightbox" hidden><div class="chat-lightbox__sc"><img alt="" /></div><button type="button" class="chat-lightbox__x" aria-label="إغلاق" data-no-wave-delay>✕</button></div>';
    document.body.appendChild(ov);
    els = {
      body: $("#chatBody", ov), down: $("#chatDown", ov), list: $("#chatMsgs", ov), input: $("#chatInput", ov), file: $("#chatFile", ov), gal: $("#chatGal", ov), cam: $("#chatCam", ov), aud: $("#chatAud", ov), sheet: $("#chatSheet", ov), sheetBox: $("#chatSheetBox", ov),
      pend: $("#chatPend", ov), rec: $("#chatRec", ov), recT: $("#chatRecT", ov), mic: $("#chatMic", ov), reply: $("#chatReply", ov), replyName: $("#chatReplyName", ov), replyTxt: $("#chatReplyTxt", ov), prev: $("#chatPrev", ov), prevStage: $("#chatPrevStage", ov), prevStrip: $("#chatPrevStrip", ov), prevCount: $("#chatPrevCount", ov), prevN: $("#chatPrevN", ov), cap: $("#chatCap", ov), field: $(".chat-field", ov), toast: $("#chatToast", ov), lb: $("#chatLightbox", ov),
      av: $("#chatPeerAv", ov), name: $("#chatPeerName", ov), sub: $("#chatPeerSub", ov), send: $(".chat-send:not(.chat-mic):not(.chat-prev__send)", ov)
    };

    $(".chat-back", ov).addEventListener("click", closeConv);
    $(".chat-peer", ov).addEventListener("click", function () {
      if (!st || !st.onPeer) return;
      var fn = st.onPeer, sid = st.sid;
      closeConv();
      fn(sid);
    });
    $(".chat-attach", ov).addEventListener("click", openAttach);
    [els.file, els.gal, els.cam, els.aud].forEach(function (inp) {
      inp.addEventListener("change", function () {
        var fs = Array.prototype.slice.call(inp.files || []);
        inp.value = "";
        if (fs.length) stage(fs);
      });
    });
    $(".chat-sheet__bg", ov).addEventListener("click", function () { if (Date.now() - sheetAt < 450) return; closeSheet(); });
    $(".chat-prev__x", ov).addEventListener("click", clearStage);
    $(".chat-prev__send", ov).addEventListener("click", sendStaged);
    els.prevEdit = $("#chatPrevEdit", ov);
    els.prevEdit.addEventListener("click", function () {
      var S = st;
      if (!S || !S.staged || !S.staged[S.sel] || S.staged[S.sel].k !== "image") return;
      var cur = S.staged[S.sel];
      if (S.staged[S.sel]) cur.cap = els.cap.value;
      openImageEditor(cur, function (nf) {
        if (st !== S || S.staged.indexOf(cur) < 0) return;
        try { URL.revokeObjectURL(cur.url); } catch (e) { /* ignore */ }
        cur.f = nf; cur.url = URL.createObjectURL(nf);
        renderPrev();
      });
    });
    els.cap.addEventListener("input", function () {
      if (st && st.staged && st.staged[st.sel]) st.staged[st.sel].cap = els.cap.value;
      els.cap.style.height = "auto";
      els.cap.style.height = Math.min(els.cap.scrollHeight || 44, 96) + "px";
    });
    els.cap.addEventListener("keydown", function (e) {
      if (e.key === "Enter" && !e.shiftKey && window.matchMedia("(pointer:fine)").matches) { e.preventDefault(); sendStaged(); }
    });
    els.send.addEventListener("click", function () { if (st && st.rec) finishRec(true); else sendText(); });
    els.mic.addEventListener("click", startRec);
    $(".chat-reply__x", ov).addEventListener("click", clearReply);
    $(".chat-rec__cancel", ov).addEventListener("click", function () { finishRec(false); });
    els.input.addEventListener("input", function () { autosize(); updateBtns(); onTyping(); });
    els.input.addEventListener("keydown", function (e) {
      if (e.key === "Enter" && !e.shiftKey && window.matchMedia("(pointer:fine)").matches) { e.preventDefault(); sendText(); }
    });
    els.lb.addEventListener("click", function (e) {
      var im = $("img", els.lb);
      if (e.target === im) { els.lb.classList.toggle("is-zoomed"); return; } /* دوسة على الصورة = تكبير/تصغير */
      e.preventDefault(); e.stopPropagation();
      closeLb();
    });
    /* بعد قفل معاينة الصورة بنتجاهل أي دوسة تانية بره المحادثة لحظة صغيرة، عشان متتفتحش حاجة من ورا الـ X */
    document.addEventListener("click", function (e) {
      if (lbClosedAt && Date.now() - lbClosedAt < 450 && ov && !ov.contains(e.target)) { e.stopPropagation(); e.preventDefault(); }
    }, true);
    els.body.addEventListener("scroll", function () { updateDown(); if (st && !st.initial && els.body.scrollTop < 160) loadOlder(st); }, { passive: true });
    els.down.addEventListener("click", function () {
      var b = els.body;
      try { b.scrollTo({ top: b.scrollHeight, behavior: "smooth" }); } catch (e) { b.scrollTop = b.scrollHeight; }
    });
    document.addEventListener("keydown", function (e) {
      if (e.key !== "Escape" || !st) return;
      if (edClose) edClose(false);
      else if (!els.sheet.hidden) closeSheet();
      else if (!els.lb.hidden) closeLb();
      else if (st.staged && st.staged.length) clearStage();
      else closeConv();
    });
    window.addEventListener("popstate", function () {
      if (st && st.pushed) { st.pushed = false; closeConv(); }
    });
    document.addEventListener("visibilitychange", function () { if (st && document.visibilityState === "visible") markRead(); });
  }

  function autosize() {
    var t = els.input;
    t.style.height = "auto";
    var sh = t.scrollHeight;
    if (!sh) { t.style.height = ""; return; } /* النافذة لسه مخفية */
    t.style.height = Math.min(sh, 120) + "px";
    t.style.overflowY = sh > 120 ? "auto" : "hidden";
  }
  /* --- "بيكتب…" / "بيسجّل…" --- */
  function quiet(p) { if (p && p.catch) p.catch(function () { }); }
  function setMyState(S, v) {
    if (!S || !S.myTypRef || S.myState === v) return;
    S.myState = v;
    try {
      if (v) { quiet(S.myTypRef.set(v)); quiet(S.myTypRef.onDisconnect().remove()); }
      else quiet(S.myTypRef.remove());
    } catch (e) { /* ignore */ }
  }
  function onTyping() {
    var S = st;
    if (!S) return;
    clearTimeout(S.typTimer);
    if (els.input.value.trim()) {
      setMyState(S, "t");
      S.typTimer = setTimeout(function () { setMyState(S, null); }, 3000);
    } else setMyState(S, null);
  }
  function showPeerState(v) {
    var S = st;
    if (!S) return;
    var kind = v === "rec" ? "rec" : v ? "t" : null;
    if (!kind) {
      if (S.liveRow && S.liveRow.parentNode) S.liveRow.parentNode.removeChild(S.liveRow);
      S.liveRow = null; S.liveKind = null;
      return;
    }
    if (S.liveKind === kind && S.liveRow && S.liveRow.parentNode === els.list) return;
    if (S.liveRow && S.liveRow.parentNode) S.liveRow.parentNode.removeChild(S.liveRow);
    var r = document.createElement("div");
    r.className = "chat-live chat-msg chat-msg--them";
    r.innerHTML = kind === "rec"
      ? '<div class="chat-bubble chat-bubble--live" aria-label="بيسجّل رسالة صوتية"><span class="chat-live__mic">' + MIC_SVG + "</span></div>"
      : '<div class="chat-bubble chat-bubble--live" aria-label="بيكتب"><span class="chat-live__dots"><i></i><i></i><i></i></span></div>';
    els.list.appendChild(r);
    S.liveRow = r; S.liveKind = kind;
    scrollDown(false);
  }

  /* --- الرد على رسالة --- */
  function peerLabel(S, from) { return from === S.role ? "أنت" : (S.peerName || (S.role === "admin" ? "الطالب" : ADMIN_NAME)); }
  function startReply(m) {
    var S = st;
    if (!S || !m || !m.id) return;
    var snip = String(previewOf(m)).replace(/\s+/g, " ").slice(0, 100);
    S.reply = { id: m.id, from: m.from, text: snip };
    els.replyName.textContent = peerLabel(S, m.from);
    els.replyTxt.textContent = snip;
    els.reply.hidden = false;
    els.input.focus();
  }
  function clearReply() { if (st) st.reply = null; if (els.reply) els.reply.hidden = true; }
  function takeReply(S) {
    var r = S.reply || null;
    S.reply = null;
    if (st === S) els.reply.hidden = true;
    return r;
  }
  function jumpTo(id) {
    var el = els.list.querySelector('.chat-msg[data-id="' + id + '"]');
    if (!el) { toast("الرسالة الأصلية قديمة — اطلع لفوق عشان تتحمّل."); return; }
    el.scrollIntoView({ block: "center", behavior: "smooth" });
    el.classList.add("is-flash");
    setTimeout(function () { el.classList.remove("is-flash"); }, 1500);
  }
  /* السحب على الرسالة للجنب = رد (زي واتساب) */
  function bindSwipe(row, m) {
    var b = $(".chat-bubble", row);
    var ico = document.createElement("span");
    ico.className = "chat-swipe-ico";
    ico.innerHTML = REPLY_SVG;
    row.appendChild(ico);
    var TH = 56, MAX = 84, sx = 0, sy = 0, dx = 0, on = false, lock = false, hit = false;
    function reset() {
      on = false; lock = false; hit = false; dx = 0;
      b.style.transition = "transform .18s ease";
      b.style.transform = "";
      ico.style.opacity = "0";
    }
    b.addEventListener("pointerdown", function (e) {
      if (e.pointerType === "mouse") return;
      on = true; lock = false; hit = false; dx = 0;
      sx = e.clientX; sy = e.clientY;
      b.style.transition = "none";
    });
    b.addEventListener("pointermove", function (e) {
      if (!on) return;
      var mx = e.clientX - sx, my = e.clientY - sy;
      if (!lock) {
        if (Math.abs(my) > 10 && Math.abs(my) > Math.abs(mx)) { reset(); return; } /* ده سكرول عادي */
        if (Math.abs(mx) > 10 && Math.abs(mx) > Math.abs(my)) lock = true; else return;
      }
      dx = Math.max(-MAX, Math.min(MAX, mx));
      b.style.transform = "translateX(" + dx + "px)";
      ico.style.left = dx > 0 ? "8px" : "auto";
      ico.style.right = dx < 0 ? "8px" : "auto";
      ico.style.opacity = String(Math.min(1, Math.abs(dx) / TH));
      if (!hit && Math.abs(dx) >= TH) { hit = true; try { if (navigator.vibrate) navigator.vibrate(12); } catch (er) { /* ignore */ } }
      else if (hit && Math.abs(dx) < TH) hit = false;
    });
    b.addEventListener("pointerup", function () {
      if (on && lock) { row._sw = true; if (Math.abs(dx) >= TH) startReply(m); }
      reset();
    });
    b.addEventListener("pointercancel", reset);
    row.addEventListener("click", function (e) { if (row._sw) { row._sw = false; e.stopPropagation(); e.preventDefault(); } }, true);
  }

  /* --- معاينة الملفات قبل الإرسال (تعليق + زرار تأكيد) --- */
  function stage(fs) {
    var S = st;
    if (!S) return;
    S.staged = S.staged || [];
    var first = S.staged.length;
    fs.forEach(function (f) {
      var k = kindOf(f.type);
      if (k !== "image" && f.size > MAX_BYTES) { toast((k === "video" ? "الفيديو" : "الملف") + " حجمه " + fmtSize(f.size) + " — الحد الأقصى " + fmtSize(MAX_BYTES) + ". اختار أصغر أو قصّره."); return; }
      S.staged.push({ f: f, k: k, cap: "", url: (k === "image" || k === "video") ? URL.createObjectURL(f) : "" });
    });
    if (S.staged.length > first) {
      S.sel = first;
      renderPrev();
      els.prev.hidden = false;
      if (window.matchMedia("(pointer:fine)").matches) setTimeout(function () { els.cap.focus(); }, 50);
    }
  }
  function extOf(n) {
    var m = /\.([A-Za-z0-9]{1,5})$/.exec(n || "");
    return m ? m[1].toUpperCase() : "";
  }
  function fileCard(it) {
    var d = document.createElement("div");
    d.className = "chat-prev__file";
    d.innerHTML = '<span class="chat-prev__fico">' + (it.k === "audio" ? "🎵" : it.k === "video" ? "🎥" : "📄") + '</span><strong dir="auto">' + esc(it.f.name || "ملف") + "</strong><small>" + esc(fmtSize(it.f.size)) + "</small>";
    return d;
  }
  function renderPrev() {
    var S = st;
    if (!S || !S.staged || !S.staged.length) { clearStage(); return; }
    if (S.sel >= S.staged.length) S.sel = S.staged.length - 1;
    var cur = S.staged[S.sel];
    els.cap.value = cur.cap || "";
    els.cap.style.height = "auto";
    els.cap.style.height = Math.min(els.cap.scrollHeight || 48, 96) + "px";
    els.prevEdit.hidden = cur.k !== "image";
    els.prevStage.innerHTML = "";
    if (cur.k === "image") {
      var img = document.createElement("img");
      img.alt = "";
      img.src = cur.url;
      img.onerror = function () { els.prevStage.innerHTML = ""; els.prevStage.appendChild(fileCard(cur)); };
      els.prevStage.appendChild(img);
    } else if (cur.k === "video") {
      var v = document.createElement("video");
      v.src = cur.url; v.controls = true; v.setAttribute("playsinline", "");
      els.prevStage.appendChild(v);
    } else els.prevStage.appendChild(fileCard(cur));
    els.prevCount.textContent = S.staged.length > 1 ? (S.sel + 1) + " / " + S.staged.length : "";
    els.prevN.textContent = String(S.staged.length);
    els.prevStrip.innerHTML = "";
    S.staged.forEach(function (it, i) {
      var b = document.createElement("button");
      b.type = "button";
      b.className = "chat-prev__th" + (i === S.sel ? " is-sel" : "");
      if (it.k === "image") { var im = document.createElement("img"); im.alt = ""; im.src = it.url; b.appendChild(im); }
      else if (it.k === "video") {
        var tv = document.createElement("video");
        tv.src = it.url + "#t=0.1"; tv.muted = true; tv.preload = "metadata"; tv.setAttribute("playsinline", "");
        b.appendChild(tv);
        var pl = document.createElement("span");
        pl.className = "chat-prev__play"; pl.textContent = "▶";
        b.appendChild(pl);
      } else {
        b.textContent = it.k === "audio" ? "🎵" : extOf(it.f.name) || "📎";
        if (it.k !== "audio") b.classList.add("chat-prev__ext");
      }
      b.addEventListener("click", function () { S.sel = i; renderPrev(); });
      var rm = document.createElement("span");
      rm.className = "chat-prev__rm"; rm.textContent = "×"; rm.setAttribute("role", "button"); rm.setAttribute("aria-label", "حذف");
      rm.addEventListener("click", function (e) {
        e.stopPropagation();
        if (it.url) { try { URL.revokeObjectURL(it.url); } catch (x) { /* ignore */ } }
        S.staged.splice(i, 1);
        if (S.sel > i || S.sel >= S.staged.length) S.sel = Math.max(0, S.sel - 1);
        renderPrev();
      });
      b.appendChild(rm);
      els.prevStrip.appendChild(b);
    });
    var add = document.createElement("button");
    add.type = "button"; add.className = "chat-prev__th chat-prev__add"; add.textContent = "+"; add.setAttribute("aria-label", "إضافة المزيد");
    add.addEventListener("click", openAttach);
    els.prevStrip.appendChild(add);
  }
  function clearStage() {
    var S = st;
    if (S && S.staged) S.staged.forEach(function (it) { if (it.url) { try { URL.revokeObjectURL(it.url); } catch (e) { /* ignore */ } } });
    if (S) { S.staged = []; S.sel = 0; }
    if (els.prev) { els.prev.hidden = true; els.prevStage.innerHTML = ""; els.prevStrip.innerHTML = ""; els.cap.value = ""; els.cap.style.height = ""; }
  }
  function sendStaged() {
    var S = st;
    if (!S || !S.staged || !S.staged.length) return;
    if (S.staged[S.sel]) S.staged[S.sel].cap = els.cap.value;
    for (var i = 0; i < S.staged.length; i++) {
      if ((S.staged[i].cap || "").trim().length > 4000) { toast("التعليق طويل قوي (الحد 4000 حرف)."); return; }
    }
    var items = S.staged.slice();
    clearStage();
    items.reduce(function (p, it) { return p.then(function () { return sendFile(it.f, (it.cap || "").trim()); }); }, Promise.resolve());
  }

  /* --- الرسائل الصوتية --- */
  function updateBtns() {
    if (!st) return;
    var canRec = !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia && window.MediaRecorder);
    var rec = !!st.rec, has = !!els.input.value.trim();
    els.field.hidden = rec;
    els.rec.hidden = !rec;
    els.send.hidden = !(rec || has || !canRec);
    els.mic.hidden = !(canRec && !rec && !has);
  }
  function fmtDur(ms) {
    var s = Math.floor(ms / 1000);
    return Math.floor(s / 60) + ":" + ("0" + (s % 60)).slice(-2);
  }
  function stopTracks(R) { try { R.stream.getTracks().forEach(function (t) { t.stop(); }); } catch (e) { /* ignore */ } }
  function startRec() {
    if (!st || st.rec || st.recBusy) return;
    var S = st;
    stopVoice();
    S.recBusy = true;
    navigator.mediaDevices.getUserMedia({ audio: true }).then(function (stream) {
      S.recBusy = false;
      if (st !== S) { stream.getTracks().forEach(function (t) { t.stop(); }); return; }
      var mime = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus"].filter(function (m) {
        return MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(m);
      })[0];
      var mr;
      try { mr = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined); }
      catch (e) { stream.getTracks().forEach(function (t) { t.stop(); }); toast("المتصفح ده مش بيدعم تسجيل الصوت."); return; }
      var R = { mr: mr, stream: stream, chunks: [], start: Date.now(), mime: mr.mimeType || mime || "audio/webm" };
      mr.ondataavailable = function (e) { if (e.data && e.data.size) R.chunks.push(e.data); };
      R.timer = setInterval(function () {
        var d = Date.now() - R.start;
        els.recT.textContent = fmtDur(d);
        if (d >= 5 * 60 * 1000) finishRec(true); /* أقصى مدة 5 دقايق */
      }, 250);
      els.recT.textContent = "0:00";
      S.rec = R;
      mr.start();
      setMyState(S, "rec");
      updateBtns();
    }).catch(function () {
      S.recBusy = false;
      if (st === S) toast("مقدرتش أوصل للمايك. اسمح للموقع باستخدام الميكروفون من إعدادات المتصفح.");
    });
  }
  function abortRec(S) {
    var R = S.rec;
    if (!R) return;
    S.rec = null;
    clearInterval(R.timer);
    setMyState(S, null);
    R.mr.onstop = null;
    try { R.mr.stop(); } catch (e) { /* ignore */ }
    stopTracks(R);
  }
  function finishRec(send) {
    var S = st;
    if (!S || !S.rec) return;
    var R = S.rec, dur = Date.now() - R.start;
    S.rec = null;
    clearInterval(R.timer);
    setMyState(S, null);
    updateBtns();
    R.mr.onstop = function () {
      stopTracks(R);
      if (!send || st !== S) return;
      if (dur < 1000 || !R.chunks.length) { toast("التسجيل قصير قوي — اضغط على المايك وسجّل أطول."); return; }
      var base = String(R.mime).split(";")[0];
      var ext = base.indexOf("mp4") > -1 ? "m4a" : base.indexOf("ogg") > -1 ? "ogg" : "webm";
      var blob = new Blob(R.chunks, { type: base });
      var vf = new File([blob], "voice-" + Date.now() + "." + ext, { type: base });
      vf._dur = dur;
      sendFile(vf);
    };
    try { R.mr.stop(); } catch (e) { stopTracks(R); }
  }


  /* ======================= القوايم السفلية (إرفاق + خيارات الرسالة) ======================= */
  var sheetAt = 0;
  function svgOf(inner) { return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' + inner + "</svg>"; }
  var ICO = {
    img: svgOf('<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.1-3.1a2 2 0 0 0-2.8 0L6 21"/>'),
    cam: svgOf('<path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3z"/><circle cx="12" cy="13" r="3.5"/>'),
    doc: svgOf('<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M9 13h6M9 17h6"/>'),
    aud: svgOf('<path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>'),
    copy: svgOf('<rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>'),
    trash: svgOf('<path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3"/>'),
    ban: svgOf('<circle cx="12" cy="12" r="9"/><path d="m5.6 5.6 12.8 12.8"/>')
  };
  function showSheet(cls, mid, fill) {
    els.sheetBox.className = "chat-sheet__box " + cls;
    els.sheetBox.innerHTML = "";
    fill(els.sheetBox);
    els.sheet.dataset.mid = mid || "";
    els.sheet.hidden = false;
    sheetAt = Date.now();
  }
  function closeSheet() {
    if (!els.sheet) return;
    els.sheet.hidden = true;
    els.sheetBox.innerHTML = "";
    els.sheet.dataset.mid = "";
  }
  /* زي واتساب: المعرض (صور/فيديو) — الكاميرا — مستند — صوت. المعرض بيفتح معرض الموبايل مباشرةً مش مدير الملفات */
  function openAttach() {
    if (!st || st.rec) return;
    var A = [
      { t: "المعرض", c: "#2f6fe4", svg: ICO.img, el: els.gal },
      { t: "الكاميرا", c: "#d6246e", svg: ICO.cam, el: els.cam },
      { t: "مستند", c: "#7a4fe0", svg: ICO.doc, el: els.file },
      { t: "صوت", c: "#e08a12", svg: ICO.aud, el: els.aud }
    ];
    showSheet("grid", "", function (box) {
      A.forEach(function (a) {
        var b = document.createElement("button");
        b.type = "button"; b.className = "chat-att";
        b.innerHTML = '<span class="chat-att__ico" style="background:' + a.c + '">' + a.svg + "</span><span>" + a.t + "</span>";
        b.addEventListener("click", function () { closeSheet(); a.el.click(); });
        box.appendChild(b);
      });
    });
  }

  /* --- خيارات الرسالة (ضغطة مطوّلة / كليك يمين / زرار ⋮) --- */
  function copyText(t) {
    function fallback() {
      var ta = document.createElement("textarea");
      ta.value = t; ta.style.position = "fixed"; ta.style.opacity = "0";
      document.body.appendChild(ta); ta.select();
      try { document.execCommand("copy"); } catch (e) { /* ignore */ }
      ta.remove();
    }
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(t).catch(fallback); else fallback();
    toast("تم النسخ");
  }
  function openMsgMenu(m) {
    var S = st;
    if (!S || !m || !m.id) return;
    if (!els.sheet.hidden && els.sheet.dataset.mid === m.id) return;
    var items = [{ t: "رد", svg: REPLY_SVG, fn: function () { startReply(m); } }];
    if (m.text) items.push({ t: "نسخ", svg: ICO.copy, fn: function () { copyText(m.text); } });
    items.push({ t: "حذف عندي بس", svg: ICO.trash, fn: function () { hideForMe(S, m); } });
    if (m.from === S.role) items.push({ t: "حذف للجميع (إلغاء الإرسال)", svg: ICO.ban, danger: true, fn: function () { deleteForAll(S, m); } });
    showSheet("list", m.id, function (box) {
      items.forEach(function (it) {
        var b = document.createElement("button");
        b.type = "button"; b.className = "chat-act" + (it.danger ? " is-danger" : "");
        b.innerHTML = it.svg + "<span>" + esc(it.t) + "</span>";
        b.addEventListener("click", function () { closeSheet(); it.fn(); });
        box.appendChild(b);
      });
    });
  }
  function bindMenu(row, m) {
    var b = $(".chat-bubble", row), t = null, sx = 0, sy = 0, fired = false;
    function clr() { clearTimeout(t); t = null; }
    b.addEventListener("pointerdown", function (e) {
      if (e.pointerType === "mouse" || (e.button && e.button > 0)) return;
      sx = e.clientX; sy = e.clientY; fired = false; clr();
      t = setTimeout(function () {
        t = null; fired = true; row._sw = true;
        try { if (navigator.vibrate) navigator.vibrate(18); } catch (er) { /* ignore */ }
        openMsgMenu(m);
      }, 480);
    });
    b.addEventListener("pointermove", function (e) { if (t && (Math.abs(e.clientX - sx) > 8 || Math.abs(e.clientY - sy) > 8)) clr(); });
    b.addEventListener("pointerup", function () { clr(); if (fired) setTimeout(function () { row._sw = false; fired = false; }, 80); });
    b.addEventListener("pointercancel", clr);
    b.addEventListener("contextmenu", function (e) { e.preventDefault(); clr(); openMsgMenu(m); });
  }

  /* --- حذف عندي بس (بيتحفظ على الجهاز + Firebase لو القواعد بتسمح) --- */
  function hideKey(role, sid) { return "snchat-hide-" + role + "-" + sid; }
  function loadHid(role, sid) {
    try { return JSON.parse(localStorage.getItem(hideKey(role, sid))) || {}; } catch (e) { return {}; }
  }
  function saveHid(S) {
    try {
      var ks = Object.keys(S.hid);
      if (ks.length > 3000) { ks.slice(0, ks.length - 3000).forEach(function (k) { delete S.hid[k]; }); }
      localStorage.setItem(hideKey(S.role, S.sid), JSON.stringify(S.hid));
    } catch (e) { /* ignore */ }
  }
  function hideForMe(S, m) {
    S.hid[m.id] = 1;
    saveHid(S);
    try { quiet(S.hidRef.child(m.id).set(true)); } catch (e) { /* ignore */ }
    var row = els.list.querySelector('.chat-msg[data-id="' + m.id + '"]');
    if (row) row.hidden = true;
    tidyDays();
    toast("اتحذفت من عندك بس");
  }
  function applyHidden(S) {
    Object.keys(S.hid).forEach(function (id) {
      var row = els.list.querySelector('.chat-msg[data-id="' + id + '"]');
      if (row) row.hidden = true;
    });
    tidyDays();
  }
  /* يخفي فاصل اليوم لو مفيش رسايل ظاهرة تحته */
  function tidyDays() {
    if (!els.list) return;
    var kids = els.list.children, vis = false;
    for (var i = kids.length - 1; i >= 0; i--) {
      var k = kids[i];
      if (k.classList.contains("chat-day")) { k.hidden = !vis; vis = false; }
      else if (k.classList.contains("chat-msg") && !k.classList.contains("chat-live") && !k.hidden) vis = true;
    }
  }

  /* --- حذف للجميع = إلغاء الإرسال (بتفضل علامة "تم حذف هذه الرسالة" زي واتساب) --- */
  function deleteForAll(S, m) {
    if (m.from !== S.role) return;
    if (!window.confirm("تحذف الرسالة دي عند الطرفين؟")) return;
    db().ref("chatMessages/" + S.sid + "/" + m.id).update({ deleted: true, text: null, file: null, reply: null }).then(function () {
      if (m.file) {
        if (m.file.path && storageOk()) quiet(firebase.storage().ref(m.file.path).delete());
        else if (!m.file.url) quiet(db().ref("chatFiles/" + S.sid + "/" + m.id).remove());
      }
      db().ref("chatMessages/" + S.sid).orderByKey().limitToLast(1).once("value").then(function (snap) {
        snap.forEach(function (c) { if (c.key === m.id) quiet(db().ref("chatMeta/" + S.sid).update({ lastText: "🚫 تم حذف رسالة" })); });
      }).catch(function () { });
    }).catch(function () { toast("تعذر حذف الرسالة. اتأكد من الاتصال."); });
  }
  function markDeleted(S, v) {
    var old = els.list.querySelector('.chat-msg[data-id="' + v.id + '"]');
    if (!old) return;
    var nr = makeRow(S, v, Number(v.at) || Date.now(), v.from === S.role);
    old.parentNode.replaceChild(nr, old);
    tidyDays();
  }


  /* ======================= مشغّل الرسائل الصوتية (زي واتساب) ======================= */
  var curVoice = null; /* المشغّل الشغّال دلوقتي — لما تشغّل واحد تاني بيتوقف ده */
  function stopVoice() { if (curVoice) { try { curVoice.pause(); } catch (e) { /* ignore */ } curVoice = null; } }
  var PLAY_SVG = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5.5v13a1 1 0 0 0 1.5.86l10.5-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5Z"/></svg>';
  var PAUSE_SVG = '<svg viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="5" width="4.2" height="14" rx="1.2"/><rect x="13.8" y="5" width="4.2" height="14" rx="1.2"/></svg>';
  var MIC_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/></svg>';
  function waveHeights(id, n) {
    var h = 0, i;
    for (i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
    var out = [];
    for (i = 0; i < n; i++) {
      h = (h * 1664525 + 1013904223) >>> 0;
      var r = (h >>> 8) / 16777216;
      out.push(Math.round(5 + Math.pow(r, 1.4) * 21 + (i % 7 === 3 ? 3 : 0)));
    }
    return out;
  }
  function mountVoice(S, box, m) {
    var mine = m.from === S.role, N = 38, total = Number(m.file.dur) || 0, a = null, loading = false;
    box.classList.add("chat-file--voice");
    box.innerHTML =
      '<div class="chat-voice"><span class="chat-voice__av"><span class="chat-av"></span><span class="chat-voice__mic">' + MIC_SVG + "</span></span>" +
      '<button type="button" class="chat-voice__play" aria-label="تشغيل">' + PLAY_SVG + "</button>" +
      '<div class="chat-voice__mid"><div class="chat-voice__wave">' +
      waveHeights(String(m.id), N).map(function (h) { return '<i style="height:' + h + 'px"></i>'; }).join("") +
      '<b class="chat-voice__dot"></b></div><span class="chat-voice__t">' + fmtDur(total * 1000) + "</span></div></div>";
    var fromAdmin = m.from === "admin", av = $(".chat-av", box);
    av.setAttribute("data-from", fromAdmin ? "admin" : "student");
    /* الصورة دايمًا لصاحب الرسالة: الأدمن = صورة الأدمن، الطالب = صورة الطالب (عند الاتنين) */
    paintAvatar(av, fromAdmin ? ADMIN_PHOTO : (S.role === "admin" ? S.peerPhoto : S.myPhoto),
      fromAdmin ? ADMIN_NAME : (S.role === "admin" ? S.peerName : S.myName));
    var btn = $(".chat-voice__play", box), wave = $(".chat-voice__wave", box), tEl = $(".chat-voice__t", box), dot = $(".chat-voice__dot", box);
    var bars = Array.prototype.slice.call(wave.querySelectorAll("i"));
    function dur() { return a && isFinite(a.duration) && a.duration > 0 ? a.duration : total; }
    function paint(p) {
      p = Math.max(0, Math.min(1, p || 0));
      var n = Math.round(p * N);
      bars.forEach(function (b, i) { b.classList.toggle("is-played", i < n); });
      dot.style.left = (p * 100) + "%";
    }
    var api = { pause: function () { if (a) a.pause(); } };
    function icon(playing) { btn.innerHTML = playing ? PAUSE_SVG : PLAY_SVG; btn.setAttribute("aria-label", playing ? "إيقاف مؤقت" : "تشغيل"); box.classList.toggle("is-playing", playing); }
    function tick() {
      var d = dur();
      paint(d ? a.currentTime / d : 0);
      tEl.textContent = fmtDur((a.paused && a.currentTime === 0 ? d : a.currentTime) * 1000);
    }
    function ensure() {
      if (a) return Promise.resolve(a);
      if (loading) return Promise.reject(new Error("BUSY"));
      loading = true; btn.classList.add("is-busy");
      return loadFile(S, m.id, m).then(function (url) {
        a = new Audio(url);
        a.preload = "auto";
        a.addEventListener("loadedmetadata", function () {
          if (!isFinite(a.duration)) { /* تسجيلات webm بتيجي من غير مدة: بنحسبها */
            a.currentTime = 1e101;
            a.addEventListener("timeupdate", function f() { a.removeEventListener("timeupdate", f); a.currentTime = 0; });
          }
        });
        a.addEventListener("timeupdate", tick);
        a.addEventListener("play", function () { icon(true); });
        a.addEventListener("pause", function () { icon(false); tick(); });
        a.addEventListener("ended", function () { a.currentTime = 0; icon(false); paint(0); tEl.textContent = fmtDur(dur() * 1000); if (curVoice === api) curVoice = null; });
        return a;
      }).then(function (x) { loading = false; btn.classList.remove("is-busy"); return x; },
        function (e) { loading = false; btn.classList.remove("is-busy"); throw e; });
    }
    function play() {
      if (a && !a.paused) { a.pause(); if (curVoice === api) curVoice = null; return; }
      ensure().then(function (x) {
        if (st !== S) return;
        if (curVoice && curVoice !== api) curVoice.pause(); /* قفّل اللي كان شغّال */
        curVoice = api;
        var p = x.play(); if (p && p.catch) p.catch(function () { toast("تعذر تشغيل الرسالة الصوتية."); });
      }).catch(function (e) { if (!e || e.message !== "BUSY") toast("تعذر تحميل الرسالة الصوتية، جرّب تاني."); });
    }
    btn.addEventListener("click", play);
    wave.addEventListener("click", function (e) {
      var r = wave.getBoundingClientRect(), p = (e.clientX - r.left) / (r.width || 1);
      ensure().then(function (x) {
        var d = dur();
        if (d) { x.currentTime = Math.max(0, Math.min(1, p)) * d; tick(); }
      }).catch(function () { });
    });
  }


  /* ======================= محرّر الصور (قص، رسم، نص، أشكال، تمويه، إيموجي) ======================= */
  var edClose = null;
  var lbClosedAt = 0;
  function closeLb() { els.lb.hidden = true; lbClosedAt = Date.now(); }
  var ED_COLORS = ["#3b3f45", "#9a9aa8", "#ffffff", "#27c4ff", "#5bdc2d", "#b266ff", "#ff9a24", "#ff4d4d"];
  var ED_SIZES = [0.004, 0.008, 0.014, 0.024];
  var ED_EMOJI = [
    { ico: "😀", list: "😀 😃 😄 😁 😆 😅 😂 🤣 😊 😇 🙂 😉 😍 🥰 😘 😋 😛 😜 🤪 🤨 🧐 🤓 😎 🥳 😏 😒 😞 😔 😟 😕 🙁 😣 😖 😫 😩 🥺 😢 😭 😤 😠 😡 🤯 😳 🥵 🥶 😱 😨 🤔 🤗 🤫 😴" },
    { ico: "👍", list: "👍 👎 👌 ✌️ 🤞 🤟 🤘 👏 🙌 🙏 💪 👀 ❤️ 🧡 💛 💚 💙 💜 🖤 🤍 💔 💯 🔥 ✨ ⭐ 🌟 💥 💫 🎉 🎊 🎁 🏆 🥇 ✅ ❌ ⚠️ ❓ ❗" },
    { ico: "🐶", list: "🐶 🐱 🐭 🐹 🐰 🦊 🐻 🐼 🐨 🐯 🦁 🐮 🐷 🐸 🐵 🐔 🐧 🐦 🦆 🦉 🐴 🦄 🐝 🦋 🐢 🐍 🐙 🐬 🐳 🦈 🌹 🌸 🌻 🌳 🌵 🍀" },
    { ico: "🍕", list: "🍎 🍌 🍉 🍇 🍓 🍒 🍑 🍍 🥭 🥑 🍅 🌽 🥕 🍕 🍔 🍟 🌭 🥪 🌮 🍣 🍜 🍝 🍩 🍪 🎂 🍰 🍫 🍿 ☕ 🍵 🥤 🍺" },
    { ico: "⚽", list: "⚽ 🏀 🏈 🎾 🏐 🎮 🎧 🎤 🎸 🎹 🎬 🎓 📚 ✏️ 📝 📌 📎 🔑 💡 ⏰ 💰 🎨 🧩 🎯" },
    { ico: "🚗", list: "🚗 🚕 🚌 🏍️ 🚲 ✈️ 🚀 🚁 ⛵ 🚢 🏠 🏫 🏥 🏖️ 🌍 🗺️ ⛰️ 🌋 🌙 ☀️ ⛅ 🌈 ❄️ 💧 📱 💻 📷" }
  ];
  function edCopy(c) {
    var n = document.createElement("canvas");
    n.width = c.width; n.height = c.height;
    n.getContext("2d").drawImage(c, 0, 0);
    return n;
  }
  function edPixelate(target, src, r, block) {
    var sw = Math.max(1, Math.round(r.w / block)), sh = Math.max(1, Math.round(r.h / block));
    var t = document.createElement("canvas");
    t.width = sw; t.height = sh;
    t.getContext("2d").drawImage(src, r.x, r.y, r.w, r.h, 0, 0, sw, sh);
    target.save();
    target.imageSmoothingEnabled = false;
    target.drawImage(t, 0, 0, sw, sh, r.x, r.y, r.w, r.h);
    target.restore();
  }
  function edShape(c, kind, a, b, col, w) {
    c.save();
    c.strokeStyle = col; c.lineWidth = w; c.lineCap = "round"; c.lineJoin = "round";
    if (kind === "rect") {
      c.strokeRect(Math.min(a.x, b.x), Math.min(a.y, b.y), Math.abs(b.x - a.x), Math.abs(b.y - a.y));
    } else if (kind === "circle") {
      c.beginPath();
      c.ellipse((a.x + b.x) / 2, (a.y + b.y) / 2, Math.abs(b.x - a.x) / 2, Math.abs(b.y - a.y) / 2, 0, 0, Math.PI * 2);
      c.stroke();
    } else {
      c.beginPath(); c.moveTo(a.x, a.y); c.lineTo(b.x, b.y); c.stroke();
      if (kind === "arrow") {
        var ang = Math.atan2(b.y - a.y, b.x - a.x), hl = Math.max(w * 4, 14);
        c.beginPath();
        c.moveTo(b.x - hl * Math.cos(ang - 0.5), b.y - hl * Math.sin(ang - 0.5));
        c.lineTo(b.x, b.y);
        c.lineTo(b.x - hl * Math.cos(ang + 0.5), b.y - hl * Math.sin(ang + 0.5));
        c.stroke();
      }
    }
    c.restore();
  }
  function edAdjustRect(r0, h, p, a, minS, W, H) {
    var L = r0.x, T = r0.y, R = r0.x + r0.w, B = r0.y + r0.h, dx = p.x - a.x, dy = p.y - a.y;
    var movL = h === 0 || h === 6 || h === 7, movR = h === 2 || h === 3 || h === 4;
    var movT = h === 0 || h === 1 || h === 2, movB = h === 4 || h === 5 || h === 6;
    if (movL) L = Math.max(0, Math.min(r0.x + dx, R - minS));
    if (movR) R = Math.min(W, Math.max(r0.x + r0.w + dx, L + minS));
    if (movT) T = Math.max(0, Math.min(r0.y + dy, B - minS));
    if (movB) B = Math.min(H, Math.max(r0.y + r0.h + dy, T + minS));
    return { x: L, y: T, w: R - L, h: B - T };
  }
  function edHandles(r) {
    return [[r.x, r.y], [r.x + r.w / 2, r.y], [r.x + r.w, r.y], [r.x + r.w, r.y + r.h / 2], [r.x + r.w, r.y + r.h], [r.x + r.w / 2, r.y + r.h], [r.x, r.y + r.h], [r.x, r.y + r.h / 2]];
  }

  function openImageEditor(it, onDone) {
    if (edClose || !st) return;
    var img = new Image();
    img.onload = function () { build(img); };
    img.onerror = function () { toast("تعذر فتح الصورة للتعديل."); };
    img.src = it.url;

    function build(img) {
      var host = els.prev.parentNode;
      var nw = img.naturalWidth || img.width, nh = img.naturalHeight || img.height;
      if (!nw || !nh) { toast("تعذر فتح الصورة للتعديل."); return; }
      var sc = Math.min(1, 2000 / Math.max(nw, nh));
      var cv = document.createElement("canvas"), ov = document.createElement("canvas");
      cv.width = Math.max(1, Math.round(nw * sc)); cv.height = Math.max(1, Math.round(nh * sc));
      var ctx = cv.getContext("2d"), octx = ov.getContext("2d");
      ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, cv.width, cv.height);
      ctx.drawImage(img, 0, 0, cv.width, cv.height);
      var orig = edCopy(cv);
      var undo = [], dirty = false, saving = false;
      var tool = "", color = "#ff4d4d", size = 1, shape = "rect", blurV = 40, textV = 30, emojiV = 45, emoCat = 0, popKind = "";
      var crop = null, rectSel = null, obj = null, drag = null, txtInput = null;
      var TXT_FONT = "'Segoe UI', Roboto, 'Noto Sans Arabic', system-ui, sans-serif";
      var EMO_FONT = "'Apple Color Emoji','Segoe UI Emoji','Noto Color Emoji',sans-serif";

      var TOOLS = [
        ["crop", "قص وتدوير", svgOf('<path d="M6 2v14a2 2 0 0 0 2 2h14M2 6h14a2 2 0 0 1 2 2v14"/>')],
        ["draw", "رسم", svgOf('<path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/>')],
        ["text", "نص", '<b class="chat-ed__aa">Aa</b>'],
        ["shape", "أشكال", svgOf('<rect x="4" y="4" width="16" height="16" rx="2"/>')],
        ["blur", "تمويه", svgOf('<circle cx="5" cy="5" r="1"/><circle cx="12" cy="5" r="1"/><circle cx="19" cy="5" r="1"/><circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="19" r="1"/><circle cx="12" cy="19" r="1"/><circle cx="19" cy="19" r="1"/>')],
        ["emoji", "إيموجي", svgOf('<circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2M9 9h.01M15 9h.01"/>')]
      ];
      var CHK = svgOf('<path d="M20 6 9 17l-5-5"/>');
      var ed = document.createElement("div");
      ed.className = "chat-ed";
      ed.innerHTML =
        '<div class="chat-ed__top">' +
        '<button type="button" class="chat-ed__ic" data-a="close" aria-label="إغلاق">' + svgOf('<path d="M6 6l12 12M18 6 6 18"/>') + "</button>" +
        '<button type="button" class="chat-ed__ic" data-a="undo" aria-label="تراجع" hidden>' + svgOf('<path d="M3 7v6h6"/><path d="M21 17a9 9 0 0 0-15-6.7L3 13"/>') + "</button>" +
        '<div class="chat-ed__tools">' + TOOLS.map(function (t) { return '<button type="button" class="chat-ed__ic" data-t="' + t[0] + '" aria-label="' + t[1] + '" title="' + t[1] + '">' + t[2] + "</button>"; }).join("") + "</div>" +
        '<button type="button" class="chat-ed__done" data-a="done">تم</button></div>' +
        '<div class="chat-ed__stage"><div class="chat-ed__wrap"></div></div>' +
        '<div class="chat-ed__opts"></div><div class="chat-ed__pop" hidden></div>';
      var wrap = $(".chat-ed__wrap", ed), stage = $(".chat-ed__stage", ed), opts = $(".chat-ed__opts", ed), pop = $(".chat-ed__pop", ed);
      var undoBtn = $('[data-a="undo"]', ed), doneBtn = $('[data-a="done"]', ed);
      wrap.appendChild(cv); wrap.appendChild(ov);
      cv.className = "chat-ed__cv"; ov.className = "chat-ed__ov";
      host.appendChild(ed);

      function maxDim() { return Math.max(cv.width, cv.height); }
      function syncSize() { ov.width = cv.width; ov.height = cv.height; }
      function fit() {
        var aw = stage.clientWidth - 16, ah = stage.clientHeight - 16;
        if (aw <= 0 || ah <= 0) return;
        var k = Math.min(aw / cv.width, ah / cv.height);
        wrap.style.width = Math.max(1, Math.floor(cv.width * k)) + "px";
        wrap.style.height = Math.max(1, Math.floor(cv.height * k)) + "px";
      }
      function K() { var r = ov.getBoundingClientRect(); return cv.width / (r.width || 1); }
      function pt(e) { var r = ov.getBoundingClientRect(); return { x: (e.clientX - r.left) * cv.width / (r.width || 1), y: (e.clientY - r.top) * cv.height / (r.height || 1) }; }
      function lw() { return Math.max(3, maxDim() * ED_SIZES[size]); }
      function blockSize() { return Math.max(4, blurV / 100 * maxDim() * 0.05); }
      function updUndo() { undoBtn.hidden = undo.length === 0; }
      function pushUndo() { undo.push(edCopy(cv)); if (undo.length > 10) undo.shift(); dirty = true; updUndo(); }
      function hidePop() { pop.hidden = true; pop.innerHTML = ""; pop.className = "chat-ed__pop"; popKind = ""; }

      /* --- عنصر عايم (نص / إيموجي) --- */
      function applyObjSize(o) { o.size = maxDim() * (0.015 + o.v / 100 * 0.15); }
      function drawObj(c, o) {
        c.save();
        c.textAlign = "center"; c.textBaseline = "middle";
        if (o.kind === "text") {
          c.font = "700 " + o.size + "px " + TXT_FONT;
          c.fillStyle = o.color; c.shadowColor = "rgba(0,0,0,.45)"; c.shadowBlur = o.size * 0.08;
          var ls = o.text.split("\n"), lh = o.size * 1.25, y0 = o.y - (ls.length - 1) * lh / 2;
          ls.forEach(function (l, i) { c.fillText(l, o.x, y0 + i * lh); });
        } else {
          c.font = o.size + "px " + EMO_FONT;
          c.fillText(o.text, o.x, o.y);
        }
        c.restore();
      }
      function objBox(o) {
        octx.save();
        octx.font = (o.kind === "text" ? "700 " : "") + o.size + "px " + (o.kind === "text" ? TXT_FONT : EMO_FONT);
        var ls = o.text.split("\n"), w = 0;
        ls.forEach(function (l) { w = Math.max(w, octx.measureText(l).width); });
        octx.restore();
        w = Math.max(w, o.size * 0.6);
        var h = (o.kind === "text" ? o.size * 1.25 : o.size * 1.15) * ls.length, pad = o.size * 0.1;
        return { x: o.x - w / 2 - pad, y: o.y - h / 2 - pad, w: w + pad * 2, h: h + pad * 2 };
      }
      function hitObj(o, p) {
        var b = objBox(o), m = 10 * K();
        return p.x >= b.x - m && p.x <= b.x + b.w + m && p.y >= b.y - m && p.y <= b.y + b.h + m;
      }
      function newObj(kind, text, x, y) {
        var o = { kind: kind, text: text, x: x, y: y, color: color, v: kind === "text" ? textV : emojiV, size: 0 };
        applyObjSize(o);
        return o;
      }
      function commitObj() {
        if (obj && obj.text.trim()) { pushUndo(); drawObj(ctx, obj); }
        obj = null;
        if (txtInput) txtInput.value = "";
        renderOv();
      }

      /* --- مستطيل القص / التمويه --- */
      function hitRect(r, p) {
        var k = K(), hs = edHandles(r), tol = 18 * k, i;
        for (i = 0; i < hs.length; i++) { if (Math.abs(hs[i][0] - p.x) <= tol && Math.abs(hs[i][1] - p.y) <= tol) return i; }
        if (p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h) return "move";
        return null;
      }
      function drawRectUI(r, k, col) {
        octx.save();
        octx.strokeStyle = col; octx.lineWidth = 2 * k;
        octx.strokeRect(r.x, r.y, r.w, r.h);
        edHandles(r).forEach(function (h) {
          octx.beginPath(); octx.arc(h[0], h[1], 7 * k, 0, Math.PI * 2);
          octx.fillStyle = "#fff"; octx.fill();
          octx.strokeStyle = "rgba(0,0,0,.45)"; octx.lineWidth = 1 * k; octx.stroke();
        });
        octx.restore();
      }
      function renderOv() {
        octx.clearRect(0, 0, ov.width, ov.height);
        var k = K(), W = ov.width, H = ov.height, i;
        if (tool === "crop" && crop) {
          octx.fillStyle = "rgba(0,0,0,.55)";
          octx.fillRect(0, 0, W, crop.y);
          octx.fillRect(0, crop.y + crop.h, W, H - crop.y - crop.h);
          octx.fillRect(0, crop.y, crop.x, crop.h);
          octx.fillRect(crop.x + crop.w, crop.y, W - crop.x - crop.w, crop.h);
          octx.strokeStyle = "rgba(255,255,255,.4)"; octx.lineWidth = 1 * k;
          for (i = 1; i < 3; i++) {
            octx.beginPath();
            octx.moveTo(crop.x + crop.w * i / 3, crop.y); octx.lineTo(crop.x + crop.w * i / 3, crop.y + crop.h);
            octx.moveTo(crop.x, crop.y + crop.h * i / 3); octx.lineTo(crop.x + crop.w, crop.y + crop.h * i / 3);
            octx.stroke();
          }
          drawRectUI(crop, k, "#fff");
        } else if (tool === "blur" && rectSel && rectSel.w > 0 && rectSel.h > 0) {
          var rr = { x: Math.floor(rectSel.x), y: Math.floor(rectSel.y), w: Math.max(1, Math.ceil(rectSel.w)), h: Math.max(1, Math.ceil(rectSel.h)) };
          edPixelate(octx, cv, rr, blockSize());
          drawRectUI(rectSel, k, "#5bdc2d");
        } else if ((tool === "text" || tool === "emoji") && obj) {
          drawObj(octx, obj);
          var b = objBox(obj);
          octx.save();
          octx.strokeStyle = "rgba(255,255,255,.85)"; octx.lineWidth = 1.5 * k; octx.setLineDash([6 * k, 4 * k]);
          octx.strokeRect(b.x, b.y, b.w, b.h);
          octx.restore();
        } else if (tool === "shape" && drag && drag.mode === "shape") {
          edShape(octx, shape, drag.a, drag.b, color, lw());
        }
      }

      /* --- قص وتدوير --- */
      function applyCrop() {
        if (!crop) return;
        var r = { x: Math.round(crop.x), y: Math.round(crop.y), w: Math.round(crop.w), h: Math.round(crop.h) };
        if (r.w < 8 || r.h < 8) return;
        if (r.x <= 0 && r.y <= 0 && r.w >= cv.width && r.h >= cv.height) return;
        r.w = Math.min(r.w, cv.width - r.x); r.h = Math.min(r.h, cv.height - r.y);
        pushUndo();
        var t = edCopy(cv);
        cv.width = r.w; cv.height = r.h; syncSize();
        ctx.drawImage(t, r.x, r.y, r.w, r.h, 0, 0, r.w, r.h);
      }
      function rotate(dir) {
        pushUndo();
        var t = edCopy(cv);
        cv.width = t.height; cv.height = t.width; syncSize();
        ctx.save();
        if (dir > 0) { ctx.translate(cv.width, 0); ctx.rotate(Math.PI / 2); } else { ctx.translate(0, cv.height); ctx.rotate(-Math.PI / 2); }
        ctx.drawImage(t, 0, 0);
        ctx.restore();
        crop = { x: 0, y: 0, w: cv.width, h: cv.height };
        fit(); renderOv();
      }
      function resetImg() {
        pushUndo();
        cv.width = orig.width; cv.height = orig.height; syncSize();
        ctx.drawImage(orig, 0, 0);
        crop = { x: 0, y: 0, w: cv.width, h: cv.height };
        fit(); renderOv();
      }
      function commitBlur() {
        if (rectSel && rectSel.w >= 4 && rectSel.h >= 4) {
          var x = Math.max(0, Math.floor(rectSel.x)), y = Math.max(0, Math.floor(rectSel.y));
          var r = { x: x, y: y, w: Math.min(cv.width - x, Math.ceil(rectSel.w)), h: Math.min(cv.height - y, Math.ceil(rectSel.h)) };
          if (r.w > 0 && r.h > 0) { pushUndo(); edPixelate(ctx, cv, r, blockSize()); }
        }
        rectSel = null;
        renderOv();
      }
      function commitPending() {
        if (tool === "crop") applyCrop();
        else if (tool === "blur") commitBlur();
        else if (tool === "text" || tool === "emoji") commitObj();
        crop = null; rectSel = null; obj = null;
      }

      /* --- شريط الخيارات --- */
      function colsHTML() {
        return '<div class="chat-ed__cols">' + ED_COLORS.map(function (c) {
          return '<button type="button" class="chat-ed__col' + (c === color ? " is-sel" : "") + '" data-c="' + c + '" style="background:' + c + '" aria-label="لون"></button>';
        }).join("") + "</div>";
      }
      function szsHTML() {
        return '<div class="chat-ed__szs">' + ED_SIZES.map(function (_, i) {
          var d = 6 + i * 4;
          return '<button type="button" class="chat-ed__sz' + (i === size ? " is-sel" : "") + '" data-s="' + i + '" aria-label="حجم"><i style="width:' + d + "px;height:" + d + 'px"></i></button>';
        }).join("") + "</div>";
      }
      function rebuildOpts() {
        var h = "";
        txtInput = null;
        if (tool === "draw" || tool === "shape") h = '<div class="chat-ed__row">' + colsHTML() + szsHTML() + "</div>";
        else if (tool === "text") h = '<div class="chat-ed__row"><input class="chat-ed__txt" type="text" dir="auto" maxlength="200" placeholder="اكتب النص هنا…" /><button type="button" class="chat-ed__chk" data-a="chk" aria-label="إضافة">' + CHK + '</button></div><div class="chat-ed__row">' + colsHTML() + '<input type="range" class="chat-ed__rng" data-r="text" min="1" max="100" value="' + textV + '" /></div>';
        else if (tool === "emoji") h = '<div class="chat-ed__row"><button type="button" class="chat-ed__pill" data-a="emopick">😀 اختار إيموجي</button><input type="range" class="chat-ed__rng" data-r="emoji" min="1" max="100" value="' + emojiV + '" /><button type="button" class="chat-ed__ic" data-a="trash" aria-label="حذف">' + ICO.trash + '</button><button type="button" class="chat-ed__chk" data-a="chk" aria-label="إضافة">' + CHK + "</button></div>";
        else if (tool === "blur") h = '<div class="chat-ed__row"><span class="chat-ed__lab">اسحب على الصورة لتحديد المنطقة</span></div><div class="chat-ed__row"><input type="range" class="chat-ed__rng" data-r="blur" min="5" max="100" value="' + blurV + '" /><span class="chat-ed__val">' + blurV + '</span><button type="button" class="chat-ed__ic" data-a="trash" aria-label="حذف">' + ICO.trash + "</button></div>";
        else if (tool === "crop") h = '<div class="chat-ed__row"><button type="button" class="chat-ed__ic" data-a="rotl" aria-label="تدوير لليسار">' + svgOf('<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/>') + '</button><button type="button" class="chat-ed__ic" data-a="rotr" aria-label="تدوير لليمين">' + svgOf('<path d="M21 12a9 9 0 1 1-3-6.7L21 8"/><path d="M21 3v5h-5"/>') + '</button><button type="button" class="chat-ed__pill" data-a="reset">استعادة الأصل</button></div>';
        opts.innerHTML = h;
        txtInput = $(".chat-ed__txt", opts);
        if (txtInput && obj && obj.kind === "text") txtInput.value = obj.text;
      }
      function syncSel() {
        Array.prototype.forEach.call(opts.querySelectorAll("[data-c]"), function (b) { b.classList.toggle("is-sel", b.getAttribute("data-c") === color); });
        Array.prototype.forEach.call(opts.querySelectorAll("[data-s]"), function (b) { b.classList.toggle("is-sel", Number(b.getAttribute("data-s")) === size); });
      }
      function setTool(t) {
        commitPending();
        tool = t; drag = null; hidePop();
        if (t === "crop") crop = { x: 0, y: 0, w: cv.width, h: cv.height };
        Array.prototype.forEach.call(ed.querySelectorAll("[data-t]"), function (b) { b.classList.toggle("is-on", b.getAttribute("data-t") === t); });
        rebuildOpts(); renderOv(); fit();
        requestAnimationFrame(function () { fit(); renderOv(); });
      }

      /* --- القوايم المنبثقة --- */
      function showShapePop() {
        var S = [["rect", '<rect x="4" y="4" width="16" height="16" rx="1"/>'], ["circle", '<circle cx="12" cy="12" r="9"/>'], ["line", '<path d="M5 19 19 5"/>'], ["arrow", '<path d="M5 19 19 5M9 5h10v10"/>']];
        pop.className = "chat-ed__pop shapes";
        pop.innerHTML = S.map(function (s) { return '<button type="button" class="chat-ed__sh' + (s[0] === shape ? " is-sel" : "") + '" data-sh="' + s[0] + '">' + svgOf(s[1]) + "</button>"; }).join("");
        pop.hidden = false; popKind = "shape";
      }
      function fillEmoji() {
        var g = $(".chat-ed__egrid", pop);
        g.innerHTML = ED_EMOJI[emoCat].list.split(" ").map(function (em) { return '<button type="button" class="chat-ed__em" data-em="' + em + '">' + em + "</button>"; }).join("");
        Array.prototype.forEach.call(pop.querySelectorAll("[data-cat]"), function (b) { b.classList.toggle("is-on", Number(b.getAttribute("data-cat")) === emoCat); });
      }
      function showEmojiPop() {
        pop.className = "chat-ed__pop emo";
        pop.innerHTML = '<div class="chat-ed__etabs">' + ED_EMOJI.map(function (c, i) { return '<button type="button" data-cat="' + i + '">' + c.ico + "</button>"; }).join("") + '</div><div class="chat-ed__egrid"></div>';
        pop.hidden = false; popKind = "emoji";
        fillEmoji();
      }

      /* --- اللمس / الماوس --- */
      ov.addEventListener("pointerdown", function (e) {
        if (e.button && e.button > 0) return;
        e.preventDefault();
        hidePop();
        var p = pt(e), r, h;
        try { ov.setPointerCapture(e.pointerId); } catch (x) { /* ignore */ }
        if (tool === "draw") {
          pushUndo();
          ctx.strokeStyle = color; ctx.lineWidth = lw(); ctx.lineCap = "round"; ctx.lineJoin = "round";
          ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x + 0.01, p.y); ctx.stroke();
          drag = { mode: "draw", last: p };
        } else if (tool === "shape") {
          drag = { mode: "shape", a: p, b: p };
        } else if (tool === "crop" || tool === "blur") {
          r = tool === "crop" ? crop : rectSel;
          h = r ? hitRect(r, p) : null;
          if (h === null) {
            if (tool === "blur") { if (rectSel) commitBlur(); rectSel = { x: p.x, y: p.y, w: 0, h: 0 }; drag = { mode: "new", a: p }; }
          } else drag = { mode: h === "move" ? "move" : "handle", h: h, a: p, r0: { x: r.x, y: r.y, w: r.w, h: r.h } };
        } else if (tool === "text" || tool === "emoji") {
          if (!obj && tool === "text") obj = newObj("text", txtInput ? txtInput.value : "", p.x, p.y);
          if (obj) {
            if (!hitObj(obj, p)) { obj.x = p.x; obj.y = p.y; }
            drag = { mode: "obj", a: p, o0: { x: obj.x, y: obj.y } };
          }
        }
        renderOv();
      });
      ov.addEventListener("pointermove", function (e) {
        if (!drag) return;
        e.preventDefault();
        var p = pt(e), W = cv.width, H = cv.height, dx, dy, r0, rr;
        if (drag.mode === "draw") {
          ctx.beginPath(); ctx.moveTo(drag.last.x, drag.last.y); ctx.lineTo(p.x, p.y); ctx.stroke();
          drag.last = p;
        } else if (drag.mode === "shape") {
          drag.b = p; renderOv();
        } else if (drag.mode === "new") {
          rectSel = { x: Math.max(0, Math.min(drag.a.x, p.x)), y: Math.max(0, Math.min(drag.a.y, p.y)), w: 0, h: 0 };
          rectSel.w = Math.min(W, Math.max(drag.a.x, p.x)) - rectSel.x;
          rectSel.h = Math.min(H, Math.max(drag.a.y, p.y)) - rectSel.y;
          renderOv();
        } else if (drag.mode === "move" || drag.mode === "handle") {
          r0 = drag.r0;
          if (drag.mode === "move") {
            dx = p.x - drag.a.x; dy = p.y - drag.a.y;
            rr = { x: Math.max(0, Math.min(W - r0.w, r0.x + dx)), y: Math.max(0, Math.min(H - r0.h, r0.y + dy)), w: r0.w, h: r0.h };
          } else rr = edAdjustRect(r0, drag.h, p, drag.a, 24 * K(), W, H);
          if (tool === "crop") crop = rr; else rectSel = rr;
          renderOv();
        } else if (drag.mode === "obj" && obj) {
          obj.x = drag.o0.x + (p.x - drag.a.x); obj.y = drag.o0.y + (p.y - drag.a.y);
          renderOv();
        }
      });
      function endDrag() {
        if (!drag) return;
        var d = drag;
        drag = null;
        if (d.mode === "shape") {
          var k = K();
          if (Math.abs(d.b.x - d.a.x) + Math.abs(d.b.y - d.a.y) >= 6 * k) { pushUndo(); edShape(ctx, shape, d.a, d.b, color, lw()); }
        } else if (d.mode === "new") {
          var kk = K();
          if (!rectSel || rectSel.w < 10 * kk || rectSel.h < 10 * kk) rectSel = null;
        }
        renderOv();
      }
      ov.addEventListener("pointerup", endDrag);
      ov.addEventListener("pointercancel", endDrag);

      /* --- الأزرار --- */
      function finish(save) {
        if (saving) return;
        if (!save) { cleanup(); return; }
        commitPending();
        if (!dirty) { cleanup(); return; }
        saving = true; doneBtn.disabled = true;
        cv.toBlob(function (b) {
          if (!b) { saving = false; doneBtn.disabled = false; toast("تعذر حفظ التعديل."); return; }
          var name = ((it.f && it.f.name) || "image").replace(/\.[^.]+$/, "") + ".jpg";
          var nf = new File([b], name, { type: "image/jpeg" });
          cleanup();
          onDone(nf);
        }, "image/jpeg", 0.92);
      }
      function doUndo() {
        if (obj || rectSel) { obj = null; rectSel = null; if (txtInput) txtInput.value = ""; renderOv(); return; }
        var p = undo.pop();
        if (!p) return;
        cv.width = p.width; cv.height = p.height; syncSize();
        ctx.drawImage(p, 0, 0);
        if (tool === "crop") crop = { x: 0, y: 0, w: cv.width, h: cv.height };
        updUndo(); fit(); renderOv();
      }
      ed.addEventListener("click", function (e) {
        var b = e.target.closest("button");
        if (!b || !ed.contains(b)) return;
        var a = b.getAttribute("data-a"), t = b.getAttribute("data-t");
        if (t) {
          if (t === tool) {
            if (t === "shape") { if (popKind === "shape") hidePop(); else showShapePop(); }
            else if (t === "emoji") { if (popKind === "emoji") hidePop(); else showEmojiPop(); }
          } else {
            setTool(t);
            if (t === "shape") showShapePop(); else if (t === "emoji") showEmojiPop();
          }
          return;
        }
        if (a === "close") finish(false);
        else if (a === "done") finish(true);
        else if (a === "undo") doUndo();
        else if (a === "chk") commitObj();
        else if (a === "trash") { obj = null; rectSel = null; if (txtInput) txtInput.value = ""; renderOv(); }
        else if (a === "rotl") rotate(-1);
        else if (a === "rotr") rotate(1);
        else if (a === "reset") resetImg();
        else if (a === "emopick") showEmojiPop();
        else if (b.hasAttribute("data-c")) { color = b.getAttribute("data-c"); if (obj && obj.kind === "text") obj.color = color; syncSel(); renderOv(); }
        else if (b.hasAttribute("data-s")) { size = Number(b.getAttribute("data-s")); syncSel(); }
        else if (b.hasAttribute("data-sh")) { shape = b.getAttribute("data-sh"); hidePop(); }
        else if (b.hasAttribute("data-cat")) { emoCat = Number(b.getAttribute("data-cat")); fillEmoji(); }
        else if (b.hasAttribute("data-em")) {
          if (obj) commitObj();
          obj = newObj("emoji", b.getAttribute("data-em"), cv.width / 2, cv.height / 2);
          hidePop(); renderOv();
        }
      });
      ed.addEventListener("input", function (e) {
        var t = e.target;
        if (t === txtInput) {
          if (!obj) obj = newObj("text", "", cv.width / 2, cv.height / 2);
          obj.text = txtInput.value;
          renderOv();
        } else if (t.getAttribute && t.getAttribute("data-r")) {
          var v = Number(t.value), kind = t.getAttribute("data-r");
          if (kind === "blur") { blurV = v; var lab = $(".chat-ed__val", opts); if (lab) lab.textContent = String(v); }
          else if (kind === "text") { textV = v; if (obj && obj.kind === "text") { obj.v = v; applyObjSize(obj); } }
          else if (kind === "emoji") { emojiV = v; if (obj && obj.kind === "emoji") { obj.v = v; applyObjSize(obj); } }
          renderOv();
        }
      });
      ed.addEventListener("keydown", function (e) {
        if (e.target === txtInput && e.key === "Enter") { e.preventDefault(); commitObj(); }
        if (e.key !== "Escape") e.stopPropagation();
      });
      var onResize = function () { fit(); renderOv(); };
      window.addEventListener("resize", onResize);
      function cleanup() {
        window.removeEventListener("resize", onResize);
        if (ed.parentNode) ed.parentNode.removeChild(ed);
        edClose = null;
      }
      edClose = function () { cleanup(); };

      syncSize();
      setTool("draw");
    }
  }

  function toast(msg) {
    els.toast.textContent = msg;
    els.toast.hidden = false;
    clearTimeout(toast._t);
    toast._t = setTimeout(function () { els.toast.hidden = true; }, 3400);
  }
  function paintAvatar(el, photo, name) {
    el.textContent = "";
    if (photo && (photo === ADMIN_PHOTO || validPhoto(photo))) {
      var img = document.createElement("img");
      img.alt = "";
      img.src = photo;
      img.onerror = function () { el.textContent = initial(name); };
      el.appendChild(img);
    } else el.textContent = initial(name);
  }

  function openConv(o) {
    build();
    if (st) teardown();
    var S = st = {
      role: o.role, sid: o.sid, onPeer: o.onPeer, studentName: o.studentName || "",
      seen: {}, hid: loadHid(o.role, o.sid), lastDay: null, initial: true, peerReadAt: 0, urls: {}, pending: 0, pushed: false, embed: o.embed || null
    };
    /* على الكمبيوتر عند الأدمن: المحادثة بتتفتح جوّه الصفحة نفسها (جنب قايمة الطلاب) بدل ما تغطي الشاشة */
    if (S.embed) {
      if (ov.parentNode !== S.embed) S.embed.appendChild(ov);
      ov.classList.add("chat-ov--embedded");
    } else {
      if (ov.parentNode !== document.body) document.body.appendChild(ov);
      ov.classList.remove("chat-ov--embedded");
    }
    paintAvatar(els.av, o.photo, o.name);
    els.name.textContent = o.name || "";
    S.peerName = o.name || "";
    S.peerPhoto = o.photo || "";
    var ses = session();
    S.myPhoto = S.role === "admin" ? ADMIN_PHOTO : ((ses && ses.photoURL) || "");
    S.myName = S.role === "admin" ? ADMIN_NAME : ((ses && ses.fullName) || "");
    if (S.role === "student" && !validPhoto(S.myPhoto)) {
      try {
        db().ref("users/" + S.sid + "/photoURL").once("value").then(function (sn) {
          var u = sn.val();
          if (st !== S || !validPhoto(u)) return;
          S.myPhoto = u;
          Array.prototype.forEach.call(ov.querySelectorAll(".chat-voice__av .chat-av[data-from=student]"), function (el) { paintAvatar(el, u, S.myName); });
        }).catch(function () { });
      } catch (e) { /* ignore */ }
    }
    S.subtitle = o.subtitle || "";
    S.reply = null;
    els.reply.hidden = true;
    els.sub.textContent = o.subtitle || "";
    els.sub.hidden = !o.subtitle;
    els.sub.classList.remove("is-typing");
    $(".chat-peer", ov).classList.toggle("is-link", !!o.onPeer);
    els.list.innerHTML = "";
    if (o.welcome) {
      var w = document.createElement("div");
      w.className = "chat-msg chat-msg--them chat-msg--welcome";
      w.innerHTML = '<div class="chat-bubble"><div class="chat-text" dir="auto">' + esc(WELCOME) + "</div></div>";
      els.list.appendChild(w);
    }
    els.input.value = "";
    autosize();
    els.pend.hidden = true;
    els.lb.hidden = true;
    ov.hidden = false;
    autosize();
    updateBtns();
    if (!S.embed) {
      document.documentElement.classList.add("chat-lock");
      try { history.pushState({ snchat: 1 }, ""); S.pushed = true; } catch (e) { /* مش مشكلة */ }
    }

    S.initCount = 0; S.noMore = false; S.oldestKey = null; S.topNode = null; S.firstDay = null; S.loadingOlder = false;
    if (window.IntersectionObserver) {
      S.io = new IntersectionObserver(function (entries) {
        entries.forEach(function (e) {
          if (!e.isIntersecting) return;
          S.io.unobserve(e.target);
          if (e.target._mount) e.target._mount();
        });
      }, { root: els.body, rootMargin: "400px 0px" });
    }
    var q = db().ref("chatMessages/" + S.sid).limitToLast(PAGE);
    S.q = q;
    S.onAdd = q.on("child_added", function (snap) { if (st === S) addMsg(S, snap.val()); });
    S.onChg = q.on("child_changed", function (snap) { var v = snap.val(); if (st === S && v && v.id && v.deleted) markDeleted(S, v); });
    S.hidRef = db().ref("chatHidden/" + S.sid + "/" + S.role);
    S.onHid = S.hidRef.on("value", function (snap) {
      var v = snap.val() || {};
      Object.keys(v).forEach(function (k) { S.hid[k] = 1; });
      if (st === S) applyHidden(S);
    }, function () { /* القواعد مش مسموحة: بنكتفي بالتخزين المحلي */ });
    q.once("value", function () {
      if (st !== S) return;
      S.initial = false;
      S.noMore = S.initCount < PAGE;
      tidyDays();
      scrollDown(true);
      markRead();
      setTimeout(function () { checkOlder(S); }, 120);
    });
    var peerRole = S.role === "admin" ? "student" : "admin";
    S.typRef = db().ref("chatTyping/" + S.sid + "/" + peerRole);
    S.myTypRef = db().ref("chatTyping/" + S.sid + "/" + S.role);
    S.onTyp = S.typRef.on("value", function (snap) { if (st === S) showPeerState(snap.val()); }, function () { });
    S.metaRef = db().ref("chatMeta/" + S.sid);
    S.onMeta = S.metaRef.on("value", function (snap) {
      if (st !== S) return;
      var m = snap.val() || {};
      S.peerReadAt = Number(S.role === "admin" ? m.studentReadAt : m.adminReadAt) || 0;
      refreshTicks();
    });
    if (window.matchMedia("(pointer:fine)").matches) setTimeout(function () { els.input.focus(); }, 60);
  }

  function teardown() {
    if (!st) return;
    if (st.rec) abortRec(st);
    stopVoice();
    if (edClose) edClose(false);
    closeSheet();
    clearStage();
    clearTimeout(st.typTimer);
    setMyState(st, null);
    try { st.typRef.off("value", st.onTyp); } catch (e) { /* ignore */ }
    try { st.q.off("child_added", st.onAdd); } catch (e) { /* ignore */ }
    try { st.q.off("child_changed", st.onChg); } catch (e) { /* ignore */ }
    try { st.hidRef.off("value", st.onHid); } catch (e) { /* ignore */ }
    try { st.metaRef.off("value", st.onMeta); } catch (e) { /* ignore */ }
    Object.keys(st.urls).forEach(function (k) {
      st.urls[k].then(function (u) { try { URL.revokeObjectURL(u); } catch (e) { /* ignore */ } }).catch(function () { });
    });
    clearTimeout(st.readTimer);
    if (st.io) { try { st.io.disconnect(); } catch (e) { /* ignore */ } }
  }

  function closeConv() {
    if (!st) return;
    teardown();
    ov.hidden = true;
    els.lb.hidden = true;
    document.documentElement.classList.remove("chat-lock");
    var pushed = st.pushed, embed = st.embed;
    st = null;
    if (pushed) { try { history.back(); } catch (e) { /* ignore */ } }
    if (embed && AL) { AL.activeSid = null; renderList(); if (AL.o.emptyEl) AL.o.emptyEl.hidden = false; }
  }

  function scrollDown(force) {
    var b = els.body;
    if (force || b.scrollHeight - b.scrollTop - b.clientHeight < 140) b.scrollTop = b.scrollHeight;
    updateDown();
  }
  /* زرار السهم: بيظهر بس لما تطلع لفوق للرسايل القديمة، وبينزّلك لآخر الرسايل */
  function updateDown() {
    if (!els || !els.down) return;
    var b = els.body;
    els.down.hidden = !(b.scrollHeight - b.scrollTop - b.clientHeight > 320);
  }

  /* --- علامة \"اتقرت\": بنكتب آخر وقت قراءة وبنصفّر العدّاد --- */
  function markRead() {
    if (!st || document.visibilityState !== "visible") return;
    var S = st;
    clearTimeout(S.readTimer);
    S.readTimer = setTimeout(function () {
      var upd = {};
      upd[S.role === "admin" ? "adminReadAt" : "studentReadAt"] = TS();
      upd[S.role === "admin" ? "unreadAdmin" : "unreadStudent"] = 0;
      db().ref("chatMeta/" + S.sid).update(upd).catch(function () { });
    }, 250);
  }

  function refreshTicks() {
    if (!st) return;
    var read = st.peerReadAt;
    Array.prototype.forEach.call(els.list.querySelectorAll(".chat-tick"), function (t) {
      t.classList.toggle("is-read", Number(t.dataset.at) <= read);
    });
  }

  function makeSep(at) {
    var sep = document.createElement("div");
    sep.className = "chat-day";
    sep.innerHTML = "<span>" + esc(dayLabel(at)) + "</span>";
    return sep;
  }
  function makeRow(S, m, at, mine) {
    var row = document.createElement("div");
    row.className = "chat-msg " + (mine ? "chat-msg--me" : "chat-msg--them");
    if (m.deleted) {
      row.dataset.id = m.id;
      row.innerHTML = '<div class="chat-bubble"><div class="chat-text chat-deleted" dir="auto">🚫 تم حذف هذه الرسالة</div><div class="chat-meta"><time>' + esc(fmtTime(at)) + "</time></div></div>";
      return row;
    }
    if (S.hid && S.hid[m.id]) row.hidden = true;
    var html = '<div class="chat-bubble">';
    if (m.reply && m.reply.id) html += '<div class="chat-quote" data-rid="' + esc(m.reply.id) + '"><strong>' + esc(peerLabel(S, m.reply.from)) + '</strong><span dir="auto">' + esc(String(m.reply.text || "").slice(0, 100)) + "</span></div>";
    if (m.file) html += '<div class="chat-file" data-k="' + kindOf(m.file.type) + '"></div>';
    if (m.text) html += '<div class="chat-text" dir="auto">' + linkify(esc(m.text)) + "</div>";
    html += '<div class="chat-meta"><time>' + esc(fmtTime(at)) + "</time>" +
      (mine ? '<span class="chat-tick" data-at="' + at + '">' + TICK + "</span>" : "") + "</div></div>";
    row.innerHTML = html;
    row.dataset.id = m.id;
    var rb = document.createElement("button");
    rb.type = "button"; rb.className = "chat-rbtn"; rb.setAttribute("aria-label", "رد"); rb.innerHTML = REPLY_SVG;
    rb.addEventListener("click", function () { startReply(m); });
    var mb = document.createElement("button");
    mb.type = "button"; mb.className = "chat-mbtn"; mb.setAttribute("aria-label", "خيارات"); mb.innerHTML = '<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="5" r="1.8"/><circle cx="12" cy="12" r="1.8"/><circle cx="12" cy="19" r="1.8"/></svg>';
    mb.addEventListener("click", function () { openMsgMenu(m); });
    if (mine) { row.appendChild(rb); row.appendChild(mb); } else { row.insertBefore(rb, row.firstChild); row.insertBefore(mb, row.firstChild); }
    var qt = $(".chat-quote", row);
    if (qt) qt.addEventListener("click", function (e) { e.stopPropagation(); jumpTo(m.reply.id); });
    bindSwipe(row, m);
    bindMenu(row, m);
    if (m.file) {
      var box = $(".chat-file", row);
      if (kindOf(m.file.type) === "image" && S.io) {
        /* الصورة بتتحمّل بس لما تقرب من الشاشة (توفير للنت) */
        box.classList.add("is-loading");
        box.innerHTML = '<span class="chat-spin"></span>';
        box._mount = function () { mountFile(S, box, m); };
        S.io.observe(box);
      } else mountFile(S, box, m);
    }
    return row;
  }

  /* --- تحميل الرسايل الأقدم لما الطالب/الأدمن يطلع لفوق --- */
  function checkOlder(S) {
    if (st !== S || S.noMore || S.loadingOlder) return;
    if (els.body.scrollHeight <= els.body.clientHeight + 20 || els.body.scrollTop < 160) loadOlder(S);
  }
  function loadOlder(S) {
    if (S.loadingOlder || S.noMore || !S.oldestKey) return;
    S.loadingOlder = true;
    db().ref("chatMessages/" + S.sid).orderByKey().endAt(S.oldestKey).limitToLast(PAGE + 1).once("value").then(function (snap) {
      if (st !== S) return;
      var arr = [];
      snap.forEach(function (c) { var v = c.val(); if (v && v.id && v.id !== S.oldestKey) arr.push(v); });
      if (snap.numChildren() < PAGE + 1) S.noMore = true;
      if (arr.length) prependMsgs(S, arr);
    }).catch(function () { /* هنحاول تاني لما يطلع لفوق */ }).then(function () {
      S.loadingOlder = false;
      if (st === S) setTimeout(function () { checkOlder(S); }, 150);
    });
  }
  function prependMsgs(S, arr) {
    var b = els.body, oldH = b.scrollHeight, oldTop = b.scrollTop;
    var frag = document.createDocumentFragment(), prevDay = null, firstNode = null, firstDay = null;
    arr.forEach(function (m) {
      if (S.seen[m.id]) return;
      S.seen[m.id] = 1;
      var at = Number(m.at) || Date.now(), dk = dayKey(at);
      if (prevDay !== dk) {
        var sep = makeSep(at);
        if (!firstNode) { firstNode = sep; firstDay = dk; }
        frag.appendChild(sep);
        prevDay = dk;
      }
      frag.appendChild(makeRow(S, m, at, m.from === S.role));
      if (!S.oldestKey || m.id < S.oldestKey) S.oldestKey = m.id;
    });
    if (!firstNode) return;
    var ref = S.topNode && S.topNode.parentNode === els.list ? S.topNode : null;
    if (ref && prevDay === S.firstDay) { var nx = ref.nextSibling; ref.remove(); ref = nx; } /* نفس اليوم: نشيل الفاصل المكرر */
    els.list.insertBefore(frag, ref);
    S.topNode = firstNode;
    S.firstDay = firstDay;
    b.scrollTop = oldTop + (b.scrollHeight - oldH);
    refreshTicks();
    tidyDays();
  }

  /* --- عرض رسالة --- */
  function addMsg(S, m) {
    if (!m || !m.id || S.seen[m.id]) return;
    S.seen[m.id] = 1;
    var at = Number(m.at) || Date.now();
    var mine = m.from === S.role;
    var near = els.body.scrollHeight - els.body.scrollTop - els.body.clientHeight < 140;

    var dk = dayKey(at);
    if (S.lastDay !== dk) {
      S.lastDay = dk;
      var sep = makeSep(at);
      if (!S.topNode) { S.topNode = sep; S.firstDay = dk; }
      els.list.appendChild(sep);
    }
    if (!S.oldestKey || m.id < S.oldestKey) S.oldestKey = m.id;
    if (S.initial) S.initCount++;
    els.list.appendChild(makeRow(S, m, at, mine));
    if (S.liveRow && S.liveRow.parentNode === els.list) els.list.appendChild(S.liveRow);
    if (!S.initial) tidyDays();

    if (S.initial) return;
    if (mine) { refreshTicks(); scrollDown(true); }
    else { markRead(); if (near) scrollDown(true); }
  }

  /* --- الملفات: بتتحمّل من chatFiles وقت العرض --- */
  function loadFile(S, id, m) {
    if (m && m.file && m.file.url) return Promise.resolve(m.file.url); /* ملف على Storage: بيتشغّل بالرابط مباشرة */
    if (!S.urls[id]) {
      S.urls[id] = db().ref("chatFiles/" + S.sid + "/" + id).get().then(function (s) {
        var d = s.val();
        if (!d) throw new Error("NO_FILE");
        return fetch(d).then(function (r) { return r.blob(); }).then(function (b) { return URL.createObjectURL(b); });
      });
      S.urls[id].catch(function () { delete S.urls[id]; });
    }
    return S.urls[id];
  }

  function mountFile(S, box, m) {
    var f = m.file, k = kindOf(f.type);
    if (k === "image") {
      box.innerHTML = '<span class="chat-spin"></span>';
      box.classList.add("is-loading");
      loadFile(S, m.id, m).then(function (url) {
        if (st !== S) return;
        box.classList.remove("is-loading");
        box.innerHTML = "";
        var img = document.createElement("img");
        img.alt = f.name || "";
        img.src = url;
        img.addEventListener("load", function () { scrollDown(false); });
        img.addEventListener("click", function () { els.lb.classList.remove("is-zoomed"); $("img", els.lb).src = url; els.lb.hidden = false; });
        box.appendChild(img);
      }).catch(function () {
        box.classList.remove("is-loading");
        box.innerHTML = '<span class="chat-file__err">تعذر تحميل الصورة</span>';
      });
      return;
    }
    if (k === "audio" && /^voice-/.test(f.name || "")) { mountVoice(S, box, m); return; }
    var icon = k === "video" ? "▶" : k === "audio" ? (/^voice-/.test(f.name || "") ? "🎤" : "♪") : "⬇";
    var label = k === "video" ? "تشغيل الفيديو" : k === "audio" ? "تشغيل الصوت" : "تحميل الملف";
    var isVoice = k === "audio" && /^voice-/.test(f.name || "");
    box.innerHTML =
      '<button type="button" class="chat-card"><span class="chat-card__ico">' + icon + "</span>" +
      '<span class="chat-card__t"><strong dir="auto">' + esc(isVoice ? "رسالة صوتية" : (f.name || "ملف")) + "</strong><small>" + esc(fmtSize(f.size)) + " · " + label + "</small></span></button>";
    $(".chat-card", box).addEventListener("click", function () {
      var btn = this;
      if (f.url && k === "file") {
        var da = document.createElement("a");
        da.href = f.url; da.target = "_blank"; da.rel = "noopener noreferrer"; da.download = f.name || "file";
        document.body.appendChild(da); da.click(); da.remove();
        return;
      }
      btn.classList.add("is-busy");
      loadFile(S, m.id, m).then(function (url) {
        if (k === "video" || k === "audio") {
          box.innerHTML = "";
          var el = document.createElement(k);
          el.controls = true;
          el.src = url;
          if (k === "video") el.setAttribute("playsinline", "");
          el.preload = "metadata";
          box.appendChild(el);
          el.play && el.play().catch(function () { });
        } else {
          var a = document.createElement("a");
          a.href = url; a.download = f.name || "file";
          document.body.appendChild(a); a.click(); a.remove();
          btn.classList.remove("is-busy");
        }
      }).catch(function () {
        btn.classList.remove("is-busy");
        if (st === S) toast("تعذر تحميل الملف، جرّب تاني.");
      });
    });
  }

  /* --- الإرسال --- */
  function touchMeta(S, preview) {
    var m = db().ref("chatMeta/" + S.sid);
    var upd = { lastText: String(preview).slice(0, 120), lastAt: TS(), lastFrom: S.role };
    if (S.role === "student") { upd.name = S.studentName || ""; upd.studentId = S.sid; }
    m.update(upd).catch(function () { });
    m.child(S.role === "student" ? "unreadAdmin" : "unreadStudent").transaction(function (n) { return (Number(n) || 0) + 1; });
  }

  function sendText() {
    if (!st) return;
    var S = st, text = els.input.value.replace(/\s+$/g, "");
    if (!text.trim()) return;
    if (text.length > 4000) { toast("الرسالة طويلة قوي (الحد 4000 حرف)."); return; }
    els.input.value = "";
    autosize();
    updateBtns();
    var ref = db().ref("chatMessages/" + S.sid).push();
    var tmsg = { id: ref.key, from: S.role, text: text, at: TS() };
    var trp = takeReply(S);
    if (trp) tmsg.reply = trp;
    clearTimeout(S.typTimer);
    setMyState(S, null);
    ref.set(tmsg)
      .then(function () { touchMeta(S, text); })
      .catch(function () { toast("تعذر إرسال الرسالة. اتأكد من الاتصال."); });
    els.input.focus();
  }

  function readDataUrl(file) {
    return new Promise(function (res, rej) {
      var r = new FileReader();
      r.onload = function () { res(r.result); };
      r.onerror = function () { rej(new Error("READ")); };
      r.readAsDataURL(file);
    });
  }
  function loadBitmap(file) {
    if (window.createImageBitmap) {
      return createImageBitmap(file, { imageOrientation: "from-image" })
        .then(function (b) { return { src: b, w: b.width, h: b.height, done: function () { b.close && b.close(); } }; })
        .catch(function () { return loadImg(file); });
    }
    return loadImg(file);
  }
  function loadImg(file) {
    return new Promise(function (res, rej) {
      var url = URL.createObjectURL(file), img = new Image();
      img.onload = function () { URL.revokeObjectURL(url); res({ src: img, w: img.naturalWidth, h: img.naturalHeight, done: function () { } }); };
      img.onerror = function () { URL.revokeObjectURL(url); rej(new Error("BAD_IMAGE")); };
      img.src = url;
    });
  }
  /* الصور بتتصغّر لحد 1600px وبتتحفظ JPEG عشان قاعدة البيانات تفضل خفيفة وسريعة */
  function compressImage(file) {
    return loadBitmap(file).then(function (bm) {
      if (!bm.w || !bm.h) throw new Error("BAD_IMAGE");
      var sc = Math.min(1, 1600 / Math.max(bm.w, bm.h));
      var c = document.createElement("canvas");
      c.width = Math.max(1, Math.round(bm.w * sc));
      c.height = Math.max(1, Math.round(bm.h * sc));
      var ctx = c.getContext("2d");
      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, c.width, c.height);
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(bm.src, 0, 0, c.width, c.height);
      bm.done();
      return c.toDataURL("image/jpeg", 0.82);
    });
  }

  function storageOk() {
    try { return !!(firebase.storage && firebase.app().options.storageBucket); } catch (e) { return false; }
  }
  function setPend(txt) { var t = els.pend.lastElementChild; if (t) t.textContent = txt; }
  function uploadToStorage(S, key, file, type, onProg) {
    var safe = (file.name || "file").replace(/[^A-Za-z0-9._-]/g, "_").slice(-80) || "file";
    var path = "chat/" + S.sid + "/" + key + "/" + safe;
    var ref = firebase.storage().ref(path);
    var task = ref.put(file, { contentType: type });
    return new Promise(function (res, rej) {
      task.on("state_changed", function (s) { if (s.totalBytes) onProg(s.bytesTransferred / s.totalBytes); }, rej, function () {
        ref.getDownloadURL().then(function (u) { res({ url: u, path: path }); }, rej);
      });
    });
  }

  async function sendFile(file, caption) {
    if (!st || !file) return;
    var S = st;
    var type = file.type || "application/octet-stream";
    var name = file.name || "file";
    var isImg = /^image\//.test(type);
    var wantStore = storageOk() && (kindOf(type) === "video" || (!isImg && file.size > STORE_MIN));
    var reply = takeReply(S);
    var data = null, extra = null, size = 0;
    S.pending++; els.pend.hidden = false; setPend("جاري إرسال الملف…");
    try {
      if (wantStore) {
        if (file.size > STORE_MAX) { toast("الملف أكبر من " + fmtSize(STORE_MAX) + " — اختار ملف أصغر."); return; }
        var key = db().ref("chatMessages/" + S.sid).push().key;
        try {
          extra = await uploadToStorage(S, key, file, type, function (p) { setPend("جاري رفع الملف… " + Math.round(p * 100) + "%"); });
          extra.key = key; size = file.size;
        } catch (e) {
          extra = null;
          if (file.size > MAX_BYTES) { toast("تعذر رفع الملف. اتأكد من الاتصال وجرّب تاني."); return; }
        }
        setPend("جاري إرسال الملف…");
      }
      if (!extra) {
        if (isImg && type !== "image/gif" && type !== "image/svg+xml") {
          try {
            data = await compressImage(file);
            type = "image/jpeg";
            name = name.replace(/\.[^.]+$/, "") + ".jpg";
          } catch (e) { data = null; }
        }
        if (!data) {
          if (file.size > MAX_BYTES) { toast("الملف أكبر من " + fmtSize(MAX_BYTES) + " — اختار ملف أصغر."); return; }
          data = await readDataUrl(file);
        }
        size = Math.round((data.length - data.indexOf(",") - 1) * 0.75);
        if (size > MAX_BYTES) { toast("الملف أكبر من " + fmtSize(MAX_BYTES) + " — اختار ملف أصغر."); return; }
      }
      var msgs = db().ref("chatMessages/" + S.sid);
      var ref = extra ? msgs.child(extra.key) : msgs.push();
      if (!extra) await db().ref("chatFiles/" + S.sid + "/" + ref.key).set(data);
      var fobj = { name: name, type: type, size: size };
      if (file._dur) fobj.dur = Math.round(file._dur / 1000);
      if (extra) { fobj.url = extra.url; fobj.path = extra.path; }
      var msg = { id: ref.key, from: S.role, at: TS(), file: fobj };
      if (caption) msg.text = caption;
      if (reply) msg.reply = reply;
      await ref.set(msg);
      touchMeta(S, caption || previewOf({ file: { type: type, name: name } }));
    } catch (e) {
      toast("تعذر إرسال الملف. اتأكد من الاتصال وجرّب تاني.");
    } finally {
      S.pending--;
      if (!S.pending) els.pend.hidden = true;
    }
  }

  /* ======================= جهة الطالب ======================= */
  function session() {
    try {
      var s = JSON.parse(localStorage.getItem("shadynasr-current-user"));
      return s && s.id && localStorage.getItem("shadynasr-auth") ? s : null;
    } catch (e) { return null; }
  }

  var studentReady = false;
  function initStudent() {
    var fab = document.getElementById("chatFab");
    if (!fab || studentReady) return;
    studentReady = true;
    var s = session();
    if (!s || s.role === "admin") { fab.hidden = true; return; }
    var badge = $(".chat-badge", fab);
    db().ref("chatMeta/" + s.id + "/unreadStudent").on("value", function (sn) {
      var n = Number(sn.val()) || 0;
      if (badge) { badge.textContent = n > 99 ? "99+" : String(n); badge.hidden = !n; }
    }, function () { });
    fab.addEventListener("click", function () {
      openConv({
        role: "student", sid: s.id, name: ADMIN_NAME, photo: ADMIN_PHOTO, subtitle: ADMIN_SUB,
        welcome: true, studentName: s.fullName
      });
    });
  }

  /* ======================= جهة الأدمن ======================= */
  var AL = null;

  function initAdminList(o) {
    AL = { o: o, metas: {}, activeSid: null };
    var mq = window.matchMedia("(min-width: 900px)");
    function onMq() {
      if (!st || st.role !== "admin") return;
      var sid = st.sid;
      closeConv();
      setTimeout(function () { openAdmin(sid); }, 80);
    }
    if (mq.addEventListener) mq.addEventListener("change", onMq); else if (mq.addListener) mq.addListener(onMq);
    if (o.searchEl) o.searchEl.addEventListener("input", renderList);
    o.listEl.addEventListener("click", function (e) {
      var r = e.target.closest("[data-chat]");
      if (r) openAdmin(r.dataset.chat);
    });
    db().ref("chatMeta").on("value", function (snap) {
      AL.metas = snap.val() || {};
      renderList();
      var total = 0;
      Object.keys(AL.metas).forEach(function (k) { if ((Number((AL.metas[k] || {}).unreadAdmin) || 0) > 0) total += 1; /* عدد الطلاب اللي بعتوا، مش عدد الرسايل */ });
      if (o.onTotal) o.onTotal(total);
    }, function () {
      o.listEl.innerHTML = '<div class="ad-empty">تعذر تحميل المحادثات — راجع قواعد Firebase (chatMeta).</div>';
    });
  }

  function userOf(sid) { return AL && AL.o.getUser ? AL.o.getUser(sid) : null; }

  function renderList() {
    if (!AL) return;
    var q = AL.o.searchEl ? AL.o.searchEl.value.trim().toLowerCase() : "";
    var rows = Object.keys(AL.metas).map(function (sid) {
      var m = AL.metas[sid] || {}, u = userOf(sid);
      return { sid: sid, m: m, u: u, name: (u && u.fullName) || m.name || "طالب" };
    }).filter(function (r) {
      return r.m.lastAt && (!q || r.name.toLowerCase().indexOf(q) > -1);
    }).sort(function (a, b) { return (Number(b.m.lastAt) || 0) - (Number(a.m.lastAt) || 0); });

    if (!rows.length) {
      AL.o.listEl.innerHTML = '<div class="ad-empty">' + (q ? "مفيش نتائج للبحث ده." : "مفيش محادثات لسه — أول ما طالب يبعتلك رسالة هتظهر هنا.") + "</div>";
      return;
    }
    AL.o.listEl.innerHTML = rows.map(function (r) {
      var photo = r.u && validPhoto(r.u.photoURL) ? r.u.photoURL : "";
      var unread = Number(r.m.unreadAdmin) || 0;
      var tick = r.m.lastFrom === "admin"
        ? '<span class="chat-tick' + ((Number(r.m.studentReadAt) || 0) >= (Number(r.m.lastAt) || 0) ? " is-read" : "") + '">' + TICK + "</span>" : "";
      return '<button type="button" class="chat-row' + (r.sid === AL.activeSid ? " is-active" : "") + '" data-chat="' + esc(r.sid) + '">' +
        '<span class="chat-av">' + (photo ? '<img src="' + photo + '" alt="" />' : esc(initial(r.name))) + "</span>" +
        '<span class="chat-row__main"><span class="chat-row__top"><strong dir="auto">' + esc(r.name) + "</strong>" +
        '<time class="' + (unread ? "is-unread" : "") + '">' + esc(listTime(Number(r.m.lastAt))) + "</time></span>" +
        '<span class="chat-row__bot"><span class="chat-row__txt" dir="auto">' + tick + "<span>" + esc(r.m.lastText || "") + "</span></span>" +
        (unread ? '<span class="chat-badge">' + (unread > 99 ? "99+" : unread) + "</span>" : "") + "</span></span></button>";
    }).join("");
  }

  function openAdmin(sid) {
    var u = userOf(sid), m = (AL && AL.metas[sid]) || {};
    var embed = AL.o.paneEl && window.matchMedia("(min-width: 900px)").matches ? AL.o.paneEl : null;
    if (embed) {
      AL.activeSid = sid;
      if (AL.o.emptyEl) AL.o.emptyEl.hidden = true;
      renderList();
    }
    openConv({
      embed: embed,
      role: "admin", sid: sid,
      name: (u && u.fullName) || m.name || "طالب",
      photo: u && validPhoto(u.photoURL) ? u.photoURL : "",
      subtitle: AL.o.getSubtitle ? AL.o.getSubtitle(u) : "",
      onPeer: AL.o.onProfile
    });
  }

  window.SNChat = {
    initAdminList: initAdminList,
    refreshList: renderList,
    openAdmin: openAdmin
  };

  document.addEventListener("DOMContentLoaded", initStudent);
  if (document.readyState !== "loading") initStudent();
})();

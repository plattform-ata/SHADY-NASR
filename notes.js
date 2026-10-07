/* ==========================================================================
   notes.js — الملاحظات في أدوات الإنتاجية (بديل "المفكرة السريعة")
   - الصفحة الرئيسية: كروت (مستطيلات) لكل ملاحظة، وزرار + عائم لإضافة ملاحظة جديدة.
   - الضغط على كارت أو على + بيفتح صفحة كاملة للكتابة/التعديل (عنوان + نص).
   - الحفظ بزرار "حفظ" (✓) صراحةً. وفيه تراجع/إعادة، ونسخ، وحذف.
   - التخزين: localStorage + Firebase (userData/{id}/notesList) عن طريق syncSet اللي بيجي من dashboard.js.
   يتحمّل في studenti.html قبل dashboard.js.
   ========================================================================== */
(() => {
  "use strict";
  const VERSION = "20";

  const TXT = {
    ar: {
      title: "الملاحظات",
      empty: "لسه مفيش ملاحظات — اضغط على + وابدأ اكتب.", untitled: "بدون عنوان", noText: "لا يوجد نص",
      newNote: "ملاحظة جديدة", ph_title: "العنوان", ph_body: "اكتب هنا",
      back: "رجوع", undo: "تراجع", redo: "إعادة", save: "حفظ", more: "المزيد",
      copy: "نسخ النص", del: "حذف الملاحظة", copied: "تم نسخ النص", saved: "تم حفظ الملاحظة", deleted: "تم حذف الملاحظة",
      needText: "اكتب عنوان أو نص الأول", search: "ابحث في الملاحظات", noResults: "مفيش ملاحظات مطابقة للبحث.",
      pin: "تثبيت الملاحظة", unpin: "إلغاء التثبيت", color: "لون الكارت", c_none: "بدون لون", c_red: "أحمر", c_orange: "برتقالي", c_yellow: "أصفر", c_green: "أخضر", c_blue: "أزرق", c_purple: "بنفسجي", c_pink: "وردي",
      fmt_font: "الخط والحجم", f_family: "نوع الخط", f_size: "حجم الخط",
      fmt_b: "غامق", fmt_i: "مائل", fmt_u: "تحته خط", fmt_s: "يتوسطه خط", fmt_ul: "قائمة نقطية", fmt_ol: "قائمة مرقّمة", fmt_chk: "قائمة مهام", fmt_q: "اقتباس", fmt_hr: "فاصل",
      fam_def: "الافتراضي", fam_cairo: "القاهرة", fam_tajawal: "تجوال", fam_amiri: "أميري", fam_serif: "سيريف", fam_mono: "أحادي", fam_hand: "يدوي",
      sz_s: "صغير", sz_n: "عادي", sz_m: "متوسط", sz_l: "كبير", sz_xl: "ضخم", tools: "أدوات التنسيق",
      discard_t: "تجاهل التغييرات؟", discard_m: "فيه تعديلات لسه ما اتحفظتش. لو رجعت دلوقتي هتضيع.",
      discard_y: "تجاهل", discard_n: "كمّل كتابة",
      del_t: "حذف الملاحظة", del_m: "متأكد إنك عايز تحذف الملاحظة دي؟ مش هتقدر ترجعها.", del_y: "حذف", del_n: "إلغاء",
      legacy: "ملاحظاتي القديمة",
    },
    en: {
      title: "Notes",
      empty: "No notes yet — tap + and start writing.", untitled: "Untitled", noText: "No text",
      newNote: "New note", ph_title: "Title", ph_body: "Write here",
      back: "Back", undo: "Undo", redo: "Redo", save: "Save", more: "More",
      copy: "Copy text", del: "Delete note", copied: "Text copied", saved: "Note saved", deleted: "Note deleted",
      needText: "Write a title or some text first", search: "Search notes", noResults: "No notes match your search.",
      pin: "Pin note", unpin: "Unpin", color: "Card color", c_none: "No color", c_red: "Red", c_orange: "Orange", c_yellow: "Yellow", c_green: "Green", c_blue: "Blue", c_purple: "Purple", c_pink: "Pink",
      fmt_font: "Font & size", f_family: "Font", f_size: "Size",
      fmt_b: "Bold", fmt_i: "Italic", fmt_u: "Underline", fmt_s: "Strikethrough", fmt_ul: "Bulleted list", fmt_ol: "Numbered list", fmt_chk: "Checklist", fmt_q: "Quote", fmt_hr: "Divider",
      fam_def: "Default", fam_cairo: "Cairo", fam_tajawal: "Tajawal", fam_amiri: "Amiri", fam_serif: "Serif", fam_mono: "Mono", fam_hand: "Handwriting",
      sz_s: "Small", sz_n: "Normal", sz_m: "Medium", sz_l: "Large", sz_xl: "Huge", tools: "Formatting tools",
      discard_t: "Discard changes?", discard_m: "You have unsaved changes. They'll be lost if you go back now.",
      discard_y: "Discard", discard_n: "Keep writing",
      del_t: "Delete note", del_m: "Are you sure you want to delete this note? You can't undo this.", del_y: "Delete", del_n: "Cancel",
      legacy: "My old notes",
    },
  };
  const lang = () => (document.documentElement.lang === "en" ? "en" : "ar");
  const tr = (k) => TXT[lang()][k] || TXT.ar[k] || k;
  const isRtl = () => getComputedStyle(document.documentElement).direction === "rtl";

  let user = null;
  let sync = () => {};
  let notes = [];

  const KEY = () => `bloom-notes-list-${user.id}`;
  const LEGACY = () => `bloom-notes-${user.id}`;
  const FLAG = () => `bloom-notes-migrated-${user.id}`;

  const uid = () => "n" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const valid = (n) => n && typeof n === "object" && typeof n.id === "string";
  const COLORS = [
    { k: "red", h: "#e5484d" }, { k: "orange", h: "#f08c2e" }, { k: "yellow", h: "#e5b800" }, { k: "green", h: "#3fa56b" },
    { k: "blue", h: "#3b82d6" }, { k: "purple", h: "#8b5cc8" }, { k: "pink", h: "#d6569b" },
  ];
  const hueOf = (k) => { const c = COLORS.find((x) => x.k === k); return c ? c.h : ""; };
  const clean = (n) => ({
    id: n.id,
    title: String(n.title || "").slice(0, 120),
    body: String(n.body || "").slice(0, 80000),
    pinned: n.pinned ? 1 : 0,
    color: hueOf(n.color) ? n.color : "",
    fmt: n.fmt ? 1 : 0, // 1 = النص محفوظ كـ HTML منسّق، 0 = نص عادي (ملاحظات قديمة)
    created: Number(n.created) || Date.now(),
    updated: Number(n.updated) || Number(n.created) || Date.now(),
  });

  function load() {
    try {
      const raw = JSON.parse(localStorage.getItem(KEY()));
      notes = Array.isArray(raw) ? raw.filter(valid).map(clean) : [];
    } catch { notes = []; }
  }
  function persist() {
    try { localStorage.setItem(KEY(), JSON.stringify(notes)); } catch { /* ignore */ }
    const map = {};
    notes.forEach((n) => { map[n.id] = n; });
    sync("notesList", notes.length ? map : null);
  }

  /* المفكرة القديمة كانت نص واحد: نحوّله لملاحظة واحدة مرة واحدة بس */
  function migrateLegacy(text) {
    try { localStorage.setItem(FLAG(), "1"); } catch { /* ignore */ }
    const t = String(text || "").trim();
    if (!t) return false;
    const now = Date.now();
    notes.unshift(clean({ id: uid(), title: tr("legacy"), body: t, created: now, updated: now }));
    return true;
  }

  /* ---------- تنظيف الـ HTML (قائمة بيضاء: تنسيق بس، مفيش سكريبتات ولا روابط ولا صور) ---------- */
  const OK_TAGS = new Set(["B", "STRONG", "I", "EM", "U", "S", "STRIKE", "DEL", "UL", "OL", "LI", "BLOCKQUOTE", "HR", "BR", "DIV", "P", "SPAN", "FONT"]);
  const DROP_TAGS = new Set(["SCRIPT", "STYLE", "IFRAME", "OBJECT", "EMBED", "NOSCRIPT", "TEMPLATE", "SVG", "MATH"]);
  const FONT_PX = { 1: 10, 2: 13, 3: 16, 4: 18, 5: 24, 6: 32, 7: 48 }; // نفس مقاسات المتصفح لـ <font size>
  const FAMILY_RE = /^[A-Za-z][A-Za-z0-9 \-]{0,38}$/;

  function sanitize(html) {
    const doc = new DOMParser().parseFromString("<body>" + String(html || "") + "</body>", "text/html");
    const out = document.createElement("div");
    (function walk(src, dst) {
      src.childNodes.forEach((n) => {
        if (n.nodeType === 3) { dst.appendChild(document.createTextNode(n.nodeValue)); return; }
        if (n.nodeType !== 1) return;
        const tag = n.tagName.toUpperCase();
        if (DROP_TAGS.has(tag)) return;
        if (!OK_TAGS.has(tag)) { walk(n, dst); return; }
        let el;
        if (tag === "FONT" || tag === "SPAN") {
          el = document.createElement("span");
          let size = 0, fam = "";
          if (tag === "FONT") {
            size = FONT_PX[parseInt(n.getAttribute("size"), 10)] || 0;
            fam = (n.getAttribute("face") || "").split(",")[0].replace(/["']/g, "").trim();
          } else {
            const m = /^(\d+(?:\.\d+)?)px$/.exec(n.style.fontSize || "");
            if (m && +m[1] >= 8 && +m[1] <= 80) size = +m[1];
            fam = (n.style.fontFamily || "").split(",")[0].replace(/["']/g, "").trim();
          }
          if (size) el.style.fontSize = size + "px";
          if (FAMILY_RE.test(fam)) el.style.fontFamily = /^(serif|sans-serif|monospace|cursive)$/i.test(fam) ? fam.toLowerCase() : '"' + fam + '"';
        } else {
          el = document.createElement(tag.toLowerCase());
          if (tag === "UL" && n.classList.contains("sn-check")) el.className = "sn-check";
          if (tag === "LI" && n.classList.contains("done")) el.className = "done";
        }
        if (tag !== "HR" && tag !== "BR") walk(n, el);
        dst.appendChild(el);
      });
    })(doc.body, out);
    return out.innerHTML;
  }
  const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const toHtml = (n) => (n.fmt ? sanitize(n.body) : esc(n.body).replace(/\r?\n/g, "<br>"));
  function toText(n) {
    const html = n.fmt ? sanitize(n.body) : esc(n.body);
    const d = document.createElement("div");
    d.innerHTML = html.replace(/<\/(div|p|li|blockquote)>|<br\s*\/?>|<hr\s*\/?>/gi, " ");
    return (d.textContent || "").replace(/\s+/g, " ").trim();
  }

  /* ---------- رسم الكروت ---------- */
  function fmtDate(ts) {
    try {
      return new Date(ts).toLocaleDateString(lang() === "en" ? "en-GB" : "ar-EG", { day: "numeric", month: "short", year: "numeric" });
    } catch { return ""; }
  }

  const ICONS = {
    backR: "M5 12h14M12 5l7 7-7 7",
    backL: "M19 12H5M12 19l-7-7 7-7",
    undo: "M9 14 4 9l5-5M4 9h10a6 6 0 0 1 0 12h-3",
    redo: "m15 14 5-5-5-5M20 9H10a6 6 0 0 0 0 12h3",
    check: "m5 12 4 4L19 6",
    more: "M12 5v.01M12 12v.01M12 19v.01",
    pin: "M12 17v5M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V7a1 1 0 0 1 1-1 2 2 0 0 0 0-4H8a2 2 0 0 0 0 4 1 1 0 0 1 1 1z",
    trash: "M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3",
    ul: "M9 6h11M9 12h11M9 18h11M4.5 6v.01M4.5 12v.01M4.5 18v.01",
    ol: "M10 6h10M10 12h10M10 18h10M4 5l1.5-1v4M3.8 13.5c.4-1.2 2.6-1 2.2.6L4 16h2.4M4 19h2l-1 1.2a1.2 1.2 0 1 1-1 2",
    chk: "M4 5h6v6H4zM5.5 8l1.2 1.2L9 6.8M13 8h7M4 15h6v6H4zM13 18h7",
    hr: "M4 12h16",
    q: "M7 8h4v4a4 4 0 0 1-4 4M15 8h4v4a4 4 0 0 1-4 4",
  };
  function svgIcon(path, w) {
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="' + (w || 2) + '" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="' + path + '"/></svg>';
  }
  function iconBtn(cls, path, label, w) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "sn-ne__btn " + cls;
    b.setAttribute("aria-label", label);
    b.title = label;
    b.innerHTML = svgIcon(path, w);
    keepFocus(b);
    return b;
  }
  /* الأزرار ما تسرقش الفوكس من خانة الكتابة (عشان الكيبورد ما يقفلش والتحديد يفضل) */
  function keepFocus(el) {
    el.addEventListener("pointerdown", (e) => e.preventDefault());
    el.addEventListener("mousedown", (e) => e.preventDefault());
  }
  function toast(msg, err) {
    if (editorOpen && editorOpen.toast) { editorOpen.toast(msg, err); return; }
    if (window.snDialog && window.snDialog.toast) window.snDialog.toast(msg, { error: !!err });
  }
  async function ask(o) {
    if (editorOpen && editorOpen.confirm) return editorOpen.confirm(o);
    if (window.snDialog && window.snDialog.confirm) return window.snDialog.confirm(o);
    return window.confirm(o.message);
  }

  async function removeNote(id) {
    const ok = await ask({ icon: "trash", tone: "danger", title: tr("del_t"), message: tr("del_m"), confirmText: tr("del_y"), cancelText: tr("del_n") });
    if (!ok) return false;
    notes = notes.filter((n) => n.id !== id);
    persist();
    render();
    setTimeout(() => toast(tr("deleted")), 0); // بعد ما صفحة الكتابة (لو مفتوحة) تقفل
    return true;
  }

  let query = "";

  function render() {
    const grid = document.getElementById("notesGrid");
    if (!grid) return;
    const h = document.getElementById("notesTitle");
    if (h) h.textContent = tr("title");
    const add = document.getElementById("notesAddBtn");
    if (add) add.setAttribute("aria-label", tr("newNote"));
    const sbox = document.getElementById("notesSearchWrap");
    if (sbox) {
      sbox.hidden = !notes.length;
      const si = sbox.querySelector("input");
      si.placeholder = tr("search");
      si.setAttribute("aria-label", tr("search"));
    }

    grid.textContent = "";
    if (!notes.length) {
      const p = document.createElement("p");
      p.className = "sn-notes-empty";
      p.textContent = tr("empty");
      grid.appendChild(p);
      return;
    }
    const q = query.trim().toLowerCase();
    const list = notes
      .filter((n) => !q || (n.title + " " + toText(n)).toLowerCase().includes(q))
      .sort((a, b) => (b.pinned - a.pinned) || (b.updated - a.updated));
    if (!list.length) {
      const p = document.createElement("p");
      p.className = "sn-notes-empty";
      p.textContent = tr("noResults");
      grid.appendChild(p);
      return;
    }
    list.forEach((n) => {
      const wrap = document.createElement("div");
      wrap.className = "sn-note-wrap";
      const card = document.createElement("button");
      card.type = "button";
      card.className = "sn-note-card";
      const hue = hueOf(n.color);
      if (hue) { card.classList.add("has-color"); card.style.setProperty("--nc", hue); }
      const t = document.createElement("strong");
      t.className = "sn-note-card__title";
      t.textContent = n.title || tr("untitled");
      const d = document.createElement("small");
      d.className = "sn-note-card__date";
      d.textContent = fmtDate(n.updated);
      const b = document.createElement("span");
      b.className = "sn-note-card__body";
      b.textContent = toText(n).slice(0, 220) || tr("noText");
      card.append(t, d, b);
      card.addEventListener("click", () => openEditor(n.id));

      const del = document.createElement("button");
      del.type = "button";
      del.className = "sn-note-del";
      del.setAttribute("aria-label", tr("del"));
      del.title = tr("del");
      del.innerHTML = svgIcon(ICONS.trash, 2);
      del.addEventListener("click", (e) => { e.stopPropagation(); removeNote(n.id); });

      const pin = document.createElement("button");
      pin.type = "button";
      pin.className = "sn-note-pin" + (n.pinned ? " is-on" : "");
      pin.setAttribute("aria-pressed", String(!!n.pinned));
      pin.setAttribute("aria-label", tr(n.pinned ? "unpin" : "pin"));
      pin.title = tr(n.pinned ? "unpin" : "pin");
      pin.innerHTML = svgIcon(ICONS.pin, 2);
      pin.addEventListener("click", (e) => {
        e.stopPropagation();
        n.pinned = n.pinned ? 0 : 1;
        persist();
        render();
      });

      wrap.append(card, del, pin);
      grid.appendChild(wrap);
    });
  }

  /* ---------- ألوان الصفحة (من الثيم الحالي) ---------- */
  const opaque = (c) => c && c !== "transparent" && !/rgba\(\s*\d+,\s*\d+,\s*\d+,\s*0\s*\)/.test(c);
  function pageColors() {
    const els = [document.body, document.documentElement, document.querySelector(".dash-card")];
    let bg = "";
    for (const el of els) {
      if (!el) continue;
      const c = getComputedStyle(el).backgroundColor;
      if (opaque(c)) { bg = c; break; }
    }
    const fg = getComputedStyle(document.body).color || "#111";
    if (!bg) {
      const m = fg.match(/\d+/g) || [0, 0, 0];
      const lum = (Number(m[0]) * 299 + Number(m[1]) * 587 + Number(m[2]) * 114) / 1000;
      bg = lum > 140 ? "#1f2023" : "#f7f4ec";
    }
    // لون التمييز بتاع المنصة: بناخده من زرار + نفسه (btn--accent) فيماشي أي ثيم
    let accent = "";
    const probe = document.getElementById("notesAddBtn");
    if (probe) { const c = getComputedStyle(probe).backgroundColor; if (opaque(c)) accent = c; }
    return { bg, fg, accent: accent || "#2c8097" };
  }

  /* ---------- صفحة الكتابة/التعديل ---------- */
  let editorOpen = null;

  const FAMILIES = [
    { k: "fam_def", v: "" },
    { k: "fam_cairo", v: "Cairo" },
    { k: "fam_tajawal", v: "Tajawal" },
    { k: "fam_amiri", v: "Amiri" },
    { k: "fam_serif", v: "serif" },
    { k: "fam_mono", v: "monospace" },
    { k: "fam_hand", v: "cursive" },
  ];
  const SIZES = [
    { k: "sz_s", v: 2, px: 13 },
    { k: "sz_n", v: 3, px: 16 },
    { k: "sz_m", v: 4, px: 18 },
    { k: "sz_l", v: 5, px: 24 },
    { k: "sz_xl", v: 6, px: 32 },
  ];

  function openEditor(id) {
    if (editorOpen) return;
    loadFonts();
    const existing = id ? notes.find((n) => n.id === id) : null;
    const rtl = isRtl();
    const colors = pageColors();

    const root = document.createElement("div");
    root.className = "sn-ne";
    root.setAttribute("role", "dialog");
    root.setAttribute("aria-modal", "true");
    root.dir = rtl ? "rtl" : "ltr";
    root.style.setProperty("--ne-bg", colors.bg);
    root.style.setProperty("--ne-fg", colors.fg);
    root.style.setProperty("--ne-accent", colors.accent);

    /* الشريط العلوي */
    const bar = document.createElement("div");
    bar.className = "sn-ne__bar";
    const backBtn = iconBtn("sn-ne__back", rtl ? ICONS.backR : ICONS.backL, tr("back"));
    const spacer = document.createElement("span");
    spacer.className = "sn-ne__spacer";
    const undoBtn = iconBtn("", ICONS.undo, tr("undo"));
    const redoBtn = iconBtn("", ICONS.redo, tr("redo"));
    const saveBtn = iconBtn("sn-ne__save", ICONS.check, tr("save"), 2.8);
    const moreBtn = iconBtn("", ICONS.more, tr("more"), 3);
    bar.append(backBtn, spacer, undoBtn, redoBtn, saveBtn, moreBtn);

    const menu = document.createElement("div");
    menu.className = "sn-ne__menu";
    menu.hidden = true;
    const copyItem = document.createElement("button");
    copyItem.type = "button";
    copyItem.textContent = tr("copy");
    let pinned = existing ? existing.pinned : 0;
    let color = existing ? existing.color : "";
    const initPinned = pinned;
    const initColor = color;
    root.style.setProperty("--ne-note", hueOf(color) || "transparent");
    const pinItem = document.createElement("button");
    pinItem.type = "button";
    const paintPin = () => { pinItem.textContent = tr(pinned ? "unpin" : "pin"); };
    paintPin();
    pinItem.addEventListener("click", () => { pinned = pinned ? 0 : 1; paintPin(); menu.hidden = true; });
    const colorLabel = document.createElement("div");
    colorLabel.className = "sn-ne__menulabel";
    colorLabel.textContent = tr("color");
    const colorRow = document.createElement("div");
    colorRow.className = "sn-ne__colors";
    const dots = [];
    const paintDots = () => dots.forEach((d) => { const on = d.k === color; d.el.classList.toggle("is-on", on); d.el.setAttribute("aria-pressed", String(on)); });
    [{ k: "", h: "" }].concat(COLORS).forEach((c) => {
      const el = document.createElement("button");
      el.type = "button";
      el.className = "sn-ne__dot" + (c.k ? "" : " is-none");
      if (c.h) el.style.background = c.h;
      el.setAttribute("aria-label", tr(c.k ? "c_" + c.k : "c_none"));
      el.title = tr(c.k ? "c_" + c.k : "c_none");
      el.addEventListener("click", (e) => {
        e.stopPropagation();
        color = c.k;
        root.style.setProperty("--ne-note", c.h || "transparent");
        paintDots();
      });
      dots.push({ k: c.k, el });
      colorRow.appendChild(el);
    });
    paintDots();
    menu.append(pinItem, colorLabel, colorRow);
    menu.appendChild(copyItem);
    const ver = document.createElement("div");
    ver.className = "sn-ne__menulabel sn-ne__ver";
    ver.textContent = "v" + VERSION;
    let delItem = null;
    if (existing) {
      delItem = document.createElement("button");
      delItem.type = "button";
      delItem.className = "is-danger";
      delItem.textContent = tr("del");
      menu.appendChild(delItem);
    }
    menu.appendChild(ver);

    /* العنوان + النص */
    const titleIn = document.createElement("input");
    titleIn.type = "text";
    titleIn.className = "sn-ne__title";
    titleIn.maxLength = 120;
    titleIn.placeholder = tr("ph_title");
    titleIn.enterKeyHint = "next";
    titleIn.value = existing ? existing.title : "";

    const bodyIn = document.createElement("div");
    bodyIn.className = "sn-ne__body";
    bodyIn.contentEditable = "true";
    bodyIn.spellcheck = true;
    bodyIn.setAttribute("role", "textbox");
    bodyIn.setAttribute("aria-multiline", "true");
    bodyIn.dataset.ph = tr("ph_body");
    bodyIn.innerHTML = existing ? toHtml(existing) : "";
    const paintEmpty = () => {
      const empty = !bodyIn.textContent.trim() && !bodyIn.querySelector("li,hr,blockquote");
      bodyIn.classList.toggle("is-empty", empty);
    };

    /* لوحة الخط والحجم */
    const panel = document.createElement("div");
    panel.className = "sn-ne__panel";
    panel.hidden = true;
    const famChips = [];
    const sizeChips = [];
    const mkRow = (label, items, onPick, styler, store) => {
      const row = document.createElement("div");
      row.className = "sn-ne__row";
      const l = document.createElement("span");
      l.className = "sn-ne__rowlabel";
      l.textContent = label;
      const chips = document.createElement("div");
      chips.className = "sn-ne__chips";
      items.forEach((it) => {
        const c = document.createElement("button");
        c.type = "button";
        c.className = "sn-ne__chip";
        c.textContent = tr(it.k);
        if (styler) styler(c, it);
        keepFocus(c);
        c.addEventListener("click", () => onPick(it));
        chips.appendChild(c);
        store.push({ el: c, it });
      });
      row.append(l, chips);
      return row;
    };
    panel.append(
      mkRow(tr("f_family"), FAMILIES, (it) => {
        const fam = it.v || (getComputedStyle(document.body).fontFamily.split(",")[0].replace(/["']/g, "").trim() || "sans-serif");
        run("fontName", fam);
      }, (c, it) => { if (it.v) c.style.fontFamily = it.v; }, famChips),
      mkRow(tr("f_size"), SIZES, (it) => run("fontSize", String(it.v)), (c, it) => { c.style.fontSize = Math.min(it.px, 22) + "px"; }, sizeChips)
    );

    /* شريط أدوات التنسيق (تحت، فوق الكيبورد) */
    const tools = document.createElement("div");
    tools.className = "sn-ne__tools";
    tools.setAttribute("role", "toolbar");
    tools.setAttribute("aria-label", tr("tools"));
    const btns = {};
    const addTool = (key, html, label, fn, cls) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "sn-ne__tool" + (cls ? " " + cls : "");
      b.setAttribute("aria-label", label);
      b.title = label;
      b.innerHTML = html;
      keepFocus(b);
      b.addEventListener("click", fn);
      tools.appendChild(b);
      btns[key] = b;
      return b;
    };
    addTool("font", "Aa", tr("fmt_font"), () => { panel.hidden = !panel.hidden; btns.font.classList.toggle("is-on", !panel.hidden); focusBody(); paintState(); }, "sn-ne__tool--aa");
    addTool("bold", "B", tr("fmt_b"), () => run("bold"), "t-b");
    addTool("italic", "I", tr("fmt_i"), () => run("italic"), "t-i");
    addTool("underline", "U", tr("fmt_u"), () => run("underline"), "t-u");
    addTool("strikeThrough", "S", tr("fmt_s"), () => run("strikeThrough"), "t-s");
    addTool("ul", svgIcon(ICONS.ul), tr("fmt_ul"), () => run("insertUnorderedList"));
    addTool("ol", svgIcon(ICONS.ol), tr("fmt_ol"), () => run("insertOrderedList"));
    addTool("chk", svgIcon(ICONS.chk), tr("fmt_chk"), () => toggleChecklist());
    addTool("q", svgIcon(ICONS.q), tr("fmt_q"), () => toggleQuote());
    addTool("hr", svgIcon(ICONS.hr, 2.6), tr("fmt_hr"), () => run("insertHorizontalRule"));

    root.append(bar, menu, titleIn, bodyIn, panel, tools);
    document.body.appendChild(root);
    document.documentElement.classList.add("sn-ne-lock");

    /* ----- أوامر التنسيق ----- */
    function focusBody() {
      if (document.activeElement !== bodyIn) bodyIn.focus();
    }
    function run(cmd, val) {
      focusBody();
      try { document.execCommand("styleWithCSS", false, false); } catch { /* ignore */ }
      try { document.execCommand(cmd, false, val == null ? null : val); } catch { /* ignore */ }
      paintEmpty();
      paintState();
    }
    function closestIn(tag) {
      const s = window.getSelection();
      let n = s && s.anchorNode;
      while (n && n !== bodyIn) {
        if (n.nodeType === 1 && n.tagName === tag) return n;
        n = n.parentNode;
      }
      return null;
    }
    function toggleChecklist() {
      focusBody();
      const ul = closestIn("UL");
      if (ul && ul.classList.contains("sn-check")) { run("insertUnorderedList"); return; }
      if (ul) { ul.classList.add("sn-check"); paintState(); return; }
      run("insertUnorderedList");
      const u2 = closestIn("UL");
      if (u2) u2.classList.add("sn-check");
      paintState();
    }
    function toggleQuote() {
      focusBody();
      run("formatBlock", closestIn("BLOCKQUOTE") ? "div" : "blockquote");
    }
    function paintState() {
      ["bold", "italic", "underline", "strikeThrough"].forEach((c) => {
        let on = false;
        try { on = document.queryCommandState(c); } catch { /* ignore */ }
        if (btns[c]) btns[c].classList.toggle("is-on", on && document.activeElement === bodyIn);
      });
      const inBody = document.activeElement === bodyIn;
      const ul = inBody && closestIn("UL");
      btns.ul.classList.toggle("is-on", !!(ul && !ul.classList.contains("sn-check")));
      btns.chk.classList.toggle("is-on", !!(ul && ul.classList.contains("sn-check")));
      btns.ol.classList.toggle("is-on", !!(inBody && closestIn("OL")));
      btns.q.classList.toggle("is-on", !!(inBody && closestIn("BLOCKQUOTE")));
      paintFmt();
    }
    function paintFmt() {
      if (panel.hidden || document.activeElement !== bodyIn) return;
      let fam = "", sz = "";
      try { fam = document.queryCommandValue("fontName") || ""; sz = document.queryCommandValue("fontSize") || ""; } catch { /* ignore */ }
      fam = fam.split(",")[0].replace(/["']/g, "").trim().toLowerCase();
      const known = FAMILIES.find((f) => f.v && f.v.toLowerCase() === fam);
      famChips.forEach(({ el, it }) => {
        const on = known ? it === known : !it.v;
        el.classList.toggle("is-on", on);
        el.setAttribute("aria-pressed", String(on));
      });
      const n = parseInt(sz, 10);
      sizeChips.forEach(({ el, it }) => {
        const on = it.v === n;
        el.classList.toggle("is-on", on);
        el.setAttribute("aria-pressed", String(on));
      });
    }
    const onSel = () => { if (root.contains(document.activeElement)) paintState(); };
    document.addEventListener("selectionchange", onSel);

    /* لصق كنص عادي فقط (عشان ما يدخلش تنسيق غريب) */
    bodyIn.addEventListener("paste", (e) => {
      e.preventDefault();
      const t = (e.clipboardData || window.clipboardData).getData("text/plain");
      try { document.execCommand("insertText", false, t); } catch { /* ignore */ }
    });
    bodyIn.addEventListener("input", paintEmpty);
    titleIn.addEventListener("keydown", (e) => {
      if (e.key === "Enter") { e.preventDefault(); bodyIn.focus(); }
    });
    /* لمس مربع قائمة المهام يعلّم/يشيل العلامة */
    bodyIn.addEventListener("click", (e) => {
      const li = e.target && e.target.closest && e.target.closest("ul.sn-check > li");
      if (!li || !bodyIn.contains(li)) return;
      const r = li.getBoundingClientRect();
      const edge = rtl ? r.right - e.clientX : e.clientX - r.left;
      if (edge >= 0 && edge <= 34) li.classList.toggle("done");
    });

    /* تراجع / إعادة (بتشتغل على الخانة اللي عليها الفوكس: العنوان أو النص) */
    const hist = (cmd) => () => {
      if (document.activeElement !== titleIn) focusBody();
      try { document.execCommand(cmd); } catch { /* ignore */ }
      paintEmpty();
    };
    undoBtn.addEventListener("click", hist("undo"));
    redoBtn.addEventListener("click", hist("redo"));

    const initTitle = titleIn.value;
    const initBody = bodyIn.innerHTML;
    const dirty = () => titleIn.value !== initTitle || bodyIn.innerHTML !== initBody || pinned !== initPinned || color !== initColor;

    /* حفظ */
    saveBtn.addEventListener("click", () => {
      const t = titleIn.value.trim();
      const html = sanitize(bodyIn.innerHTML);
      const hasContent = bodyIn.textContent.trim() || bodyIn.querySelector("li,hr");
      if (!t && !hasContent) { toast(tr("needText"), true); return; }
      const now = Date.now();
      if (existing) {
        existing.title = t;
        existing.body = html;
        existing.fmt = 1;
        existing.pinned = pinned;
        existing.color = color;
        existing.updated = now;
      } else {
        notes.unshift(clean({ id: uid(), title: t, body: html, fmt: 1, pinned, color, created: now, updated: now }));
      }
      persist();
      render();
      close(true);
      toast(tr("saved"));
    });

    /* قايمة ⋮ */
    moreBtn.addEventListener("click", (e) => { e.stopPropagation(); menu.hidden = !menu.hidden; });
    root.addEventListener("click", () => { menu.hidden = true; });
    copyItem.addEventListener("click", async () => {
      menu.hidden = true;
      const text = [titleIn.value.trim(), bodyIn.innerText.trim()].filter(Boolean).join("\n\n");
      try { await navigator.clipboard.writeText(text); toast(tr("copied")); }
      catch { toast(tr("copied")); }
    });
    if (delItem) {
      delItem.addEventListener("click", async () => {
        menu.hidden = true;
        if (await removeNote(existing.id)) close(true);
      });
    }

    /* نافذة التأكيد والتنبيه جوه صفحة الكتابة نفسها (نافذة المنصة كانت بتظهر وراها) */
    let asking = false;
    function confirmIn(o) {
      return new Promise((resolve) => {
        asking = true;
        const back = document.createElement("div");
        back.className = "sn-ne__dlg";
        const box = document.createElement("div");
        box.className = "sn-ne__dlgbox";
        box.setAttribute("role", "alertdialog");
        box.setAttribute("aria-modal", "true");
        const h = document.createElement("strong");
        h.textContent = o.title || "";
        const p = document.createElement("p");
        p.textContent = o.message || "";
        const row = document.createElement("div");
        row.className = "sn-ne__dlgrow";
        const no = document.createElement("button");
        no.type = "button";
        no.className = "is-cancel";
        no.textContent = o.cancelText || tr("del_n");
        const yes = document.createElement("button");
        yes.type = "button";
        yes.className = "is-danger";
        yes.textContent = o.confirmText || "OK";
        row.append(no, yes);
        box.append(h, p, row);
        back.appendChild(box);
        const done = (v) => {
          asking = false;
          back.remove();
          resolve(v);
        };
        yes.addEventListener("click", () => done(true));
        no.addEventListener("click", () => done(false));
        back.addEventListener("click", (e) => { if (e.target === back) done(false); });
        back.addEventListener("keydown", (e) => { if (e.key === "Escape") { e.stopPropagation(); done(false); } });
        root.appendChild(back);
        no.focus();
      });
    }
    let toastTimer = null;
    function toastIn(msg, err) {
      let t = root.querySelector(".sn-ne__toast");
      if (!t) {
        t = document.createElement("div");
        t.className = "sn-ne__toast";
        t.setAttribute("role", "status");
        root.appendChild(t);
      }
      t.textContent = msg;
      t.classList.toggle("is-err", !!err);
      clearTimeout(toastTimer);
      toastTimer = setTimeout(() => t.remove(), 2200);
    }

    /* رجوع: لو فيه تعديلات ما اتحفظتش نسأل الأول */
    async function requestClose() {
      if (asking) return false;
      if (dirty()) {
        const ok = await confirmIn({ title: tr("discard_t"), message: tr("discard_m"), confirmText: tr("discard_y"), cancelText: tr("discard_n") });
        if (!ok) return false;
      }
      close(true);
      return true;
    }
    backBtn.addEventListener("click", requestClose);
    root.addEventListener("keydown", (e) => { if (e.key === "Escape" && !asking) requestClose(); });

    /* مقاس الصفحة يتبع الكيبورد: شريط الأدوات يفضل لازق فوق الكيبورد على الموبايل */
    const vv = window.visualViewport;
    function fit() {
      if (!vv) { root.style.height = "100%"; return; }
      root.style.height = vv.height + "px";
      root.style.transform = "translateY(" + vv.offsetTop + "px)";
      root.classList.toggle("kb", window.innerHeight - vv.height > 120);
    }
    if (vv) { vv.addEventListener("resize", fit); vv.addEventListener("scroll", fit); }
    fit();

    /* زرار الرجوع بتاع الجهاز */
    let closed = false;
    const base = history.state || {};
    history.pushState(Object.assign({}, base, { snNote: true }), "");
    function onPop() {
      if (closed) return;
      if (asking) {
        history.pushState(Object.assign({}, base, { snNote: true }), "");
        return;
      }
      if (dirty()) {
        history.pushState(Object.assign({}, base, { snNote: true }), "");
        requestClose();
      } else {
        close(false);
      }
    }
    window.addEventListener("popstate", onPop);

    function close(popHistory) {
      if (closed) return;
      closed = true;
      window.removeEventListener("popstate", onPop);
      document.removeEventListener("selectionchange", onSel);
      if (vv) { vv.removeEventListener("resize", fit); vv.removeEventListener("scroll", fit); }
      root.remove();
      document.documentElement.classList.remove("sn-ne-lock");
      editorOpen = null;
      if (popHistory && history.state && history.state.snNote) history.back();
    }
    editorOpen = { close, confirm: confirmIn, toast: toastIn };

    paintEmpty();
    paintState();
    if (!existing) setTimeout(() => titleIn.focus(), 80);
  }

  /* خطوط جوجل للعربي (بتتحمّل أول مرة بس تتفتح فيها صفحة الكتابة) */
  function loadFonts() {
    if (document.getElementById("sn-notes-fonts")) return;
    const l = document.createElement("link");
    l.id = "sn-notes-fonts";
    l.rel = "stylesheet";
    l.href = "https://fonts.googleapis.com/css2?family=Amiri:wght@400;700&family=Cairo:wght@400;700&family=Tajawal:wght@400;700&display=swap";
    document.head.appendChild(l);
  }

  /* ---------- CSS ---------- */
  function injectCss() {
    if (document.getElementById("sn-notes-css")) return;
    const st = document.createElement("style");
    st.id = "sn-notes-css";
    st.textContent = `
.sn-notes-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:12px;margin-top:14px}
.sn-notes-empty{grid-column:1/-1;text-align:center;opacity:.65;padding:28px 8px;margin:0}
.sn-note-wrap{position:relative}
.sn-note-card{display:flex;flex-direction:column;align-items:flex-start;gap:6px;text-align:start;width:100%;min-height:104px;padding:14px 16px;font:inherit;color:inherit;cursor:pointer;-webkit-tap-highlight-color:transparent;
  background:color-mix(in srgb,currentColor 5%,transparent);border:1px solid color-mix(in srgb,currentColor 22%,transparent);border-radius:14px;transition:transform .15s,background .15s}
.sn-note-card:hover{background:color-mix(in srgb,currentColor 9%,transparent)}
.sn-note-card:active{transform:scale(.98)}
.sn-note-card__title{font-size:1.05rem;line-height:1.4;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:100%;padding-inline-start:84px;box-sizing:border-box}
.sn-note-card__date{opacity:.65;font-size:.8rem}
.sn-note-card__body{opacity:.8;font-size:.9rem;line-height:1.6;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;word-break:break-word;max-width:100%}
.sn-notes-search{display:flex;align-items:center;gap:8px;margin-top:12px;padding:0 14px;border-radius:999px;background:color-mix(in srgb,currentColor 6%,transparent);border:1px solid color-mix(in srgb,currentColor 20%,transparent)}
.sn-notes-search[hidden]{display:none}
.sn-notes-search svg{flex:none;width:20px;height:20px;opacity:.6}
.sn-notes-search input{flex:1;min-width:0;height:44px;border:0;outline:0;background:transparent;color:inherit;font:inherit;font-size:16px;box-shadow:none;padding:0}
.sn-note-card.has-color{background:color-mix(in srgb,var(--nc) 22%,transparent);border-color:color-mix(in srgb,var(--nc) 60%,transparent)}
.sn-note-card.has-color:hover{background:color-mix(in srgb,var(--nc) 30%,transparent)}
.sn-note-pin{position:absolute;top:6px;inset-inline-start:44px;width:36px;height:36px;padding:0;border:0;border-radius:50%;display:grid;place-items:center;cursor:pointer;background:transparent;color:inherit;opacity:.5;-webkit-tap-highlight-color:transparent}
.sn-note-pin svg{width:18px;height:18px}
.sn-note-pin.is-on{opacity:1}
.sn-note-pin.is-on svg{fill:currentColor}
.sn-note-pin:active{background:color-mix(in srgb,currentColor 14%,transparent)}
.sn-note-del{position:absolute;top:6px;inset-inline-start:6px;width:36px;height:36px;padding:0;border:0;border-radius:50%;display:grid;place-items:center;cursor:pointer;
  background:transparent;color:#d6453d;-webkit-tap-highlight-color:transparent}
.sn-note-del svg{width:19px;height:19px}
.sn-note-del:hover,.sn-note-del:active{background:color-mix(in srgb,#d6453d 16%,transparent)}
.sn-notes-fabwrap{display:flex;margin-top:16px}
.sn-notes-fab{margin-left:auto;width:58px;height:58px;border-radius:50%;padding:0;display:grid;place-items:center;box-shadow:0 6px 18px rgba(0,0,0,.28)}
.sn-notes-fab svg{width:28px;height:28px}

.sn-ne-lock,.sn-ne-lock body{overflow:hidden;overscroll-behavior:none}
.sn-ne{position:fixed;top:0;left:0;right:0;height:100%;height:100dvh;z-index:9000;display:flex;flex-direction:column;box-sizing:border-box;
  background:var(--ne-bg);color:var(--ne-fg);padding-top:env(safe-area-inset-top,0px);overscroll-behavior:contain}
.sn-ne__bar{display:flex;align-items:center;gap:2px;padding:6px 8px;flex:none}
.sn-ne__spacer{flex:1}
.sn-ne__btn{width:44px;height:44px;border:0;border-radius:50%;background:transparent;color:var(--ne-fg);display:grid;place-items:center;cursor:pointer;padding:0;-webkit-tap-highlight-color:transparent}
.sn-ne__btn:active{background:color-mix(in srgb,var(--ne-accent) 20%,transparent)}
.sn-ne__btn svg{width:24px;height:24px}
.sn-ne__save{background:var(--ne-accent);color:#fff}
.sn-ne__save:active{background:var(--ne-accent);filter:brightness(.9)}
.sn-ne__menu{position:absolute;top:58px;inset-inline-start:10px;min-width:190px;padding:6px;border-radius:14px;z-index:3;
  background:var(--ne-bg);border:1px solid color-mix(in srgb,var(--ne-accent) 35%,transparent);box-shadow:0 10px 30px rgba(0,0,0,.3)}
.sn-ne__menu[hidden]{display:none}
.sn-ne__menu>button{display:block;width:100%;text-align:start;padding:12px;border:0;background:transparent;color:inherit;font:inherit;font-size:1rem;border-radius:10px;cursor:pointer}
.sn-ne__menu>button:active{background:color-mix(in srgb,var(--ne-accent) 16%,transparent)}
.sn-ne__menu .is-danger{color:#d6453d}
.sn-ne__ver{text-align:end;opacity:.4;font-size:.7rem;padding-bottom:4px}
.sn-ne__menulabel{padding:8px 12px 2px;font-size:.8rem;opacity:.65}
.sn-ne__colors{display:flex;flex-wrap:wrap;gap:8px;padding:6px 12px 10px}
.sn-ne__dot{width:30px;height:30px;padding:0;border-radius:50%;border:2px solid transparent;cursor:pointer;display:block;-webkit-tap-highlight-color:transparent}
.sn-ne__dot.is-none{background:transparent;border:2px dashed color-mix(in srgb,currentColor 45%,transparent)}
.sn-ne__dot.is-on{box-shadow:0 0 0 2px var(--ne-bg),0 0 0 4px var(--ne-fg)}
.sn-ne__dlg{position:absolute;inset:0;z-index:20;display:grid;place-items:center;padding:20px;background:rgba(0,0,0,.5)}
.sn-ne__dlgbox{width:100%;max-width:360px;padding:20px;border-radius:18px;background:var(--ne-bg);color:var(--ne-fg);border:1px solid color-mix(in srgb,var(--ne-accent) 35%,transparent);box-shadow:0 18px 50px rgba(0,0,0,.4)}
.sn-ne__dlgbox strong{display:block;font-size:1.15rem;margin-bottom:8px}
.sn-ne__dlgbox p{margin:0 0 16px;line-height:1.7;opacity:.85}
.sn-ne__dlgrow{display:flex;gap:10px}
.sn-ne__dlgrow button{flex:1;min-height:46px;border-radius:12px;border:0;font:inherit;font-size:1rem;font-weight:700;cursor:pointer;-webkit-tap-highlight-color:transparent}
.sn-ne__dlgrow .is-cancel{background:color-mix(in srgb,var(--ne-accent) 16%,var(--ne-bg));color:var(--ne-fg)}
.sn-ne__dlgrow .is-danger{background:#d6453d;color:#fff}
.sn-ne__toast{position:absolute;inset-inline:16px;bottom:96px;margin-inline:auto;width:max-content;max-width:calc(100% - 32px);z-index:25;padding:12px 18px;border-radius:12px;background:var(--ne-fg);color:var(--ne-bg);font-size:.95rem;text-align:center;box-shadow:0 8px 24px rgba(0,0,0,.3);pointer-events:none}
.sn-ne__toast.is-err{background:#d6453d;color:#fff}
.sn-ne__bar{box-shadow:inset 0 -3px 0 var(--ne-note,transparent)}
.sn-ne__title{flex:none;display:block;width:100%;box-sizing:border-box;border:0;outline:0;background:transparent;color:inherit;font:inherit;font-size:1.5rem;font-weight:700;padding:10px 20px 6px;box-shadow:none;border-radius:0}
.sn-ne__body{flex:1 1 auto;min-height:0;overflow-y:auto;-webkit-overflow-scrolling:touch;overscroll-behavior:contain;outline:0;padding:8px 20px 24px;font-size:16px;line-height:1.8;word-break:break-word;
  -webkit-user-select:text;user-select:text;caret-color:var(--ne-accent)}
.sn-ne__body.is-empty::before{content:attr(data-ph);opacity:.45;pointer-events:none;display:block;height:0;overflow:visible;white-space:nowrap}
.sn-ne__body blockquote{margin:6px 0;padding:4px 12px;border-inline-start:4px solid var(--ne-accent);background:color-mix(in srgb,var(--ne-accent) 10%,transparent);border-radius:6px}
.sn-ne__body hr{border:0;border-top:2px solid color-mix(in srgb,var(--ne-accent) 45%,transparent);margin:12px 0}
.sn-ne__body ul,.sn-ne__body ol{margin:4px 0;padding-inline-start:26px}
.sn-ne__body ul.sn-check{list-style:none;padding-inline-start:0}
.sn-ne__body ul.sn-check>li{position:relative;padding-inline-start:34px;min-height:1.8em}
.sn-ne__body ul.sn-check>li::before{content:"";position:absolute;inset-inline-start:4px;top:.45em;width:20px;height:20px;box-sizing:border-box;border:2px solid var(--ne-accent);border-radius:6px;background:transparent}
.sn-ne__body ul.sn-check>li.done::before{background:var(--ne-accent);box-shadow:inset 0 0 0 3px var(--ne-bg)}
.sn-ne__body ul.sn-check>li.done{opacity:.6;text-decoration:line-through}
.sn-ne__panel{flex:none;padding:10px 12px;border-top:1px solid color-mix(in srgb,var(--ne-accent) 30%,transparent);background:color-mix(in srgb,var(--ne-accent) 9%,var(--ne-bg))}
.sn-ne__panel[hidden]{display:none}
.sn-ne__row{display:flex;align-items:center;gap:10px;margin:4px 0}
.sn-ne__rowlabel{flex:none;width:64px;font-size:.85rem;opacity:.75}
.sn-ne__chips{display:flex;gap:8px;overflow-x:auto;padding:4px 2px;scrollbar-width:none;-webkit-overflow-scrolling:touch}
.sn-ne__chips::-webkit-scrollbar{display:none}
.sn-ne__chip{flex:none;min-height:40px;padding:0 14px;border-radius:999px;border:1px solid color-mix(in srgb,var(--ne-accent) 45%,transparent);background:var(--ne-bg);color:inherit;font:inherit;font-size:.95rem;cursor:pointer;-webkit-tap-highlight-color:transparent}
.sn-ne__chip:active,.sn-ne__chip.is-on{background:var(--ne-accent);color:#fff;border-color:var(--ne-accent)}
.sn-ne__tools{flex:none;display:flex;gap:8px;overflow-x:auto;padding:8px 10px calc(8px + env(safe-area-inset-bottom,0px));scrollbar-width:none;-webkit-overflow-scrolling:touch;
  background:color-mix(in srgb,var(--ne-accent) 14%,var(--ne-bg));border-top:1px solid color-mix(in srgb,var(--ne-accent) 30%,transparent)}
.sn-ne.kb .sn-ne__tools{padding-bottom:8px}
.sn-ne__tools::-webkit-scrollbar{display:none}
.sn-ne__tool{flex:none;min-width:44px;height:44px;padding:0 10px;border:0;border-radius:12px;display:grid;place-items:center;cursor:pointer;
  background:color-mix(in srgb,var(--ne-accent) 16%,var(--ne-bg));color:var(--ne-fg);font:inherit;font-size:1.1rem;font-weight:700;-webkit-tap-highlight-color:transparent}
.sn-ne__tool svg{width:22px;height:22px}
.sn-ne__tool.t-i{font-style:italic;font-family:serif}
.sn-ne__tool.t-u{text-decoration:underline}
.sn-ne__tool.t-s{text-decoration:line-through}
.sn-ne__tool.is-on{background:var(--ne-accent);color:#fff}
`;
    document.head.appendChild(st);
  }

  /* ---------- جاهزية الواجهة ---------- */
  function mountSearch() {
    const grid = document.getElementById("notesGrid");
    if (!grid || document.getElementById("notesSearchWrap")) return;
    const wrap = document.createElement("div");
    wrap.id = "notesSearchWrap";
    wrap.className = "sn-notes-search";
    wrap.hidden = true;
    wrap.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg><input type="search" enterkeyhint="search" autocomplete="off" />';
    const input = wrap.querySelector("input");
    input.addEventListener("input", () => { query = input.value; render(); });
    grid.parentNode.insertBefore(wrap, grid);
  }

  function mountCard() {
    mountSearch();
    const addBtn = document.getElementById("notesAddBtn");
    if (addBtn && !addBtn._snBound) {
      addBtn._snBound = true;
      addBtn.addEventListener("click", () => openEditor(null));
    }
  }

  window.snNotes = {
    /** بيتنادى من dashboard.js عند الإقلاع */
    init(u, syncFn) {
      user = u;
      sync = typeof syncFn === "function" ? syncFn : () => {};
      injectCss();
      load();
      if (!notes.length && !localStorage.getItem(FLAG())) {
        if (migrateLegacy(localStorage.getItem(LEGACY()))) persist();
      }
      mountCard();
      render();
    },
    /** بيتنادى من dashboard.js بعد سحب بيانات الطالب من Firebase */
    hydrate(u, data, syncFn) {
      user = u;
      if (typeof syncFn === "function") sync = syncFn;
      const remote = data && data.notesList;
      if (remote && typeof remote === "object") {
        notes = Object.values(remote).filter(valid).map(clean);
        try { localStorage.setItem(KEY(), JSON.stringify(notes)); localStorage.setItem(FLAG(), "1"); } catch { /* ignore */ }
      } else {
        load();
        if (notes.length) {
          persist();
        } else if (!localStorage.getItem(FLAG())) {
          const legacy = typeof (data && data.notes) === "string" && data.notes.trim() ? data.notes : localStorage.getItem(LEGACY());
          if (migrateLegacy(legacy)) persist();
        }
      }
      render();
    },
    render,
    version: VERSION,
  };
})();

/* ==========================================================================
   pdf-viewer.js — عارض ملفات PDF والصور جوه المنصة (بدل فتحها في تاب/صفحة جديدة)
   الاستخدام:
     SNPdf.open({ blob | dataUrl | url, title, filename, mime })   // يعرض ملف جاهز
     SNPdf.openHtml(html, { title, filename })                      // يحوّل صفحة HTML لـ PDF ويعرضه
     SNPdf.fromHtml(html)                                           // بيرجّع Blob لـ PDF
   الشاشة: شريط علوي فيه إغلاق + العنوان + 3 نقط؛ الـ 3 نقط بتفتح قايمة جانبية فيها:
     تنزيل • طباعة • مشاركة
   كمان أي رابط <a> لملف .pdf (أو عليه data-sn-pdf) بيتفتح هنا تلقائيًا.
   يتحمّل في studenti.html و admin.html قبل باقي السكريبتات اللي بتستخدمه.
   ========================================================================== */
(() => {
  "use strict";
  if (window.SNPdf) return;

  const CDN = {
    pdfjs: "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js",
    worker: "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js",
    h2c: "https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js",
    jspdf: "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js",
  };
  const loading = {};
  function lib(src, ready) {
    if (ready()) return Promise.resolve();
    if (!loading[src]) {
      loading[src] = new Promise((res, rej) => {
        const s = document.createElement("script");
        s.src = src;
        s.onload = () => (ready() ? res() : rej(new Error("LIB_NOT_READY")));
        s.onerror = () => { delete loading[src]; rej(new Error("LOAD_FAILED")); };
        document.head.appendChild(s);
      });
    }
    return loading[src];
  }
  const loadPdfJs = () => lib(CDN.pdfjs, () => !!window.pdfjsLib).then(() => {
    window.pdfjsLib.GlobalWorkerOptions.workerSrc = CDN.worker;
  });

  const esc = (v) => String(v == null ? "" : v).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  /* ---------- تنبيه صغير ---------- */
  let toastTimer = 0;
  function toast(msg) {
    let t = document.getElementById("snPdfToast");
    if (!t) {
      t = document.createElement("div");
      t.id = "snPdfToast";
      t.style.cssText = "position:fixed;left:50%;bottom:28px;transform:translateX(-50%);z-index:2147482500;background:#1d2b36;color:#fff;padding:10px 18px;border-radius:12px;font:600 .9rem Tajawal,Cairo,sans-serif;max-width:88vw;text-align:center;box-shadow:0 8px 28px rgba(0,0,0,.3)";
      document.body.appendChild(t);
    }
    t.textContent = msg;
    t.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { t.hidden = true; }, 3200);
  }

  /* ---------- الستايل ---------- */
  function injectStyle() {
    if (document.getElementById("snPdfStyle")) return;
    const st = document.createElement("style");
    st.id = "snPdfStyle";
    st.textContent =
      "#snPdf{position:fixed;inset:0;z-index:2147482000;display:flex;flex-direction:column;background:#2b3138;color:#fff;font-family:Tajawal,Cairo,system-ui,sans-serif}" +
      "#snPdf .sp-bar{display:flex;align-items:center;gap:8px;padding:10px 12px;padding-top:max(10px,env(safe-area-inset-top));background:#1d2429;box-shadow:0 2px 12px rgba(0,0,0,.35)}" +
      "#snPdf .sp-title{flex:1;min-width:0;font-weight:700;font-size:1rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;text-align:center}" +
      "#snPdf .sp-ibtn{width:42px;height:42px;border-radius:50%;border:0;background:transparent;color:#fff;display:grid;place-items:center;cursor:pointer}" +
      "#snPdf .sp-ibtn:hover,#snPdf .sp-ibtn:focus-visible{background:rgba(255,255,255,.14);outline:none}" +
      "#snPdf .sp-ibtn svg{width:24px;height:24px}" +
      "#snPdf .sp-body{flex:1;overflow:auto;-webkit-overflow-scrolling:touch;padding:14px 10px 30px;text-align:center}" +
      "#snPdf .sp-pages canvas,#snPdf .sp-pages img{display:block;margin:0 auto 14px;background:#fff;box-shadow:0 4px 18px rgba(0,0,0,.45);max-width:100%;height:auto}" +
      "#snPdf .sp-msg{margin:40px auto;opacity:.85;max-width:420px;line-height:1.8}" +
      "#snPdf .sp-frame{width:100%;height:100%;border:0;background:#fff}" +
      "#snPdf .sp-scrim{position:absolute;inset:0;background:rgba(0,0,0,.45);opacity:0;visibility:hidden;transition:opacity .2s}" +
      "#snPdf .sp-scrim.is-open{opacity:1;visibility:visible}" +
      "#snPdf .sp-menu{position:absolute;top:0;bottom:0;left:0;width:min(270px,82vw);background:#fff;color:#1c2b3a;padding:16px 12px;padding-top:max(16px,env(safe-area-inset-top));transform:translateX(-105%);transition:transform .22s ease;visibility:hidden;box-shadow:6px 0 28px rgba(0,0,0,.35)}" +
      "#snPdf .sp-menu.is-open{transform:none;visibility:visible}" +
      "#snPdf .sp-menu h4{margin:4px 8px 12px;font-size:.95rem;opacity:.65;font-weight:700}" +
      "#snPdf .sp-act{display:flex;align-items:center;gap:12px;width:100%;padding:13px 12px;border:0;border-radius:12px;background:transparent;color:inherit;font:700 1rem inherit;cursor:pointer;text-align:start}" +
      "#snPdf .sp-act:hover,#snPdf .sp-act:focus-visible{background:rgba(0,0,0,.07);outline:none}" +
      "#snPdf .sp-act svg{width:22px;height:22px;flex:none}" +
      "#snPdf .sp-act[disabled]{opacity:.45;cursor:progress}";
    document.head.appendChild(st);
  }

  const I = {
    x: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 6l12 12M18 6 6 18"/></svg>',
    dots: '<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="5" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="12" cy="19" r="2"/></svg>',
    dl: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 4v11"/><path d="m7 11 5 5 5-5"/><path d="M5 20h14"/></svg>',
    pr: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 9V4h10v5"/><rect x="4" y="9" width="16" height="8" rx="2"/><path d="M7 14h10v6H7z"/></svg>',
    sh: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="6" r="2.5"/><circle cx="18" cy="18" r="2.5"/><path d="m8.2 10.8 7.6-3.6M8.2 13.2l7.6 3.6"/></svg>',
  };

  /* ---------- الحالة ---------- */
  let cur = null;       // { root, blob, objUrl, remoteUrl, title, filename, mime, isImage, pdfDoc, token }
  let pushed = false;
  let prevOverflow = "";
  let tokenSeq = 0;

  function safeName(n, mime) {
    let s = String(n || "file").replace(/[\\/:*?"<>|]+/g, "-").trim() || "file";
    const ext = mime === "application/pdf" ? ".pdf" : /^image\//.test(mime || "") ? "." + String(mime).split("/")[1].replace("jpeg", "jpg") : "";
    if (ext && !s.toLowerCase().endsWith(ext)) s += ext;
    return s;
  }

  /* ---------- فتح ---------- */
  async function open(o) {
    o = o || {};
    const reuse = !!cur && pushed; // لو في ملف مفتوح بنستعمل نفس خانة الـ history
    if (cur) teardown();
    injectStyle();
    const token = ++tokenSeq;
    const root = document.createElement("div");
    root.id = "snPdf";
    root.setAttribute("role", "dialog");
    root.setAttribute("aria-modal", "true");
    root.dir = "rtl";
    root.innerHTML =
      '<div class="sp-bar">' +
      '<button type="button" class="sp-ibtn" data-sp="close" aria-label="إغلاق">' + I.x + "</button>" +
      '<div class="sp-title">' + esc(o.title || "ملف") + "</div>" +
      '<button type="button" class="sp-ibtn" data-sp="more" aria-label="خيارات" aria-haspopup="true" aria-expanded="false">' + I.dots + "</button></div>" +
      '<div class="sp-body"><div class="sp-pages"></div><p class="sp-msg" data-sp="msg">جاري تحميل الملف…</p></div>' +
      '<div class="sp-scrim" data-sp="scrim"></div>' +
      '<aside class="sp-menu" aria-label="خيارات الملف"><h4>خيارات الملف</h4>' +
      '<button type="button" class="sp-act" data-sp="download">' + I.dl + "<span>تنزيل</span></button>" +
      '<button type="button" class="sp-act" data-sp="print">' + I.pr + "<span>طباعة</span></button>" +
      '<button type="button" class="sp-act" data-sp="share">' + I.sh + "<span>مشاركة</span></button></aside>";
    document.body.appendChild(root);
    prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    cur = { root, token, blob: null, objUrl: "", remoteUrl: "", title: o.title || "ملف", filename: "", mime: o.mime || "", isImage: false, pdfDoc: null };

    root.addEventListener("click", onClick);
    if (reuse) pushed = true;
    else { try { history.pushState({ snpdf: 1 }, ""); pushed = true; } catch (e) { pushed = false; } }

    try {
      /* نجيب الملف كـ Blob (لازم للتنزيل والطباعة والمشاركة) */
      let blob = null;
      if (o.blob) blob = o.blob;
      else if (o.dataUrl) blob = await (await fetch(o.dataUrl)).blob();
      else if (o.url) {
        cur.remoteUrl = o.url;
        try { const r = await fetch(o.url, { mode: "cors" }); if (r.ok) blob = await r.blob(); } catch (e) { blob = null; }
      }
      if (!alive(token)) return;
      let mime = o.mime || (blob && blob.type) || "";
      if (!mime || mime === "application/octet-stream") mime = /\.(png|jpe?g|gif|webp)(?:$|[?#])/i.test(o.url || "") ? "image/" + RegExp.$1.toLowerCase().replace("jpg", "jpeg") : "application/pdf";
      cur.mime = mime;
      cur.isImage = /^image\//.test(mime);
      cur.blob = blob;
      if (blob) cur.objUrl = URL.createObjectURL(blob.type === mime ? blob : new Blob([blob], { type: mime }));
      let fname = o.filename || (o.url ? decodeURIComponent(String(o.url).split("?")[0].split("/").pop() || "") : "") || o.title || "file";
      cur.filename = safeName(fname, mime);

      const pages = root.querySelector(".sp-pages");
      const msg = root.querySelector('[data-sp="msg"]');
      if (cur.isImage) {
        const img = new Image();
        img.alt = cur.title;
        img.src = cur.objUrl || cur.remoteUrl;
        pages.appendChild(img);
        msg.remove();
      } else {
        await renderPdf(token, pages, msg);
      }
    } catch (e) {
      console.error(e);
      if (alive(token)) showFail();
    }
  }

  const alive = (t) => !!cur && cur.token === t;

  function showFail() {
    if (!cur) return;
    const msg = cur.root.querySelector('[data-sp="msg"]');
    const pages = cur.root.querySelector(".sp-pages");
    if (cur.objUrl && !cur.isImage) {
      if (msg) msg.remove();
      pages.innerHTML = '<iframe class="sp-frame" style="height:calc(100vh - 90px)" src="' + esc(cur.objUrl) + '" title="' + esc(cur.title) + '"></iframe>';
    } else if (msg) {
      msg.textContent = "تعذر عرض الملف. راجع النت وحاول تاني، أو استخدم قايمة الـ 3 نقط للتنزيل.";
    }
  }

  async function renderPdf(token, pages, msg) {
    await loadPdfJs();
    if (!alive(token)) return;
    const src = cur.blob ? { data: new Uint8Array(await cur.blob.arrayBuffer()) } : { url: cur.remoteUrl };
    const doc = await window.pdfjsLib.getDocument(src).promise;
    if (!alive(token)) { try { doc.destroy(); } catch (e) { /* ignore */ } return; }
    cur.pdfDoc = doc;
    const body = cur.root.querySelector(".sp-body");
    const fit = Math.max(260, Math.min(980, body.clientWidth - 20));
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    for (let n = 1; n <= doc.numPages; n++) {
      const page = await doc.getPage(n);
      if (!alive(token)) return;
      const base = page.getViewport({ scale: 1 });
      const k = fit / base.width;
      const vp = page.getViewport({ scale: k * dpr });
      const c = document.createElement("canvas");
      c.width = Math.floor(vp.width);
      c.height = Math.floor(vp.height);
      c.style.width = Math.floor(vp.width / dpr) + "px";
      pages.appendChild(c);
      await page.render({ canvasContext: c.getContext("2d"), viewport: vp }).promise;
      if (n === 1 && msg && msg.parentNode) msg.remove();
    }
  }

  /* ---------- إغلاق ---------- */
  function teardown() {
    if (!cur) return;
    try { if (cur.pdfDoc) cur.pdfDoc.destroy(); } catch (e) { /* ignore */ }
    if (cur.objUrl) { try { URL.revokeObjectURL(cur.objUrl); } catch (e) { /* ignore */ } }
    cur.root.remove();
    cur = null;
    document.body.style.overflow = prevOverflow;
  }
  function close() {
    if (!cur) return;
    const hadPush = pushed;
    teardown();
    if (hadPush) {
      pushed = false;
      try { skipPop = true; history.back(); } catch (e) { skipPop = false; }
    }
  }
  let skipPop = false;
  window.addEventListener("popstate", () => {
    if (skipPop) { skipPop = false; return; }
    if (cur) { pushed = false; teardown(); }
  });
  document.addEventListener("keydown", (e) => {
    if (!cur || e.key !== "Escape") return;
    const m = cur.root.querySelector(".sp-menu");
    if (m.classList.contains("is-open")) toggleMenu(false); else close();
  });

  /* ---------- القايمة والأوامر ---------- */
  function toggleMenu(on) {
    if (!cur) return;
    const m = cur.root.querySelector(".sp-menu"), s = cur.root.querySelector(".sp-scrim");
    const open = on == null ? !m.classList.contains("is-open") : on;
    m.classList.toggle("is-open", open);
    s.classList.toggle("is-open", open);
    const b = cur.root.querySelector('[data-sp="more"]');
    if (b) b.setAttribute("aria-expanded", String(open));
  }

  async function onClick(e) {
    const b = e.target.closest("[data-sp]");
    if (!b || !cur) return;
    const a = b.dataset.sp;
    if (a === "close") close();
    else if (a === "more") toggleMenu();
    else if (a === "scrim") toggleMenu(false);
    else if (a === "download") { toggleMenu(false); download(); }
    else if (a === "print") { toggleMenu(false); await print(); }
    else if (a === "share") { toggleMenu(false); await share(); }
  }

  function download() {
    if (!cur) return;
    if (!cur.objUrl) { if (cur.remoteUrl) window.open(cur.remoteUrl, "_blank", "noopener"); return; }
    const a = document.createElement("a");
    a.href = cur.objUrl;
    a.download = cur.filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  async function pageImages() {
    if (cur.isImage) return [cur.objUrl || cur.remoteUrl];
    if (!cur.pdfDoc) return [];
    const out = [];
    for (let n = 1; n <= cur.pdfDoc.numPages; n++) {
      const page = await cur.pdfDoc.getPage(n);
      const vp = page.getViewport({ scale: 2 });
      const c = document.createElement("canvas");
      c.width = Math.floor(vp.width);
      c.height = Math.floor(vp.height);
      await page.render({ canvasContext: c.getContext("2d"), viewport: vp }).promise;
      out.push(c.toDataURL("image/jpeg", 0.92));
    }
    return out;
  }

  async function print() {
    if (!cur) return;
    const t = cur.token;
    toast("جاري تجهيز الطباعة…");
    let imgs = [];
    try { imgs = await pageImages(); } catch (e) { imgs = []; }
    if (!alive(t)) return;
    if (!imgs.length) { toast("تعذرت الطباعة — نزّل الملف واطبعه من جهازك."); return; }
    const f = document.createElement("iframe");
    f.setAttribute("aria-hidden", "true");
    f.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden";
    document.body.appendChild(f);
    const d = f.contentWindow.document;
    d.open();
    d.write("<!doctype html><html><head><meta charset='utf-8'><title>" + esc(cur.title) + "</title><style>@page{margin:0}html,body{margin:0}img{display:block;width:100%;page-break-after:always;break-after:page}img:last-child{page-break-after:auto;break-after:auto}</style></head><body>" +
      imgs.map((s) => "<img src='" + s + "'>").join("") + "</body></html>");
    d.close();
    let done = false;
    const go = () => {
      if (done) return; done = true;
      try { f.contentWindow.focus(); f.contentWindow.print(); } catch (e) { toast("تعذر فتح نافذة الطباعة"); }
      setTimeout(() => f.remove(), 60000);
    };
    const all = Array.from(d.images);
    Promise.all(all.map((im) => (im.complete ? 1 : new Promise((r) => { im.onload = im.onerror = r; })))).then(() => setTimeout(go, 150));
    setTimeout(go, 3000);
  }

  async function share() {
    if (!cur) return;
    if (cur.blob && navigator.canShare && navigator.share) {
      try {
        const file = new File([cur.blob], cur.filename, { type: cur.mime });
        if (navigator.canShare({ files: [file] })) {
          await navigator.share({ files: [file], title: cur.title });
          return;
        }
      } catch (e) {
        if (e && e.name === "AbortError") return; // الطالب قفل نافذة المشاركة
      }
    }
    if (cur.remoteUrl && navigator.share) {
      try { await navigator.share({ title: cur.title, url: cur.remoteUrl }); return; } catch (e) { if (e && e.name === "AbortError") return; }
    }
    if (cur.remoteUrl && navigator.clipboard) {
      try { await navigator.clipboard.writeText(cur.remoteUrl); toast("اتنسخ رابط الملف"); return; } catch (e) { /* ignore */ }
    }
    download();
    toast("المشاركة مش متاحة على الجهاز ده — اتنزّل الملف تقدر تبعته من جهازك");
  }

  /* ---------- HTML ← PDF ---------- */
  async function fromHtml(html) {
    await Promise.all([lib(CDN.h2c, () => !!window.html2canvas), lib(CDN.jspdf, () => !!(window.jspdf && window.jspdf.jsPDF))]);
    const W = 794, PH = 1123, PAD = 30;
    const f = document.createElement("iframe");
    f.setAttribute("aria-hidden", "true");
    f.style.cssText = "position:fixed;left:-20000px;top:0;width:" + W + "px;height:1200px;border:0";
    document.body.appendChild(f);
    try {
      const d = f.contentWindow.document;
      d.open(); d.write(html); d.close();
      const st = d.createElement("style");
      st.textContent = "html,body{margin:0!important;background:#fff!important}body{width:" + W + "px!important;max-width:none!important;box-sizing:border-box!important;padding:6px 40px!important}";
      d.head.appendChild(st);
      if (d.fonts && d.fonts.ready) { try { await d.fonts.ready; } catch (e) { /* ignore */ } }
      await Promise.all(Array.from(d.images).map((im) => (im.complete ? 1 : new Promise((r) => { im.onload = im.onerror = r; }))));
      await sleep(250);
      const total = Math.max(d.body.scrollHeight, 200);
      f.style.height = total + "px";
      const sc = total > 4500 ? 1.5 : 2;
      const canvas = await window.html2canvas(d.body, { scale: sc, backgroundColor: "#ffffff", width: W, height: total, windowWidth: W, windowHeight: total, useCORS: true, logging: false });
      const tops = Array.from(d.querySelectorAll(".q,h3,header,table,.fb,section,.note,.box,footer"))
        .map((el) => Math.round(el.getBoundingClientRect().top))
        .filter((v) => v > 0).sort((a, b) => a - b);
      const usable = PH - PAD * 2;
      const doc = new window.jspdf.jsPDF({ unit: "mm", format: "a4", orientation: "portrait", compress: true });
      let start = 0, first = true;
      while (start < total - 1) {
        let end = Math.min(total, start + usable);
        if (end < total) {
          const cand = tops.filter((v) => v > start + usable * 0.35 && v <= end);
          if (cand.length) end = cand[cand.length - 1];
        }
        const pc = document.createElement("canvas");
        pc.width = Math.round(W * sc);
        pc.height = Math.round(PH * sc);
        const ctx = pc.getContext("2d");
        ctx.fillStyle = "#fff";
        ctx.fillRect(0, 0, pc.width, pc.height);
        ctx.drawImage(canvas, 0, Math.round(start * sc), canvas.width, Math.round((end - start) * sc), 0, Math.round(PAD * sc), canvas.width, Math.round((end - start) * sc));
        if (!first) doc.addPage();
        first = false;
        doc.addImage(pc.toDataURL("image/jpeg", 0.92), "JPEG", 0, 0, 210, 297);
        start = end;
      }
      return doc.output("blob");
    } finally {
      f.remove();
    }
  }

  async function openHtml(html, o) {
    o = o || {};
    toast("جاري تجهيز الملف…");
    try {
      const blob = await fromHtml(html);
      await open({ blob, title: o.title, filename: o.filename || (o.title || "file") + ".pdf", mime: "application/pdf" });
      return true;
    } catch (e) {
      console.error(e);
      toast("تعذر تجهيز الملف — اتأكد من النت وحاول تاني");
      return false;
    }
  }

  /* أي رابط لملف PDF يتفتح هنا بدل تاب جديد */
  document.addEventListener("click", (e) => {
    if (e.defaultPrevented || e.button || e.metaKey || e.ctrlKey || e.shiftKey) return;
    const a = e.target.closest && e.target.closest("a[href]");
    if (!a || a.hasAttribute("download") || a.closest("#snPdf")) return;
    const href = a.getAttribute("href") || "";
    if (!(a.hasAttribute("data-sn-pdf") || /\.pdf(?:$|[?#])/i.test(href))) return;
    e.preventDefault();
    open({ url: a.href, title: (a.textContent || "").trim() || "ملف PDF", mime: "application/pdf" });
  }, true);

  window.SNPdf = { open, openHtml, fromHtml, close: () => close(), toast };
})();

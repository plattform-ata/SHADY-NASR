/* ==========================================================================
   pdf-viewer.js — عارض ملفات PDF والصور جوه المنصة (بدل فتحها في تاب/صفحة جديدة)
   الاستخدام:
     SNPdf.open({ blob | dataUrl | url | driveId | load, title, filename, mime })   // يعرض ملف جاهز
       النافذة بتتفتح فورًا وفيها شريط تحميل؛ driveId = ملف على Google Drive، load = (onProgress) => Promise<Blob>
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

  /* خطوط وCMaps pdf.js: بتخلّي الكلام العربي والإنجليزي يتعرض مظبوط ومن غير تشويه.
     - cMaps = جداول ترميز الحروف (ضرورية للـ PDF العربي اللي الخطوط فيه مش مدمجة كاملة)
     - standard_fonts = الخطوط البديلة لما الملف ما يحتويش خطه
     - الـ service worker بيحفظهم على الجهاز، فبعد أول مرة العربي بيظهر فورًا حتى لو النت ضعيف */
  const PDFJS_ASSETS = "https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/";
  const docParams = (src) => Object.assign({}, src, {
    cMapUrl: PDFJS_ASSETS + "cmaps/",
    cMapPacked: true,
    standardFontDataUrl: PDFJS_ASSETS + "standard_fonts/",
    useSystemFonts: true,       // لو الملف مش حاطط الخط، استخدم خطوط الجهاز (فيها العربي)
    disableFontFace: false,     // خطوط الملف المدمجة بتتحمّل كـ @font-face (أوضح للعربي)
    fontExtraProperties: true,
    isEvalSupported: false
  });
  /* تسخين مسبق: نحمّل أهم ملفات العربي قبل ما الملف يتفتح */
  let assetsWarm = null;
  function warmAssets() {
    if (assetsWarm) return assetsWarm;
    const urls = ["cmaps/Identity-H.bcmap", "cmaps/UniJIS-UTF16-H.bcmap", "standard_fonts/FoxitSans.pfb"];
    assetsWarm = Promise.all(urls.map((u) => fetch(PDFJS_ASSETS + u).catch(() => null))).catch(() => null);
    return assetsWarm;
  }

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
      "#snPdf .sp-bar{position:relative;z-index:3;display:flex;align-items:center;gap:8px;padding:8px 10px;padding-top:max(8px,env(safe-area-inset-top));background:#1d2429;box-shadow:0 2px 12px rgba(0,0,0,.35)}" +
      "#snPdf .sp-head{flex:1;min-width:0;text-align:center;line-height:1.35}" +
      "#snPdf .sp-title{font-weight:800;font-size:1rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}" +
      "#snPdf .sp-sub{font-size:.78rem;opacity:.7;font-variant-numeric:tabular-nums;min-height:1em}" +
      "#snPdf .sp-ibtn{width:44px;height:44px;border-radius:50%;border:0;background:transparent;color:#fff;display:grid;place-items:center;cursor:pointer}" +
      "#snPdf .sp-ibtn:hover,#snPdf .sp-ibtn:focus-visible,#snPdf .sp-ibtn[aria-expanded=true]{background:rgba(255,255,255,.16);outline:none}" +
      "#snPdf .sp-ibtn svg{width:24px;height:24px}" +
      "#snPdf .sp-body{flex:1;overflow:auto;-webkit-overflow-scrolling:touch;padding:14px 10px 40px;text-align:center}" +
      "#snPdf .sp-pages{display:flex;flex-direction:column;align-items:center}" +
      "#snPdf .sp-page{width:100%;margin:0 auto 14px;background:#fff;border-radius:6px;box-shadow:0 4px 18px rgba(0,0,0,.45);overflow:hidden}" +
      "#snPdf .sp-page canvas{display:block;width:100%;height:auto}" +
      "#snPdf .sp-pages>img{display:block;margin:0 auto 14px;background:#fff;box-shadow:0 4px 18px rgba(0,0,0,.45);max-width:100%;height:auto}" +
      "#snPdf .sp-msg{margin:40px auto;opacity:.85;max-width:420px;line-height:1.8}" +
      "#snPdf .sp-frame{width:100%;height:100%;border:0;background:#fff}" +
      "#snPdf .sp-scrim{position:absolute;inset:0;z-index:4;background:rgba(0,0,0,.28);opacity:0;visibility:hidden;transition:opacity .18s}" +
      "#snPdf .sp-scrim.is-open{opacity:1;visibility:visible}" +
      /* القايمة: كارت عايم تحت زرار الـ 3 نقط */
      "#snPdf .sp-menu{position:absolute;z-index:5;left:10px;top:calc(max(8px,env(safe-area-inset-top)) + 54px);width:min(300px,calc(100vw - 20px));box-sizing:border-box;padding:8px;" +
        "background:#fff;color:#1c2b3a;border-radius:20px;box-shadow:0 18px 50px rgba(0,0,0,.45),0 0 0 1px rgba(0,0,0,.06);" +
        "transform-origin:top left;transform:scale(.92) translateY(-6px);opacity:0;visibility:hidden;transition:transform .18s ease,opacity .18s ease,visibility .18s}" +
      "#snPdf .sp-menu.is-open{transform:none;opacity:1;visibility:visible}" +
      "#snPdf .sp-mhead{display:flex;flex-direction:column;gap:2px;padding:10px 12px 12px;margin-bottom:6px;border-bottom:1px solid rgba(28,43,58,.1)}" +
      "#snPdf .sp-mname{font-weight:800;font-size:.95rem;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}" +
      "#snPdf .sp-mmeta{font-size:.78rem;opacity:.6}" +
      "#snPdf .sp-act{display:flex;align-items:center;gap:14px;width:100%;box-sizing:border-box;padding:10px 12px;border:0;border-radius:14px;background:transparent;color:inherit;font:700 1rem inherit;cursor:pointer;text-align:start}" +
      "#snPdf .sp-act:hover,#snPdf .sp-act:focus-visible{background:rgba(28,43,58,.07);outline:none}" +
      "#snPdf .sp-act:active{background:rgba(28,43,58,.12)}" +
      "#snPdf .sp-act .sp-aico{flex:none;width:40px;height:40px;border-radius:12px;display:grid;place-items:center}" +
      "#snPdf .sp-act .sp-aico svg{width:21px;height:21px}" +
      "#snPdf .sp-act[data-sp=download] .sp-aico{background:#e4f3ea;color:#1f8a57}" +
      "#snPdf .sp-act[data-sp=print] .sp-aico{background:#e6eefb;color:#2b5fc0}" +
      "#snPdf .sp-act[data-sp=share] .sp-aico{background:#fdeedc;color:#c8791a}" +
      "#snPdf .sp-act .sp-atxt{display:flex;flex-direction:column;gap:1px;min-width:0}" +
      "#snPdf .sp-act .sp-atxt small{font-weight:500;font-size:.76rem;opacity:.6}" +
      "#snPdf .sp-act[disabled]{opacity:.45;cursor:progress}" +
      /* موبايل: العارض بيطلع من تحت كنافذة (Bottom sheet) بنفس شكل باقي النوافذ */
      "#snPdfScrim{display:none}" +
      "@media (max-width:720px){" +
      "#snPdfScrim{display:block;position:fixed;inset:0;z-index:2147481999;background:rgba(10,15,25,.5);animation:snPdfFade .25s ease}" +
      "#snPdf{top:12%;max-width:520px;margin-inline:auto;border-radius:26px 26px 0 0;overflow:hidden;animation:snPdfUp .35s cubic-bezier(.2,.9,.3,1)}" +
      "#snPdf .sp-bar{padding-top:20px;border-radius:26px 26px 0 0}" +
      "#snPdf .sp-bar::before{content:'';position:absolute;top:7px;left:50%;margin-left:-21px;width:42px;height:4px;border-radius:9px;background:rgba(255,255,255,.28)}" +
      "#snPdf .sp-menu{top:70px}" +
      "}" +
      "@keyframes snPdfUp{from{transform:translateY(100%)}}@keyframes snPdfFade{from{opacity:0}}";
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
      '<div class="sp-head"><div class="sp-title">' + esc(o.title || "ملف") + '</div><div class="sp-sub" data-sp="pagei"></div></div>' +
      '<button type="button" class="sp-ibtn" data-sp="more" aria-label="خيارات" aria-haspopup="true" aria-expanded="false">' + I.dots + "</button></div>" +
      '<div class="sp-body"><div class="sp-pages"></div><p class="sp-msg" data-sp="msg">جاري تحميل الملف…</p></div>' +
      '<div class="sp-scrim" data-sp="scrim"></div>' +
      '<aside class="sp-menu" aria-label="خيارات الملف">' +
      '<div class="sp-mhead"><span class="sp-mname">' + esc(o.title || "ملف") + '</span><span class="sp-mmeta" data-sp="mmeta">ملف PDF</span></div>' +
      '<button type="button" class="sp-act" data-sp="download"><span class="sp-aico">' + I.dl + '</span><span class="sp-atxt">تنزيل<small>حفظ الملف على جهازك</small></span></button>' +
      '<button type="button" class="sp-act" data-sp="print"><span class="sp-aico">' + I.pr + '</span><span class="sp-atxt">طباعة<small>طباعة صفحات الملف</small></span></button>' +
      '<button type="button" class="sp-act" data-sp="share"><span class="sp-aico">' + I.sh + '</span><span class="sp-atxt">مشاركة<small>إرسال الملف لحد تاني</small></span></button></aside>';
    let scrim = document.getElementById("snPdfScrim");
    if (!scrim) {
      scrim = document.createElement("div");
      scrim.id = "snPdfScrim";
      scrim.addEventListener("click", () => close());
      document.body.appendChild(scrim);
    }
    document.body.appendChild(root);
    prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    cur = { root, token, blob: null, objUrl: "", remoteUrl: "", title: o.title || "ملف", filename: "", mime: o.mime || "", isImage: false, pdfDoc: null };

    /* شريط التحميل: بيظهر فورًا تحت الشريط العلوي، ويفضل لحد ما أول صفحة تتعرض */
    if (window.SNTransfer && (o.load || o.driveId || o.url)) {
      const bar = root.querySelector(".sp-bar");
      cur.ld = window.SNTransfer.loader(root, o.title || "ملف", { top: (bar ? bar.offsetHeight : 0) + 12, inset: 12 });
      const m0 = root.querySelector('[data-sp="msg"]');
      if (m0) m0.hidden = true;
    }
    root.addEventListener("click", onClick);
    if (reuse) pushed = true;
    else { try { history.pushState({ snpdf: 1 }, ""); pushed = true; } catch (e) { pushed = false; } }

    try {
      /* نجيب الملف كـ Blob (لازم للتنزيل والطباعة والمشاركة) */
      let blob = null;
      const ld = cur.ld, prog = (p) => { if (ld) ld.set(p == null ? null : p * 0.9); };
      if (o.blob) blob = o.blob;
      else if (o.load) blob = await o.load(prog);
      else if (o.driveId) blob = await window.SNDrive.fetchBlobAs(o.driveId, o.mime || "application/pdf", prog);
      else if (o.dataUrl) blob = await (await fetch(o.dataUrl)).blob();
      else if (o.url) {
        cur.remoteUrl = o.url;
        try {
          blob = window.SNTransfer
            ? await window.SNTransfer.fetchWithProgress(o.url, { mode: "cors" }, prog)
            : await (await fetch(o.url, { mode: "cors" })).blob();
        } catch (e) { blob = null; }
      }
      if (cur && cur.ld && blob) cur.ld.set(0.9);
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
        const ldI = cur.ld;
        if (ldI) { img.style.visibility = "hidden"; img.onload = img.onerror = () => { img.style.visibility = ""; ldI.done(); }; }
        img.src = cur.objUrl || cur.remoteUrl;
        pages.appendChild(img);
        msg.remove();
      } else {
        await renderPdf(token, pages, msg);
      }
    } catch (e) {
      console.error(e);
      if (alive(token)) {
        if (cur.ld) cur.ld.fail(() => { open(o); }, "تعذر فتح الملف");
        else showFail();
      }
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
    await Promise.race([warmAssets(), sleep(2500)]);
    if (!alive(token)) return;
    const src = cur.blob ? { data: new Uint8Array(await cur.blob.arrayBuffer()) } : { url: cur.remoteUrl };
    const doc = await window.pdfjsLib.getDocument(docParams(src)).promise;
    if (!alive(token)) { try { doc.destroy(); } catch (e) { /* ignore */ } return; }
    cur.pdfDoc = doc;
    const root = cur.root;
    const body = root.querySelector(".sp-body");
    const pageI = root.querySelector('[data-sp="pagei"]');
    const meta = root.querySelector('[data-sp="mmeta"]');
    if (meta) meta.textContent = "ملف PDF • " + doc.numPages + " صفحة";
    if (pageI) pageI.textContent = "1 / " + doc.numPages;

    /* الصفحات بتترسم بدقة عالية (×2 لحد ×3) وبس اللي قريب من الشاشة — عشان الكلام يبان واضح وملف كبير زي 150 صفحة يفتح بسرعة */
    const fit = Math.max(260, Math.min(980, body.clientWidth - 20));
    const dpr = Math.min(Math.max(window.devicePixelRatio || 1, 2), 3);
    const first = await doc.getPage(1);
    if (!alive(token)) return;
    const b1 = first.getViewport({ scale: 1 });
    const holders = [];
    for (let n = 1; n <= doc.numPages; n++) {
      const h = document.createElement("div");
      h.className = "sp-page";
      h.dataset.n = String(n);
      h.style.width = fit + "px";
      h.style.maxWidth = "100%";
      h.style.aspectRatio = b1.width + " / " + b1.height;
      pages.appendChild(h);
      holders.push(h);
    }

    let chain = Promise.resolve();
    const draw = (h) => {
      if (h.dataset.state) return;
      h.dataset.state = "queued";
      const n = Number(h.dataset.n);
      chain = chain.then(async () => {
        if (!alive(token) || h.dataset.state !== "queued") return;
        const page = await doc.getPage(n);
        const base = page.getViewport({ scale: 1 });
        const vp = page.getViewport({ scale: (fit / base.width) * dpr });
        const c = document.createElement("canvas");
        c.width = Math.floor(vp.width);
        c.height = Math.floor(vp.height);
        const ctx = c.getContext("2d", { alpha: false });
        ctx.fillStyle = "#fff";
        ctx.fillRect(0, 0, c.width, c.height);
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = "high";
        await page.render({ canvasContext: ctx, viewport: vp, background: "#fff" }).promise;
        if (!alive(token) || h.dataset.state !== "queued") { c.width = c.height = 0; return; }
        h.style.aspectRatio = base.width + " / " + base.height;
        h.replaceChildren(c);
        h.dataset.state = "done";
        if (msg && msg.parentNode) msg.remove();
        if (cur && cur.ld) { cur.ld.done(); cur.ld = null; }
      }).catch(() => { h.dataset.state = ""; });
    };
    const release = (h) => {
      if (h.dataset.state === "done") {
        const c = h.firstChild;
        if (c) c.width = c.height = 0; // يفضّي الذاكرة للصفحات البعيدة
        h.replaceChildren();
      }
      h.dataset.state = "";
    };
    const loader = new IntersectionObserver((entries) => {
      entries.forEach((e) => (e.isIntersecting ? draw(e.target) : release(e.target)));
    }, { root: body, rootMargin: "1400px 0px" });
    const tracker = new IntersectionObserver((entries) => {
      entries.forEach((e) => { if (e.isIntersecting && pageI) pageI.textContent = e.target.dataset.n + " / " + doc.numPages; });
    }, { root: body, rootMargin: "-45% 0px -50% 0px" });
    holders.forEach((h) => { loader.observe(h); tracker.observe(h); });
    cur.observers = [loader, tracker];
  }

  /* ---------- إغلاق ---------- */
  function teardown() {
    if (!cur) return;
    try { (cur.observers || []).forEach((o) => o.disconnect()); } catch (e) { /* ignore */ }
    try { if (cur.pdfDoc) cur.pdfDoc.destroy(); } catch (e) { /* ignore */ }
    try { if (cur.ld) cur.ld.cancel(); } catch (e) { /* ignore */ }
    if (cur.objUrl) { try { URL.revokeObjectURL(cur.objUrl); } catch (e) { /* ignore */ } }
    cur.root.remove();
    const sc = document.getElementById("snPdfScrim");
    if (sc) sc.remove();
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
    open({ url: a.href, title: a.getAttribute("data-sn-title") || (a.textContent || "").trim() || "ملف PDF", mime: "application/pdf" });
  }, true);

  window.SNPdf = { open, openHtml, fromHtml, close: () => close(), toast };
})();

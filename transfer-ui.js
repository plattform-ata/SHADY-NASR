/* ==========================================================================
   transfer-ui.js — إحساس "المنصة شغالة" وقت التحميل والفتح
   1) إشعار منبثق من فوق (بنفس شكل "اسحب للتحديث") فيه أيقونة تحميل + اسم الملف + شريط تقدّم + نسبة.
      SNTransfer.start("اسم الملف") ← t.set(0..1) / t.done() / t.fail()
   2) لوحة تحميل جوه أي نافذة عرض (PDF / شارة / صورة) بتظهر فورًا أول ما تتفتح النافذة،
      وبتختفي لما الشريط يكتمل ويظهر المحتوى.
      var ld = SNTransfer.loader(hostEl, "عنوان"); ← ld.set(p) / ld.done(cb) / ld.fail(retryFn)
   3) SNTransfer.fetchWithProgress(url, opts, onProgress, sizeHint) ← Blob بتقدّم حقيقي
      SNTransfer.download(url, filename) ← تحميل كامل + إشعار
      SNTransfer.saveBlob(blob, filename) ← حفظ blob جاهز + إشعار
   بيتحمّل في أي صفحة: <script defer src="transfer-ui.js"></script>
   ========================================================================== */
(function () {
  "use strict";
  if (window.SNTransfer) return;

  var isEn = function () { return document.documentElement.lang === "en"; };
  var TX = {
    ar: { busy: "جاري التحميل…", done: "تم التحميل", fail: "تعذّر التحميل", retry: "إعادة المحاولة", opening: "جاري تجهيز الملف…", ready: "تم!" },
    en: { busy: "Downloading…", done: "Download complete", fail: "Download failed", retry: "Try again", opening: "Preparing file…", ready: "Done!" }
  };
  var tx = function () { return isEn() ? TX.en : TX.ar; };

  var ICO_DL = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12M7 10l5 5 5-5M5 21h14"/></svg>';
  var ICO_OK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';
  var ICO_X = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M6 6l12 12M18 6L6 18"/></svg>';

  /* ---------- ستايل (نفس ألوان ptr.js ومتغيّرات المنصة) ---------- */
  var st = document.createElement("style");
  st.textContent =
    ".sn-tx{position:fixed;top:0;left:0;right:0;z-index:2147482900;display:flex;flex-direction:column;align-items:center;gap:8px;" +
    "padding:calc(10px + env(safe-area-inset-top,0px)) 12px 0;pointer-events:none;box-sizing:border-box}" +
    ".sn-tx__item{width:100%;max-width:496px;box-sizing:border-box;display:flex;align-items:center;gap:12px;padding:12px 14px;border-radius:18px;" +
    "background:var(--surface-glass,#fafbfd);color:var(--ink,#16202e);border:1px solid var(--surface-glass-border,#d6dbe5);box-shadow:0 10px 30px rgba(0,0,0,.18);" +
    "font-family:var(--font-body,inherit);transform:translateY(-140%);opacity:0;transition:transform .35s cubic-bezier(.2,.9,.3,1),opacity .25s ease}" +
    ".sn-tx__item.is-in{transform:none;opacity:1}" +
    ".sn-tx__ico{position:relative;flex:none;width:38px;height:38px;border-radius:12px;background:rgba(127,127,127,.16);color:var(--accent,#34506f);display:grid;place-items:center}" +
    ".sn-tx__ico svg{width:20px;height:20px;display:block}" +
    ".sn-tx__spin{position:absolute;inset:-3px;border-radius:15px;border:2.5px solid transparent;border-top-color:var(--accent,#34506f);animation:snTxSpin .9s linear infinite}" +
    "@keyframes snTxSpin{to{transform:rotate(360deg)}}" +
    ".sn-tx__item.is-done .sn-tx__spin,.sn-tx__item.is-fail .sn-tx__spin{display:none}" +
    ".sn-tx__item.is-done .sn-tx__ico{background:#1f9d63;color:#fff}" +
    ".sn-tx__item.is-fail .sn-tx__ico{background:#e5484d;color:#fff}" +
    ".sn-tx__tb{flex:1;min-width:0}" +
    ".sn-tx__t{font-weight:700;font-size:.85rem;line-height:1.35;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}" +
    ".sn-tx__s{display:flex;justify-content:space-between;gap:8px;margin-top:1px;font-size:.74rem;color:var(--ink-soft,#667085);font-variant-numeric:tabular-nums}" +
    ".sn-bar{height:5px;border-radius:99px;background:rgba(127,127,127,.22);overflow:hidden;position:relative;margin-top:7px}" +
    ".sn-bar__fill{position:absolute;top:0;bottom:0;inset-inline-start:0;width:0;border-radius:99px;background:var(--accent,#34506f)}" +
    ".sn-tx__item.is-done .sn-bar__fill,.sn-ld.is-done .sn-bar__fill{background:#1f9d63}" +
    ".sn-tx__item.is-fail .sn-bar__fill,.sn-ld.is-fail .sn-bar__fill{background:#e5484d}" +
    /* لوحة التحميل جوه النافذة: حلقة تقدّم + اسم + شريط */
    ".sn-ld{position:absolute;inset:0;z-index:50;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;padding:28px;box-sizing:border-box;border-radius:inherit;" +
    "background:var(--surface-glass,#fafbfd);color:var(--ink,#16202e);font-family:var(--font-body,inherit);text-align:center;transition:opacity .35s ease}" +
    ".sn-ld--card{border:1px solid var(--surface-glass-border,#d6dbe5);border-radius:18px}" +
    ".sn-ld.is-out{opacity:0;pointer-events:none}" +
    ".sn-ld__ring{position:relative;width:64px;height:64px;flex:none}" +
    ".sn-ld__ring svg{width:64px;height:64px;display:block;transform:rotate(-90deg)}" +
    ".sn-ld__ring circle{fill:none;stroke-width:6}" +
    ".sn-ld__ring .bg{stroke:rgba(127,127,127,.22)}" +
    ".sn-ld__ring .fg{stroke:var(--accent,#34506f);stroke-linecap:round;stroke-dasharray:175.9;stroke-dashoffset:175.9}" +
    ".sn-ld.is-done .sn-ld__ring .fg{stroke:#1f9d63}.sn-ld.is-fail .sn-ld__ring .fg{stroke:#e5484d}" +
    ".sn-ld__pct{position:absolute;inset:0;display:grid;place-items:center;font-size:.88rem;font-weight:700;font-variant-numeric:tabular-nums}" +
    ".sn-ld__t{font-weight:700;font-size:.92rem;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}" +
    ".sn-ld .sn-bar{width:min(260px,80%);height:6px;margin-top:0}" +
    ".sn-ld__s{font-size:.8rem;color:var(--ink-soft,#667085)}" +
    ".sn-ld__retry{padding:9px 20px;border:1.5px solid var(--accent,#34506f);border-radius:999px;background:transparent;color:inherit;font:inherit;font-weight:700;cursor:pointer}" +
    ".sn-ld__retry:focus-visible{outline:3px solid var(--accent,#34506f);outline-offset:2px}" +
    /* اسم الملف: الاسم بس هو اللي بيتقصّ بـ …، والامتداد والحجم والأيقونة ثابتين في مكانهم */
    ".sn-fl{display:flex;align-items:center;gap:8px;min-width:0;max-width:100%;width:100%}" +
    ".sn-fl__i{flex:none;display:inline-flex;align-items:center}" +
    ".sn-fl__n{min-width:0;flex:0 1 auto;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;unicode-bidi:plaintext}" +
    ".sn-fl__e{flex:none;direction:ltr;unicode-bidi:isolate;white-space:nowrap}" +
    ".sn-fl__s{flex:none;margin-inline-start:auto;direction:ltr;unicode-bidi:isolate;white-space:nowrap;font-size:.74rem;padding:3px 9px;border-radius:999px;background:rgba(127,127,127,.16);color:var(--ink-soft,inherit)}" +
    "@media (prefers-reduced-motion:reduce){.sn-tx__spin{animation-duration:2.4s}.sn-tx__item{transition:opacity .2s}}";
  document.head.appendChild(st);

  var root = null;
  function getRoot() {
    if (!root) {
      root = document.createElement("div");
      root.className = "sn-tx";
      root.setAttribute("role", "status");
      root.setAttribute("aria-live", "polite");
    }
    if (!root.parentNode && document.body) document.body.appendChild(root);
    return root;
  }

  /* ---------- حركة الشريط: بتتحرّك بنعومة، ولو الحجم مجهول بتزحف لحد 92% ---------- */
  function Ctl(paint) {
    var shown = 0, target = 0, indet = true, raf = 0, stopped = false, fullCb = null;
    function tick() {
      raf = 0;
      if (stopped) return;
      if (indet) shown += (0.92 - shown) * 0.02;
      else if (target > shown) shown = Math.min(target, shown + Math.max(0.004, (target - shown) * 0.2));
      if (!indet && target >= 1 && shown >= 0.999) {
        shown = 1; paint(1, false);
        if (fullCb) { var cb = fullCb; fullCb = null; cb(); }
        return;
      }
      paint(shown, indet);
      raf = requestAnimationFrame(tick);
    }
    function kick() { if (!raf && !stopped) raf = requestAnimationFrame(tick); }
    return {
      set: function (p) {
        if (p == null || isNaN(p) || p < 0) indet = true;
        else { indet = false; target = Math.max(target, Math.min(1, p)); }
        kick();
      },
      finish: function (cb) { indet = false; target = 1; fullCb = cb || null; kick(); },
      stop: function () { stopped = true; if (raf) cancelAnimationFrame(raf); }
    };
  }

  function setIco(box, svg) { var s = box.querySelector("svg"); if (s) s.outerHTML = svg; else box.insertAdjacentHTML("beforeend", svg); }
  function pctText(f, indet) { return indet ? "" : Math.round(f * 100) + "%"; }

  /* ---------- 1) الإشعار المنبثق من فوق ---------- */
  function start(label, opts) {
    opts = opts || {};
    var el = document.createElement("div");
    el.className = "sn-tx__item is-busy";
    el.innerHTML =
      '<div class="sn-tx__ico"><span class="sn-tx__spin"></span>' + ICO_DL + '</div>' +
      '<div class="sn-tx__tb"><div class="sn-tx__t"></div><div class="sn-tx__s"><span class="sn-tx__st"></span><span class="sn-tx__pct"></span></div>' +
      '<div class="sn-bar"><div class="sn-bar__fill"></div></div></div>';
    var ico = el.querySelector(".sn-tx__ico"), tEl = el.querySelector(".sn-tx__t"), sEl = el.querySelector(".sn-tx__st"),
      pEl = el.querySelector(".sn-tx__pct"), fill = el.querySelector(".sn-bar__fill");
    if (label) tEl.innerHTML = fileLabel(label); else tEl.textContent = tx().busy;
    sEl.textContent = tx().busy;
    getRoot().appendChild(el);
    requestAnimationFrame(function () { requestAnimationFrame(function () { el.classList.add("is-in"); }); });

    var ended = false;
    var ctl = Ctl(function (f, indet) {
      fill.style.width = (f * 100).toFixed(1) + "%";
      pEl.textContent = pctText(f, indet);
    });
    ctl.set(opts.progress == null ? null : opts.progress);

    function hide(ms) {
      setTimeout(function () {
        el.classList.remove("is-in");
        setTimeout(function () { ctl.stop(); if (el.parentNode) el.parentNode.removeChild(el); }, 350);
      }, ms);
    }
    return {
      set: function (p) { if (!ended) ctl.set(p); },
      done: function (msg) {
        if (ended) return; ended = true;
        ctl.finish(function () {
          el.classList.remove("is-busy"); el.classList.add("is-done");
          setIco(ico, ICO_OK); sEl.textContent = msg || tx().done; pEl.textContent = "100%";
          hide(1500);
        });
      },
      fail: function (msg) {
        if (ended) return; ended = true;
        ctl.stop();
        el.classList.remove("is-busy"); el.classList.add("is-fail");
        setIco(ico, ICO_X); sEl.textContent = msg || tx().fail; pEl.textContent = "";
        hide(3200);
      }
    };
  }

  /* ---------- 2) لوحة التحميل جوه نافذة العرض ---------- */
  function loader(host, label, lopts) {
    if (!host) return { set: function () { }, done: function (cb) { if (cb) cb(); }, fail: function () { }, cancel: function () { }, el: null };
    var prevPos = null;
    if (getComputedStyle(host).position === "static") { prevPos = host.style.position; host.style.position = "relative"; }
    var el = document.createElement("div");
    el.className = "sn-ld is-busy" + (lopts && lopts.inset != null ? " sn-ld--card" : "");
    el.setAttribute("role", "status");
    el.innerHTML =
      '<div class="sn-ld__ring"><svg viewBox="0 0 64 64"><circle class="bg" cx="32" cy="32" r="28"/><circle class="fg" cx="32" cy="32" r="28"/></svg><b class="sn-ld__pct"></b></div>' +
      '<div class="sn-ld__t"></div>' +
      '<div class="sn-bar"><div class="sn-bar__fill"></div></div>' +
      '<div class="sn-ld__s"></div>';
    var fg = el.querySelector(".fg"), tEl = el.querySelector(".sn-ld__t"), pEl = el.querySelector(".sn-ld__pct"),
      sEl = el.querySelector(".sn-ld__s"), fill = el.querySelector(".sn-bar__fill");
    if (label) tEl.innerHTML = fileLabel(label); else tEl.textContent = "";
    sEl.textContent = tx().opening;
    if (lopts && lopts.top != null) el.style.top = lopts.top + "px";
    if (lopts && lopts.inset != null) { el.style.left = el.style.right = el.style.bottom = lopts.inset + "px"; }
    host.appendChild(el);

    var ended = false, ctl;
    function paint(f, indet) { fill.style.width = (f * 100).toFixed(1) + "%"; fg.style.strokeDashoffset = (175.9 * (1 - f)).toFixed(2); pEl.textContent = pctText(f, indet); }
    function mk() { ctl = Ctl(paint); ctl.set(null); }
    mk();
    function remove() {
      ctl.stop();
      if (el.parentNode) el.parentNode.removeChild(el);
      if (prevPos !== null) host.style.position = prevPos;
    }
    return {
      el: el,
      cancel: function () { ended = true; remove(); },
      set: function (p) { if (!ended) ctl.set(p); },
      /* بيكمّل الشريط لـ 100% وبعدين يخفي اللوحة ويشغّل cb (وقتها المحتوى يظهر) */
      done: function (cb) {
        if (ended) return; ended = true;
        ctl.finish(function () {
          el.classList.remove("is-busy"); el.classList.add("is-done"); sEl.textContent = tx().ready;
          setTimeout(function () {
            el.classList.add("is-out");
            if (cb) cb();
            setTimeout(remove, 280);
          }, 160);
        });
      },
      fail: function (retry, msg) {
        ended = true; ctl.stop();
        el.classList.remove("is-busy"); el.classList.add("is-fail");
        sEl.textContent = msg || tx().fail; pEl.textContent = "!";
        if (typeof retry === "function") {
          var b = document.createElement("button");
          b.type = "button"; b.className = "sn-ld__retry"; b.textContent = tx().retry;
          b.addEventListener("click", function () {
            if (b.parentNode) b.parentNode.removeChild(b);
            el.classList.remove("is-fail"); el.classList.add("is-busy");
            sEl.textContent = tx().opening; pEl.textContent = "";
            ended = false; mk(); retry();
          });
          el.appendChild(b);
        }
      }
    };
  }

  /* ---------- 3) تحميل بتقدّم حقيقي ---------- */
  function fetchWithProgress(url, opts, onProgress, sizeHint) {
    return fetch(url, opts).then(function (r) {
      if (!r.ok) throw new Error("HTTP_" + r.status);
      var total = Number(r.headers.get("content-length")) || sizeHint || 0;
      if (!r.body || !r.body.getReader) {
        return r.blob().then(function (b) { if (onProgress) onProgress(1); return b; });
      }
      var reader = r.body.getReader(), chunks = [], got = 0, type = r.headers.get("content-type") || "";
      function pump() {
        return reader.read().then(function (x) {
          if (x.done) { if (onProgress) onProgress(1); return new Blob(chunks, type ? { type: type } : undefined); }
          chunks.push(x.value); got += x.value.length;
          if (onProgress) onProgress(total ? Math.min(0.99, got / total) : null);
          return pump();
        });
      }
      return pump();
    });
  }

  function saveBlob(blob, name, label) {
    var t = start(label || name || "");
    try {
      t.set(1);
      var u = URL.createObjectURL(blob), a = document.createElement("a");
      a.href = u; a.download = name || "file"; a.style.display = "none";
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(function () { URL.revokeObjectURL(u); }, 10000);
      t.done();
    } catch (e) { t.fail(); }
  }

  function download(url, name, opts) {
    var t = start(name || "");
    return fetchWithProgress(url, opts, t.set)
      .then(function (b) {
        var u = URL.createObjectURL(b), a = document.createElement("a");
        a.href = u; a.download = name || "file"; a.style.display = "none";
        document.body.appendChild(a); a.click(); a.remove();
        setTimeout(function () { URL.revokeObjectURL(u); }, 10000);
        t.done(); return b;
      })
      .catch(function (e) { t.fail(); throw e; });
  }

  /* ---------- 4) عنوان ملف بشكل ثابت: [أيقونة] [الاسم…] [.pdf] [(14.1 MB)] ---------- */
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function fmtSize(n) {
    n = Number(n) || 0;
    return n > 1048576 ? (n / 1048576).toFixed(1) + " MB" : Math.max(1, Math.round(n / 1024)) + " KB";
  }
  function fileLabel(name, size, iconHtml) {
    name = String(name || "");
    var m = /^([\s\S]*?)(\.[A-Za-z0-9]{1,5})$/.exec(name), base = m ? m[1] : name, ext = m ? m[2] : "";
    return '<span class="sn-fl" title="' + esc(name) + '">' +
      (iconHtml ? '<span class="sn-fl__i">' + iconHtml + '</span>' : '') +
      '<span class="sn-fl__n">' + esc(base) + '</span>' +
      (ext ? '<span class="sn-fl__e">' + esc(ext) + '</span>' : '') +
      (size ? '<span class="sn-fl__s">' + fmtSize(size) + '</span>' : '') + '</span>';
  }

  window.SNTransfer = { fileLabel: fileLabel, fmtSize: fmtSize, start: start, loader: loader, fetchWithProgress: fetchWithProgress, saveBlob: saveBlob, download: download };
})();

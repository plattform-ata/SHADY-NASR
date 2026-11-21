/* ==========================================================================
   ai-files.js — تحويل ملف (PDF / Word / صورة / نص) لأسئلة، عن طريق الـ Worker "shady-files".
   window.SNAIFiles.convert(file, { letters, hint, onState }) → Promise<{ sections }>
     sections = [{ type: "mcq"|"vocab"|"correction"|"translation"|"conversation"|"essay", questions: [{ text, options[], answer }] }]
   بيتحمّل في admin.html قبل content-admin.js.
   ========================================================================== */
(function () {
  "use strict";
  if (window.SNAIFiles) return;

  var FILES_URL = "https://shady-files.nasr-platform.workers.dev";
  var TOKEN = "f3xTpDzfVCkeYQEr3IFKbG5k";          /* لازم يطابق ADMIN_KEY_DEFAULT في files-worker.js */
  var PDFJS_VER = "3.11.174";
  var EXTS = ["pdf", "docx", "txt", "md", "png", "jpg", "jpeg", "webp"];

  function extOf(f) { var m = String(f && f.name || "").match(/\.([a-z0-9]+)$/i); return m ? m[1].toLowerCase() : ""; }
  function isImage(f) { return /^image\//.test(f.type || "") || ["png", "jpg", "jpeg", "webp"].indexOf(extOf(f)) >= 0; }
  function isConvertible(f) { return !!f && (EXTS.indexOf(extOf(f)) >= 0 || isImage(f)); }
  function err(msg) { var e = new Error(msg); e.ai = true; return e; }

  function loadPdfJs() {
    if (window.pdfjsLib) return Promise.resolve(window.pdfjsLib);
    return new Promise(function (ok, no) {
      var sc = document.createElement("script");
      sc.src = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/" + PDFJS_VER + "/pdf.min.js";
      sc.onload = function () {
        if (!window.pdfjsLib) return no(new Error("pdfjs"));
        window.pdfjsLib.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/" + PDFJS_VER + "/pdf.worker.min.js";
        ok(window.pdfjsLib);
      };
      sc.onerror = function () { no(new Error("pdfjs")); };
      document.head.appendChild(sc);
    });
  }
  function pdfText(file) {
    return loadPdfJs().then(function (lib) {
      return file.arrayBuffer().then(function (buf) { return lib.getDocument({ data: buf }).promise; });
    }).then(function (doc) {
      var out = [], n = Math.min(doc.numPages, 40), chain = Promise.resolve();
      function page(i) {
        chain = chain.then(function () { return doc.getPage(i); }).then(function (pg) { return pg.getTextContent(); }).then(function (tc) {
          var lines = [], line = "", y = null;
          tc.items.forEach(function (it) {
            var yy = it.transform ? Math.round(it.transform[5]) : 0;
            if (y !== null && Math.abs(yy - y) > 3) { lines.push(line); line = ""; }
            line += (line && !/\s$/.test(line) && !/^\s/.test(it.str) ? " " : "") + it.str; y = yy;
          });
          lines.push(line); out.push(lines.join("\n"));
        });
      }
      for (var i = 1; i <= n; i++) page(i);
      return chain.then(function () { return { text: out.join("\n\n"), doc: doc }; });
    });
  }
  function pdfImages(doc) {
    var res = [], n = Math.min(doc.numPages, 4), chain = Promise.resolve();
    function page(i) {
      chain = chain.then(function () { return doc.getPage(i); }).then(function (pg) {
        var vp = pg.getViewport({ scale: 1.4 }), cv = document.createElement("canvas");
        cv.width = vp.width; cv.height = vp.height;
        return pg.render({ canvasContext: cv.getContext("2d"), viewport: vp }).promise.then(function () {
          res.push({ mime: "image/jpeg", data: cv.toDataURL("image/jpeg", 0.82).split(",")[1] });
        });
      });
    }
    for (var i = 1; i <= n; i++) page(i);
    return chain.then(function () { return res; });
  }
  function imageToJpeg(file) {
    return new Promise(function (ok, no) {
      var url = URL.createObjectURL(file), img = new Image();
      img.onload = function () {
        var k = Math.min(1, 1600 / Math.max(img.width, img.height)), cv = document.createElement("canvas");
        cv.width = Math.round(img.width * k); cv.height = Math.round(img.height * k);
        cv.getContext("2d").drawImage(img, 0, 0, cv.width, cv.height); URL.revokeObjectURL(url);
        ok({ mime: "image/jpeg", data: cv.toDataURL("image/jpeg", 0.85).split(",")[1] });
      };
      img.onerror = function () { URL.revokeObjectURL(url); no(new Error("img")); };
      img.src = url;
    });
  }
  function readB64(file) {
    return new Promise(function (ok, no) {
      var fr = new FileReader(); fr.onload = function () { ok(String(fr.result).split(",")[1] || ""); }; fr.onerror = function () { no(new Error("read")); }; fr.readAsDataURL(file);
    });
  }

  function convert(file, o) {
    o = o || {};
    var say = typeof o.onState === "function" ? o.onState : function () { };
    var ext = extOf(file), img = isImage(file);
    if (ext === "doc") return Promise.reject(err("ملفات Word القديمة (.doc) مش مدعومة. احفظ الملف كـ .docx أو PDF وجرّب تاني."));
    if (!isConvertible(file)) return Promise.reject(err("نوع الملف مش مدعوم. ارفع PDF أو Word (.docx) أو صورة أو ملف نص."));
    var maxMb = ext === "pdf" ? 25 : 8;
    if (file.size > maxMb * 1024 * 1024) return Promise.reject(err("الملف كبير (الحد الأقصى " + maxMb + " ميجا). قسّمه لأجزاء أصغر."));

    say("بيقرا الملف…");
    var prep = ext === "pdf"
      ? pdfText(file).then(function (r) {
        if (r.text.replace(/\s+/g, "").length >= 40) return { text: r.text };
        say("الـ PDF مصوّر، بيقرا الصفحات كصور…");
        return pdfImages(r.doc).then(function (imgs) { return { images: imgs }; });
      })
      : img ? imageToJpeg(file).then(function (im) { return { images: [im] }; })
        : readB64(file).then(function (data) { return { file: { name: file.name, mime: file.type || "", data: data } }; });

    return prep.then(function (payload) {
      say("بيحوّل الملف لأسئلة… ممكن ياخد لحد كام دقيقة");
      var ctl = new AbortController(), timer = setTimeout(function () { ctl.abort(); }, 170000);
      var body = { action: "extract_questions", adminKey: TOKEN, letters: o.letters || ["A", "B", "C", "D"], hint: String(o.hint || "").slice(0, 500) };
      Object.keys(payload).forEach(function (k) { body[k] = payload[k]; });
      return fetch(FILES_URL, { method: "POST", signal: ctl.signal, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
        .then(function (r) { clearTimeout(timer); return r.json().catch(function () { return {}; }); }, function (e) { clearTimeout(timer); throw e; });
    }).then(function (res) {
      if (!res || !res.ok) {
        var c = res && res.error;
        throw err(c === "no_key" ? "مفتاح الملفات مش متضاف على الـ Worker (shady-files): لازم Secret اسمه files-exame" :
          c === "provider_auth" ? "مفتاح Groq بتاع الملفات (files-exame) غلط أو منتهي" :
          c === "auth" ? "التوكن مش مطابق: الصق files-worker.js الجديد في الـ Worker shady-files واعمل Deploy" :
          c === "unsupported" ? "نوع الملف مش مدعوم" : c === "too_big" ? "الملف كبير على قراءة واحدة. قسّمه لأجزاء أصغر" :
          c === "empty" ? "ماقدرتش ألاقي أسئلة في الملف ده" : c === "rate_limited" ? "الحد المجاني خلص دلوقتي، جرّب بعد دقيقة" :
          "تعذّر تحويل الملف. افتح رابط الـ Worker shady-files في المتصفح وشوف حالته");
      }
      return { sections: res.sections || [] };
    }).catch(function (e) {
      if (e && e.ai) throw e;
      throw err(e && e.name === "AbortError" ? "التحويل أخد وقت طويل، جرّب ملف أصغر" :
        e && e.message === "pdfjs" ? "تعذّر تحميل قارئ الـ PDF، اتأكد من النت وجرّب تاني" :
        e && e.message === "img" ? "الصورة دي مش مفهومة" : "تعذّر تحويل الملف. اتأكد من النت وجرّب تاني");
    });
  }

  window.SNAIFiles = { convert: convert, isConvertible: isConvertible, accept: ".pdf,.docx,.txt,.md,.png,.jpg,.jpeg,.webp,image/*,application/pdf" };
})();

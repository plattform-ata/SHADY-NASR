/* ==========================================================================
   certificates.js — شهادات التقدير الشهرية + نافذة عرض الصور (شهادة / شارة)
   - SNCert.render(rec)  : بيرسم الشهادة كصورة (Canvas) بالإنجليزي، باسم الطالب ولوجو المنصة
   - SNCert.open(rec)    : بيفتح الشهادة في نافذة بنفس ستايل الموقع، فيها قايمة ⋮ (تحميل / طباعة / مشاركة)
   - SNCert.view(opts)   : نفس النافذة لأي صورة بتتولّد (بنستخدمها للشارات)
   السجل: { id, name, rank, gain, bonus, month: "YYYY-MM", createdAt }
   ========================================================================== */
(function () {
  "use strict";
  if (window.SNCert) return;

  var LOGO_SRC = "shady-nasr-logo.png";
  var TEACHER = "Mr. Shady Nasr";
  var PLATFORM = "SHADY NASR PLATFORM";
  var W = 2000, H = 1550;
  var SCRIPT = '"Great Vibes", "Allura", "Segoe Script", cursive';
  var SANS = '"Poppins", "Cairo", "Segoe UI", Arial, sans-serif';
  var ARABIC = '"Cairo", "Tajawal", "Segoe UI", Arial, sans-serif';

  var curLang = function () { return document.documentElement.lang === "en" ? "en" : "ar"; };
  var TXT = {
    ar: { cert: "شهادة تقدير", more: "المزيد", close: "إغلاق", download: "تحميل الصورة", print: "طباعة", share: "مشاركة",
      loading: "جاري تجهيز الصورة…", fail: "تعذر تجهيز الصورة — حاول تاني بعد شوية", saved: "اتحمّلت الصورة على جهازك",
      noShare: "المشاركة مش متاحة على الجهاز ده — اتحمّلت الصورة بدلًا منها", printFail: "تعذرت الطباعة — حمّل الصورة واطبعها" },
    en: { cert: "Certificate of appreciation", more: "More", close: "Close", download: "Download image", print: "Print", share: "Share",
      loading: "Preparing the image…", fail: "Couldn't prepare the image. Please try again.", saved: "Image saved to your device",
      noShare: "Sharing isn't available on this device — the image was downloaded instead", printFail: "Printing failed — download the image and print it" }
  };
  var tx = function (k) { return (TXT[curLang()] || TXT.ar)[k] || k; };

  /* ---------- أدوات صغيرة ---------- */
  var MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  function monthLabel(m) {
    var p = String(m || "").split("-");
    var i = Number(p[1]) - 1;
    return (MONTHS[i] || "") + (p[0] ? " " + p[0] : "");
  }
  function dateLabel(v) {
    var d = new Date(v || Date.now());
    if (isNaN(d.getTime())) d = new Date();
    return d.getDate() + " " + MONTHS[d.getMonth()] + " " + d.getFullYear();
  }
  function slug(s) { return String(s || "").replace(/[^\w\u0600-\u06FF]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40) || "certificate"; }
  var hasArabic = function (s) { return /[\u0600-\u06FF]/.test(String(s || "")); };

  var fontsP = null;
  function ensureFonts() {
    if (fontsP) return fontsP;
    if (!document.getElementById("snCertFonts")) {
      var l = document.createElement("link");
      l.id = "snCertFonts"; l.rel = "stylesheet";
      l.href = "https://fonts.googleapis.com/css2?family=Great+Vibes&family=Poppins:wght@400;500;600;700;800&family=Cairo:wght@600;800&display=swap";
      document.head.appendChild(l);
    }
    var loads = ["400 30px Poppins", "600 30px Poppins", "700 30px Poppins", "800 30px Poppins", "400 60px 'Great Vibes'", "800 40px Cairo"]
      .map(function (f) { return document.fonts && document.fonts.load ? document.fonts.load(f).catch(function () { }) : Promise.resolve(); });
    var timeout = new Promise(function (r) { setTimeout(r, 3500); });
    fontsP = Promise.race([Promise.all(loads), timeout]);
    return fontsP;
  }

  var logoP = null;
  function loadLogo() {
    if (logoP) return logoP;
    logoP = new Promise(function (res) {
      var im = new Image();
      im.onload = function () { res(im); };
      im.onerror = function () { res(null); };
      im.src = LOGO_SRC;
    });
    return logoP;
  }

  function roundPoly(ctx, pts, r) {
    var n = pts.length;
    ctx.beginPath();
    for (var i = 0; i < n; i++) {
      var p0 = pts[(i - 1 + n) % n], p1 = pts[i], p2 = pts[(i + 1) % n];
      var d1 = Math.hypot(p0.x - p1.x, p0.y - p1.y), d2 = Math.hypot(p2.x - p1.x, p2.y - p1.y);
      var d = Math.min(r, d1 / 2, d2 / 2);
      var a = { x: p1.x + (p0.x - p1.x) / d1 * d, y: p1.y + (p0.y - p1.y) / d1 * d };
      var b = { x: p1.x + (p2.x - p1.x) / d2 * d, y: p1.y + (p2.y - p1.y) / d2 * d };
      if (i) ctx.lineTo(a.x, a.y); else ctx.moveTo(a.x, a.y);
      ctx.quadraticCurveTo(p1.x, p1.y, b.x, b.y);
    }
    ctx.closePath();
  }
  function lin(ctx, x0, y0, x1, y1, stops) {
    var g = ctx.createLinearGradient(x0, y0, x1, y1);
    stops.forEach(function (s, i) { g.addColorStop(i / (stops.length - 1), s); });
    return g;
  }
  var GOLD = ["#fbe38e", "#d9a23a", "#a9741c", "#e8bb55", "#fbe38e"];
  var MAROON = ["#4a070c", "#8f1a21", "#5e0b11"];
  var BLACK = ["#161616", "#2d2d2d", "#171717"];

  function wrap(ctx, text, maxW) {
    var words = String(text).split(/\s+/), lines = [], cur = "";
    words.forEach(function (w) {
      var t = cur ? cur + " " + w : w;
      if (ctx.measureText(t).width > maxW && cur) { lines.push(cur); cur = w; } else cur = t;
    });
    if (cur) lines.push(cur);
    return lines;
  }
  function spaced(ctx, text, x, y, sp, align) {
    var chars = String(text).split(""), widths = chars.map(function (c) { return ctx.measureText(c).width; });
    var total = widths.reduce(function (a, b) { return a + b; }, 0) + sp * (chars.length - 1);
    var cx = align === "right" ? x - total : align === "center" ? x - total / 2 : x;
    ctx.textAlign = "left";
    chars.forEach(function (c, i) { ctx.fillText(c, cx, y); cx += widths[i] + sp; });
    return total;
  }

  function laurel(ctx, cx, cy, r, color, leaf, count) {
    ctx.fillStyle = color;
    for (var s = -1; s <= 1; s += 2) {
      for (var i = 0; i < count; i++) {
        var t = i / (count - 1), a = (0.5 + 0.95 * t) * Math.PI / 2 + 0.05; // من تحت لفوق
        var ang = s < 0 ? Math.PI - a + 0.0 : a; // يمين/شمال
        var px = cx + r * Math.cos(ang), py = cy + r * Math.sin(ang);
        ctx.save();
        ctx.translate(px, py);
        ctx.rotate(ang + (s < 0 ? -1 : 1) * (Math.PI / 2 + 0.55));
        ctx.beginPath();
        ctx.ellipse(0, 0, leaf * 0.55, leaf * 0.22, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    }
  }

  function rosette(ctx, cx, cy, R, label, logo) {
    // الشريط الذهبي اللي تحت الوردة
    [-1, 1].forEach(function (s) {
      ctx.save();
      ctx.translate(cx + s * 22, cy + R * 0.55);
      ctx.rotate(s * 0.22);
      ctx.beginPath();
      ctx.moveTo(-52, 0); ctx.lineTo(52, 0); ctx.lineTo(52, 270); ctx.lineTo(0, 225); ctx.lineTo(-52, 270); ctx.closePath();
      ctx.fillStyle = lin(ctx, -52, 0, 52, 270, ["#f7d56e", "#c58a22", "#e9bb4f"]);
      ctx.fill();
      ctx.restore();
    });
    // الوردة المسنّنة
    ctx.beginPath();
    for (var a = 0; a <= Math.PI * 2 + 0.01; a += 0.02) {
      var rr = R * (1 + 0.055 * Math.cos(a * 30));
      var x = cx + rr * Math.cos(a), y = cy + rr * Math.sin(a);
      if (a === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fillStyle = lin(ctx, cx - R, cy - R, cx + R, cy + R, GOLD);
    ctx.fill();
    ctx.lineWidth = 4; ctx.strokeStyle = "rgba(110,70,10,.55)"; ctx.stroke();
    ctx.beginPath(); ctx.arc(cx, cy, R * 0.8, 0, Math.PI * 2);
    ctx.lineWidth = 6; ctx.strokeStyle = "#8d5e12"; ctx.stroke();
    ctx.beginPath(); ctx.arc(cx, cy, R * 0.74, 0, Math.PI * 2);
    ctx.fillStyle = lin(ctx, cx, cy - R, cx, cy + R, ["#2c2c2c", "#111"]);
    ctx.fill();
    laurel(ctx, cx, cy + 6, R * 0.58, "#e3b64c", R * 0.2, 9);
    ctx.fillStyle = lin(ctx, cx, cy - 60, cx, cy + 60, ["#fbe38e", "#d49a2c"]);
    ctx.font = "800 " + Math.round(R * 0.8) + "px " + SANS;
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText(String(label), cx, cy - R * 0.04);
  }

  function seal(ctx, cx, cy, R, kind, logo) {
    ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2);
    ctx.fillStyle = kind === "logo" ? "#fffaf0" : "#1b1b1b"; ctx.fill();
    ctx.lineWidth = 5; ctx.strokeStyle = kind === "logo" ? "#c58a22" : "#1b1b1b"; ctx.stroke();
    ctx.beginPath(); ctx.arc(cx, cy, R * 0.86, 0, Math.PI * 2);
    ctx.lineWidth = 3; ctx.strokeStyle = kind === "logo" ? "#c58a22" : "#e3b64c"; ctx.stroke();
    if (kind === "logo") {
      if (logo) {
        var box = R * 1.34, k = Math.min(box / logo.width, box / logo.height);
        ctx.drawImage(logo, cx - logo.width * k / 2, cy - logo.height * k / 2, logo.width * k, logo.height * k);
      }
    } else {
      laurel(ctx, cx, cy + 4, R * 0.7, "#e3b64c", R * 0.2, 7);
      ctx.fillStyle = "#e3b64c"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.font = "800 " + Math.round(R * 0.34) + "px " + SANS; ctx.fillText("TOP 5", cx, cy - R * 0.1);
      ctx.font = "600 " + Math.round(R * 0.17) + "px " + SANS; ctx.fillText("OF THE MONTH", cx, cy + R * 0.26);
    }
  }

  /* ---------- رسم الشهادة ---------- */
  function drawCertificate(rec, logo) {
    var c = document.createElement("canvas");
    c.width = W; c.height = H;
    var ctx = c.getContext("2d");
    ctx.textBaseline = "alphabetic";

    // الإطار الأسود
    ctx.fillStyle = "#1c1c1c"; ctx.fillRect(0, 0, W, H);
    // الورقة الكريمي
    var PX = 46, PY = 40;
    ctx.save();
    ctx.beginPath(); ctx.rect(PX, PY, W - PX * 2, H - PY * 2); ctx.clip();
    ctx.fillStyle = lin(ctx, 0, 0, W, H, ["#f8ecd0", "#f3e4c3", "#f9efd7"]);
    ctx.fillRect(0, 0, W, H);
    // خطوط ناعمة في الخلفية
    ctx.lineWidth = 1.6;
    for (var i = 0; i < 46; i++) {
      ctx.beginPath();
      for (var x = 560; x <= W; x += 20) {
        var y = 120 + i * 30 + Math.sin(x / 210 + i * 0.35) * 26;
        if (x === 560) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.strokeStyle = "rgba(176,140,80," + (0.1 + (i % 3) * 0.03) + ")";
      ctx.stroke();
    }

    // الزخرفة الشمال: شريط ماروني + شكل دهبي + شكل أسود
    roundPoly(ctx, [{ x: 0, y: 0 }, { x: 430, y: 0 }, { x: 430, y: 470 }, { x: 690, y: 800 }, { x: 540, y: 1010 }, { x: 0, y: 760 }], 26);
    ctx.fillStyle = lin(ctx, 0, 0, 700, 1000, MAROON); ctx.fill();
    roundPoly(ctx, [{ x: 0, y: 560 }, { x: 330, y: 330 }, { x: 620, y: 560 }, { x: 620, y: 700 }, { x: 330, y: 1030 }, { x: 0, y: 1030 }], 70);
    ctx.fillStyle = lin(ctx, 0, 330, 640, 1130, GOLD); ctx.fill();
    roundPoly(ctx, [{ x: 0, y: 900 }, { x: 480, y: 900 }, { x: 590, y: 1030 }, { x: 560, y: 1140 }, { x: 330, y: H }, { x: 0, y: H }], 80);
    ctx.fillStyle = lin(ctx, 0, 900, 600, H, BLACK); ctx.fill();
    // خط دهبي رفيع حوالين الشكل الأسود
    roundPoly(ctx, [{ x: 0, y: 960 }, { x: 520, y: 960 }, { x: 640, y: 1050 }, { x: 540, y: 1190 }, { x: 390, y: H }, { x: 0, y: H }], 80);
    ctx.lineWidth = 6; ctx.strokeStyle = "#d9a23a"; ctx.stroke();

    // الشريط الأسود المعلّق + الوردة
    ctx.fillStyle = lin(ctx, 190, 0, 420, 0, BLACK);
    ctx.fillRect(190, 0, 230, 520);
    ctx.fillStyle = lin(ctx, 0, 0, 0, 520, ["#f7d56e", "#c58a22"]);
    ctx.fillRect(184, 0, 12, 520); ctx.fillRect(414, 0, 12, 520);
    rosette(ctx, 305, 560, 130, rec.rank || 1, logo);
    ctx.restore();

    // الخطوط الرفيعة على اليمين/فوق/تحت (زي الأوراق المتراصة في الصورة)
    ctx.lineWidth = 3; ctx.strokeStyle = "rgba(60,48,30,.55)";
    ctx.strokeRect(PX + 14, PY + 14, W - PX * 2 - 28, H - PY * 2 - 28);
    ctx.lineWidth = 2; ctx.strokeStyle = "rgba(201,150,50,.9)";
    ctx.strokeRect(PX + 26, PY + 26, W - PX * 2 - 52, H - PY * 2 - 52);

    // النصوص
    var L = 760, R = W - 150, cxT = (L + R) / 2;
    ctx.textBaseline = "alphabetic";
    ctx.fillStyle = "#222";
    ctx.font = "800 158px " + SANS;
    var tw = spaced(ctx, "CERTIFICATE", R, 400, 6, "right");
    // اللافتة الحمرا
    var bx = R - tw / 2, bw = 640, bh = 86, by = 440;
    ctx.beginPath();
    ctx.moveTo(bx - bw / 2, by + bh / 2); ctx.lineTo(bx - bw / 2 + 44, by); ctx.lineTo(bx + bw / 2 - 44, by); ctx.lineTo(bx + bw / 2, by + bh / 2);
    ctx.lineTo(bx + bw / 2 - 44, by + bh); ctx.lineTo(bx - bw / 2 + 44, by + bh); ctx.closePath();
    ctx.fillStyle = lin(ctx, bx - bw / 2, by, bx + bw / 2, by, ["#5e0b11", "#a3202a", "#5e0b11"]); ctx.fill();
    ctx.fillStyle = "#fff"; ctx.font = "700 52px " + SANS; ctx.textBaseline = "middle";
    spaced(ctx, "OF APPRECIATION", bx, by + bh / 2 + 3, 5, "center");

    ctx.textBaseline = "alphabetic"; ctx.fillStyle = "#222"; ctx.font = "500 40px " + SANS;
    spaced(ctx, "THIS CERTIFICATE IS PROUDLY PRESENTED TO", R, 700, 2.2, "right");

    // الاسم
    var name = String(rec.name || "Student Name").trim();
    var arabic = hasArabic(name), maxNameW = R - L, size = arabic ? 150 : 215;
    var fam = arabic ? ARABIC : SCRIPT, wt = arabic ? "800 " : "400 ";
    ctx.font = wt + size + "px " + fam;
    while (ctx.measureText(name).width > maxNameW && size > 60) { size -= 4; ctx.font = wt + size + "px " + fam; }
    ctx.fillStyle = "#7d0f14"; ctx.textAlign = arabic ? "right" : "left";
    if (arabic) ctx.direction = "rtl";
    ctx.fillText(name, arabic ? R : L, 850);
    ctx.direction = "ltr";
    ctx.beginPath(); ctx.moveTo(L, 895); ctx.lineTo(R, 895); ctx.lineWidth = 3; ctx.strokeStyle = "#222"; ctx.stroke();

    ctx.fillStyle = "#222"; ctx.font = "600 34px " + SANS;
    spaced(ctx, ("RANK " + (rec.rank || 1) + " · " + monthLabel(rec.month)).toUpperCase(), R, 950, 2.5, "right");

    ctx.textAlign = "left"; ctx.font = "400 31px " + SANS; ctx.fillStyle = "#333";
    var body = "Awarded in recognition of outstanding effort, steady progress and a real passion for learning English. " +
      "Ranked No. " + (rec.rank || 1) + " among all students on the platform in " + monthLabel(rec.month) +
      (rec.gain ? ", with " + rec.gain + " points earned this month" : "") + ". " +
      "A bonus of " + (rec.bonus || 50) + " points has been added to the student's account. Keep shining!";
    var lines = wrap(ctx, body, R - L), y = 1015;
    lines.forEach(function (ln) { ctx.fillText(ln, L, y); y += 46; });

    // الفوتر: التاريخ — ختمين — التوقيع
    var fy = 1355;
    ctx.strokeStyle = "#222"; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(L, fy); ctx.lineTo(L + 330, fy); ctx.moveTo(R - 330, fy); ctx.lineTo(R, fy); ctx.stroke();
    ctx.fillStyle = "#222"; ctx.font = "500 32px " + SANS; ctx.textAlign = "center";
    ctx.fillText(dateLabel(rec.createdAt), L + 165, fy - 16);
    ctx.font = "600 28px " + SANS;
    spaced(ctx, "DATE", L + 165, fy + 44, 3, "center");
    spaced(ctx, "SIGNATURE", R - 165, fy + 44, 3, "center");
    var ss = 78; ctx.font = "400 " + ss + "px " + SCRIPT;
    while (ctx.measureText(TEACHER).width > 320 && ss > 30) { ss -= 2; ctx.font = "400 " + ss + "px " + SCRIPT; }
    ctx.fillStyle = "#7d0f14"; ctx.textAlign = "center";
    ctx.fillText(TEACHER, R - 165, fy - 22);
    seal(ctx, cxT - 105, fy - 22, 76, "top", logo);
    seal(ctx, cxT + 105, fy - 22, 76, "logo", logo);

    ctx.fillStyle = "rgba(34,34,34,.6)"; ctx.font = "600 22px " + SANS;
    spaced(ctx, PLATFORM, cxT, fy + 90, 5, "center");
    return c;
  }

  function render(rec) {
    return Promise.all([ensureFonts(), loadLogo()]).then(function (r) { return drawCertificate(rec || {}, r[1]); });
  }

  /* ---------- نافذة العرض (بنفس ستايل نوافذ الموقع) ---------- */
  function injectCss() {
    if (document.getElementById("snCertCss")) return;
    var st = document.createElement("style");
    st.id = "snCertCss";
    st.textContent =
      ".modal--cert{max-width:min(980px,96vw);padding:14px 14px 16px;text-align:start;display:flex;flex-direction:column;gap:12px;max-height:94vh}" +
      ".sn-cert__bar{display:flex;align-items:center;gap:8px;position:relative;padding-inline:6px}" +
      ".sn-cert__title{flex:1;min-width:0;font-family:var(--font-display);font-weight:800;font-size:1rem;color:var(--ink);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}" +
      ".sn-cert__btn{width:38px;height:38px;border-radius:50%;border:none;background:transparent;color:var(--ink-soft);display:grid;place-items:center;cursor:pointer;transition:background .2s var(--ease),color .2s var(--ease)}" +
      ".sn-cert__btn:hover,.sn-cert__btn[aria-expanded=true]{background:var(--surface-glass-border);color:var(--ink)}" +
      ".sn-cert__btn:focus-visible{outline:2px solid var(--accent);outline-offset:2px}" +
      ".sn-cert__btn svg{width:20px;height:20px}" +
      ".sn-cert__menu{position:absolute;top:calc(100% + 6px);inset-inline-end:44px;z-index:5;min-width:210px;padding:6px;border-radius:var(--radius-md);background:var(--surface-glass);border:1px solid var(--surface-glass-border);box-shadow:0 18px 44px rgba(0,0,0,.28);display:flex;flex-direction:column;gap:2px;transform-origin:top;animation:snCertPop .16s var(--ease)}" +
      ".sn-cert__menu[hidden]{display:none}" +
      "@keyframes snCertPop{from{opacity:0;transform:translateY(-6px) scale(.97)}to{opacity:1;transform:none}}" +
      ".sn-cert__item{display:flex;align-items:center;gap:12px;width:100%;padding:11px 12px;border:none;border-radius:10px;background:transparent;color:var(--ink);font:inherit;font-weight:700;font-size:.92rem;text-align:start;cursor:pointer}" +
      ".sn-cert__item:hover,.sn-cert__item:focus-visible{background:var(--surface-glass-border);outline:none}" +
      ".sn-cert__item svg{width:19px;height:19px;flex:none;color:var(--accent)}" +
      ".sn-cert__stage{flex:1;min-height:0;display:grid;place-items:center;border-radius:var(--radius-md);background:var(--bg-soft);padding:10px;overflow:auto;position:relative;min-height:300px}" +
      ".sn-cert__stage img{display:block;max-width:100%;max-height:calc(94vh - 120px);height:auto;border-radius:8px;box-shadow:0 14px 40px rgba(0,0,0,.25);-webkit-user-drag:none}" +
      ".sn-cert__load{color:var(--ink-soft);font-weight:700;padding:60px 10px}" +
      ".sn-cert__bar .modal__close{position:static}" +
      /* موبايل: نافذة بتطلع من تحت (Bottom sheet) بدل كارت صغير مضغوط في النص */
      "@media (max-width:720px){" +
      ".modal-overlay--cert{display:flex;align-items:flex-end;justify-content:center;padding:0!important;overflow:hidden}" +
      ".modal-overlay--cert .modal--cert{width:100%;max-width:520px;height:88vh;height:88dvh;max-height:none;gap:0;padding:0 0 env(safe-area-inset-bottom,0px);" +
      "border-radius:26px 26px 0 0;transform:translateY(105%);transition:transform .35s cubic-bezier(.2,.9,.3,1)}" +
      ".modal-overlay--cert.is-open .modal--cert{transform:none}" +
      ".modal--cert::before{content:'';flex:none;width:42px;height:4px;border-radius:9px;background:var(--surface-glass-border);margin:9px auto 0}" +
      ".modal--cert .sn-cert__bar{padding:12px 16px 10px}" +
      ".modal--cert .sn-cert__btn{border:1px solid var(--surface-glass-border);background:var(--surface-glass);color:var(--ink)}" +
      ".modal--cert .sn-cert__stage{margin:0 12px 12px;padding:12px;min-height:0;border-radius:18px;border:1px solid var(--surface-glass-border);background:var(--surface-glass)}" +
      ".modal--cert .sn-cert__stage img{max-height:calc(88dvh - 150px)}" +
      ".modal--cert .sn-cert__menu{inset-inline-end:16px}" +
      "}";
    document.head.appendChild(st);
  }
  var IC = {
    more: '<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="5" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="12" cy="19" r="2"/></svg>',
    close: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18"/></svg>',
    dl: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12m0 0 4-4m-4 4-4-4M5 20h14"/></svg>',
    pr: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 9V3h10v6M7 17H5a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2h-2"/><rect x="7" y="14" width="10" height="7" rx="1"/></svg>',
    sh: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8.6 13.5 6.8 4m0-11-6.8 4"/></svg>'
  };
  var toast = function (m, err) { if (window.snDialog && snDialog.toast) snDialog.toast(m, { error: !!err }); };

  function canvasBlob(c) {
    return new Promise(function (res, rej) { c.toBlob(function (b) { b ? res(b) : rej(new Error("BLOB")); }, "image/png"); });
  }
  function saveBlob(blob, filename) {
    var u = URL.createObjectURL(blob), a = document.createElement("a");
    a.href = u; a.download = filename; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(u); }, 4000);
  }
  function printUrl(url) {
    return new Promise(function (resolve, reject) {
      var f = document.createElement("iframe");
      f.style.cssText = "position:fixed;width:0;height:0;border:0;opacity:0;pointer-events:none";
      f.onload = function () {
        try {
          var w = f.contentWindow;
          var im = w.document.querySelector("img");
          var go = function () { w.focus(); w.print(); setTimeout(function () { f.remove(); }, 2000); resolve(); };
          if (im && !im.complete) { im.onload = go; im.onerror = function () { f.remove(); reject(new Error("IMG")); }; } else go();
        } catch (e) { f.remove(); reject(e); }
      };
      f.srcdoc = '<!doctype html><html><head><style>@page{size:landscape;margin:0}html,body{margin:0;height:100%}img{display:block;width:100%;height:100%;object-fit:contain}</style></head><body><img src="' + url + '"></body></html>';
      document.body.appendChild(f);
    });
  }

  /* opts: { title, filename, render: () => Promise<canvas>, shareText } */
  function view(opts) {
    injectCss();
    var prevFocus = document.activeElement;
    var ov = document.createElement("div");
    ov.className = "modal-overlay modal-overlay--cert";
    ov.innerHTML =
      '<div class="modal modal--cert" role="dialog" aria-modal="true" aria-label="' + (opts.title || tx("cert")).replace(/"/g, "&quot;") + '">' +
      '<div class="sn-cert__bar"><strong class="sn-cert__title"></strong>' +
      '<button type="button" class="sn-cert__btn" data-more aria-haspopup="menu" aria-expanded="false" aria-label="' + tx("more") + '">' + IC.more + "</button>" +
      '<button type="button" class="sn-cert__btn" data-x aria-label="' + tx("close") + '">' + IC.close + "</button>" +
      '<div class="sn-cert__menu" role="menu" hidden>' +
      '<button type="button" class="sn-cert__item" role="menuitem" data-act="download">' + IC.dl + "<span>" + tx("download") + "</span></button>" +
      '<button type="button" class="sn-cert__item" role="menuitem" data-act="print">' + IC.pr + "<span>" + tx("print") + "</span></button>" +
      '<button type="button" class="sn-cert__item" role="menuitem" data-act="share">' + IC.sh + "<span>" + tx("share") + "</span></button>" +
      "</div></div>" +
      '<div class="sn-cert__stage"><div class="sn-cert__load">' + tx("loading") + "</div></div></div>";
    ov.querySelector(".sn-cert__title").textContent = opts.title || tx("cert");
    var menu = ov.querySelector(".sn-cert__menu"), more = ov.querySelector("[data-more]"), stage = ov.querySelector(".sn-cert__stage");
    var blob = null, url = null, closed = false;

    function setMenu(on) { menu.hidden = !on; more.setAttribute("aria-expanded", on ? "true" : "false"); if (on) { var f = menu.querySelector(".sn-cert__item"); if (f) f.focus(); } }
    function close() {
      if (closed) return; closed = true;
      document.removeEventListener("keydown", onKey, true);
      ov.classList.remove("is-open");
      document.body.style.overflow = prevOverflow;
      setTimeout(function () { ov.remove(); if (url) URL.revokeObjectURL(url); }, 240);
      if (prevFocus && prevFocus.focus) { try { prevFocus.focus(); } catch (e) { } }
    }
    function onKey(e) {
      if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); if (!menu.hidden) { setMenu(false); more.focus(); } else close(); }
    }
    var prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    ov.addEventListener("click", function (e) {
      if (e.target === ov) return close();
      if (e.target.closest("[data-x]")) return close();
      if (e.target.closest("[data-more]")) return setMenu(menu.hidden);
      var it = e.target.closest("[data-act]");
      if (it) { setMenu(false); return act(it.dataset.act); }
      if (!e.target.closest(".sn-cert__menu")) setMenu(false);
    });
    document.addEventListener("keydown", onKey, true);

    function act(a) {
      if (!blob) return;
      var filename = opts.filename || "certificate.png";
      if (a === "download") { saveBlob(blob, filename); toast(tx("saved")); }
      else if (a === "print") { printUrl(url).catch(function () { toast(tx("printFail"), true); }); }
      else if (a === "share") {
        var file = new File([blob], filename, { type: "image/png" });
        var data = { files: [file], title: opts.title || tx("cert"), text: opts.shareText || "" };
        if (navigator.canShare && navigator.canShare(data) && navigator.share) {
          navigator.share(data).catch(function (e) { if (e && e.name !== "AbortError") { saveBlob(blob, filename); toast(tx("noShare")); } });
        } else { saveBlob(blob, filename); toast(tx("noShare")); }
      }
    }

    document.body.appendChild(ov);
    requestAnimationFrame(function () { ov.classList.add("is-open"); });

    var ld = null;
    if (window.SNTransfer) {
      stage.innerHTML = "";
      ld = window.SNTransfer.loader(stage, tx("loading"));
    }
    Promise.resolve().then(opts.render).then(canvasBlob).then(function (b) {
      if (closed) { if (ld) ld.cancel(); return; }
      blob = b; url = URL.createObjectURL(b);
      var im = new Image();
      im.alt = opts.title || ""; im.draggable = false; im.src = url;
      if (ld) {
        ld.set(0.9);
        ld.done(function () { stage.querySelectorAll(".sn-cert__load").forEach(function (n) { n.remove(); }); stage.appendChild(im); });
      } else { stage.innerHTML = ""; stage.appendChild(im); }
    }).catch(function () {
      if (closed) { if (ld) ld.cancel(); return; }
      if (ld) ld.fail(null, tx("fail")); else stage.innerHTML = '<div class="sn-cert__load">' + tx("fail") + "</div>";
    });
    return { close: close };
  }

  function open(rec) {
    /* rec ممكن يبقى Promise: النافذة تتفتح فورًا وتستنى البيانات */
    if (rec && typeof rec.then === "function") {
      return view({
        title: tx("cert"),
        filename: "Certificate.png",
        shareText: "Certificate of Appreciation",
        render: function () { return rec.then(render); }
      });
    }
    var nm = rec && rec.name ? rec.name : "";
    return view({
      title: tx("cert") + (rec && rec.month ? " — " + monthLabel(rec.month) : ""),
      filename: "Certificate-" + slug(nm) + "-" + (rec && rec.month || "") + ".png",
      shareText: "Certificate of Appreciation — " + monthLabel(rec && rec.month),
      render: function () { return render(rec); }
    });
  }
  function download(rec) {
    return render(rec).then(canvasBlob).then(function (b) {
      saveBlob(b, "Certificate-" + slug(rec && rec.name) + "-" + (rec && rec.month || "") + ".png");
      toast(tx("saved"));
    }).catch(function () { toast(tx("fail"), true); });
  }

  window.SNCert = {
    render: render, open: open, view: view, download: download, monthLabel: monthLabel, hasArabic: hasArabic,
    ensureFonts: ensureFonts, loadLogo: loadLogo, canvasBlob: canvasBlob, saveBlob: saveBlob, slug: slug
  };
})();

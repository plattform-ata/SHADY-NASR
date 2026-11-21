/* ==========================================================================
   badge-art.js — شكل جديد للشارات (ميدالية بلوجو المنصة) + تحميلها كصورة
   - بيستبدل أيقونات الشارات اللي في #badgesGrid (من غير ما يلمس منطق حساب الشارات)
   - الضغط على شارة مكتسبة بيفتح صورتها في نفس نافذة الشهادة (تحميل / طباعة / مشاركة)
   لازم يتحمّل بعد certificates.js و dashboard.js
   ========================================================================== */
(function () {
  "use strict";
  var LOGO = "shady-nasr-logo.png";
  var TIERS = {
    bronze: { c: ["#f0b27a", "#c0723a", "#7c3f16"], ribbon: "#8a2d2d", rim: "#6a3510" },
    silver: { c: ["#ffffff", "#cfd7e0", "#8c97a4"], ribbon: "#1d5260", rim: "#69727e" },
    gold: { c: ["#fff1ad", "#e8b83e", "#a06f10"], ribbon: "#8a1d24", rim: "#7a540c" },
    diamond: { c: ["#eaf8ff", "#8cc9ee", "#3b84b8"], ribbon: "#17404b", rim: "#2c6a94" },
    crystal: { c: ["#f1e9ff", "#b8a2de", "#6e4fc4"], ribbon: "#3d2a7a", rim: "#54389e" }
  };
  var GLYPH = {
    streak: "M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.07-2.14-.22-4.05 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.15.43-2.29 1-3a2.5 2.5 0 0 0 2.5 2.5z",
    perfect: "m12 3 2.6 5.6 6.1.7-4.5 4.2 1.2 6L12 16.6 6.6 19.5l1.2-6L3.3 9.3l6.1-.7Z"
  };
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var session = function () { try { return JSON.parse(localStorage.getItem("shadynasr-current-user")) || {}; } catch (e) { return {}; } };
  var esc = function (v) { return String(v == null ? "" : v).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); };

  function medalPath(tier, cx, cy, R) {
    var d = "", a, i;
    if (tier === "diamond") {
      return "M" + cx + " " + (cy - R * 1.12) + " L" + (cx + R) + " " + cy + " L" + cx + " " + (cy + R * 1.12) + " L" + (cx - R) + " " + cy + " Z";
    }
    if (tier === "crystal") {
      for (i = 0; i < 6; i++) {
        a = Math.PI / 6 + i * Math.PI / 3 - Math.PI / 2 + Math.PI / 6;
        d += (i ? "L" : "M") + (cx + R * 1.06 * Math.cos(a)).toFixed(1) + " " + (cy + R * 1.06 * Math.sin(a)).toFixed(1) + " ";
      }
      return d + "Z";
    }
    for (i = 0; i <= 240; i++) {
      a = i / 240 * Math.PI * 2;
      var r = R * (1 + 0.04 * Math.cos(a * 24));
      d += (i ? "L" : "M") + (cx + r * Math.cos(a)).toFixed(1) + " " + (cy + r * Math.sin(a)).toFixed(1) + " ";
    }
    return d + "Z";
  }

  /* logoHref: اسم الملف للعرض في الصفحة، أو data: URL وقت التصدير كصورة */
  function medalSvg(tier, set, uid, logoHref, attrs, vb) {
    var T = TIERS[tier] || TIERS.gold, cx = 100, cy = 118, R = 68, g = "bm" + uid;
    var facets = "";
    if (tier === "diamond") facets = '<path d="M100 ' + (cy - R * 1.12) + ' L' + (cx - R * 0.5) + " " + cy + " L" + cx + " " + (cy + R * 1.12) + " M100 " + (cy - R * 1.12) + " L" + (cx + R * 0.5) + " " + cy + " L" + cx + " " + (cy + R * 1.12) + " M" + (cx - R) + " " + cy + " H" + (cx + R) + '" stroke="rgba(255,255,255,.55)" stroke-width="1.4" fill="none"/>';
    if (tier === "crystal") facets = '<path d="M' + cx + " " + (cy - R * 1.06) + " V" + (cy + R * 1.06) + " M" + (cx - R * 0.92) + " " + (cy - R * 0.53) + " L" + (cx + R * 0.92) + " " + (cy + R * 0.53) + " M" + (cx + R * 0.92) + " " + (cy - R * 0.53) + " L" + (cx - R * 0.92) + " " + (cy + R * 0.53) + '" stroke="rgba(255,255,255,.5)" stroke-width="1.4" fill="none"/>';
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="' + (vb || "0 0 200 240") + '" ' + (attrs || "") + ' aria-hidden="true">' +
      "<defs>" +
      '<linearGradient id="' + g + 'a" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="' + T.c[0] + '"/><stop offset=".5" stop-color="' + T.c[1] + '"/><stop offset="1" stop-color="' + T.c[2] + '"/></linearGradient>' +
      '<linearGradient id="' + g + 'r" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="' + T.ribbon + '"/><stop offset="1" stop-color="#000" stop-opacity=".35"/></linearGradient>' +
      '<clipPath id="' + g + 'c"><circle cx="' + cx + '" cy="' + cy + '" r="' + (R * 0.6) + '"/></clipPath></defs>' +
      '<path d="M66 6 L100 94 L78 108 L48 30 Z" fill="' + T.ribbon + '"/><path d="M134 6 L100 94 L122 108 L152 30 Z" fill="' + T.ribbon + '"/>' +
      '<path d="M66 6 L100 94 L78 108 L48 30 Z M134 6 L100 94 L122 108 L152 30 Z" fill="url(#' + g + 'r)"/>' +
      '<path d="' + medalPath(tier, cx, cy, R) + '" fill="url(#' + g + 'a)" stroke="' + T.rim + '" stroke-width="2.5" stroke-linejoin="round"/>' +
      facets +
      '<circle cx="' + cx + '" cy="' + cy + '" r="' + (R * 0.72) + '" fill="none" stroke="' + T.rim + '" stroke-opacity=".55" stroke-width="2"/>' +
      '<circle cx="' + cx + '" cy="' + cy + '" r="' + (R * 0.62) + '" fill="#fbf6e8" stroke="' + T.rim + '" stroke-width="2"/>' +
      (logoHref ? '<image href="' + logoHref + '" x="' + (cx - R * 0.5) + '" y="' + (cy - R * 0.5) + '" width="' + (R) + '" height="' + (R) + '" preserveAspectRatio="xMidYMid meet" clip-path="url(#' + g + 'c)"/>'
        : '<text x="' + cx + '" y="' + (cy + 8) + '" text-anchor="middle" font-size="26" font-weight="800" font-family="Poppins,Arial" fill="#17404b">SN</text>') +
      '<circle cx="' + cx + '" cy="' + (cy + R * 0.86) + '" r="15" fill="' + T.rim + '" stroke="#fbf6e8" stroke-width="2.5"/>' +
      '<g transform="translate(' + (cx - 9) + " " + (cy + R * 0.86 - 9) + ') scale(.75)" fill="#fff" stroke="none"><path d="' + (GLYPH[set] || GLYPH.perfect) + '"/></g></svg>';
  }

  /* ---------- أيقونات القايمة ---------- */
  function tierOf(btn) {
    for (var t in TIERS) if (btn.classList.contains("dash-badge--" + t)) return t;
    return null;
  }
  function activeSet() {
    var b = $('#badgesTabs [data-badge-set].is-active') || $("#badgesTabs [data-badge-set][aria-selected=\"true\"]");
    return b ? b.dataset.badgeSet : "streak";
  }
  var busy = false;
  function decorate() {
    var grid = $("#badgesGrid");
    if (!grid || busy) return;
    busy = true;
    var set = activeSet();
    Array.prototype.forEach.call(grid.querySelectorAll(".dash-badge"), function (btn, i) {
      var tier = tierOf(btn), icon = $(".dash-badge__icon", btn);
      if (!tier || !icon) return;
      var key = tier + "|" + set;
      if (icon.getAttribute("data-bart") === key) return;
      icon.innerHTML = medalSvg(tier, set, "g" + i, LOGO, "", "24 0 152 200");
      icon.setAttribute("data-bart", key);
    });
    busy = false;
  }

  /* ---------- صورة التحميل ---------- */
  var logoDataP = null;
  function logoData() {
    if (!logoDataP) logoDataP = SNCert.loadLogo().then(function (im) {
      if (!im) return null;
      var c = document.createElement("canvas"); c.width = im.naturalWidth || im.width; c.height = im.naturalHeight || im.height;
      c.getContext("2d").drawImage(im, 0, 0);
      try { return c.toDataURL("image/png"); } catch (e) { return null; }
    });
    return logoDataP;
  }
  function svgImage(svg) {
    return new Promise(function (res, rej) {
      var im = new Image();
      im.onload = function () { res(im); };
      im.onerror = function () { rej(new Error("SVG")); };
      im.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
    });
  }
  function renderBadge(info) {
    return Promise.all([SNCert.ensureFonts(), logoData(), SNCert.loadLogo()]).then(function (r) {
      var logoUrl = r[1], logoImg = r[2];
      return svgImage(medalSvg(info.tier, info.set, "x", logoUrl, 'width="800" height="960"')).then(function (medal) {
        var W = 1080, H = 1440, c = document.createElement("canvas");
        c.width = W; c.height = H;
        var ctx = c.getContext("2d");
        var g = ctx.createLinearGradient(0, 0, W, H);
        g.addColorStop(0, "#0f2d35"); g.addColorStop(1, "#1d5260");
        ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
        ctx.strokeStyle = "rgba(244,238,224,.18)"; ctx.lineWidth = 3;
        ctx.strokeRect(36, 36, W - 72, H - 72);
        var glow = ctx.createRadialGradient(W / 2, 560, 60, W / 2, 560, 560);
        glow.addColorStop(0, "rgba(143,207,210,.35)"); glow.addColorStop(1, "rgba(143,207,210,0)");
        ctx.fillStyle = glow; ctx.fillRect(0, 0, W, H);
        // اللوجو + اسم المنصة
        if (logoImg) { var k = Math.min(84 / logoImg.width, 84 / logoImg.height); ctx.drawImage(logoImg, W / 2 - 190 - logoImg.width * k / 2, 120 - logoImg.height * k / 2, logoImg.width * k, logoImg.height * k); }
        ctx.fillStyle = "#f4eee0"; ctx.font = "700 34px Poppins, Arial"; ctx.textAlign = "left"; ctx.textBaseline = "middle";
        ctx.fillText("SHADY NASR PLATFORM", W / 2 - 120, 120);
        ctx.drawImage(medal, (W - 800) / 2, 190, 800, 960);
        // النصوص
        ctx.textAlign = "center"; ctx.textBaseline = "alphabetic"; ctx.direction = "rtl";
        ctx.fillStyle = "#ffffff"; ctx.font = "800 70px Cairo, Tajawal, Arial";
        var label = info.label || "", size = 70;
        while (ctx.measureText(label).width > W - 200 && size > 34) { size -= 3; ctx.font = "800 " + size + "px Cairo, Tajawal, Arial"; }
        ctx.fillText(label, W / 2, 1230);
        ctx.fillStyle = "#8fcfd2"; ctx.font = "700 38px Cairo, Tajawal, Arial";
        if (info.tierText) ctx.fillText(info.tierText, W / 2, 1290);
        ctx.fillStyle = "rgba(244,238,224,.85)"; ctx.font = "600 32px Cairo, Tajawal, Arial";
        var line = (info.student ? info.student + " · " : "") + new Date().toLocaleDateString("ar-EG", { year: "numeric", month: "long", day: "numeric" });
        ctx.fillText(line, W / 2, 1352);
        ctx.direction = "ltr";
        return c;
      });
    });
  }

  function openInfo(info) {
    SNCert.view({
      title: info.label || "شارة",
      filename: "Badge-" + SNCert.slug(info.label || info.tier) + ".png",
      shareText: info.label,
      render: function () { return renderBadge(info); }
    });
  }
  function openBadge(btn) {
    var tier = tierOf(btn), set = activeSet();
    var label = ($(".dash-badge__label", btn) || {}).textContent || "";
    var tierText = ($(".dash-badge__tier", btn) || {}).textContent || "";
    openInfo({ tier: tier, set: set, label: label.trim(), tierText: tierText.trim(), student: session().fullName || "" });
  }

  function init() {
    var grid = $("#badgesGrid");
    if (!grid || !window.SNCert) return;
    decorate();
    new MutationObserver(function () { decorate(); }).observe(grid, { childList: true, subtree: true });
    var tabs = $("#badgesTabs");
    if (tabs) new MutationObserver(function () { decorate(); }).observe(tabs, { attributes: true, subtree: true, attributeFilter: ["class", "aria-selected"] });
    // نلتقط الضغطة قبل منطق التحميل القديم، ونفتح الصورة الجديدة بدله
    grid.addEventListener("click", function (e) {
      var b = e.target.closest(".dash-badge");
      if (!b || b.disabled || b.classList.contains("is-locked") || !tierOf(b)) return;
      e.stopImmediatePropagation();
      e.preventDefault();
      openBadge(b);
    }, true);
  }
  window.SNBadgeArt = { svg: medalSvg, open: function (info) { info.student = info.student || session().fullName || ""; openInfo(info); } };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
})();

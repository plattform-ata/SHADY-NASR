/* ==========================================================================
   records.js — "شاراتي وشهاداتي": سجل الشارات والشهادات اللي الطالب كسبها (قسم في "المزيد")
   - تبويبين: الشهادات / الشارات
   - الضغط على أي شهادة أو شارة بيفتحها في نفس النافذة (تحميل / طباعة / مشاركة)
   - الشهادات بتتحمّل من Firebase (certificates) للطالب الحالي بس
   - الشارات بتتقرأ من شبكة الشارات الأصلية (#badgesGrid) من غير ما نلمس منطق حسابها
   بيتحمّل في studenti.html بعد certificates.js و badge-art.js
   ========================================================================== */
(function () {
  "use strict";

  var EXT = {
    ar: { dash_nav_records: "شاراتي وشهاداتي" },
    en: { dash_nav_records: "My badges & certificates" }
  };
  if (typeof I18N !== "undefined") {
    Object.assign(I18N.ar, EXT.ar);
    Object.assign(I18N.en, EXT.en);
  }

  var $ = function (s, r) { return (r || document).querySelector(s); };
  var curLang = function () { return document.documentElement.lang === "en" ? "en" : "ar"; };
  var T = {
    ar: {
      tab_certs: "الشهادات", tab_badges: "الشارات",
      certs_empty: "لسه ما جاتلكش شهادات. كمّل اجتهاد وهتوصلك أول شهادة قريب!",
      badges_empty: "لسه ما كسبتش شارات. كمّل دخول ودرجات نهائية وهتبدأ تجمعها.",
      loading: "جاري التحميل…", error: "تعذر تحميل السجل. حاول تاني بعد شوية.",
      rank: "المركز", points: "نقطة", open: "اضغط للعرض", cert: "شهادة تقدير",
      set_streak: "الدخول المستمر", set_perfect: "الدرجات النهائية"
    },
    en: {
      tab_certs: "Certificates", tab_badges: "Badges",
      certs_empty: "No certificates yet. Keep up the great work!",
      badges_empty: "No badges yet. Keep logging in and aim for full marks!",
      loading: "Loading…", error: "Couldn't load your records. Please try again later.",
      rank: "Rank", points: "pts", open: "Tap to view", cert: "Certificate of appreciation",
      set_streak: "Login streak", set_perfect: "Perfect scores"
    }
  };
  var tr = function (k) { return (T[curLang()] || T.ar)[k] || T.ar[k] || k; };
  var esc = function (v) { return String(v == null ? "" : v).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); };
  var session = function () { try { return JSON.parse(localStorage.getItem("shadynasr-current-user")) || {}; } catch (e) { return {}; } };

  var TIERS = ["bronze", "silver", "gold", "diamond", "crystal"];
  var S = { tab: "certs", certs: null, badges: null, certErr: false, loadingBadges: false, token: 0 };

  function panel() { return $('[data-panel="records"]'); }
  function isActive() { var p = panel(); return !!(p && p.classList.contains("is-active")); }

  function css() {
    if (document.getElementById("recCss")) return;
    var st = document.createElement("style");
    st.id = "recCss";
    st.textContent =
      ".rc-tabs{display:flex;gap:8px;margin-bottom:16px}" +
      ".rc-tab{flex:1;display:flex;align-items:center;justify-content:center;gap:8px;padding:12px 14px;border-radius:var(--radius-md,14px);border:1.5px solid var(--surface-glass-border);background:transparent;color:var(--ink-soft);font:inherit;font-weight:800;cursor:pointer;transition:background .2s,color .2s,border-color .2s}" +
      ".rc-tab.is-active{background:var(--accent,#c8902e);border-color:var(--accent,#c8902e);color:#fff}" +
      ".rc-tab:focus-visible{outline:2px solid var(--accent);outline-offset:2px}" +
      ".rc-count{min-width:22px;height:22px;padding:0 6px;border-radius:999px;display:inline-grid;place-items:center;font-size:.78rem;background:rgba(255,255,255,.22)}" +
      ".rc-tab:not(.is-active) .rc-count{background:var(--surface-glass-border);color:var(--ink)}" +
      ".rc-list{display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:12px}" +
      ".rc-card{display:flex;align-items:center;gap:14px;width:100%;padding:14px;border-radius:var(--radius-md,14px);border:1px solid var(--surface-glass-border);background:var(--surface-glass);color:inherit;font:inherit;text-align:start;cursor:pointer;transition:transform .2s,box-shadow .2s}" +
      ".rc-card:hover{transform:translateY(-2px);box-shadow:0 10px 26px rgba(0,0,0,.14)}" +
      ".rc-card:focus-visible{outline:2px solid var(--accent);outline-offset:2px}" +
      ".rc-rank{width:48px;height:48px;border-radius:50%;flex:none;display:grid;place-items:center;font-weight:800;font-size:1.15rem;color:#fff;background:linear-gradient(135deg,#d9a23a,#a9741c)}" +
      ".rc-card__txt{flex:1;min-width:0;display:flex;flex-direction:column;gap:3px}" +
      ".rc-card__title{font-weight:800;font-size:.98rem;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}" +
      ".rc-card__sub{font-size:.8rem;color:var(--ink-soft);font-weight:700}" +
      ".rc-card__hint{font-size:.74rem;color:var(--accent,#c8902e);font-weight:800}" +
      ".rc-medal{width:54px;height:72px;flex:none}" +
      ".rc-medal svg{width:100%;height:100%;display:block}" +
      ".rc-empty{padding:34px 14px;text-align:center;color:var(--ink-soft);font-weight:700;line-height:1.8}";
    document.head.appendChild(st);
  }

  /* ---------- الشهادات ---------- */
  function loadCerts() {
    var me = session();
    var tok = ++S.token;
    if (!window.SNAuth || !me.id) { S.certs = []; S.certErr = false; paint(); return; }
    var done = function (list) {
      if (tok !== S.token) return;
      S.certs = (list || []).filter(function (c) { return c && c.id && c.name && /^\d{4}-\d{2}$/.test(String(c.month || "")); })
        .sort(function (a, b) { return Date.parse(b.createdAt || 0) - Date.parse(a.createdAt || 0); });
      S.certErr = false;
      paint();
    };
    var fromAnnouncements = function () {
      if (!SNAuth.fetchAnnouncements || !SNAuth.fetchCertificate) throw new Error("NO_API");
      return SNAuth.fetchAnnouncements().then(function (list) {
        var ids = (list || []).filter(function (a) { return a && a.cert && a.to === me.id; }).map(function (a) { return a.cert; });
        return Promise.all(ids.map(function (id) { return SNAuth.fetchCertificate(id).catch(function () { return null; }); }));
      });
    };
    var p = SNAuth.fetchMyCertificates ? SNAuth.fetchMyCertificates(me.id).catch(fromAnnouncements) : fromAnnouncements();
    Promise.resolve(p).then(done).catch(function () {
      if (tok !== S.token) return;
      S.certErr = true; S.certs = []; paint();
    });
  }

  /* ---------- الشارات (بنقراها من الشبكة الأصلية) ---------- */
  function tierOf(btn) {
    for (var i = 0; i < TIERS.length; i++) if (btn.classList.contains("dash-badge--" + TIERS[i])) return TIERS[i];
    return null;
  }
  var wait = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };

  async function collectBadges() {
    if (S.loadingBadges) return;
    var grid = $("#badgesGrid"), tabs = document.querySelectorAll("#badgesTabs [data-badge-set]");
    if (!grid || !tabs.length) { S.badges = []; paint(); return; }
    S.loadingBadges = true;
    var cur = $("#badgesTabs [data-badge-set].is-active") || tabs[0];
    var out = [];
    try {
      for (var i = 0; i < tabs.length; i++) {
        var t = tabs[i];
        if (t !== cur || !grid.querySelector(".dash-badge")) { t.click(); await wait(80); }
        var set = t.dataset.badgeSet;
        Array.prototype.forEach.call(grid.querySelectorAll(".dash-badge"), function (b) {
          var tier = tierOf(b);
          if (!tier || b.classList.contains("is-locked")) return;
          out.push({
            set: set, tier: tier,
            label: (($(".dash-badge__label", b) || {}).textContent || "").trim(),
            tierText: (($(".dash-badge__tier", b) || {}).textContent || "").trim()
          });
        });
      }
      if (cur) { cur.click(); await wait(40); }
    } catch (e) { /* نسيب اللي اتجمّع */ }
    S.badges = out;
    S.loadingBadges = false;
    paint();
  }

  /* ---------- رسم ---------- */
  function monthText(rec) {
    var p = String(rec.month || "").split("-");
    var m = Number(p[1]);
    if (!m) return "";
    var d = new Date(Number(p[0]) || 2000, m - 1, 1);
    return d.toLocaleDateString(curLang() === "en" ? "en-GB" : "ar-EG", { year: "numeric", month: "long" });
  }

  function paint() {
    var root = $("#recRoot");
    if (!root) return;
    var nCerts = S.certs ? S.certs.length : 0, nBadges = S.badges ? S.badges.length : 0;
    var html =
      '<div class="rc-tabs" role="tablist">' +
      '<button type="button" class="rc-tab' + (S.tab === "certs" ? " is-active" : "") + '" role="tab" aria-selected="' + (S.tab === "certs") + '" data-tab="certs">' + esc(tr("tab_certs")) + '<span class="rc-count">' + nCerts + "</span></button>" +
      '<button type="button" class="rc-tab' + (S.tab === "badges" ? " is-active" : "") + '" role="tab" aria-selected="' + (S.tab === "badges") + '" data-tab="badges">' + esc(tr("tab_badges")) + '<span class="rc-count">' + nBadges + "</span></button></div>";

    if (S.tab === "certs") {
      if (S.certs == null) html += '<div class="rc-empty">' + esc(tr("loading")) + "</div>";
      else if (S.certErr) html += '<div class="rc-empty">' + esc(tr("error")) + "</div>";
      else if (!S.certs.length) html += '<div class="rc-empty">' + esc(tr("certs_empty")) + "</div>";
      else html += '<div class="rc-list">' + S.certs.map(function (c) {
        return '<button type="button" class="rc-card" data-cid="' + esc(c.id) + '">' +
          '<span class="rc-rank" aria-hidden="true">' + esc(c.rank || 1) + "</span>" +
          '<span class="rc-card__txt"><strong class="rc-card__title">' + esc(tr("cert") + (monthText(c) ? " — " + monthText(c) : "")) + "</strong>" +
          '<span class="rc-card__sub">' + esc(tr("rank") + " " + (c.rank || 1) + (c.gain ? " · +" + c.gain + " " + tr("points") : "")) + "</span>" +
          '<span class="rc-card__hint">' + esc(tr("open")) + "</span></span></button>";
      }).join("") + "</div>";
    } else {
      if (S.badges == null) html += '<div class="rc-empty">' + esc(tr("loading")) + "</div>";
      else if (!S.badges.length) html += '<div class="rc-empty">' + esc(tr("badges_empty")) + "</div>";
      else html += '<div class="rc-list">' + S.badges.map(function (b, i) {
        var art = window.SNBadgeArt ? SNBadgeArt.svg(b.tier, b.set, "r" + i + b.set, "shady-nasr-logo.png", "", "24 0 152 200") : "";
        return '<button type="button" class="rc-card" data-bi="' + i + '">' +
          '<span class="rc-medal" aria-hidden="true">' + art + "</span>" +
          '<span class="rc-card__txt"><strong class="rc-card__title">' + esc(b.label) + "</strong>" +
          '<span class="rc-card__sub">' + esc((b.tierText ? b.tierText + " · " : "") + tr("set_" + b.set)) + "</span>" +
          '<span class="rc-card__hint">' + esc(tr("open")) + "</span></span></button>";
      }).join("") + "</div>";
    }
    root.innerHTML = html;
  }

  function refresh() {
    paint();
    loadCerts();
    collectBadges();
  }

  function init() {
    var root = $("#recRoot");
    if (!root) return;
    css();
    root.addEventListener("click", function (e) {
      var tab = e.target.closest(".rc-tab");
      if (tab) { S.tab = tab.dataset.tab; paint(); return; }
      var c = e.target.closest("[data-cid]");
      if (c && window.SNCert) {
        var rec = (S.certs || []).filter(function (x) { return x.id === c.dataset.cid; })[0];
        if (rec) SNCert.open(rec);
        return;
      }
      var b = e.target.closest("[data-bi]");
      if (b && window.SNBadgeArt && SNBadgeArt.open) {
        var info = S.badges && S.badges[Number(b.dataset.bi)];
        if (info) SNBadgeArt.open({ tier: info.tier, set: info.set, label: info.label, tierText: info.tierText });
      }
    });
    paint();

    // نحدّث السجل كل ما القسم يتفتح (فيه شهادة ممكن تكون وصلت من آخر مرة)
    var p = panel();
    if (p) {
      var was = false;
      new MutationObserver(function () {
        var now = isActive();
        if (now && !was) refresh();
        was = now;
      }).observe(p, { attributes: true, attributeFilter: ["class"] });
      if (isActive()) { was = true; refresh(); }
    }

    if (typeof window.applyLanguage === "function") {
      var orig = window.applyLanguage;
      window.applyLanguage = function () { var r = orig.apply(this, arguments); paint(); return r; };
    }
  }

  document.addEventListener("DOMContentLoaded", init);
})();

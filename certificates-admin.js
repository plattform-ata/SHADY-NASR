/* ==========================================================================
   certificates-admin.js — توزيع شهادات التقدير الشهرية (لوحة الأدمن، قسم "الأوائل")
   - بيرتّب كل طلاب المنصة (كل الصفوف) حسب زيادة النقاط من آخر توزيع، ويطلع أول 5
   - الأدمن يراجع الأسماء (ويكتبها بالإنجليزي لو لسه بالعربي) وبعدها يوزّع
   - كل طالب بياخد شهادة + 50 نقطة + إعلان خاص بيه فيه زرار تحميل الشهادة
   بيتحمّل في admin.html بعد firebase.js و certificates.js
   ========================================================================== */
(function () {
  "use strict";
  var BONUS = 50, TOP = 5;
  var AR_MONTHS = ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"];
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var esc = function (v) { return String(v == null ? "" : v).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); };
  var toast = function (m, err) { if (window.snDialog && snDialog.toast) snDialog.toast(m, { error: !!err }); };
  var session = function () { try { return JSON.parse(localStorage.getItem("shadynasr-current-user")) || {}; } catch (e) { return {}; } };
  var monthAr = function (m) { var p = String(m).split("-"); return (AR_MONTHS[Number(p[1]) - 1] || "") + " " + (p[0] || ""); };
  var thisMonth = function () { var d = new Date(); return d.getFullYear() + "-" + ("0" + (d.getMonth() + 1)).slice(-2); };

  var S = { users: [], certs: [], snap: {}, top: [], loaded: false, busy: false, open: {}, hidden: 0 };
  var validCert = function (c) { return !!(c && c.id && c.name && /^\d{4}-\d{2}$/.test(String(c.month || ""))); };
  function monthOptions() {
    var out = [], d = new Date(), i;
    for (i = 1; i >= -12; i--) {
      var x = new Date(d.getFullYear(), d.getMonth() + i, 1);
      var v = x.getFullYear() + "-" + ("0" + (x.getMonth() + 1)).slice(-2);
      out.push('<option value="' + v + '">' + monthAr(v) + "</option>");
    }
    return out.join("");
  }

  function css() {
    if ($("#certAdminCss")) return;
    var st = document.createElement("style");
    st.id = "certAdminCss";
    st.textContent =
      "#certCard{margin-bottom:18px}" +
      ".cert-head{display:flex;align-items:center;gap:12px}" +
      ".cert-head__icon{width:40px;height:40px;border-radius:12px;display:grid;place-items:center;background:rgba(185,119,14,.14);color:#b9770e;flex:none}" +
      ".cert-head__icon svg{width:22px;height:22px}" +
      ".cert-head h3{margin:0}" +
      ".cert-intro{margin:10px 0 14px;color:var(--ink-soft);line-height:1.7;font-size:.92rem}" +
      ".cert-bar{display:flex;flex-wrap:wrap;gap:10px;align-items:flex-end;margin-bottom:14px}" +
      ".cert-bar .form-field{margin:0;min-width:190px}" +
      ".cert-list{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:8px}" +
      ".cert-row{display:flex;align-items:center;gap:12px;padding:10px 12px;border-radius:var(--radius-md);background:var(--surface-glass-border)}" +
      ".cert-rank{width:34px;height:34px;border-radius:50%;flex:none;display:grid;place-items:center;font-weight:800;color:#fff;background:linear-gradient(135deg,#d9a23a,#a9741c)}" +
      ".cert-who{flex:1;min-width:0;display:flex;flex-direction:column;gap:6px}" +
      ".cert-who__meta{font-size:.78rem;color:var(--ink-soft);font-weight:700}" +
      ".cert-name{width:100%;box-sizing:border-box;padding:9px 12px;border-radius:10px;border:1.5px solid var(--surface-glass-border);background:var(--bg);color:var(--ink);font:inherit;font-weight:700}" +
      ".cert-name:focus-visible{outline:2px solid var(--accent);outline-offset:1px}" +
      ".cert-note{margin:12px 0 0;font-size:.85rem;color:var(--ink-soft);line-height:1.6}" +
      ".cert-note.is-warn{color:#b9770e;font-weight:700}" +
      ".cert-actions{display:flex;flex-wrap:wrap;gap:10px;margin-top:14px}" +
      ".cert-sub{margin:22px 0 10px;font-size:1rem}" +
      ".cert-bar select{box-sizing:border-box;width:100%;height:44px;padding:0 14px;border-radius:var(--radius-md);border:1px solid var(--surface-glass-border);background:var(--bg-soft);color:var(--ink);font:inherit;font-weight:700}" +
".cert-batch{margin-top:10px;border-radius:var(--radius-md);border:1px solid var(--surface-glass-border);overflow:hidden}" +
".cert-batch__head{display:flex;align-items:center;gap:10px;width:100%;padding:13px 14px;border:none;background:var(--bg-soft);color:var(--ink);font:inherit;font-weight:800;font-size:.92rem;text-align:start;cursor:pointer}" +
".cert-batch__head:hover{background:var(--surface-glass-border)}" +
".cert-batch__head:focus-visible{outline:2px solid var(--accent);outline-offset:-2px}" +
".cert-batch__title{flex:1;min-width:0}" +
".cert-batch__title small{display:block;margin-top:2px;color:var(--ink-soft);font-weight:700;font-size:.78rem}" +
".cert-batch__count{flex:none;padding:3px 10px;border-radius:999px;background:var(--surface-glass-border);font-size:.76rem}" +
".cert-batch__chev{flex:none;width:18px;height:18px;transition:transform .2s;color:var(--ink-soft)}" +
".cert-batch.is-open .cert-batch__chev{transform:rotate(180deg)}" +
".cert-batch__body{padding:4px 12px 12px}" +
".cert-batch__body[hidden]{display:none}" +
      ".cert-empty{padding:14px;text-align:center;color:var(--ink-soft);font-weight:700}";
    document.head.appendChild(st);
  }

  function build() {
    var panel = $("#panel-honors");
    if (!panel || $("#certCard")) return !!$("#certCard");
    css();
    var card = document.createElement("div");
    card.className = "dash-card";
    card.id = "certCard";
    card.innerHTML =
      '<div class="cert-head"><span class="cert-head__icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="9" r="5.5"/><path d="M8.6 13.6 7 21l5-3 5 3-1.6-7.4"/><path d="m10 9 1.4 1.4L14.2 7.6"/></svg></span>' +
      "<h3>شهادات التقدير الشهرية</h3></div>" +
      '<p class="cert-intro">أول ' + TOP + " طلاب على المنصة كلها (كل الصفوف) من حيث النقاط اللي كسبوها من آخر توزيع. كل طالب بياخد شهادة بالإنجليزي + " + BONUS + " نقطة، وبتظهر له في الإعلانات والإشعارات وفي سجل شاراته وشهاداته. تقدر توزّع في أي وقت، والترتيب بيتحسب من آخر توزيع.</p>" +
      '<div class="cert-bar"><div class="form-field"><label for="certMonth">الشهر اللي هيتكتب على الشهادة</label><select id="certMonth" aria-label="الشهر اللي هيتكتب على الشهادة">' + monthOptions() + '</select></div>' +
      '<button type="button" class="btn btn--ghost" id="certRefresh">تحديث الترتيب</button></div>' +
      '<ul class="cert-list" id="certTop"></ul>' +
      '<p class="cert-note" id="certNote" hidden></p>' +
      '<div class="cert-actions"><button type="button" class="btn btn--accent" id="certIssue" disabled>وزّع الشهادات</button></div>' +
      '<h4 class="cert-sub">الشهادات اللي اتوزّعت</h4><div id="certHistory"></div>';
    panel.insertBefore(card, panel.firstChild);
    $("#certMonth").value = thisMonth();
    $("#certMonth").addEventListener("change", paint);
    $("#certRefresh").addEventListener("click", function () { load(true); });
    $("#certIssue").addEventListener("click", issue);
    $("#certHistory").addEventListener("click", function (e) {
      var h = e.target.closest("[data-batch]");
      if (h) { S.open[h.dataset.batch] = !S.open[h.dataset.batch]; paintHistory(); return; }
      var b = e.target.closest("[data-cid]");
      if (!b) return;
      var rec = S.certs.filter(function (c) { return c.id === b.dataset.cid; })[0];
      if (rec && window.SNCert) SNCert.open(rec);
    });
    return true;
  }

  function students() { return S.users.filter(function (u) { return u && u.id && u.role !== "admin"; }); }

  function ranking() {
    return students().map(function (u) {
      var pts = Number(u.points) || 0;
      return { u: u, total: pts, gain: pts - (Number(S.snap[u.id]) || 0) };
    }).filter(function (r) { return r.gain > 0; })
      .sort(function (a, b) { return b.gain - a.gain || b.total - a.total || String(a.u.fullName).localeCompare(String(b.u.fullName), "ar"); })
      .slice(0, TOP);
  }

  function monthDone(m) { return S.certs.some(function (c) { return c.month === m; }); }

  function paint() {
    var month = $("#certMonth").value || thisMonth();
    var list = $("#certTop"), note = $("#certNote"), btn = $("#certIssue");
    var done = monthDone(month);
    if (!S.loaded) { list.innerHTML = '<li class="cert-empty">جاري التحميل…</li>'; btn.disabled = true; return; }
    S.top = ranking();
    if (!S.top.length) {
      list.innerHTML = '<li class="cert-empty">مفيش طلاب كسبوا نقاط جديدة من آخر توزيع.</li>';
    } else {
      list.innerHTML = S.top.map(function (r, i) {
        var nm = r.u.fullName || "";
        return '<li class="cert-row"><span class="cert-rank">' + (i + 1) + "</span>" +
          '<div class="cert-who"><input class="cert-name" data-i="' + i + '" type="text" maxlength="40" dir="auto" value="' + esc(nm) + '" placeholder="اكتب الاسم بالإنجليزي" aria-label="اسم الطالب على الشهادة" ' + " />" +
          '<span class="cert-who__meta">+' + r.gain + " نقطة من آخر توزيع · الإجمالي " + r.total + "</span></div></li>";
      }).join("");
    }
    note.hidden = false;
    note.classList.toggle("is-warn", done);
    note.textContent = (done ? "في شهادات اتوزّعت قبل كده لـ" + monthAr(month) + " — التوزيع الجديد هيتضاف جنبها. " : "") +
      "الاسم اللي في الخانة هو اللي هيتكتب على الشهادة — الأفضل بالحروف الإنجليزية.";
    btn.disabled = !S.top.length || S.busy;
    paintHistory();
  }

  function paintHistory() {
    var box = $("#certHistory");
    if (!S.certs.length) { box.innerHTML = '<div class="cert-empty">لسه ما اتوزّعتش شهادات.</div>'; return; }
    var by = {};
    S.certs.forEach(function (c) { var k = c.createdAt || c.month; (by[k] = by[k] || []).push(c); });
    var CH = '<svg class="cert-batch__chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>';
    box.innerHTML = Object.keys(by).sort().reverse().map(function (k) {
      var list = by[k], first = list[0], dt = new Date(k), open = !!S.open[k];
      var when = isNaN(dt.getTime()) ? "" : "اتوزّعت " + dt.toLocaleDateString("ar-EG", { year: "numeric", month: "long", day: "numeric" });
      return '<div class="cert-batch' + (open ? " is-open" : "") + '">' +
        '<button type="button" class="cert-batch__head" data-batch="' + esc(k) + '" aria-expanded="' + open + '">' +
        '<span class="cert-batch__title">شهادات ' + esc(monthAr(first.month)) + "<small>" + esc(when) + "</small></span>" +
        '<span class="cert-batch__count">' + list.length + " طلاب</span>" + CH + "</button>" +
        '<div class="cert-batch__body"' + (open ? "" : " hidden") + '><ul class="cert-list">' +
        list.slice().sort(function (a, b) { return (a.rank || 0) - (b.rank || 0); }).map(function (c) {
          return '<li class="cert-row"><span class="cert-rank">' + esc(c.rank) + '</span><div class="cert-who"><strong>' + esc(c.name) + '</strong><span class="cert-who__meta">+' + esc(c.gain || 0) + " نقطة</span></div>" +
            '<button type="button" class="btn btn--ghost" data-cid="' + esc(c.id) + '">عرض</button></li>';
        }).join("") + "</ul></div></div>";
    }).join("") + (S.hidden ? '<p class="cert-note">' + S.hidden + " سجل ناقص (من غير اسم أو شهر) مخفي — تقدر تمسحه من Firebase (certificates).</p>" : "");
  }

  async function load(force) {
    if (!window.SNAuth || !SNAuth.fetchAllUsers || !SNAuth.fetchCertificates) return;
    if (S.loaded && !force) { paint(); return; }
    S.loaded = false; paint();
    try {
      var r = await Promise.all([SNAuth.fetchAllUsers(), SNAuth.fetchCertificates(), SNAuth.fetchCertSnapshot()]);
      S.users = r[0] || []; S.snap = r[2] || {};
      var allC = r[1] || [];
      S.certs = allC.filter(validCert); S.hidden = allC.length - S.certs.length;
      S.loaded = true;
    } catch (e) {
      S.loaded = false;
      $("#certTop").innerHTML = '<li class="cert-empty">تعذر تحميل البيانات — راجع قواعد Firebase (certificates / certSnapshots).</li>';
      return;
    }
    paint();
  }

  async function issue() {
    if (S.busy || !window.SNCert) return;
    var month = $("#certMonth").value || thisMonth();
    var inputs = document.querySelectorAll("#certTop .cert-name");
    var winners = S.top.map(function (r, i) {
      var nm = (inputs[i] && inputs[i].value || "").trim() || r.u.fullName || "Student";
      return { r: r, rank: i + 1, name: nm };
    });
    if (!winners.length) return;

    var ar = winners.filter(function (w) { return SNCert.hasArabic(w.name); });
    if (ar.length) {
      var go = await snDialog.confirm({ icon: "info", title: "أسماء بالعربي", message: "في " + ar.length + " اسم لسه بالعربي، وهيتكتب بالعربي على الشهادة الإنجليزي. تكمّل برضو؟", confirmText: "كمّل", cancelText: "ارجع أعدّل" });
      if (!go) return;
    }
    var ok = await snDialog.confirm({
      icon: "info", title: "توزيع شهادات " + monthAr(month),
      message: winners.map(function (w) { return w.rank + ". " + w.name + " (+" + w.r.gain + ")"; }).join("\n") + (monthDone(month) ? "\n\n(في شهادات اتوزّعت قبل كده لنفس الشهر)" : "") + "\n\nكل طالب هياخد شهادة + " + BONUS + " نقطة وإعلان خاص بيه. متأكد؟",
      confirmText: "وزّع", cancelText: "إلغاء"
    });
    if (!ok) return;

    S.busy = true; $("#certIssue").disabled = true;
    var by = session().id || "admin", now = new Date().toISOString(), fail = 0, newPts = {};
    for (var i = 0; i < winners.length; i++) {
      var w = winners[i], u = w.r.u;
      try {
        var cid = await SNAuth.pushCertificate({ studentId: u.id, name: w.name, fullName: u.fullName || "", grade: u.grade || "", rank: w.rank, gain: w.r.gain, bonus: BONUS, month: month, createdAt: now, createdBy: by });
        var res = await SNAuth.addUserPoints(u.id, BONUS);
        if (res && typeof res.points === "number") newPts[u.id] = res.points;
        var first = String(u.fullName || w.name).trim().split(/\s+/)[0];
        await SNAuth.pushAnnouncement({
          title: "شهادة تقدير — " + monthAr(month),
          body: "مبروك يا " + first + "! جبت المركز " + w.rank + " بين طلاب المنصة في " + monthAr(month) + " واتضاف لك " + BONUS + " نقطة. افتح الشهادة ونزّلها أو شاركها.",
          type: "certificate", target: u.grade || "all", to: u.id, cert: cid, auto: "cert", createdAt: now, createdBy: by
        });
      } catch (e) { fail++; }
    }
    try {
      var snap = {};
      students().forEach(function (u) { snap[u.id] = newPts[u.id] != null ? newPts[u.id] : (Number(u.points) || 0); });
      await SNAuth.saveCertSnapshot(snap);
    } catch (e) { fail++; }
    S.busy = false;
    toast(fail ? "اتوزّعت الشهادات لكن حصلت " + fail + " أخطاء — راجع القايمة" : "اتوزّعت الشهادات على أول " + winners.length + " طلاب", !!fail);
    load(true);
  }

  function init() {
    if (!build()) return;
    var panel = $("#panel-honors");
    var was = false;
    var check = function () {
      var now = panel.classList.contains("is-active");
      if (now && !was) load(false);
      was = now;
    };
    new MutationObserver(check).observe(panel, { attributes: true, attributeFilter: ["class"] });
    check();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
})();

/* dash-pro.js — إضافة دونات "الطلاب حسب الصف" في نظرة عامة الأدمن.
   بيقرا الأرقام من نفس الأشرطة اللي بيرسمها admin.html (من غير ما يلمس أي بيانات أو Firebase)،
   وبيعيد الرسم تلقائيًا كل ما نظرة عامة تتحدّث. */
(function () {
  "use strict";
  var NS = "http://www.w3.org/2000/svg";
  var SHADES = [100, 78, 58, 42, 30, 20];

  function mk(tag, attrs) {
    var el = document.createElementNS(NS, tag);
    Object.keys(attrs || {}).forEach(function (k) { el.setAttribute(k, attrs[k]); });
    return el;
  }

  function build(bars) {
    var rows = Array.prototype.slice.call(bars.querySelectorAll(".ad-bar")).map(function (r) {
      var n = parseInt((r.querySelector("b") || {}).textContent, 10) || 0;
      var name = ((r.querySelector("span") || {}).textContent || "").trim();
      return { name: name, n: n };
    });
    var total = rows.reduce(function (a, r) { return a + r.n; }, 0);

    var wrap = document.createElement("div");
    wrap.className = "pro-donut";
    wrap.setAttribute("data-pro-donut", "1");

    var R = 54, C = 2 * Math.PI * R, GAP = total > 0 && rows.filter(function (r) { return r.n > 0; }).length > 1 ? 3 : 0;
    var svg = mk("svg", { viewBox: "0 0 140 140", role: "img", "aria-label": "الطلاب حسب الصف" });
    svg.appendChild(mk("circle", { "class": "bg", cx: 70, cy: 70, r: R }));

    var offset = 0, segs = [];
    rows.forEach(function (r, i) {
      if (!r.n || !total) return;
      var len = Math.max((r.n / total) * C - GAP, 1);
      var c = mk("circle", { "class": "seg", cx: 70, cy: 70, r: R, transform: "rotate(-90 70 70)" });
      c.style.stroke = "color-mix(in srgb, var(--accent) " + SHADES[i % SHADES.length] + "%, transparent)";
      c.setAttribute("stroke-dasharray", "0 " + C);
      c.setAttribute("stroke-dashoffset", String(-offset));
      svg.appendChild(c);
      segs.push([c, len]);
      offset += (r.n / total) * C;
    });

    var t1 = mk("text", { "class": "n", x: 70, y: 72, "text-anchor": "middle" });
    t1.textContent = String(total);
    var t2 = mk("text", { "class": "l", x: 70, y: 88, "text-anchor": "middle" });
    t2.textContent = "طالب";
    svg.appendChild(t1); svg.appendChild(t2);
    wrap.appendChild(svg);

    var ul = document.createElement("ul");
    rows.forEach(function (r, i) {
      var li = document.createElement("li");
      var dot = document.createElement("i");
      dot.style.background = "color-mix(in srgb, var(--accent) " + SHADES[i % SHADES.length] + "%, transparent)";
      var nm = document.createElement("span"); nm.textContent = r.name;
      var b = document.createElement("b"); b.textContent = String(r.n);
      li.appendChild(dot); li.appendChild(nm); li.appendChild(b);
      ul.appendChild(li);
    });
    wrap.appendChild(ul);

    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        segs.forEach(function (s) { s[0].setAttribute("stroke-dasharray", s[1] + " " + (C - s[1])); });
      });
    });
    return wrap;
  }

  function enhance(root) {
    var bars = root.querySelector(".ad-bars");
    if (!bars || (bars.previousElementSibling && bars.previousElementSibling.hasAttribute("data-pro-donut"))) return;
    bars.parentNode.insertBefore(build(bars), bars);
  }

  function init() {
    var body = document.getElementById("overviewBody");
    if (!body) return;
    enhance(body);
    new MutationObserver(function () { enhance(body); }).observe(body, { childList: true, subtree: true });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();

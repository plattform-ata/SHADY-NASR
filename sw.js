/* Service worker — بيخلّي المنصة قابلة للتثبيت كتطبيق، وبيفتح بسرعة حتى لو النت ضعيف.
   الاستراتيجية:
   - ملفات ثابتة (js / css / صور / خطوط): "الكاش الأول" — بتتفتح فورًا من الجهاز، وبتتحدّث في الخلفية للمرة الجاية.
   - الصفحات (html): النت الأول بمهلة قصيرة (1.2 ثانية) — لو النت بطيء بنفتح النسخة المحفوظة فورًا،
     ولو وقع بنرجع للنسخة المحفوظة. كده التعديلات الجديدة بتظهر من أول فتحة لو النت سريع.
   مش بيتدخل في طلبات Firebase / EmailJS / أي دومين تاني (بيشتغلوا عادي). */
const CACHE = "shadynasr-v71";
const CDN_CACHE = "shadynasr-cdn-v1"; /* ملفات pdf.js (الخطوط وجداول الحروف العربية) — بتتحفظ مرة وتفضل على الجهاز */
const NAV_TIMEOUT_MS = 1200;
const PRECACHE = [
  "./", "index.html", "login.html", "studenti.html", "admin.html", "admin-verify.html",
  "shared.css", "shared.js", "home.js", "dashboard.js", "firebase.js", "auth.js", "liquid.js",
  "announcements.js", "notifications.js", "accounts.js", "login-accounts.js", "grade-codes.js", "settings.js", "notes.js", "honors.js", "lock.js", "grade-access.js", "drive.js", "transfer-ui.js", "certificates.js", "certificates-admin.js", "badge-art.js", "records.js", "ui-pickers.js", "ptr.js", "no-zoom.js", "content.js", "content-admin.js", "pdf-viewer.js", "protect.js", "admin-notes.js", "video-landscape.js", "bell-fx.js", "questions-unit1.js", "questions-unit2.js", "questions-unit3.js",
  "chat.js", "chat.css", "exams.js", "exams.css", "exams-student.js", "exams-admin.js", "progress-chart.js", "home-customize.js", "year-report.js", "i18n-extra.js", "shady-nasr.jpg", "shady-nasr-logo.png", "favicon.png", "schedule-shady-nasr.jpg", "manifest.webmanifest", "manifest-admin.webmanifest"
];
const CACHEABLE = ["document", "script", "style", "image", "font", "manifest"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE)
      .then((cache) => Promise.allSettled(PRECACHE.map((u) => cache.add(u))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE && k !== CDN_CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

function store(req, res) {
  if (res && res.ok && res.status === 200 && !res.redirected) {
    const copy = res.clone();
    caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
  }
  return res;
}

/* صفحات: النت الأول، لكن لو اتأخر أكتر من المهلة نفتح النسخة المحفوظة فورًا */
function navigate(req) {
  return new Promise((resolve) => {
    let settled = false;
    const done = (r) => { if (!settled && r) { settled = true; clearTimeout(timer); resolve(r); } };
    const timer = setTimeout(() => { caches.match(req).then(done); }, NAV_TIMEOUT_MS);

    fetch(req, { cache: "no-cache" })
      .then((res) => { store(req, res); done(res); })
      .catch(async () => {
        const hit = (await caches.match(req, { ignoreSearch: true })) || (await caches.match("index.html"));
        if (!settled) { settled = true; clearTimeout(timer); resolve(hit || Response.error()); }
      });
  });
}

/* ملفات ثابتة: من الكاش فورًا + تحديث في الخلفية */
function assetFast(event, req) {
  return caches.match(req).then((hit) => {
    const net = fetch(req, { cache: "no-cache" }).then((res) => store(req, res));
    if (hit) {
      event.waitUntil(net.catch(() => {}));
      return hit;
    }
    return net.catch(() => caches.match(req, { ignoreSearch: true }).then((h) => h || Response.error()));
  });
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET" || req.headers.has("range")) return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) {
    /* الاستثناء الوحيد: أصول pdf.js (cmaps / standard_fonts / المكتبة) + مكتبة قراءة الـ QR — الكاش الأول */
    if (/(^|\.)cdn\.jsdelivr\.net$|^cdnjs\.cloudflare\.com$/.test(url.hostname) && /pdfjs-dist|pdf\.js|jsQR/.test(url.pathname)) {
      event.respondWith(caches.open(CDN_CACHE).then((c) => c.match(req).then((hit) => hit || fetch(req).then((res) => {
        if (res && res.ok) c.put(req, res.clone()).catch(() => {});
        return res;
      }))));
    }
    return;
  }
  const isNav = req.mode === "navigate";
  if (!isNav && !CACHEABLE.includes(req.destination)) return;

  event.respondWith(isNav ? navigate(req) : assetFast(event, req));
});

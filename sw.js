/* Service worker — بيخلّي المنصة قابلة للتثبيت كتطبيق، وبيفتح بسرعة حتى لو النت ضعيف.
   الاستراتيجية:
   - ملفات ثابتة (js / css / صور / خطوط): "الكاش الأول" — بتتفتح فورًا من الجهاز، وبتتحدّث في الخلفية للمرة الجاية.
   - الصفحات (html): النت الأول بمهلة قصيرة (1.2 ثانية) — لو النت بطيء بنفتح النسخة المحفوظة فورًا،
     ولو وقع بنرجع للنسخة المحفوظة. كده التعديلات الجديدة بتظهر من أول فتحة لو النت سريع.
   مش بيتدخل في طلبات Firebase / EmailJS / أي دومين تاني (بيشتغلوا عادي). */
const CACHE = "shadynasr-v28";
const NAV_TIMEOUT_MS = 1200;
const PRECACHE = [
  "./", "index.html", "login.html", "studenti.html", "admin.html", "admin-verify.html",
  "shared.css", "shared.js", "home.js", "dashboard.js", "firebase.js", "auth.js", "liquid.js",
  "announcements.js", "accounts.js", "login-accounts.js", "settings.js", "notes.js", "honors.js", "admin-notes.js", "questions-unit1.js", "questions-unit2.js", "questions-unit3.js",
  "chat.js", "chat.css", "shady-nasr.jpg", "shady-nasr-logo.png", "favicon.png", "schedule-shady-nasr.jpg", "manifest.webmanifest"
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
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
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
  if (url.origin !== self.location.origin) return;
  const isNav = req.mode === "navigate";
  if (!isNav && !CACHEABLE.includes(req.destination)) return;

  event.respondWith(isNav ? navigate(req) : assetFast(event, req));
});

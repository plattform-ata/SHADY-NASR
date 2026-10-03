/* Service worker — بيخلّي المنصة قابلة للتثبيت كتطبيق، وبيفتح الصفحات الأساسية حتى لو النت ضعيف.
   الاستراتيجية: network-first (دايمًا آخر نسخة من السيرفر، ولو النت وقع بنرجع للنسخة المحفوظة).
   مش بيتدخل في طلبات Firebase / EmailJS / أي دومين تاني (بيشتغلوا عادي). */
const CACHE = "shadynasr-v9";
const PRECACHE = [
  "./", "index.html", "login.html", "studenti.html",
  "shared.css", "shared.js", "home.js", "dashboard.js", "firebase.js", "auth.js", "liquid.js",
  "announcements.js", "settings.js", "honors.js", "questions-unit1.js", "questions-unit2.js", "questions-unit3.js",
  "shady-nasr-logo.png", "favicon.png", "schedule-shady-nasr.jpg", "manifest.webmanifest"
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

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET" || req.headers.has("range")) return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  const isNav = req.mode === "navigate";
  if (!isNav && !CACHEABLE.includes(req.destination)) return;

  event.respondWith(
    fetch(req)
      .then((res) => {
        if (res.ok && res.status === 200 && !res.redirected) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
        }
        return res;
      })
      .catch(() =>
        caches.match(req, { ignoreSearch: true }).then((hit) => hit || (isNav ? caches.match("index.html") : Response.error()))
      )
  );
});

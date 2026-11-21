/* ==========================================================================
   bell-fx.js — سلوك جرس الإشعارات عند الطالب
   - لما يوصل إشعار جديد: الجرس يتحرك بأنيميشن واضح لمدة 5 ثواني + دايرة حمرا فيها عدد الإشعارات.
   - أول ما الطالب يفتح قايمة الإشعارات (يضغط على الجرس أو يفتح صفحة الإعلانات) الدايرة الحمرا تختفي.
   - الدايرة ترجع بس لما يوصل إشعار جديد (العدد يزيد عن آخر عدد اتشاف).
   مستقل عن announcements.js / notifications.js: بيراقب عدّاد #annBellBadge اللي بيحدّثوه.
   ========================================================================== */
(() => {
  "use strict";
  const RING_MS = 5000;
  const bell = () => document.getElementById("annBell");
  const badge = () => document.getElementById("annBellBadge");

  let uid = "guest";
  try { const s = JSON.parse(localStorage.getItem("shadynasr-current-user")); if (s && s.id) uid = s.id; } catch (e) { /* ignore */ }
  const KEY = "shadynasr-bell-ack:" + uid; // بينتهي بـ ":id" فبيتمسح مع بيانات الطالب لو اتحذف

  let ack = 0, ringTimer = 0, lastCount = -1;
  try { ack = parseInt(localStorage.getItem(KEY), 10) || 0; } catch (e) { /* ignore */ }
  const saveAck = () => { try { localStorage.setItem(KEY, String(ack)); } catch (e) { /* ignore */ } };

  const count = () => { const b = badge(); return !b || b.hidden ? 0 : (parseInt(b.textContent, 10) || 0); };

  function stopRing() {
    clearTimeout(ringTimer);
    const el = bell();
    if (el) el.classList.remove("bellfx-ring");
  }
  function startRing() {
    const el = bell();
    if (!el) return;
    stopRing();
    void el.offsetWidth; // يعيد تشغيل الأنيميشن لو جه إشعار تاني
    el.classList.add("bellfx-ring");
    ringTimer = setTimeout(stopRing, RING_MS);
  }

  function sync() {
    const el = bell();
    if (!el) return;
    const n = count();
    if (n < ack) { ack = n; saveAck(); }          // اتقرا/اتمسح منهم → نعدّل آخر عدد اتشاف
    const unseen = n > ack;
    el.classList.toggle("bellfx-seen", !unseen);   // مفيش جديد → الدايرة مخفية
    if (unseen && n > lastCount) startRing();      // جديد فعلًا → حرّك الجرس 5 ثواني
    if (!unseen) stopRing();
    lastCount = n;
  }

  /* فتح قايمة الإشعارات = الطالب شافهم */
  function acknowledge() {
    ack = count();
    saveAck();
    stopRing();
    const el = bell();
    if (el) el.classList.add("bellfx-seen");
  }

  function annOpen() {
    const p = document.querySelector('[data-panel="announcements"]');
    return !!(p && p.classList.contains("is-active"));
  }

  document.addEventListener("DOMContentLoaded", () => {
    const el = bell(), b = badge();
    if (!el || !b) return;

    new MutationObserver(() => { if (annOpen()) acknowledge(); else sync(); })
      .observe(b, { attributes: true, attributeFilter: ["hidden"], childList: true, characterData: true, subtree: true });

    el.addEventListener("click", acknowledge, true);

    const p = document.querySelector('[data-panel="announcements"]');
    if (p) new MutationObserver(() => { if (annOpen()) acknowledge(); }).observe(p, { attributes: true, attributeFilter: ["class"] });

    setTimeout(sync, 600);
  });
})();

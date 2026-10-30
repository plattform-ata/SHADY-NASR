/* ==========================================================================
   settings.js — صفحة الإعدادات في لوحة الطالب
   - زر "الإعدادات" في أعلى القائمة الجانبية بيفتح صفحة الإعدادات
   - ترجمات الصفحة (بتتضاف على قاموس I18N الموجود في shared.js)
   يتحمّل في studenti.html بعد announcements.js.
   ========================================================================== */
(() => {
  "use strict";

  const EXT = {
    ar: {
      dash_nav_settings: "الإعدادات",
      settings_sub: "المظهر واللغة والتطبيق",
      settings_intro: "تحكّم في مظهر المنصة ولغتها وتثبيتها كتطبيق على جهازك.",
      settings_general: "المظهر واللغة",
      set_back: "رجوع للإعدادات",
      glass_title: "Liquid Glass", glass_sub: "مظهر الزجاج السائل بتاع iOS على كل المنصة", glass_level: "قوة التأثير",
      set_tile_general_sub: "فاتح/غامق، اللغة، تحميل التطبيق",
      set_tile_colors_sub: "ثيمات وألوان خاصة بيك",
      settings_install_sub: "ثبّت المنصة على شاشتك الرئيسية",
      theme_colors_title: "ألوان المنصة",
      theme_colors_hint: "اختار الألوان اللي تريحك — بتظهر عندك إنت بس وبتتحفظ على حسابك، والدارك مود بيتولّد تلقائيًا من نفس الألوان.",
      theme_save: "حفظ الألوان", theme_reset: "الرجوع لألوان المنصة",
      theme_state_default: "بتستخدم ألوان المنصة الأصلية.",
      theme_state_custom: "بتستخدم ألوانك الخاصة.",
      theme_state_preview: "معاينة — لسه ما اتحفظتش.",
      theme_saved: "تم حفظ ألوانك", theme_saved_local: "اتحفظت على جهازك بس — تعذّر حفظها أونلاين.",
      theme_cleared: "رجعت ألوان المنصة", theme_need_login: "سجّل دخولك الأول.",
      th_ink: "لون النصوص والعناوين", th_ink_s: "الأغمق",
      th_brand: "اللون الأساسي", th_brand_s: "الهوية",
      th_accent: "لون التمييز (الأزرار)", th_accent_s: "العنصر النشط",
      th_accentSoft: "تمييز فاتح", th_accentSoft_s: "لمسات وخلفيات",
      th_bg: "خلفية الصفحة", th_bg_s: "الفاتحة",
      th_bgSoft: "خلفية الحقول والكروت", th_bgSoft_s: "أغمق قليلًا",
    },
    en: {
      dash_nav_settings: "Settings",
      settings_sub: "Appearance, language and app",
      settings_intro: "Control the platform's look, language and install it as an app on your device.",
      settings_general: "Appearance & language",
      set_back: "Back to settings",
      glass_title: "Liquid Glass", glass_sub: "The iOS liquid glass look across the whole platform", glass_level: "Effect strength",
      set_tile_general_sub: "Light/dark, language, install app",
      set_tile_colors_sub: "Themes and your own colors",
      settings_install_sub: "Add the platform to your home screen",
      theme_colors_title: "Platform colors",
      theme_colors_hint: "Pick the colors you like — they only apply to you and are saved to your account. Dark mode is generated automatically from the same colors.",
      theme_save: "Save colors", theme_reset: "Use platform colors",
      theme_state_default: "Using the platform's default colors.",
      theme_state_custom: "Using your own colors.",
      theme_state_preview: "Preview — not saved yet.",
      theme_saved: "Your colors were saved", theme_saved_local: "Saved on this device only — couldn't save online.",
      theme_cleared: "Back to the platform colors", theme_need_login: "Please log in first.",
      th_ink: "Text & headings", th_ink_s: "Darkest",
      th_brand: "Main color", th_brand_s: "Identity",
      th_accent: "Accent (buttons)", th_accent_s: "Active element",
      th_accentSoft: "Soft accent", th_accentSoft_s: "Highlights & backgrounds",
      th_bg: "Page background", th_bg_s: "Light",
      th_bgSoft: "Fields & cards background", th_bgSoft_s: "Slightly darker",
    },
  };
  if (typeof I18N !== "undefined") {
    Object.assign(I18N.ar, EXT.ar);
    Object.assign(I18N.en, EXT.en);
  }

  document.addEventListener("DOMContentLoaded", () => {
    const btn = document.getElementById("sideSettingsBtn");
    if (btn) {
      btn.addEventListener("click", () => {
        // الرابط المخفي بيتعامل معاه dashboard.js زي أي قسم (العنوان + سجل الرجوع + قفل القائمة)
        const link = document.querySelector('.dash-nav__link[data-target="settings"]');
        if (link) link.click();
      });
    }

    initSettingsHub();
    initGlassControl();
    initUserTheme();
  });


  /* ================= Liquid Glass: زر تفعيل + شريط القوة (بيظهر بعد التفعيل) ================= */
  function initGlassControl() {
    const sw = document.getElementById("glassSwitch");
    const wrap = document.getElementById("glassLevel");
    const range = document.getElementById("glassRange");
    const val = document.getElementById("glassValue");
    const api = window.snLiquid;
    if (!sw || !wrap || !range || !val || !api) return;

    function paint() {
      const on = api.isOn();
      sw.setAttribute("aria-checked", String(on));
      wrap.hidden = !on;
      range.value = String(api.level());
      val.textContent = api.level() + "%";
    }
    sw.addEventListener("click", () => { api.setOn(!api.isOn()); paint(); });
    range.addEventListener("input", () => { api.setLevel(Number(range.value)); val.textContent = range.value + "%"; });
    paint();
  }

  /* ================= مركز الإعدادات: عناوين -> صفحة كل إعداد ================= */
  function initSettingsHub() {
    const hub = document.getElementById("setHub");
    const sub = document.getElementById("setSub");
    const panel = document.querySelector('[data-panel="settings"]');
    if (!hub || !sub || !panel) return;
    const title = document.getElementById("dashPanelTitle");

    function open(key) {
      hub.hidden = !!key;
      sub.hidden = !key;
      sub.querySelectorAll("[data-set-card]").forEach((c) => { c.hidden = c.dataset.setCard !== key; });
      const t = key && hub.querySelector('[data-set-open="' + key + '"] strong');
      if (title) title.textContent = t ? t.textContent : (document.querySelector('.dash-nav__link[data-target="settings"] span') || {}).textContent || title.textContent;
      const main = document.getElementById("dashMain");
      if (main) main.scrollTo({ top: 0, behavior: "instant" });
    }
    hub.querySelectorAll("[data-set-open]").forEach((b) => b.addEventListener("click", () => open(b.dataset.setOpen)));
    document.getElementById("setBack").addEventListener("click", () => open(null));

    // كل مرة تتفتح الإعدادات تبدأ بصفحة العناوين
    let was = panel.classList.contains("is-active");
    new MutationObserver(() => {
      const now = panel.classList.contains("is-active");
      if (now && !was) open(null);
      was = now;
    }).observe(panel, { attributes: true, attributeFilter: ["class"] });
  }

  /* ================= ألوان المنصة الشخصية (نفس خيارات صفحة الأدمن) ================= */
  const DEFAULT_THEME = { ink: "#0f2d35", brand: "#1d5260", accent: "#2c8097", accentSoft: "#8fcfd2", bg: "#f4eee0", bgSoft: "#e8e1ce" };
  const FIELDS = ["ink", "brand", "accent", "accentSoft", "bg", "bgSoft"];
  const PRESETS = [
    { ar: "الأصلي (أزرق مخضر)", en: "Original (teal)", c: DEFAULT_THEME },
    { ar: "بنفسجي", en: "Purple", c: { ink: "#1f1530", brand: "#3f2a66", accent: "#6a45a8", accentSoft: "#cdb8ee", bg: "#f3eefa", bgSoft: "#e4dbf1" } },
    { ar: "أخضر", en: "Green", c: { ink: "#10291c", brand: "#1f4d38", accent: "#2f8a5b", accentSoft: "#a7dcc0", bg: "#eef4ea", bgSoft: "#dde8d6" } },
    { ar: "أزرق", en: "Blue", c: { ink: "#0e1f3a", brand: "#1c3f73", accent: "#2f6bc4", accentSoft: "#a9c8f2", bg: "#eef3fa", bgSoft: "#dce6f4" } },
    { ar: "عنابي", en: "Burgundy", c: { ink: "#2e1018", brand: "#6b1f38", accent: "#b03a5b", accentSoft: "#f0b5c6", bg: "#faf0f2", bgSoft: "#efdde1" } },
    { ar: "برتقالي ترابي", en: "Earthy orange", c: { ink: "#2e1a0e", brand: "#7a3a14", accent: "#c4651f", accentSoft: "#f2c79f", bg: "#fbf3ea", bgSoft: "#efe0cd" } },
    { ar: "رمادي أردوازي", en: "Slate grey", c: { ink: "#1a1f26", brand: "#2f3b4a", accent: "#4f6a8a", accentSoft: "#b6c4d6", bg: "#f1f3f6", bgSoft: "#e0e5ec" } },
    { ar: "تيل غامق", en: "Dark teal", c: { ink: "#0b2a2a", brand: "#14524f", accent: "#1f8f86", accentSoft: "#9edcd5", bg: "#edf5f3", bgSoft: "#d9e8e4" } },
  ];
  const HEX = /^#[0-9a-f]{6}$/i;
  const lang = () => (document.documentElement.lang === "en" ? "en" : "ar");
  const tr = (k) => (EXT[lang()] && EXT[lang()][k]) || EXT.ar[k] || k;
  const sameTheme = (a, b) => FIELDS.every((k) => String(a[k]).toLowerCase() === String(b[k]).toLowerCase());

  function initUserTheme() {
    const card = document.getElementById("userThemeCard");
    const api = window.snUserTheme;
    if (!card || !api) return;

    const presetHost = document.getElementById("stPresetGrid");
    const colorHost = document.getElementById("stColorGrid");
    const stateEl = document.getElementById("stThemeState");
    const saveBtn = document.getElementById("stThemeSave");
    const resetBtn = document.getElementById("stThemeReset");

    // الألوان اللي بتتعرض: ألوان الطالب لو عنده، وإلا ألوان الأدمن، وإلا الأصلية
    const base = () => Object.assign({}, DEFAULT_THEME, api.get() || api.site() || {});
    let draft = base();
    let dirty = false;

    function setState() {
      stateEl.textContent = dirty ? tr("theme_state_preview") : (api.get() ? tr("theme_state_custom") : tr("theme_state_default"));
    }

    function preview() {
      dirty = true;
      api.preview(draft);
      setState();
      renderPresets();
    }

    function renderPresets() {
      presetHost.innerHTML = PRESETS.map((p, i) => {
        const active = sameTheme(draft, p.c);
        const bar = ["ink", "brand", "accent", "accentSoft", "bgSoft", "bg"].map((k) => '<span style="background:' + p.c[k] + '"></span>').join("");
        return '<button type="button" class="st-preset' + (active ? " is-active" : "") + '" data-preset="' + i + '" aria-pressed="' + active + '">' +
          '<div class="st-preset__bar">' + bar + '</div><span class="st-preset__name">' + p[lang()] + "</span></button>";
      }).join("");
      presetHost.querySelectorAll("[data-preset]").forEach((b) => {
        b.addEventListener("click", () => {
          draft = Object.assign({}, PRESETS[Number(b.dataset.preset)].c);
          renderColors();
          preview();
        });
      });
    }

    function renderColors() {
      colorHost.innerHTML = FIELDS.map((k) =>
        '<div class="st-color"><button type="button" class="color-swatch" id="stclr-' + k + '" style="background:' + draft[k] + '" aria-label="' + tr("th_" + k) + '"></button>' +
        '<div><label for="stclr-' + k + '">' + tr("th_" + k) + "</label><small>" + tr("th_" + k + "_s") + ' · <span id="sthex-' + k + '">' + draft[k] + "</span></small></div></div>"
      ).join("");
      FIELDS.forEach((k) => {
        document.getElementById("stclr-" + k).addEventListener("click", () => {
          const before = draft[k];
          const setColor = (v) => {
            draft[k] = v;
            document.getElementById("sthex-" + k).textContent = v;
            document.getElementById("stclr-" + k).style.background = v;
            preview();
          };
          window.snDialog.color({ title: tr("th_" + k), value: before, onInput: setColor }).then((v) => {
            if (v == null) { setColor(before); dirty = !sameTheme(draft, base()); if (!dirty) { api.revert(); setState(); } }
            else setColor(v);
          });
        });
      });
    }

    function toast(msg, err) {
      if (window.snDialog && window.snDialog.toast) window.snDialog.toast(msg, { error: !!err });
    }

    saveBtn.addEventListener("click", async () => {
      saveBtn.disabled = true;
      try {
        await api.save(draft);
        dirty = false;
        toast(tr("theme_saved"));
      } catch (err) {
        if (err && err.message === "NO_USER") toast(tr("theme_need_login"), true);
        else { dirty = false; toast(tr("theme_saved_local"), true); } // اتحفظت محليًا وتعذّر Firebase
      } finally {
        saveBtn.disabled = false;
        setState();
        renderPresets();
      }
    });

    resetBtn.addEventListener("click", async () => {
      resetBtn.disabled = true;
      try { await api.clear(); } catch (e) { /* اتمسحت محليًا */ }
      draft = base();
      dirty = false;
      renderColors();
      renderPresets();
      setState();
      resetBtn.disabled = false;
      toast(tr("theme_cleared"));
    });

    // لو الطالب غيّر ألوان ومحفظش وخرج من الصفحة: نرجّع الألوان المحفوظة
    const panel = document.querySelector('[data-panel="settings"]');
    if (panel) {
      let was = panel.classList.contains("is-active");
      new MutationObserver(() => {
        const now = panel.classList.contains("is-active");
        if (was && !now && dirty) { api.revert(); dirty = false; draft = base(); renderColors(); renderPresets(); setState(); }
        was = now;
      }).observe(panel, { attributes: true, attributeFilter: ["class"] });
    }

    // إعادة رسم الأسماء لما اللغة تتغير
    if (typeof window.applyLanguage === "function") {
      const orig = window.applyLanguage;
      window.applyLanguage = function () {
        const r = orig.apply(this, arguments);
        renderColors(); renderPresets(); setState();
        return r;
      };
    }

    renderColors();
    renderPresets();
    setState();

    // مزامنة ألوان الطالب لو فتح من جهاز تاني
    api.syncFromServer().then(() => { if (!dirty) { draft = base(); renderColors(); renderPresets(); setState(); } });
  }

  /* ================= ملاحظات الأستاذ: قايمتي النوع والشهر بنافذة اختيار بستايل المنصة (بدل قايمة المتصفح) ================= */
  const IDS = ["tnType", "tnMonth"];
  const CHEV = '<svg class="custom-select__chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>';
  const isEn = () => document.documentElement.lang === "en";

  function enhance(sel) {
    if (!sel || sel.dataset.pickReady) return;
    sel.dataset.pickReady = "1";

    const label = document.querySelector('label[for="' + sel.id + '"]');
    const wrap = document.createElement("div");
    wrap.className = "custom-select custom-select--auto";
    sel.parentNode.insertBefore(wrap, sel);
    wrap.appendChild(sel);
    sel.hidden = true;
    sel.tabIndex = -1;
    sel.setAttribute("aria-hidden", "true");

    const trigger = document.createElement("button");
    trigger.type = "button";
    trigger.className = "custom-select__trigger";
    trigger.setAttribute("aria-haspopup", "dialog");
    trigger.innerHTML = '<span class="custom-select__value"></span>' + CHEV;
    wrap.appendChild(trigger);
    const valueEl = trigger.querySelector(".custom-select__value");
    if (label) label.addEventListener("click", (e) => { e.preventDefault(); trigger.focus(); });

    const sync = () => {
      const o = sel.options[sel.selectedIndex];
      valueEl.textContent = o ? o.textContent : "";
    };
    sync();
    sel.addEventListener("change", sync);
    // announcements.js بيعيد تعبئة الاختيارات (لغة / أشهر جديدة) -> نحدّث العنوان
    new MutationObserver(sync).observe(sel, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ["selected"] });

    trigger.addEventListener("click", () => openPicker(sel, label ? label.textContent : "", trigger, sync));
  }

  function openPicker(sel, title, trigger, sync) {
    const ov = document.createElement("div");
    ov.className = "modal-overlay sn-pick";
    ov.setAttribute("role", "dialog");
    ov.setAttribute("aria-modal", "true");

    const box = document.createElement("div");
    box.className = "modal";
    const h = document.createElement("h3");
    h.textContent = title;
    const list = document.createElement("ul");
    list.className = "sn-pick__list";

    Array.from(sel.options).forEach((o, i) => {
      const li = document.createElement("li");
      const b = document.createElement("button");
      b.type = "button";
      b.className = "sn-pick__item" + (i === sel.selectedIndex ? " is-selected" : "");
      b.setAttribute("aria-pressed", String(i === sel.selectedIndex));
      b.innerHTML = '<span></span><span class="sn-pick__dot"></span>';
      b.firstChild.textContent = o.textContent;
      b.addEventListener("click", () => {
        if (sel.selectedIndex !== i) {
          sel.selectedIndex = i;
          sel.dispatchEvent(new Event("change", { bubbles: true }));
        }
        sync();
        close();
      });
      li.appendChild(b);
      list.appendChild(li);
    });

    const cancel = document.createElement("button");
    cancel.type = "button";
    cancel.className = "btn btn--ghost sn-pick__cancel";
    cancel.textContent = isEn() ? "Cancel" : "إلغاء";
    cancel.addEventListener("click", () => close());

    box.append(h, list, cancel);
    ov.appendChild(box);
    document.body.appendChild(ov);
    requestAnimationFrame(() => ov.classList.add("is-open"));

    const onKey = (e) => { if (e.key === "Escape") close(); };
    document.addEventListener("keydown", onKey);
    ov.addEventListener("click", (e) => { if (e.target === ov) close(); });

    const first = list.querySelector(".is-selected") || list.querySelector("button");
    if (first) first.focus({ preventScroll: true });

    function close() {
      document.removeEventListener("keydown", onKey);
      ov.classList.remove("is-open");
      setTimeout(() => ov.remove(), 250);
      trigger.focus({ preventScroll: true });
    }
  }

  document.addEventListener("DOMContentLoaded", () => IDS.forEach((id) => enhance(document.getElementById(id))));
})();

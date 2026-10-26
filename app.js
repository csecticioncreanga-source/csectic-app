(function () {
  "use strict";

  const STORAGE_KEY = "csectic_class";
  const ITEM_H = 72; // Ã®nÄƒlÈ›imea unui rÃ¢nd din roata de selecÈ›ie (trebuie sÄƒ fie la fel Ã®n CSS)
  const EASE = "cubic-bezier(0.65, 0, 0.35, 1)"; // aceeaÈ™i curbÄƒ ca Ã®n CSS (--ease)
  const REDUCED = !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);

  const DAY_NAMES = ["Luni", "MarÈ›i", "Miercuri", "Joi", "Vineri"];
  // Homescreen-only: aplicaÈ›ia nu poate fi pusÄƒ pe ecranul principal pÃ¢nÄƒ la alegerea clasei.
  let _installPrompt = null;
  window.addEventListener("beforeinstallprompt", function (e) {
    if (state.cls) return; // deja selectatÄƒ â†’ lÄƒsÄƒm browserul sÄƒ o propunÄƒ
    e.preventDefault();
    _installPrompt = e;
  });
  const DAY_SHORT = ["L", "Ma", "Mi", "J", "V"];

  const ICONS = {
    orar: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3.5" y="5" width="17" height="15" rx="2.5"/><path d="M8 3v4M16 3v4M3.5 10h17M9 15l2 2 4-4"/></svg>',
    activitati: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="9" r="5.5"/><path d="M9 14l-2 7 5-3 5 3-2-7"/></svg>',
    proiecte: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3z"/></svg>'
  };
  const LABELS = { orar: "Orar", activitati: "ActivitÄƒÈ›i", proiecte: "Proiecte" };
  const ALL_TABS = ["proiecte", "orar", "activitati"];
  const TAB_ORDER = ["proiecte", "orar", "activitati"];
  const NAV_ORDER = {
    orar: ["proiecte", "orar", "activitati"],
    activitati: ["proiecte", "activitati", "orar"],
    proiecte: ["activitati", "proiecte", "orar"]
  };

  const $ = (s) => document.querySelector(s);
  const app = $("#app");
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  const state = { cls: null, tab: "orar", day: 0, busy: false };

  function animate(el, keyframes, opts) {
    if (!el || !el.animate) return { finished: Promise.resolve(), cancel: function () {} };
    const o = Object.assign({ easing: EASE }, opts);
    if (REDUCED) { o.duration = 1; o.delay = 0; }
    return el.animate(keyframes, o);
  }
  function done(anim, fn) { anim.finished.then(fn, fn); }

  function toggleMorph(root, body, btn) {
    if (root._busy) return;
    root._busy = true;
    const isOpen = root.classList.contains("open");
    const h0 = root.offsetHeight;
    if (!isOpen) {
      root.classList.add("open");
      if (btn) btn.setAttribute("aria-expanded", "true");
      const h1 = root.offsetHeight;
      done(animate(root, [{ height: h0 + "px" }, { height: h1 + "px" }], { duration: 480 }), function () { root._busy = false; });
      animate(body, [{ opacity: 0 }, { opacity: 1 }], { duration: 240, delay: 300, easing: "ease-out", fill: "backwards" });
    } else {
      const fade = animate(body, [{ opacity: 1 }, { opacity: 0 }], { duration: 150, easing: "ease-in", fill: "forwards" });
      done(fade, function () {
        root.classList.remove("open");
        if (btn) btn.setAttribute("aria-expanded", "false");
        if (fade.cancel) fade.cancel();
        const h1 = root.offsetHeight;
        done(animate(root, [{ height: h0 + "px" }, { height: h1 + "px" }], { duration: 420 }), function () { root._busy = false; });
      });
    }
  }

  function findClass(id) {
    for (let gi = 0; gi < CATEGORIES.length; gi++) {
      const yrs = CATEGORIES[gi].YEARS;
      for (let yi = 0; yi < yrs.length; yi++) {
        const cl = yrs[yi].classes;
        for (let ci = 0; ci < cl.length; ci++) {
          if (cl[ci].id === id) return { catIdx: gi, yearIdx: yi, classIdx: ci, label: cl[ci].label };
        }
      }
    }
    return null;
  }

  function loadClass() {
    try {
      const c = localStorage.getItem(STORAGE_KEY);
      return c && findClass(c) ? c : null;
    } catch (e) { return null; }
  }
  function saveClass(c) {
    try { localStorage.setItem(STORAGE_KEY, c); } catch (e) { /* ignorÄƒm */ }
  }

  function initLogo() {
    const el = $("#brandLogo");
    const fallback = '<div class="wm"><span class="mono">CE</span><span class="word">CSECTIC</span></div>';
    el.innerHTML = fallback;
    const img = new Image();
    img.alt = "CSECTIC";
    img.onload = function () { el.innerHTML = ""; el.appendChild(img); };
    img.src = "assets/logo.png";
  }

  function pad(n) { return (n < 10 ? "0" : "") + n; }
  function toMin(hhmm) { const p = hhmm.split(":"); return parseInt(p[0], 10) * 60 + parseInt(p[1], 10); }
  function nowMin() { const d = new Date(); return d.getHours() * 60 + d.getMinutes(); }
  function todayIndex() { const d = new Date().getDay(); return d === 0 || d === 6 ? -1 : d - 1; }
  function hourRange(h) { return BELLS[h] || [pad(h) + ":00", pad(h) + ":50"]; }
  function startMin(h) { return toMin(hourRange(h)[0]); }
  function endMin(h) { return toMin(hourRange(h)[1]); }
  function subjName(code) {
    const c = String(code);
    if (typeof SUBJECTS !== "undefined" && SUBJECTS[c]) return SUBJECTS[c];
    const ml = c.match(/^[A-Z]+/);
    if (ml && typeof SUBJECT_PREFIXES !== "undefined" && SUBJECT_PREFIXES[ml[0]]) return SUBJECT_PREFIXES[ml[0]];
    return c;
  }
  function lessonsFor(day) {
  const cls = state.cls;
  if (typeof TIMETABLE_REAL !== "undefined" && TIMETABLE_REAL[cls]) {
    return (TIMETABLE_REAL[cls][day]) || [];
  }
  return (TIMETABLE[cls] && TIMETABLE[cls][day]) || [];
}

  const wheel = $("#wheel");
  let wheelItems = [];
  let wheelIndex = 0;
  const ob = { step: 1, catIdx: 0, yearIdx: 0, busy: false };
  const OB_TITLES = ["Alege ÃŽnvÄƒÈ›ÄƒmÃ¢ntul", "Alege Anul", "Alege Clasa"];

  function setObTitle() { $(".title-pill").textContent = OB_TITLES[ob.step - 1]; }
  function catItems() { return CATEGORIES.map(function (c) { return { id: c.id, label: c.label, cat: true }; }); }
  function yearItems() { return CATEGORIES[ob.catIdx].YEARS.map(function (y) { return { id: y.id, label: y.label }; }); }
  function letterItems() { return CATEGORIES[ob.catIdx].YEARS[ob.yearIdx].classes.map(function (c) { return { id: c.id, label: c.label }; }); }

  function buildWheel(items, selected) {
    wheelItems = items;
    wheel.innerHTML = "";
    items.forEach(function (it, i) {
      const d = document.createElement("div");
      d.className = "wheel-item" + (it.cat ? " cat" : "");
      d.textContent = it.label;
      d.addEventListener("click", function () { wheel.scrollTo({ top: i * ITEM_H, behavior: "smooth" }); });
      wheel.appendChild(d);
    });
    wheelIndex = Math.min(items.length - 1, Math.max(0, selected || 0));
    wheel.scrollTop = wheelIndex * ITEM_H;
    markWheel();
  }
  function markWheel() {
    if (!wheelItems.length) return;
    const idx = Math.min(wheelItems.length - 1, Math.max(0, Math.round(wheel.scrollTop / ITEM_H)));
    wheelIndex = idx;
    wheel.querySelectorAll(".wheel-item").forEach(function (el, i) { el.classList.toggle("active", i === idx); });
  }
  let raf = null;
  wheel.addEventListener("scroll", function () {
    if (raf) cancelAnimationFrame(raf);
    raf = requestAnimationFrame(markWheel);
  });

  function swapWheel(items, selected, dir) {
    ob.busy = true;
    const out = animate(wheel, [{ transform: "translateX(0)", opacity: 1 }, { transform: "translateX(" + (-dir * 45) + "px)", opacity: 0 }], { duration: 220, fill: "forwards" });
    done(out, function () {
      buildWheel(items, selected);
      if (out.cancel) out.cancel();
      done(animate(wheel, [{ transform: "translateX(" + (dir * 45) + "px)", opacity: 0 }, { transform: "translateX(0)", opacity: 1 }], { duration: 320 }), function () { ob.busy = false; });
    });
  }
  function updateObButtons() { $("#backBtn").classList.toggle("hidden", ob.step === 1); }

  function showOnboarding() {
    const f = state.cls ? findClass(state.cls) : null;
    ob.step = 1;
    ob.catIdx = f ? f.catIdx : 0;
    ob.yearIdx = f ? f.yearIdx : 0;
    ob.busy = false;
    buildWheel(catItems(), ob.catIdx);
    setObTitle();
    updateObButtons();
    app.dataset.view = "onboarding";
  }
  function showMain() {
    const f = findClass(state.cls);
    $("#classChip").textContent = (f ? f.label : state.cls) + " â–¾";
    const ti = todayIndex();
    state.day = ti < 0 ? 0 : ti;
    setTab(state.tab, false);
    app.dataset.view = "main";
  }

  $("#continueBtn").addEventListener("click", function () {
    if (ob.busy) return;
    if (ob.step === 1) {
      ob.catIdx = wheelIndex;
      ob.yearIdx = 0;
      ob.step = 2;
      updateObButtons();
      setObTitle();
      swapWheel(yearItems(), ob.yearIdx, 1);
    } else if (ob.step === 2) {
      ob.yearIdx = wheelIndex;
      ob.step = 3;
      const f = state.cls ? findClass(state.cls) : null;
      const pre = f && f.catIdx === ob.catIdx && f.yearIdx === ob.yearIdx ? f.classIdx : 0;
      updateObButtons();
      setObTitle();
      swapWheel(letterItems(), pre, 1);
    } else {
      const c = CATEGORIES[ob.catIdx].YEARS[ob.yearIdx].classes[wheelIndex];
      state.cls = c.id;
      saveClass(c.id);
      if (_installPrompt) {
        try { _installPrompt.prompt(); } catch (_) {}
        _installPrompt = null;
      }
      showMain();
    }
  });
  $("#backBtn").addEventListener("click", function () {
    if (ob.busy || ob.step === 1) return;
    ob.step--;
    updateObButtons();
    setObTitle();
    if (ob.step === 1) swapWheel(catItems(), ob.catIdx, -1);
    else swapWheel(yearItems(), ob.yearIdx, -1);
  });
  $("#classChip").addEventListener("click", showOnboarding);

  function buildNav() {
    const nav = $("#nav");
    nav.innerHTML = ALL_TABS.map(function (t) {
      return '<button class="nav-btn" data-tab="' + t + '"><span class="inner">' + ICONS[t] +
        '<span class="lbl">' + LABELS[t] + "</span></span></button>";
    }).join("");
    nav.querySelectorAll(".nav-btn").forEach(function (b) {
      b.addEventListener("click", function () { setTab(b.dataset.tab, true); });
    });
  }
  function renderNav(withAnim) {
    const nav = $("#nav");
    const btns = {};
    nav.querySelectorAll(".nav-btn").forEach(function (b) { btns[b.dataset.tab] = b; });
    const first = {};
    if (withAnim) Object.keys(btns).forEach(function (t) { first[t] = btns[t].getBoundingClientRect().left; });
    NAV_ORDER[state.tab].forEach(function (t, i) {
      nav.appendChild(btns[t]);
      btns[t].classList.toggle("center", i === 1);
    });
    if (withAnim) {
      Object.keys(btns).forEach(function (t) {
        const dx = first[t] - btns[t].getBoundingClientRect().left;
        if (dx) animate(btns[t], [{ transform: "translateX(" + dx + "px)" }, { transform: "none" }], { duration: 550 });
      });
    }
  }

  function setTab(t, withAnim) {
    const prev = state.tab;
    const panels = { orar: $("#panel-orar"), activitati: $("#panel-activitati"), proiecte: $("#panel-proiecte") };
    const content = $("#content");

    if (withAnim && prev !== t) {
      if (state.busy) return;
      state.busy = true;
      setTimeout(function () { state.busy = false; }, 560);

      const dir = TAB_ORDER.indexOf(t) > TAB_ORDER.indexOf(prev) ? 1 : -1;
      const oldP = panels[prev];
      const newP = panels[t];
      content.scrollTop = 0;
      state.tab = t;

      newP.classList.remove("hidden");
      oldP.classList.add("leaving");
      done(animate(oldP, [{ transform: "translateX(0)", opacity: 1 }, { transform: "translateX(" + (-dir * 60) + "px)", opacity: 0 }], { duration: 450 }), function () {
        if (state.tab !== prev) oldP.classList.add("hidden");
        oldP.classList.remove("leaving");
      });
      animate(newP, [{ transform: "translateX(" + (dir * 60) + "px)", opacity: 0 }, { transform: "translateX(0)", opacity: 1 }], { duration: 550 });
    } else {
      Object.keys(panels).forEach(function (n) { panels[n].classList.toggle("hidden", n !== t); });
      content.scrollTop = 0;
      state.tab = t;
    }

    renderNav(withAnim && prev !== t);
    if (t === "orar") { renderSchedule(); placeIndicator(false); }
  }

  function renderNowStrip() {
    const el = $("#nowStrip");
    const ti = todayIndex();
    if (ti < 0) { el.innerHTML = "Weekend. UrmÄÝØ\™XHšHH2&XÛØ[1 Îˆ“[šOØ‹ˆŽÈ™]\›ŽÈBˆÛÛœÝ\ÝH\ÜÛÛœÑ›ÜŠJNÂˆÛÛœÝHH›ÝÓZ[Š
NÂˆÛÛœÝÝ\ˆH\Ý™š[\Š[˜Ý[Ûˆ

HÈ™]\›ˆHHÝ\Z[ŠÌJH	‰ˆH[™Z[ŠÌJNÈJNÂˆÛÛœÝ]\™HH\Ý™š[\Š[˜Ý[Ûˆ

HÈ™]\›ˆÝ\Z[ŠÌJHˆNÈJNÂˆ]™^H×NÂˆYˆ
]\™K›[™Ý
HÂˆÛÛœÝHX]›Z[‹˜\J[]\™K›X\
[˜Ý[Ûˆ

HÈ™]\›ˆÌNÈJJNÂˆ™^H]\™K™š[\Š[˜Ý[Ûˆ

HÈ™]\›ˆÌHOOHÈJNÂˆBˆÛÛœÝ˜[Y\ÈH[˜Ý[Ûˆ
\œŠHÈ™]\›ˆ\œ‹›X\
[˜Ý[Ûˆ

HÈ™]\›ˆ\ØÊÝXš“˜[YJÌWJJNÈJKš›Ú[ŠˆÈŠNÈNÂˆ][HˆŽÂˆYˆ
Ý\‹›[™Ý
H[
ÏHXÝ[NØˆˆ
È˜[Y\ÊÝ\ŠH
ÈœˆŽÂˆYˆ
™^›[™Ý
H[
ÏH•\›YX^± ÎØˆˆ
È˜[Y\Ê™^
H
ÈˆHˆ
ÈÝ\”˜[™ÙJ™^ÌVÌJVÌNÂˆYˆ
Z[
H[H\Ý›[™ÝÈ“Ü™[HH^šHËX]H\›Z[˜]ˆˆˆ^šHHZHÜ™KˆŽÂˆ[š[›™\’SH[ÂˆB‚ˆ[˜Ý[ÛˆZ[^P˜\Š
HÂˆÛÛœÝ˜\ˆH	
ˆÙ^P˜\ˆŠNÂˆVWÔÒÔ•™›Ü‘XXÚ
[˜Ý[Ûˆ
ËJHÂˆÛÛœÝˆHØÝ[Y[˜Ü™X]Q[[Y[
˜]ÛˆŠNÂˆ‹™]\Ù]™^HHNÂˆ‹^ÛÛ[HÎÂˆ‹˜Y]™[\Ý[™\Š˜ÛXÚÈ‹[˜Ý[Ûˆ

HÈÚ[™ÙQ^JJNÈJNÂˆ˜\‹˜\[™Ú[
ŠNÂˆJNÂˆBˆ[˜Ý[Ûˆ\]Q^P˜\Š
HÂˆÛÛœÝHHÙ^R[™^

NÂˆ	
ˆÙ^P˜\ˆŠKœ]Y\žTÙ[XÝÜ[
˜]ÛˆŠK™›Ü‘XXÚ
[˜Ý[Ûˆ
‹JHÂˆ‹˜Û\ÜÓ\ÝÙÙÛJ˜XÝ]™H‹HOOHÝ]K™^JNÂˆ‹˜Û\ÜÓ\ÝÙÙÛJÙ^H‹HOOHJNÂˆJNÂˆBˆ[˜Ý[ÛˆXÙR[™XØ]ÜŠÚ][š[JHÂˆÛÛœÝ[™H	
ˆÙ^R[™ŠNÂˆÛÛœÝˆH	
ˆÙ^P˜\ˆŠKœ]Y\žTÙ[XÝÜ[
˜]ÛˆŠVÜÝ]K™^WNÂˆYˆ
XˆX‹›Ù™œÙ]ÚY
H™]\›ŽÂˆYˆ
]Ú][š[JH[™œÝ[K˜[œÚ][ÛˆH››Û™HŽÂˆ[™œÝ[KÚYH‹›Ù™œÙ]ÚY
ÈœŽÂˆ[™œÝ[K˜[œÙ›Ü›HH˜[œÛ]V
ˆ
È‹›Ù™œÙ]Y
Èœ
HŽÂˆYˆ
]Ú][š[JHÈ›ÚY[™›Ù™œÙ]ÚYÈ[™œÝ[K˜[œÚ][ÛˆHˆŽÈBˆBˆ[˜Ý[ÛˆÚ[™ÙQ^JJHÂˆYˆ
HOOHÝ]K™^JH™]\›ŽÂˆÛÛœÝ\ˆHHˆÝ]K™^HÈHˆLNÂˆÝ]K™^HHNÂˆ\]Q^P˜\Š
NÂˆXÙR[™XØ]ÜŠYJNÂˆ™[™\“\ÜÛÛœÊ
NÂˆ[š[X]J	
ˆÜØÚY[PØ\™ŠKÞÈ˜[œÙ›Ü›Nˆ˜[œÛ]V
ˆ
È
\ˆ
ˆL
H
Èœ
H‹ÜXÚ]NˆKÈ˜[œÙ›Ü›Nˆ››Û™H‹ÜXÚ]NˆHWKÈ\˜][ÛŽˆLJNÂˆB‚ˆ[˜Ý[Ûˆ™[™\“\ÜÛÛœÊ
HÂˆÛÛœÝ\ÝH\ÜÛÛœÑ›ÜŠÝ]K™^JNÂˆ][H	Ï]ˆÛ\ÜÏH˜Ø\™]]H‰È
ÈVWÓSQTÖÜÝ]K™^WH
ÈÙ]ˆŽÂˆYˆ
[\Ý›[™Ý
HÂˆ[
ÏH	Ï]ˆÛ\ÜÏH™[\H“HÝ[Ü™H0ë›ˆXÙX\Ý1 ÈšKÙ]‰ÎÂˆH[ÙHÂˆ[
ÏH\Ý›X\
[˜Ý[Ûˆ

HÂˆÛÛœÝˆHÝ\”˜[™ÙJÌJNÂˆ™]\›ˆ	Ï]ˆÛ\ÜÏH›\ÜÛÛˆˆ]KZH‰È
ÈÌH
È	È‰È
Âˆ	Ï]ˆÛ\ÜÏH[YH‰È
È–ÌH
ÈØˆˆ
È–ÌWH
ÈÙ]ˆˆ
Âˆ	Ï]]ˆÛ\ÜÏHœÝXšˆ‰È
È\ØÊÝXš“˜[YJÌWJJH
ÈÙ]ˆˆ
ÂˆÙ]ˆˆ
ÂˆÙ]ˆŽÂˆJKš›Ú[ŠˆŠNÂˆBˆ	
ˆÜØÚY[PØ\™ŠKš[›™\’SH[Âˆ\]PÝ\œ™[

NÂˆB‚ˆ[˜Ý[Ûˆ\]PÝ\œ™[

HÂˆÛÛœÝ\ÕÙ^HHÝ]K™^HOOHÙ^R[™^

NÂˆÛÛœÝHH›ÝÓZ[Š
NÂˆ	
ˆÜØÚY[PØ\™ŠKœ]Y\žTÙ[XÝÜ[
‹›\ÜÛÛˆŠK™›Ü‘XXÚ
[˜Ý[Ûˆ
›ÝÊHÂˆÛÛœÝH\œÙR[
›ÝË™]\Ù]šL
NÂˆ›ÝË˜Û\ÜÓ\ÝÙÙÛJ˜Ý\œ™[‹\ÕÙ^H	‰ˆHHÝ\Z[Š
H	‰ˆH[™Z[Š
JNÂˆJNÂˆB‚ˆ[˜Ý[Ûˆ™[™\[››Ý[˜ÙJ
HÂˆÛÛœÝ›ÞH	
ˆØ[››Ý[˜ÙHŠNÂˆYˆ
PS““ÕSÑSQS•Ë›[™Ý
HÈ›Þ˜Û\ÜÓ\Ý˜Y
šY[ˆŠNÈ™]\›ŽÈBˆ›Þ˜Û\ÜÓ\Ýœ™[[Ý™JšY[ˆŠNÂˆÛÛœÝHHS““ÕSÑSQS•ÖÌNÂˆ	
ˆØ[››Ý[˜ÙRXYŠKš[›™\’SH	ÏÜ[ˆÛ\ÜÏHYÈ[[²&ÏÜÜ[Ü[ˆÛ\ÜÏH‰È
È\ØÊK]JH
È	ÏÜÜ[Ü[ˆÛ\ÜÏH›[Ü™H¸ .ÜÜ[‰ÎÂˆ	
ˆØ[››Ý[˜ÙP›ÙHŠKš[›™\’SHS““ÕSÑSQS•Ë›X\
[˜Ý[Ûˆ

HÂˆ™]\›ˆ	Ï]ˆÛ\ÜÏH˜[›ˆ]ˆÛ\ÜÏH˜[›‹Y]H‰È
È\ØÊ™]JH
È	ÏÙ]]ˆÛ\ÜÏH˜[›‹]]H‰È
È\ØÊ]JH
Âˆ	ÏÙ]]ˆÛ\ÜÏH˜[›‹]^‰È
È\ØÊ^
H
ÈÙ]Ù]ˆŽÂˆJKš›Ú[ŠˆŠNÂˆBˆ	
ˆØ[››Ý[˜ÙRXYŠK˜Y]™[\Ý[™\Š˜ÛXÚÈ‹[˜Ý[Ûˆ

HÂˆÙÙÛS[Üœ
	
ˆØ[››Ý[˜ÙHŠK	
ˆØ[››Ý[˜ÙP›ÙHŠK	
ˆØ[››Ý[˜ÙRXYŠJNÂˆJNÂ‚ˆ[˜Ý[Ûˆ™[™\”ØÚY[J
HÂˆ™[™\“›ÝÔÝš\

NÂˆ™[™\[››Ý[˜ÙJ
NÂˆ\]Q^P˜\Š
NÂˆ™[™\“\ÜÛÛœÊ
NÂˆB‚ˆ
[˜Ý[Ûˆ

HÂˆÛÛœÝØ\™H	
ˆÜØÚY[PØ\™ŠNÂˆ]H[ÂˆØ\™˜Y]™[\Ý[™\ŠÝXÚÝ\‹[˜Ý[Ûˆ
JHÈHKÝXÚ\ÖÌK˜ÛY[ÈKÈ\ÜÚ]™NˆYHJNÂˆØ\™˜Y]™[\Ý[™\ŠÝXÚ[™‹[˜Ý[Ûˆ
JHÂˆYˆ
OOH[
H™]\›ŽÂˆÛÛœÝHK˜Ú[™ÙYÝXÚ\ÖÌK˜ÛY[HÂˆH[ÂˆYˆ
X]˜XœÊ
HL
H™]\›ŽÂˆÚ[™ÙQ^JX]›Z[ŠX]›X^
Ý]K™^H
È
ÈHˆLJJJJNÂˆKÈ\ÜÚ]™NˆYHJNÂˆJJ
NÂ‚ˆ[˜Ý[Ûˆ™[™\Ø\™ÊÛÛZ[™\’Y][\ÊHÂˆÛÛœÝ›ÞH	
ÛÛZ[™\’Y
NÂˆ›Þš[›™\’SH][\Ë›X\
[˜Ý[Ûˆ
]
HÂˆ™]\›ˆ	Ï]ÛˆÛ\ÜÏH™Û\ÜÈ][Hˆ\šXKY^[™YH™˜[ÙH‰È
Âˆ	Ï]ˆÛ\ÜÏH[Xˆ‰È
È
]š[XYÙHÈ	ÈÝ[OH˜˜XÚÙÜ›Ý[™Z[XYÙN\›
	ÉÈ
È\ØÊ]š[XYÙJH
È	×	ÊH‰ÈˆˆŠH
Èˆˆ
Âˆ
]™]HÈ	ÏÜ[ˆÛ\ÜÏH™]H‰È
È\ØÊ]™]JH
ÈÜÜ[ˆˆˆˆŠH
ÈÙ]ˆˆ
Âˆ	Ï]ˆÛ\ÜÏH›˜[YH‰È
È\ØÊ]]JH
ÈÙ]ˆˆ
Âˆ	Ï]ˆÛ\ÜÏH™\ØÈ‰È
È\ØÊ]^
H
ÈÙ]ˆˆ
ÂˆØ]ÛˆŽÂˆJKš›Ú[ŠˆŠNÂˆ›Þœ]Y\žTÙ[XÝÜ[
‹š][HŠK™›Ü‘XXÚ
[˜Ý[Ûˆ
ŠHÂˆ‹˜Y]™[\Ý[™\Š˜ÛXÚÈ‹[˜Ý[Ûˆ

HÈÙÙÛS[Üœ
‹‹œ]Y\žTÙ[XÝÜŠ‹™\ØÈŠKŠNÈJNÂˆJNÂˆB‚ˆÚ[™ÝË˜Y]™[\Ý[™\Šœ™\Ú^™H‹[˜Ý[Ûˆ

HÈYˆ
Ý]KXˆOOH›Ü˜\ˆŠHXÙR[™XØ]ÜŠ˜[ÙJNÈJNÂ‚ˆ[š]ÙÛÊ
NÂˆZ[˜]Š
NÂˆZ[^P˜\Š
NÂˆ™[™\Ø\™ÊˆØXÝ]š]Y\Ó\Ý‹PÕU’UQTÊNÂˆ™[™\Ø\™ÊˆÜ›Ú™XÝÓ\Ý‹“Ò‘PÕÊNÂ‚ˆÛÛœÝØ]™YHØYÛ\ÜÊ
NÂˆYˆ
Ø]™Y
HÈÝ]K˜ÛÈHØ]™YÈÚÝÓXZ[Š
NÈBˆ[ÙHÚÝÓÛ˜›Ø\™[™Ê
NÂ‚ˆ™\]Y\Ý[š[X][Û‘œ˜[YJ[˜Ý[Ûˆ

HÂˆ™\]Y\Ý[š[X][Û‘œ˜[YJ[˜Ý[Ûˆ

HÈ\˜Û\ÜÓ\Ýœ™[[Ý™J››ËX[š[HŠNÈJNÂˆJNÂ‚ˆÙ][\˜[
[˜Ý[Ûˆ

HÂˆYˆ
Ý]KXˆOOH›Ü˜\ˆˆ	‰ˆÝ]K˜ÛÊHÈ™[™\“›ÝÔÝš\

NÈ\]PÝ\œ™[

NÈBˆKŒ
NÂŸJJ
NÂ
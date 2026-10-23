(function () {
  "use strict";

  const STORAGE_KEY = "csectic_class";
  const ITEM_H = 72; // înălțimea unui rând din roata de selecție (trebuie să fie la fel în CSS)
  const EASE = "cubic-bezier(0.65, 0, 0.35, 1)"; // aceeași curbă ca în CSS (--ease)
  const REDUCED = !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);

  const DAY_NAMES = ["Luni", "Marți", "Miercuri", "Joi", "Vineri"];
  // Homescreen-only: aplicația nu poate fi pusă pe ecranul principal până la alegerea clasei.
  let _installPrompt = null;
  window.addEventListener("beforeinstallprompt", function (e) {
    if (state.cls) return; // deja selectată → lăsăm browserul să o propună
    e.preventDefault();
    _installPrompt = e;
  });
  const DAY_SHORT = ["L", "Ma", "Mi", "J", "V"];

  const ICONS = {
    orar: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3.5" y="5" width="17" height="15" rx="2.5"/><path d="M8 3v4M16 3v4M3.5 10h17M9 15l2 2 4-4"/></svg>',
    activitati: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="9" r="5.5"/><path d="M9 14l-2 7 5-3 5 3-2-7"/></svg>',
    proiecte: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3z"/></svg>'
  };
  const LABELS = { orar: "Orar", activitati: "Activități", proiecte: "Proiecte" };
  const ALL_TABS = ["proiecte", "orar", "activitati"];
  // Ordinea liniară a filelor (decide direcția animației: stânga sau dreapta)
  const TAB_ORDER = ["proiecte", "orar", "activitati"];
  // Fila activă merge mereu în butonul din mijloc
  const NAV_ORDER = {
    orar: ["proiecte", "orar", "activitati"],
    activitati: ["proiecte", "activitati", "orar"],
    proiecte: ["activitati", "proiecte", "orar"]
  };

  const $ = (s) => document.querySelector(s);
  const app = $("#app");
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  const state = { cls: null, tab: "orar", day: 0, busy: false };

  // ---------- Ajutoare pentru animații ----------
  function animate(el, keyframes, opts) {
    if (!el || !el.animate) return { finished: Promise.resolve(), cancel: function () {} };
    const o = Object.assign({ easing: EASE }, opts);
    if (REDUCED) { o.duration = 1; o.delay = 0; }
    return el.animate(keyframes, o);
  }
  function done(anim, fn) { anim.finished.then(fn, fn); }

  // Morph: elementul se lungește/scurtează, iar textul apare cu fade scurt după
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

  // ---------- Clase ----------
  // Caută o clasă (ex. "X A") în cele trei trepte (categorie -> an -> clasa)
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

  // Memorare clasă (doar pe telefonul elevului)
  function loadClass() {
    try {
      const c = localStorage.getItem(STORAGE_KEY);
      return c && findClass(c) ? c : null;
    } catch (e) { return null; }
  }
  function saveClass(c) {
    try { localStorage.setItem(STORAGE_KEY, c); } catch (e) { /* ignorăm */ }
  }

  // ---------- Logo (assets/logo.png, altfel o variantă text) ----------
  function initLogo() {
    const el = $("#brandLogo");
    const fallback = '<div class="wm"><span class="mono">CE</span><span class="word">CSECTIC</span></div>';
    el.innerHTML = fallback;
    const img = new Image();
    img.alt = "CSECTIC";
    img.onload = function () { el.innerHTML = ""; el.appendChild(img); };
    img.src = "assets/logo.png";
  }

  // ---------- Timp ----------
  function pad(n) { return (n < 10 ? "0" : "") + n; }
  function toMin(hhmm) { const p = hhmm.split(":"); return parseInt(p[0], 10) * 60 + parseInt(p[1], 10); }
  function nowMin() { const d = new Date(); return d.getHours() * 60 + d.getMinutes(); }
  function todayIndex() { const d = new Date().getDay(); return d === 0 || d === 6 ? -1 : d - 1; }
  function hourRange(h) { return BELLS[h] || [pad(h) + ":00", pad(h) + ":50"]; }
  function startMin(h) { return toMin(hourRange(h)[0]); }
  function endMin(h) { return toMin(hourRange(h)[1]); }
  // Numele materiei: coduri exacte din SUBJECTS, altfel prefixul de litere din
  // SUBJECT_PREFIXES (B4, B2, B1 = Biologie), altfel afișăm codul așa cum a venit.
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

  // ---------- Ecranul 1: alegerea clasei, în trei trepte (învățământul, apoi anul, apoi litera) ----------
  const wheel = $("#wheel");
  let wheelItems = [];
  let wheelIndex = 0;
  const ob = { step: 1, catIdx: 0, yearIdx: 0, busy: false };
  const OB_TITLES = ["Alege Învățământul", "Alege Anul", "Alege Clasa"];

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

  // Schimbă lista din roată: cea veche iese într-o parte, cea nouă intră din cealaltă
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
    app.dataset.view = "onboarding"; // logo-ul se mărește la loc, ecranele alunecă
  }
  function showMain() {
    const f = findClass(state.cls);
    $("#classChip").textContent = (f ? f.label : state.cls) + " ▾";
    const ti = todayIndex();
    state.day = ti < 0 ? 0 : ti;
    setTab(state.tab, false);
    app.dataset.view = "main"; // logo-ul se micșorează, ecranele alunecă
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

  // ---------- Bara de jos (butoanele se mută animat) ----------
  function buildNav() {
    const nav = $("#nav");
    nav.innerHTML = ALL_TABS.map(function (t) {
      return '<button class="nav-btn" data-tab="' + t + '"><span class="inner">' + ICONS[t] +
        '<span class="lbl">' + LABELS[t] + "</span></button>".replace("</button>", "</span></button>");
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

  // ---------- Schimbarea filelor (slide stânga <-> dreapta) ----------
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

  // ---------- Orar ----------
  function renderNowStrip() {
    const el = $("#nowStrip");
    const ti = todayIndex();
    if (ti < 0) { el.innerHTML = "Weekend. Următoarea zi de școală: <b>Luni</b>."; return; }
    const list = lessonsFor(ti);
    const m = nowMin();
    const cur = list.filter(function (l) { return m >= startMin(l[0]) && m < endMin(l[0]); });
    const future = list.filter(function (l) { return startMin(l[0]) > m; });
    let next = [];
    if (future.length) {
      const h = Math.min.apply(null, future.map(function (l) { return l[0]; }));
      next = future.filter(function (l) { return l[0] === h; });
    }
    const names = function (arr) { return arr.map(function (l) { return esc(subjName(l[1])); }).join(" / "); };
    let html = "";
    if (cur.length) html += "<b>Acum:</b> " + names(cur) + "<br>";
    if (next.length) html += "<b>Urmează:</b> " + names(next) + " la " + hourRange(next[0][0])[0];
    if (!html) html = list.length ? "Orele de azi s-au terminat." : "Azi nu ai ore.";
    el.innerHTML = html;
  }

  // Butoanele zilelor se construiesc o singură dată (ca indicatorul să poată aluneca)
  function buildDayBar() {
    const bar = $("#dayBar");
    DAY_SHORT.forEach(function (s, i) {
      const b = document.createElement("button");
      b.dataset.day = i;
      b.textContent = s;
      b.addEventListener("click", function () { changeDay(i); });
      bar.appendChild(b);
    });
  }
  function updateDayBar() {
    const ti = todayIndex();
    $("#dayBar").querySelectorAll("button").forEach(function (b, i) {
      b.classList.toggle("active", i === state.day);
      b.classList.toggle("today", i === ti);
    });
  }
  function placeIndicator(withAnim) {
    const ind = $("#dayInd");
    const b = $("#dayBar").querySelectorAll("button")[state.day];
    if (!b || !b.offsetWidth) return;
    if (!withAnim) ind.style.transition = "none";
    ind.style.width = b.offsetWidth + "px";
    ind.style.transform = "translateX(" + b.offsetLeft + "px)";
    if (!withAnim) { void ind.offsetWidth; ind.style.transition = ""; }
  }
  function changeDay(i) {
    if (i === state.day) return;
    const dir = i > state.day ? 1 : -1;
    state.day = i;
    updateDayBar();
    placeIndicator(true);
    renderLessons();
    animate($("#scheduleCard"), [{ transform: "translateX(" + (dir * 50) + "px)", opacity: 0 }, { transform: "none", opacity: 1 }], { duration: 450 });
  }

  function renderLessons() {
    const list = lessonsFor(state.day);
    let html = '<div class="card-title">' + DAY_NAMES[state.day] + "</div>";
    if (!list.length) {
      html += '<div class="empty">Nu sunt ore în această zi.</div>';
    } else {
      html += list.map(function (l) {
        const r = hourRange(l[0]);
        return '<div class="lesson" data-h="' + l[0] + '">' +
          '<div class="time"><b>' + r[0] + "</b>" + r[1] + "</div>" +
          '<div><div class="subj">' + esc(subjName(l[1])) + "</div>" +
          "</div>" +
          "</div>";
      }).join("");
    }
    $("#scheduleCard").innerHTML = html;
    updateCurrent();
  }

  // Evidențiază ora curentă fără să refacă lista (ca să nu se repete animațiile)
  function updateCurrent() {
    const isToday = state.day === todayIndex();
    const m = nowMin();
    $("#scheduleCard").querySelectorAll(".lesson").forEach(function (row) {
      const h = parseInt(row.dataset.h, 10);
      row.classList.toggle("current", isToday && m >= startMin(h) && m < endMin(h));
    });
  }

  function renderAnnounce() {
    const box = $("#announce");
    if (!ANNOUNCEMENTS.length) { box.classList.add("hidden"); return; }
    box.classList.remove("hidden");
    const a = ANNOUNCEMENTS[0];
    $("#announceHead").innerHTML = '<span class="tag">Anunț</span><span class="txt">' + esc(a.title) + '</span><span class="more">›</span>';
    $("#announceBody").innerHTML = ANNOUNCEMENTS.map(function (x) {
      return '<div class="ann"><div class="ann-date">' + esc(x.date) + '</div><div class="ann-title">' + esc(x.title) +
        '</div><div class="ann-text">' + esc(x.text) + "</div></div>";
    }).join("");
  }
  $("#announceHead").addEventListener("click", function () {
    toggleMorph($("#announce"), $("#announceBody"), $("#announceHead"));
  });

  function renderSchedule() {
    renderNowStrip();
    renderAnnounce();
    updateDayBar();
    renderLessons();
  }

  // Swipe stânga/dreapta pe orar = schimbă ziua
  (function () {
    const card = $("#scheduleCard");
    let x0 = null;
    card.addEventListener("touchstart", function (e) { x0 = e.touches[0].clientX; }, { passive: true });
    card.addEventListener("touchend", function (e) {
      if (x0 === null) return;
      const dx = e.changedTouches[0].clientX - x0;
      x0 = null;
      if (Math.abs(dx) < 50) return;
      changeDay(Math.min(4, Math.max(0, state.day + (dx < 0 ? 1 : -1))));
    }, { passive: true });
  })();

  // ---------- Activități și proiecte ----------
  function renderCards(containerId, items) {
    const box = $(containerId);
    box.innerHTML = items.map(function (it) {
      return '<button class="glass item" aria-expanded="false">' +
        '<div class="thumb"' + (it.image ? ' style="background-image:url(\'' + esc(it.image) + '\')"' : "") + ">" +
        (it.date ? '<span class="date">' + esc(it.date) + "</span>" : "") + "</div>" +
        '<div class="name">' + esc(it.title) + "</div>" +
        '<div class="desc">' + esc(it.text) + "</div>" +
        "</button>";
    }).join("");
    box.querySelectorAll(".item").forEach(function (b) {
      b.addEventListener("click", function () { toggleMorph(b, b.querySelector(".desc"), b); });
    });
  }

  window.addEventListener("resize", function () { if (state.tab === "orar") placeIndicator(false); });

  // ---------- Pornire ----------
  initLogo();
  buildNav();
  buildDayBar();
  renderCards("#activitiesList", ACTIVITIES);
  renderCards("#projectsList", PROJECTS);

  // Pornim întotdeauna în meniul de selecție. Clasa salvată (dacă există) e doar
  // preselecție convenabilă în roată — nu mai intră direct în ea la deschidere.
  const saved = loadClass();
  if (saved) { state.cls = saved; }
  showOnboarding();

  // După prima afișare pornim animațiile (ca ecranul să nu "sară" la încărcare)
  requestAnimationFrame(function () {
    requestAnimationFrame(function () { app.classList.remove("no-anim"); });
  });

  // Reîmprospătează "Acum / Urmează" și ora curentă la fiecare minut
  setInterval(function () {
    if (state.tab === "orar" && state.cls) { renderNowStrip(); updateCurrent(); }
  }, 60000);
})();
/* CSECTIC — Notificări (banner + activare + abonare web push).
 * Trimiterea mesajelor se face din GitHub Actions (gratuit, web-push/VAPID).
 * Lista de abonați e ținută într-un Google Sheet printr-un Apps Script;
 * la apăsarea butonului, browserul POSTează abonația acolo (fără cont,
 * fără server propriu). Dacă SUBMIT_URL e gol, abonarea rămâne locală
 * până când URL-ul e completat din NOTIFICARI-SETUP.md.
 */
(function () {
  "use strict";

  // Cheia PUBLICĂ VAPID (cheia privată e doar în secretul repository-ului)
  const VAPID_PUBLIC = "BJ54D-SD-PrrYbrFD7NIKRFOR-tBAK6hHmzlnSYUqqOMOozSiKxrBdAqN3-JFzDhSTMjEaA5c39et4pHRNpGt80";
  // URL-ul Apps Script creat după pașii din NOTIFICARI-SETUP.md
  const SUBMIT_URL = "https://script.google.com/macros/s/AKfycbzpQdN2mv1BV6bzai0N9luQOkxqcWnmHe7VJdeittyX2Fq53cpahzi0ZYDo2PhfYDdy/exec";
  const SITE_URL = "https://csecticioncreanga-source.github.io/csectic-app/";
  const LS_FLAG = "csectic_notify_state"; // "on" | "off" | "denied"

  const STORAGE_KEY = "csectic_class";

  function $(s) { return document.querySelector(s); }

  // ---------- helpers ----------
  function urlB64ToU8(b64) {
    const pad = "===".slice((b64.length + 3) % 4);
    const b = (b64 + pad).replace(/-/g, "+").replace(/_/g, "/");
    const raw = atob(b);
    const arr = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
    return arr;
  }

  function getLS() { try { return localStorage.getItem(LS_FLAG) || ""; } catch (_) { return ""; } }
  function setLS(v) { try { localStorage.setItem(LS_FLAG, v); } catch (_) {} }

  async function getReg() {
    if (!("serviceWorker" in navigator)) return null;
    try { return await navigator.serviceWorker.register("sw.js"); }
    catch (e) { console.warn("SW registration failed:", e); return null; }
  }
  async function getSub(reg) {
    if (!reg || !reg.pushManager) return null;
    try { return await reg.pushManager.getSubscription(); }
    catch (e) { return null; }
  }

  // Trimite abonația + clasa spre Apps Script (fire-and-forget, no-cors)
  function sendSub(sub, cls, label) {
    if (!SUBMIT_URL || !sub) return;
    try {
      const body = new URLSearchParams();
      body.set("endpoint", sub.endpoint);
      body.set("p256dh", sub.toJSON().keys.p256dh || "");
      body.set("auth", sub.toJSON().keys.auth || "");
      body.set("cls", cls || "");
      body.set("label", label || "");
      body.set("url", SITE_URL);
      fetch(SUBMIT_URL, { method: "POST", mode: "no-cors", body: body });
    } catch (e) { console.warn("sendSub:", e); }
  }

  function classInfo() {
    try {
      const id = localStorage.getItem(STORAGE_KEY) || "";
      // găsim label-ul clăsei din CATEGORIES (sursa: data.js, încărcat deja)
      if (typeof CATEGORIES !== "undefined") {
        for (let ci = 0; ci < CATEGORIES.length; ci++) {
          const yrs = CATEGORIES[ci].YEARS;
          for (let yi = 0; yi < yrs.length; yi++) {
            const list = yrs[yi].classes;
            for (let k = 0; k < list.length; k++) {
              if (list[k].id === id) return { id: id, cat: CATEGORIES[ci].id, label: list[k].label };
            }
          }
        }
      }
      return { id: id, cat: "", label: id };
    } catch (_) { return { id: "", cat: "", label: "" }; }
  }

  // ---------- bannerul din aplicație ----------
  function bannerHTML(state) {
    if (state === "on") {
      return '<div class="notif glass on" id="notifBanner" role="status">' +
        '<div class="notif-icon">🔔</div>' +
        '<div class="notif-txt"><b>Notificări active pentru ' + esc(classInfo().label) + '</b>' +
        '<span>Primești anunțuri, clopoțel și programul de mâine.</span></div>' +
        '<button class="notif-act off" id="notifBtn">Oprește</button></div>';
    }
    return '<div class="notif glass" id="notifBanner" role="alert">' +
      '<div class="notif-icon">🔔</div>' +
      '<div class="notif-txt"><b>Primește anunțuri și orarul pe telefon</b>' +
      '<span>Anunț nou, memento clopoțel și programul de mâine — gratuite.</span></div>' +
      '<button class="notif-act" id="notifBtn">Activează</button></div>';
  }
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]; }); }

  function renderBanner() {
    const host = $("#panel-orar");
    if (!host) return;
    const state = getLS() === "on" ? "on" : "off";
    let el = $("#notifBanner");
    if (!el) { el = document.createElement("div"); host.insertBefore(el, host.firstChild); }
    el.outerHTML = bannerHTML(state);
    const btn = $("#notifBtn");
    if (btn) btn.addEventListener("click", onBtnClick);
  }

  async function onBtnClick() {
    const now = getLS();
    if (now === "on") { await deactivate(); return; }
    await activate();
  }

  async function activate() {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      alert("Browserul tău nu suportă notificări web. Folosește Safari/Chrome recent.");
      return;
    }
    let perm = Notification.permission;
    if (perm === "default") perm = await Notification.requestPermission();
    if (perm === "denied") { setLS("denied"); renderBanner(); return; }
    const reg = await getReg();
    if (!reg) { alert("Nu am putu înregistra serviciul de notificări. Reîncarcă pagina."); return; }
    let sub = await getSub(reg);
    if (!sub) {
      try {
        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlB64ToU8(VAPID_PUBLIC)
        });
      } catch (e) {
        console.warn("subscribe:", e);
        return;
      }
    }
    const ci = classInfo();
    sendSub(sub, ci.id, ci.label);
    setLS("on");
    renderBanner();
  }

  async function deactivate() {
    const reg = await getReg();
    const sub = await getSub(reg);
    if (sub && sub.endpoint) {
      try {
        fetch(SUBMIT_URL, { method: "POST", mode: "no-cors", body: new URLSearchParams({ mode: "off", endpoint: sub.endpoint }) });
      } catch (_) {}
      try { await sub.unsubscribe(); } catch (_) {}
    }
    setLS("off");
    renderBanner();
  }

  // Reabonea{4�-i clasa dacă s-a schimbat (polling, decuplat de app.js)
  let lastCls = null;
  function watchCls() {
    const ci = classInfo();
    if (ci.id !== lastCls && lastCls !== null && getLS() === "on") {
      getReg().then(function (reg) {
        return getSub(reg);
      }).then(function (sub) {
        if (sub) sendSub(sub, ci.id, ci.label);
      });
    }
    lastCls = ci.id;
  }

  // Pornire
  function init() {
    renderBanner();
    getReg().then(function (reg) { return getSub(reg); }).then(function (sub) {
      if (!sub && getLS() === "on") setLS("off");
      renderBanner();
    });
    if (typeof Notification !== "undefined" && Notification.permission === "granted") renderBanner();
    setInterval(watchCls, 2000);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();

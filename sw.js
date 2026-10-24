/* CSECTIC — Service Worker pentru notificări web push.
 * Trăiește la rădăcina site-ului (scope = /csectic-app/).
 * Primește evenimentele "push" trimise de GitHub Actions (web-push/VAPID)
 * și le afișează ca notificări, pe Chrome/Android și iOS (16.4+, aplicația
 * trebuie să fie adăugată pe ecranul principal).
 */
"use strict";

const SCOPE = self.registration ? self.registration.scope : "./";
const ICON = SCOPE + "assets/icon-192.png";
const BADGE = SCOPE + "assets/favicon32.png";

self.addEventListener("install", function (e) {
  self.skipWaiting();
});
self.addEventListener("activate", function (e) {
  e.waitUntil(self.clients.claim());
});

// Soarta e un JSON {title, body, url, tag}
self.addEventListener("push", function (e) {
  let data = {};
  try { data = e.data ? e.data.json() : {}; }
  catch (_) { data = { title: "CSECTIC", body: (e.data && e.data.text()) || "" }; }
  e.waitUntil(
    self.registration.showNotification(data.title || "CSECTIC", {
      body: data.body || "",
      tag: data.tag || "csectic",
      icon: ICON,
      badge: BADGE,
      lang: "ro",
      data: { url: data.url || SCOPE }
    })
  );
});

// La atingerea notificării: deschide/axează aplicația
self.addEventListener("notificationclick", function (e) {
  e.notification.close();
  const url = (e.notification.data && e.notification.data.url) || SCOPE;
  e.waitUntil(
    (async function () {
      const list = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (let i = 0; i < list.length; i++) {
        if (list[i].url.indexOf(SCOPE) === 0) {
          if (url !== SCOPE && list[i].navigate) { try { await list[i].navigate(url); } catch (_) {} }
          return list[i].focus();
        }
      }
      return self.clients.openWindow(url);
    })()
  );
});

#!/usr/bin/env node
/* CSECTIC — trimitere notificări web push (gratuit, GitHub Actions + web-push/VAPID).
 *
 * Moduri:
 *   announce  — un commit pe data.js/timetable_*.js → „Anunț nou” către toți
 *   schedule  — cron la 5 minute → memento clopoțel + programul de mâine (20:00 Romania)
 *   test      — workflow manual → notificare de probă către toți
 *
 * Secreturi (GitHub → Settings → Secrets → Actions):
 *   SUBS_URL          — URL-ul Apps Script GET (lista de abonați JSON)
 *   VAPID_PRIVATE_KEY — cheia privată generată (vezi vapid-keys-local.txt local)
 *
 * Dacă SUBS_URL lipsește, scriptul doar calculează și afișează mesajele (dry-run în log).
 */
"use strict";

var fs = require("fs");
var path = require("path");
var vm = require("vm");
var crypto = require("crypto");

var ROOT = path.join(__dirname, "..");
var SITE_URL = "https://csecticioncreanga-source.github.io/csectic-app/";
var VAPID_PUBLIC = "BJ54D-SD-PrrYbrFD7NIKRFOR-tBAK6hHmzlnSYUqqOMOozSiKxrBdAqN3-JFzDhSTMjEaA5c39et4pHRNpGt80";
var VAPID_CONTACT = "mailto:contact@example.com";

var MODE = process.env.NOTIFY_MODE || "schedule";
var SUBS_URL = process.env.SUBS_URL || "";

// ============================================================
// 1. Încarc datele aplicației (data.js + timetable_1..6.js) într-un sandbox
// ============================================================
function loadData() {
  var files = ["data.js", "timetable_1.js", "timetable_2.js", "timetable_3.js",
               "timetable_4.js", "timetable_5.js", "timetable_6.js"];
  var src = files.map(function (name) {
    return fs.readFileSync(path.join(ROOT, name), "utf8");
  }).join("\n;\n");
  src += ";\n__OUT = {SUBJECT_PREFIXES: SUBJECT_PREFIXES, SUBJECTS: SUBJECTS, BELLS: BELLS, CATEGORIES: CATEGORIES, TIMETABLE: TIMETABLE, ANNOUNCEMENTS: ANNOUNCEMENTS};";
  var sandbox = { __OUT: null };
  vm.createContext(sandbox);
  vm.runInContext(src, sandbox);
  return sandbox.__OUT;
}

var DATA = loadData();
var TIMETABLE = DATA.TIMETABLE || {};
var BELLS = DATA.BELLS || {};
var ANNOUNCEMENTS = DATA.ANNOUNCEMENTS || [];
var SUBJECTS = DATA.SUBJECTS || {};
var PREFIXES = DATA.SUBJECT_PREFIXES || {};
var CATEGORIES = DATA.CATEGORIES || [];

// ============================================================
// 2. Ajutoare
// ============================================================
var DAY_NAMES = ["Luni", "Marți", "Miercuri", "Joi", "Vineri"];

function subjName(code) {
  var c = String(code);
  if (SUBJECTS[c]) return SUBJECTS[c];
  var m = c.match(/^[A-Z]+/);
  if (m && PREFIXES[m[0]]) return PREFIXES[m[0]];
  return c;
}
function toMin(hhmm) { var p = hhmm.split(":"); return (+p[0]) * 60 + (+p[1]); }
function hourRange(h) { return BELLS[h] || [(h < 10 ? "0" + h : h) + ":00", (h < 10 ? "0" + h : h) + ":50"]; }

// Oraexactă în România ca {dow: 0..6 (0=luni), hh, mm, min (de la miez de noapte), dateLabel}
function bucharestNow() {
  var now = new Date();
  var f = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Bucharest", hour12: false,
    weekday: "short", hour: "2-digit", minute: "2-digit", year: "numeric", month: "2-digit", day: "2-digit"
  }).formatToParts(now);
  var get = function (t) { for (var i = 0; i < f.length; i++) if (f[i].type === t) return f[i].value; return ""; };
  var weekday = get("weekday");
  var wdMap = { Mon: 0, Tue: 1, Wed: 2, Thu: 3, Fri: 4, Sat: 5, Sun: 6 };
  var hh = parseInt(get("hour"), 10); if (hh === 24) hh = 0;
  var mm = parseInt(get("minute"), 10);
  return {
    dow: wdMap[weekday],          // 0 = Luni ... 6 = Duminică (ca în TIMETABLE)
    hh: hh, mm: mm, min: hh * 60 + mm,
    nowDate: get("day") + "." + get("month") + "." + get("year"),
    raw: now
  };
}
function lessonsFor(cls, day) {
  var row = TIMETABLE[cls];
  if (!row) return [];
  var l = row[day] || row[String(day)] || [];
  return l;
}

// ============================================================
// 3. Abonați
// ============================================================
function fetchSubs() {
  if (!SUBS_URL) return Promise.resolve([]);
  return fetch(SUBS_URL, { headers: { "Accept": "application/json" } })
    .then(function (r) { if (!r.ok) throw new Error("SUBS_URL HTTP " + r.status); return r.json(); })
    .then(function (j) {
      var arr = (j && (j.subs || j)) || [];
      // deduplifică după endpoint (rămâne cea mai nouă)
      var map = {};
      arr.forEach(function (s) {
        if (!s || !s.endpoint || !s.keys && (!s.p256dh || !s.auth)) { /* skip incomplet */ }
        var keys = s.keys || { p256dh: s.p256dh, auth: s.auth };
        if (!s.endpoint || !keys || !keys.p256dh || !keys.auth) return;
        var old = map[s.endpoint];
        if (!old || (+s.ts || 0) >= (+old.ts || 0)) map[s.endpoint] = { endpoint: s.endpoint, keys: keys, cls: s.cls || "", label: s.label || "", ts: s.ts || 0 };
      });
      return Object.keys(map).map(function (k) { return map[k]; });
    })
    .catch(function (e) { console.error("Eroare la citirea abonatilor:", e.message); return []; });
}

var webpush = null;
function wp() {
  if (!webpush) { webpush = require("web-push"); webpush.setVapidDetails(VAPID_CONTACT, VAPID_PUBLIC, process.env.VAPID_PRIVATE_KEY); }
  return webpush;
}

function sendAll(subs, payload) {
  var body = JSON.stringify(payload);
  var valid = subs;
  if (!process.env.VAPID_PRIVATE_KEY) { console.log("DRY-RUN (fără VAPID_PRIVATE_KEY) — mesaj:", body, "→ destinatari:", valid.length); return Promise.resolve(); }
  var sent = 0, dead = [];
  return valid.reduce(function (chain, sub) {
    return chain.then(function () {
      return wp().sendNotification(sub, body, { TTL: 12 * 3600 })
        .then(function () { sent++; })
        .catch(function (err) {
          var sc = err.statusCode || 0;
          if (sc === 404 || sc === 410) dead.push(sub.endpoint);
          else console.warn("Push failed", sc, err.message && err.message.slice(0, 120));
        });
    });
  }, Promise.resolve()).then(function () {
    console.log("Trimise:", sent, "/", valid.length, ", expirate închise:", dead.length);
    if (dead.length && SUBS_URL) {
      return dead.reduce(function (c, ep) {
        return c.then(function () {
          var fd = new URLSearchParams(); fd.set("mode", "off"); fd.set("endpoint", ep);
          return fetch(SUBS_URL, { method: "POST", body: fd }).catch(function () {});
        });
      }, Promise.resolve());
    }
  });
}

// ============================================================
// 4. Compunerea mesajelor
// ============================================================
function announcePayload() {
  var a = ANNOUNCEMENTS[0] || { title: "CSECTIC", text: "Aplicația a fost actualizată." };
  var text = String(a.text || "").replace(/\s+/g, " ").trim();
  if (text.length > 140) text = text.slice(0, 137) + "…";
  return { title: "📣 " + (a.title || "Anunț nou"), body: text, tag: "anunt", url: SITE_URL };
}

// memento clopoțel pentru un abonat cu clasă — sau null
function bellPayloadFor(sub, t) {
  if (t.dow > 4) return null;                     // weekend
  var list = lessonsFor(sub.cls, t.dow);
  if (!list.length) return null;
  var hits = [];
  list.forEach(function (l) {
    var h = parseInt(l[0], 10);
    var r = hourRange(h);
    var s = toMin(r[0]);
    if (s >= t.min && s < t.min + 8) hits.push({ h: h, r: r, code: l[1] });
  });
  if (!hits.length) return null;
  var names = hits.map(function (x) { return subjName(x.code); });
  var prev = null;
  if (hits.length === 1) {
    var h0 = hits[0].h;
    prev = list.find(function (l) { return parseInt(l[0], 10) === h0 - 1; });
  }
  var label = (prev ? ("Pauza se apropie — ") : "") + hits.map(function (x) { return hourRange(x.h)[0] + " " + subjName(x.code); }).join(" / ");
  return {
    title: hits.length > 1 ? "🔔 Clopoțel: " + hourRange(hits[0].h)[0] : "🔔 Clopoțel la " + hourRange(hits[0].h)[0],
    body: label,
    tag: "bell-" + sub.cls + "-" + hits[0].h,
    url: SITE_URL
  };
}

// programul de mâine (sau de luni, vineri/duminică seara) — sau null
function tomorrowPayloadFor(sub, t) {
  if (!(t.hh === 19 && t.mm <= 4)) return null;   // fereastra serii 19:00–19:04
  var cls = sub.cls;
  var day = t.dow + 1;                            // mâine
  if (t.dow === 4) {                              // vineri seara → weekend + program luni
    var mon = lessonsFor(cls, 0);
    return mon.length
      ? { title: "☕ Weekend odihnit!", body: "Luni ai " + mon.length + " ore" + firstLine(mon), tag: "tom-" + cls + "-lun", url: SITE_URL }
      : { title: "☕ Weekend odihnit!", body: "Luni nu ai ore. Vedem în aplicație!", tag: "tom-" + cls + "-lun", url: SITE_URL };
  }
  if (t.dow === 5) return null;                   // sâmbătă seara → nimic
  if (t.dow === 6) day = 0;                       // duminică seara → programul de luni
  var list = lessonsFor(cls, day);
  return list.length
    ? { title: "📖 Mâine (" + DAY_NAMES[day] + ") ai " + list.length + " ore", body: "Prima oră: " + subjName(firstCode(list)) + " la " + hourRange(list[0][0])[0], tag: "tom-" + cls + "-" + DAY_NAMES[day], url: SITE_URL }
    : { title: "📖 Mâine (" + DAY_NAMES[day] + ") nu ai ore", body: "Odihniți-vă! CSECTIC te așteaptă în aplicație.", tag: "tom-" + cls + "-empty", url: SITE_URL };
}
function firstCode(list) { return String((list[0] && list[0][1]) || "").split("/")[0]; }
function firstLine(list) { var r = hourRange(list[0][0]); return " — prima oră: " + subjName(firstCode(list)) + " la " + r[0]; }

// ============================================================
// 5. Rularea
// ============================================================
function run() {
  return fetchSubs().then(function (subs) {
    if (!subs.length) console.log("Nu există abonați încă (sau SUBS_URL nu e setat). Mode:", MODE);
    if (MODE === "announce") {
      console.log("→ ANUNȚ:", JSON.stringify(announcePayload()));
      return sendAll(subs, announcePayload());
    }
    if (MODE === "test") {
      return sendAll(subs, { title: "🔔 Notificare de probă CSECTIC", body: "Notificările funcționează! Vei primi anunțuri, memento clopoțel și programul de mâine.", tag: "test", url: SITE_URL });
    }
    // schedule
    var t = bucharestNow();
    console.log("Ora în România:", t.nowDate, "dow=" + t.dow, t.hh + ":" + (t.mm < 10 ? "0" : "") + t.mm);
    var msgs = [];
    subs.forEach(function (sub) {
      var p = tomorrowPayloadFor(sub, t);
      if (p) { msgs.push(["MÂINE", sub.cls, JSON.stringify(p)]); return sendAll([sub], p); }
      var b = bellPayloadFor(sub, t);
      if (b) { msgs.push(["CLOPOȚEL", sub.cls, JSON.stringify(b)]); return sendAll([sub], b); }
    });
    msgs.forEach(function (m) { console.log(m[0], m[1], m[2]); });
  });
}

run().then(function () { console.log("OK"); }).catch(function (e) {
  console.error("Eroare fatală:", e && (e.stack || e.message || e));
  process.exitCode = 1;
});

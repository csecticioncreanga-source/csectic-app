#!/usr/bin/env node
/* CSECTIC — notificări web push (gratuit: GitHub Actions + web-push/VAPID).
 *
 * MOD (NOTIFY_MODE):
 *   schedule — rulat în buclă la 5 min. Trimite ce e scadent ACUM:
 *                • dimineața „Bună dimineața! CSECTIC îți urează o zi frumoasă!”
 *                • la fiecare pauză (la :50) „Urmează ora N: Materia la HH:MM”
 *                • seara programul complet de mâine, cu orele
 *   announce — commit pe data.js/timetable_*.js → „Anunț nou”
 *   test     — notificare de probă
 *
 * De ce buclă: cronul GitHub e tăiat agresiv (câteva rulări/zi, la ore
 * aleatorii), iar ferestrele de 5–10 min erau ratate → o notificare pe
 * săptămână. Jobul de acum rulează ~5 ore și verifică la fiecare 5 minute.
 *
 * Stare anti-duplicat: JSON pe branch-ul „notify-state” (API), deci fiecare
 * mesaj pleacă exact o dată, oricâte rulări s-ar suprapune.
 *
 * Testare: NOTIFY_NOW=2026-11-10T19:02 (oră RO simulată), NOTIFY_DRY=1 (nu trimite).
 */
"use strict";

const fs = require("fs");
const path = require("path");
const vm = require("vm");

const ROOT = path.join(__dirname, "..");
const SITE_URL = "https://csecticioncreanga-source.github.io/csectic-app/";
const VAPID_PUBLIC = "BJ54D-SD-PrrYbrFD7NIKRFOR-tBAK6hHmzlnSYUqqOMOozSiKxrBdAqN3-JFzDhSTMjEaA5c39et4pHRNpGt80";
const VAPID_CONTACT = "mailto:contact@example.com";

const MODE = process.env.NOTIFY_MODE || "schedule";
const SUBS_URL = process.env.SUBS_URL || "";
const PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || "";
const DRY = process.env.NOTIFY_DRY === "1";
const GH_TOKEN = process.env.GITHUB_TOKEN || process.env.GH_TOKEN || "";
const REPO = process.env.GITHUB_REPOSITORY || "csecticioncreanga-source/csectic-app";
const STATE_BRANCH = process.env.STATE_BRANCH || "notify-state";
const STATE_PATH = "notify-state.json";
const LOCAL_STATE = path.join(__dirname, "notify-state.local.json");

const DAYS = ["Luni", "Marți", "Miercuri", "Joi", "Vineri"];
const HELLO = "CSECTIC îți urează o zi frumoasă!";

// ---------- datele aplicației ----------
function loadData() {
  const files = ["data.js"];
  for (let i = 1; i <= 6; i++) files.push("timetable_" + i + ".js");
  let src = files.map((f) => fs.readFileSync(path.join(ROOT, f), "utf8")).join("\n;\n");
  src += ";\n__OUT={SUBJECT_PREFIXES,SUBJECTS,BELLS,TIMETABLE,ANNOUNCEMENTS};";
  const box = { __OUT: null };
  vm.createContext(box);
  vm.runInContext(src, box);
  return box.__OUT;
}
const DATA = loadData();
const TT = DATA.TIMETABLE || {};
const BELLS = DATA.BELLS || {};
const ANNOUNCEMENTS = DATA.ANNOUNCEMENTS || [];
const SUBJECTS = DATA.SUBJECTS || {};
const PREFIXES = DATA.SUBJECT_PREFIXES || {};

// ---------- ajutoare ----------
function subjName(code) {
  const c = String(code || "").trim();
  if (SUBJECTS[c]) return SUBJECTS[c];
  const m = c.match(/^[A-ZĂÂÎȘȚ]+/);
  if (m && PREFIXES[m[0]]) return PREFIXES[m[0]];
  return c;
}
function subjectOf(entry) {
  const raw = String((entry && entry[1]) || "").trim();
  return subjName(SUBJECTS[raw] ? raw : raw.split("/")[0].trim());
}
function toMin(hhmm) { const p = String(hhmm).split(":"); return (+p[0]) * 60 + (+p[1]); }
function bells(h) {
  if (BELLS[h]) return BELLS[h];
  const hh = String(h).padStart(2, "0");
  return [hh + ":00", hh + ":50"];
}
const startOf = (e) => bells(e[0])[0];
const endOf = (e) => bells(e[0])[1];

function nowRO() {
  const m = String(process.env.NOTIFY_NOW || "").match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/);
  if (m) {
    const dow = (new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], 12)).getUTCDay() + 6) % 7;
    return { dow, hh: +m[4], mm: +m[5], min: +m[4] * 60 + +m[5], iso: m[1] + "-" + m[2] + "-" + m[3] };
  }
  const p = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Bucharest", hour12: false,
    weekday: "short", hour: "2-digit", minute: "2-digit",
    year: "numeric", month: "2-digit", day: "2-digit"
  }).formatToParts(new Date());
  const g = (t) => { for (const x of p) if (x.type === t) return x.value; return ""; };
  const wd = { Mon: 0, Tue: 1, Wed: 2, Thu: 3, Fri: 4, Sat: 5, Sun: 6 };
  let hh = parseInt(g("hour"), 10); if (hh === 24) hh = 0;
  const mm = parseInt(g("minute"), 10);
  return { dow: wd[g("weekday")], hh, mm, min: hh * 60 + mm, iso: g("year") + "-" + g("month") + "-" + g("day") };
}

function lessonsFor(cls, day) {
  const row = TT[cls];
  if (!row) return [];
  const list = row[day] || row[String(day)] || [];
  const seen = {};
  return list.filter((e) => {
    const s = startOf(e);
    if (seen[s]) return false;
    seen[s] = true;
    return true;
  }).sort((a, b) => toMin(startOf(a)) - toMin(startOf(b)));
}

// ---------- abonați ----------
async function fetchSubs() {
  if (!SUBS_URL) return [];
  try {
    const r = await fetch(SUBS_URL, { headers: { Accept: "application/json" } });
    if (!r.ok) throw new Error("HTTP " + r.status);
    const j = await r.json();
    const arr = (j && (j.subs || j)) || [];
    const map = {};
    for (const s of arr) {
      if (!s || !s.endpoint) continue;
      const k = s.keys || { p256dh: s.p256dh, auth: s.auth };
      if (!k || !k.p256dh || !k.auth) continue;
      const old = map[s.endpoint];
      if (!old || (+s.ts || 0) >= (+old.ts || 0)) {
        map[s.endpoint] = { endpoint: s.endpoint, keys: k, cls: String(s.cls || "").trim() };
      }
    }
    return Object.values(map);
  } catch (e) {
    console.error("Eroare abonați:", e.message);
    return [];
  }
}

// ---------- stare anti-duplicat ----------
const state = { marks: {}, sha: null, local: !GH_TOKEN };

async function gh(method, url, body) {
  const res = await fetch("https://api.github.com" + url, {
    method,
    headers: {
      Authorization: "Bearer " + GH_TOKEN,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "Content-Type": "application/json",
      "User-Agent": "csectic-notify"
    },
    body: body ? JSON.stringify(body) : undefined
  });
  const txt = await res.text();
  let json = null;
  try { json = txt ? JSON.parse(txt) : null; } catch (_) {}
  if (!res.ok) {
    const err = new Error(method + " " + url + " → " + res.status + " " + txt.slice(0, 180));
    err.status = res.status;
    throw err;
  }
  return json;
}

async function ensureBranch() {
  try { await gh("GET", "/repos/" + REPO + "/git/ref/heads/" + STATE_BRANCH); return; }
  catch (e) { if (e.status !== 404) throw e; }
  const info = await gh("GET", "/repos/" + REPO);
  const base = await gh("GET", "/repos/" + REPO + "/git/ref/heads/" + info.default_branch);
  await gh("POST", "/repos/" + REPO + "/git/refs", { ref: "refs/heads/" + STATE_BRANCH, sha: base.object.sha });
  console.log("branch de stare creat:", STATE_BRANCH);
}

async function stateLoad() {
  if (!GH_TOKEN) {
    try { state.marks = JSON.parse(fs.readFileSync(LOCAL_STATE, "utf8")).marks || {}; } catch (_) {}
    return;
  }
  try {
    await ensureBranch();
    const f = await gh("GET", "/repos/" + REPO + "/contents/" + STATE_PATH + "?ref=" + STATE_BRANCH);
    state.sha = f.sha;
    state.marks = JSON.parse(Buffer.from(f.content || "", "base64").toString("utf8")).marks || {};
  } catch (e) { console.warn("stare necitită:", e.message); }
}

async function stateSave() {
  const cut = new Date(Date.now() - 3 * 86400000).toISOString().slice(0, 10);
  for (const k of Object.keys(state.marks)) {
    if ((String(k).split("|")[1] || "") < cut) delete state.marks[k];
  }
  if (!GH_TOKEN) {
    try { fs.writeFileSync(LOCAL_STATE, JSON.stringify({ marks: state.marks })); } catch (_) {}
    return;
  }
  const body = {
    message: "notificari: stare",
    content: Buffer.from(JSON.stringify({ updated: new Date().toISOString(), marks: state.marks })).toString("base64"),
    branch: STATE_BRANCH
  };
  if (state.sha) body.sha = state.sha;
  try {
    state.sha = (await gh("PUT", "/repos/" + REPO + "/contents/" + STATE_PATH, body)).content.sha;
  } catch (e) {
    console.warn("stare nesalvată:", e.message);
  }
}

// ---------- trimitere ----------
let wpLib = null;
function wp() {
  if (!wpLib) {
    wpLib = require("web-push");
    wpLib.setVapidDetails(VAPID_CONTACT, VAPID_PUBLIC, PRIVATE_KEY);
  }
  return wpLib;
}

async function sendAll(subs, payload) {
  if (!subs.length) return 0;
  if (!PRIVATE_KEY || DRY) {
    console.log("   [dry-run] " + payload.title + " — " + payload.body);
    return 0;
  }
  const body = JSON.stringify(payload);
  let sent = 0;
  const dead = [];
  for (const s of subs) {
    try { await wp().sendNotification(s, body, { TTL: 6 * 3600 }); sent++; }
    catch (err) {
      const sc = err.statusCode || 0;
      if (sc === 404 || sc === 410) dead.push(s.endpoint);
      else console.warn("   push eșuat", sc, (err.message || "").slice(0, 100));
    }
  }
  for (const ep of dead) {
    try {
      const fd = new URLSearchParams({ mode: "off", endpoint: ep });
      await fetch(SUBS_URL, { method: "POST", body: fd });
    } catch (_) {}
  }
  if (dead.length) console.log("   abonamente expirate șterse:", dead.length);
  return sent;
}

// ---------- mesaje ----------
function morning(cls, t) {
  const list = lessonsFor(cls, t.dow);
  const body = list.length
    ? HELLO + " Astăzi ai " + list.length + (list.length === 1 ? " oră" : " ore") +
      " — prima: " + subjectOf(list[0]) + " la " + startOf(list[0]) + "."
    : HELLO + " Astăzi nu ai ore — bucură-te de zi!";
  return { title: "🌅 Bună dimineața!", body, tag: "mor-" + t.iso, url: SITE_URL };
}

function breaks(cls, t) {
  const list = lessonsFor(cls, t.dow);
  const out = [];
  for (let i = 0; i < list.length; i++) {
    const endMin = toMin(endOf(list[i]));
    let next = null, idx = -1;
    for (let j = 0; j < list.length; j++) {
      if (toMin(startOf(list[j])) > endMin) { next = list[j]; idx = j; break; }
    }
    if (!next) continue;
    const when = startOf(next);
    const gap = toMin(when) - endMin;
    const subj = subjectOf(next);
    const body = gap <= 15
      ? "Urmează ora " + (idx + 1) + ": " + subj + " la " + when + ". Pauză de " + gap + " minute."
      : "Pauză lungă (" + gap + " min). Următoarea oră: " + subj + " la " + when + ".";
    out.push({
      at: endMin,
      key: cls + "|" + t.iso + "|brk-" + when.replace(":", ""),
      payload: {
        title: "⏰ Pauză — la " + when + " începe " + subj,
        body,
        tag: "brk-" + t.iso + "-" + when.replace(":", ""),
        url: SITE_URL
      }
    });
  }
  return out;
}

function evening(cls, t) {
  if (t.dow === 5) return null;
  let target, title;
  if (t.dow === 4) { target = 0; title = "☕ Weekend! Luni"; }
  else if (t.dow === 6) { target = 0; title = "📖 Mâine (Luni)"; }
  else { target = t.dow + 1; title = "📖 Mâine (" + DAYS[target] + ")"; }
  const list = lessonsFor(cls, target);
  if (!list.length) {
    return { title: title + " — nu ai ore", body: "Mâine nu ai ore. CSECTIC îți urează o zi liniștită!", tag: "tom-" + t.iso, url: SITE_URL };
  }
  const body = list.map((l, i) => (i + 1) + ". " + startOf(l) + " " + subjectOf(l)).join(" • ");
  return { title: title + " — " + list.length + (list.length === 1 ? " oră" : " ore"), body, tag: "tom-" + t.iso, url: SITE_URL };
}

function dueFor(sub, t) {
  const cls = sub.cls;
  const out = [];
  if (!cls || !TT[cls]) return out;

  if (t.dow <= 4 && t.min >= 410 && t.min < 630) {                       // 06:50–10:30
    out.push({ at: 410, key: cls + "|" + t.iso + "|morning", payload: morning(cls, t) });
  }
  if (t.dow <= 5) {
    for (const b of breaks(cls, t)) if (t.min >= b.at && t.min < b.at + 12) out.push(b);
  }
  const list = lessonsFor(cls, t.dow);
  const from = Math.max(1140, list.length ? toMin(endOf(list[list.length - 1])) + 5 : 0);  // 19:00
  if (t.min >= from && t.min <= 1350) {                                  // până la 22:30
    const p = evening(cls, t);
    if (p) out.push({ at: from, key: cls + "|" + t.iso + "|tom", payload: p });
  }
  return out;
}

// ---------- rulare ----------
function announce() {
  const a = ANNOUNCEMENTS[0] || { title: "CSECTIC", text: "Aplicația a fost actualizată." };
  let text = String(a.text || "").replace(/\s+/g, " ").trim();
  if (text.length > 140) text = text.slice(0, 137) + "…";
  return { title: "📣 " + (a.title || "Anunț nou"), body: text, tag: "anunt", url: SITE_URL };
}

async function scheduleFlow(subs, t) {
  const stamp = t.iso + " " + String(t.hh).padStart(2, "0") + ":" + String(t.mm).padStart(2, "0");
  const plan = [];
  const byKey = {};
  for (const sub of subs) {
    for (const it of dueFor(sub, t)) {
      let e = byKey[it.key];
      if (!e) { e = byKey[it.key] = { key: it.key, at: it.at || 0, payload: it.payload, subs: [] }; plan.push(e); }
      if (!e.subs.includes(sub)) e.subs.push(sub);
    }
  }
  const todo = plan.filter((e) => !state.marks[e.key]).sort((a, b) => a.at - b.at);
  if (!todo.length) {
    console.log("[" + stamp + "] nimic de trimis (" + plan.length + " candidate)");
    return;
  }
  for (const job of todo) {
    console.log("[" + stamp + "] → " + job.payload.title + " | " + job.payload.body + " | " + job.subs.length + " abonați");
    const sent = await sendAll(job.subs, job.payload);
    if (PRIVATE_KEY && !DRY && sent > 0) {
      state.marks[job.key] = new Date().toISOString();
      await stateSave();
    }
  }
}

async function run() {
  const subs = await fetchSubs();
  if (!subs.length) { console.log("Fără abonați (sau SUBS_URL lipsește). Mod:", MODE); return; }
  if (MODE === "announce") {
    const p = announce();
    console.log("→ ANUNȚ:", p.title, "|", p.body);
    console.log("trimis:", await sendAll(subs, p), "/", subs.length);
    return;
  }
  if (MODE === "test") {
    const p = {
      title: "🔔 Notificare de probă CSECTIC",
      body: "De acum primești: salut dimineața, memento la fiecare pauză (la :50) și programul complet de mâine, seara.",
      tag: "test", url: SITE_URL
    };
    console.log("trimis:", await sendAll(subs, p), "/", subs.length);
    return;
  }
  await stateLoad();
  console.log("marcaje în stare:", Object.keys(state.marks).length, state.local ? "(fișier local)" : "");
  await scheduleFlow(subs, nowRO());
}

run().then(() => console.log("OK")).catch((e) => {
  console.error("Eroare fatală:", e && (e.stack || e.message || e));
  process.exitCode = 1;
});

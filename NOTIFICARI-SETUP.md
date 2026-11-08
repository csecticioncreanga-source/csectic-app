# 🔔 Notificările CSECTIC — cum funcționează (100% gratuit)

Totul rulează pe **GitHub Actions** (repo public = minute nelimitate, 0 lei) plus
lista de abonați ținută într-un **Google Sheet** printr-un Apps Script. Nu există
server plătit, cont pentru elevi sau chei de cumpărat.

---

## Ce primește fiecare elev

| Notificare | Când | Exemplu |
|---|---|---|
| 🌅 Bună dimineața | luni–vineri, între 06:50 și 10:30 | „CSECTIC îți urează o zi frumoasă! Astăzi ai 7 ore — prima: Franceză la 08:00.” |
| ⏰ Pauză | la fiecare sunet de **:50**, pentru fiecare pauză | „Pauză — la 09:00 începe Matematică · Urmează ora 2: Matematică la 09:00. Pauză de 10 minute.” |
| 📖 Programul de mâine | seara, de la 19:00 (după ultima oră, pentru seral) până la 22:30 | „Mâine (Miercuri) — 6 ore · 1. 08:00 Română • 2. 09:00 Română • 3. 10:00 Franceză …” |
| ☕ Weekend | vineri seara | „Weekend! Luni — 6 ore · 1. 08:00 …” |
| 📣 Anunț nou | imediat după ce se modifică `data.js` / `timetable_*.js` | „Semestrul II — vacanță…” |

Mesajele sunt calculate **pe clasa fiecărui abonat** (`cls` din Sheet), deci fiecare
elev primește exact orarul lui. Sâmbăta și duminica nu se trimite nimic în afara
salutului de seară pentru luni.

---

## De ce merge acum (și de ce nu mergea înainte)

Cronul GitHub Actions este „best effort”: pe conturi noi dă **doar câteva rulări pe
zi, la ore aleatorii** (am numărat ~12/zi). Ferestrele de trimitere sunt de 10–30 de
minute, așa că aproape toate cădeau în gol → **o notificare pe săptămână**.

Acum workflow-ul `Notificări` **nu mai depinde de momentul în care pornește**:

1. Un job rulează **~5 ore** și verifică la fiecare **5 minute** (60 de pași).
2. Cât timp rulează, GitHub ține următorul rulaj în așteptare, care pornește imediat
după el → acoperire continuă, la fix, fără costuri.
3. Fiecare mesaj are o **cheie de stare** (`clasa | data | tip`) salvată în fișierul
`notify-state.json` de pe branch-ul `notify-state`. Așa un mesaj pleacă **exact o
dată**, oricâte rulări s-ar suprapune sau ar reporni.

---

## Cum verifici / testezi

GitHub → **Actions → Notificări → Run workflow**:

- `mode: test` → trimite o notificare de probă tuturor (fără să atingă starea).
- `mode: schedule` + `now: 2026-11-10T19:02` + `dry: 1` → **simulează** ora de România
indicată și doar afișează în log ce s-ar trimite (util pentru „cum arată mesajul de
la 19:00?”).
- `mode: schedule` (fără `now`, fără `dry`) → pornește bucla reală de 5 ore.

În log, fiecare pas apare ca `[2026-11-10 19:02] → 📖 Mâine (Miercuri) … | 4 abonați`.

---

## Dacă un elev nu primește notificări

1. Aplicația trebuie **adăugată pe ecranul principal** (iPhone: Safari → Partajare →
„Adaugă la ecranul principal”; Android: Chrome → meniu → „Instalează aplicația”).
2. În aplicație, bannerul 🔔 trebuie să fie pe **„Notificări active”** (butonul
„Activează”). Dacă a refuzat permisiunea, o deblochează din setările browserului.
3. Abonamentul se salvează în Sheet (`subs`). Abonamentele expirate (404/410) sunt
șterse automat la următoarea trimitere.

## Fișiere implicate

- `.github/workflows/notificari.yml` — bucla de 5 minute și ieșirile de test.
- `scripts/notify.js` — calculează și trimite mesajele (web-push + VAPID).
- `notifications.js` — bannerul din aplicație și abonarea (POST către Apps Script).
- `sw.js` — service worker-ul care afișează notificarea.
- `apps-script.apps` — codul din Google Sheet (lista de abonați). Nu mai e nevoie de
trigger sau de PAT: GitHub Actions se întreține singur.

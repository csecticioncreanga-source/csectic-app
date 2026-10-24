# 🔔 Configurarea notificărilor CSECTIC — 100% gratuit

Tot sistemul folosește doar ce e **gratuit pentru totdeauna**:
- **GitHub Actions** — rulează cronul și trimite mesajele (web-push cu chei VAPID)
- **Google Sheets + Apps Script** — ține lista de abonați (fără server, fără plăți)
- **iOS 16.4+** — notificările merg numai pentru aplicația adăugată pe ecranul principal (Home Screen)

---

## Pașii (o singură dată, ~5 minute)

### 1. Creează tabelul care ține abonații
1. Deschide [sheets.new](https://sheets.new) și denumește fișierul `CSECTIC notificari`.
2. Sus: **Extensii → Apps Script**.
3. Șterge tot ce e în editor și lipește tot conținutul fișierului [apps-script.apps](apps-script.apps) din acest repo.
4. Apasă **Deploy → New deployment**, la gear alege **Web app**:
   - Descriere: `CSECTIC notifications`
   - Execute as: **me**
   - Who has access: **Anyone**
5. Apasă **Deploy**, autorizează când cere (Google îți va cere permisiunea Apps Script).
6. Copiază **Web app URL** (se termină în `/exec`).

### 2. Trimite-mi URL-ul
Dă-i URL-ul tău `/exec` în chat — **eu** pun:
- `SUBMIT_URL` → `notifications.js` (clientul trimite abonațiile acolo)
- `SUBS_URL` → secretul GitHub `SUBS_URL` (Actions citesc abonații)

### 3. Cheia privată VAPID
- E deja în fișierul **local** `vapid-keys-local.txt` (nu intră în repo).
- Trebuie să ajungă în secretul GitHub `VAPID_PRIVATE_KEY` (GitHub → Settings → Secrets and variables → Actions → New repository secret). Poți să-mi dai OK să-l setez eu prin API, dacă îl poți citi din fișierul tău local.

### 4. Testă
1. GitHub → **Actions → Notificări → Run workflow** → mode `test` → Run.
2. Pe telefon (iOS 16.4+, aplicația pe Home Screen) sau Android/Chrome apare „🔔 Notificare de probă CSECTIC”.

---

## Ce primesc elevii
Notificarea | Când | Exemplu
---|---|---
📣 Anunț nou | imediat după ce actualizezi `data.js` | „Semestre II — vacanță…”
📖 Programul de mâine | în fiecare seară la 19:00 (România) | „Mâine (Marți) ai 6 ore — prima la 08:00”
☕ Weekend | vineri seara | „Weekend odihnit! Luni ai 6 ore — prima oră…”
🔔 Memento clopoțel | cu puțin înainte de fiecare oră | „Clopoțel la 10:00 — Biologie”

## Note tehnice
- cronul GitHub Actions rulează din 5 în 5 minute, cu posibil **delay de până la ~15 min** la ore de vârf — mesajele pot ajunge cu o întârziere mică; e limitarea planului gratuit.
- Abonații vechi mori se curăță automat (410/404 dezabonate din tabel).
- Nu depune niciodată `vapid-keys-local.txt` în repo (e deja `.gitignore`).

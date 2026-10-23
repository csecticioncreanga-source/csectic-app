### 1. `index.html` — adăugat:
- `<link rel="manifest" href="manifest.json">` după `<title>`, înainte de CSS.

### 2. `manifest.json` — creat nou:
- `display: standalone`, `orientation: portrait`, `background_color: #141414`, `theme_color: #141414`.
- Doi iconiță din `assets/logo_opt.png`: `assets/logo_192.png` și `assets/logo_512.png`.

### 3. `app.js` — modificat:
- Blocare PWA prompt până la selectare clasă:
  - `beforeinstallprompt` este preîntâmpinat ( `e.preventDefault()` ) când `state.cls` nu e setat.
  - Promisul e memorat în `_installPrompt` și e eliberat (`prompt()`) imediat după `saveClass(c.id)` în onboarding, înainte de `showMain()`.
- Asta face ca aplicația să apară "instalată" doar după ce elevul a trecut de onboard.

### 4. Imaginile:
- `assets/logo_192.png` și `assets/logo_512.png` regenerate din `assets/logo_opt.png` cu `sips`.
- `assets/logo_opt.png` e intact (1000×1000, ~93 KB).

Ca să testezi, pornesc serverul local pe port 8123 (`python -m http.server 8123` din `Desktop/app cse`) și îl regăsesc în preview — la fel ca înainte. Să-mi spui:
- vrei preview pe browser normal (Chrome / Safari desktop) pentru a verifica că promptul e blocat până la onboard,
- sau direct pe telefon (adică îți trimit link-ul și tu îl deschizi în Safari pe iOS) pentru a vedea comportamentul real pe homescreen?

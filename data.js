// ==========================================================
//  DATELE APLICAȚIEI
//  - ORARUL vine din fișierul orar.xlsx (toate clasele, toate orele).
//    Materiile apar deocamdată ca inițiale/coduri (ex. M6, R6, FR3).
//  - Anunțurile, activitățile și proiectele de mai jos sunt DATE DE PROBĂ.
// ==========================================================

// Numele complete ale materiilor, în două etape:
//  1) SUBJECT_PREFIXES — literele din fața codului dau materia, indiferent de cifra
//     de la final: ex. B1, B2, B3, B4 = Biologie;  EN1, EN2, EN3 = Engleză.
//     Coduri exacte câștigă mereu: dacă un cod e și în SUBJECTS, se folosește SUBJECTS.
//  2) SUBJECTS — nume complete pentru coduri cu nume propriu sau combinații,
//     ex. "DES/MUZ": "Desen / Muzică".
//     Un cod care nu se potrivește nicăieri rămâne afișat cum a venit din Excel.
const SUBJECT_PREFIXES = {
  B: "Biologie",
  EN: "Engleză",
  RE: "Religie",
  FR: "Franceză",
  M: "Matematică",
  I: "Informatică",
  IS: "Istorie",
  G: "Geografie",
  R: "Română",
  S: "Sport",
  F: "Fizică"
};
const SUBJECTS = {};

// Orele de sunet: ora de început (7..19) -> [început, sfârșit]
const BELLS = {
  7: ["07:00", "07:50"],
  8: ["08:00", "08:50"],
  9: ["09:00", "09:50"],
  10: ["10:00", "10:50"],
  11: ["11:00", "11:50"],
  12: ["12:00", "12:50"],
  13: ["13:00", "13:50"],
  14: ["14:00", "14:50"],
  15: ["15:00", "15:50"],
  16: ["16:00", "16:50"],
  17: ["17:00", "17:50"],
  18: ["18:00", "18:50"],
  19: ["19:00", "19:50"]
};

// Clasele, grupate în patru categorii pentru selector: categorie -> an -> clasa,
// exact ca în orar.xlsx: V-VIII general, clasa simpla cu litera liceal, "prof" profesional, "seral" seral.
const CATEGORIES = [
  {
    id: "general", label: "Învățământ General",
    YEARS: [
      { id: "V", label: "A V-a", classes: [{ id: "V A", label: "A V-a A" }] },
      { id: "VI", label: "A VI-a", classes: [{ id: "VI A", label: "A VI-a A" }, { id: "VI B", label: "A VI-a B" }] },
      { id: "VII", label: "A VII-a", classes: [{ id: "VII A", label: "A VII-a A" }] },
      { id: "VIII", label: "A VIII-a", classes: [{ id: "VIII A", label: "A VIII-a A" }, { id: "VIII B", label: "A VIII-a B" }] }
    ]
  },
  {
    id: "liceal", label: "Învățământ Liceal",
    YEARS: [
      { id: "IX", label: "A IX-a", classes: [{ id: "IX A", label: "A IX-a A" }, { id: "IX B", label: "A IX-a B" }, { id: "IX C", label: "A IX-a C" }, { id: "IX D", label: "A IX-a D" }, { id: "IX E", label: "A IX-a E" }, { id: "IX F", label: "A IX-a F" }, { id: "IX G", label: "A IX-a G" }, { id: "IX H", label: "A IX-a H" }, { id: "IX I", label: "A IX-a I" }, { id: "IX J", label: "A IX-a J" }] },
      { id: "X", label: "A X-a", classes: [{ id: "X A", label: "A X-a A" }, { id: "X B", label: "A X-a B" }, { id: "X C", label: "A X-a C" }, { id: "X D", label: "A X-a D" }, { id: "X E", label: "A X-a E" }, { id: "X F", label: "A X-a F" }, { id: "X G", label: "A X-a G" }] },
      { id: "XI", label: "A XI-a", classes: [{ id: "XI A", label: "A XI-a A" }, { id: "XI B", label: "A XI-a B" }, { id: "XI C", label: "A XI-a C" }, { id: "XI D", label: "A XI-a D" }, { id: "XI E", label: "A XI-a E" }, { id: "XI F", label: "A XI-a F" }, { id: "XI G", label: "A XI-a G" }, { id: "XI H", label: "A XI-a H" }] },
      { id: "XII", label: "A XII-a", classes: [{ id: "XII A", label: "A XII-a A" }, { id: "XII B", label: "A XII-a B" }, { id: "XII C", label: "A XII-a C" }, { id: "XII D", label: "A XII-a D" }, { id: "XII E", label: "A XII-a E" }, { id: "XII F", label: "A XII-a F" }, { id: "XII G", label: "A XII-a G" }, { id: "XII H", label: "A XII-a H" }] }
    ]
  },
  {
    id: "profesional", label: "Învățământ Profesional",
    YEARS: [
      { id: "X", label: "A X-a", classes: [{ id: "X A prof", label: "A X-a A prof" }, { id: "X B prof", label: "A X-a B prof" }, { id: "X C prof", label: "A X-a C prof" }, { id: "X D prof/1", label: "A X-a D prof · grupa 1" }, { id: "X D prof/2", label: "A X-a D prof · grupa 2" }, { id: "X E prof", label: "A X-a E prof" }] },
      { id: "XI", label: "A XI-a", classes: [{ id: "XI A prof/1", label: "A XI-a A prof · grupa 1" }, { id: "XI A prof/2", label: "A XI-a A prof · grupa 2" }, { id: "XI B prof/1", label: "A XI-a B prof · grupa 1" }, { id: "XI B prof/2", label: "A XI-a B prof · grupa 2" }, { id: "XI C prof", label: "A XI-a C prof" }] }
    ]
  },
  {
    id: "seral", label: "Învățământ Seral",
    YEARS: [
      { id: "XII", label: "A XII-a", classes: [{ id: "XII seral", label: "A XII-a Seral" }] },
      { id: "XIII", label: "A XIII-a", classes: [{ id: "XIII seral", label: "A XIII-a Seral" }] }
    ]
  }
];

// Orarul: TIMETABLE[clasă][zi] = lista de ore [ora de început, cod materie]; zilele 0-4 = Luni-Vineri.
// E populat de timetable_1.js ... timetable_6.js (încărcate după data.js, înainte de app.js).
var TIMETABLE = {};

// Anunțurile (cel mai nou primul)
const ANNOUNCEMENTS = [
  {
    date: "n/a",
    title: "Anunț",
    text: "Deocamdata nu exista anunturi."
  }
];

// Activități
const ACTIVITIES = [

];

// Proiecte
const PROJECTS = [
  {
    title: "Lansarea aplicației CSECTIC",
    image: "assets/logo.png",
    text: "Aplicația a fost lansată pentru clasele școlii C.T.I.C.: orar digital, anunțuri și resurse într-un singur loc. Adăugați-vă clasa în prima deschidere și consultați orarul zilei direct de pe telefon."
  },
  {
    title: "Actualizarea imaginii vizuale a consiliului școlar al elevilor C.T.I.C",
    image: "assets/logo.png",
    text: "Actualizarea imaginii vizuale a consiliului școlar al elevilor C.T.I.C. pentru a reflecta activitățile realizate și pentru o prezentare coerentă a consilului."
  }
];
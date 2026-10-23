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
      { id: "P1", label: "Anul I", classes: [{ id: "P1 A", label: "Profesional I-a A" }] },
      { id: "P2", label: "Anul a II-a", classes: [{ id: "P2 A", label: "Profesional a II-a A" }] },
      { id: "P3", label: "Anul a III-a", classes: [{ id: "P3 A", label: "Profesional a III-a A" }] }
    ]
  },
  {
    id: "seral", label: "Învățământ Seral",
    YEARS: [
      { id: "S1", label: "Anul I", classes: [{ id: "S1 A", label: "Seral I-a A" }] },
      { id: "S2", label: "Anul a II-a", classes: [{ id: "S2 A", label: "Seral a II-a A" }] }
    ]
  }
];

const TIMETABLE_REAL = {
  "V A": {
    0: [[8,"M"], [9,"RO"], [10,"BIO"], [11,"ENG"], [12,"FR"], [13,"HIS"]],
    1: [[8,"M"], [9,"INF"], [10,"RO"], [11,"GEO"], [12,"BIO"], [13,"FR"]],
    2: [[8,"M"], [9,"BIO"], [10,"ENG"], [11,"RO"], [12,"SPT"], [13,"ART"]],
    3: [[8,"M"], [9,"RO"], [10,"HIS"], [11,"INF"], [12,"GEO"], [13,"ENG"]],
    4: [[8,"M"], [9,"FR"], [10,"SPT"], [11,"Muzică"], [12,"Desen"], [13,"RO"]],
  },
  "VI A": {
    0: [[8,"M"], [9,"RO"], [10,"GEO"], [11,"BIO"], [12,"FR"], [13,"IST"]],
    1: [[8,"M"], [9,"INF"], [10,"RO"], [11,"BIO"], [12,"SPT"], [13,"FR"]],
    2: [[8,"M"], [9,"GEO"], [10,"ENG"], [11,"RO"], [12,"ART"], [13,"HIST"]],
    3: [[8,"M"], [9,"M"], [10,"RO"], [11,"GEO"], [12,"INF"], [13,"ENG"]],
    4: [[8,"M"], [9,"FR"], [10,"SPT"], [11,"Muzică"], [12,"Desen"], [13,"RO"]],
  },
  "VI B": {
    0: [[8,"M"], [9,"RO"], [10,"BIO"], [11,"ENG"], [12,"FR"], [13,"IST"]],
    1: [[8,"M"], [9,"INF"], [10,"RO"], [11,"GEO"], [12,"BIO"], [13,"SPT"]],
    2: [[8,"M"], [9,"BIO"], [10,"ENG"], [11,"RO"], [12,"FR"], [13,"ART"]],
    3: [[8,"M"], [9,"RO"], [10,"HIST"], [11,"INF"], [12,"GEO"], [13,"ENG"]],
    4: [[8,"M"], [9,"FR"], [10,"SPT"], [11,"Muzică"], [12,"Desen"], [13,"RO"]],
  },
  "VII A": {
    0: [[8,"M"], [9,"RO"], [10,"GEO"], [11,"BIO"], [12,"FR"], [13,"IST"]],
    1: [[8,"M"], [9,"INF"], [10,"RO"], [11,"BIO"], [12,"SPT"], [13,"ENG"]],
    2: [[8,"M"], [9,"ENG"], [10,"FR"], [11,"RO"], [12,"GEO"], [13,"ART"]],
    3: [[8,"M"], [9,"M"], [10,"RO"], [11,"HIST"], [12,"INF"], [13,"ENG"]],
    4: [[8,"M"], [9,"FR"], [10,"SPT"], [11,"Muzică"], [12,"DES"], [13,"RO"]],
  },
  "VIII A": {
    0: [[8,"M"], [9,"RO"], [10,"BIO"], [11,"ENG"], [12,"FR"], [13,"IST"]],
    1: [[8,"M"], [9,"INF"], [10,"RO"], [11,"GEO"], [12,"BIO"], [13,"SPT"]],
    2: [[8,"M"], [9,"GEO"], [10,"ENG"], [11,"RO"], [12,"FR"], [13,"IST"]],
    3: [[8,"M"], [9,"M"], [10,"RO"], [11,"GEO"], [12,"INF"], [13,"ENG"]],
    4: [[8,"M"], [9,"FR"], [10,"SPT"], [11,"Muzică"], [12,"DES"], [13,"RO"]],
  },
  "VIII B": {
    0: [[8,"M"], [9,"RO"], [10,"GEO"], [11,"BIO"], [12,"ENG"], [13,"FR"]],
    1: [[8,"M"], [9,"INF"], [10,"RO"], [11,"BIO"], [12,"SPT"], [13,"IST"]],
    2: [[8,"M"], [9,"ENG"], [10,"FR"], [11,"RO"], [12,"GEO"], [13,"ART"]],
    3: [[8,"M"], [9,"M"], [10,"RO"], [11,"HIST"], [12,"INF"], [13,"ENG"]],
    4: [[8,"M"], [9,"FR"], [10,"SPT"], [11,"Muzică"], [12,"DES"], [13,"RO"]],
  },
  "IX A": {
    0: [[8,"M"], [9,"FR"], [10,"REL"], [11,"BIO"], [12,"M"], [13,"RO"]],
    1: [[8,"ENG"], [9,"SPT"], [10,"INF"], [11,"M"], [12,"FIZ"], [13,"BIO"]],
    2: [[8,"FIZ"], [9,"INF"], [10,"IST"], [11,"M"], [12,"MUZ/DES"], [13,"GEO"]],
    3: [[8,"BIO"], [9,"SPT"], [10,"M"], [11,"RO"], [12,"INF"], [13,"ENG"]],
    4: [[8,"M"], [9,"M"], [10,"RO"], [11,"RO"], [12,"FIZ"]],
  },
  "IX B": {
    0: [[8,"M"], [9,"FR"], [10,"REL"], [11,"BIO"], [12,"M"], [13,"RO"]],
    1: [[8,"ENG"], [9,"SPT"], [10,"INF"], [11,"M"], [12,"FIZ"], [13,"BIO"]],
    2: [[8,"FIZ"], [9,"INF"], [10,"IST"], [11,"M"], [12,"MUZ/DES"], [13,"GEO"]],
    3: [[8,"BIO"], [9,"SPT"], [10,"M"], [11,"RO"], [12,"INF"], [13,"ENG"]],
    4: [[8,"M"], [9,"M"], [10,"RO"], [11,"RO"], [12,"FIZ"]],
  },
  "X A": {
    0: [[8,"SPT"], [9,"FIZ"], [10,"M"], [11,"RO"], [12,"M"], [13,"INF"]],
    1: [[8,"SPT"], [9,"FR"], [10,"RO"], [11,"INF"], [12,"M"], [13,"M"]],
    2: [[8,"M"], [9,"M"], [10,"FIZ"], [11,"ENG"], [12,"MUZ/DES"], [13,"BIO"]],
    3: [[8,"RO"], [9,"M"], [10,"REL"], [11,"M"], [12,"BIO"], [13,"IST"]],
    4: [[8,"INF"], [9,"FR"], [10,"ENG"], [11,"FIZ"], [12,"GEO"]],
  },
  "X B": {
    0: [[8,"SPT"], [9,"FIZ"], [10,"M"], [11,"RO"], [12,"M"], [13,"INF"]],
    1: [[8,"SPT"], [9,"FR"], [10,"RO"], [11,"INF"], [12,"M"], [13,"M"]],
    2: [[8,"M"], [9,"M"], [10,"FIZ"], [11,"ENG"], [12,"MUZ/DES"], [13,"BIO"]],
    3: [[8,"RO"], [9,"M"], [10,"REL"], [11,"M"], [12,"BIO"], [13,"IST"]],
    4: [[8,"INF"], [9,"FR"], [10,"ENG"], [11,"FIZ"], [12,"GEO"]],
  },
  "XI A": {
    0: [[8,"IST"], [9,"BIO"], [10,"SPT"], [11,"M"]],
    1: [[8,"M"], [9,"M"], [10,"M"], [11,"ENG"], [12,"INF"], [13,"FR"]],
    2: [[8,"INF"], [9,"M"], [10,"M"], [11,"M"], [12,"IST"], [13,"ENG"]],
    3: [[8,"INF"], [9,"RO"], [10,"RO"], [11,"FR"], [12,"M"], [13,"M"]],
    4: [[8,"RO"], [9,"BIO"], [10,"REL"], [11,"GEO"], [12,"BIO"], [13,"M"]],
  },
  "XI B": {
    0: [[8,"IST"], [9,"BIO"], [10,"SPT"], [11,"M"]],
    1: [[8,"M"], [9,"M"], [10,"M"], [11,"ENG"], [12,"INF"], [13,"FR"]],
    2: [[8,"INF"], [9,"M"], [10,"M"], [11,"M"], [12,"IST"], [13,"ENG"]],
    3: [[8,"INF"], [9,"RO"], [10,"RO"], [11,"FR"], [12,"M"], [13,"M"]],
    4: [[8,"RO"], [9,"BIO"], [10,"REL"], [11,"GEO"], [12,"BIO"], [13,"M"]],
  },
  "XII A": {
    0: [[8,"M"], [9,"M"], [10,"FR"], [11,"RO"], [12,"IST"], [13,"M"]],
    1: [[8,"BIO"], [9,"BIO"], [10,"REL"], [11,"M"], [12,"ENG"], [13,"INF"]],
    2: [[8,"RO"], [9,"GEO"], [10,"BIO"], [11,"ENG"], [12,"INF"]],
    3: [[8,"M"], [9,"RO"], [10,"M"], [11,"M"], [12,"BIO"]],
    4: [[8,"M"], [9,"M"], [10,"SPT"], [11,"FR"], [12,"M"], [13,"IST"]],
  },
  "XII B": {
    0: [[8,"M"], [9,"M"], [10,"FR"], [11,"RO"], [12,"IST"], [13,"M"]],
    1: [[8,"BIO"], [9,"BIO"], [10,"REL"], [11,"M"], [12,"ENG"], [13,"INF"]],
    2: [[8,"RO"], [9,"GEO"], [10,"BIO"], [11,"ENG"], [12,"INF"]],
    3: [[8,"M"], [9,"RO"], [10,"M"], [11,"M"], [12,"BIO"]],
    4: [[8,"M"], [9,"M"], [10,"SPT"], [11,"FR"], [12,"M"], [13,"IST"]],
  },
};



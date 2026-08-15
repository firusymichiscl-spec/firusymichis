// Lista curada de principios activos y nombres comerciales frecuentes en
// veterinaria en Chile, mapeados a su CLASE farmacológica — nunca el uso
// clínico ("prednisona" sirve para muchas cosas distintas, pero su clase
// siempre es "corticoide"; el uso específico de una receta vive en las
// indicaciones del tratamiento, no acá).
//
// Deliberadamente conservadora: solo entradas donde la clase es de
// conocimiento farmacológico establecido y no ambigua. Esta lista NUNCA se
// completa con IA — ver guessDrugClass() más abajo: si el nombre del
// medicamento no matchea nada acá, el campo queda vacío. Una categoría
// equivocada en un contexto de salud es peor que no tener ninguna
// (Lote L2, Feature 5).
export const DRUG_CLASSES = {
  // ── Antibióticos ──────────────────────────────────────────────────
  "amoxicilina": "antibiótico",
  "clavulánico": "antibiótico", // amoxicilina + ác. clavulánico
  "cefalexina": "antibiótico",
  "cefadroxilo": "antibiótico",
  "cefovecina": "antibiótico",
  "enrofloxacino": "antibiótico",
  "enrofloxacina": "antibiótico",
  "marbofloxacino": "antibiótico",
  "ciprofloxacino": "antibiótico",
  "metronidazol": "antibiótico",
  "doxiciclina": "antibiótico",
  "clindamicina": "antibiótico",
  "azitromicina": "antibiótico",
  "ampicilina": "antibiótico",
  "gentamicina": "antibiótico",
  "tilosina": "antibiótico",
  "trimetoprima": "antibiótico",
  "sulfametoxazol": "antibiótico",
  "rilexine": "antibiótico",
  "baytril": "antibiótico",
  "convenia": "antibiótico",
  "rostrum": "antibiótico",

  // ── Corticoides ───────────────────────────────────────────────────
  "prednisona": "corticoide",
  "prednisolona": "corticoide",
  "dexametasona": "corticoide",
  "metilprednisolona": "corticoide",
  "betametasona": "corticoide",
  "triamcinolona": "corticoide",
  "hidrocortisona": "corticoide",

  // ── Antiinflamatorios no esteroidales (AINEs) ────────────────────
  "meloxicam": "antiinflamatorio",
  "carprofeno": "antiinflamatorio",
  "firocoxib": "antiinflamatorio",
  "ketoprofeno": "antiinflamatorio",
  "robenacoxib": "antiinflamatorio",
  "deracoxib": "antiinflamatorio",
  "metacam": "antiinflamatorio",
  "rimadyl": "antiinflamatorio",
  "previcox": "antiinflamatorio",
  "onsior": "antiinflamatorio", // robenacoxib

  // ── Antiparasitarios (internos y externos) ───────────────────────
  "fenbendazol": "antiparasitario",
  "praziquantel": "antiparasitario",
  "milbemicina": "antiparasitario",
  "pirantel": "antiparasitario",
  "febantel": "antiparasitario",
  "ivermectina": "antiparasitario",
  "moxidectina": "antiparasitario",
  "fluralaner": "antiparasitario",
  "afoxolaner": "antiparasitario",
  "selamectina": "antiparasitario",
  "sarolaner": "antiparasitario",
  "lotilaner": "antiparasitario",
  "fipronil": "antiparasitario",
  "imidacloprid": "antiparasitario",
  "permetrina": "antiparasitario",
  "nexgard": "antiparasitario",
  "bravecto": "antiparasitario",
  "simparica": "antiparasitario",
  "drontal": "antiparasitario",
  "milbemax": "antiparasitario",
  "frontline": "antiparasitario",
  "advantix": "antiparasitario",
  "advantage": "antiparasitario",
  "revolution": "antiparasitario",

  // ── Antihistamínicos ──────────────────────────────────────────────
  "clorfenamina": "antihistamínico",
  "clorfeniramina": "antihistamínico",
  "hidroxicina": "antihistamínico",
  "difenhidramina": "antihistamínico",
  "cetirizina": "antihistamínico",

  // ── Protectores gástricos ─────────────────────────────────────────
  "omeprazol": "protector gástrico",
  "famotidina": "protector gástrico",
  "sucralfato": "protector gástrico",
  "ranitidina": "protector gástrico",
  "losec": "protector gástrico",

  // ── Hormonales ────────────────────────────────────────────────────
  "levotiroxina": "hormonal",
  "trilostano": "hormonal",
  "vetoryl": "hormonal",
  "desmopresina": "hormonal",
  "metimazol": "antitiroideo",

  // ── Analgésicos ───────────────────────────────────────────────────
  "tramadol": "analgésico",
  "gabapentina": "analgésico",
  "buprenorfina": "analgésico",
  "metadona": "analgésico",
  "tramal": "analgésico",

  // ── Inmunomoduladores ─────────────────────────────────────────────
  "oclacitinib": "inmunomodulador",
  "apoquel": "inmunomodulador",
  "ciclosporina": "inmunomodulador",
  "atopica": "inmunomodulador",
  "lokivetmab": "inmunomodulador",
  "cytopoint": "inmunomodulador",

  // ── Suplementos ───────────────────────────────────────────────────
  "glucosamina": "suplemento",
  "condroitina": "suplemento",
  "condroitín": "suplemento",
  "omega 3": "suplemento",
  "omega3": "suplemento",
  "ácido hialurónico": "suplemento",
  "probiótico": "suplemento",
  "probióticos": "suplemento",

  // ── Antifúngicos ──────────────────────────────────────────────────
  "itraconazol": "antifúngico",
  "ketoconazol": "antifúngico",
  "fluconazol": "antifúngico",
  "griseofulvina": "antifúngico",
  "terbinafina": "antifúngico",

  // ── Cardiológicos ─────────────────────────────────────────────────
  "pimobendan": "inodilatador",
  "benazepril": "IECA",
  "enalapril": "IECA",
  "furosemida": "diurético",
  "espironolactona": "diurético",
  "digoxina": "digitálico",
  "atenolol": "betabloqueador",
  "sildenafil": "vasodilatador",

  // ── Antieméticos ──────────────────────────────────────────────────
  "maropitant": "antiemético",
  "cerenia": "antiemético",
  "ondansetrón": "antiemético",
  "metoclopramida": "antiemético",
};

// Quita tildes y pasa a minúsculas — el nombre real del medicamento puede
// venir con o sin acentos ("Enrofloxacino" / "enrofloxacina"), y las claves
// de arriba tampoco necesitan repetirse acentuadas/sin acentuar: normalize
// nivela ambos lados de la comparación.
const ACCENTS = { "á": "a", "é": "e", "í": "i", "ó": "o", "ú": "u", "ñ": "n", "ü": "u" };
function normalize(str) {
  return str.toLowerCase().replace(/[áéíóúñü]/g, (c) => ACCENTS[c]);
}

const NORMALIZED_ENTRIES = Object.entries(DRUG_CLASSES).map(([key, value]) => [normalize(key), value]);

// Búsqueda flexible: el nombre puede venir como "Prednisona 20 mg
// Comprimidos" — alcanza con que CONTENGA algún principio activo o nombre
// comercial conocido. Sin coincidencia → string vacío (nunca inventa).
export function guessDrugClass(medicationName) {
  if (!medicationName) return "";
  const normalized = normalize(medicationName);
  const match = NORMALIZED_ENTRIES.find(([key]) => normalized.includes(key));
  return match ? match[1] : "";
}

// Tipos exactos que ofrece el dropdown de "Tipo de mascota" cuando
// species === "other" (Fix 8). value = lo que se guarda en pets.breed.
export const OTHER_PET_TYPES = [
  { value: "Conejo enano", icon: "🐰", maxAgeYears: 15 },
  { value: "Hámster sirio", icon: "🐹", maxAgeYears: 5 },
  { value: "Cobaya", icon: "🐹", maxAgeYears: 10 },
  { value: "Chinchilla", icon: "🐭", maxAgeYears: 20 },
  { value: "Hurón", icon: "🦡", maxAgeYears: 12 },
  { value: "Tortuga", icon: "🐢", maxAgeYears: 20 },
  { value: "Loro", icon: "🦜", maxAgeYears: 80 },
  { value: "Canario", icon: "🐦", maxAgeYears: 20 },
  { value: "Periquito", icon: "🐦", maxAgeYears: 20 },
  { value: "Iguana", icon: "🦎", maxAgeYears: 20 },
];

// Respaldo por palabra clave, solo para fichas viejas cuya raza se
// escribió libre antes de que existiera el dropdown de arriba.
const KEYWORD_FALLBACK = [
  { kw: "tortuga", icon: "🐢", maxAgeYears: 20 },
  { kw: "loro", icon: "🦜", maxAgeYears: 80 },
  { kw: "canario", icon: "🐦", maxAgeYears: 20 },
  { kw: "periquito", icon: "🐦", maxAgeYears: 20 },
  { kw: "chinchilla", icon: "🐭", maxAgeYears: 20 },
  { kw: "huron", icon: "🦡", maxAgeYears: 12 },
  { kw: "cobaya", icon: "🐹", maxAgeYears: 10 },
  { kw: "hamster", icon: "🐹", maxAgeYears: 5 },
  { kw: "conejo", icon: "🐰", maxAgeYears: 15 },
  { kw: "iguana", icon: "🦎", maxAgeYears: 20 },
];

const DEFAULT_OTHER = { icon: "🐾", maxAgeYears: 15 };

const stripAccents = (s) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

// Único punto de verdad: primero intenta match exacto contra el dropdown
// (fichas nuevas), y si no calza cae a palabra clave sobre texto libre
// (fichas viejas). Nunca lanza, siempre devuelve algo usable.
export function classifyOtherPet(breed) {
  if (!breed) return DEFAULT_OTHER;
  const exact = OTHER_PET_TYPES.find(t => t.value === breed);
  if (exact) return { icon: exact.icon, maxAgeYears: exact.maxAgeYears };
  const norm = stripAccents(breed);
  const kw = KEYWORD_FALLBACK.find(k => norm.includes(stripAccents(k.kw)));
  return kw ? { icon: kw.icon, maxAgeYears: kw.maxAgeYears } : DEFAULT_OTHER;
}

// Ícono final para cualquier mascota — reemplaza los condicionales
// "species === 'other' ? 🐰 : 🐶" repetidos por el proyecto.
export function getPetIcon(species, breed) {
  if (species === "cat") return "🐱";
  if (species === "dog") return "🐶";
  return classifyOtherPet(breed).icon;
}

// Edad máxima en años para validar fecha de nacimiento (Fix 6).
export function getMaxAgeYears(species, breed) {
  if (species === "dog" || species === "cat") return 15;
  return classifyOtherPet(breed).maxAgeYears;
}

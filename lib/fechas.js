// Utilidades de formato de fecha en español chileno (dd/mm/yyyy).
//
// Para fechas puras "YYYY-MM-DD" (columnas DATE de Postgres) se parsean los
// componentes a mano y NUNCA se usa `new Date(string)`: JS interpreta ese
// formato como medianoche UTC, y en Chile (UTC-4/-3) el resultado local cae
// un día antes. Mismo enfoque que el cálculo de cumpleaños en DashboardClient.jsx.
// Para timestamptz sí se usa Date + toLocaleString con America/Santiago.

const MESES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

const pad2 = (n) => String(n).padStart(2, "0");

const isPureDateString = (valor) => typeof valor === "string" && /^\d{4}-\d{2}-\d{2}$/.test(valor);
const isYearMonthString = (valor) => typeof valor === "string" && /^\d{4}-\d{2}$/.test(valor);

const parsePureDate = (str) => {
  const [y, m, d] = str.split("-").map(Number);
  return { y, m, d };
};

const partsInSantiago = (date, opts) => {
  const parts = new Intl.DateTimeFormat("es-CL", { timeZone: "America/Santiago", ...opts }).formatToParts(date);
  const map = {};
  parts.forEach(p => { map[p.type] = p.value; });
  return map;
};

const toDate = (valor) => (valor instanceof Date ? valor : new Date(valor));

export function formatFecha(valor) {
  if (!valor) return "";
  if (isPureDateString(valor)) {
    const { y, m, d } = parsePureDate(valor);
    return `${pad2(d)}/${pad2(m)}/${y}`;
  }
  const date = toDate(valor);
  if (isNaN(date.getTime())) return "";
  const p = partsInSantiago(date, { day: "2-digit", month: "2-digit", year: "numeric" });
  return `${p.day}/${p.month}/${p.year}`;
}

export function formatFechaHora(valor) {
  if (!valor) return "";
  const date = toDate(valor);
  if (isNaN(date.getTime())) return "";
  const p = partsInSantiago(date, { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false });
  return `${p.day}/${p.month}/${p.year} ${p.hour}:${p.minute}`;
}

export function formatFechaLarga(valor) {
  if (!valor) return "";
  if (isPureDateString(valor)) {
    const { y, m, d } = parsePureDate(valor);
    return `${d} de ${MESES[m - 1]} de ${y}`;
  }
  const date = toDate(valor);
  if (isNaN(date.getTime())) return "";
  const p = partsInSantiago(date, { day: "numeric", month: "numeric", year: "numeric" });
  return `${parseInt(p.day, 10)} de ${MESES[parseInt(p.month, 10) - 1]} de ${p.year}`;
}

export function formatMesAno(valor) {
  if (!valor) return "";
  if (isPureDateString(valor) || isYearMonthString(valor)) {
    const [y, m] = valor.split("-").map(Number);
    return `${MESES[m - 1]} ${y}`;
  }
  const date = toDate(valor);
  if (isNaN(date.getTime())) return "";
  const p = partsInSantiago(date, { month: "numeric", year: "numeric" });
  return `${MESES[parseInt(p.month, 10) - 1]} ${p.year}`;
}

// Resta un día a una fecha pura "YYYY-MM-DD" sin pasar por UTC (mismo motivo
// que el resto del archivo). Usado para cerrar un período de dieta el día
// anterior al inicio del siguiente.
export function restarUnDia(fechaPura) {
  const { y, m, d } = parsePureDate(fechaPura);
  const date = new Date(y, m - 1, d);
  date.setDate(date.getDate() - 1);
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

// Suma n días a una fecha pura "YYYY-MM-DD" (mismo motivo que restarUnDia).
// Usado para calcular cuándo vuelve a estar disponible una cuota semanal.
export function sumarDias(fechaPura, n) {
  const { y, m, d } = parsePureDate(fechaPura);
  const date = new Date(y, m - 1, d);
  date.setDate(date.getDate() + n);
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

// "Hoy" como fecha pura "YYYY-MM-DD" en hora de Chile — NUNCA
// new Date().toISOString().split("T")[0], que da el día en UTC y puede
// quedar adelantado respecto al día real en Chile cerca de medianoche
// (mismo motivo que el resto del archivo). Usado para límites de fecha
// (ej. "no más de 30 días atrás, no más allá de hoy" al elegir la fecha de
// inicio de un tratamiento, Lote M2).
export function todayInChile() {
  const p = partsInSantiago(new Date(), { year: "numeric", month: "2-digit", day: "2-digit" });
  return `${p.year}-${p.month}-${p.day}`;
}

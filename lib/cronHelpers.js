// Helpers de horario para el cron de notificaciones (resumen diario + alertas
// puntuales). Sin dependencias — todo con Date/Intl nativos, salvo
// treatmentDoseTimesToday que delega en lib/doseSchedule.js (ver abajo).

import { getScheduledDoses } from "./doseSchedule";

// Dosis por día según el texto de frecuencia. "48 hora" se revisa antes que
// "8 hora" a propósito: "cada 48 horas" contiene "8 hora" como substring, así
// que en el orden inverso se clasificaba mal como cada-8-horas (bug heredado
// del cron anterior, corregido acá). Frecuencias no reconocidas (ej. texto
// libre "cada 30 días" para antiparasitarios mensuales) caen en 1 dosis/día.
export function getDosesPerDay(frequency) {
  const f = (frequency || "").toLowerCase();
  if (f.includes("48 hora") || f.includes("48h")) return 0.5;
  if (f.includes("6 hora") || f.includes("6h")) return 4;
  if (f.includes("8 hora") || f.includes("8h")) return 3;
  if (f.includes("12 hora") || f.includes("12h") || f.includes("2 veces")) return 2;
  if (f.includes("24 hora") || f.includes("1 vez") || f.includes("una vez")) return 1;
  return 1;
}

function formatHM(totalMinutes) {
  const m = ((totalMinutes % 1440) + 1440) % 1440;
  const h = Math.floor(m / 60);
  const min = m % 60;
  return `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
}

// Horas de toma de hoy para un medicamento HABITUAL. La tabla `medications`
// no tiene columna de hora de inicio, así que se asume un horario anclado a
// medianoche (00:00, 08:00, 16:00 para "cada 8 horas", etc.) — la misma
// suposición que ya usaba el cron anterior para los recordatorios por dosis.
// Devuelve [] para frecuencias multi-día (< 1 dosis/día): sin una fecha de
// inicio no hay forma de saber si hoy corresponde tomarlo.
export function medDoseTimesToday(frequency) {
  const dpd = getDosesPerDay(frequency);
  if (dpd < 1) return [];
  const intervalMinutes = (24 * 60) / dpd;
  return Array.from({ length: Math.round(dpd) }, (_, i) => formatHM(i * intervalMinutes));
}

// Horas de toma de hoy para un ítem de TRATAMIENTO (sí tiene start_date +
// start_time reales). Delega en getScheduledDoses (lib/doseSchedule.js),
// que sí conoce esquemas por fases — antes usaba getDosesPerDay directo,
// que solo reconoce la PRIMERA frecuencia del texto y la aplicaba a todo
// el tratamiento: un medicamento en fase 2 (ej. "cada 12h por 1 día, luego
// cada 24h por 3 días") seguía notificando cada 12 horas para siempre
// (Lote L2 Fix 3 — el mismo bug de duración también rompía esto).
export function treatmentDoseTimesToday(ti, todayStr) {
  if (!ti.start_time || !ti.frequency || !ti.start_date) return [];
  const dayStart = new Date(`${todayStr}T00:00:00`);
  const dayEnd = new Date(dayStart.getTime() + 86400000);
  return getScheduledDoses(ti, dayStart, dayEnd).map(d => formatHM(d.getHours() * 60 + d.getMinutes()));
}

// Fecha/hora actuales en America/Santiago. Chile observa horario de verano
// (cambia UTC-4/UTC-3 según la época), por eso se usa Intl con timeZone en
// vez de un offset fijo — Intl resuelve el offset correcto automáticamente.
export function nowInChile(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Santiago",
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).formatToParts(date).reduce((acc, p) => { acc[p.type] = p.value; return acc; }, {});
  return {
    dateStr: `${parts.year}-${parts.month}-${parts.day}`,
    hour: parseInt(parts.hour, 10),
    minute: parseInt(parts.minute, 10),
  };
}

// Días entre hoy (YYYY-MM-DD) y una fecha objetivo (YYYY-MM-DD). Positivo si
// la fecha objetivo es futura.
export function daysUntil(dateStr, todayStr) {
  const a = new Date(`${todayStr}T00:00:00`);
  const b = new Date(`${dateStr}T00:00:00`);
  return Math.round((b - a) / 86400000);
}

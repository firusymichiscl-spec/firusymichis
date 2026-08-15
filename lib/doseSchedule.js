// Helpers de horario de dosis para tratamientos (Lote L). Complementa
// lib/cronHelpers.js (que solo calcula "hoy") con generación de dosis en
// cualquier rango de fechas — necesario para Vista Semana, Vista Fases,
// y para detectar dosis pasadas sin registrar (Feature 2).

const FREQ_HOURS = {
  "cada 6 horas": 6, "cada 6h": 6,
  "cada 8 horas": 8, "cada 8h": 8,
  "cada 12 horas": 12, "cada 12h": 12,
  "cada 24 horas": 24, "cada 24h": 24,
  "cada 48 horas": 48, "cada 48h": 48,
  "1 vez al día": 24, "una vez al día": 24,
  "2 veces al día": 12, "dos veces al día": 12,
  "3 veces al día": 8, "tres veces al día": 8,
};

function flatIntervalHours(frequency) {
  if (!frequency) return null;
  const f = frequency.toLowerCase();
  const key = Object.keys(FREQ_HOURS).find(k => f.includes(k));
  return key ? FREQ_HOURS[key] : null;
}

// ── Parseo de fases ("cada 12 horas por 1 día, luego cada 24 horas por
// 3 días, luego día por medio") ──────────────────────────────────────
// La frecuencia es texto libre escrito por el lector de recetas IA o a
// mano, así que este parser es DELIBERADAMENTE estricto: reconoce un
// patrón muy específico (segmentos separados por "luego", cada uno con
// "cada N horas" o "día por medio", y opcionalmente "por M días") y
// devuelve null ante cualquier ambigüedad — nunca "adivina" una fase.
// Ver justificación completa de este enfoque en el reporte de Lote L.
const HOURS_RE = /cada\s+(\d+)\s*h(?:oras?)?\b/i;
const EVERY_OTHER_DAY_RE = /d[ií]a\s+por\s+medio/i;
const DURATION_RE = /por\s+(\d+)\s*d[ií]as?\b/i;

function parsePhaseSegment(segment) {
  const text = segment.trim();
  if (!text) return null;
  let intervalHours = null;
  const hoursMatch = text.match(HOURS_RE);
  if (hoursMatch) {
    intervalHours = parseInt(hoursMatch[1], 10);
  } else if (EVERY_OTHER_DAY_RE.test(text)) {
    intervalHours = 48;
  } else {
    return null;
  }
  const durMatch = text.match(DURATION_RE);
  const durationDays = durMatch ? parseInt(durMatch[1], 10) : null;
  return { intervalHours, durationDays };
}

// Devuelve un array de fases [{intervalHours, durationDays}, ...] o null
// si el texto no es un esquema por fases reconocible con confianza.
// Solo la ÚLTIMA fase puede quedar sin duración explícita (fase abierta
// hasta el fin del tratamiento) — si una fase intermedia no dice "por N
// días" no hay forma confiable de saber cuándo empieza la siguiente.
export function parsePhases(frequency) {
  if (!frequency || !/luego/i.test(frequency)) return null;
  const segments = frequency.split(/\s*,?\s*luego\s*,?\s*/i).map(s => s.trim()).filter(Boolean);
  if (segments.length < 2) return null;
  const phases = segments.map(parsePhaseSegment);
  if (phases.some(p => p === null)) return null;
  for (let i = 0; i < phases.length - 1; i++) {
    if (phases[i].durationDays == null) return null;
  }
  return phases;
}

export function hasReliablePhases(ti) {
  return !!(ti?.frequency && parsePhases(ti.frequency));
}

// Fases con horario concreto (inicio/fin/lista de dosis) ancladas a
// start_date+start_time. Cada fase empieza exactamente donde termina la
// anterior (no se reinicia el reloj a medianoche) — es la interpretación
// más predecible y la única que no requiere adivinar. La última fase, si
// es abierta, se extiende hasta ti.duration_days del tratamiento completo
// (o queda sin fin si el tratamiento tampoco tiene duration_days).
export function getPhaseSchedule(ti) {
  const phases = parsePhases(ti?.frequency);
  if (!phases || !ti.start_date || !ti.start_time) return null;
  const start = new Date(`${ti.start_date}T${ti.start_time}:00`);
  const overallEnd = ti.duration_days ? new Date(start.getTime() + ti.duration_days * 86400000) : null;
  let cursor = start;
  const result = [];
  phases.forEach((phase, i) => {
    const phaseStart = cursor;
    const isLast = i === phases.length - 1;
    const phaseEnd = phase.durationDays != null
      ? new Date(phaseStart.getTime() + phase.durationDays * 86400000)
      : (isLast ? overallEnd : null);
    const doses = [];
    if (phaseEnd) {
      let t = phaseStart;
      while (t < phaseEnd) {
        doses.push(new Date(t));
        t = new Date(t.getTime() + phase.intervalHours * 3600000);
      }
    }
    result.push({ index: i, intervalHours: phase.intervalHours, start: phaseStart, end: phaseEnd, doses, openEnded: !phaseEnd });
    if (phaseEnd) cursor = phaseEnd;
  });
  return result;
}

// Todas las dosis programadas de un treatment_item entre [rangeStart,
// rangeEnd) (Date, rangeEnd exclusivo). Punto de entrada único para
// Vista Hoy, Vista Semana y la detección de dosis atrasadas — usa fases
// si la frecuencia las tiene, si no cae al cálculo plano de siempre.
export function getScheduledDoses(ti, rangeStart, rangeEnd) {
  if (!ti?.start_date || !ti?.start_time || !ti?.frequency) return [];
  const phases = parsePhases(ti.frequency);
  if (phases) {
    const schedule = getPhaseSchedule(ti);
    if (!schedule) return [];
    return schedule.flatMap(p => p.doses).filter(d => d >= rangeStart && d < rangeEnd);
  }
  const intervalHours = flatIntervalHours(ti.frequency);
  if (!intervalHours) return [];
  const start = new Date(`${ti.start_date}T${ti.start_time}:00`);
  const treatmentEnd = ti.duration_days ? new Date(start.getTime() + ti.duration_days * 86400000) : null;
  const hardEnd = treatmentEnd && treatmentEnd < rangeEnd ? treatmentEnd : rangeEnd;
  if (start >= hardEnd) return [];
  let t = start;
  if (t < rangeStart) {
    const stepMs = intervalHours * 3600000;
    const stepsToSkip = Math.floor((rangeStart - t) / stepMs);
    t = new Date(t.getTime() + stepsToSkip * stepMs);
  }
  const doses = [];
  while (t < hardEnd) {
    if (t >= rangeStart) doses.push(new Date(t));
    t = new Date(t.getTime() + intervalHours * 3600000);
  }
  return doses;
}

// Fecha de término del tratamiento (start_date + duration_days) o null
// si no tiene duración fija (tratamiento de por vida / campo vacío).
export function getTreatmentEnd(ti) {
  if (!ti?.start_date || !ti?.duration_days) return null;
  const start = new Date(`${ti.start_date}T${ti.start_time || "00:00"}:00`);
  return new Date(start.getTime() + ti.duration_days * 86400000);
}

export function getTreatmentStart(ti) {
  if (!ti?.start_date) return null;
  return new Date(`${ti.start_date}T${ti.start_time || "00:00"}:00`);
}

// Clave estable para identificar una dosis programada (usada como
// scheduled_at al escribir/leer dose_log).
export function doseKey(date) {
  return date.toISOString();
}

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

export function flatIntervalHours(frequency) {
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

// ── Fases estructuradas (Lote M) ──────────────────────────────────────
// treatment_items.phases (jsonb) guarda el mismo array que parsePhases()
// devuelve, pero en snake_case (interval_hours/duration_days) porque así
// vive en la base — lo llena el lector de recetas IA (app/api/ai-recipe)
// o el editor manual del formulario. Cuando existe y es válido, se usa
// DIRECTO y no se vuelve a intentar interpretar el texto libre de
// `frequency`: el parser de regex es frágil por diseño (ver comentario de
// parsePhases más arriba) y solo debía ser la solución hasta tener fases
// reales — sigue existiendo como red de seguridad para tratamientos
// guardados antes de este lote, o para cuando la IA no pudo determinar
// las fases con certeza (phases: null).

// Valida un array de fases en el shape que se guarda en la base
// (snake_case) ANTES de escribirlo — Lote M Feature 1.6. Se usa tanto al
// guardar (AITab.jsx, editor manual en DashboardClient.jsx) como al leer
// (por si alguna fila llegara con datos mal formados por otra vía).
// Devuelve el mismo array si es válido, o null si no — nunca "corrige" ni
// completa datos a medio validar: con null, el tratamiento cae al parser
// de texto libre, que sigue siendo la red de seguridad real.
export function validatePhases(phases) {
  if (!Array.isArray(phases) || phases.length === 0) return null;
  for (let i = 0; i < phases.length; i++) {
    const p = phases[i];
    if (!p || typeof p !== "object") return null;
    if (typeof p.interval_hours !== "number" || !(p.interval_hours > 0)) return null;
    const isLast = i === phases.length - 1;
    if (p.duration_days == null) {
      if (!isLast) return null;
    } else if (typeof p.duration_days !== "number" || !(p.duration_days > 0)) {
      return null;
    }
  }
  return phases;
}

// Punto de entrada único de fases para todo lo demás en este archivo:
// prioriza treatment_items.phases (estructurado) sobre el parser de texto
// libre. Devuelve el shape interno camelCase ({intervalHours,
// durationDays}) que ya usaban getPhaseSchedule/getScheduledDoses/etc.
export function resolvePhases(ti) {
  const stored = validatePhases(ti?.phases);
  if (stored) {
    return stored.map(p => ({ intervalHours: p.interval_hours, durationDays: p.duration_days ?? null }));
  }
  return parsePhases(ti?.frequency);
}

export function hasReliablePhases(ti) {
  return !!resolvePhases(ti);
}

// Fases con horario concreto (inicio/fin/lista de dosis) ancladas a
// start_date+start_time. Cada fase empieza exactamente donde termina la
// anterior (no se reinicia el reloj a medianoche) — es la interpretación
// más predecible y la única que no requiere adivinar. La última fase, si
// es abierta, se extiende hasta ti.duration_days del tratamiento completo
// (o queda sin fin si el tratamiento tampoco tiene duration_days) — pero
// eso solo afecta `end` (la fecha de término, que sigue quedando `null`
// si no se puede conocer). Las DOSIS de esa fase abierta igual se generan
// hasta `horizon` (por defecto ahora): "no saber cuándo termina" no es lo
// mismo que "no saber qué dosis ya pasaron" — sin esto, una fase final
// abierta ("día por medio", sin fin) quedaba con doses=[] para siempre,
// invisible en Vista Fases y nunca contada en el progreso (Lote L2 Fix 3).
export function getPhaseSchedule(ti, horizon = new Date()) {
  const phases = resolvePhases(ti);
  if (!phases || !ti.start_date || !ti.start_time) return null;
  const start = new Date(`${ti.start_date}T${ti.start_time}:00`);
  const overallEnd = ti.duration_days ? new Date(start.getTime() + ti.duration_days * 86400000) : null;
  let cursor = start;
  const result = [];
  phases.forEach((phase, i) => {
    const phaseStart = cursor;
    const isLast = i === phases.length - 1;
    const definedEnd = phase.durationDays != null
      ? new Date(phaseStart.getTime() + phase.durationDays * 86400000)
      : (isLast ? overallEnd : null);
    const openEnded = !definedEnd;
    const genEnd = definedEnd || (isLast ? horizon : null);
    const doses = [];
    if (genEnd) {
      let t = phaseStart;
      while (t < genEnd) {
        doses.push(new Date(t));
        t = new Date(t.getTime() + phase.intervalHours * 3600000);
      }
    }
    result.push({ index: i, intervalHours: phase.intervalHours, start: phaseStart, end: definedEnd, doses, openEnded });
    if (definedEnd) cursor = definedEnd;
  });
  return result;
}

// Todas las dosis programadas de un treatment_item entre [rangeStart,
// rangeEnd) (Date, rangeEnd exclusivo). Punto de entrada único para
// Vista Hoy, Vista Semana y la detección de dosis atrasadas — usa fases
// si la frecuencia las tiene, si no cae al cálculo plano de siempre.
export function getScheduledDoses(ti, rangeStart, rangeEnd) {
  if (!ti?.start_date || !ti?.start_time || !ti?.frequency) return [];
  const phases = resolvePhases(ti);
  if (phases) {
    // horizon=rangeEnd: si se pide una semana futura (Vista Semana, Lote L2
    // Fix 2) y la última fase quedó abierta, se proyecta hasta ahí — el
    // intervalo de la fase SÍ se conoce, solo no se sabe cuándo se discontinúa.
    const schedule = getPhaseSchedule(ti, rangeEnd);
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

// Fecha de término del tratamiento o null si no tiene duración fija
// (tratamiento de por vida / campo vacío). Fase-consciente (Lote L2 Fix 3):
// antes solo miraba ti.duration_days directo, ignorando que en un esquema
// por fases el fin real es la suma de la duración de cada fase, no ese
// campo — que en un tratamiento por fases puede no estar seteado o
// referirse a otra cosa.
export function getTreatmentEnd(ti) {
  if (!ti?.start_date) return null;
  const phases = resolvePhases(ti);
  if (phases) {
    const schedule = getPhaseSchedule(ti);
    if (!schedule) return null;
    return schedule[schedule.length - 1].end || null;
  }
  if (!ti.duration_days) return null;
  const start = new Date(`${ti.start_date}T${ti.start_time || "00:00"}:00`);
  return new Date(start.getTime() + ti.duration_days * 86400000);
}

export function getTreatmentStart(ti) {
  if (!ti?.start_date) return null;
  return new Date(`${ti.start_date}T${ti.start_time || "00:00"}:00`);
}

// Intervalo en horas de la fase VIGENTE en `now` (o el plano de siempre si
// el tratamiento no tiene fases) — Lote S, Feature 2. Es el único dato de
// fases que faltaba exportar suelto: getTreatmentProgress ya lo calcula
// internamente para phaseInfo.intervalHours, pero solo en el caso con
// fases; acá se cubren ambos casos para que lib/inventoryCalc.js no tenga
// que reimplementar el parseo de fases.
export function getCurrentIntervalHours(ti, now = new Date()) {
  const phases = resolvePhases(ti);
  if (!phases) return flatIntervalHours(ti?.frequency);
  const schedule = getPhaseSchedule(ti, now);
  if (!schedule) return null;
  let current = schedule.find(p => now >= p.start && (p.end ? now < p.end : true));
  if (!current) current = now < schedule[0].start ? schedule[0] : schedule[schedule.length - 1];
  return current.intervalHours;
}

// ── Dosis huérfanas (Lote N) ───────────────────────────────────────────
// dose_log queda unido a un treatment_item por (treatment_item_id,
// scheduled_at) — no hay una columna que diga "a qué versión del horario
// pertenece esta fila". Si después se edita start_date, frequency o phases,
// getScheduledDoses ya no genera esos scheduled_at: la fila sigue en la
// base (correcto, es historial) pero deja de calzar con NINGUNA dosis del
// horario ACTUAL. Punto de entrada único para excluirlas de cálculos de
// adherencia/progreso sin duplicar esta lógica en cada archivo que lee
// dose_log (mismo motivo que getTreatmentProgress). No borra nada.
export function filterValidDoseLogs(ti, doseLogs, now = new Date()) {
  const start = getTreatmentStart(ti);
  if (!start) return [];
  // +1 min de margen: dose_log_check_not_future (Lote L2) tolera ese
  // margen al escribir, así que una dosis marcada justo ahora podría
  // quedar 1seg por delante de `now` si se llama con timestamps distintos.
  const rangeEnd = new Date(now.getTime() + 60000);
  const validTimes = new Set(getScheduledDoses(ti, start, rangeEnd).map(d => d.getTime()));
  return doseLogs.filter(d => d.treatment_item_id === ti.id && validTimes.has(new Date(d.scheduled_at).getTime()));
}

// Cuántas filas de dose_log de este treatment_item NO calzan con el
// horario actual — para el aviso "N registros anteriores no coinciden"
// (Lote N Fix 1.4). No se llama dentro de filterValidDoseLogs para no
// recorrer doseLogs dos veces cuando ambos números hacen falta a la vez;
// quien los necesite juntos arma el conteo con la resta (ver DashboardClient).
export function countOrphanedDoseLogs(ti, doseLogs, now = new Date()) {
  const total = doseLogs.filter(d => d.treatment_item_id === ti.id).length;
  const valid = filterValidDoseLogs(ti, doseLogs, now).length;
  return Math.max(0, total - valid);
}

// Clave estable para identificar una dosis programada (usada como
// scheduled_at al escribir/leer dose_log).
export function doseKey(date) {
  return date.toISOString();
}

// ── Progreso de HORARIO de un treatment_item (NO es adherencia real —
// eso vive en dose_log, ver Feature 3 de Lote L; esto es "qué tocaría
// haber pasado según el calendario"). Fase-consciente (Lote L2 Fix 3):
// reemplaza el cálculo que existía duplicado en DashboardClient.jsx,
// OverviewClient.jsx y lib/cronHelpers.js, que solo miraba la PRIMERA
// frecuencia reconocida en el texto libre (ej. "cada 12 horas" en un
// esquema por fases) y le aplicaba duration_days completo a ESE único
// intervalo — así que un tratamiento con fases se declaraba "completado"
// apenas terminaba la fase 1 (bug reportado: prednisona de Otto mostrando
// "100% de adherencia" recién en fase 2). Nunca declara completado si no
// se puede conocer el fin real (última fase abierta sin duration_days).
export function getTreatmentProgress(ti, now = new Date()) {
  if (!ti?.start_date || !ti?.start_time || !ti?.frequency) return null;
  const start = new Date(`${ti.start_date}T${ti.start_time}:00`);
  const phases = resolvePhases(ti);

  if (phases) {
    const schedule = getPhaseSchedule(ti, now);
    if (!schedule) return null;
    const end = schedule[schedule.length - 1].end || null;
    const allBounded = !!end;

    const flatDoses = schedule.flatMap(p => p.doses);
    const dosesDone = flatDoses.filter(d => d <= now).length;
    const totalDoses = allBounded ? flatDoses.length : null;
    const dosesLeft = totalDoses != null ? Math.max(0, totalDoses - dosesDone) : null;

    const totalDays = allBounded ? Math.round((end - start) / 86400000) : null;
    const daysDone = Math.max(0, Math.floor((Math.min(now, end || now) - start) / 86400000));
    const daysLeft = totalDays != null ? Math.max(0, totalDays - daysDone) : null;

    const completed = allBounded && now >= end;

    let current = schedule.find(p => now >= p.start && (p.end ? now < p.end : true));
    if (!current) current = now < start ? schedule[0] : schedule[schedule.length - 1];

    let nextDoseTime = null;
    if (!completed) {
      const upcoming = flatDoses.find(d => d > now);
      if (upcoming) {
        nextDoseTime = upcoming;
      } else {
        // Fase actual abierta (horizon=now no generó dosis futuras) —
        // se calcula la siguiente a mano con el intervalo conocido.
        const stepMs = current.intervalHours * 3600000;
        const elapsed = Math.max(0, now - current.start);
        const steps = Math.floor(elapsed / stepMs) + 1;
        nextDoseTime = new Date(current.start.getTime() + steps * stepMs);
      }
    }

    const phaseInfo = {
      index: current.index,
      total: schedule.length,
      intervalHours: current.intervalHours,
      dayInPhase: Math.max(0, Math.floor((now - current.start) / 86400000)) + 1,
      totalDaysInPhase: current.end ? Math.round((current.end - current.start) / 86400000) : null,
      doseInPhase: current.doses.filter(d => d <= now).length,
      totalDosesInPhase: current.end ? current.doses.length : null,
    };

    return { totalDoses, dosesDone, dosesLeft, daysDone, daysLeft, totalDays, progress: totalDoses ? Math.round((dosesDone / totalDoses) * 100) : null, completed, nextDoseTime, phaseInfo };
  }

  // Sin fases — mismo cálculo plano de siempre, centralizado acá para no
  // duplicar el mapa de frecuencias en cada archivo que lo necesita.
  const intervalHours = flatIntervalHours(ti.frequency);
  if (!intervalHours) return null;
  const totalDays = ti.duration_days || 0;
  const totalDoses = Math.round((totalDays * 24) / intervalHours);
  const elapsedHours = Math.max(0, (now - start) / 3600000);
  const dosesDone = Math.min(totalDoses, Math.floor(elapsedHours / intervalHours));
  const dosesLeft = Math.max(0, totalDoses - dosesDone);
  const daysDone = Math.floor(dosesDone * intervalHours / 24);
  const daysLeft = Math.max(0, totalDays - daysDone);
  const completed = totalDoses > 0 && dosesDone >= totalDoses;
  const nextDoseTime = completed ? null : new Date(start.getTime() + (dosesDone + 1) * intervalHours * 3600000);
  const progress = totalDoses > 0 ? Math.round((dosesDone / totalDoses) * 100) : null;

  return { totalDoses, dosesDone, dosesLeft, daysDone, daysLeft, totalDays, progress, completed, nextDoseTime, phaseInfo: null };
}

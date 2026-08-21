// Cálculo de consumo/agotamiento/compra del inventario (Lote S, Feature 2).
// Cubre los dos tipos de vínculo de inventory_treatment_links:
// - "treatment": treatment_items con horario real (fases, fecha de fin) —
//   reusa lib/doseSchedule.js, nunca reimplementa el parseo de fases.
// - "medication": medications habituales sin horario — mismo cálculo de
//   texto libre que ya usa el cron hoy (lib/cronHelpers.js getDosesPerDay),
//   solo "días que alcanza"/"fecha de agotamiento": un medicamento crónico
//   no tiene fin conocido, así que nunca se calcula "cuánto falta para
//   completar" para este tipo de vínculo.
import { getCurrentIntervalHours, getTreatmentProgress } from "./doseSchedule";
import { getDosesPerDay } from "./cronHelpers";

export function dailyConsumptionForTreatment(ti, now = new Date()) {
  const hours = getCurrentIntervalHours(ti, now);
  if (!hours) return null;
  return (24 / hours) * (ti.units_per_dose || 1);
}

export function dailyConsumptionForMedication(med) {
  if (!med?.frequency) return null;
  return getDosesPerDay(med.frequency);
}

function addDays(date, days) {
  return new Date(date.getTime() + days * 86400000);
}

// links: [{ kind: "treatment", treatmentItem }, { kind: "medication", medication }, ...]
// Un mismo ítem puede tener varios vínculos (Feature 3.3 — una mascota por
// vínculo), de cualquier combinación de los dos tipos.
export function computeItemNeeds(item, links, now = new Date()) {
  if (!links || links.length === 0) {
    return { dailyTotal: null, daysRemaining: null, exhaustionDate: null, unitsNeeded: null, unitsToBuy: null, packagesToBuy: null, openEnded: false, hasCalc: false };
  }

  let dailyTotal = 0;
  let anyKnownRate = false;
  let unitsNeeded = 0;
  let anyOpenEnded = false;
  let anyKnownNeed = false;

  for (const link of links) {
    if (link.kind === "treatment") {
      const ti = link.treatmentItem;
      const rate = dailyConsumptionForTreatment(ti, now);
      if (rate != null) { dailyTotal += rate; anyKnownRate = true; }

      const progress = getTreatmentProgress(ti, now);
      if (progress && progress.dosesLeft != null) {
        unitsNeeded += progress.dosesLeft * (ti.units_per_dose || 1);
        anyKnownNeed = true;
      } else {
        anyOpenEnded = true;
      }
    } else if (link.kind === "medication") {
      const rate = dailyConsumptionForMedication(link.medication);
      if (rate != null) { dailyTotal += rate; anyKnownRate = true; }
      anyOpenEnded = true; // medicamento habitual = crónico, sin fin conocido
    }
  }

  const daysRemaining = anyKnownRate && dailyTotal > 0 ? Math.floor(item.quantity / dailyTotal) : null;
  const exhaustionDate = daysRemaining != null ? addDays(now, daysRemaining) : null;

  const openEnded = anyOpenEnded || !anyKnownNeed;
  const finalUnitsNeeded = openEnded ? null : unitsNeeded;
  const unitsToBuy = finalUnitsNeeded != null ? Math.max(0, finalUnitsNeeded - item.quantity) : null;
  const packagesToBuy = unitsToBuy != null && item.units_per_package ? Math.ceil(unitsToBuy / item.units_per_package) : null;

  return {
    dailyTotal: anyKnownRate ? dailyTotal : null,
    daysRemaining,
    exhaustionDate,
    unitsNeeded: finalUnitsNeeded,
    unitsToBuy,
    packagesToBuy,
    openEnded,
    hasCalc: anyKnownRate,
  };
}

import { createClient } from "@supabase/supabase-js";
import { formatFecha } from "@/lib/fechas";
import { medDoseTimesToday, treatmentDoseTimesToday, nowInChile, daysUntil } from "@/lib/cronHelpers";
import { computeItemNeeds } from "@/lib/inventoryCalc";

// Corre cada 10 minutos (config del cron en Vercel). Dos mecanismos,
// independientes entre sí, ambos idempotentes vía `sent_notifications`:
//
// 1. RESUMEN DIARIO: una vez al día a las 8:00 AM hora de Chile, por
//    mascota con notificaciones activas. Junta dosis del día, vacunas que
//    vencen en <=30 días y medicamentos con stock para <7 días. Si no hay
//    nada que informar, no se envía email. Clave: resumen:{petId}:{fecha}.
//
// 2. ALERTAS PUNTUALES: corren en cada ejecución del cron (no solo a las
//    8 AM). Stock crítico (<3 días), vacuna por vencer (30/7/1 días antes)
//    y trial por vencer (7/1 días antes, a nivel de cuenta, sin toggle).
//
// "notify_vet_control" (Controles veterinarios) NO se implementa: no existe
// ningún campo en el modelo de datos para la fecha del próximo control (los
// tipos de medical_history son surgery/illness/exam/procedure/vaccine/other,
// ninguno con semántica de "próxima consulta"). El toggle queda intacto en
// la UI y la tabla, pero el cron no lo lee — ver auditoría del Lote I.
//
// "advance_minutes" (anticipación en minutos) tampoco se lee: el diseño de
// resumen diario + alertas puntuales reemplaza los recordatorios por dosis
// que lo usaban. Se deja la columna y el selector en la UI intactos a la
// espera de una decisión de producto.
export async function GET(req) {
  const token = req.headers.get("x-cron-secret");
  if (token !== process.env.CRON_SECRET) {
    return new Response("Unauthorized", { status: 401 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  const chile = nowInChile();
  const results = {
    resumen_sent: 0, resumen_empty: 0, resumen_idempotent: 0,
    alertas_sent: 0, alertas_idempotent: 0,
    errors: 0,
  };

  const { data: prefs } = await supabase
    .from("notification_preferences")
    .select("*, pets(id, name, species, archived_at)")
    .eq("enabled", true);

  for (const pref of (prefs || [])) {
    if (!pref.email || !pref.pet_id) continue;
    const pet = pref.pets;
    if (!pet || pet.archived_at) continue; // En Memoria: sin alertas

    // ── RESUMEN DIARIO (solo en la hora 8 de Chile) ──────────────────
    if (chile.hour === 8) {
      const r = await sendDailySummaryIfDue(supabase, pref, pet, chile);
      if (r === "errors") results.errors++;
      else results[`resumen_${r}`]++;
    }

    // ── ALERTAS PUNTUALES por mascota ─────────────────────────────────
    if (pref.notify_low_stock) {
      const r = await sendStockCriticalAlerts(supabase, pref, pet, chile);
      results.alertas_sent += r.sent; results.alertas_idempotent += r.idempotent; results.errors += r.errors;
    }
    if (pref.notify_vaccine) {
      const r = await sendVaccineAlerts(supabase, pref, pet, chile);
      results.alertas_sent += r.sent; results.alertas_idempotent += r.idempotent; results.errors += r.errors;
    }
  }

  // ── ALERTAS DE TRIAL (a nivel de cuenta, sin toggle por mascota) ────
  const trialResults = await sendTrialAlerts(supabase, chile);
  results.alertas_sent += trialResults.sent;
  results.alertas_idempotent += trialResults.idempotent;
  results.errors += trialResults.errors;

  const { error: hbError } = await supabase.from("cron_heartbeats").insert({
    emails_sent: results.resumen_sent + results.alertas_sent,
    emails_skipped: results.resumen_empty + results.resumen_idempotent + results.alertas_idempotent,
  });
  if (hbError) {
    console.error("[cron] heartbeat insert error:", hbError.code, hbError.message);
  }

  return Response.json({ ok: true, timestamp: new Date().toISOString(), chileHour: chile.hour, ...results });
}

// ── 1. Resumen diario ────────────────────────────────────────────────

async function sendDailySummaryIfDue(supabase, pref, pet, chile) {
  const key = `resumen:${pref.pet_id}:${chile.dateStr}`;

  const doses = [];
  if (pref.notify_medication_habitual) {
    const { data: meds } = await supabase.from("medications").select("*").eq("pet_id", pref.pet_id).eq("active", true);
    for (const med of (meds || [])) {
      if (!med.frequency) continue;
      for (const time of medDoseTimesToday(med.frequency)) {
        doses.push({ time, label: `${med.name}${med.dose ? ` ${med.dose}` : ""}` });
      }
    }
  }
  if (pref.notify_medication_treatment) {
    const { data: items } = await supabase.from("treatment_items").select("*").eq("pet_id", pref.pet_id).eq("active", true);
    for (const ti of (items || [])) {
      for (const time of treatmentDoseTimesToday(ti, chile.dateStr)) {
        doses.push({ time, label: `${ti.name}${ti.prescribed_dose ? ` ${ti.prescribed_dose}` : ""}` });
      }
    }
  }
  doses.sort((a, b) => a.time.localeCompare(b.time));

  const vaccines = [];
  if (pref.notify_vaccine) {
    const { data: vacs } = await supabase.from("medical_history").select("*").eq("pet_id", pref.pet_id).eq("type", "vaccine");
    for (const v of (vacs || [])) {
      if (!v.next_date) continue;
      const d = daysUntil(v.next_date, chile.dateStr);
      if (d >= 0 && d <= 30) vaccines.push({ name: v.event, date: formatFecha(v.next_date), daysUntil: d });
    }
  }

  const stockItems = [];
  if (pref.notify_low_stock) {
    const statuses = await getPetInventoryStockStatus(supabase, pref.pet_id);
    for (const { item, calc } of statuses) {
      if (calc.daysRemaining !== null && calc.daysRemaining < 7) stockItems.push({ name: item.name, daysLeft: calc.daysRemaining });
    }
  }

  if (doses.length === 0 && vaccines.length === 0 && stockItems.length === 0) {
    return "empty";
  }

  const ok = await tryInsertKey(supabase, key);
  if (!ok) return "idempotent";

  const r = await sendNotif(pref.email, "resumen", { petName: pet.name, doses, vaccines, stockItems });
  if (r.error) { await removeKey(supabase, key); return "errors"; }
  return "sent";
}

// ── 2. Alertas puntuales ─────────────────────────────────────────────

async function sendStockCriticalAlerts(supabase, pref, pet, chile) {
  const out = { sent: 0, idempotent: 0, errors: 0 };
  const statuses = await getPetInventoryStockStatus(supabase, pref.pet_id);
  for (const { item, calc } of statuses) {
    if (calc.daysRemaining === null || calc.daysRemaining >= 3) continue;

    // Clave por ítem, no por mascota: si un mismo ítem abastece a dos
    // mascotas del mismo usuario con notify_low_stock activo, evita mandar
    // dos correos por el mismo evento de stock (Lote S, Feature 3.3).
    const key = `stock:${item.id}:${chile.dateStr}`;
    const ok = await tryInsertKey(supabase, key);
    if (!ok) { out.idempotent++; continue; }
    const r = await sendNotif(pref.email, "low_stock", { petName: pet.name, medicationName: item.name, stockRemaining: item.quantity });
    if (!r.error) out.sent++; else { out.errors++; await removeKey(supabase, key); }
  }
  return out;
}

// ── Inventario (Lote S) ────────────────────────────────────────────────
// Ítems de inventory_items vinculados a algún treatment_item o medication
// ACTIVO de esta mascota, con su cálculo de consumo (lib/inventoryCalc.js).
// El cálculo de cada ítem usa TODOS sus vínculos (Feature 3.3: puede
// abastecer a otra mascota también), no solo los de esta mascota — por eso
// se recarga el set completo de vínculos por ítem en vez de derivarlo de
// los treatment_items/medications ya consultados acá.
async function getPetInventoryStockStatus(supabase, petId) {
  const [tiRes, medRes] = await Promise.all([
    supabase.from("treatment_items").select("id").eq("pet_id", petId).eq("active", true),
    supabase.from("medications").select("id").eq("pet_id", petId).eq("active", true),
  ]);
  const tiIds = (tiRes.data || []).map(r => r.id);
  const medIds = (medRes.data || []).map(r => r.id);
  if (tiIds.length === 0 && medIds.length === 0) return [];

  const [linksByTi, linksByMed] = await Promise.all([
    tiIds.length ? supabase.from("inventory_treatment_links").select("inventory_item_id").in("treatment_item_id", tiIds) : Promise.resolve({ data: [] }),
    medIds.length ? supabase.from("inventory_treatment_links").select("inventory_item_id").in("medication_id", medIds) : Promise.resolve({ data: [] }),
  ]);
  const itemIds = [...new Set([...(linksByTi.data || []), ...(linksByMed.data || [])].map(r => r.inventory_item_id))];
  if (itemIds.length === 0) return [];

  const results = [];
  for (const itemId of itemIds) {
    const { data: item } = await supabase.from("inventory_items").select("*").eq("id", itemId).single();
    if (!item) continue;

    const { data: allLinks } = await supabase.from("inventory_treatment_links").select("*").eq("inventory_item_id", itemId);
    const allTiIds = (allLinks || []).filter(l => l.treatment_item_id).map(l => l.treatment_item_id);
    const allMedIds = (allLinks || []).filter(l => l.medication_id).map(l => l.medication_id);
    const [allTiRes, allMedRes] = await Promise.all([
      allTiIds.length ? supabase.from("treatment_items").select("*").in("id", allTiIds) : Promise.resolve({ data: [] }),
      allMedIds.length ? supabase.from("medications").select("*").in("id", allMedIds) : Promise.resolve({ data: [] }),
    ]);
    const links = [
      ...(allTiRes.data || []).map(ti => ({ kind: "treatment", treatmentItem: ti })),
      ...(allMedRes.data || []).map(m => ({ kind: "medication", medication: m })),
    ];
    results.push({ item, calc: computeItemNeeds(item, links) });
  }
  return results;
}

async function sendVaccineAlerts(supabase, pref, pet, chile) {
  const out = { sent: 0, idempotent: 0, errors: 0 };
  const { data: vacs } = await supabase.from("medical_history").select("*").eq("pet_id", pref.pet_id).eq("type", "vaccine");
  for (const vac of (vacs || [])) {
    if (!vac.next_date) continue;
    const d = daysUntil(vac.next_date, chile.dateStr);
    if (![30, 7, 1].includes(d)) continue;

    const key = `vacuna:${vac.id}:${d}`;
    const ok = await tryInsertKey(supabase, key);
    if (!ok) { out.idempotent++; continue; }
    const r = await sendNotif(pref.email, "vaccine", { petName: pet.name, medicationName: vac.event, scheduledTime: formatFecha(vac.next_date) });
    if (!r.error) out.sent++; else { out.errors++; await removeKey(supabase, key); }
  }
  return out;
}

async function sendTrialAlerts(supabase, chile) {
  const out = { sent: 0, idempotent: 0, errors: 0 };
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, plan, plan_expires_at")
    .eq("plan", "pro")
    .not("plan_expires_at", "is", null);

  for (const profile of (profiles || [])) {
    const d = daysUntil(profile.plan_expires_at.slice(0, 10), chile.dateStr);
    if (![7, 1].includes(d)) continue;

    const key = `trial:${profile.id}:${d}`;
    const ok = await tryInsertKey(supabase, key);
    if (!ok) { out.idempotent++; continue; }

    const { data: authUser, error: userError } = await supabase.auth.admin.getUserById(profile.id);
    if (userError || !authUser?.user?.email) { out.errors++; await removeKey(supabase, key); continue; }

    const r = await sendNotif(authUser.user.email, "trial", { daysLeft: d });
    if (!r.error) out.sent++; else { out.errors++; await removeKey(supabase, key); }
  }
  return out;
}

// ── Helpers de idempotencia ───────────────────────────────────────────

async function tryInsertKey(supabase, key) {
  const { error } = await supabase.from("sent_notifications").insert({ notification_key: key });
  if (!error) return true;
  if (error.code === "23505") return false; // unique_violation → ya enviado, saltar en silencio
  console.error("[cron] sent_notifications insert error:", error.code, error.message, "key:", key);
  return false;
}

async function removeKey(supabase, key) {
  await supabase.from("sent_notifications").delete().eq("notification_key", key);
}

// ── Envío de emails ────────────────────────────────────────────────────

async function sendNotif(to, type, data) {
  try {
    const res = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || "https://firusymichis.cl"}/api/send-notification`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-cron-secret": process.env.CRON_SECRET },
      body: JSON.stringify({ to, type, ...data }),
    });
    return await res.json();
  } catch (e) {
    return { error: e.message };
  }
}

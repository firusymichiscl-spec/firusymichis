import { createClient } from "@supabase/supabase-js";

export async function GET(req) {
  // ── Auth ──────────────────────────────────────────────────────────
  const token = req.headers.get("x-cron-secret");
  if (token !== process.env.CRON_SECRET) {
    return new Response("Unauthorized", { status: 401 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  const now = new Date();
  const dateHour = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}-${String(now.getHours()).padStart(2, "0")}`;
  const dateDay  = dateHour.slice(0, 10);

  const results = { sent: 0, errors: 0, skipped: 0, idempotent: 0 };

  const { data: prefs } = await supabase
    .from("notification_preferences")
    .select("*, pets(id, name, species, conditions, archived_at)")
    .eq("enabled", true);

  for (const pref of (prefs || [])) {
    if (!pref.email || !pref.pet_id) { results.skipped++; continue; }
    const pet = pref.pets;
    if (!pet) { results.skipped++; continue; }
    if (pet.archived_at) { results.skipped++; continue; } // En Memoria: sin alertas

    // ── 1. MEDICAMENTOS HABITUALES ─────────────────────────────────
    if (pref.notify_medication_habitual) {
      const { data: meds } = await supabase
        .from("medications")
        .select("*")
        .eq("pet_id", pref.pet_id)
        .eq("active", true);

      for (const med of (meds || [])) {
        if (!med.frequency) continue;

        // Stock bajo
        if (pref.notify_low_stock && med.stock != null) {
          const dpd = getDosesPerDay(med.frequency);
          const daysLeft = dpd > 0 ? Math.floor(med.stock / dpd) : null;
          if (daysLeft !== null && daysLeft <= 7) {
            const key = `${pref.pet_id}:low_stock:${med.id}:${dateDay}`;
            const ok = await tryInsertKey(supabase, key);
            if (!ok) { results.idempotent++; continue; }
            const r = await sendNotif(pref.email, "low_stock", { petName: pet.name, medicationName: med.name, stockRemaining: med.stock });
            if (!r.error) results.sent++;
            else { results.errors++; await removeKey(supabase, key); }
          }
        }

        // Toma programada
        if (!checkMedTime(med.frequency, now, pref.advance_minutes)) continue;
        const key = `${pref.pet_id}:medication:${med.id}:${dateHour}`;
        const ok = await tryInsertKey(supabase, key);
        if (!ok) { results.idempotent++; continue; }
        const r = await sendNotif(pref.email, "medication", {
          petName: pet.name,
          medicationName: `${med.name}${med.dose ? ` — ${med.dose}` : ""}`,
          scheduledTime: now.toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" }),
        });
        if (!r.error) results.sent++;
        else { results.errors++; await removeKey(supabase, key); }
      }
    }

    // ── 2. VACUNAS PRÓXIMAS ────────────────────────────────────────
    if (pref.notify_vaccine) {
      const { data: vaccines } = await supabase
        .from("medical_history")
        .select("*")
        .eq("pet_id", pref.pet_id)
        .eq("type", "vaccine");

      for (const vac of (vaccines || [])) {
        if (!vac.next_date) continue;
        const daysUntil = Math.ceil((new Date(vac.next_date) - now) / 86400000);
        if (![30, 7, 1].includes(daysUntil)) continue;

        const key = `${pref.pet_id}:vaccine:${vac.id}-${daysUntil}d:${dateDay}`;
        const ok = await tryInsertKey(supabase, key);
        if (!ok) { results.idempotent++; continue; }
        const r = await sendNotif(pref.email, "vaccine", {
          petName: pet.name,
          medicationName: vac.event,
          scheduledTime: new Date(vac.next_date).toLocaleDateString("es-CL"),
        });
        if (!r.error) results.sent++;
        else { results.errors++; await removeKey(supabase, key); }
      }
    }

    // ── 3. TRATAMIENTOS ───────────────────────────────────────────
    if (pref.notify_medication_treatment) {
      const { data: treatments } = await supabase
        .from("treatment_items")
        .select("*")
        .eq("pet_id", pref.pet_id)
        .eq("active", true);

      for (const ti of (treatments || [])) {
        if (!ti.start_time || !ti.frequency) continue;
        if (!checkTreatmentTime(ti, now, pref.advance_minutes)) continue;

        const key = `${pref.pet_id}:treatment:${ti.id}:${dateHour}`;
        const ok = await tryInsertKey(supabase, key);
        if (!ok) { results.idempotent++; continue; }
        const r = await sendNotif(pref.email, "medication", {
          petName: pet.name,
          medicationName: `${ti.name}${ti.prescribed_dose ? ` — ${ti.prescribed_dose}` : ""}`,
          scheduledTime: now.toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" }),
        });
        if (!r.error) results.sent++;
        else { results.errors++; await removeKey(supabase, key); }
      }
    }
  }

  // ── Heartbeat ─────────────────────────────────────────────────
  const { error: hbError } = await supabase.from("cron_heartbeats").insert({
    emails_sent: results.sent,
    emails_skipped: results.skipped + results.idempotent,
  });
  if (hbError) {
    console.error("[cron] heartbeat insert error:", hbError.code, hbError.message);
  }

  return Response.json({ ok: true, timestamp: now.toISOString(), ...results });
}

// ── Helpers de idempotencia ───────────────────────────────────────

async function tryInsertKey(supabase, key) {
  const { error } = await supabase
    .from("sent_notifications")
    .insert({ notification_key: key });
  if (!error) return true;
  if (error.code === "23505") return false; // unique_violation → ya enviado, saltar en silencio
  // cualquier otro error (tabla inexistente, red, etc.) — logueamos y NO enviamos
  console.error("[cron] sent_notifications insert error:", error.code, error.message, "key:", key);
  return false;
}

async function removeKey(supabase, key) {
  await supabase.from("sent_notifications").delete().eq("notification_key", key);
}

// ── Envío de emails ───────────────────────────────────────────────

async function sendNotif(to, type, data) {
  try {
    const res = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || "https://firusymichis.cl"}/api/send-notification`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ to, type, ...data }),
    });
    return await res.json();
  } catch (e) {
    return { error: e.message };
  }
}

// ── Helpers de tiempo ─────────────────────────────────────────────

function getDosesPerDay(frequency) {
  const f = frequency.toLowerCase();
  if (f.includes("6 hora") || f.includes("6h")) return 4;
  if (f.includes("8 hora") || f.includes("8h")) return 3;
  if (f.includes("12 hora") || f.includes("12h") || f.includes("2 veces")) return 2;
  if (f.includes("24 hora") || f.includes("1 vez") || f.includes("una vez")) return 1;
  if (f.includes("48 hora")) return 0.5;
  return 1;
}

function checkMedTime(frequency, now, advanceMinutes) {
  const dpd = getDosesPerDay(frequency);
  if (dpd <= 0) return false;
  const intervalMinutes = (24 * 60) / dpd;
  const minutesInDay = now.getHours() * 60 + now.getMinutes();
  for (let i = 0; i < dpd; i++) {
    const doseMinute = (i * intervalMinutes + advanceMinutes) % (24 * 60);
    if (Math.abs(minutesInDay - doseMinute) <= 5) return true;
  }
  return false;
}

function checkTreatmentTime(ti, now, advanceMinutes) {
  const [startH, startM] = ti.start_time.split(":").map(Number);
  const dpd = getDosesPerDay(ti.frequency || "");
  if (dpd <= 0) return false;
  const intervalMinutes = (24 * 60) / dpd;
  const startMinutes = startH * 60 + startM;
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  for (let i = 0; i < Math.ceil(dpd); i++) {
    const doseMinute = (startMinutes + i * intervalMinutes - advanceMinutes) % (24 * 60);
    if (Math.abs(nowMinutes - doseMinute) <= 5) return true;
  }
  return false;
}

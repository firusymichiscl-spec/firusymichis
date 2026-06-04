import { createClient } from "@supabase/supabase-js";

export async function GET(req) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  const now = new Date();
  const results = { sent: 0, errors: 0, skipped: 0 };

  const { data: prefs } = await supabase
    .from("notification_preferences")
    .select("*, pets(id, name, species, conditions)")
    .eq("enabled", true);

  for (const pref of (prefs || [])) {
    if (!pref.email || !pref.pet_id) { results.skipped++; continue; }
    const pet = pref.pets;
    if (!pet) { results.skipped++; continue; }

    // 1. MEDICAMENTOS HABITUALES
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
            const logKey = `${pref.pet_id}-${med.id}-low_stock`;
            const alreadySent = await checkRecentLog(supabase, pref.pet_id, "low_stock", logKey);
            if (!alreadySent) {
              const r = await sendNotif(pref.email, "low_stock", { petName: pet.name, medicationName: med.name, stockRemaining: med.stock });
              if (!r.error) {
                await logNotif(supabase, pref.user_id, pref.pet_id, "low_stock", logKey);
                results.sent++;
              } else results.errors++;
            }
          }
        }

        // Toma programada
        if (!checkMedTime(med.frequency, now, pref.advance_minutes)) continue;
        const logKey = `${pref.pet_id}-${med.id}-medication`;
        const alreadySent = await checkRecentLog(supabase, pref.pet_id, "medication", logKey);
        if (alreadySent) continue;

        const r = await sendNotif(pref.email, "medication", {
          petName: pet.name,
          medicationName: `${med.name}${med.dose ? ` — ${med.dose}` : ""}`,
          scheduledTime: now.toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" }),
        });
        if (!r.error) { await logNotif(supabase, pref.user_id, pref.pet_id, "medication", logKey); results.sent++; }
        else results.errors++;
      }
    }

    // 2. VACUNAS PRÓXIMAS
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

        const logKey = `${pref.pet_id}-${vac.id}-vaccine-${daysUntil}d`;
        const alreadySent = await checkRecentLog(supabase, pref.pet_id, "vaccine", logKey);
        if (alreadySent) continue;

        const r = await sendNotif(pref.email, "vaccine", {
          petName: pet.name,
          medicationName: vac.event,
          scheduledTime: new Date(vac.next_date).toLocaleDateString("es-CL"),
        });
        if (!r.error) { await logNotif(supabase, pref.user_id, pref.pet_id, "vaccine", logKey); results.sent++; }
        else results.errors++;
      }
    }

    // 3. TRATAMIENTOS
    if (pref.notify_medication_treatment) {
      const { data: treatments } = await supabase
        .from("treatment_items")
        .select("*")
        .eq("pet_id", pref.pet_id)
        .eq("active", true);

      for (const ti of (treatments || [])) {
        if (!ti.start_time || !ti.frequency) continue;
        if (!checkTreatmentTime(ti, now, pref.advance_minutes)) continue;

        const logKey = `${pref.pet_id}-${ti.id}-treatment`;
        const alreadySent = await checkRecentLog(supabase, pref.pet_id, "medication", logKey);
        if (alreadySent) continue;

        const r = await sendNotif(pref.email, "medication", {
          petName: pet.name,
          medicationName: `${ti.name}${ti.prescribed_dose ? ` — ${ti.prescribed_dose}` : ""}`,
          scheduledTime: now.toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" }),
        });
        if (!r.error) { await logNotif(supabase, pref.user_id, pref.pet_id, "medication", logKey); results.sent++; }
        else results.errors++;
      }
    }
  }

  return Response.json({ ok: true, timestamp: now.toISOString(), ...results });
}

async function checkRecentLog(supabase, petId, type, referenceId) {
  const { data } = await supabase
    .from("notification_logs")
    .select("id")
    .eq("pet_id", petId)
    .eq("type", type)
    .eq("reference_id", referenceId)
    .gte("sent_at", new Date(Date.now() - 2 * 3600000).toISOString())
    .single();
  return !!data;
}

async function logNotif(supabase, userId, petId, type, referenceId) {
  await supabase.from("notification_logs").insert({ user_id: userId, pet_id: petId, type, reference_id: referenceId });
}

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

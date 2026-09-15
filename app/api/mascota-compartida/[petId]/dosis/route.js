import { createClient } from "@supabase/supabase-js";
import { createRouteSupabase } from "@/lib/supabase-route";
import { getScheduledDoses } from "@/lib/doseSchedule";
import { logActivity } from "@/lib/activityLog";

function serviceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}

export async function POST(req, { params }) {
  const { petId } = await params;
  const supabase = await createRouteSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const { data: access } = await supabase
    .from("pet_access")
    .select("id, status")
    .eq("pet_id", petId)
    .eq("user_id", user.id)
    .eq("status", "accepted")
    .maybeSingle();
  if (!access) return Response.json({ error: "No tienes acceso a esta mascota." }, { status: 403 });

  const { treatmentItemId } = await req.json();
  if (!treatmentItemId) return Response.json({ error: "Falta treatmentItemId." }, { status: 400 });

  const svc = serviceClient();
  const { data: ti } = await svc.from("treatment_items").select("*").eq("id", treatmentItemId).eq("pet_id", petId).eq("active", true).single();
  if (!ti) return Response.json({ error: "Tratamiento no encontrado." }, { status: 404 });

  const { data: existingLogs } = await svc.from("dose_log").select("scheduled_at").eq("treatment_item_id", treatmentItemId);
  const loggedTimes = new Set((existingLogs || []).map(d => new Date(d.scheduled_at).getTime()));

  // Misma lógica que usa DoseTracker.jsx para el titular: se busca la
  // dosis PROGRAMADA sin registrar más cercana a ahora, no se inventa un
  // horario nuevo — así el registro calza con el cálculo de adherencia
  // que ya existe.
  const now = new Date();
  const windowStart = new Date(now.getTime() - 48 * 3600000);
  // Nunca se busca hacia adelante: la base de datos rechaza cualquier
  // scheduled_at futuro (trigger dose_log_no_future), así que `now` es
  // el límite superior de la ventana, no now + 12h.
  const scheduled = getScheduledDoses(ti, windowStart, now);
  const pending = scheduled.filter(d => !loggedTimes.has(d.getTime()));

  if (pending.length === 0) {
    return Response.json({ error: "No hay ninguna dosis programada pendiente cerca de ahora." }, { status: 400 });
  }
  pending.sort((a, b) => Math.abs(a - now) - Math.abs(b - now));
  const doseDate = pending[0];

  const { error } = await svc.from("dose_log").insert({
    pet_id: petId,
    treatment_item_id: treatmentItemId,
    scheduled_at: doseDate.toISOString(),
    status: "dada",
    marked_at: new Date().toISOString(),
  });
  if (error) return Response.json({ error: "No se pudo registrar la dosis." }, { status: 500 });

  // Descuento de stock vinculado (mismo comportamiento que ya tiene la
  // ficha del titular vía inventory_treatment_links) — best effort, no
  // bloquea el registro de la dosis si algo falla acá.
  try {
    const { data: link } = await svc.from("inventory_treatment_links").select("inventory_item_id").eq("treatment_item_id", treatmentItemId).maybeSingle();
    if (link) {
      const { data: invItem } = await svc.from("inventory_items").select("id, quantity").eq("id", link.inventory_item_id).single();
      if (invItem) {
        const upd = ti.units_per_dose || 1;
        await svc.from("inventory_items").update({ quantity: Math.max(0, parseFloat(invItem.quantity) - upd) }).eq("id", invItem.id);
      }
    }
  } catch {}

  await logActivity(svc, petId, "Marcó dosis dada", `${ti.name} · tutor suplente`);

  return Response.json({ success: true, scheduledAt: doseDate.toISOString() });
}

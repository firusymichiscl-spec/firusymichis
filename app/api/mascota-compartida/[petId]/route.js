import { createClient } from "@supabase/supabase-js";
import { createRouteSupabase } from "@/lib/supabase-route";

function serviceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}

export async function GET(req, { params }) {
  const { petId } = await params;
  const supabase = await createRouteSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  // Verifica acceso compartido aceptado — la RLS de pet_access (Fase 1)
  // ya permite esta lectura por user_id = auth.uid(), así que se usa el
  // cliente de sesión normal para este chequeo puntual.
  const { data: access } = await supabase
    .from("pet_access")
    .select("id, status")
    .eq("pet_id", petId)
    .eq("user_id", user.id)
    .eq("status", "accepted")
    .maybeSingle();

  if (!access) {
    return Response.json({ error: "No tienes acceso a esta mascota." }, { status: 403 });
  }

  // El suplente no es dueño de la mascota, así que la RLS normal de
  // estas tablas no lo dejaría leerlas — el chequeo de arriba es la
  // única puerta de entrada, y de acá para abajo se usa el cliente de
  // rol de servicio. Misma forma de consulta que ya usa la ficha del
  // titular en DashboardClient, para no arriesgar un esquema adivinado.
  const svc = serviceClient();

  const [petRes, medicationsRes, historyRes, treatmentItemsRes, doseLogRes] = await Promise.all([
    svc.from("pets").select("*").eq("id", petId).single(),
    svc.from("medications").select("*").eq("pet_id", petId).order("created_at", { ascending: false }),
    svc.from("medical_history").select("*").eq("pet_id", petId).order("event_date", { ascending: false }),
    svc.from("treatment_items").select("*, treatments(diagnostico, doctor, vet_clinic, emission_date, recipe_date)").eq("pet_id", petId).eq("active", true).order("created_at", { ascending: false }),
    svc.from("dose_log").select("*").eq("pet_id", petId),
  ]);

  if (!petRes.data) {
    return Response.json({ error: "Mascota no encontrada." }, { status: 404 });
  }

  return Response.json({
    pet: petRes.data,
    medications: medicationsRes.data || [],
    medicalHistory: historyRes.data || [],
    treatmentItems: treatmentItemsRes.data || [],
    doseLog: doseLogRes.data || [],
  });
}

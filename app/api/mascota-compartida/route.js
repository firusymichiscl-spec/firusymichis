import { createClient } from "@supabase/supabase-js";
import { createRouteSupabase } from "@/lib/supabase-route";

function serviceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}

// Lista las mascotas compartidas CON el usuario logueado (donde es el
// tutor suplente aceptado) — para mostrarlas en su propio overview.
export async function GET() {
  const supabase = await createRouteSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  // RLS de pet_access ya permite esta lectura (user_id = auth.uid()).
  const { data: access } = await supabase
    .from("pet_access")
    .select("pet_id, accepted_at")
    .eq("user_id", user.id)
    .eq("status", "accepted");

  if (!access || access.length === 0) return Response.json({ pets: [] });

  // El suplente no puede leer `pets` directo (RLS es solo para el
  // dueño) — se resuelven los datos básicos con el cliente de rol de
  // servicio, solo los campos necesarios para la tarjeta.
  const svc = serviceClient();
  const petIds = access.map(a => a.pet_id);
  const { data: petsData } = await svc
    .from("pets")
    .select("id, name, species, breed, photo_url, birth_date, user_id")
    .in("id", petIds);

  const ownerIds = [...new Set((petsData || []).map(p => p.user_id))];
  const { data: owners } = await svc.from("users").select("id, full_name").in("id", ownerIds);
  const ownersMap = Object.fromEntries((owners || []).map(o => [o.id, o.full_name]));

  const merged = (petsData || []).map(p => ({
    ...p,
    accepted_at: access.find(a => a.pet_id === p.id)?.accepted_at,
    ownerName: ownersMap[p.user_id] || null,
  }));

  return Response.json({ pets: merged });
}

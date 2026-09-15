import { createClient } from "@supabase/supabase-js";
import { createRouteSupabase } from "@/lib/supabase-route";

function serviceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}

const EXPIRY_MS = 24 * 60 * 60 * 1000;

// GET — datos para mostrar la pantalla de invitación (nombre de la
// mascota, quién invitó, si venció). Exige sesión.
export async function GET(req, { params }) {
  const { token } = await params;
  const supabase = await createRouteSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  // RLS de pet_access ya permite leer esta fila si el email coincide con
  // el del usuario logueado (o si es quien invitó) — cliente de sesión,
  // no de rol de servicio, para esta parte.
  const { data: access } = await supabase
    .from("pet_access")
    .select("id, pet_id, email, status, created_at, invited_by")
    .eq("invite_token", token)
    .maybeSingle();

  if (!access) {
    return Response.json({ error: "Invitación no encontrada." }, { status: 404 });
  }

  const emailMatches = access.email.toLowerCase() === (user.email || "").toLowerCase();
  if (!emailMatches) {
    return Response.json({ error: "Esta invitación es para otro correo." }, { status: 403 });
  }

  const expired = Date.now() - new Date(access.created_at).getTime() > EXPIRY_MS;

  // El nombre de la mascota y de quien invita no son visibles por RLS
  // para el tutor suplente (no es dueño de la mascota) — se resuelven
  // acá con el cliente de rol de servicio, solo estos dos datos puntuales.
  const svc = serviceClient();
  const { data: pet } = await svc.from("pets").select("name").eq("id", access.pet_id).single();
  const { data: inviterRow } = await svc.from("users").select("full_name").eq("id", access.invited_by).single();

  return Response.json({
    petName: pet?.name || "una mascota",
    inviterName: inviterRow?.full_name || "alguien",
    status: access.status,
    expired,
  });
}

// POST — acepta la invitación (vincula el user_id, marca aceptada).
export async function POST(req, { params }) {
  const { token } = await params;
  const supabase = await createRouteSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const { data: access } = await supabase
    .from("pet_access")
    .select("id, email, status, created_at")
    .eq("invite_token", token)
    .maybeSingle();

  if (!access) return Response.json({ error: "Invitación no encontrada." }, { status: 404 });

  const emailMatches = access.email.toLowerCase() === (user.email || "").toLowerCase();
  if (!emailMatches) return Response.json({ error: "Esta invitación es para otro correo." }, { status: 403 });

  if (access.status === "accepted") {
    return Response.json({ success: true, alreadyAccepted: true });
  }

  const expired = Date.now() - new Date(access.created_at).getTime() > EXPIRY_MS;
  if (expired) return Response.json({ error: "Esta invitación venció. Pide que te inviten de nuevo." }, { status: 410 });

  const { error } = await supabase
    .from("pet_access")
    .update({ user_id: user.id, status: "accepted", accepted_at: new Date().toISOString() })
    .eq("id", access.id);

  if (error) return Response.json({ error: "No se pudo aceptar la invitación." }, { status: 500 });

  return Response.json({ success: true });
}

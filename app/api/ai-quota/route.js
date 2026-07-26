import { createClient } from "@supabase/supabase-js";
import { createRouteSupabase } from "@/lib/supabase-route";
import { getPetQuotaStatus } from "@/lib/ai/quota";

function serviceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}

// Lectura de la cuota de IA de una mascota (sin incrementar). La usa
// AITab para mostrar "Consultas disponibles hoy" antes de enviar.
export async function GET(req) {
  const supabase = await createRouteSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const { searchParams } = new URL(req.url);
  const petId = searchParams.get("petId");
  const tipo = searchParams.get("tipo");

  if (!petId || !tipo) {
    return Response.json({ error: "Faltan parámetros" }, { status: 400 });
  }

  const svc = serviceClient();
  const { data: ownedPet } = await svc
    .from("pets")
    .select("id")
    .eq("id", petId)
    .eq("user_id", user.id)
    .single();
  if (!ownedPet) return new Response("Forbidden", { status: 403 });

  const status = await getPetQuotaStatus(supabase, petId, tipo);
  return Response.json(status);
}

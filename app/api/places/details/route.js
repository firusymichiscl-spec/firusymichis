import { NextResponse } from "next/server";
import { createRouteSupabase } from "@/lib/supabase-route";
import { checkPlacesDetailsQuota, recordAiUsage } from "@/lib/ai/quota";

const CACHE_DAYS = 30;
// place_id de Google: letras/números/guion/guion bajo. Cualquier otra
// cosa se rechaza en vez de pasarla cruda a Google.
const PLACE_ID_RE = /^[A-Za-z0-9_-]{10,200}$/;

export async function GET(req) {
  const supabase = await createRouteSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const quota = await checkPlacesDetailsQuota(user.id);
  if (!quota.allowed) {
    return NextResponse.json({ error: "Alcanzaste el límite diario de consultas de detalle. Vuelve mañana." }, { status: 429 });
  }

  const { searchParams } = new URL(req.url);
  const placeId = searchParams.get("place_id") || "";
  if (!PLACE_ID_RE.test(placeId)) {
    return NextResponse.json({ error: "place_id inválido." }, { status: 400 });
  }

  // 1) Caché — evita pagarle a Google por la misma clínica de nuevo.
  const cutoff = new Date(Date.now() - CACHE_DAYS * 86400000).toISOString();
  const { data: cached } = await supabase
    .from("vet_details_cache")
    .select("phone, website, fetched_at")
    .eq("place_id", placeId)
    .maybeSingle();

  if (cached && cached.fetched_at > cutoff) {
    return NextResponse.json({ phone: cached.phone, website: cached.website, cached: true });
  }

  // 2) Google Place Details — solo los dos campos que necesitamos.
  const key = process.env.GOOGLE_PLACES_SERVER_KEY;
  const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${encodeURIComponent(placeId)}&fields=formatted_phone_number,website&key=${key}`;
  const res = await fetch(url);
  const data = await res.json();

  const phone = data.result?.formatted_phone_number || null;
  const website = data.result?.website || null;

  // 3) Guardar/actualizar caché (upsert por place_id).
  const { error: upsertError } = await supabase
    .from("vet_details_cache")
    .upsert({ place_id: placeId, phone, website, fetched_at: new Date().toISOString() });
  if (upsertError) console.error("[places/details] upsert error:", upsertError);

  await recordAiUsage(user.id, "places_details");
  return NextResponse.json({ phone, website, cached: false });
}

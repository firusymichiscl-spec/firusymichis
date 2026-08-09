import { NextResponse } from "next/server";
import { createRouteSupabase } from "@/lib/supabase-route";
import { checkPlacesQuota, recordAiUsage } from "@/lib/ai/quota";

// Radios que ofrece la UI (VetMapTab.jsx) — cualquier otro valor se rechaza
// en vez de pasarlo tal cual a Google.
const ALLOWED_RADII = [1000, 3000, 5000, 10000, 20000];

function isValidLat(n) { return Number.isFinite(n) && n >= -90 && n <= 90; }
function isValidLng(n) { return Number.isFinite(n) && n >= -180 && n <= 180; }

export async function GET(req) {
  // Lote K1 — antes este proxy no exigía sesión: cualquiera podía llamarlo
  // directo y consumir la cuota/costo de la API key de Google del proyecto.
  const supabase = await createRouteSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const quota = await checkPlacesQuota(user.id);
  if (!quota.allowed) {
    return NextResponse.json({ error: "Alcanzaste el límite diario de búsquedas de veterinarias. Vuelve mañana." }, { status: 429 });
  }

  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q") || "";
  const latParam = searchParams.get("lat");
  const lngParam = searchParams.get("lng");
  const openNow = searchParams.get("open_now") === "true";

  // lat/lng son opcionales (búsqueda solo por texto, ej. autocompletar
  // clínica), pero si viene uno de los dos deben venir los dos, y ambos
  // tienen que ser números reales dentro de rango — nunca se pasan crudos.
  let lat = null, lng = null;
  if (latParam !== null || lngParam !== null) {
    lat = Number(latParam);
    lng = Number(lngParam);
    if (!isValidLat(lat) || !isValidLng(lng)) {
      return NextResponse.json({ error: "Ubicación inválida." }, { status: 400 });
    }
  }

  let radius = 3000;
  if (searchParams.has("radius")) {
    radius = Number(searchParams.get("radius"));
    if (!ALLOWED_RADII.includes(radius)) {
      return NextResponse.json({ error: "Radio de búsqueda inválido." }, { status: 400 });
    }
  }

  const key = process.env.GOOGLE_PLACES_SERVER_KEY;

  let url;
  if (lat !== null && lng !== null) {
    url = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${lat},${lng}&radius=${radius}&type=veterinary_care&keyword=${encodeURIComponent(q)}&key=${key}${openNow ? "&opennow=true" : ""}`;
  } else {
    url = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=veterinaria+${encodeURIComponent(q)}&region=cl&language=es&locationbias=circle:500000@-33.4489,-70.6693&key=${key}`;
  }

  const res = await fetch(url);
  const data = await res.json();
  await recordAiUsage(user.id, "places_search");
  return NextResponse.json({ results: data.results || [] });
}

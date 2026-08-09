import { createClient } from "@supabase/supabase-js";

export async function POST(req) {
  // GUARD — Lote K1: el marketplace está desactivado a la espera de
  // revisión legal (ver también el guard de app/marketplace/page.jsx,
  // Lote J). Esta ruta además nunca tuvo autenticación ni validación de
  // ownership del listing_id — escribía en marketplace_matches con service
  // role a partir de lo que mandara cualquiera (ver auditoría de
  // seguridad). Se deshabilita acá en vez de solo confiar en que la UI no
  // la llame, porque la ruta seguía respondiendo igual por URL directa.
  //
  // Para reactivar el módulo: quitar este guard Y agregar autenticación
  // real (auth.getUser() + verificar que el listing/request pertenezcan al
  // usuario correspondiente) antes de volver a exponerlo — la lógica de
  // abajo no se tocó, sigue tal cual estaba.
  return new Response("Not Found", { status: 404 });
}

async function POST_disabled(req) {
  const { listing_id } = await req.json();

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  const { data: listing } = await supabase
    .from("marketplace_listings")
    .select("*")
    .eq("id", listing_id)
    .single();

  if (!listing) return Response.json({ matches: 0 });

  const { data: requests } = await supabase
    .from("marketplace_requests")
    .select("*")
    .eq("status", "searching")
    .ilike("medication_name", `%${listing.name.split(" ")[0]}%`);

  const matches = [];
  for (const req of (requests || [])) {
    if (req.user_id === listing.user_id) continue;
    if (req.max_price_clp && listing.price_clp > req.max_price_clp) continue;

    const platform_fee = Math.round(listing.price_clp * 0.25);
    const seller_payout = listing.price_clp - platform_fee;

    const { data: match } = await supabase
      .from("marketplace_matches")
      .insert({
        listing_id: listing.id,
        request_id: req.id,
        buyer_user_id: req.user_id,
        seller_user_id: listing.user_id,
        final_price_clp: listing.price_clp,
        platform_fee_clp: platform_fee,
        seller_payout_clp: seller_payout,
        status: "pending",
      })
      .select()
      .single();

    if (match) matches.push(match);
  }

  return Response.json({ matches: matches.length });
}

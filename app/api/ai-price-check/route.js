import Anthropic from "@anthropic-ai/sdk";
import { createRouteSupabase } from "@/lib/supabase-route";
import { checkAiQuota } from "@/lib/ai/quota";

export async function POST(req) {
  // Auth
  const supabase = await createRouteSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  // Cuota (no ownership check — listing doesn't exist yet at price-check time)
  const quota = await checkAiQuota(user.id, "price_check");
  if (!quota.allowed) {
    return Response.json(
      { error: "Alcanzaste tu límite diario de consultas IA. Vuelve mañana o pásate a PRO 🐾" },
      { status: 429 }
    );
  }

  const { name, quantity, unit, price_clp } = await req.json();
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const message = await client.messages.create({
    model: "claude-sonnet-4-5",
    max_tokens: 1024,
    messages: [{
      role: "user",
      content: `Eres un experto en precios de medicamentos veterinarios en Chile.
      El tutor quiere vender: ${name}, ${quantity} ${unit} a $${price_clp} CLP.

      Analiza si el precio es justo considerando:
      1. Precio de mercado aproximado en Chile de este medicamento veterinario
      2. Si el precio pedido es razonable, alto o bajo
      3. Precio sugerido por el sistema (con margen del 25% para la plataforma)

      Responde SOLO en JSON sin backticks:
      {
        "precio_mercado_estimado": 0,
        "evaluacion": "justo|alto|bajo",
        "precio_sugerido_venta": 0,
        "precio_plataforma": 0,
        "pago_vendedor": 0,
        "analisis": "texto breve en español",
        "recomendacion": "texto breve en español"
      }

      El precio_sugerido_venta debe ser el precio que paga el comprador.
      El precio_plataforma es el 25% del precio_sugerido_venta.
      El pago_vendedor es el 75% del precio_sugerido_venta.`
    }]
  });

  try {
    const txt = message.content[0].text;
    const json = JSON.parse(txt.replace(/```json|```/g, "").trim());
    return Response.json(json, { headers: { "X-AI-Remaining": String(quota.remaining) } });
  } catch {
    return Response.json({ error: "No se pudo analizar el precio" }, { status: 500 });
  }
}

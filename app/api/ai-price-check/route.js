import Anthropic from "@anthropic-ai/sdk";
import { createRouteSupabase } from "@/lib/supabase-route";
import { checkAiQuota, recordAiUsage } from "@/lib/ai/quota";
import { ANTI_INJECTION_REINFORCEMENT } from "@/lib/ai/prompts";

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

  // Límites server-side (Lote K1) — el cliente ya valida, pero es evitable.
  if (typeof name !== "string" || !name.trim()) {
    return Response.json({ error: "Ingresa el nombre del medicamento." }, { status: 400 });
  }
  if (name.length > 200) {
    return Response.json({ error: "El nombre del medicamento no puede superar los 200 caracteres." }, { status: 400 });
  }
  const qty = Number(quantity);
  if (!Number.isFinite(qty) || qty <= 0 || qty > 100000) {
    return Response.json({ error: "La cantidad debe ser un número válido." }, { status: 400 });
  }
  const price = Number(price_clp);
  if (!Number.isFinite(price) || price <= 0 || price > 100_000_000) {
    return Response.json({ error: "El precio debe ser un número válido en pesos chilenos." }, { status: 400 });
  }

  // Lote K2 — mismo patrón que ai-analyze/ai-symptoms/ai-recipe: instrucciones
  // en `system`, dato del usuario (name/unit son texto libre) delimitado
  // dentro de <publicacion> en el turno "user".
  const systemPrompt = `Eres un experto en precios de medicamentos veterinarios en Chile. Vas a recibir los datos de una publicación de venta dentro de las etiquetas <publicacion></publicacion> en el mensaje del usuario. Analiza si el precio es justo considerando:
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
El pago_vendedor es el 75% del precio_sugerido_venta.

${ANTI_INJECTION_REINFORCEMENT}`;

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  // Antes esta llamada no tenía try/catch: si Claude fallaba (red, rate
  // limit, etc.) la excepción quedaba sin manejar y Next.js devolvía una
  // página de error genérica en vez de JSON — el cliente reventaba al
  // intentar res.json() sobre eso (Lote K1, bug 2).
  try {
    const message = await client.messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: 1024,
      system: systemPrompt,
      messages: [{
        role: "user",
        content: `<publicacion>\nMedicamento: ${name}\nCantidad: ${quantity} ${unit}\nPrecio pedido: $${price_clp} CLP\n</publicacion>`
      }]
    });

    const txt = message.content[0].text;
    const json = JSON.parse(txt.replace(/```json|```/g, "").trim());

    // Solo se consume cuota si Claude respondió Y el JSON se pudo parsear.
    await recordAiUsage(user.id, "price_check");

    return Response.json(json, { headers: { "X-AI-Remaining": String(Math.max(0, quota.remaining - 1)) } });
  } catch (e) {
    console.error("[ai-price-check] error:", e);
    return Response.json({ error: "No pudimos analizar el precio. Intenta nuevamente en unos minutos." }, { status: 500 });
  }
}

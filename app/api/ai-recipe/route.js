import Anthropic from "@anthropic-ai/sdk";
import { createRouteSupabase } from "@/lib/supabase-route";
import { checkAiQuota } from "@/lib/ai/quota";

const BASE64_MAX_LENGTH = 7_000_000;

export async function POST(req) {
  // Auth
  const supabase = await createRouteSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const body = await req.json();
  const { imageBase64, mediaType } = body;

  // Server-side payload size guard
  if (!imageBase64 || imageBase64.length > BASE64_MAX_LENGTH) {
    return Response.json({ error: "Imagen muy pesada" }, { status: 400 });
  }

  // Cuota
  const quota = await checkAiQuota(user.id, "recipe");
  if (!quota.allowed) {
    return Response.json(
      { error: "Alcanzaste tu límite diario de consultas IA. Vuelve mañana o pásate a PRO 🐾" },
      { status: 429 }
    );
  }

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  try {
    const message = await client.messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: 1024,
      messages: [{
        role: "user",
        content: [
          { type: "image", source: { type: "base64", media_type: mediaType || "image/jpeg", data: imageBase64 } },
          { type: "text", text: `Eres asistente veterinario. Analiza esta receta veterinaria y devuelve SOLO un array JSON válido sin backticks ni markdown. Cada elemento del array representa un medicamento con estos campos exactos: [{"medicamento":"","dosis_recetada":"","frecuencia":"","duracion":"","indicaciones":"","notas":""}]. Si hay múltiples medicamentos en la receta, incluye todos en el array.` }
        ]
      }]
    });

    const txt = message.content[0].text;
    try {
      const clean = txt.replace(/```json|```/g, "").trim();
      const arr = JSON.parse(clean);
      return Response.json(
        { result: Array.isArray(arr) ? arr : [arr] },
        { headers: { "X-AI-Remaining": String(quota.remaining) } }
      );
    } catch {
      return Response.json({ error: "No se pudo procesar la receta" });
    }
  } catch (e) {
    console.error("[ai-recipe] error:", e);
    return Response.json({ error: e.message }, { status: 500 });
  }
}

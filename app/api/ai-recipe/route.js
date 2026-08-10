import Anthropic from "@anthropic-ai/sdk";
import { createRouteSupabase } from "@/lib/supabase-route";
import { checkAiQuota, recordAiUsage } from "@/lib/ai/quota";
import { detectImageMediaType } from "@/lib/images/magicBytes";
import { ANTI_INJECTION_REINFORCEMENT } from "@/lib/ai/prompts";

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

  // Lote K2 — antes se confiaba en el mediaType que declara el cliente sin
  // mirar los bytes reales. Se detecta el tipo real por firma (magic bytes)
  // y, si el cliente declaró algo distinto de lo que realmente es, se
  // rechaza en vez de "corregirlo" en silencio: un mismatch es una señal de
  // que algo no debería estar pasando (bug de un cliente futuro, o alguien
  // probando el endpoint directo), y taparlo con el valor detectado
  // ocultaría ese caso en vez de exponerlo. De todas formas, a Claude
  // siempre se le manda el media_type detectado por bytes, nunca el
  // declarado — ver más abajo.
  const detectedType = detectImageMediaType(imageBase64);
  if (!detectedType) {
    return Response.json({ error: "El archivo no parece ser una imagen JPEG, PNG o WebP válida." }, { status: 400 });
  }
  if (mediaType && mediaType !== detectedType) {
    return Response.json({ error: "El tipo de imagen declarado no coincide con el archivo. Vuelve a intentar subiendo la foto de nuevo." }, { status: 400 });
  }

  // Cuota
  const quota = await checkAiQuota(user.id, "recipe");
  if (!quota.allowed) {
    return Response.json(
      { error: "Alcanzaste tu límite diario de consultas IA. Vuelve mañana o pásate a PRO 🐾" },
      { status: 429 }
    );
  }

  // Lote K2 — instrucciones en `system`. Este es el endpoint más expuesto a
  // inyección de los 3: el "dato del usuario" es una imagen, y un texto
  // adversarial escrito a mano en la foto de la receta (una nota, un post-it,
  // lo que sea) llega a Claude igual que el texto de la receta real. El
  // texto de refuerzo cubre explícitamente el contenido de imágenes.
  const systemPrompt = `Eres un asistente veterinario. Vas a recibir una foto de una receta veterinaria adjunta como imagen. Analízala y devuelve SOLO un array JSON válido sin backticks ni markdown. Cada elemento del array representa un medicamento con estos campos exactos: [{"medicamento":"","dosis_recetada":"","frecuencia":"","duracion":"","indicaciones":"","notas":""}]. Si hay múltiples medicamentos en la receta, incluye todos en el array.

${ANTI_INJECTION_REINFORCEMENT}`;

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  try {
    const message = await client.messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: 1024,
      system: systemPrompt,
      messages: [{
        role: "user",
        content: [
          { type: "image", source: { type: "base64", media_type: detectedType, data: imageBase64 } },
        ]
      }]
    });

    // Solo se consume cuota si Claude respondió con éxito.
    await recordAiUsage(user.id, "recipe");

    const txt = message.content[0].text;
    try {
      const clean = txt.replace(/```json|```/g, "").trim();
      const arr = JSON.parse(clean);
      return Response.json(
        { result: Array.isArray(arr) ? arr : [arr] },
        { headers: { "X-AI-Remaining": String(Math.max(0, quota.remaining - 1)) } }
      );
    } catch {
      // Faltaba el status acá — sin él, esta respuesta de error salía como
      // 200 OK, así que un cliente que solo mirara res.ok la habría tomado
      // como éxito (Lote K1, bug 2).
      return Response.json({ error: "No se pudo procesar la receta. Intenta con una foto más clara." }, { status: 422 });
    }
  } catch (e) {
    // Detalle real solo en consola del servidor — nunca texto técnico en
    // inglés al usuario.
    console.error("[ai-recipe] error:", e);
    return Response.json({ error: "No pudimos leer la receta. Intenta nuevamente en unos minutos." }, { status: 500 });
  }
}

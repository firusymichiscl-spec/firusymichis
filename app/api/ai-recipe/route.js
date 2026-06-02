import Anthropic from "@anthropic-ai/sdk";

export async function POST(req) {
  const { imageBase64, mediaType } = await req.json();
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
      return Response.json({ result: Array.isArray(arr) ? arr : [arr] });
    } catch {
      return Response.json({ error: "No se pudo procesar la receta" });
    }
  } catch (e) {
    console.error("[ai-recipe] error:", e);
    return Response.json({ error: e.message }, { status: 500 });
  }
}

import Anthropic from "@anthropic-ai/sdk";

export async function POST(req) {
  const { imageBase64, mediaType } = await req.json();
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  try {
    const message = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1024,
      messages: [{
        role: "user",
        content: [
          { type: "image", source: { type: "base64", media_type: mediaType || "image/jpeg", data: imageBase64 } },
          { type: "text", text: `Eres asistente veterinario. Analiza esta receta veterinaria y devuelve SOLO un objeto JSON válido sin backticks ni markdown, con estos campos exactos: {"medicamento":"","dosis":"","frecuencia":"","duracion":"","indicaciones":"","veterinario":"","fecha":"","notas":""}` }
        ]
      }]
    });
    const txt = message.content[0].text;
    try {
      const json = JSON.parse(txt.replace(/```json|```/g, "").trim());
      return Response.json({ result: json });
    } catch {
      return Response.json({ error: "No se pudo procesar la receta" });
    }
  } catch (e) {
    console.error("[ai-recipe] error:", e);
    return Response.json({ error: e.message }, { status: 500 });
  }
}

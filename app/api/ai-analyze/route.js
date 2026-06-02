import Anthropic from "@anthropic-ai/sdk";

export async function POST(req) {
  const { pet, medications, history } = await req.json();
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const petContext = `
Mascota: ${pet.name}, ${pet.species === "dog" ? "Perro" : pet.species === "cat" ? "Gato" : "Otro"}, ${pet.breed || "raza desconocida"}
Edad: calculada desde ${pet.birth_date || "desconocida"}
Peso: ${pet.weight_kg || "desconocido"} kg
Condiciones: ${pet.conditions?.join(", ") || "ninguna"}
Medicamentos activos: ${medications?.filter(m => m.active).map(m => `${m.name} ${m.dose} ${m.frequency}`).join(", ") || "ninguno"}
Dieta: ${pet.diet || "no especificada"}
Alergias: ${pet.allergies?.join(", ") || "ninguna"}
Historial reciente: ${history?.slice(0, 5).map(h => `${h.event_date}: ${h.event}`).join(" | ") || "sin historial"}
  `;

  const message = await client.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 1024,
    messages: [{
      role: "user",
      content: `Eres un asistente veterinario experto. Analiza esta mascota y da recomendaciones prácticas y personalizadas en español. Incluye suplementos naturales, productos de farmacia veterinaria, cuidados preventivos y tips según su raza, edad y condiciones. Sé concreto y menciona nombres de productos cuando sea posible. Máximo 5 recomendaciones claras. Contexto: ${petContext}`
    }]
  });

  return Response.json({ result: message.content[0].text });
}

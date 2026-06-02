import Anthropic from "@anthropic-ai/sdk";

export async function POST(req) {
  const { pet, medications, history, symptom } = await req.json();
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const petContext = `
Mascota: ${pet.name}, ${pet.species === "dog" ? "Perro" : pet.species === "cat" ? "Gato" : "Otro"}, ${pet.breed || "raza desconocida"}
Edad: calculada desde ${pet.birth_date || "desconocida"}
Peso: ${pet.weight_kg || "desconocido"} kg
Condiciones: ${pet.conditions?.join(", ") || "ninguna"}
Medicamentos activos: ${medications?.filter(m => m.active).map(m => `${m.name} ${m.dose} ${m.frequency}`).join(", ") || "ninguno"}
Alergias: ${pet.allergies?.join(", ") || "ninguna"}
Historial médico: ${history?.slice(0, 8).map(h => `${h.event_date} (${h.type}): ${h.event}${h.vet_clinic ? " en " + h.vet_clinic : ""}`).join(" | ") || "sin historial"}
  `;

  try {
    const message = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1024,
      messages: [{
        role: "user",
        content: `Eres un asistente veterinario experto. El tutor describe este síntoma: "${symptom}". Analiza considerando el historial completo de la mascota. Responde en español con: 1) Posible causa considerando el historial, 2) Qué hacer de inmediato (productos, cuidados), 3) Si debe ir al veterinario y con qué urgencia, 4) Si tiene historial en alguna clínica específica, recomienda volver ahí. Sé directo y práctico. Incluye siempre un aviso de que esto no reemplaza la consulta veterinaria. Contexto: ${petContext}`
      }]
    });
    return Response.json({ result: message.content[0].text });
  } catch (e) {
    console.error("[ai-symptoms] error:", e);
    return Response.json({ error: e.message }, { status: 500 });
  }
}

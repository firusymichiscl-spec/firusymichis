import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@supabase/supabase-js";
import { createRouteSupabase } from "@/lib/supabase-route";
import { checkAiQuota, recordAiUsage, getPetQuotaStatus, recordPetUsage } from "@/lib/ai/quota";
import { formatFecha } from "@/lib/fechas";
import { ANTI_INJECTION_REINFORCEMENT } from "@/lib/ai/prompts";

function serviceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}

export async function POST(req) {
  // Auth
  const supabase = await createRouteSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const { pet, medications, history, symptom } = await req.json();

  // Límite server-side (Lote K1) — el cliente ya valida, pero es evitable
  // llamando la API directo. Un symptom gigante encarece la llamada a
  // Claude antes de que la cuota diaria pueda frenar el siguiente intento.
  const SYMPTOM_MAX_LENGTH = 1000;
  if (typeof symptom !== "string" || !symptom.trim()) {
    return Response.json({ error: "Cuéntanos qué le está pasando a tu mascota 🐾" }, { status: 400 });
  }
  if (symptom.length > SYMPTOM_MAX_LENGTH) {
    return Response.json({ error: `La descripción del síntoma no puede superar los ${SYMPTOM_MAX_LENGTH} caracteres. Intenta resumirla un poco 🐾` }, { status: 400 });
  }

  // Ownership
  if (pet?.id) {
    const svc = serviceClient();
    const { data: ownedPet } = await svc
      .from("pets")
      .select("id")
      .eq("id", pet.id)
      .eq("user_id", user.id)
      .single();
    if (!ownedPet) return new Response("Forbidden", { status: 403 });
  }

  // Cuota por usuario
  const quota = await checkAiQuota(user.id, "symptoms");
  if (!quota.allowed) {
    return Response.json(
      { error: "Alcanzaste tu límite diario de consultas IA. Vuelve mañana o pásate a PRO 🐾" },
      { status: 429 }
    );
  }

  // Cuota por mascota (se suma a la de usuario — gana la más restrictiva)
  const petQuota = await getPetQuotaStatus(supabase, pet?.id, "symptoms");
  if (!petQuota.allowed) {
    const msg = petQuota.motivo === "diaria"
      ? `Ya hiciste una consulta de síntomas para ${pet.name} hoy. Podrás hacer otra mañana 🐾`
      : `Alcanzaste el máximo de 2 consultas semanales para ${pet.name}. Podrás hacer otra el ${formatFecha(petQuota.disponibleEn)}.`;
    return Response.json({ error: msg }, { status: 429 });
  }

  const petContext = `
Mascota: ${pet.name}, ${pet.species === "dog" ? "Perro" : pet.species === "cat" ? "Gato" : "Otro"}, ${pet.breed || "raza desconocida"}
Edad: calculada desde ${pet.birth_date || "desconocida"}
Peso: ${pet.weight_kg || "desconocido"} kg
Condiciones: ${pet.conditions?.join(", ") || "ninguna"}
Medicamentos activos: ${medications?.filter(m => m.active).map(m => `${m.name} ${m.dose} ${m.frequency}`).join(", ") || "ninguno"}
Alergias: ${pet.allergies?.join(", ") || "ninguna"}
Historial médico: ${history?.slice(0, 8).map(h => `${h.event_date} (${h.type}): ${h.event}${h.vet_clinic ? " en " + h.vet_clinic : ""}`).join(" | ") || "sin historial"}
  `;

  // Lote K2 — instrucciones en `system`, dato del usuario delimitado. El
  // síntoma es el campo de texto libre más expuesto de los 3 endpoints (lo
  // escribe el usuario a mano, sin estructura), así que va en su propia
  // etiqueta <sintoma> separada de la ficha.
  const systemPrompt = `Eres un asistente veterinario experto. Vas a recibir el síntoma que describe un tutor dentro de las etiquetas <sintoma></sintoma>, junto con la ficha de la mascota dentro de <ficha_mascota></ficha_mascota>, ambos en el mensaje del usuario. Analiza el síntoma considerando el historial completo de la mascota y responde en español latinoamericano con buena ortografía y gramática. Estructura tu respuesta en 4 secciones claramente separadas: 1) Posible causa considerando el historial, 2) Qué hacer de inmediato (productos y cuidados concretos), 3) Urgencia de ir al veterinario, 4) Si tiene historial en alguna clínica conocida, recomienda volver ahí. Finaliza siempre con un aviso de que esto no reemplaza la consulta veterinaria.

${ANTI_INJECTION_REINFORCEMENT}`;

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  try {
    const message = await client.messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: 1024,
      system: systemPrompt,
      messages: [{
        role: "user",
        content: `<sintoma>${symptom}</sintoma>\n<ficha_mascota>${petContext}</ficha_mascota>`
      }]
    });
    // Solo se consume cuota si Claude respondió con éxito.
    await recordAiUsage(user.id, "symptoms");
    await recordPetUsage(supabase, user.id, pet?.id, "symptoms");

    return Response.json(
      { result: message.content[0].text },
      { headers: { "X-AI-Remaining": String(Math.max(0, quota.remaining - 1)) } }
    );
  } catch (e) {
    // Detalle real solo en consola del servidor — nunca texto técnico en
    // inglés al usuario (Lote K1, bug 2).
    console.error("[ai-symptoms] error:", e);
    return Response.json({ error: "No pudimos analizar el síntoma. Intenta nuevamente en unos minutos." }, { status: 500 });
  }
}

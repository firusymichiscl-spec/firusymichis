import Anthropic from "@anthropic-ai/sdk";
import { createRouteSupabase } from "@/lib/supabase-route";
import { checkAiQuota, recordAiUsage } from "@/lib/ai/quota";
import { detectImageMediaType } from "@/lib/images/magicBytes";
import { ANTI_INJECTION_REINFORCEMENT } from "@/lib/ai/prompts";

const BASE64_MAX_LENGTH = 7_000_000;

// URGENTE (post Lote M) — parseo tolerante: Claude a veces antepone o
// agrega texto/explicación alrededor de la respuesta pese a que el prompt
// pide "SOLO JSON" (más probable cuanto más compleja es la instrucción —
// ver la simplificación de "phases" más abajo). Se limpian los fences de
// markdown y se recorta todo lo que quede antes/después de la estructura
// real antes de intentar parsear. Esto NO arregla una respuesta
// genuinamente truncada a la mitad (no hay cierre real que encontrar) —
// para eso ver el razonamiento de max_tokens más abajo.
//
// Lote Q — el formato pasó de un array pelado de medicamentos a un objeto
// {"medicamentos":[...],"veterinario":...} para poder devolver también los
// datos del veterinario/clínica sin romper la forma de "result" que ya
// consume AITab.jsx. Se detecta cuál delimitador ({ o [) aparece primero
// en el texto para soportar AMBOS formatos: el nuevo objeto, y — por si
// Claude alguna vez ignora la instrucción y vuelve a devolver el array
// pelado de antes — ese formato viejo también sigue aceptándose (ver el
// fallback en el catch de abajo). Nunca vale la pena romper la extracción
// de medicamentos por un cambio de formato en los datos secundarios.
function extractJson(text) {
  const stripped = text.replace(/```json|```/g, "").trim();
  const firstBrace = stripped.indexOf("{");
  const firstBracket = stripped.indexOf("[");
  if (firstBrace !== -1 && (firstBracket === -1 || firstBrace < firstBracket)) {
    const end = stripped.lastIndexOf("}");
    if (end !== -1 && end > firstBrace) return stripped.slice(firstBrace, end + 1);
  }
  if (firstBracket !== -1) {
    const end = stripped.lastIndexOf("]");
    if (end !== -1 && end > firstBracket) return stripped.slice(firstBracket, end + 1);
  }
  return stripped;
}

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
  // URGENTE (post Lote M) — este prompt se simplificó a propósito: la
  // versión anterior explicaba "phases" en 4 párrafos, y las recetas con
  // varios medicamentos empezaron a devolver JSON inválido/cortado (ver
  // nota de max_tokens más abajo). La prioridad absoluta es que la
  // extracción de medicamentos funcione — "phases" es secundario y se le
  // dedica una sola frase para no competirle presupuesto de tokens ni
  // complejidad a lo esencial.
  //
  // Lote Q — se agregan veterinario/clínica/dirección, con el mismo
  // cuidado: UN párrafo corto, y explícitamente subordinado a "si dudas,
  // null y sigue" para no repetir el incidente de Lote M. A diferencia de
  // "phases" (que se repite por CADA medicamento y fue lo que realmente
  // infló la respuesta la vez pasada), estos 3 campos son top-level y
  // aparecen UNA sola vez sin importar cuántos medicamentos traiga la
  // receta — el costo marginal en tokens es mínimo, no hace falta subir
  // max_tokens por esto (ver el comentario junto a max_tokens más abajo).
  const systemPrompt = `Eres un asistente veterinario. Vas a recibir una foto de una receta veterinaria adjunta como imagen. Analízala y devuelve SOLO un objeto JSON válido sin backticks ni markdown ni texto antes o después, con esta forma exacta: {"medicamentos":[{"medicamento":"","dosis_recetada":"","frecuencia":"","duracion":"","indicaciones":"","notas":"","phases":null}],"veterinario":null,"clinica":null,"direccion":null}. Si hay múltiples medicamentos en la receta, incluye todos en "medicamentos" — esto es lo más importante, prioriza extraerlos todos bien.

"frecuencia" es siempre texto libre legible (ej. "Cada 12 horas por 1 día, luego cada 24 horas por 3 días, luego día por medio").

"phases" es opcional y secundario — solo complétalo si es sencillo y estás seguro: un array [{"interval_hours":N,"duration_days":M}], un elemento por cada fase de la receta en orden (48 = día por medio; duration_days:null solo en la última fase si no tiene fin). Si dudas de los intervalos o la frecuencia no es un número fijo de horas, deja "phases":null y sigue — nunca sacrifiques la extracción del medicamento por completar esto.

"veterinario" (nombre del médico con su título si aparece, ej. "Dra. Francisca Gutiérrez"), "clinica" (nombre de la veterinaria) y "direccion" (dirección o comuna de la clínica, si aparece) son opcionales y secundarios igual que "phases" — si alguno no aparece claramente en la receta usa null, nunca lo inventes, y nunca sacrifiques la extracción de medicamentos por completarlos.

${ANTI_INJECTION_REINFORCEMENT}`;

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  try {
    const message = await client.messages.create({
      model: "claude-sonnet-4-5",
      // URGENTE (post Lote M) — subido de 1024 a 2048. Causa más probable
      // del fallo reportado: cada medicamento ahora incluye el array
      // "phases" además de los 6 campos de siempre, y con varios
      // medicamentos en una misma receta la respuesta podía superar 1024
      // tokens y llegar CORTADA — un JSON truncado nunca es válido, y eso
      // explica el "No se pudo procesar la receta" incluso con fotos
      // perfectamente legibles (el fallo no estaba en leer la imagen, sino
      // en que la respuesta de texto no alcanzaba a completarse). No tiene
      // costo real: Anthropic cobra por tokens efectivamente generados, no
      // por este techo — antes, una respuesta cortada ya gastaba esos
      // tokens y encima fallaba.
      // Lote Q — se evaluó subir esto de nuevo al agregar veterinario/
      // clínica/dirección, pero a diferencia de "phases" (que se repite por
      // cada medicamento y fue la causa real del incidente de Lote M),
      // estos 3 campos son top-level: aparecen UNA vez en la respuesta sin
      // importar cuántos medicamentos traiga la receta. El costo marginal
      // es de unos pocos tokens fijos, no crece con el tamaño de la receta
      // — 2048 sigue siendo suficiente margen, no hace falta tocarlo.
      max_tokens: 2048,
      system: systemPrompt,
      messages: [{
        role: "user",
        content: [
          { type: "image", source: { type: "base64", media_type: detectedType, data: imageBase64 } },
        ]
      }]
    });

    const txt = message.content[0].text;
    try {
      const parsed = JSON.parse(extractJson(txt));

      // Compat con el formato viejo (array pelado de medicamentos, sin
      // veterinario/clínica) por si Claude no sigue el formato nuevo — ver
      // comentario de extractJson más arriba. Nunca vale la pena romper la
      // extracción de medicamentos por esto.
      const isLegacyArray = Array.isArray(parsed);
      const hasNewFormat = !isLegacyArray && Array.isArray(parsed?.medicamentos);
      // Si ni siquiera es un objeto con "medicamentos" ni un array, se
      // envuelve como antes (Claude devolvió un único objeto suelto) —
      // misma red de seguridad que ya existía, ahora con un formato más.
      const meds = isLegacyArray ? parsed : hasNewFormat ? parsed.medicamentos : (parsed ? [parsed] : []);
      const veterinario = hasNewFormat ? (parsed.veterinario || null) : null;
      const clinica = hasNewFormat ? (parsed.clinica || null) : null;
      const direccion = hasNewFormat ? (parsed.direccion || null) : null;

      // Recién acá se consumió una consulta real y útil — antes se
      // descontaba apenas Claude respondía, aunque el parseo fallara
      // después: un usuario podía gastar su cuota diaria en intentos que
      // nunca llegaban a mostrarle nada (URGENTE, relacionado con este
      // mismo bug).
      await recordAiUsage(user.id, "recipe");

      return Response.json(
        { result: meds, veterinario, clinica, direccion },
        { headers: { "X-AI-Remaining": String(Math.max(0, quota.remaining - 1)) } }
      );
    } catch (parseErr) {
      // Logueado completo para poder diagnosticar la próxima vez sin tener
      // que reproducir el bug a ciegas — esto fue justamente lo que faltó
      // para diagnosticar este incidente con certeza.
      console.error("[ai-recipe] JSON parse falló:", parseErr.message);
      console.error("[ai-recipe] Respuesta cruda de Claude:", txt);
      // Faltaba el status acá — sin él, esta respuesta de error salía como
      // 200 OK, así que un cliente que solo mirara res.ok la habría tomado
      // como éxito (Lote K1, bug 2). Mensaje distinto al de la imagen: acá
      // la imagen SÍ se leyó, el problema es interpretar lo que respondió
      // la IA — decirle "foto poco clara" al usuario es engañoso cuando la
      // foto estaba bien.
      return Response.json({ error: "Pudimos leer la receta, pero la respuesta de la IA no llegó en un formato que pudiéramos interpretar. Intenta nuevamente — si se repite, avísanos." }, { status: 422 });
    }
  } catch (e) {
    // Detalle real solo en consola del servidor — nunca texto técnico en
    // inglés al usuario. Este catch es de la llamada a la API en sí
    // (red, autenticación, límite de tasa, Claude rechazando la imagen) —
    // distinto del catch de arriba, que es sobre interpretar la respuesta.
    console.error("[ai-recipe] error:", e);
    return Response.json({ error: "No pudimos conectar con el servicio de IA. Intenta nuevamente en unos minutos." }, { status: 500 });
  }
}

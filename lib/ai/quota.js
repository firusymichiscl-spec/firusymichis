import { createClient } from "@supabase/supabase-js";
import { sumarDias } from "@/lib/fechas";

export const AI_LIMITS = {
  free: 3,
  pro: 30,
  business: 100,
};

// Cuota POR MASCOTA (se suma a la cuota por usuario de arriba — gana la
// más restrictiva). "Semana" = últimos 7 días corridos, no semana calendario.
export const PET_DAILY_LIMIT = 1;
export const PET_WEEKLY_LIMIT = 2;
const PET_WINDOW_DAYS = 7;

// Fecha "de hoy" en formato YYYY-MM-DD. Se calcula igual que el resto del
// código cliente (ver AITab.jsx) para quedar alineada con `current_date`
// de Postgres, que la función increment_ai_usage usa del lado del servidor.
function hoyISO() {
  return new Date().toISOString().split("T")[0];
}

function serviceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}

async function getUserPlan(supabase, userId) {
  const { data } = await supabase
    .from("profiles")
    .select("plan, plan_expires_at")
    .eq("id", userId)
    .single();

  if (!data || data.plan === "free") return "free";

  const isActive =
    !data.plan_expires_at || new Date(data.plan_expires_at) > new Date();

  return isActive ? data.plan : "free";
}

async function getUserUsageToday(supabase, userId, tipo) {
  const { data, error } = await supabase
    .from("ai_usage")
    .select("count")
    .eq("user_id", userId)
    .eq("tipo", tipo)
    .eq("fecha", hoyISO())
    .is("pet_id", null)
    .maybeSingle();
  if (error) {
    console.error("[getUserUsageToday] error:", error);
    return 0;
  }
  return data?.count || 0;
}

// Lectura SIN incrementar. Se llama ANTES de invocar a Claude: así un
// intento bloqueado nunca consume cuota y no hace falta "revertir" nada.
export async function checkAiQuota(userId, tipo) {
  const supabase = serviceClient();
  const plan = await getUserPlan(supabase, userId);
  const limit = AI_LIMITS[plan] ?? AI_LIMITS.free;
  const used = await getUserUsageToday(supabase, userId, tipo);
  return { allowed: used < limit, remaining: Math.max(0, limit - used), limit };
}

// Registra el uso — se debe llamar SOLO después de que Claude respondió
// con éxito. Si el intento fue bloqueado por checkAiQuota, o si la llamada
// a Claude falla, esta función nunca se invoca y el usuario no pierde su
// consulta del día.
//
// p_pet_id se manda SIEMPRE explícito (null acá) aunque la función tenga
// default — si se omite, Postgres/PostgREST no puede decidir entre este
// overload de 2 argumentos y el de 3 (p_pet_id uuid default null) que creó
// la migración 20260726_cuota_por_mascota.sql, y la llamada falla con
// PGRST203 ("Could not choose the best candidate function"). Ese error
// quedaba silenciado acá abajo (solo se loguea, nunca se relanza), así que
// la cuota por usuario llevaba semanas sin registrar nada sin que nada
// más se rompiera visiblemente — bug encontrado en el Lote K1 al agregar
// checkEmailTestQuota, que no tiene un límite por mascota que lo tapara.
export async function recordAiUsage(userId, tipo) {
  const supabase = serviceClient();
  const { error } = await supabase.rpc("increment_ai_usage", {
    p_user_id: userId,
    p_tipo: tipo,
    p_pet_id: null,
  });
  if (error) console.error("[recordAiUsage] RPC error:", error);
}

// Suma las filas de ai_usage de una mascota/tipo en la ventana de 7 días
// corridos que termina hoy. Cada fila es a lo más 1 (el límite diario es 1),
// así que la cantidad de filas devueltas equivale a la cantidad de días
// distintos usados en la semana.
async function petUsageWindow(supabase, petId, tipo) {
  const hoy = hoyISO();
  const desde = sumarDias(hoy, -(PET_WINDOW_DAYS - 1));
  const { data: rows, error } = await supabase
    .from("ai_usage")
    .select("fecha, count")
    .eq("pet_id", petId)
    .eq("tipo", tipo)
    .gte("fecha", desde)
    .order("fecha", { ascending: true });
  if (error) {
    console.error("[petUsageWindow] error:", error);
    return { hoy, rows: [] };
  }
  return { hoy, rows: rows || [] };
}

function evaluarVentana(hoy, rows) {
  const filaHoy = rows.find(r => r.fecha === hoy);
  const todayUsed = filaHoy?.count || 0;
  const weekUsed = rows.reduce((sum, r) => sum + r.count, 0);

  if (todayUsed >= PET_DAILY_LIMIT) {
    return { allowed: false, motivo: "diaria", disponibleEn: sumarDias(hoy, 1), todayUsed, weekUsed };
  }
  if (weekUsed >= PET_WEEKLY_LIMIT) {
    const masAntigua = rows[0]?.fecha || hoy;
    return { allowed: false, motivo: "semanal", disponibleEn: sumarDias(masAntigua, PET_WINDOW_DAYS), todayUsed, weekUsed };
  }
  return { allowed: true, motivo: null, disponibleEn: null, todayUsed, weekUsed };
}

// Lectura del estado de cuota de una mascota SIN incrementar. La usan tanto
// la UI (AITab, vía /api/ai-quota) para mostrar "Consultas disponibles hoy:
// X de Y" antes de enviar, como los route handlers de análisis/síntomas
// para decidir si bloquean el intento ANTES de llamar a Claude.
export async function getPetQuotaStatus(supabase, petId, tipo) {
  if (!petId) {
    return { allowed: true, motivo: null, disponibleEn: null, todayUsed: 0, weekUsed: 0, todayLimit: PET_DAILY_LIMIT, weekLimit: PET_WEEKLY_LIMIT };
  }
  const { hoy, rows } = await petUsageWindow(supabase, petId, tipo);
  return { ...evaluarVentana(hoy, rows), todayLimit: PET_DAILY_LIMIT, weekLimit: PET_WEEKLY_LIMIT };
}

// Registra el uso por mascota — igual que recordAiUsage, se debe llamar
// SOLO después de que Claude respondió con éxito (nunca en un intento
// bloqueado por getPetQuotaStatus ni si la llamada a Claude falla).
export async function recordPetUsage(supabase, userId, petId, tipo) {
  if (!petId) return;
  const { error } = await supabase.rpc("increment_ai_usage", {
    p_user_id: userId,
    p_tipo: tipo,
    p_pet_id: petId,
  });
  if (error) console.error("[recordPetUsage] RPC error:", error);
}

// ── Cuota de "email de prueba" (Lote K1, /api/send-notification) ───────
// No es una cuota de IA, pero reutiliza la misma tabla/RPC (ai_usage +
// increment_ai_usage) con un "tipo" propio — increment_ai_usage no valida
// el tipo contra una lista fija, así que no hace falta SQL nuevo. Límite
// plano (no depende del plan del usuario, a diferencia de AI_LIMITS).
export const EMAIL_TEST_DAILY_LIMIT = 5;

export async function checkEmailTestQuota(userId) {
  const supabase = serviceClient();
  const used = await getUserUsageToday(supabase, userId, "email_test");
  return { allowed: used < EMAIL_TEST_DAILY_LIMIT, remaining: Math.max(0, EMAIL_TEST_DAILY_LIMIT - used) };
}

// ── Cuota de búsquedas en /api/places (Lote K1) ─────────────────────────
// Mismo patrón que EMAIL_TEST_DAILY_LIMIT — tope plano por usuario, no
// ligado al plan, para frenar el consumo de la cuota de Google Places.
export const PLACES_SEARCH_DAILY_LIMIT = 100;

export async function checkPlacesQuota(userId) {
  const supabase = serviceClient();
  const used = await getUserUsageToday(supabase, userId, "places_search");
  return { allowed: used < PLACES_SEARCH_DAILY_LIMIT, remaining: Math.max(0, PLACES_SEARCH_DAILY_LIMIT - used) };
}

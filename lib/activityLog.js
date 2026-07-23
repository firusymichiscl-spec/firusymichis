// Log de auditoría inmutable — ver supabase/migrations para el RPC log_activity
// (SECURITY DEFINER, sin policy de INSERT/UPDATE/DELETE para la app: solo lectura).
// Best-effort: un fallo al loguear nunca debe romper la operación principal.
export async function logActivity(supabase, petId, action, detail = null) {
  if (!petId) return;
  try {
    const { error } = await supabase.rpc("log_activity", {
      p_pet_id: petId,
      p_action: action,
      p_detail: detail,
    });
    if (error) console.error("[activityLog]", action, error.message);
  } catch (err) {
    console.error("[activityLog]", action, err.message);
  }
}

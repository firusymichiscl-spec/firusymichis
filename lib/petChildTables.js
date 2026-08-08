// Tablas hijas de "pets": [tabla, columna_de_relación], en el orden correcto
// para borrarlas antes de borrar la mascota. Verificado contra el esquema
// real de Supabase (columnas + FKs vía introspección del OpenAPI de
// PostgREST) — auditoría Lote I, 2026-08-08.
//
// Restricciones de orden:
// - marketplace_listings va antes que medications: marketplace_listings
//   tiene además una FK a medications.id (medication_id) — si medications
//   se borra primero y queda un listing apuntando a un medicamento ya
//   borrado, la FK lo rechaza. marketplace_listings ya tiene su propio
//   pet_id (se asigna igual al pet_id del medicamento al crear el listing,
//   ver app/marketplace/page.jsx), así que filtrar por pet_id alcanza para
//   borrar todos los listings de esta mascota sin tocar medication_id.
// - treatment_items va antes que treatments (treatment_items.treatment_id
//   las referencia). Todo va antes que pets.
//
// "vaccines" NO existe como tabla — las vacunas viven en medical_history
// (type='vaccine'), por eso no aparece aquí (usarla causaba el error al
// eliminar: "relation \"vaccines\" does not exist" en cada intento).
//
// Riesgo conocido, no resuelto en este lote: marketplace_matches referencia
// listing_id/request_id. Si una mascota tiene un listing con un match activo
// o pasado (compra/venta ya simulada), borrar marketplace_listings puede
// fallar por esa FK. No se agregó marketplace_matches acá porque implica
// una decisión de producto (¿se pierde el historial de compra/venta al
// borrar la mascota?) — si eliminar-mascota devuelve
// step: "marketplace_listings" con code "23503", es por esto.
//
// NO incluidas aquí — se manejan aparte o no requieren borrado explícito:
// - medication_logs: no tiene pet_id, se relaciona por medication_id.
//   Se borra antes de este loop, buscando los ids de medications del pet.
// - activity_log: tiene ON DELETE CASCADE hacia pets y además no tiene
//   policy de DELETE para el usuario (registro inmodificable por diseño):
//   no se puede ni hace falta borrarla explícitamente.
// - ai_usage: tiene ON DELETE CASCADE hacia pets, confirmado en
//   supabase/migrations/20260726_cuota_por_mascota.sql.
// - sent_notifications: no tiene columna pet_id ni FK a pets (PK es
//   notification_key, texto libre) — no aplica.
export const PET_CHILD_TABLES = [
  ["marketplace_listings", "pet_id"],
  ["treatment_items", "pet_id"],
  ["medications", "pet_id"],
  ["medical_history", "pet_id"],
  ["weight_logs", "pet_id"],
  ["treatments", "pet_id"],
  ["pet_shares", "pet_id"],
  ["tutors", "pet_id"],
  ["diet_logs", "pet_id"],
  ["notification_preferences", "pet_id"],
  ["notification_logs", "pet_id"],
  ["marketplace_requests", "pet_id"],
];

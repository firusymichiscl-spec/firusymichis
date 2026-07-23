import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

// Mismo orden que el deleteChildTables client-side de DashboardClient.jsx —
// treatments antes que pets (RLS de treatments requiere que pets exista).
const CHILD_TABLES = [
  ["medication_logs", "pet_id"],
  ["medications", "pet_id"],
  ["medical_history", "pet_id"],
  ["vaccines", "pet_id"],
  ["weight_logs", "pet_id"],
  ["treatment_items", "pet_id"],
  ["treatments", "pet_id"],
  ["pet_shares", "pet_id"],
  ["tutors", "pet_id"],
];

export async function POST(req) {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() { return cookieStore.getAll(); },
        setAll(cookiesToSet) {
          try { cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options)); } catch {}
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { petId } = await req.json();
  if (!petId) return NextResponse.json({ error: "Missing petId" }, { status: 400 });

  // Ownership: se lee con el cliente de sesión (respeta RLS de pets, no la tocamos).
  const { data: pet } = await supabase.from("pets").select("id, name, user_id").eq("id", petId).single();
  if (!pet || pet.user_id !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    || req.headers.get("x-real-ip")
    || null;

  // activity_log_archive solo tiene GRANT para service_role (sin policies para
  // la app) — es la única parte de este flujo que necesita el cliente admin.
  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  // a) Copiar el activity_log completo de esta mascota al archivo forense.
  const { data: logs, error: logsError } = await supabase
    .from("activity_log")
    .select("*")
    .eq("pet_id", petId);

  if (logsError) {
    console.error("[eliminar-mascota] error leyendo activity_log:", logsError.message);
    return NextResponse.json({ error: "No se pudo respaldar el registro de actividad" }, { status: 500 });
  }

  if (logs && logs.length > 0) {
    const archiveRows = logs.map(l => ({
      original_log_id: l.id,
      pet_id: l.pet_id,
      pet_name: pet.name,
      user_id: l.user_id,
      user_email: l.user_email,
      action: l.action,
      detail: l.detail,
      ip_address: null, // no se capturó IP en el momento original
      original_created_at: l.created_at,
    }));
    const { error: archiveError } = await supabaseAdmin.from("activity_log_archive").insert(archiveRows);
    if (archiveError) {
      console.error("[eliminar-mascota] error archivando activity_log:", archiveError.message);
      return NextResponse.json({ error: "No se pudo respaldar el registro de actividad" }, { status: 500 });
    }
  }

  // b) Entrada final: quién eliminó la mascota, cuándo y desde qué IP.
  const { error: finalLogError } = await supabaseAdmin.from("activity_log_archive").insert({
    pet_id: petId,
    pet_name: pet.name,
    user_id: user.id,
    user_email: user.email,
    action: "Eliminó la mascota",
    detail: pet.name,
    ip_address: ip,
    original_created_at: new Date().toISOString(),
  });
  if (finalLogError) {
    console.error("[eliminar-mascota] error insertando entrada final:", finalLogError.message);
    return NextResponse.json({ error: "No se pudo respaldar el registro de actividad" }, { status: 500 });
  }

  // c) Recién aquí, con el respaldo forense confirmado, se borran las tablas hijas.
  for (const [table, col] of CHILD_TABLES) {
    const { error } = await supabase.from(table).delete().eq(col, petId);
    if (error) {
      console.error(`[eliminar-mascota] error eliminando ${table}:`, error.message);
      return NextResponse.json({ error: `Error al eliminar ${table}` }, { status: 500 });
    }
  }

  // d) Borrar la mascota (activity_log cae con ella por ON DELETE CASCADE).
  const { error: petError } = await supabase.from("pets").delete().eq("id", petId);
  if (petError) {
    console.error("[eliminar-mascota] error eliminando pets:", petError.message);
    return NextResponse.json({ error: "Error al eliminar la mascota" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

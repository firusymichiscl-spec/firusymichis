import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { PET_CHILD_TABLES } from "@/lib/petChildTables";

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

  // Loguea el error completo de Postgres en la consola de Vercel (nombre de
  // tabla, mensaje, código y detalle) y devuelve al cliente un mensaje sin
  // detalles internos, pero con un "step" y el código de Postgres — suficiente
  // para diagnosticar sin exponer la estructura de la base de datos.
  const failStep = (step, error) => {
    console.error(`[eliminar-mascota] fallo en paso "${step}":`, {
      message: error?.message, code: error?.code, details: error?.details, hint: error?.hint,
    });
    return NextResponse.json(
      { error: "No se pudo eliminar la mascota. Intenta de nuevo o contacta a soporte.", step, code: error?.code || null },
      { status: 500 }
    );
  };

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
    return failStep("leer activity_log", logsError);
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
      return failStep("archivar activity_log", archiveError);
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
    return failStep("insertar entrada final de activity_log_archive", finalLogError);
  }

  // c) Recién aquí, con el respaldo forense confirmado, se borran las tablas hijas.

  // Nieta especial: medication_logs no tiene pet_id, se relaciona por medication_id.
  // Hay que borrarla ANTES de borrar medications (si medication_logs.medication_id
  // tiene FK, borrar medications primero fallaría por violación de esa referencia).
  const { data: petMeds, error: medsLookupError } = await supabase
    .from("medications")
    .select("id")
    .eq("pet_id", petId);
  if (medsLookupError) {
    return failStep("leer medications (para medication_logs)", medsLookupError);
  }
  const medIds = (petMeds || []).map(m => m.id);
  if (medIds.length > 0) {
    const { error: logsDeleteError } = await supabase.from("medication_logs").delete().in("medication_id", medIds);
    if (logsDeleteError) {
      return failStep("medication_logs", logsDeleteError);
    }
  }

  for (const [table, col] of PET_CHILD_TABLES) {
    const { error } = await supabase.from(table).delete().eq(col, petId);
    if (error) {
      return failStep(table, error);
    }
  }

  // d) Borrar la mascota (activity_log y ai_usage caen con ella por ON DELETE CASCADE).
  const { error: petError } = await supabase.from("pets").delete().eq("id", petId);
  if (petError) {
    return failStep("pets", petError);
  }

  return NextResponse.json({ ok: true });
}

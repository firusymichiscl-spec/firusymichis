import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { TRIAL_DAYS } from "@/lib/trial";

export async function POST() {
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

  const svc = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  // Solo se activa una prueba nueva si el usuario sigue en plan "free".
  // Esto evita que alguien reactive un trial completo borrando todas
  // sus mascotas y creando una "primera" mascota de nuevo — si ya tuvo
  // un trial antes (plan quedó en "pro", vigente o vencido), esta
  // llamada no hace nada.
  const { data: profile } = await svc.from("profiles").select("plan").eq("id", user.id).single();
  if (!profile || profile.plan !== "free") {
    return NextResponse.json({ ok: true, skipped: true });
  }

  const now = new Date().toISOString();
  const expiresAt = new Date(Date.now() + TRIAL_DAYS * 86400000).toISOString();
  const { error } = await svc.from("profiles")
    .update({ plan: "pro", plan_expires_at: expiresAt, plan_started_at: now })
    .eq("id", user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, plan: "pro", plan_expires_at: expiresAt });
}

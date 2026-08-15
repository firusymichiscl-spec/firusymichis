import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

const VALID_VIEWS = ["hoy", "semana", "fases"];

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

  const { doseView } = await req.json();
  if (doseView !== null && !VALID_VIEWS.includes(doseView)) {
    return NextResponse.json({ error: "Invalid doseView" }, { status: 400 });
  }

  // profiles solo tiene política RLS de SELECT propia — igual que
  // /api/profile/theme, se usa la RPC set_profile_dose_view (SECURITY
  // DEFINER) en vez de un update directo. Ver
  // supabase/migrations/20260815_dose_view_pref.sql
  const { error } = await supabase.rpc("set_profile_dose_view", {
    p_dose_view_pref: doseView,
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

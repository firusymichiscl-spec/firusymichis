import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

const VALID_THEMES = ["clasico","canino","felino","nocturno","primavera","bosque","conejito","oceano","custom"];

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

  const { theme, customColor } = await req.json();
  if (!VALID_THEMES.includes(theme)) {
    return NextResponse.json({ error: "Invalid theme" }, { status: 400 });
  }

  // profiles solo tiene política RLS de SELECT propia (a propósito, para que
  // nadie pueda auto-asignarse plan/plan_expires_at) — un update/upsert directo
  // con el cliente anon-key queda bloqueado en silencio por RLS. Se usa la RPC
  // set_profile_theme (SECURITY DEFINER) que solo permite tocar esta columna.
  // Ver supabase/migrations/20260722_profile_theme_rpc.sql
  const { error } = await supabase.rpc("set_profile_theme", {
    p_theme: theme,
    p_theme_custom_color: theme === "custom" ? (customColor || null) : null,
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

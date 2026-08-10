import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import NuevaMascotaClient from "@/components/NuevaMascotaClient";

// Gate de servidor (Lote K2) — antes esta ruta era 100% Client Component
// sin ningún chequeo antes de renderizar: el formulario completo (listas
// de razas, dietas, condiciones) se mandaba igual a un visitante sin
// sesión, y el auth recién se exigía adentro de acciones puntuales
// (cargar tutor existente, guardar mascota). Mismo patrón que
// app/dashboard/page.jsx: Server Component que valida sesión antes de
// renderizar nada, delegando la parte interactiva a un Client Component.
export default async function NuevaMascotaPage() {
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
  if (!user) redirect("/login");

  return <NuevaMascotaClient />;
}

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import MedicamentosPage from "@/components/MedicamentosPage";

export default async function Medicamentos() {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() { return cookieStore.getAll(); },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: pets } = await supabase
    .from("pets")
    .select("*")
    .eq("user_id", user.id);

  if (!pets || pets.length === 0) redirect("/nueva-mascota");

  const { data: medications } = await supabase
    .from("medications")
    .select("*")
    .eq("pet_id", pets[0].id)
    .order("created_at", { ascending: false });

  return <MedicamentosPage pet={pets[0]} medications={medications || []} />;
}

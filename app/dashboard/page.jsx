import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import DashboardClient from "@/components/DashboardClient";

export default async function Dashboard() {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          )
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
    .eq("active", true);

  const { data: history } = await supabase
    .from("medical_history")
    .select("*")
    .eq("pet_id", pets[0].id)
    .order("event_date", { ascending: false });

  const { data: vaccines } = await supabase
    .from("vaccines")
    .select("*")
    .eq("pet_id", pets[0].id);

  const { data: lastWeight } = await supabase
    .from("weight_logs")
    .select("weight_kg, logged_date")
    .eq("pet_id", pets[0].id)
    .order("logged_date", { ascending: false })
    .limit(1)
    .single();

  return (
    <DashboardClient
      pet={pets[0]}
      medications={medications || []}
      history={history || []}
      vaccines={vaccines || []}
      user={user}
      lastWeight={lastWeight}
    />
  );
}
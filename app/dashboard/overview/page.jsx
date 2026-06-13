import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import OverviewClient from "@/components/OverviewClient";

export default async function OverviewPage() {
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

  const { data: pets } = await supabase
    .from("pets")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true });

  if (!pets || pets.length === 0) redirect("/nueva-mascota");

  const { data: profile } = await supabase
    .from("profiles")
    .select("plan, plan_expires_at")
    .eq("id", user.id)
    .single();

  const isActivePlan = profile && profile.plan !== "free" &&
    (!profile.plan_expires_at || new Date(profile.plan_expires_at) > new Date());
  const userPlan = isActivePlan ? profile.plan : "free";

  // Fetch medications, vaccines, treatments, weight for all pets in parallel
  const petIds = pets.map(p => p.id);

  const [medsRes, vaccinesRes, treatmentsRes, weightsRes] = await Promise.all([
    supabase.from("medications").select("*").in("pet_id", petIds),
    supabase.from("vaccines").select("*").in("pet_id", petIds),
    supabase.from("treatments").select("*, treatment_items(*)").in("pet_id", petIds),
    supabase.from("weight_logs").select("pet_id, weight_kg, logged_date").in("pet_id", petIds).order("logged_date", { ascending: false }),
  ]);

  const medications = medsRes.data || [];
  const vaccines = vaccinesRes.data || [];
  const treatments = treatmentsRes.data || [];
  const weightLogs = weightsRes.data || [];

  // Latest weight per pet
  const latestWeights = {};
  weightLogs.forEach(w => {
    if (!latestWeights[w.pet_id]) latestWeights[w.pet_id] = w;
  });

  return (
    <OverviewClient
      pets={pets}
      user={user}
      userPlan={userPlan}
      medications={medications}
      vaccines={vaccines}
      treatments={treatments}
      latestWeights={latestWeights}
    />
  );
}

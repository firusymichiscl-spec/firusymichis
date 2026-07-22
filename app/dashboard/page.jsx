import { Suspense } from "react";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import DashboardClient from "@/components/DashboardClient";
import ThemeProvider from "@/components/ThemeProvider";

export default async function Dashboard() {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {}
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

  const firstPet = pets[0];

  const { data: medications } = await supabase
    .from("medications")
    .select("*")
    .eq("pet_id", firstPet.id)
    .order("created_at", { ascending: false });

  const { data: history } = await supabase
    .from("medical_history")
    .select("*")
    .eq("pet_id", firstPet.id)
    .order("event_date", { ascending: false });

  const { data: vaccines } = await supabase
    .from("vaccines")
    .select("*")
    .eq("pet_id", firstPet.id);

  const { data: lastWeight } = await supabase
    .from("weight_logs")
    .select("weight_kg, logged_date")
    .eq("pet_id", firstPet.id)
    .order("logged_date", { ascending: false })
    .limit(1)
    .single();

  const { data: profile } = await supabase
    .from("profiles")
    .select("plan, plan_expires_at, theme, theme_custom_color")
    .eq("id", user.id)
    .single();

  const isActivePlan =
    profile &&
    profile.plan !== "free" &&
    (!profile.plan_expires_at || new Date(profile.plan_expires_at) > new Date());
  const userPlan = isActivePlan ? profile.plan : "free";

  const diasRestantes =
    isActivePlan && profile.plan_expires_at
      ? Math.ceil((new Date(profile.plan_expires_at) - new Date()) / 86400000)
      : null;

  const userTheme = profile?.theme || "clasico";
  const userThemeCustomColor = profile?.theme_custom_color || null;

  // Banner de aviso: últimos 10 días de un trial PRO (plan_expires_at presente,
  // no un plan pagado permanente que tiene plan_expires_at = null).
  const showTrialBanner =
    diasRestantes !== null && diasRestantes <= 10 && diasRestantes > 0 &&
    profile?.plan === "pro" && !!profile?.plan_expires_at;

  // Trial vencido: plan pro con fecha de expiración ya pasada.
  const trialExpired =
    profile?.plan === "pro" && profile?.plan_expires_at !== null && profile?.plan_expires_at !== undefined &&
    new Date(profile.plan_expires_at) < new Date();

  let lastPetSnapshot = null;
  if (trialExpired) {
    const newestPet = pets[pets.length - 1];

    const { data: snapshotMeds } = await supabase
      .from("medications")
      .select("id, name, dose, frequency, stock, unit")
      .eq("pet_id", newestPet.id)
      .eq("active", true)
      .order("created_at", { ascending: false })
      .limit(3);

    const { data: snapshotWeight } = await supabase
      .from("weight_logs")
      .select("weight_kg, logged_date")
      .eq("pet_id", newestPet.id)
      .order("logged_date", { ascending: false })
      .limit(1)
      .single();

    lastPetSnapshot = {
      name: newestPet.name,
      breed: newestPet.breed,
      species: newestPet.species,
      birth_date: newestPet.birth_date,
      photo_url: newestPet.photo_url,
      weight_kg: snapshotWeight?.weight_kg || newestPet.weight_kg || null,
      medications: snapshotMeds || [],
    };
  }

  return (
    <ThemeProvider theme={userTheme} customColor={userThemeCustomColor}>
      <Suspense fallback={null}>
        <DashboardClient
          pet={firstPet}
          allPets={pets}
          medications={medications || []}
          history={history || []}
          vaccines={vaccines || []}
          user={user}
          lastWeight={lastWeight}
          userPlan={userPlan}
          diasRestantes={diasRestantes}
          initialTheme={userTheme}
          initialCustomColor={userThemeCustomColor}
          showTrialBanner={showTrialBanner}
          trialExpired={trialExpired}
          lastPetSnapshot={lastPetSnapshot}
        />
      </Suspense>
    </ThemeProvider>
  );
}

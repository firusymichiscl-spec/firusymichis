import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import LogoutButton from "@/components/LogoutButton";

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

  if (!pets || pets.length === 0) {
    redirect("/nueva-mascota");
  }

  return (
    <div style={{
      minHeight: "100vh",
      background: "#FFF8F3",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontFamily: "Nunito, sans-serif",
    }}>
      <div style={{
        background: "#fff",
        borderRadius: 24,
        padding: "48px 40px",
        boxShadow: "0 4px 24px rgba(61,31,10,0.08)",
        textAlign: "center",
        maxWidth: 380,
        width: "100%",
      }}>
        <div style={{ fontSize: 48, marginBottom: 12 }}>🐾</div>
        <h1 style={{
          fontFamily: "Baloo 2, cursive",
          fontSize: 24,
          fontWeight: 800,
          color: "#3D1F0A",
          marginBottom: 8,
        }}>
          ¡Bienvenido!
        </h1>
        <p style={{ color: "#C4845A", fontSize: 14, marginBottom: 8 }}>
          {user.email}
        </p>
        <p style={{ color: "#3D1F0A", fontSize: 14, marginBottom: 32 }}>
          Tienes {pets.length} mascota{pets.length > 1 ? "s" : ""} registrada{pets.length > 1 ? "s" : ""}
        </p>
        <LogoutButton />
      </div>
    </div>
  );
}
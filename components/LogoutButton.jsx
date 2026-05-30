"use client";

import { createClient } from "@/lib/supabase";
import { useRouter } from "next/navigation";

export default function LogoutButton() {
  const router = useRouter();
  const supabase = createClient();

  const logout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };

  return (
    <button onClick={logout} style={{
      width: "100%",
      padding: "14px",
      borderRadius: 14,
      background: "#FFF0EB",
      color: "#FF6B35",
      border: "1px solid #FFD0BC",
      fontFamily: "Baloo 2, cursive",
      fontSize: 16,
      fontWeight: 700,
      cursor: "pointer",
    }}>
      Cerrar sesión
    </button>
  );
}
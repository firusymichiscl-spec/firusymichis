"use client";

import { createClient } from "@/lib/supabase";

export default function LoginPage() {
  const supabase = createClient();

  const loginWithGoogle = async () => {
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
  };

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
          fontSize: 28,
          fontWeight: 800,
          color: "#3D1F0A",
          marginBottom: 4,
        }}>
          Firus<span style={{ color: "#FFD166" }}>&</span>Michis
        </h1>
        <p style={{ color: "#C4845A", fontSize: 14, marginBottom: 32 }}>
          La salud de tu mascota, siempre contigo
        </p>
        <button onClick={loginWithGoogle} style={{
          width: "100%",
          padding: "14px",
          borderRadius: 14,
          background: "linear-gradient(135deg, #FF6B35, #e85d2e)",
          color: "#fff",
          border: "none",
          fontFamily: "Baloo 2, cursive",
          fontSize: 16,
          fontWeight: 700,
          cursor: "pointer",
          boxShadow: "0 6px 20px rgba(255,107,53,0.35)",
        }}>
          🐶 Entrar con Google
        </button>
      </div>
    </div>
  );
}
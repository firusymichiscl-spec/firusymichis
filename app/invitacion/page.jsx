"use client";
import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase";

function InvitacionInner() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const supabase = createClient();

  const [checking, setChecking] = useState(true);
  const [user, setUser] = useState(null);
  const [info, setInfo] = useState(null);
  const [error, setError] = useState(null);
  const [accepting, setAccepting] = useState(false);
  const [accepted, setAccepted] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);
      setChecking(false);
    })();
  }, []);

  useEffect(() => {
    if (!user || !token) return;
    fetch(`/api/invitacion/${token}`)
      .then(res => res.json().then(data => ({ ok: res.ok, data })))
      .then(({ ok, data }) => {
        if (!ok) setError(data.error || "No se pudo cargar la invitación.");
        else setInfo(data);
      })
      .catch(() => setError("No se pudo cargar la invitación."));
  }, [user, token]);

  const loginWithGoogle = async () => {
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(`/invitacion?token=${token}`)}`,
      },
    });
  };

  const aceptar = async () => {
    setAccepting(true);
    try {
      const res = await fetch(`/api/invitacion/${token}`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) setError(data.error || "No se pudo aceptar la invitación.");
      else setAccepted(true);
    } catch {
      setError("No se pudo aceptar la invitación.");
    }
    setAccepting(false);
  };

  const shell = (children) => (
    <div style={{ minHeight: "100vh", background: "#FFF8F3", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Nunito', sans-serif", padding: 20 }}>
      <div style={{ background: "#fff", borderRadius: 24, padding: "40px 32px", boxShadow: "0 4px 24px rgba(61,31,10,0.08)", maxWidth: 420, width: "100%", textAlign: "center" }}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>🐾</div>
        {children}
      </div>
    </div>
  );

  if (!token) return shell(<p style={{ color: "#dc2626", fontWeight: 700 }}>Este link de invitación no es válido.</p>);
  if (checking) return shell(<p style={{ color: "#7A4522" }}>Cargando...</p>);

  if (!user) {
    return shell(
      <>
        <h1 style={{ fontFamily: "'Baloo 2', cursive", fontSize: 22, color: "#3D1F0A", marginBottom: 8 }}>Te invitaron a Firus&amp;Michis</h1>
        <p style={{ color: "#7A4522", fontSize: 14, marginBottom: 24 }}>Inicia sesión con Google para ver los detalles de la invitación.</p>
        <button onClick={loginWithGoogle} style={{ width: "100%", padding: 12, borderRadius: 12, border: "1.5px solid #FFD9C8", background: "#fff", fontWeight: 700, cursor: "pointer" }}>
          Continuar con Google
        </button>
      </>
    );
  }

  if (error) return shell(<p style={{ color: "#dc2626", fontWeight: 700 }}>⚠️ {error}</p>);
  if (!info) return shell(<p style={{ color: "#7A4522" }}>Cargando invitación...</p>);

  if (accepted || info.status === "accepted") {
    return shell(
      <>
        <h1 style={{ fontFamily: "'Baloo 2', cursive", fontSize: 22, color: "#3D1F0A", marginBottom: 8 }}>¡Listo! 🎉</h1>
        <p style={{ color: "#7A4522", fontSize: 14, marginBottom: 24 }}>Ya tienes acceso a {info.petName}.</p>
        <a href="/dashboard/overview" style={{ display: "inline-block", padding: "12px 24px", borderRadius: 12, background: "#FF6B35", color: "#fff", fontWeight: 700, textDecoration: "none" }}>Ir a mi cuenta</a>
      </>
    );
  }

  if (info.expired) {
    return shell(<p style={{ color: "#dc2626", fontWeight: 700 }}>⚠️ Esta invitación venció. Pide que te inviten de nuevo.</p>);
  }

  return shell(
    <>
      <h1 style={{ fontFamily: "'Baloo 2', cursive", fontSize: 22, color: "#3D1F0A", marginBottom: 8 }}>Te invitaron a {info.petName}</h1>
      <p style={{ color: "#7A4522", fontSize: 14, marginBottom: 24 }}>{info.inviterName} te invitó como tutor suplente. Vas a poder ver su ficha y registrar cuando le des sus medicamentos.</p>
      <button onClick={aceptar} disabled={accepting} style={{ width: "100%", padding: 12, borderRadius: 12, border: "none", background: "#FF6B35", color: "#fff", fontWeight: 700, cursor: accepting ? "not-allowed" : "pointer" }}>
        {accepting ? "Aceptando..." : "Aceptar invitación"}
      </button>
    </>
  );
}

export default function InvitacionPage() {
  return (
    <Suspense fallback={null}>
      <InvitacionInner />
    </Suspense>
  );
}

"use client";
import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";

function ResultadoInner() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const [estado, setEstado] = useState(token ? "cargando" : "error");

  useEffect(() => {
    if (!token) return;
    fetch(`/api/pago/flow/estado?token=${encodeURIComponent(token)}`)
      .then(res => res.json())
      .then(data => {
        if (data.status === 2) setEstado("pagado");
        else if (data.status === 1) setEstado("pendiente");
        else setEstado("rechazado");
      })
      .catch(() => setEstado("error"));
  }, [token]);

  const shell = (icon, titulo, texto, color) => (
    <div style={{ minHeight: "100vh", background: "#FFF8F3", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Nunito', sans-serif", padding: 20 }}>
      <div style={{ background: "#fff", borderRadius: 24, padding: "40px 32px", boxShadow: "0 4px 24px rgba(61,31,10,0.08)", maxWidth: 420, width: "100%", textAlign: "center" }}>
        <div style={{ fontSize: 48, marginBottom: 12 }}>{icon}</div>
        <div style={{ fontFamily: "'Baloo 2', cursive", fontSize: 20, fontWeight: 800, color: color || "#3D1F0A", marginBottom: 8 }}>{titulo}</div>
        <p style={{ color: "#7A4522", fontSize: 14, marginBottom: 24 }}>{texto}</p>
        <a href="/dashboard" style={{ display: "inline-block", padding: "12px 24px", borderRadius: 12, background: "#FF6B35", color: "#fff", fontWeight: 700, textDecoration: "none" }}>Ir a mi cuenta</a>
      </div>
    </div>
  );

  if (estado === "cargando") return shell("⏳", "Confirmando tu pago...", "Esto toma solo unos segundos.");
  if (estado === "pagado") return shell("🎉", "¡Pago aprobado!", "Tu plan PRO ya está activo. Te enviamos el comprobante por correo.", "#059669");
  if (estado === "pendiente") return shell("⏳", "Pago en proceso", "Te avisaremos por correo apenas se confirme.");
  return shell("⚠️", "No se pudo procesar el pago", "Intenta de nuevo o escríbenos a contacto@firusymichis.cl si el problema sigue.", "#dc2626");
}

export default function ResultadoPage() {
  return (
    <Suspense fallback={null}>
      <ResultadoInner />
    </Suspense>
  );
}

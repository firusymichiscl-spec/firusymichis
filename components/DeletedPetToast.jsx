"use client";

import Link from "next/link";

// Banner de confirmación tras eliminar una mascota — mismo verde/forma/
// posición que el toast de "¡Plan activado!" (DashboardClient.jsx), pero en
// un componente aparte porque se usa desde dos lugares: DashboardClient
// (queda otra mascota, no hay navegación real) y /nueva-mascota (era la
// última mascota, se redirige ahí — ver auditoría Lote J).
export default function DeletedPetToast({ name, sex, onClose }) {
  const verbo = sex === "female" ? "eliminada" : "eliminado";
  return (
    <div style={{
      position: "fixed", top: 16, left: "50%", transform: "translateX(-50%)", zIndex: 1500,
      background: "#059669", color: "#fff", padding: "12px 34px 12px 18px", borderRadius: 14,
      fontFamily: "'Nunito', sans-serif", fontSize: 13, fontWeight: 600, lineHeight: 1.5,
      boxShadow: "0 8px 24px rgba(5,150,105,0.35)", maxWidth: 380, width: "calc(100% - 32px)",
    }}>
      ✓ {name} fue {verbo} correctamente. Por seguridad conservamos un registro técnico de esta acción, conforme a nuestra{" "}
      <Link href="/privacidad" style={{ color: "#fff", textDecoration: "underline", fontWeight: 700 }}>Política de Privacidad</Link>.
      <button onClick={onClose} aria-label="Cerrar"
        style={{ position: "absolute", top: 6, right: 8, background: "none", border: "none", color: "#fff", fontSize: 16, fontWeight: 700, cursor: "pointer", opacity: 0.85, lineHeight: 1, padding: 4 }}>
        ✕
      </button>
    </div>
  );
}

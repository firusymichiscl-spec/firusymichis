"use client";
import { useState } from "react";

export default function DeleteArchivedPetModal({ pet, onClose, onDeleted }) {
  const [step, setStep] = useState(1);
  const [confirmText, setConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState(null);

  const matches = confirmText.trim().toLowerCase() === (pet.name || "").trim().toLowerCase();

  const doDelete = async () => {
    if (!matches) return;
    setDeleting(true);
    setError(null);
    const res = await fetch("/api/pets/eliminar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ petId: pet.id }),
    });
    setDeleting(false);
    if (!res.ok) {
      setError("No se pudo eliminar. Intenta de nuevo o contacta a soporte.");
      return;
    }
    onDeleted();
  };

  const css = {
    overlay: { position: "fixed", inset: 0, background: "rgba(0,0,0,0.65)", zIndex: 2000, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 },
    modal: { background: "#fff", borderRadius: 22, padding: "26px 24px", maxWidth: 420, width: "100%", boxShadow: "0 20px 60px rgba(61,31,10,0.3)", border: "1.5px solid #fecaca" },
    icon: { fontSize: 40, textAlign: "center", marginBottom: 8 },
    title: { fontFamily: "'Baloo 2', cursive", fontSize: 19, fontWeight: 800, color: "#dc2626", textAlign: "center", marginBottom: 10 },
    body: { fontSize: 13, color: "#7A4522", lineHeight: 1.6, marginBottom: 18, textAlign: "center" },
    dangerBtn: { width: "100%", padding: 13, borderRadius: 13, border: "none", background: "#dc2626", color: "#fff", fontFamily: "'Baloo 2', cursive", fontSize: 15, fontWeight: 700, cursor: "pointer", marginBottom: 8 },
    cancelBtn: { width: "100%", padding: 11, borderRadius: 13, background: "#fff", color: "#7A4522", border: "1.5px solid #FFD9C8", fontFamily: "'Baloo 2', cursive", fontSize: 14, fontWeight: 700, cursor: "pointer" },
    input: { width: "100%", padding: "10px 13px", borderRadius: 11, border: "1.5px solid #FFD9C8", background: "#FFFAF7", fontFamily: "'Nunito', sans-serif", fontSize: 14, color: "#3D1F0A", outline: "none", boxSizing: "border-box", marginBottom: 18 },
  };

  return (
    <div style={css.overlay}>
      <div style={css.modal}>
        {step === 1 && (
          <>
            <div style={css.icon}>⚠️</div>
            <div style={css.title}>Vas a eliminar a {pet.name} para siempre</div>
            <div style={css.body}>
              Esta acción es irreversible. Una vez eliminada, no hay forma de recuperar
              su ficha ni sus datos — ni tú ni nuestro equipo podrán restaurarla.
            </div>
            <button style={css.dangerBtn} onClick={() => setStep(2)}>Entiendo, continuar</button>
            <button style={css.cancelBtn} onClick={onClose}>Cancelar</button>
          </>
        )}
        {step === 2 && (
          <>
            <div style={css.icon}>🗑️</div>
            <div style={css.title}>Esto se borra para siempre</div>
            <ul style={{ fontSize: 13, color: "#7A4522", lineHeight: 1.9, marginBottom: 18, paddingLeft: 20, textAlign: "left" }}>
              <li>Su ficha completa y foto</li>
              <li>Historial médico, vacunas y cirugías</li>
              <li>Medicamentos y dosis registradas</li>
              <li>Historial de peso y alimentación</li>
              <li>Tutores asociados a su ficha</li>
            </ul>
            <button style={css.dangerBtn} onClick={() => setStep(3)}>Sigo, continuar</button>
            <button style={css.cancelBtn} onClick={onClose}>Cancelar</button>
          </>
        )}
        {step === 3 && (
          <>
            <div style={css.icon}>💔</div>
            <div style={css.title}>Última confirmación</div>
            <div style={css.body}>
              Escribe <strong>{pet.name}</strong> para confirmar que quieres eliminarla para siempre.
            </div>
            <input type="text" value={confirmText} onChange={e => setConfirmText(e.target.value)}
              placeholder={pet.name} style={css.input} />
            {error && <div style={{ fontSize: 12, color: "#dc2626", marginBottom: 12, textAlign: "center" }}>⚠️ {error}</div>}
            <button onClick={doDelete} disabled={!matches || deleting}
              style={{ ...css.dangerBtn, background: matches ? "#dc2626" : "#e5e7eb", color: matches ? "#fff" : "#9ca3af", cursor: matches && !deleting ? "pointer" : "not-allowed" }}>
              {deleting ? "Eliminando..." : "Eliminar para siempre 💔"}
            </button>
            <button style={css.cancelBtn} onClick={onClose}>Cancelar</button>
          </>
        )}
      </div>
    </div>
  );
}

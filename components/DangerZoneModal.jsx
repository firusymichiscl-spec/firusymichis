"use client";

import { createClient } from "@/lib/supabase";
import { logActivity } from "@/lib/activityLog";

export default function DangerZoneModal({ pet, onClose, deleteChildTables, onDataCleared, onDeleted, onOpenArchive }) {
  const supabase = createClient();

  const handleClearData = async () => {
    if (!confirm(`¿Eliminar TODOS los datos de ${pet.name}? Esto incluye medicamentos, historial, vacunas, pesos y tratamientos.`)) return;
    if (!confirm(`⚠️ Segunda confirmación: Esta acción NO se puede deshacer. ¿Confirmas?`)) return;
    const ok = await deleteChildTables(pet.id);
    if (!ok) { alert("Error al limpiar datos. Revisa la consola."); return; }
    await logActivity(supabase, pet.id, "Limpió todos los datos");
    onDataCleared();
    alert("✓ Datos eliminados correctamente");
    onClose();
  };

  const handleDeletePet = async () => {
    if (!confirm(`¿Eliminar a ${pet.name} completamente? Se borrarán TODOS sus datos.`)) return;
    if (!confirm(`⚠️ Última confirmación: Esta acción NO se puede deshacer. ¿Confirmas?`)) return;
    const res = await fetch("/api/pets/eliminar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ petId: pet.id }),
    });
    if (!res.ok) {
      const { error } = await res.json().catch(() => ({}));
      console.error("[deletePet] Error:", error);
      alert("Error al eliminar la mascota. La mascota no fue eliminada.");
      return;
    }
    onDeleted();
  };

  const css = {
    overlay: { position: "fixed", inset: 0, background: "rgba(0,0,0,0.65)", zIndex: 2000, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 },
    modal: { background: "#fff", borderRadius: 22, padding: "26px 24px", maxWidth: 420, width: "100%", boxShadow: "0 20px 60px rgba(61,31,10,0.3)", border: "1.5px solid #fecaca" },
    title: { fontFamily: "'Baloo 2', cursive", fontSize: 19, fontWeight: 800, color: "#dc2626", textAlign: "center", marginBottom: 6 },
    sub: { fontSize: 13, color: "#7A4522", lineHeight: 1.5, marginBottom: 20, textAlign: "center" },
    dangerBtn: { width: "100%", padding: 13, borderRadius: 13, background: "#fef2f2", color: "#dc2626", border: "1.5px solid #fecaca", fontFamily: "'Baloo 2', cursive", fontSize: 14, fontWeight: 700, cursor: "pointer", marginBottom: 10 },
    neutralBtn: { width: "100%", padding: 13, borderRadius: 13, background: "#F1F5F9", color: "#475569", border: "1.5px solid #CBD5E1", fontFamily: "'Baloo 2', cursive", fontSize: 14, fontWeight: 700, cursor: "pointer", marginBottom: 18 },
    cancelBtn: { width: "100%", padding: 11, borderRadius: 13, background: "#fff", color: "#7A4522", border: "1.5px solid #FFD9C8", fontFamily: "'Baloo 2', cursive", fontSize: 14, fontWeight: 700, cursor: "pointer" },
  };

  return (
    <div style={css.overlay}>
      <div style={css.modal}>
        <div style={{ fontSize: 40, textAlign: "center", marginBottom: 8 }}>⚠️</div>
        <div style={css.title}>Zona de peligro</div>
        <div style={css.sub}>
          Acciones destructivas sobre la ficha de <strong>{pet.name}</strong>. No se pueden deshacer.
        </div>

        <button onClick={handleClearData} style={css.dangerBtn}>🗑️ Limpiar datos</button>
        <button onClick={handleDeletePet} style={css.dangerBtn}>🗑️ Eliminar mascota</button>
        <button onClick={onOpenArchive} style={css.neutralBtn}>🌈 Archivar (En Memoria)</button>

        <button onClick={onClose} style={css.cancelBtn}>Cerrar</button>
      </div>
    </div>
  );
}

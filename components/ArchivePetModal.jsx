"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase";
import { logActivity } from "@/lib/activityLog";

export default function ArchivePetModal({ pet, onClose, onArchived }) {
  const supabase = createClient();
  const [confirmText, setConfirmText] = useState("");
  const [archiving, setArchiving] = useState(false);

  const matches = confirmText.trim().toLowerCase() === (pet.name || "").trim().toLowerCase();

  const doArchive = async () => {
    if (!matches) return;
    setArchiving(true);
    const archivedAt = new Date().toISOString();
    const { error } = await supabase
      .from("pets")
      .update({ archived_at: archivedAt, archived_reason: "fallecimiento" })
      .eq("id", pet.id);
    setArchiving(false);
    if (error) { alert("No se pudo archivar. Intenta de nuevo."); return; }
    await logActivity(supabase, pet.id, "Archivó (En Memoria)");
    onArchived({ archived_at: archivedAt, archived_reason: "fallecimiento" });
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.65)", zIndex: 2000, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div style={{ background: "#fff", borderRadius: 22, padding: "26px 24px", maxWidth: 420, width: "100%", boxShadow: "0 20px 60px rgba(61,31,10,0.3)" }}>
        <div style={{ fontSize: 40, textAlign: "center", marginBottom: 8 }}>🌈</div>
        <div style={{ fontFamily: "'Baloo 2', cursive", fontSize: 19, fontWeight: 800, color: "#3D1F0A", textAlign: "center", marginBottom: 10 }}>
          Archivar a {pet.name}
        </div>
        <div style={{ fontSize: 13, color: "#7A4522", lineHeight: 1.6, marginBottom: 18, textAlign: "center" }}>
          Esta acción es permanente. {pet.name} pasará a la sección <strong>En Memoria</strong>: sus datos quedarán
          guardados en modo lectura y no podrás editarlos ni revertir el archivado. Su cupo de mascota quedará liberado.
        </div>

        <label style={{ fontSize: 11, fontWeight: 700, color: "#7A4522", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 6, display: "block" }}>
          Escribe <strong>{pet.name}</strong> para confirmar
        </label>
        <input
          type="text"
          value={confirmText}
          onChange={e => setConfirmText(e.target.value)}
          placeholder={pet.name}
          style={{ width: "100%", padding: "10px 13px", borderRadius: 11, border: "1.5px solid #FFD9C8", background: "#FFFAF7", fontFamily: "'Nunito', sans-serif", fontSize: 14, color: "#3D1F0A", outline: "none", boxSizing: "border-box", marginBottom: 18 }}
        />

        <button onClick={doArchive} disabled={!matches || archiving}
          style={{
            width: "100%", padding: 13, borderRadius: 13, border: "none",
            background: matches ? "#6b7280" : "#e5e7eb",
            color: matches ? "#fff" : "#9ca3af",
            fontFamily: "'Baloo 2', cursive", fontSize: 15, fontWeight: 700,
            cursor: matches && !archiving ? "pointer" : "not-allowed", marginBottom: 8,
          }}>
          {archiving ? "Archivando..." : "Archivar para siempre 🌈"}
        </button>
        <button onClick={onClose}
          style={{ width: "100%", padding: 11, borderRadius: 13, background: "#fff", color: "#7A4522", border: "1.5px solid #FFD9C8", fontFamily: "'Baloo 2', cursive", fontSize: 14, fontWeight: 700, cursor: "pointer" }}>
          Cancelar
        </button>
      </div>
    </div>
  );
}

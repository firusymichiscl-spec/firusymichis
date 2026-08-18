"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase";
import { logActivity } from "@/lib/activityLog";
import { formatFecha } from "@/lib/fechas";

// Extrae la ruta dentro del bucket a partir de un public URL de Supabase
// Storage (para fotos de eventos aún no migradas al bucket privado —
// mismo patrón que scripts/migrate-storage-privacidad.mjs).
function extractStoragePath(publicUrl, bucket) {
  if (!publicUrl) return null;
  const marker = `/object/public/${bucket}/`;
  const idx = publicUrl.indexOf(marker);
  if (idx === -1) return null;
  return decodeURIComponent(publicUrl.slice(idx + marker.length));
}

// Doble confirmación: explicación (qué se borra, de qué mascota, qué fecha)
// + escribir ELIMINAR para habilitar el botón — mismo mecanismo de texto
// tipeado que ArchivePetModal, con el framing de advertencia de
// DangerZoneModal.
export default function EventDeleteModal({ event, petId, petName, onClose, onDeleted }) {
  const supabase = createClient();
  const [confirmText, setConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);

  const matches = confirmText.trim().toUpperCase() === "ELIMINAR";
  const isVaccine = event.type === "vaccine";
  const label = event.event || (isVaccine ? "Vacuna" : "Evento médico");

  const handleDelete = async () => {
    if (!matches) return;
    setDeleting(true);

    // Borra la foto asociada antes que la fila — si falla, no vale la pena
    // bloquear el borrado del registro por eso (mismo criterio que
    // app/api/pets/eliminar/route.js): en el peor caso queda un huérfano
    // que el script de auditoría de Storage detecta después, no un dato
    // que el usuario no pudo borrar.
    if (event.photo_path) {
      const { error } = await supabase.storage.from("pet-photos-medical").remove([event.photo_path]);
      if (error) console.error("[EventDeleteModal] no se pudo borrar la foto (bucket nuevo):", error.message);
    } else if (event.photo_url) {
      const legacyPath = extractStoragePath(event.photo_url, "pet-photos");
      if (legacyPath) {
        const { error } = await supabase.storage.from("pet-photos").remove([legacyPath]);
        if (error) console.error("[EventDeleteModal] no se pudo borrar la foto (bucket legado):", error.message);
      }
    }

    const { error } = await supabase.from("medical_history").delete().eq("id", event.id);
    setDeleting(false);
    if (error) {
      console.error("[EventDeleteModal] no se pudo eliminar el registro:", error.message);
      alert("No se pudo eliminar el registro. Intenta de nuevo.");
      return;
    }

    // Si es vacuna, next_date alimenta las alertas del cron y del overview,
    // pero ambos consultan medical_history en vivo cada vez (no cachean el
    // id en ningún lado) — al no existir más la fila, las alertas
    // desaparecen solas, sin limpieza adicional.
    await logActivity(supabase, petId, isVaccine ? "Eliminó vacuna" : "Eliminó evento médico", `${label}${event.event_date ? ` (${event.event_date})` : ""}`);
    onDeleted(event.id);
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.65)", zIndex: 2100, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div style={{ background: "#fff", borderRadius: 22, padding: "26px 24px", maxWidth: 420, width: "100%", boxShadow: "0 20px 60px rgba(61,31,10,0.3)", border: "1.5px solid #fecaca" }}>
        <div style={{ fontSize: 40, textAlign: "center", marginBottom: 8 }}>⚠️</div>
        <div style={{ fontFamily: "'Baloo 2', cursive", fontSize: 19, fontWeight: 800, color: "#dc2626", textAlign: "center", marginBottom: 10 }}>
          Eliminar {isVaccine ? "vacuna" : "evento"}
        </div>
        <div style={{ fontSize: 13, color: "#7A4522", lineHeight: 1.6, marginBottom: 14, textAlign: "center" }}>
          Se eliminará permanentemente este registro del historial médico de <strong>{petName}</strong>. Esta acción no se puede deshacer.
        </div>

        <div style={{ background: "#FFF8F3", borderRadius: 12, border: "1px solid #FFD9C8", padding: 12, marginBottom: 18 }}>
          <div style={{ fontWeight: 700, fontSize: 13, color: "#3D1F0A" }}>{label}</div>
          {event.event_date && <div style={{ fontSize: 12, color: "#C4845A", marginTop: 2 }}>{formatFecha(event.event_date)}</div>}
        </div>

        <label style={{ fontSize: 11, fontWeight: 700, color: "#7A4522", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 6, display: "block" }}>
          Escribe <strong>ELIMINAR</strong> para confirmar
        </label>
        <input
          type="text"
          value={confirmText}
          onChange={e => setConfirmText(e.target.value)}
          placeholder="ELIMINAR"
          style={{ width: "100%", padding: "10px 13px", borderRadius: 11, border: "1.5px solid #fecaca", background: "#FFFAF7", fontFamily: "'Nunito', sans-serif", fontSize: 14, color: "#3D1F0A", outline: "none", boxSizing: "border-box", marginBottom: 18 }}
        />

        <button onClick={handleDelete} disabled={!matches || deleting}
          style={{
            width: "100%", padding: 13, borderRadius: 13, border: "none",
            background: matches ? "#dc2626" : "#e5e7eb",
            color: matches ? "#fff" : "#9ca3af",
            fontFamily: "'Baloo 2', cursive", fontSize: 15, fontWeight: 700,
            cursor: matches && !deleting ? "pointer" : "not-allowed", marginBottom: 8,
          }}>
          {deleting ? "Eliminando..." : "🗑️ Eliminar para siempre"}
        </button>
        <button onClick={onClose}
          style={{ width: "100%", padding: 11, borderRadius: 13, background: "#fff", color: "#7A4522", border: "1.5px solid #FFD9C8", fontFamily: "'Baloo 2', cursive", fontSize: 14, fontWeight: 700, cursor: "pointer" }}>
          Cancelar
        </button>
      </div>
    </div>
  );
}

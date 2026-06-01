"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase";

const RELATIONSHIPS = ["Dueño", "Familiar", "Veterinario", "Vecino", "Otro"];

const getInitials = (name) => {
  if (!name) return "?";
  const parts = name.trim().split(" ");
  return ((parts[0]?.[0] || "") + (parts[1]?.[0] || "")).toUpperCase();
};

const inputStyle = {
  width: "100%", padding: "9px 12px", borderRadius: 10,
  border: "1.5px solid #FFD9C8", background: "#fff",
  fontFamily: "'Nunito', sans-serif", fontSize: 14,
  color: "#3D1F0A", outline: "none", boxSizing: "border-box",
};

export default function TutorTab({ pet }) {
  const supabase = createClient();
  const [primary, setPrimary] = useState(null);
  const [secondary, setSecondary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editingType, setEditingType] = useState(null);
  const [form, setForm] = useState({ full_name: "", phone: "", email: "", address: "", relationship: "", notes: "" });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => { loadTutors(); }, []);

  const loadTutors = async () => {
    setLoading(true);
    const { data } = await supabase.from("tutors").select("*").eq("pet_id", pet.id);
    setPrimary(data?.find(t => t.type === "primary") || null);
    setSecondary(data?.find(t => t.type === "secondary") || null);
    setLoading(false);
  };

  const openEdit = (type) => {
    const tutor = type === "primary" ? primary : secondary;
    setForm({
      full_name: tutor?.full_name || "",
      phone: tutor?.phone || "",
      email: tutor?.email || "",
      address: tutor?.address || "",
      relationship: tutor?.relationship || "",
      notes: tutor?.notes || "",
    });
    setEditingType(type);
    setSaved(false);
  };

  const closeEdit = () => { setEditingType(null); setSaved(false); };

  const handleSave = async () => {
    if (!form.full_name) return;
    setSaving(true);
    const existing = editingType === "primary" ? primary : secondary;
    const payload = { ...form, pet_id: pet.id, type: editingType };
    if (existing?.id) {
      await supabase.from("tutors").update(payload).eq("id", existing.id);
    } else {
      await supabase.from("tutors").insert(payload);
    }
    setSaving(false);
    setSaved(true);
    await loadTutors();
    setTimeout(() => closeEdit(), 800);
  };

  const handleDelete = async () => {
    const existing = editingType === "primary" ? primary : secondary;
    if (!existing?.id || !confirm("¿Eliminar este tutor?")) return;
    await supabase.from("tutors").delete().eq("id", existing.id);
    await loadTutors();
    closeEdit();
  };

  const DataRow = ({ icon, value }) => (
    <div style={{ display: "flex", alignItems: "flex-start", gap: 8, fontSize: 13, color: "#3D1F0A", padding: "4px 0" }}>
      <span style={{ fontSize: 14, flexShrink: 0 }}>{icon}</span>
      <span>{value}</span>
    </div>
  );

  const renderCard = (type) => {
    const tutor = type === "primary" ? primary : secondary;
    const isPrimary = type === "primary";
    const color = isPrimary ? "#FF6B35" : "#2EC4B6";
    const bgBadge = isPrimary ? "#FFF0EB" : "#E8FAF9";
    const label = isPrimary ? "Titular" : "Suplente";
    const icon = isPrimary ? "👤" : "👥";

    return (
      <div key={type} style={{ background: "#fff", borderRadius: 18, padding: 18, marginBottom: 16, boxShadow: "0 4px 24px rgba(61,31,10,0.08)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <div style={{ fontFamily: "'Baloo 2', cursive", fontSize: 13, fontWeight: 700, color, textTransform: "uppercase", letterSpacing: 1 }}>
            {icon} Tutor {label}
          </div>
          {tutor && (
            <button onClick={() => openEdit(type)} style={{ background: "#FFF0EB", border: "1.5px solid #FFD0BC", borderRadius: 8, padding: "4px 10px", fontSize: 11, color: "#FF6B35", fontWeight: 700, cursor: "pointer" }}>
              ✏️ Editar
            </button>
          )}
        </div>

        {tutor ? (
          <>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
              <div style={{ width: 48, height: 48, borderRadius: "50%", background: color, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Baloo 2', cursive", fontSize: 17, fontWeight: 800, color: "#fff", flexShrink: 0 }}>
                {getInitials(tutor.full_name)}
              </div>
              <div>
                <div style={{ fontFamily: "'Baloo 2', cursive", fontSize: 17, fontWeight: 800, color: "#3D1F0A", lineHeight: 1.2 }}>{tutor.full_name}</div>
                <div style={{ marginTop: 4 }}>
                  <span style={{ background: bgBadge, color, borderRadius: 6, padding: "2px 8px", fontSize: 10, fontWeight: 800 }}>{label}</span>
                  {tutor.relationship && <span style={{ fontSize: 11, color: "#C4845A", marginLeft: 6 }}>{tutor.relationship}</span>}
                </div>
              </div>
            </div>
            <div style={{ borderTop: "1px solid #FFF0EB", paddingTop: 10, display: "flex", flexDirection: "column", gap: 2 }}>
              {tutor.phone && <DataRow icon="📞" value={tutor.phone} />}
              {tutor.email && <DataRow icon="✉️" value={tutor.email} />}
              {tutor.address && <DataRow icon="📍" value={tutor.address} />}
              {tutor.notes && <DataRow icon="📝" value={tutor.notes} />}
            </div>
          </>
        ) : (
          <div style={{ textAlign: "center", padding: "16px 0" }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>{icon}</div>
            <div style={{ fontSize: 13, color: "#C4845A", marginBottom: 14 }}>Sin tutor {label.toLowerCase()} registrado</div>
            <button onClick={() => openEdit(type)} style={{ padding: "10px 24px", borderRadius: 12, background: color, color: "#fff", border: "none", fontFamily: "'Baloo 2', cursive", fontSize: 14, fontWeight: 700, cursor: "pointer" }}>
              + Agregar tutor {label.toLowerCase()}
            </button>
          </div>
        )}
      </div>
    );
  };

  if (loading) {
    return <div style={{ textAlign: "center", padding: 40, color: "#C4845A", fontSize: 14 }}>Cargando tutores...</div>;
  }

  const editingTutor = editingType === "primary" ? primary : secondary;
  const editingLabel = editingType === "primary" ? "Titular" : "Suplente";

  return (
    <div className="fade-up">
      {renderCard("primary")}
      {renderCard("secondary")}

      {/* MODAL EDICIÓN */}
      {editingType && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 1000, display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
          <div style={{ background: "#FFF8F3", borderRadius: "24px 24px 0 0", width: "100%", maxWidth: 480, maxHeight: "92vh", overflowY: "auto" }}>
            <link href="https://fonts.googleapis.com/css2?family=Baloo+2:wght@800&family=Nunito:wght@400;700&display=swap" rel="stylesheet" />

            <div style={{ background: "linear-gradient(135deg, #FF6B35, #e85d2e)", padding: "16px 20px", borderRadius: "24px 24px 0 0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ fontFamily: "'Baloo 2', cursive", fontSize: 17, fontWeight: 800, color: "#fff" }}>
                {editingTutor ? `✏️ Editar tutor ${editingLabel}` : `➕ Agregar tutor ${editingLabel}`}
              </div>
              <button onClick={closeEdit} style={{ background: "rgba(255,255,255,0.2)", border: "1px solid rgba(255,255,255,0.3)", borderRadius: 10, color: "#fff", fontFamily: "'Baloo 2', cursive", fontSize: 13, fontWeight: 700, padding: "6px 12px", cursor: "pointer" }}>
                ✕ Cerrar
              </button>
            </div>

            <div style={{ padding: 20 }}>
              {[
                { label: "Nombre completo *", key: "full_name", placeholder: "Ej: María González", type: "text" },
                { label: "Teléfono", key: "phone", placeholder: "Ej: +56 9 1234 5678", type: "tel" },
                { label: "Email", key: "email", placeholder: "correo@ejemplo.com", type: "email" },
                { label: "Dirección", key: "address", placeholder: "Calle y número", type: "text" },
              ].map(({ label, key, placeholder, type }) => (
                <div key={key} style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "#7A4522", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 4 }}>{label}</div>
                  <input
                    style={inputStyle}
                    type={type}
                    placeholder={placeholder}
                    value={form[key]}
                    onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                  />
                </div>
              ))}

              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#7A4522", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 4 }}>Relación con la mascota</div>
                <select
                  style={{ ...inputStyle, background: "#fff" }}
                  value={form.relationship}
                  onChange={e => setForm(f => ({ ...f, relationship: e.target.value }))}>
                  <option value="">Seleccionar...</option>
                  {RELATIONSHIPS.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>

              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#7A4522", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 4 }}>Notas</div>
                <textarea
                  style={{ ...inputStyle, resize: "vertical", minHeight: 60 }}
                  placeholder="Información adicional..."
                  value={form.notes}
                  onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                />
              </div>

              <button
                onClick={handleSave}
                disabled={saving || !form.full_name}
                style={{ width: "100%", padding: 13, borderRadius: 13, background: saved ? "#2EC4B6" : "#FF6B35", color: "#fff", border: "none", fontFamily: "'Baloo 2', cursive", fontSize: 15, fontWeight: 700, cursor: "pointer", transition: "background 0.3s", marginBottom: 8 }}>
                {saved ? "✓ Guardado" : saving ? "Guardando..." : `✓ Guardar tutor ${editingLabel}`}
              </button>

              {editingTutor && (
                <button
                  onClick={handleDelete}
                  style={{ width: "100%", padding: 11, borderRadius: 13, background: "#fef2f2", color: "#dc2626", border: "1.5px solid #fecaca", fontFamily: "'Baloo 2', cursive", fontSize: 14, fontWeight: 700, cursor: "pointer" }}>
                  🗑️ Eliminar tutor
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

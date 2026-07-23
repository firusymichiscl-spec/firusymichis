"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase";
import { logActivity } from "@/lib/activityLog";

const FOOD_OPTIONS = [
  "Royal Canin", "Hill's", "Purina Pro Plan", "Eukanuba",
  "Orijen", "Acana", "Brit Care", "Natural Choice", "Otro",
];

const birthYearOf = (pet) =>
  pet.birth_date ? new Date(pet.birth_date).toISOString().split("T")[0] : "2000-01-01";

export default function DietHistoryModal({ pet, onClose, onSaved }) {
  const supabase = createClient();
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(true);

  const [editingId, setEditingId] = useState(null);
  const [foodName, setFoodName] = useState("");
  const [brand, setBrand] = useState("");
  const [gramsPerDay, setGramsPerDay] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [notes, setNotes] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => { loadRecords(); }, []);

  const loadRecords = async () => {
    setLoadingData(true);
    const { data } = await supabase
      .from("diet_logs")
      .select("*")
      .eq("pet_id", pet.id)
      .order("date_from", { ascending: false });
    setRecords(data || []);
    setLoadingData(false);
  };

  const resetForm = () => {
    setEditingId(null);
    setFoodName(""); setBrand(""); setGramsPerDay("");
    setDateFrom(""); setDateTo(""); setNotes("");
    setSaved(false);
  };

  const startEdit = (r) => {
    setEditingId(r.id);
    setFoodName(r.food_name || "");
    setBrand(r.brand || "");
    setGramsPerDay(r.grams_per_day?.toString() || "");
    setDateFrom(r.date_from || "");
    setDateTo(r.date_to || "");
    setNotes(r.notes || "");
    setSaved(false);
  };

  const handleSave = async () => {
    if (!foodName || !dateFrom) return;
    setLoading(true);
    const payload = {
      pet_id: pet.id,
      food_name: foodName,
      brand: brand || null,
      grams_per_day: gramsPerDay ? parseInt(gramsPerDay) : null,
      date_from: dateFrom,
      date_to: dateTo || null,
      notes: notes || null,
    };
    if (editingId) {
      await supabase.from("diet_logs").update(payload).eq("id", editingId);
      await logActivity(supabase, pet.id, "Editó dieta", foodName);
    } else {
      await supabase.from("diet_logs").insert(payload);
      await logActivity(supabase, pet.id, "Agregó dieta", foodName);
    }
    setLoading(false);
    setSaved(true);
    await loadRecords();
    setTimeout(() => { resetForm(); onSaved?.(); }, 800);
  };

  const handleDelete = async (id) => {
    if (!confirm("¿Eliminar este registro de alimentación?")) return;
    const record = records.find(r => r.id === id);
    await supabase.from("diet_logs").delete().eq("id", id);
    await logActivity(supabase, pet.id, "Eliminó dieta", record?.food_name);
    await loadRecords();
    onSaved?.();
  };

  const css = {
    overlay: { position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 1000, display: "flex", alignItems: "flex-end", justifyContent: "center" },
    modal: { background: "#FFF8F3", borderRadius: "24px 24px 0 0", width: "100%", maxWidth: 480, maxHeight: "92vh", overflowY: "auto", display: "flex", flexDirection: "column" },
    header: { background: "linear-gradient(135deg, #FF6B35, #e85d2e)", padding: "16px 20px", borderRadius: "24px 24px 0 0", display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0 },
    body: { padding: "20px", flex: 1 },
    sectionLabel: { fontSize: 11, fontWeight: 700, color: "#7A4522", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 10 },
    input: { width: "100%", padding: "9px 12px", borderRadius: 10, border: "1.5px solid #FFD9C8", background: "#fff", fontFamily: "'Nunito', sans-serif", fontSize: 14, color: "#3D1F0A", outline: "none", boxSizing: "border-box" },
    saveBtn: { width: "100%", padding: 13, borderRadius: 13, background: saved ? "#2EC4B6" : "#FF6B35", color: "#fff", border: "none", fontFamily: "'Baloo 2', cursive", fontSize: 15, fontWeight: 700, cursor: "pointer", marginTop: 14, transition: "background 0.3s" },
    cancelBtn: { width: "100%", padding: 11, borderRadius: 13, background: "#fff", color: "#FF6B35", border: "1.5px solid #FFD0BC", fontFamily: "'Baloo 2', cursive", fontSize: 14, fontWeight: 700, cursor: "pointer", marginTop: 8 },
    deleteBtn: { background: "#fef2f2", color: "#dc2626", border: "1px solid #fecaca", borderRadius: 8, padding: "4px 8px", fontSize: 11, fontWeight: 700, cursor: "pointer" },
    editBtn: { background: "#FFF0EB", color: "#FF6B35", border: "1px solid #FFD0BC", borderRadius: 8, padding: "4px 8px", fontSize: 11, fontWeight: 700, cursor: "pointer", marginRight: 6 },
    recordCard: { background: "#fff", borderRadius: 12, padding: "10px 14px", marginBottom: 8, border: "1.5px solid #FFD9C8" },
  };

  return (
    <div style={css.overlay}>
      <div style={css.modal}>
        <link href="https://fonts.googleapis.com/css2?family=Baloo+2:wght@800&family=Nunito:wght@400;700&display=swap" rel="stylesheet" />

        <div style={css.header}>
          <div>
            <div style={{ fontFamily: "'Baloo 2', cursive", fontSize: 17, fontWeight: 800, color: "#fff" }}>
              🍽️ Historial de alimentación
            </div>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.75)", marginTop: 2 }}>
              {pet.name}
            </div>
          </div>
          <button onClick={onClose} style={{ background: "rgba(255,255,255,0.2)", border: "1px solid rgba(255,255,255,0.3)", borderRadius: 10, color: "#fff", fontFamily: "'Baloo 2', cursive", fontSize: 13, fontWeight: 700, padding: "6px 12px", cursor: "pointer" }}>
            ✕ Cerrar
          </button>
        </div>

        <div style={css.body}>
          {/* FORMULARIO */}
          <div style={css.sectionLabel}>{editingId ? "✏️ Editando registro" : "➕ Nuevo período de alimentación"}</div>

          <div style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#7A4522", marginBottom: 4 }}>Alimento *</div>
            <input
              style={css.input}
              list="food-options"
              placeholder="Ej: Royal Canin, Orijen..."
              value={foodName}
              onChange={e => setFoodName(e.target.value)}
            />
            <datalist id="food-options">
              {FOOD_OPTIONS.map(o => <option key={o} value={o} />)}
            </datalist>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 10 }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#7A4522", marginBottom: 4 }}>Marca</div>
              <input style={css.input} placeholder="Marca (opcional)" value={brand} onChange={e => setBrand(e.target.value)} />
            </div>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#7A4522", marginBottom: 4 }}>Gramos/día</div>
              <input style={css.input} type="number" placeholder="ej: 350" value={gramsPerDay} onChange={e => setGramsPerDay(e.target.value)} />
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 10 }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#7A4522", marginBottom: 4 }}>Desde *</div>
              <input style={css.input} type="date" min={birthYearOf(pet)} value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
            </div>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#7A4522", marginBottom: 4 }}>Hasta (vacío = actual)</div>
              <input style={css.input} type="date" min={dateFrom || birthYearOf(pet)} value={dateTo} onChange={e => setDateTo(e.target.value)} />
            </div>
          </div>

          <div style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#7A4522", marginBottom: 4 }}>Notas</div>
            <textarea
              style={{ ...css.input, resize: "vertical", minHeight: 60 }}
              placeholder="Alergias, preferencias, observaciones..."
              value={notes}
              onChange={e => setNotes(e.target.value)}
            />
          </div>

          <button style={css.saveBtn} onClick={handleSave} disabled={loading || !foodName || !dateFrom}>
            {saved ? "✓ Guardado" : loading ? "Guardando..." : editingId ? "✓ Actualizar" : "✓ Guardar período"}
          </button>
          {editingId && (
            <button style={css.cancelBtn} onClick={resetForm}>Cancelar edición</button>
          )}

          {/* REGISTROS EXISTENTES */}
          {loadingData ? (
            <div style={{ textAlign: "center", padding: 20, color: "#C4845A", fontSize: 13 }}>Cargando...</div>
          ) : records.length > 0 && (
            <div style={{ marginTop: 24 }}>
              <div style={css.sectionLabel}>Registros guardados ({records.length})</div>
              {records.map(r => (
                <div key={r.id} style={css.recordCard}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontFamily: "'Baloo 2', cursive", fontSize: 14, fontWeight: 800, color: "#3D1F0A" }}>
                        {r.food_name}
                        {!r.date_to && <span style={{ background: "#FFF0EB", color: "#FF6B35", borderRadius: 6, padding: "1px 7px", fontSize: 10, fontWeight: 700, marginLeft: 6 }}>actual</span>}
                      </div>
                      {r.brand && <div style={{ fontSize: 11, color: "#C4845A" }}>{r.brand}</div>}
                      <div style={{ fontSize: 11, color: "#7A4522", marginTop: 2 }}>
                        {r.date_from?.slice(0, 7)} → {r.date_to ? r.date_to.slice(0, 7) : "hoy"}
                        {r.grams_per_day ? ` · ${r.grams_per_day} g/día` : ""}
                      </div>
                      {r.notes && <div style={{ fontSize: 11, color: "#C4845A", marginTop: 2, fontStyle: "italic" }}>{r.notes}</div>}
                    </div>
                    <div style={{ display: "flex", gap: 4, flexShrink: 0, marginLeft: 8 }}>
                      <button style={css.editBtn} onClick={() => startEdit(r)}>✏️</button>
                      <button style={css.deleteBtn} onClick={() => handleDelete(r.id)}>🗑️</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

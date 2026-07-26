"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase";
import { logActivity } from "@/lib/activityLog";
import { formatFecha, formatMesAno, restarUnDia } from "@/lib/fechas";
import { validateRequired } from "@/lib/formValidation";

const FOOD_OPTIONS_DOG = [
  "Royal Canin Maxi Adult 15 kg", "Royal Canin Mini Adult 8 kg", "Royal Canin Medium Adult 15 kg",
  "Royal Canin Skin Care Hipoalergénico 10 kg", "Royal Canin Urinary S/O 10 kg", "Royal Canin Renal Canino 10 kg",
  "Royal Canin Gastrointestinal Canino 10 kg", "Royal Canin Satiety Weight Management 10 kg",
  "Royal Canin Puppy Maxi 15 kg", "Royal Canin Mini Puppy 8 kg",
  "Hill's Science Diet Adult Chicken 15 kg", "Hill's Prescription Diet k/d Renal Care 5 kg",
  "Hill's Prescription Diet z/d Skin/Food Sensitivities 8 kg", "Hill's Prescription Diet i/d Digestive Care 8 kg",
  "Hill's Science Diet Puppy 15 kg", "Hill's Science Diet Adult 7+ Senior 12 kg",
  "Pro Plan Adult Sensitive Skin Salmón 15 kg", "Pro Plan Adult Complete Pollo 15 kg",
  "Pro Plan Puppy Complete 15 kg", "Pro Plan Adult 7+ Senior 15 kg",
  "Pro Plan Veterinary Diets EN Gastroenteric 10 kg", "Purina Dog Chow Adulto Pollo y Arroz 21 kg",
  "VIRBAC HPM Canino Kidney Support 3 kg", "VIRBAC HPM Canino Skin Support 12 kg",
  "VIRBAC HPM Canino Joint Support 12 kg", "VIRBAC HPM Canino Growth Puppy 12 kg",
  "VIRBAC HPM Canino Gastro Intestinal 12 kg",
  "Eukanuba Adult Small Breed Pollo 7,5 kg", "Eukanuba Adult Medium Breed 15 kg", "Eukanuba Puppy Large Breed 15 kg",
  "Acana Heritage Adult Dog 11,4 kg", "Acana Puppy Recipe 11,4 kg",
  "Orijen Original Dog 11,4 kg", "Orijen Puppy 11,4 kg",
  "Master Dog Adulto Carne 21 kg", "Master Dog Cachorro 15 kg",
  "Cannes Gold Adulto 21 kg", "Nutra Nuggets Professional Adulto 15 kg", "Champion Dog Adulto Carne 22 kg",
];

const FOOD_OPTIONS_CAT = [
  "Royal Canin Indoor Adult 10 kg", "Royal Canin Sterilised Adult 10 kg", "Royal Canin Kitten 10 kg",
  "Royal Canin Urinary S/O Felino 9 kg", "Royal Canin Renal Felino 4 kg", "Royal Canin Hairball Care 10 kg",
  "Hill's Science Diet Adult Indoor 7,5 kg", "Hill's Prescription Diet c/d Urinary Care 8 kg",
  "Hill's Prescription Diet k/d Renal Care Felino 8 kg", "Hill's Science Diet Kitten 7,5 kg",
  "Pro Plan Adult Sterilised Salmón 7,5 kg", "Pro Plan Adult Urinary Tract Health 7,5 kg",
  "Pro Plan Kitten 7,5 kg", "Purina Cat Chow Adulto 15 kg",
  "VIRBAC HPM Felino Kidney Support 3 kg", "VIRBAC HPM Felino Skin Support 7 kg", "VIRBAC HPM Felino Sterilised 7 kg",
  "Eukanuba Adult Cat Sterilised 4 kg",
  "Acana Grasslands Cat 5,4 kg", "Orijen Cat & Kitten 5,4 kg",
  "Fussie Cat Adult Pollo y Salmón 4,54 kg", "Fussie Cat Trueform Grain Free 4,54 kg",
  "Whiskas Adulto Pollo 8 kg", "Whiskas Gatitos 1,5 kg", "Whiskas Sachet Trozos en Salsa Pollo 85 g",
  "Felix Sensations Adulto 8 kg", "Felix Sachet As Good As It Looks Pollo 85 g",
  "Nutra Nuggets Professional Cat Adulto 7,5 kg",
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
  const [foodDropdown, setFoodDropdown] = useState(false);
  const [gramsPerDay, setGramsPerDay] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [notes, setNotes] = useState("");
  const [saved, setSaved] = useState(false);
  const [errors, setErrors] = useState({});

  const foodOptions = pet.species === "cat" ? FOOD_OPTIONS_CAT
    : pet.species === "dog" ? FOOD_OPTIONS_DOG
    : [...FOOD_OPTIONS_DOG, ...FOOD_OPTIONS_CAT];
  const foodPlaceholder = pet.species === "cat" ? "Ej: Royal Canin Indoor Adult 10 kg..."
    : pet.species === "dog" ? "Ej: Royal Canin Maxi Adult 15 kg..."
    : "Ej: nombre del alimento y formato...";
  const foodQueryTrimmed = foodName.trim();
  const filteredFoods = foodQueryTrimmed.length >= 2
    ? foodOptions.filter(o => o.toLowerCase().includes(foodQueryTrimmed.toLowerCase()))
    : [];

  // Si por datos antiguos hay más de un período abierto (date_to null), solo
  // el más reciente por date_from se considera "actual".
  const openRecords = records.filter(r => !r.date_to);
  const mostRecentOpenId = openRecords.length > 0
    ? openRecords.reduce((a, b) => (a.date_from > b.date_from ? a : b)).id
    : null;

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
    setFoodName(""); setGramsPerDay("");
    setDateFrom(""); setDateTo(""); setNotes("");
    setSaved(false);
    setErrors({});
  };

  const startEdit = (r) => {
    setEditingId(r.id);
    setFoodName(r.food_name || "");
    setGramsPerDay(r.grams_per_day?.toString() || "");
    setDateFrom(r.date_from || "");
    setDateTo(r.date_to || "");
    setNotes(r.notes || "");
    setSaved(false);
  };

  const handleSave = async () => {
    const ok = validateRequired([
      { valid: !!foodName.trim(), id: "diet-food-name", message: "El alimento es obligatorio", onInvalid: msg => setErrors(e => ({ ...e, foodName: msg })) },
      { valid: !!dateFrom, id: "diet-date-from", message: "La fecha de inicio es obligatoria", onInvalid: msg => setErrors(e => ({ ...e, dateFrom: msg })) },
    ]);
    if (!ok) return;
    setErrors({});

    const otherRecords = records.filter(r => r.id !== editingId);
    const isNewOpenPeriod = !editingId && !dateTo;
    const openRecordToClose = isNewOpenPeriod
      ? otherRecords.find(r => !r.date_to) || null
      : null;

    // Valida solapamiento contra todo período que no vayamos a cerrar automáticamente.
    const overlapCandidates = otherRecords.filter(r => r.id !== openRecordToClose?.id);
    const newEnd = dateTo || "9999-12-31";
    const hasOverlap = overlapCandidates.some(r => {
      const rEnd = r.date_to || "9999-12-31";
      return dateFrom <= rEnd && r.date_from <= newEnd;
    });
    if (hasOverlap) {
      alert("Ya existe un período de alimentación en esas fechas");
      return;
    }

    let closeDate = null;
    if (openRecordToClose) {
      closeDate = restarUnDia(dateFrom);
      const confirmMsg = `${openRecordToClose.food_name} se marcará como finalizado el ${formatFecha(closeDate)}. ¿Continuar?`;
      if (!confirm(confirmMsg)) return;
    }

    setLoading(true);

    if (openRecordToClose) {
      await supabase.from("diet_logs").update({ date_to: closeDate }).eq("id", openRecordToClose.id);
    }

    const payload = {
      pet_id: pet.id,
      food_name: foodName,
      brand: null,
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
    dropdown: { position: "absolute", top: "100%", left: 0, right: 0, background: "#fff", border: "1.5px solid #FF6B35", borderRadius: 11, maxHeight: 180, overflowY: "auto", zIndex: 10, boxShadow: "0 4px 16px rgba(61,31,10,0.1)" },
    dropItem: { padding: "9px 13px", fontSize: 13, cursor: "pointer", color: "#3D1F0A" },
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

          <div style={{ marginBottom: 10, position: "relative" }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#7A4522", marginBottom: 4 }}>Alimento *</div>
            <input
              id="diet-food-name"
              style={css.input}
              placeholder={foodPlaceholder}
              value={foodName}
              onChange={e => { setFoodName(e.target.value); setFoodDropdown(true); setErrors(er => ({ ...er, foodName: null })); }}
              onFocus={() => setFoodDropdown(true)}
              onBlur={() => setTimeout(() => setFoodDropdown(false), 200)}
            />
            {foodDropdown && filteredFoods.length > 0 && (
              <div style={css.dropdown}>
                {filteredFoods.slice(0, 8).map(o => (
                  <div key={o} style={css.dropItem} onClick={() => { setFoodName(o); setFoodDropdown(false); }}>{o}</div>
                ))}
              </div>
            )}
            {errors.foodName && <div style={{ fontSize: 11, color: "#dc2626", marginTop: 4 }}>⚠️ {errors.foodName}</div>}
          </div>

          <div style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#7A4522", marginBottom: 4 }}>Gramos/día</div>
            <input style={css.input} type="number" step="10" placeholder="ej: 350" value={gramsPerDay} onChange={e => setGramsPerDay(e.target.value)} />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 10 }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#7A4522", marginBottom: 4 }}>Desde *</div>
              <input id="diet-date-from" style={css.input} type="date" min={birthYearOf(pet)} value={dateFrom}
                onChange={e => { setDateFrom(e.target.value); setErrors(er => ({ ...er, dateFrom: null })); }} />
              {errors.dateFrom && <div style={{ fontSize: 11, color: "#dc2626", marginTop: 4 }}>⚠️ {errors.dateFrom}</div>}
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

          <button style={css.saveBtn} onClick={handleSave} disabled={loading}>
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
                        {r.id === mostRecentOpenId && <span style={{ background: "#FFF0EB", color: "#FF6B35", borderRadius: 6, padding: "1px 7px", fontSize: 10, fontWeight: 700, marginLeft: 6 }}>actual</span>}
                      </div>
                      {r.brand && <div style={{ fontSize: 11, color: "#C4845A" }}>{r.brand}</div>}
                      <div style={{ fontSize: 11, color: "#7A4522", marginTop: 2 }}>
                        {formatMesAno(r.date_from)} → {r.date_to ? formatMesAno(r.date_to) : "hoy"}
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

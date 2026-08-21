"use client";
import { useState } from "react";
import { createClient } from "@/lib/supabase";
import { validateRequired } from "@/lib/formValidation";
import { guessDrugClass } from "@/lib/clasesFarmacologicas";
import { logActivity } from "@/lib/activityLog";

const CATEGORIES = [
  { value: "medicamento", label: "💊 Medicamento" },
  { value: "higiene", label: "🧴 Higiene" },
  { value: "insumo", label: "🩹 Insumo" },
  { value: "alimento", label: "🍖 Alimento" },
  { value: "otro", label: "📦 Otro" },
];

const UNITS = ["comprimidos", "cápsulas", "ml", "gramos", "unidades", "frascos"];

const inputStyle = {
  width: "100%", padding: "9px 12px", borderRadius: 10,
  border: "1.5px solid #FFD9C8", background: "#fff",
  fontFamily: "'Nunito', sans-serif", fontSize: 14,
  color: "#3D1F0A", outline: "none", boxSizing: "border-box",
};

const fieldLabel = (text) => (
  <div style={{ fontSize: 11, fontWeight: 700, color: "#7A4522", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 4 }}>{text}</div>
);

function emptyFormFor(prefill) {
  return {
    name: prefill?.name || "",
    category: prefill?.category || "medicamento",
    quantity: prefill?.quantity ?? "",
    unit: prefill?.unit || "comprimidos",
    units_per_package: prefill?.units_per_package || "",
    expires_at: prefill?.expires_at || "",
    notes: prefill?.notes || "",
    drug_class: prefill?.drug_class || "",
  };
}

// pet.id -> { kind: "treatment"|"medication", id } | null
function emptyLinksFor(prefill) {
  const map = {};
  if (prefill?.petId && prefill?.linkKind && prefill?.linkId) {
    map[prefill.petId] = { kind: prefill.linkKind, id: prefill.linkId };
  }
  return map;
}

export default function StockItemModal({
  pets, treatmentItems, medications, editingItem, prefill, onClose, onSaved,
}) {
  const supabase = createClient();
  const activePets = pets.filter(p => !p.archived_at);

  const [form, setForm] = useState(() => emptyFormFor(editingItem || prefill));
  const [selectedPetIds, setSelectedPetIds] = useState(() => {
    if (editingItem?.assignedPetIds) return editingItem.assignedPetIds;
    if (prefill?.petId) return [prefill.petId];
    return [];
  });
  const [links, setLinks] = useState(() => {
    if (editingItem?.links) {
      const map = {};
      editingItem.links.forEach(l => { map[l.petId] = { kind: l.kind, id: l.kind === "treatment" ? l.treatmentItem.id : l.medication.id }; });
      return map;
    }
    return emptyLinksFor(prefill);
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [errors, setErrors] = useState({});

  const togglePet = (petId) => {
    setSelectedPetIds(prev => {
      if (prev.includes(petId)) {
        setLinks(l => { const n = { ...l }; delete n[petId]; return n; });
        return prev.filter(id => id !== petId);
      }
      return [...prev, petId];
    });
  };

  const setLinkForPet = (petId, value) => {
    if (!value) {
      setLinks(l => { const n = { ...l }; delete n[petId]; return n; });
      return;
    }
    const [kind, id] = value.split(":");
    setLinks(l => ({ ...l, [petId]: { kind, id } }));
  };

  const handleSave = async () => {
    const ok = validateRequired([
      { valid: !!form.name.trim(), id: "stock-name", message: "El nombre es obligatorio", onInvalid: msg => setErrors(e => ({ ...e, name: msg })) },
    ]);
    if (!ok) return;
    setErrors({});
    setSaving(true);

    const { data: { user } } = await supabase.auth.getUser();
    const payload = {
      user_id: user.id,
      name: form.name.trim(),
      category: form.category,
      quantity: form.quantity ? parseFloat(form.quantity) : 0,
      unit: form.unit || null,
      units_per_package: form.units_per_package ? parseInt(form.units_per_package) : null,
      expires_at: form.expires_at || null,
      notes: form.notes?.trim() || null,
      drug_class: form.drug_class?.trim() || null,
      updated_at: new Date().toISOString(),
    };

    let itemId = editingItem?.id;
    if (itemId) {
      await supabase.from("inventory_items").update(payload).eq("id", itemId);
    } else {
      const { data, error } = await supabase.from("inventory_items").insert(payload).select().single();
      if (error) { setSaving(false); alert("Error al guardar. Intenta de nuevo."); return; }
      itemId = data.id;
    }

    // Reemplazo completo de asignaciones y vínculos — más simple que un
    // diff, y evita upsert (sin riesgo de la lección de RLS del Lote P).
    await supabase.from("inventory_pets").delete().eq("inventory_item_id", itemId);
    if (selectedPetIds.length > 0) {
      await supabase.from("inventory_pets").insert(selectedPetIds.map(pet_id => ({ inventory_item_id: itemId, pet_id })));
    }

    await supabase.from("inventory_treatment_links").delete().eq("inventory_item_id", itemId);
    const linkRows = Object.values(links).map(l => ({
      inventory_item_id: itemId,
      treatment_item_id: l.kind === "treatment" ? l.id : null,
      medication_id: l.kind === "medication" ? l.id : null,
    }));
    if (linkRows.length > 0) {
      await supabase.from("inventory_treatment_links").insert(linkRows);
    }

    const logPetId = selectedPetIds[0] || null;
    await logActivity(supabase, logPetId, editingItem ? "Ajustó ítem de inventario" : "Agregó ítem de inventario", form.name.trim());

    setSaving(false);
    setSaved(true);
    setTimeout(() => onSaved?.(), 600);
  };

  const linkOptionsForPet = (petId) => {
    const treatments = treatmentItems.filter(ti => ti.pet_id === petId);
    const meds = medications.filter(m => m.pet_id === petId);
    return { treatments, meds };
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 1100, display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
      <div style={{ background: "#FFF8F3", borderRadius: "24px 24px 0 0", width: "100%", maxWidth: 480, maxHeight: "92vh", overflowY: "auto" }}>
        <div style={{ background: "linear-gradient(135deg, #FF6B35, #e85d2e)", padding: "16px 20px", borderRadius: "24px 24px 0 0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ fontFamily: "'Baloo 2', cursive", fontSize: 17, fontWeight: 800, color: "#fff" }}>
            {editingItem ? "✏️ Editar ítem" : "➕ Nuevo ítem de inventario"}
          </div>
          <button onClick={onClose} style={{ background: "rgba(255,255,255,0.2)", border: "1px solid rgba(255,255,255,0.3)", borderRadius: 10, color: "#fff", fontFamily: "'Baloo 2', cursive", fontSize: 13, fontWeight: 700, padding: "6px 12px", cursor: "pointer" }}>
            ✕ Cerrar
          </button>
        </div>

        <div style={{ padding: 20 }}>
          <div style={{ marginBottom: 12 }}>
            {fieldLabel("Nombre *")}
            <input id="stock-name" style={inputStyle} placeholder="Ej: Levotiroxina 100mcg"
              value={form.name}
              onChange={e => {
                const name = e.target.value;
                setForm(f => ({ ...f, name, drug_class: f.drug_class ? f.drug_class : (guessDrugClass(name) || f.drug_class) }));
                setErrors(er => ({ ...er, name: null }));
              }} />
            {errors.name && <div style={{ fontSize: 11, color: "#dc2626", marginTop: 4 }}>⚠️ {errors.name}</div>}
          </div>

          <div style={{ marginBottom: 12 }}>
            {fieldLabel("Categoría")}
            <select style={{ ...inputStyle, background: "#fff" }} value={form.category}
              onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
              {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </div>

          {form.category === "medicamento" && (
            <div style={{ marginBottom: 12 }}>
              {fieldLabel("Clase farmacológica")}
              <input style={inputStyle} placeholder="Ej: hormonal"
                value={form.drug_class} onChange={e => setForm(f => ({ ...f, drug_class: e.target.value }))} />
            </div>
          )}

          <div style={{ marginBottom: 12, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <div>
              {fieldLabel("Cantidad")}
              <input style={inputStyle} type="number" min="0" step="any" placeholder="0"
                value={form.quantity} onChange={e => setForm(f => ({ ...f, quantity: e.target.value }))} />
            </div>
            <div>
              {fieldLabel("Unidad")}
              <select style={{ ...inputStyle, background: "#fff" }} value={form.unit}
                onChange={e => setForm(f => ({ ...f, unit: e.target.value }))}>
                {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>
          </div>

          <div style={{ marginBottom: 12 }}>
            {fieldLabel("Unidades por envase (opcional)")}
            <input style={inputStyle} type="number" min="1" placeholder="Ej: 10 (caja de 10 comprimidos)"
              value={form.units_per_package} onChange={e => setForm(f => ({ ...f, units_per_package: e.target.value }))} />
          </div>

          <div style={{ marginBottom: 12 }}>
            {fieldLabel("Vencimiento (opcional)")}
            <input style={inputStyle} type="date"
              value={form.expires_at} onChange={e => setForm(f => ({ ...f, expires_at: e.target.value }))} />
          </div>

          <div style={{ marginBottom: 16 }}>
            {fieldLabel("Notas (opcional)")}
            <textarea style={{ ...inputStyle, minHeight: 60, resize: "vertical" }}
              value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
          </div>

          <div style={{ marginBottom: 16 }}>
            {fieldLabel("Mascotas asignadas")}
            <div style={{ background: "#fff", borderRadius: 14, border: "1.5px solid #FFD9C8", padding: "4px 14px" }}>
              {activePets.map((pet, i) => (
                <div key={pet.id} style={{ padding: "10px 0", borderBottom: i < activePets.length - 1 ? "1px solid #FFF0EB" : "none" }}>
                  <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
                    <input type="checkbox" checked={selectedPetIds.includes(pet.id)}
                      onChange={() => togglePet(pet.id)}
                      style={{ width: 16, height: 16, accentColor: "#FF6B35" }} />
                    <span style={{ fontSize: 13, color: "#3D1F0A" }}>{pet.name}</span>
                  </label>
                  {selectedPetIds.includes(pet.id) && (() => {
                    const { treatments, meds } = linkOptionsForPet(pet.id);
                    if (treatments.length === 0 && meds.length === 0) return null;
                    const current = links[pet.id];
                    return (
                      <select
                        style={{ ...inputStyle, marginTop: 8, marginBottom: 4, fontSize: 12 }}
                        value={current ? `${current.kind}:${current.id}` : ""}
                        onChange={e => setLinkForPet(pet.id, e.target.value)}>
                        <option value="">— Sin vincular a un tratamiento —</option>
                        {treatments.length > 0 && (
                          <optgroup label="Tratamientos activos">
                            {treatments.map(ti => <option key={ti.id} value={`treatment:${ti.id}`}>{ti.name}{ti.prescribed_dose ? ` · ${ti.prescribed_dose}` : ""}</option>)}
                          </optgroup>
                        )}
                        {meds.length > 0 && (
                          <optgroup label="Medicamentos habituales">
                            {meds.map(m => <option key={m.id} value={`medication:${m.id}`}>{m.name}{m.dose ? ` · ${m.dose}` : ""}</option>)}
                          </optgroup>
                        )}
                      </select>
                    );
                  })()}
                </div>
              ))}
            </div>
            <div style={{ fontSize: 10, color: "#C4845A", marginTop: 4 }}>
              Vincular a un tratamiento o medicamento habilita el cálculo de cuánto alcanza y cuánto comprar.
            </div>
          </div>

          <button onClick={handleSave} disabled={saving}
            style={{ width: "100%", padding: 13, borderRadius: 13, background: saved ? "#2EC4B6" : "#FF6B35", color: "#fff", border: "none", fontFamily: "'Baloo 2', cursive", fontSize: 15, fontWeight: 700, cursor: saving ? "default" : "pointer", transition: "background 0.3s" }}>
            {saved ? "✓ Guardado" : saving ? "Guardando..." : editingItem ? "✓ Actualizar" : "✓ Guardar ítem"}
          </button>
        </div>
      </div>
    </div>
  );
}

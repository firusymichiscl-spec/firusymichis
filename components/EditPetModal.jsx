"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase";
import { logActivity } from "@/lib/activityLog";
import { validateRequired } from "@/lib/formValidation";
import { validateBirthDate, birthDateFromApproxYears } from "@/lib/nutrition";
import { filterChipInput, chipValidationMessage } from "@/lib/chip";
import { OTHER_PET_TYPES, getMaxAgeYears } from "@/lib/petSpecies";
import DateInputCL from "@/components/DateInputCL";

const BREEDS_DOG = ['Boyera de Berna','Golden Retriever','Labrador Retriever','Pastor Alemán','Bulldog Francés','Poodle','Beagle','Chihuahua','Yorkshire Terrier','Husky Siberiano','Boxer','Dálmata','Cocker Spaniel','Shih Tzu','Pomerania','Schnauzer','Dóberman','Rottweiler','Maltés','Basset Hound','Border Collie','Samoyedo','Akita','Weimaraner','Shar Pei'];
const BREEDS_CAT = ['Siamés','Persa','Maine Coon','Ragdoll','Bengalí','Abisinio','British Shorthair','Esfinge','Scottish Fold','Angora','Birmano','Noruego del Bosque','Ruso Azul','Somali','Tonkinés'];
const BREEDS_OTHER = ['Conejo enano','Hámster sirio','Cobaya','Chinchilla','Hurón','Tortuga','Loro','Canario','Periquito','Iguana'];
const DIETS = ['Royal Canin Skin Care','Royal Canin Urinary','Royal Canin Renal',"Hill's Science Diet","Hill's Prescription Diet",'Purina Pro Plan','Eukanuba','Advance Veterinary Diets','Orijen','Acana','Brit Care','Taste of the Wild','Nutrivet','Equilibrio Veterinary','Natural Choice'];
const CONDITIONS = ['Hipotiroidismo','Dermatitis atópica','Otitis recurrente','Diabetes','Epilepsia','Displasia de cadera','Insuficiencia renal','Problemas cardíacos','Alergias alimentarias','Parásitos','Ansiedad','Artritis','Obesidad','Cáncer','Leishmaniasis'];
const MEDS_LIST = ['Nexgard','Bravecto','Simparica','Frontline','Revolution','Milbemax','Drontal','Meloxicam','Rimadyl','Previcox','Metacam','Tramadol','Amoxicilina','Cefalexina','Metronidazol','Enrofloxacina','Doxiciclina','Levotiroxina','Trilostano','Prednisolona','Dexametasona','Apoquel','Cytopoint','Atopica','Omeprazol','Sucralfato','Metoclopramida','Famotidina','Omega 3 Vet','Condroitín','Glucosamina','Probióticos Vet'];

const calcAge = (birthDate) => {
  if (!birthDate) return "";
  const birth = new Date(birthDate);
  const now = new Date();
  const totalDays = Math.floor((now - birth) / 86400000);
  const years = Math.floor(totalDays / 365);
  const months = Math.floor((totalDays % 365) / 30);
  const weeks = Math.floor((totalDays % 365 % 30) / 7);
  const parts = [];
  if (years > 0) parts.push(`${years} año${years !== 1 ? "s" : ""}`);
  if (months > 0) parts.push(`${months} mes${months !== 1 ? "es" : ""}`);
  if (weeks > 0) parts.push(`${weeks} semana${weeks !== 1 ? "s" : ""}`);
  return parts.join(", ");
};

export default function EditPetModal({ pet, onClose, onSave, onOpenDangerZone }) {
  const supabase = createClient();
  const [form, setForm] = useState({
    name: pet.name || "",
    species: pet.species || "dog",
    sex: pet.sex || "",
    breed: pet.breed || "",
    birth_date: pet.birth_date || "",
    conditions: pet.conditions || [],
    diet: pet.diet || "",
    allergies: pet.allergies || [],
    chip_number: pet.chip_number || "",
    chip_registry: pet.chip_registry || "",
    is_adopted: pet.is_adopted || false,
    adoption_type: pet.adoption_type || null,
    adopted_date: pet.adopted_date || "",
    birth_date_approximate: pet.birth_date_approximate || false,
    approximate_age_years: pet.approximate_age_years != null ? String(pet.approximate_age_years) : "",
  });
  const [breedQuery, setBreedQuery] = useState(pet.breed || "");
  const [breedDropdown, setBreedDropdown] = useState(false);
  const [allergyInput, setAllergyInput] = useState("");
  const [conditionInput, setConditionInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [nameError, setNameError] = useState("");
  const [birthDateError, setBirthDateError] = useState("");

  const breeds = form.species === "cat" ? BREEDS_CAT : form.species === "other" ? BREEDS_OTHER : BREEDS_DOG;
  const filteredBreeds = breedQuery ? breeds.filter(b => b.toLowerCase().includes(breedQuery.toLowerCase())) : breeds;

  const toggleCondition = (cond) => setForm(f => ({ ...f, conditions: f.conditions.includes(cond) ? f.conditions.filter(c => c !== cond) : [...f.conditions, cond] }));

  const toggleAllergy = (med) => setForm(f => ({ ...f, allergies: f.allergies.includes(med) ? f.allergies.filter(a => a !== med) : [...f.allergies, med] }));

  const addCustomAllergy = () => {
    const val = allergyInput.trim();
    if (!val || form.allergies.includes(val)) return;
    setForm(f => ({ ...f, allergies: [...f.allergies, val] }));
    setAllergyInput("");
  };

  const CHANGED_FIELD_LABELS = {
    name: "nombre", species: "especie", sex: "sexo", breed: "raza",
    birth_date: "nacimiento", conditions: "condiciones",
    diet: "dieta", allergies: "alergias", chip_number: "chip", chip_registry: "registro de chip",
    is_adopted: "adopción", adopted_date: "fecha de adopción",
    adoption_type: "tipo de adopción", birth_date_approximate: "fecha aproximada", approximate_age_years: "edad aproximada",
  };

  const save = async () => {
    const birthCheck = validateBirthDate(form.birth_date, form.species, form.breed);
    const ok = validateRequired([
      { valid: !!form.name.trim(), id: "editpet-name", message: "El nombre es obligatorio", onInvalid: setNameError },
      { valid: birthCheck.valid, id: "editpet-birth-date", message: birthCheck.message, onInvalid: setBirthDateError },
    ]);
    if (!ok) return;
    setNameError("");
    setBirthDateError("");
    setLoading(true);
    const changedFields = Object.keys(CHANGED_FIELD_LABELS).filter(key => {
      const before = pet[key];
      const after = form[key];
      if (Array.isArray(before) || Array.isArray(after)) {
        return JSON.stringify(before || []) !== JSON.stringify(after || []);
      }
      return (before || "") !== (after || "") && !(key === "weight_kg" && !before && !after);
    });
    const { error } = await supabase.from("pets").update({
      name: form.name, species: form.species, sex: form.sex || null,
      breed: form.breed, birth_date: form.birth_date || null,
      conditions: form.conditions, diet: form.diet,
      allergies: form.allergies.length > 0 ? form.allergies : null,
      chip_number: form.chip_number || null,
      chip_registry: form.chip_registry || null,
      is_adopted: form.is_adopted,
      adopted_date: form.is_adopted && form.adopted_date ? form.adopted_date : null,
      adoption_type: form.adoption_type,
      birth_date_approximate: form.birth_date_approximate,
      approximate_age_years: form.birth_date_approximate && form.approximate_age_years ? parseFloat(form.approximate_age_years) : null,
    }).eq("id", pet.id);
    if (!error) {
      const detail = changedFields.length > 0
        ? changedFields.map(k => CHANGED_FIELD_LABELS[k]).join(", ")
        : null;
      await logActivity(supabase, pet.id, "Editó datos básicos", detail);
      onSave();
    }
    setLoading(false);
  };

  const css = {
    overlay: { position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 1000, display: "flex", alignItems: "flex-end", justifyContent: "center" },
    modal: { background: "#FFF8F3", borderRadius: "24px 24px 0 0", padding: "24px 20px", width: "100%", maxWidth: 480, maxHeight: "90vh", overflowY: "auto" },
    title: { fontFamily: "'Baloo 2', cursive", fontSize: 18, fontWeight: 800, color: "#3D1F0A", marginBottom: 4 },
    sub: { fontSize: 12, color: "#C4845A", marginBottom: 20 },
    label: { fontSize: 11, fontWeight: 700, color: "#7A4522", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 5, display: "block", marginTop: 14 },
    input: { width: "100%", padding: "10px 13px", borderRadius: 11, border: "1.5px solid #FFD9C8", background: "#fff", fontFamily: "'Nunito', sans-serif", fontSize: 14, color: "#3D1F0A", outline: "none", boxSizing: "border-box" },
    ageDisplay: { background: "#FFF0EB", borderRadius: 10, padding: "8px 12px", fontSize: 13, fontWeight: 700, color: "#FF6B35", marginTop: 6, display: "flex", alignItems: "center", gap: 6 },
    dropdown: { position: "absolute", top: "100%", left: 0, right: 0, background: "#fff", border: "1.5px solid #FF6B35", borderRadius: 11, maxHeight: 160, overflowY: "auto", zIndex: 10, boxShadow: "0 4px 16px rgba(61,31,10,0.1)" },
    dropItem: { padding: "9px 13px", fontSize: 13, cursor: "pointer", color: "#3D1F0A" },
    speciesGrid: { display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginTop: 6 },
    speciesBtn: (sel) => ({ border: `2px solid ${sel ? "#FF6B35" : "#FFD9C8"}`, borderRadius: 12, padding: "10px 6px", background: sel ? "#FFF0EB" : "#fff", cursor: "pointer", textAlign: "center" }),
    sexGrid: { display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginTop: 6 },
    sexBtn: (sel) => ({ border: `2px solid ${sel ? "#FF6B35" : "#FFD9C8"}`, borderRadius: 12, padding: "10px 6px", background: sel ? "#FFF0EB" : "#fff", cursor: "pointer", textAlign: "center" }),
    tag: (sel) => ({ padding: "6px 12px", borderRadius: 20, border: `1.5px solid ${sel ? "#FF6B35" : "#E8D5C8"}`, background: sel ? "#FFF0EB" : "#fff", fontSize: 12, fontWeight: 700, color: sel ? "#CC4A1A" : "#7A4522", cursor: "pointer", display: "flex", alignItems: "center", gap: 5 }),
    allergyTag: (sel) => ({ padding: "5px 10px", borderRadius: 20, border: `1.5px solid ${sel ? "#dc2626" : "#E8D5C8"}`, background: sel ? "#fef2f2" : "#fff", fontSize: 11, fontWeight: 700, color: sel ? "#dc2626" : "#7A4522", cursor: "pointer" }),
    saveBtn: { width: "100%", padding: 13, borderRadius: 13, background: "#FF6B35", color: "#fff", border: "none", fontFamily: "'Baloo 2', cursive", fontSize: 15, fontWeight: 700, cursor: "pointer", marginTop: 20 },
    cancelBtn: { width: "100%", padding: 11, borderRadius: 13, background: "#FFF0EB", color: "#FF6B35", border: "2px solid #FFD0BC", fontFamily: "'Baloo 2', cursive", fontSize: 14, fontWeight: 700, cursor: "pointer", marginTop: 8 },
  };

  return (
    <div style={css.overlay}>
      <div style={css.modal}>
        <link href="https://fonts.googleapis.com/css2?family=Baloo+2:wght@800&family=Nunito:wght@400;700&display=swap" rel="stylesheet" />

        <div style={css.title}>✏️ Editar datos de {pet.name}</div>
        <div style={css.sub}>Toca fuera del modal para cerrar sin guardar</div>

        {/* ESPECIE */}
        <label style={css.label}>Especie</label>
        <div style={css.speciesGrid}>
          {[{ value: "dog", icon: "🐶", label: "Perro" }, { value: "cat", icon: "🐱", label: "Gato" }, { value: "other", icon: "🐰", label: "Otro" }].map(s => (
            <div key={s.value} style={css.speciesBtn(form.species === s.value)} onClick={() => { setForm(f => ({ ...f, species: s.value, breed: "" })); setBreedQuery(""); }}>
              <span style={{ fontSize: 24, display: "block", marginBottom: 3 }}>{s.icon}</span>
              <span style={{ fontSize: 11, fontWeight: 700, color: "#3D1F0A" }}>{s.label}</span>
            </div>
          ))}
        </div>

        {/* SEXO */}
        <label style={css.label}>Sexo</label>
        <div style={css.sexGrid}>
          {[{ value: "male", icon: "♂️", label: "Macho" }, { value: "female", icon: "♀️", label: "Hembra" }, { value: "unknown", icon: "❓", label: "Descon." }].map(s => (
            <div key={s.value} style={css.sexBtn(form.sex === s.value)} onClick={() => setForm(f => ({ ...f, sex: s.value }))}>
              <span style={{ fontSize: 20, display: "block", marginBottom: 3 }}>{s.icon}</span>
              <span style={{ fontSize: 11, fontWeight: 700, color: "#3D1F0A" }}>{s.label}</span>
            </div>
          ))}
        </div>

        {/* NOMBRE */}
        <label style={css.label}>Nombre *</label>
        <input id="editpet-name" style={css.input} value={form.name}
          onChange={e => { setForm(f => ({ ...f, name: e.target.value })); setNameError(""); }} />
        {nameError && <div style={{ fontSize: 11, color: "#dc2626", marginTop: 4 }}>⚠️ {nameError}</div>}

        {/* RAZA / TIPO */}
        <label style={css.label}>{form.species === "other" ? "Tipo de mascota" : "Raza"}</label>
        {form.species === "other" ? (
          <select style={{ ...css.input, background: "#fff" }} value={form.breed}
            onChange={e => setForm(f => ({ ...f, breed: e.target.value }))}>
            <option value="">Selecciona...</option>
            {OTHER_PET_TYPES.map(t => (
              <option key={t.value} value={t.value}>{t.icon} {t.value}</option>
            ))}
          </select>
        ) : (
          <div style={{ position: "relative" }}>
            <input style={css.input} placeholder="Buscar raza..." value={breedQuery}
              onChange={e => { setBreedQuery(e.target.value); setBreedDropdown(true); }}
              onFocus={() => setBreedDropdown(true)}
              onBlur={() => setTimeout(() => setBreedDropdown(false), 200)} />
            {breedDropdown && (
              <div style={css.dropdown}>
                {filteredBreeds.slice(0, 8).map(b => (
                  <div key={b} style={css.dropItem} onClick={() => { setForm(f => ({ ...f, breed: b })); setBreedQuery(b); setBreedDropdown(false); }}>{b}</div>
                ))}
                {breedQuery && !breeds.find(b => b.toLowerCase() === breedQuery.toLowerCase()) && (
                  <div style={{ ...css.dropItem, color: "#2EC4B6", fontWeight: 700 }} onClick={() => { setForm(f => ({ ...f, breed: breedQuery })); setBreedDropdown(false); }}>+ Usar "{breedQuery}"</div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ADOPCIÓN */}
        <label style={css.label}>¿Es adoptada?</label>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginTop: 6 }}>
          {[
            { value: null, label: "No" },
            { value: "adoptada", label: "Adoptada" },
            { value: "rescatada", label: "Rescatada" },
          ].map(opt => (
            <div key={String(opt.value)}
              onClick={() => setForm(f => ({
                ...f,
                is_adopted: !!opt.value,
                adoption_type: opt.value,
                adopted_date: opt.value ? f.adopted_date : "",
                birth_date_approximate: opt.value ? f.birth_date_approximate : false,
                approximate_age_years: opt.value ? f.approximate_age_years : "",
              }))}
              style={css.speciesBtn(form.adoption_type === opt.value)}>
              <span style={{ fontSize: 11, fontWeight: 700, color: "#3D1F0A" }}>{opt.label}</span>
            </div>
          ))}
        </div>

        {!form.adoption_type && (
          <>
            <label style={css.label}>Fecha de nacimiento</label>
            <DateInputCL style={{ ...css.input, borderColor: birthDateError ? "#dc2626" : "#FFD9C8" }} max={new Date().toISOString().split("T")[0]}
              value={form.birth_date} onChange={v => { setForm(f => ({ ...f, birth_date: v })); setBirthDateError(""); }} />
            {form.birth_date && <div style={css.ageDisplay}>🎂 {calcAge(form.birth_date)}</div>}
            {birthDateError && <div style={{ fontSize: 11, color: "#dc2626", marginTop: 4 }}>⚠️ {birthDateError}</div>}
          </>
        )}

        {form.adoption_type && (
          <>
            <label style={css.label}>Fecha aproximada de {form.adoption_type === "rescatada" ? "rescate" : "adopción"}</label>
            <DateInputCL style={css.input} max={new Date().toISOString().split("T")[0]}
              value={form.adopted_date} onChange={v => setForm(f => ({ ...f, adopted_date: v }))} />

            <label style={css.label}>¿Sabes la fecha de nacimiento?</label>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 6 }}>
              {[{ value: false, label: "Sí, la sé" }, { value: true, label: "No, edad aprox." }].map(opt => (
                <div key={String(opt.value)}
                  onClick={() => setForm(f => ({ ...f, birth_date_approximate: opt.value, birth_date: "", approximate_age_years: opt.value ? f.approximate_age_years : "" }))}
                  style={css.speciesBtn(form.birth_date_approximate === opt.value)}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: "#3D1F0A" }}>{opt.label}</span>
                </div>
              ))}
            </div>

            {!form.birth_date_approximate ? (
              <>
                <label style={css.label}>Fecha de nacimiento</label>
                <DateInputCL style={{ ...css.input, borderColor: birthDateError ? "#dc2626" : "#FFD9C8" }} max={new Date().toISOString().split("T")[0]}
                  value={form.birth_date} onChange={v => { setForm(f => ({ ...f, birth_date: v })); setBirthDateError(""); }} />
                {form.birth_date && <div style={css.ageDisplay}>🎂 {calcAge(form.birth_date)}</div>}
                {birthDateError && <div style={{ fontSize: 11, color: "#dc2626", marginTop: 4 }}>⚠️ {birthDateError}</div>}
              </>
            ) : (
              <>
                <label style={css.label}>Edad aproximada (años) — según el veterinario</label>
                <input style={css.input} type="number" min="0" max={getMaxAgeYears(form.species, form.breed)} step="0.5" placeholder="ej: 3"
                  value={form.approximate_age_years}
                  onChange={e => {
                    const years = e.target.value;
                    const iso = years ? birthDateFromApproxYears(parseFloat(years)) : "";
                    setForm(f => ({ ...f, approximate_age_years: years, birth_date: iso }));
                    setBirthDateError("");
                  }} />
                {form.birth_date && <div style={css.ageDisplay}>🎂 ≈ {calcAge(form.birth_date)}</div>}
                {birthDateError && <div style={{ fontSize: 11, color: "#dc2626", marginTop: 4 }}>⚠️ {birthDateError}</div>}
              </>
            )}
          </>
        )}

        {/* CHIP */}
        <label style={css.label}>Número de chip</label>
        <input style={css.input} placeholder="15 dígitos (ej: 152098101234567)"
          maxLength={15} inputMode="numeric"
          value={form.chip_number} onChange={e => setForm(f => ({ ...f, chip_number: filterChipInput(e.target.value) }))} />
        {(() => {
          const msg = chipValidationMessage(form.chip_number);
          if (!msg) return null;
          return (
            <div style={{ fontSize: 11, fontWeight: 600, marginTop: 4, color: msg.level === "ok" ? "#059669" : "#d97706" }}>
              {msg.text}
            </div>
          );
        })()}

        <label style={css.label}>Empresa registradora</label>
        <input style={css.input} placeholder="ej: RNPA, Virbac, Animalink..."
          value={form.chip_registry} onChange={e => setForm(f => ({ ...f, chip_registry: e.target.value }))} />

        {/* CONDICIONES */}
        <label style={css.label}>Condiciones de salud</label>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 7, marginTop: 6 }}>
          {[...CONDITIONS].sort((a, b) => a.localeCompare(b, "es")).map(cond => {
            const sel = form.conditions.includes(cond);
            return (
              <div key={cond} style={css.tag(sel)} onClick={() => toggleCondition(cond)}>
                <span style={{ width: 14, height: 14, borderRadius: "50%", border: `1.5px solid ${sel ? "#FF6B35" : "#C4845A"}`, background: sel ? "#FF6B35" : "transparent", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 9, color: "#fff" }}>{sel ? "✓" : ""}</span>
                {cond}
              </div>
            );
          })}
        </div>

        <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
          <input
            style={{ ...css.input, flex: 1 }}
            placeholder="Agregar condición personalizada..."
            value={conditionInput}
            onChange={e => setConditionInput(e.target.value)}
            onKeyDown={e => {
              if (e.key === "Enter") {
                const val = conditionInput.trim();
                if (val && !form.conditions.includes(val)) setForm(f => ({ ...f, conditions: [...f.conditions, val] }));
                setConditionInput("");
              }
            }}
          />
          <button
            onClick={() => {
              const val = conditionInput.trim();
              if (val && !form.conditions.includes(val)) setForm(f => ({ ...f, conditions: [...f.conditions, val] }));
              setConditionInput("");
            }}
            style={{ padding: "10px 14px", borderRadius: 11, background: "#FF6B35", color: "#fff", border: "none", fontFamily: "'Baloo 2', cursive", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>+</button>
        </div>

        {/* ALERGIAS A MEDICAMENTOS */}
        <label style={css.label}>⚠️ Alergias a medicamentos</label>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 6, marginBottom: 10 }}>
          {[...MEDS_LIST].sort((a, b) => a.localeCompare(b, "es")).map(med => {
            const sel = form.allergies.includes(med);
            return <div key={med} style={css.allergyTag(sel)} onClick={() => toggleAllergy(med)}>{med}</div>;
          })}
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <input style={{ ...css.input, flex: 1 }} placeholder="Agregar alergia libre..."
            value={allergyInput} onChange={e => setAllergyInput(e.target.value)}
            onKeyDown={e => e.key === "Enter" && addCustomAllergy()} />
          <button onClick={addCustomAllergy} style={{ padding: "10px 14px", borderRadius: 11, background: "#FF6B35", color: "#fff", border: "none", fontFamily: "'Baloo 2', cursive", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>+</button>
        </div>
        {form.allergies.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginTop: 8 }}>
            {form.allergies.map(a => (
              <span key={a} onClick={() => setForm(f => ({ ...f, allergies: f.allergies.filter(x => x !== a) }))}
                style={{ background: "#fef2f2", color: "#dc2626", border: "1px solid #fecaca", borderRadius: 8, padding: "3px 10px", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
                {a} ×
              </span>
            ))}
          </div>
        )}

        <button style={css.saveBtn} onClick={save} disabled={loading}>{loading ? "Guardando..." : "✓ Guardar cambios"}</button>
        <button style={css.cancelBtn} onClick={onClose}>Cancelar</button>

        {onOpenDangerZone && (
          <button
            onClick={onOpenDangerZone}
            style={{ width: "100%", padding: 10, borderRadius: 13, background: "transparent", color: "#C4845A", border: "none", fontFamily: "'Nunito', sans-serif", fontSize: 12, fontWeight: 700, cursor: "pointer", marginTop: 10, textDecoration: "underline" }}>
            ⚙️ Acciones avanzadas
          </button>
        )}
      </div>
    </div>
  );
}

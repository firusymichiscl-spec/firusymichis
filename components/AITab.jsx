"use client";
import { useState, useRef, useEffect } from "react";
import { createClient } from "@/lib/supabase";

const FREQ_MAP = {
  "cada 12 horas": 2, "cada 12h": 2, "2 veces al día": 2, "dos veces al día": 2,
  "1 vez al día": 1, "una vez al día": 1, "cada 24 horas": 1, "cada 24h": 1,
  "3 veces al día": 3, "tres veces al día": 3,
  "cada 8 horas": 3, "cada 8h": 3,
  "cada 48 horas": 0.5, "cada 48h": 0.5,
  "semanal": 1/7,
};

const parseDosesPerDay = (freq) => {
  if (!freq) return null;
  const key = freq.toLowerCase().trim();
  for (const [k, v] of Object.entries(FREQ_MAP)) {
    if (key.includes(k)) return v;
  }
  return null;
};

const calcNextDose = (startDate, startTime, freqStr) => {
  if (!startDate || !startTime) return null;
  const dosesPerDay = parseDosesPerDay(freqStr);
  if (!dosesPerDay) return null;
  const hoursInterval = 24 / dosesPerDay;
  const start = new Date(`${startDate}T${startTime}:00`);
  const next = new Date(start.getTime() + hoursInterval * 3600000);
  return next.toLocaleString("es-CL", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
};

const HOURS = Array.from({ length: 18 }, (_, i) => i + 6);

export default function AITab({ pet, medications, history, onTreatmentSaved }) {
  const supabase = createClient();
  const [activeSection, setActiveSection] = useState(null);

  const [analyzing, setAnalyzing] = useState(false);
  const [analyzeResult, setAnalyzeResult] = useState(null);

  const [symptom, setSymptom] = useState("");
  const [symptomLoading, setSymptomLoading] = useState(false);
  const [symptomResult, setSymptomResult] = useState(null);

  const [preview, setPreview] = useState(null);
  const [b64, setB64] = useState(null);
  const [mediaType, setMediaType] = useState("image/jpeg");
  const [recipeLoading, setRecipeLoading] = useState(false);
  const [recipeItems, setRecipeItems] = useState([]);
  const [recipeError, setRecipeError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [treatmentMeta, setTreatmentMeta] = useState({ diagnostico: "", doctor: "", vet_clinic: "", emission_date: "" });
  const [savedTreatments, setSavedTreatments] = useState([]);
  const [loadingTreatments, setLoadingTreatments] = useState(false);
  const [deletingTreatment, setDeletingTreatment] = useState(null);
  const [selectedTreatmentId, setSelectedTreatmentId] = useState(null);
  const [placeholderIdx, setPlaceholderIdx] = useState(0);
  const [clinicQuery, setClinicQuery] = useState("");
  const [clinicSuggestions, setClinicSuggestions] = useState([]);
  const [clinicSearching, setClinicSearching] = useState(false);
  const fileRef = useRef();

  const today = new Date().toISOString().split("T")[0];

  const loadTreatments = async () => {
    setLoadingTreatments(true);
    const { data: treats } = await supabase
      .from("treatments")
      .select("id, recipe_date, diagnostico, doctor, vet_clinic, emission_date, created_at, treatment_items(*)")
      .eq("pet_id", pet.id)
      .order("created_at", { ascending: false });
    setSavedTreatments(treats || []);
    setLoadingTreatments(false);
  };

  useEffect(() => { loadTreatments(); }, []);

  const searchClinics = async (q) => {
    setClinicQuery(q);
    setTreatmentMeta(f => ({ ...f, vet_clinic: q }));
    if (q.length < 2) { setClinicSuggestions([]); return; }
    setClinicSearching(true);
    try {
      const res = await fetch(`/api/places?q=${encodeURIComponent(q)}`);
      const data = await res.json();
      setClinicSuggestions(data.results || []);
    } catch { setClinicSuggestions([]); }
    setClinicSearching(false);
  };

  useEffect(() => {
    if (savedTreatments.length > 0 && !selectedTreatmentId) {
      setSelectedTreatmentId(savedTreatments[0].id);
    }
  }, [savedTreatments]);

  const SYMPTOM_PLACEHOLDERS = [
    `${pet.name} se está rascando mucho las orejas`,
    `${pet.name} vomitó esta mañana`,
    `${pet.name} estornudó muchas veces`,
    `${pet.name} hoy le picó una abeja`,
    `${pet.name} no quiere comer desde esta mañana`,
    `${pet.name} está cojeando de la pata trasera`,
    `${pet.name} tiene los ojos llorosos y rojos`,
  ];

  useEffect(() => {
    const interval = setInterval(() => {
      setPlaceholderIdx(i => (i + 1) % SYMPTOM_PLACEHOLDERS.length);
    }, 2500);
    return () => clearInterval(interval);
  }, []);

  const deleteTreatment = async (id) => {
    if (!confirm("¿Eliminar este tratamiento?")) return;
    setDeletingTreatment(id);
    await supabase.from("treatment_items").delete().eq("treatment_id", id);
    await supabase.from("treatments").delete().eq("id", id);
    setDeletingTreatment(null);
    loadTreatments();
  };

  const analyze = async () => {
    setAnalyzing(true);
    setAnalyzeResult(null);
    try {
      const res = await fetch("/api/ai-analyze", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ pet, medications, history }) });
      const data = await res.json();
      setAnalyzeResult(data.result);
    } catch { setAnalyzeResult("Error al conectar con la IA. Intenta de nuevo."); }
    setAnalyzing(false);
  };

  const consultSymptom = async () => {
    if (!symptom.trim()) return;
    setSymptomLoading(true);
    setSymptomResult(null);
    try {
      const res = await fetch("/api/ai-symptoms", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ pet, medications, history, symptom }) });
      const data = await res.json();
      setSymptomResult(data.result);
    } catch { setSymptomResult("Error al conectar con la IA. Intenta de nuevo."); }
    setSymptomLoading(false);
  };

  const onFile = (e) => {
    const f = e.target.files[0];
    if (!f) return;
    setMediaType(f.type || "image/jpeg");
    const r = new FileReader();
    r.onload = (ev) => { setPreview(ev.target.result); setB64(ev.target.result.split(",")[1]); setRecipeItems([]); setRecipeError(null); setSaved(false); };
    r.readAsDataURL(f);
  };

  const analyzeRecipe = async () => {
    if (!b64) return;
    if (savedTreatments.length > 0) {
      const confirmed = window.confirm(`Ya tienes ${savedTreatments.length} tratamiento(s) guardado(s). ¿Deseas analizar esta receta de todas formas? El sistema verificará si es un duplicado al guardar.`);
      if (!confirmed) return;
    }
    setRecipeLoading(true);
    setRecipeItems([]);
    setRecipeError(null);
    try {
      const res = await fetch("/api/ai-recipe", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ imageBase64: b64, mediaType }) });
      const data = await res.json();
      if (data.error) { setRecipeError(data.error); }
      else {
        setRecipeItems(data.result.map((item, i) => ({
          id: i,
          name: item.medicamento || "",
          prescribed_dose: item.dosis_recetada || "",
          frequency: item.frecuencia || "",
          duration_days: parseInt(item.duracion) || null,
          indicaciones: item.indicaciones || "",
          notas: item.notas || "",
          start_date: today,
          start_hour: 20,
          start_min: "00",
          mg_per_unit: "",
          units_per_box: "",
          box_unit: "comp.",
          brand_name: "",
          dose_unit: "mg",
          stock_at_home: "",
          lifelong: false,
          expanded: i === 0,
        })));
      }
    } catch { setRecipeError("No se pudo procesar. Intenta con una foto más clara."); }
    setRecipeLoading(false);
  };

  const updateItem = (id, field, value) => setRecipeItems(items => items.map(item => item.id === id ? { ...item, [field]: value } : item));
  const toggleExpand = (id) => setRecipeItems(items => items.map(item => item.id === id ? { ...item, expanded: !item.expanded } : item));

  const parseDoseUnits = (doseStr) => {
    if (!doseStr) return null;
    const s = doseStr.toLowerCase().trim();
    const decimal = parseFloat(s);
    if (!isNaN(decimal) && s.match(/^\d+(\.\d+)?$/)) return decimal;
    const fracMatch = s.match(/^(\d+)\/(\d+)$/);
    if (fracMatch) return parseInt(fracMatch[1]) / parseInt(fracMatch[2]);
    const mixedMatch = s.match(/(\d+)\s*[+\s]\s*(\d+)\/(\d+)/);
    if (mixedMatch) return parseInt(mixedMatch[1]) + parseInt(mixedMatch[2]) / parseInt(mixedMatch[3]);
    const numMatch = s.match(/^(\d+(\.\d+)?)/);
    if (numMatch) return parseFloat(numMatch[1]);
    return null;
  };

  const calcUnitsPerDose = (item) => {
    const doseUnits = parseDoseUnits(item.prescribed_dose);
    if (doseUnits !== null) return +doseUnits.toFixed(4);
    return null;
  };

  const calcBoxes = (item) => {
    const upb = parseInt(item.units_per_box);
    const days = parseInt(item.duration_days);
    const dpd = parseDosesPerDay(item.frequency);
    if (!upb || upb <= 0) return null;
    const upd = calcUnitsPerDose(item) ?? 1;
    if (dpd && days) {
      const totalUnits = +(upd * dpd * days).toFixed(2);
      const stockHome = parseFloat(item.stock_at_home) || 0;
      const unitsToBuy = Math.max(0, totalUnits - stockHome);
      const boxesNeeded = Math.ceil(unitsToBuy / upb);
      const unitsWithBoxes = boxesNeeded * upb;
      const remaining = +(unitsWithBoxes - unitsToBuy).toFixed(2);
      const daysPerBox = +(upb / (upd * dpd)).toFixed(1);
      const daysFromHome = +(stockHome / (upd * dpd)).toFixed(1);
      return { totalUnits, unitsToBuy, boxesNeeded, remaining, daysPerBox, daysFromHome, stockHome };
    }
    return null;
  };

  const saveTreatment = async () => {
    if (treatmentMeta.emission_date || treatmentMeta.vet_clinic) {
      const possible = savedTreatments.find(t =>
        (treatmentMeta.emission_date && t.emission_date === treatmentMeta.emission_date) ||
        (treatmentMeta.vet_clinic && t.vet_clinic?.toLowerCase() === treatmentMeta.vet_clinic.toLowerCase())
      );
      if (possible) {
        const meds = possible.treatment_items?.map(ti => ti.name).join(", ");
        const confirmed = window.confirm(`Posible duplicado detectado: ya existe una receta de "${possible.vet_clinic || "misma veterinaria"}" con medicamentos: ${meds}. ¿Guardar de todas formas?`);
        if (!confirmed) return;
      }
    }
    setSaving(true);
    const { data: treatment, error: tErr } = await supabase
      .from("treatments")
      .insert({
        pet_id: pet.id,
        recipe_date: today,
        diagnostico: treatmentMeta.diagnostico || null,
        doctor: treatmentMeta.doctor || null,
        vet_clinic: treatmentMeta.vet_clinic || null,
        emission_date: treatmentMeta.emission_date || null,
      })
      .select()
      .single();
    if (tErr || !treatment) {
      console.error("Error creando treatment:", tErr);
      setSaving(false);
      alert("Error al guardar. Verifica tu conexión e intenta de nuevo.");
      return;
    }
    for (const item of recipeItems) {
      const upd = calcUnitsPerDose(item);
      const calc = calcBoxes(item);
      const startTime = `${item.start_hour.toString().padStart(2, "0")}:${item.start_min}`;
      await supabase.from("treatment_items").insert({
        treatment_id: treatment.id, pet_id: pet.id, name: item.name,
        prescribed_dose: item.prescribed_dose, frequency: item.frequency,
        duration_days: item.duration_days, start_date: item.start_date, start_time: startTime,
        mg_per_unit: parseFloat(item.mg_per_unit) || null,
        units_per_box: parseInt(item.units_per_box) || null,
        units_per_dose: upd, boxes_needed: calc?.boxesNeeded || null,
        units_remaining: calc?.remaining || null, add_to_meds: item.lifelong || false, active: true,
      });
      if (item.lifelong) {
        await supabase.from("medications").insert({
          pet_id: pet.id, name: item.name, dose: item.prescribed_dose,
          frequency: item.frequency,
          stock: calc ? calc.boxes * parseInt(item.units_per_box) : null,
          unit: item.box_unit || "comp.", color: "#8B5CF6", active: true,
        });
      }
    }
    setSaving(false);
    setSaved(true);
    setTimeout(() => {
      setPreview(null);
      setB64(null);
      setRecipeItems([]);
      setRecipeError(null);
      setTreatmentMeta({ diagnostico: "", doctor: "", vet_clinic: "", emission_date: "" });
      setClinicQuery("");
      setClinicSuggestions([]);
      onTreatmentSaved?.();
    }, 1500);
  };

  const inputS = { width: "100%", padding: "9px 12px", borderRadius: 10, border: "1.5px solid #FFD9C8", background: "#fff", fontFamily: "'Nunito', sans-serif", fontSize: 13, color: "#3D1F0A", outline: "none", boxSizing: "border-box" };
  const card = { background: "#fff", borderRadius: 18, padding: 18, marginBottom: 16, boxShadow: "0 4px 24px rgba(61,31,10,0.08)" };
  const disclaimer = <div style={{ background: "#fef2f2", borderRadius: 10, padding: "10px 12px", marginTop: 10, border: "1px solid #fecaca" }}><div style={{ fontSize: 11, color: "#dc2626", fontWeight: 700 }}>⚠️ Aviso importante</div><div style={{ fontSize: 11, color: "#7A4522", marginTop: 2 }}>Este análisis es orientativo y no reemplaza la consulta veterinaria. Ante cualquier duda, consulta a un profesional.</div></div>;

  if (!activeSection) return (
    <div className="fade-up">
      <style>{`@keyframes bounce{0%,80%,100%{transform:scale(0.7);opacity:0.5}40%{transform:scale(1);opacity:1}}`}</style>
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 16 }}>
        <div style={{ background: "#FFD166", color: "#7A4522", fontSize: 10, fontWeight: 700, padding: "3px 12px", borderRadius: 20 }}>✦ PRO</div>
      </div>
      <div style={{ fontSize: 13, color: "#7A4522", marginBottom: 16, lineHeight: 1.6 }}>¿Qué quieres hacer hoy con {pet.name}?</div>
      <div style={{ background: "#FFF0EB", borderRadius: 12, padding: "10px 14px", marginBottom: 12, border: "1.5px solid #FFD0BC" }}>
        <div style={{ fontSize: 11, color: "#FF6B35", fontWeight: 700, marginBottom: 2 }}>🔜 Próximamente</div>
        <div style={{ fontSize: 11, color: "#7A4522" }}>Envío del resumen de compra por WhatsApp o correo</div>
      </div>
      {[
        { id: "analyze", icon: "🔍", title: `Analizar a ${pet.name}`, sub: "Recomendaciones personalizadas según su historial", color: "#FF6B35", bg: "#FFF0EB", border: "#FFD0BC" },
        { id: "symptom", icon: "🩺", title: "Consultar síntomas", sub: "Describe lo que le pasa y la IA analiza con su historial", color: "#2EC4B6", bg: "#E8FAF9", border: "#9FE1CB" },
        { id: "recipe", icon: "📋", title: "Subir receta", sub: "La IA extrae todos los medicamentos y calcula las dosis", color: "#8B5CF6", bg: "#f5f3ff", border: "#C4B5FD" },
      ].map(s => (
        <div key={s.id} onClick={() => setActiveSection(s.id)}
          style={{ background: s.bg, borderRadius: 16, border: `1.5px solid ${s.border}`, padding: "16px 18px", marginBottom: 12, cursor: "pointer", display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ fontSize: 32 }}>{s.icon}</div>
          <div>
            <div style={{ fontFamily: "'Baloo 2', cursive", fontSize: 16, fontWeight: 700, color: s.color }}>{s.title}</div>
            <div style={{ fontSize: 12, color: "#7A4522", marginTop: 2 }}>{s.sub}</div>
          </div>
        </div>
      ))}

      {savedTreatments.length > 0 && (
        <div style={{ marginTop: 8 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: "#8B5CF6", textTransform: "uppercase", letterSpacing: 1, marginBottom: 10 }}>Tratamientos guardados</div>
          {savedTreatments.length > 1 && (
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>
              {savedTreatments.map(t => {
                const label = t.diagnostico || `Receta ${new Date((t.emission_date || t.recipe_date || t.created_at) + "T12:00:00").toLocaleDateString("es-CL")}`;
                const meds = t.treatment_items?.slice(0, 3).map(ti => ti.name).join(", ");
                const isSelected = selectedTreatmentId === t.id;
                return (
                  <div key={t.id} onClick={() => setSelectedTreatmentId(t.id)}
                    style={{ padding: "6px 12px", borderRadius: 20, border: `1.5px solid ${isSelected ? "#8B5CF6" : "#C4B5FD"}`, background: isSelected ? "#f5f3ff" : "#fff", fontSize: 11, fontWeight: isSelected ? 700 : 400, color: isSelected ? "#7c3aed" : "#7A4522", cursor: "pointer" }}>
                    {label}
                    {meds && <span style={{ color: "#C4845A", fontSize: 10 }}> ({meds}{t.treatment_items?.length > 3 ? "..." : ""})</span>}
                  </div>
                );
              })}
            </div>
          )}
          {savedTreatments.filter(t => !selectedTreatmentId || t.id === selectedTreatmentId).map(t => (
            <div key={t.id} style={{ background: "#fff", borderRadius: 14, border: "1.5px solid #C4B5FD", padding: 14, marginBottom: 10 }}>
              <div style={{ marginBottom: 8 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
                  <div style={{ fontSize: 11, color: "#C4845A" }}>📋 Receta del {t.emission_date ? new Date(t.emission_date + "T12:00:00").toLocaleDateString("es-CL") : t.recipe_date ? new Date(t.recipe_date + "T12:00:00").toLocaleDateString("es-CL") : "—"}</div>
                  <button onClick={() => deleteTreatment(t.id)} disabled={deletingTreatment === t.id}
                    style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8, padding: "3px 10px", fontSize: 11, color: "#dc2626", fontWeight: 700, cursor: "pointer" }}>
                    {deletingTreatment === t.id ? "..." : "🗑️"}
                  </button>
                </div>
                {t.diagnostico && <div style={{ fontSize: 12, fontWeight: 700, color: "#3D1F0A", marginBottom: 3 }}>🩺 {t.diagnostico}</div>}
                {t.doctor && <div style={{ fontSize: 11, color: "#7A4522", marginBottom: 2 }}>👨‍⚕️ {t.doctor}</div>}
                {t.vet_clinic && <div style={{ fontSize: 11, color: "#7A4522", marginBottom: 6 }}>🏥 {t.vet_clinic}</div>}
              </div>
              {t.treatment_items?.map(ti => {
                const daysLeft = ti.duration_days && ti.start_date
                  ? Math.ceil((new Date(ti.start_date).getTime() + ti.duration_days * 86400000 - Date.now()) / 86400000)
                  : null;
                return (
                  <div key={ti.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "7px 0", borderBottom: "1px solid #f5f3ff" }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: "#3D1F0A" }}>{ti.name}</div>
                      <div style={{ fontSize: 11, color: "#C4845A" }}>{ti.frequency}{ti.start_time ? ` · inicio ${ti.start_time}` : ""}</div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      {ti.boxes_needed && <div style={{ fontSize: 12, fontWeight: 700, color: "#8B5CF6" }}>{ti.boxes_needed} caja{ti.boxes_needed !== 1 ? "s" : ""}</div>}
                      {daysLeft !== null && (
                        <div style={{ fontSize: 10, color: daysLeft < 3 ? "#dc2626" : daysLeft < 7 ? "#d97706" : "#059669", fontWeight: 700 }}>
                          {daysLeft > 0 ? `${daysLeft}d restantes` : "Finalizado"}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  );

  return (
    <div className="fade-up">
      <style>{`@keyframes bounce{0%,80%,100%{transform:scale(0.7);opacity:0.5}40%{transform:scale(1);opacity:1}}`}</style>
      <button onClick={() => setActiveSection(null)} style={{ background: "none", border: "none", color: "#FF6B35", fontFamily: "'Baloo 2', cursive", fontSize: 13, fontWeight: 700, cursor: "pointer", marginBottom: 16, padding: 0 }}>← Volver</button>

      {/* ANÁLISIS */}
      {activeSection === "analyze" && (
        <div style={card}>
          <div style={{ fontSize: 10, fontWeight: 700, color: "#FF6B35", textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>Análisis personalizado</div>
          <div style={{ fontSize: 12, color: "#7A4522", marginBottom: 12, lineHeight: 1.6 }}>La IA analiza la ficha completa de {pet.name} y genera recomendaciones según su edad, raza, condiciones y medicamentos actuales.</div>
          <button onClick={analyze} disabled={analyzing} style={{ width: "100%", padding: 13, borderRadius: 13, background: "#FF6B35", color: "#fff", border: "none", fontFamily: "'Baloo 2', cursive", fontSize: 15, fontWeight: 700, cursor: "pointer" }}>
            {analyzing ? (
              <span style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                Analizando
                <span style={{ display: "inline-flex", gap: 4 }}>
                  {[0,1,2].map(i => (
                    <span key={i} style={{ width: 6, height: 6, borderRadius: "50%", background: "#fff", display: "inline-block", animation: "bounce 1.2s infinite ease-in-out", animationDelay: `${i * 0.2}s` }} />
                  ))}
                </span>
              </span>
            ) : `🔍 Analizar a ${pet.name}`}
          </button>
          {analyzeResult && <><div style={{ background: "#FFF0EB", borderRadius: 12, padding: 14, marginTop: 12, borderLeft: "3px solid #FF6B35" }}><div style={{ fontSize: 11, fontWeight: 700, color: "#FF6B35", marginBottom: 8 }}>Recomendaciones para {pet.name}</div><div style={{ fontSize: 13, color: "#3D1F0A", lineHeight: 1.7, whiteSpace: "pre-wrap" }}>{analyzeResult}</div></div>{disclaimer}</>}
        </div>
      )}

      {/* SÍNTOMAS */}
      {activeSection === "symptom" && (
        <div style={card}>
          <div style={{ fontSize: 10, fontWeight: 700, color: "#2EC4B6", textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>Consulta de síntomas</div>
          <textarea style={{ ...inputS, resize: "vertical", minHeight: 80 }} placeholder={SYMPTOM_PLACEHOLDERS[placeholderIdx]} value={symptom} onChange={e => setSymptom(e.target.value)} />
          <button onClick={consultSymptom} disabled={symptomLoading || !symptom.trim()} style={{ width: "100%", padding: 13, borderRadius: 13, background: "#2EC4B6", color: "#fff", border: "none", fontFamily: "'Baloo 2', cursive", fontSize: 15, fontWeight: 700, cursor: "pointer", marginTop: 10 }}>
            {symptomLoading ? (
              <span style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                Consultando
                <span style={{ display: "inline-flex", gap: 4 }}>
                  {[0,1,2].map(i => (
                    <span key={i} style={{ width: 6, height: 6, borderRadius: "50%", background: "#fff", display: "inline-block", animation: "bounce 1.2s infinite ease-in-out", animationDelay: `${i * 0.2}s` }} />
                  ))}
                </span>
              </span>
            ) : "🩺 Consultar"}
          </button>
          {symptomResult && <><div style={{ background: "#E8FAF9", borderRadius: 12, padding: 14, marginTop: 12, borderLeft: "3px solid #2EC4B6" }}><div style={{ fontSize: 11, fontWeight: 700, color: "#0F6E56", marginBottom: 8 }}>Análisis de síntomas</div><div style={{ fontSize: 13, color: "#3D1F0A", lineHeight: 1.7, whiteSpace: "pre-wrap" }}>{symptomResult}</div></div>{disclaimer}</>}
        </div>
      )}

      {/* RECETA */}
      {activeSection === "recipe" && (
        <div>
          <div style={card}>
            <div style={{ fontSize: 10, fontWeight: 700, color: "#8B5CF6", textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>Lector de receta</div>
            <div onClick={() => fileRef.current.click()} style={{ border: "2px dashed #C4B5FD", borderRadius: 14, padding: "20px 16px", textAlign: "center", background: "#f5f3ff", cursor: "pointer", marginBottom: 8 }}>
              {preview ? <img src={preview} alt="Receta" style={{ maxWidth: "100%", maxHeight: 160, borderRadius: 10, objectFit: "contain" }} /> : <><div style={{ fontSize: 32, marginBottom: 6 }}>📋</div><div style={{ fontSize: 13, fontWeight: 700, color: "#7c3aed" }}>Toca para subir receta</div><div style={{ fontSize: 11, color: "#8B5CF6", marginTop: 3 }}>Foto JPG o PNG</div></>}
              <input ref={fileRef} type="file" accept="image/*" onChange={onFile} style={{ display: "none" }} />
            </div>
            {preview && (
              <button onClick={analyzeRecipe} disabled={recipeLoading} style={{ width: "100%", padding: 13, borderRadius: 13, background: "#8B5CF6", color: "#fff", border: "none", fontFamily: "'Baloo 2', cursive", fontSize: 15, fontWeight: 700, cursor: "pointer" }}>
                {recipeLoading ? (
                  <span style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                    Analizando receta
                    <span style={{ display: "inline-flex", gap: 4 }}>
                      {[0,1,2].map(i => (
                        <span key={i} style={{ width: 6, height: 6, borderRadius: "50%", background: "#fff", display: "inline-block", animation: "bounce 1.2s infinite ease-in-out", animationDelay: `${i * 0.2}s` }} />
                      ))}
                    </span>
                  </span>
                ) : "🔍 Analizar receta"}
              </button>
            )}
            {recipeError && <div style={{ background: "#fef2f2", borderRadius: 12, padding: 14, marginTop: 12, color: "#dc2626", fontSize: 13, fontWeight: 600, border: "1px solid #fecaca" }}>⚠️ {recipeError}</div>}
          </div>

          {recipeItems.length > 0 && !saved && (
            <>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#8B5CF6", textTransform: "uppercase", letterSpacing: 1, marginBottom: 10 }}>Medicamentos extraídos ({recipeItems.length})</div>

              {/* Datos de la receta */}
              <div style={{ background: "#fff", borderRadius: 16, border: "1.5px solid #FFD9C8", padding: 14, marginBottom: 14 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: "#FF6B35", textTransform: "uppercase", letterSpacing: 1, marginBottom: 10 }}>Datos de la receta</div>
                <div style={{ marginBottom: 8 }}>
                  <div style={{ fontSize: 9, color: "#C4845A", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 3 }}>Diagnóstico</div>
                  <input style={{ ...inputS, background: "#fff" }} placeholder="ej: Neuropatía, dermatitis..." value={treatmentMeta.diagnostico} onChange={e => setTreatmentMeta(f => ({ ...f, diagnostico: e.target.value }))} />
                </div>
                <div style={{ marginBottom: 8 }}>
                  <div style={{ fontSize: 9, color: "#C4845A", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 3 }}>Doctor que recetó</div>
                  <input style={{ ...inputS, background: "#fff" }} placeholder="ej: Juan Rosas" value={treatmentMeta.doctor}
                    onChange={e => {
                      const val = e.target.value.replace(/\b\w/g, l => l.toUpperCase());
                      setTreatmentMeta(f => ({ ...f, doctor: val }));
                    }}
                    onBlur={e => {
                      let val = e.target.value.trim();
                      if (val && !val.match(/^Dr[a]?\./i)) {
                        const firstName = val.split(" ")[0].toLowerCase();
                        const title = firstName.endsWith("a") ? "Dra." : "Dr.";
                        val = `${title} ${val}`;
                      }
                      setTreatmentMeta(f => ({ ...f, doctor: val }));
                    }} />
                </div>
                <div style={{ marginBottom: 8, position: "relative" }}>
                  <div style={{ fontSize: 9, color: "#C4845A", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 3 }}>Veterinaria</div>
                  <input style={{ ...inputS, background: "#fff" }} placeholder="Buscar o escribir veterinaria..."
                    value={clinicQuery} spellCheck={false} autoCorrect="off"
                    onChange={e => searchClinics(e.target.value)} />
                  {clinicSearching && <div style={{ fontSize: 11, color: "#C4845A", marginTop: 4 }}>Buscando...</div>}
                  {clinicSuggestions.length > 0 && (
                    <div style={{ position: "absolute", top: "100%", left: 0, right: 0, background: "#fff", border: "1.5px solid #8B5CF6", borderRadius: 11, maxHeight: 160, overflowY: "auto", zIndex: 10, boxShadow: "0 4px 16px rgba(61,31,10,0.1)" }}>
                      {clinicSuggestions.map((c, i) => (
                        <div key={i} onClick={() => { setClinicQuery(c.name); setTreatmentMeta(f => ({ ...f, vet_clinic: c.name })); setClinicSuggestions([]); }}
                          style={{ padding: "9px 13px", fontSize: 13, cursor: "pointer", color: "#3D1F0A", borderBottom: "1px solid #f5f3ff" }}>
                          <div style={{ fontWeight: 700 }}>{c.name}</div>
                          <div style={{ fontSize: 11, color: "#C4845A" }}>{c.formatted_address}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <div>
                  <div style={{ fontSize: 9, color: "#C4845A", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 3 }}>Fecha de emisión</div>
                  <input type="date" style={{ ...inputS, background: "#fff" }} value={treatmentMeta.emission_date} onChange={e => setTreatmentMeta(f => ({ ...f, emission_date: e.target.value }))} />
                </div>
              </div>

              {recipeItems.map(item => {
                const calc = calcBoxes(item);
                const upd = calcUnitsPerDose(item);
                const startTime = `${item.start_hour.toString().padStart(2, "0")}:${item.start_min}`;
                const nextDose = calcNextDose(item.start_date, startTime, item.frequency);

                return (
                  <div key={item.id} style={{ background: "#fff", borderRadius: 16, border: "1.5px solid #C4B5FD", padding: 14, marginBottom: 10 }}>
                    <div onClick={() => toggleExpand(item.id)} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer" }}>
                      <div>
                        <div style={{ fontFamily: "'Baloo 2', cursive", fontSize: 15, fontWeight: 700, color: "#3D1F0A" }}>{item.name || "Sin nombre"}</div>
                        <div style={{ fontSize: 11, color: "#C4845A" }}>{item.prescribed_dose}{item.frequency ? ` · ${item.frequency}` : ""}{item.duration_days ? ` · ${item.duration_days} días` : ""}</div>
                      </div>
                      <div style={{ fontSize: 11, color: "#8B5CF6", fontWeight: 700 }}>{item.expanded ? "▲" : "▼"}</div>
                    </div>

                    {item.expanded && (
                      <div style={{ marginTop: 12 }}>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 10 }}>
                          {[["Medicamento","name"],["Dosis recetada","prescribed_dose"]].map(([label, field]) => (
                            <div key={field}>
                              <div style={{ fontSize: 9, color: "#C4845A", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 3 }}>{label}</div>
                              <input style={inputS} value={item[field]} onChange={e => updateItem(item.id, field, e.target.value)} />
                            </div>
                          ))}
                          <div style={{ gridColumn: "1 / -1" }}>
                            <div style={{ fontSize: 9, color: "#C4845A", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 5 }}>Frecuencia</div>
                            <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginBottom: 6 }}>
                              {["cada 6 horas", "cada 8 horas", "cada 12 horas", "cada 24 horas"].map(f => (
                                <div key={f} onClick={() => updateItem(item.id, "frequency", f)}
                                  style={{ padding: "5px 10px", borderRadius: 8, border: `${item.frequency === f ? "2px solid #8B5CF6" : "1.5px solid #C4B5FD"}`, background: item.frequency === f ? "#f5f3ff" : "#fff", fontSize: 11, fontWeight: item.frequency === f ? 700 : 400, color: item.frequency === f ? "#7c3aed" : "#7A4522", cursor: "pointer" }}>
                                  {f.replace("cada ", "")}
                                </div>
                              ))}
                            </div>
                            <input style={inputS} placeholder="O escribe frecuencia libre..." value={item.frequency} onChange={e => updateItem(item.id, "frequency", e.target.value)} />
                          </div>
                          <div>
                            <div style={{ fontSize: 9, color: "#C4845A", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 3 }}>Días de tratamiento</div>
                            <input style={inputS} type="number" min="1" placeholder="ej: 30" value={item.duration_days || ""} onChange={e => { const v = parseInt(e.target.value); if (v > 0) updateItem(item.id, "duration_days", v); else updateItem(item.id, "duration_days", ""); }} />
                            <div style={{ marginTop: 6 }}>
                              <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#7A4522", cursor: "pointer" }}>
                                <input type="checkbox" checked={item.lifelong || false}
                                  onChange={e => { updateItem(item.id, "lifelong", e.target.checked); if (e.target.checked) updateItem(item.id, "duration_days", null); }}
                                  style={{ width: 14, height: 14, accentColor: "#FF6B35" }} />
                                Agregar también a meds de por vida
                              </label>
                            </div>
                          </div>
                        </div>

                        {/* Inicio del tratamiento */}
                        <div style={{ background: "#FFF0EB", borderRadius: 12, padding: 12, marginBottom: 10 }}>
                          <div style={{ fontSize: 9, color: "#FF6B35", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 8 }}>Inicio del tratamiento</div>
                          <div style={{ marginBottom: 8 }}>
                            <div style={{ fontSize: 9, color: "#C4845A", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 4 }}>Fecha</div>
                            <input type="date" style={{ ...inputS, background: "#fff" }} value={item.start_date} min={today} onChange={e => updateItem(item.id, "start_date", e.target.value)} />
                          </div>
                          <div style={{ fontSize: 9, color: "#C4845A", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 5 }}>Hora</div>
                          <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 8 }}>
                            {HOURS.map(h => (
                              <div key={h} onClick={() => updateItem(item.id, "start_hour", h)}
                                style={{ padding: "5px 8px", borderRadius: 7, border: `${item.start_hour === h ? "2px solid #FF6B35" : "1.5px solid #FFD9C8"}`, background: item.start_hour === h ? "#FFF0EB" : "#fff", fontSize: 11, fontWeight: item.start_hour === h ? 700 : 400, color: item.start_hour === h ? "#CC4A1A" : "#7A4522", cursor: "pointer", minWidth: 32, textAlign: "center" }}>
                                {h.toString().padStart(2, "0")}
                              </div>
                            ))}
                          </div>
                          <div style={{ fontSize: 9, color: "#C4845A", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 5 }}>Minutos</div>
                          <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
                            {["00", "30"].map(m => (
                              <div key={m} onClick={() => updateItem(item.id, "start_min", m)}
                                style={{ flex: 1, padding: "8px", borderRadius: 10, border: `${item.start_min === m ? "2px solid #FF6B35" : "1.5px solid #FFD9C8"}`, background: item.start_min === m ? "#FFF0EB" : "#fff", textAlign: "center", fontSize: 14, fontWeight: item.start_min === m ? 700 : 400, color: item.start_min === m ? "#CC4A1A" : "#7A4522", cursor: "pointer" }}>:{m}</div>
                            ))}
                          </div>
                          {nextDose && <div style={{ fontSize: 11, color: "#7A4522" }}>Próxima toma: <strong style={{ color: "#FF6B35" }}>{nextDose}</strong></div>}
                        </div>

                        {/* Farmacia */}
                        <div style={{ background: "#f5f3ff", borderRadius: 12, padding: 12, marginBottom: 10 }}>
                          <div style={{ fontSize: 9, color: "#8B5CF6", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 8 }}>Volviste de la farmacia</div>
                          <div style={{ marginBottom: 8 }}>
                            <div style={{ fontSize: 9, color: "#C4845A", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 3 }}>Nombre comercial comprado</div>
                            <input style={{ ...inputS, background: "#fff" }} placeholder="ej: Prestat, Genérico..." value={item.brand_name || ""} onChange={e => updateItem(item.id, "brand_name", e.target.value)} />
                          </div>
                          <div style={{ marginBottom: 8 }}>
                            <div style={{ fontSize: 9, color: "#C4845A", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 3 }}>Stock disponible en casa (opcional)</div>
                            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                              <input style={{ ...inputS, background: "#fff", width: 100, flexShrink: 0 }} type="number" min="0" placeholder="ej: 20" value={item.stock_at_home || ""} onChange={e => { const v = parseFloat(e.target.value); updateItem(item.id, "stock_at_home", v >= 0 ? e.target.value : ""); }} />
                              <div style={{ fontSize: 11, color: "#7A4522" }}>unidades ya disponibles</div>
                            </div>
                          </div>
                          <div style={{ marginBottom: 8 }}>
                            <div style={{ fontSize: 9, color: "#C4845A", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 3 }}>Contenido de la caja</div>
                            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                              <input style={{ ...inputS, background: "#fff", width: 80, flexShrink: 0 }} type="number" min="1" placeholder="ej: 30" value={item.units_per_box} onChange={e => { const v = parseInt(e.target.value); if (v > 0) updateItem(item.id, "units_per_box", e.target.value); else updateItem(item.id, "units_per_box", ""); }} />
                              <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                                {["comp.", "cáps."].map(u => (
                                  <div key={u} onClick={() => updateItem(item.id, "box_unit", u)}
                                    style={{ padding: "5px 10px", borderRadius: 8, border: `${(item.box_unit || "comp.") === u ? "2px solid #8B5CF6" : "1.5px solid #C4B5FD"}`, background: (item.box_unit || "comp.") === u ? "#f5f3ff" : "#fff", fontSize: 11, fontWeight: (item.box_unit || "comp.") === u ? 700 : 400, color: (item.box_unit || "comp.") === u ? "#7c3aed" : "#7A4522", cursor: "pointer" }}>
                                    {u}
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>
                          <div style={{ marginBottom: 8 }}>
                            <div style={{ fontSize: 9, color: "#C4845A", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 3 }}>Concentración por unidad (para cálculo de dosis)</div>
                            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                              <input style={{ ...inputS, background: "#fff", width: 80, flexShrink: 0 }} type="number" min="0.001" placeholder="ej: 75" value={item.mg_per_unit} onChange={e => { const v = parseFloat(e.target.value); if (v > 0) updateItem(item.id, "mg_per_unit", e.target.value); else updateItem(item.id, "mg_per_unit", ""); }} />
                              <div style={{ display: "flex", gap: 5 }}>
                                {["mg", "g", "ml"].map(u => (
                                  <div key={u} onClick={() => updateItem(item.id, "dose_unit", u)}
                                    style={{ padding: "5px 10px", borderRadius: 8, border: `${(item.dose_unit || "mg") === u ? "2px solid #8B5CF6" : "1.5px solid #C4B5FD"}`, background: (item.dose_unit || "mg") === u ? "#f5f3ff" : "#fff", fontSize: 11, fontWeight: (item.dose_unit || "mg") === u ? 700 : 400, color: (item.dose_unit || "mg") === u ? "#7c3aed" : "#7A4522", cursor: "pointer" }}>
                                    {u}
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>
                          {calc && (
                            <div style={{ background: "#fff", borderRadius: 8, padding: "10px 12px", fontSize: 12, color: "#3D1F0A", lineHeight: 1.8 }}>
                              <div><strong style={{ color: "#8B5CF6" }}>{upd ?? 1} unidades</strong> por toma · <strong style={{ color: "#8B5CF6" }}>{+((upd ?? 1) * (parseDosesPerDay(item.frequency) || 1)).toFixed(2)}</strong> por día</div>
                              <div>Total necesario: <strong style={{ color: "#8B5CF6" }}>{calc.totalUnits} unidades</strong> para {item.duration_days} días</div>
                              {calc.stockHome > 0 && (
                                <div style={{ color: "#059669" }}>Stock en casa: <strong>{calc.stockHome} unidades</strong> → cubren {calc.daysFromHome} días</div>
                              )}
                              <div style={{ marginTop: 6, padding: "8px 10px", borderRadius: 8, background: calc.boxesNeeded === 0 ? "#E8FAF9" : "#FFF0EB", border: `1px solid ${calc.boxesNeeded === 0 ? "#9FE1CB" : "#FFD0BC"}` }}>
                                {calc.boxesNeeded === 0
                                  ? <span style={{ color: "#059669", fontWeight: 700 }}>✓ Tu stock en casa es suficiente para el tratamiento completo</span>
                                  : calc.boxesNeeded === 1
                                    ? <span style={{ color: "#FF6B35", fontWeight: 700 }}>🛒 Compra 1 caja ({item.units_per_box} unidades){calc.stockHome > 0 ? " además de tu stock" : ""}</span>
                                    : <span style={{ color: "#FF6B35", fontWeight: 700 }}>🛒 Compra {calc.boxesNeeded} cajas — 1 caja alcanza para {calc.daysPerBox} días{calc.stockHome > 0 ? `, con tu stock cubres ${calc.daysFromHome} días más` : ""}</span>
                                }
                                {calc.remaining > 0 && calc.boxesNeeded > 0 && <span style={{ color: "#C4845A" }}> · sobran {calc.remaining} unidades</span>}
                              </div>
                            </div>
                          )}
                        </div>

                      </div>
                    )}
                  </div>
                );
              })}

              {/* Resumen de compra */}
              {recipeItems.some(i => calcBoxes(i)) && (
                <div style={{ background: "#E8FAF9", borderRadius: 14, border: "1.5px solid #2EC4B6", padding: 14, marginBottom: 14 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: "#0F6E56", textTransform: "uppercase", letterSpacing: 1, marginBottom: 10 }}>Resumen de compra</div>
                  {recipeItems.map(item => {
                    const calc = calcBoxes(item);
                    if (!calc) return null;
                    return (
                      <div key={item.id} style={{ display: "flex", justifyContent: "space-between", fontSize: 12, padding: "6px 0", borderBottom: "1px solid #9FE1CB" }}>
                        <span style={{ color: "#3D1F0A", fontWeight: 700 }}>{item.name}</span>
                        <span style={{ color: "#0F6E56", fontWeight: 700 }}>{calc.boxesNeeded} caja{calc.boxesNeeded !== 1 ? "s" : ""}</span>
                      </div>
                    );
                  })}
                </div>
              )}

              {!saved && (
                <button onClick={saveTreatment} disabled={saving} style={{ width: "100%", padding: 14, borderRadius: 13, background: "#8B5CF6", color: "#fff", border: "none", fontFamily: "'Baloo 2', cursive", fontSize: 15, fontWeight: 700, cursor: "pointer", marginBottom: 16 }}>
                  {saving ? "Guardando..." : "✓ Guardar tratamiento"}
                </button>
              )}
              {saved && (
                <div style={{ background: "#E8FAF9", borderRadius: 14, border: "1.5px solid #2EC4B6", padding: 14, marginBottom: 16 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "#0F6E56", marginBottom: 10 }}>✓ Tratamiento guardado correctamente</div>
                  <button onClick={() => { setSaved(false); setRecipeItems([]); setPreview(null); setB64(null); loadTreatments(); setActiveSection(null); }}
                    style={{ width: "100%", padding: 10, borderRadius: 10, background: "#2EC4B6", color: "#fff", border: "none", fontFamily: "'Baloo 2', cursive", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
                    Ver tratamientos guardados
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

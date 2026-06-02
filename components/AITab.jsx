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

export default function AITab({ pet, medications, history }) {
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
  const [savedTreatments, setSavedTreatments] = useState([]);
  const [loadingTreatments, setLoadingTreatments] = useState(false);
  const fileRef = useRef();

  const today = new Date().toISOString().split("T")[0];

  const loadTreatments = async () => {
    setLoadingTreatments(true);
    const { data: treats } = await supabase
      .from("treatments")
      .select("*, treatment_items(*)")
      .eq("pet_id", pet.id)
      .order("created_at", { ascending: false });
    setSavedTreatments(treats || []);
    setLoadingTreatments(false);
  };

  useEffect(() => { loadTreatments(); }, []);

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
      const boxesNeeded = Math.ceil(totalUnits / upb);
      const remaining = +((boxesNeeded * upb) - totalUnits).toFixed(2);
      const daysPerBox = +(upb / (upd * dpd)).toFixed(1);
      return { totalUnits, boxesNeeded, remaining, daysPerBox };
    }
    return null;
  };

  const saveTreatment = async () => {
    setSaving(true);
    const { data: treatment, error: tErr } = await supabase
      .from("treatments")
      .insert({ pet_id: pet.id, recipe_date: today })
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
  };

  const inputS = { width: "100%", padding: "9px 12px", borderRadius: 10, border: "1.5px solid #FFD9C8", background: "#fff", fontFamily: "'Nunito', sans-serif", fontSize: 13, color: "#3D1F0A", outline: "none", boxSizing: "border-box" };
  const card = { background: "#fff", borderRadius: 18, padding: 18, marginBottom: 16, boxShadow: "0 4px 24px rgba(61,31,10,0.08)" };
  const disclaimer = <div style={{ background: "#fef2f2", borderRadius: 10, padding: "10px 12px", marginTop: 10, border: "1px solid #fecaca" }}><div style={{ fontSize: 11, color: "#dc2626", fontWeight: 700 }}>⚠️ Aviso importante</div><div style={{ fontSize: 11, color: "#7A4522", marginTop: 2 }}>Este análisis es orientativo y no reemplaza la consulta veterinaria. Ante cualquier duda, consulta a un profesional.</div></div>;

  if (!activeSection) return (
    <div className="fade-up">
      <style>{`@keyframes bounce{0%,80%,100%{transform:scale(0)}40%{transform:scale(1)}}`}</style>
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 16 }}>
        <div style={{ background: "#FFD166", color: "#7A4522", fontSize: 10, fontWeight: 700, padding: "3px 12px", borderRadius: 20 }}>✦ PRO</div>
      </div>
      <div style={{ fontSize: 13, color: "#7A4522", marginBottom: 16, lineHeight: 1.6 }}>¿Qué quieres hacer hoy con {pet.name}?</div>
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
          {savedTreatments.map(t => (
            <div key={t.id} style={{ background: "#fff", borderRadius: 14, border: "1.5px solid #C4B5FD", padding: 14, marginBottom: 10 }}>
              <div style={{ fontSize: 11, color: "#C4845A", marginBottom: 6 }}>📋 Receta del {t.recipe_date ? new Date(t.recipe_date + "T12:00:00").toLocaleDateString("es-CL") : "—"}</div>
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
      <style>{`@keyframes bounce{0%,80%,100%{transform:scale(0)}40%{transform:scale(1)}}`}</style>
      <button onClick={() => setActiveSection(null)} style={{ background: "none", border: "none", color: "#FF6B35", fontFamily: "'Baloo 2', cursive", fontSize: 13, fontWeight: 700, cursor: "pointer", marginBottom: 16, padding: 0 }}>← Volver</button>

      {/* ANÁLISIS */}
      {activeSection === "analyze" && (
        <div style={card}>
          <div style={{ fontSize: 10, fontWeight: 700, color: "#FF6B35", textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>Análisis personalizado</div>
          <div style={{ fontSize: 12, color: "#7A4522", marginBottom: 12, lineHeight: 1.6 }}>La IA analiza la ficha completa de {pet.name} y genera recomendaciones según su edad, raza, condiciones y medicamentos actuales.</div>
          <button onClick={analyze} disabled={analyzing} style={{ width: "100%", padding: 13, borderRadius: 13, background: "#FF6B35", color: "#fff", border: "none", fontFamily: "'Baloo 2', cursive", fontSize: 15, fontWeight: 700, cursor: "pointer" }}>
            {analyzing ? "Analizando..." : `🔍 Analizar a ${pet.name}`}
          </button>
          {analyzeResult && <><div style={{ background: "#FFF0EB", borderRadius: 12, padding: 14, marginTop: 12, borderLeft: "3px solid #FF6B35" }}><div style={{ fontSize: 11, fontWeight: 700, color: "#FF6B35", marginBottom: 8 }}>Recomendaciones para {pet.name}</div><div style={{ fontSize: 13, color: "#3D1F0A", lineHeight: 1.7, whiteSpace: "pre-wrap" }}>{analyzeResult}</div></div>{disclaimer}</>}
        </div>
      )}

      {/* SÍNTOMAS */}
      {activeSection === "symptom" && (
        <div style={card}>
          <div style={{ fontSize: 10, fontWeight: 700, color: "#2EC4B6", textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>Consulta de síntomas</div>
          <textarea style={{ ...inputS, resize: "vertical", minHeight: 80 }} placeholder={`Ej: ${pet.name} se está rascando mucho las orejas...`} value={symptom} onChange={e => setSymptom(e.target.value)} />
          <button onClick={consultSymptom} disabled={symptomLoading || !symptom.trim()} style={{ width: "100%", padding: 13, borderRadius: 13, background: "#2EC4B6", color: "#fff", border: "none", fontFamily: "'Baloo 2', cursive", fontSize: 15, fontWeight: 700, cursor: "pointer", marginTop: 10 }}>
            {symptomLoading ? "Consultando..." : "🩺 Consultar"}
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
                          {[["Medicamento","name"],["Dosis recetada","prescribed_dose"],["Frecuencia","frequency"]].map(([label, field]) => (
                            <div key={field}>
                              <div style={{ fontSize: 9, color: "#C4845A", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 3 }}>{label}</div>
                              <input style={inputS} value={item[field]} onChange={e => updateItem(item.id, field, e.target.value)} />
                            </div>
                          ))}
                          <div>
                            <div style={{ fontSize: 9, color: "#C4845A", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 3 }}>Días de tratamiento</div>
                            <input style={inputS} type="number" placeholder="ej: 30" value={item.duration_days || ""} onChange={e => updateItem(item.id, "duration_days", parseInt(e.target.value) || null)} />
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
                            <div style={{ fontSize: 9, color: "#C4845A", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 3 }}>Contenido de la caja</div>
                            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                              <input style={{ ...inputS, background: "#fff", width: 80, flexShrink: 0 }} type="number" placeholder="ej: 30" value={item.units_per_box} onChange={e => updateItem(item.id, "units_per_box", e.target.value)} />
                              <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                                {["comp.", "cáps.", "ml", "mg", "g"].map(u => (
                                  <div key={u} onClick={() => updateItem(item.id, "box_unit", u)}
                                    style={{ padding: "5px 10px", borderRadius: 8, border: `${(item.box_unit || "comp.") === u ? "2px solid #8B5CF6" : "1.5px solid #C4B5FD"}`, background: (item.box_unit || "comp.") === u ? "#f5f3ff" : "#fff", fontSize: 11, fontWeight: (item.box_unit || "comp.") === u ? 700 : 400, color: (item.box_unit || "comp.") === u ? "#7c3aed" : "#7A4522", cursor: "pointer" }}>
                                    {u}
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>
                          <div style={{ marginBottom: 8 }}>
                            <div style={{ fontSize: 9, color: "#C4845A", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 3 }}>mg por unidad (para cálculo de dosis)</div>
                            <input style={{ ...inputS, background: "#fff" }} type="number" placeholder="ej: 75" value={item.mg_per_unit} onChange={e => updateItem(item.id, "mg_per_unit", e.target.value)} />
                          </div>
                          {calc && (
                            <div style={{ background: "#fff", borderRadius: 8, padding: "10px 12px", fontSize: 12, color: "#3D1F0A", lineHeight: 1.8 }}>
                              <div><strong style={{ color: "#8B5CF6" }}>{upd ?? 1} unidades</strong> por toma</div>
                              <div><strong style={{ color: "#8B5CF6" }}>{+((upd ?? 1) * (parseDosesPerDay(item.frequency) || 1)).toFixed(2)}</strong> unidades por día</div>
                              <div>Para <strong>{item.duration_days} días</strong> necesitas <strong style={{ color: "#8B5CF6" }}>{calc.totalUnits} unidades totales</strong></div>
                              <div style={{ marginTop: 6, padding: "6px 10px", borderRadius: 8, background: calc.boxesNeeded > 1 ? "#FFF0EB" : "#E8FAF9", border: `1px solid ${calc.boxesNeeded > 1 ? "#FFD0BC" : "#9FE1CB"}` }}>
                                {calc.boxesNeeded > 1
                                  ? <span style={{ color: "#FF6B35", fontWeight: 700 }}>⚠️ Necesitas {calc.boxesNeeded} cajas — 1 caja alcanza para {calc.daysPerBox} días, faltan {Math.ceil(item.duration_days - calc.daysPerBox)} días más</span>
                                  : <span style={{ color: "#059669", fontWeight: 700 }}>✓ 1 caja es suficiente</span>
                                }
                                {calc.remaining > 0 && <span style={{ color: "#C4845A" }}> · sobran {calc.remaining} unidades</span>}
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

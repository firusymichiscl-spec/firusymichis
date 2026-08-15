"use client";
import { useState, useRef, useEffect } from "react";
import { createClient } from "@/lib/supabase";
import { compressImage } from "@/lib/images/compress";
import { logActivity } from "@/lib/activityLog";
import { formatFecha, formatFechaHora, todayInChile, sumarDias } from "@/lib/fechas";
import MarkdownText from "@/components/MarkdownText";
import { guessDrugClass } from "@/lib/clasesFarmacologicas";
import DrugClassLabel from "@/components/DrugClassLabel";
import { validatePhases } from "@/lib/doseSchedule";

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
  return formatFechaHora(next);
};

const HOURS = Array.from({ length: 18 }, (_, i) => i + 6);
const SYMPTOM_MAX_LENGTH = 1000; // debe calzar con el límite server-side en app/api/ai-symptoms/route.js

export default function AITab({ pet, medications, history, isArchived, onTreatmentSaved, onGoToTratamiento }) {
  const supabase = createClient();
  const [activeSection, setActiveSection] = useState(null);

  const [analyzing, setAnalyzing] = useState(false);
  const [analyzeResult, setAnalyzeResult] = useState(null);
  const [analyzeElapsed, setAnalyzeElapsed] = useState(0);
  const [quotaAnalyze, setQuotaAnalyze] = useState(null);

  const [symptom, setSymptom] = useState("");
  const [symptomLoading, setSymptomLoading] = useState(false);
  const [symptomResult, setSymptomResult] = useState(null);
  const [symptomElapsed, setSymptomElapsed] = useState(0);
  const [quotaSymptom, setQuotaSymptom] = useState(null);

  const [userEmail, setUserEmail] = useState("");

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
  const [placeholderIdx, setPlaceholderIdx] = useState(0);
  const [clinicQuery, setClinicQuery] = useState("");
  const [clinicSuggestions, setClinicSuggestions] = useState([]);
  const [clinicSearching, setClinicSearching] = useState(false);
  const fileRef = useRef();

  // Lote M2 — hora de Chile, no UTC (ver lib/fechas.js): el límite "no
  // posterior a hoy" se evaluaba mal cerca de medianoche si se usaba
  // new Date().toISOString().split("T")[0].
  const today = todayInChile();
  const minStartDate = sumarDias(today, -30);
  const maxStartDate = today;
  const [globalStartDate, setGlobalStartDate] = useState(today);

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

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserEmail(data?.user?.email || ""));
  }, []);

  const loadQuota = async (tipo, setter) => {
    try {
      const res = await fetch(`/api/ai-quota?petId=${pet.id}&tipo=${tipo}`);
      if (!res.ok) { setter(null); return; }
      setter(await res.json());
    } catch { setter(null); }
  };

  useEffect(() => {
    if (activeSection === "analyze") loadQuota("analyze", setQuotaAnalyze);
    if (activeSection === "symptom") loadQuota("symptoms", setQuotaSymptom);
  }, [activeSection, pet.id]);

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

  const analyze = async () => {
    setAnalyzing(true);
    setAnalyzeResult(null);
    setAnalyzeElapsed(0);
    const startedAt = Date.now();
    const timer = setInterval(() => setAnalyzeElapsed(Math.floor((Date.now() - startedAt) / 1000)), 1000);
    try {
      const res = await fetch("/api/ai-analyze", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ pet, medications, history }) });
      const ms = Date.now() - startedAt;
      const data = await res.json().catch(() => null);
      // Primero se chequea res.ok — si el servidor bloqueó por cuota (429) o
      // rechazó por validación (400), la respuesta no trae "result", solo
      // "error". Intentar leer .result ahí antes de mirar el status es lo
      // que producía el "Cannot read properties of undefined" en pantalla.
      // Si fue justo por cuota (429), el banner de arriba (renderQuotaBanner)
      // ya va a mostrar el mismo aviso apenas se recargue quotaAnalyze más
      // abajo — no se duplica acá.
      if (res.status === 429) {
        // no-op: el banner de cuota se encarga del mensaje
      } else if (!res.ok || !data || typeof data.result !== "string") {
        setAnalyzeResult({ text: data?.error || "No pudimos procesar tu consulta. Intenta nuevamente en unos minutos.", error: true, at: new Date(), ms });
      } else {
        setAnalyzeResult({ text: data.result, error: false, at: new Date(), ms });
        logActivity(supabase, pet.id, "Consulta IA", `Análisis · ${(ms / 1000).toFixed(1)}s`);
      }
    } catch {
      setAnalyzeResult({ text: "Error al conectar con la IA. Intenta de nuevo.", error: true, at: new Date(), ms: Date.now() - startedAt });
    }
    clearInterval(timer);
    setAnalyzing(false);
    loadQuota("analyze", setQuotaAnalyze);
  };

  const consultSymptom = async () => {
    if (!symptom.trim()) return;
    setSymptomLoading(true);
    setSymptomResult(null);
    setSymptomElapsed(0);
    const startedAt = Date.now();
    const timer = setInterval(() => setSymptomElapsed(Math.floor((Date.now() - startedAt) / 1000)), 1000);
    try {
      const res = await fetch("/api/ai-symptoms", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ pet, medications, history, symptom }) });
      const ms = Date.now() - startedAt;
      const data = await res.json().catch(() => null);
      // Ver comentario equivalente en analyze() — mismo fix: chequear res.ok
      // antes de asumir que la respuesta trae "result", y no duplicar el
      // mensaje si ya lo muestra el banner de cuota.
      if (res.status === 429) {
        // no-op: el banner de cuota se encarga del mensaje
      } else if (!res.ok || !data || typeof data.result !== "string") {
        setSymptomResult({ text: data?.error || "No pudimos procesar tu consulta. Intenta nuevamente en unos minutos.", error: true, at: new Date(), ms });
      } else {
        setSymptomResult({ text: data.result, error: false, at: new Date(), ms });
        logActivity(supabase, pet.id, "Consulta IA", `Síntomas · ${(ms / 1000).toFixed(1)}s`);
      }
    } catch {
      setSymptomResult({ text: "Error al conectar con la IA. Intenta de nuevo.", error: true, at: new Date(), ms: Date.now() - startedAt });
    }
    clearInterval(timer);
    setSymptomLoading(false);
    loadQuota("symptoms", setQuotaSymptom);
  };

  const onFile = async (e) => {
    const f = e.target.files[0];
    if (!f) return;
    setRecipeError(null);
    try {
      const { blob, mediaType: mt } = await compressImage(f);
      setMediaType(mt);
      const r = new FileReader();
      r.onload = (ev) => { setPreview(ev.target.result); setB64(ev.target.result.split(",")[1]); setRecipeItems([]); setSaved(false); };
      r.readAsDataURL(blob);
    } catch (err) {
      setRecipeError(err.message);
    }
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
    // Lote M2 — nueva receta, nueva fecha por defecto. El lector de recetas
    // no extrae hoy la fecha real de la receta (el JSON que pide ai-recipe
    // no incluye una fecha) — "hoy" es el mejor default disponible hasta
    // que eso exista; el selector de abajo deja corregirlo a mano.
    setGlobalStartDate(today);
    try {
      const res = await fetch("/api/ai-recipe", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ imageBase64: b64, mediaType }) });
      const data = await res.json();
      if (data.error || !res.ok) { setRecipeError(data.error || "Error al procesar la receta"); }
      else {
        setRecipeItems(data.result.map((item, i) => ({
          id: i,
          name: item.medicamento || "",
          // Lote L2 Feature 5: sugerencia inicial por nombre reconocido —
          // sigue siendo editable, nunca la decide la IA que leyó la receta.
          drug_class: guessDrugClass(item.medicamento || ""),
          prescribed_dose: item.dosis_recetada || "",
          frequency: item.frecuencia || "",
          duration_days: parseInt(item.duracion) || null,
          // Lote M Feature 1: fases estructuradas que devuelve el lector de
          // recetas — se validan recién al guardar (ver saveRecipe más abajo);
          // acá se guardan tal cual para poder mostrarlas/editarlas mientras
          // se revisa la receta.
          phases: Array.isArray(item.phases) ? item.phases : null,
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

  // Lote M2 Feature 1.5 — el selector global es el valor inicial, no una
  // imposición: si algún medicamento ya tiene una fecha distinta (porque el
  // usuario la cambió a mano, ej. tratamientos que empiezan escalonados),
  // avisa antes de pisarla en todos.
  const applyGlobalStartDate = (newDate) => {
    const hasCustomDates = recipeItems.some(item => item.start_date !== globalStartDate);
    if (hasCustomDates) {
      const confirmed = window.confirm(
        `Ya cambiaste la fecha de inicio de algún medicamento por separado. ¿Aplicar el ${formatFecha(newDate)} a TODOS los medicamentos de esta receta de todas formas?`
      );
      if (!confirmed) return;
    }
    setGlobalStartDate(newDate);
    setRecipeItems(items => items.map(item => ({ ...item, start_date: newDate })));
  };

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
    // Lote M2 Feature 1.3 — validación en cliente antes de guardar (además
    // de los min/max de cada <input type="date">, que un usuario podría
    // saltarse editando el DOM o mandando la petición directo). El servidor
    // tiene su propia validación real: ver migración
    // 20260815_treatment_items_start_date.sql (trigger, no ejecutada aún).
    const invalidItem = recipeItems.find(item => item.start_date < minStartDate || item.start_date > maxStartDate);
    if (invalidItem) {
      alert(`La fecha de inicio de "${invalidItem.name}" (${formatFecha(invalidItem.start_date)}) está fuera del rango permitido: entre el ${formatFecha(minStartDate)} y el ${formatFecha(maxStartDate)}.`);
      return;
    }

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
        // Lote M2 — antes era siempre `today`, sin relación con la fecha de
        // inicio real que el usuario acaba de elegir arriba. recipe_date es
        // literalmente "fecha de la receta", así que corresponde que sea la
        // misma fecha que el selector global, no la fecha en que se digitalizó.
        recipe_date: globalStartDate,
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
        indicaciones: item.indicaciones || null,
        drug_class: item.drug_class?.trim() || null,
        // Lote M Feature 1.6 — se valida acá, no se confía en lo que haya
        // devuelto el modelo: si no calza (array vacío, interval_hours no
        // numérico, duration_days null en una fase que no es la última...),
        // se guarda null y el tratamiento cae al parser de texto libre de
        // lib/doseSchedule.js sobre `frequency`, que sigue siendo la red de
        // seguridad real.
        phases: validatePhases(item.phases),
      });
      if (item.lifelong) {
        await supabase.from("medications").insert({
          pet_id: pet.id, name: item.name, dose: item.prescribed_dose,
          frequency: item.frequency,
          stock: calc ? calc.boxes * parseInt(item.units_per_box) : null,
          unit: item.box_unit || "comp.", color: "#8B5CF6", active: true,
          drug_class: item.drug_class?.trim() || null,
        });
        await logActivity(supabase, pet.id, "Agregó medicamento", item.name);
      }
    }
    await logActivity(supabase, pet.id, "Guardó receta desde IA", treatmentMeta.diagnostico || null);
    // Lote M2 Feature 2.2 — si algún medicamento arrancó en el pasado, van a
    // quedar dosis sin registrar hasta hoy (Feature 2.1: es esperado). Se
    // captura acá, antes de limpiar recipeItems, para que el padre pueda
    // mostrar directamente el aviso de "Ponerse al día" en vez de dejar que
    // el usuario lo descubra solo.
    const hasPastStartDate = recipeItems.some(item => item.start_date < today);
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
      onTreatmentSaved?.({ treatmentId: treatment.id, hasPastStartDate });
    }, 1500);
  };

  const inputS = { width: "100%", padding: "9px 12px", borderRadius: 10, border: "1.5px solid #FFD9C8", background: "#fff", fontFamily: "'Nunito', sans-serif", fontSize: 13, color: "#3D1F0A", outline: "none", boxSizing: "border-box" };
  const card = { background: "#fff", borderRadius: 18, padding: 18, marginBottom: 16, boxShadow: "0 4px 24px rgba(61,31,10,0.08)" };

  const calcAge = (birthDate) => {
    if (!birthDate) return "Sin datos";
    const [by, bm] = birthDate.split("-").map(Number);
    const now = new Date();
    const totalMonths = (now.getFullYear() - by) * 12 + (now.getMonth() + 1 - bm);
    const y = Math.floor(totalMonths / 12);
    const m = totalMonths % 12;
    return `${y} año${y !== 1 ? "s" : ""}${m > 0 ? ` ${m} mes${m !== 1 ? "es" : ""}` : ""}`;
  };
  const speciesLabel = pet.species === "dog" ? "Perro" : pet.species === "cat" ? "Gato" : "Otro";
  const sexLabel = pet.sex === "male" ? "Macho" : pet.sex === "female" ? "Hembra" : "Sin datos";

  const renderResponseHeader = (at) => (
    <div style={{ background: "#FFF7ED", border: "1px solid #FED7AA", borderRadius: 10, padding: "10px 12px", marginBottom: 10, fontSize: 11, color: "#7A4522", lineHeight: 1.8 }}>
      <div id="ai-print-logo" style={{ display: "none", fontFamily: "'Baloo 2', cursive", fontSize: 16, fontWeight: 800, color: "#FF6B35", marginBottom: 8 }}>🐾 Firus&Michis</div>
      <div style={{ color: "#dc2626", fontWeight: 700 }}>⚠️ AVISO: Esta información es solo orientativa y no reemplaza la consulta con un médico veterinario.</div>
      <div style={{ borderTop: "1px dashed #FED7AA", margin: "6px 0" }} />
      <div>Solicitado por: <strong>{userEmail}</strong></div>
      <div>Fecha y hora: <strong>{formatFechaHora(at)}</strong></div>
      <div>Mascota: <strong>{pet.name}</strong> · {speciesLabel} · {pet.breed || "raza desconocida"}</div>
      <div>Edad: <strong>{calcAge(pet.birth_date)}</strong> · Peso: <strong>{pet.weight_kg || "—"} kg</strong> · Sexo: <strong>{sexLabel}</strong></div>
      <div style={{ borderTop: "1px dashed #FED7AA", margin: "6px 0" }} />
    </div>
  );

  const renderResponseFooter = () => (
    <div style={{ background: "#fef2f2", borderRadius: 10, padding: "10px 12px", marginTop: 10, border: "1px solid #fecaca" }}>
      <div style={{ fontSize: 11, color: "#dc2626", fontWeight: 700 }}>⚠️ Recuerda: esta información es orientativa y generada por inteligencia artificial. Ante cualquier síntoma o duda, consulta con tu médico veterinario.</div>
    </div>
  );

  const renderQuotaBanner = (quota) => {
    if (!quota) return null;
    const label = quota.allowed
      ? `Consultas disponibles hoy: ${Math.max(0, quota.todayLimit - quota.todayUsed)} de ${quota.todayLimit}`
      : quota.motivo === "diaria"
        ? `Ya hiciste una consulta para ${pet.name} hoy. Disponible nuevamente mañana 🐾`
        : `Alcanzaste el máximo de ${quota.weekLimit} consultas semanales para ${pet.name}. Disponible el ${formatFecha(quota.disponibleEn)}.`;
    return (
      <div style={{ background: quota.allowed ? "#E8FAF9" : "#fef2f2", border: `1px solid ${quota.allowed ? "#9FE1CB" : "#fecaca"}`, borderRadius: 10, padding: "8px 12px", marginBottom: 10, fontSize: 11, fontWeight: 700, color: quota.allowed ? "#0F6E56" : "#dc2626" }}>
        {label}
      </div>
    );
  };

  const renderPrintButtons = () => (
    <div className="no-print" style={{ display: "flex", gap: 8, marginTop: 10 }}>
      <button onClick={() => window.print()} style={{ flex: 1, padding: 10, borderRadius: 10, background: "#fff", border: "1.5px solid #FFD9C8", color: "#7A4522", fontFamily: "'Baloo 2', cursive", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>🖨️ Imprimir</button>
      <button onClick={() => window.print()} style={{ flex: 1, padding: 10, borderRadius: 10, background: "#fff", border: "1.5px solid #FFD9C8", color: "#7A4522", fontFamily: "'Baloo 2', cursive", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>📄 Guardar PDF</button>
    </div>
  );

  if (isArchived) return (
    <div className="fade-up">
      <div style={card}>
        <div style={{ textAlign: "center", padding: "20px 0" }}>
          <div style={{ fontSize: 36, marginBottom: 10 }}>🌈</div>
          <div style={{ fontSize: 13, color: "#7A4522", lineHeight: 1.6 }}>
            El asistente IA no está disponible para mascotas En Memoria — es una herramienta para crear tratamientos y medicamentos nuevos.
          </div>
        </div>
      </div>
    </div>
  );

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
        <div style={{ marginTop: 8, background: "#f5f3ff", borderRadius: 14, border: "1.5px solid #C4B5FD", padding: 14, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#7c3aed" }}>
              ✓ {savedTreatments.length === 1 ? "Tienes 1 tratamiento guardado" : `Tienes ${savedTreatments.length} tratamientos guardados`}
            </div>
            <div style={{ fontSize: 11, color: "#7A4522", marginTop: 2 }}>en Meds → Tratamiento</div>
          </div>
          <button onClick={() => onGoToTratamiento?.()}
            style={{ background: "#8B5CF6", color: "#fff", border: "none", borderRadius: 10, padding: "8px 14px", fontFamily: "'Baloo 2', cursive", fontSize: 12, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap" }}>
            Ver en Meds →
          </button>
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
          <style>{`@media print{body *{visibility:hidden}#ai-print-area,#ai-print-area *{visibility:visible}#ai-print-area{position:absolute;left:0;top:0;width:100%;padding:20px}#ai-print-area .no-print{display:none!important}#ai-print-logo{display:block!important}}`}</style>
          <div style={{ fontSize: 10, fontWeight: 700, color: "#FF6B35", textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>Análisis personalizado</div>
          <div style={{ fontSize: 12, color: "#7A4522", marginBottom: 12, lineHeight: 1.6 }}>La IA analiza la ficha completa de {pet.name} y genera recomendaciones según su edad, raza, condiciones y medicamentos actuales.</div>
          {renderQuotaBanner(quotaAnalyze)}
          <button onClick={analyze} disabled={analyzing || (quotaAnalyze && !quotaAnalyze.allowed)} style={{ width: "100%", padding: 13, borderRadius: 13, background: "#FF6B35", color: "#fff", border: "none", fontFamily: "'Baloo 2', cursive", fontSize: 15, fontWeight: 700, cursor: "pointer", opacity: (quotaAnalyze && !quotaAnalyze.allowed) ? 0.5 : 1 }}>
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
          {analyzing && <div style={{ fontSize: 11, color: "#C4845A", marginTop: 6, textAlign: "center" }}>Analizando... {analyzeElapsed}s</div>}
          {analyzeResult && (
            analyzeResult.error ? (
              <div style={{ background: "#fef2f2", borderRadius: 12, padding: 14, marginTop: 12, color: "#dc2626", fontSize: 13, fontWeight: 600, border: "1px solid #fecaca" }}>⚠️ {analyzeResult.text}</div>
            ) : (
              <div id="ai-print-area" style={{ marginTop: 12 }}>
                {renderResponseHeader(analyzeResult.at)}
                <div style={{ background: "#FFF0EB", borderRadius: 12, padding: 14, borderLeft: "3px solid #FF6B35" }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "#FF6B35", marginBottom: 8 }}>Recomendaciones para {pet.name}</div>
                  <div style={{ fontSize: 13, color: "#3D1F0A" }}><MarkdownText text={analyzeResult.text} /></div>
                </div>
                {renderResponseFooter()}
                <div style={{ fontSize: 11, color: "#7A4522", marginTop: 8, textAlign: "center" }}>⏱️ Respuesta generada en {(analyzeResult.ms / 1000).toFixed(1)} segundos</div>
                {renderPrintButtons()}
              </div>
            )
          )}
        </div>
      )}

      {/* SÍNTOMAS */}
      {activeSection === "symptom" && (
        <div style={card}>
          <style>{`@media print{body *{visibility:hidden}#ai-print-area,#ai-print-area *{visibility:visible}#ai-print-area{position:absolute;left:0;top:0;width:100%;padding:20px}#ai-print-area .no-print{display:none!important}#ai-print-logo{display:block!important}}`}</style>
          <div style={{ fontSize: 10, fontWeight: 700, color: "#2EC4B6", textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>Consulta de síntomas</div>
          <textarea style={{ ...inputS, resize: "vertical", minHeight: 80 }} placeholder={SYMPTOM_PLACEHOLDERS[placeholderIdx]} value={symptom} maxLength={SYMPTOM_MAX_LENGTH} onChange={e => setSymptom(e.target.value)} />
          <div style={{ fontSize: 10, color: symptom.length >= SYMPTOM_MAX_LENGTH ? "#dc2626" : "#C4845A", textAlign: "right", marginTop: 3 }}>
            {symptom.length}/{SYMPTOM_MAX_LENGTH}
          </div>
          {renderQuotaBanner(quotaSymptom)}
          <button onClick={consultSymptom} disabled={symptomLoading || !symptom.trim() || symptom.length > SYMPTOM_MAX_LENGTH || (quotaSymptom && !quotaSymptom.allowed)} style={{ width: "100%", padding: 13, borderRadius: 13, background: "#2EC4B6", color: "#fff", border: "none", fontFamily: "'Baloo 2', cursive", fontSize: 15, fontWeight: 700, cursor: "pointer", marginTop: 10, opacity: (quotaSymptom && !quotaSymptom.allowed) ? 0.5 : 1 }}>
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
          {symptomLoading && <div style={{ fontSize: 11, color: "#C4845A", marginTop: 6, textAlign: "center" }}>Consultando... {symptomElapsed}s</div>}
          {symptomResult && (
            symptomResult.error ? (
              <div style={{ background: "#fef2f2", borderRadius: 12, padding: 14, marginTop: 12, color: "#dc2626", fontSize: 13, fontWeight: 600, border: "1px solid #fecaca" }}>⚠️ {symptomResult.text}</div>
            ) : (
              <div id="ai-print-area" style={{ marginTop: 12 }}>
                {renderResponseHeader(symptomResult.at)}
                <div style={{ background: "#E8FAF9", borderRadius: 12, padding: 14, borderLeft: "3px solid #2EC4B6" }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "#0F6E56", marginBottom: 8 }}>Análisis de síntomas</div>
                  <div style={{ fontSize: 13, color: "#3D1F0A" }}><MarkdownText text={symptomResult.text} /></div>
                </div>
                {renderResponseFooter()}
                <div style={{ fontSize: 11, color: "#7A4522", marginTop: 8, textAlign: "center" }}>⏱️ Respuesta generada en {(symptomResult.ms / 1000).toFixed(1)} segundos</div>
                {renderPrintButtons()}
              </div>
            )
          )}
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

              {/* Lote M2 — fecha de inicio del tratamiento. Bien visible y
                  arriba de todo: las recetas suelen digitalizarse días
                  después de la consulta, y arrancar "hoy" por defecto
                  corría todo el cálculo de dosis/fases/adherencia. */}
              <div style={{ background: "#FFF0EB", borderRadius: 16, border: "1.5px solid #FFD0BC", padding: 14, marginBottom: 14 }}>
                <div style={{ fontSize: 11, fontWeight: 800, color: "#FF6B35", marginBottom: 3 }}>📅 Fecha de inicio del tratamiento</div>
                <input type="date" style={{ ...inputS, background: "#fff", marginTop: 6 }}
                  value={globalStartDate} min={minStartDate} max={maxStartDate}
                  onChange={e => applyGlobalStartDate(e.target.value)} />
                <div style={{ fontSize: 10, color: "#7A4522", marginTop: 6 }}>
                  Se aplicará a todos los medicamentos de esta receta. Puedes elegir hasta 30 días atrás (desde el {formatFecha(minStartDate)}) — útil si digitalizas la receta días después de la consulta.
                </div>
              </div>

              {/* Datos de la receta */}
              <div style={{ background: "#fff", borderRadius: 16, border: "1.5px solid #FFD9C8", padding: 14, marginBottom: 14 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: "#FF6B35", textTransform: "uppercase", letterSpacing: 1, marginBottom: 10 }}>Datos de la receta</div>
                <div style={{ marginBottom: 8 }}>
                  <div style={{ fontSize: 11, color: "#C4845A", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 3 }}>Diagnóstico</div>
                  <input style={{ ...inputS, background: "#fff" }} placeholder="ej: Neuropatía, dermatitis..." value={treatmentMeta.diagnostico} onChange={e => setTreatmentMeta(f => ({ ...f, diagnostico: e.target.value }))} />
                </div>
                <div style={{ marginBottom: 8 }}>
                  <div style={{ fontSize: 11, color: "#C4845A", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 3 }}>Doctor que recetó</div>
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
                  <div style={{ fontSize: 11, color: "#C4845A", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 3 }}>Veterinaria</div>
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
                  <div style={{ fontSize: 11, color: "#C4845A", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 3 }}>Fecha de emisión</div>
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
                        <div style={{ fontFamily: "'Baloo 2', cursive", fontSize: 15, fontWeight: 700, color: "#3D1F0A" }}>{item.name || "Sin nombre"}<DrugClassLabel drugClass={item.drug_class} style={{ fontSize: 12 }} /></div>
                        <div style={{ fontSize: 11, color: "#C4845A" }}>{item.prescribed_dose}{item.frequency ? ` · ${item.frequency}` : ""}{item.duration_days ? ` · ${item.duration_days} días` : ""}</div>
                      </div>
                      <div style={{ fontSize: 11, color: "#8B5CF6", fontWeight: 700 }}>{item.expanded ? "▲" : "▼"}</div>
                    </div>

                    {item.expanded && (
                      <div style={{ marginTop: 12 }}>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 10 }}>
                          {[["Medicamento","name"],["Dosis recetada","prescribed_dose"]].map(([label, field]) => (
                            <div key={field}>
                              <div style={{ fontSize: 11, color: "#C4845A", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 3 }}>{label}</div>
                              <input style={inputS} value={item[field]} onChange={e => {
                                const value = e.target.value;
                                if (field === "name") {
                                  // Lote L2 Feature 5: solo pre-llena si el usuario no escribió ya
                                  // una clase a mano — nunca pisa una edición manual.
                                  updateItem(item.id, "name", value);
                                  if (!item.drug_class) {
                                    const guess = guessDrugClass(value);
                                    if (guess) updateItem(item.id, "drug_class", guess);
                                  }
                                } else {
                                  updateItem(item.id, field, value);
                                }
                              }} />
                            </div>
                          ))}
                          <div style={{ gridColumn: "1 / -1" }}>
                            <div style={{ fontSize: 11, color: "#C4845A", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 3 }}>Clase farmacológica</div>
                            <input style={inputS} placeholder="Ej: antibiótico" value={item.drug_class || ""} onChange={e => updateItem(item.id, "drug_class", e.target.value)} />
                            <div style={{ fontSize: 10, color: "#C4845A", marginTop: 3 }}>Se sugiere automáticamente si se reconoce el nombre — es solo referencial, puedes editarla.</div>
                          </div>
                          <div style={{ gridColumn: "1 / -1" }}>
                            <div style={{ fontSize: 11, color: "#C4845A", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 5 }}>Frecuencia</div>
                            <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginBottom: 6 }}>
                              {["cada 6 horas", "cada 8 horas", "cada 12 horas", "cada 24 horas"].map(f => (
                                <div key={f} onClick={() => updateItem(item.id, "frequency", f)}
                                  style={{ padding: "5px 10px", borderRadius: 8, border: `1.5px solid ${item.frequency === f ? "var(--color-primary)" : "#C4B5FD"}`, background: item.frequency === f ? "var(--color-primary)" : "#fff", fontSize: 11, fontWeight: item.frequency === f ? 700 : 400, color: item.frequency === f ? "#fff" : "#7A4522", cursor: "pointer" }}>
                                  {f.replace("cada ", "")}
                                </div>
                              ))}
                            </div>
                            <input style={inputS} placeholder="O escribe frecuencia libre..." value={item.frequency} onChange={e => updateItem(item.id, "frequency", e.target.value)} />
                          </div>
                          <div>
                            <div style={{ fontSize: 11, color: "#C4845A", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 3 }}>Días de tratamiento</div>
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
                          <div style={{ fontSize: 11, color: "#FF6B35", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 8 }}>Inicio del tratamiento</div>
                          <div style={{ marginBottom: 8 }}>
                            <div style={{ fontSize: 11, color: "#C4845A", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 4 }}>Fecha</div>
                            {/* Lote M2 — antes min={today} bloqueaba fechas pasadas por
                                completo, hasta a mano; ahora respeta el mismo rango de
                                30 días atrás que el selector global (Feature 1.5: cada
                                medicamento puede tener su propia fecha, ej. tratamientos
                                escalonados). */}
                            <input type="date" style={{ ...inputS, background: "#fff" }} value={item.start_date} min={minStartDate} max={maxStartDate} onChange={e => updateItem(item.id, "start_date", e.target.value)} />
                          </div>
                          <div style={{ fontSize: 11, color: "#C4845A", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 5 }}>Hora</div>
                          <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 8 }}>
                            {HOURS.map(h => (
                              <div key={h} onClick={() => updateItem(item.id, "start_hour", h)}
                                style={{ padding: "5px 8px", borderRadius: 7, border: `${item.start_hour === h ? "2px solid #FF6B35" : "1.5px solid #FFD9C8"}`, background: item.start_hour === h ? "#FFF0EB" : "#fff", fontSize: 11, fontWeight: item.start_hour === h ? 700 : 400, color: item.start_hour === h ? "#CC4A1A" : "#7A4522", cursor: "pointer", minWidth: 32, textAlign: "center" }}>
                                {h.toString().padStart(2, "0")}
                              </div>
                            ))}
                          </div>
                          <div style={{ fontSize: 11, color: "#C4845A", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 5 }}>Minutos</div>
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
                          <div style={{ fontSize: 11, color: "#8B5CF6", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 8 }}>Volviste de la farmacia</div>
                          <div style={{ marginBottom: 8 }}>
                            <div style={{ fontSize: 11, color: "#C4845A", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 3 }}>Nombre comercial comprado</div>
                            <input style={{ ...inputS, background: "#fff" }} placeholder="ej: Prestat, Genérico..." value={item.brand_name || ""} onChange={e => updateItem(item.id, "brand_name", e.target.value)} />
                          </div>
                          <div style={{ marginBottom: 8 }}>
                            <div style={{ fontSize: 11, color: "#C4845A", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 3 }}>Stock disponible en casa (opcional)</div>
                            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                              <input style={{ ...inputS, background: "#fff", width: 100, flexShrink: 0 }} type="number" min="0" placeholder="ej: 20" value={item.stock_at_home || ""} onChange={e => { const v = parseFloat(e.target.value); updateItem(item.id, "stock_at_home", v >= 0 ? e.target.value : ""); }} />
                              <div style={{ fontSize: 11, color: "#7A4522" }}>unidades ya disponibles</div>
                            </div>
                          </div>
                          <div style={{ marginBottom: 8 }}>
                            <div style={{ fontSize: 11, color: "#C4845A", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 3 }}>Contenido de la caja</div>
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
                            <div style={{ fontSize: 11, color: "#C4845A", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 3 }}>Concentración por unidad (para cálculo de dosis)</div>
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

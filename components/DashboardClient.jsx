"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";
import WeightChart from "@/components/WeightChart";
import PetPhotoUpload from "@/components/PetPhotoUpload";
import EditPetModal from "@/components/EditPetModal";
import DietTimeline from "@/components/DietTimeline";
import TutorTab from "@/components/TutorTab";

const TYPE_STYLES = {
  surgery:   { bg: "#fef2f2", text: "#dc2626", dot: "#ef4444", icon: "🔪", label: "Cirugía" },
  illness:   { bg: "#fffbeb", text: "#d97706", dot: "#f59e0b", icon: "🤒", label: "Enfermedad" },
  exam:      { bg: "#eff6ff", text: "#2563eb", dot: "#3b82f6", icon: "🧪", label: "Examen" },
  procedure: { bg: "#f5f3ff", text: "#7c3aed", dot: "#8b5cf6", icon: "⚕️", label: "Procedimiento" },
  other:     { bg: "#f0fdf4", text: "#16a34a", dot: "#22c55e", icon: "📝", label: "Otro" },
};

const MEDS_LIST = [
  'Nexgard','Bravecto','Simparica','Frontline','Revolution','Milbemax','Drontal',
  'Meloxicam','Rimadyl','Previcox','Metacam','Tramadol',
  'Amoxicilina','Cefalexina','Metronidazol','Enrofloxacina','Doxiciclina',
  'Levotiroxina','Trilostano','Prednisolona','Dexametasona',
  'Apoquel','Cytopoint','Atopica',
  'Omeprazol','Sucralfato','Metoclopramida','Famotidina',
  'Omega 3 Vet','Condroitín','Glucosamina','Probióticos Vet',
];

const FREQUENCIES = [
  'Cada 12 horas','1 vez al día','2 veces al día','3 veces al día',
  'Cada 48 horas','Semanal','Mensual','Según necesidad',
];

const UNITS = ['comp.','cáps.','ml.','sobre','ampolla'];

const COLORS = [
  { value: '#FF6B35' },{ value: '#2EC4B6' },{ value: '#FFD166' },
  { value: '#8B5CF6' },{ value: '#EF4444' },{ value: '#10B981' },
];

const FREQ_DOSES_PER_DAY = {
  'Cada 12 horas': 2, '1 vez al día': 1, '2 veces al día': 2,
  '3 veces al día': 3, 'Cada 48 horas': 0.5, 'Semanal': 1/7, 'Mensual': 1/30,
};

const emptyMedForm = {
  name:'', dose:'', frequency:'', frequency_custom:'',
  stock:'', unit:'comp.', color:'#FF6B35', in_ayunas: false,
  mg_per_unit:'', prescribed_dose:'',
};

export default function DashboardClient({ pet, medications: initialMeds, history, vaccines, user, lastWeight }) {
  const router = useRouter();
  const supabase = createClient();
  const [tab, setTab] = useState("ficha");
  const [editingPet, setEditingPet] = useState(false);
  const [petData, setPetData] = useState(pet);
  const [currentWeight, setCurrentWeight] = useState(lastWeight?.weight_kg || pet.weight_kg);

  // Medications
  const [meds, setMeds] = useState(initialMeds);
  const [showMedModal, setShowMedModal] = useState(false);
  const [editingMedId, setEditingMedId] = useState(null);
  const [medForm, setMedForm] = useState(emptyMedForm);
  const [medSaving, setMedSaving] = useState(false);
  const [medSaved, setMedSaved] = useState(false);
  const [customFreq, setCustomFreq] = useState(false);

  const [showHistModal, setShowHistModal] = useState(false);
  const [histForm, setHistForm] = useState({ type: "exam", event: "", event_date: "", vet_name: "", vet_clinic: "", notes: "" });
  const [histSaving, setHistSaving] = useState(false);
  const [histSaved, setHistSaved] = useState(false);
  const [historyData, setHistoryData] = useState(history);
  const [clinicQuery, setClinicQuery] = useState("");
  const [clinicSuggestions, setClinicSuggestions] = useState([]);
  const [clinicSearching, setClinicSearching] = useState(false);
  const [histErrors, setHistErrors] = useState({});

  const activeMeds = meds.filter(m => m.active);
  const historyMeds = meds.filter(m => !m.active);

  const reloadMeds = async () => {
    const { data } = await supabase.from('medications').select('*').eq('pet_id', pet.id).order('created_at', { ascending: false });
    setMeds(data || []);
  };

  const openMedModal = (med = null) => {
    if (med) {
      const isCustom = !FREQUENCIES.includes(med.frequency);
      setMedForm({ name: med.name||'', dose: med.dose||'', frequency: isCustom?'__custom__':(med.frequency||''), frequency_custom: isCustom?(med.frequency||''):'', stock: med.stock?.toString()||'', unit: med.unit||'comp.', color: med.color||'#FF6B35', in_ayunas: med.in_ayunas||false, mg_per_unit:'', prescribed_dose:'' });
      setCustomFreq(isCustom);
      setEditingMedId(med.id);
    } else {
      setMedForm(emptyMedForm);
      setEditingMedId(null);
      setCustomFreq(false);
    }
    setMedSaved(false);
    setShowMedModal(true);
  };

  const closeMedModal = () => { setShowMedModal(false); setEditingMedId(null); setMedSaved(false); };

  const handleMedSave = async () => {
    if (!medForm.name) return;
    setMedSaving(true);
    const freq = medForm.frequency === '__custom__' ? medForm.frequency_custom : medForm.frequency;
    const payload = { pet_id: pet.id, name: medForm.name, dose: medForm.dose||null, frequency: freq||null, stock: medForm.stock ? parseFloat(medForm.stock) : null, unit: medForm.unit, color: medForm.color, active: true };
    if (editingMedId) { await supabase.from('medications').update(payload).eq('id', editingMedId); }
    else { await supabase.from('medications').insert(payload); }
    setMedSaving(false); setMedSaved(true);
    await reloadMeds();
    setTimeout(() => closeMedModal(), 800);
  };

  const setMedActive = async (id, active) => {
    await supabase.from('medications').update({ active }).eq('id', id);
    await reloadMeds();
  };

  const searchClinics = async (q) => {
    setClinicQuery(q);
    setHistForm(f => ({ ...f, vet_clinic: q }));
    if (q.length < 2) { setClinicSuggestions([]); return; }
    setClinicSearching(true);
    try {
      const res = await fetch(`/api/places?q=${encodeURIComponent(q)}`);
      const data = await res.json();
      setClinicSuggestions(data.results || []);
    } catch { setClinicSuggestions([]); }
    setClinicSearching(false);
  };

  const reloadHistory = async () => {
    const { data } = await supabase.from("medical_history").select("*").eq("pet_id", pet.id).order("event_date", { ascending: false });
    setHistoryData(data || []);
  };

  const handleHistSave = async () => {
    const errors = {};
    if (!histForm.event.trim()) errors.event = true;
    if (!histForm.event_date) errors.event_date = true;
    if (Object.keys(errors).length > 0) { setHistErrors(errors); return; }
    setHistErrors({});
    setHistSaving(true);
    await supabase.from("medical_history").insert({
      pet_id: pet.id, type: histForm.type, event: histForm.event,
      event_date: histForm.event_date, vet_name: histForm.vet_name || null,
      vet_clinic: histForm.vet_clinic || null, notes: histForm.notes || null,
    });
    setHistSaving(false); setHistSaved(true);
    await reloadHistory();
    setTimeout(() => {
      setShowHistModal(false); setHistSaved(false); setHistErrors({});
      setHistForm({ type: "exam", event: "", event_date: "", vet_name: "", vet_clinic: "", notes: "" });
      setClinicQuery(""); setClinicSuggestions([]);
    }, 800);
  };

  // Dose calculation (local only)
  const mgPerUnit = parseFloat(medForm.mg_per_unit);
  const prescribedDose = parseFloat(medForm.prescribed_dose);
  const unitsPerDose = mgPerUnit > 0 && prescribedDose > 0 ? +(prescribedDose / mgPerUnit).toFixed(2) : null;
  const freqKey = medForm.frequency === '__custom__' ? medForm.frequency_custom : medForm.frequency;
  const dosesPerDay = FREQ_DOSES_PER_DAY[freqKey] || null;
  const stockVal = parseFloat(medForm.stock);
  const stockDays = unitsPerDose && dosesPerDay && stockVal > 0 ? Math.floor(stockVal / (unitsPerDose * dosesPerDay)) : null;

  // Allergy check
  const allergyAlert = petData.allergies?.length > 0 && medForm.name &&
    petData.allergies.some(a => a.toLowerCase() === medForm.name.toLowerCase());

  const speciesIcon = petData.species === "cat" ? "🐱" : petData.species === "other" ? "🐰" : "🐶";
  const sexSymbol = petData.sex === 'male' ? ' ♂' : petData.sex === 'female' ? ' ♀' : '';

  const calcAge = (birthDate) => {
    if (!birthDate) return "Sin datos";
    const birth = new Date(birthDate);
    const now = new Date();
    const totalMonths = (now.getFullYear() - birth.getFullYear()) * 12 + now.getMonth() - birth.getMonth();
    const y = Math.floor(totalMonths / 12);
    const m = totalMonths % 12;
    return `${y} año${y !== 1 ? "s" : ""}${m > 0 ? ` ${m} mes${m !== 1 ? "es" : ""}` : ""}`;
  };

  const vaccineStatus = (nextDate) => {
    if (!nextDate) return { cls: "warn", label: "Sin fecha" };
    const days = Math.ceil((new Date(nextDate) - new Date()) / 86400000);
    if (days < 0) return { cls: "danger", label: "VENCIDA" };
    if (days < 60) return { cls: "warn", label: `${days}d` };
    return { cls: "ok", label: `${days}d` };
  };

  const handleSignOut = async () => { await supabase.auth.signOut(); router.push("/login"); };

  const formatDate = (dateStr) => {
    if (!dateStr) return "Sin fecha";
    const [y, m, d] = dateStr.split("-");
    return `${d}/${m}/${y}`;
  };

  const inputS = { width:'100%', padding:'9px 12px', borderRadius:10, border:'1.5px solid #FFD9C8', background:'#fff', fontFamily:"'Nunito', sans-serif", fontSize:14, color:'#3D1F0A', outline:'none', boxSizing:'border-box' };
  const fLabel = (t) => <div style={{ fontSize:11, fontWeight:700, color:'#7A4522', textTransform:'uppercase', letterSpacing:'0.5px', marginBottom:4 }}>{t}</div>;

  const css = `
    @import url('https://fonts.googleapis.com/css2?family=Baloo+2:wght@400;600;700;800&family=Nunito:ital,wght@0,400;0,600;0,700;1,400&display=swap');
    :root { --orange:#FF6B35;--mint:#2EC4B6;--cream:#FFF8F3;--brown:#3D1F0A;--brown-light:#C4845A;--brown-pale:#F5E6DA;--yellow:#FFD166;--red:#FF4757;--green:#06D6A0;--card-shadow:0 4px 24px rgba(61,31,10,0.08); }
    *{box-sizing:border-box;margin:0;padding:0;}
    body{font-family:'Nunito',sans-serif;background:var(--cream);color:var(--brown);}
    .app{max-width:900px;margin:0 auto;min-height:100vh;}
    .header{border-radius:0 0 24px 24px;}
    .content{display:grid;grid-template-columns:1fr;gap:0;}
    @media(min-width:640px){.content{grid-template-columns:1fr 1fr;gap:20px;padding:24px;}.tabs{max-width:420px;}}
    @media(max-width:639px){.app{max-width:420px;}.header{border-radius:0;}}
    .header{background:linear-gradient(160deg,#FF6B35 0%,#FF4500 60%,#E63900 100%);padding:20px 20px 0;position:relative;overflow:hidden;}
    .brand{display:flex;align-items:center;justify-content:space-between;margin-bottom:20px;}
    .brand-left{display:flex;align-items:center;gap:10px;}
    .brand-logo{width:38px;height:38px;background:rgba(255,255,255,0.2);border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:20px;}
    .brand-name{font-family:'Baloo 2',cursive;font-size:20px;font-weight:800;color:#fff;}
    .brand-name span{color:var(--yellow);}
    .signout-btn{background:rgba(255,255,255,0.15);border:1px solid rgba(255,255,255,0.3);border-radius:10px;padding:6px 12px;color:#fff;font-family:'Nunito',sans-serif;font-size:11px;font-weight:700;cursor:pointer;}
    .pet-card{display:flex;align-items:center;gap:14px;margin-bottom:20px;max-width:860px;margin-left:auto;margin-right:auto;}
    .brand{max-width:860px;margin-left:auto;margin-right:auto;}
    .conditions-row{max-width:860px;margin-left:auto;margin-right:auto;}
    .pet-avatar{width:68px;height:68px;border-radius:50%;background:linear-gradient(135deg,#FFD166,#FF8C5A);display:flex;align-items:center;justify-content:center;font-size:34px;box-shadow:0 6px 20px rgba(0,0,0,0.2),0 0 0 3px rgba(255,255,255,0.3);flex-shrink:0;}
    .pet-name{font-family:'Baloo 2',cursive;font-size:26px;font-weight:800;color:#fff;line-height:1;margin-bottom:3px;}
    .pet-breed{font-size:12px;color:rgba(255,255,255,0.8);font-style:italic;}
    .today-badge{background:rgba(255,255,255,0.15);border:1px solid rgba(255,255,255,0.25);border-radius:14px;padding:8px 14px;text-align:center;flex-shrink:0;}
    .today-num{font-family:'Baloo 2',cursive;font-size:22px;font-weight:800;color:#fff;line-height:1;}
    .today-label{font-size:9px;color:rgba(255,255,255,0.7);text-transform:uppercase;letter-spacing:0.5px;}
    .conditions-row{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:20px;}
    .condition-pill{background:rgba(255,255,255,0.18);color:#fff;padding:3px 10px;border-radius:20px;font-size:10px;font-weight:600;border:1px solid rgba(255,255,255,0.25);}
    .tabs{display:flex;}
    .tab{flex:1;padding:8px 4px;background:transparent;border:none;color:rgba(255,255,255,0.65);font-family:'Nunito',sans-serif;font-size:10px;font-weight:700;cursor:pointer;text-align:center;border-radius:10px 10px 0 0;}
    .tab.active{background:var(--cream);color:var(--orange);}
    .tab-icon{display:block;font-size:16px;margin-bottom:2px;}
    .content{padding:20px 16px;}
    .card{background:#fff;border-radius:18px;padding:18px;margin-bottom:16px;box-shadow:var(--card-shadow);}
    .card-title{font-family:'Baloo 2',cursive;font-size:13px;font-weight:700;color:var(--orange);text-transform:uppercase;letter-spacing:1px;margin-bottom:14px;}
    .row{display:flex;justify-content:space-between;align-items:flex-start;padding:8px 0;border-bottom:1px solid var(--brown-pale);font-size:13px;}
    .row:last-child{border-bottom:none;}
    .row-label{color:var(--brown-light);font-size:12px;}
    .row-value{font-weight:700;text-align:right;max-width:60%;font-size:13px;}
    .vaccine-row{display:flex;justify-content:space-between;align-items:center;padding:10px 0;border-bottom:1px solid var(--brown-pale);}
    .vaccine-row:last-child{border-bottom:none;}
    .vaccine-name{font-weight:700;font-size:14px;}
    .vaccine-date{font-size:11px;color:var(--brown-light);margin-top:2px;}
    .badge{padding:4px 12px;border-radius:20px;font-size:11px;font-weight:800;}
    .badge-ok{background:#e8faf4;color:#059669;}
    .badge-warn{background:#fff7ed;color:#d97706;}
    .badge-danger{background:#fef2f2;color:#dc2626;}
    .empty-state{text-align:center;padding:32px 16px;color:var(--brown-light);font-size:13px;}
    .empty-icon{font-size:40px;margin-bottom:8px;}
    .add-btn{width:100%;padding:13px;border-radius:13px;background:var(--orange);color:#fff;border:none;font-family:'Baloo 2',cursive;font-size:15px;font-weight:700;cursor:pointer;margin-top:8px;}
    .timeline{position:relative;padding-left:36px;}
    .timeline::before{content:'';position:absolute;left:14px;top:0;bottom:0;width:2px;background:linear-gradient(to bottom,var(--orange),var(--mint));border-radius:2px;}
    .timeline-item{position:relative;margin-bottom:18px;}
    .timeline-dot{position:absolute;left:-28px;top:6px;width:28px;height:28px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:13px;box-shadow:0 0 0 3px var(--cream);}
    .timeline-content{border-radius:14px;padding:10px 14px;}
    .timeline-type{font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:3px;}
    .timeline-event{font-size:13px;font-weight:600;}
    .fade-up{animation:fadeUp 0.35s ease both;}
    @keyframes fadeUp{from{opacity:0;transform:translateY(12px);}to{opacity:1;transform:translateY(0);}}
  `;

  return (
    <>
      <style>{css}</style>
      <div className="app">
        <div className="header">
          <div className="brand">
            <div className="brand-left">
              <div className="brand-logo">🐾</div>
              <div className="brand-name">Firus<span>&</span>Michis</div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 10, color: "rgba(255,255,255,0.7)", marginBottom: 4 }}>{user.email}</div>
              <button className="signout-btn" onClick={handleSignOut}>Cerrar sesión</button>
            </div>
          </div>

          <div className="pet-card">
            <PetPhotoUpload pet={pet} />
            <div style={{ flex: 1 }}>
              <div className="pet-name">{petData.name}</div>
              <div className="pet-breed">{petData.breed}{sexSymbol} · {calcAge(petData.birth_date)}</div>
            </div>
            <div className="today-badge">
              <div className="today-num">{activeMeds.length}</div>
              <div className="today-label">meds activos</div>
            </div>
          </div>

          {petData.conditions?.length > 0 && (
            <div className="conditions-row">
              {petData.conditions.map(c => <span key={c} className="condition-pill">{c}</span>)}
            </div>
          )}

          <div className="tabs">
            {[
              { id: "ficha", icon: "📋", label: "Ficha" },
              { id: "medicamentos", icon: "💊", label: "Meds" },
              { id: "historial", icon: "📅", label: "Historial" },
              { id: "tutor", icon: "👤", label: "Tutor" },
              { id: "operaciones", icon: "🔪", label: "Ops" },
            ].map(t => (
              <button key={t.id} className={`tab${tab === t.id ? " active" : ""}`} onClick={() => setTab(t.id)}>
                <span className="tab-icon">{t.icon}</span>
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <div className="content">

          {/* FICHA */}
          {tab === "ficha" && (
            <div className="fade-up">
              <div className="card">
                <div className="card-title" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span>🐶 Datos básicos</span>
                  <button onClick={() => setEditingPet(true)} style={{ background: "#FFF0EB", border: "1.5px solid #FFD0BC", borderRadius: 8, padding: "4px 10px", fontSize: 12, color: "#FF6B35", fontWeight: 700, cursor: "pointer" }}>✏️ Editar</button>
                </div>
                {[
                  ["Nombre", petData.name],
                  ["Especie", petData.species === "dog" ? "Perro" : petData.species === "cat" ? "Gato" : "Otro"],
                  ["Raza", petData.breed || "Sin datos"],
                  ["Sexo", petData.sex === 'male' ? '♂️ Macho' : petData.sex === 'female' ? '♀️ Hembra' : 'Sin datos'],
                  ["Edad", calcAge(petData.birth_date)],
                  ["Peso actual", currentWeight ? `${currentWeight} kg` : "Sin datos"],
                ].map(([l, v]) => (
                  <div className="row" key={l}>
                    <span className="row-label">{l}</span>
                    <span className="row-value">{v}</span>
                  </div>
                ))}
                {petData.allergies?.length > 0 && (
                  <div style={{ paddingTop: 10, borderTop: "1px solid #F5E6DA" }}>
                    <div style={{ fontSize: 11, color: "#C4845A", marginBottom: 6 }}>⚠️ Alergias a medicamentos</div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                      {petData.allergies.map(a => (
                        <span key={a} style={{ background: "#fef2f2", color: "#dc2626", border: "1px solid #fecaca", borderRadius: 8, padding: "2px 8px", fontSize: 11, fontWeight: 700 }}>{a}</span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <DietTimeline pet={petData} />
              <WeightChart pet={petData} onWeightUpdate={(newKg) => setCurrentWeight(newKg)} />

              <div className="card">
                <div className="card-title">💉 Vacunas</div>
                {vaccines.length === 0 ? (
                  <div className="empty-state"><div className="empty-icon">💉</div><p>Sin vacunas registradas</p></div>
                ) : vaccines.map(v => {
                  const { cls, label } = vaccineStatus(v.next_date);
                  return (
                    <div className="vaccine-row" key={v.id}>
                      <div>
                        <div className="vaccine-name">{v.name}</div>
                        <div className="vaccine-date">Próx: {formatDate(v.next_date)}</div>
                      </div>
                      <div className={`badge badge-${cls}`}>{label}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* MEDICAMENTOS */}
          {tab === "medicamentos" && (
            <div className="fade-up">
              {/* Activos */}
              {activeMeds.length === 0 ? (
                <div className="card">
                  <div className="empty-state"><div className="empty-icon">💊</div><p>Sin medicamentos activos</p></div>
                  <button className="add-btn" onClick={() => openMedModal()}>+ Agregar medicamento</button>
                </div>
              ) : (
                <>
                  {activeMeds.map(med => (
                    <div key={med.id} style={{ background: "#fff", borderRadius: 18, padding: "14px 16px", marginBottom: 12, boxShadow: "var(--card-shadow)", position: "relative", overflow: "hidden", display: "flex" }}>
                      <div style={{ position: "absolute", top: 0, left: 0, bottom: 0, width: 5, background: med.color || "#FF6B35", borderRadius: "18px 0 0 18px" }} />
                      <div style={{ paddingLeft: 14, flex: 1 }}>
                        <div style={{ fontFamily: "'Baloo 2', cursive", fontSize: 16, fontWeight: 800, color: "#3D1F0A" }}>{med.name}</div>
                        {med.dose && <div style={{ fontSize: 12, color: "#C4845A", marginTop: 2 }}>💊 {med.dose}</div>}
                        {med.frequency && <div style={{ fontSize: 12, color: "#C4845A" }}>🕐 {med.frequency}</div>}
                        {med.stock != null && (
                          <div style={{ fontSize: 12, color: "#7A4522", marginTop: 4 }}>📦 Stock: <strong>{med.stock} {med.unit}</strong></div>
                        )}
                        <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
                          <button onClick={() => openMedModal(med)} style={{ padding: "5px 12px", borderRadius: 8, background: "#FFF0EB", color: "#FF6B35", border: "1px solid #FFD0BC", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>✏️ Editar</button>
                          <button onClick={() => setMedActive(med.id, false)} style={{ padding: "5px 12px", borderRadius: 8, background: "#fef2f2", color: "#dc2626", border: "1px solid #fecaca", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>Marcar inactivo</button>
                        </div>
                      </div>
                    </div>
                  ))}
                  <button className="add-btn" onClick={() => openMedModal()}>+ Agregar medicamento</button>
                </>
              )}

              {/* Historial */}
              {historyMeds.length > 0 && (
                <div style={{ marginTop: 20 }}>
                  <div style={{ fontFamily: "'Baloo 2', cursive", fontSize: 12, fontWeight: 700, color: "#C4845A", textTransform: "uppercase", letterSpacing: 1, marginBottom: 10 }}>Historial</div>
                  <div className="card" style={{ padding: "4px 16px" }}>
                    {historyMeds.map((med, i) => (
                      <div key={med.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: i < historyMeds.length - 1 ? "1px solid #FFF0EB" : "none" }}>
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 700, color: "#7A4522" }}>{med.name}</div>
                          {med.dose && <div style={{ fontSize: 11, color: "#C4845A" }}>{med.dose}{med.frequency ? ` · ${med.frequency}` : ""}</div>}
                        </div>
                        <button onClick={() => setMedActive(med.id, true)} style={{ padding: "4px 10px", borderRadius: 8, background: "#e8faf4", color: "#059669", border: "1px solid #a7f3d0", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>Reactivar</button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* HISTORIAL MÉDICO */}
          {tab === "historial" && (
            <div className="fade-up">
              {historyData.length === 0 ? (
                <div className="card">
                  <div className="empty-state"><div className="empty-icon">📅</div><p>Sin historial médico registrado</p></div>
                  <button className="add-btn" onClick={() => setShowHistModal(true)}>+ Agregar evento</button>
                </div>
              ) : (
                <>
                  <div className="timeline">
                    {historyData.map(item => {
                      const s = TYPE_STYLES[item.type] || TYPE_STYLES.other;
                      return (
                        <div className="timeline-item" key={item.id}>
                          <div className="timeline-dot" style={{ background: s.dot }}>{s.icon}</div>
                          <div className="timeline-content" style={{ background: s.bg, border: `1px solid ${s.dot}22` }}>
                            <div className="timeline-type" style={{ color: s.text }}>{s.label} · {formatDate(item.event_date)}</div>
                            <div className="timeline-event">{item.event}</div>
                            {item.vet_clinic && <div style={{ fontSize: 11, color: "var(--brown-light)", marginTop: 2 }}>🏥 {item.vet_clinic}{item.vet_name ? ` · ${item.vet_name}` : ""}</div>}
                            {item.notes && <div style={{ fontSize: 11, color: "var(--brown-light)", marginTop: 4 }}>{item.notes}</div>}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <button className="add-btn" onClick={() => setShowHistModal(true)}>+ Agregar evento</button>
                </>
              )}
            </div>
          )}

          {/* TUTOR */}
          {tab === "tutor" && <TutorTab pet={petData} />}

          {/* OPERACIONES */}
          {tab === "operaciones" && (
            <div className="fade-up">
              <div className="card">
                <div className="empty-state">
                  <div className="empty-icon">🔪</div>
                  <p style={{ fontWeight: 700, marginBottom: 4 }}>Próximamente</p>
                  <p>Historial de intervenciones quirúrgicas</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* MODAL MEDICAMENTO */}
      {showMedModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 1000, display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
          <div style={{ background: "#FFF8F3", borderRadius: "24px 24px 0 0", width: "100%", maxWidth: 480, maxHeight: "92vh", overflowY: "auto" }}>
            <div style={{ background: "linear-gradient(135deg,#FF6B35,#e85d2e)", padding: "16px 20px", borderRadius: "24px 24px 0 0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ fontFamily: "'Baloo 2', cursive", fontSize: 17, fontWeight: 800, color: "#fff" }}>
                {editingMedId ? "✏️ Editar medicamento" : "➕ Nuevo medicamento"}
              </div>
              <button onClick={closeMedModal} style={{ background: "rgba(255,255,255,0.2)", border: "1px solid rgba(255,255,255,0.3)", borderRadius: 10, color: "#fff", fontFamily: "'Baloo 2', cursive", fontSize: 13, fontWeight: 700, padding: "6px 12px", cursor: "pointer" }}>✕ Cerrar</button>
            </div>

            <div style={{ padding: 20 }}>

              {/* Alerta alergia */}
              {allergyAlert && (
                <div style={{ background: "#fef2f2", border: "1.5px solid #fecaca", borderRadius: 10, padding: "10px 14px", marginBottom: 14, display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 18 }}>⚠️</span>
                  <div>
                    <div style={{ fontFamily: "'Baloo 2', cursive", fontSize: 13, fontWeight: 800, color: "#dc2626" }}>ALERTA ALERGIA</div>
                    <div style={{ fontSize: 11, color: "#dc2626" }}>{petData.name} tiene alergia registrada a este medicamento</div>
                  </div>
                </div>
              )}

              {/* Nombre */}
              <div style={{ marginBottom: 12 }}>
                {fLabel("Nombre *")}
                <input style={inputS} list="meds-dl" placeholder="Buscar o escribir medicamento..."
                  value={medForm.name} onChange={e => setMedForm(f => ({ ...f, name: e.target.value }))} />
                <datalist id="meds-dl">{MEDS_LIST.map(m => <option key={m} value={m} />)}</datalist>
              </div>

              {/* Dosis */}
              <div style={{ marginBottom: 12 }}>
                {fLabel("Dosis")}
                <input style={inputS} placeholder="ej: 0.8 mg, 16 mg, 1 comp."
                  value={medForm.dose} onChange={e => setMedForm(f => ({ ...f, dose: e.target.value }))} />
              </div>

              {/* Cálculo dosis */}
              <div style={{ background: "#FFF0EB", borderRadius: 12, padding: 12, marginBottom: 12 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#FF6B35", marginBottom: 8 }}>🧮 Cálculo de unidades (opcional)</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 8 }}>
                  <div>
                    {fLabel("mg por unidad")}
                    <input style={inputS} type="number" placeholder="ej: 200" value={medForm.mg_per_unit}
                      onChange={e => setMedForm(f => ({ ...f, mg_per_unit: e.target.value }))} />
                  </div>
                  <div>
                    {fLabel("Dosis recetada (mg)")}
                    <input style={inputS} type="number" placeholder="ej: 300" value={medForm.prescribed_dose}
                      onChange={e => setMedForm(f => ({ ...f, prescribed_dose: e.target.value }))} />
                  </div>
                </div>
                {unitsPerDose !== null && (
                  <div style={{ fontSize: 13, fontWeight: 700, color: "#3D1F0A" }}>
                    = <span style={{ color: "#FF6B35" }}>{unitsPerDose} {medForm.unit}</span> por toma
                    {stockDays !== null && <span style={{ color: "#C4845A", fontWeight: 400, fontSize: 11 }}> · La caja dura ~{stockDays} días</span>}
                  </div>
                )}
              </div>

              {/* Frecuencia */}
              <div style={{ marginBottom: 12 }}>
                {fLabel("Frecuencia")}
                <select style={{ ...inputS, background: "#fff" }} value={medForm.frequency}
                  onChange={e => { const v = e.target.value; setMedForm(f => ({ ...f, frequency: v, frequency_custom: "" })); setCustomFreq(v === "__custom__"); }}>
                  <option value="">Seleccionar...</option>
                  {FREQUENCIES.map(f => <option key={f} value={f}>{f}</option>)}
                  <option value="__custom__">Otra (escribir)</option>
                </select>
                {customFreq && (
                  <input style={{ ...inputS, marginTop: 8 }} placeholder="Ej: cada 3 días..."
                    value={medForm.frequency_custom} onChange={e => setMedForm(f => ({ ...f, frequency_custom: e.target.value }))} />
                )}
                {/* En ayunas */}
                <label style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8, cursor: "pointer", fontSize: 13, color: "#7A4522", fontWeight: 600 }}>
                  <input type="checkbox" checked={medForm.in_ayunas}
                    onChange={e => setMedForm(f => ({ ...f, in_ayunas: e.target.checked }))}
                    style={{ width: 16, height: 16, accentColor: "#FF6B35" }} />
                  Administrar en ayunas
                </label>
              </div>

              {/* Stock */}
              <div style={{ marginBottom: 12 }}>
                {fLabel("Stock")}
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <input style={{ ...inputS, width: 100, flexShrink: 0 }} type="number" min="0" placeholder="Cant."
                    value={medForm.stock} onChange={e => setMedForm(f => ({ ...f, stock: e.target.value }))} />
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {UNITS.map(u => (
                      <button key={u} onClick={() => setMedForm(f => ({ ...f, unit: u }))}
                        style={{ padding: "6px 12px", borderRadius: 20, border: `1.5px solid ${medForm.unit === u ? "#FF6B35" : "#FFD9C8"}`, background: medForm.unit === u ? "#FFF0EB" : "#fff", color: medForm.unit === u ? "#FF6B35" : "#7A4522", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
                        {u}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Color */}
              <div style={{ marginBottom: 16 }}>
                {fLabel("Color de acento")}
                <div style={{ display: "flex", gap: 10 }}>
                  {COLORS.map(c => (
                    <div key={c.value} onClick={() => setMedForm(f => ({ ...f, color: c.value }))}
                      style={{ width: 30, height: 30, borderRadius: "50%", background: c.value, cursor: "pointer", border: medForm.color === c.value ? "3px solid #3D1F0A" : "3px solid transparent", outline: medForm.color === c.value ? "2px solid #fff" : "none", outlineOffset: -4 }} />
                  ))}
                </div>
              </div>

              <button onClick={handleMedSave} disabled={medSaving || !medForm.name}
                style={{ width: "100%", padding: 13, borderRadius: 13, background: medSaved ? "#2EC4B6" : "#FF6B35", color: "#fff", border: "none", fontFamily: "'Baloo 2', cursive", fontSize: 15, fontWeight: 700, cursor: "pointer", transition: "background 0.3s" }}>
                {medSaved ? "✓ Guardado" : medSaving ? "Guardando..." : editingMedId ? "✓ Actualizar" : "✓ Guardar medicamento"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL HISTORIAL MÉDICO */}
      {showHistModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 1000, display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
          <div style={{ background: "#FFF8F3", borderRadius: "24px 24px 0 0", width: "100%", maxWidth: 480, maxHeight: "92vh", overflowY: "auto" }}>
            <div style={{ background: "linear-gradient(135deg,#FF6B35,#e85d2e)", padding: "16px 20px", borderRadius: "24px 24px 0 0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ fontFamily: "'Baloo 2', cursive", fontSize: 17, fontWeight: 800, color: "#fff" }}>📅 Nuevo evento médico</div>
              <button onClick={() => { setShowHistModal(false); setHistErrors({}); setHistForm({ type: "exam", event: "", event_date: "", vet_name: "", vet_clinic: "" , notes: "" }); setClinicQuery(""); setClinicSuggestions([]); }}
                style={{ background: "rgba(255,255,255,0.2)", border: "1px solid rgba(255,255,255,0.3)", borderRadius: 10, color: "#fff", fontFamily: "'Baloo 2', cursive", fontSize: 13, fontWeight: 700, padding: "6px 12px", cursor: "pointer" }}>✕ Cerrar</button>
            </div>
            <div style={{ padding: 20 }}>
              {/* Tipo */}
              <div style={{ marginBottom: 12 }}>
                {fLabel("Tipo de evento")}
                <div style={{ display: "flex", flexWrap: "wrap", gap: 7, marginTop: 2 }}>
                  {[{ value:"exam",icon:"🧪",label:"Examen"},{value:"illness",icon:"🤒",label:"Enfermedad"},{value:"surgery",icon:"🔪",label:"Cirugía"},{value:"procedure",icon:"⚕️",label:"Procedimiento"},{value:"other",icon:"📝",label:"Otro"}].map(t => (
                    <div key={t.value} onClick={() => setHistForm(f => ({ ...f, type: t.value }))}
                      style={{ padding: "7px 13px", borderRadius: 20, border: `1.5px solid ${histForm.type === t.value ? "#FF6B35" : "#FFD9C8"}`, background: histForm.type === t.value ? "#FFF0EB" : "#fff", fontSize: 12, fontWeight: 700, color: histForm.type === t.value ? "#CC4A1A" : "#7A4522", cursor: "pointer" }}>
                      {t.icon} {t.label}
                    </div>
                  ))}
                </div>
              </div>
              {/* Descripción */}
              <div style={{ marginBottom: 12 }}>
                {fLabel("Descripción *")}
                <input style={{ ...inputS, border: `1.5px solid ${histErrors.event ? "#dc2626" : "#FFD9C8"}` }}
                  placeholder="ej: Control rutinario, Otitis bilateral..."
                  value={histForm.event}
                  onChange={e => { setHistForm(f => ({ ...f, event: e.target.value })); if (histErrors.event) setHistErrors(p => ({ ...p, event: false })); }} />
                {histErrors.event && <div style={{ fontSize: 11, color: "#dc2626", marginTop: 4 }}>⚠️ La descripción es obligatoria</div>}
              </div>
              {/* Fecha */}
              <div style={{ marginBottom: 12 }}>
                {fLabel("Fecha *")}
                <input type="date" style={{ ...inputS, border: `1.5px solid ${histErrors.event_date ? "#dc2626" : "#FFD9C8"}` }}
                  max={new Date().toISOString().split("T")[0]}
                  value={histForm.event_date}
                  onChange={e => { setHistForm(f => ({ ...f, event_date: e.target.value })); if (histErrors.event_date) setHistErrors(p => ({ ...p, event_date: false })); }} />
                {histErrors.event_date && <div style={{ fontSize: 11, color: "#dc2626", marginTop: 4 }}>⚠️ La fecha es obligatoria</div>}
              </div>
              {/* Veterinaria */}
              <div style={{ marginBottom: 12, position: "relative" }}>
                {fLabel("Veterinaria")}
                <input style={inputS} placeholder="Buscar clínica veterinaria..."
                  value={clinicQuery} onChange={e => searchClinics(e.target.value)}
                  spellCheck={false} autoCorrect="off" autoCapitalize="off" lang="es" />
                {clinicSearching && <div style={{ fontSize: 11, color: "#C4845A", marginTop: 4 }}>Buscando...</div>}
                {clinicSuggestions.length > 0 && (
                  <div style={{ position: "absolute", top: "100%", left: 0, right: 0, background: "#fff", border: "1.5px solid #FF6B35", borderRadius: 11, maxHeight: 180, overflowY: "auto", zIndex: 10, boxShadow: "0 4px 16px rgba(61,31,10,0.1)" }}>
                    {clinicSuggestions.map((c, i) => (
                      <div key={i} onClick={() => { setClinicQuery(c.name); setHistForm(f => ({ ...f, vet_clinic: c.name })); setClinicSuggestions([]); }}
                        style={{ padding: "9px 13px", fontSize: 13, cursor: "pointer", color: "#3D1F0A", borderBottom: "1px solid #FFF0EB" }}>
                        <div style={{ fontWeight: 700 }}>{c.name}</div>
                        <div style={{ fontSize: 11, color: "#C4845A" }}>{c.formatted_address}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              {/* Veterinario */}
              <div style={{ marginBottom: 12 }}>
                {fLabel("Veterinario/a")}
                <input style={inputS} placeholder="Nombre del veterinario/a (opcional)"
                  value={histForm.vet_name} onChange={e => setHistForm(f => ({ ...f, vet_name: e.target.value }))} />
              </div>
              {/* Notas */}
              <div style={{ marginBottom: 16 }}>
                {fLabel("Notas")}
                <textarea style={{ ...inputS, resize: "vertical", minHeight: 70 }}
                  placeholder="Observaciones, tratamiento indicado, etc. (opcional)"
                  value={histForm.notes} onChange={e => setHistForm(f => ({ ...f, notes: e.target.value }))} />
              </div>
              <button onClick={handleHistSave} disabled={histSaving || !histForm.event || !histForm.event_date}
                style={{ width: "100%", padding: 13, borderRadius: 13, background: histSaved ? "#2EC4B6" : "#FF6B35", color: "#fff", border: "none", fontFamily: "'Baloo 2', cursive", fontSize: 15, fontWeight: 700, cursor: "pointer", transition: "background 0.3s" }}>
                {histSaved ? "✓ Guardado" : histSaving ? "Guardando..." : "✓ Guardar evento"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL EDITAR MASCOTA */}
      {editingPet && (
        <EditPetModal
          pet={petData}
          onClose={() => setEditingPet(false)}
          onSave={async () => {
              const { data } = await supabase.from("pets").select("*").eq("id", pet.id).single();
              if (data) setPetData(data);
              setEditingPet(false);
            }}
        />
      )}
    </>
  );
}

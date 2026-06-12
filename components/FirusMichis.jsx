"use client";

import { useState, useRef, useEffect } from "react";

const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Baloo+2:wght@400;600;700;800&family=Nunito:ital,wght@0,400;0,600;0,700;1,400&display=swap');

  :root {
    --orange: #FF6B35;
    --orange-light: #FF8C5A;
    --orange-pale: #FFF0EB;
    --mint: #2EC4B6;
    --mint-light: #5ED8D0;
    --mint-pale: #E8FAF9;
    --cream: #FFF8F3;
    --brown: #3D1F0A;
    --brown-mid: #7A4522;
    --brown-light: #C4845A;
    --brown-pale: #F5E6DA;
    --yellow: #FFD166;
    --red: #FF4757;
    --green: #06D6A0;
    --card-shadow: 0 4px 24px rgba(61,31,10,0.08);
  }

  * { box-sizing: border-box; margin: 0; padding: 0; }

  body {
    font-family: 'Nunito', sans-serif;
    background: var(--cream);
    color: var(--brown);
    min-height: 100vh;
  }

  .app { max-width: 420px; margin: 0 auto; min-height: 100vh; position: relative; }

  /* ── HEADER ── */
  .header {
    background: linear-gradient(160deg, #FF6B35 0%, #FF4500 60%, #E63900 100%);
    padding: 20px 20px 0;
    position: relative;
    overflow: hidden;
  }
  .header::before {
    content: '';
    position: absolute;
    top: -40px; right: -40px;
    width: 180px; height: 180px;
    border-radius: 50%;
    background: rgba(255,255,255,0.07);
  }
  .header::after {
    content: '';
    position: absolute;
    bottom: 20px; left: -30px;
    width: 120px; height: 120px;
    border-radius: 50%;
    background: rgba(255,255,255,0.05);
  }

  .brand {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 20px;
    position: relative; z-index: 1;
  }
  .brand-logo {
    width: 38px; height: 38px;
    background: rgba(255,255,255,0.2);
    border-radius: 10px;
    display: flex; align-items: center; justify-content: center;
    font-size: 20px;
    backdrop-filter: blur(10px);
    border: 1px solid rgba(255,255,255,0.3);
  }
  .brand-name {
    font-family: 'Baloo 2', cursive;
    font-size: 20px;
    font-weight: 800;
    color: #fff;
    letter-spacing: -0.3px;
  }
  .brand-name span { color: var(--yellow); }

  .pet-card {
    position: relative; z-index: 1;
    display: flex;
    align-items: center;
    gap: 14px;
    margin-bottom: 20px;
  }
  .pet-avatar {
    width: 68px; height: 68px;
    border-radius: 50%;
    background: linear-gradient(135deg, #FFD166, #FF8C5A);
    display: flex; align-items: center; justify-content: center;
    font-size: 34px;
    box-shadow: 0 6px 20px rgba(0,0,0,0.2), 0 0 0 3px rgba(255,255,255,0.3);
    flex-shrink: 0;
  }
  .pet-info { flex: 1; }
  .pet-name {
    font-family: 'Baloo 2', cursive;
    font-size: 26px;
    font-weight: 800;
    color: #fff;
    line-height: 1;
    margin-bottom: 3px;
  }
  .pet-breed {
    font-size: 12px;
    color: rgba(255,255,255,0.8);
    font-style: italic;
  }
  .today-badge {
    background: rgba(255,255,255,0.15);
    backdrop-filter: blur(10px);
    border: 1px solid rgba(255,255,255,0.25);
    border-radius: 14px;
    padding: 8px 14px;
    text-align: center;
    flex-shrink: 0;
  }
  .today-num {
    font-family: 'Baloo 2', cursive;
    font-size: 22px;
    font-weight: 800;
    color: #fff;
    line-height: 1;
  }
  .today-label { font-size: 9px; color: rgba(255,255,255,0.7); text-transform: uppercase; letter-spacing: 0.5px; }

  .conditions-row {
    display: flex; gap: 6px; flex-wrap: wrap;
    position: relative; z-index: 1;
    margin-bottom: 20px;
  }
  .condition-pill {
    background: rgba(255,255,255,0.18);
    color: #fff;
    padding: 3px 10px;
    border-radius: 20px;
    font-size: 10px;
    font-weight: 600;
    border: 1px solid rgba(255,255,255,0.25);
    backdrop-filter: blur(5px);
  }

  /* ── TABS ── */
  .tabs {
    display: flex;
    position: relative; z-index: 1;
  }
  .tab {
    flex: 1;
    padding: 10px 6px;
    background: transparent;
    border: none;
    color: rgba(255,255,255,0.65);
    font-family: 'Nunito', sans-serif;
    font-size: 11px;
    font-weight: 700;
    cursor: pointer;
    text-align: center;
    transition: all 0.2s;
    border-radius: 10px 10px 0 0;
  }
  .tab.active {
    background: var(--cream);
    color: var(--orange);
  }
  .tab-icon { display: block; font-size: 18px; margin-bottom: 2px; }

  /* ── CONTENT ── */
  .content { padding: 20px 16px; }

  /* ── CARD ── */
  .card {
    background: #fff;
    border-radius: 18px;
    padding: 18px;
    margin-bottom: 16px;
    box-shadow: var(--card-shadow);
  }
  .card-title {
    font-family: 'Baloo 2', cursive;
    font-size: 13px;
    font-weight: 700;
    color: var(--orange);
    text-transform: uppercase;
    letter-spacing: 1px;
    margin-bottom: 14px;
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .row {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    padding: 8px 0;
    border-bottom: 1px solid var(--brown-pale);
    font-size: 13px;
  }
  .row:last-child { border-bottom: none; }
  .row-label { color: var(--brown-light); font-size: 12px; }
  .row-value { font-weight: 700; text-align: right; max-width: 60%; font-size: 13px; }

  /* ── VACCINE ── */
  .vaccine-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 10px 0;
    border-bottom: 1px solid var(--brown-pale);
  }
  .vaccine-row:last-child { border-bottom: none; }
  .vaccine-name { font-weight: 700; font-size: 14px; }
  .vaccine-date { font-size: 11px; color: var(--brown-light); margin-top: 2px; }
  .badge {
    padding: 4px 12px;
    border-radius: 20px;
    font-size: 11px;
    font-weight: 800;
  }
  .badge-ok { background: #e8faf4; color: #059669; }
  .badge-warn { background: #fff7ed; color: #d97706; }
  .badge-danger { background: #fef2f2; color: #dc2626; }

  /* ── MED CARD ── */
  .med-card {
    background: #fff;
    border-radius: 18px;
    padding: 18px;
    margin-bottom: 14px;
    box-shadow: var(--card-shadow);
    position: relative;
    overflow: hidden;
  }
  .med-accent {
    position: absolute;
    top: 0; left: 0; bottom: 0;
    width: 5px;
    border-radius: 18px 0 0 18px;
  }
  .med-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 12px;
    padding-left: 10px;
  }
  .med-name {
    font-family: 'Baloo 2', cursive;
    font-size: 17px;
    font-weight: 700;
  }
  .med-dose { font-size: 12px; color: var(--brown-light); margin-top: 2px; }
  .adherence-num {
    font-family: 'Baloo 2', cursive;
    font-size: 22px;
    font-weight: 800;
    text-align: right;
    line-height: 1;
  }
  .adherence-label { font-size: 9px; color: var(--brown-light); text-transform: uppercase; letter-spacing: 0.5px; }

  .week-grid {
    display: flex;
    gap: 5px;
    padding-left: 10px;
    margin-bottom: 12px;
  }
  .week-day { flex: 1; text-align: center; }
  .week-label { font-size: 9px; color: var(--brown-light); margin-bottom: 4px; font-weight: 700; }
  .week-dot {
    height: 30px;
    border-radius: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 13px;
    font-weight: 700;
    color: #fff;
    transition: transform 0.15s;
  }

  .med-footer {
    display: flex;
    justify-content: space-between;
    font-size: 11px;
    color: var(--brown-light);
    padding-left: 10px;
    padding-top: 6px;
    border-top: 1px solid var(--brown-pale);
  }
  .med-footer strong { color: var(--brown); }

  /* ── TIMELINE ── */
  .timeline { position: relative; padding-left: 36px; }
  .timeline::before {
    content: '';
    position: absolute;
    left: 14px; top: 0; bottom: 0;
    width: 2px;
    background: linear-gradient(to bottom, var(--orange), var(--mint));
    border-radius: 2px;
  }
  .timeline-item {
    position: relative;
    margin-bottom: 18px;
  }
  .timeline-dot {
    position: absolute;
    left: -28px;
    top: 6px;
    width: 28px; height: 28px;
    border-radius: 50%;
    display: flex; align-items: center; justify-content: center;
    font-size: 13px;
    box-shadow: 0 0 0 3px var(--cream);
  }
  .timeline-content {
    border-radius: 14px;
    padding: 10px 14px;
  }
  .timeline-type {
    font-size: 10px;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    margin-bottom: 3px;
  }
  .timeline-event { font-size: 13px; font-weight: 600; }

  /* ── RECIPE ── */
  .upload-zone {
    border: 2.5px dashed var(--orange-light);
    border-radius: 18px;
    padding: 28px 20px;
    text-align: center;
    cursor: pointer;
    background: var(--orange-pale);
    transition: all 0.2s;
    margin-bottom: 16px;
  }
  .upload-zone:hover { background: #ffe4d6; border-color: var(--orange); }
  .upload-icon { font-size: 44px; margin-bottom: 8px; }
  .upload-text { font-size: 14px; color: var(--brown-mid); font-weight: 700; }
  .upload-sub { font-size: 11px; color: var(--brown-light); margin-top: 4px; }

  .btn-primary {
    width: 100%;
    padding: 14px;
    border-radius: 14px;
    background: linear-gradient(135deg, var(--orange), #e85d2e);
    color: #fff;
    border: none;
    font-family: 'Baloo 2', cursive;
    font-size: 16px;
    font-weight: 700;
    cursor: pointer;
    margin-bottom: 16px;
    box-shadow: 0 6px 20px rgba(255,107,53,0.35);
    transition: all 0.2s;
    letter-spacing: 0.3px;
  }
  .btn-primary:hover { transform: translateY(-1px); box-shadow: 0 8px 24px rgba(255,107,53,0.45); }
  .btn-primary:disabled { background: #ddd; box-shadow: none; transform: none; cursor: not-allowed; }

  .btn-mint {
    width: 100%;
    padding: 12px;
    border-radius: 12px;
    background: linear-gradient(135deg, var(--mint), #25a99e);
    color: #fff;
    border: none;
    font-family: 'Baloo 2', cursive;
    font-size: 14px;
    font-weight: 700;
    cursor: pointer;
    margin-top: 14px;
    box-shadow: 0 4px 14px rgba(46,196,182,0.35);
    transition: all 0.2s;
  }

  .result-card {
    background: #fff;
    border-radius: 18px;
    padding: 18px;
    box-shadow: var(--card-shadow);
  }
  .result-header {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 14px;
  }
  .result-ok {
    background: var(--green);
    color: #fff;
    border-radius: 20px;
    padding: 3px 12px;
    font-size: 11px;
    font-weight: 800;
    letter-spacing: 0.3px;
  }
  .result-row {
    display: flex;
    gap: 10px;
    padding: 8px 0;
    border-bottom: 1px solid var(--brown-pale);
    font-size: 13px;
  }
  .result-row:last-child { border-bottom: none; }
  .result-key {
    width: 90px;
    flex-shrink: 0;
    color: var(--brown-light);
    font-size: 11px;
    text-transform: capitalize;
    padding-top: 1px;
  }
  .result-val { font-weight: 700; flex: 1; }

  .error-box {
    background: #fef2f2;
    border-radius: 14px;
    padding: 16px;
    color: var(--red);
    font-size: 13px;
    font-weight: 600;
    border: 1px solid #fecaca;
  }

  /* ── LOADING DOTS ── */
  .loading-dots { display: flex; gap: 5px; justify-content: center; margin: 6px 0; }
  .dot {
    width: 8px; height: 8px;
    border-radius: 50%;
    background: rgba(255,255,255,0.7);
    animation: bounce 1.2s infinite ease-in-out;
  }
  .dot:nth-child(2) { animation-delay: 0.2s; }
  .dot:nth-child(3) { animation-delay: 0.4s; }
  @keyframes bounce {
    0%, 80%, 100% { transform: scale(0.7); opacity: 0.5; }
    40% { transform: scale(1); opacity: 1; }
  }

  /* ── FADE IN ── */
  @keyframes fadeUp {
    from { opacity: 0; transform: translateY(12px); }
    to { opacity: 1; transform: translateY(0); }
  }
  .fade-up { animation: fadeUp 0.35s ease both; }
`;

const KIARA = {
  name: "Kiara",
  breed: "Boyera de Berna",
  age: "8 años 8 meses",
  weight: "38 kg",
  conditions: ["Hipotiroidismo", "Dermatitis atópica", "Otitis recurrente"],
  diet: "Royal Canin Skin Care Hipoalergénico",
  shampoo: "Douxo S3 Calm (medicado)",
  medications: [
    { id: 1, name: "Levotiroxina", dose: "0.8 mg · c/12h", color: "#FF6B35", taken: [true,true,true,true,true,true,false], stock: 24, unit: "comp.", expires: "2025-09-01" },
    { id: 2, name: "Apoquel", dose: "16 mg · 1×día", color: "#2EC4B6", taken: [true,true,false,true,true,false,false], stock: 10, unit: "comp.", expires: "2025-12-15" },
    { id: 3, name: "Omega 3 Vet", dose: "1 cáps. · 1×día", color: "#FFD166", taken: [true,true,true,true,true,true,true], stock: 30, unit: "cáps.", expires: "2026-03-01" },
  ],
  history: [
    { date: "Nov 2024", event: "Extirpación masa párpado derecho", type: "surgery" },
    { date: "Ago 2024", event: "Destartraje bajo anestesia", type: "procedure" },
    { date: "Jun 2024", event: "Otitis bilateral — tratamiento 3 semanas", type: "illness" },
    { date: "Mar 2024", event: "Control hipotiroidismo: sangre + orina", type: "exam" },
    { date: "Nov 2023", event: "Extirpación masa oreja izquierda", type: "surgery" },
    { date: "Jul 2023", event: "Parche caliente zona lumbar", type: "illness" },
  ],
  vaccines: [
    { name: "Sextuple", last: "2024-08-15", next: "2025-08-15" },
    { name: "Rabia", last: "2024-08-15", next: "2025-08-15" },
    { name: "Bordetella", last: "2024-06-01", next: "2025-06-01" },
  ],
};

const TYPE_STYLES = {
  surgery:   { bg: "#fef2f2", text: "#dc2626", dot: "#ef4444", icon: "🔪", label: "Cirugía" },
  illness:   { bg: "#fffbeb", text: "#d97706", dot: "#f59e0b", icon: "🤒", label: "Enfermedad" },
  exam:      { bg: "#eff6ff", text: "#2563eb", dot: "#3b82f6", icon: "🧪", label: "Examen" },
  procedure: { bg: "#f5f3ff", text: "#7c3aed", dot: "#8b5cf6", icon: "⚕️", label: "Procedimiento" },
};

const DAYS = ["L","M","X","J","V","S","D"];

export default function FirusMichis() {
  const [tab, setTab] = useState("ficha");
  const [aiResult, setAiResult] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [preview, setPreview] = useState(null);
  const [b64, setB64] = useState(null);
  const fileRef = useRef();

  const todayTaken = KIARA.medications.filter(m => m.taken[6]).length;

  const onFile = e => {
    const f = e.target.files[0];
    if (!f) return;
    const r = new FileReader();
    r.onload = ev => {
      setPreview(ev.target.result);
      setB64(ev.target.result.split(",")[1]);
      setAiResult(null);
    };
    r.readAsDataURL(f);
  };

  const analyze = async () => {
    if (!b64) return;
    setAiLoading(true);
    setAiResult(null);
    try {
      const res = await fetch("/api/ai-recipe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageBase64: b64, mediaType: "image/jpeg" }),
      });
      const data = await res.json();
      if (data.error) { setAiResult({ error: data.error }); return; }
      const first = Array.isArray(data.result) ? data.result[0] : data.result;
      setAiResult(first || {});
    } catch {
      setAiResult({ error: "No se pudo procesar. Intenta con una foto más clara." });
    }
    setAiLoading(false);
  };

  return (
    <>
      <style>{CSS}</style>
      <div className="app">

        {/* HEADER */}
        <div className="header">
          <div className="brand">
            <div className="brand-logo">🐾</div>
            <div className="brand-name">Firus<span>&</span>Michis</div>
          </div>

          <div className="pet-card">
            <div className="pet-avatar">🐕</div>
            <div className="pet-info">
              <div className="pet-name">{KIARA.name}</div>
              <div className="pet-breed">{KIARA.breed} · {KIARA.age}</div>
            </div>
            <div className="today-badge">
              <div className="today-num">{todayTaken}/{KIARA.medications.length}</div>
              <div className="today-label">dosis hoy</div>
            </div>
          </div>

          <div className="conditions-row">
            {KIARA.conditions.map(c => (
              <span key={c} className="condition-pill">{c}</span>
            ))}
          </div>

          <div className="tabs">
            {[
              { id: "ficha",        icon: "📋", label: "Ficha" },
              { id: "medicamentos", icon: "💊", label: "Meds" },
              { id: "historial",    icon: "📅", label: "Historial" },
              { id: "receta",       icon: "📷", label: "Receta IA" },
            ].map(t => (
              <button key={t.id} className={`tab${tab === t.id ? " active" : ""}`} onClick={() => setTab(t.id)}>
                <span className="tab-icon">{t.icon}</span>
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* CONTENT */}
        <div className="content">

          {/* ── FICHA ── */}
          {tab === "ficha" && (
            <div className="fade-up">
              <div className="card">
                <div className="card-title">🐶 Datos Básicos</div>
                {[
                  ["Nombre", KIARA.name],
                  ["Raza", KIARA.breed],
                  ["Edad", KIARA.age],
                  ["Peso", KIARA.weight],
                ].map(([l,v]) => (
                  <div className="row" key={l}>
                    <span className="row-label">{l}</span>
                    <span className="row-value">{v}</span>
                  </div>
                ))}
              </div>

              <div className="card">
                <div className="card-title">🍽️ Alimentación & Cuidados</div>
                <div className="row">
                  <span className="row-label">Dieta</span>
                  <span className="row-value">{KIARA.diet}</span>
                </div>
                <div className="row">
                  <span className="row-label">Shampoo</span>
                  <span className="row-value">{KIARA.shampoo}</span>
                </div>
              </div>

              <div className="card">
                <div className="card-title">💉 Vacunas</div>
                {KIARA.vaccines.map(v => {
                  const days = Math.ceil((new Date(v.next) - new Date()) / 86400000);
                  const cls = days < 0 ? "badge-danger" : days < 60 ? "badge-warn" : "badge-ok";
                  const label = days < 0 ? "VENCIDA" : `${days}d`;
                  return (
                    <div className="vaccine-row" key={v.name}>
                      <div>
                        <div className="vaccine-name">{v.name}</div>
                        <div className="vaccine-date">Última: {v.last} · Próx: {v.next}</div>
                      </div>
                      <div className={`badge ${cls}`}>{label}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── MEDICAMENTOS ── */}
          {tab === "medicamentos" && (
            <div className="fade-up">
              <div style={{ fontSize: 12, color: "var(--brown-light)", marginBottom: 16, fontStyle: "italic" }}>
                Adherencia últimos 7 días — hoy es domingo
              </div>
              {KIARA.medications.map(med => {
                const pct = Math.round(med.taken.filter(Boolean).length / 7 * 100);
                return (
                  <div className="med-card" key={med.id}>
                    <div className="med-accent" style={{ background: med.color }} />
                    <div className="med-header">
                      <div>
                        <div className="med-name">{med.name}</div>
                        <div className="med-dose">{med.dose}</div>
                      </div>
                      <div>
                        <div className="adherence-num" style={{ color: med.color }}>{pct}%</div>
                        <div className="adherence-label">adherencia</div>
                      </div>
                    </div>
                    <div className="week-grid">
                      {DAYS.map((d, i) => (
                        <div className="week-day" key={i}>
                          <div className="week-label">{d}</div>
                          <div className="week-dot" style={{
                            background: med.taken[i] ? med.color : "var(--brown-pale)",
                            color: med.taken[i] ? "#fff" : "var(--brown-light)",
                          }}>
                            {med.taken[i] ? "✓" : "·"}
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="med-footer">
                      <span>📦 Stock: <strong>{med.stock} {med.unit}</strong></span>
                      <span>Vence: <strong>{med.expires}</strong></span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* ── HISTORIAL ── */}
          {tab === "historial" && (
            <div className="fade-up">
              <div style={{ fontSize: 12, color: "var(--brown-light)", marginBottom: 20, fontStyle: "italic" }}>
                Línea de tiempo médica de {KIARA.name}
              </div>
              <div className="timeline">
                {KIARA.history.map((item, i) => {
                  const s = TYPE_STYLES[item.type];
                  return (
                    <div className="timeline-item" key={i}>
                      <div className="timeline-dot" style={{ background: s.dot }}>
                        {s.icon}
                      </div>
                      <div className="timeline-content" style={{ background: s.bg, border: `1px solid ${s.dot}22` }}>
                        <div className="timeline-type" style={{ color: s.text }}>
                          {s.label} · {item.date}
                        </div>
                        <div className="timeline-event">{item.event}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── RECETA IA ── */}
          {tab === "receta" && (
            <div className="fade-up">
              <div style={{ fontSize: 13, color: "var(--brown-mid)", marginBottom: 18, lineHeight: 1.6 }}>
                Sube la foto de la receta y la IA extraerá el medicamento, dosis y frecuencia automáticamente. 🤖
              </div>

              <div className="upload-zone" onClick={() => fileRef.current.click()}>
                {preview ? (
                  <img src={preview} alt="Receta" style={{ maxWidth: "100%", maxHeight: 200, borderRadius: 10, objectFit: "contain" }} />
                ) : (
                  <>
                    <div className="upload-icon">📋</div>
                    <div className="upload-text">Toca para subir receta</div>
                    <div className="upload-sub">Foto de la receta veterinaria (JPG o PNG)</div>
                  </>
                )}
                <input ref={fileRef} type="file" accept="image/*" onChange={onFile} style={{ display: "none" }} />
              </div>

              {preview && (
                <button className="btn-primary" onClick={analyze} disabled={aiLoading}>
                  {aiLoading ? (
                    <><span>Analizando</span><div className="loading-dots"><div className="dot"/><div className="dot"/><div className="dot"/></div></>
                  ) : "🔍 Analizar con IA"}
                </button>
              )}

              {aiResult && !aiResult.error && (
                <div className="result-card fade-up">
                  <div className="result-header">
                    <span className="result-ok">✓ Receta procesada</span>
                  </div>
                  {Object.entries(aiResult).filter(([,v]) => v).map(([k, v]) => (
                    <div className="result-row" key={k}>
                      <div className="result-key">{k}</div>
                      <div className="result-val">{v}</div>
                    </div>
                  ))}
                  <button className="btn-mint">+ Agregar a medicamentos de {KIARA.name}</button>
                </div>
              )}

              {aiResult?.error && (
                <div className="error-box fade-up">⚠️ {aiResult.error}</div>
              )}
            </div>
          )}

        </div>
      </div>
    </>
  );
}
"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

const PET_ACCENT_COLORS = ["#FF6B35","#2EC4B6","#534AB7","#2D6A4F","#D4537E","#BA7517"];

const TYPE_ICONS = { surgery:"🔪", illness:"🤒", exam:"🧪", procedure:"⚕️", vaccine:"💉", other:"📝" };

function getPetAvatar(species) {
  if (!species) return "🐾";
  const s = species.toLowerCase();
  if (s.includes("perro") || s.includes("dog")) return "🐶";
  if (s.includes("gato") || s.includes("cat")) return "🐱";
  if (s.includes("conejo")) return "🐰";
  if (s.includes("ave") || s.includes("bird")) return "🐦";
  return "🐾";
}

function calcAge(birth) {
  if (!birth) return "—";
  const diff = Date.now() - new Date(birth).getTime();
  const years = Math.floor(diff / (365.25 * 24 * 3600 * 1000));
  const months = Math.floor(diff / (30.5 * 24 * 3600 * 1000));
  return years >= 1 ? `${years} año${years > 1 ? "s" : ""}` : `${months} mes${months > 1 ? "es" : ""}`;
}

function daysUntil(dateStr) {
  if (!dateStr) return null;
  return Math.ceil((new Date(dateStr) - new Date()) / 86400000);
}

function formatDate(d) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("es-CL", { day: "2-digit", month: "short", year: "numeric" });
}

// Misma tabla de frecuencias que components/DashboardClient.jsx (calcProgress) —
// no hay tabla de "dosis marcadas" con timestamp, así que hoy/adherencia se
// estiman a partir del horario del tratamiento, igual que el resto de la app.
const FREQ_HOURS = {
  "cada 6 horas": 6, "cada 8 horas": 8, "cada 12 horas": 12, "cada 24 horas": 24,
  "una vez al día": 24, "1 vez al día": 24, "dos veces al día": 12, "2 veces al día": 12,
  "tres veces al día": 8, "3 veces al día": 8,
};
function freqHours(freq) {
  if (!freq) return null;
  const key = Object.keys(FREQ_HOURS).find(k => freq.toLowerCase().includes(k));
  return key ? FREQ_HOURS[key] : null;
}

const css = `
  @import url('https://fonts.googleapis.com/css2?family=Baloo+2:wght@400;600;700;800&family=Nunito:ital,wght@0,400;0,600;0,700;1,400&display=swap');
  *{box-sizing:border-box;margin:0;padding:0;}
  body{font-family:'Nunito',sans-serif;}
  .ov-page{position:fixed;inset:0;display:flex;flex-direction:column;background:#F0F2F5;font-family:'Nunito',sans-serif;color:#1A1A2E;}
  .ov-topbar{background:linear-gradient(135deg,#1e293b,#0f172a);height:60px;display:flex;align-items:center;padding:0 28px;gap:20px;flex-shrink:0;z-index:20;}
  .ov-topbar-logo{font-family:'Baloo 2',cursive;font-size:20px;font-weight:800;color:#fff;}
  .ov-topbar-logo span{color:#FFD166;}
  .ov-body{display:flex;flex:1;overflow:hidden;}
  .ov-sidebar{width:240px;background:#fff;border-right:1px solid #E2E8F0;display:flex;flex-direction:column;overflow-y:auto;flex-shrink:0;}
  .ov-sidebar-section{padding:16px 12px 8px;font-size:10px;font-weight:800;color:#94A3B8;text-transform:uppercase;letter-spacing:1px;}
  .ov-sidebar-btn{display:flex;align-items:center;gap:10px;padding:10px 16px;border:none;background:transparent;cursor:pointer;font-family:'Nunito',sans-serif;font-size:14px;font-weight:600;color:#475569;width:100%;text-align:left;border-radius:0;transition:all 0.15s;}
  .ov-sidebar-btn:hover{background:#F8FAFC;color:#1e293b;}
  .ov-sidebar-btn.active{background:#FFF5F0;color:#FF6B35;font-weight:700;border-right:3px solid #FF6B35;}
  .ov-content{flex:1;overflow-y:auto;padding:28px;}
  .ov-section-title{font-family:'Baloo 2',cursive;font-size:16px;font-weight:700;color:#1e293b;margin-bottom:16px;display:flex;align-items:center;gap:8px;}
  .ov-stat-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:16px;margin-bottom:28px;}
  .ov-stat{background:#fff;border-radius:16px;padding:22px 24px;box-shadow:0 1px 3px rgba(0,0,0,0.07),0 4px 12px rgba(0,0,0,0.04);}
  .ov-stat-num{font-family:'Baloo 2',cursive;font-size:36px;font-weight:800;line-height:1;margin-bottom:4px;}
  .ov-stat-label{font-size:13px;color:#64748B;font-weight:600;}
  .ov-pet-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:16px;margin-bottom:28px;}
  .ov-pet-card{background:#fff;border-radius:18px;padding:22px;box-shadow:0 1px 3px rgba(0,0,0,0.07),0 4px 12px rgba(0,0,0,0.04);border-top:4px solid;}
  .ov-panel{background:#fff;border-radius:16px;padding:24px;box-shadow:0 1px 3px rgba(0,0,0,0.07),0 4px 12px rgba(0,0,0,0.04);margin-bottom:24px;}
  .ov-table{width:100%;border-collapse:collapse;}
  .ov-table th{text-align:left;padding:10px 14px;font-size:12px;font-weight:700;color:#64748B;text-transform:uppercase;letter-spacing:0.5px;border-bottom:2px solid #F1F5F9;}
  .ov-table td{padding:12px 14px;font-size:14px;border-bottom:1px solid #F1F5F9;vertical-align:middle;}
  .ov-table tr:last-child td{border-bottom:none;}
  .ov-table tr.warn td{background:#FFFBEB;}
  .ov-table tr.danger td{background:#FFF1F1;}
  .ov-badge{display:inline-flex;padding:3px 10px;border-radius:20px;font-size:12px;font-weight:700;}
  .ov-alert-item{display:flex;align-items:flex-start;gap:10px;padding:12px 16px;border-radius:12px;margin-bottom:8px;font-size:14px;}
  .ov-event-row{display:flex;align-items:center;gap:14px;padding:12px 0;border-bottom:1px solid #F1F5F9;}
  .ov-event-row:last-child{border-bottom:none;}
  /* individual pet view */
  .ov-pet-header{background:linear-gradient(135deg,var(--pet-color,#FF6B35),color-mix(in srgb,var(--pet-color,#FF6B35),#000 20%));border-radius:18px;padding:28px;color:#fff;margin-bottom:24px;display:flex;align-items:center;gap:22px;}
  .ov-metric-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:14px;margin-bottom:24px;}
  .ov-metric{background:#fff;border-radius:14px;padding:18px 20px;box-shadow:0 1px 3px rgba(0,0,0,0.07);}
  .ov-metric-val{font-family:'Baloo 2',cursive;font-size:28px;font-weight:800;line-height:1;margin-bottom:4px;}
  .ov-metric-label{font-size:13px;color:#64748B;font-weight:600;}
  @media(max-width:1023px){.ov-page{display:none;}.ov-mobile{display:flex;}}
  @media(min-width:1024px){.ov-mobile{display:none;}}
`;

export default function OverviewClient({ pets, user, userPlan, medications, vaccines, treatments, latestWeights, tutors, history }) {
  const router = useRouter();
  const [selectedPet, setSelectedPet] = useState(null);

  // ── Derived data ──────────────────────────────────
  const activeMeds = medications.filter(m => m.active !== false);
  const vaccinesExpiringSoon = vaccines.filter(v => { const d = daysUntil(v.next_date); return d !== null && d >= 0 && d <= 60; });
  const nextVaccines90 = vaccines
    .map(v => ({ ...v, days: daysUntil(v.next_date) }))
    .filter(v => v.days !== null && v.days >= 0 && v.days <= 90)
    .sort((a, b) => a.days - b.days);

  const alerts = [];
  activeMeds.forEach(m => {
    if (m.stock != null && m.stock < 10) {
      const pet = pets.find(p => p.id === m.pet_id);
      alerts.push({ type: "stock", text: `Stock bajo: ${m.name} (${pet?.name})`, detail: `${m.stock} ${m.unit || "unid."} restantes`, color: "#d97706" });
    }
  });
  vaccines.forEach(v => {
    const d = daysUntil(v.next_date);
    const pet = pets.find(p => p.id === v.pet_id);
    if (d !== null && d < 0) alerts.push({ type: "vaccine", text: `Vacuna vencida: ${v.name} (${pet?.name})`, detail: `Hace ${Math.abs(d)} días`, color: "#dc2626" });
    else if (d !== null && d <= 14) alerts.push({ type: "vaccine", text: `Vacuna próxima: ${v.name} (${pet?.name})`, detail: `En ${d} días`, color: "#d97706" });
  });

  // ── Helpers ───────────────────────────────────────
  function petColor(pet) { return PET_ACCENT_COLORS[pets.indexOf(pet) % PET_ACCENT_COLORS.length]; }
  function petTutorPrimary(petId) { return tutors.find(t => t.pet_id === petId && t.type === "primary"); }
  function petMeds(petId) { return activeMeds.filter(m => m.pet_id === petId); }
  function petVaccines(petId) { return vaccines.filter(v => v.pet_id === petId); }
  function petNextVaccine(petId) {
    return petVaccines(petId).map(v => ({ ...v, days: daysUntil(v.next_date) })).filter(v => v.days !== null && v.days >= 0).sort((a, b) => a.days - b.days)[0];
  }
  function petDoseStats(petId) {
    const items = treatments.filter(t => t.pet_id === petId).flatMap(t => t.treatment_items || []);
    const now = new Date();
    const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    let dosesToday = 0, progressSum = 0, progressCount = 0;
    items.forEach(ti => {
      const hrs = freqHours(ti.frequency);
      if (!hrs || !ti.start_date || !ti.start_time) return;
      const start = new Date(`${ti.start_date}T${ti.start_time}:00`);
      const totalDoses = Math.round(((ti.duration_days || 0) * 24) / hrs);
      if (totalDoses <= 0) return;
      const dosesUpTo = (t) => Math.min(totalDoses, Math.max(0, Math.floor((t - start) / 3600000 / hrs)));
      const doneNow = dosesUpTo(now);
      dosesToday += Math.max(0, doneNow - dosesUpTo(dayStart));
      progressSum += Math.round((doneNow / totalDoses) * 100);
      progressCount++;
    });
    return { dosesToday, adherence: progressCount ? Math.round(progressSum / progressCount) : null };
  }

  // ── Sidebar ───────────────────────────────────────
  const Sidebar = (
    <div className="ov-sidebar">
      <div className="ov-sidebar-section">Navegación</div>
      <button className={`ov-sidebar-btn${!selectedPet ? " active" : ""}`} onClick={() => setSelectedPet(null)}>
        <span>📊</span> Todas las mascotas
      </button>
      <div className="ov-sidebar-section">Mascotas</div>
      {pets.map((p, i) => (
        <button key={p.id} className={`ov-sidebar-btn${selectedPet?.id === p.id ? " active" : ""}`}
          onClick={() => setSelectedPet(p)}
          style={{ borderRight: selectedPet?.id === p.id ? `3px solid ${PET_ACCENT_COLORS[i % PET_ACCENT_COLORS.length]}` : undefined }}>
          <span>{getPetAvatar(p.species)}</span> {p.name}
        </button>
      ))}
      <div className="ov-sidebar-section">Acciones</div>
      <button className="ov-sidebar-btn" onClick={() => router.push("/nueva-mascota")}>
        <span>➕</span> Nueva mascota
      </button>
      <div style={{ flex: 1 }} />
      <button className="ov-sidebar-btn" onClick={() => router.push("/dashboard")} style={{ color: "#FF6B35", borderTop: "1px solid #F1F5F9" }}>
        <span>←</span> Dashboard
      </button>
    </div>
  );

  // ── Vista "Todas" ──────────────────────────────────
  const ViewAll = (
    <div className="ov-content">
      {/* Stats globales */}
      <div className="ov-stat-grid">
        <div className="ov-stat">
          <div className="ov-stat-num" style={{ color: "#FF6B35" }}>{activeMeds.length}</div>
          <div className="ov-stat-label">💊 Medicamentos activos</div>
        </div>
        <div className="ov-stat">
          <div className="ov-stat-num" style={{ color: "#d97706" }}>{vaccinesExpiringSoon.length}</div>
          <div className="ov-stat-label">💉 Vacunas por vencer (60 días)</div>
        </div>
        <div className="ov-stat">
          <div className="ov-stat-num" style={{ color: "#2EC4B6" }}>{treatments.length}</div>
          <div className="ov-stat-label">📋 Tratamientos activos</div>
        </div>
      </div>

      {/* Cards por mascota */}
      <div className="ov-section-title">🐾 Mis mascotas</div>
      <div className="ov-pet-grid">
        {pets.map((p, i) => {
          const color = PET_ACCENT_COLORS[i % PET_ACCENT_COLORS.length];
          const meds = petMeds(p.id);
          const nv = petNextVaccine(p.id);
          const tutor = petTutorPrimary(p.id);
          const w = latestWeights[p.id];
          return (
            <div key={p.id} className="ov-pet-card" style={{ borderTopColor: color }}>
              <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 16 }}>
                <div style={{ width: 56, height: 56, borderRadius: "50%", background: color + "20", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28, flexShrink: 0, overflow: "hidden" }}>
                  {p.photo_url
                    ? <img src={p.photo_url} alt={p.name} style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "50%" }} />
                    : getPetAvatar(p.species)}
                </div>
                <div>
                  <div style={{ fontFamily: "'Baloo 2', cursive", fontSize: 22, fontWeight: 800, color: "#1e293b" }}>{p.name}</div>
                  <div style={{ fontSize: 13, color: "#64748B" }}>{p.breed} · {calcAge(p.birth_date)}{w ? ` · ${w.weight_kg} kg` : ""}</div>
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 14 }}>
                <div style={{ background: "#F8FAFC", borderRadius: 10, padding: "10px 14px" }}>
                  <div style={{ fontFamily: "'Baloo 2', cursive", fontSize: 22, fontWeight: 800, color }}>{meds.length}</div>
                  <div style={{ fontSize: 12, color: "#64748B" }}>meds activos</div>
                </div>
                <div style={{ background: "#F8FAFC", borderRadius: 10, padding: "10px 14px" }}>
                  <div style={{ fontFamily: "'Baloo 2', cursive", fontSize: 22, fontWeight: 800, color }}>{treatments.filter(t => t.pet_id === p.id).length}</div>
                  <div style={{ fontSize: 12, color: "#64748B" }}>tratamientos</div>
                </div>
              </div>

              {p.conditions?.length > 0 && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginBottom: 12 }}>
                  {p.conditions.map(c => (
                    <span key={c} style={{ background: color + "15", color, padding: "3px 10px", borderRadius: 20, fontSize: 12, fontWeight: 700 }}>{c}</span>
                  ))}
                </div>
              )}

              {tutor && (
                <div style={{ fontSize: 13, color: "#475569", marginBottom: 10, display: "flex", alignItems: "center", gap: 6 }}>
                  <span>👤</span>
                  <span style={{ fontWeight: 600 }}>{tutor.name}</span>
                  {tutor.phone && <span style={{ color: "#94A3B8" }}>· {tutor.phone}</span>}
                </div>
              )}

              {nv && (
                <div style={{ fontSize: 13, color: nv.days <= 14 ? "#d97706" : "#059669", marginBottom: 12 }}>
                  💉 {nv.name}: en {nv.days} días
                </div>
              )}

              <button onClick={() => setSelectedPet(p)}
                style={{ width: "100%", padding: "9px", borderRadius: 10, background: color, color: "#fff", border: "none", fontFamily: "'Baloo 2', cursive", fontSize: 14, fontWeight: 700, cursor: "pointer" }}>
                Ver detalle →
              </button>
            </div>
          );
        })}
      </div>

      {/* Alertas */}
      <div className="ov-panel">
        <div className="ov-section-title">🚨 Alertas activas</div>
        {alerts.length === 0
          ? <div style={{ color: "#64748B", fontSize: 14, padding: "8px 0" }}>✓ Sin alertas activas</div>
          : alerts.map((a, i) => (
            <div key={i} className="ov-alert-item" style={{ background: a.color + "12", border: `1px solid ${a.color}30` }}>
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: a.color, marginTop: 5, flexShrink: 0 }} />
              <div>
                <div style={{ fontWeight: 700, color: a.color }}>{a.text}</div>
                <div style={{ fontSize: 13, color: "#64748B" }}>{a.detail}</div>
              </div>
            </div>
          ))}
      </div>

      {/* Tabla tratamientos activos */}
      <div className="ov-panel">
        <div className="ov-section-title">💊 Medicamentos activos</div>
        {activeMeds.length === 0
          ? <div style={{ color: "#64748B", fontSize: 14 }}>Sin medicamentos activos</div>
          : <table className="ov-table">
            <thead>
              <tr>
                <th>Mascota</th>
                <th>Medicamento</th>
                <th>Dosis</th>
                <th>Frecuencia</th>
                <th>Stock</th>
                <th>Vence</th>
              </tr>
            </thead>
            <tbody>
              {activeMeds.map(m => {
                const pet = pets.find(p => p.id === m.pet_id);
                const stockLow = m.stock != null && m.stock < 10;
                const expired = m.end_date && new Date(m.end_date) < new Date();
                const rowClass = stockLow || expired ? "danger" : "";
                const color = PET_ACCENT_COLORS[pets.indexOf(pet) % PET_ACCENT_COLORS.length];
                return (
                  <tr key={m.id} className={rowClass}>
                    <td>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                        <span style={{ width: 10, height: 10, borderRadius: "50%", background: color, display: "inline-block" }} />
                        <span style={{ fontWeight: 700 }}>{pet?.name || "—"}</span>
                      </span>
                    </td>
                    <td style={{ fontWeight: 600 }}>{m.name}</td>
                    <td>{m.dose || "—"}</td>
                    <td>{m.frequency || "—"}</td>
                    <td>
                      {m.stock != null
                        ? <span className="ov-badge" style={{ background: stockLow ? "#FEE2E2" : "#D1FAE5", color: stockLow ? "#DC2626" : "#059669" }}>
                            {m.stock} {m.unit || ""}
                          </span>
                        : "—"}
                    </td>
                    <td>{m.end_date ? formatDate(m.end_date) : "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>}
      </div>

      {/* Próximos eventos (vacunas) */}
      <div className="ov-panel">
        <div className="ov-section-title">📅 Próximas vacunas (90 días)</div>
        {nextVaccines90.length === 0
          ? <div style={{ color: "#64748B", fontSize: 14 }}>Sin vacunas próximas en 90 días</div>
          : nextVaccines90.map((v) => {
            const pet = pets.find(p => p.id === v.pet_id);
            const color = PET_ACCENT_COLORS[pets.indexOf(pet) % PET_ACCENT_COLORS.length];
            return (
              <div key={v.id} className="ov-event-row">
                <div style={{ width: 44, height: 44, borderRadius: 12, background: color + "15", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, flexShrink: 0 }}>💉</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: 14, color: "#1e293b" }}>{v.name}</div>
                  <div style={{ fontSize: 13, color: "#64748B" }}>{pet?.name} · {formatDate(v.next_date)}</div>
                </div>
                <span className="ov-badge" style={{ background: v.days <= 14 ? "#FEF3C7" : "#DBEAFE", color: v.days <= 14 ? "#D97706" : "#1D4ED8" }}>
                  en {v.days} días
                </span>
              </div>
            );
          })}
      </div>

      {/* Panel pesos */}
      <div className="ov-panel">
        <div className="ov-section-title">⚖️ Último peso registrado</div>
        {pets.map((p, i) => {
          const color = PET_ACCENT_COLORS[i % PET_ACCENT_COLORS.length];
          const w = latestWeights[p.id];
          const maxW = Math.max(...pets.map(pt => latestWeights[pt.id]?.weight_kg || 0), 1);
          const pct = w ? Math.round((w.weight_kg / maxW) * 100) : 0;
          return (
            <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 14, padding: "12px 0", borderBottom: i < pets.length - 1 ? "1px solid #F1F5F9" : "none" }}>
              <div style={{ fontSize: 22 }}>{getPetAvatar(p.species)}</div>
              <div style={{ width: 100, fontWeight: 700, fontSize: 14, color: "#1e293b" }}>{p.name}</div>
              <div style={{ flex: 1, height: 10, background: "#F1F5F9", borderRadius: 5, overflow: "hidden" }}>
                <div style={{ width: `${pct}%`, height: "100%", background: color, borderRadius: 5, transition: "width 0.5s" }} />
              </div>
              <div style={{ width: 70, textAlign: "right", fontSize: 14, fontWeight: 700, color: "#1e293b" }}>
                {w ? `${w.weight_kg} kg` : "—"}
              </div>
              {w && <div style={{ fontSize: 12, color: "#94A3B8", width: 80, textAlign: "right" }}>{formatDate(w.logged_date)}</div>}
            </div>
          );
        })}
      </div>
    </div>
  );

  return (
    <>
      <style>{css}</style>

      {/* Mobile fallback */}
      <div className="ov-mobile" style={{ minHeight: "100vh", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 32, textAlign: "center", gap: 16, background: "#F0F2F5" }}>
        <div style={{ fontSize: 48 }}>🖥️</div>
        <div style={{ fontFamily: "'Baloo 2', cursive", fontSize: 20, fontWeight: 800, color: "#1e293b" }}>Vista disponible solo en pantalla grande</div>
        <div style={{ fontSize: 14, color: "#64748B", maxWidth: 280 }}>La vista general requiere una pantalla de al menos 1024px.</div>
        <button onClick={() => router.push("/dashboard")}
          style={{ padding: "10px 24px", borderRadius: 12, background: "#FF6B35", color: "#fff", border: "none", fontFamily: "'Baloo 2', cursive", fontSize: 14, fontWeight: 700, cursor: "pointer" }}>
          ← Volver al dashboard
        </button>
      </div>

      <div className="ov-page">
        {/* Topbar */}
        <div className="ov-topbar">
          <div className="ov-topbar-logo">Firus<span>&</span>Michis</div>
          <div style={{ fontSize: 13, color: "#94A3B8", flex: 1 }}>{selectedPet ? `/ ${selectedPet.name}` : "/ Vista general"}</div>
          <div style={{ fontSize: 13, color: "#94A3B8" }}>{user.email}</div>
          <span style={{ background: "rgba(255,255,255,0.12)", color: "#94A3B8", fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 10, textTransform: "uppercase" }}>
            {userPlan}
          </span>
          <button onClick={() => router.push("/dashboard")}
            style={{ background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.2)", borderRadius: 10, padding: "6px 14px", color: "#E2E8F0", fontFamily: "'Nunito',sans-serif", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
            ← Volver al dashboard
          </button>
        </div>

        <div className="ov-body">
          {Sidebar}
          {selectedPet ? (
            <PetDetailView
              pet={selectedPet}
              color={petColor(selectedPet)}
              meds={petMeds(selectedPet.id)}
              nv={petNextVaccine(selectedPet.id)}
              w={latestWeights[selectedPet.id]}
              petTutors={tutors.filter(t => t.pet_id === selectedPet.id)}
              petHistory={history.filter(h => h.pet_id === selectedPet.id).slice(0, 3)}
              doseStats={petDoseStats(selectedPet.id)}
              router={router}
              onBack={() => setSelectedPet(null)}
            />
          ) : ViewAll}
        </div>
      </div>
    </>
  );
}

const TUTOR_LABELS = { primary: "Principal", secondary: "Secundario", tertiary: "Adicional" };

// ── Vista mascota individual (componente de nivel de módulo: no se
// recrea en cada render de OverviewClient) ──────────────────────
function PetDetailView({ pet, color, meds, nv, w, petTutors, petHistory, doseStats, router, onBack }) {
  const criticalStock = meds.filter(m => m.stock != null && m.stock < 10).length;

  return (
    <div className="ov-content">
      {/* Header mascota */}
        <div className="ov-pet-header" style={{ "--pet-color": color }}>
          <div style={{ width: 80, height: 80, borderRadius: "50%", background: "rgba(255,255,255,0.2)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 40, flexShrink: 0, overflow: "hidden" }}>
            {pet.photo_url
              ? <img src={pet.photo_url} alt={pet.name} style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "50%" }} />
              : getPetAvatar(pet.species)}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: "'Baloo 2', cursive", fontSize: 28, fontWeight: 800, lineHeight: 1.1 }}>{pet.name}</div>
            <div style={{ fontSize: 15, opacity: 0.85, marginTop: 4 }}>{pet.breed} · {calcAge(pet.birth_date)}{w ? ` · ${w.weight_kg} kg` : ""}</div>
            {pet.conditions?.length > 0 && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 10 }}>
                {pet.conditions.map(c => (
                  <span key={c} style={{ background: "rgba(255,255,255,0.25)", padding: "3px 10px", borderRadius: 20, fontSize: 12, fontWeight: 700 }}>{c}</span>
                ))}
              </div>
            )}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, flexShrink: 0 }}>
            <button onClick={onBack}
              style={{ background: "rgba(255,255,255,0.15)", border: "1.5px solid rgba(255,255,255,0.35)", borderRadius: 12, padding: "8px 16px", color: "#fff", fontFamily: "'Baloo 2', cursive", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
              ← Volver a todas
            </button>
            <button onClick={() => router.push(`/dashboard?pet=${pet.id}`)}
              style={{ background: "rgba(255,255,255,0.2)", border: "1.5px solid rgba(255,255,255,0.4)", borderRadius: 12, padding: "10px 18px", color: "#fff", fontFamily: "'Baloo 2', cursive", fontSize: 14, fontWeight: 700, cursor: "pointer" }}>
              Editar ficha completa →
            </button>
          </div>
        </div>

        {/* Métricas */}
        <div className="ov-metric-grid">
          <div className="ov-metric">
            <div className="ov-metric-val" style={{ color }}>{doseStats.dosesToday}</div>
            <div className="ov-metric-label">💊 Dosis tomadas hoy</div>
          </div>
          <div className="ov-metric">
            <div className="ov-metric-val" style={{ color: doseStats.adherence == null ? color : doseStats.adherence >= 80 ? "#059669" : doseStats.adherence >= 50 ? "#D97706" : "#DC2626" }}>
              {doseStats.adherence != null ? `${doseStats.adherence}%` : "—"}
            </div>
            <div className="ov-metric-label">📈 Adherencia semanal</div>
          </div>
          <div className="ov-metric">
            <div className="ov-metric-val" style={{ color: criticalStock > 0 ? "#DC2626" : "#059669" }}>{criticalStock}</div>
            <div className="ov-metric-label">⚠️ Stock crítico</div>
          </div>
          <div className="ov-metric">
            <div className="ov-metric-val" style={{ color: nv && nv.days <= 14 ? "#D97706" : color }}>{nv ? `${nv.days}d` : "—"}</div>
            <div className="ov-metric-label">💉 Próxima vacuna</div>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
          {/* Medicamentos */}
          <div className="ov-panel" style={{ margin: 0 }}>
            <div className="ov-section-title">💊 Medicamentos activos</div>
            {meds.length === 0
              ? <div style={{ color: "#64748B", fontSize: 14 }}>Sin medicamentos activos</div>
              : meds.map(m => (
                <div key={m.id} style={{ display: "flex", alignItems: "flex-start", gap: 12, padding: "12px 0", borderBottom: "1px solid #F1F5F9" }}>
                  <div style={{ width: 6, height: 6, borderRadius: "50%", background: m.color || color, marginTop: 7, flexShrink: 0 }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: 14, color: "#1e293b" }}>{m.name}</div>
                    <div style={{ fontSize: 13, color: "#64748B" }}>{m.dose} · {m.frequency}</div>
                  </div>
                  {m.stock != null && (
                    <span className="ov-badge" style={{ background: m.stock < 10 ? "#FEE2E2" : "#DBEAFE", color: m.stock < 10 ? "#DC2626" : "#1D4ED8", flexShrink: 0 }}>
                      {m.stock} {m.unit}
                    </span>
                  )}
                </div>
              ))}
          </div>

          {/* Tutores */}
          <div className="ov-panel" style={{ margin: 0 }}>
            <div className="ov-section-title">👤 Tutores</div>
            {petTutors.length === 0
              ? <div style={{ color: "#64748B", fontSize: 14 }}>Sin tutores registrados</div>
              : petTutors.map(t => (
                <div key={t.id} style={{ padding: "12px 0", borderBottom: "1px solid #F1F5F9" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div style={{ fontWeight: 700, fontSize: 14, color: "#1e293b" }}>{t.name}</div>
                    <span className="ov-badge" style={{ background: "#F1F5F9", color: "#475569", fontSize: 11 }}>{TUTOR_LABELS[t.type] || t.type}</span>
                  </div>
                  {t.relationship && <div style={{ fontSize: 13, color: "#64748B" }}>{t.relationship}</div>}
                  {t.phone && <div style={{ fontSize: 13, color: "#64748B" }}>📞 {t.phone}</div>}
                </div>
              ))}
          </div>
        </div>

        {/* Historial reciente */}
        {petHistory.length > 0 && (
          <div className="ov-panel" style={{ marginTop: 20 }}>
            <div className="ov-section-title">📅 Historial reciente</div>
            {petHistory.map(h => (
              <div key={h.id} className="ov-event-row">
                <div style={{ width: 44, height: 44, borderRadius: 12, background: color + "15", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, flexShrink: 0 }}>
                  {TYPE_ICONS[h.type] || "📝"}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: 14, color: "#1e293b" }}>{h.event || h.title}</div>
                  <div style={{ fontSize: 13, color: "#64748B" }}>{formatDate(h.event_date)}{h.vet_clinic ? ` · ${h.vet_clinic}` : ""}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
  );
}


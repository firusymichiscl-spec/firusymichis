"use client";
import { useRouter } from "next/navigation";

const PET_ACCENT_COLORS = ["#FF6B35","#2EC4B6","#534AB7","#2D6A4F","#D4537E","#BA7517"];

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

export default function OverviewClient({ pets, user, userPlan, medications, vaccines, treatments, latestWeights }) {
  const router = useRouter();

  // Mobile guard
  const isMobileUI = typeof window !== "undefined" && window.innerWidth < 1024;

  // --- Stats globales ---
  const today = new Date().toISOString().slice(0, 10);
  const activeMedsToday = medications.filter(m => m.active !== false).length;
  const vaccinesExpiringSoon = vaccines.filter(v => {
    const d = daysUntil(v.next_date);
    return d !== null && d >= 0 && d <= 60;
  }).length;
  const activeTreatments = treatments.length;

  // --- Alertas ---
  const alerts = [];
  medications.forEach(m => {
    if (m.stock != null && m.stock < 10) {
      const pet = pets.find(p => p.id === m.pet_id);
      alerts.push({ type: "stock", text: `Stock bajo: ${m.name} de ${pet?.name || "mascota"} (${m.stock} ${m.unit || "unid."} restantes)`, color: "#d97706" });
    }
  });
  vaccines.forEach(v => {
    const d = daysUntil(v.next_date);
    if (d !== null && d < 0) {
      const pet = pets.find(p => p.id === v.pet_id);
      alerts.push({ type: "vaccine", text: `Vacuna vencida: ${v.name} de ${pet?.name || "mascota"} (hace ${Math.abs(d)} días)`, color: "#dc2626" });
    } else if (d !== null && d <= 14) {
      const pet = pets.find(p => p.id === v.pet_id);
      alerts.push({ type: "vaccine", text: `Vacuna por vencer: ${v.name} de ${pet?.name || "mascota"} (en ${d} días)`, color: "#d97706" });
    }
  });

  const css = `
    @import url('https://fonts.googleapis.com/css2?family=Baloo+2:wght@400;600;700;800&family=Nunito:ital,wght@0,400;0,600;0,700;1,400&display=swap');
    *{box-sizing:border-box;margin:0;padding:0;}
    body{font-family:'Nunito',sans-serif;background:#F5F7FA;color:#3D1F0A;}
    .ov-layout{display:grid;grid-template-columns:220px 1fr;min-height:100vh;}
    .ov-sidebar{background:#fff;border-right:1px solid #FFD9C8;padding:24px 16px;display:flex;flex-direction:column;gap:8px;}
    .ov-main{padding:28px;overflow-y:auto;}
    .ov-topbar{background:linear-gradient(135deg,#FF6B35,#e85d2e);border-radius:16px;padding:18px 24px;display:flex;align-items:center;gap:16px;margin-bottom:28px;color:#fff;}
    .ov-stat-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:16px;margin-bottom:28px;}
    .ov-stat{background:#fff;border-radius:16px;padding:20px;box-shadow:0 2px 12px rgba(61,31,10,0.07);}
    .ov-stat-num{font-family:'Baloo 2',cursive;font-size:32px;font-weight:800;line-height:1;}
    .ov-stat-label{font-size:12px;color:#8A5530;margin-top:4px;}
    .ov-pet-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:16px;margin-bottom:28px;}
    .ov-pet-card{background:#fff;border-radius:18px;padding:20px;box-shadow:0 2px 12px rgba(61,31,10,0.07);border-top:4px solid;}
    .ov-section-title{font-family:'Baloo 2',cursive;font-size:14px;font-weight:700;color:#3D1F0A;text-transform:uppercase;letter-spacing:1px;margin-bottom:14px;}
    .ov-alerts{background:#fff;border-radius:16px;padding:20px;box-shadow:0 2px 12px rgba(61,31,10,0.07);margin-bottom:28px;}
    .ov-alert-item{padding:10px 14px;border-radius:10px;margin-bottom:8px;font-size:13px;}
    .ov-weights{background:#fff;border-radius:16px;padding:20px;box-shadow:0 2px 12px rgba(61,31,10,0.07);}
    .ov-weight-row{display:flex;align-items:center;gap:12px;padding:10px 0;border-bottom:1px solid #F5E6DA;}
    .ov-weight-row:last-child{border-bottom:none;}
    .ov-sidebar-btn{padding:10px 12px;border-radius:12px;border:none;background:transparent;text-align:left;cursor:pointer;font-family:'Nunito',sans-serif;font-size:13px;font-weight:700;color:#8A5530;width:100%;transition:background 0.15s;}
    .ov-sidebar-btn:hover{background:#FFF0EB;}
    .ov-sidebar-btn.active{background:#FFF0EB;color:#FF6B35;}
    @media(max-width:1023px){
      .ov-layout{display:block;}
      .ov-sidebar,.ov-stat-grid,.ov-pet-grid,.ov-alerts,.ov-weights,.ov-topbar{display:none;}
      .mobile-msg{display:flex;}
    }
    @media(min-width:1024px){.mobile-msg{display:none;}}
  `;

  return (
    <>
      <style>{css}</style>

      {/* Mobile fallback */}
      <div className="mobile-msg" style={{ minHeight: "100vh", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 32, textAlign: "center", gap: 16 }}>
        <div style={{ fontSize: 48 }}>🖥️</div>
        <div style={{ fontFamily: "'Baloo 2', cursive", fontSize: 20, fontWeight: 800, color: "#3D1F0A" }}>Vista disponible solo en pantalla grande</div>
        <div style={{ fontSize: 14, color: "#8A5530", maxWidth: 280 }}>La vista general multi-mascota requiere una pantalla de al menos 1024px.</div>
        <button onClick={() => router.push("/dashboard")}
          style={{ padding: "10px 24px", borderRadius: 12, background: "#FF6B35", color: "#fff", border: "none", fontFamily: "'Baloo 2', cursive", fontSize: 14, fontWeight: 700, cursor: "pointer" }}>
          ← Volver al dashboard
        </button>
      </div>

      <div className="ov-layout">
        {/* Sidebar */}
        <div className="ov-sidebar">
          <div style={{ fontFamily: "'Baloo 2', cursive", fontSize: 18, fontWeight: 800, color: "#FF6B35", marginBottom: 12 }}>🐾 Firus&Michis</div>
          <button className="ov-sidebar-btn active">📊 Vista general</button>
          <div style={{ borderTop: "1px solid #FFD9C8", margin: "8px 0" }} />
          {pets.map((p, i) => (
            <button key={p.id} className="ov-sidebar-btn" onClick={() => router.push(`/dashboard?pet=${p.id}`)}>
              <span style={{ marginRight: 8 }}>{getPetAvatar(p.species)}</span>
              {p.name}
            </button>
          ))}
          <div style={{ borderTop: "1px solid #FFD9C8", margin: "8px 0" }} />
          <button className="ov-sidebar-btn" onClick={() => router.push("/nueva-mascota")}>+ Nueva mascota</button>
          <div style={{ flex: 1 }} />
          <button className="ov-sidebar-btn" onClick={() => router.push("/dashboard")} style={{ color: "#FF6B35" }}>← Dashboard</button>
        </div>

        {/* Main */}
        <div className="ov-main">
          {/* Topbar */}
          <div className="ov-topbar">
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: "'Baloo 2', cursive", fontSize: 22, fontWeight: 800 }}>Vista general</div>
              <div style={{ fontSize: 12, opacity: 0.8 }}>{user.email} · {pets.length} mascota{pets.length > 1 ? "s" : ""}</div>
            </div>
            <span style={{ background: "rgba(255,255,255,0.2)", color: "#fff", fontSize: 10, fontWeight: 800, padding: "3px 10px", borderRadius: 10, textTransform: "uppercase" }}>
              {userPlan}
            </span>
          </div>

          {/* Stat cards */}
          <div className="ov-stat-grid">
            <div className="ov-stat">
              <div className="ov-stat-num" style={{ color: "#FF6B35" }}>{activeMedsToday}</div>
              <div className="ov-stat-label">💊 Medicamentos activos</div>
            </div>
            <div className="ov-stat">
              <div className="ov-stat-num" style={{ color: "#d97706" }}>{vaccinesExpiringSoon}</div>
              <div className="ov-stat-label">💉 Vacunas por vencer (60 días)</div>
            </div>
            <div className="ov-stat">
              <div className="ov-stat-num" style={{ color: "#2EC4B6" }}>{activeTreatments}</div>
              <div className="ov-stat-label">📋 Tratamientos activos</div>
            </div>
          </div>

          {/* Pet cards */}
          <div className="ov-section-title">Mis mascotas</div>
          <div className="ov-pet-grid">
            {pets.map((p, i) => {
              const color = PET_ACCENT_COLORS[i % PET_ACCENT_COLORS.length];
              const petMeds = medications.filter(m => m.pet_id === p.id && m.active !== false);
              const petTreatments = treatments.filter(t => t.pet_id === p.id);
              const petVaccines = vaccines.filter(v => v.pet_id === p.id);
              const nextVaccine = petVaccines
                .map(v => ({ ...v, days: daysUntil(v.next_date) }))
                .filter(v => v.days !== null && v.days >= 0)
                .sort((a, b) => a.days - b.days)[0];

              return (
                <div key={p.id} className="ov-pet-card" style={{ borderTopColor: color }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
                    <div style={{ width: 48, height: 48, borderRadius: "50%", background: color + "22", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24, flexShrink: 0 }}>
                      {p.photo_url
                        ? <img src={p.photo_url} alt={p.name} style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "50%" }} />
                        : getPetAvatar(p.species)}
                    </div>
                    <div>
                      <div style={{ fontFamily: "'Baloo 2', cursive", fontSize: 16, fontWeight: 800, color: "#3D1F0A" }}>{p.name}</div>
                      <div style={{ fontSize: 11, color: "#8A5530" }}>{p.breed} · {calcAge(p.birth_date)}</div>
                    </div>
                  </div>

                  <div style={{ display: "flex", gap: 10, marginBottom: 12 }}>
                    <div style={{ flex: 1, background: "#F5F7FA", borderRadius: 10, padding: "8px 10px", textAlign: "center" }}>
                      <div style={{ fontFamily: "'Baloo 2', cursive", fontSize: 18, fontWeight: 800, color }}>{petMeds.length}</div>
                      <div style={{ fontSize: 10, color: "#8A5530" }}>meds activos</div>
                    </div>
                    <div style={{ flex: 1, background: "#F5F7FA", borderRadius: 10, padding: "8px 10px", textAlign: "center" }}>
                      <div style={{ fontFamily: "'Baloo 2', cursive", fontSize: 18, fontWeight: 800, color }}>{petTreatments.length}</div>
                      <div style={{ fontSize: 10, color: "#8A5530" }}>tratamientos</div>
                    </div>
                  </div>

                  {p.conditions?.length > 0 && (
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 10 }}>
                      {p.conditions.map(c => (
                        <span key={c} style={{ background: color + "18", color, padding: "2px 8px", borderRadius: 20, fontSize: 10, fontWeight: 700 }}>{c}</span>
                      ))}
                    </div>
                  )}

                  {nextVaccine && (
                    <div style={{ fontSize: 11, color: nextVaccine.days <= 14 ? "#d97706" : "#059669", marginBottom: 10 }}>
                      💉 {nextVaccine.name}: en {nextVaccine.days} días
                    </div>
                  )}

                  <button onClick={() => router.push(`/dashboard?pet=${p.id}`)}
                    style={{ width: "100%", padding: "8px", borderRadius: 10, background: color, color: "#fff", border: "none", fontFamily: "'Baloo 2', cursive", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
                    Ver ficha →
                  </button>
                </div>
              );
            })}
          </div>

          {/* Alertas */}
          <div className="ov-section-title">Alertas</div>
          <div className="ov-alerts">
            {alerts.length === 0 ? (
              <div style={{ textAlign: "center", color: "#8A5530", fontSize: 13, padding: "12px 0" }}>✓ Sin alertas activas</div>
            ) : alerts.map((a, i) => (
              <div key={i} className="ov-alert-item" style={{ background: a.color + "15", color: a.color, border: `1px solid ${a.color}33` }}>
                {a.text}
              </div>
            ))}
          </div>

          {/* Pesos */}
          <div className="ov-section-title">Último peso registrado</div>
          <div className="ov-weights">
            {pets.map((p, i) => {
              const color = PET_ACCENT_COLORS[i % PET_ACCENT_COLORS.length];
              const w = latestWeights[p.id];
              const maxWeight = Math.max(...pets.map(pt => latestWeights[pt.id]?.weight_kg || 0), 1);
              const pct = w ? Math.round((w.weight_kg / maxWeight) * 100) : 0;
              return (
                <div key={p.id} className="ov-weight-row">
                  <div style={{ width: 32, textAlign: "center", fontSize: 18 }}>{getPetAvatar(p.species)}</div>
                  <div style={{ width: 80, fontFamily: "'Baloo 2', cursive", fontWeight: 700, fontSize: 13, color: "#3D1F0A" }}>{p.name}</div>
                  <div style={{ flex: 1, height: 10, background: "#F5E6DA", borderRadius: 5, overflow: "hidden" }}>
                    <div style={{ width: `${pct}%`, height: "100%", background: color, borderRadius: 5, transition: "width 0.5s" }} />
                  </div>
                  <div style={{ width: 60, textAlign: "right", fontSize: 12, fontWeight: 700, color: "#3D1F0A" }}>
                    {w ? `${w.weight_kg} kg` : "—"}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </>
  );
}

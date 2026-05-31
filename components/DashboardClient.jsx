"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";

const TYPE_STYLES = {
  surgery:   { bg: "#fef2f2", text: "#dc2626", dot: "#ef4444", icon: "🔪", label: "Cirugía" },
  illness:   { bg: "#fffbeb", text: "#d97706", dot: "#f59e0b", icon: "🤒", label: "Enfermedad" },
  exam:      { bg: "#eff6ff", text: "#2563eb", dot: "#3b82f6", icon: "🧪", label: "Examen" },
  procedure: { bg: "#f5f3ff", text: "#7c3aed", dot: "#8b5cf6", icon: "⚕️", label: "Procedimiento" },
  other:     { bg: "#f0fdf4", text: "#16a34a", dot: "#22c55e", icon: "📝", label: "Otro" },
};

const DAYS = ["L","M","X","J","V","S","D"];

export default function DashboardClient({ pet, medications, history, vaccines, user }) {
  const router = useRouter();
  const supabase = createClient();
  const [tab, setTab] = useState("ficha");

  const speciesIcon = pet.species === "cat" ? "🐱" : pet.species === "other" ? "🐰" : "🐶";

  const calcAge = (birthDate) => {
    if (!birthDate) return "Sin datos";
    const birth = new Date(birthDate);
    const now = new Date();
    const years = now.getFullYear() - birth.getFullYear();
    const months = now.getMonth() - birth.getMonth();
    const totalMonths = years * 12 + months;
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

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };

  const css = `
    @import url('https://fonts.googleapis.com/css2?family=Baloo+2:wght@400;600;700;800&family=Nunito:ital,wght@0,400;0,600;0,700;1,400&display=swap');
    :root {
      --orange: #FF6B35; --mint: #2EC4B6; --cream: #FFF8F3;
      --brown: #3D1F0A; --brown-light: #C4845A; --brown-pale: #F5E6DA;
      --yellow: #FFD166; --red: #FF4757; --green: #06D6A0;
      --card-shadow: 0 4px 24px rgba(61,31,10,0.08);
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Nunito', sans-serif; background: var(--cream); color: var(--brown); }
    .app { max-width: 420px; margin: 0 auto; min-height: 100vh; }
    .header { background: linear-gradient(160deg, #FF6B35 0%, #FF4500 60%, #E63900 100%); padding: 20px 20px 0; position: relative; overflow: hidden; }
    .brand { display: flex; align-items: center; justify-content: space-between; margin-bottom: 20px; }
    .brand-left { display: flex; align-items: center; gap: 10px; }
    .brand-logo { width: 38px; height: 38px; background: rgba(255,255,255,0.2); border-radius: 10px; display: flex; align-items: center; justify-content: center; font-size: 20px; }
    .brand-name { font-family: 'Baloo 2', cursive; font-size: 20px; font-weight: 800; color: #fff; }
    .brand-name span { color: var(--yellow); }
    .signout-btn { background: rgba(255,255,255,0.15); border: 1px solid rgba(255,255,255,0.3); border-radius: 10px; padding: 6px 12px; color: #fff; font-family: 'Nunito', sans-serif; font-size: 11px; font-weight: 700; cursor: pointer; }
    .pet-card { display: flex; align-items: center; gap: 14px; margin-bottom: 20px; }
    .pet-avatar { width: 68px; height: 68px; border-radius: 50%; background: linear-gradient(135deg, #FFD166, #FF8C5A); display: flex; align-items: center; justify-content: center; font-size: 34px; box-shadow: 0 6px 20px rgba(0,0,0,0.2), 0 0 0 3px rgba(255,255,255,0.3); flex-shrink: 0; }
    .pet-name { font-family: 'Baloo 2', cursive; font-size: 26px; font-weight: 800; color: #fff; line-height: 1; margin-bottom: 3px; }
    .pet-breed { font-size: 12px; color: rgba(255,255,255,0.8); font-style: italic; }
    .today-badge { background: rgba(255,255,255,0.15); border: 1px solid rgba(255,255,255,0.25); border-radius: 14px; padding: 8px 14px; text-align: center; flex-shrink: 0; }
    .today-num { font-family: 'Baloo 2', cursive; font-size: 22px; font-weight: 800; color: #fff; line-height: 1; }
    .today-label { font-size: 9px; color: rgba(255,255,255,0.7); text-transform: uppercase; letter-spacing: 0.5px; }
    .conditions-row { display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 20px; }
    .condition-pill { background: rgba(255,255,255,0.18); color: #fff; padding: 3px 10px; border-radius: 20px; font-size: 10px; font-weight: 600; border: 1px solid rgba(255,255,255,0.25); }
    .tabs { display: flex; }
    .tab { flex: 1; padding: 10px 6px; background: transparent; border: none; color: rgba(255,255,255,0.65); font-family: 'Nunito', sans-serif; font-size: 11px; font-weight: 700; cursor: pointer; text-align: center; border-radius: 10px 10px 0 0; }
    .tab.active { background: var(--cream); color: var(--orange); }
    .tab-icon { display: block; font-size: 18px; margin-bottom: 2px; }
    .content { padding: 20px 16px; }
    .card { background: #fff; border-radius: 18px; padding: 18px; margin-bottom: 16px; box-shadow: var(--card-shadow); }
    .card-title { font-family: 'Baloo 2', cursive; font-size: 13px; font-weight: 700; color: var(--orange); text-transform: uppercase; letter-spacing: 1px; margin-bottom: 14px; }
    .row { display: flex; justify-content: space-between; align-items: flex-start; padding: 8px 0; border-bottom: 1px solid var(--brown-pale); font-size: 13px; }
    .row:last-child { border-bottom: none; }
    .row-label { color: var(--brown-light); font-size: 12px; }
    .row-value { font-weight: 700; text-align: right; max-width: 60%; font-size: 13px; }
    .vaccine-row { display: flex; justify-content: space-between; align-items: center; padding: 10px 0; border-bottom: 1px solid var(--brown-pale); }
    .vaccine-row:last-child { border-bottom: none; }
    .vaccine-name { font-weight: 700; font-size: 14px; }
    .vaccine-date { font-size: 11px; color: var(--brown-light); margin-top: 2px; }
    .badge { padding: 4px 12px; border-radius: 20px; font-size: 11px; font-weight: 800; }
    .badge-ok { background: #e8faf4; color: #059669; }
    .badge-warn { background: #fff7ed; color: #d97706; }
    .badge-danger { background: #fef2f2; color: #dc2626; }
    .empty-state { text-align: center; padding: 32px 16px; color: var(--brown-light); font-size: 13px; }
    .empty-icon { font-size: 40px; margin-bottom: 8px; }
    .add-btn { width: 100%; padding: 13px; border-radius: 13px; background: var(--orange); color: #fff; border: none; font-family: 'Baloo 2', cursive; font-size: 15px; font-weight: 700; cursor: pointer; margin-top: 8px; }
    .timeline { position: relative; padding-left: 36px; }
    .timeline::before { content: ''; position: absolute; left: 14px; top: 0; bottom: 0; width: 2px; background: linear-gradient(to bottom, var(--orange), var(--mint)); border-radius: 2px; }
    .timeline-item { position: relative; margin-bottom: 18px; }
    .timeline-dot { position: absolute; left: -28px; top: 6px; width: 28px; height: 28px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 13px; box-shadow: 0 0 0 3px var(--cream); }
    .timeline-content { border-radius: 14px; padding: 10px 14px; }
    .timeline-type { font-size: 10px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 3px; }
    .timeline-event { font-size: 13px; font-weight: 600; }
    .fade-up { animation: fadeUp 0.35s ease both; }
    @keyframes fadeUp { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
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
            <button className="signout-btn" onClick={handleSignOut}>Cerrar sesión</button>
          </div>

          <div className="pet-card">
            <div className="pet-avatar">{speciesIcon}</div>
            <div style={{ flex: 1 }}>
              <div className="pet-name">{pet.name}</div>
              <div className="pet-breed">{pet.breed} · {calcAge(pet.birth_date)}</div>
            </div>
            <div className="today-badge">
              <div className="today-num">{medications.length}</div>
              <div className="today-label">meds activos</div>
            </div>
          </div>

          {pet.conditions?.length > 0 && (
            <div className="conditions-row">
              {pet.conditions.map(c => (
                <span key={c} className="condition-pill">{c}</span>
              ))}
            </div>
          )}

          <div className="tabs">
            {[
              { id: "ficha", icon: "📋", label: "Ficha" },
              { id: "medicamentos", icon: "💊", label: "Meds" },
              { id: "historial", icon: "📅", label: "Historial" },
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
                <div className="card-title">🐶 Datos básicos</div>
                {[
                  ["Nombre", pet.name],
                  ["Especie", pet.species === "dog" ? "Perro" : pet.species === "cat" ? "Gato" : "Otro"],
                  ["Raza", pet.breed || "Sin datos"],
                  ["Edad", calcAge(pet.birth_date)],
                  ["Peso", pet.weight_kg ? `${pet.weight_kg} kg` : "Sin datos"],
                ].map(([l, v]) => (
                  <div className="row" key={l}>
                    <span className="row-label">{l}</span>
                    <span className="row-value">{v}</span>
                  </div>
                ))}
              </div>

              {pet.diet && (
                <div className="card">
                  <div className="card-title">🍽️ Alimentación</div>
                  <div className="row">
                    <span className="row-label">Dieta</span>
                    <span className="row-value">{pet.diet}</span>
                  </div>
                </div>
              )}

              <div className="card">
                <div className="card-title">💉 Vacunas</div>
                {vaccines.length === 0 ? (
                  <div className="empty-state">
                    <div className="empty-icon">💉</div>
                    <p>Sin vacunas registradas</p>
                  </div>
                ) : vaccines.map(v => {
                  const { cls, label } = vaccineStatus(v.next_date);
                  return (
                    <div className="vaccine-row" key={v.id}>
                      <div>
                        <div className="vaccine-name">{v.name}</div>
                        <div className="vaccine-date">Próx: {v.next_date || "Sin fecha"}</div>
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
              {medications.length === 0 ? (
                <div className="card">
                  <div className="empty-state">
                    <div className="empty-icon">💊</div>
                    <p>Sin medicamentos registrados</p>
                  </div>
                  <button className="add-btn">+ Agregar medicamento</button>
                </div>
              ) : medications.map(med => (
                <div key={med.id} style={{ background: "#fff", borderRadius: 18, padding: 18, marginBottom: 14, boxShadow: "var(--card-shadow)", position: "relative", overflow: "hidden" }}>
                  <div style={{ position: "absolute", top: 0, left: 0, bottom: 0, width: 5, borderRadius: "18px 0 0 18px", background: med.color || "#FF6B35" }} />
                  <div style={{ paddingLeft: 10 }}>
                    <div style={{ fontFamily: "'Baloo 2', cursive", fontSize: 17, fontWeight: 700 }}>{med.name}</div>
                    <div style={{ fontSize: 12, color: "var(--brown-light)", marginTop: 2 }}>{med.dose} · {med.frequency}</div>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "var(--brown-light)", marginTop: 10, paddingTop: 8, borderTop: "1px solid var(--brown-pale)" }}>
                      <span>📦 Stock: <strong style={{ color: "var(--brown)" }}>{med.stock} {med.unit}</strong></span>
                      {med.expires_at && <span>Vence: <strong style={{ color: "var(--brown)" }}>{med.expires_at}</strong></span>}
                    </div>
                  </div>
                </div>
              ))}
              {medications.length > 0 && (
                <button className="add-btn">+ Agregar medicamento</button>
              )}
            </div>
          )}

          {/* HISTORIAL */}
          {tab === "historial" && (
            <div className="fade-up">
              {history.length === 0 ? (
                <div className="card">
                  <div className="empty-state">
                    <div className="empty-icon">📅</div>
                    <p>Sin historial médico registrado</p>
                  </div>
                  <button className="add-btn">+ Agregar evento</button>
                </div>
              ) : (
                <div className="timeline">
                  {history.map((item, i) => {
                    const s = TYPE_STYLES[item.type] || TYPE_STYLES.other;
                    return (
                      <div className="timeline-item" key={item.id}>
                        <div className="timeline-dot" style={{ background: s.dot }}>{s.icon}</div>
                        <div className="timeline-content" style={{ background: s.bg, border: `1px solid ${s.dot}22` }}>
                          <div className="timeline-type" style={{ color: s.text }}>{s.label} · {item.event_date}</div>
                          <div className="timeline-event">{item.event}</div>
                          {item.notes && <div style={{ fontSize: 11, color: "var(--brown-light)", marginTop: 4 }}>{item.notes}</div>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
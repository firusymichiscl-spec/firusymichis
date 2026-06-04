"use client";
import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase";

const ADVANCE_OPTIONS = [
  { label: "15 minutos antes", value: 15 },
  { label: "30 minutos antes", value: 30 },
  { label: "45 minutos antes", value: 45 },
  { label: "1 hora antes", value: 60 },
];

export default function NotificationSettings({ pet, user, onClose }) {
  const supabase = createClient();
  const [prefs, setPrefs] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [testSending, setTestSending] = useState(false);
  const [testSent, setTestSent] = useState(false);

  useEffect(() => { loadPrefs(); }, []);

  const loadPrefs = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("notification_preferences")
      .select("*")
      .eq("user_id", user.id)
      .eq("pet_id", pet.id)
      .single();

    if (data) {
      setPrefs(data);
    } else {
      setPrefs({
        email: user.email,
        enabled: true,
        notify_medication_habitual: true,
        notify_medication_treatment: true,
        notify_vaccine: true,
        notify_vet_control: true,
        notify_low_stock: true,
        advance_minutes: 30,
      });
    }
    setLoading(false);
  };

  const save = async () => {
    setSaving(true);
    await supabase.from("notification_preferences").upsert({
      user_id: user.id,
      pet_id: pet.id,
      ...prefs,
      updated_at: new Date().toISOString(),
    }, { onConflict: "user_id,pet_id" });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const sendTest = async () => {
    setTestSending(true);
    await fetch("/api/send-notification", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        to: prefs.email,
        type: "medication",
        petName: pet.name,
        medicationName: "Medicamento de prueba",
        scheduledTime: new Date().toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" }),
      }),
    });
    setTestSending(false);
    setTestSent(true);
    setTimeout(() => setTestSent(false), 3000);
  };

  const inputS = { width: "100%", padding: "9px 12px", borderRadius: 10, border: "1.5px solid #FFD9C8", background: "#fff", fontFamily: "'Nunito', sans-serif", fontSize: 14, color: "#3D1F0A", outline: "none", boxSizing: "border-box" };

  const Toggle = ({ value, onChange, label, sublabel }) => (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 0", borderBottom: "1px solid #FFF0EB" }}>
      <div>
        <div style={{ fontSize: 13, fontWeight: 700, color: "#3D1F0A" }}>{label}</div>
        {sublabel && <div style={{ fontSize: 11, color: "#C4845A", marginTop: 2 }}>{sublabel}</div>}
      </div>
      <div onClick={() => onChange(!value)}
        style={{ width: 44, height: 24, borderRadius: 12, background: value ? "#FF6B35" : "#E5E7EB", cursor: "pointer", position: "relative", transition: "background 0.2s", flexShrink: 0 }}>
        <div style={{ position: "absolute", top: 2, left: value ? 22 : 2, width: 20, height: 20, borderRadius: "50%", background: "#fff", transition: "left 0.2s", boxShadow: "0 1px 4px rgba(0,0,0,0.2)" }} />
      </div>
    </div>
  );

  if (loading) return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ color: "#fff", fontFamily: "'Baloo 2', cursive", fontSize: 16 }}>Cargando...</div>
    </div>
  );

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 1000, display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
      <div style={{ background: "#FFF8F3", borderRadius: "24px 24px 0 0", width: "100%", maxWidth: 480, maxHeight: "92vh", overflowY: "auto" }}>
        <link href="https://fonts.googleapis.com/css2?family=Baloo+2:wght@800&family=Nunito:wght@400;700&display=swap" rel="stylesheet" />
        <div style={{ background: "linear-gradient(135deg, #FF6B35, #e85d2e)", padding: "16px 20px", borderRadius: "24px 24px 0 0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ fontFamily: "'Baloo 2', cursive", fontSize: 17, fontWeight: 800, color: "#fff" }}>🔔 Notificaciones — {pet.name}</div>
          <button onClick={onClose} style={{ background: "rgba(255,255,255,0.2)", border: "1px solid rgba(255,255,255,0.3)", borderRadius: 10, color: "#fff", fontFamily: "'Baloo 2', cursive", fontSize: 13, fontWeight: 700, padding: "6px 12px", cursor: "pointer" }}>✕ Cerrar</button>
        </div>

        <div style={{ padding: 20 }}>

          {/* Activar todo */}
          <div style={{ background: prefs.enabled ? "#FFF0EB" : "#f5f5f5", borderRadius: 14, padding: 14, marginBottom: 16, border: `1.5px solid ${prefs.enabled ? "#FFD0BC" : "#E5E7EB"}` }}>
            <Toggle
              value={prefs.enabled}
              onChange={v => setPrefs(p => ({ ...p, enabled: v }))}
              label="Notificaciones activas"
              sublabel={prefs.enabled ? "Recibirás alertas por email" : "Sin notificaciones"}
            />
          </div>

          {prefs.enabled && (
            <>
              {/* Email */}
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#7A4522", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 5 }}>Email de notificaciones</div>
                <input style={inputS} type="email" value={prefs.email || ""} onChange={e => setPrefs(p => ({ ...p, email: e.target.value }))} />
              </div>

              {/* Anticipación */}
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#7A4522", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 8 }}>Recibir alerta con</div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {ADVANCE_OPTIONS.map(o => (
                    <div key={o.value} onClick={() => setPrefs(p => ({ ...p, advance_minutes: o.value }))}
                      style={{ padding: "6px 12px", borderRadius: 20, border: `1.5px solid ${prefs.advance_minutes === o.value ? "#FF6B35" : "#FFD9C8"}`, background: prefs.advance_minutes === o.value ? "#FFF0EB" : "#fff", fontSize: 11, fontWeight: 700, color: prefs.advance_minutes === o.value ? "#CC4A1A" : "#7A4522", cursor: "pointer" }}>
                      {o.label}
                    </div>
                  ))}
                </div>
              </div>

              {/* Tipos de notificación */}
              <div style={{ background: "#fff", borderRadius: 14, border: "1.5px solid #FFD9C8", padding: "0 14px", marginBottom: 14 }}>
                <Toggle value={prefs.notify_medication_habitual} onChange={v => setPrefs(p => ({ ...p, notify_medication_habitual: v }))} label="💊 Medicamentos habituales" sublabel="Alertas de toma para meds crónicos" />
                <Toggle value={prefs.notify_medication_treatment} onChange={v => setPrefs(p => ({ ...p, notify_medication_treatment: v }))} label="📋 Medicamentos de tratamiento" sublabel="Alertas según receta activa" />
                <Toggle value={prefs.notify_vaccine} onChange={v => setPrefs(p => ({ ...p, notify_vaccine: v }))} label="💉 Vacunas próximas" sublabel="30 días antes del vencimiento" />
                <Toggle value={prefs.notify_vet_control} onChange={v => setPrefs(p => ({ ...p, notify_vet_control: v }))} label="🏥 Controles veterinarios" sublabel="Recordatorio de próximas consultas" />
                <Toggle value={prefs.notify_low_stock} onChange={v => setPrefs(p => ({ ...p, notify_low_stock: v }))} label="📦 Stock bajo" sublabel="Cuando queden menos de 7 días de medicamento" />
              </div>

              {/* Test */}
              <button onClick={sendTest} disabled={testSending || !prefs.email}
                style={{ width: "100%", padding: 11, borderRadius: 12, background: testSent ? "#059669" : "#fff", color: testSent ? "#fff" : "#FF6B35", border: "1.5px solid #FFD0BC", fontFamily: "'Baloo 2', cursive", fontSize: 13, fontWeight: 700, cursor: "pointer", marginBottom: 10 }}>
                {testSent ? "✓ Email de prueba enviado" : testSending ? "Enviando..." : "📧 Enviar email de prueba"}
              </button>
            </>
          )}

          <button onClick={save} disabled={saving}
            style={{ width: "100%", padding: 13, borderRadius: 13, background: saved ? "#2EC4B6" : "#FF6B35", color: "#fff", border: "none", fontFamily: "'Baloo 2', cursive", fontSize: 15, fontWeight: 700, cursor: "pointer" }}>
            {saved ? "✓ Guardado" : saving ? "Guardando..." : "✓ Guardar preferencias"}
          </button>
        </div>
      </div>
    </div>
  );
}

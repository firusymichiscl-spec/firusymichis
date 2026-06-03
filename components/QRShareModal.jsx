"use client";
import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase";

const EXPIRY_OPTIONS = [
  { label: "Sin expiración", value: null },
  { label: "24 horas", value: 1 },
  { label: "7 días", value: 7 },
  { label: "30 días", value: 30 },
];

export default function QRShareModal({ pet, onClose }) {
  const supabase = createClient();
  const [share, setShare] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const [expiryDays, setExpiryDays] = useState(7);
  const [config, setConfig] = useState({
    show_basics: true,
    show_conditions: true,
    show_medications: true,
    show_vaccines: true,
    show_history: true,
    show_allergies: true,
  });

  useEffect(() => { loadShare(); }, []);

  const loadShare = async () => {
    setLoading(true);
    const { data } = await supabase.from("pet_shares").select("*").eq("pet_id", pet.id).eq("active", true).single();
    if (data) {
      setShare(data);
      setConfig({
        show_basics: data.show_basics,
        show_conditions: data.show_conditions,
        show_medications: data.show_medications,
        show_vaccines: data.show_vaccines,
        show_history: data.show_history,
        show_allergies: data.show_allergies,
      });
    }
    setLoading(false);
  };

  const generateShare = async () => {
    setSaving(true);
    if (share) {
      await supabase.from("pet_shares").delete().eq("id", share.id);
    }
    const expires_at = expiryDays ? new Date(Date.now() + expiryDays * 86400000).toISOString() : null;
    const { data } = await supabase.from("pet_shares").insert({
      pet_id: pet.id,
      expires_at,
      ...config,
    }).select().single();
    setShare(data);
    setSaving(false);
  };

  const revokeShare = async () => {
    if (!confirm("¿Revocar el acceso? El QR dejará de funcionar.")) return;
    await supabase.from("pet_shares").update({ active: false }).eq("id", share.id);
    setShare(null);
  };

  const shareUrl = share ? `https://firusymichis.cl/ficha/${share.token}` : null;

  const copyLink = () => {
    navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const daysLeft = share?.expires_at
    ? Math.ceil((new Date(share.expires_at) - new Date()) / 86400000)
    : null;

  const FIELDS = [
    { key: "show_basics", label: "Datos básicos", icon: "🐶" },
    { key: "show_conditions", label: "Condiciones de salud", icon: "🏥" },
    { key: "show_allergies", label: "Alergias", icon: "⚠️" },
    { key: "show_medications", label: "Medicamentos activos", icon: "💊" },
    { key: "show_vaccines", label: "Vacunas", icon: "💉" },
    { key: "show_history", label: "Historial médico", icon: "📅" },
  ];

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 1000, display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
      <div style={{ background: "#FFF8F3", borderRadius: "24px 24px 0 0", width: "100%", maxWidth: 480, maxHeight: "92vh", overflowY: "auto" }}>
        <link href="https://fonts.googleapis.com/css2?family=Baloo+2:wght@800&family=Nunito:wght@400;700&display=swap" rel="stylesheet" />
        <div style={{ background: "linear-gradient(135deg, #2EC4B6, #25a99e)", padding: "16px 20px", borderRadius: "24px 24px 0 0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ fontFamily: "'Baloo 2', cursive", fontSize: 17, fontWeight: 800, color: "#fff" }}>📱 Compartir ficha QR</div>
          <button onClick={onClose} style={{ background: "rgba(255,255,255,0.2)", border: "1px solid rgba(255,255,255,0.3)", borderRadius: 10, color: "#fff", fontFamily: "'Baloo 2', cursive", fontSize: 13, fontWeight: 700, padding: "6px 12px", cursor: "pointer" }}>✕ Cerrar</button>
        </div>

        <div style={{ padding: 20 }}>
          {loading ? (
            <div style={{ textAlign: "center", padding: 32, color: "#C4845A" }}>Cargando...</div>
          ) : (
            <>
              {share ? (
                <div>
                  {/* QR generado */}
                  <div style={{ background: "#E8FAF9", borderRadius: 16, padding: 16, marginBottom: 16, border: "1.5px solid #2EC4B6", textAlign: "center" }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: "#0F6E56", marginBottom: 8 }}>
                      ✓ Ficha activa {daysLeft !== null ? `· expira en ${daysLeft} día${daysLeft !== 1 ? "s" : ""}` : "· sin expiración"}
                    </div>
                    <img
                      src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(shareUrl)}`}
                      alt="QR Code"
                      style={{ width: 180, height: 180, borderRadius: 12, border: "4px solid #fff", boxShadow: "0 4px 16px rgba(0,0,0,0.1)" }}
                    />
                    <div style={{ marginTop: 10, fontSize: 11, color: "#0F6E56", wordBreak: "break-all" }}>{shareUrl}</div>
                  </div>

                  <button onClick={copyLink} style={{ width: "100%", padding: 12, borderRadius: 12, background: copied ? "#059669" : "#2EC4B6", color: "#fff", border: "none", fontFamily: "'Baloo 2', cursive", fontSize: 14, fontWeight: 700, cursor: "pointer", marginBottom: 8 }}>
                    {copied ? "✓ Enlace copiado" : "📋 Copiar enlace"}
                  </button>

                  <button onClick={revokeShare} style={{ width: "100%", padding: 11, borderRadius: 12, background: "#fef2f2", color: "#dc2626", border: "1.5px solid #fecaca", fontFamily: "'Baloo 2', cursive", fontSize: 13, fontWeight: 700, cursor: "pointer", marginBottom: 16 }}>
                    🗑️ Revocar acceso
                  </button>

                  <div style={{ borderTop: "1px solid #FFD9C8", paddingTop: 16 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: "#7A4522", marginBottom: 10 }}>Regenerar con nueva configuración:</div>
                  </div>
                </div>
              ) : (
                <div style={{ background: "#FFF0EB", borderRadius: 12, padding: 14, marginBottom: 16, border: "1.5px solid #FFD0BC" }}>
                  <div style={{ fontSize: 13, color: "#7A4522", lineHeight: 1.6 }}>
                    Genera un código QR para compartir la ficha de <strong>{pet.name}</strong> con veterinarios u otras personas.
                  </div>
                </div>
              )}

              {/* Configuración */}
              <div style={{ fontSize: 11, fontWeight: 700, color: "#7A4522", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 8 }}>Información a mostrar</div>
              <div style={{ background: "#fff", borderRadius: 14, border: "1.5px solid #FFD9C8", padding: "4px 14px", marginBottom: 14 }}>
                {FIELDS.map((f, i) => (
                  <label key={f.key} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 0", borderBottom: i < FIELDS.length - 1 ? "1px solid #FFF0EB" : "none", cursor: "pointer" }}>
                    <input type="checkbox" checked={config[f.key]}
                      onChange={e => setConfig(p => ({ ...p, [f.key]: e.target.checked }))}
                      style={{ width: 16, height: 16, accentColor: "#2EC4B6" }} />
                    <span style={{ fontSize: 13, color: "#3D1F0A" }}>{f.icon} {f.label}</span>
                  </label>
                ))}
              </div>

              {/* Expiración */}
              <div style={{ fontSize: 11, fontWeight: 700, color: "#7A4522", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 8 }}>Tiempo de acceso</div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 16 }}>
                {EXPIRY_OPTIONS.map(o => (
                  <div key={String(o.value)} onClick={() => setExpiryDays(o.value)}
                    style={{ padding: "6px 12px", borderRadius: 20, border: `1.5px solid ${expiryDays === o.value ? "#2EC4B6" : "#FFD9C8"}`, background: expiryDays === o.value ? "#E8FAF9" : "#fff", fontSize: 11, fontWeight: 700, color: expiryDays === o.value ? "#0F6E56" : "#7A4522", cursor: "pointer" }}>
                    {o.label}
                  </div>
                ))}
              </div>

              <button onClick={generateShare} disabled={saving}
                style={{ width: "100%", padding: 13, borderRadius: 13, background: "#2EC4B6", color: "#fff", border: "none", fontFamily: "'Baloo 2', cursive", fontSize: 15, fontWeight: 700, cursor: "pointer" }}>
                {saving ? "Generando..." : share ? "🔄 Regenerar QR" : "✓ Generar QR"}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

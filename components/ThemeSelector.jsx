"use client";
import { useState } from "react";
import { THEMES, CUSTOM_COLORS, getThemeVars } from "@/lib/themes";

const THEME_NAMES = {
  clasico: "Clásico", canino: "Canino", felino: "Felino", nocturno: "Nocturno",
  primavera: "Primavera", bosque: "Bosque", conejito: "Conejito", oceano: "Océano",
};

function applyVars(vars) {
  Object.entries(vars).forEach(([k, v]) => document.documentElement.style.setProperty(k, v));
}

export default function ThemeSelector({ initialTheme, initialCustomColor, onClose }) {
  const [selected, setSelected] = useState(initialTheme || "clasico");
  const [customColor, setCustomColor] = useState(initialCustomColor || CUSTOM_COLORS[0]);
  const [saving, setSaving] = useState(false);

  function pick(theme) {
    setSelected(theme);
    applyVars(getThemeVars(theme, customColor));
    if (theme === "nocturno") document.documentElement.classList.add("dark");
    else document.documentElement.classList.remove("dark");
  }

  function pickCustomColor(color) {
    setCustomColor(color);
    if (selected === "custom") applyVars(getThemeVars("custom", color));
  }

  async function save() {
    setSaving(true);
    await fetch("/api/profile/theme", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ theme: selected, customColor: selected === "custom" ? customColor : null }),
    });
    setSaving(false);
    onClose();
  }

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 2000, display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
      <div style={{ background: "#FFF8F3", borderRadius: "24px 24px 0 0", width: "100%", maxWidth: 500, padding: 24, maxHeight: "85vh", overflowY: "auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <div style={{ fontFamily: "'Baloo 2', cursive", fontSize: 18, fontWeight: 800, color: "#3D1F0A" }}>🎨 Tema de color</div>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: "#C4845A" }}>✕</button>
        </div>

        {/* Vista previa */}
        <div style={{
          background: `linear-gradient(135deg, var(--color-primary), var(--color-secondary))`,
          borderRadius: 14, padding: "14px 18px", marginBottom: 20,
          display: "flex", alignItems: "center", gap: 12,
        }}>
          <div style={{ width: 44, height: 44, borderRadius: "50%", background: "var(--color-accent)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22 }}>🐾</div>
          <div>
            <div style={{ fontFamily: "'Baloo 2', cursive", fontWeight: 800, color: "#fff", fontSize: 16 }}>Vista previa</div>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.8)" }}>{THEME_NAMES[selected] || "Personalizado"}</div>
          </div>
          <div style={{ marginLeft: "auto", background: "var(--color-accent)", color: "#3D1F0A", fontSize: 9, fontWeight: 800, padding: "2px 8px", borderRadius: 10 }}>PRO</div>
        </div>

        {/* Grid de temas */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 20 }}>
          {Object.entries(THEMES).map(([key, t]) => (
            <button key={key} onClick={() => pick(key)} style={{
              border: selected === key ? `2px solid ${t.primary}` : "2px solid #FFD9C8",
              borderRadius: 14, padding: "12px 14px", background: selected === key ? "#FFF0EB" : "#fff",
              cursor: "pointer", textAlign: "left", transition: "all 0.15s",
            }}>
              <div style={{ display: "flex", gap: 5, marginBottom: 8 }}>
                {[t.primary, t.secondary, t.accent].map((c, i) => (
                  <div key={i} style={{ width: 18, height: 18, borderRadius: "50%", background: c, border: "1.5px solid rgba(0,0,0,0.08)" }} />
                ))}
              </div>
              <div style={{ fontFamily: "'Baloo 2', cursive", fontSize: 13, fontWeight: 700, color: "#3D1F0A" }}>{THEME_NAMES[key]}</div>
              <div style={{ height: 8, borderRadius: 4, background: `linear-gradient(90deg,${t.primary},${t.secondary})`, marginTop: 6 }} />
            </button>
          ))}

          {/* Custom */}
          <button onClick={() => pick("custom")} style={{
            border: selected === "custom" ? "2px solid #805AD5" : "2px solid #FFD9C8",
            borderRadius: 14, padding: "12px 14px", background: selected === "custom" ? "#F5F0FF" : "#fff",
            cursor: "pointer", textAlign: "left",
          }}>
            <div style={{ display: "flex", gap: 5, marginBottom: 8 }}>
              <div style={{ width: 18, height: 18, borderRadius: "50%", background: customColor, border: "1.5px solid rgba(0,0,0,0.08)" }} />
            </div>
            <div style={{ fontFamily: "'Baloo 2', cursive", fontSize: 13, fontWeight: 700, color: "#3D1F0A" }}>Personalizado</div>
            <div style={{ height: 8, borderRadius: 4, background: customColor, marginTop: 6 }} />
          </button>
        </div>

        {/* Colores custom */}
        {selected === "custom" && (
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#7A4522", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 10 }}>Color personalizado</div>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              {CUSTOM_COLORS.map(c => (
                <button key={c} onClick={() => pickCustomColor(c)} style={{
                  width: 32, height: 32, borderRadius: "50%", background: c, border: customColor === c ? "3px solid #3D1F0A" : "2px solid rgba(0,0,0,0.1)",
                  cursor: "pointer", transition: "border 0.15s",
                }} />
              ))}
            </div>
          </div>
        )}

        <button onClick={save} disabled={saving} style={{
          width: "100%", padding: 13, borderRadius: 13,
          background: saving ? "#C4845A" : "var(--color-primary)",
          color: "#fff", border: "none", fontFamily: "'Baloo 2', cursive", fontSize: 15, fontWeight: 700, cursor: "pointer",
        }}>
          {saving ? "Guardando..." : "Guardar tema"}
        </button>
      </div>
    </div>
  );
}

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const PLANS = [
  { id: "pro", label: "PRO", price: "$3.990", features: ["Hasta 3 mascotas", "Asistente IA incluido", "Exportar ficha en PDF"] },
  { id: "premium", label: "PREMIUM", price: "$7.990", features: ["Hasta 5 mascotas", "Todo lo de PRO", "Perfil familiar compartido"] },
];

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export default function PagoClient({ currentPlan, preselectedPlan }) {
  const router = useRouter();
  const [selectedPlan, setSelectedPlan] = useState(preselectedPlan || "pro");
  const [processing, setProcessing] = useState(false);

  // Formulario simulado — integrar Mercado Pago aquí
  const [cardName, setCardName] = useState("");
  const [cardNumber, setCardNumber] = useState("");
  const [cardExpiry, setCardExpiry] = useState("");
  const [cardCvv, setCardCvv] = useState("");

  const activarPlan = async () => {
    setProcessing(true);
    await sleep(1500);

    const res = await fetch("/api/pago/simular", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ plan: selectedPlan }),
    });

    setProcessing(false);
    if (!res.ok) {
      alert("No se pudo activar el plan. Intenta de nuevo.");
      return;
    }

    router.push("/dashboard?activated=true");
  };

  const css = {
    page: { minHeight: "100vh", background: "#FFF8F3", fontFamily: "'Nunito', sans-serif" },
    header: { display: "flex", alignItems: "center", gap: 14, padding: "16px 20px", background: "#fff", borderBottom: "1px solid #FFE4D6" },
    logo: { fontFamily: "'Baloo 2', cursive", fontSize: 18, fontWeight: 800, color: "#3D1F0A" },
    back: { background: "none", border: "none", color: "#FF6B35", fontFamily: "'Baloo 2', cursive", fontSize: 13, fontWeight: 700, cursor: "pointer" },
    body: { maxWidth: 460, margin: "0 auto", padding: "28px 20px 60px" },
    title: { fontFamily: "'Baloo 2', cursive", fontSize: 22, fontWeight: 800, color: "#3D1F0A", marginBottom: 20, textAlign: "center" },
    planCard: (sel) => ({
      border: `2px solid ${sel ? "#FF6B35" : "#FFD9C8"}`, background: sel ? "#FFF0EB" : "#fff",
      borderRadius: 16, padding: 16, marginBottom: 12, cursor: "pointer", display: "flex", alignItems: "flex-start", gap: 12,
    }),
    input: { width: "100%", padding: "11px 14px", borderRadius: 12, border: "1.5px solid #FFD9C8", background: "#fff", fontFamily: "'Nunito', sans-serif", fontSize: 14, color: "#3D1F0A", outline: "none", boxSizing: "border-box" },
    label: { fontSize: 11, fontWeight: 700, color: "#7A4522", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 5, display: "block", marginTop: 14 },
    submitBtn: { width: "100%", padding: 15, borderRadius: 14, border: "none", background: processing ? "#C4845A" : "linear-gradient(135deg,#FF6B35,#e85d2e)", color: "#fff", fontFamily: "'Baloo 2', cursive", fontSize: 16, fontWeight: 700, cursor: processing ? "default" : "pointer", marginTop: 24, boxShadow: "0 8px 20px rgba(255,107,53,0.3)" },
  };

  const chosenPlan = PLANS.find((p) => p.id === selectedPlan);

  return (
    <div style={css.page}>
      <link href="https://fonts.googleapis.com/css2?family=Baloo+2:wght@400;700;800&family=Nunito:wght@400;600;700&display=swap" rel="stylesheet" />

      <div style={css.header}>
        <div style={css.logo}>Firus<span style={{ color: "#FFD166" }}>&</span>Michis</div>
        <div style={{ flex: 1 }} />
        <button onClick={() => router.back()} style={css.back}>← Volver</button>
      </div>

      <div style={css.body}>
        <div style={css.title}>Elige tu plan</div>

        {PLANS.map((p) => (
          <div key={p.id} style={css.planCard(selectedPlan === p.id)} onClick={() => setSelectedPlan(p.id)}>
            <input type="radio" name="plan" checked={selectedPlan === p.id} onChange={() => setSelectedPlan(p.id)}
              style={{ width: 18, height: 18, accentColor: "#FF6B35", marginTop: 2, flexShrink: 0 }} />
            <div style={{ flex: 1 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                <span style={{ fontFamily: "'Baloo 2', cursive", fontSize: 15, fontWeight: 800, color: "#3D1F0A" }}>{p.label}</span>
                <span style={{ fontFamily: "'Baloo 2', cursive", fontSize: 16, fontWeight: 800, color: "#FF6B35" }}>{p.price} <small style={{ fontSize: 11, fontWeight: 600 }}>CLP/mes</small></span>
              </div>
              <ul style={{ listStyle: "none", padding: 0, margin: "8px 0 0" }}>
                {p.features.map((f) => (
                  <li key={f} style={{ fontSize: 12.5, color: "#7A4522", lineHeight: 1.8 }}>✓ {f}</li>
                ))}
              </ul>
            </div>
          </div>
        ))}

        {currentPlan && currentPlan !== "free" && (
          <div style={{ fontSize: 12, color: "#8A5530", marginBottom: 8, textAlign: "center" }}>
            Plan actual: <strong>{currentPlan.toUpperCase()}</strong>
          </div>
        )}

        {/* Formulario simulado — integrar Mercado Pago aquí */}
        <label style={css.label}>Nombre en la tarjeta</label>
        <input style={css.input} type="text" placeholder="Como aparece en tu tarjeta" value={cardName} onChange={(e) => setCardName(e.target.value)} />

        <label style={css.label}>Número de tarjeta</label>
        <input style={css.input} type="text" placeholder="•••• •••• •••• ••••" value={cardNumber} onChange={(e) => setCardNumber(e.target.value)} />

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <div>
            <label style={css.label}>Vencimiento</label>
            <input style={css.input} type="text" placeholder="MM/AA" value={cardExpiry} onChange={(e) => setCardExpiry(e.target.value)} />
          </div>
          <div>
            <label style={css.label}>CVV</label>
            <input style={css.input} type="text" placeholder="•••" value={cardCvv} onChange={(e) => setCardCvv(e.target.value)} />
          </div>
        </div>

        <button style={css.submitBtn} onClick={activarPlan} disabled={processing}>
          {processing ? "Procesando..." : `Activar plan ${chosenPlan?.label || ""}`}
        </button>

        <div style={{ fontSize: 11, color: "#B08968", textAlign: "center", marginTop: 10 }}>
          * Pago simulado — próximamente Mercado Pago
        </div>
      </div>
    </div>
  );
}

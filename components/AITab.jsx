"use client";
import { useState, useRef } from "react";

export default function AITab({ pet, medications, history }) {
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzeResult, setAnalyzeResult] = useState(null);
  const [symptom, setSymptom] = useState("");
  const [symptomLoading, setSymptomLoading] = useState(false);
  const [symptomResult, setSymptomResult] = useState(null);
  const [preview, setPreview] = useState(null);
  const [b64, setB64] = useState(null);
  const [mediaType, setMediaType] = useState("image/jpeg");
  const [recipeLoading, setRecipeLoading] = useState(false);
  const [recipeResult, setRecipeResult] = useState(null);
  const fileRef = useRef();

  const analyze = async () => {
    setAnalyzing(true);
    setAnalyzeResult(null);
    try {
      const res = await fetch("/api/ai-analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pet, medications, history }),
      });
      const data = await res.json();
      setAnalyzeResult(data.result);
    } catch {
      setAnalyzeResult("Error al conectar con la IA. Intenta de nuevo.");
    }
    setAnalyzing(false);
  };

  const consultSymptom = async () => {
    if (!symptom.trim()) return;
    setSymptomLoading(true);
    setSymptomResult(null);
    try {
      const res = await fetch("/api/ai-symptoms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pet, medications, history, symptom }),
      });
      const data = await res.json();
      setSymptomResult(data.result);
    } catch {
      setSymptomResult("Error al conectar con la IA. Intenta de nuevo.");
    }
    setSymptomLoading(false);
  };

  const onFile = (e) => {
    const f = e.target.files[0];
    if (!f) return;
    setMediaType(f.type || "image/jpeg");
    const r = new FileReader();
    r.onload = (ev) => {
      setPreview(ev.target.result);
      setB64(ev.target.result.split(",")[1]);
      setRecipeResult(null);
    };
    r.readAsDataURL(f);
  };

  const analyzeRecipe = async () => {
    if (!b64) return;
    setRecipeLoading(true);
    setRecipeResult(null);
    try {
      const res = await fetch("/api/ai-recipe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageBase64: b64, mediaType }),
      });
      const data = await res.json();
      setRecipeResult(data);
    } catch {
      setRecipeResult({ error: "No se pudo procesar. Intenta con una foto más clara." });
    }
    setRecipeLoading(false);
  };

  const inputS = { width: "100%", padding: "9px 12px", borderRadius: 10, border: "1.5px solid #FFD9C8", background: "#fff", fontFamily: "'Nunito', sans-serif", fontSize: 14, color: "#3D1F0A", outline: "none", boxSizing: "border-box" };
  const btnOrange = { width: "100%", padding: 13, borderRadius: 13, background: "#FF6B35", color: "#fff", border: "none", fontFamily: "'Baloo 2', cursive", fontSize: 15, fontWeight: 700, cursor: "pointer", marginTop: 10 };
  const btnMint = { width: "100%", padding: 13, borderRadius: 13, background: "#2EC4B6", color: "#fff", border: "none", fontFamily: "'Baloo 2', cursive", fontSize: 15, fontWeight: 700, cursor: "pointer", marginTop: 10 };
  const btnPurple = { width: "100%", padding: 13, borderRadius: 13, background: "#8B5CF6", color: "#fff", border: "none", fontFamily: "'Baloo 2', cursive", fontSize: 15, fontWeight: 700, cursor: "pointer", marginTop: 10 };
  const sectionTitle = (color, text) => (
    <div style={{ fontSize: 10, fontWeight: 700, color, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>{text}</div>
  );
  const card = { background: "#fff", borderRadius: 18, padding: 18, marginBottom: 16, boxShadow: "0 4px 24px rgba(61,31,10,0.08)" };
  const disclaimer = (
    <div style={{ background: "#fef2f2", borderRadius: 10, padding: "10px 12px", marginTop: 10, border: "1px solid #fecaca" }}>
      <div style={{ fontSize: 11, color: "#dc2626", fontWeight: 700 }}>⚠️ Aviso importante</div>
      <div style={{ fontSize: 11, color: "#7A4522", marginTop: 2 }}>Este análisis es orientativo y no reemplaza la consulta veterinaria. Ante cualquier duda, consulta a un profesional.</div>
    </div>
  );

  return (
    <div className="fade-up">
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 12 }}>
        <div style={{ background: "#FFD166", color: "#7A4522", fontSize: 10, fontWeight: 700, padding: "3px 12px", borderRadius: 20, letterSpacing: "0.5px" }}>✦ PRO</div>
      </div>

      {/* SECCIÓN 1: Análisis general */}
      <div style={card}>
        {sectionTitle("#FF6B35", "1 · Análisis personalizado")}
        <div style={{ fontSize: 12, color: "#7A4522", marginBottom: 12, lineHeight: 1.6 }}>
          La IA analiza la ficha completa de {pet.name} y genera recomendaciones según su edad, raza, condiciones y medicamentos actuales.
        </div>
        <button style={btnOrange} onClick={analyze} disabled={analyzing}>
          {analyzing ? "Analizando..." : `🔍 Analizar a ${pet.name}`}
        </button>
        {analyzeResult && (
          <div style={{ background: "#FFF0EB", borderRadius: 12, padding: 14, marginTop: 12, borderLeft: "3px solid #FF6B35" }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#FF6B35", marginBottom: 8 }}>Recomendaciones para {pet.name}</div>
            <div style={{ fontSize: 13, color: "#3D1F0A", lineHeight: 1.7, whiteSpace: "pre-wrap" }}>{analyzeResult}</div>
            {disclaimer}
          </div>
        )}
      </div>

      {/* SECCIÓN 2: Consulta de síntomas */}
      <div style={card}>
        {sectionTitle("#2EC4B6", "2 · Consulta de síntomas")}
        <div style={{ fontSize: 12, color: "#7A4522", marginBottom: 10, lineHeight: 1.6 }}>
          Describe lo que le pasa a {pet.name} y la IA analizará con su historial completo.
        </div>
        <textarea
          style={{ ...inputS, resize: "vertical", minHeight: 80 }}
          placeholder={`Ej: ${pet.name} se está rascando mucho las orejas y sacude la cabeza...`}
          value={symptom}
          onChange={e => setSymptom(e.target.value)}
        />
        <button style={btnMint} onClick={consultSymptom} disabled={symptomLoading || !symptom.trim()}>
          {symptomLoading ? "Consultando..." : "🩺 Consultar"}
        </button>
        {symptomResult && (
          <div style={{ background: "#E8FAF9", borderRadius: 12, padding: 14, marginTop: 12, borderLeft: "3px solid #2EC4B6" }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#0F6E56", marginBottom: 8 }}>Análisis de síntomas</div>
            <div style={{ fontSize: 13, color: "#3D1F0A", lineHeight: 1.7, whiteSpace: "pre-wrap" }}>{symptomResult}</div>
            {disclaimer}
          </div>
        )}
      </div>

      {/* SECCIÓN 3: Lector de receta */}
      <div style={card}>
        {sectionTitle("#8B5CF6", "3 · Lector de receta")}
        <div style={{ fontSize: 12, color: "#7A4522", marginBottom: 10, lineHeight: 1.6 }}>
          Sube una foto de la receta veterinaria y la IA extrae medicamento, dosis y frecuencia automáticamente.
        </div>
        <div
          onClick={() => fileRef.current.click()}
          style={{ border: "2px dashed #C4B5FD", borderRadius: 14, padding: "24px 16px", textAlign: "center", background: "#f5f3ff", cursor: "pointer", marginBottom: 8 }}>
          {preview
            ? <img src={preview} alt="Receta" style={{ maxWidth: "100%", maxHeight: 180, borderRadius: 10, objectFit: "contain" }} />
            : <>
                <div style={{ fontSize: 36, marginBottom: 6 }}>📋</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#7c3aed" }}>Toca para subir receta</div>
                <div style={{ fontSize: 11, color: "#8B5CF6", marginTop: 3 }}>Foto JPG o PNG</div>
              </>
          }
          <input ref={fileRef} type="file" accept="image/*" onChange={onFile} style={{ display: "none" }} />
        </div>
        {preview && (
          <button style={btnPurple} onClick={analyzeRecipe} disabled={recipeLoading}>
            {recipeLoading ? "Analizando receta..." : "🔍 Analizar receta"}
          </button>
        )}
        {recipeResult && !recipeResult.error && (
          <div style={{ background: "#f5f3ff", borderRadius: 12, padding: 14, marginTop: 12, borderLeft: "3px solid #8B5CF6" }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#7c3aed", marginBottom: 8 }}>✓ Receta procesada</div>
            {Object.entries(recipeResult.result).filter(([, v]) => v).map(([k, v]) => (
              <div key={k} style={{ display: "flex", gap: 10, padding: "6px 0", borderBottom: "1px solid #ede9fe", fontSize: 13 }}>
                <div style={{ width: 90, flexShrink: 0, color: "#C4845A", fontSize: 11, textTransform: "capitalize", paddingTop: 1 }}>{k}</div>
                <div style={{ fontWeight: 700, flex: 1, color: "#3D1F0A" }}>{v}</div>
              </div>
            ))}
          </div>
        )}
        {recipeResult?.error && (
          <div style={{ background: "#fef2f2", borderRadius: 12, padding: 14, marginTop: 12, color: "#dc2626", fontSize: 13, fontWeight: 600, border: "1px solid #fecaca" }}>
            ⚠️ {recipeResult.error}
          </div>
        )}
      </div>
    </div>
  );
}

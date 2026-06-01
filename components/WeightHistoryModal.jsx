"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase";

export default function WeightHistoryModal({ pet, onClose, onSaved }) {
  const supabase = createClient();
  const [mode, setMode] = useState("annual");
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);
  const [loadingData, setLoadingData] = useState(true);

  const birthYear = pet.birth_date
    ? new Date(pet.birth_date).getFullYear()
    : new Date().getFullYear() - 5;
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: currentYear - birthYear }, (_, i) => currentYear - 1 - i);

  const [annualData, setAnnualData] = useState(Object.fromEntries(years.map(y => [y, ""])));
  const [semYear, setSemYear] = useState(years[0] || currentYear - 1);
  const [sem1, setSem1] = useState("");
  const [sem2, setSem2] = useState("");
  const [semAutoCalc, setSemAutoCalc] = useState(false);
  const [sporadic, setSporadic] = useState([{ date: "", kg: "" }]);
  const [existingSporadic, setExistingSporadic] = useState([]);
  const [weekYear, setWeekYear] = useState(years[0] || currentYear - 1);
  const [weekMonth, setWeekMonth] = useState(0);
  const [weekData, setWeekData] = useState({ 1: "", 2: "", 3: "", 4: "" });

  const months = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];

  useEffect(() => { loadExisting(); }, []);

  const loadExisting = async () => {
    setLoadingData(true);
    const firstDay = `${birthYear}-01-01`;
    const lastDay = `${currentYear - 1}-12-31`;

    const { data } = await supabase
      .from("weight_logs")
      .select("*")
      .eq("pet_id", pet.id)
      .gte("logged_date", firstDay)
      .lte("logged_date", lastDay)
      .order("logged_date", { ascending: true });

    if (!data?.length) { setLoadingData(false); return; }

    // Cargar anuales
    const byYear = {};
    data.forEach(w => {
      const y = parseInt(w.logged_date.slice(0, 4));
      if (!byYear[y]) byYear[y] = [];
      byYear[y].push(parseFloat(w.weight_kg));
    });

    const newAnnual = { ...Object.fromEntries(years.map(y => [y, ""])) };
    Object.entries(byYear).forEach(([y, vals]) => {
      const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
      newAnnual[parseInt(y)] = avg.toFixed(1);
    });
    setAnnualData(newAnnual);

    // Cargar esporádicos existentes
    const spor = data.filter(w => w.granularity === "sporadic");
    if (spor.length) {
      setExistingSporadic(spor.map(w => ({
        id: w.id,
        date: w.logged_date,
        kg: parseFloat(w.weight_kg).toFixed(1),
      })));
    }

    setLoadingData(false);
  };

  // Cuando cambia semYear, calcular promedios semestrales desde anuales
  useEffect(() => {
    const y = semYear;
    const sem1Avg = annualData[y];
    if (sem1Avg && !sem1) {
      setSem1(sem1Avg);
      setSem2(sem1Avg);
      setSemAutoCalc(true);
    }
  }, [semYear, annualData]);

  const saveAnnual = async () => {
    setLoading(true);
    const entries = Object.entries(annualData).filter(([, v]) => v && parseFloat(v) > 0);
    for (const [year, kg] of entries) {
      const date = `${year}-07-01`;
      await supabase.from("weight_logs").upsert({
        pet_id: pet.id,
        weight_kg: parseFloat(kg),
        logged_date: date,
        granularity: "annual",
        week_of_month: null,
      }, { onConflict: "pet_id,logged_date,granularity" });
    }
    setLoading(false);
    setSaved(true);
    setTimeout(() => { onSaved?.(); onClose(); }, 1000);
  };

  const saveSemester = async () => {
    setLoading(true);
    if (sem1 && parseFloat(sem1) > 0) {
      await supabase.from("weight_logs").upsert({
        pet_id: pet.id,
        weight_kg: parseFloat(sem1),
        logged_date: `${semYear}-03-01`,
        granularity: "semester",
        semester: 1,
        week_of_month: null,
      }, { onConflict: "pet_id,logged_date,granularity" });
    }
    if (sem2 && parseFloat(sem2) > 0) {
      await supabase.from("weight_logs").upsert({
        pet_id: pet.id,
        weight_kg: parseFloat(sem2),
        logged_date: `${semYear}-09-01`,
        granularity: "semester",
        semester: 2,
        week_of_month: null,
      }, { onConflict: "pet_id,logged_date,granularity" });
    }
    setLoading(false);
    setSaved(true);
    setTimeout(() => { onSaved?.(); onClose(); }, 1000);
  };

  const saveSporadic = async () => {
    setLoading(true);
    const valid = sporadic.filter(s => s.date && s.kg && parseFloat(s.kg) > 0);
    for (const s of valid) {
      await supabase.from("weight_logs").upsert({
        pet_id: pet.id,
        weight_kg: parseFloat(s.kg),
        logged_date: s.date,
        granularity: "sporadic",
        week_of_month: null,
      }, { onConflict: "pet_id,logged_date,granularity" });
    }
    setLoading(false);
    setSaved(true);
    setTimeout(() => { onSaved?.(); onClose(); }, 1000);
  };

  const deleteExistingSporadic = async () => {
    if (!existingSporadic.length) return;
    if (!confirm(`¿Eliminar ${existingSporadic.length} registro(s) esporádico(s)?`)) return;
    setLoading(true);
    const ids = existingSporadic.map(s => s.id);
    await supabase.from("weight_logs").delete().in("id", ids);
    setExistingSporadic([]);
    setLoading(false);
  };

const resetAll = async () => {
  if (!confirm("¿Eliminar TODOS los registros históricos de peso? Esta acción no se puede deshacer.")) return;
  setLoading(true);
  const firstDay = `${birthYear}-01-01`;
  const lastDay = `${currentYear - 1}-12-31`;
  await supabase
    .from("weight_logs")
    .delete()
    .eq("pet_id", pet.id)
    .gte("logged_date", firstDay)
    .lte("logged_date", lastDay);
  setAnnualData(Object.fromEntries(years.map(y => [y, ""])));
  setSem1(""); setSem2(""); setSemAutoCalc(false);
  setSporadic([{ date: "", kg: "" }]);
  setExistingSporadic([]);
  setWeekData({ 1: "", 2: "", 3: "", 4: "" });
  setLoading(false);
};

  const saveWeekly = async () => {
    setLoading(true);
    const entries = Object.entries(weekData).filter(([, v]) => v && parseFloat(v) > 0);
    for (const [wk, kg] of entries) {
      const day = parseInt(wk) * 7 - 6;
      const date = new Date(weekYear, weekMonth, Math.min(day, 28)).toISOString().split("T")[0];
      await supabase.from("weight_logs").upsert({
        pet_id: pet.id,
        weight_kg: parseFloat(kg),
        logged_date: date,
        granularity: "weekly",
        week_of_month: parseInt(wk),
      }, { onConflict: "pet_id,logged_date,granularity" });
    }
    setLoading(false);
    setSaved(true);
    setTimeout(() => { onSaved?.(); onClose(); }, 1000);
  };

  const css = {
    overlay: { position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 1000, display: "flex", alignItems: "flex-end", justifyContent: "center" },
    modal: { background: "#FFF8F3", borderRadius: "24px 24px 0 0", width: "100%", maxWidth: 480, maxHeight: "92vh", overflowY: "auto", display: "flex", flexDirection: "column" },
    header: { background: "linear-gradient(135deg, #FF6B35, #e85d2e)", padding: "16px 20px", borderRadius: "24px 24px 0 0", display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0 },
    body: { padding: "20px", flex: 1 },
    modeGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 16 },
    modeBtn: (sel) => ({ border: `2px solid ${sel ? "#FF6B35" : "#FFD9C8"}`, borderRadius: 12, padding: "10px 8px", background: sel ? "#FFF0EB" : "#fff", cursor: "pointer", textAlign: "center", transition: "all 0.2s" }),
    modeIcon: { fontSize: 22, marginBottom: 4 },
    modeLabel: (sel) => ({ fontSize: 12, fontWeight: 700, color: sel ? "#CC4A1A" : "#3D1F0A" }),
    modeSub: { fontSize: 10, color: "#C4845A", marginTop: 2 },
    sectionLabel: { fontSize: 11, fontWeight: 700, color: "#7A4522", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 10 },
    input: { width: "100%", padding: "9px 12px", borderRadius: 10, border: "1.5px solid #FFD9C8", background: "#fff", fontFamily: "'Nunito', sans-serif", fontSize: 14, color: "#3D1F0A", outline: "none", boxSizing: "border-box" },
    select: { width: "100%", padding: "9px 12px", borderRadius: 10, border: "1.5px solid #FFD9C8", background: "#fff", fontFamily: "'Nunito', sans-serif", fontSize: 14, color: "#3D1F0A", outline: "none" },
    saveBtn: { width: "100%", padding: 13, borderRadius: 13, background: saved ? "#2EC4B6" : "#FF6B35", color: "#fff", border: "none", fontFamily: "'Baloo 2', cursive", fontSize: 15, fontWeight: 700, cursor: "pointer", marginTop: 16, transition: "background 0.3s" },
    deleteBtn: { width: "100%", padding: 11, borderRadius: 13, background: "#fef2f2", color: "#dc2626", border: "1.5px solid #fecaca", fontFamily: "'Baloo 2', cursive", fontSize: 14, fontWeight: 700, cursor: "pointer", marginTop: 8 },
    row: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: "1px solid #FFF0EB", gap: 12 },
    yearLabel: { fontSize: 14, fontWeight: 700, color: "#3D1F0A", flexShrink: 0, width: 48 },
    weekGrid: { display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 6, marginBottom: 14 },
    weekSlot: { border: "1.5px solid #FFD9C8", borderRadius: 10, padding: "8px 4px", textAlign: "center" },
    weekLabel: { fontSize: 9, color: "#C4845A", marginBottom: 4 },
    weekInput: { width: "100%", padding: "5px 4px", borderRadius: 8, border: "1px solid #FFD9C8", background: "#FFFAF7", fontFamily: "'Nunito', sans-serif", fontSize: 12, color: "#3D1F0A", outline: "none", textAlign: "center", boxSizing: "border-box" },
    autoTag: { background: "#E8FAF9", color: "#0F6E56", borderRadius: 6, padding: "2px 8px", fontSize: 10, fontWeight: 700, marginLeft: 6 },
  };

  const MODES = [
    { id: "annual", icon: "📊", label: "Promedio anual", sub: "1 peso por año" },
    { id: "semester", icon: "📅", label: "Semestral", sub: "2 pesos por año" },
    { id: "sporadic", icon: "🗒️", label: "Esporádico", sub: "fecha + peso libre" },
    { id: "weekly", icon: "📋", label: "Por semana", sub: "hasta 4 por mes" },
  ];

  return (
    <div style={css.overlay}>
      <div style={css.modal}>
        <link href="https://fonts.googleapis.com/css2?family=Baloo+2:wght@800&family=Nunito:wght@400;700&display=swap" rel="stylesheet" />

        <div style={css.header}>
          <div>
            <div style={{ fontFamily: "'Baloo 2', cursive", fontSize: 17, fontWeight: 800, color: "#fff" }}>
              📈 Historial de peso
            </div>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.75)", marginTop: 2 }}>
              {pet.name} · desde {birthYear}
            </div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
  <button onClick={resetAll} style={{ background: "rgba(255,255,255,0.15)", border: "1px solid rgba(255,255,255,0.3)", borderRadius: 10, color: "#fff", fontFamily: "'Baloo 2', cursive", fontSize: 12, fontWeight: 700, padding: "6px 10px", cursor: "pointer" }}>
    🗑️ Limpiar todo
  </button>
  <button onClick={onClose} style={{ background: "rgba(255,255,255,0.2)", border: "1px solid rgba(255,255,255,0.3)", borderRadius: 10, color: "#fff", fontFamily: "'Baloo 2', cursive", fontSize: 13, fontWeight: 700, padding: "6px 12px", cursor: "pointer" }}>
    ✕ Cerrar
  </button>
</div>
        </div>

        <div style={css.body}>
          {loadingData ? (
            <div style={{ textAlign: "center", padding: 32, color: "#C4845A", fontSize: 14 }}>
              Cargando datos...
            </div>
          ) : (
            <>
              <div style={css.sectionLabel}>¿Cómo quieres ingresar los datos?</div>
              <div style={css.modeGrid}>
                {MODES.map(m => (
                  <div key={m.id} style={css.modeBtn(mode === m.id)} onClick={() => setMode(m.id)}>
                    <div style={css.modeIcon}>{m.icon}</div>
                    <div style={css.modeLabel(mode === m.id)}>{m.label}</div>
                    <div style={css.modeSub}>{m.sub}</div>
                  </div>
                ))}
              </div>

              <div style={{ borderTop: "1px solid #FFD9C8", paddingTop: 16 }}>

                {/* MODO 1: ANUAL */}
                {mode === "annual" && (
                  <div>
                    <div style={css.sectionLabel}>Peso promedio por año</div>
                    <div style={{ maxHeight: 340, overflowY: "auto", paddingRight: 4 }}>
                      {years.map(y => (
                        <div key={y} style={css.row}>
                          <span style={css.yearLabel}>{y}</span>
                          <input style={{ ...css.input, flex: 1 }} type="number" placeholder="kg promedio" step="0.1"
                            value={annualData[y] || ""}
                            onChange={e => setAnnualData(p => ({ ...p, [y]: e.target.value }))} />
                        </div>
                      ))}
                    </div>
                    <button style={css.saveBtn} onClick={saveAnnual} disabled={loading}>
                      {saved ? "✓ Guardado" : loading ? "Guardando..." : "✓ Guardar historial anual"}
                    </button>
                  </div>
                )}

                {/* MODO 2: SEMESTRAL */}
                {mode === "semester" && (
                  <div>
                    <div style={css.sectionLabel}>Selecciona año y completa semestres</div>
                    <select style={{ ...css.select, marginBottom: 14 }} value={semYear}
                      onChange={e => {
                        const y = parseInt(e.target.value);
                        setSemYear(y);
                        const avg = annualData[y];
                        if (avg) { setSem1(avg); setSem2(avg); setSemAutoCalc(true); }
                        else { setSem1(""); setSem2(""); setSemAutoCalc(false); }
                      }}>
                      {years.map(y => <option key={y} value={y}>{y}</option>)}
                    </select>
                    {semAutoCalc && (
                      <div style={{ background: "#E8FAF9", borderRadius: 10, padding: "8px 12px", marginBottom: 12, fontSize: 12, color: "#0F6E56", fontWeight: 600 }}>
                        ✓ Valores calculados desde el promedio anual de {semYear} — puedes modificarlos
                      </div>
                    )}
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                      <div>
                        <div style={{ fontSize: 11, fontWeight: 700, color: "#7A4522", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 6 }}>Enero – Junio</div>
                        <input style={css.input} type="number" placeholder="ej: 14.2" step="0.1"
                          value={sem1} onChange={e => { setSem1(e.target.value); setSemAutoCalc(false); }} />
                      </div>
                      <div>
                        <div style={{ fontSize: 11, fontWeight: 700, color: "#7A4522", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 6 }}>Julio – Diciembre</div>
                        <input style={css.input} type="number" placeholder="ej: 15.0" step="0.1"
                          value={sem2} onChange={e => { setSem2(e.target.value); setSemAutoCalc(false); }} />
                      </div>
                    </div>
                    <button style={css.saveBtn} onClick={saveSemester} disabled={loading}>
                      {saved ? "✓ Guardado" : loading ? "Guardando..." : "✓ Guardar semestres"}
                    </button>
                  </div>
                )}

                {/* MODO 3: ESPORÁDICO */}
                {mode === "sporadic" && (
                  <div>
                    <div style={css.sectionLabel}>Agrega fecha y peso libre</div>

                    {existingSporadic.length > 0 && (
                      <div style={{ background: "#FFF0EB", borderRadius: 10, padding: "10px 12px", marginBottom: 12 }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: "#7A4522", marginBottom: 6 }}>
                          Registros esporádicos guardados ({existingSporadic.length}):
                        </div>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginBottom: 8 }}>
                          {existingSporadic.map((s, i) => (
                            <span key={i} style={{ background: "#E8FAF9", color: "#0F6E56", borderRadius: 6, padding: "3px 8px", fontSize: 11, fontWeight: 700 }}>
                              {s.date} · {s.kg} kg
                            </span>
                          ))}
                        </div>
                        <button style={css.deleteBtn} onClick={deleteExistingSporadic} disabled={loading}>
                          🗑️ Eliminar registros actuales
                        </button>
                      </div>
                    )}

                    <div style={{ fontSize: 12, color: "#C4845A", marginBottom: 10 }}>Nuevos registros a agregar:</div>
                    {sporadic.map((s, i) => (
                      <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr 1fr auto", gap: 8, marginBottom: 8 }}>
                        <input style={css.input} type="date"
                          min={`${birthYear}-01-01`}
                          max={new Date(new Date().getFullYear(), new Date().getMonth(), 0).toISOString().split("T")[0]}
                          value={s.date}
                          onChange={e => setSporadic(p => p.map((x, j) => j === i ? { ...x, date: e.target.value } : x))} />
                        <input style={css.input} type="number" placeholder="kg" step="0.1" value={s.kg}
                          onChange={e => setSporadic(p => p.map((x, j) => j === i ? { ...x, kg: e.target.value } : x))} />
                        {sporadic.length > 1 && (
                          <button onClick={() => setSporadic(p => p.filter((_, j) => j !== i))}
                            style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8, color: "#dc2626", padding: "0 10px", cursor: "pointer", fontSize: 14 }}>✕</button>
                        )}
                      </div>
                    ))}
                    <button onClick={() => setSporadic(p => [...p, { date: "", kg: "" }])}
                      style={{ width: "100%", padding: 10, borderRadius: 10, background: "#FFF0EB", color: "#FF6B35", border: "1.5px solid #FFD0BC", fontFamily: "'Baloo 2', cursive", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
                      + Agregar otro registro
                    </button>
                    <button style={css.saveBtn} onClick={saveSporadic} disabled={loading}>
                      {saved ? "✓ Guardado" : loading ? "Guardando..." : "✓ Guardar registros"}
                    </button>
                  </div>
                )}

                {/* MODO 4: SEMANAL */}
                {mode === "weekly" && (
                  <div>
                    <div style={css.sectionLabel}>Selecciona año y mes</div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 }}>
                      <select style={css.select} value={weekYear}
                        onChange={e => { setWeekYear(parseInt(e.target.value)); setWeekData({ 1: "", 2: "", 3: "", 4: "" }); }}>
                        {years.map(y => <option key={y} value={y}>{y}</option>)}
                      </select>
                      <select style={css.select} value={weekMonth}
                        onChange={e => { setWeekMonth(parseInt(e.target.value)); setWeekData({ 1: "", 2: "", 3: "", 4: "" }); }}>
                        {months.map((m, i) => <option key={i} value={i}>{m}</option>)}
                      </select>
                    </div>
                    <div style={css.weekGrid}>
                      {[1, 2, 3, 4].map(wk => (
                        <div key={wk} style={css.weekSlot}>
                          <div style={css.weekLabel}>semana {wk}</div>
                          <input style={css.weekInput} type="number" placeholder="kg" step="0.1"
                            value={weekData[wk] || ""}
                            onChange={e => setWeekData(p => ({ ...p, [wk]: e.target.value }))} />
                        </div>
                      ))}
                    </div>
                    <button style={css.saveBtn} onClick={saveWeekly} disabled={loading}>
                      {saved ? "✓ Guardado" : loading ? "Guardando..." : "✓ Guardar semanas"}
                    </button>
                  </div>
                )}

              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

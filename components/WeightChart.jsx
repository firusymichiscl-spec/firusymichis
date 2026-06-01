"use client";

import WeightHistoryModal from "@/components/WeightHistoryModal";
import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine
} from "recharts";

const getWeekOfMonth = (date) => {
  const d = new Date(date + "T12:00:00");
  const firstDay = new Date(d.getFullYear(), d.getMonth(), 1);
  return Math.ceil((d.getDate() + firstDay.getDay()) / 7);
};

const weeksInMonth = (year, month) => {
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  return Math.ceil((firstDay + daysInMonth) / 7);
};

const currentWeekOfMonth = () => {
  const today = new Date();
  return Math.ceil(today.getDate() / 7);
};

const PAW_EMOJI = { dog: "🐾", cat: "🐱", other: "🐰" };

const CustomDot = (props) => {
  const { cx, cy, payload, species } = props;
  if (!cx || !cy) return null;
  const isHistorical = payload?.type === "historical";
  return (
    <text x={cx} y={cy + 7} textAnchor="middle" fontSize={isHistorical ? 14 : 18}
      style={{ userSelect: "none", opacity: isHistorical ? 0.7 : 1 }}>
      {isHistorical ? "📅" : (PAW_EMOJI[species] || "🐾")}
    </text>
  );
};

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  const isHist = payload[0]?.payload?.type === "historical";
  return (
    <div style={{ background: "#3D1F0A", color: "#fff", padding: "6px 10px", borderRadius: 8, fontSize: 12, fontWeight: 700 }}>
      {Number(payload[0].value).toFixed(1)} kg · {label}
      {isHist && <div style={{ fontSize: 10, opacity: 0.7 }}>promedio anual</div>}
    </div>
  );
};

export default function WeightChart({ pet }) {
  const supabase = createClient();
  const [weekData, setWeekData] = useState([]);
  const [yearlyAvgs, setYearlyAvgs] = useState([]);
  const [chartData, setChartData] = useState([]);
  const [showInput, setShowInput] = useState(false);
  const [editingWeek, setEditingWeek] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [newWeight, setNewWeight] = useState("");
  const [loading, setLoading] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);

  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const totalWeeks = weeksInMonth(year, month);
  const currentWeek = currentWeekOfMonth();
  const firstDay = new Date(year, month, 1).toISOString().split("T")[0];
  const lastDay = new Date(year, month + 1, 0).toISOString().split("T")[0];
  const monthLabel = now.toLocaleDateString("es-CL", { month: "long", year: "numeric" });
  const species = pet.species || "dog";

  useEffect(() => { loadAll(); }, []);

  const loadAll = async () => {
    // Mes actual
    const { data: current } = await supabase
      .from("weight_logs")
      .select("*")
      .eq("pet_id", pet.id)
      .gte("logged_date", firstDay)
      .lte("logged_date", lastDay)
      .order("week_of_month", { ascending: true });

    // Años anteriores
    const { data: hist } = await supabase
      .from("weight_logs")
      .select("*")
      .eq("pet_id", pet.id)
      .lt("logged_date", firstDay)
      .order("logged_date", { ascending: true });

    const weeks = Array.from({ length: Math.min(totalWeeks, 4) }, (_, i) => {
      const wk = i + 1;
      const found = current?.find(w => w.week_of_month === wk);
      return {
        week: wk,
        kg: found ? parseFloat(found.weight_kg) : null,
        id: found?.id || null,
      };
    });

    // Si hay semana 5, promediar con semana 4
    if (totalWeeks === 5) {
      const wk5 = current?.find(w => w.week_of_month === 5);
      if (wk5 && weeks[3]) {
        const avg = ((weeks[3].kg || 0) + parseFloat(wk5.weight_kg)) / 2;
        weeks[3] = { ...weeks[3], kg: parseFloat(avg.toFixed(1)) };
      }
    }

    setWeekData(weeks);

    // Promedios anuales
    const byYear = {};
    hist?.forEach(w => {
      const y = w.logged_date.slice(0, 4);
      if (!byYear[y]) byYear[y] = [];
      byYear[y].push(parseFloat(w.weight_kg));
    });

    const avgs = Object.entries(byYear).map(([y, vals]) => ({
      year: y,
      kg: parseFloat((vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(1)),
      type: "historical",
    }));

    setYearlyAvgs(avgs);

    // Chart data: años históricos + semanas del mes actual
    const currentPoints = weeks
      .filter(w => w.kg !== null)
      .map(w => ({
        label: `S${w.week} ${now.toLocaleDateString("es-CL", { month: "short" })}`,
        kg: w.kg,
        type: "current",
      }));

    setChartData([
      ...avgs.map(a => ({ label: a.year, kg: a.kg, type: "historical" })),
      ...currentPoints,
    ]);
  };

  const currentKg = weekData.filter(w => w.kg !== null).slice(-1)[0]?.kg;
  const prevKg = weekData.filter(w => w.kg !== null).slice(-2)[0]?.kg;
  const diff = currentKg && prevKg ? (currentKg - prevKg).toFixed(1) : null;
  const minY = chartData.length ? Math.min(...chartData.map(d => d.kg)) - 1 : 0;
  const maxY = chartData.length ? Math.max(...chartData.map(d => d.kg)) + 1 : 20;

  const openEdit = (week, kg, id) => {
    setEditingWeek(week);
    setEditingId(id);
    setNewWeight(kg?.toString() || "");
    setShowInput(true);
  };

  const getWeekDateRange = (wk) => {
    const firstOfMonth = new Date(year, month, 1);
    const startDay = (wk - 1) * 7 - firstOfMonth.getDay() + 1;
    const start = new Date(year, month, Math.max(startDay, 1));
    const end = new Date(year, month, Math.min(startDay + 6, new Date(year, month + 1, 0).getDate()));
    const startStr = start.toISOString().split("T")[0];
    return startStr <= lastDay ? startStr : null;
  };

  const saveWeight = async () => {
    const val = parseFloat(newWeight);
    if (!val || val < 0.1 || val > 200) return;
    setLoading(true);

    const loggedDate = getWeekDateRange(editingWeek) || firstDay;

    if (editingId) {
      await supabase.from("weight_logs").update({
        weight_kg: val,
        week_of_month: editingWeek,
        logged_date: loggedDate,
      }).eq("id", editingId);
    } else {
      await supabase.from("weight_logs").insert({
        pet_id: pet.id,
        weight_kg: val,
        week_of_month: editingWeek,
        logged_date: loggedDate,
      });
    }

    setNewWeight("");
    setShowInput(false);
    setEditingWeek(null);
    setEditingId(null);
    await loadAll();
    setLoading(false);
  };

  const deleteWeight = async (id) => {
    if (!id) return;
    await supabase.from("weight_logs").delete().eq("id", id);
    await loadAll();
  };

  const css = {
    card: { background: "#fff", borderRadius: 18, padding: 18, marginBottom: 16, boxShadow: "0 4px 24px rgba(61,31,10,0.08)" },
    title: { fontFamily: "'Baloo 2', cursive", fontSize: 13, fontWeight: 700, color: "#FF6B35", textTransform: "uppercase", letterSpacing: 1 },
    header: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 },
    kg: { fontFamily: "'Baloo 2', cursive", fontSize: 26, fontWeight: 800, color: "#3D1F0A", lineHeight: 1 },
    label: { fontSize: 10, color: "#C4845A", textTransform: "uppercase", letterSpacing: "0.5px" },
    trend: (up) => ({ display: "inline-flex", alignItems: "center", gap: 3, fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 10, marginTop: 3, background: up ? "#e8faf4" : "#fef2f2", color: up ? "#059669" : "#dc2626" }),
    slots: { display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 6, margin: "10px 0" },
    slot: (type) => ({
      border: `1.5px ${type === "empty" ? "dashed" : "solid"} ${type === "filled" ? "#2EC4B6" : type === "active" ? "#FF6B35" : type === "disabled" ? "#F5E6DA" : "#FFD9C8"}`,
      borderRadius: 10, padding: "8px 4px", textAlign: "center",
      cursor: type === "disabled" ? "not-allowed" : "pointer",
      background: type === "filled" ? "#E8FAF9" : type === "active" ? "#FFF0EB" : type === "disabled" ? "#FDFAF8" : "#FFFAF7",
      opacity: type === "disabled" ? 0.5 : 1,
      position: "relative",
    }),
    slotLabel: { fontSize: 9, color: "#C4845A", marginBottom: 2 },
    slotVal: (type) => ({ fontFamily: "'Baloo 2', cursive", fontSize: 13, fontWeight: 800, color: type === "filled" ? "#0F6E56" : type === "active" ? "#CC4A1A" : "#C4845A" }),
    input: { width: "100%", padding: "9px 12px", borderRadius: 10, border: "1.5px solid #FFD9C8", background: "#FFFAF7", fontFamily: "'Nunito', sans-serif", fontSize: 14, color: "#3D1F0A", outline: "none", boxSizing: "border-box" },
    saveBtn: { padding: "9px 16px", borderRadius: 10, background: "#FF6B35", color: "#fff", border: "none", fontFamily: "'Baloo 2', cursive", fontSize: 14, fontWeight: 700, cursor: "pointer" },
    histChip: { display: "inline-flex", flexDirection: "column", alignItems: "center", background: "#F5E6DA", borderRadius: 8, padding: "4px 10px" },
  };

  return (
    <div style={css.card}>
      
      
      <div style={css.header}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
            <div style={css.title}>⚖️ Evolución de peso</div>
            <button onClick={() => setShowHistoryModal(true)} style={{ background: "#FFF0EB", border: "1.5px solid #FFD0BC", borderRadius: 8, padding: "4px 10px", fontSize: 11, color: "#FF6B35", fontWeight: 700, cursor: "pointer" }}>
              📈 Historial
            </button>
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          
          
          {currentKg && <div style={css.kg}>{currentKg.toFixed(1)} <span style={{ fontSize: 14 }}>kg</span></div>}
          <div style={css.label}>peso actual</div>
          {diff !== null && (
            <div style={css.trend(parseFloat(diff) >= 0)}>
              {parseFloat(diff) >= 0 ? "▲ +" : "▼ "}{diff} kg
            </div>
          )}
        </div>
      </div>

      {chartData.length > 0 && (
        <ResponsiveContainer width="100%" height={160}>
          <LineChart data={chartData} margin={{ top: 16, right: 8, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(245,230,218,0.6)" />
            <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#C4845A", fontFamily: "Nunito" }} axisLine={false} tickLine={false} />
            <YAxis domain={[minY, maxY]} tick={{ fontSize: 10, fill: "#C4845A", fontFamily: "Nunito" }} axisLine={false} tickLine={false} tickFormatter={v => v.toFixed(0)} />
            <Tooltip content={<CustomTooltip />} />
            {yearlyAvgs.length > 0 && (
              <ReferenceLine x={yearlyAvgs[yearlyAvgs.length - 1].year} stroke="#FFD9C8" strokeDasharray="4 4" />
            )}
            <Line
              type="monotone"
              dataKey="kg"
              stroke="#FF6B35"
              strokeWidth={2.5}
              dot={(props) => <CustomDot {...props} species={species} />}
              activeDot={{ r: 6, fill: "#FF6B35", stroke: "#fff", strokeWidth: 2 }}
            />
          </LineChart>
        </ResponsiveContainer>
      )}

      {/* SLOTS SEMANAS */}
      <div style={{ borderTop: "1px solid #FFF0EB", paddingTop: 14, marginTop: 8 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: "#7A4522", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 4 }}>
          {monthLabel} — toca para editar
        </div>
        <div style={css.slots}>
          {weekData.map((w, i) => {
            const wk = w.week;
            const isCurrent = wk === currentWeek;
            const isFuture = wk > currentWeek;
            const type = isFuture ? "disabled" : w.kg !== null ? (isCurrent ? "active" : "filled") : "empty";
            return (
              <div key={wk} style={css.slot(type)}
                onClick={() => !isFuture && openEdit(wk, w.kg, w.id)}>
                {!isFuture && w.kg !== null && w.id !== null && (
                  <>
                    <div style={{ position: "absolute", top: 3, right: 4, fontSize: 8, color: "#C4845A" }}>✏️</div>
                    <div
                      style={{ position: "absolute", top: 3, left: 4, fontSize: 8, color: "#dc2626", cursor: "pointer", background: "#fef2f2", borderRadius: "50%", width: 14, height: 14, display: "flex", alignItems: "center", justifyContent: "center" }}
                      onClick={e => { e.stopPropagation(); deleteWeight(w.id); }}>
                      ×
                    </div>
                  </>
                )}
                <div style={css.slotLabel}>semana {wk}</div>
                <div style={css.slotVal(type)}>
                  {w.kg !== null ? w.kg.toFixed(1) : isFuture ? "—" : "+"}
                </div>
              </div>
            );
          })}
        </div>
        {totalWeeks === 5 && (
          <div style={{ fontSize: 10, color: "#C4845A", fontStyle: "italic", marginBottom: 8 }}>
            * Este mes tiene 5 semanas — semana 4 mostrará el promedio de S4 y S5
          </div>
        )}

        {/* INPUT */}
        {showInput && (
          <div style={{ marginTop: 8, background: "#FFF0EB", borderRadius: 12, padding: 12 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#FF6B35", marginBottom: 8 }}>
              {editingId ? `✏️ Editando semana ${editingWeek}` : `➕ Registrar semana ${editingWeek}`}
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <input style={css.input} type="number" placeholder="ej: 12.5" step="0.1"
                value={newWeight} onChange={e => setNewWeight(e.target.value)} />
              <button style={css.saveBtn} onClick={saveWeight} disabled={loading}>
                {loading ? "..." : editingId ? "Actualizar" : "Guardar"}
              </button>
              <button onClick={() => setShowInput(false)} style={{ ...css.saveBtn, background: "#fff", color: "#FF6B35", border: "1.5px solid #FFD0BC" }}>
                ✕
              </button>
            </div>
          </div>
        )}

        {/* PROMEDIOS ANUALES */}
        {yearlyAvgs.length > 0 && (
          <div style={{ marginTop: 14, paddingTop: 12, borderTop: "1px solid #FFF0EB" }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: "#C4845A", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 8 }}>
              Promedio anual
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {yearlyAvgs.map((a, i) => (
                <div key={i} style={css.histChip}>
                  <span style={{ fontSize: 9, color: "#C4845A" }}>{a.year}</span>
                  <span style={{ fontFamily: "'Baloo 2', cursive", fontSize: 13, fontWeight: 800, color: "#7A4522" }}>{a.kg.toFixed(1)} kg</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    
    {showHistoryModal && (
        <WeightHistoryModal
          pet={pet}
          onClose={() => setShowHistoryModal(false)}
          onSaved={() => { setShowHistoryModal(false); loadAll(); }}
        />
      )}
    </div>
  );
}
    

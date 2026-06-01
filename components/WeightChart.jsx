"use client";

import WeightHistoryModal from "@/components/WeightHistoryModal";
import { useState, useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase";
import { Chart, CategoryScale, LinearScale, PointElement, LineElement, LineController, Filler, Tooltip } from "chart.js";

const weeksInMonth = (year, month) => {
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  return Math.ceil((firstDay + daysInMonth) / 7);
};

const currentWeekOfMonth = () => {
  const today = new Date();
  return Math.ceil(today.getDate() / 7);
};

export default function WeightChart({ pet, onWeightUpdate }) {
  const supabase = createClient();
  const [weekData, setWeekData] = useState([]);
  const [yearlyAvgs, setYearlyAvgs] = useState([]);
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
  const birthYear = pet.birth_date ? new Date(pet.birth_date).getFullYear() : year - 5;

  const chartRef = useRef(null);
  const chartInstanceRef = useRef(null);

  useEffect(() => { loadAll(); }, []);

  const loadAll = async () => {
    const { data: current } = await supabase
      .from("weight_logs")
      .select("*")
      .eq("pet_id", pet.id)
      .gte("logged_date", firstDay)
      .lte("logged_date", lastDay)
      .order("week_of_month", { ascending: true });

    const { data: hist } = await supabase
      .from("weight_logs")
      .select("*")
      .eq("pet_id", pet.id)
      .lt("logged_date", firstDay)
      .order("logged_date", { ascending: true });

    const weeks = Array.from({ length: Math.min(totalWeeks, 4) }, (_, i) => {
      const wk = i + 1;
      const found = current?.find(w => w.week_of_month === wk);
      return { week: wk, kg: found ? parseFloat(found.weight_kg) : null, id: found?.id || null };
    });

    if (totalWeeks === 5) {
      const wk5 = current?.find(w => w.week_of_month === 5);
      if (wk5 && weeks[3]) {
        const avg = ((weeks[3].kg || 0) + parseFloat(wk5.weight_kg)) / 2;
        weeks[3] = { ...weeks[3], kg: parseFloat(avg.toFixed(1)) };
      }
    }

    setWeekData(weeks);

    const byYear = {};
    hist?.forEach(w => {
      const y = w.logged_date.slice(0, 4);
      if (!byYear[y]) byYear[y] = [];
      byYear[y].push(parseFloat(w.weight_kg));
    });

    const avgs = Object.entries(byYear).map(([y, vals]) => ({
      year: y,
      kg: parseFloat((vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(1)),
    }));

    setYearlyAvgs(avgs);
  };

  // Chart.js
  useEffect(() => {
    if (typeof window === "undefined" || !chartRef.current) return;

    Chart.register(CategoryScale, LinearScale, PointElement, LineElement, LineController, Filler, Tooltip);

    if (chartInstanceRef.current) {
      chartInstanceRef.current.destroy();
      chartInstanceRef.current = null;
    }

    const allYears = Array.from({ length: year - birthYear }, (_, i) => birthYear + i);
    const monthShort = now.toLocaleDateString("es-CL", { month: "short" });
    const currentWeekPoints = weekData.filter(w => w.kg !== null);

    if (allYears.length === 0 && currentWeekPoints.length === 0) return;

    const labels = [
      ...allYears.map(String),
      ...currentWeekPoints.map(w => `S${w.week} ${monthShort}`),
    ];
    const data = [
      ...allYears.map(y => yearlyAvgs.find(a => parseInt(a.year) === y)?.kg ?? null),
      ...currentWeekPoints.map(w => w.kg),
    ];
    const pointBgColors = [
      ...allYears.map(y => yearlyAvgs.find(a => parseInt(a.year) === y) ? "#FF6B35" : "transparent"),
      ...currentWeekPoints.map(() => "#2EC4B6"),
    ];
    const pointBorderColors = [
      ...allYears.map(y => yearlyAvgs.find(a => parseInt(a.year) === y) ? "#FF6B35" : "#C4845A"),
      ...currentWeekPoints.map(() => "#2EC4B6"),
    ];
    const pointBorderWidths = [
      ...allYears.map(y => yearlyAvgs.find(a => parseInt(a.year) === y) ? 2 : 1.5),
      ...currentWeekPoints.map(() => 2),
    ];
    const pointRadii = [
      ...allYears.map(y => yearlyAvgs.find(a => parseInt(a.year) === y) ? 4 : 3),
      ...currentWeekPoints.map(() => 0),
    ];
    const tickColors = [
      ...allYears.map(() => "#C4845A"),
      ...currentWeekPoints.map(() => "#2EC4B6"),
    ];

    const ctx = chartRef.current.getContext("2d");
    const canvasWidth = chartRef.current.parentElement?.offsetWidth || 400;

    const gradLine = ctx.createLinearGradient(0, 0, canvasWidth, 0);
    gradLine.addColorStop(0, "#FF6B35");
    gradLine.addColorStop(1, "#2EC4B6");

    const gradFill = ctx.createLinearGradient(0, 0, 0, 160);
    gradFill.addColorStop(0, "rgba(255,107,53,0.15)");
    gradFill.addColorStop(1, "rgba(46,196,182,0.02)");

    const species = pet.species || "dog";
    const emoji = species === "cat" ? "🐱" : species === "other" ? "🐰" : "🐾";
    const pawPlugin = {
      id: "pawPlugin",
      afterDatasetsDraw(chart) {
        const { ctx: c } = chart;
        const meta = chart.getDatasetMeta(0);
        meta.data.forEach((point, i) => {
          const label = chart.data.labels[i];
          const isCurrentMonth = typeof label === "string" && label.startsWith("S");
          if (isCurrentMonth && chart.data.datasets[0].data[i] !== null) {
            c.save();
            c.font = "16px serif";
            c.textAlign = "center";
            c.textBaseline = "middle";
            c.fillText(emoji, point.x, point.y);
            c.restore();
          }
        });
      },
    };

    try {
      chartInstanceRef.current = new Chart(ctx, {
        type: "line",
        plugins: [pawPlugin],
        data: {
          labels,
          datasets: [{
            data,
            borderColor: gradLine,
            borderWidth: 2.5,
            backgroundColor: gradFill,
            fill: true,
            tension: 0.35,
            spanGaps: false,
            pointBackgroundColor: pointBgColors,
            pointBorderColor: pointBorderColors,
            pointBorderWidth: pointBorderWidths,
            pointRadius: pointRadii,
            pointHoverRadius: 6,
          }],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          animation: false,
          plugins: {
            legend: { display: false },
            tooltip: {
              callbacks: { label: (c) => `${c.parsed.y?.toFixed(1)} kg` },
              backgroundColor: "#3D1F0A",
              titleColor: "#C4845A",
              bodyColor: "#fff",
              cornerRadius: 8,
              padding: 8,
              titleFont: { size: 10 },
              bodyFont: { size: 13, weight: "bold" },
            },
          },
          scales: {
            x: {
              grid: { color: "rgba(245,230,218,0.4)" },
              border: { display: false },
              ticks: {
                font: { size: 9, family: "Nunito" },
                color: (c) => tickColors[c.index] || "#C4845A",
                maxRotation: 45,
                autoSkip: true,
                maxTicksLimit: 14,
              },
            },
            y: {
              grid: { color: "rgba(245,230,218,0.4)" },
              border: { display: false },
              ticks: {
                font: { size: 9, family: "Nunito" },
                color: "#C4845A",
                callback: v => v.toFixed(0),
              },
            },
          },
        },
      });
    } catch (err) {
      // canvas no disponible durante el render
    }

    return () => {
      if (chartInstanceRef.current) {
        chartInstanceRef.current.destroy();
        chartInstanceRef.current = null;
      }
    };
  }, [weekData, yearlyAvgs]);

  const currentKg = weekData.filter(w => w.kg !== null).slice(-1)[0]?.kg;
  const prevKg = weekData.filter(w => w.kg !== null).slice(-2)[0]?.kg;
  const diff = currentKg && prevKg ? (currentKg - prevKg).toFixed(1) : null;

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
    const startStr = start.toISOString().split("T")[0];
    return startStr <= lastDay ? startStr : null;
  };

  const saveWeight = async () => {
    const val = parseFloat(newWeight.replace(",", "."));
    if (!val || val < 0.1 || val > 200) return;
    setLoading(true);
    const loggedDate = getWeekDateRange(editingWeek) || firstDay;
    if (editingId) {
      await supabase.from("weight_logs").update({
        weight_kg: val, week_of_month: editingWeek, logged_date: loggedDate,
      }).eq("id", editingId);
    } else {
      await supabase.from("weight_logs").insert({
        pet_id: pet.id, weight_kg: val, week_of_month: editingWeek, logged_date: loggedDate,
      });
    }
    setNewWeight(""); setShowInput(false); setEditingWeek(null); setEditingId(null);
    onWeightUpdate?.(val);
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

      {/* GRÁFICO CHART.JS */}
      <div style={{ position: "relative", height: 180 }}>
        <canvas ref={chartRef} style={{ width: "100%", height: "180px", display: "block" }} />
      </div>

      {/* SLOTS SEMANAS */}
      <div style={{ borderTop: "1px solid #FFF0EB", paddingTop: 14, marginTop: 8 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: "#7A4522", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 4 }}>
          {monthLabel} — toca para editar
        </div>
        <div style={css.slots}>
          {weekData.map((w) => {
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

        {showInput && (
          <div style={{ marginTop: 8, background: "#FFF0EB", borderRadius: 12, padding: 12 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#FF6B35", marginBottom: 8 }}>
              {editingId ? `✏️ Editando semana ${editingWeek}` : `➕ Registrar semana ${editingWeek}`}
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <input style={css.input} type="text" inputMode="decimal" placeholder="ej: 12.5"
                value={newWeight} onChange={e => setNewWeight(e.target.value.replace(",", "."))} />
              <button style={css.saveBtn} onClick={saveWeight} disabled={loading}>
                {loading ? "..." : editingId ? "Actualizar" : "Guardar"}
              </button>
              <button onClick={() => setShowInput(false)} style={{ ...css.saveBtn, background: "#fff", color: "#FF6B35", border: "1.5px solid #FFD0BC" }}>
                ✕
              </button>
            </div>
          </div>
        )}

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

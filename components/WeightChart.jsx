"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer
} from "recharts";

const PAW_EMOJI = { dog: "🐾", cat: "🐱", other: "🐰" };

const CustomDot = ({ cx, cy, species }) => (
  <text x={cx} y={cy + 7} textAnchor="middle" fontSize={18} style={{ userSelect: "none" }}>
    {PAW_EMOJI[species] || "🐾"}
  </text>
);

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: "#3D1F0A", color: "#fff", padding: "6px 10px", borderRadius: 8, fontSize: 12, fontWeight: 700 }}>
      {Number(payload[0].value).toFixed(1)} kg · {label}
    </div>
  );
};

export default function WeightChart({ pet }) {
  const supabase = createClient();
  const [weights, setWeights] = useState([]);
  const [newWeight, setNewWeight] = useState("");
  const [newDate, setNewDate] = useState(new Date().toISOString().split("T")[0]);
  const [showInput, setShowInput] = useState(false);
  const [editingIdx, setEditingIdx] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => { loadWeights(); }, []);

  const loadWeights = async () => {
    const { data } = await supabase
      .from("weight_logs")
      .select("*")
      .eq("pet_id", pet.id)
      .order("logged_date", { ascending: true })
      .limit(3);

    if (data?.length) {
      setWeights(data.map(w => ({
        date: new Date(w.logged_date).toLocaleDateString("es-CL", { month: "short", year: "numeric" }),
        kg: parseFloat(w.weight_kg),
        id: w.id,
        logged_date: w.logged_date,
      })));
    } else if (pet.weight_kg) {
      setWeights([{
        date: new Date().toLocaleDateString("es-CL", { month: "short", year: "numeric" }),
        kg: parseFloat(pet.weight_kg),
        id: null,
        logged_date: new Date().toISOString().split("T")[0],
      }]);
    }
  };

  const openAdd = () => {
    setEditingIdx(null);
    setNewWeight("");
    setNewDate(new Date().toISOString().split("T")[0]);
    setShowInput(true);
  };

  const openEdit = (idx) => {
    setEditingIdx(idx);
    setNewWeight(weights[idx].kg.toString());
    setNewDate(weights[idx].logged_date);
    setShowInput(true);
  };

  const saveWeight = async () => {
    const val = parseFloat(newWeight);
    if (!val || val < 0.1 || val > 200 || !newDate) return;
    setLoading(true);

    if (editingIdx !== null && weights[editingIdx]?.id) {
      // Editar registro existente
      await supabase
        .from("weight_logs")
        .update({ weight_kg: val, logged_date: newDate })
        .eq("id", weights[editingIdx].id);
    } else {
      // Nuevo registro
      await supabase.from("weight_logs").insert({
        pet_id: pet.id,
        weight_kg: val,
        logged_date: newDate,
      });
    }

    setNewWeight("");
    setNewDate(new Date().toISOString().split("T")[0]);
    setShowInput(false);
    setEditingIdx(null);
    await loadWeights();
    setLoading(false);
  };

  const current = weights[weights.length - 1]?.kg;
  const prev = weights[weights.length - 2]?.kg;
  const diff = current && prev ? (current - prev).toFixed(1) : null;
  const minY = weights.length ? Math.min(...weights.map(w => w.kg)) - 0.8 : 0;
  const maxY = weights.length ? Math.max(...weights.map(w => w.kg)) + 0.8 : 20;
  const species = pet.species || "dog";

  const css = {
    card: { background: "#fff", borderRadius: 18, padding: 18, marginBottom: 16, boxShadow: "0 4px 24px rgba(61,31,10,0.08)" },
    title: { fontFamily: "'Baloo 2', cursive", fontSize: 13, fontWeight: 700, color: "#FF6B35", textTransform: "uppercase", letterSpacing: 1, marginBottom: 14 },
    header: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 },
    kg: { fontFamily: "'Baloo 2', cursive", fontSize: 28, fontWeight: 800, color: "#3D1F0A", lineHeight: 1 },
    label: { fontSize: 10, color: "#C4845A", textTransform: "uppercase", letterSpacing: "0.5px" },
    trend: (up) => ({ display: "inline-flex", alignItems: "center", gap: 3, fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 10, marginTop: 3, background: up ? "#e8faf4" : "#fef2f2", color: up ? "#059669" : "#dc2626" }),
    slots: { display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 10 },
    slot: (type) => ({ border: `1.5px ${type === "empty" ? "dashed" : "solid"} ${type === "filled" ? "#2EC4B6" : type === "active" ? "#FF6B35" : "#FFD9C8"}`, borderRadius: 12, padding: "10px 6px", textAlign: "center", cursor: "pointer", background: type === "filled" ? "#E8FAF9" : type === "active" ? "#FFF0EB" : "#FFFAF7", position: "relative" }),
    slotLabel: { fontSize: 10, color: "#C4845A", marginBottom: 4 },
    slotVal: (type) => ({ fontFamily: "'Baloo 2', cursive", fontSize: 15, fontWeight: 800, color: type === "filled" ? "#0F6E56" : "#3D1F0A" }),
    editBadge: { position: "absolute", top: 4, right: 6, fontSize: 9, color: "#C4845A", fontWeight: 700 },
    inputRow: { display: "flex", gap: 8, marginTop: 8 },
    input: { flex: 1, padding: "9px 12px", borderRadius: 10, border: "1.5px solid #FFD9C8", background: "#FFFAF7", fontFamily: "'Nunito', sans-serif", fontSize: 14, color: "#3D1F0A", outline: "none" },
    saveBtn: { padding: "9px 16px", borderRadius: 10, background: "#FF6B35", color: "#fff", border: "none", fontFamily: "'Baloo 2', cursive", fontSize: 14, fontWeight: 700, cursor: "pointer" },
    addBtn: { border: "1.5px dashed #FFD9C8", borderRadius: 12, padding: "10px 6px", textAlign: "center", cursor: "pointer", background: "#FFFAF7" },
  };

  return (
    <div style={css.card}>
      <div style={css.header}>
        <div style={css.title}>⚖️ Evolución de peso</div>
        <div style={{ textAlign: "right" }}>
          {current && <div style={css.kg}>{current.toFixed(1)} <span style={{ fontSize: 14 }}>kg</span></div>}
          <div style={css.label}>peso actual</div>
          {diff !== null && (
            <div style={css.trend(parseFloat(diff) >= 0)}>
              {parseFloat(diff) >= 0 ? "▲ +" : "▼ "}{diff} kg
            </div>
          )}
        </div>
      </div>

      {weights.length > 0 && (
        <ResponsiveContainer width="100%" height={160}>
          <AreaChart data={weights} margin={{ top: 16, right: 8, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="weightGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#FF6B35" stopOpacity={0.2} />
                <stop offset="95%" stopColor="#FF6B35" stopOpacity={0.01} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(245,230,218,0.6)" />
            <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#C4845A", fontFamily: "Nunito" }} axisLine={false} tickLine={false} />
            <YAxis domain={[minY, maxY]} tick={{ fontSize: 11, fill: "#C4845A", fontFamily: "Nunito" }} axisLine={false} tickLine={false} tickFormatter={v => v.toFixed(1)} />
            <Tooltip content={<CustomTooltip />} />
            <Area
              type="monotone"
              dataKey="kg"
              stroke="#FF6B35"
              strokeWidth={2.5}
              fill="url(#weightGrad)"
              dot={(props) => <CustomDot {...props} species={species} />}
              activeDot={{ r: 6, fill: "#FF6B35", stroke: "#fff", strokeWidth: 2 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      )}

      <div style={{ borderTop: "1px solid #FFF0EB", paddingTop: 14, marginTop: 8 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: "#7A4522", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 10 }}>
          Registros del año — toca para editar
        </div>
        <div style={css.slots}>
          {weights.map((w, i) => {
            const type = i === weights.length - 1 ? "active" : "filled";
            return (
              <div key={i} style={css.slot(type)} onClick={() => openEdit(i)}>
                <div style={css.editBadge}>✏️</div>
                <div style={css.slotLabel}>{w.date}</div>
                <div style={css.slotVal(type)}>{w.kg.toFixed(1)}</div>
              </div>
            );
          })}
          {weights.length < 3 && (
            <div style={css.addBtn} onClick={openAdd}>
              <div style={css.slotLabel}>+ Agregar</div>
              <div style={{ fontFamily: "'Baloo 2', cursive", fontSize: 20, color: "#C4845A" }}>+</div>
            </div>
          )}
        </div>

        {showInput && (
          <div style={{ marginTop: 8 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#FF6B35", marginBottom: 8 }}>
              {editingIdx !== null ? `✏️ Editando registro ${editingIdx + 1}` : "➕ Nuevo registro"}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 8 }}>
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#7A4522", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 5 }}>Fecha</div>
                <input
                  style={css.input}
                  type="date"
                  min={pet.birth_date || "2000-01-01"}
                  max={new Date().toISOString().split("T")[0]}
                  value={newDate}
                  onChange={e => setNewDate(e.target.value)}
                />
              </div>
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#7A4522", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 5 }}>Peso (kg)</div>
                <input
                  style={css.input}
                  type="number"
                  placeholder="ej: 12.5"
                  step="0.1"
                  value={newWeight}
                  onChange={e => setNewWeight(e.target.value)}
                />
              </div>
            </div>
            <div style={css.inputRow}>
              <button style={{ ...css.saveBtn, flex: 1 }} onClick={saveWeight} disabled={loading}>
                {loading ? "..." : editingIdx !== null ? "Actualizar" : "Guardar"}
              </button>
              <button onClick={() => { setShowInput(false); setEditingIdx(null); }} style={{ ...css.saveBtn, background: "#FFF0EB", color: "#FF6B35", border: "1.5px solid #FFD0BC" }}>
                Cancelar
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

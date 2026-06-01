"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase";
import DietHistoryModal from "@/components/DietHistoryModal";

export default function DietTimeline({ pet }) {
  const supabase = createClient();
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);

  useEffect(() => { loadRecords(); }, []);

  const loadRecords = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("diet_logs")
      .select("*")
      .eq("pet_id", pet.id)
      .order("date_from", { ascending: false });
    setRecords(data || []);
    setLoading(false);
  };

  const formatPeriod = (from, to) => {
    const f = from ? from.slice(0, 7) : "?";
    if (!to) return `${f} → hoy`;
    return `${f} → ${to.slice(0, 7)}`;
  };

  const dotColor = (record, index) => {
    if (!record.date_to) return "#FF6B35";
    const t = Math.min(index / Math.max(records.length - 1, 1), 1);
    const r = Math.round(0xFF + t * (0x2E - 0xFF));
    const g = Math.round(0x6B + t * (0xC4 - 0x6B));
    const b = Math.round(0x35 + t * (0xB6 - 0x35));
    return `rgb(${r},${g},${b})`;
  };

  const css = {
    card: { background: "#fff", borderRadius: 18, padding: 18, marginBottom: 16, boxShadow: "0 4px 24px rgba(61,31,10,0.08)" },
    title: { fontFamily: "'Baloo 2', cursive", fontSize: 13, fontWeight: 700, color: "#FF6B35", textTransform: "uppercase", letterSpacing: 1 },
    header: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 },
    timeline: { position: "relative", paddingLeft: 32 },
    line: { position: "absolute", left: 10, top: 0, bottom: 0, width: 2, background: "linear-gradient(to bottom, #FF6B35, #2EC4B6)", borderRadius: 2 },
    item: { position: "relative", marginBottom: 10 },
    dot: (color) => ({
      position: "absolute", left: -26, top: 6,
      width: 8, height: 8, borderRadius: "50%",
      background: color, boxShadow: `0 0 0 3px #FFF8F3`,
    }),
    content: { background: "#FFFAF7", borderRadius: 12, padding: "8px 12px", border: "1.5px solid #FFD9C8" },
    foodName: { fontFamily: "'Baloo 2', cursive", fontSize: 13, fontWeight: 800, color: "#3D1F0A" },
    period: { fontSize: 10, color: "#C4845A", marginBottom: 3 },
    meta: { fontSize: 11, color: "#7A4522", marginTop: 2 },
    badge: { background: "#FFF0EB", color: "#FF6B35", border: "1px solid #FFD0BC", borderRadius: 6, padding: "2px 6px", fontSize: 9, fontWeight: 800, marginLeft: 6 },
    notes: { fontSize: 11, color: "#C4845A", marginTop: 3, fontStyle: "italic" },
    addBtn: { width: "100%", padding: 11, borderRadius: 13, background: "#FFF0EB", color: "#FF6B35", border: "1.5px solid #FFD0BC", fontFamily: "'Baloo 2', cursive", fontSize: 14, fontWeight: 700, cursor: "pointer", marginTop: 8 },
    histBtn: { background: "#FFF0EB", border: "1.5px solid #FFD0BC", borderRadius: 8, padding: "4px 10px", fontSize: 11, color: "#FF6B35", fontWeight: 700, cursor: "pointer" },
  };

  return (
    <div style={css.card}>
      <div style={css.header}>
        <div style={css.title}>🍽️ Alimentación</div>
        <button style={css.histBtn} onClick={() => setShowModal(true)}>📋 Historial</button>
      </div>

      {loading ? (
        <div style={{ textAlign: "center", padding: 24, color: "#C4845A", fontSize: 13 }}>Cargando...</div>
      ) : records.length === 0 ? (
        <div style={{ textAlign: "center", padding: 24, color: "#C4845A", fontSize: 13 }}>
          <div style={{ fontSize: 36, marginBottom: 8 }}>🍽️</div>
          <div>Sin registros de alimentación</div>
          <button style={css.addBtn} onClick={() => setShowModal(true)}>+ Agregar alimento</button>
        </div>
      ) : (
        <>
          <div style={css.timeline}>
            <div style={css.line} />
            {records.map((r, i) => {
              const color = dotColor(r, i);
              const isCurrent = !r.date_to;
              return (
                <div key={r.id} style={css.item}>
                  <div style={css.dot(color)} />
                  <div style={{ ...css.content, ...(isCurrent ? { borderColor: "#FF6B35", background: "#FFF0EB" } : {}) }}>
                    <div style={css.period}>{formatPeriod(r.date_from, r.date_to)}</div>
                    <div style={css.foodName}>
                      {r.food_name}
                      {isCurrent && <span style={css.badge}>actual</span>}
                    </div>
                    {r.brand && <div style={{ ...css.meta, color: "#C4845A" }}>{r.brand}</div>}
                    {r.grams_per_day && <div style={css.meta}>⚖️ {r.grams_per_day} g/día</div>}
                    {r.notes && <div style={css.notes}>{r.notes}</div>}
                  </div>
                </div>
              );
            })}
          </div>
          <button style={css.addBtn} onClick={() => setShowModal(true)}>+ Agregar período</button>
        </>
      )}

      {showModal && (
        <DietHistoryModal
          pet={pet}
          onClose={() => { setShowModal(false); loadRecords(); }}
          onSaved={() => { loadRecords(); }}
        />
      )}
    </div>
  );
}

"use client";
import { useState, useMemo } from "react";
import { logActivity } from "@/lib/activityLog";
import { formatFecha, formatFechaHora } from "@/lib/fechas";
import DrugClassLabel from "@/components/DrugClassLabel";
import {
  getScheduledDoses, getTreatmentStart, getTreatmentEnd,
  hasReliablePhases, getPhaseSchedule, doseKey,
} from "@/lib/doseSchedule";

const MOMENTOS = [
  { id: "mañana", icon: "🌅", label: "Mañana", from: 6, to: 12 },
  { id: "mediodia", icon: "☀️", label: "Mediodía", from: 12, to: 15 },
  { id: "tarde", icon: "🌆", label: "Tarde", from: 15, to: 19 },
  { id: "noche", icon: "🌙", label: "Noche", from: 19, to: 30 }, // 30 = cruza medianoche (19:00–05:59)
];
function momentoOf(date) {
  const h = date.getHours();
  return MOMENTOS.find(m => (m.to <= 24 ? h >= m.from && h < m.to : h >= m.from || h < m.to - 24)) || MOMENTOS[3];
}

const DIAS = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"]; // índice = Date.getDay()

// Clave de día en hora de Chile — NUNCA toISOString().split("T")[0]: eso da
// el día calendario en UTC, que puede quedar un día adelantado/atrasado
// cerca de medianoche en Chile (UTC-3/-4). formatFecha() sí sabe convertir
// un Date a hora de Chile, pero solo si recibe el Date real — por eso esta
// clave también se arma a mano con Intl en vez de un slice de ISO string.
function chileDayKey(date) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Santiago" }).format(date);
}

function startOfDay(d) { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; }

// ── Círculo de 3 estados: sin registro → dada → omitida → sin registro ──
function DoseCircle({ status, onClick, disabled, size = 30 }) {
  const cfg = status === "dada"
    ? { bg: "var(--green,#06D6A0)", border: "var(--green,#06D6A0)", icon: "✓", color: "#fff" }
    : status === "omitida"
    ? { bg: "var(--red,#FF4757)", border: "var(--red,#FF4757)", icon: "✕", color: "#fff" }
    : { bg: "#fff", border: "#D9C4B0", icon: "", color: "#C4845A" };
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={disabled ? "Fuera del rango del tratamiento" : status === "dada" ? "Dada — clic para marcar omitida" : status === "omitida" ? "Omitida — clic para quitar registro" : "Sin registro — clic para marcar dada"}
      style={{
        width: size, height: size, borderRadius: "50%", flexShrink: 0,
        border: `2px solid ${cfg.border}`, background: cfg.bg, color: cfg.color,
        fontSize: size * 0.5, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center",
        cursor: disabled ? "default" : "pointer", opacity: disabled ? 0.4 : 1, padding: 0,
        transition: "background 0.15s, border-color 0.15s",
      }}>
      {cfg.icon}
    </button>
  );
}

export default function DoseTracker({
  supabase, petData, items, meds, doseLogs,
  reloadMeds, reloadDoseLogs, view, setView,
}) {
  const [busyKey, setBusyKey] = useState(null);
  const [showBackfill, setShowBackfill] = useState(false);
  const [backfillBusy, setBackfillBusy] = useState(false);

  const now = new Date();
  const anyPhases = items.some(hasReliablePhases);
  const VIEWS = [
    { id: "hoy", label: "Hoy" },
    { id: "semana", label: "Semana" },
    ...(anyPhases ? [{ id: "fases", label: "Fases" }] : []),
  ];
  const activeView = view === "fases" && !anyPhases ? "hoy" : view;

  // ── Estado de una dosis a partir de doseLogs ──────────────────────
  const statusFor = (ti, date) => {
    const log = doseLogs.find(d => d.treatment_item_id === ti.id && new Date(d.scheduled_at).getTime() === date.getTime());
    return log ? log.status : null;
  };

  // ── Marcar / desmarcar una dosis (ciclo de 3 estados), con descuento
  // de stock — mismo mecanismo que reemplaza el botón genérico (Feature 4).
  const cycleDose = async (ti, date) => {
    const key = `${ti.id}-${date.getTime()}`;
    if (busyKey) return;
    setBusyKey(key);
    try {
      const prevStatus = statusFor(ti, date);
      const nextStatus = prevStatus === null ? "dada" : prevStatus === "dada" ? "omitida" : null;
      await applyDoseStatus(ti, date, prevStatus, nextStatus);
    } finally {
      setBusyKey(null);
    }
  };

  const applyDoseStatus = async (ti, date, prevStatus, nextStatus) => {
    const upd = ti.units_per_dose || 1;
    const med = meds.find(m => m.name.toLowerCase() === ti.name.toLowerCase() && m.active);
    if (med && med.stock != null) {
      if (prevStatus !== "dada" && nextStatus === "dada") {
        await supabase.from("medications").update({ stock: Math.max(0, parseFloat(med.stock) - upd) }).eq("id", med.id);
      } else if (prevStatus === "dada" && nextStatus !== "dada") {
        await supabase.from("medications").update({ stock: parseFloat(med.stock) + upd }).eq("id", med.id);
      }
    }

    const existing = doseLogs.find(d => d.treatment_item_id === ti.id && new Date(d.scheduled_at).getTime() === date.getTime());
    if (nextStatus === null) {
      if (existing) await supabase.from("dose_log").delete().eq("id", existing.id);
    } else if (existing) {
      await supabase.from("dose_log").update({ status: nextStatus, marked_at: new Date().toISOString() }).eq("id", existing.id);
    } else {
      await supabase.from("dose_log").insert({
        pet_id: petData.id, treatment_item_id: ti.id, scheduled_at: doseKey(date), status: nextStatus,
      });
    }

    if (med) await reloadMeds();
    await reloadDoseLogs();
    if (nextStatus) await logActivity(supabase, petData.id, nextStatus === "dada" ? "Marcó dosis dada" : "Marcó dosis omitida", `${ti.name} · ${formatFechaHora(date)}`);
  };

  // ── Dosis atrasadas sin registro (Feature 2) ──────────────────────
  const backlog = useMemo(() => {
    const list = [];
    items.forEach(ti => {
      const start = getTreatmentStart(ti);
      if (!start) return;
      getScheduledDoses(ti, start, now).forEach(date => {
        if (statusFor(ti, date) === null) list.push({ ti, date });
      });
    });
    return list.sort((a, b) => a.date - b.date);
  }, [items, doseLogs]);

  const applyBulk = async (status) => {
    const label = status === "dada" ? "todas como dadas" : "todas como omitidas";
    if (!confirm(`¿Marcar ${backlog.length} dosis atrasadas ${label}? Esta acción no se puede deshacer.`)) return;
    setBackfillBusy(true);
    for (const { ti, date } of backlog) {
      await applyDoseStatus(ti, date, null, status);
    }
    setBackfillBusy(false);
    setShowBackfill(false);
  };

  return (
    <div>
      {backlog.length > 0 && (
        <div style={{ background: "#FFFBEB", border: "1.5px solid #FDE68A", borderRadius: 14, padding: "12px 14px", marginBottom: 14, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
          <div style={{ fontSize: 12, color: "#92400E", fontWeight: 700 }}>
            ⏰ Tienes {backlog.length} dosis sin registrar desde el {formatFecha(chileDayKey(backlog[0].date))}
          </div>
          <button onClick={() => setShowBackfill(true)}
            style={{ background: "#F59E0B", color: "#fff", border: "none", borderRadius: 10, padding: "7px 14px", fontFamily: "'Baloo 2', cursive", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
            Ponerse al día
          </button>
        </div>
      )}

      <div style={{ display: "flex", gap: 6, marginBottom: 14 }}>
        {VIEWS.map(v => (
          <button key={v.id} onClick={() => setView(v.id)}
            style={{ flex: 1, padding: "8px 6px", borderRadius: 12, border: `1.5px solid ${activeView === v.id ? "var(--color-primary)" : "#FFD9C8"}`, background: activeView === v.id ? "var(--color-primary)" : "#fff", textAlign: "center", fontSize: 12, fontWeight: 700, color: activeView === v.id ? "#fff" : "#7A4522", cursor: "pointer" }}>
            {v.label}
          </button>
        ))}
      </div>

      {activeView === "hoy" && (
        <VistaHoy items={items} statusFor={statusFor} onCycle={cycleDose} busyKey={busyKey} now={now} />
      )}
      {activeView === "semana" && (
        <VistaSemana items={items} statusFor={statusFor} onCycle={cycleDose} busyKey={busyKey} now={now} />
      )}
      {activeView === "fases" && (
        <VistaFases items={items} statusFor={statusFor} onCycle={cycleDose} busyKey={busyKey} now={now} />
      )}

      {showBackfill && (
        <BackfillModal
          backlog={backlog}
          busy={backfillBusy}
          onApplyBulk={applyBulk}
          onApplyOne={async (ti, date, status) => { setBackfillBusy(true); await applyDoseStatus(ti, date, null, status); setBackfillBusy(false); }}
          onClose={() => setShowBackfill(false)}
        />
      )}
    </div>
  );
}

// ── VISTA A: HOY ─────────────────────────────────────────────────────
function VistaHoy({ items, statusFor, onCycle, busyKey, now }) {
  const todayStart = startOfDay(now);
  const todayEnd = new Date(todayStart.getTime() + 86400000);
  const doses = items.flatMap(ti => getScheduledDoses(ti, todayStart, todayEnd).map(date => ({ ti, date })))
    .sort((a, b) => a.date - b.date);

  if (doses.length === 0) {
    return <div className="card"><div className="empty-state"><p>Sin tomas programadas para hoy</p></div></div>;
  }

  const total = doses.length;
  const registradas = doses.filter(d => statusFor(d.ti, d.date) !== null).length;
  const pct = total > 0 ? Math.round((registradas / total) * 100) : 0;

  const grouped = MOMENTOS.map(m => ({ ...m, doses: doses.filter(d => momentoOf(d.date).id === m.id) })).filter(g => g.doses.length > 0);

  return (
    <div>
      <div style={{ marginBottom: 14 }}>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "#7A4522", fontWeight: 700, marginBottom: 4 }}>
          <span>{registradas} de {total} dosis</span>
          <span>{pct}%</span>
        </div>
        <div style={{ height: 8, borderRadius: 4, background: "#f5f3ff", overflow: "hidden" }}>
          <div style={{ height: "100%", width: `${pct}%`, background: pct === 100 ? "var(--green,#06D6A0)" : "var(--color-primary)", borderRadius: 4, transition: "width 0.3s" }} />
        </div>
      </div>

      {grouped.map(g => (
        <div key={g.id} style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#7A4522", marginBottom: 6 }}>{g.icon} {g.label}</div>
          {g.doses.map(({ ti, date }) => (
            <DoseRow key={`${ti.id}-${date.getTime()}`} ti={ti} date={date} status={statusFor(ti, date)}
              busy={busyKey === `${ti.id}-${date.getTime()}`} onCycle={() => onCycle(ti, date)} />
          ))}
        </div>
      ))}
    </div>
  );
}

function DoseRow({ ti, date, status, busy, onCycle }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, background: "#fff", borderRadius: 14, padding: "10px 14px", marginBottom: 8, boxShadow: "var(--card-shadow)" }}>
      <DoseCircle status={status} onClick={onCycle} disabled={busy} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: "#3D1F0A" }}>{ti.name}<DrugClassLabel drugClass={ti.drug_class} /></div>
        <div style={{ fontSize: 11, color: "#C4845A" }}>
          🕐 {date.toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" })}
          {ti.prescribed_dose ? ` · ${ti.prescribed_dose}` : ""}
        </div>
      </div>
    </div>
  );
}

// ── VISTA B: SEMANA ──────────────────────────────────────────────────
// Lote L2 Fix 1/2 — la grilla arranca en start_date del tratamiento (no en
// el lunes calendario, que antes mostraba días previos al inicio como puro
// ruido punteado) y navega en bloques de 7 días en vez de scroll horizontal
// (incómodo en pantallas angostas). overallStart/overallEnd son el rango
// del tratamiento COMPLETO (el más temprano/tardío entre todos los ítems),
// no de un solo medicamento — varios medicamentos de la misma receta
// comparten una sola navegación de semanas.
function VistaSemana({ items, statusFor, onCycle, busyKey, now }) {
  // Reglas de hooks: useState no puede quedar después de un return
  // condicional, así que todo lo derivado de `items` que alimenta el
  // estado inicial se calcula ANTES, con null-safety propia, y el "no hay
  // horario" se revisa recién después de declarar el hook.
  const starts = items.map(getTreatmentStart).filter(Boolean);
  const overallStart = starts.length ? new Date(Math.min(...starts.map(d => d.getTime()))) : null;

  const ends = items.map(getTreatmentEnd);
  // El tratamiento completo solo tiene fin conocido si TODOS sus ítems lo
  // tienen — si uno queda abierto (última fase sin duration_days), no se
  // puede afirmar cuándo termina el conjunto tampoco (mismo principio del
  // Fix 3: no declarar un fin que no se conoce).
  const overallEnd = overallStart && ends.every(Boolean) ? new Date(Math.max(...ends.map(d => d.getTime()))) : null;

  const weekBlockStart = (idx) => new Date(overallStart.getTime() + (idx - 1) * 7 * 86400000);
  const totalWeeks = !overallStart ? 1 : overallEnd
    ? Math.max(1, Math.ceil((overallEnd - overallStart) / (7 * 86400000)))
    : Math.max(1, Math.floor((now - overallStart) / (7 * 86400000)) + 1);

  const defaultWeek = !overallStart ? 1 : overallEnd && now >= overallEnd
    ? totalWeeks
    : Math.min(totalWeeks, Math.max(1, Math.floor((now - overallStart) / (7 * 86400000)) + 1));

  const [weekIndex, setWeekIndex] = useState(defaultWeek);

  if (!overallStart) {
    return <div className="card"><div className="empty-state"><p>Sin horario definido para este tratamiento</p></div></div>;
  }

  const clampedWeek = Math.min(Math.max(weekIndex, 1), totalWeeks);

  const weekStart = weekBlockStart(clampedWeek);
  const weekEnd = new Date(weekStart.getTime() + 7 * 86400000);
  const days = Array.from({ length: 7 }, (_, i) => new Date(weekStart.getTime() + i * 86400000));

  // Resumen del TRATAMIENTO COMPLETO (todas las semanas navegables), no
  // solo de la semana visible — Fix 2.4.
  const summaryHorizon = overallEnd || weekBlockStart(totalWeeks + 1);
  let dadas = 0, omitidas = 0, porVenir = 0;
  items.forEach(ti => {
    getScheduledDoses(ti, overallStart, summaryHorizon).forEach(d => {
      const st = statusFor(ti, d);
      if (st === "dada") dadas++;
      else if (st === "omitida") omitidas++;
      else if (d > now) porVenir++;
    });
  });

  const grids = items.map(ti => {
    const doses = getScheduledDoses(ti, weekStart, weekEnd);
    const start = getTreatmentStart(ti);
    const end = getTreatmentEnd(ti);
    const horarios = [...new Set(doses.map(d => d.toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" })))].sort();
    return { ti, horarios, doses, start, end };
  });

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <button onClick={() => setWeekIndex(w => Math.max(1, w - 1))} disabled={clampedWeek <= 1}
          style={{ background: "#fff", border: "1.5px solid #FFD9C8", borderRadius: 10, width: 32, height: 32, fontSize: 14, color: clampedWeek <= 1 ? "#E9D8FD" : "var(--color-primary)", cursor: clampedWeek <= 1 ? "default" : "pointer" }}>
          ◄
        </button>
        <div style={{ fontSize: 12, fontWeight: 700, color: "#7A4522" }}>Semana {clampedWeek} de {totalWeeks}</div>
        <button onClick={() => setWeekIndex(w => Math.min(totalWeeks, w + 1))} disabled={clampedWeek >= totalWeeks}
          style={{ background: "#fff", border: "1.5px solid #FFD9C8", borderRadius: 10, width: 32, height: 32, fontSize: 14, color: clampedWeek >= totalWeeks ? "#E9D8FD" : "var(--color-primary)", cursor: clampedWeek >= totalWeeks ? "default" : "pointer" }}>
          ►
        </button>
      </div>

      {grids.every(g => g.horarios.length === 0) ? (
        <div className="card"><div className="empty-state"><p>Sin tomas programadas esta semana</p></div></div>
      ) : grids.map(({ ti, horarios, doses, start, end }) => horarios.length > 0 && (
        <div key={ti.id} style={{ marginBottom: 18 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#3D1F0A", marginBottom: 8 }}>{ti.name}<DrugClassLabel drugClass={ti.drug_class} /></div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ borderCollapse: "collapse", width: "100%", minWidth: 420 }}>
              <thead>
                <tr>
                  <th style={{ fontSize: 10, color: "#C4845A", textAlign: "left", padding: "2px 6px" }}></th>
                  {days.map((d, i) => (
                    <th key={i} style={{ fontSize: 10, color: "#7A4522", fontWeight: 700, padding: "2px 4px", textAlign: "center" }}>
                      {DIAS[d.getDay()]}<br /><span style={{ fontWeight: 400 }}>{d.getDate()}</span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {horarios.map(hora => (
                  <tr key={hora}>
                    <td style={{ fontSize: 10, color: "#C4845A", padding: "4px 6px", whiteSpace: "nowrap" }}>{hora}</td>
                    {days.map((d, i) => {
                      const dose = doses.find(x => x.toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" }) === hora
                        && x.toDateString() === d.toDateString());
                      const outOfRange = !dose && ((start && d < startOfDay(start)) || (end && d >= end));
                      const key = dose ? `${ti.id}-${dose.getTime()}` : null;
                      return (
                        <td key={i} style={{ textAlign: "center", padding: 4 }}>
                          {dose ? (
                            <DoseCircle size={26} status={statusFor(ti, dose)} disabled={busyKey === key} onClick={() => onCycle(ti, dose)} />
                          ) : (
                            <div style={{ width: 26, height: 26, margin: "0 auto", borderRadius: "50%", border: outOfRange ? "2px dashed #E9D8FD" : "none" }} />
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
      <div style={{ fontSize: 9, color: "#C4845A", marginBottom: 4, textAlign: "center" }}>Resumen del tratamiento completo, no solo de esta semana</div>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "#7A4522", fontWeight: 700, background: "#fff", borderRadius: 10, padding: "8px 12px" }}>
        <span>✓ {dadas} dadas</span>
        <span>✕ {omitidas} omitidas</span>
        <span>⏳ {porVenir} por venir</span>
      </div>
    </div>
  );
}

// ── VISTA C: FASES ───────────────────────────────────────────────────
function VistaFases({ items, statusFor, onCycle, busyKey, now }) {
  const withPhases = items.filter(hasReliablePhases);
  if (withPhases.length === 0) {
    return <div className="card"><div className="empty-state"><p>Ningún medicamento de este tratamiento tiene un esquema por fases reconocible</p></div></div>;
  }
  return (
    <div>
      {withPhases.map(ti => {
        const schedule = getPhaseSchedule(ti);
        if (!schedule) return null;
        return (
          <div key={ti.id} style={{ marginBottom: 18 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#3D1F0A", marginBottom: 8 }}>{ti.name}<DrugClassLabel drugClass={ti.drug_class} /></div>
            {schedule.map(phase => {
              const total = phase.doses.length;
              const done = phase.doses.filter(d => statusFor(ti, d) !== null).length;
              const pct = total > 0 ? Math.round((done / total) * 100) : 0;
              const isCurrent = now >= phase.start && (phase.end ? now < phase.end : true);
              return (
                <div key={phase.index} style={{ background: "#fff", borderRadius: 14, border: `1.5px solid ${isCurrent ? "var(--color-primary)" : "#FFD9C8"}`, padding: 14, marginBottom: 10 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: isCurrent ? "var(--color-primary)" : "#7A4522" }}>
                      Fase {phase.index + 1} · cada {phase.intervalHours}h
                      {isCurrent && <span style={{ marginLeft: 6, background: "var(--color-primary)", color: "#fff", fontSize: 9, padding: "2px 6px", borderRadius: 8 }}>Actual</span>}
                    </div>
                    <div style={{ fontSize: 10, color: "#C4845A" }}>
                      {formatFecha(chileDayKey(phase.start))} – {phase.end ? formatFecha(chileDayKey(phase.end)) : "sin fin definido"}
                    </div>
                  </div>
                  {total > 0 && (
                    <>
                      <div style={{ height: 6, borderRadius: 3, background: "#f5f3ff", overflow: "hidden", marginBottom: 8 }}>
                        <div style={{ height: "100%", width: `${pct}%`, background: "var(--color-primary)", borderRadius: 3 }} />
                      </div>
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                        {phase.doses.map(date => {
                          const key = `${ti.id}-${date.getTime()}`;
                          return (
                            <div key={key} title={date.toLocaleString("es-CL")}>
                              <DoseCircle size={24} status={statusFor(ti, date)} disabled={busyKey === key} onClick={() => onCycle(ti, date)} />
                            </div>
                          );
                        })}
                      </div>
                    </>
                  )}
                  {total === 0 && <div style={{ fontSize: 11, color: "#C4845A" }}>Fase sin fecha de término definida — no se pueden generar dosis todavía</div>}
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}

// ── MODAL: PONERSE AL DÍA (Feature 2) ────────────────────────────────
function BackfillModal({ backlog, busy, onApplyBulk, onApplyOne, onClose }) {
  const byDay = {};
  backlog.forEach(({ ti, date }) => {
    const dayKey = chileDayKey(date);
    (byDay[dayKey] = byDay[dayKey] || []).push({ ti, date });
  });

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 1100, display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
      <div style={{ background: "#FFF8F3", borderRadius: "24px 24px 0 0", width: "100%", maxWidth: 480, maxHeight: "88vh", overflowY: "auto" }}>
        <div style={{ background: "linear-gradient(135deg,#F59E0B,#D97706)", padding: "16px 20px", borderRadius: "24px 24px 0 0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ fontFamily: "'Baloo 2', cursive", fontSize: 16, fontWeight: 800, color: "#fff" }}>⏰ Ponerse al día</div>
          <button onClick={onClose} style={{ background: "rgba(255,255,255,0.2)", border: "1px solid rgba(255,255,255,0.3)", borderRadius: 10, color: "#fff", fontFamily: "'Baloo 2', cursive", fontSize: 13, fontWeight: 700, padding: "6px 12px", cursor: "pointer" }}>✕ Cerrar</button>
        </div>
        <div style={{ padding: 20 }}>
          <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
            <button disabled={busy} onClick={() => onApplyBulk("dada")}
              style={{ flex: 1, padding: 12, borderRadius: 12, background: "var(--green,#06D6A0)", color: "#fff", border: "none", fontFamily: "'Baloo 2', cursive", fontSize: 13, fontWeight: 700, cursor: busy ? "default" : "pointer", opacity: busy ? 0.6 : 1 }}>
              ✓ Todas dadas
            </button>
            <button disabled={busy} onClick={() => onApplyBulk("omitida")}
              style={{ flex: 1, padding: 12, borderRadius: 12, background: "var(--red,#FF4757)", color: "#fff", border: "none", fontFamily: "'Baloo 2', cursive", fontSize: 13, fontWeight: 700, cursor: busy ? "default" : "pointer", opacity: busy ? 0.6 : 1 }}>
              ✕ Todas omitidas
            </button>
          </div>
          {Object.keys(byDay).sort().map(dayKey => (
            <div key={dayKey} style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#7A4522", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.5px" }}>{formatFecha(dayKey)}</div>
              {byDay[dayKey].map(({ ti, date }) => (
                <div key={`${ti.id}-${date.getTime()}`} style={{ display: "flex", alignItems: "center", gap: 10, background: "#fff", borderRadius: 12, padding: "8px 12px", marginBottom: 6 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: "#3D1F0A" }}>{ti.name}<DrugClassLabel drugClass={ti.drug_class} /></div>
                    <div style={{ fontSize: 10, color: "#C4845A" }}>{date.toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" })}</div>
                  </div>
                  <button disabled={busy} onClick={() => onApplyOne(ti, date, "dada")}
                    style={{ background: "#f0fdf4", border: "1.5px solid #86efac", borderRadius: 8, color: "#059669", fontSize: 14, width: 30, height: 30, cursor: busy ? "default" : "pointer" }}>✓</button>
                  <button disabled={busy} onClick={() => onApplyOne(ti, date, "omitida")}
                    style={{ background: "#fef2f2", border: "1.5px solid #fecaca", borderRadius: 8, color: "#dc2626", fontSize: 14, width: 30, height: 30, cursor: busy ? "default" : "pointer" }}>✕</button>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

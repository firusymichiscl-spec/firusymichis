"use client";
import { useState, useEffect, useRef } from "react";

const MESES_CORTOS = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];

const parseISO = (iso) => {
  if (!iso) return { d: "", m: "", y: "" };
  const [y, mm, dd] = iso.split("-");
  return { d: dd ? String(Number(dd)) : "", m: mm ? String(Number(mm)) : "", y: y || "" };
};

const daysInMonth = (year, month) => {
  if (!year || !month) return 31;
  return new Date(Number(year), Number(month), 0).getDate();
};

// Selector de fecha propio (Día / Mes / Año, en ese orden) — reemplaza
// <input type="date"> en todo el sitio. El calendario nativo usa el
// idioma del NAVEGADOR (no el de la página) para el orden día/mes/año;
// con 3 <select> propios el orden queda fijo en español chileno para
// cualquier visitante. Recibe/devuelve siempre "YYYY-MM-DD" (mismo
// contrato que el input nativo).
//
// Guarda día/mes/año en estado LOCAL (no solo derivado de `value`): si
// se derivara siempre del ISO completo, elegir el día antes que el mes
// y el año haría que la fecha quedara "incompleta" y el componente se
// reseteaba entero, borrando la selección a medio hacer. `lastEmittedRef`
// evita que el efecto de resincronización pise una selección local en
// progreso cada vez que el padre simplemente hace eco del mismo valor
// que acabamos de emitir — solo resincroniza cuando `value` cambia por
// una razón EXTERNA de verdad (reset de formulario, cargar otro registro).
export default function DateInputCL({ value, onChange, min, max, style }) {
  const initial = parseISO(value);
  const [d, setD] = useState(initial.d);
  const [m, setM] = useState(initial.m);
  const [y, setY] = useState(initial.y);
  const lastEmittedRef = useRef(value ?? "");

  useEffect(() => {
    if (value === lastEmittedRef.current) return; // eco de nuestro propio cambio
    const parsed = parseISO(value); // cambio externo real
    setD(parsed.d); setM(parsed.m); setY(parsed.y);
    lastEmittedRef.current = value ?? "";
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const minY = min ? Number(min.split("-")[0]) : new Date().getFullYear() - 30;
  const maxY = max ? Number(max.split("-")[0]) : new Date().getFullYear();
  const years = [];
  for (let yr = maxY; yr >= minY; yr--) years.push(yr);

  const maxDay = daysInMonth(y, m);
  const days = Array.from({ length: maxDay }, (_, i) => i + 1);

  const handlePick = (nd, nm, ny) => {
    setD(nd); setM(nm); setY(ny);
    let out = "";
    if (nd && nm && ny) {
      const clampedDay = Math.min(Number(nd), daysInMonth(ny, nm));
      out = `${ny}-${String(nm).padStart(2, "0")}-${String(clampedDay).padStart(2, "0")}`;
    }
    lastEmittedRef.current = out;
    onChange(out);
  };

  const selStyle = { ...style, width: "auto", minWidth: 0 };

  return (
    <div style={{ display: "flex", gap: 6 }}>
      <select style={{ ...selStyle, flex: 0.8 }} value={d} onChange={e => handlePick(e.target.value, m, y)}>
        <option value="">Día</option>
        {days.map(n => <option key={n} value={n}>{n}</option>)}
      </select>
      <select style={{ ...selStyle, flex: 1.3 }} value={m} onChange={e => handlePick(d, e.target.value, y)}>
        <option value="">Mes</option>
        {MESES_CORTOS.map((label, i) => <option key={i} value={i + 1}>{label}</option>)}
      </select>
      <select style={{ ...selStyle, flex: 1 }} value={y} onChange={e => handlePick(d, m, e.target.value)}>
        <option value="">Año</option>
        {years.map(yr => <option key={yr} value={yr}>{yr}</option>)}
      </select>
    </div>
  );
}

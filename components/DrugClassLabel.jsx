// Clase farmacológica entre paréntesis, en texto más tenue que el nombre
// del medicamento — nunca paréntesis vacíos si el campo no está seteado
// (Lote L2 Feature 5.5). Sin "use client": es puramente presentacional,
// se usa tanto desde componentes cliente como desde la ficha pública QR
// (server component).
export default function DrugClassLabel({ drugClass, style }) {
  if (!drugClass) return null;
  return <span style={{ fontWeight: 400, color: "#C4845A", ...style }}> ({drugClass})</span>;
}

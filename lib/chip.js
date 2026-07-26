// Utilidades para el número de chip (microchip) de la mascota.
// Estándar ISO 11784/11785: 15 dígitos numéricos. Los 3 primeros son el
// código de país/fabricante certificado por ICAR (Chile = 152). Chips
// pre-1996 (no ISO) suelen tener 9 o 10 dígitos, a veces con letras.

// Filtra la entrada a solo dígitos, máximo 15 — usar en onChange (cubre
// también pegado, ya que el evento de paste dispara onChange igual).
export function filterChipInput(raw) {
  return (raw || "").replace(/\D/g, "").slice(0, 15);
}

// Validación informativa, nunca bloqueante: el chip es opcional y nunca debe
// impedir guardar. Retorna null si no hay nada que avisar.
export function chipValidationMessage(digits) {
  if (!digits) return null;
  const len = digits.length;
  if (len === 15) {
    const isChile = digits.startsWith("152");
    return { level: "ok", text: `✓ Formato ISO válido${isChile ? " · Chile" : ""}` };
  }
  if (len === 9 || len === 10) {
    return { level: "warn", text: "Parece un chip antiguo (no ISO). Los chips actuales tienen 15 dígitos." };
  }
  return { level: "warn", text: "Un chip ISO tiene 15 dígitos. Verifica el número." };
}

// Formato de lectura agrupado 3-3-9 ("152 098 101234567"). El valor
// guardado en la DB sigue siendo los 15 dígitos sin espacios; si no tiene
// exactamente 15 dígitos se muestra tal cual, sin agrupar.
export function formatChipDisplay(chip) {
  if (!chip) return chip;
  const digits = chip.replace(/\D/g, "");
  if (digits.length !== 15) return chip;
  return `${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6)}`;
}

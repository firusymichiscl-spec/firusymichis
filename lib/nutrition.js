// Cálculo referencial de ración diaria (fórmula veterinaria estándar RER/MER).
// RER = 70 * peso_kg^0.75 (kcal/día en reposo)
// MER = RER * factor según etapa/especie

const DENSIDAD_DEFAULT_KCAL_KG = 3500;

// Lote R2 — rangos duros de peso por especie (kg). Capa adicional a la
// advertencia de desviación >50% (que se mantiene tal cual, para valores
// DENTRO del rango — un gato de 12kg es obeso pero posible). Esto bloquea
// directamente valores imposibles como 112kg para un perro (error de
// tipeo real que motivó esto) o gramos escritos como si fueran kilos
// (el mínimo es tan importante como el máximo para ese caso).
export const WEIGHT_RANGES = {
  dog: { min: 0.2, max: 120 },
  cat: { min: 0.1, max: 15 },
  other: { min: 0.05, max: 120 },
};

const SPECIES_LABEL = { dog: "un perro", cat: "un gato", other: "esta mascota" };

// Chile usa coma decimal ("0,1" no "0.1") — los límites son números fijos
// acá arriba, no input de usuario, así que un replace simple alcanza.
const formatKg = (n) => String(n).replace(".", ",");

// Devuelve { valid, message } — nunca lanza. weightKg puede venir como
// string (value crudo de un <input>) o number; se parsea acá para que
// cada call site no tenga que repetir el parseFloat + isNaN.
export function validateWeightRange(weightKg, species) {
  const val = typeof weightKg === "string" ? parseFloat(weightKg.replace(",", ".")) : weightKg;
  const range = WEIGHT_RANGES[species] || WEIGHT_RANGES.other;
  if (val == null || isNaN(val) || val < range.min || val > range.max) {
    return {
      valid: false,
      message: `El peso de ${SPECIES_LABEL[species] || "esta mascota"} debe estar entre ${formatKg(range.min)} y ${formatKg(range.max)} kg. Verifica el valor.`,
    };
  }
  return { valid: true, message: null };
}

function factorPerro({ edadMeses, esterilizado, supuestos }) {
  if (edadMeses < 4) return 3.0;
  if (edadMeses < 12) return 2.0;
  if (edadMeses > 84) return 1.4; // senior > 7 años
  if (esterilizado === true) return 1.6;
  if (esterilizado === false) return 1.8;
  supuestos.push("se asumió esterilizado");
  return 1.6;
}

function factorGato({ edadMeses, esterilizado, supuestos }) {
  if (edadMeses < 4) return 2.5;
  if (edadMeses < 12) return 2.0;
  if (edadMeses > 120) return 1.1; // senior > 10 años
  if (esterilizado === true) return 1.2;
  if (esterilizado === false) return 1.4;
  supuestos.push("se asumió esterilizado");
  return 1.2;
}

export function sugerirRacion({ pesoKg, edadMeses, especie, esterilizado, kcalPorKg }) {
  if (!pesoKg || pesoKg <= 0 || edadMeses == null || edadMeses < 0) return null;
  if (especie !== "dog" && especie !== "cat") return null;

  const supuestos = [];
  const rer = 70 * Math.pow(pesoKg, 0.75);
  const factor = especie === "cat"
    ? factorGato({ edadMeses, esterilizado, supuestos })
    : factorPerro({ edadMeses, esterilizado, supuestos });
  const mer = rer * factor;

  const densidad = kcalPorKg || DENSIDAD_DEFAULT_KCAL_KG;
  if (!kcalPorKg) supuestos.push(`densidad estimada ${DENSIDAD_DEFAULT_KCAL_KG} kcal/kg (alimento seco premium)`);

  const gramosDia = Math.round((mer / densidad) * 1000);

  return { gramosDia, rer: Math.round(rer), mer: Math.round(mer), supuestos };
}

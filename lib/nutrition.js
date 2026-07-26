// Cálculo referencial de ración diaria (fórmula veterinaria estándar RER/MER).
// RER = 70 * peso_kg^0.75 (kcal/día en reposo)
// MER = RER * factor según etapa/especie

const DENSIDAD_DEFAULT_KCAL_KG = 3500;

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

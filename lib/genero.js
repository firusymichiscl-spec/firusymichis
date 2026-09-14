// Concordancia de género para palabras que dependen del sexo de la
// mascota (adoptada/adoptado, rescatada/rescatado). "unknown" usa la
// forma masculina por defecto (uso genérico estándar en español).
export function generoPalabra(sex, femenino, masculino) {
  return sex === "female" ? femenino : masculino;
}

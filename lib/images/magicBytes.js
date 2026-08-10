// Detección de tipo de imagen por firma real de bytes (magic bytes) — no
// por el mediaType que declara el cliente, que es solo un string cualquiera
// que llega en el body del request (Lote K2, auditoría de seguridad).
//
// Solo se decodifica un prefijo del base64, no el payload completo — todas
// las firmas caben en los primeros 12 bytes reales.
const SIGNATURES = [
  { mediaType: "image/jpeg", check: (b) => b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  { mediaType: "image/png", check: (b) => b.length >= 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 && b[4] === 0x0d && b[5] === 0x0a && b[6] === 0x1a && b[7] === 0x0a },
  {
    mediaType: "image/webp",
    check: (b) => b.length >= 12
      && b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 // "RIFF"
      && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50, // "WEBP"
  },
];

// Devuelve el media type real detectado por bytes ("image/jpeg", "image/png",
// "image/webp"), o null si el base64 es inválido o no calza con ninguna de
// las 3 firmas soportadas.
export function detectImageMediaType(base64) {
  if (!base64 || typeof base64 !== "string") return null;
  let bytes;
  try {
    bytes = Buffer.from(base64.slice(0, 32), "base64");
  } catch {
    return null;
  }
  const match = SIGNATURES.find(sig => sig.check(bytes));
  return match?.mediaType || null;
}

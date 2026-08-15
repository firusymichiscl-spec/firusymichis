import type { NextConfig } from "next";

// Cabeceras de seguridad (Lote K2). Dominios externos reales que usa la app
// (auditados por código, no adivinados):
// - fonts.googleapis.com / fonts.gstatic.com: Google Fonts (Baloo 2, Nunito)
//   vía @import/<link> en casi todos los componentes.
// - maps.googleapis.com: SDK de Google Maps/Places (VetMapTab.jsx,
//   TutorTab.jsx) + el proxy server-side app/api/places/route.js.
// - places.googleapis.com: llamadas RPC que hace el propio elemento
//   <gmp-place-autocomplete> (TutorTab.jsx) contra la Places API nueva
//   (google.maps.places.v1.Places/Autocomplete) — es un dominio DISTINTO
//   de maps.googleapis.com, no cubierto por ese. Sin esto el autocompletado
//   de direcciones fallaba en producción con "violates connect-src" /
//   "network request error" (Fix post-CSP, detectado en producción).
//   Se agrega solo este dominio especifico, no un comodín *.googleapis.com:
//   es el unico que la consola señaló como bloqueado, y sumar un comodín
//   ampliaria la superficie a cualquier servicio de Google (Analytics,
//   Drive, etc.) sin que la app use ninguno de ellos hoy.
// - maps.gstatic.com: tiles/íconos que sirve el propio widget de Maps.
// - *.supabase.co: fotos de mascotas y de recetas (Supabase Storage).
// - api.qrserver.com: generación del QR en QRShareModal.jsx.
// Anthropic y Resend son server-side (Node llamándolos, nunca el
// navegador) — no necesitan estar en esta CSP, que solo gobierna qué puede
// cargar/ejecutar el navegador.
//
// Chart.js y @react-pdf/renderer no necesitan reglas propias: Chart.js se
// importa como paquete npm (queda en el bundle propio, 'self') y renderiza
// a <canvas>; @react-pdf/renderer corre 100% en el servidor generando un
// PDF, nunca se ejecuta en el navegador.
//
// 'unsafe-inline' en script-src NO es por Google Maps — es por Next.js
// mismo. Probado en vivo con Playwright sin 'unsafe-inline': CADA página,
// incluidas /login y /privacidad que ni cargan Maps, tiraba "Executing
// inline script violates... script-src" sobre 2 scripts inline que el
// propio Next.js inyecta en producción (bootstrap/hidratación), y la app
// directamente no hidrataba (React error #412 — la página quedaba muerta).
// Evitarlo exige pasar a CSP con nonce por request (agregar middleware.ts
// que genere un nonce distinto en cada response y lo pase a next/script) —
// cambio de arquitectura más grande que no se hizo acá sin decidirlo con
// el equipo. Con 'unsafe-inline' puesto, Google Maps + PlaceAutocomplete
// cargaron y funcionaron sin ningún otro ajuste (no hizo falta relajar
// nada más por Maps específicamente).
const CSP_SHARED = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' https://maps.googleapis.com",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com",
  "img-src 'self' data: blob: https://*.supabase.co https://maps.gstatic.com https://maps.googleapis.com https://api.qrserver.com",
  "connect-src 'self' https://*.supabase.co https://maps.googleapis.com https://places.googleapis.com",
  "base-uri 'self'",
  "form-action 'self'",
];

const CSP_DEFAULT = [...CSP_SHARED, "frame-ancestors 'none'"].join("; ");

// /ficha/[token] es el perfil público por QR — se deja abierta la puerta a
// que una veterinaria lo embeba en su propio sitio algún día. X-Frame-Options
// no soporta una lista de orígenes (solo DENY/SAMEORIGIN), así que en esta
// ruta se omite del todo y se deja que mande frame-ancestors de la CSP —
// los navegadores modernos priorizan CSP por sobre X-Frame-Options cuando
// ambas están presentes, pero mejor no dejar las dos contradiciéndose.
const CSP_FICHA_PUBLICA = [...CSP_SHARED, "frame-ancestors 'self' https:"].join("; ");

const HSTS = "max-age=31536000; includeSubDomains"; // sin preload — decisión explícita, ver auditoría

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        // Todo excepto /ficha/* — regex path matching de Next.js, no un
        // catch-all + override (evita que X-Frame-Options: DENY quede
        // seteado a la vez que frame-ancestors 'self' https: en la misma
        // respuesta de /ficha).
        source: "/:path((?!ficha).*)",
        headers: [
          { key: "Content-Security-Policy", value: CSP_DEFAULT },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Strict-Transport-Security", value: HSTS },
        ],
      },
      {
        source: "/ficha/:token*",
        headers: [
          { key: "Content-Security-Policy", value: CSP_FICHA_PUBLICA },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Strict-Transport-Security", value: HSTS },
        ],
      },
    ];
  },
};

export default nextConfig;

// Fondos decorativos del header de la ficha (feature PRO, Lote J).
//
// Todo se genera por código como SVG data-URI — sin archivos de imagen ni
// servicios externos. Los 7 patrones/ilustrados son SIEMPRE formas blancas
// a opacidad baja SOBRE el color del tema (nunca lo reemplazan): el color
// de base sigue siendo var(--color-primary), así que funcionan igual con
// los 8 temas, incluido "nocturno". "aurora" es la única excepción: es un
// degradado, no un patrón, así que no tiene una "opacidad baja" que lo haga
// seguro por construcción — su fórmula de contraste está explicada abajo.
//
// El identificador guardado en pets.header_background es la clave de este
// objeto (ej. "huellas"), nunca una URL.

function svgUrl(svg) {
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
}

// ── Patrones tileables (blanco sobre el tema, opacidad 0.05–0.12) ──────

const huellasSvg = `<svg xmlns='http://www.w3.org/2000/svg' width='110' height='110' viewBox='0 0 110 110'>
  <g fill='#ffffff' opacity='0.1' transform='rotate(35 55 55)'>
    <ellipse cx='55' cy='70' rx='15' ry='12'/>
    <ellipse cx='38' cy='51' rx='6.5' ry='8.5'/>
    <ellipse cx='51' cy='41' rx='6.5' ry='8.5'/>
    <ellipse cx='66' cy='43' rx='6.5' ry='8.5'/>
    <ellipse cx='76' cy='55' rx='5.5' ry='7.5'/>
  </g>
</svg>`;

const geometricoSvg = `<svg xmlns='http://www.w3.org/2000/svg' width='140' height='140' viewBox='0 0 140 140'>
  <g fill='#ffffff'>
    <polygon points='10,10 70,30 30,80' opacity='0.06'/>
    <polygon points='70,30 130,10 110,70' opacity='0.1'/>
    <polygon points='30,80 70,30 110,70' opacity='0.05'/>
    <polygon points='10,90 60,110 20,140' opacity='0.08'/>
    <polygon points='60,110 130,100 100,140' opacity='0.06'/>
  </g>
</svg>`;

const puntosSvg = `<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160' viewBox='0 0 160 160'>
  <defs><filter id='b' x='-50%' y='-50%' width='200%' height='200%'><feGaussianBlur stdDeviation='4'/></filter></defs>
  <g fill='#ffffff' filter='url(#b)'>
    <circle cx='30' cy='40' r='18' opacity='0.07'/>
    <circle cx='114' cy='28' r='10' opacity='0.1'/>
    <circle cx='132' cy='112' r='22' opacity='0.05'/>
    <circle cx='48' cy='122' r='12' opacity='0.09'/>
    <circle cx='90' cy='78' r='7' opacity='0.11'/>
  </g>
</svg>`;

const ondasSvg = `<svg xmlns='http://www.w3.org/2000/svg' width='200' height='80' viewBox='0 0 200 80'>
  <g fill='none' stroke='#ffffff' stroke-width='2'>
    <path d='M0,20 Q25,10 50,20 T100,20 T150,20 T200,20' opacity='0.1'/>
    <path d='M0,42 Q25,32 50,42 T100,42 T150,42 T200,42' opacity='0.06'/>
    <path d='M0,64 Q25,54 50,64 T100,64 T150,64 T200,64' opacity='0.08'/>
  </g>
</svg>`;

// ── Ilustrados (siluetas suaves en la base, opacidad 0.08–0.15) ────────

const bosqueSvg = `<svg xmlns='http://www.w3.org/2000/svg' width='180' height='90' viewBox='0 0 180 90'>
  <g fill='#ffffff' opacity='0.12'>
    <polygon points='30,90 30,66 40,66 30,50 38,50 30,36 20,36 12,50 20,50 10,66 20,66'/>
    <rect x='27' y='66' width='6' height='10'/>
    <polygon points='110,90 110,60 122,60 110,42 120,42 110,26 98,26 88,42 98,42 86,60 98,60'/>
    <rect x='106' y='60' width='8' height='12'/>
    <polygon points='160,90 160,70 168,70 160,58 166,58 160,48 152,48 146,58 152,58 144,70 152,70'/>
    <rect x='157' y='70' width='6' height='8'/>
  </g>
</svg>`;

const ciudadSvg = `<svg xmlns='http://www.w3.org/2000/svg' width='200' height='80' viewBox='0 0 200 80'>
  <g fill='#ffffff' opacity='0.1'>
    <rect x='10' y='40' width='24' height='40'/>
    <rect x='40' y='25' width='18' height='55'/>
    <rect x='64' y='50' width='20' height='30'/>
    <rect x='90' y='15' width='16' height='65'/>
    <rect x='96' y='9' width='4' height='8'/>
    <rect x='112' y='45' width='22' height='35'/>
    <rect x='140' y='30' width='18' height='50'/>
    <rect x='164' y='55' width='24' height='25'/>
  </g>
</svg>`;

const montanasSvg = `<svg xmlns='http://www.w3.org/2000/svg' width='220' height='90' viewBox='0 0 220 90'>
  <g fill='#ffffff' opacity='0.12'>
    <polygon points='0,90 30,30 55,60 80,15 110,55 135,25 160,60 190,35 220,90'/>
  </g>
</svg>`;

// ── Aurora (degradado, sin patrón encima) ───────────────────────────────
//
// No es un patrón disperso a baja opacidad, así que no es "seguro por
// construcción" como los de arriba — es un degradado que cubre todo el
// header, exactamente donde va el texto blanco (nombre, badges, tabs). Se
// midió el contraste real (fórmula WCAG) antes de fijar los porcentajes:
//
//   base (var(--color-primary) sólido, el fondo actual sin ningún fondo
//   elegido) ya da entre 2.84:1 (tema "clasico") y 6.93:1 (tema "felino")
//   contra texto blanco — ese es el piso que ya acepta la app hoy.
//
//   Usar var(--color-accent) tal cual para la esquina "clara" se probó y
//   da 1.10–1.44:1 en 7 de los 8 temas (el accent es un pastel casi blanco,
//   pensado para chips sobre fondo claro, no para ir detrás de texto
//   blanco) — así que NO se usa acá.
//
//   La fórmula final solo aclara/oscurece var(--color-primary) con
//   color-mix() (funciona igual con el color "custom" que elige el
//   usuario, no solo con los 8 temas fijos):
//     - esquina clara: primary + 12% blanco  → peor caso medido 2.53:1
//       (tema "clasico"), el resto entre 3.11 y 5.22:1.
//     - base/esquina oscura: primary + 28–30% negro → 5.3–10.6:1 siempre.
//   Un toque de var(--color-secondary) a opacidad baja (color-mix con
//   transparent) da la variación "multicolor" cerca del avatar (zona sin
//   texto encima), sin tocar el fondo detrás del email/badges/tabs.
const auroraStyle = {
  backgroundColor: "var(--color-primary)",
  backgroundImage: [
    "radial-gradient(circle at 15% 95%, color-mix(in srgb, var(--color-secondary) 30%, transparent) 0%, transparent 45%)",
    "radial-gradient(circle at 78% -15%, color-mix(in srgb, var(--color-primary) 88%, white 12%) 0%, transparent 55%)",
    "linear-gradient(165deg, var(--color-primary) 0%, color-mix(in srgb, var(--color-primary) 72%, black 28%) 100%)",
  ].join(", "),
  backgroundRepeat: "no-repeat",
};

function patternStyle(svg, size) {
  return {
    backgroundColor: "var(--color-primary)",
    backgroundImage: svgUrl(svg),
    backgroundRepeat: "repeat",
    backgroundSize: size,
  };
}

function baseStripStyle(svg, size) {
  return {
    backgroundColor: "var(--color-primary)",
    backgroundImage: svgUrl(svg),
    backgroundRepeat: "repeat-x",
    backgroundPosition: "bottom",
    backgroundSize: size,
  };
}

export const FONDOS = {
  huellas:   { label: "Huellas",     group: "patron",    style: patternStyle(huellasSvg, "90px 90px") },
  geometrico:{ label: "Geométrico",  group: "patron",    style: patternStyle(geometricoSvg, "110px 110px") },
  puntos:    { label: "Puntos",      group: "patron",    style: patternStyle(puntosSvg, "130px 130px") },
  ondas:     { label: "Ondas",       group: "patron",    style: patternStyle(ondasSvg, "160px 64px") },
  bosque:    { label: "Bosque",      group: "ilustrado", style: baseStripStyle(bosqueSvg, "180px 90px") },
  ciudad:    { label: "Ciudad",      group: "ilustrado", style: baseStripStyle(ciudadSvg, "200px 80px") },
  montanas:  { label: "Montañas",    group: "ilustrado", style: baseStripStyle(montanasSvg, "220px 90px") },
  aurora:    { label: "Aurora",      group: "degradado", style: auroraStyle },
};

// Devuelve el style object listo para spread sobre el header. `{}` (sin
// cambios) si no hay fondo elegido — deja el CSS por defecto de .header tal
// cual (color plano del tema).
export function getHeaderBackgroundStyle(key) {
  return (key && FONDOS[key]?.style) || {};
}

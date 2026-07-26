"use client";

// Helper reutilizable para señalar un campo obligatorio vacío al intentar
// avanzar/guardar: shake horizontal + borde rojo que se desvanece + scroll
// suave + foco. No deshabilita el botón de guardar — es más claro disparar
// esta señal que dejar un botón muerto sin explicación.

function prefersReducedMotion() {
  if (typeof window === "undefined") return false;
  return window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches ?? false;
}

// Sacude ~400ms (3 oscilaciones de 6px), pone un borde rojo 2px que se
// desvanece en ~2s, hace scroll suave al centro y enfoca el campo.
export function flashRequiredField(fieldOrId) {
  const el = typeof fieldOrId === "string" ? document.getElementById(fieldOrId) : fieldOrId;
  if (!el) return;

  const reduced = prefersReducedMotion();

  el.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "center" });
  el.focus?.({ preventScroll: true });

  const prevOutline = el.style.outline;
  const prevOutlineOffset = el.style.outlineOffset;
  const prevTransition = el.style.transition;

  el.style.transition = reduced ? "none" : "outline-color 2s ease";
  el.style.outline = "2px solid #dc2626";
  el.style.outlineOffset = "1px";

  if (reduced) {
    setTimeout(() => { el.style.outlineColor = "transparent"; }, 2000);
  } else {
    if (el.animate) {
      el.animate(
        [
          { transform: "translateX(0)" },
          { transform: "translateX(-6px)" },
          { transform: "translateX(6px)" },
          { transform: "translateX(-6px)" },
          { transform: "translateX(6px)" },
          { transform: "translateX(-6px)" },
          { transform: "translateX(6px)" },
          { transform: "translateX(0)" },
        ],
        { duration: 400, easing: "ease-in-out" }
      );
    }
    // Doble rAF para asegurar que el navegador pinte el rojo antes de animar a transparente.
    requestAnimationFrame(() => {
      requestAnimationFrame(() => { el.style.outlineColor = "transparent"; });
    });
  }

  setTimeout(() => {
    el.style.outline = prevOutline;
    el.style.outlineOffset = prevOutlineOffset;
    el.style.transition = prevTransition;
  }, 2200);
}

// Recorre campos requeridos en orden { valid, id, message, onInvalid } y, en el
// primero inválido, dispara flashRequiredField + onInvalid(message) (para que
// el formulario muestre el mensaje bajo el campo). Retorna true si todos son
// válidos (nada que hacer).
export function validateRequired(fields) {
  for (const f of fields) {
    if (!f.valid) {
      f.onInvalid?.(f.message || "Este campo es obligatorio");
      flashRequiredField(f.id);
      return false;
    }
  }
  return true;
}

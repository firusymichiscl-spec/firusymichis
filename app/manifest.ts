import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Firus & Michis",
    short_name: "Firus&Michis",
    description:
      "Controla medicamentos, vacunas e historial médico de tus perros y gatos, con recordatorios automáticos y asistente veterinario con IA.",
    start_url: "/",
    display: "standalone",
    background_color: "#FFF8F3",
    theme_color: "#FF6B35",
    lang: "es-CL",
    icons: [
      {
        src: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
      },
    ],
  };
}

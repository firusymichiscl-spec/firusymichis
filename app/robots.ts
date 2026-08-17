import type { MetadataRoute } from "next";

const SITE_URL = "https://www.firusymichis.cl";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/dashboard",
        "/api",
        "/pago",
        "/nueva-mascota",
        "/medicamentos",
        "/marketplace",
        "/ficha",
        "/auth",
      ],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}

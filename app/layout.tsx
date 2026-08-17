import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const SITE_URL = "https://www.firusymichis.cl";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Firus & Michis — Salud y medicamentos de tu mascota en un solo lugar",
    template: "%s · Firus & Michis",
  },
  description:
    "Controla medicamentos, vacunas e historial médico de tus perros y gatos. Recordatorios automáticos y asistente veterinario con IA. Prueba 1 mes gratis.",
  keywords: [
    "salud mascotas",
    "recordatorio medicamentos perro",
    "recordatorio medicamentos gato",
    "carnet de vacunas gato",
    "carnet de vacunas perro",
    "ficha veterinaria",
    "control de medicamentos mascotas",
    "historial médico mascota",
    "app veterinaria Chile",
    "asistente veterinario IA",
  ],
  authors: [{ name: "GO COMPUTACIÓN SpA" }],
  creator: "GO COMPUTACIÓN SpA",
  openGraph: {
    type: "website",
    locale: "es_CL",
    url: SITE_URL,
    siteName: "Firus & Michis",
    title: "Firus & Michis — Salud y medicamentos de tu mascota en un solo lugar",
    description:
      "Controla medicamentos, vacunas e historial médico de tus perros y gatos. Recordatorios automáticos y asistente veterinario con IA. Prueba 1 mes gratis.",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "Firus & Michis — app para controlar medicamentos, vacunas e historial médico de tu mascota",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Firus & Michis — Salud y medicamentos de tu mascota en un solo lugar",
    description:
      "Controla medicamentos, vacunas e historial médico de tus perros y gatos. Recordatorios automáticos y asistente veterinario con IA. Prueba 1 mes gratis.",
    images: ["/og-image.png"],
  },
  icons: {
    // apple-touch-icon se declara explícito pese a existir app/apple-icon.png
    // (convención de archivo): verificado en build que Next 16.3/Turbopack
    // sirve esa ruta pero NO inyecta el <link rel="apple-touch-icon"> solo
    // por la convención — sin esta entrada el tag no aparece en el <head>.
    icon: [
      { url: "/favicon-16.png", sizes: "16x16", type: "image/png" },
      { url: "/favicon-32.png", sizes: "32x32", type: "image/png" },
    ],
    shortcut: "/favicon.ico",
    apple: "/apple-icon.png",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
    },
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="es-CL"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}

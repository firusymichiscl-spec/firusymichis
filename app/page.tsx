import { redirect } from "next/navigation";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import Link from "next/link";

const FEATURES = [
  { icon: "💊", title: "Control de medicamentos", desc: "Dosis, horarios y stock de cada tratamiento, sin olvidos." },
  { icon: "💉", title: "Vacunas al día", desc: "Recordatorios automáticos antes de que venza cada vacuna." },
  { icon: "🤖", title: "Asistente IA veterinario", desc: "Preguntas sobre síntomas, recetas y dosis con respaldo de IA." },
  { icon: "📋", title: "Historial médico", desc: "Cirugías, exámenes y consultas, todo ordenado y accesible." },
  { icon: "📍", title: "Veterinarias cercanas", desc: "Encuentra clínicas cerca de ti cuando las necesites." },
  { icon: "📱", title: "Perfil compartible QR", desc: "Comparte la ficha de tu mascota con un código QR." },
];

const css = `
  @import url('https://fonts.googleapis.com/css2?family=Baloo+2:wght@400;600;700;800&family=Nunito:ital,wght@0,400;0,600;0,700;1,400&display=swap');
  *{box-sizing:border-box;}
  .lp{font-family:'Nunito',sans-serif;background:#FFF8F3;color:#3D1F0A;}
  .lp-nav{position:sticky;top:0;z-index:50;background:rgba(255,248,243,0.92);backdrop-filter:blur(8px);border-bottom:1px solid #FFE4D6;display:flex;align-items:center;justify-content:space-between;padding:16px 24px;}
  .lp-logo{font-family:'Baloo 2',cursive;font-size:20px;font-weight:800;color:#3D1F0A;}
  .lp-logo span{color:#FFD166;}
  .lp-nav-links{display:flex;align-items:center;gap:28px;}
  .lp-nav-link{font-size:14px;font-weight:700;color:#7A4522;text-decoration:none;}
  .lp-nav-link:hover{color:#FF6B35;}
  .lp-nav-actions{display:flex;align-items:center;gap:10px;}
  .lp-btn-ghost{padding:9px 18px;border-radius:12px;border:1.5px solid #FFD0BC;background:#fff;color:#FF6B35;font-family:'Baloo 2',cursive;font-size:14px;font-weight:700;text-decoration:none;}
  .lp-btn-solid{padding:9px 18px;border-radius:12px;border:none;background:linear-gradient(135deg,#FF6B35,#e85d2e);color:#fff;font-family:'Baloo 2',cursive;font-size:14px;font-weight:700;text-decoration:none;box-shadow:0 4px 14px rgba(255,107,53,0.3);}
  .lp-hero{max-width:760px;margin:0 auto;padding:72px 24px 56px;text-align:center;}
  .lp-badge{display:inline-flex;align-items:center;gap:6px;background:#FFF0EB;border:1.5px solid #FFD0BC;color:#CC4A1A;font-size:13px;font-weight:700;padding:6px 16px;border-radius:20px;margin-bottom:24px;}
  .lp-title{font-family:'Baloo 2',cursive;font-size:44px;font-weight:800;line-height:1.15;color:#3D1F0A;margin-bottom:18px;}
  .lp-title .accent{color:#FF6B35;}
  .lp-sub{font-size:17px;color:#7A4522;line-height:1.6;margin-bottom:32px;}
  .lp-cta-row{display:flex;align-items:center;justify-content:center;gap:14px;flex-wrap:wrap;margin-bottom:28px;}
  .lp-cta-main{padding:15px 30px;border-radius:14px;border:none;background:linear-gradient(135deg,#FF6B35,#e85d2e);color:#fff;font-family:'Baloo 2',cursive;font-size:16px;font-weight:700;text-decoration:none;box-shadow:0 8px 24px rgba(255,107,53,0.35);transition:background 0.2s ease, transform 0.15s ease;}
  .lp-cta-main:active{background:linear-gradient(135deg,#e85d2e,#c94a20);transform:scale(0.97);}
  .lp-cta-sec{padding:15px 24px;border-radius:14px;border:1.5px solid #FFD9C8;background:#fff;color:#3D1F0A;font-family:'Baloo 2',cursive;font-size:15px;font-weight:700;text-decoration:none;transition:background 0.2s ease, border-color 0.2s ease, transform 0.15s ease;}
  .lp-cta-sec:active{background:#FFF0EB;border-color:#FF6B35;transform:scale(0.97);}
  .lp-chips{display:flex;flex-wrap:wrap;align-items:center;justify-content:center;gap:8px;margin-bottom:20px;}
  .lp-chip{background:#fff;border:1.5px solid #FFE4D6;border-radius:20px;padding:6px 14px;font-size:13px;font-weight:700;color:#7A4522;}
  .lp-note{font-size:12px;color:#B08968;}
  .lp-section{max-width:1080px;margin:0 auto;padding:56px 24px;}
  .lp-section-title{font-family:'Baloo 2',cursive;font-size:28px;font-weight:800;color:#3D1F0A;text-align:center;margin-bottom:8px;}
  .lp-section-sub{font-size:14px;color:#7A4522;text-align:center;margin-bottom:40px;}
  .lp-shot{position:absolute;top:16px;left:16px;right:16px;bottom:16px;width:calc(100% - 32px);height:calc(100% - 32px);object-fit:contain;opacity:0;animation:lpshotcycle 15s infinite;}
  @keyframes lpshotcycle{0%{opacity:0;transform:translateY(8px)}4%{opacity:1;transform:translateY(0)}16%{opacity:1}20%{opacity:0;transform:translateY(-8px)}100%{opacity:0}}
  .lp-shot-1{animation-delay:0s}
  .lp-shot-2{animation-delay:-3s}
  .lp-shot-3{animation-delay:-6s}
  .lp-shot-4{animation-delay:-9s}
  .lp-shot-5{animation-delay:-12s}
  .lp-features-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:20px;}
  .lp-feature-card{background:#fff;border-radius:18px;padding:26px 22px;box-shadow:0 2px 12px rgba(61,31,10,0.06);}
  .lp-feature-icon{font-size:32px;margin-bottom:14px;}
  .lp-feature-title{font-family:'Baloo 2',cursive;font-size:16px;font-weight:700;color:#3D1F0A;margin-bottom:6px;}
  .lp-feature-desc{font-size:13.5px;color:#7A4522;line-height:1.5;}
  .lp-pricing-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:20px;align-items:stretch;}
  .lp-plan{background:#fff;border-radius:20px;padding:30px 26px;box-shadow:0 2px 12px rgba(61,31,10,0.06);border:1.5px solid #FFE4D6;display:flex;flex-direction:column;transition:transform 0.25s ease, box-shadow 0.25s ease, border-color 0.25s ease;cursor:pointer;position:relative;overflow:hidden;}
  .lp-plan:hover{transform:translateY(-6px);box-shadow:0 16px 32px rgba(61,31,10,0.12);}
  .lp-plan:active{transform:translateY(-2px);border-color:#FF6B35;box-shadow:0 8px 20px rgba(255,107,53,0.2);}
  .lp-plan.featured{background:linear-gradient(160deg,#FF6B35,#e85d2e);border:none;color:#fff;transform:scale(1.03);box-shadow:0 12px 32px rgba(255,107,53,0.35);}
  .lp-plan.featured:hover{transform:scale(1.03) translateY(-6px);box-shadow:0 20px 40px rgba(255,107,53,0.45);}
  .lp-plan.featured:active{transform:scale(1.01) translateY(-2px);box-shadow:0 10px 26px rgba(255,107,53,0.5);}
  .lp-plan-name{font-family:'Baloo 2',cursive;font-size:15px;font-weight:800;letter-spacing:0.5px;text-transform:uppercase;margin-bottom:10px;}
  .lp-plan-price{font-family:'Baloo 2',cursive;font-size:32px;font-weight:800;margin-bottom:4px;}
  .lp-plan-price small{font-size:13px;font-weight:600;opacity:0.75;}
  .lp-plan-feat{font-size:13.5px;line-height:2;margin:18px 0 24px;flex:1;}
  .lp-plan .lp-cta-main, .lp-plan .lp-cta-sec{display:block;text-align:center;}
  .lp-plan.featured .lp-cta-main{background:#fff;color:#FF6B35;box-shadow:none;}
  .lp-footer{border-top:1px solid #FFE4D6;padding:36px 24px;text-align:center;}
  .lp-footer-links{display:flex;justify-content:center;gap:20px;margin:16px 0;flex-wrap:wrap;}
  .lp-footer-links a{color:#7A4522;font-size:13px;text-decoration:none;}
  .lp-footer-copy{font-size:12px;color:#B08968;}
  @media(max-width:640px){
    .lp-title{font-size:32px;}
    .lp-nav-links{display:none;}
  }
`;

const SITE_URL = "https://www.firusymichis.cl";

// CSP (next.config.ts) tiene 'unsafe-inline' en script-src por requerimiento
// de hidratación de Next.js (ver comentario en next.config.ts), así que un
// <script type="application/ld+json"> inline no viola la política — no hace
// falta nonce ni un endpoint aparte.
const JSON_LD = [
  {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "Firus & Michis",
    description:
      "Controla medicamentos, vacunas e historial médico de tus perros y gatos. Recordatorios automáticos y asistente veterinario con IA.",
    applicationCategory: "HealthApplication",
    operatingSystem: "Web",
    url: SITE_URL,
    inLanguage: "es-CL",
    offers: {
      "@type": "Offer",
      name: "Prueba gratuita",
      price: "0",
      priceCurrency: "CLP",
      description: "1 mes de acceso PRO gratis, sin tarjeta de crédito.",
    },
  },
  {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "GO COMPUTACIÓN SpA",
    url: SITE_URL,
    logo: `${SITE_URL}/icon-512.png`,
    email: "contacto@firusymichis.cl",
    areaServed: "CL",
  },
];

export default async function Home() {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // Server Components no pueden modificar cookies
          }
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();

  if (user) {
    redirect("/dashboard");
  }

  return (
    <div className="lp">
      <style>{css}</style>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(JSON_LD) }}
      />

      <nav className="lp-nav">
        <div className="lp-logo">Firus<span>&</span>Michis</div>
        <div className="lp-nav-links">
          <a className="lp-nav-link" href="#features">Funciones</a>
          <a className="lp-nav-link" href="#pricing">Precios</a>
          <a className="lp-nav-link" href="#footer">Contacto</a>
        </div>
        <div className="lp-nav-actions">
          <Link href="/login" className="lp-btn-ghost">Iniciar sesión</Link>
          <Link href="/login" className="lp-btn-solid">Registrarse</Link>
        </div>
      </nav>

      <section className="lp-hero">
        <div className="lp-badge">✨ 1 mes PRO gratis al registrarte</div>
        <h1 className="lp-title">
          La salud de tu mascota, siempre <span className="accent">organizada</span>
        </h1>
        <p className="lp-sub">
          Medicamentos, vacunas, historial médico y mucho más — todo en un solo lugar,
          con recordatorios que no dejan pasar nada importante.
        </p>
        <div className="lp-cta-row">
          <Link href="/login" className="lp-cta-main">Empieza tu prueba PRO gratis →</Link>
          <a href="#features" className="lp-cta-sec">Ver cómo funciona</a>
        </div>
        <div className="lp-chips">
          <span className="lp-chip">🐕 Perros</span>
          <span className="lp-chip">🐈 Gatos</span>
          <span className="lp-chip">🐰 Conejos</span>
          <span className="lp-chip">🐢 Tortugas</span>
          <span className="lp-chip">🐹 Hámsters</span>
          <span className="lp-chip">🐦 Aves</span>
        </div>
        <div className="lp-note">Sin tarjeta de crédito · Cancela cuando quieras · Datos seguros</div>
      </section>

      <section className="lp-section" style={{ paddingTop: 8 }}>
        <h2 className="lp-section-title">Así se ve por dentro</h2>
        <div className="lp-section-sub">La ficha completa de tu mascota, siempre a mano</div>
        <div style={{ maxWidth: 320, margin: "0 auto", background: "#fff", border: "1.5px solid #FFE4D6", borderRadius: 24, padding: 16, position: "relative", height: 460, overflow: "hidden", boxShadow: "0 8px 24px rgba(61,31,10,0.08)" }}>
          <img src="/landing/screenshot-1-datos-basicos.png" alt="Datos básicos de una mascota en Firus&Michis" className="lp-shot lp-shot-1" />
          <img src="/landing/screenshot-2-peso.png" alt="Evolución de peso de una mascota en Firus&Michis" className="lp-shot lp-shot-2" />
          <img src="/landing/screenshot-3-historial.png" alt="Historial médico de una mascota en Firus&Michis" className="lp-shot lp-shot-3" />
          <img src="/landing/screenshot-4-alimentacion.png" alt="Registro de alimentación en Firus&Michis" className="lp-shot lp-shot-4" />
          <img src="/landing/screenshot-5-ia.png" alt="Asistente de inteligencia artificial en Firus&Michis" className="lp-shot lp-shot-5" />
        </div>
      </section>

      <section id="features" className="lp-section">
        <h2 className="lp-section-title">Todo lo que tu mascota necesita</h2>
        <div className="lp-section-sub">Una app pensada para no perder nunca el control de su salud</div>
        <div className="lp-features-grid">
          {FEATURES.map((f) => (
            <div key={f.title} className="lp-feature-card">
              <div className="lp-feature-icon">{f.icon}</div>
              <div className="lp-feature-title">{f.title}</div>
              <div className="lp-feature-desc">{f.desc}</div>
            </div>
          ))}
        </div>
      </section>

      <section id="pricing" className="lp-section">
        <h2 className="lp-section-title">Planes simples, sin sorpresas</h2>
        <div className="lp-section-sub">Empieza gratis y sube de plan cuando lo necesites</div>
        <div className="lp-pricing-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
          <div className="lp-plan">
            <div className="lp-plan-name" style={{ color: "#2EC4B6" }}>FREE TRIAL</div>
            <div className="lp-plan-price">1 mes <small>gratis</small></div>
            <ul className="lp-plan-feat" style={{ listStyle: "none", padding: 0 }}>
              <li>✓ Acceso PRO completo</li>
              <li>✓ Sin tarjeta de crédito</li>
              <li>✓ Cancela cuando quieras</li>
            </ul>
            <Link href="/login" className="lp-cta-sec">Empezar gratis →</Link>
          </div>

          <div className="lp-plan">
            <div className="lp-plan-name" style={{ color: "#3D1F0A" }}>PRO · 3 MESES</div>
            <div className="lp-plan-price">$7.990 <small>CLP</small></div>
            <div style={{ fontSize: 12, color: "#7A4522", marginTop: -8, marginBottom: 8 }}>≈ $2.663/mes</div>
            <ul className="lp-plan-feat" style={{ listStyle: "none", padding: 0 }}>
              <li>✓ Hasta 3 mascotas</li>
              <li>✓ Asistente IA incluido</li>
              <li>✓ Exportar ficha en PDF</li>
            </ul>
            <Link href="/login" className="lp-cta-sec">Empezar gratis →</Link>
          </div>

          <div className="lp-plan">
            <div style={{ position: "absolute", top: 14, right: -34, transform: "rotate(40deg)", background: "#059669", color: "#fff", fontSize: 11, fontWeight: 700, padding: "4px 38px" }}>16%</div>
            <div className="lp-plan-name" style={{ color: "#3D1F0A" }}>PRO · 6 MESES</div>
            <div className="lp-plan-price">$14.990 <small>CLP</small></div>
            <div style={{ fontSize: 12, color: "#7A4522", marginTop: -8, marginBottom: 8 }}>≈ $2.498/mes</div>
            <ul className="lp-plan-feat" style={{ listStyle: "none", padding: 0 }}>
              <li>✓ Hasta 3 mascotas</li>
              <li>✓ Asistente IA incluido</li>
              <li>✓ Exportar ficha en PDF</li>
            </ul>
            <Link href="/login" className="lp-cta-sec">Empezar gratis →</Link>
          </div>

          <div className="lp-plan featured">
            <div style={{ position: "absolute", top: 14, right: -34, transform: "rotate(40deg)", background: "#059669", color: "#fff", fontSize: 11, fontWeight: 700, padding: "4px 38px" }}>30%</div>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#FF6B35", background: "#fff", display: "inline-block", padding: "3px 10px", borderRadius: 10, marginBottom: 10 }}>Recomendado</div>
            <div className="lp-plan-name" style={{ color: "#fff" }}>PRO · 12 MESES</div>
            <div className="lp-plan-price" style={{ color: "#fff" }}>$24.990 <small style={{ color: "rgba(255,255,255,0.85)" }}>CLP</small></div>
            <div style={{ fontSize: 12, color: "rgba(255,255,255,0.9)", marginTop: -8, marginBottom: 8 }}>≈ $2.083/mes</div>
            <ul className="lp-plan-feat" style={{ listStyle: "none", padding: 0, color: "#fff" }}>
              <li>✓ Hasta 3 mascotas</li>
              <li>✓ Asistente IA incluido</li>
              <li>✓ Exportar ficha en PDF</li>
            </ul>
            <Link href="/login" className="lp-cta-main">Empezar gratis →</Link>
          </div>
        </div>
      </section>

      <footer id="footer" className="lp-footer">
        <div className="lp-logo">Firus<span>&</span>Michis</div>
        <div className="lp-footer-links">
          <Link href="/terminos">Términos de uso</Link>
          <Link href="/privacidad">Privacidad</Link>
          <a href="mailto:contacto@firusymichis.cl">contacto@firusymichis.cl</a>
        </div>
        <div className="lp-footer-copy">© 2026 Firus & Michis · Hecho con amor en Chile 🇨🇱</div>
      </footer>
    </div>
  );
}

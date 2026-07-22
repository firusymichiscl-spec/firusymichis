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
  .lp-cta-main{padding:15px 30px;border-radius:14px;border:none;background:linear-gradient(135deg,#FF6B35,#e85d2e);color:#fff;font-family:'Baloo 2',cursive;font-size:16px;font-weight:700;text-decoration:none;box-shadow:0 8px 24px rgba(255,107,53,0.35);}
  .lp-cta-sec{padding:15px 24px;border-radius:14px;border:1.5px solid #FFD9C8;background:#fff;color:#3D1F0A;font-family:'Baloo 2',cursive;font-size:15px;font-weight:700;text-decoration:none;}
  .lp-chips{display:flex;flex-wrap:wrap;align-items:center;justify-content:center;gap:8px;margin-bottom:20px;}
  .lp-chip{background:#fff;border:1.5px solid #FFE4D6;border-radius:20px;padding:6px 14px;font-size:13px;font-weight:700;color:#7A4522;}
  .lp-note{font-size:12px;color:#B08968;}
  .lp-section{max-width:1080px;margin:0 auto;padding:56px 24px;}
  .lp-section-title{font-family:'Baloo 2',cursive;font-size:28px;font-weight:800;color:#3D1F0A;text-align:center;margin-bottom:8px;}
  .lp-section-sub{font-size:14px;color:#7A4522;text-align:center;margin-bottom:40px;}
  .lp-features-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:20px;}
  .lp-feature-card{background:#fff;border-radius:18px;padding:26px 22px;box-shadow:0 2px 12px rgba(61,31,10,0.06);}
  .lp-feature-icon{font-size:32px;margin-bottom:14px;}
  .lp-feature-title{font-family:'Baloo 2',cursive;font-size:16px;font-weight:700;color:#3D1F0A;margin-bottom:6px;}
  .lp-feature-desc{font-size:13.5px;color:#7A4522;line-height:1.5;}
  .lp-pricing-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:20px;align-items:stretch;}
  .lp-plan{background:#fff;border-radius:20px;padding:30px 26px;box-shadow:0 2px 12px rgba(61,31,10,0.06);border:1.5px solid #FFE4D6;display:flex;flex-direction:column;}
  .lp-plan.featured{background:linear-gradient(160deg,#FF6B35,#e85d2e);border:none;color:#fff;transform:scale(1.03);box-shadow:0 12px 32px rgba(255,107,53,0.35);}
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

      <section id="features" className="lp-section">
        <div className="lp-section-title">Todo lo que tu mascota necesita</div>
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
        <div className="lp-section-title">Planes simples, sin sorpresas</div>
        <div className="lp-section-sub">Empieza gratis y sube de plan cuando lo necesites</div>
        <div className="lp-pricing-grid">
          <div className="lp-plan">
            <div className="lp-plan-name" style={{ color: "#2EC4B6" }}>Free trial</div>
            <div className="lp-plan-price">1 mes <small>gratis</small></div>
            <ul className="lp-plan-feat" style={{ listStyle: "none", padding: 0 }}>
              <li>✓ Acceso PRO completo</li>
              <li>✓ Sin tarjeta de crédito</li>
              <li>✓ Cancela cuando quieras</li>
            </ul>
            <Link href="/login" className="lp-cta-sec">Empezar gratis →</Link>
          </div>

          <div className="lp-plan featured">
            <div className="lp-plan-name">Pro</div>
            <div className="lp-plan-price">$3.990 <small>CLP/mes</small></div>
            <ul className="lp-plan-feat" style={{ listStyle: "none", padding: 0 }}>
              <li>✓ Hasta 3 mascotas</li>
              <li>✓ Asistente IA incluido</li>
              <li>✓ Exportar ficha en PDF</li>
            </ul>
            <Link href="/login" className="lp-cta-main">Empezar gratis →</Link>
          </div>

          <div className="lp-plan">
            <div className="lp-plan-name" style={{ color: "#805AD5" }}>Premium</div>
            <div className="lp-plan-price">$7.990 <small>CLP/mes</small></div>
            <ul className="lp-plan-feat" style={{ listStyle: "none", padding: 0 }}>
              <li>✓ Hasta 5 mascotas</li>
              <li>✓ Todo lo de PRO</li>
              <li>✓ Perfil familiar compartido</li>
            </ul>
            <Link href="/login" className="lp-cta-sec">Empezar gratis →</Link>
          </div>
        </div>
      </section>

      <footer id="footer" className="lp-footer">
        <div className="lp-logo">Firus<span>&</span>Michis</div>
        <div className="lp-footer-links">
          <a href="#">Términos</a>
          <a href="#">Privacidad</a>
          <a href="mailto:contacto@firusymichis.cl">contacto@firusymichis.cl</a>
        </div>
        <div className="lp-footer-copy">© 2026 Firus & Michis · Hecho con amor en Chile 🇨🇱</div>
      </footer>
    </div>
  );
}

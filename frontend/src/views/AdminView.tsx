import { BarChart3, CalendarDays, LogOut, Menu, Users, X } from "lucide-react";
import { useEffect, useState } from "react";
import AdminContribuyentesPanel from "../components/Admin/AdminContribuyentesPanel";
import brandSymbol from "../assets/dashboard/brand-symbol.png";
import "../internal-colors.css";
import "../components/Admin/admin.css";

interface AdminViewProps {
  userRuc: string;
  userRazonSocial: string;
  onLogout: () => void;
  onOpenContable: () => void;
}

export default function AdminView({ userRuc, userRazonSocial, onLogout, onOpenContable }: AdminViewProps) {
  const [now, setNow] = useState(() => new Date());
  const [menuOpen, setMenuOpen] = useState(false);
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  useEffect(() => {
    const close = (event: KeyboardEvent) => { if (event.key === "Escape") setMenuOpen(false); };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, []);
  const initials = userRazonSocial.split(" ").filter(Boolean).slice(0, 2).map(word => word[0]).join("");
  return (
    <main className="admin-app">
      {menuOpen && <button className="admin-menu-backdrop" aria-label="Cerrar menú" onClick={() => setMenuOpen(false)} />}
      <aside id="admin-navigation" className={`admin-sidebar ${menuOpen ? "is-open" : ""}`}>
        <div className="admin-brand">
          <span className="admin-brand-symbol"><img src={brandSymbol} alt="" /></span>
          <div><strong>TRIBUTACIÓN</strong><span>En línea</span></div>
          <button className="admin-mobile-toggle" aria-label="Cerrar menú" onClick={() => setMenuOpen(false)}><X size={20} /></button>
        </div>
        <nav aria-label="Administración">
          <button className="is-active" aria-current="page" onClick={() => { setMenuOpen(false); window.scrollTo({ top: 0, behavior: "smooth" }); }}><Users size={20} />Administración</button>
          <button onClick={onOpenContable}><BarChart3 size={20} />Sistema contable</button>
        </nav>
        <svg className="admin-sidebar-decoration" viewBox="0 0 240 400" preserveAspectRatio="none" aria-hidden="true"><path fill="#7029e7" opacity=".18" d="M0 0C130 45 70 170 240 185V400C100 310 60 140 0 120Z"/><path fill="#b080fa" opacity=".13" d="M240 110C90 160 170 280 0 250V400H240Z"/></svg>
        <div className="admin-sidebar-account"><div className="admin-identity"><span className="admin-avatar">{initials}</span><div><strong>{userRazonSocial}</strong><small>ADMINISTRADOR</small></div></div><button onClick={onLogout}><LogOut size={17} />Cerrar sesión</button></div>
      </aside>
      <div className="admin-body">
        <header className="admin-header">
          <button className="admin-mobile-toggle" aria-label="Abrir menú" aria-expanded={menuOpen} aria-controls="admin-navigation" onClick={() => setMenuOpen(true)}><Menu size={22} /></button>
          <div className="admin-heading"><span className="admin-icon"><Users size={23} /></span><div><h1>Administración</h1><p>Gestión de accesos de contribuyentes</p></div></div>
          <div className="admin-header-meta"><div className="admin-clock"><CalendarDays size={18} /><div><span>{now.toLocaleDateString("es-EC", { weekday: "long", day: "2-digit", month: "long", year: "numeric" })}</span><time>{now.toLocaleTimeString("es-EC")}</time></div></div><div className="admin-identity"><span className="admin-avatar">{initials}</span><div><strong>{userRazonSocial}</strong><small>ADMINISTRADOR</small></div></div></div>
        </header>
        <section className="admin-workspace internal-theme"><AdminContribuyentesPanel currentUserRuc={userRuc} /></section>
      </div>
    </main>
  );
}

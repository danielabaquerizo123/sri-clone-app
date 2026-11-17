import { ArrowRight, Calculator, FileText, Folder, ShieldCheck, Zap, Network } from "lucide-react";
import type { AccessInfo } from "../../utils/acceso";
import type { ContribuyenteData } from "../../views/DashboardView";
import building from "../../assets/dashboard/sri-building.png";
import declaraciones from "../../assets/dashboard/declaraciones.png";
import anexos from "../../assets/dashboard/anexos.png";
import contabilidad from "../../assets/dashboard/contabilidad.png";

interface DashboardHomeProps {
  data: ContribuyenteData;
  accessInfo: AccessInfo;
  obligacionesList: string[];
  onNavigate: (tab: string) => void;
  onRefresh: () => void;
}

export default function DashboardHome({ onNavigate }: DashboardHomeProps) {
  return (
    <div className="tributacion-home">
      <section className="tributacion-welcome" aria-labelledby="dashboard-welcome-title">
        <img className="tributacion-building" src={building} alt="" />
        <svg className="tributacion-mobile-waves" viewBox="0 0 400 40" preserveAspectRatio="none" aria-hidden="true"><path d="M0 0Q140 15 310 40H0Z" fill="#6524e8"/><path d="M0 18Q90 25 220 40H0Z" fill="#9948ff"/><path d="M65 14Q210 22 335 40H310Z" fill="#ff9b5d"/></svg>
        <div className="tributacion-welcome-copy">
          <p className="tributacion-eyebrow">Bienvenida</p>
          <h1 id="dashboard-welcome-title">Tu gestión<br />tributaria<br /><strong>más simple</strong></h1>
          <svg className="tributacion-underline" viewBox="0 0 380 14" aria-hidden="true"><path d="M0 11Q190-9 380 8Q200 4 0 14Z" fill="#ffaf87" /></svg>
          <p className="tributacion-intro">Realiza tus procesos tributarios<br />de forma segura, ágil y en un solo lugar.</p>
          <ul className="tributacion-benefits">
            <li><ShieldCheck /><span>Información<br />segura</span></li>
            <li><Zap /><span>Procesos<br />más ágiles</span></li>
            <li><Network /><span>Todo en un<br />solo sistema</span></li>
          </ul>
        </div>
      </section>
      <section className="tributacion-services" aria-label="Servicios tributarios">
        {[
          { title: "Declaraciones", description: "Presenta tus declaraciones de IVA, retenciones y otras obligaciones tributarias.", image: declaraciones, icon: FileText, tone: "orange", destination: "declaracion_elaboracion" },
          { title: "Anexos", description: "Carga y gestiona tus anexos (ATS, guías de remisión, comprobantes anulados y más).", image: anexos, icon: Folder, tone: "purple", destination: "anexo_ats" },
          { title: "Contabilidad", description: "Convierte tu información tributaria en asientos contables de forma automática.", image: contabilidad, icon: Calculator, tone: "blue", destination: "contabilidad" },
        ].map(({ title, description, image, icon: Icon, tone, destination }) => (
          <button className={`tributacion-service tributacion-service-${tone}`} key={destination} type="button" onClick={() => onNavigate(destination)}>
            <img src={image} alt="" />
            <span className="tributacion-service-copy">
              <span className="tributacion-service-icon"><Icon aria-hidden="true" /></span>
              <span className="tributacion-service-title">{title}</span>
              <span className="tributacion-service-description">{description}</span>
              <span className="tributacion-service-arrow"><ArrowRight aria-hidden="true" /><span className="sr-only">Abrir {title}</span></span>
            </span>
          </button>
        ))}
      </section>
    </div>
  );
}

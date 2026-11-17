import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import {
  BadgeCheck,
  Calculator,
  ChevronDown,
  ChevronRight,
  ClipboardList,
  Download,
  FileSpreadsheet,
  FileText,
  FolderKanban,
  Home,
  Layers,
  X,
  LogOut,
  Pencil,
  Printer,
  RefreshCcw,
  Search,
} from "lucide-react";
import type { ContribuyenteData, OpcionesRuc } from "../../views/DashboardView";
import { type AccessInfo } from "../../utils/acceso";
import brandSymbol from "../../assets/dashboard/brand-symbol.png";

interface DashboardSidebarProps {
  mobileOpen: boolean;
  onMobileOpenChange: (open: boolean) => void;
  activeTab: string;
  accessInfo: AccessInfo;
  data: ContribuyenteData;
  opcionesRuc: OpcionesRuc | null;
  onLogout: () => void;
  onNavigate: (tab: string) => void;
}

export default function DashboardSidebar({
  mobileOpen,
  onMobileOpenChange,
  activeTab,
  opcionesRuc,
  onLogout,
  onNavigate,
}: DashboardSidebarProps) {
  const [funcOpen, setFuncOpen] = useState(true);
  const [rucOpen, setRucOpen] = useState(false);
  const [isPhone, setIsPhone] = useState(() => window.matchMedia("(max-width: 700px)").matches);
  const drawerRef = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const media = window.matchMedia("(max-width: 700px)");
    const update = () => { setIsPhone(media.matches); onMobileOpenChange(false); };
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, [onMobileOpenChange]);
  useEffect(() => {
    const dialog = drawerRef.current;
    if (!isPhone || !dialog) return;
    if (!mobileOpen) { if (dialog.open) dialog.close(); return; }
    const previousOverflow = document.body.style.overflow;
    const previousRootOverflow = document.documentElement.style.overflow;
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";
    dialog.showModal();
    return () => {
      if (dialog.open) dialog.close();
      document.body.style.overflow = previousOverflow;
      document.documentElement.style.overflow = previousRootOverflow;
    };
  }, [isPhone, mobileOpen]);
  const navigate = (tab: string) => {
    if (isPhone) onMobileOpenChange(false);
    onNavigate(tab);
  };
  const handleDrawerKeyDown = (event: KeyboardEvent<HTMLDialogElement>) => {
    if (event.key !== "Tab") return;
    const controls = Array.from(event.currentTarget.querySelectorAll<HTMLElement>("button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex='-1'])")).filter(element => element.getClientRects().length > 0);
    const first = controls[0];
    const last = controls[controls.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last?.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first?.focus();
    }
  };
  const [declaracionesOpen, setDeclaracionesOpen] = useState(false);
  const [anexosOpen, setAnexosOpen] = useState(false);



  const sidebar = (
    <aside className="tributacion-sidebar flex max-h-[48vh] w-full flex-col overflow-y-auto bg-[linear-gradient(180deg,#061d58_0%,#003565_52%,#063e78_100%)] text-white shadow-[8px_0_30px_rgba(3,7,18,0.18)] [scrollbar-width:thin] [scrollbar-color:rgba(148,163,184,0.35)_transparent] lg:sticky lg:top-0 lg:h-screen lg:max-h-none lg:w-[272px] lg:shrink-0">
      <div className="tributacion-brand">
        <span className="tributacion-brand-symbol"><img src={brandSymbol} alt="" /></span>
        <div><strong>TRIBUTACIÓN</strong><span>— En línea —</span></div>
        <button type="button" className="tributacion-menu-toggle" aria-label={isPhone ? "Cerrar navegación" : "Abrir o cerrar navegación"} aria-expanded={mobileOpen} aria-controls="tributacion-navigation" onClick={() => onMobileOpenChange(!mobileOpen)}>{isPhone ? <X size={24} /> : <Layers size={24} />}</button>
      </div>
      <svg className="tributacion-sidebar-art" viewBox="0 0 290 520" aria-hidden="true"><defs><linearGradient id="tributacion-ribbon" x1="0" y1="0" x2="1" y2="1"><stop stopColor="#914be1"/><stop offset="1" stopColor="#462378"/></linearGradient></defs><path d="M-85 0C80 22 177 115 136 213 78 113 0 100-85 72Z" fill="url(#tributacion-ribbon)"/><path d="M318 75C156 108 66 208 89 295 120 219 196 191 318 174Z" fill="url(#tributacion-ribbon)"/><path d="M36 201C66 264 134 263 169 307 188 335 182 365 193 406 101 345 24 280 36 201Z" fill="url(#tributacion-ribbon)"/><path d="M300 214C194 244 172 288 180 350 202 311 255 307 300 292Z" fill="url(#tributacion-ribbon)"/><path d="M180 340Q213 421 288 488C258 401 234 361 180 340Z" fill="#5a3188"/></svg>
      <div id="tributacion-navigation" className={`tributacion-navigation ${mobileOpen ? "is-open" : ""}`}>
      <nav className="flex-1 space-y-5 px-5 pb-4 pt-3">
        <SidebarItem
          active={activeTab === "inicio"}
          icon={<Home size={18} />}
          label="Inicio"
          onClick={() => navigate("inicio")}
        />

        <div>
          <button
            type="button"
            aria-expanded={funcOpen}
            onClick={() => setFuncOpen((current) => !current)}
            className="tributacion-functionalities mb-3 flex w-full items-center justify-between rounded-xl px-3 py-2 text-[11px] font-black uppercase tracking-wider text-blue-100/70 transition hover:bg-white/10"
          >
            Funcionalidades
            {funcOpen ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
          </button>

          {funcOpen && (
            <div className="space-y-1">
              <ModuleButton
                label="RUC"
                icon={<FileText size={18} />}
                open={rucOpen}
                active={activeTab.startsWith("ruc_")}
                onClick={() => setRucOpen((current) => !current)}
              />

              {rucOpen && (
                <div className="ml-6 mt-2 space-y-1 border-l border-white/10 pl-3">
                  <SidebarSubItem
                    active={activeTab === "ruc_inscripcion"}
                    enabled={!!opcionesRuc?.inscripcion}
                    icon={<Search size={15} />}
                    label="Inscripcion"
                    onClick={() => navigate("ruc_inscripcion")}
                  />
                  <SidebarSubItem
                    active={activeTab === "ruc_actualizacion"}
                    enabled={!!opcionesRuc?.actualizacion}
                    icon={<Pencil size={15} />}
                    label="Actualizacion"
                    onClick={() => navigate("ruc_actualizacion")}
                  />
                  <SidebarSubItem
                    active={activeTab === "ruc_reapertura"}
                    enabled={!!opcionesRuc?.reapertura}
                    icon={<RefreshCcw size={15} />}
                    label="Reapertura"
                    onClick={() => navigate("ruc_reapertura")}
                  />
                  <SidebarSubItem
                    active={activeTab === "ruc_reimpresion"}
                    enabled={!!opcionesRuc?.reimpresion}
                    icon={<Printer size={15} />}
                    label="Reimpresion"
                    onClick={() => navigate("ruc_reimpresion")}
                  />
                </div>
              )}

              <ModuleButton
                label="Declaraciones"
                icon={<FileSpreadsheet size={18} />}
                open={declaracionesOpen}
                active={activeTab.startsWith("declaracion_")}
                onClick={() => setDeclaracionesOpen((current) => !current)}
              />

              {declaracionesOpen && (
                <div className="ml-6 mt-2 space-y-1 border-l border-white/10 pl-3">
                  <SidebarSubItem active={activeTab === "declaracion_elaboracion"} enabled icon={<FileSpreadsheet size={15} />} label="Elaboracion y envio" onClick={() => navigate("declaracion_elaboracion")} />
                  <SidebarSubItem active={activeTab === "declaracion_consulta"} enabled icon={<Search size={15} />} label="Consulta declaraciones" onClick={() => navigate("declaracion_consulta")} />
                  <SidebarSubItem active={activeTab === "declaracion_107"} enabled icon={<Printer size={15} />} label="Formulario 107 - RDEP" onClick={() => navigate("declaracion_107")} />
                  <SidebarSubItem active={activeTab === "declaracion_103"} enabled icon={<FileText size={15} />} label="Formulario 103" onClick={() => navigate("declaracion_103")} />
                  <SidebarSubItem active={activeTab === "declaracion_104"} enabled icon={<FileSpreadsheet size={15} />} label="Formulario 104" onClick={() => navigate("declaracion_104")} />
                </div>
              )}

              <ModuleButton
                label="Anexos"
                icon={<FolderKanban size={18} />}
                open={anexosOpen}
                active={activeTab.startsWith("anexo_")}
                onClick={() => setAnexosOpen((current) => !current)}
              />

              {anexosOpen && (
                <div className="ml-6 mt-2 space-y-1 border-l border-white/10 pl-3">
                  <SidebarSubItem active={activeTab === "anexo_ats"} enabled icon={<FileSpreadsheet size={15} />} label="ATS" onClick={() => navigate("anexo_ats")} />
                  <SidebarSubItem active={activeTab === "anexo_envio"} enabled icon={<Download size={15} />} label="Envio y consulta" onClick={() => navigate("anexo_envio")} />
                  <SidebarSubItem active={activeTab === "anexo_beneficiario"} enabled icon={<BadgeCheck size={15} />} label="Beneficiario pension" onClick={() => navigate("anexo_beneficiario")} />
                  <SidebarSubItem active={activeTab === "anexo_dependientes_2022"} enabled icon={<ClipboardList size={15} />} label="Dependientes hasta 2022" onClick={() => navigate("anexo_dependientes_2022")} />
                  <SidebarSubItem active={activeTab === "anexo_cargas_2023"} enabled icon={<Layers size={15} />} label="Cargas desde 2023" onClick={() => navigate("anexo_cargas_2023")} />
                </div>
              )}

              <SidebarItem
                active={activeTab === "contabilidad"}
                icon={<Calculator size={18} />}
                label="Contabilidad"
                onClick={() => navigate("contabilidad")}
              />
            </div>
          )}
        </div>
      </nav>

      <div className="tributacion-sidebar-footer space-y-3 px-5 pb-5 pt-2">

        <button
          type="button"
          onClick={onLogout}
          className="flex w-full items-center gap-3 rounded-2xl bg-white/10 px-4 py-3 text-sm font-black text-white/90 transition hover:bg-white/20 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
        >
          <LogOut size={18} />
          Cerrar sesion
        </button>
      </div>
      </div>
    </aside>
  );
  return isPhone ? (
    <dialog id="tributacion-mobile-drawer" ref={drawerRef} className="tributacion-mobile-drawer" aria-label="Navegación principal" onKeyDown={handleDrawerKeyDown} onCancel={() => onMobileOpenChange(false)} onClick={event => { if (event.target === event.currentTarget) onMobileOpenChange(false); }}>
      {sidebar}
    </dialog>
  ) : sidebar;
}

function SidebarItem({
  active,
  icon,
  label,
  onClick,
}: {
  active: boolean;
  icon: ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`tributacion-sidebar-item flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left text-sm font-black transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 ${
        active
          ? "bg-blue-500 text-white shadow-[0_12px_24px_rgba(37,99,235,0.34)]"
          : "text-white/80 hover:bg-white/10 hover:text-white"
      }`}
    >
      {icon}
      <span className="truncate">{label}</span>
    </button>
  );
}

function ModuleButton({
  active,
  icon,
  label,
  open,
  onClick,
}: {
  active: boolean;
  icon: ReactNode;
  label: string;
  open: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-expanded={open}
      onClick={onClick}
      className={`tributacion-module flex w-full items-center justify-between rounded-2xl px-3 py-2.5 text-sm font-black transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 ${
        active
          ? "bg-white/12 text-white"
          : "text-white/80 hover:bg-white/10 hover:text-white"
      }`}
    >
      <span className="flex min-w-0 items-center gap-3">
        {icon}
        <span className="truncate">{label}</span>
      </span>
      {open ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
    </button>
  );
}

function SidebarSubItem({
  active,
  enabled,
  icon,
  label,
  onClick,
}: {
  active: boolean;
  enabled: boolean;
  icon: ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={!enabled}
      onClick={onClick}
      className={`tributacion-subitem flex w-full items-center gap-3 rounded-xl px-3 py-1.5 text-left text-xs font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50 ${
        active
          ? "bg-white/12 text-white"
          : enabled
          ? "text-white/65 hover:bg-white/10 hover:text-white"
          : "cursor-not-allowed text-white/25"
      }`}
    >
      {icon}
      <span className="truncate">{label}</span>
    </button>
  );
}



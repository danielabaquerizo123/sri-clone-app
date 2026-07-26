import { useState, type ReactNode } from "react";
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
  LogOut,
  Pencil,
  Printer,
  RefreshCcw,
  Search,
  ShieldCheck,
} from "lucide-react";
import type { ContribuyenteData, OpcionesRuc } from "../../views/DashboardView";
import type { AccessInfo } from "../../utils/acceso";
import sriLogo from "../../assets/images/SRI.png";

interface DashboardSidebarProps {
  activeTab: string;
  accessInfo: AccessInfo;
  data: ContribuyenteData;
  opcionesRuc: OpcionesRuc | null;
  onLogout: () => void;
  onNavigate: (tab: string) => void;
}

export default function DashboardSidebar({
  activeTab,
  accessInfo,
  data,
  opcionesRuc,
  onLogout,
  onNavigate,
}: DashboardSidebarProps) {
  const [funcOpen, setFuncOpen] = useState(true);
  const [rucOpen, setRucOpen] = useState(true);
  const [declaracionesOpen, setDeclaracionesOpen] = useState(false);
  const [anexosOpen, setAnexosOpen] = useState(false);

  const accessProgress = accessInfo.porcentajeRestante;
  const accessTone = getAccessTone(accessInfo.estadoAcceso);

  return (
    <aside className="flex max-h-[48vh] w-full flex-col overflow-y-auto bg-[linear-gradient(180deg,#061d58_0%,#003565_52%,#063e78_100%)] text-white shadow-[8px_0_30px_rgba(3,7,18,0.18)] [scrollbar-width:thin] [scrollbar-color:rgba(148,163,184,0.35)_transparent] lg:sticky lg:top-0 lg:h-screen lg:max-h-none lg:w-[272px] lg:shrink-0">
      <div className="flex items-center gap-4 p-5">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-white p-1.5 shadow-sm">
          <img src={sriLogo} alt="SRI" className="h-full w-full object-contain" />
        </div>
        <div className="min-w-0">
          <p className="text-xl font-black leading-tight">SRI en linea</p>
          <p className="text-xs font-bold uppercase tracking-wider text-blue-100/70">
            Portal tributario
          </p>
        </div>
      </div>

      <nav className="flex-1 space-y-5 px-5 pb-4 pt-3">
        <SidebarItem
          active={activeTab === "inicio"}
          icon={<Home size={18} />}
          label="Inicio"
          onClick={() => onNavigate("inicio")}
        />

        <div>
          <button
            type="button"
            onClick={() => setFuncOpen((current) => !current)}
            className="mb-3 flex w-full items-center justify-between rounded-xl px-3 py-2 text-[11px] font-black uppercase tracking-wider text-blue-100/70 transition hover:bg-white/10"
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
                    onClick={() => onNavigate("ruc_inscripcion")}
                  />
                  <SidebarSubItem
                    active={activeTab === "ruc_actualizacion"}
                    enabled={!!opcionesRuc?.actualizacion}
                    icon={<Pencil size={15} />}
                    label="Actualizacion"
                    onClick={() => onNavigate("ruc_actualizacion")}
                  />
                  <SidebarSubItem
                    active={activeTab === "ruc_reapertura"}
                    enabled={!!opcionesRuc?.reapertura}
                    icon={<RefreshCcw size={15} />}
                    label="Reapertura"
                    onClick={() => onNavigate("ruc_reapertura")}
                  />
                  <SidebarSubItem
                    active={activeTab === "ruc_reimpresion"}
                    enabled={!!opcionesRuc?.reimpresion}
                    icon={<Printer size={15} />}
                    label="Reimpresion"
                    onClick={() => onNavigate("ruc_reimpresion")}
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
                  <SidebarSubItem active={activeTab === "declaracion_elaboracion"} enabled icon={<FileSpreadsheet size={15} />} label="Elaboracion y envio" onClick={() => onNavigate("declaracion_elaboracion")} />
                  <SidebarSubItem active={activeTab === "declaracion_consulta"} enabled icon={<Search size={15} />} label="Consulta declaraciones" onClick={() => onNavigate("declaracion_consulta")} />
                  <SidebarSubItem active={activeTab === "declaracion_107"} enabled icon={<Printer size={15} />} label="Formulario 107 - RDEP" onClick={() => onNavigate("declaracion_107")} />
                  <SidebarSubItem active={activeTab === "declaracion_103"} enabled icon={<FileText size={15} />} label="Formulario 103" onClick={() => onNavigate("declaracion_103")} />
                  <SidebarSubItem active={activeTab === "declaracion_104"} enabled icon={<FileSpreadsheet size={15} />} label="Formulario 104" onClick={() => onNavigate("declaracion_104")} />
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
                  <SidebarSubItem active={activeTab === "anexo_ats"} enabled icon={<FileSpreadsheet size={15} />} label="ATS" onClick={() => onNavigate("anexo_ats")} />
                  <SidebarSubItem active={activeTab === "anexo_envio"} enabled icon={<Download size={15} />} label="Envio y consulta" onClick={() => onNavigate("anexo_envio")} />
                  <SidebarSubItem active={activeTab === "anexo_beneficiario"} enabled icon={<BadgeCheck size={15} />} label="Beneficiario pension" onClick={() => onNavigate("anexo_beneficiario")} />
                  <SidebarSubItem active={activeTab === "anexo_dependientes_2022"} enabled icon={<ClipboardList size={15} />} label="Dependientes hasta 2022" onClick={() => onNavigate("anexo_dependientes_2022")} />
                  <SidebarSubItem active={activeTab === "anexo_cargas_2023"} enabled icon={<Layers size={15} />} label="Cargas desde 2023" onClick={() => onNavigate("anexo_cargas_2023")} />
                </div>
              )}

              <SidebarItem
                active={activeTab === "contabilidad"}
                icon={<Calculator size={18} />}
                label="Contabilidad"
                onClick={() => onNavigate("contabilidad")}
              />
            </div>
          )}
        </div>
      </nav>

      <div className="space-y-3 px-5 pb-5 pt-2">
        <div className="rounded-2xl border border-white/12 bg-white/10 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-[11px] font-black uppercase text-blue-100/70">
              Contribuyente activo
            </p>
            <span className={`h-2.5 w-2.5 rounded-full ${data.activo ? "bg-emerald-400" : "bg-amber-300"}`} />
          </div>
          <p className="truncate text-sm font-black text-white">{data.razonSocial}</p>
          <p className="mt-1 font-mono text-xs font-bold text-blue-100/75">RUC: {data.ruc}</p>
          <button
            type="button"
            onClick={() => onNavigate("ruc_reimpresion")}
            className="mt-3 rounded-xl bg-white/10 px-3 py-2 text-xs font-black text-white transition hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
          >
            Ver perfil
          </button>
        </div>

        {accessInfo.fechaExpiracion && (
        <div className="rounded-2xl border border-white/8 bg-[#07427f]/45 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-[11px] font-black uppercase text-blue-100/70">Dias de acceso</p>
            <ShieldCheck size={15} className="text-sky-300" />
          </div>
          <p className="text-xl font-black">
            {formatAccessValue(accessInfo)}
          </p>
          <p className="mt-2 text-xs font-semibold text-white/60">
            Expira el {formatDate(accessInfo.fechaExpiracion)}
          </p>
          <div className="mt-3 flex items-center gap-3">
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/10">
              <div
                className={`h-full rounded-full ${accessTone}`}
                style={{ width: `${accessProgress ?? 0}%` }}
              />
            </div>
            <span className="text-xs font-bold text-white/65">
              {accessProgress ?? 0}%
            </span>
          </div>
        </div>
        )}

        <button
          type="button"
          onClick={onLogout}
          className="flex w-full items-center gap-3 rounded-2xl bg-white/10 px-4 py-3 text-sm font-black text-white/90 transition hover:bg-white/20 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
        >
          <LogOut size={18} />
          Cerrar sesion
        </button>
      </div>
    </aside>
  );
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
      className={`flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left text-sm font-black transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 ${
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
      onClick={onClick}
      className={`flex w-full items-center justify-between rounded-2xl px-3 py-2.5 text-sm font-black transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 ${
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
      className={`flex w-full items-center gap-3 rounded-xl px-3 py-1.5 text-left text-xs font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50 ${
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

function formatDate(value?: string | Date | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("es-EC");
}

function formatAccessValue(accessInfo: AccessInfo) {
  if (accessInfo.estadoAcceso === "vencido") return "Acceso vencido";
  if (accessInfo.estadoAcceso === "desactivado") return "Desactivado";
  if (accessInfo.diasRestantes === null) return "-";
  return `${accessInfo.diasRestantes} dias`;
}

function getAccessTone(estado: AccessInfo["estadoAcceso"]) {
  if (estado === "alerta" || estado === "vencido" || estado === "desactivado") return "bg-red-300";
  if (estado === "por_vencer") return "bg-amber-300";
  return "bg-cyan-300";
}

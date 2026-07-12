import { useMemo, useState, type ReactNode } from "react";
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

interface DashboardSidebarProps {
  activeTab: string;
  data: ContribuyenteData;
  diasRestantesAcceso: number | null;
  opcionesRuc: OpcionesRuc | null;
  onLogout: () => void;
  onNavigate: (tab: string) => void;
}

export default function DashboardSidebar({
  activeTab,
  data,
  diasRestantesAcceso,
  opcionesRuc,
  onLogout,
  onNavigate,
}: DashboardSidebarProps) {
  const [funcOpen, setFuncOpen] = useState(true);
  const [rucOpen, setRucOpen] = useState(true);
  const [declaracionesOpen, setDeclaracionesOpen] = useState(false);
  const [anexosOpen, setAnexosOpen] = useState(false);

  const accessProgress = useMemo(() => {
    if (diasRestantesAcceso === null) return 0;
    return Math.max(0, Math.min(100, Math.round((diasRestantesAcceso / 120) * 100)));
  }, [diasRestantesAcceso]);

  return (
    <aside className="flex flex-col overflow-y-auto bg-[#003565] text-white shadow-xl lg:sticky lg:top-0 lg:h-screen lg:w-64 lg:shrink-0">
      <div className="flex items-center gap-3 border-b border-white/10 p-4">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white text-lg font-black text-[#003565]">
          SRI
        </div>
        <div className="min-w-0">
          <p className="text-lg font-black leading-tight">SRI en linea</p>
          <p className="text-xs font-black uppercase tracking-wider text-white/55">
            Portal transaccional
          </p>
        </div>
      </div>

      <nav className="flex-1 space-y-4 p-4">
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
            className="mb-2 flex w-full items-center justify-between rounded-xl px-3 py-2 text-[11px] font-black uppercase tracking-wider text-white/55 transition hover:bg-white/10"
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

      <div className="space-y-3 border-t border-white/10 p-4">
        <div className="rounded-2xl border border-white/10 bg-white/10 p-3">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-xs font-black uppercase text-white/60">
              Contribuyente activo
            </p>
            <span className="h-2 w-2 rounded-full bg-emerald-400" />
          </div>
          <p className="truncate text-sm font-black">{data.razonSocial}</p>
          <p className="mt-1 font-mono text-xs text-white/60">RUC: {data.ruc}</p>
          <span className="mt-2 inline-flex rounded-lg bg-white/10 px-3 py-1 text-[10px] font-black uppercase text-white/80">
            {data.regimen}
          </span>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/10 p-3">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-xs font-black text-white/70">Acceso restante</p>
            <ShieldCheck size={15} className="text-sky-300" />
          </div>
          <p className="text-xl font-black">
            {diasRestantesAcceso === null ? "-" : diasRestantesAcceso} dias
          </p>
          <p className="mt-2 text-xs font-semibold text-white/60">
            Expira el {formatDate(data.fechaExpiracion)}
          </p>
          <div className="mt-3 flex items-center gap-3">
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full bg-sky-400"
                style={{ width: `${accessProgress}%` }}
              />
            </div>
            <span className="text-xs font-bold text-white/65">
              {accessProgress}%
            </span>
          </div>
        </div>

        <button
          type="button"
          onClick={onLogout}
          className="flex w-full items-center gap-3 rounded-2xl bg-white/10 px-4 py-2.5 text-sm font-black text-white/85 transition hover:bg-white/15 hover:text-white"
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
      className={`flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left text-sm font-black transition ${
        active
          ? "bg-blue-600 text-white shadow-lg shadow-blue-950/20"
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
      className={`flex w-full items-center justify-between rounded-2xl px-3 py-2.5 text-sm font-black transition ${
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
      className={`flex w-full items-center gap-3 rounded-xl px-3 py-1.5 text-left text-xs font-bold transition ${
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

function formatDate(value?: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("es-EC");
}

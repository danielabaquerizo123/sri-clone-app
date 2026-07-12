import {
  Activity,
  ArrowRight,
  BadgeCheck,
  Building2,
  CalendarDays,
  CheckCircle2,
  Clock3,
  FileSpreadsheet,
  FolderKanban,
  Layers,
  RefreshCcw,
  Send,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import type { ContribuyenteData } from "../../views/DashboardView";

interface DashboardHomeProps {
  data: ContribuyenteData;
  diasRestantesAcceso: number | null;
  obligacionesList: string[];
  actividadesList: string[];
  onNavigate: (tab: string) => void;
  onRefresh: () => void;
}

const mockObligacionesPendientes = [
  {
    titulo: "Declaracion IVA - Formulario 104",
    periodo: "Periodo fiscal: Abril 2025",
    fechaLimite: "Fecha limite: 22/05/2025",
    etiqueta: "Vence en 12 dias",
  },
];

const mockActividadReciente = [
  {
    titulo: "Inicio de sesion exitoso",
    detalle: "10/05/2025 10:20 AM",
  },
  {
    titulo: "Consulta de declaraciones",
    detalle: "10/05/2025 09:45 AM - Formulario 104",
  },
];

const mockCalendarioTributario = [
  {
    mes: "MAY",
    dia: "22",
    titulo: "Declaracion IVA - Formulario 104",
    etiqueta: "Vence en 12 dias",
  },
];

export default function DashboardHome({
  data,
  diasRestantesAcceso,
  obligacionesList,
  actividadesList,
  onNavigate,
  onRefresh,
}: DashboardHomeProps) {
  const obligacionesRegistradas = obligacionesList.length;

  return (
    <div className="mx-auto w-full max-w-[1800px] space-y-4 2xl:space-y-6">
      <section className="relative overflow-hidden rounded-[1.5rem] bg-[#06185f] p-5 text-white shadow-xl lg:p-6 2xl:p-8 [@media(min-width:1800px)]:p-10">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_82%_18%,rgba(37,99,235,0.58),transparent_32%),radial-gradient(circle_at_55%_45%,rgba(14,165,233,0.2),transparent_30%)]" />
        <div className="absolute right-8 top-6 hidden text-blue-300/35 xl:block [@media(min-width:1800px)]:right-12 [@media(min-width:1800px)]:top-8">
          <ShieldCheck className="h-32 w-32 [@media(min-width:1800px)]:h-40 [@media(min-width:1800px)]:w-40" />
        </div>

        <div className="relative z-10 max-w-2xl [@media(min-width:1800px)]:max-w-3xl">
          <p className="mb-3 text-sm font-bold text-blue-100">
            Bienvenida de nuevo, {getFirstName(data.razonSocial)}
          </p>
          <h1 className="text-2xl font-black leading-tight lg:text-3xl 2xl:text-4xl [@media(min-width:1800px)]:text-5xl">
            Panel tributario del contribuyente
          </h1>
          <p className="mt-3 max-w-2xl text-sm font-semibold leading-6 text-blue-100/85 2xl:text-base [@media(min-width:1800px)]:max-w-3xl">
            Consulta y gestiona tu informacion tributaria de manera rapida,
            segura y facil desde el portal transaccional del SRI.
          </p>

          <div className="mt-5 flex flex-wrap gap-3 [@media(min-width:1800px)]:mt-7">
            <HeroButton icon={<RefreshCcw size={16} />} label="Actualizar datos" onClick={onRefresh} primary />
            <HeroButton icon={<FileSpreadsheet size={16} />} label="Declaraciones" onClick={() => onNavigate("declaracion_elaboracion")} />
            <HeroButton icon={<FolderKanban size={16} />} label="Anexos" onClick={() => onNavigate("anexo_ats")} />
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          icon={<Building2 size={24} />}
          label="Estado RUC"
          value={data.estadoRuc}
          detail="Sin novedades registradas"
          tone="emerald"
        />
        <MetricCard
          icon={<Layers size={24} />}
          label="Regimen tributario"
          value={data.regimen}
          detail="Regimen registrado"
          tone="blue"
        />
        <MetricCard
          icon={<Sparkles size={24} />}
          label="Obligaciones registradas"
          value={String(obligacionesRegistradas)}
          detail="Desde ficha del contribuyente"
          tone="violet"
        />
        <MetricCard
          icon={<Clock3 size={24} />}
          label="Dias de acceso"
          value={diasRestantesAcceso === null ? "-" : `${diasRestantesAcceso} dias`}
          detail={`Expira el ${formatDate(data.fechaExpiracion)}`}
          tone="amber"
        />
      </section>

      <section className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.08fr)_minmax(320px,0.92fr)] 2xl:gap-6">
        <section className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm 2xl:p-6 [@media(min-width:1800px)]:p-8">
          <SectionTitle icon={<BadgeCheck size={18} />} title="Resumen del contribuyente" />
          <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2">
            <Info label="RUC" value={data.ruc} />
            <Info label="Razon social" value={data.razonSocial} />
            <Info label="Tipo contribuyente" value={formatTipo(data.tipoContribuyente)} />
            <Info label="Estado tributario" value={data.estadoTributario} highlight />
            <Info label="Fecha de registro" value={formatDate(data.fechaRegistro || data.createdAt)} />
            <Info
              label="Actividad economica"
              value={actividadesList[0] || data.actividadesEconomicas || "No registra"}
            />
          </div>
          <button
            type="button"
            onClick={() => onNavigate("ruc_reimpresion")}
            className="mt-5 inline-flex items-center gap-2 rounded-xl bg-blue-50 px-4 py-3 text-sm font-black text-blue-700 transition hover:bg-blue-100"
          >
            Ver informacion completa del RUC
            <ArrowRight size={16} />
          </button>
        </section>

        <div className="space-y-4 2xl:space-y-6">
          <section className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm 2xl:p-6 [@media(min-width:1800px)]:p-8">
            <SectionTitle icon={<FileSpreadsheet size={18} />} title="Obligaciones pendientes" action="Ver todas" />
            <div className="mt-5 space-y-3">
              {mockObligacionesPendientes.map((item) => (
                <div key={item.titulo} className="rounded-2xl border border-amber-200 bg-amber-50/60 p-4">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <h3 className="font-black text-[#003565]">{item.titulo}</h3>
                    <span className="w-fit rounded-lg bg-amber-100 px-3 py-1 text-[11px] font-black uppercase text-amber-700">
                      {item.etiqueta}
                    </span>
                  </div>
                  <p className="mt-3 text-sm font-semibold text-slate-600">{item.periodo}</p>
                  <p className="mt-1 text-sm font-semibold text-slate-600">{item.fechaLimite}</p>
                  <button
                    type="button"
                    onClick={() => onNavigate("declaracion_104")}
                    className="mt-3 inline-flex items-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-4 py-2 text-xs font-black text-blue-700 transition hover:bg-blue-100"
                  >
                    <Send size={14} />
                    Presentar declaracion
                  </button>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm 2xl:p-6 [@media(min-width:1800px)]:p-8">
            <SectionTitle icon={<Sparkles size={18} />} title="Acciones rapidas" />
            <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <QuickAction icon={<Building2 size={18} />} label="Generar RUC" onClick={() => onNavigate("ruc_reimpresion")} tone="blue" />
              <QuickAction icon={<FileSpreadsheet size={18} />} label="Nueva declaracion" onClick={() => onNavigate("declaracion_elaboracion")} tone="emerald" />
              <QuickAction icon={<FolderKanban size={18} />} label="Subir anexo" onClick={() => onNavigate("anexo_ats")} tone="violet" />
              <QuickAction icon={<BadgeCheck size={18} />} label="Estado tributario" onClick={() => onNavigate("ruc_actualizacion")} tone="cyan" />
            </div>
          </section>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 xl:grid-cols-2 2xl:gap-6">
        <section className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm 2xl:p-6 [@media(min-width:1800px)]:p-8">
          <SectionTitle icon={<Activity size={18} />} title="Actividad reciente" action="Ver todo" />
          <div className="mt-5 space-y-4">
            {mockActividadReciente.map((item) => (
              <div key={item.titulo} className="flex gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
                  <CheckCircle2 size={18} />
                </div>
                <div>
                  <p className="font-black text-[#003565]">{item.titulo}</p>
                  <p className="text-sm font-semibold text-slate-500">{item.detalle}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm 2xl:p-6 [@media(min-width:1800px)]:p-8">
          <SectionTitle icon={<CalendarDays size={18} />} title="Calendario tributario" action="Ver calendario completo" />
          <div className="mt-5 space-y-3">
            {mockCalendarioTributario.map((item) => (
              <div key={`${item.mes}-${item.dia}-${item.titulo}`} className="flex items-center gap-4 rounded-2xl border border-slate-100 bg-slate-50 p-4">
                <div className="w-14 shrink-0 rounded-2xl bg-white p-3 text-center shadow-sm 2xl:w-16">
                  <p className="text-[11px] font-black text-red-500">{item.mes}</p>
                  <p className="text-2xl font-black text-[#003565]">{item.dia}</p>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-black text-[#003565]">{item.titulo}</p>
                </div>
                <span className="hidden rounded-lg bg-amber-100 px-3 py-1 text-[11px] font-black text-amber-700 sm:inline">
                  {item.etiqueta}
                </span>
              </div>
            ))}
          </div>
        </section>
      </section>
    </div>
  );
}

function HeroButton({
  icon,
  label,
  onClick,
  primary = false,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  primary?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-black transition [@media(min-width:1800px)]:px-5 [@media(min-width:1800px)]:py-3 ${
        primary
          ? "bg-white text-[#003565] shadow hover:bg-blue-50"
          : "border border-white/15 bg-white/10 text-white hover:bg-white/15"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

function MetricCard({
  detail,
  icon,
  label,
  tone,
  value,
}: {
  detail: string;
  icon: React.ReactNode;
  label: string;
  tone: "emerald" | "blue" | "violet" | "amber";
  value: string;
}) {
  const tones = {
    emerald: "bg-emerald-50 text-emerald-700",
    blue: "bg-blue-50 text-blue-700",
    violet: "bg-violet-50 text-violet-700",
    amber: "bg-amber-50 text-amber-700",
  };

  return (
    <div className="flex min-w-0 items-center gap-3 rounded-[1.5rem] border border-slate-200 bg-white p-4 shadow-sm 2xl:gap-4 2xl:p-5 [@media(min-width:1800px)]:p-6">
      <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl 2xl:h-14 2xl:w-14 [@media(min-width:1800px)]:h-16 [@media(min-width:1800px)]:w-16 ${tones[tone]}`}>
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-[10px] font-black uppercase tracking-wide text-slate-400">
          {label}
        </p>
        <p className="truncate text-xl font-black text-[#003565] 2xl:text-2xl [@media(min-width:1800px)]:text-3xl">{value}</p>
        <p className="mt-1 text-xs font-semibold text-slate-500">{detail}</p>
      </div>
    </div>
  );
}

function SectionTitle({
  action,
  icon,
  title,
}: {
  action?: string;
  icon: React.ReactNode;
  title: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
          {icon}
        </div>
        <h2 className="font-black text-[#003565]">{title}</h2>
      </div>
      {action && (
        <button className="rounded-xl border border-blue-100 bg-blue-50 px-3 py-2 text-xs font-black text-blue-700">
          {action}
        </button>
      )}
    </div>
  );
}

function Info({
  highlight = false,
  label,
  value,
}: {
  highlight?: boolean;
  label: string;
  value?: string | null;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <p className="text-[11px] font-black uppercase tracking-wide text-slate-400">
        {label}
      </p>
      <p
        className={`mt-2 text-sm font-black ${
          highlight
            ? "inline-flex rounded-lg bg-emerald-50 px-2 py-1 text-emerald-700"
            : "text-[#003565]"
        }`}
      >
        {value || "-"}
      </p>
    </div>
  );
}

function QuickAction({
  icon,
  label,
  onClick,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  tone: "blue" | "emerald" | "violet" | "cyan";
}) {
  const tones = {
    blue: "bg-blue-50 text-blue-700",
    emerald: "bg-emerald-50 text-emerald-700",
    violet: "bg-violet-50 text-violet-700",
    cyan: "bg-cyan-50 text-cyan-700",
  };

  return (
    <button
      type="button"
      onClick={onClick}
      className="flex flex-col items-center gap-2 rounded-2xl border border-slate-100 bg-white p-3 text-center transition hover:bg-slate-50"
    >
      <span className={`flex h-11 w-11 items-center justify-center rounded-2xl ${tones[tone]}`}>
        {icon}
      </span>
      <span className="text-xs font-black text-[#003565]">{label}</span>
    </button>
  );
}

function formatDate(value?: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("es-EC");
}

function formatTipo(value: ContribuyenteData["tipoContribuyente"]) {
  return value === "PERSONA_NATURAL" ? "Persona natural" : "Sociedad";
}

function getFirstName(value: string) {
  return value.split(" ").filter(Boolean)[0] || "contribuyente";
}

import {
  BadgeCheck,
  Bell,
  Building2,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  Download,
  FileText,
  FolderKanban,
  RefreshCcw,
  Sparkles,
} from "lucide-react";
import type { ReactNode } from "react";
import { formatDiasAcceso, type AccessInfo } from "../../utils/acceso";
import type { ContribuyenteData } from "../../views/DashboardView";

interface DashboardHomeProps {
  data: ContribuyenteData;
  accessInfo: AccessInfo;
  obligacionesList: string[];
  onNavigate: (tab: string) => void;
  onRefresh: () => void;
}

export default function DashboardHome({
  data,
  accessInfo,
  obligacionesList,
  onNavigate,
  onRefresh,
}: DashboardHomeProps) {
  const obligacionesRegistradas = obligacionesList.length;
  const estadoTone = getEstadoTone(data.estadoTributario || data.estadoRuc);

  return (
    <div className="w-full space-y-4 2xl:space-y-5">
      <section className="relative min-h-[250px] overflow-hidden rounded-[22px] bg-[linear-gradient(120deg,var(--dashboard-hero-start)_0%,var(--dashboard-hero-middle)_48%,var(--dashboard-hero-end)_100%)] px-7 py-6 text-white shadow-[0_18px_42px_rgba(11,53,120,0.26)] lg:px-10 lg:py-6">
        <div className="absolute inset-0 bg-[#08245f]/10" />
        <div className="absolute inset-0 opacity-80">
          <div className="absolute -left-20 -top-28 h-72 w-72 rounded-full bg-sky-300/10" />
          <div className="absolute left-[53%] top-8 h-40 w-40 rounded-full bg-white/7" />
          <div className="absolute right-7 top-20 h-52 w-52 rounded-full bg-white/8" />
          <div className="absolute bottom-5 left-[47%] h-px w-80 rotate-[-30deg] bg-white/25" />
        </div>

        <div className="relative z-10 grid min-h-[198px] items-center gap-6 lg:grid-cols-[minmax(0,0.95fr)_minmax(380px,1fr)]">
          <div className="max-w-2xl">
            <p className="text-sm font-black text-blue-50">
              Bienvenida de nuevo, {getFirstName(data.razonSocial, data.tipoContribuyente)}
            </p>
            <h1 className="mt-3 max-w-xl text-4xl font-black leading-[1.04] text-white lg:text-[40px]">
              Panel tributario del contribuyente
            </h1>
            <p className="mt-3 max-w-2xl text-[15px] font-semibold leading-6 text-blue-50/90 lg:text-base">
              Consulta y gestiona tu informacion tributaria de manera rapida,
              segura y facil desde el portal transaccional del SRI.
            </p>

            <div className="mt-5 flex flex-wrap gap-3">
              <HeroButton icon={<RefreshCcw size={17} />} label="Actualizar datos" onClick={onRefresh} primary />
              <HeroButton icon={<FileText size={17} />} label="Declaraciones" onClick={() => onNavigate("declaracion_elaboracion")} />
              <HeroButton icon={<FolderKanban size={17} />} label="Anexos" onClick={() => onNavigate("anexo_ats")} />
            </div>
          </div>

          <HeroIllustration />
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          icon={<Building2 size={28} />}
          label="Estado RUC"
          value={data.estadoRuc || "-"}
          detail={data.estadoTributario || "Estado registrado"}
          tone="emerald"
        />
        <MetricCard
          icon={<Sparkles size={28} />}
          label="Regimen tributario"
          value={data.regimen || "-"}
          detail="Regimen registrado"
          tone="blue"
        />
        <MetricCard
          icon={<ClipboardList size={28} />}
          label="Obligaciones registradas"
          value={String(obligacionesRegistradas)}
          detail={obligacionesRegistradas === 1 ? "Dentro del regimen" : "Desde ficha del contribuyente"}
          tone="violet"
        />
        <MetricCard
          icon={<CalendarDays size={28} />}
          label="Dias de acceso"
          value={formatAccessValue(accessInfo)}
          detail={accessInfo.fechaExpiracion ? `Expira el ${formatDate(accessInfo.fechaExpiracion)}` : "Sin fecha registrada"}
          tone="amber"
        />
      </section>

      <section className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.12fr)_minmax(360px,0.88fr)]">
        <section className="rounded-[18px] border border-slate-200/80 bg-white p-5 shadow-[0_10px_30px_rgba(15,23,42,0.06)] lg:p-6">
          <SectionTitle icon={<BadgeCheck size={18} />} title="Resumen del contribuyente" />
          <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-2">
            <Info label="RUC" value={data.ruc} />
            <Info label="Razon social" value={data.razonSocial} />
            <Info label="Tipo contribuyente" value={formatTipo(data.tipoContribuyente)} />
            <Info label="Estado tributario" value={data.estadoTributario || data.estadoRuc} highlight tone={estadoTone} />
          </div>
        </section>

        <section className="rounded-[18px] border border-slate-200/80 bg-white p-5 shadow-[0_10px_30px_rgba(15,23,42,0.06)] lg:p-6">
          <SectionTitle
            icon={<FileText size={18} />}
            title="Obligaciones pendientes"
            action="Ver todas"
            onAction={() => onNavigate("declaracion_consulta")}
          />
          <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50/80 p-5">
            <div className="flex items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
                <CheckCircle2 size={20} />
              </span>
              <div>
                <h3 className="font-black text-[#082b68]">No tienes obligaciones pendientes.</h3>
                <p className="mt-1 text-sm font-semibold leading-5 text-slate-500">
                  La ficha actual registra {obligacionesRegistradas} obligacion{obligacionesRegistradas === 1 ? "" : "es"}, pero no reporta vencimientos pendientes con fecha limite.
                </p>
              </div>
            </div>
          </div>
        </section>
      </section>

      <section className="relative overflow-hidden rounded-[18px] border border-slate-200/80 bg-white px-5 py-4 shadow-[0_10px_30px_rgba(15,23,42,0.06)] lg:px-6">
        <h2 className="text-xl font-black text-[#082b68]">Accesos rapidos</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <QuickAccess icon={<Sparkles size={18} />} title="Nueva declaracion" subtitle="Crear y enviar" onClick={() => onNavigate("declaracion_elaboracion")} tone="violet" />
          <QuickAccess icon={<FileText size={18} />} title="Consultar declaraciones" subtitle="Historial de envios" onClick={() => onNavigate("declaracion_consulta")} tone="emerald" />
          <QuickAccess icon={<Download size={18} />} title="Descargar comprobantes" subtitle="Certificado RUC" onClick={() => onNavigate("ruc_reimpresion")} tone="green" />
          <QuickAccess icon={<Bell size={18} />} title="Ver notificaciones" subtitle="Mensajes del SRI" onClick={() => onNavigate("inicio")} tone="blue" />
        </div>
        <div aria-hidden="true" className="pointer-events-none absolute bottom-0 right-8 hidden h-28 w-40 text-blue-100 xl:block">
          <DecorativeLaptop />
        </div>
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
  icon: ReactNode;
  label: string;
  onClick: () => void;
  primary?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex min-h-11 items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-black transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80 ${
        primary
          ? "bg-white text-[#133b8c] shadow hover:bg-blue-50"
          : "border border-white/30 bg-white/10 text-white hover:bg-white/20"
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
  icon: ReactNode;
  label: string;
  tone: "emerald" | "blue" | "violet" | "amber";
  value: string;
}) {
  const tones = {
    emerald: "bg-emerald-50 text-emerald-700",
    blue: "bg-blue-50 text-blue-700",
    violet: "bg-violet-50 text-violet-700",
    amber: "bg-orange-50 text-orange-600",
  };

  return (
    <div className="flex min-h-[104px] min-w-0 items-center gap-4 rounded-[18px] border border-slate-200/80 bg-white p-5 shadow-[0_10px_30px_rgba(15,23,42,0.06)]">
      <div className={`flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl ${tones[tone]}`}>
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-[11px] font-black uppercase text-slate-500">
          {label}
        </p>
        <p className="mt-1 truncate text-2xl font-black leading-7 text-[#082b68]">{value}</p>
        <p className="mt-1 text-xs font-semibold leading-4 text-slate-500">{detail}</p>
      </div>
    </div>
  );
}

function SectionTitle({
  action,
  icon,
  onAction,
  title,
}: {
  action?: string;
  icon: ReactNode;
  onAction?: () => void;
  title: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex min-w-0 items-center gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
          {icon}
        </div>
        <h2 className="truncate text-lg font-black text-[#082b68]">{title}</h2>
      </div>
      {action && (
        <button
          type="button"
          onClick={onAction}
          className="shrink-0 rounded-xl bg-blue-50 px-4 py-2 text-xs font-black text-blue-700 transition hover:bg-blue-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
        >
          {action}
        </button>
      )}
    </div>
  );
}

function Info({
  highlight = false,
  label,
  tone = "green",
  value,
}: {
  highlight?: boolean;
  label: string;
  tone?: "green" | "yellow" | "red";
  value?: string | null;
}) {
  const tones = {
    green: "bg-emerald-50 text-emerald-700",
    yellow: "bg-amber-50 text-amber-700",
    red: "bg-red-50 text-red-700",
  };

  return (
    <div className="min-w-0 rounded-xl border border-slate-200 bg-slate-50/70 px-4 py-3">
      <p className="text-[11px] font-black uppercase text-slate-500">
        {label}
      </p>
      {highlight ? (
        <p className={`mt-2 inline-flex max-w-full rounded-lg px-2 py-1 text-sm font-black ${tones[tone]}`}>
          <span className="truncate">{value || "-"}</span>
        </p>
      ) : (
        <p className="mt-2 truncate text-sm font-black text-[#082b68]">{value || "-"}</p>
      )}
    </div>
  );
}

function QuickAccess({
  icon,
  onClick,
  subtitle,
  title,
  tone,
}: {
  icon: ReactNode;
  onClick: () => void;
  subtitle: string;
  title: string;
  tone: "violet" | "emerald" | "green" | "blue";
}) {
  const tones = {
    violet: "bg-violet-50 text-violet-600",
    emerald: "bg-emerald-50 text-emerald-700",
    green: "bg-green-50 text-green-700",
    blue: "bg-blue-50 text-blue-700",
  };

  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex min-h-[58px] min-w-0 items-center gap-3 rounded-xl px-2 py-2 text-left transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
    >
      <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${tones[tone]}`}>
        {icon}
      </span>
      <span className="min-w-0">
        <span className="block truncate text-sm font-black text-[#082b68]">{title}</span>
        <span className="block truncate text-xs font-semibold text-slate-500">{subtitle}</span>
      </span>
      <ChevronRight size={16} className="ml-auto hidden shrink-0 text-slate-300 transition group-hover:text-blue-500 sm:block" />
    </button>
  );
}

function HeroIllustration() {
  return (
    <div aria-hidden="true" className="relative hidden h-full min-h-[210px] lg:block">
      <svg className="absolute inset-0 h-full w-full" viewBox="0 0 660 240" fill="none">
        <path d="M20 150C105 55 128 202 214 114C289 37 312 156 377 92C456 15 489 89 631 51" stroke="white" strokeOpacity=".26" strokeWidth="2" />
        <ellipse cx="484" cy="207" rx="118" ry="10" fill="#0F2D79" opacity=".18" />
        <rect x="272" y="38" width="258" height="124" rx="16" fill="#EEF4FF" opacity=".97" transform="rotate(-6 272 38)" />
        <rect x="286" y="60" width="113" height="86" rx="9" fill="white" opacity=".78" transform="rotate(-6 286 60)" />
        <rect x="414" y="50" width="94" height="88" rx="9" fill="white" opacity=".9" transform="rotate(-6 414 50)" />
        <path d="M441 86a31 31 0 1 0 60 16" stroke="#6D5DF7" strokeWidth="15" />
        <path d="M499 96a31 31 0 0 0-27-33" stroke="#FDBA74" strokeWidth="15" />
        <path d="M472 63a31 31 0 0 0-31 23" stroke="#38BDF8" strokeWidth="15" />
        <rect x="302" y="77" width="70" height="6" rx="3" fill="#5B6EE1" opacity=".65" transform="rotate(-6 302 77)" />
        <rect x="302" y="97" width="86" height="5" rx="2.5" fill="#C7D2FE" transform="rotate(-6 302 97)" />
        <rect x="302" y="115" width="60" height="5" rx="2.5" fill="#C7D2FE" transform="rotate(-6 302 115)" />
        <path d="M575 82l53 11 13 48c-18 32-43 43-75 34-24-24-31-51-23-82l32-11Z" fill="#DDE8FF" opacity=".95" />
        <path d="M578 93l38 8 9 35c-13 22-30 30-53 24-17-17-22-37-16-60l22-7Z" fill="#1D5DE8" />
        <path d="m574 128 16 15 32-37" stroke="white" strokeWidth="12" strokeLinecap="round" strokeLinejoin="round" />
        <rect x="204" y="142" width="52" height="58" rx="12" fill="#F8FAFC" />
        <path d="M228 144c-3-28-27-46-52-52 3 29 25 48 52 52Z" fill="#6EE7B7" opacity=".82" />
        <path d="M233 143c7-25 31-40 58-41-9 29-30 45-58 41Z" fill="#67E8F9" opacity=".78" />
        <path d="M231 145c-13-31-2-61 21-83 15 31 7 61-21 83Z" fill="#93C5FD" opacity=".85" />
      </svg>
    </div>
  );
}

function DecorativeLaptop() {
  return (
    <svg viewBox="0 0 170 115" fill="none" className="h-full w-full">
      <rect x="56" y="16" width="78" height="58" rx="8" fill="#DBEAFE" />
      <rect x="64" y="25" width="62" height="41" rx="4" fill="#2563EB" />
      <rect x="47" y="74" width="98" height="12" rx="6" fill="#BFDBFE" />
      <rect x="74" y="36" width="10" height="21" rx="2" fill="#93C5FD" />
      <rect x="91" y="31" width="10" height="26" rx="2" fill="#A7F3D0" />
      <rect x="108" y="42" width="10" height="15" rx="2" fill="#FDBA74" />
      <path d="M24 83c22-3 31-18 29-45 18 11 24 28 16 50" stroke="#60A5FA" strokeWidth="6" strokeLinecap="round" />
      <path d="M38 45c-13-14-18-29-14-45 17 8 25 21 24 39" fill="#86EFAC" opacity=".75" />
    </svg>
  );
}

function formatDate(value?: string | Date | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("es-EC");
}

function formatAccessValue(accessInfo: AccessInfo) {
  return formatDiasAcceso(accessInfo);
}

function formatTipo(value: ContribuyenteData["tipoContribuyente"]) {
  return value === "PERSONA_NATURAL" ? "Persona natural" : "Sociedad";
}

function getFirstName(value: string, tipo: ContribuyenteData["tipoContribuyente"]) {
  const parts = value.split(" ").map((part) => part.trim()).filter(Boolean);
  if (parts.length === 0) return "contribuyente";
  if (tipo === "PERSONA_NATURAL" && parts.length >= 3) return parts[parts.length - 2];
  return parts[0];
}

function getEstadoTone(value: string): "green" | "yellow" | "red" {
  const normalized = value.toLowerCase();
  if (normalized.includes("venc") || normalized.includes("suspend") || normalized.includes("inactiv")) return "red";
  if (normalized.includes("oblig") || normalized.includes("pend")) return "yellow";
  return "green";
}

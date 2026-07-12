import { CalendarDays, Search } from "lucide-react";

interface DashboardHeaderProps {
  activeTab: string;
  nombreUsuario: string;
  rucUsuario: string;
  tipoContribuyente: "PERSONA_NATURAL" | "SOCIEDAD";
  now: Date;
}

export default function DashboardHeader({
  activeTab,
  nombreUsuario,
  rucUsuario,
  tipoContribuyente,
  now,
}: DashboardHeaderProps) {
  const initials = getInitials(nombreUsuario);
  const isInicio = activeTab === "inicio";
  const headerTitle = isInicio
    ? `Hola, ${getNombrePila(nombreUsuario, tipoContribuyente)}`
    : getSectionTitle(activeTab);

  return (
    <header className="border-b border-slate-200 bg-white/95 shadow-sm backdrop-blur">
      <div className="grid gap-3 px-4 py-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center xl:grid-cols-[minmax(0,1fr)_minmax(220px,300px)_auto_auto] xl:px-6">
        <div className="min-w-0">
          <h1 className="truncate text-lg font-black leading-tight text-[#003565] xl:text-xl">
            {headerTitle}
          </h1>
          {isInicio && (
            <p className="mt-1 truncate text-xs font-semibold text-slate-500 xl:text-sm">
              Aqui tienes un resumen actualizado de tu informacion tributaria.
            </p>
          )}
        </div>

        <div className="hidden min-w-0 items-center gap-3 rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-slate-500 shadow-sm xl:flex">
            <Search size={18} className="shrink-0 text-slate-400" />
            <input
              aria-label="Buscar en el sistema"
              className="min-w-0 flex-1 bg-transparent text-sm font-semibold outline-none placeholder:text-slate-400"
              placeholder="Buscar en el sistema..."
            />
            <span className="hidden rounded-lg bg-slate-100 px-2 py-1 text-[10px] font-black text-slate-500 sm:inline">
              Ctrl + K
            </span>
          </div>

        <div className="hidden items-center gap-3 rounded-2xl bg-slate-50 px-3 py-2.5 text-slate-700 md:flex lg:justify-self-end xl:justify-self-auto">
            <CalendarDays size={18} className="text-[#006aa6]" />
            <div className="leading-tight">
              <p className="text-[11px] font-bold capitalize text-slate-500">
                {formatDate(now)}
              </p>
              <p className="font-mono text-sm font-black text-[#003565]">
                {formatTime(now)}
              </p>
            </div>
          </div>

        <div className="flex min-w-0 items-center gap-3 rounded-2xl bg-white px-2 py-2 lg:justify-self-end xl:justify-self-auto">
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-blue-500 text-sm font-black text-white">
              {initials}
            </div>
            <div className="min-w-0 leading-tight">
              <p className="max-w-36 truncate text-sm font-black text-[#003565] 2xl:max-w-44">
                {nombreUsuario}
              </p>
              <p className="font-mono text-xs font-semibold text-slate-500">
                RUC: {rucUsuario}
              </p>
            </div>
        </div>
      </div>
    </header>
  );
}

function formatDate(value: Date) {
  return value.toLocaleDateString("es-EC", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

function getNombrePila(
  razonSocial: string,
  tipoContribuyente: DashboardHeaderProps["tipoContribuyente"]
) {
  const parts = razonSocial.split(" ").map((part) => part.trim()).filter(Boolean);

  if (parts.length === 0) return "contribuyente";

  if (tipoContribuyente === "PERSONA_NATURAL" && parts.length >= 3) {
    return parts[parts.length - 2];
  }

  return parts[0];
}

function getSectionTitle(activeTab: string) {
  const titles: Record<string, string> = {
    ruc_inscripcion: "Inscripcion RUC",
    ruc_actualizacion: "Actualizacion RUC",
    ruc_reapertura: "Reapertura RUC",
    ruc_reimpresion: "Reimpresion RUC",
    declaracion_elaboracion: "Declaraciones",
    declaracion_consulta: "Consulta de declaraciones",
    declaracion_107: "Formulario 107 - RDEP",
    declaracion_103: "Formulario 103",
    declaracion_104: "Formulario 104",
    anexo_ats: "ATS",
    anexo_envio: "Envio y consulta de anexos",
    anexo_beneficiario: "Beneficiario pension",
    anexo_dependientes_2022: "Dependientes hasta 2022",
    anexo_cargas_2023: "Cargas desde 2023",
    contabilidad: "Contabilidad",
  };

  return titles[activeTab] || "Portal transaccional";
}

function formatTime(value: Date) {
  return value.toLocaleTimeString("es-EC", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function getInitials(value: string) {
  return value
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

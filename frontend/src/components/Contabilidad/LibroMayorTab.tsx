import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  ArrowDown,
  ArrowUp,
  BookOpen,
  CalendarDays,
  ChevronDown,
  Download,
  Loader2,
  ShieldCheck,
  Users,
} from "lucide-react";
import { authFetch } from "../../api/authApi";

type Props = {
  rucActivo: string;
  preview?: PreviewLike | null;
  onExport?: () => void;
};

type PreviewLike = {
  resumen?: {
    ruc?: string;
    razonSocial?: string;
    periodo?: string;
    moneda?: string;
  };
  periodo?: {
    id?: string | null;
    anio?: number | null;
    mes?: string | null;
    estado?: string | null;
  };
};

type LibroMayorMovimiento = {
  lineaId: string;
  asientoId?: string;
  fecha: string;
  numeroAsiento: string;
  descripcion: string;
  debe: string;
  haber: string;
  saldoDeudor: string | null;
  saldoAcreedor: string | null;
};

type LibroMayorFolio = {
  folio: number;
  cuentaId: string;
  codigoCuenta: string;
  nombreCuenta: string;
  tipoCuenta?: string;
  naturalezaCuenta?: string;
  totalDebe: string;
  totalHaber: string;
  saldoFinalDeudor: string | null;
  saldoFinalAcreedor: string | null;
  movimientos: LibroMayorMovimiento[];
};

type LibroMayorResponse = {
  origen: "PREVIEW" | "PERSISTIDO";
  estadoReporte: string;
  mensaje: string;
  empresa: { ruc: string; razonSocial: string };
  periodo: { anio: number | null; mes: string | null };
  fechaDesde?: string | null;
  fechaHasta?: string | null;
  totalCuentas: number;
  totalFolios: number;
  resumenGlobal: {
    totalDebeDiario: string;
    totalHaberDiario: string;
    totalDebeMayor: string;
    totalHaberMayor: string;
    diferenciaDebe: string;
    diferenciaHaber: string;
    totalMovimientos: number;
  };
  folios: LibroMayorFolio[];
};

const apiUrl = import.meta.env.VITE_API_URL || "http://localhost:3001";
function numberFormat(value: number | string | null | undefined) {
  const numeric = Number(value ?? 0);
  return new Intl.NumberFormat("es-EC", { maximumFractionDigits: 0 }).format(Number.isFinite(numeric) ? numeric : 0);
}

function formatMoney(value: string | null | undefined) {
  if (!value) return "0,00";
  const numeric = Number(value);
  return new Intl.NumberFormat("es-EC", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number.isFinite(numeric) ? numeric : 0);
}

function formatDate(value: string | null | undefined) {
  if (!value) return "";
  const [year, month, day] = String(value).slice(0, 10).split("-");
  return year && month && day ? `${day}/${month}/${year}` : String(value);
}

function parsePeriodMonth(data: LibroMayorResponse, preview?: PreviewLike | null) {
  const raw = String(preview?.resumen?.periodo || data.periodo.mes || "").trim();
  const match = raw.match(/^(\d{4})-(\d{1,2})$/);
  if (match) return { year: Number(match[1]), month: Number(match[2]) };

  const month = Number(data.periodo.mes);
  if (Number.isFinite(month) && month >= 1 && month <= 12 && data.periodo.anio) {
    return { year: Number(data.periodo.anio), month };
  }

  return { year: data.periodo.anio || null, month: null };
}

function monthName(month: number | null) {
  if (!month) return "";
  const names = [
    "Enero",
    "Febrero",
    "Marzo",
    "Abril",
    "Mayo",
    "Junio",
    "Julio",
    "Agosto",
    "Septiembre",
    "Octubre",
    "Noviembre",
    "Diciembre",
  ];
  return names[month - 1] || "";
}

function endOfMonth(year: number, month: number) {
  return new Date(year, month, 0).getDate();
}

function periodInfo(data: LibroMayorResponse, preview?: PreviewLike | null) {
  const parsed = parsePeriodMonth(data, preview);
  const label = [monthName(parsed.month), parsed.year].filter(Boolean).join(" ") || "Periodo contable";
  const start = data.fechaDesde || (parsed.year && parsed.month ? `${parsed.year}-${String(parsed.month).padStart(2, "0")}-01` : "");
  const end = data.fechaHasta || (parsed.year && parsed.month ? `${parsed.year}-${String(parsed.month).padStart(2, "0")}-${String(endOfMonth(parsed.year, parsed.month)).padStart(2, "0")}` : "");

  return {
    label,
    range: [formatDate(start), formatDate(end)].filter(Boolean).join(" - "),
  };
}

function isValid(data: LibroMayorResponse) {
  return data.resumenGlobal.diferenciaDebe === "0.00" && data.resumenGlobal.diferenciaHaber === "0.00";
}

export default function LibroMayorTab({ rucActivo, preview = null, onExport }: Props) {
  const [data, setData] = useState<LibroMayorResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [folioPage, setFolioPage] = useState(1);

  const folios = useMemo(() => data?.folios || [], [data]);
  const totalFolioPages = Math.max(1, folios.length);
  const currentFolioPage = Math.min(folioPage, totalFolioPages);
  const visibleFolio = folios[currentFolioPage - 1] || null;

  useEffect(() => {
    let cancelled = false;

    async function loadMayor() {
      if (!preview) {
        setData(null);
        setError("");
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError("");
        const res = await authFetch(`${apiUrl}/api/contabilidad/${rucActivo}/libro-mayor/preview`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ preview }),
        });
        const json = await res.json().catch(() => null);
        if (!res.ok) throw new Error(json?.message || json?.error || "No se pudo consultar el Libro Mayor.");
        if (!cancelled) {
          setData(json);
          setFolioPage(1);
        }
      } catch {
        if (!cancelled) {
          setError("No se pudo generar el Libro Mayor. Verifique que el Libro Diario esté disponible.");
          setData(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadMayor();
    return () => {
      cancelled = true;
    };
  }, [preview, rucActivo]);

  if (!preview) {
    return (
      <section className="rounded-[18px] border border-slate-200 bg-white p-6 text-sm font-bold text-slate-600 shadow-[0_16px_40px_rgba(15,23,42,0.06)]">
        No existe un Libro Diario generado para este lote y periodo. Genere primero el Libro Diario para consultar el Libro Mayor.
      </section>
    );
  }

  if (loading) {
    return (
      <section className="flex items-center gap-3 rounded-[18px] border border-slate-200 bg-white p-6 text-sm font-black text-slate-600 shadow-[0_16px_40px_rgba(15,23,42,0.06)]">
        <Loader2 className="animate-spin text-[#246bfe]" size={18} />
        Generando Libro Mayor...
      </section>
    );
  }

  if (error) {
    return (
      <section className="flex items-center gap-3 rounded-[18px] border border-red-200 bg-red-50 p-5 text-sm font-bold text-red-700">
        <AlertCircle size={18} />
        {error}
      </section>
    );
  }

  if (!data || folios.length === 0) {
    return (
      <section className="rounded-[18px] border border-slate-200 bg-white p-6 text-sm font-bold text-slate-600 shadow-[0_16px_40px_rgba(15,23,42,0.06)]">
        No existe un Libro Diario generado para este lote y periodo. Genere primero el Libro Diario para consultar el Libro Mayor.
      </section>
    );
  }

  return (
    <div className="space-y-7">
      <LibroMayorResumen data={data} />
      <LibroMayorGeneralHeader data={data} preview={preview} onExport={onExport} />
      {!isValid(data) && (
        <section className="rounded-[18px] border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-700">
          El Libro Mayor no coincide con el Libro Diario. Revise las diferencias antes de continuar.
        </section>
      )}
      {visibleFolio && (
        <LibroMayorFolioSection
          key={visibleFolio.cuentaId || visibleFolio.codigoCuenta}
          folio={visibleFolio}
          page={currentFolioPage}
          totalPages={totalFolioPages}
          onPageChange={setFolioPage}
        />
      )}
    </div>
  );
}

function LibroMayorResumen({ data }: { data: LibroMayorResponse }) {
  return (
    <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
      <Metric icon={<Users size={26} />} label="Cuentas" value={numberFormat(data.totalCuentas)} helper="Cuentas utilizadas" tone="blue" />
      <Metric icon={<BookOpen size={25} />} label="Movimientos" value={numberFormat(data.resumenGlobal.totalMovimientos)} helper="Asientos registrados" tone="sky" />
      <Metric icon={<ArrowDown size={25} />} label="Debe" value={`$${formatMoney(data.resumenGlobal.totalDebeMayor)}`} helper="Total debe" tone="green" />
      <Metric icon={<ArrowUp size={25} />} label="Haber" value={`$${formatMoney(data.resumenGlobal.totalHaberMayor)}`} helper="Total haber" tone="indigo" />
      <Metric icon={<ShieldCheck size={26} />} label="Estado" value={isValid(data) ? "Cuadrado" : "Con diferencias"} helper={isValid(data) ? "Balance verificado" : "Revisión requerida"} tone="purple" />
    </section>
  );
}

function LibroMayorGeneralHeader({
  data,
  preview,
  onExport,
}: {
  data: LibroMayorResponse;
  preview?: PreviewLike | null;
  onExport?: () => void;
}) {
  const period = periodInfo(data, preview);
  const ruc = preview?.resumen?.ruc || data.empresa.ruc;
  const razonSocial = preview?.resumen?.razonSocial || data.empresa.razonSocial;
  const moneda = preview?.resumen?.moneda || "Dólares (USD)";

  return (
    <section className="rounded-[18px] border border-slate-200 bg-white px-6 py-5 shadow-[0_16px_40px_rgba(15,23,42,0.07)]">
      <div className="grid gap-5 lg:grid-cols-[240px_minmax(0,1fr)_auto] lg:items-center">
        <div className="flex items-center gap-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#edf3ff] text-[#246bfe]">
            <CalendarDays size={24} />
          </div>
          <div>
            <p className="text-[11px] font-black uppercase tracking-wide text-[#446198]">Periodo contable</p>
            <p className="mt-3 text-base font-black text-[#071f55]">{period.label}</p>
            <p className="mt-1 text-sm font-semibold text-[#596c9a]">{period.range || "-"}</p>
          </div>
        </div>

        <div className="border-slate-200 lg:border-l lg:pl-6">
          <p className="text-[11px] font-black uppercase tracking-wide text-[#446198]">Información del contribuyente</p>
          <div className="mt-3 space-y-1 text-sm text-[#41527e]">
            <p><span className="font-black text-[#071f55]">RUC:</span> {ruc || "-"}</p>
            <p><span className="font-black text-[#071f55]">Razón Social:</span> {razonSocial || "-"}</p>
            <p><span className="font-black text-[#071f55]">Moneda:</span> {moneda}</p>
          </div>
        </div>

        <button
          type="button"
          onClick={onExport}
          disabled={!onExport}
          className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-5 text-sm font-black text-[#12306b] shadow-sm transition hover:border-[#b8c6e4] hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Download size={17} />
          Exportar
          <ChevronDown size={16} />
        </button>
      </div>
    </section>
  );
}

function LibroMayorFolioSection({
  folio,
  page,
  totalPages,
  onPageChange,
}: {
  folio: LibroMayorFolio;
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}) {
  return (
    <article className="space-y-4">
      <div className="overflow-hidden rounded-[18px] border border-slate-200 bg-white shadow-[0_18px_44px_rgba(15,23,42,0.07)]">
        <header className="border-b border-slate-200 bg-white px-6 py-4">
          <p className="text-sm font-semibold text-[#41527e]">
            <span className="font-black uppercase text-[#071f55]">Código y Denominación:</span>{" "}
            <span className="font-mono text-[#385283]">{folio.codigoCuenta}</span>
            <span className="mx-1 text-slate-400">—</span>
            <span>{folio.nombreCuenta}</span>
          </p>
        </header>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1040px] border-collapse text-sm">
            <thead className="bg-[#f4f7fc] text-[12px] uppercase tracking-[0] text-[#1b376d]">
              <tr>
                <th rowSpan={2} className="w-[118px] border border-slate-200 px-5 py-5 text-left font-black">Fecha</th>
                <th rowSpan={2} className="w-[116px] border border-slate-200 px-5 py-5 text-left font-black">N.º Asiento</th>
                <th rowSpan={2} className="min-w-[420px] border border-slate-200 px-5 py-5 text-left font-black">Glosa de la operación</th>
                <th colSpan={2} className="border border-slate-200 px-5 py-3 text-center font-black">Movimientos</th>
                <th colSpan={2} className="border border-slate-200 px-5 py-3 text-center font-black">Saldos</th>
              </tr>
              <tr>
                <th className="w-[120px] border border-slate-200 px-5 py-4 text-right font-black">Debe</th>
                <th className="w-[120px] border border-slate-200 px-5 py-4 text-right font-black">Haber</th>
                <th className="w-[120px] border border-slate-200 px-5 py-4 text-right font-black">Deudor</th>
                <th className="w-[120px] border border-slate-200 px-5 py-4 text-right font-black">Acreedor</th>
              </tr>
            </thead>
            <tbody>
              {folio.movimientos.map((movement, index) => (
                <tr key={movement.lineaId || `${movement.asientoId || movement.numeroAsiento}-${index}`} className="bg-white text-[#162b5f]">
                  <td className="border border-slate-100 px-5 py-3 font-semibold">{formatDate(movement.fecha)}</td>
                  <td className="border border-slate-100 px-5 py-3">
                    <button type="button" className="font-black text-[#005cff]">AS-{movement.numeroAsiento}</button>
                  </td>
                  <td className="border border-slate-100 px-5 py-3 text-[13px] font-semibold leading-relaxed text-[#243866]">{movement.descripcion}</td>
                  <td className="border border-slate-100 px-5 py-3 text-right font-semibold">{formatMoney(movement.debe)}</td>
                  <td className="border border-slate-100 px-5 py-3 text-right font-semibold">{formatMoney(movement.haber)}</td>
                  <td className="border border-slate-100 px-5 py-3 text-right font-black">{formatMoney(movement.saldoDeudor)}</td>
                  <td className={`border border-slate-100 px-5 py-3 text-right font-black ${Number(movement.saldoAcreedor || 0) > 0 ? "text-[#071f55]" : ""}`}>
                    {formatMoney(movement.saldoAcreedor)}
                  </td>
                </tr>
              ))}
              <tr className="bg-[#f4f7fc] text-[#071f55]">
                <td colSpan={3} className="border border-slate-200 px-5 py-4 text-left font-black uppercase">TOTALES</td>
                <td className="border border-slate-200 px-5 py-4 text-right font-black">{formatMoney(folio.totalDebe)}</td>
                <td className="border border-slate-200 px-5 py-4 text-right font-black">{formatMoney(folio.totalHaber)}</td>
                <td className="border border-slate-200 px-5 py-4 text-right font-black">{formatMoney(folio.saldoFinalDeudor)}</td>
                <td className="border border-slate-200 px-5 py-4 text-right font-black">{formatMoney(folio.saldoFinalAcreedor)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
      <FolioPagination page={page} totalPages={totalPages} onPageChange={onPageChange} />
    </article>
  );
}

function FolioPagination({
  page,
  totalPages,
  onPageChange,
}: {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}) {
  const pages = paginationPages(page, totalPages);

  return (
    <footer className="flex flex-col gap-4 rounded-[18px] border border-slate-200 bg-white px-6 py-4 text-sm text-[#506398] shadow-[0_14px_34px_rgba(15,23,42,0.05)] md:flex-row md:items-center md:justify-between">
      <p className="font-semibold">Mostrando folio {page} de {totalPages}</p>
      <div className="flex flex-wrap items-center justify-center gap-2">
        <button
          type="button"
          onClick={() => onPageChange(Math.max(1, page - 1))}
          disabled={page <= 1}
          className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm font-black text-[#314779] disabled:cursor-not-allowed disabled:opacity-40"
        >
          Anterior
        </button>
        {pages.map((item, index) =>
          item === "ellipsis" ? (
            <span key={`ellipsis-${index}`} className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white font-black text-slate-400">...</span>
          ) : (
            <button
              key={item}
              type="button"
              onClick={() => onPageChange(item)}
              className={`h-9 min-w-9 rounded-lg border px-3 text-sm font-black transition ${
                item === page
                  ? "border-[#d8e2f5] bg-[#f4f7ff] text-[#005cff]"
                  : "border-slate-200 bg-white text-[#314779] hover:bg-slate-50"
              }`}
            >
              {item}
            </button>
          )
        )}
        <button
          type="button"
          onClick={() => onPageChange(Math.min(totalPages, page + 1))}
          disabled={page >= totalPages}
          className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm font-black text-[#314779] disabled:cursor-not-allowed disabled:opacity-40"
        >
          Siguiente
        </button>
      </div>
    </footer>
  );
}

function paginationPages(page: number, totalPages: number): Array<number | "ellipsis"> {
  if (totalPages <= 5) return Array.from({ length: totalPages }, (_, index) => index + 1);
  const pages = new Set([1, page, Math.min(page + 1, totalPages), totalPages]);
  if (page <= 3) pages.add(2).add(3);
  if (page >= totalPages - 2) pages.add(totalPages - 1).add(totalPages - 2);
  const ordered = [...pages].filter((item) => item >= 1 && item <= totalPages).sort((a, b) => a - b);
  return ordered.flatMap((item, index) => (index > 0 && item - ordered[index - 1] > 1 ? ["ellipsis", item] : [item]));
}

function Metric({
  icon,
  label,
  value,
  helper,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  helper: string;
  tone: "blue" | "sky" | "green" | "indigo" | "purple";
}) {
  const tones = {
    blue: "bg-[#edf3ff] text-[#173b8e]",
    sky: "bg-[#eaf3ff] text-[#246bfe]",
    green: "bg-[#e8f8ec] text-[#16a34a]",
    indigo: "bg-[#eef3ff] text-[#246bfe]",
    purple: "bg-[#f4e8ff] text-[#7c2dff]",
  }[tone];

  return (
    <div className="flex min-h-[96px] items-center gap-4 rounded-[16px] border border-slate-200 bg-white px-5 py-4 shadow-[0_14px_34px_rgba(15,23,42,0.07)]">
      <div className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-full ${tones}`}>
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-[11px] font-black uppercase tracking-wide text-[#446198]">{label}</p>
        <p className="mt-2 truncate text-lg font-black text-[#071f55]">{value || "-"}</p>
        <p className="mt-1 truncate text-xs font-semibold text-[#41527e]">{helper}</p>
      </div>
    </div>
  );
}

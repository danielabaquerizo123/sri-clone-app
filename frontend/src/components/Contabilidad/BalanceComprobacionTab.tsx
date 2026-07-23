import { useEffect, useMemo, useState } from "react";
import { AlertCircle, CheckCircle2, Download, Loader2, Scale } from "lucide-react";
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
};

type BalanceRow = {
  numero: number;
  cuenta: string;
  codigo: string;
  tipoCuenta?: string;
  naturalezaCuenta?: string;
  debe: string;
  haber: string;
  deudor: string;
  acreedor: string;
};

type BalanceResponse = {
  origen: "PREVIEW" | "PERSISTIDO";
  empresa: { ruc: string; razonSocial: string };
  periodo: { anio: number | null; mes: string | null };
  fechaDesde: string | null;
  fechaHasta: string | null;
  moneda: string;
  filas: BalanceRow[];
  resumen: {
    totalCuentas: number;
    totalDebe: string;
    totalHaber: string;
    totalDeudor: string;
    totalAcreedor: string;
    diferenciaSumas: string;
    diferenciaSaldos: string;
    cuadradoSumas: boolean;
    cuadradoSaldos: boolean;
  };
};

const apiUrl = import.meta.env.VITE_API_URL || "http://localhost:3001";

function formatMoney(value: string | number | null | undefined) {
  const numeric = Number(value ?? 0);
  return new Intl.NumberFormat("es-EC", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number.isFinite(numeric) ? numeric : 0);
}

function formatDate(value: string | null | undefined) {
  if (!value) return "";
  const [year, month, day] = String(value).slice(0, 10).split("-");
  return year && month && day ? `${day}/${month}/${year}` : String(value);
}

function periodLabel(data: BalanceResponse, preview?: PreviewLike | null) {
  const raw = String(preview?.resumen?.periodo || "").trim();
  if (raw) return raw;
  return [data.periodo.mes, data.periodo.anio].filter(Boolean).join("/") || "Periodo contable";
}

function moneyCell(value: string | null | undefined) {
  return Number(value || 0) > 0 ? formatMoney(value) : "";
}

export default function BalanceComprobacionTab({ rucActivo, preview = null, onExport }: Props) {
  const [data, setData] = useState<BalanceResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const rows = useMemo(() => data?.filas || [], [data]);

  useEffect(() => {
    let cancelled = false;

    async function loadBalance() {
      if (!preview) {
        setData(null);
        setError("");
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError("");
        const res = await authFetch(`${apiUrl}/api/contabilidad/${rucActivo}/balance-comprobacion/preview`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ preview }),
        });
        const json = await res.json().catch(() => null);
        if (!res.ok) throw new Error(json?.message || json?.error || "No se pudo consultar el Balance de Comprobación.");
        if (!cancelled) setData(json);
      } catch {
        if (!cancelled) {
          setError("No se pudo generar el Balance de Comprobación. Verifique que el Libro Diario esté disponible.");
          setData(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadBalance();
    return () => {
      cancelled = true;
    };
  }, [preview, rucActivo]);

  if (!preview) {
    return (
      <section className="rounded-[18px] border border-slate-200 bg-white p-6 text-sm font-bold text-slate-600 shadow-[0_16px_40px_rgba(15,23,42,0.06)]">
        Genere primero el Libro Diario para consultar el Balance de Comprobación.
      </section>
    );
  }

  if (loading) {
    return (
      <section className="flex items-center gap-3 rounded-[18px] border border-slate-200 bg-white p-6 text-sm font-black text-slate-600 shadow-[0_16px_40px_rgba(15,23,42,0.06)]">
        <Loader2 className="animate-spin text-[#246bfe]" size={18} />
        Generando Balance de Comprobación...
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

  if (!data) {
    return (
      <section className="rounded-[18px] border border-slate-200 bg-white p-6 text-sm font-bold text-slate-600 shadow-[0_16px_40px_rgba(15,23,42,0.06)]">
        No existe información suficiente para generar el Balance de Comprobación.
      </section>
    );
  }

  const valid = data.resumen.cuadradoSumas && data.resumen.cuadradoSaldos;
  const ruc = preview?.resumen?.ruc || data.empresa.ruc;
  const razonSocial = preview?.resumen?.razonSocial || data.empresa.razonSocial;

  return (
    <div className="space-y-6">
      <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Metric label="Cuentas" value={String(data.resumen.totalCuentas)} />
        <Metric label="Sumas" value={`$${formatMoney(data.resumen.totalDebe)}`} />
        <Metric label="Estado" value={valid ? "Cuadrado" : "Con diferencias"} />
      </section>

      <section className="rounded-[18px] border border-slate-200 bg-white px-6 py-5 shadow-[0_16px_40px_rgba(15,23,42,0.07)]">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-1 text-sm text-[#41527e]">
            <h1 className="text-xl font-black text-[#071f55]">Balance de Comprobación</h1>
            <p><span className="font-black text-[#071f55]">Razón Social:</span> {razonSocial || "-"}</p>
            <p><span className="font-black text-[#071f55]">RUC:</span> {ruc || "-"}</p>
            <p><span className="font-black text-[#071f55]">Periodo:</span> {periodLabel(data, preview)}</p>
            <p><span className="font-black text-[#071f55]">Fecha:</span> {[formatDate(data.fechaDesde), formatDate(data.fechaHasta)].filter(Boolean).join(" - ") || "-"}</p>
            <p><span className="font-black text-[#071f55]">Expresado en:</span> {data.moneda || "Dólares (USD)"}</p>
          </div>
          <button
            type="button"
            onClick={onExport}
            disabled={!onExport}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-5 text-sm font-black text-[#12306b] shadow-sm transition hover:border-[#b8c6e4] hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Download size={17} />
            Exportar Excel
          </button>
        </div>
      </section>

      {!valid && (
        <section className="flex items-center gap-3 rounded-[18px] border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-700">
          <AlertCircle size={18} />
          El Balance de Comprobación presenta diferencias. Revise las sumas y saldos antes de continuar.
        </section>
      )}

      <section className="overflow-hidden rounded-[18px] border border-slate-200 bg-white shadow-[0_18px_44px_rgba(15,23,42,0.07)]">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] border-collapse text-sm">
            <thead className="bg-[#f4f7fc] text-[12px] uppercase text-[#1b376d]">
              <tr>
                <th rowSpan={2} className="w-[70px] border border-slate-200 px-4 py-4 text-right font-black">N°</th>
                <th rowSpan={2} className="min-w-[330px] border border-slate-200 px-4 py-4 text-left font-black">Cuenta</th>
                <th rowSpan={2} className="w-[150px] border border-slate-200 px-4 py-4 text-left font-black">Código</th>
                <th colSpan={2} className="border border-slate-200 px-4 py-3 text-center font-black">Sumas</th>
                <th colSpan={2} className="border border-slate-200 px-4 py-3 text-center font-black">Saldos</th>
              </tr>
              <tr>
                <th className="w-[120px] border border-slate-200 px-4 py-3 text-right font-black">Debe</th>
                <th className="w-[120px] border border-slate-200 px-4 py-3 text-right font-black">Haber</th>
                <th className="w-[120px] border border-slate-200 px-4 py-3 text-right font-black">Deudor</th>
                <th className="w-[120px] border border-slate-200 px-4 py-3 text-right font-black">Acreedor</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.codigo} className="text-[#162b5f]">
                  <td className="border border-slate-100 px-4 py-3 text-right font-semibold">{row.numero}</td>
                  <td className="border border-slate-100 px-4 py-3 font-semibold">{row.cuenta}</td>
                  <td className="border border-slate-100 px-4 py-3 font-mono text-xs font-bold">{row.codigo}</td>
                  <td className="border border-slate-100 px-4 py-3 text-right font-semibold">{moneyCell(row.debe)}</td>
                  <td className="border border-slate-100 px-4 py-3 text-right font-semibold">{moneyCell(row.haber)}</td>
                  <td className="border border-slate-100 px-4 py-3 text-right font-black">{moneyCell(row.deudor)}</td>
                  <td className="border border-slate-100 px-4 py-3 text-right font-black">{moneyCell(row.acreedor)}</td>
                </tr>
              ))}
              <tr className="bg-[#f4f7fc] text-[#071f55]">
                <td colSpan={3} className="border border-slate-200 px-4 py-4 text-left font-black uppercase">Totales</td>
                <td className="border border-slate-200 px-4 py-4 text-right font-black">{formatMoney(data.resumen.totalDebe)}</td>
                <td className="border border-slate-200 px-4 py-4 text-right font-black">{formatMoney(data.resumen.totalHaber)}</td>
                <td className="border border-slate-200 px-4 py-4 text-right font-black">{formatMoney(data.resumen.totalDeudor)}</td>
                <td className="border border-slate-200 px-4 py-4 text-right font-black">{formatMoney(data.resumen.totalAcreedor)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex min-h-[96px] items-center gap-4 rounded-[16px] border border-slate-200 bg-white px-5 py-4 shadow-[0_14px_34px_rgba(15,23,42,0.07)]">
      <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-[#edf3ff] text-[#173b8e]">
        {label === "Estado" ? <CheckCircle2 size={26} /> : <Scale size={26} />}
      </div>
      <div className="min-w-0">
        <p className="text-[11px] font-black uppercase text-[#446198]">{label}</p>
        <p className="mt-2 truncate text-lg font-black text-[#071f55]">{value}</p>
      </div>
    </div>
  );
}

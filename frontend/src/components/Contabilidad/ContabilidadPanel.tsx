import { useMemo, useState } from "react";
import { AlertCircle, FileSpreadsheet, Loader2, Upload } from "lucide-react";
import LibroDiarioTab from "./LibroDiarioTab";
import { authFetch } from "../../api/authApi";
import {
  normalizeLibroDiarioResponse,
  type ContabilidadIssue,
  type LibroDiarioResponse,
} from "./contabilidadResponse";

type Props = {
  rucActivo: string;
};

export type JournalVisualRow = {
  asiento: number;
  fecha: string;
  codigoCuenta: string;
  nombreCuenta: string;
  descripcion: string;
  debe: string;
  haber: string;
};

const apiUrl = import.meta.env.VITE_API_URL || "http://localhost:3001";

export default function ContabilidadPanel({ rucActivo }: Props) {
  const [archivo, setArchivo] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [response, setResponse] = useState<LibroDiarioResponse | null>(null);

  const visibleIssues = useMemo(
    () => (response?.issues || []).filter((issue) => issue.tipo !== "INFO"),
    [response]
  );

  async function cargarLibroDiario() {
    if (!archivo) {
      setError("Selecciona un archivo Excel ATS.");
      return;
    }

    try {
      setLoading(true);
      setError("");
      setResponse(null);

      const formData = new FormData();
      formData.append("archivo", archivo);

      const res = await authFetch(
        `${apiUrl}/api/contabilidad/${rucActivo}/procesar-excel-libro-diario`,
        {
          method: "POST",
          body: formData,
        }
      );
      const data = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(data?.message || data?.error || "No se pudo generar el Libro Diario.");
      }

      setResponse(normalizeLibroDiarioResponse(data));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error generando Libro Diario.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6 pr-2">
      <section className="rounded-[2rem] border bg-white p-7 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="rounded-2xl bg-slate-100 p-4 text-slate-700">
            <FileSpreadsheet size={28} />
          </div>
          <div>
            <h1 className="text-2xl font-black text-[#003565]">Libro Diario desde ATS</h1>
            <p className="text-sm text-slate-500">
              Solo se leerán las pestañas COMPRAS, VENTAS y GASTOS
            </p>
          </div>
        </div>
      </section>

      <section className="rounded-[2rem] border bg-white p-7 shadow-sm">
        <label className="block">
          <span className="text-[11px] font-black uppercase text-slate-400">
            Archivo Excel ATS
          </span>
          <div className="mt-2 flex flex-col gap-3 md:flex-row md:items-center">
            <input
              type="file"
              accept=".xlsx,.xls"
              onChange={(event) => {
                setArchivo(event.target.files?.[0] || null);
                setResponse(null);
                setError("");
              }}
              className="block w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold"
            />
            <button
              type="button"
              onClick={cargarLibroDiario}
              disabled={loading}
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[#003565] px-5 py-3 text-sm font-black text-white shadow disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? <Loader2 className="animate-spin" size={18} /> : <Upload size={18} />}
              {loading ? "Cargando..." : "Cargar"}
            </button>
          </div>
        </label>

        <div className="mt-4 rounded-2xl border border-sky-200 bg-sky-50 p-4 text-sm font-bold text-sky-800">
          Solo se leerán las pestañas COMPRAS, VENTAS y GASTOS. Cualquier otra pestaña del
          archivo será ignorada por Contabilidad.
        </div>

        {archivo && (
          <p className="mt-3 text-xs font-semibold text-slate-500">
            Archivo seleccionado: {archivo.name}
          </p>
        )}
      </section>

      {error && (
        <section className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-700">
          {error}
        </section>
      )}

      {response && (
        <>
          <section className="grid grid-cols-1 gap-3 md:grid-cols-4">
            <Info label="Archivo" value={response.resumen.archivo} />
            <Info
              label="Hojas leídas"
              value={
                Array.isArray(response.resumen.hojasLeidas) && response.resumen.hojasLeidas.length > 0
                  ? response.resumen.hojasLeidas.join(", ")
                  : "-"
              }
            />
            <Info label="Compras" value={String(response.resumen.compras)} />
            <Info label="Ventas" value={String(response.resumen.ventas)} />
            <Info label="Gastos" value={String(response.resumen.gastos)} />
            <Info label="Asientos" value={String(response.resumen.asientos)} />
            <Info label="Errores" value={String(response.resumen.errores)} />
            <Info label="Advertencias" value={String(response.resumen.advertencias)} />
            <Info label="Tipo de pago" value={formatCounter(response.resumen.tiposPagoCompras)} />
            <Info label="Forma de pago" value={formatCounter(response.resumen.formasPagoCompras)} />
            <Info label="Forma de cobro" value={formatCounter(response.resumen.formasCobroVentas)} />
          </section>

          {visibleIssues.length > 0 && <IssuesPanel issues={visibleIssues} />}

          <section className="rounded-[2rem] border bg-white p-7 shadow-sm">
            <LibroDiarioTab
              entries={
                Array.isArray(response.libroDiario) && response.libroDiario.length > 0
                  ? response.libroDiario
                  : response.asientos
              }
              rows={[]}
            />
          </section>
        </>
      )}
    </div>
  );
}

function formatCounter(counter: Record<string, number>) {
  const entries = Object.entries(counter || {});
  if (entries.length === 0) return "-";
  return entries.map(([code, amount]) => `${code}: ${amount}`).join(", ");
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border bg-white p-4 shadow-sm">
      <p className="text-[10px] font-black uppercase text-slate-400">{label}</p>
      <p className="mt-1 break-words text-sm font-black text-slate-800">{value || "-"}</p>
    </div>
  );
}

function IssuesPanel({ issues }: { issues: ContabilidadIssue[] }) {
  return (
    <section className="rounded-[2rem] border border-red-200 bg-red-50 p-7 shadow-sm">
      <div className="mb-4 flex items-center gap-3 text-red-800">
        <AlertCircle size={22} />
        <h2 className="text-lg font-black">Filas con errores o advertencias</h2>
      </div>
      <div className="overflow-hidden rounded-lg border border-red-200 bg-white">
        <table className="w-full min-w-[760px] border-collapse text-sm">
          <thead className="bg-red-100 text-red-950">
            <tr>
              <th className="border border-red-200 px-3 py-2 text-left font-black">HOJA</th>
              <th className="border border-red-200 px-3 py-2 text-right font-black">FILA</th>
              <th className="border border-red-200 px-3 py-2 text-left font-black">CAMPO</th>
              <th className="border border-red-200 px-3 py-2 text-left font-black">MENSAJE</th>
            </tr>
          </thead>
          <tbody>
            {issues.map((issue, index) => (
              <tr key={`${issue.hoja || "sin-hoja"}-${issue.fila || 0}-${issue.campo || "general"}-${index}`}>
                <td className="border border-red-100 px-3 py-2">{issue.hoja || "-"}</td>
                <td className="border border-red-100 px-3 py-2 text-right">{issue.fila || "-"}</td>
                <td className="border border-red-100 px-3 py-2">{issue.campo || "-"}</td>
                <td className="border border-red-100 px-3 py-2">{issue.mensaje}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

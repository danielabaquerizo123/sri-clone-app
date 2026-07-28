import { useState } from "react";
import { AlertCircle, Download, Loader2 } from "lucide-react";
import { authFetch } from "../../api/authApi";

type Props = { rucActivo: string; preview: unknown | null };
const apiUrl = import.meta.env.VITE_API_URL || "http://localhost:3001";

export default function ExportarExcelTab({ rucActivo, preview }: Props) {
  const [confirming, setConfirming] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function download() {
    if (!preview) return;
    try {
      setLoading(true);
      setError("");
      setMessage("");
      const response = await authFetch(`${apiUrl}/api/contabilidad/${rucActivo}/procesos/preview/exportar/excel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ preview }),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.message || data?.error || "No se pudo generar el archivo Excel. Intente nuevamente.");
      }
      const disposition = response.headers.get("Content-Disposition") || "";
      const filename = disposition.match(/filename="?([^";]+)"?/i)?.[1] || `Procesos_Contables_${rucActivo}.xlsx`;
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      link.click();
      URL.revokeObjectURL(url);
      setConfirming(false);
      setMessage("Archivo Excel descargado correctamente.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo generar el archivo Excel. Intente nuevamente.");
    } finally {
      setLoading(false);
    }
  }

  if (!preview) return <section className="rounded-[18px] border border-slate-200 bg-white p-6 text-sm font-bold text-slate-600 shadow-[0_16px_40px_rgba(15,23,42,0.06)]">No existen procesos contables para exportar.</section>;

  return <section className="rounded-[18px] border border-slate-200 bg-white p-6 shadow-[0_16px_40px_rgba(15,23,42,0.07)]">
    <h3 className="text-lg font-black text-[#071f55]">Exportar Excel</h3>
    <p className="mt-2 text-sm font-semibold text-[#41527e]">Descargue un único archivo con todos los procesos contables generados.</p>
    <button type="button" onClick={() => setConfirming(true)} disabled={loading} className="mt-5 inline-flex h-11 items-center gap-2 rounded-xl bg-[#005cff] px-5 text-sm font-black text-white transition hover:bg-[#004ad0] disabled:cursor-not-allowed disabled:opacity-50"><Download size={17} />Exportar Excel</button>
    {loading && <p className="mt-4 flex items-center gap-2 text-sm font-bold text-[#41527e]"><Loader2 size={17} className="animate-spin" />Preparando archivo Excel...</p>}
    {message && <p className="mt-4 text-sm font-bold text-emerald-700">{message}</p>}
    {error && <p className="mt-4 flex items-center gap-2 text-sm font-bold text-red-700"><AlertCircle size={17} />{error}</p>}
    {confirming && <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/35 p-4">
      <section className="w-full max-w-md rounded-[18px] border border-slate-200 bg-white p-6 shadow-[0_22px_60px_rgba(15,23,42,0.2)]">
        <h4 className="text-base font-black text-[#071f55]">¿Desea descargar el archivo Excel con todos los procesos contables?</h4>
        <p className="mt-4 text-sm font-semibold text-[#41527e]">El archivo incluirá:</p>
        <ul className="mt-2 space-y-1 text-sm font-semibold text-[#41527e]"><li>Libro Diario</li><li>Libro Mayor</li><li>Balance de Comprobación</li><li>Estado de Resultados</li></ul>
        <div className="mt-6 flex justify-end gap-3">
          <button type="button" onClick={() => setConfirming(false)} disabled={loading} className="h-10 rounded-xl border border-slate-200 px-4 text-sm font-black text-[#314779] disabled:opacity-50">Cancelar</button>
          <button type="button" onClick={() => void download()} disabled={loading} className="inline-flex h-10 items-center gap-2 rounded-xl bg-[#005cff] px-4 text-sm font-black text-white disabled:opacity-50">{loading && <Loader2 size={16} className="animate-spin" />}Descargar Excel</button>
        </div>
      </section>
    </div>}
  </section>;
}

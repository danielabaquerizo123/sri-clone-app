import { useEffect, useState } from "react";
import { AlertCircle, Loader2 } from "lucide-react";
import { authFetch } from "../../api/authApi";

type Props = { rucActivo: string; preview: unknown | null };
type Categoria = "INGRESO_OPERACIONAL" | "OTRO_INGRESO" | "COSTO_VENTAS" | "GASTO_OPERACIONAL" | "GASTO_ADMINISTRATIVO" | "GASTO_VENTAS" | "GASTO_FINANCIERO" | "OTRO_GASTO" | "PARTICIPACION_TRABAJADORES" | "IMPUESTO_RENTA";
type Linea = { cuentaId: string; codigo: string; cuenta: string; categoria: Categoria; valor: string };
type Resultado = {
  empresa: { ruc: string; razonSocial: string };
  periodo: { anio: number | null; mes: string | null };
  moneda: string;
  lineas: Linea[];
  totales: Record<Categoria, string> & Record<"utilidadBruta" | "totalGastosOperacionales" | "utilidadOperacional" | "resultadoAntesParticipacionImpuestos" | "resultadoAntesImpuesto" | "resultadoNeto", string>;
  resultadoFinal: { etiqueta: string; valor: string };
  advertencias: string[];
};

const apiUrl = import.meta.env.VITE_API_URL || "http://localhost:3001";
const grupos: Array<[Categoria, string]> = [
  ["INGRESO_OPERACIONAL", "Ingresos operacionales"],
  ["OTRO_INGRESO", "Otros ingresos"],
  ["COSTO_VENTAS", "Costo de ventas"],
  ["GASTO_OPERACIONAL", "Gastos operacionales"],
  ["GASTO_ADMINISTRATIVO", "Gastos administrativos"],
  ["GASTO_VENTAS", "Gastos de ventas"],
  ["GASTO_FINANCIERO", "Gastos financieros"],
  ["OTRO_GASTO", "Otros gastos"],
  ["PARTICIPACION_TRABAJADORES", "Participación trabajadores"],
  ["IMPUESTO_RENTA", "Impuesto a la renta"],
];

function money(value: string | undefined) {
  return new Intl.NumberFormat("es-EC", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(value || 0));
}

export default function EstadoResultadosTab({ rucActivo, preview }: Props) {
  const [data, setData] = useState<Resultado | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (!preview) {
      setData(null);
      return;
    }
    async function load() {
      try {
        setLoading(true);
        setError("");
        const response = await authFetch(`${apiUrl}/api/contabilidad/${rucActivo}/estado-resultados/preview`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ preview }),
        });
        const result = await response.json().catch(() => null);
        if (!response.ok) throw new Error(result?.message || result?.error || "No se pudo generar el Estado de Resultados.");
        if (!cancelled) setData(result);
      } catch (cause) {
        if (!cancelled) setError(cause instanceof Error ? cause.message : "No se pudo generar el Estado de Resultados.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => { cancelled = true; };
  }, [preview, rucActivo]);

  if (!preview) return <section className="rounded-[18px] border border-slate-200 bg-white p-6 text-sm font-bold text-slate-600 shadow-[0_16px_40px_rgba(15,23,42,0.06)]">Genere primero el Libro Diario para consultar el Estado de Resultados.</section>;
  if (loading) return <section className="flex items-center gap-3 rounded-[18px] border border-slate-200 bg-white p-6 text-sm font-black text-slate-600 shadow-[0_16px_40px_rgba(15,23,42,0.06)]"><Loader2 className="animate-spin text-[#246bfe]" size={18} />Generando Estado de Resultados...</section>;
  if (error) return <section className="flex items-center gap-3 rounded-[18px] border border-red-200 bg-red-50 p-5 text-sm font-bold text-red-700"><AlertCircle size={18} />{error}</section>;
  if (!data) return null;

  return <section className="overflow-hidden rounded-[18px] border border-slate-200 bg-white shadow-[0_18px_44px_rgba(15,23,42,0.07)]">
    <header className="border-b border-slate-200 px-6 py-5 text-[#071f55]">
      <h3 className="text-lg font-black">Estado de Resultados</h3>
      <p className="mt-2 text-sm font-semibold text-[#41527e]">{data.empresa.razonSocial} · RUC: {data.empresa.ruc} · {data.periodo.mes}/{data.periodo.anio} · {data.moneda}</p>
    </header>
    <div className="divide-y divide-slate-100 px-6">
      {grupos.map(([categoria, label]) => {
        const lineas = data.lineas.filter((linea) => linea.categoria === categoria);
        if (!lineas.length) return null;
        return <section key={categoria} className="py-4">
          <div className="mb-2 flex justify-between text-sm font-black text-[#071f55]"><span>{label}</span><span>{money(data.totales[categoria])}</span></div>
          {lineas.map((linea) => <div key={linea.cuentaId} className="flex justify-between py-1 text-sm font-semibold text-[#41527e]"><span><span className="font-mono text-[#385283]">{linea.codigo}</span> · {linea.cuenta}</span><span>{money(linea.valor)}</span></div>)}
        </section>;
      })}
      <section className="space-y-2 py-4 text-sm font-black text-[#071f55]">
        <Total label="Utilidad bruta" value={data.totales.utilidadBruta} />
        <Total label="Total gastos operacionales" value={data.totales.totalGastosOperacionales} />
        <Total label="Utilidad operacional" value={data.totales.utilidadOperacional} />
        <Total label="Resultado antes de impuesto" value={data.totales.resultadoAntesImpuesto} />
        <div className="flex justify-between border-t border-slate-200 pt-3 text-base"><span>{data.resultadoFinal.etiqueta}</span><span>{money(data.resultadoFinal.valor)}</span></div>
      </section>
      {data.advertencias.map((advertencia) => <p key={advertencia} className="py-3 text-sm font-semibold text-amber-700">{advertencia}</p>)}
    </div>
  </section>;
}

function Total({ label, value }: { label: string; value: string }) {
  return <div className="flex justify-between"><span>{label}</span><span>{money(value)}</span></div>;
}

import { useState } from "react";
import { FileSpreadsheet, Loader2, Upload } from "lucide-react";
import BalanceComprobacionTab from "./BalanceComprobacionTab";
import EstadoResultadosTab from "./EstadoResultadosTab";
import LibroDiarioTab from "./LibroDiarioTab";
import LibroMayorTab from "./LibroMayorTab";

type Props = {
  rucActivo: string;
};

type AccountingResponse = {
  message: string;
  resumen: {
    empresa: string;
    ruc: string;
    periodo: string;
    compras: number;
    ventas: number;
    gastos: number;
    estado: string;
  };
  libroDiario: unknown[];
  libroMayor: unknown[];
  balanceComprobacion: unknown[];
  estadoResultados: unknown[];
  issues: unknown[];
};

type ActiveTab =
  | "diario"
  | "mayor"
  | "balance"
  | "resultados";

const apiUrl = import.meta.env.VITE_API_URL || "http://localhost:3001";

export default function ContabilidadPanel({ rucActivo }: Props) {
  const [archivo, setArchivo] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [response, setResponse] = useState<AccountingResponse | null>(null);
  const [activeTab, setActiveTab] = useState<ActiveTab>("diario");

  const cargarAts = async () => {
    if (!archivo) {
      setError("Selecciona un archivo ATS en Excel.");
      return;
    }

    try {
      setLoading(true);
      setError("");

      const formData = new FormData();
      formData.append("archivo", archivo);

      const res = await fetch(`${apiUrl}/api/contabilidad/${rucActivo}/procesar-ats`, {
        method: "POST",
        body: formData,
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data?.message || "No se pudo procesar el ATS.");
      }

      setResponse(data);
      setActiveTab("diario");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error procesando el ATS.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6 pr-2">
      <section className="bg-white rounded-[2rem] border shadow-sm p-7">
        <div className="flex items-center gap-4">
          <div className="p-4 bg-slate-100 text-slate-700 rounded-2xl">
            <FileSpreadsheet size={28} />
          </div>
          <div>
            <h1 className="text-2xl font-black text-[#003565]">Contabilidad</h1>
            <p className="text-sm text-slate-500">Carga ATS e infraestructura del motor contable</p>
          </div>
        </div>
      </section>

      <section className="bg-white rounded-[2rem] border shadow-sm p-7">
        <label className="block">
          <span className="text-[11px] font-black uppercase text-slate-400">
            Seleccionar archivo
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
              onClick={cargarAts}
              disabled={loading}
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[#003565] px-5 py-3 text-sm font-black text-white shadow disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? <Loader2 className="animate-spin" size={18} /> : <Upload size={18} />}
              {loading ? "Cargando..." : "Cargar"}
            </button>
          </div>
        </label>

        {archivo && (
          <p className="mt-3 text-xs font-semibold text-slate-500">
            Archivo seleccionado: {archivo.name}
          </p>
        )}

        {error && (
          <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-700">
            {error}
          </div>
        )}
      </section>

      {response && (
        <>
          <section className="grid grid-cols-1 gap-3 md:grid-cols-4">
            <Info label="Empresa" value={response.resumen.empresa} />
            <Info label="RUC" value={response.resumen.ruc} />
            <Info label="Período" value={response.resumen.periodo} />
            <Info label="Estado" value={response.resumen.estado} />
            <Info label="Compras" value={String(response.resumen.compras)} />
            <Info label="Ventas" value={String(response.resumen.ventas)} />
            <Info label="Gastos" value={String(response.resumen.gastos)} />
            <Info label="Incidencias" value={String(response.issues.length)} />
          </section>

          <section className="bg-white rounded-[2rem] border shadow-sm p-7">
            <div className="mb-5 flex flex-wrap gap-2">
              <TabButton active={activeTab === "diario"} onClick={() => setActiveTab("diario")}>
                Libro Diario
              </TabButton>
              <TabButton active={activeTab === "mayor"} onClick={() => setActiveTab("mayor")}>
                Libro Mayor
              </TabButton>
              <TabButton active={activeTab === "balance"} onClick={() => setActiveTab("balance")}>
                Balance de Comprobación
              </TabButton>
              <TabButton active={activeTab === "resultados"} onClick={() => setActiveTab("resultados")}>
                Estado de Resultados
              </TabButton>
            </div>

            {activeTab === "diario" && <LibroDiarioTab rows={response.libroDiario} />}
            {activeTab === "mayor" && <LibroMayorTab rows={response.libroMayor} />}
            {activeTab === "balance" && (
              <BalanceComprobacionTab rows={response.balanceComprobacion} />
            )}
            {activeTab === "resultados" && (
              <EstadoResultadosTab rows={response.estadoResultados} />
            )}
          </section>
        </>
      )}
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border bg-white p-4 shadow-sm">
      <p className="text-[10px] uppercase font-black text-slate-400">{label}</p>
      <p className="mt-1 break-words text-sm font-black text-slate-800">{value || "-"}</p>
    </div>
  );
}

function TabButton({
  active,
  children,
  onClick,
}: {
  active: boolean;
  children: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-2xl px-4 py-2 text-sm font-black transition ${
        active
          ? "bg-[#003565] text-white"
          : "bg-slate-100 text-slate-600 hover:bg-slate-200"
      }`}
    >
      {children}
    </button>
  );
}

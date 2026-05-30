import { useMemo, useState } from "react";

type Props = {
  ruc: string;
};

type AtsIssue = {
  tipo: "ERROR" | "WARNING" | "INFO";
  hoja: string;
  fila: number;
  campo?: string;
  mensaje: string;
};

type AtsLote = {
  id: string;
  nombreArchivo: string;
  rucInformante: string;
  razonSocial: string;
  anio: number;
  mes: string;
  estado: string;
  ventas?: any[];
  compras?: any[];
  anulados?: any[];
  guias?: any[];
};

type ImportResponse = {
  message: string;
  lote: AtsLote;
  contribuyenteDetectado?: {
    ruc: string;
    razonSocial: string;
    id: string;
  };
  issues?: AtsIssue[];
  resumen?: {
    ventas: number;
    compras: number;
    anulados: number;
    guias: number;
    errores: number;
    advertencias: number;
    ventasInsertadas?: number;
    comprasInsertadas?: number;
    anuladosInsertados?: number;
    guiasInsertadas?: number;
  };
};

const API_BASE = `${import.meta.env.VITE_API_URL || "http://localhost:3001"}/api`;

const steps = [
  "Contribuyente",
  "Ventas y Compras",
  "Anulados",
  "Guías",
  "Generar XML",
];

export default function AtsMasivoPanel({ ruc }: Props) {
  const [archivo, setArchivo] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [activeStep, setActiveStep] = useState(0);
  const [response, setResponse] = useState<ImportResponse | null>(null);
  const [error, setError] = useState("");

  const lote = response?.lote;
  const contribuyenteDetectado = response?.contribuyenteDetectado;
  const resumen = response?.resumen;
  const issues = response?.issues || [];

  const errorsCount = useMemo(
    () => issues.filter((x) => x.tipo === "ERROR").length,
    [issues]
  );

  const warningsCount = useMemo(
    () => issues.filter((x) => x.tipo === "WARNING").length,
    [issues]
  );

  async function importarExcel() {
    if (!archivo) {
      setError("Selecciona un archivo Excel primero.");
      return;
    }

    if (!ruc) {
      setError("No se encontró el RUC del contribuyente.");
      return;
    }

    try {
      setError("");
      setLoading(true);

      const formData = new FormData();
      formData.append("archivo", archivo);

      const res = await fetch(`${API_BASE}/ats/${ruc}/importar`, {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data?.message || "Error importando ATS.");
      }

      setResponse(data);
      setActiveStep(0);
    } catch (err: any) {
      setError(err.message || "Error inesperado importando archivo.");
    } finally {
      setLoading(false);
    }
  }

  async function descargarXml() {
    if (!lote?.id) {
      setError("Primero importa un lote ATS.");
      return;
    }

    try {
      setError("");
      setDownloading(true);

      const res = await fetch(`${API_BASE}/ats/lote/${lote.id}/xml`);

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.message || "Error generando XML.");
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);

      const filename = `ATS_${lote.rucInformante}_${lote.mes}${lote.anio}.xml`;

      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();

      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      setError(err.message || "Error descargando XML.");
    } finally {
      setDownloading(false);
    }
  }

  async function descargarTalonResumen() {
    if (!lote?.id) {
      setError("Primero importa un lote ATS.");
      return;
    }

    try {
      setError("");
      setDownloading(true);

      const res = await fetch(`${API_BASE}/ats/lote/${lote.id}/talon-resumen`);

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.message || "Error generando talón resumen.");
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const filename = `Talon_Resumen_ATS_${lote.rucInformante}_${lote.mes}${lote.anio}.pdf`;
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      setError(err.message || "Error descargando talón resumen.");
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div className="w-full">
      <div className="mb-5 flex flex-col gap-2">
        <h2 className="text-xl font-bold text-gray-800">
          ATS Masivo por Excel
        </h2>
        <p className="text-sm text-gray-500">
          Sube el Excel, revisa el lote procesado y genera el XML listo para validar.
        </p>
      </div>

      <div className="mb-6 rounded-xl border border-dashed border-gray-300 bg-gray-50 p-4">
        <label className="mb-2 block text-sm font-semibold text-gray-700">
          Archivo Excel ATS
        </label>

        <div className="flex flex-col gap-3 md:flex-row md:items-center">
          <input
            type="file"
            accept=".xlsx,.xls"
            onChange={(e) => setArchivo(e.target.files?.[0] || null)}
            className="block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm"
          />

          <button
            onClick={importarExcel}
            disabled={loading}
            className="rounded-lg bg-blue-700 px-5 py-2 text-sm font-semibold text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? "Procesando..." : "Subir Excel"}
          </button>
        </div>

        {archivo && (
          <p className="mt-2 text-xs text-gray-500">
            Archivo seleccionado: <b>{archivo.name}</b>
          </p>
        )}
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {lote && (
        <>
          {contribuyenteDetectado && (
            <div className="mb-5 rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm font-semibold text-blue-800">
              Contribuyente detectado: {contribuyenteDetectado.ruc} - {contribuyenteDetectado.razonSocial}
            </div>
          )}

          <div className="mb-6 flex flex-wrap items-center gap-2">
            {steps.map((step, index) => (
              <button
                key={step}
                onClick={() => setActiveStep(index)}
                className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                  activeStep === index
                    ? "bg-blue-700 text-white"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
              >
                {index === 4 ? "⚙️ " : ""}
                {step}
              </button>
            ))}
          </div>

          <div className="mb-5 grid grid-cols-1 gap-3 md:grid-cols-4">
            <MetricCard title="Ventas" value={resumen?.ventasInsertadas ?? resumen?.ventas ?? lote.ventas?.length ?? 0} />
            <MetricCard title="Compras" value={resumen?.comprasInsertadas ?? resumen?.compras ?? lote.compras?.length ?? 0} />
            <MetricCard title="Anulados" value={resumen?.anuladosInsertados ?? resumen?.anulados ?? lote.anulados?.length ?? 0} />
            <MetricCard title="Guías" value={resumen?.guiasInsertadas ?? resumen?.guias ?? lote.guias?.length ?? 0} />
          </div>

          <div className="rounded-xl border border-gray-200 p-4">
            {activeStep === 0 && <ContribuyenteView lote={lote} />}
            {activeStep === 1 && <VentasComprasView lote={lote} />}
            {activeStep === 2 && <SimpleTable title="Anulados" rows={lote.anulados || []} />}
            {activeStep === 3 && <SimpleTable title="Guías" rows={lote.guias || []} />}
            {activeStep === 4 && (
              <div className="space-y-4">
                <h3 className="text-lg font-bold text-gray-800">
                  Generar XML ATS
                </h3>

                <div className="rounded-lg bg-gray-50 p-4 text-sm text-gray-700">
                  <p>
                    Lote: <b>{lote.id}</b>
                  </p>
                  <p>
                    Periodo: <b>{lote.mes}/{lote.anio}</b>
                  </p>
                  <p>
                    Estado: <b>{lote.estado}</b>
                  </p>
                </div>

                <button
                  onClick={descargarXml}
                  disabled={downloading || errorsCount > 0}
                  className="rounded-lg bg-green-700 px-5 py-2 text-sm font-semibold text-white hover:bg-green-800 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {downloading ? "Generando..." : "Descargar XML ATS"}
                </button>

                <button
                  onClick={descargarTalonResumen}
                  disabled={downloading}
                  className="ml-2 rounded-lg bg-blue-700 px-5 py-2 text-sm font-semibold text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {downloading ? "Generando..." : "Descargar Talón Resumen"}
                </button>

                {errorsCount > 0 && (
                  <p className="text-sm text-red-600">
                    Hay errores bloqueantes. Revisa el panel de incidencias antes de generar.
                  </p>
                )}
              </div>
            )}
          </div>

          <div className="mt-5 rounded-xl border border-gray-200 p-4">
            <h3 className="mb-3 text-base font-bold text-gray-800">
              Incidencias del lote
            </h3>

            <div className="mb-3 flex gap-2 text-sm">
              <span className="rounded-full bg-red-100 px-3 py-1 text-red-700">
                Errores: {errorsCount}
              </span>
              <span className="rounded-full bg-yellow-100 px-3 py-1 text-yellow-700">
                Advertencias: {warningsCount}
              </span>
              <span className="rounded-full bg-blue-100 px-3 py-1 text-blue-700">
                Total: {issues.length}
              </span>
            </div>

            {issues.length === 0 ? (
              <p className="text-sm text-gray-500">Sin incidencias reportadas.</p>
            ) : (
              <div className="max-h-64 overflow-auto rounded-lg border border-gray-100">
                <table className="w-full text-left text-xs">
                  <thead className="bg-gray-100 text-gray-700">
                    <tr>
                      <th className="p-2">Tipo</th>
                      <th className="p-2">Hoja</th>
                      <th className="p-2">Fila</th>
                      <th className="p-2">Campo</th>
                      <th className="p-2">Mensaje</th>
                    </tr>
                  </thead>
                  <tbody>
                    {issues.slice(0, 100).map((item, index) => (
                      <tr key={index} className="border-t">
                        <td className="p-2">{item.tipo}</td>
                        <td className="p-2">{item.hoja}</td>
                        <td className="p-2">{item.fila}</td>
                        <td className="p-2">{item.campo || "-"}</td>
                        <td className="p-2">{item.mensaje}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function MetricCard({ title, value }: { title: string; value: number }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
      <p className="text-sm text-gray-500">{title}</p>
      <p className="text-2xl font-bold text-gray-800">{value}</p>
    </div>
  );
}

function ContribuyenteView({ lote }: { lote: AtsLote }) {
  return (
    <div>
      <h3 className="mb-3 text-lg font-bold text-gray-800">Contribuyente</h3>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <Info label="RUC" value={lote.rucInformante} />
        <Info label="Razón Social" value={lote.razonSocial} />
        <Info label="Periodo" value={`${lote.mes}/${lote.anio}`} />
        <Info label="Archivo" value={lote.nombreArchivo} />
        <Info label="Estado" value={lote.estado} />
        <Info label="ID Lote" value={lote.id} />
      </div>
    </div>
  );
}

function VentasComprasView({ lote }: { lote: AtsLote }) {
  return (
    <div className="space-y-5">
      <SimpleTable title="Ventas" rows={lote.ventas || []} />
      <SimpleTable title="Compras" rows={lote.compras || []} />
    </div>
  );
}

function Info({ label, value }: { label: string; value: any }) {
  return (
    <div className="rounded-lg bg-gray-50 p-3">
      <p className="text-xs font-semibold uppercase text-gray-500">{label}</p>
      <p className="break-all text-sm font-medium text-gray-800">{String(value ?? "-")}</p>
    </div>
  );
}

function SimpleTable({ title, rows }: { title: string; rows: any[] }) {
  const columns = rows.length ? Object.keys(rows[0]).slice(0, 8) : [];

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-lg font-bold text-gray-800">{title}</h3>
        <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-600">
          {rows.length} registros
        </span>
      </div>

      {rows.length === 0 ? (
        <p className="rounded-lg bg-gray-50 p-3 text-sm text-gray-500">
          No hay registros para mostrar.
        </p>
      ) : (
        <div className="max-h-72 overflow-auto rounded-lg border border-gray-200">
          <table className="w-full text-left text-xs">
            <thead className="bg-gray-100 text-gray-700">
              <tr>
                {columns.map((col) => (
                  <th key={col} className="whitespace-nowrap p-2">
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.slice(0, 80).map((row, index) => (
                <tr key={index} className="border-t">
                  {columns.map((col) => (
                    <td key={col} className="max-w-48 truncate p-2">
                      {String(row[col] ?? "-")}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {rows.length > 80 && (
        <p className="mt-2 text-xs text-gray-500">
          Mostrando 80 de {rows.length} registros.
        </p>
      )}
    </div>
  );
}

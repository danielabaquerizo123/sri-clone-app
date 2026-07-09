import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  FileSpreadsheet,
  Loader2,
  RefreshCcw,
  Save,
  Upload,
} from "lucide-react";
import BalanceComprobacionTab from "./BalanceComprobacionTab";
import EstadoResultadosTab from "./EstadoResultadosTab";
import LibroDiarioTab from "./LibroDiarioTab";
import LibroMayorTab from "./LibroMayorTab";

type Props = {
  rucActivo: string;
};

type AtsLote = {
  id: string;
  nombreArchivo: string;
  rucInformante: string;
  razonSocial: string;
  anio: number;
  mes: string;
  estado: string;
  createdAt: string;
  compras?: unknown[];
  ventas?: unknown[];
};

type PreviewIssue = {
  tipo: "ERROR" | "WARNING" | "INFO";
  hoja: string;
  fila: number;
  campo?: string;
  mensaje: string;
};

type PreviewResponse = {
  message: string;
  resumen: {
    ruc: string;
    razonSocial: string;
    loteId: string;
    periodo: string;
    asientosValidos: number;
    asientosPendientes: number;
    errores: number;
  };
  periodo: {
    id: string;
    anio: number;
    mes: string;
    estado: string;
  };
  asientos: unknown[];
  pendientes: Array<{
    hoja: string;
    fila: number;
    documentoOrigen: string;
    motivo: string;
  }>;
  issues: PreviewIssue[];
};

type LibroDiarioResponse = {
  ruc: string;
  razonSocial: string;
  filtros: {
    anio: number | null;
    mes: string | null;
  };
  libroDiario: unknown[];
  asientos: unknown[];
};

type PersistResponse = {
  message: string;
  estado: "BORRADOR" | "APROBADO";
  guardados: number;
  omitidosDuplicados: number;
  pendientes: number;
  issues: PreviewIssue[];
};

type LegacyAccountingResponse = {
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
  libroDiarioFilas: JournalVisualRow[];
  asientos?: unknown[];
  libroMayor: unknown[];
  balanceComprobacion: unknown[];
  estadoResultados: unknown[];
  issues: unknown[];
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

type ActiveTab = "diario" | "mayor" | "balance" | "resultados";

const apiUrl = import.meta.env.VITE_API_URL || "http://localhost:3001";

export default function ContabilidadPanel({ rucActivo }: Props) {
  const [lotes, setLotes] = useState<AtsLote[]>([]);
  const [selectedLoteId, setSelectedLoteId] = useState("");
  const [selectedLote, setSelectedLote] = useState<AtsLote | null>(null);
  const [loadingLotes, setLoadingLotes] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [saving, setSaving] = useState<"BORRADOR" | "APROBADO" | "">("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [preview, setPreview] = useState<PreviewResponse | null>(null);
  const [libroGuardado, setLibroGuardado] = useState<LibroDiarioResponse | null>(null);
  const [activeTab, setActiveTab] = useState<ActiveTab>("diario");

  const [legacyOpen, setLegacyOpen] = useState(false);
  const [archivoLegacy, setArchivoLegacy] = useState<File | null>(null);
  const [legacyLoading, setLegacyLoading] = useState(false);
  const [legacyResponse, setLegacyResponse] = useState<LegacyAccountingResponse | null>(null);

  const selectedSummary = useMemo(() => {
    if (!selectedLote) return null;

    return {
      periodo: `${selectedLote.mes}/${selectedLote.anio}`,
      fecha: formatDateTime(selectedLote.createdAt),
      compras: selectedLote.compras?.length ?? 0,
      ventas: selectedLote.ventas?.length ?? 0,
      estado: selectedLote.estado,
    };
  }, [selectedLote]);

  const blockingIssues = useMemo(
    () => (preview?.issues || []).filter((issue) => issue.tipo === "ERROR"),
    [preview]
  );
  const hasBlockingIssues =
    blockingIssues.length > 0 || Boolean(preview?.pendientes?.length);
  const currentEntries =
    libroGuardado?.libroDiario ||
    preview?.asientos ||
    legacyResponse?.asientos ||
    legacyResponse?.libroDiario ||
    [];

  const currentRows =
    !libroGuardado && !preview ? legacyResponse?.libroDiarioFilas || [] : [];

  async function fetchJson<T>(url: string, options?: RequestInit): Promise<T> {
    const res = await fetch(url, options);
    const data = await res.json().catch(() => null);

    if (!res.ok) {
      throw new Error(data?.message || data?.error || "No se pudo completar la solicitud.");
    }

    return data as T;
  }

  async function cargarLotes() {
    if (!rucActivo) return;

    try {
      setLoadingLotes(true);
      setError("");
      setSuccess("");
      setPreview(null);
      setLibroGuardado(null);

      const data = await fetchJson<AtsLote[]>(`${apiUrl}/api/ats/${rucActivo}/lotes`);
      setLotes(data);

      const nextId = selectedLoteId || data[0]?.id || "";
      setSelectedLoteId(nextId);

      if (nextId) {
        await cargarDetalleLote(nextId);
      } else {
        setSelectedLote(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error cargando lotes ATS.");
    } finally {
      setLoadingLotes(false);
    }
  }

  async function cargarDetalleLote(loteId: string) {
    if (!loteId) {
      setSelectedLote(null);
      return;
    }

    const lote = await fetchJson<AtsLote>(`${apiUrl}/api/ats/lote/${loteId}`);
    setSelectedLote(lote);
  }

  useEffect(() => {
    cargarLotes();
  }, [rucActivo]);

  async function cambiarLote(loteId: string) {
    try {
      setSelectedLoteId(loteId);
      setPreview(null);
      setLibroGuardado(null);
      setLegacyResponse(null);
      setError("");
      setSuccess("");
      await cargarDetalleLote(loteId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error consultando lote ATS.");
    }
  }

  async function previsualizarLibroDiario() {
    if (!selectedLoteId) {
      setError("Selecciona un lote ATS importado.");
      return;
    }

    try {
      setPreviewLoading(true);
      setError("");
      setSuccess("");
      setLibroGuardado(null);
      setLegacyResponse(null);

      const data = await fetchJson<PreviewResponse>(
        `${apiUrl}/api/contabilidad/${rucActivo}/ats/${selectedLoteId}/previsualizar`,
        { method: "POST" }
      );

      setPreview(data);
      setActiveTab("diario");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error generando vista previa.");
    } finally {
      setPreviewLoading(false);
    }
  }

  async function guardarAsientos(estado: "BORRADOR" | "APROBADO") {
    if (!selectedLote || !preview) {
      setError("Primero genera la vista previa del Libro Diario.");
      return;
    }

    if (estado === "APROBADO" && hasBlockingIssues) {
      setError("No se puede aprobar porque existen pendientes o errores contables.");
      return;
    }

    try {
      setSaving(estado);
      setError("");
      setSuccess("");

      const result = await fetchJson<PersistResponse>(
        `${apiUrl}/api/contabilidad/${rucActivo}/ats/${selectedLote.id}/generar-asientos`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ estado }),
        }
      );

      setSuccess(
        `${result.guardados} asiento(s) guardado(s) como ${result.estado}. ${result.omitidosDuplicados} duplicado(s) omitido(s).`
      );
      await recargarLibroDiario(selectedLote.anio, selectedLote.mes);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error guardando asientos.");
    } finally {
      setSaving("");
    }
  }

  async function recargarLibroDiario(anio: number, mes: string) {
    const data = await fetchJson<LibroDiarioResponse>(
      `${apiUrl}/api/contabilidad/${rucActivo}/libro-diario?anio=${anio}&mes=${mes}`
    );
    setLibroGuardado(data);
    setActiveTab("diario");
  }

  async function cargarAtsLegacy() {
    if (!archivoLegacy) {
      setError("Selecciona un archivo ATS en Excel.");
      return;
    }

    try {
      setLegacyLoading(true);
      setError("");
      setSuccess("");
      setPreview(null);
      setLibroGuardado(null);

      const formData = new FormData();
      formData.append("archivo", archivoLegacy);

      const data = await fetchJson<LegacyAccountingResponse>(
        `${apiUrl}/api/contabilidad/${rucActivo}/procesar-ats`,
        {
          method: "POST",
          body: formData,
        }
      );

      setLegacyResponse(data);
      setActiveTab("diario");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error procesando ATS legacy.");
    } finally {
      setLegacyLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6 pr-2">
      <section className="rounded-[2rem] border bg-white p-7 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-4">
            <div className="rounded-2xl bg-slate-100 p-4 text-slate-700">
              <FileSpreadsheet size={28} />
            </div>
            <div>
              <h1 className="text-2xl font-black text-[#003565]">Contabilidad</h1>
              <p className="text-sm text-slate-500">
                Libro Diario desde ATS importado y persistido
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={cargarLotes}
            disabled={loadingLotes}
            className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-black text-slate-700 shadow-sm disabled:opacity-60"
          >
            {loadingLotes ? <Loader2 className="animate-spin" size={18} /> : <RefreshCcw size={18} />}
            Actualizar lotes
          </button>
        </div>
      </section>

      <section className="rounded-[2rem] border bg-white p-7 shadow-sm">
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
          <label className="block">
            <span className="text-[11px] font-black uppercase text-slate-400">
              Lote ATS importado
            </span>
            <select
              value={selectedLoteId}
              onChange={(event) => cambiarLote(event.target.value)}
              className="mt-2 block w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-800"
            >
              <option value="">Sin lotes importados</option>
              {lotes.map((lote) => (
                <option key={lote.id} value={lote.id}>
                  {lote.mes}/{lote.anio} · {lote.razonSocial} · {lote.nombreArchivo}
                </option>
              ))}
            </select>
          </label>

          <button
            type="button"
            onClick={previsualizarLibroDiario}
            disabled={!selectedLoteId || previewLoading}
            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[#003565] px-5 py-3 text-sm font-black text-white shadow disabled:cursor-not-allowed disabled:opacity-60"
          >
            {previewLoading ? <Loader2 className="animate-spin" size={18} /> : <FileSpreadsheet size={18} />}
            Previsualizar Libro Diario
          </button>
        </div>

        {selectedSummary && (
          <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-5">
            <Info label="Período" value={selectedSummary.periodo} />
            <Info label="Fecha importación" value={selectedSummary.fecha} />
            <Info label="Compras" value={String(selectedSummary.compras)} />
            <Info label="Ventas" value={String(selectedSummary.ventas)} />
            <Info label="Estado" value={selectedSummary.estado} />
          </div>
        )}

        {!loadingLotes && lotes.length === 0 && (
          <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-bold text-amber-800">
            No hay lotes ATS importados para este contribuyente. Importa primero el ATS desde Anexos.
          </div>
        )}
      </section>

      {preview && (
        <section className="rounded-[2rem] border bg-white p-7 shadow-sm">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-lg font-black text-[#003565]">Vista previa contable</h2>
              <p className="text-sm font-semibold text-slate-500">
                {preview.resumen.asientosValidos} válido(s), {preview.resumen.asientosPendientes} pendiente(s)
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => guardarAsientos("BORRADOR")}
                disabled={saving !== "" || preview.resumen.asientosValidos === 0}
                className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-black text-slate-700 shadow-sm disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving === "BORRADOR" ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
                Guardar como borrador
              </button>
              <button
                type="button"
                onClick={() => guardarAsientos("APROBADO")}
                disabled={saving !== "" || preview.resumen.asientosValidos === 0 || hasBlockingIssues}
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-700 px-4 py-3 text-sm font-black text-white shadow disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving === "APROBADO" ? (
                  <Loader2 className="animate-spin" size={18} />
                ) : (
                  <CheckCircle2 size={18} />
                )}
                Aprobar asientos
              </button>
            </div>
          </div>
        </section>
      )}

      {(error || success) && (
        <section
          className={`rounded-2xl border p-4 text-sm font-bold ${
            error
              ? "border-red-200 bg-red-50 text-red-700"
              : "border-emerald-200 bg-emerald-50 text-emerald-700"
          }`}
        >
          {error || success}
        </section>
      )}

      {preview && (preview.pendientes.length > 0 || blockingIssues.length > 0) && (
        <IssuesPanel pendientes={preview.pendientes} issues={blockingIssues} />
      )}

      {(currentEntries.length > 0 || currentRows.length > 0) && (
        <section className="rounded-[2rem] border bg-white p-7 shadow-sm">
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

          {activeTab === "diario" && <LibroDiarioTab entries={currentEntries} rows={currentRows} />}
          {activeTab === "mayor" && <LibroMayorTab rows={legacyResponse?.libroMayor || []} />}
          {activeTab === "balance" && (
            <BalanceComprobacionTab rows={legacyResponse?.balanceComprobacion || []} />
          )}
          {activeTab === "resultados" && (
            <EstadoResultadosTab rows={legacyResponse?.estadoResultados || []} />
          )}
        </section>
      )}

      <section className="rounded-[2rem] border border-slate-200 bg-white p-7 shadow-sm">
        <button
          type="button"
          onClick={() => setLegacyOpen((value) => !value)}
          className="text-sm font-black text-slate-600"
        >
          {legacyOpen ? "Ocultar flujo legacy" : "Mostrar flujo legacy de Excel directo"}
        </button>

        {legacyOpen && (
          <div className="mt-5 border-t pt-5">
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-bold text-amber-800">
              Flujo secundario: procesa un Excel en memoria sin usar AtsLote persistido ni guardar asientos.
            </div>
            <div className="mt-4 flex flex-col gap-3 md:flex-row md:items-center">
              <input
                type="file"
                accept=".xlsx,.xls"
                onChange={(event) => {
                  setArchivoLegacy(event.target.files?.[0] || null);
                  setLegacyResponse(null);
                  setError("");
                }}
                className="block w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold"
              />
              <button
                type="button"
                onClick={cargarAtsLegacy}
                disabled={legacyLoading}
                className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-black text-slate-700 shadow-sm disabled:cursor-not-allowed disabled:opacity-60"
              >
                {legacyLoading ? <Loader2 className="animate-spin" size={18} /> : <Upload size={18} />}
                Procesar legacy
              </button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

function formatDateTime(value: string) {
  if (!value) return "-";
  return new Date(value).toLocaleString("es-EC", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border bg-white p-4 shadow-sm">
      <p className="text-[10px] font-black uppercase text-slate-400">{label}</p>
      <p className="mt-1 break-words text-sm font-black text-slate-800">{value || "-"}</p>
    </div>
  );
}

function IssuesPanel({
  pendientes,
  issues,
}: {
  pendientes: PreviewResponse["pendientes"];
  issues: PreviewIssue[];
}) {
  return (
    <section className="rounded-[2rem] border border-red-200 bg-red-50 p-7 shadow-sm">
      <div className="mb-4 flex items-center gap-3 text-red-800">
        <AlertCircle size={22} />
        <h2 className="text-lg font-black">Pendientes y errores contables</h2>
      </div>
      <div className="overflow-hidden rounded-lg border border-red-200 bg-white">
        <table className="w-full min-w-[760px] border-collapse text-sm">
          <thead className="bg-red-100 text-red-950">
            <tr>
              <th className="border border-red-200 px-3 py-2 text-left font-black">HOJA</th>
              <th className="border border-red-200 px-3 py-2 text-right font-black">FILA</th>
              <th className="border border-red-200 px-3 py-2 text-left font-black">DOCUMENTO</th>
              <th className="border border-red-200 px-3 py-2 text-left font-black">MOTIVO</th>
            </tr>
          </thead>
          <tbody>
            {pendientes.map((item, index) => (
              <tr key={`pendiente-${item.hoja}-${item.fila}-${index}`}>
                <td className="border border-red-100 px-3 py-2">{item.hoja}</td>
                <td className="border border-red-100 px-3 py-2 text-right">{item.fila || "-"}</td>
                <td className="border border-red-100 px-3 py-2">{item.documentoOrigen || "-"}</td>
                <td className="border border-red-100 px-3 py-2">{item.motivo}</td>
              </tr>
            ))}
            {issues.map((issue, index) => (
              <tr key={`issue-${issue.hoja}-${issue.fila}-${index}`}>
                <td className="border border-red-100 px-3 py-2">{issue.hoja}</td>
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
        active ? "bg-[#003565] text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
      }`}
    >
      {children}
    </button>
  );
}

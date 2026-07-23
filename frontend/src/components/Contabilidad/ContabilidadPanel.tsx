import { useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode, RefObject } from "react";
import { AlertCircle, CheckCircle2, Download, FileSpreadsheet, Info as InfoIcon, Loader2, Upload, UploadCloud, X } from "lucide-react";
import LibroDiarioTab from "./LibroDiarioTab";
import LibroMayorTab from "./LibroMayorTab";
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
const MAX_ATS_FILE_SIZE = 25 * 1024 * 1024;
const ALLOWED_ATS_EXTENSIONS = [".xlsx", ".xls"];

export default function ContabilidadPanel({ rucActivo }: Props) {
  const [archivo, setArchivo] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [response, setResponse] = useState<LibroDiarioResponse | null>(null);
  const [successNotice, setSuccessNotice] = useState("");
  const [showTechnicalDetail, setShowTechnicalDetail] = useState(false);
  const [showIncidenceDetail, setShowIncidenceDetail] = useState(false);
  const [activeView, setActiveView] = useState<"ats" | "diario" | "mayor">("ats");
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const reviewRef = useRef<HTMLElement | null>(null);

  const classificationRows = useMemo(() => classificationAuditRows(response), [response]);
  const automaticRows = classificationRows.filter((row) => row.estadoAsiento === "GENERADO");
  const reviewRows = classificationRows.filter((row) => row.estadoAsiento !== "GENERADO");
  const visibleIssues = useMemo(
    () => (response?.issues || []).filter((issue) => issue.tipo !== "INFO"),
    [response]
  );
  const journalEntries =
    response && Array.isArray(response.libroDiario) && response.libroDiario.length > 0
      ? response.libroDiario
      : response?.asientos || [];

  useEffect(() => {
    if (!successNotice) return;
    const timeout = window.setTimeout(() => setSuccessNotice(""), 5000);
    return () => window.clearTimeout(timeout);
  }, [successNotice]);

  async function cargarLibroDiario() {
    if (!archivo) {
      setError("Selecciona un archivo Excel ATS.");
      return;
    }

    try {
      setLoading(true);
      setError("");
      setSuccessNotice("");
      setResponse(null);
      setShowTechnicalDetail(false);
      setShowIncidenceDetail(false);

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

      const normalized = normalizeLibroDiarioResponse(data);
      setResponse(normalized);
      setSuccessNotice(
        `Se generaron ${normalized.resumen.asientos} asientos contables. Ya puedes revisar el Libro Diario y el Libro Mayor.`
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error generando Libro Diario.");
    } finally {
      setLoading(false);
    }
  }

  function selectFile(file: File | null) {
    if (!file) return;

    const validationError = validateAtsFile(file);
    if (validationError) {
      setArchivo(null);
      setResponse(null);
      setError(validationError);
      setSuccessNotice("");
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    setArchivo(file);
    setResponse(null);
    setError("");
    setSuccessNotice("");
  }

  function removeFile() {
    setArchivo(null);
    setResponse(null);
    setError("");
    setSuccessNotice("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function openPending() {
    setShowIncidenceDetail(true);
    window.setTimeout(() => reviewRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 0);
  }

  return (
    <div className="mx-auto flex min-h-full w-full max-w-[1500px] flex-1 flex-col px-3 lg:px-0">
      <div className="flex-1 space-y-6">
      <section className="flex flex-wrap gap-2 pt-1">
        <button type="button" onClick={() => setActiveView("ats")} className={`inline-flex h-16 items-center gap-3 rounded-t-2xl rounded-b-md border px-7 text-sm font-black shadow-sm transition ${activeView === "ats" ? "border-slate-200 border-b-[#0f66ff] bg-white text-[#005cff] shadow-[0_14px_30px_rgba(15,23,42,0.08)]" : "border-transparent bg-transparent text-[#344a78] hover:bg-white/70"}`}>
          <FileSpreadsheet size={18} />
          Procesar ATS
        </button>
        <button type="button" onClick={() => setActiveView("diario")} className={`inline-flex h-16 items-center gap-3 rounded-t-2xl rounded-b-md border px-7 text-sm font-black shadow-sm transition ${activeView === "diario" ? "border-slate-200 border-b-[#0f66ff] bg-white text-[#005cff] shadow-[0_14px_30px_rgba(15,23,42,0.08)]" : "border-transparent bg-transparent text-[#344a78] hover:bg-white/70"}`}>
          <FileSpreadsheet size={18} />
          Libro Diario
        </button>
        <button type="button" onClick={() => setActiveView("mayor")} className={`inline-flex h-16 items-center gap-3 rounded-t-2xl rounded-b-md border px-7 text-sm font-black shadow-sm transition ${activeView === "mayor" ? "border-slate-200 border-b-[#0f66ff] bg-white text-[#005cff] shadow-[0_14px_30px_rgba(15,23,42,0.08)]" : "border-transparent bg-transparent text-[#344a78] hover:bg-white/70"}`}>
          <FileSpreadsheet size={18} />
          Libro Mayor
        </button>
      </section>

      {activeView === "mayor" && (
        <LibroMayorTab
          rucActivo={rucActivo}
          preview={response}
          onExport={response ? () => void downloadJournalExcel(response, rucActivo).catch((err) => setError(err instanceof Error ? err.message : "No se pudo exportar el Libro Mayor.")) : undefined}
        />
      )}

      {activeView === "diario" && (
        response ? (
          <section className="space-y-5">
            <h1 className="text-2xl font-black text-[#08265f]">Libro Diario</h1>
            <LoteSummary response={response} variant="compact" />
            <LoteActions
              response={response}
              reviewRows={reviewRows}
              onExport={() => void downloadJournalExcel(response, rucActivo).catch((err) => setError(err instanceof Error ? err.message : "No se pudo exportar el Libro Diario."))}
              onReview={openPending}
              showTechnicalDetail={showTechnicalDetail}
              onToggleTechnicalDetail={() => setShowTechnicalDetail((value) => !value)}
            />
            <section className="rounded-[2rem] border bg-white p-7 shadow-sm">
              <LibroDiarioTab entries={journalEntries} rows={[]} resumen={response.resumen} />
            </section>
            {showIncidenceDetail && <IncidencePanel response={response} reviewRows={reviewRows} issues={visibleIssues} sectionRef={reviewRef} />}
            {showTechnicalDetail && (
              <section ref={showIncidenceDetail ? undefined : reviewRef} className="space-y-5">
                <TechnicalIssuesPanel issues={response.issues} />
                {automaticRows.length > 0 && <AutomaticClassificationPanel rows={automaticRows} />}
              </section>
            )}
          </section>
        ) : (
          <LibroDiarioEmptyState onGoToAts={() => setActiveView("ats")} />
        )
      )}

      {activeView === "ats" && (
      <>
      <section className="rounded-[22px] border border-slate-200 bg-white px-8 py-9 shadow-[0_18px_48px_rgba(15,23,42,0.08)]">
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_460px] lg:items-center">
          <div className="flex items-center gap-7">
            <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-[22px] bg-[#eaf2ff] text-[#0f66ff]">
              <FileSpreadsheet size={34} />
            </div>
            <div>
              <h1 className="text-[28px] font-black leading-tight text-[#08265f]">Procesos Contables desde ATS</h1>
              <p className="mt-2 text-base font-semibold text-[#5b6f9c]">
                Solo se leerán las pestañas COMPRAS, VENTAS y GASTOS
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4 rounded-xl border border-[#bcd9ff] bg-[#f2f8ff] px-6 py-4 text-sm text-[#425783]">
            <InfoIcon className="shrink-0 text-[#0f66ff]" size={21} />
            <p className="font-semibold leading-relaxed">
              Solo se procesarán las pestañas permitidas<br />
              <span className="font-black text-[#005cff]">COMPRAS, VENTAS y GASTOS</span>
            </p>
          </div>
        </div>
      </section>

      <section className="rounded-[22px] border border-slate-200 bg-white p-9 shadow-[0_18px_48px_rgba(15,23,42,0.08)]">
        <h2 className="text-lg font-black text-[#08265f]">Archivo Excel ATS</h2>
        <input
          ref={fileInputRef}
          type="file"
          accept=".xlsx,.xls"
          onChange={(event) => selectFile(event.target.files?.[0] || null)}
          className="sr-only"
        />
        <div
          role="button"
          tabIndex={0}
          onClick={() => fileInputRef.current?.click()}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") fileInputRef.current?.click();
          }}
          onDragEnter={(event) => {
            event.preventDefault();
            setDragOver(true);
          }}
          onDragOver={(event) => {
            event.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={(event) => {
            event.preventDefault();
            setDragOver(false);
          }}
          onDrop={(event) => {
            event.preventDefault();
            setDragOver(false);
            selectFile(event.dataTransfer.files?.[0] || null);
          }}
          className={`mt-5 flex min-h-[372px] cursor-pointer flex-col items-center justify-center rounded-[18px] border border-dashed px-6 text-center transition ${
            dragOver
              ? "border-[#0f66ff] bg-[#f3f8ff]"
              : "border-[#b7c7df] bg-white hover:border-[#72a7ff] hover:bg-[#fbfdff]"
          }`}
        >
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#edf3ff] text-[#0f66ff]">
            <UploadCloud size={32} />
          </div>
          <p className="mt-6 text-xl font-black text-[#08265f]">Arrastra y suelta tu archivo ATS aquí</p>
          <p className="mt-3 text-base font-semibold text-[#62739b]">o selecciona un archivo desde tu dispositivo</p>
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              fileInputRef.current?.click();
            }}
            className="mt-7 inline-flex h-14 min-w-[290px] items-center justify-center gap-3 rounded-lg bg-[#0f66ff] px-7 text-base font-black text-white shadow-[0_12px_24px_rgba(15,102,255,0.25)] transition hover:bg-[#0057e6] focus:outline-none focus:ring-4 focus:ring-blue-200"
          >
            <FileSpreadsheet size={20} />
            Seleccionar archivo
          </button>
          <p className="mt-5 text-sm font-semibold text-[#62739b]">
            Formatos permitidos: .xlsx, .xls <span className="mx-3 text-slate-400">|</span> Tamaño máximo: 25MB
          </p>
        </div>

        {archivo && (
          <div className="mt-5 flex flex-col gap-4 rounded-2xl border border-blue-100 bg-[#f7fbff] p-4 md:flex-row md:items-center md:justify-between">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#eaf2ff] text-[#0f66ff]">
                <FileSpreadsheet size={22} />
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-black text-[#08265f]">{archivo.name}</p>
                <p className="mt-1 text-xs font-semibold text-[#62739b]">{formatFileSize(archivo.size)}</p>
              </div>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <button
                type="button"
                onClick={cargarLibroDiario}
                disabled={loading}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-[#0f66ff] px-5 text-sm font-black text-white shadow disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? <Loader2 className="animate-spin" size={18} /> : <Upload size={18} />}
                {loading ? "Procesando..." : "Procesar ATS"}
              </button>
              <button
                type="button"
                onClick={removeFile}
                disabled={loading}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-black text-[#314779] disabled:cursor-not-allowed disabled:opacity-60"
              >
                <X size={16} />
                Quitar
              </button>
            </div>
          </div>
        )}

        <div className="mt-10 flex items-center gap-4 rounded-xl border border-[#bcd9ff] bg-[#f5fbff] px-6 py-4 text-sm font-bold text-[#005cff]">
          <InfoIcon className="shrink-0" size={20} />
          <p>
            Solo se leerán las pestañas <span className="font-black">COMPRAS, VENTAS y GASTOS</span>. Cualquier otra pestaña del archivo será ignorada por Contabilidad.
          </p>
        </div>
      </section>

      {error && (
        <section className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-700">
          {error}
        </section>
      )}

      </>
      )}
      </div>
      <ContabilidadFooter />
      {successNotice && <SuccessNotification message={successNotice} onClose={() => setSuccessNotice("")} />}
    </div>
  );
}

function SuccessNotification({ message, onClose }: { message: string; onClose: () => void }) {
  return (
    <>
      <style>{`
        @keyframes contabilidad-toast-in {
          from { opacity: 0; transform: translate3d(16px, -8px, 0) scale(0.98); }
          to { opacity: 1; transform: translate3d(0, 0, 0) scale(1); }
        }
      `}</style>
      <section className="fixed right-6 top-6 z-50 w-[min(420px,calc(100vw-48px))] animate-[contabilidad-toast-in_220ms_ease-out] rounded-2xl border border-emerald-300 bg-emerald-600 p-4 text-white shadow-[0_18px_44px_rgba(16,185,129,0.28)]" role="status" aria-live="polite">
        <div className="flex items-start gap-3">
          <CheckCircle2 className="mt-0.5 shrink-0" size={22} />
          <div className="min-w-0 flex-1">
            <p className="font-black">ATS procesado correctamente</p>
            <p className="mt-1 text-sm font-semibold text-emerald-50">{message}</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-1 text-white/90 transition hover:bg-white/15 hover:text-white" aria-label="Cerrar notificación">
            <X size={17} />
          </button>
        </div>
      </section>
    </>
  );
}

function LibroDiarioEmptyState({ onGoToAts }: { onGoToAts: () => void }) {
  return (
    <section className="rounded-[2rem] border border-slate-200 bg-white p-8 text-center shadow-sm">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#edf3ff] text-[#0f66ff]">
        <FileSpreadsheet size={26} />
      </div>
      <h2 className="mt-5 text-xl font-black text-[#08265f]">No existe un ATS contable procesado.</h2>
      <p className="mt-2 text-sm font-semibold text-[#62739b]">
        Carga y procesa un archivo ATS para generar el Libro Diario.
      </p>
      <button
        type="button"
        onClick={onGoToAts}
        className="mt-6 inline-flex h-11 items-center justify-center rounded-xl bg-[#0f66ff] px-5 text-sm font-black text-white shadow transition hover:bg-[#0057e6]"
      >
        Ir a Procesar ATS
      </button>
    </section>
  );
}

function LoteSummary({ response, variant }: { response: LibroDiarioResponse; variant: "normal" | "compact" }) {
  const summary = response.resumen;
  const compact = variant === "compact";

  return (
    <section className={`grid grid-cols-1 gap-3 ${compact ? "sm:grid-cols-2 lg:grid-cols-4" : "md:grid-cols-4"}`}>
      <Info label="Archivo" value={fileName(summary.archivo)} title={summary.archivo} compact={compact} />
      <Info label={compact ? "Compras" : "Compras procesadas"} value={String(summary.compras)} compact={compact} />
      <Info label={compact ? "Ventas" : "Ventas procesadas"} value={String(summary.ventas)} compact={compact} />
      <Info label={compact ? "Gastos" : "Gastos procesados"} value={String(summary.gastos)} compact={compact} />
      <Info label={compact ? "Asientos" : "Asientos generados"} value={String(summary.asientos)} compact={compact} />
      <Info label="Errores" value={String(summary.errores)} compact={compact} />
      <Info label="Advertencias" value={String(summary.advertencias)} compact={compact} />
      <Info label={compact ? "Pendientes" : "Documentos pendientes"} value={String(summary.documentosPendientes)} compact={compact} />
    </section>
  );
}

function Info({
  label,
  value,
  title,
  compact = false,
}: {
  label: string;
  value: string;
  title?: string;
  compact?: boolean;
}) {
  return (
    <div className={`rounded-2xl border bg-white shadow-sm ${compact ? "p-3" : "p-4"}`}>
      <p className="text-[10px] font-black uppercase text-slate-400">{label}</p>
      <p className={`mt-1 break-words font-black text-slate-800 ${compact ? "text-sm" : "text-sm"}`} title={title || value}>
        {value || "-"}
      </p>
    </div>
  );
}

function fileName(value: string) {
  const parts = String(value || "").split(/[\\/]/).filter(Boolean);
  return parts.length > 0 ? parts[parts.length - 1] : String(value || "");
}

function validateAtsFile(file: File) {
  const lowerName = file.name.toLowerCase();
  const validExtension = ALLOWED_ATS_EXTENSIONS.some((extension) => lowerName.endsWith(extension));

  if (!validExtension) {
    return "El archivo ATS debe estar en formato .xlsx o .xls.";
  }

  if (file.size > MAX_ATS_FILE_SIZE) {
    return "El archivo ATS no debe superar 25MB.";
  }

  return "";
}

function formatFileSize(size: number) {
  if (size < 1024 * 1024) return `${Math.max(1, Math.round(size / 1024))} KB`;
  return `${(size / (1024 * 1024)).toFixed(2)} MB`;
}

function ContabilidadFooter() {
  return (
    <footer className="flex flex-col gap-3 px-1 pb-1 pt-2 text-xs font-semibold text-[#64769d] lg:flex-row lg:items-center lg:justify-between">
      <p>© 2026 SRI en línea. Todos los derechos reservados.</p>
      <nav className="flex flex-wrap items-center gap-4 lg:gap-6">
        <span>Versión 2.0.0</span>
        <span className="text-slate-400">•</span>
        <span>Soporte técnico</span>
        <span className="text-slate-400">•</span>
        <span>Términos y condiciones</span>
        <span className="text-slate-400">•</span>
        <span>Privacidad</span>
      </nav>
    </footer>
  );
}

function ActionButton({
  icon,
  label,
  onClick,
  disabled = false,
  tone = "secondary",
}: {
  icon: ReactNode;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  tone?: "primary" | "warning" | "secondary";
}) {
  const toneClass = {
    primary: "border-[#0f66ff] bg-[#0f66ff] text-white shadow-[0_12px_22px_rgba(15,102,255,0.24)] hover:bg-[#0057e6] hover:border-[#0057e6]",
    warning: "border-amber-300 bg-amber-100 text-amber-950 shadow-[0_10px_20px_rgba(245,158,11,0.14)] hover:bg-amber-200",
    secondary: "border-[#bcd9ff] bg-[#edf5ff] text-[#0f3f91] shadow-sm hover:border-[#0f66ff] hover:bg-[#0f66ff] hover:text-white",
  }[tone];

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center justify-center gap-2 rounded-2xl border px-4 py-3 text-sm font-black transition disabled:cursor-not-allowed disabled:opacity-50 ${toneClass}`}
    >
      {icon}
      {label}
    </button>
  );
}

function reviewActionLabel(response: LibroDiarioResponse, reviewRows: ClassificationAuditRow[]) {
  const pendingCount = Number(response.resumen.documentosPendientes || reviewRows.length || 0);
  const warningCount = Number(response.resumen.advertencias || 0);

  if (pendingCount > 0) return `Revisar ${pendingCount} pendientes`;
  if (warningCount > 0) return `Revisar ${warningCount} advertencias`;
  return "";
}

function LoteActions({
  response,
  reviewRows,
  onExport,
  onReview,
  showTechnicalDetail,
  onToggleTechnicalDetail,
}: {
  response: LibroDiarioResponse;
  reviewRows: ClassificationAuditRow[];
  onExport: () => void;
  onReview: () => void;
  showTechnicalDetail: boolean;
  onToggleTechnicalDetail: () => void;
}) {
  const reviewLabel = reviewActionLabel(response, reviewRows);

  return (
    <section className="rounded-[2rem] border bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-3 md:flex-row md:flex-wrap">
        <ActionButton
          icon={<Download size={18} />}
          label="Exportar reporte contable en Excel"
          onClick={onExport}
          tone="primary"
        />
        {reviewLabel && (
          <ActionButton
            icon={<AlertCircle size={18} />}
            label={reviewLabel}
            onClick={onReview}
            tone="warning"
          />
        )}
        <ActionButton
          icon={<FileSpreadsheet size={18} />}
          label={showTechnicalDetail ? "Ocultar detalle técnico" : "Ver detalle técnico"}
          onClick={onToggleTechnicalDetail}
          tone="secondary"
        />
      </div>
    </section>
  );
}

type ClassificationAuditRow = {
  fila: number;
  documento: string;
  tercero: string;
  observacion: string;
  categoriaBase: string;
  categoria: string;
  cuentaAsignada: string;
  origen: string;
  confianza: string;
  estadoAsiento: string;
  motivo: string;
};

function asRecord(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function classificationAuditRows(response: LibroDiarioResponse | null): ClassificationAuditRow[] {
  if (!response) return [];
  return response.auditoriaCompras
    .map((item) => {
      const record = asRecord(item);
      const clasificacion = asRecord(record.clasificacion);
      const cuenta = asRecord(record.cuentaAsignada);
      const motivoRevision = String(record.motivoRevision || "");
      return {
        fila: Number(record.filaOrigen || 0),
        documento: String(record.documentoOrigen || ""),
        tercero: String(record.razonSocialProveedor || ""),
        observacion: String(record.descripcion || record.concepto || ""),
        categoriaBase: String(clasificacion.categoriaBase || clasificacion.categoria || ""),
        categoria: String(clasificacion.categoria || ""),
        cuentaAsignada: cuenta.codigo ? `${String(cuenta.codigo)} ${String(cuenta.nombre || "")}` : "",
        origen: String(clasificacion.origen || ""),
        confianza: String(clasificacion.confianza || ""),
        estadoAsiento: String(record.estadoAsiento || ""),
        motivo: motivoRevision || (Array.isArray(clasificacion.motivos) ? clasificacion.motivos.map(String).join(" ") : ""),
      };
    })
    .filter((item): item is ClassificationAuditRow => Boolean(item));
}

function AutomaticClassificationPanel({ rows }: { rows: ClassificationAuditRow[] }) {
  return (
    <section className="rounded-[2rem] border border-emerald-200 bg-emerald-50 p-7 shadow-sm">
      <div className="mb-4 flex items-center gap-3 text-emerald-900">
        <CheckCircle2 size={22} />
        <h2 className="text-lg font-black">Clasificación automática aplicada</h2>
      </div>
      <ClassificationTable rows={rows} tone="emerald" />
    </section>
  );
}

function ReviewDocumentsPanel({
  rows,
  sectionRef,
}: {
  rows: ClassificationAuditRow[];
  sectionRef?: RefObject<HTMLElement>;
}) {
  return (
    <section ref={sectionRef} className="rounded-[2rem] border border-amber-200 bg-amber-50 p-7 shadow-sm">
      <div className="mb-4 flex items-center gap-3 text-amber-900">
        <AlertCircle size={22} />
        <h2 className="text-lg font-black">Documentos que requieren revisión</h2>
      </div>
      <ReviewTable rows={rows} />
    </section>
  );
}

function IncidencePanel({
  response,
  reviewRows,
  issues,
  sectionRef,
}: {
  response: LibroDiarioResponse;
  reviewRows: ClassificationAuditRow[];
  issues: ContabilidadIssue[];
  sectionRef?: RefObject<HTMLElement>;
}) {
  if (reviewRows.length > 0) {
    return <ReviewDocumentsPanel rows={reviewRows} sectionRef={sectionRef} />;
  }

  if (response.resumen.advertencias > 0 || issues.length > 0) {
    return <IssuesPanel issues={issues} sectionRef={sectionRef} />;
  }

  return (
    <section ref={sectionRef} className="rounded-[2rem] border border-emerald-200 bg-emerald-50 p-5 text-sm font-black text-emerald-900 shadow-sm">
      Todos los documentos fueron procesados correctamente.
    </section>
  );
}

function IssuesPanel({
  issues,
  sectionRef,
}: {
  issues: ContabilidadIssue[];
  sectionRef?: RefObject<HTMLElement>;
}) {
  return (
    <section ref={sectionRef} className="rounded-[2rem] border border-amber-200 bg-amber-50 p-7 shadow-sm">
      <div className="mb-4 flex items-center gap-3 text-amber-900">
        <AlertCircle size={22} />
        <h2 className="text-lg font-black">Advertencias del lote</h2>
      </div>
      {issues.length > 0 ? (
        <div className="overflow-hidden rounded-lg border border-amber-200 bg-white">
          <table className="w-full min-w-[760px] border-collapse text-sm">
            <thead className="bg-amber-100 text-amber-950">
              <tr>
                <th className="border border-amber-200 px-3 py-2 text-left font-black">TIPO</th>
                <th className="border border-amber-200 px-3 py-2 text-left font-black">HOJA</th>
                <th className="border border-amber-200 px-3 py-2 text-right font-black">FILA</th>
                <th className="border border-amber-200 px-3 py-2 text-left font-black">MENSAJE</th>
              </tr>
            </thead>
            <tbody>
              {issues.map((issue, index) => (
                <tr key={`${issue.tipo}-${issue.hoja || "general"}-${issue.fila || 0}-${index}`}>
                  <td className="border border-amber-100 px-3 py-2 font-bold">{issue.tipo}</td>
                  <td className="border border-amber-100 px-3 py-2">{issue.hoja || "-"}</td>
                  <td className="border border-amber-100 px-3 py-2 text-right">{issue.fila || "-"}</td>
                  <td className="border border-amber-100 px-3 py-2">{issue.mensaje}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="rounded-xl border border-amber-200 bg-white p-4 text-sm font-bold text-amber-900">
          Existen advertencias reportadas por el lote, pero no hay detalle adicional disponible en la respuesta.
        </p>
      )}
    </section>
  );
}

function TechnicalIssuesPanel({ issues }: { issues: ContabilidadIssue[] }) {
  if (issues.length === 0) return null;

  return (
    <section className="rounded-[2rem] border border-blue-200 bg-blue-50 p-7 shadow-sm">
      <div className="mb-4 flex items-center gap-3 text-blue-950">
        <FileSpreadsheet size={22} />
        <h2 className="text-lg font-black">Detalle técnico</h2>
      </div>
      <div className="overflow-hidden rounded-lg border border-blue-200 bg-white">
        <table className="w-full min-w-[760px] border-collapse text-sm">
          <thead className="bg-blue-100 text-blue-950">
            <tr>
              <th className="border border-blue-200 px-3 py-2 text-left font-black">TIPO</th>
              <th className="border border-blue-200 px-3 py-2 text-left font-black">HOJA</th>
              <th className="border border-blue-200 px-3 py-2 text-right font-black">FILA</th>
              <th className="border border-blue-200 px-3 py-2 text-left font-black">MENSAJE</th>
            </tr>
          </thead>
          <tbody>
            {issues.map((issue, index) => (
              <tr key={`${issue.tipo}-${issue.hoja || "general"}-${issue.fila || 0}-${index}`}>
                <td className="border border-blue-100 px-3 py-2 font-bold">{issue.tipo}</td>
                <td className="border border-blue-100 px-3 py-2">{issue.hoja || "-"}</td>
                <td className="border border-blue-100 px-3 py-2 text-right">{issue.fila || "-"}</td>
                <td className="border border-blue-100 px-3 py-2">{issue.mensaje}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function ReviewTable({ rows }: { rows: ClassificationAuditRow[] }) {
  return (
    <div className="overflow-hidden rounded-lg border border-amber-200 bg-white">
      <table className="w-full min-w-[760px] border-collapse text-sm">
        <thead className="bg-amber-100 text-amber-950">
          <tr>
            <th className="border border-amber-200 px-3 py-2 text-right font-black">FILA</th>
            <th className="border border-amber-200 px-3 py-2 text-left font-black">DOCUMENTO</th>
            <th className="border border-amber-200 px-3 py-2 text-left font-black">PROVEEDOR</th>
            <th className="border border-amber-200 px-3 py-2 text-left font-black">CATEGORÍA</th>
            <th className="border border-amber-200 px-3 py-2 text-left font-black">MOTIVO</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={`${row.fila}-${row.documento}`}>
              <td className="border border-amber-100 px-3 py-2 text-right">{row.fila}</td>
              <td className="border border-amber-100 px-3 py-2">{row.documento}</td>
              <td className="border border-amber-100 px-3 py-2">{row.tercero}</td>
              <td className="border border-amber-100 px-3 py-2 font-bold">{row.categoriaBase || row.categoria || "-"}</td>
              <td className="border border-amber-100 px-3 py-2 text-xs text-slate-700">{row.motivo || row.estadoAsiento}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

async function downloadJournalExcel(response: LibroDiarioResponse, rucActivo: string) {
  const res = await authFetch(`${apiUrl}/api/contabilidad/${rucActivo}/libro-diario/preview/exportar/excel`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ preview: response }),
  });

  if (!res.ok) {
    const data = await res.json().catch(() => null);
    throw new Error(data?.message || data?.error || "No se pudo exportar el Libro Diario.");
  }

  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `Reporte_Contable_${rucActivo}.xlsx`;
  link.click();
  URL.revokeObjectURL(url);
}

function ClassificationTable({ rows, tone }: { rows: ClassificationAuditRow[]; tone: "emerald" | "amber" }) {
  const border = tone === "emerald" ? "border-emerald-200" : "border-amber-200";
  const head = tone === "emerald" ? "bg-emerald-100 text-emerald-950" : "bg-amber-100 text-amber-950";
  const cell = tone === "emerald" ? "border-emerald-100" : "border-amber-100";
  return (
      <div className={`overflow-hidden rounded-lg border ${border} bg-white`}>
        <table className="w-full min-w-[920px] border-collapse text-sm">
          <thead className={head}>
            <tr>
              <th className={`border ${border} px-3 py-2 text-right font-black`}>FILA</th>
              <th className={`border ${border} px-3 py-2 text-left font-black`}>DOCUMENTO</th>
              <th className={`border ${border} px-3 py-2 text-left font-black`}>PROVEEDOR</th>
              <th className={`border ${border} px-3 py-2 text-left font-black`}>OBSERVACIÓN</th>
              <th className={`border ${border} px-3 py-2 text-left font-black`}>CATEGORÍA</th>
              <th className={`border ${border} px-3 py-2 text-left font-black`}>CUENTA</th>
              <th className={`border ${border} px-3 py-2 text-left font-black`}>ORIGEN</th>
              <th className={`border ${border} px-3 py-2 text-left font-black`}>CONFIANZA</th>
              <th className={`border ${border} px-3 py-2 text-left font-black`}>ESTADO</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={`${row.fila}-${row.documento}`}>
                <td className={`border ${cell} px-3 py-2 text-right`}>{row.fila}</td>
                <td className={`border ${cell} px-3 py-2`}>{row.documento}</td>
                <td className={`border ${cell} px-3 py-2`}>{row.tercero}</td>
                <td className={`border ${cell} px-3 py-2 text-xs text-slate-600`}>{row.observacion || "-"}</td>
                <td className={`border ${cell} px-3 py-2 font-bold`}>{row.categoriaBase || row.categoria || "-"}</td>
                <td className={`border ${cell} px-3 py-2`}>{row.cuentaAsignada || "-"}</td>
                <td className={`border ${cell} px-3 py-2`}>{row.origen || "-"}</td>
                <td className={`border ${cell} px-3 py-2`}>{row.confianza || "-"}</td>
                <td className={`border ${cell} px-3 py-2`} title={row.motivo}>{row.estadoAsiento || "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
  );
}

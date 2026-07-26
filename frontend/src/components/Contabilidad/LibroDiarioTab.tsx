import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode, RefObject } from "react";
import {
  ArrowDown,
  ArrowLeftRight,
  ArrowUp,
  CalendarDays,
  ChevronDown,
  ChevronUp,
  FileSpreadsheet,
  FileText,
  ReceiptText,
  ShieldCheck,
} from "lucide-react";
import type { JournalVisualRow } from "./ContabilidadPanel";

type LibroDiarioLine = {
  codigo: string;
  cuenta: string;
  debe: number;
  haber: number;
};

type LibroDiarioEvidence = {
  campo: string;
  valor: string | number | boolean | null;
  descripcion?: string;
};

export type LibroDiarioEntry = {
  numero: number;
  fecha: string;
  glosa: string;
  evidencias: LibroDiarioEvidence[];
  lineas: LibroDiarioLine[];
};

type Props = {
  entries?: unknown[];
  rows?: JournalVisualRow[];
  resumen?: {
    asientos?: number;
    totalDebe?: number;
    totalHaber?: number;
    errores?: number;
    advertencias?: number;
    ruc?: string;
    razonSocial?: string;
    periodo?: string;
    moneda?: string;
  };
  onExportExcel?: () => void;
};

type SummaryTone = "blue" | "mint" | "green" | "red";

const DIARY_BATCH_SIZE = 20;
const SCROLL_TOP_THRESHOLD = 360;

function toMoneyNumber(value: unknown): number {
  if (value === "" || value === null || value === undefined) return 0;
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;

  const raw = String(value).trim();
  const normalized = raw.includes(",")
    ? raw.replace(/\./g, "").replace(",", ".")
    : raw;
  const numberValue = Number(normalized);

  return Number.isFinite(numberValue) ? numberValue : 0;
}

function formatMoney(value: unknown): string {
  const numberValue = toMoneyNumber(value);

  if (numberValue === 0) return "";

  return new Intl.NumberFormat("es-EC", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(numberValue);
}

function formatInteger(value: number) {
  return new Intl.NumberFormat("es-EC", {
    maximumFractionDigits: 0,
  }).format(value);
}

function normalizeEntries(entries: unknown[] = [], rows: JournalVisualRow[] = []): LibroDiarioEntry[] {
  const normalizedFromEntries = entries
    .map((entry: any): LibroDiarioEntry | null => {
      const rawLines = Array.isArray(entry?.lineas)
        ? entry.lineas
        : Array.isArray(entry?.movimientos)
          ? entry.movimientos
          : [];

      if (!entry || rawLines.length === 0) return null;

      return {
        numero: Number(entry.numero || entry.asiento || 0),
        fecha: String(entry.fecha || "").slice(0, 10),
        glosa: String(entry.glosa || entry.descripcion || ""),
        evidencias: Array.isArray(entry.evidencias)
          ? entry.evidencias
              .map((evidence: any) => ({
                campo: String(evidence?.campo || ""),
                valor: evidence?.valor ?? "",
                descripcion: evidence?.descripcion ? String(evidence.descripcion) : undefined,
              }))
              .filter((evidence: LibroDiarioEvidence) =>
                ["tipoPago", "formaPago1", "formaPago2", "formaCobro1", "formaCobro2"].includes(evidence.campo)
              )
          : [],
        lineas: rawLines.map((line: any) => ({
          codigo: String(line.codigo || line.codigoCuenta || line.cuenta || ""),
          cuenta: String(line.cuenta || line.nombreCuenta || ""),
          debe: toMoneyNumber(line.debe),
          haber: toMoneyNumber(line.haber),
        })),
      };
    })
    .filter((entry): entry is LibroDiarioEntry => Boolean(entry));

  if (normalizedFromEntries.length > 0) {
    return normalizedFromEntries;
  }

  const grouped = new Map<number, LibroDiarioEntry>();

  rows.forEach((row) => {
    const asiento = Number(row.asiento || 0);
    const current =
      grouped.get(asiento) ||
      ({
        numero: asiento,
        fecha: row.fecha,
        glosa: row.descripcion || "",
        evidencias: [],
        lineas: [],
      } satisfies LibroDiarioEntry);

    current.lineas.push({
      codigo: row.codigoCuenta,
      cuenta: row.nombreCuenta,
      debe: toMoneyNumber(row.debe),
      haber: toMoneyNumber(row.haber),
    });
    grouped.set(asiento, current);
  });

  return Array.from(grouped.values());
}

export default function LibroDiarioTab({ entries = [], rows = [], resumen, onExportExcel }: Props) {
  const journal = useMemo(() => normalizeEntries(entries, rows), [entries, rows]);
  const [visibleCount, setVisibleCount] = useState(DIARY_BATCH_SIZE);
  const [loadingMore, setLoadingMore] = useState(false);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [collapsedEntries, setCollapsedEntries] = useState<Set<string>>(() => new Set());
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const loadTimeoutRef = useRef<number | null>(null);
  const totalDebe = useMemo(
    () =>
      journal.reduce(
        (total, entry) => total + entry.lineas.reduce((sum, line) => sum + line.debe, 0),
        0
      ),
    [journal]
  );
  const totalHaber = useMemo(
    () =>
      journal.reduce(
        (total, entry) => total + entry.lineas.reduce((sum, line) => sum + line.haber, 0),
        0
      ),
    [journal]
  );
  const movementCount = useMemo(
    () => journal.reduce((total, entry) => total + entry.lineas.length, 0),
    [journal]
  );
  const visibleEntries = useMemo(
    () => journal.slice(0, Math.min(visibleCount, journal.length)),
    [journal, visibleCount]
  );
  const displayedTotalDebe = Number(resumen?.totalDebe ?? totalDebe);
  const displayedTotalHaber = Number(resumen?.totalHaber ?? totalHaber);
  const hasMore = visibleEntries.length < journal.length;
  const statusLabel = getStatusLabel({
    totalDebe: displayedTotalDebe,
    totalHaber: displayedTotalHaber,
    errores: Number(resumen?.errores || 0),
    advertencias: Number(resumen?.advertencias || 0),
  });
  const loadMore = useCallback(() => {
    if (loadingMore || !hasMore) return;

    setLoadingMore(true);
    loadTimeoutRef.current = window.setTimeout(() => {
      setVisibleCount((current) => Math.min(current + DIARY_BATCH_SIZE, journal.length));
      setLoadingMore(false);
    }, 120);
  }, [hasMore, journal.length, loadingMore]);
  const scrollToTop = useCallback(() => {
    scrollContainerRef.current?.scrollTo({ top: 0, behavior: "smooth" });
  }, []);
  const toggleEntry = useCallback((entryKey: string) => {
    setCollapsedEntries((current) => {
      const next = new Set(current);
      if (next.has(entryKey)) {
        next.delete(entryKey);
      } else {
        next.add(entryKey);
      }
      return next;
    });
  }, []);

  useEffect(() => {
    setVisibleCount(DIARY_BATCH_SIZE);
    setLoadingMore(false);
    setCollapsedEntries(new Set());
    scrollContainerRef.current?.scrollTo({ top: 0 });
  }, [journal]);

  useEffect(() => {
    return () => {
      if (loadTimeoutRef.current !== null) {
        window.clearTimeout(loadTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const handleScroll = () => {
      setShowScrollTop(container.scrollTop > SCROLL_TOP_THRESHOLD);
    };

    handleScroll();
    container.addEventListener("scroll", handleScroll, { passive: true });

    return () => container.removeEventListener("scroll", handleScroll);
  }, []);

  if (journal.length === 0) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-[0_12px_30px_rgba(15,23,42,0.06)]">
        <h3 className="font-black text-[#07183d]">Libro Diario</h3>
        <p className="mt-3 text-sm font-semibold text-[#43577f]">
          No existen asientos contables para visualizar.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <LibroDiarioHeader onExportExcel={onExportExcel} />
      <LibroDiarioSummary
        totalAsientos={Number(resumen?.asientos || journal.length)}
        movimientos={movementCount}
        totalDebe={displayedTotalDebe}
        totalHaber={displayedTotalHaber}
        estado={statusLabel}
      />
      <div className="relative">
        <LibroDiarioProgress visible={visibleEntries.length} total={journal.length} />
        <div ref={scrollContainerRef} className="max-h-[680px] overflow-auto scroll-smooth pr-1">
          <LibroDiarioList
            entries={visibleEntries}
            collapsedEntries={collapsedEntries}
            onToggleEntry={toggleEntry}
          />
          <LibroDiarioLoadSentinel
            rootRef={scrollContainerRef}
            hasMore={hasMore}
            loadingMore={loadingMore}
            onLoadMore={loadMore}
          />
        </div>
        <LibroDiarioScrollTopButton visible={showScrollTop} onClick={scrollToTop} />
      </div>
    </div>
  );
}

function LibroDiarioHeader({ onExportExcel }: { onExportExcel?: () => void }) {
  return (
    <section className="flex flex-col gap-4 bg-transparent sm:flex-row sm:items-start sm:justify-between">
      <div className="flex items-center gap-4">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-[#4b93ff] to-[#0f66d8] text-white shadow-[0_10px_18px_rgba(15,102,255,0.22)]">
          <FileSpreadsheet size={28} />
        </span>
        <div>
          <h1 className="text-[30px] font-black leading-none text-[#07183d]">Libro Diario</h1>
          <p className="mt-2 text-sm font-semibold text-[#43577f]">
            Registro cronológico de todas las operaciones contables
          </p>
        </div>
      </div>
      <div className="flex flex-wrap gap-3 sm:justify-end">
        <button
          type="button"
          onClick={onExportExcel}
          disabled={!onExportExcel}
          className="inline-flex min-h-[52px] items-center justify-center gap-3 rounded-lg border border-emerald-300 bg-white px-6 text-base font-black text-emerald-700 shadow-sm transition hover:bg-emerald-50 focus:outline-none focus:ring-4 focus:ring-emerald-100 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <FileSpreadsheet size={22} />
          Excel
        </button>
        <button
          type="button"
          disabled
          title="La exportación PDF del Libro Diario no está disponible en el frontend actual."
          className="inline-flex min-h-[52px] items-center justify-center gap-3 rounded-lg border border-red-200 bg-white px-6 text-base font-black text-red-500 opacity-70 shadow-sm"
        >
          <FileText size={22} />
          PDF
        </button>
      </div>
    </section>
  );
}

function LibroDiarioSummary({
  totalAsientos,
  movimientos,
  totalDebe,
  totalHaber,
  estado,
}: {
  totalAsientos: number;
  movimientos: number;
  totalDebe: number;
  totalHaber: number;
  estado: string;
}) {
  const items = [
    { label: "TOTAL ASIENTOS", value: formatInteger(totalAsientos), icon: <ReceiptText size={24} />, tone: "blue" as SummaryTone },
    { label: "MOVIMIENTOS", value: formatInteger(movimientos), icon: <ArrowLeftRight size={28} />, tone: "mint" as SummaryTone },
    { label: "TOTAL DEBE", value: formatMoney(totalDebe), icon: <ArrowDown size={28} />, tone: "green" as SummaryTone },
    { label: "TOTAL HABER", value: formatMoney(totalHaber), icon: <ArrowUp size={28} />, tone: "red" as SummaryTone },
    { label: "ESTADO", value: estado, icon: <ShieldCheck size={25} />, tone: "blue" as SummaryTone },
  ];

  return (
    <section className="grid overflow-hidden rounded-xl border border-[#dbe5f4] bg-white shadow-[0_14px_34px_rgba(15,23,42,0.07)] sm:grid-cols-2 min-[1100px]:grid-cols-[minmax(150px,0.9fr)_minmax(165px,1fr)_minmax(210px,1.18fr)] min-[1440px]:grid-cols-[minmax(145px,0.85fr)_minmax(155px,0.95fr)_minmax(205px,1.18fr)_minmax(205px,1.18fr)_minmax(190px,1fr)]">
      {items.map((item, index) => (
        <SummaryItem
          key={item.label}
          label={item.label}
          value={item.value}
          icon={item.icon}
          tone={item.tone}
          showDivider={index < items.length - 1}
          compactValue={item.label === "ESTADO"}
        />
      ))}
    </section>
  );
}

function SummaryItem({
  label,
  value,
  icon,
  tone,
  showDivider,
  compactValue,
}: {
  label: string;
  value: string;
  icon: ReactNode;
  tone: SummaryTone;
  showDivider: boolean;
  compactValue: boolean;
}) {
  const iconClass = {
    blue: "bg-[#eaf3ff] text-[#1872f2]",
    mint: "bg-emerald-100 text-emerald-700",
    green: "bg-emerald-100 text-emerald-700",
    red: "bg-red-100 text-red-600",
  }[tone];
  const valueColor = tone === "green" ? "text-emerald-700" : tone === "red" ? "text-red-600" : "text-[#07183d]";

  return (
    <div className={`flex min-w-0 items-center gap-3 border-b border-[#dbe5f4] px-4 py-5 last:border-b-0 sm:gap-4 sm:px-5 min-[1440px]:border-b-0 ${showDivider ? "min-[1440px]:border-r min-[1440px]:border-[#dbe5f4]" : ""}`}>
      <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl sm:h-12 sm:w-12 min-[1440px]:h-14 min-[1440px]:w-14 ${iconClass}`}>
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <p className="whitespace-normal break-normal text-[10px] font-black uppercase leading-tight text-[#31446d] [overflow-wrap:normal] sm:text-[11px]">
          {label}
        </p>
        <p
          className={`mt-2 font-black leading-tight ${valueColor} ${
            compactValue
              ? "whitespace-normal break-normal text-lg [overflow-wrap:normal] sm:text-xl min-[1440px]:text-[22px]"
              : "whitespace-nowrap text-xl tabular-nums sm:text-2xl min-[1440px]:text-[26px]"
          }`}
        >
          {value || "-"}
        </p>
      </div>
    </div>
  );
}

const LibroDiarioList = memo(function LibroDiarioList({
  entries,
  collapsedEntries,
  onToggleEntry,
}: {
  entries: LibroDiarioEntry[];
  collapsedEntries: Set<string>;
  onToggleEntry: (entryKey: string) => void;
}) {
  return (
    <div className="space-y-4 pb-1">
      {entries.map((entry) => {
        const entryKey = entryStableKey(entry);
        return (
          <LibroDiarioAsientoCard
            key={entryKey}
            entry={entry}
            entryKey={entryKey}
            collapsed={collapsedEntries.has(entryKey)}
            onToggle={onToggleEntry}
          />
        );
      })}
    </div>
  );
});

const LibroDiarioAsientoCard = memo(function LibroDiarioAsientoCard({
  entry,
  entryKey,
  collapsed,
  onToggle,
}: {
  entry: LibroDiarioEntry;
  entryKey: string;
  collapsed: boolean;
  onToggle: (entryKey: string) => void;
}) {
  return (
    <article className="overflow-hidden rounded-xl border border-[#74a8ff] bg-white shadow-[0_8px_22px_rgba(15,102,255,0.06)]">
      <header className="flex flex-wrap items-center justify-between gap-4 px-3 py-3">
        <div className="flex flex-wrap items-center gap-6">
          <div className="flex h-10 overflow-hidden rounded-xl bg-[#0d55bd] text-white shadow-sm">
            <span className="flex items-center rounded-xl bg-[#2f83f4] px-5 text-sm font-black uppercase">
              ASIENTO
            </span>
            <span className="flex min-w-14 items-center justify-center px-4 text-2xl font-black">
              {entry.numero}
            </span>
          </div>
          <div className="flex items-center gap-3 text-[#0750b5]">
            <CalendarDays size={21} />
            <span className="text-lg font-black">{entry.fecha}</span>
          </div>
        </div>
        <button
          type="button"
          onClick={() => onToggle(entryKey)}
          aria-label={collapsed ? `Expandir asiento ${entry.numero}` : `Contraer asiento ${entry.numero}`}
          aria-expanded={!collapsed}
          className="flex h-10 w-10 items-center justify-center rounded-full border border-[#a9ccff] bg-white text-[#0f66ff] transition hover:bg-[#f4f8ff] focus:outline-none focus:ring-4 focus:ring-blue-100"
        >
          {collapsed ? <ChevronDown size={20} /> : <ChevronUp size={20} />}
        </button>
      </header>
      {!collapsed && (
        <div className="px-3 pb-3">
          <LibroDiarioTable entry={entry} />
          <LibroDiarioGlosa entry={entry} />
        </div>
      )}
    </article>
  );
});

function LibroDiarioTable({ entry }: { entry: LibroDiarioEntry }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[920px] border-collapse text-base">
        <colgroup>
          <col className="w-[145px]" />
          <col className="w-[145px]" />
          <col />
          <col className="w-[155px]" />
          <col className="w-[155px]" />
        </colgroup>
        <thead className="bg-[#004fb3] text-white shadow-sm">
          <tr>
            <Th>FECHA</Th>
            <Th>CÓDIGO</Th>
            <Th>DETALLE</Th>
            <Th align="right">DEBE</Th>
            <Th align="right">HABER</Th>
          </tr>
        </thead>
        <tbody>
          {entry.lineas.map((line, index) => (
            <tr
              key={`${entry.numero}-${line.codigo}-${index}`}
              className="bg-white text-[#07183d] transition hover:bg-[#fbfdff]"
            >
              <Td>{entry.fecha}</Td>
              <Td>{line.codigo}</Td>
              <Td className="font-medium">{line.cuenta}</Td>
              <Td align="right" className="font-bold text-emerald-700 tabular-nums">{formatMoney(line.debe)}</Td>
              <Td align="right" className="font-bold text-red-600 tabular-nums">{formatMoney(line.haber)}</Td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function LibroDiarioGlosa({ entry }: { entry: LibroDiarioEntry }) {
  return (
    <section className="mt-3 flex gap-4 rounded-lg bg-[#f6f9fe] px-4 py-4">
      <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-[#e5f0ff] text-[#0f66d8]">
        <ReceiptText size={28} />
      </span>
      <div className="min-w-0 pt-1">
        <p className="text-lg font-black italic leading-snug text-[#004fb3]">{entry.glosa}</p>
        {entry.evidencias.length > 0 && <LibroDiarioChips entry={entry} />}
      </div>
    </section>
  );
}

function LibroDiarioChips({ entry }: { entry: LibroDiarioEntry }) {
  return (
    <div className="mt-3 flex flex-wrap gap-2">
      {entry.evidencias.map((evidence, index) => {
        const isPaymentForm = evidence.campo.toLowerCase().includes("forma");
        return (
          <span
            key={`${entry.numero}-${evidence.campo}-${index}`}
            className={`inline-flex max-w-full items-center gap-1.5 rounded-full border px-3 py-1 text-sm font-semibold ${
              isPaymentForm
                ? "border-violet-200 bg-violet-50 text-violet-800"
                : "border-[#bcd9ff] bg-[#eef6ff] text-[#064fae]"
            }`}
            title={evidence.descripcion}
          >
            <ReceiptText size={14} className="shrink-0" />
            <span className="min-w-0 truncate">{evidenceLabel(evidence.campo)}: {String(evidence.valor)}</span>
          </span>
        );
      })}
    </div>
  );
}

function LibroDiarioProgress({ visible, total }: { visible: number; total: number }) {
  return (
    <div className="px-6 pb-3 text-sm font-semibold text-[#38507c]">
      Mostrando {visible} de {total} asientos
    </div>
  );
}

function LibroDiarioLoadSentinel({
  rootRef,
  hasMore,
  loadingMore,
  onLoadMore,
}: {
  rootRef: RefObject<HTMLDivElement>;
  hasMore: boolean;
  loadingMore: boolean;
  onLoadMore: () => void;
}) {
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    const root = rootRef.current;
    if (!sentinel || !root || !hasMore) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) onLoadMore();
      },
      { root, rootMargin: "180px 0px", threshold: 0.1 }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, onLoadMore, rootRef]);

  return (
    <div
      ref={sentinelRef}
      className="flex min-h-16 items-center justify-center px-4 py-4 text-sm font-bold text-[#536994]"
      aria-live="polite"
    >
      {hasMore ? (
        loadingMore ? (
          <span className="inline-flex items-center gap-2">
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-[#b9d2ff] border-t-[#0f66ff]" aria-hidden="true" />
            Cargando más asientos...
          </span>
        ) : (
          <span>Continúa bajando para cargar más asientos.</span>
        )
      ) : (
        <span>Se mostraron todos los asientos.</span>
      )}
    </div>
  );
}

function LibroDiarioScrollTopButton({
  visible,
  onClick,
}: {
  visible: boolean;
  onClick: () => void;
}) {
  if (!visible) return null;

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Volver arriba del Libro Diario"
      className="absolute bottom-5 right-5 z-20 inline-flex items-center gap-2 rounded-full border border-[#bcd9ff] bg-white px-4 py-2 text-sm font-black text-[#0f66ff] shadow-[0_12px_26px_rgba(15,23,42,0.16)] transition hover:border-[#0f66ff] hover:bg-[#f4f8ff] focus:outline-none focus:ring-4 focus:ring-blue-200"
    >
      <span aria-hidden="true">↑</span>
      Volver arriba
    </button>
  );
}

function evidenceLabel(campo: string) {
  const labels: Record<string, string> = {
    tipoPago: "Tipo de pago",
    formaPago1: "Forma de pago 1",
    formaPago2: "Forma de pago 2",
    formaCobro1: "Forma de cobro 1",
    formaCobro2: "Forma de cobro 2",
  };
  return labels[campo] || campo;
}

function getStatusLabel({
  totalDebe,
  totalHaber,
  errores,
  advertencias,
}: {
  totalDebe: number;
  totalHaber: number;
  errores: number;
  advertencias: number;
}) {
  if (errores > 0) return "Con errores";
  if (Math.abs(totalDebe - totalHaber) > 0.005) return "Descuadrado";
  if (advertencias > 0) return "Con advertencias";
  return "Libro validado";
}

function entryStableKey(entry: LibroDiarioEntry) {
  return `${entry.numero}-${entry.fecha}-${entry.glosa}`;
}

function alignClass(align: "left" | "right") {
  return align === "right" ? "text-right" : "text-left";
}

function Th({
  children,
  align = "left",
}: {
  children: string;
  align?: "left" | "right";
}) {
  return (
    <th className={`border border-[#0a5ac8] px-6 py-3.5 ${alignClass(align)} text-sm font-black`}>
      {children}
    </th>
  );
}

function Td({
  children,
  align = "left",
  className = "",
}: {
  children?: string | number;
  align?: "left" | "right";
  className?: string;
}) {
  return (
    <td className={`border border-[#dbe4f1] px-6 py-3.5 align-top ${alignClass(align)} ${className}`}>
      {children}
    </td>
  );
}

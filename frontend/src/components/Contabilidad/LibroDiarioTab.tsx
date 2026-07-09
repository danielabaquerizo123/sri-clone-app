import type { JournalVisualRow } from "./ContabilidadPanel";

type LibroDiarioLine = {
  codigo: string;
  cuenta: string;
  debe: number;
  haber: number;
};

export type LibroDiarioEntry = {
  numero: number;
  fecha: string;
  glosa: string;
  lineas: LibroDiarioLine[];
};

type Props = {
  entries?: unknown[];
  rows?: JournalVisualRow[];
};

function toMoneyNumber(value: unknown): number {
  if (value === "" || value === null || value === undefined) return 0;

  const normalized = String(value).replace(/\./g, "").replace(",", ".");
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

export default function LibroDiarioTab({ entries = [], rows = [] }: Props) {
  const journal = normalizeEntries(entries, rows);
  const totalDebe = journal.reduce(
    (total, entry) => total + entry.lineas.reduce((sum, line) => sum + line.debe, 0),
    0
  );
  const totalHaber = journal.reduce(
    (total, entry) => total + entry.lineas.reduce((sum, line) => sum + line.haber, 0),
    0
  );

  if (journal.length === 0) {
    return (
      <div className="rounded-lg border bg-slate-50 p-5">
        <h3 className="font-black text-[#003565]">Libro Diario</h3>
        <p className="mt-3 text-sm font-semibold text-slate-500">
          No hay asientos contables válidos para mostrar.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-slate-300 bg-white">
      <div className="max-h-[620px] overflow-auto">
        <table className="w-full min-w-[920px] border-collapse font-mono text-[13px]">
          <colgroup>
            <col className="w-[130px]" />
            <col className="w-[150px]" />
            <col />
            <col className="w-[150px]" />
            <col className="w-[150px]" />
          </colgroup>
          <thead className="sticky top-0 z-10 bg-slate-100 text-slate-900 shadow-sm">
            <tr>
              <Th>FECHA</Th>
              <Th>CÓDIGO</Th>
              <Th>DETALLE</Th>
              <Th align="right">DEBE</Th>
              <Th align="right">HABER</Th>
            </tr>
          </thead>
          <tbody>
            {journal.map((entry) => (
              <JournalRows key={`${entry.numero}-${entry.fecha}-${entry.glosa}`} entry={entry} />
            ))}
          </tbody>
          <tfoot className="sticky bottom-0 bg-slate-100 font-black text-slate-950">
            <tr className="border-t-2 border-slate-400">
              <Td></Td>
              <Td></Td>
              <Td className="text-right">TOTALES</Td>
              <Td align="right">{formatMoney(totalDebe)}</Td>
              <Td align="right">{formatMoney(totalHaber)}</Td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

function JournalRows({ entry }: { entry: LibroDiarioEntry }) {
  return (
    <>
      <tr className="border-t-2 border-slate-400 bg-slate-50">
        <td className="px-3 py-2 font-black text-slate-900" colSpan={5}>
          Asiento {entry.numero}
        </td>
      </tr>
      {entry.lineas.map((line, index) => (
        <tr
          key={`${entry.numero}-${line.codigo}-${index}`}
          className="border-t border-slate-200 bg-white"
        >
          <Td>{entry.fecha}</Td>
          <Td>{line.codigo}</Td>
          <Td>{line.cuenta}</Td>
          <Td align="right">{formatMoney(line.debe)}</Td>
          <Td align="right">{formatMoney(line.haber)}</Td>
        </tr>
      ))}
      <tr className="border-t border-slate-200 bg-white">
        <Td></Td>
        <Td></Td>
        <td className="px-3 py-2 italic text-slate-600" colSpan={3}>
          {entry.glosa}
        </td>
      </tr>
      <tr className="h-3 bg-slate-50">
        <td colSpan={5}></td>
      </tr>
    </>
  );
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
    <th className={`border border-slate-300 px-3 py-2 ${alignClass(align)} font-black`}>
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
    <td className={`border border-slate-200 px-3 py-2 align-top text-slate-900 ${alignClass(align)} ${className}`}>
      {children}
    </td>
  );
}

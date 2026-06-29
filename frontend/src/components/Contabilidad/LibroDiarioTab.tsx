import type { JournalVisualRow } from "./ContabilidadPanel";

type Props = {
  rows: JournalVisualRow[];
};

function formatMoney(value: string): string {
  if (!value) return "";

  const [integerRaw, decimalRaw = "00"] = value.split(".");
  const integer = integerRaw.replace(/\B(?=(\d{3})+(?!\d))/g, ".");

  return `${integer},${decimalRaw.padEnd(2, "0").slice(0, 2)}`;
}

export default function LibroDiarioTab({ rows }: Props) {
  const totalDebe = rows.reduce((total, row) => total + cents(row.debe), 0);
  const totalHaber = rows.reduce((total, row) => total + cents(row.haber), 0);

  if (rows.length === 0) {
    return (
      <div className="rounded-2xl border bg-slate-50 p-5">
        <h3 className="font-black text-[#003565]">Libro Diario</h3>
        <p className="mt-3 text-sm font-semibold text-slate-500">
          No hay asientos contables válidos para mostrar.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border bg-white">
      <div className="max-h-[560px] overflow-auto">
        <table className="w-full min-w-[980px] border-collapse text-sm">
          <thead className="sticky top-0 z-10 bg-slate-100 text-slate-900 shadow-sm">
            <tr>
              <Th align="right">Asiento</Th>
              <Th align="center">Fecha</Th>
              <Th>Código Cuenta</Th>
              <Th>Nombre Cuenta</Th>
              <Th>Descripción</Th>
              <Th align="right">Debe</Th>
              <Th align="right">Haber</Th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={`${row.asiento}-${index}`} className="border-t border-slate-200">
                <Td align="right">{row.asiento}</Td>
                <Td align="center">{row.fecha}</Td>
                <Td>{row.codigoCuenta}</Td>
                <Td>{row.nombreCuenta}</Td>
                <Td>{row.descripcion}</Td>
                <Td align="right">{formatMoney(row.debe)}</Td>
                <Td align="right">{formatMoney(row.haber)}</Td>
              </tr>
            ))}
          </tbody>
          <tfoot className="sticky bottom-0 bg-slate-50 font-black text-slate-900">
            <tr className="border-t-2 border-slate-300">
              <Td align="right"></Td>
              <Td align="center"></Td>
              <Td></Td>
              <Td></Td>
              <Td>Totales</Td>
              <Td align="right">{formatCents(totalDebe)}</Td>
              <Td align="right">{formatCents(totalHaber)}</Td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

function cents(value: string): number {
  if (!value) return 0;

  const [integerRaw = "0", decimalRaw = ""] = value.split(".");
  return Number(integerRaw) * 100 + Number(decimalRaw.padEnd(2, "0").slice(0, 2));
}

function formatCents(value: number): string {
  const integer = Math.trunc(value / 100);
  const decimals = String(Math.abs(value % 100)).padStart(2, "0");

  return `${String(integer).replace(/\B(?=(\d{3})+(?!\d))/g, ".")},${decimals}`;
}

function Th({
  children,
  align = "left",
}: {
  children: string;
  align?: "left" | "center" | "right";
}) {
  return (
    <th className={`whitespace-nowrap px-4 py-3 text-${align} font-black`}>
      {children}
    </th>
  );
}

function Td({
  children,
  align = "left",
}: {
  children?: string | number;
  align?: "left" | "center" | "right";
}) {
  return (
    <td className={`px-4 py-3 text-${align} align-top text-slate-800`}>
      {children}
    </td>
  );
}

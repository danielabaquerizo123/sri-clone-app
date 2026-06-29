type Props = {
  rows: unknown[];
};

export default function LibroMayorTab({ rows }: Props) {
  return (
    <div className="rounded-2xl border bg-slate-50 p-5">
      <div className="flex items-center justify-between gap-3">
        <h3 className="font-black text-[#003565]">Libro Mayor</h3>
        <span className="rounded-full bg-white px-3 py-1 text-xs font-black text-slate-500">
          {rows.length} cuentas
        </span>
      </div>
      <p className="mt-3 text-sm font-semibold text-slate-500">
        Infraestructura preparada. Este generador leerá exclusivamente el Libro Diario en la Fase 2.
      </p>
    </div>
  );
}

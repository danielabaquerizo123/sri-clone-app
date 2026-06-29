type Props = {
  rows: unknown[];
};

export default function LibroDiarioTab({ rows }: Props) {
  return (
    <EmptyTab
      title="Libro Diario"
      count={rows.length}
      text="Infraestructura preparada. La generación de asientos se implementará en la Fase 2."
    />
  );
}

function EmptyTab({ title, count, text }: { title: string; count: number; text: string }) {
  return (
    <div className="rounded-2xl border bg-slate-50 p-5">
      <div className="flex items-center justify-between gap-3">
        <h3 className="font-black text-[#003565]">{title}</h3>
        <span className="rounded-full bg-white px-3 py-1 text-xs font-black text-slate-500">
          {count} registros
        </span>
      </div>
      <p className="mt-3 text-sm font-semibold text-slate-500">{text}</p>
    </div>
  );
}

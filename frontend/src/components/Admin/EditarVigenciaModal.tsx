import { CalendarDays, Loader2, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { ContribuyenteAdmin } from "./AdminContribuyentesPanel";

interface EditarVigenciaModalProps {
  contribuyente: ContribuyenteAdmin | null;
  loading: boolean;
  onCancel: () => void;
  onConfirm: (fechaExpiracion: string) => void;
}

const quickOptions = [
  { label: "+7 días", days: 7 },
  { label: "+30 días", days: 30 },
  { label: "+3 meses", months: 3 },
  { label: "+4 meses", months: 4 },
  { label: "+6 meses", months: 6 },
  { label: "+1 año", years: 1 },
];

export default function EditarVigenciaModal({
  contribuyente,
  loading,
  onCancel,
  onConfirm,
}: EditarVigenciaModalProps) {
  const [fechaExpiracion, setFechaExpiracion] = useState(getDefaultDateValue);

  useEffect(() => {
    if (contribuyente?.fechaExpiracion) {
      setFechaExpiracion(formatDateInput(new Date(contribuyente.fechaExpiracion)));
    } else if (contribuyente) {
      setFechaExpiracion(getDefaultDateValue());
    }
  }, [contribuyente]);

  const fechaInicio = useMemo(() => new Date(), [contribuyente]);

  if (!contribuyente) return null;

  const minDate = getTomorrowDateValue();

  const applyQuickOption = (option: (typeof quickOptions)[number]) => {
    const date = new Date();

    if (option.days) date.setDate(date.getDate() + option.days);
    if (option.months) date.setMonth(date.getMonth() + option.months);
    if (option.years) date.setFullYear(date.getFullYear() + option.years);

    setFechaExpiracion(formatDateInput(date));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 px-4 py-6">
      <section className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl">
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase tracking-wide text-slate-400">
              Editar vigencia
            </p>
            <h2 className="mt-1 text-xl font-black text-[#003565]">
              {contribuyente.razonSocial}
            </h2>
            <p className="mt-1 font-mono text-xs font-semibold text-slate-500">
              RUC {contribuyente.ruc}
            </p>
          </div>
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="rounded-xl p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 disabled:opacity-50"
            aria-label="Cerrar"
          >
            <X size={19} />
          </button>
        </div>

        <div className="mb-4 rounded-xl border border-slate-100 bg-slate-50 p-4">
          <p className="text-[10px] font-black uppercase tracking-wide text-slate-400">
            Fecha de inicio informativa
          </p>
          <p className="mt-1 text-sm font-black text-slate-700">
            {fechaInicio.toLocaleDateString("es-EC")}
          </p>
        </div>

        <label className="text-xs font-black uppercase tracking-wide text-slate-500">
          Fecha de fin
        </label>
        <div className="mt-2 flex overflow-hidden rounded-xl border border-slate-200 bg-white">
          <div className="flex items-center px-3 text-[#006aa6]">
            <CalendarDays size={18} />
          </div>
          <input
            type="date"
            value={fechaExpiracion}
            min={minDate}
            onChange={(event) => setFechaExpiracion(event.target.value)}
            className="w-full px-2 py-3 text-sm font-bold text-slate-700 outline-none"
          />
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
          {quickOptions.map((option) => (
            <button
              key={option.label}
              type="button"
              onClick={() => applyQuickOption(option)}
              disabled={loading}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-black text-[#003565] transition hover:bg-blue-50 disabled:opacity-50"
            >
              {option.label}
            </button>
          ))}
        </div>

        <p className="mt-4 text-sm font-semibold leading-6 text-slate-500">
          Esta acción solo actualiza la fecha de expiración. No cambia si el
          contribuyente está activo o desactivado.
        </p>

        <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-black text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={() => onConfirm(fechaExpiracion)}
            disabled={loading || !fechaExpiracion}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#003565] px-4 py-3 text-sm font-black text-white transition hover:bg-[#004784] disabled:opacity-60"
          >
            {loading && <Loader2 className="animate-spin" size={16} />}
            Guardar vigencia
          </button>
        </div>
      </section>
    </div>
  );
}

function getDefaultDateValue(): string {
  const date = new Date();
  date.setMonth(date.getMonth() + 4);
  return formatDateInput(date);
}

function getTomorrowDateValue(): string {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  return formatDateInput(date);
}

function formatDateInput(date: Date): string {
  const safeDate = Number.isNaN(date.getTime()) ? new Date() : date;

  const year = safeDate.getFullYear();
  const month = String(safeDate.getMonth() + 1).padStart(2, "0");
  const day = String(safeDate.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

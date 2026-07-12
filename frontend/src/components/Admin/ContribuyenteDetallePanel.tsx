import { CalendarDays, Clock3, Mail, UserRound, X } from "lucide-react";
import type { ContribuyenteAdmin } from "./AdminContribuyentesPanel";
import { calcularDiasRestantes, calcularEstadoAcceso } from "../../utils/acceso";

interface ContribuyenteDetallePanelProps {
  contribuyente: ContribuyenteAdmin;
  fechaActual: Date;
  onClose: () => void;
}

export default function ContribuyenteDetallePanel({
  contribuyente,
  fechaActual,
  onClose,
}: ContribuyenteDetallePanelProps) {
  const diasRestantes = calcularDiasRestantes(
    contribuyente.fechaExpiracion,
    fechaActual
  );
  const estadoAcceso = calcularEstadoAcceso(
    contribuyente.activo,
    contribuyente.fechaExpiracion,
    fechaActual
  );

  return (
    <aside className="relative rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <button
        type="button"
        onClick={onClose}
        className="absolute right-4 top-4 inline-flex h-9 w-9 items-center justify-center rounded-xl text-slate-400 transition hover:bg-slate-100 hover:text-[#003565]"
        aria-label="Cerrar detalle del contribuyente"
      >
        <X size={18} />
      </button>

      <div className="mb-6 flex flex-col items-center text-center">
        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[#003565] text-lg font-black text-white">
          {getInitials(contribuyente.razonSocial)}
        </div>
        <h2 className="text-lg font-black text-[#003565]">
          {contribuyente.razonSocial}
        </h2>
        <div className="mt-3">
          <EstadoBadge estado={estadoAcceso} />
        </div>
      </div>

      <div className="space-y-3">
        <DetailItem
          icon={<UserRound size={17} />}
          label="RUC"
          value={contribuyente.ruc}
        />
        <DetailItem
          icon={<Mail size={17} />}
          label="Email"
          value={contribuyente.email || "-"}
        />
        <DetailItem
          icon={<CalendarDays size={17} />}
          label="Fecha de registro"
          value={formatDate(contribuyente.fechaRegistro || contribuyente.createdAt)}
        />
        <DetailItem
          icon={<CalendarDays size={17} />}
          label="Fecha de expiración"
          value={formatDate(contribuyente.fechaExpiracion)}
        />
        <DetailItem
          icon={<Clock3 size={17} />}
          label="Días restantes"
          value={
            estadoAcceso === "activo"
              ? `${diasRestantes ?? 0} días`
              : "0 días"
          }
        />
      </div>
    </aside>
  );
}

function DetailItem({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
      <div className="mb-2 flex items-center gap-2 text-slate-400">
        {icon}
        <p className="text-[10px] font-black uppercase tracking-wide">
          {label}
        </p>
      </div>
      <p className="break-words text-sm font-black text-slate-700">{value}</p>
    </div>
  );
}

function EstadoBadge({ estado }: { estado: ContribuyenteAdmin["estadoAcceso"] }) {
  const className =
    estado === "activo"
      ? "bg-emerald-50 text-emerald-700"
      : estado === "vencido"
      ? "bg-amber-50 text-amber-700"
      : "bg-red-50 text-red-700";

  return (
    <span className={`rounded-full px-3 py-1 text-xs font-black uppercase ${className}`}>
      {estado}
    </span>
  );
}

function formatDate(value?: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("es-EC");
}

function getInitials(value: string) {
  return value
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

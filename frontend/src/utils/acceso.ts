export type EstadoAcceso =
  | "activo"
  | "por_vencer"
  | "alerta"
  | "expira_hoy"
  | "vencido"
  | "desactivado"
  | "sin_vencimiento";

interface AccessInfoInput {
  activo?: boolean | null;
  diasRestantes?: number | null;
  estadoAcceso?: EstadoAcceso | string | null;
  fechaInicioAcceso?: string | Date | null;
  fechaFinAcceso?: string | Date | null;
  fechaExpiracion?: string | Date | null;
  porcentajeRestante?: number | null;
}

export interface AccessInfo {
  diasRestantes: number | null;
  porcentajeRestante: number | null;
  estadoAcceso: EstadoAcceso;
  fechaInicio: Date | null;
  fechaExpiracion: Date | null;
}

export function crearResumenAccesoDesdeBackend(input?: AccessInfoInput | null): AccessInfo {
  const estadoBackend = normalizeEstado(input?.estadoAcceso);
  const diasRestantes =
    typeof input?.diasRestantes === "number" && Number.isFinite(input.diasRestantes)
      ? input.diasRestantes
      : null;

  return {
    diasRestantes,
    porcentajeRestante:
      typeof input?.porcentajeRestante === "number" && Number.isFinite(input.porcentajeRestante)
        ? input.porcentajeRestante
        : null,
    estadoAcceso: estadoBackend || fallbackEstado(input?.activo, diasRestantes),
    fechaInicio: parseDate(input?.fechaInicioAcceso),
    fechaExpiracion: parseDate(input?.fechaFinAcceso ?? input?.fechaExpiracion),
  };
}

export function formatDiasAcceso(info: Pick<AccessInfo, "diasRestantes" | "estadoAcceso">) {
  if (info.estadoAcceso === "desactivado") return "Desactivado";
  if (info.estadoAcceso === "sin_vencimiento") return "Sin vencimiento";
  if (info.estadoAcceso === "vencido") return "Vencido";
  if (info.estadoAcceso === "expira_hoy" || info.diasRestantes === 0) return "Expira hoy";
  if (info.diasRestantes === null) return "-";
  if (info.diasRestantes === 1) return "1 día";
  return `${info.diasRestantes} días`;
}

function normalizeEstado(value?: string | null): EstadoAcceso | null {
  if (
    value === "activo" ||
    value === "por_vencer" ||
    value === "alerta" ||
    value === "expira_hoy" ||
    value === "vencido" ||
    value === "desactivado" ||
    value === "sin_vencimiento"
  ) {
    return value;
  }

  return null;
}

function fallbackEstado(activo?: boolean | null, diasRestantes?: number | null): EstadoAcceso {
  if (activo === false) return "desactivado";
  if (diasRestantes == null) return "sin_vencimiento";
  if (diasRestantes <= 0) return "expira_hoy";
  if (diasRestantes <= 7) return "alerta";
  if (diasRestantes <= 30) return "por_vencer";
  return "activo";
}

function parseDate(value?: string | Date | null) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

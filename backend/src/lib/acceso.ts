export const MESES_VIGENCIA_ACCESO = 4;
export const ZONA_HORARIA_ACCESO = "America/Guayaquil";

const MS_PER_DAY = 1000 * 60 * 60 * 24;
const ECUADOR_UTC_OFFSET_HOURS = 5;

export type EstadoAcceso =
  | "activo"
  | "expira_hoy"
  | "vencido"
  | "desactivado"
  | "sin_vencimiento";

type ContribuyenteAcceso = {
  activo: boolean;
  fechaExpiracion?: Date | null;
  fechaRegistro?: Date | null;
  createdAt?: Date | null;
};

function getEcuadorDateParts(value = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: ZONA_HORARIA_ACCESO,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(value);

  const find = (type: string) => Number(parts.find((part) => part.type === type)?.value);

  return {
    year: find("year"),
    month: find("month"),
    day: find("day"),
  };
}

export function fechaInicioDiaEcuador(year: number, month: number, day: number) {
  return new Date(Date.UTC(year, month - 1, day, ECUADOR_UTC_OFFSET_HOURS, 0, 0, 0));
}

export function inicioDiaActualEcuador(fechaActual = new Date()) {
  const parts = getEcuadorDateParts(fechaActual);
  return fechaInicioDiaEcuador(parts.year, parts.month, parts.day);
}

export function normalizarFechaExpiracionAcceso(fechaExpiracion: Date) {
  const parts = getEcuadorDateParts(fechaExpiracion);
  return fechaInicioDiaEcuador(parts.year, parts.month, parts.day);
}

export function esMismoDiaEcuador(first: Date, second: Date) {
  const firstParts = getEcuadorDateParts(first);
  const secondParts = getEcuadorDateParts(second);
  return (
    firstParts.year === secondParts.year &&
    firstParts.month === secondParts.month &&
    firstParts.day === secondParts.day
  );
}

export const calcularFechaExpiracion = (fechaBase = new Date()) => {
  const parts = getEcuadorDateParts(fechaBase);
  return fechaInicioDiaEcuador(
    parts.year,
    parts.month + MESES_VIGENCIA_ACCESO,
    parts.day
  );
};

export const calcularDiasRestantes = (
  fechaExpiracion?: Date | null,
  fechaActual = new Date()
) => {
  if (!fechaExpiracion) return null;

  const fecha = normalizarFechaExpiracionAcceso(fechaExpiracion);
  const diferenciaMs = fecha.getTime() - fechaActual.getTime();
  return Math.max(Math.ceil(diferenciaMs / MS_PER_DAY), 0);
};

export const calcularEstadoAcceso = (
  activo: boolean,
  fechaExpiracion?: Date | null,
  fechaActual = new Date()
) => {
  if (!activo) return "desactivado";
  if (!fechaExpiracion) return "sin_vencimiento";

  const fechaFinAcceso = normalizarFechaExpiracionAcceso(fechaExpiracion);
  const inicioHoy = inicioDiaActualEcuador(fechaActual);

  if (fechaFinAcceso < inicioHoy) return "vencido";
  if (esMismoDiaEcuador(fechaFinAcceso, fechaActual)) return "expira_hoy";

  return "activo";
};

export function calcularPorcentajeAccesoRestante(
  fechaInicio?: Date | null,
  fechaExpiracion?: Date | null,
  fechaActual = new Date()
) {
  if (!fechaInicio || !fechaExpiracion) return null;

  const inicio = normalizarFechaExpiracionAcceso(fechaInicio);
  const fin = normalizarFechaExpiracionAcceso(fechaExpiracion);
  const totalMs = fin.getTime() - inicio.getTime();

  if (totalMs <= 0) return null;

  const restanteMs = Math.max(fin.getTime() - fechaActual.getTime(), 0);
  return Math.max(0, Math.min(100, Math.round((restanteMs / totalMs) * 100)));
}

export function construirResumenAcceso(
  contribuyente: ContribuyenteAcceso,
  fechaActual = new Date()
) {
  const fechaInicioAcceso = contribuyente.fechaRegistro || contribuyente.createdAt || null;
  const fechaFinAcceso = contribuyente.fechaExpiracion || null;
  const diasRestantes = calcularDiasRestantes(fechaFinAcceso, fechaActual);
  const estadoAcceso = calcularEstadoAcceso(
    contribuyente.activo,
    fechaFinAcceso,
    fechaActual
  );

  return {
    diasRestantes,
    estadoAcceso,
    fechaInicioAcceso,
    fechaFinAcceso,
    porcentajeRestante: calcularPorcentajeAccesoRestante(
      fechaInicioAcceso,
      fechaFinAcceso,
      fechaActual
    ),
    zonaHorariaAcceso: ZONA_HORARIA_ACCESO,
  };
}

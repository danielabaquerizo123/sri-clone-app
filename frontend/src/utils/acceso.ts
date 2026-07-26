const MS_PER_DAY = 1000 * 60 * 60 * 24;

export type EstadoAcceso = "activo" | "por_vencer" | "alerta" | "vencido" | "desactivado";

interface AccessInfoInput {
  activo: boolean;
  fechaInicio?: string | Date | null;
  fechaExpiracion?: string | Date | null;
  fechaActual?: Date;
}

export interface AccessInfo {
  diasRestantes: number | null;
  porcentajeRestante: number | null;
  estadoAcceso: EstadoAcceso;
  fechaInicio: Date | null;
  fechaExpiracion: Date | null;
}

export function calcularDiasRestantes(
  fechaExpiracion?: string | Date | null,
  fechaActual: Date = new Date()
) {
  if (!fechaExpiracion) return null;

  const fecha = new Date(fechaExpiracion);

  if (Number.isNaN(fecha.getTime())) return null;

  const diferenciaMs = fecha.getTime() - fechaActual.getTime();

  return Math.max(Math.ceil(diferenciaMs / MS_PER_DAY), 0);
}

export function estaPorVencer(
  fechaExpiracion?: string | Date | null,
  fechaActual: Date = new Date()
) {
  const diasRestantes = calcularDiasRestantes(fechaExpiracion, fechaActual);

  return diasRestantes !== null && diasRestantes >= 0 && diasRestantes <= 7;
}

export function calcularEstadoAcceso(
  activo: boolean,
  fechaExpiracion?: string | Date | null,
  fechaActual: Date = new Date()
) {
  if (!activo) return "desactivado";

  if (!fechaExpiracion) return "vencido";

  const fecha = new Date(fechaExpiracion);

  if (Number.isNaN(fecha.getTime())) return "vencido";

  return fechaActual > fecha ? "vencido" : "activo";
}

export function calcularResumenAcceso({
  activo,
  fechaActual = new Date(),
  fechaExpiracion,
  fechaInicio,
}: AccessInfoInput): AccessInfo {
  const inicio = parseDate(fechaInicio);
  const expiracion = parseDate(fechaExpiracion);
  const diasRestantes = calcularDiasRestantes(expiracion, fechaActual);

  if (!activo) {
    return {
      diasRestantes,
      porcentajeRestante: 0,
      estadoAcceso: "desactivado",
      fechaInicio: inicio,
      fechaExpiracion: expiracion,
    };
  }

  if (!expiracion || fechaActual > expiracion) {
    return {
      diasRestantes: diasRestantes ?? 0,
      porcentajeRestante: 0,
      estadoAcceso: "vencido",
      fechaInicio: inicio,
      fechaExpiracion: expiracion,
    };
  }

  const porcentajeRestante = calcularPorcentajeRestante(inicio, expiracion, fechaActual);

  return {
    diasRestantes,
    porcentajeRestante,
    estadoAcceso: getEstadoPorDias(diasRestantes),
    fechaInicio: inicio,
    fechaExpiracion: expiracion,
  };
}

function calcularPorcentajeRestante(
  fechaInicio: Date | null,
  fechaExpiracion: Date,
  fechaActual: Date
) {
  if (!fechaInicio) return null;

  const totalMs = fechaExpiracion.getTime() - fechaInicio.getTime();
  if (totalMs <= 0) return null;

  const restanteMs = Math.max(fechaExpiracion.getTime() - fechaActual.getTime(), 0);
  return Math.max(0, Math.min(100, Math.round((restanteMs / totalMs) * 100)));
}

function getEstadoPorDias(diasRestantes: number | null): EstadoAcceso {
  if (diasRestantes === null) return "activo";
  if (diasRestantes <= 7) return "alerta";
  if (diasRestantes <= 30) return "por_vencer";
  return "activo";
}

function parseDate(value?: string | Date | null) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

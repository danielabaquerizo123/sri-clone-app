const MS_PER_DAY = 1000 * 60 * 60 * 24;

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

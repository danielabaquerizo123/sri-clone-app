export const MESES_VIGENCIA_ACCESO = 4;

export const calcularFechaExpiracion = (fechaBase = new Date()) => {
  const fechaExpiracion = new Date(fechaBase);
  fechaExpiracion.setMonth(
    fechaExpiracion.getMonth() + MESES_VIGENCIA_ACCESO
  );
  return fechaExpiracion;
};

export const calcularDiasRestantes = (
  fechaExpiracion: Date,
  fechaActual = new Date()
) => {
  const diferenciaMs = fechaExpiracion.getTime() - fechaActual.getTime();
  return Math.max(Math.ceil(diferenciaMs / (1000 * 60 * 60 * 24)), 0);
};

export const calcularEstadoAcceso = (
  activo: boolean,
  fechaExpiracion: Date,
  fechaActual = new Date()
) => {
  if (!activo) return "desactivado";
  if (fechaActual > fechaExpiracion) return "vencido";
  return "activo";
};

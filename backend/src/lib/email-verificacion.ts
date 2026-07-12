import crypto from "crypto";

export const HORAS_EXPIRACION_VERIFICACION = 24;
export const HORAS_EXPIRACION_RESET_PASSWORD = 1;

export const generarVerificationToken = () =>
  crypto.randomBytes(32).toString("hex");

export const generarResetToken = () =>
  crypto.randomBytes(32).toString("hex");

export const calcularVerificationExpires = (fechaBase = new Date()) => {
  const fechaExpiracion = new Date(fechaBase);
  fechaExpiracion.setHours(
    fechaExpiracion.getHours() + HORAS_EXPIRACION_VERIFICACION
  );
  return fechaExpiracion;
};

export const calcularResetTokenExpires = (fechaBase = new Date()) => {
  const fechaExpiracion = new Date(fechaBase);
  fechaExpiracion.setHours(
    fechaExpiracion.getHours() + HORAS_EXPIRACION_RESET_PASSWORD
  );
  return fechaExpiracion;
};

export const construirUrlVerificacion = (token: string) => {
  const appUrl = process.env.APP_URL || process.env.FRONTEND_URL || "http://localhost:5173";
  const url = new URL(appUrl);
  url.searchParams.set("verifyEmailToken", token);
  return url.toString();
};

export const construirUrlResetPassword = (token: string) => {
  const appUrl = process.env.FRONTEND_URL || process.env.APP_URL || "http://localhost:5173";
  const url = new URL(appUrl);
  url.pathname = "/reset-password";
  url.searchParams.set("token", token);
  return url.toString();
};

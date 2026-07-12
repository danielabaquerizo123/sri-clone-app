import { Resend } from "resend";

const getResendClient = () => {
  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey) {
    throw new Error("RESEND_API_KEY no está definido en el entorno.");
  }

  return new Resend(apiKey);
};

export const enviarCorreoVerificacion = async (params: {
  to: string;
  razonSocial: string;
  verificationUrl: string;
}) => {
  const from = process.env.EMAIL_FROM || "onboarding@resend.dev";
  const resend = getResendClient();

  await resend.emails.send({
    from,
    to: params.to,
    subject: "Verifica tu correo en SRI Clone App",
    html: `
      <div style="font-family: Arial, sans-serif; color: #0f172a; line-height: 1.5;">
        <h2 style="color: #003565;">Verifica tu correo electrónico</h2>
        <p>Hola ${escapeHtml(params.razonSocial)},</p>
        <p>Para activar tu acceso a SRI Clone App, confirma tu correo electrónico en el siguiente enlace:</p>
        <p>
          <a href="${params.verificationUrl}" style="display: inline-block; background: #003565; color: #ffffff; padding: 12px 18px; border-radius: 8px; text-decoration: none; font-weight: bold;">
            Verificar correo
          </a>
        </p>
        <p>Este enlace vence en 24 horas.</p>
        <p>Si no solicitaste este registro, puedes ignorar este mensaje.</p>
      </div>
    `,
    text: `Hola ${params.razonSocial}. Verifica tu correo en este enlace: ${params.verificationUrl}. Este enlace vence en 24 horas.`,
  });
};

export const enviarCorreoRecuperacionPassword = async (params: {
  to: string;
  razonSocial: string;
  resetUrl: string;
}) => {
  const from = process.env.EMAIL_FROM || "onboarding@resend.dev";
  const resend = getResendClient();

  await resend.emails.send({
    from,
    to: params.to,
    subject: "Recupera tu contraseña en SRI Clone App",
    html: `
      <div style="font-family: Arial, sans-serif; color: #0f172a; line-height: 1.5;">
        <h2 style="color: #003565;">Recupera tu contraseña</h2>
        <p>Hola ${escapeHtml(params.razonSocial)},</p>
        <p>Recibimos una solicitud para cambiar la contraseña de tu cuenta. Usa el siguiente enlace para registrar una nueva clave:</p>
        <p>
          <a href="${params.resetUrl}" style="display: inline-block; background: #003565; color: #ffffff; padding: 12px 18px; border-radius: 8px; text-decoration: none; font-weight: bold;">
            Cambiar contraseña
          </a>
        </p>
        <p>Este enlace vence en 1 hora y solo puede usarse una vez.</p>
        <p>Si no solicitaste este cambio, puedes ignorar este mensaje.</p>
      </div>
    `,
    text: `Hola ${params.razonSocial}. Cambia tu contraseña en este enlace: ${params.resetUrl}. Este enlace vence en 1 hora y solo puede usarse una vez.`,
  });
};

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

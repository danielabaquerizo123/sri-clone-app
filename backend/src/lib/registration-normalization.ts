export type RegistrationInputLike = {
  tipoIdentificacion?: unknown;
  identificacion?: unknown;
  razonSocial?: unknown;
  tipoContribuyente?: unknown;
  email?: unknown;
  telefono?: unknown;
  password?: unknown;
  confirmPassword?: unknown;
};

export const normalizeUppercaseText = (value: unknown) =>
  String(value ?? "")
    .trim()
    .replace(/\s+/g, " ")
    .toLocaleUpperCase("es");

export const normalizeEmail = (value: unknown) =>
  String(value ?? "").trim().toLowerCase();

export const normalizeRegistrationInput = (input: RegistrationInputLike) => ({
  tipoIdentificacion: input.tipoIdentificacion,
  identificacion: String(input.identificacion ?? "").trim(),
  razonSocial: normalizeUppercaseText(input.razonSocial),
  tipoContribuyente: input.tipoContribuyente,
  email: normalizeEmail(input.email),
  telefono: String(input.telefono ?? "").trim().replace(/\s+/g, " "),
  password: input.password,
  confirmPassword: input.confirmPassword,
});

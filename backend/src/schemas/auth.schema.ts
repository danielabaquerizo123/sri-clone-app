import { z } from "zod";

export const loginSchema = z.object({
  ruc: z
    .string({ required_error: "El RUC/C.I./Pasaporte es requerido" })
    .min(10, "Debe tener al menos 10 dígitos")
    .max(13, "No puede superar 13 dígitos"),

  ciAdicional: z
    .string()
    .max(10, "La C.I. adicional no puede superar 10 dígitos")
    .optional()
    .nullable(),

  clave: z
    .string({ required_error: "La clave es requerida" })
    .min(1, "La clave es requerida"),
});

export type LoginInput = z.infer<typeof loginSchema>;
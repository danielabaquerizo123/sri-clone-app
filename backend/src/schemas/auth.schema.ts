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

export const registerSchema = z
  .object({
    tipoIdentificacion: z.enum(["CEDULA", "RUC"], {
      required_error: "El tipo de identificación es requerido",
    }),
    identificacion: z
      .string({ required_error: "La identificación es requerida" })
      .regex(/^\d+$/, "La identificación solo debe contener dígitos"),
    razonSocial: z
      .string({ required_error: "Los nombres o razón social son requeridos" })
      .trim()
      .min(3, "Ingrese nombres o razón social válidos"),
    tipoContribuyente: z.enum(["PERSONA_NATURAL", "SOCIEDAD"], {
      required_error: "El tipo de contribuyente es requerido",
    }),
    email: z
      .string({ required_error: "El correo electrónico es requerido" })
      .trim()
      .email("Ingrese un correo electrónico válido"),
    telefono: z
      .string({ required_error: "El teléfono es requerido" })
      .trim()
      .min(7, "Ingrese un teléfono válido")
      .max(20, "El teléfono no puede superar 20 caracteres"),
    password: z
      .string({ required_error: "La contraseña es requerida" })
      .min(8, "La contraseña debe tener mínimo 8 caracteres"),
    confirmPassword: z.string({
      required_error: "Debe confirmar la contraseña",
    }),
  })
  .superRefine((data, ctx) => {
    if (data.tipoIdentificacion === "CEDULA" && data.identificacion.length !== 10) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["identificacion"],
        message: "La cédula debe tener 10 dígitos",
      });
    }

    if (data.tipoIdentificacion === "RUC" && data.identificacion.length !== 13) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["identificacion"],
        message: "El RUC debe tener 13 dígitos",
      });
    }

    if (data.password !== data.confirmPassword) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["confirmPassword"],
        message: "La confirmación no coincide con la contraseña",
      });
    }
  });

export type RegisterInput = z.infer<typeof registerSchema>;

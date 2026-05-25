import { z } from 'zod'

// Validación básica de RUC ecuatoriano: 13 dígitos
const rucRegex = /^\d{13}$/

export const createContribuyenteSchema = z.object({
  ruc: z
    .string({ required_error: 'El RUC es requerido' })
    .regex(rucRegex, 'El RUC debe tener exactamente 13 dígitos numéricos'),
  razonSocial: z
    .string({ required_error: 'La razón social es requerida' })
    .min(3, 'La razón social debe tener al menos 3 caracteres')
    .max(300),
  nombreComercial: z.string().max(300).optional(),
  email: z.string().email('Correo inválido').optional().or(z.literal('')),
  telefono: z
    .string()
    .regex(/^\d{7,10}$/, 'Teléfono debe tener entre 7 y 10 dígitos')
    .optional()
    .or(z.literal('')),
  direccion: z.string().max(500).optional(),
  tipo: z
    .enum(['PERSONA_NATURAL', 'SOCIEDAD', 'PERSONA_NATURAL_NO_OBLIGADA'])
    .default('PERSONA_NATURAL'),
  estado: z
    .enum(['ACTIVO', 'SUSPENDIDO', 'CANCELADO', 'PASIVO'])
    .default('ACTIVO'),
  obligadoContabilidad: z.boolean().default(false),
})

export type CreateContribuyenteInput = z.infer<typeof createContribuyenteSchema>

export type AccountingClassificationConfidence = "ALTA" | "MEDIA" | "BAJA";

export type AccountingClassificationOrigin =
  | "REGLA_PROVEEDOR"
  | "REGLA_ACTIVIDAD"
  | "REGLA_CONCEPTO"
  | "REGLA_SUSTENTO"
  | "REGLA_GENERAL"
  | "SIN_CLASIFICACION";

export type AccountingClassification = {
  categoria: string;
  cuentaSugeridaCodigo?: string;
  reglaSugeridaId?: string;
  confianza: AccountingClassificationConfidence;
  origen: AccountingClassificationOrigin;
  requiereRevision: boolean;
  motivos: string[];
  evidencias: string[];
};

export const SIN_CLASIFICACION: AccountingClassification = {
  categoria: "SIN_CLASIFICACION",
  confianza: "BAJA",
  origen: "SIN_CLASIFICACION",
  requiereRevision: true,
  motivos: ["Documento pendiente de clasificacion contable."],
  evidencias: [],
};

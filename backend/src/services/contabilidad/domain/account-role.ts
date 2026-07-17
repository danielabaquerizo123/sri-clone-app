export type RequiredAccountRole =
  | "GASTO_COSTO_ACTIVO"
  | "IVA_CREDITO_TRIBUTARIO"
  | "CUENTAS_POR_PAGAR_PROVEEDORES"
  | "RETENCION_FUENTE_POR_PAGAR"
  | "RETENCION_IVA_POR_PAGAR"
  | "INGRESO"
  | "IVA_POR_PAGAR"
  | "CUENTAS_POR_COBRAR_CLIENTES"
  | "RETENCION_FUENTE_POR_COBRAR"
  | "RETENCION_IVA_POR_COBRAR"
  | "CUENTA_FINANCIERA";

export type AccountCandidate = {
  id: string;
  codigo: string;
  nombre: string;
  activa: boolean;
  movimiento: boolean;
  tipo?: string | null;
  naturaleza?: string | null;
};

export type AccountResolutionOrigin =
  | "REGLA_CONTABLE"
  | "MAPEO_TEMPORAL"
  | "CLASIFICACION"
  | "SIN_RESOLVER";

export type ResolvedAccount = {
  role: RequiredAccountRole;
  resolved: boolean;
  cuenta?: AccountCandidate;
  origen: AccountResolutionOrigin;
  confianza: "ALTA" | "MEDIA" | "BAJA";
  requiereRevision: boolean;
  motivos: string[];
};

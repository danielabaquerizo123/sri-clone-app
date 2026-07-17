import type { AccountingClassification } from "./accounting-classification";
import type { AccountingDocumentEvidence } from "./accounting-document";
import type { RequiredAccountRole } from "./account-role";

export type AccountingEventType =
  | "DEVENGO_COMPRA"
  | "DEVENGO_VENTA"
  | "PAGO_PROVEEDOR"
  | "COBRO_CLIENTE"
  | "RETENCION_EMITIDA"
  | "RETENCION_RECIBIDA"
  | "NOTA_CREDITO_COMPRA"
  | "NOTA_CREDITO_VENTA"
  | "NOTA_DEBITO_COMPRA"
  | "NOTA_DEBITO_VENTA";

export type AccountingEventStatus =
  | "GENERABLE"
  | "PENDIENTE_EVIDENCIA"
  | "PENDIENTE_CLASIFICACION"
  | "NO_APLICA";

export type AccountingEvidence = AccountingDocumentEvidence;

export type AccountingEventAmounts = {
  base: number;
  iva: number;
  totalDocumento: number;
  retencionFuente: number;
  retencionIva: number;
  netoPagadoOCobrado: number;
  saldoPendiente: number;
};

export type AccountingEvent = {
  idTemporal: string;
  tipo: AccountingEventType;
  estado: AccountingEventStatus;
  fecha: Date;
  fechaRetencion?: Date | null;
  hojaOrigen: string;
  filaOrigen: number;
  documentoOrigen: string;
  tercero: {
    identificacion: string;
    razonSocial: string;
  };
  montos: AccountingEventAmounts;
  rolesRequeridos: RequiredAccountRole[];
  clasificacion?: AccountingClassification;
  evidencias: AccountingEvidence[];
  motivos: string[];
  requiereRevision: boolean;
  eventoRelacionadoId?: string;
};

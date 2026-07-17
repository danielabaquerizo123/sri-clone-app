import type { AccountingClassification } from "./accounting-classification";

export type AccountingDocumentSource = "COMPRAS" | "VENTAS" | "GASTOS";
export type AccountingOperationType = "COMPRA" | "VENTA" | "GASTO";

export type AccountingDocumentEvidence = {
  campo: string;
  valor: string | number | boolean | null;
  origen: AccountingDocumentSource | string;
  descripcion: string;
};

export type AccountingRetentionSource = {
  codigo?: string | null;
  base: number;
  porcentaje?: number | null;
  valor: number;
};

export type AccountingRetentionIva = {
  porcentaje: number;
  valor: number;
};

export type AccountingRetentionData = {
  tipoEmision?: string | null;
  establecimiento?: string | null;
  puntoEmision?: string | null;
  secuencial?: string | null;
  autorizacion?: string | null;
  fechaEmision?: Date | null;
  retencionesFuente: AccountingRetentionSource[];
  retencionesIva: AccountingRetentionIva[];
  totalRetenidoFuente: number;
  totalRetenidoIva: number;
};

export type PaymentEvidence = {
  tipoPago?: string | null;
  formaPago1?: string | null;
  formaPago2?: string | null;
};

export type CollectionEvidence = {
  formaCobro1?: string | null;
  formaCobro2?: string | null;
};

export type AccountingDocument = {
  hojaOrigen: AccountingDocumentSource;
  filaOrigen: number;
  documentoOrigen: string;
  fechaEmision: Date;
  fechaRegistro?: Date | null;
  identificacionTercero: string;
  razonSocialTercero: string;
  tipoOperacion: AccountingOperationType;
  tipoComprobante: string | null;
  codigoSustento?: string | null;
  baseNoObjeto?: number;
  baseExenta?: number;
  baseTarifa0?: number;
  baseGravada?: number;
  iva?: number;
  total?: number;
  paymentEvidence?: PaymentEvidence;
  collectionEvidence?: CollectionEvidence;
  datosRetencion?: AccountingRetentionData;
  clasificacion?: AccountingClassification;
  actividadEconomica?: string | null;
  concepto?: string | null;
  documentoModificado?: string | null;
  autorizacionModificada?: string | null;
  evidencias?: AccountingDocumentEvidence[];
  raw?: unknown;
};

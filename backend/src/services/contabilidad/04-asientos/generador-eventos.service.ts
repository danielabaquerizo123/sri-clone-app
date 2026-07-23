import type { AccountingClassificationResult } from "../02-clasificacion/clasificador.service";
import type {
  AccountingDocument,
  AccountingDocumentEvidence,
  AccountingRetentionData,
  AccountingRetentionIva,
  AccountingRetentionSource,
  RequiredAccountRole,
} from "../contratos";
import { TipoComprobanteSRI } from "../../../constants/tipos-comprobante-sri";

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

export type NormalizedAccountingSourceDocument = Omit<AccountingDocument, "clasificacion"> & {
  clasificacion: AccountingClassificationResult;
};

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
  clasificacion: AccountingClassificationResult;
  evidencias: AccountingEvidence[];
  motivos: string[];
  reglaSugeridaCodigo?: string;
  requiereRevision: boolean;
  eventoRelacionadoId?: string;
  documentoOriginalId?: string;
  documentoOriginalNumero?: string;
  metodoRelacion?: string;
  confianzaRelacion?: "ALTA" | "MEDIA" | "BAJA";
  valoresOriginales?: AccountingEventAmounts;
  valoresRevertidos?: AccountingEventAmounts;
  esReversoParcial?: boolean;
  motivoRevision?: string;
};

export type AccountingEventIssue = {
  tipo: "ERROR" | "WARNING" | "INFO";
  codigo: string;
  hojaOrigen: string;
  filaOrigen: number;
  documentoOrigen: string;
  mensaje: string;
};

export type AccountingEventGenerationResult = {
  documentosProcesados: number;
  eventos: AccountingEvent[];
  eventosGenerables: number;
  eventosPendientesEvidencia: number;
  eventosPendientesClasificacion: number;
  warnings: AccountingEventIssue[];
  errors: AccountingEventIssue[];
};

type CompraLike = Record<string, unknown>;
type VentaLike = Record<string, unknown>;

const ZERO_CLASSIFICATION: AccountingClassificationResult = {
  categoria: "SIN_CLASIFICACION",
  categoriaBase: null,
  destinoContable: null,
  confianzaCategoria: "BAJA",
  confianzaDestino: "BAJA",
  requiereDecisionDestino: false,
  alternativasDestino: [],
  confianza: "BAJA",
  origen: "SIN_CLASIFICACION",
  requiereRevision: true,
  motivos: ["Documento sin clasificacion contable recibida por el generador de eventos."],
  evidencias: [],
};

function roundMoney(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function money(value: unknown): number {
  if (typeof value === "number") return roundMoney(value);
  if (typeof value === "bigint") return Number(value);
  const text = String(value ?? "").trim();
  if (!text || text === "-" || text === "–" || text === "—") return 0;
  const normalized = text.replace(/\s/g, "").replace(",", ".");
  const numberValue = Number(normalized);
  return Number.isFinite(numberValue) ? roundMoney(numberValue) : 0;
}

function text(value: unknown): string {
  return String(value ?? "").trim();
}

function dateValue(value: unknown, fallback = new Date()): Date {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
  const parsed = new Date(String(value ?? ""));
  return Number.isNaN(parsed.getTime()) ? fallback : parsed;
}

function sum(values: number[]): number {
  return roundMoney(values.reduce((total, value) => total + money(value), 0));
}

function positiveRetentions<T extends { valor: number }>(items: T[]): T[] {
  return items.filter((item) => money(item.valor) > 0);
}

function eventStatus(classification: AccountingClassificationResult): AccountingEventStatus {
  return classification.origen === "SIN_CLASIFICACION" ||
    classification.confianza === "BAJA" ||
    (classification.requiereRevision &&
      !classification.reglaSugeridaId &&
      !classification.cuentaSugeridaCodigo)
    ? "PENDIENTE_CLASIFICACION"
    : "GENERABLE";
}

function hasCode(value: string | null | undefined, code: string) {
  return String(value ?? "").padStart(2, "0") === code;
}

function eventId(document: NormalizedAccountingSourceDocument, suffix: string) {
  return [
    document.hojaOrigen,
    document.filaOrigen,
    document.documentoOrigen || "SIN_DOCUMENTO",
    suffix,
  ].join(":");
}

function baseAmount(document: NormalizedAccountingSourceDocument): number {
  return sum([
    document.baseNoObjeto || 0,
    document.baseExenta || 0,
    document.baseTarifa0 || 0,
    document.baseGravada || 0,
  ]);
}

function totalAmount(document: NormalizedAccountingSourceDocument): number {
  const total = money(document.total);
  return total !== 0 ? total : sum([baseAmount(document), document.iva || 0]);
}

export function sumRetencionesFuente(retenciones: AccountingRetentionSource[] = []): number {
  return sum(retenciones.map((item) => item.valor));
}

export function sumRetencionesIva(retenciones: AccountingRetentionIva[] = []): number {
  return sum(retenciones.map((item) => item.valor));
}

export function calculatePendingBalance(total: number, retencionFuente: number, retencionIva: number): number {
  return roundMoney(total - retencionFuente - retencionIva);
}

export function validateRetentionsDoNotExceedTotal(
  document: NormalizedAccountingSourceDocument
): AccountingEventIssue[] {
  const total = totalAmount(document);
  const retentionTotal = sum([
    document.datosRetencion?.totalRetenidoFuente || 0,
    document.datosRetencion?.totalRetenidoIva || 0,
  ]);
  const limit = Math.abs(total);

  if (retentionTotal <= limit) return [];

  return [
    {
      tipo: "ERROR",
      codigo: "RETENCIONES_SUPERAN_TOTAL",
      hojaOrigen: document.hojaOrigen,
      filaOrigen: document.filaOrigen,
      documentoOrigen: document.documentoOrigen,
      mensaje: `Las retenciones (${retentionTotal.toFixed(2)}) superan el total del documento (${total.toFixed(2)}).`,
    },
  ];
}

function baseEvent(
  document: NormalizedAccountingSourceDocument,
  params: {
    suffix: string;
    tipo: AccountingEventType;
    estado?: AccountingEventStatus;
    rolesRequeridos: RequiredAccountRole[];
    evidencias: AccountingEvidence[];
    motivos: string[];
    eventoRelacionadoId?: string;
    fecha?: Date;
    fechaRetencion?: Date | null;
    retencionFuente?: number;
    retencionIva?: number;
  }
): AccountingEvent {
  const total = totalAmount(document);
  const retencionFuente = money(params.retencionFuente);
  const retencionIva = money(params.retencionIva);

  return {
    idTemporal: eventId(document, params.suffix),
    tipo: params.tipo,
    estado: params.estado || eventStatus(document.clasificacion),
    fecha: params.fecha || document.fechaEmision,
    fechaRetencion: params.fechaRetencion,
    hojaOrigen: document.hojaOrigen,
    filaOrigen: document.filaOrigen,
    documentoOrigen: document.documentoOrigen,
    tercero: {
      identificacion: document.identificacionTercero,
      razonSocial: document.razonSocialTercero,
    },
    montos: {
      base: baseAmount(document),
      iva: money(document.iva),
      totalDocumento: total,
      retencionFuente,
      retencionIva,
      netoPagadoOCobrado: calculatePendingBalance(total, retencionFuente, retencionIva),
      saldoPendiente: calculatePendingBalance(total, retencionFuente, retencionIva),
    },
    rolesRequeridos: params.rolesRequeridos,
    clasificacion: document.clasificacion,
    evidencias: [...params.evidencias, ...(document.evidencias || [])],
    motivos: [...params.motivos, ...(document.clasificacion.motivos || [])],
    reglaSugeridaCodigo: document.clasificacion.reglaSugeridaId,
    requiereRevision:
      params.estado === "PENDIENTE_EVIDENCIA" ||
      document.clasificacion.requiereRevision ||
      document.clasificacion.confianza === "BAJA",
    eventoRelacionadoId: params.eventoRelacionadoId,
  };
}

function devengoCompraRoles(document: NormalizedAccountingSourceDocument): RequiredAccountRole[] {
  return [
    "GASTO_COSTO_ACTIVO",
    ...(money(document.iva) !== 0 ? (["IVA_CREDITO_TRIBUTARIO"] as RequiredAccountRole[]) : []),
    "CUENTAS_POR_PAGAR_PROVEEDORES",
  ];
}

function devengoVentaRoles(document: NormalizedAccountingSourceDocument): RequiredAccountRole[] {
  return [
    "CUENTAS_POR_COBRAR_CLIENTES",
    "INGRESO_VENTAS",
    ...(money(document.iva) !== 0 ? (["IVA_POR_PAGAR"] as RequiredAccountRole[]) : []),
  ];
}

function paymentEvidence(document: NormalizedAccountingSourceDocument): AccountingEvidence[] {
  const evidencias: Array<AccountingEvidence | null> = [
    document.paymentEvidence?.formaPago1
      ? {
          campo: "formaPago1",
          valor: document.paymentEvidence.formaPago1,
          origen: document.hojaOrigen,
          descripcion: "Forma de pago tributaria declarada para resolver dinamicamente caja o banco.",
        }
      : null,
    document.paymentEvidence?.formaPago2
      ? {
          campo: "formaPago2",
          valor: document.paymentEvidence.formaPago2,
          origen: document.hojaOrigen,
          descripcion: "Forma de pago tributaria secundaria declarada para resolver dinamicamente caja o banco.",
        }
      : null,
    document.fechaRegistro
      ? {
          campo: "fechaRegistro",
          valor: document.fechaRegistro.toISOString().slice(0, 10),
          origen: document.hojaOrigen,
          descripcion: "Fecha de registro de COMPRAS usada para el asiento de pago.",
        }
      : null,
    {
      campo: "tipoComprobante",
      valor: document.tipoComprobante,
      origen: document.hojaOrigen,
      descripcion: "Tipo de comprobante declarado en el ATS.",
    },
  ];
  return evidencias.filter((item): item is AccountingEvidence => item !== null);
}

function collectionEvidence(document: NormalizedAccountingSourceDocument): AccountingEvidence[] {
  const evidencias: Array<AccountingEvidence | null> = [
    document.collectionEvidence?.formaCobro1
      ? {
          campo: "formaCobro1",
          valor: document.collectionEvidence.formaCobro1,
          origen: document.hojaOrigen,
          descripcion: "Forma de cobro tributaria declarada para resolver dinamicamente caja o banco.",
        }
      : null,
    document.collectionEvidence?.formaCobro2
      ? {
          campo: "formaCobro2",
          valor: document.collectionEvidence.formaCobro2,
          origen: document.hojaOrigen,
          descripcion: "Forma de cobro tributaria secundaria declarada para resolver dinamicamente caja o banco.",
        }
      : null,
    {
      campo: "fechaEmision",
      valor: document.fechaEmision.toISOString().slice(0, 10),
      origen: document.hojaOrigen,
      descripcion: "Fecha de emision de VENTAS usada tambien para el asiento de cobro porque la hoja no contiene Fecha de Registro.",
    },
    {
      campo: "tipoComprobante",
      valor: document.tipoComprobante,
      origen: document.hojaOrigen,
      descripcion: "Tipo de comprobante declarado en el ATS.",
    },
  ];
  return evidencias.filter((item): item is AccountingEvidence => item !== null);
}

function hasPaymentMethod(document: NormalizedAccountingSourceDocument) {
  return Boolean(document.paymentEvidence?.formaPago1 || document.paymentEvidence?.formaPago2);
}

function hasCollectionMethod(document: NormalizedAccountingSourceDocument) {
  return Boolean(document.collectionEvidence?.formaCobro1 || document.collectionEvidence?.formaCobro2);
}

function retentionEvidence(document: NormalizedAccountingSourceDocument): AccountingEvidence[] {
  const retention = document.datosRetencion;
  if (!retention) return [];

  return [
    {
      campo: "fechaEmisionRetencion",
      valor: retention.fechaEmision?.toISOString().slice(0, 10) || null,
      origen: document.hojaOrigen,
      descripcion: "Fecha de emision del comprobante de retencion.",
    },
    {
      campo: "comprobanteRetencion",
      valor: [retention.establecimiento, retention.puntoEmision, retention.secuencial].filter(Boolean).join("-") || null,
      origen: document.hojaOrigen,
      descripcion: "Comprobante de retencion asociado al documento.",
    },
    {
      campo: "autorizacionRetencion",
      valor: retention.autorizacion || null,
      origen: document.hojaOrigen,
      descripcion: "Autorizacion del comprobante de retencion.",
    },
  ].filter((item) => item.valor !== null && item.valor !== "");
}

function purchaseEvents(document: NormalizedAccountingSourceDocument, emitPendingPaymentEvents: boolean) {
  const isCreditNote = hasCode(document.tipoComprobante, TipoComprobanteSRI.NOTA_CREDITO);
  const isDebitNote = hasCode(document.tipoComprobante, TipoComprobanteSRI.NOTA_DEBITO);
  const fuente = positiveRetentions(document.datosRetencion?.retencionesFuente || []);
  const iva = positiveRetentions(document.datosRetencion?.retencionesIva || []);
  const totalFuente = sumRetencionesFuente(fuente);
  const totalIva = sumRetencionesIva(iva);
  const devengoType: AccountingEventType = isCreditNote
    ? "NOTA_CREDITO_COMPRA"
    : isDebitNote
      ? "NOTA_DEBITO_COMPRA"
      : "DEVENGO_COMPRA";
  const devengo = baseEvent(document, {
    suffix: "DEVENGO",
    tipo: devengoType,
    rolesRequeridos: devengoCompraRoles(document),
    evidencias: [
      {
        campo: "fechaEmision",
        valor: document.fechaEmision.toISOString().slice(0, 10),
        origen: document.hojaOrigen,
        descripcion: "Fecha del comprobante usada para reconocer el devengo.",
      },
      {
        campo: "documentoOrigen",
        valor: document.documentoOrigen,
        origen: document.hojaOrigen,
        descripcion: "Documento tributario que origina el evento.",
      },
      {
        campo: "tipoComprobante",
        valor: document.tipoComprobante,
        origen: document.hojaOrigen,
        descripcion: "Tipo de comprobante declarado en el ATS.",
      },
    ],
    motivos: [`${devengoType} generado desde documento ATS persistido/normalizado.`],
    retencionFuente: totalFuente,
    retencionIva: totalIva,
  });

  const events = [devengo];

  if (emitPendingPaymentEvents && !isCreditNote && !isDebitNote) {
    const canGeneratePayment = devengo.estado === "GENERABLE" && hasPaymentMethod(document) && Boolean(document.fechaRegistro);
    events.push(
      baseEvent(document, {
        suffix: "PAGO",
        tipo: "PAGO_PROVEEDOR",
        estado: canGeneratePayment ? "GENERABLE" : "PENDIENTE_EVIDENCIA",
        rolesRequeridos: [
          "CUENTAS_POR_PAGAR_PROVEEDORES",
          ...(totalFuente > 0 ? (["RETENCION_FUENTE_POR_PAGAR"] as RequiredAccountRole[]) : []),
          ...(totalIva > 0 ? (["RETENCION_IVA_POR_PAGAR"] as RequiredAccountRole[]) : []),
          "CUENTA_FINANCIERA",
        ],
        evidencias: paymentEvidence(document),
        motivos: [
          canGeneratePayment
            ? "PAGO_PROVEEDOR generado desde Fecha de Registro y Forma de Pago declaradas en COMPRAS."
            : "No se genera asiento de pago automatico porque falta Fecha de Registro o Forma de Pago en COMPRAS.",
        ],
        eventoRelacionadoId: devengo.idTemporal,
        fecha: document.fechaRegistro || document.fechaEmision,
        retencionFuente: totalFuente,
        retencionIva: totalIva,
      })
    );
  }

  return events;
}

function saleEvents(document: NormalizedAccountingSourceDocument, emitPendingPaymentEvents: boolean) {
  const isCreditNote = hasCode(document.tipoComprobante, TipoComprobanteSRI.NOTA_CREDITO);
  const isDebitNote = hasCode(document.tipoComprobante, TipoComprobanteSRI.NOTA_DEBITO);
  const devengoType: AccountingEventType = isCreditNote
    ? "NOTA_CREDITO_VENTA"
    : isDebitNote
      ? "NOTA_DEBITO_VENTA"
      : "DEVENGO_VENTA";
  const devengo = baseEvent(document, {
    suffix: "DEVENGO",
    tipo: devengoType,
    rolesRequeridos: devengoVentaRoles(document),
    evidencias: [
      {
        campo: "fechaEmision",
        valor: document.fechaEmision.toISOString().slice(0, 10),
        origen: document.hojaOrigen,
        descripcion: "Fecha del comprobante usada para reconocer el devengo.",
      },
      {
        campo: "documentoOrigen",
        valor: document.documentoOrigen,
        origen: document.hojaOrigen,
        descripcion: "Documento tributario que origina el evento.",
      },
      {
        campo: "tipoComprobante",
        valor: document.tipoComprobante,
        origen: document.hojaOrigen,
        descripcion: "Tipo de comprobante declarado en el ATS.",
      },
    ],
    motivos: [`${devengoType} generado desde documento ATS persistido/normalizado.`],
  });

  const events = [devengo];
  const fuente = positiveRetentions(document.datosRetencion?.retencionesFuente || []);
  const iva = positiveRetentions(document.datosRetencion?.retencionesIva || []);
  const totalFuente = sumRetencionesFuente(fuente);
  const totalIva = sumRetencionesIva(iva);

  if (emitPendingPaymentEvents && !isCreditNote && !isDebitNote) {
    const canGenerateCollection = devengo.estado === "GENERABLE" && hasCollectionMethod(document);
    events.push(
      baseEvent(document, {
        suffix: "COBRO",
        tipo: "COBRO_CLIENTE",
        estado: canGenerateCollection ? "GENERABLE" : "PENDIENTE_EVIDENCIA",
        rolesRequeridos: [
          "CUENTA_FINANCIERA",
          ...(totalFuente > 0 ? (["RETENCION_FUENTE_POR_COBRAR"] as RequiredAccountRole[]) : []),
          ...(totalIva > 0 ? (["RETENCION_IVA_POR_COBRAR"] as RequiredAccountRole[]) : []),
          "CUENTAS_POR_COBRAR_CLIENTES",
        ],
        evidencias: [...collectionEvidence(document), ...retentionEvidence(document)],
        motivos: [
          canGenerateCollection
            ? "COBRO_CLIENTE generado desde Fecha de Emision y Forma de Cobro declaradas en VENTAS."
            : "No se genera asiento de cobro automatico porque falta Forma de Cobro en VENTAS.",
        ],
        eventoRelacionadoId: devengo.idTemporal,
        fecha: document.fechaEmision,
        fechaRetencion: document.datosRetencion?.fechaEmision || null,
        retencionFuente: totalFuente,
        retencionIva: totalIva,
      })
    );
  }

  return events;
}

export type AccountingEventGeneratorOptions = {
  emitPendingPaymentEvents?: boolean;
};

export class AccountingEventGenerator {
  constructor(private readonly options: AccountingEventGeneratorOptions = {}) {}

  generate(documents: NormalizedAccountingSourceDocument[]): AccountingEventGenerationResult {
    const events: AccountingEvent[] = [];
    const errors: AccountingEventIssue[] = [];
    const warnings: AccountingEventIssue[] = [];
    const emitPendingPaymentEvents = this.options.emitPendingPaymentEvents !== false;
    let hasPaymentEvidence = false;

    for (const document of documents) {
      const retentionErrors = validateRetentionsDoNotExceedTotal(document);
      errors.push(...retentionErrors);

      if (retentionErrors.length > 0) {
        continue;
      }

      const documentEvents =
        document.tipoOperacion === "VENTA"
          ? saleEvents(document, emitPendingPaymentEvents)
          : purchaseEvents(document, emitPendingPaymentEvents);

      events.push(...documentEvents);

      if (
        document.paymentEvidence?.formaPago1 ||
        document.paymentEvidence?.formaPago2 ||
        document.collectionEvidence?.formaCobro1 ||
        document.collectionEvidence?.formaCobro2
      ) {
        hasPaymentEvidence = true;
      }
    }

    if (hasPaymentEvidence) {
      warnings.push({
        tipo: "INFO",
        codigo: "FORMA_PAGO_NO_PRUEBA_PAGO",
        hojaOrigen: "ATS",
        filaOrigen: 0,
        documentoOrigen: "RESUMEN",
        mensaje:
          "La forma de pago/cobro se conserva como dato tributario, pero no confirma por si sola la cancelacion efectiva.",
      });
    }

    return {
      documentosProcesados: documents.length,
      eventos: events,
      eventosGenerables: events.filter((event) => event.estado === "GENERABLE").length,
      eventosPendientesEvidencia: events.filter((event) => event.estado === "PENDIENTE_EVIDENCIA").length,
      eventosPendientesClasificacion: events.filter((event) => event.estado === "PENDIENTE_CLASIFICACION").length,
      warnings,
      errors,
    };
  }
}

function firstMoney(source: Record<string, unknown>, keys: string[]): number {
  for (const key of keys) {
    const value = money(source[key]);
    if (value !== 0) return value;
  }
  return 0;
}

function firstText(source: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const value = text(source[key]);
    if (value) return value;
  }
  return null;
}

function sourceRetencionesFuente(source: Record<string, unknown>): AccountingRetentionSource[] {
  return [1, 2, 3].map((index) => {
    return {
      codigo: firstText(source, [`codigoRetencion${index}`, `retFuenteCodigoRetencion${index}`]),
      base: firstMoney(source, [`baseImponibleRet${index}`, `retFuenteBaseImponible${index}`]),
      porcentaje: firstMoney(source, [`porcentajeRetencion${index}`, `retFuentePorcentaje${index}`]),
      valor: firstMoney(source, [`valorRetenido${index}`, `retFuenteValorRetenido${index}`]),
    };
  });
}

function sourceRetencionesIvaCompra(source: Record<string, unknown>): AccountingRetentionIva[] {
  return [
    { porcentaje: 10, valor: money(source.valorRetencionIva10 ?? source.retIvaValor10) },
    { porcentaje: 20, valor: money(source.valorRetencionIva20 ?? source.retIvaValor20) },
    { porcentaje: 30, valor: money(source.valorRetencionIva30 ?? source.retIvaValor30) },
    { porcentaje: 50, valor: money(source.valorRetencionIva50 ?? source.retIvaValor50) },
    { porcentaje: 70, valor: money(source.valorRetencionIva70 ?? source.retIvaValor70) },
    { porcentaje: 100, valor: money(source.valorRetencionIva100 ?? source.retIvaValor100) },
  ];
}

function sourceRetencionesIvaVenta(source: Record<string, unknown>): AccountingRetentionIva[] {
  return [
    { porcentaje: 10, valor: money(source.retIvaValor10) },
    { porcentaje: 20, valor: money(source.retIvaValor20) },
    { porcentaje: 30, valor: money(source.retIvaValor30) },
    { porcentaje: 50, valor: money(source.retIvaValor50) },
    { porcentaje: 70, valor: money(source.retIvaValor70) },
    { porcentaje: 100, valor: money(source.retIvaValor100) },
  ];
}

function buildRetentionData(
  source: Record<string, unknown>,
  params: {
    fecha?: unknown;
    establecimiento?: unknown;
    puntoEmision?: unknown;
    secuencial?: unknown;
    autorizacion?: unknown;
    retencionesFuente: AccountingRetentionSource[];
    retencionesIva: AccountingRetentionIva[];
  }
): AccountingRetentionData | undefined {
  const retencionesFuente = positiveRetentions(params.retencionesFuente);
  const retencionesIva = positiveRetentions(params.retencionesIva);
  const totalRetenidoFuente = sumRetencionesFuente(retencionesFuente);
  const totalRetenidoIva = sumRetencionesIva(retencionesIva);
  const hasHeader = Boolean(
    text(params.establecimiento) ||
      text(params.puntoEmision) ||
      text(params.secuencial) ||
      text(params.autorizacion) ||
      text(params.fecha)
  );

  if (!hasHeader && totalRetenidoFuente === 0 && totalRetenidoIva === 0) return undefined;

  return {
    tipoEmision: text(source.tipoEmisionRetencion) || null,
    establecimiento: text(params.establecimiento) || null,
    puntoEmision: text(params.puntoEmision) || null,
    secuencial: text(params.secuencial) || null,
    autorizacion: text(params.autorizacion) || null,
    fechaEmision: text(params.fecha) ? dateValue(params.fecha, new Date()) : null,
    retencionesFuente,
    retencionesIva,
    totalRetenidoFuente,
    totalRetenidoIva,
  };
}

export function adaptCompraToAccountingSource(
  compra: CompraLike,
  clasificacion: AccountingClassificationResult = ZERO_CLASSIFICATION
): NormalizedAccountingSourceDocument {
  const establecimiento = text(compra.establecimiento);
  const puntoEmision = text(compra.puntoEmision);
  const numeroSecuencial = text(compra.numeroSecuencial);

  return {
    hojaOrigen: "COMPRAS",
    filaOrigen: Number(compra.filaExcel || 0),
    documentoOrigen: [establecimiento, puntoEmision, numeroSecuencial].filter(Boolean).join("-"),
    fechaEmision: dateValue(compra.fechaEmision),
    fechaRegistro: text(compra.fechaRegistro) ? dateValue(compra.fechaRegistro) : null,
    identificacionTercero: text(compra.noIdentificacion),
    razonSocialTercero: text(compra.razonSocialProveedor),
    tipoOperacion: "COMPRA",
    tipoComprobante: text(compra.comprobante) || null,
    codigoSustento: text(compra.codigoSustento) || null,
    baseNoObjeto: money(compra.baseNoObjetoIva),
    baseExenta: money(compra.baseExenta),
    baseTarifa0: money(compra.baseTarifa0),
    baseGravada: sum([
      money(compra.baseGravableIva1),
      money(compra.baseGravableIva2),
      money(compra.baseGravableIva3),
    ]),
    iva: sum([money(compra.montoIva1), money(compra.montoIva2), money(compra.montoIva3)]),
    total: money(compra.totalDocumento),
    paymentEvidence: {
      tipoPago: text(compra.tipoPago) || null,
      formaPago1: text(compra.formaPago1) || null,
      formaPago2: text(compra.formaPago2) || null,
    },
    datosRetencion: buildRetentionData(compra, {
      fecha: compra.fechaEmisionRet1,
      establecimiento: compra.establecimientoRet,
      puntoEmision: compra.puntoEmisionRet,
      secuencial: compra.numeroSecuencialRet,
      autorizacion: compra.numeroAutorizacionSriRet,
      retencionesFuente: sourceRetencionesFuente(compra),
      retencionesIva: sourceRetencionesIvaCompra(compra),
    }),
    clasificacion,
    actividadEconomica: text(compra.tipoActividad) || null,
    concepto: text(compra.conceptoContableCompra || compra.conceptoCompra) || null,
    documentoModificado: [
      compra.establecimientoModificado,
      compra.puntoEmisionModificado,
      compra.numeroSecuencialModificado,
    ].filter(Boolean).join("-") || null,
    autorizacionModificada: text(compra.numeroAutorizacionSriModificado) || null,
  };
}

export function adaptVentaToAccountingSource(
  venta: VentaLike,
  clasificacion: AccountingClassificationResult = ZERO_CLASSIFICATION
): NormalizedAccountingSourceDocument {
  const establecimiento = text(venta.codigoEstablecimiento);
  const noDocumento = text(venta.noDocumento);
  const totalFuente = money(venta.valorRetenidoFuente);
  const totalIva = money(venta.valorRetenidoIva);
  const retencionesFuente = sourceRetencionesFuente(venta);
  const retencionesIva = sourceRetencionesIvaVenta(venta);

  return {
    hojaOrigen: "VENTAS",
    filaOrigen: Number(venta.filaExcel || 0),
    documentoOrigen: [establecimiento, noDocumento].filter(Boolean).join("-"),
    fechaEmision: dateValue(venta.fechaEmision),
    identificacionTercero: text(venta.noIdentificacion),
    razonSocialTercero: text(venta.razonSocialCliente),
    tipoOperacion: "VENTA",
    tipoComprobante: text(venta.tipoComprobante) || null,
    baseNoObjeto: money(venta.baseNoObjetoIva),
    baseExenta: money(venta.baseExenta),
    baseTarifa0: money(venta.baseTarifa0),
    baseGravada: sum([
      money(venta.baseGravableIva1),
      money(venta.baseGravableIva2),
      money(venta.baseGravableIva3),
    ]),
    iva: sum([money(venta.montoIva1), money(venta.montoIva2), money(venta.montoIva3)]),
    total: money(venta.totalDocumento),
    collectionEvidence: {
      formaCobro1: text(venta.formaCobro1 ?? venta.formaPago1) || null,
      formaCobro2: text(venta.formaCobro2 ?? venta.formaPago2) || null,
    },
    datosRetencion: buildRetentionData(venta, {
      fecha: venta.fechaRetencion,
      establecimiento: undefined,
      puntoEmision: undefined,
      secuencial: venta.noDocumentoRetencion,
      autorizacion: venta.noAutorizacionRetencion,
      retencionesFuente:
        sumRetencionesFuente(retencionesFuente) > 0
          ? retencionesFuente
          : [{ codigo: null, base: 0, porcentaje: null, valor: totalFuente }],
      retencionesIva:
        sumRetencionesIva(retencionesIva) > 0
          ? retencionesIva
          : [{ porcentaje: 0, valor: totalIva }],
    }),
    clasificacion,
    actividadEconomica: text(venta.tipoActividad) || null,
    concepto: text(venta.conceptoContableVenta || venta.conceptoVenta) || null,
  };
}

export function generateAccountingEvents(
  documents: NormalizedAccountingSourceDocument[],
  options?: AccountingEventGeneratorOptions
): AccountingEventGenerationResult {
  return new AccountingEventGenerator(options).generate(documents);
}

import type { AccountingEvent, AccountingEventType } from "./04-asientos/generador-eventos.service";

export type AccountingDescriptionInput = {
  evento: AccountingEventType | string;
  tipoDocumento?: string | null;
  numeroDocumento?: string | null;
  establecimiento?: string | null;
  puntoEmision?: string | null;
  secuencial?: string | null;
  razonSocial?: string | null;
  nombreComercial?: string | null;
  nombre?: string | null;
  identificacion?: string | null;
  descripcionAnterior?: string | null;
};

const OPERATION_BY_EVENT: Record<string, string> = {
  DEVENGO_COMPRA: "Compra",
  PAGO_PROVEEDOR: "Pago",
  DEVENGO_VENTA: "Venta",
  COBRO_CLIENTE: "Cobro",
  NOTA_CREDITO_COMPRA: "Nota de crédito compra",
  NOTA_CREDITO_VENTA: "Nota de crédito venta",
  NOTA_DEBITO_COMPRA: "Nota de débito compra",
  NOTA_DEBITO_VENTA: "Nota de débito venta",
  RETENCION_EMITIDA: "Retención",
  RETENCION_RECIBIDA: "Retención",
};

const DOCUMENT_TYPE_BY_CODE: Record<string, string> = {
  "01": "factura",
  "03": "liquidación",
  "04": "nota de crédito",
  "05": "nota de débito",
  "07": "comp. retención",
  "18": "factura",
};

function text(value: unknown): string {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function normalizeCode(value: string): string {
  return value.trim().padStart(2, "0");
}

function normalizeDocumentType(value: unknown): string {
  const raw = text(value);
  if (!raw) return "";

  const code = normalizeCode(raw);
  if (DOCUMENT_TYPE_BY_CODE[code]) return DOCUMENT_TYPE_BY_CODE[code];

  const lower = raw.toLowerCase();
  if (lower.includes("factura")) return "factura";
  if (lower.includes("liquidacion") || lower.includes("liquidación")) return "liquidación";
  if (lower.includes("nota") && lower.includes("credito")) return "nota de crédito";
  if (lower.includes("nota") && lower.includes("crédito")) return "nota de crédito";
  if (lower.includes("nota") && lower.includes("debito")) return "nota de débito";
  if (lower.includes("nota") && lower.includes("débito")) return "nota de débito";
  if (lower.includes("retencion") || lower.includes("retención")) return "comp. retención";

  return lower;
}

function normalizeEventName(event: string): string {
  return text(event)
    .toLowerCase()
    .split("_")
    .filter(Boolean)
    .join(" ");
}

function documentNumber(input: AccountingDescriptionInput): string {
  const full = text(input.numeroDocumento);
  if (full) return full;

  const establishment = text(input.establecimiento);
  const emissionPoint = text(input.puntoEmision);
  const sequential = text(input.secuencial);
  if (establishment && emissionPoint && sequential) return [establishment, emissionPoint, sequential].join("-");

  const series = [establishment, emissionPoint].filter(Boolean).join("-");
  if (series && sequential) return [series, sequential].join("-");
  if (sequential) return sequential;

  return "";
}

function thirdParty(input: AccountingDescriptionInput): string {
  return (
    text(input.razonSocial) ||
    text(input.nombreComercial) ||
    text(input.nombre) ||
    text(input.identificacion)
  );
}

function cleanDescription(value: string): string {
  return value
    .replace(/\s*-{2,}\s*/g, " - ")
    .replace(/\s+-\s*$/g, "")
    .replace(/^\s*-\s+/g, "")
    .replace(/\s+-\s+-\s+/g, " - ")
    .replace(/\s+/g, " ")
    .trim();
}

export function generarGlosaOperacion(input: AccountingDescriptionInput): string {
  const event = text(input.evento);
  const operation = OPERATION_BY_EVENT[event] || text(input.descripcionAnterior) || normalizeEventName(event);
  const type = normalizeDocumentType(input.tipoDocumento);
  const number = documentNumber(input);
  const party = thirdParty(input);
  const base = [operation, type, number].filter(Boolean).join(" ");

  return cleanDescription([base, party].filter(Boolean).join(" - "));
}

function evidenceValue(event: AccountingEvent, field: string) {
  return String(event.evidencias.find((item) => item.campo === field)?.valor || "").trim();
}

export function generarGlosaOperacionDesdeEvento(event: AccountingEvent): string {
  const retentionDocument = evidenceValue(event, "comprobanteRetencion");
  const type = event.tipo === "RETENCION_EMITIDA" || event.tipo === "RETENCION_RECIBIDA"
    ? "07"
    : evidenceValue(event, "tipoComprobante");

  return generarGlosaOperacion({
    evento: event.tipo,
    tipoDocumento: type,
    numeroDocumento: retentionDocument || event.documentoOrigen,
    razonSocial: event.tercero.razonSocial,
    identificacion: event.tercero.identificacion,
  });
}

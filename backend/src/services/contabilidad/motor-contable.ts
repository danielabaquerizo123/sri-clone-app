import * as XLSX from "xlsx";
import { prisma as defaultPrisma } from "../../lib/prisma";
import { TipoComprobanteSRI } from "../../constants/tipos-comprobante-sri";
import { adaptCompra } from "./01-lectura/compra.adapter";
import { adaptGasto } from "./01-lectura/gasto.adapter";
import { adaptVenta } from "./01-lectura/venta.adapter";
import type { AccountingDocument } from "./contratos";
import {
  classifyAccountingDocument,
  loadClassificationConfigFromPrisma,
  type AccountingClassificationConfig,
  type AccountingClassificationResult,
  type AccountingRuleHint,
} from "./02-clasificacion/clasificador.service";
import {
  generateAccountingEvents,
  type AccountingEvent,
  type AccountingEventAmounts,
  type NormalizedAccountingSourceDocument,
} from "./04-asientos/generador-eventos.service";
import { AccountingEventJournalBuilder, type CreditNoteRelationPreview, type PreviewEntry } from "./04-asientos/constructor-asiento.service";
import {
  AccountingRoleResolver,
  loadAccountConfigurationsFromPrisma,
  type AccountConfigurationRecord,
  type AccountingRuleAccountHint,
  type ResolvedAccount,
} from "./03-cuentas/resolver-cuentas.service";
import { AccountingJournalValidatorService } from "./04-asientos/validador-cuadre.service";
import type { ValidationIssue } from "./contratos";

type ExcelIssue = {
  tipo: "INFO" | "WARNING" | "ERROR";
  codigo?: string;
  hoja?: string;
  fila?: number;
  campo?: string;
  mensaje: string;
};

export type ExcelLibroDiarioResult = {
  message: string;
  resumen: {
    archivo: string;
    hojasLeidas: string[];
    hojasIgnoradas: string[];
    compras: number;
    ventas: number;
    gastos: number;
    asientos: number;
    totalDebe: number;
    totalHaber: number;
    errores: number;
    advertencias: number;
    documentosLeidos: number;
    documentosPendientes: number;
    tiposPagoCompras: Record<string, number>;
    formasPagoCompras: Record<string, number>;
    formasCobroVentas: Record<string, number>;
    hojas: number;
    filas: number;
    asientosGenerados: number;
    comprasLeidas: number;
    comprasValidas: number;
    comprasContabilizadas: number;
    comprasPendientesClasificacion: number;
    comprasPendientesCuenta: number;
    comprasConError: number;
    comprasExcluidas: number;
    asientosCompraGenerados: number;
    totalDebeCompras: number;
    totalHaberCompras: number;
    totalDebeVentas: number;
    totalHaberVentas: number;
    totalDebeGeneral: number;
    totalHaberGeneral: number;
    diferencia: number;
    ruc?: string;
    razonSocial?: string;
    periodo?: string;
    moneda?: string;
  };
  periodo?: {
    id: string | null;
    anio: number | null;
    mes: string | null;
    estado: string | null;
  };
  hojas: Array<{
    nombre: string;
    filas: number;
    encabezados: string[];
  }>;
  libroDiario: PreviewEntry[];
  asientos: PreviewEntry[];
  issues: ExcelIssue[];
  warnings: ExcelIssue[];
  errors: ExcelIssue[];
  auditoriaCompras: Array<Record<string, unknown>>;
};

type ExcelAccountingRule = AccountingRuleAccountHint &
  AccountingRuleHint & {
    prioridad?: number | null;
  };

type ExcelLibroDiarioOptions = {
  accounts?: ResolvedAccount[];
  rules?: ExcelAccountingRule[];
  classification?: AccountingClassificationConfig;
  accountConfigurations?: AccountConfigurationRecord[];
};

type SheetRow = unknown[];

const READABLE_SHEETS = new Set(["COMPRAS", "VENTAS", "GASTOS", "GASTOSP"]);

function normalizeSheetName(name: string) {
  return name.trim().toUpperCase();
}

function text(value: unknown) {
  return String(value ?? "").trim();
}

function cleanText(value: unknown) {
  const raw = text(value);
  if (!raw || raw === "-" || raw === "–" || raw === "—") return "";
  return raw;
}

function code(value: unknown) {
  const raw = cleanText(value);
  const match = raw.match(/\d+/);
  return match ? match[0].padStart(2, "0").slice(0, 2) : "";
}

function paymentCode(value: unknown) {
  return code(value) || "SIN_CODIGO";
}

function incrementCounter(counter: Record<string, number>, value: unknown) {
  const raw = cleanText(value);
  if (!raw) return;
  const key = paymentCode(raw);
  counter[key] = (counter[key] || 0) + 1;
}

function money(value: unknown) {
  const raw = cleanText(value);
  if (!raw) return 0;
  const accountingNegative = /^\(.+\)$/.test(raw);
  const compact = raw.replace(/\s/g, "").replace(/%/g, "").replace(/^\((.+)\)$/, "$1");
  const normalized =
    compact.includes(",") && !compact.includes(".")
      ? compact.replace(",", ".")
      : compact.replace(/,/g, "");
  const numberValue = Number(normalized);
  const signedValue = accountingNegative ? -numberValue : numberValue;
  return Number.isFinite(signedValue) ? Math.round((signedValue + Number.EPSILON) * 100) / 100 : 0;
}

function dateText(value: unknown) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }

  const raw = cleanText(value);
  const match = raw.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (!match) return raw;

  const [, day, month, year] = match;
  return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
}

function rowHasDocument(row: SheetRow, indexes: number[]) {
  return indexes.some((index) => Boolean(cleanText(row[index])));
}

function rowsForSheet(sheet: XLSX.WorkSheet | undefined): SheetRow[] {
  if (!sheet) return [];
  return XLSX.utils.sheet_to_json<SheetRow>(sheet, { header: 1, defval: null, raw: false });
}

function sheetInfo(name: string, rows: SheetRow[]) {
  const header = rows.find((row) => row.some((cell) => cleanText(cell)));
  return {
    nombre: name,
    filas: rows.filter((row) => row.some((cell) => cleanText(cell))).length,
    encabezados: (header || []).map((cell) => cleanText(cell)).filter(Boolean),
  };
}

function onlyDigits(value: unknown) {
  return cleanText(value).replace(/\D/g, "");
}

function firstNonEmpty(rows: SheetRow[], rowIndex: number, startIndex: number) {
  const row = rows[rowIndex] || [];
  for (let index = startIndex; index < row.length; index += 1) {
    const value = cleanText(row[index]);
    if (value) return value;
  }
  return "";
}

function yearFromFormularioHeader(row: SheetRow) {
  const markerIndex = row.findIndex((cell) => cleanText(cell) === "102");
  if (markerIndex < 0) return "";
  const digits = row
    .slice(markerIndex + 2, markerIndex + 8)
    .map((cell) => onlyDigits(cell))
    .join("");
  const match = digits.match(/\d{4}/);
  return match ? match[0] : "";
}

function metadataFromParametros(rows: SheetRow[]) {
  const metadata = { ruc: "", razonSocial: "" };
  rows.forEach((row) => {
    const key = cleanText(row[1]).toLowerCase();
    if (key === "dt_rucemp") metadata.ruc = onlyDigits(row[3]);
    if (key === "dt_razsoc") metadata.razonSocial = cleanText(row[3]);
  });
  return metadata;
}

function monthYearFromFormulario(rows: SheetRow[]) {
  let month: number | null = null;
  let yearText = "";

  for (const row of rows) {
    const first = cleanText(row[0]);
    if (first === "101" || first === "102") {
      yearText = yearText || yearFromFormularioHeader(row);
      const selected = row
        .slice(2, 14)
        .map((value, index) => ({ value: cleanText(value).toLowerCase(), month: index + 1 }))
        .find((item) => item.value === "true");
      if (selected) month = selected.month;
    }
  }

  const year = Number(yearText);
  return {
    month: month && month >= 1 && month <= 12 ? month : null,
    year: Number.isFinite(year) && year > 1900 ? year : null,
  };
}

function monthYearFromDates(documents: NormalizedAccountingSourceDocument[]) {
  const first = documents
    .map((document) => document.fechaEmision)
    .find((date) => date instanceof Date && !Number.isNaN(date.getTime()));
  if (!first) return { month: null, year: null };
  return { month: first.getUTCMonth() + 1, year: first.getUTCFullYear() };
}

function accountingMetadata(
  sheetRows: Map<string, SheetRow[]>,
  documents: NormalizedAccountingSourceDocument[]
) {
  const parametros = metadataFromParametros(sheetRows.get("Parametros") || sheetRows.get("PARAMETROS") || []);
  const form104 = monthYearFromFormulario(sheetRows.get("104") || []);
  const form103 = monthYearFromFormulario(sheetRows.get("103") || []);
  const fromDates = monthYearFromDates(documents);
  const month = form104.month || form103.month || fromDates.month;
  const year = form104.year || form103.year || fromDates.year;
  const periodo = month && year ? `${year}-${String(month).padStart(2, "0")}` : "";

  return {
    ruc: parametros.ruc,
    razonSocial: parametros.razonSocial,
    periodo,
    periodoObjeto: {
      id: null,
      anio: year,
      mes: month ? String(month).padStart(2, "0") : null,
      estado: "NO_CONTABILIZADO",
    },
    moneda: "Dólares (USD)",
  };
}

function compraFromRow(row: SheetRow, filaExcel: number) {
  return {
    filaExcel,
    noIdentificacion: cleanText(row[0]),
    razonSocialProveedor: cleanText(row[2]),
    comprobante: code(row[6]),
    establecimiento: cleanText(row[7]),
    puntoEmision: cleanText(row[8]),
    numeroSecuencial: cleanText(row[9]),
    fechaEmision: dateText(row[11]),
    fechaRegistro: dateText(row[12]),
    comprobanteModificado: code(row[13]),
    establecimientoModificado: cleanText(row[14]),
    puntoEmisionModificado: cleanText(row[15]),
    numeroSecuencialModificado: cleanText(row[16]),
    numeroAutorizacionSriModificado: cleanText(row[17]),
    conceptoCompra: cleanText(row[18]),
    codigoSustento: code(row[19]),
    baseNoObjetoIva: money(row[20]),
    baseExenta: money(row[21]),
    baseTarifa0: money(row[22]),
    baseGravableIva1: money(row[23]),
    montoIva1: money(row[25]),
    baseGravableIva2: money(row[26]),
    montoIva2: money(row[28]),
    baseGravableIva3: money(row[29]),
    montoIva3: money(row[31]),
    totalDocumento: money(row[36]),
    conceptoContableCompra: cleanText(row[40]),
    tipoActividad: cleanText(row[43]),
    establecimientoRet: cleanText(row[52]),
    puntoEmisionRet: cleanText(row[53]),
    numeroSecuencialRet: cleanText(row[54]),
    numeroAutorizacionSriRet: cleanText(row[55]),
    fechaEmisionRet1: dateText(row[56]),
    codigoRetencionFuente1: cleanText(row[57]),
    baseImponibleRetencionFuente1: money(row[58]),
    porcentajeRetencionFuente1: money(row[59]),
    valorRetenidoFuente1: money(row[60]),
    codigoRetencionFuente2: cleanText(row[66]),
    baseImponibleRetencionFuente2: money(row[67]),
    porcentajeRetencionFuente2: money(row[68]),
    valorRetenidoFuente2: money(row[69]),
    codigoRetencionFuente3: cleanText(row[75]),
    baseImponibleRetencionFuente3: money(row[76]),
    porcentajeRetencionFuente3: money(row[77]),
    valorRetenidoFuente3: money(row[78]),
    valorRetenidoIva10: money(row[80]),
    valorRetenidoIva20: money(row[81]),
    valorRetenidoIva30: money(row[82]),
    valorRetenidoIva50: money(row[83]),
    valorRetenidoIva70: money(row[84]),
    valorRetenidoIva100: money(row[85]),
    tipoPago: cleanText(row[93]),
    formaPago1: cleanText(row[94]),
    formaPago2: cleanText(row[95]),
    observaciones: cleanText(row[140]),
  };
}

function ventaFromRow(row: SheetRow, filaExcel: number) {
  return {
    filaExcel,
    noIdentificacion: cleanText(row[0]),
    razonSocialCliente: cleanText(row[2]),
    tipoComprobante: code(row[7]),
    fechaEmision: dateText(row[8]),
    codigoEstablecimiento: cleanText(row[9]),
    noDocumento: cleanText(row[10]) || `${filaExcel}`,
    conceptoVenta: cleanText(row[11]),
    baseNoObjetoIva: money(row[12]),
    baseExenta: money(row[13]),
    baseTarifa0: money(row[14]),
    baseGravableIva1: money(row[15]),
    montoIva1: money(row[17]),
    baseGravableIva2: money(row[18]),
    montoIva2: money(row[20]),
    baseGravableIva3: money(row[21]),
    montoIva3: money(row[23]),
    totalDocumento: money(row[27]),
    conceptoContableVenta: cleanText(row[31]),
    tipoActividad: cleanText(row[34]),
    valorRetenidoIva: money(row[43]),
    valorRetenidoFuente: money(row[44]),
    noDocumentoRetencion: cleanText(row[46]),
    fechaRetencion: dateText(row[47]),
    noAutorizacionRetencion: cleanText(row[48]),
    formaCobro1: cleanText(row[53]),
    formaCobro2: cleanText(row[54]),
  };
}

function gastoFromRow(row: SheetRow, filaExcel: number) {
  return {
    filaExcel,
    noIdentificacion: cleanText(row[0]),
    razonSocialProveedor: cleanText(row[1]),
    comprobante: code(row[4]),
    numeroSecuencial: cleanText(row[5]),
    numeroAutorizacionSri: cleanText(row[6]),
    fechaEmision: dateText(row[7]),
    baseTarifa0: money(row[8]),
    baseGravableIva1: money(row[9]),
    montoIva1: money(row[10]),
    totalDocumento: money(row[12]),
    conceptoGasto: "Gasto personal declarado",
  };
}

function classificationInput(document: AccountingDocument) {
  return {
    hojaOrigen: document.hojaOrigen,
    rucTercero: document.identificacionTercero,
    razonSocial: document.razonSocialTercero,
    actividadEconomica: document.actividadEconomica,
    concepto: document.concepto,
    codigoSustento: document.codigoSustento,
    tipoComprobante: document.tipoComprobante,
    formaPago: document.paymentEvidence?.formaPago1 || document.paymentEvidence?.formaPago2,
  };
}

function withClassification(document: AccountingDocument, clasificacion: AccountingClassificationResult): NormalizedAccountingSourceDocument {
  return {
    ...document,
    clasificacion,
  } as NormalizedAccountingSourceDocument;
}

function findRule(event: AccountingEvent, rules: ExcelAccountingRule[]) {
  const operation = event.hojaOrigen === "VENTAS" ? "VENTA" : event.hojaOrigen === "GASTOS" ? "GASTO" : "COMPRA";
  const eventCode = event.tipo.includes("NOTA_CREDITO")
    ? TipoComprobanteSRI.NOTA_CREDITO
    : event.tipo.includes("NOTA_DEBITO")
      ? TipoComprobanteSRI.NOTA_DEBITO
      : event.hojaOrigen === "VENTAS"
        ? TipoComprobanteSRI.COMPROBANTE_VENTA
        : TipoComprobanteSRI.FACTURA;
  const explicit = event.clasificacion.reglaSugeridaId;
  if (explicit) {
    const matched = rules.find((rule) => rule.codigo === explicit || rule.id === explicit);
    if (matched) return matched;
  }
  return rules
    .filter((rule) => rule.tipoOperacion === operation)
    .filter((rule) => !rule.tipoComprobante || rule.tipoComprobante === eventCode)
    .sort((left, right) => Number(left.prioridad || 100) - Number(right.prioridad || 100))[0] || null;
}

function deduplicateIssues(issues: ExcelIssue[]) {
  const seen = new Set<string>();
  return issues.filter((issue) => {
    const key = [issue.tipo, issue.hoja, issue.fila, issue.campo, issue.mensaje].join("|");
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function validationToIssue(issue: ValidationIssue): ExcelIssue {
  return {
    tipo: issue.tipo === "ERROR" ? "ERROR" : issue.tipo === "WARNING" ? "WARNING" : "INFO",
    codigo: issue.codigo,
    hoja: issue.hoja,
    fila: issue.fila,
    campo: issue.campo,
    mensaje: issue.mensaje,
  };
}

function buildIssue(
  tipo: ExcelIssue["tipo"],
  mensaje: string,
  params: Partial<ExcelIssue> = {}
): ExcelIssue {
  return { tipo, mensaje, ...params };
}

function missingConfigurationReason(motivos: string[]) {
  return motivos.find((motivo) => motivo.startsWith("No existe ConfiguracionCuentaContable activa para"));
}

function entryWithContext(entry: PreviewEntry, event: AccountingEvent, warnings: string[], errors: string[]) {
  return {
    ...entry,
    tercero: event.tercero,
    clasificacion: event.clasificacion,
    valido: errors.length === 0,
    errores: errors,
    advertencias: [...(entry.advertencias || []), ...warnings],
  };
}

function total(entries: PreviewEntry[], side: "debe" | "haber") {
  return Math.round(
    entries.reduce((sum, entry) => sum + entry.lineas.reduce((lineSum, line) => lineSum + Number(line[side] || 0), 0), 0) * 100
  ) / 100;
}

function assignedPurchaseAccount(entry: PreviewEntry | undefined) {
  const resolution = entry?.rolesResueltos?.find((item) => item.role === "GASTO_COSTO_ACTIVO");
  if (!resolution?.cuenta) return null;
  return {
    codigo: resolution.cuenta.codigo,
    nombre: resolution.cuenta.nombre,
    origen: resolution.origen,
  };
}

function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function absAmount(value: unknown) {
  return Math.abs(roundMoney(Number(value || 0)));
}

function isCode(value: string | null | undefined, expected: string) {
  return String(value ?? "").padStart(2, "0") === expected;
}

function normalizeDocumentPart(value: unknown, size: number) {
  const raw = text(value).replace(/\s/g, "");
  return raw ? raw.padStart(size, "0") : "";
}

function normalizeDocumentNumber(value: unknown) {
  const parts = text(value).split("-");
  if (parts.length !== 3) return text(value).replace(/\s/g, "");
  return [
    normalizeDocumentPart(parts[0], 3),
    normalizeDocumentPart(parts[1], 3),
    normalizeDocumentPart(parts[2], 9),
  ].join("-");
}

function documentNumberLookupKey(value: unknown) {
  return normalizeDocumentNumber(value).replace(/\D/g, "");
}

function purchaseKey(document: Pick<AccountingDocument, "identificacionTercero" | "documentoOrigen">) {
  return `${document.identificacionTercero || "SIN_ID"}|${documentNumberLookupKey(document.documentoOrigen) || "SIN_DOCUMENTO"}`;
}

function valuesFromDocument(document: AccountingDocument) {
  return {
    base: absAmount((document.baseNoObjeto || 0) + (document.baseExenta || 0) + (document.baseTarifa0 || 0) + (document.baseGravada || 0)),
    iva: absAmount(document.iva),
    totalDocumento: absAmount(document.total),
    retencionFuente: absAmount(document.datosRetencion?.totalRetenidoFuente),
    retencionIva: absAmount(document.datosRetencion?.totalRetenidoIva),
  };
}

function valuesFromEventAmounts(amounts: AccountingEventAmounts) {
  return {
    base: absAmount(amounts.base),
    iva: absAmount(amounts.iva),
    totalDocumento: absAmount(amounts.totalDocumento),
    retencionFuente: absAmount(amounts.retencionFuente),
    retencionIva: absAmount(amounts.retencionIva),
  };
}

function totalsMatch(left: number, right: number) {
  return Math.abs(roundMoney(left - right)) <= 0.01;
}

function documentDateIsBefore(left: AccountingDocument, right: AccountingDocument) {
  return left.fechaEmision.getTime() < right.fechaEmision.getTime();
}

function reverseLinesFromOriginal(original: PreviewEntry, ratio: number, description: string) {
  const lineas = original.lineas.map((line, index) => {
    const amount = roundMoney((Number(line.debe || 0) > 0 ? Number(line.debe || 0) : Number(line.haber || 0)) * ratio);
    return {
      ...line,
      descripcion: description,
      debe: Number(line.haber || 0) > 0 ? amount : 0,
      haber: Number(line.debe || 0) > 0 ? amount : 0,
      orden: index + 1,
    };
  });

  const totalDebe = roundMoney(lineas.reduce((sum, line) => sum + Number(line.debe || 0), 0));
  const totalHaber = roundMoney(lineas.reduce((sum, line) => sum + Number(line.haber || 0), 0));
  const difference = roundMoney(totalDebe - totalHaber);
  if (difference > 0) {
    const target = lineas.find((line) => Number(line.haber || 0) > 0);
    if (target) target.haber = roundMoney(Number(target.haber || 0) + difference);
  } else if (difference < 0) {
    const target = lineas.find((line) => Number(line.debe || 0) > 0);
    if (target) target.debe = roundMoney(Number(target.debe || 0) + Math.abs(difference));
  }

  return lineas;
}

function findCreditNoteOriginal(params: {
  event: AccountingEvent;
  document: NormalizedAccountingSourceDocument | undefined;
  purchaseDocumentsByKey: Map<string, NormalizedAccountingSourceDocument>;
  purchaseEntriesByKey: Map<string, PreviewEntry>;
  reversedTotalsByOriginalKey: Map<string, number>;
}) {
  const { event, document, purchaseDocumentsByKey, purchaseEntriesByKey, reversedTotalsByOriginalKey } = params;
  if (!document) {
    return {
      metodoRelacion: "SIN_COINCIDENCIA" as const,
      motivoRevision: "No se encontró el documento normalizado de la nota de crédito en el lote actual.",
    };
  }

  const modifiedNumber = normalizeDocumentNumber(document.documentoModificado);
  if (!modifiedNumber) {
    return {
      metodoRelacion: "SIN_COINCIDENCIA" as const,
      motivoRevision: `La nota de crédito ${event.documentoOrigen} no informa el número de factura modificada en el ATS.`,
    };
  }

  const originalKey = `${document.identificacionTercero || "SIN_ID"}|${documentNumberLookupKey(modifiedNumber) || "SIN_DOCUMENTO"}`;
  const exactOriginalDocument = purchaseDocumentsByKey.get(originalKey);
  const reversedValues = valuesFromEventAmounts(event.montos);
  let originalDocument = exactOriginalDocument;
  let relationMethod: CreditNoteRelationPreview["metodoRelacion"] = "NUMERO_EXACTO_LOTE_ACTUAL";
  let confidence: CreditNoteRelationPreview["confianzaRelacion"] = "ALTA";
  let resolvedOriginalKey = originalKey;
  let economicCandidates: NormalizedAccountingSourceDocument[] = [];

  if (!originalDocument) {
    economicCandidates = Array.from(purchaseDocumentsByKey.values()).filter((candidate) => {
      const values = valuesFromDocument(candidate);
      return (
        String(candidate.identificacionTercero || "") === String(document.identificacionTercero || "") &&
        isCode(candidate.tipoComprobante, TipoComprobanteSRI.FACTURA) &&
        documentDateIsBefore(candidate, document) &&
        totalsMatch(values.base, reversedValues.base) &&
        totalsMatch(values.iva, reversedValues.iva) &&
        totalsMatch(values.totalDocumento, reversedValues.totalDocumento)
      );
    });

    if (economicCandidates.length === 0) {
      return {
        documentoOriginalNumero: modifiedNumber,
        metodoRelacion: "SIN_COINCIDENCIA" as const,
        motivoRevision: `No se encontró la factura original ${modifiedNumber} del proveedor ${event.tercero.razonSocial} en la hoja COMPRAS del lote actual ni una coincidencia única por proveedor, valores y fecha.`,
      };
    }

    if (economicCandidates.length > 1) {
      return {
        documentoOriginalNumero: modifiedNumber,
        metodoRelacion: "MULTIPLES_COINCIDENCIAS" as const,
        posiblesCoincidencias: economicCandidates.map((candidate) => ({
          fila: candidate.filaOrigen,
          documento: candidate.documentoOrigen,
          fecha: candidate.fechaEmision.toISOString().slice(0, 10),
          valores: valuesFromDocument(candidate),
        })),
        motivoRevision: `La factura original declarada ${modifiedNumber} no fue localizada literalmente y existen ${economicCandidates.length} coincidencias por proveedor, valores y fecha.`,
      };
    }

    originalDocument = economicCandidates[0];
    resolvedOriginalKey = purchaseKey(originalDocument);
    relationMethod = "PROVEEDOR_VALORES_FECHA_UNICA";
    confidence = "MEDIA";
  }

  if (!originalDocument) {
    return {
      documentoOriginalNumero: modifiedNumber,
      metodoRelacion: "SIN_COINCIDENCIA" as const,
      motivoRevision: `No se encontró la factura original ${modifiedNumber} del proveedor ${event.tercero.razonSocial} en la hoja COMPRAS del lote actual.`,
    };
  }

  if (String(originalDocument.identificacionTercero || "") !== String(document.identificacionTercero || "")) {
    return {
      documentoOriginalNumero: modifiedNumber,
      metodoRelacion: "SIN_COINCIDENCIA" as const,
      motivoRevision: `La factura candidata ${modifiedNumber} no pertenece al mismo proveedor de la nota de crédito.`,
    };
  }

  if (isCode(originalDocument.tipoComprobante, TipoComprobanteSRI.NOTA_CREDITO)) {
    return {
      documentoOriginalNumero: modifiedNumber,
      metodoRelacion: "SIN_COINCIDENCIA" as const,
      motivoRevision: `La factura candidata ${modifiedNumber} también es nota de crédito y no puede usarse como documento original.`,
    };
  }

  const originalEntry = purchaseEntriesByKey.get(resolvedOriginalKey);
  if (!originalEntry) {
    return {
      documentoOriginalNumero: modifiedNumber,
      metodoRelacion: "SIN_COINCIDENCIA" as const,
      motivoRevision: `La factura original ${originalDocument.documentoOrigen} existe, pero todavía no tiene asiento de compra generable para reversar.`,
    };
  }

  const originalValues = valuesFromDocument(originalDocument);
  const alreadyReversed = reversedTotalsByOriginalKey.get(resolvedOriginalKey) || 0;
  const remaining = roundMoney(originalValues.totalDocumento - alreadyReversed);

  if (reversedValues.totalDocumento <= 0) {
    return {
      documentoOriginalNumero: modifiedNumber,
      metodoRelacion: "SIN_COINCIDENCIA" as const,
      motivoRevision: `La nota de crédito ${event.documentoOrigen} no tiene valor monetario suficiente para reversar la factura ${modifiedNumber}.`,
    };
  }

  if (reversedValues.totalDocumento - remaining > 0.01) {
    return {
      documentoOriginalNumero: modifiedNumber,
      metodoRelacion: "SIN_COINCIDENCIA" as const,
      motivoRevision: `La nota de crédito ${event.documentoOrigen} intenta reversar ${reversedValues.totalDocumento.toFixed(2)}, pero el saldo disponible de la factura ${originalDocument.documentoOrigen} es ${remaining.toFixed(2)}.`,
    };
  }

  const originalHasRetentions = originalEntry.lineas.some((line) => /retencion/i.test(line.descripcion));
  const noteHasRetentions = reversedValues.retencionFuente > 0 || reversedValues.retencionIva > 0;
  if (originalHasRetentions && !noteHasRetentions) {
    return {
      documentoOriginalNumero: modifiedNumber,
      metodoRelacion: "SIN_COINCIDENCIA" as const,
      motivoRevision: `La factura original ${originalDocument.documentoOrigen} tiene líneas de retención y la nota de crédito no declara retenciones propias; se requiere revisión para no duplicar retenciones.`,
    };
  }

  const ratio = roundMoney(reversedValues.totalDocumento / originalValues.totalDocumento);
  return {
    originalKey: resolvedOriginalKey,
    originalDocument,
    originalEntry,
    relation: {
      documentoOriginalId: originalEntry.idTemporal || originalEntry.accountingEventId || originalEntry.idTemporalEvento,
      notaCreditoDocumento: event.documentoOrigen,
      documentoModificadoDeclarado: modifiedNumber,
      documentoOriginalEncontrado: originalDocument.documentoOrigen,
      documentoOriginalNumero: originalDocument.documentoOrigen,
      filaOriginal: originalDocument.filaOrigen,
      metodoRelacion: relationMethod,
      confianzaRelacion: confidence,
      coincidenciaNumeroExacto: Boolean(exactOriginalDocument),
      coincidenciaProveedor: String(originalDocument.identificacionTercero || "") === String(document.identificacionTercero || ""),
      coincidenciaBase: totalsMatch(originalValues.base, reversedValues.base),
      coincidenciaIva: totalsMatch(originalValues.iva, reversedValues.iva),
      coincidenciaTotal: totalsMatch(originalValues.totalDocumento, reversedValues.totalDocumento),
      asientoOriginalId: originalEntry.idTemporal || originalEntry.accountingEventId || originalEntry.idTemporalEvento,
      reversoGenerado: true,
      valoresOriginales: originalValues,
      valoresRevertidos: reversedValues,
      esReversoParcial: ratio < 0.999,
    },
    ratio,
  };
}

function buildCreditNoteReverseEntry(params: {
  event: AccountingEvent;
  originalEntry: PreviewEntry;
  relation: CreditNoteRelationPreview;
  ratio: number;
  numero: number;
}) {
  const thirdParty = String(params.event.tercero.razonSocial || params.event.tercero.identificacion || "").trim();
  const description = [
    "Nota de credito segun documento",
    params.event.documentoOrigen,
    "relacionada con factura",
    params.relation.documentoOriginalNumero,
    thirdParty ? "de" : "",
    thirdParty,
  ].filter(Boolean).join(" ");
  const lineas = reverseLinesFromOriginal(params.originalEntry, params.ratio, description);
  const totalDebe = roundMoney(lineas.reduce((sum, line) => sum + Number(line.debe || 0), 0));
  const totalHaber = roundMoney(lineas.reduce((sum, line) => sum + Number(line.haber || 0), 0));

  const entry: PreviewEntry = {
    numero: params.numero,
    fecha: params.event.fecha.toISOString().slice(0, 10),
    fechaDate: params.event.fecha,
    glosa: description,
    descripcion: description,
    documentoOrigen: params.event.documentoOrigen,
    hojaOrigen: params.event.hojaOrigen,
    filaOrigen: params.event.filaOrigen,
    reglaCodigo: params.originalEntry.reglaCodigo,
    lineas,
    totalDebe,
    totalHaber,
    valido: true,
    errores: [],
    clasificacion: params.event.clasificacion,
    advertencias: [],
    tipoEvento: params.event.tipo,
    idTemporalEvento: params.event.idTemporal,
    eventoRelacionadoId: params.relation.documentoOriginalId,
    evidencias: [
      ...(params.event.evidencias || []),
      {
        campo: "documentoOriginalNumero",
        valor: params.relation.documentoOriginalNumero,
        origen: params.event.hojaOrigen,
        descripcion: "Factura original relacionada automaticamente para reverso de nota de credito.",
      },
    ],
    notaCreditoRelacion: params.relation,
  };

  return entry;
}

function countPendingDocuments(issues: ExcelIssue[]) {
  const pendingCodes = new Set(["PENDIENTE_CLASIFICACION", "ROL_SIN_RESOLVER", "RETENCIONES_SUPERAN_TOTAL"]);
  return new Set(
    issues
      .filter((issue) => issue.codigo && pendingCodes.has(issue.codigo))
      .map((issue) => [issue.hoja || "SIN_HOJA", issue.fila || "SIN_FILA", issue.campo || "SIN_DOCUMENTO"].join(":"))
  ).size;
}

export class ExcelLibroDiarioService {
  private readonly accounts: ResolvedAccount[];
  private readonly rules: ExcelAccountingRule[];
  private readonly classification: AccountingClassificationConfig;
  private readonly accountConfigurations: AccountConfigurationRecord[];

  constructor(options: ExcelLibroDiarioOptions = {}) {
    this.accounts = options.accounts || [];
    this.rules = options.rules || [];
    this.classification = options.classification || {};
    this.accountConfigurations = options.accountConfigurations || [];
  }

  async processAsync(buffer: Buffer, filename: string): Promise<ExcelLibroDiarioResult> {
    const [accounts, dbRules, classification, accountConfigurations] = await Promise.all([
      defaultPrisma.cuentaContable.findMany(),
      defaultPrisma.reglaContable.findMany({
        where: { activa: true },
        include: {
          cuentaBase: true,
          cuentaIva: true,
          cuentaContrapartida: true,
        },
      }),
      loadClassificationConfigFromPrisma(defaultPrisma),
      loadAccountConfigurationsFromPrisma(defaultPrisma),
    ]);
    const rules = dbRules.map((rule) => ({
      ...rule,
      tarifaIva: rule.tarifaIva == null ? null : rule.tarifaIva.toString(),
    }));

    return new ExcelLibroDiarioService({
      accounts,
      rules,
      classification,
      accountConfigurations,
    }).process(buffer, filename);
  }

  process(buffer: Buffer, filename: string): ExcelLibroDiarioResult {
    const workbook = XLSX.read(buffer, { type: "buffer", cellDates: true });
    const sheetRows = new Map(workbook.SheetNames.map((name) => [name, rowsForSheet(workbook.Sheets[name])]));
    const hojas = workbook.SheetNames.map((name) => sheetInfo(name, sheetRows.get(name) || []));
    const hojasLeidas = hojas
      .filter((hoja) => READABLE_SHEETS.has(normalizeSheetName(hoja.nombre)))
      .map((hoja) => hoja.nombre);
    const hojasIgnoradas = hojas
      .filter((hoja) => !READABLE_SHEETS.has(normalizeSheetName(hoja.nombre)))
      .map((hoja) => hoja.nombre);
    const issues: ExcelIssue[] = [];
    const documents: NormalizedAccountingSourceDocument[] = [];
    const auditoriaCompras: Array<Record<string, unknown>> = [];
    const tiposPagoCompras: Record<string, number> = {};
    const formasPagoCompras: Record<string, number> = {};
    const formasCobroVentas: Record<string, number> = {};

    const comprasRows = sheetRows.get("COMPRAS") || [];
    comprasRows.slice(6).forEach((row, index) => {
      if (!rowHasDocument(row, [0, 2, 6, 9, 36])) return;
      const rawDocument = compraFromRow(row, index + 7);
      if (!rawDocument.fechaEmision || rawDocument.totalDocumento === 0) return;
      incrementCounter(tiposPagoCompras, rawDocument.tipoPago);
      incrementCounter(formasPagoCompras, rawDocument.formaPago1);
      incrementCounter(formasPagoCompras, rawDocument.formaPago2);
      const document = adaptCompra(rawDocument);
      const clasificacion = classifyAccountingDocument(classificationInput(document), {
        ...this.classification,
        reglasContablesExistentes: this.rules,
      });
      auditoriaCompras.push({
        hojaOrigen: document.hojaOrigen,
        filaOrigen: document.filaOrigen,
        documentoOrigen: document.documentoOrigen,
        identificacionProveedor: document.identificacionTercero,
        razonSocialProveedor: document.razonSocialTercero,
        actividadEconomica: document.actividadEconomica,
        concepto: document.concepto,
        descripcion: rawDocument.conceptoCompra,
        conceptoContable: rawDocument.conceptoContableCompra,
        tipoActividad: rawDocument.tipoActividad,
        codigoSustento: document.codigoSustento,
        tipoComprobante: document.tipoComprobante,
        documentoModificado: document.documentoModificado,
        autorizacionModificada: document.autorizacionModificada,
        baseTarifa0: document.baseTarifa0,
        baseGravada: document.baseGravada,
        iva: document.iva,
        total: document.total,
        tipoPago: document.paymentEvidence?.tipoPago,
        formaPago1: document.paymentEvidence?.formaPago1,
        formaPago2: document.paymentEvidence?.formaPago2,
        retenciones: document.datosRetencion,
        clasificacion,
      });
      documents.push(withClassification(document, clasificacion));
    });

    const ventasRows = sheetRows.get("VENTAS") || [];
    ventasRows.slice(6).forEach((row, index) => {
      if (!rowHasDocument(row, [0, 2, 7, 27])) return;
      const rawDocument = ventaFromRow(row, index + 7);
      if (!rawDocument.fechaEmision || rawDocument.totalDocumento === 0) return;
      incrementCounter(formasCobroVentas, rawDocument.formaCobro1);
      incrementCounter(formasCobroVentas, rawDocument.formaCobro2);
      const document = adaptVenta(rawDocument);
      const clasificacion = classifyAccountingDocument(classificationInput(document), {
        ...this.classification,
        reglasContablesExistentes: this.rules,
      });
      documents.push(withClassification(document, clasificacion));
    });

    const gastosRows = sheetRows.get("GASTOS") || sheetRows.get("GASTOSP") || [];
    gastosRows.slice(6).forEach((row, index) => {
      if (!rowHasDocument(row, [0, 1, 4, 12]) || money(row[12]) === 0) return;
      const rawDocument = gastoFromRow(row, index + 7);
      if (!rawDocument.fechaEmision || rawDocument.totalDocumento === 0) return;
      const document = adaptGasto(rawDocument);
      const clasificacion = classifyAccountingDocument(classificationInput(document), {
        ...this.classification,
        reglasContablesExistentes: this.rules,
      });
      documents.push(withClassification(document, clasificacion));
    });

    if (hojasLeidas.length === 0) {
      issues.push(buildIssue("WARNING", "No se encontraron hojas COMPRAS, VENTAS o GASTOS para generar asientos."));
    }

    const eventResult = generateAccountingEvents(documents, { emitPendingPaymentEvents: true });
    issues.push(
      ...eventResult.warnings.map((warning) =>
        buildIssue(warning.tipo === "INFO" ? "INFO" : "WARNING", warning.mensaje, {
          codigo: warning.codigo,
          hoja: warning.hojaOrigen,
          fila: warning.filaOrigen,
          campo: warning.documentoOrigen,
        })
      ),
      ...eventResult.errors.map((error) =>
        buildIssue("ERROR", error.mensaje, {
          codigo: error.codigo,
          hoja: error.hojaOrigen,
          fila: error.filaOrigen,
          campo: error.documentoOrigen,
        })
      )
    );

    const resolver = new AccountingRoleResolver({ configuraciones: this.accountConfigurations });
    const builder = new AccountingEventJournalBuilder();
    const validator = new AccountingJournalValidatorService({ accounts: this.accounts });
    const asientos: PreviewEntry[] = [];
    const documentByEventId = new Map(documents.map((document) => [`${document.hojaOrigen}:${document.filaOrigen}:${document.documentoOrigen}`, document]));
    const purchaseDocumentsByKey = new Map(
      documents
        .filter((document) => document.hojaOrigen === "COMPRAS")
        .filter((document) => !isCode(document.tipoComprobante, TipoComprobanteSRI.NOTA_CREDITO) && !isCode(document.tipoComprobante, TipoComprobanteSRI.NOTA_DEBITO))
        .map((document) => [purchaseKey(document), document])
    );
    const purchaseEntriesByKey = new Map<string, PreviewEntry>();
    const reversedTotalsByOriginalKey = new Map<string, number>();
    const creditNoteAuditByRow = new Map<number, Record<string, unknown>>();
    const missingConfigurationGroups = new Map<
      string,
      {
        role: string;
        reason: string;
        affected: number;
        documents: Set<string>;
      }
    >();
    const blockedEventIds = new Set<string>();
    let numero = 1;

    for (const event of eventResult.eventos) {
      const informationalMotives = event.motivos.filter((motivo) =>
        motivo.includes("generado desde documento ATS persistido/normalizado")
      );
      const actionableMotives = event.motivos.filter((motivo) => !informationalMotives.includes(motivo));

      informationalMotives.forEach((motivo) => {
        issues.push(
          buildIssue("INFO", motivo, {
            codigo: `${event.tipo}_GENERADO`,
            hoja: event.hojaOrigen,
            fila: event.filaOrigen,
            campo: event.documentoOrigen,
          })
        );
      });

      if (event.eventoRelacionadoId && blockedEventIds.has(event.eventoRelacionadoId)) {
        issues.push(
          buildIssue("WARNING", `El evento ${event.tipo} no se genera porque su evento relacionado ${event.eventoRelacionadoId} no fue generado.`, {
            codigo: "EVENTO_RELACIONADO_BLOQUEADO",
            hoja: event.hojaOrigen,
            fila: event.filaOrigen,
            campo: event.documentoOrigen,
          })
        );
        continue;
      }

      if (event.estado !== "GENERABLE") {
        blockedEventIds.add(event.idTemporal);
        if (event.tipo === "NOTA_CREDITO_COMPRA") {
          const document = documentByEventId.get(`${event.hojaOrigen}:${event.filaOrigen}:${event.documentoOrigen}`);
          const relation = findCreditNoteOriginal({
            event,
            document,
            purchaseDocumentsByKey,
            purchaseEntriesByKey,
            reversedTotalsByOriginalKey,
          });

          if ("originalEntry" in relation && relation.originalEntry && relation.relation && relation.originalKey && relation.ratio) {
            const reverseEntry = buildCreditNoteReverseEntry({
              event,
              originalEntry: relation.originalEntry,
              relation: relation.relation,
              ratio: relation.ratio,
              numero,
            });
            const validationIssues = validator.validate(reverseEntry);
            issues.push(...validationIssues.map(validationToIssue));
            const validationErrors = validationIssues.filter((issue) => issue.tipo === "ERROR").map((issue) => issue.mensaje);
            if (validationErrors.length === 0) {
              asientos.push(reverseEntry);
              reversedTotalsByOriginalKey.set(
                relation.originalKey,
                roundMoney((reversedTotalsByOriginalKey.get(relation.originalKey) || 0) + relation.relation.valoresRevertidos.totalDocumento)
              );
              creditNoteAuditByRow.set(event.filaOrigen, {
                notaCreditoRelacion: relation.relation,
                documentoOriginalNumero: relation.relation.documentoOriginalNumero,
                metodoRelacion: relation.relation.metodoRelacion,
                confianzaRelacion: relation.relation.confianzaRelacion,
                motivoRevision: "",
              });
              if (relation.relation.metodoRelacion === "PROVEEDOR_VALORES_FECHA_UNICA") {
                issues.push(
                  buildIssue(
                    "WARNING",
                    "Factura relacionada mediante coincidencia alternativa por proveedor, fecha y valores. Se recomienda revisar el documento original.",
                    {
                      codigo: "NOTA_CREDITO_RELACION_ECONOMICA",
                      hoja: event.hojaOrigen,
                      fila: event.filaOrigen,
                      campo: event.documentoOrigen,
                    }
                  )
                );
              }
              issues.push(
                buildIssue("INFO", `Nota de crédito ${event.documentoOrigen} reversada automáticamente contra factura ${relation.relation.documentoOriginalNumero}.`, {
                  codigo: "NOTA_CREDITO_COMPRA_REVERSADA",
                  hoja: event.hojaOrigen,
                  fila: event.filaOrigen,
                  campo: event.documentoOrigen,
                })
              );
              numero += 1;
              continue;
            }
          }

          const motivoRevision = relation.motivoRevision || `No se pudo relacionar la nota de crédito ${event.documentoOrigen} con una factura original generable.`;
          creditNoteAuditByRow.set(event.filaOrigen, {
            documentoOriginalNumero: relation.documentoOriginalNumero,
            metodoRelacion: relation.metodoRelacion,
            posiblesCoincidencias: relation.posiblesCoincidencias,
            motivoRevision,
          });
          issues.push(
            buildIssue("WARNING", motivoRevision, {
              codigo: "PENDIENTE_CLASIFICACION",
              hoja: event.hojaOrigen,
              fila: event.filaOrigen,
              campo: event.documentoOrigen,
            })
          );
          continue;
        }

        issues.push(
          buildIssue("WARNING", actionableMotives.join(" ") || `El evento ${event.tipo} requiere revisión antes de generar asiento.`, {
            codigo: event.estado,
            hoja: event.hojaOrigen,
            fila: event.filaOrigen,
            campo: event.documentoOrigen,
          })
        );
        continue;
      }

      const rule = findRule(event, this.rules);
      const resolvedRoles = resolver.resolveMany({ event, reglaContable: rule });
      const unresolved = resolvedRoles.filter((resolution) => !resolution.resolved);
      if (unresolved.length > 0) {
        blockedEventIds.add(event.idTemporal);
        unresolved.forEach((resolution) => {
          const reason = missingConfigurationReason(resolution.motivos);
          if (reason) {
            const key = `${resolution.role}|${reason}`;
            const group = missingConfigurationGroups.get(key) || {
              role: resolution.role,
              reason,
              affected: 0,
              documents: new Set<string>(),
            };
            group.affected += 1;
            group.documents.add(`${event.hojaOrigen}:${event.filaOrigen}:${event.documentoOrigen}`);
            missingConfigurationGroups.set(key, group);
            return;
          }
          issues.push(
            buildIssue("ERROR", resolution.motivos.join(" "), {
              codigo: "ROL_SIN_RESOLVER",
              hoja: event.hojaOrigen,
              fila: event.filaOrigen,
              campo: resolution.role,
            })
          );
        });
        continue;
      }

      const built = builder.build(event, {
        numero,
        reglaCodigo: rule?.codigo,
        reglaDescripcion: rule?.descripcion,
        resolvedRoles,
      });
      if (!built.entry) {
        blockedEventIds.add(event.idTemporal);
        built.errors.forEach((error) =>
          issues.push(
            buildIssue("ERROR", error, {
              codigo: "ASIENTO_NO_GENERADO",
              hoja: event.hojaOrigen,
              fila: event.filaOrigen,
              campo: event.documentoOrigen,
            })
          )
        );
        continue;
      }

      const validationIssues = validator.validate(built.entry);
      issues.push(...validationIssues.map(validationToIssue));
      const validationErrors = validationIssues.filter((issue) => issue.tipo === "ERROR").map((issue) => issue.mensaje);
      if (validationErrors.length === 0) {
        const entry = entryWithContext(built.entry, event, built.warnings, validationErrors);
        asientos.push(entry);
        if (event.hojaOrigen === "COMPRAS" && event.tipo === "DEVENGO_COMPRA") {
          const document = documentByEventId.get(`${event.hojaOrigen}:${event.filaOrigen}:${event.documentoOrigen}`);
          if (document) purchaseEntriesByKey.set(purchaseKey(document), entry);
        }
        numero += 1;
      } else {
        blockedEventIds.add(event.idTemporal);
      }
    }

    missingConfigurationGroups.forEach((group) => {
      issues.push(
        buildIssue(
          "ERROR",
          `${group.reason} Documentos afectados: ${group.affected}.`,
          {
            codigo: "ROL_SIN_RESOLVER",
            campo: group.role,
          }
        )
      );
    });

    const totalDebe = total(asientos, "debe");
    const totalHaber = total(asientos, "haber");
    if (Math.abs(totalDebe - totalHaber) > 0.01) {
      issues.push(buildIssue("ERROR", `El total global Debe (${totalDebe.toFixed(2)}) no coincide con Haber (${totalHaber.toFixed(2)}).`, { codigo: "LIBRO_DESCUADRADO" }));
    }

    const uniqueIssues = deduplicateIssues(issues);
    const warnings = uniqueIssues.filter((issue) => issue.tipo === "WARNING");
    const errors = uniqueIssues.filter((issue) => issue.tipo === "ERROR");
    const filasPorHoja = new Map(hojas.map((hoja) => [normalizeSheetName(hoja.nombre), hoja.filas]));
    const purchaseEntryByRow = new Map(
      asientos
        .filter((entry) => entry.hojaOrigen === "COMPRAS")
        .map((entry) => [entry.filaOrigen, entry])
    );
    const auditoriaComprasEnriquecida = auditoriaCompras.map((item) => {
      const fila = Number(item.filaOrigen || 0);
      const entry = purchaseEntryByRow.get(fila);
      return {
        ...item,
        ...(creditNoteAuditByRow.get(fila) || {}),
        estadoAsiento: entry ? "GENERADO" : "REQUIERE_REVISION",
        cuentaAsignada: assignedPurchaseAccount(entry),
      };
    });
    const metadata = accountingMetadata(sheetRows, documents);

    return {
      message: "Excel ATS procesado por el módulo Contabilidad.",
      resumen: {
        archivo: filename,
        hojasLeidas,
        hojasIgnoradas,
        compras: filasPorHoja.get("COMPRAS") || 0,
        ventas: filasPorHoja.get("VENTAS") || 0,
        gastos: filasPorHoja.get("GASTOS") || filasPorHoja.get("GASTOSP") || 0,
        asientos: asientos.length,
        totalDebe,
        totalHaber,
        errores: errors.length,
        advertencias: warnings.length,
        documentosLeidos: documents.length,
        documentosPendientes: countPendingDocuments(uniqueIssues),
        tiposPagoCompras,
        formasPagoCompras,
        formasCobroVentas,
        hojas: hojas.length,
        filas: hojas.reduce((sum, hoja) => sum + hoja.filas, 0),
        asientosGenerados: asientos.length,
        comprasLeidas: comprasRows.slice(6).filter((row) => rowHasDocument(row, [0, 2, 6, 9, 36])).length,
        comprasValidas: documents.filter((document) => document.hojaOrigen === "COMPRAS").length,
        comprasContabilizadas: asientos.filter((entry) => entry.hojaOrigen === "COMPRAS").length,
        comprasPendientesClasificacion: new Set(uniqueIssues.filter((issue) => issue.hoja === "COMPRAS" && issue.codigo === "PENDIENTE_CLASIFICACION").map((issue) => issue.fila)).size,
        comprasPendientesCuenta: new Set(uniqueIssues.filter((issue) => issue.hoja === "COMPRAS" && issue.codigo === "PENDIENTE_CUENTA").map((issue) => issue.fila)).size,
        comprasConError: new Set(uniqueIssues.filter((issue) => issue.hoja === "COMPRAS" && issue.tipo === "ERROR").map((issue) => issue.fila)).size,
        comprasExcluidas: 0,
        asientosCompraGenerados: asientos.filter((entry) => entry.hojaOrigen === "COMPRAS").length,
        totalDebeCompras: total(asientos.filter((entry) => entry.hojaOrigen === "COMPRAS"), "debe"),
        totalHaberCompras: total(asientos.filter((entry) => entry.hojaOrigen === "COMPRAS"), "haber"),
        totalDebeVentas: total(asientos.filter((entry) => entry.hojaOrigen === "VENTAS"), "debe"),
        totalHaberVentas: total(asientos.filter((entry) => entry.hojaOrigen === "VENTAS"), "haber"),
        totalDebeGeneral: totalDebe,
        totalHaberGeneral: totalHaber,
        diferencia: Math.round((totalDebe - totalHaber) * 100) / 100,
        ruc: metadata.ruc,
        razonSocial: metadata.razonSocial,
        periodo: metadata.periodo,
        moneda: metadata.moneda,
      },
      periodo: metadata.periodoObjeto,
      hojas,
      libroDiario: asientos,
      asientos,
      issues: [
        buildIssue("INFO", "Excel leído y procesado en memoria. No se persistieron asientos."),
         ...uniqueIssues,
      ],
      warnings,
      errors,
      auditoriaCompras: auditoriaComprasEnriquecida,
    };
  }
}


import { JournalPreviewService } from "./04-asientos/preview-asientos.service";
import { JournalPersistenceService } from "./05-persistencia/persistencia-asientos.service";

export { JournalPreviewService, JournalPersistenceService };
export {
  JournalPersistenceValidationError,
  validatePreviewEntries,
  validatePreviewIsPersistible,
} from "./05-persistencia/persistencia-asientos.service";
export {
  shouldHoldForClassification,
  validatePreviewEntryForTest,
  validateResolvedRuleAccounts,
} from "./04-asientos/preview-asientos.service";
export type {
  JournalPreviewResult,
  PendingClassification,
  PendingEvent,
  PreviewEntry,
  PreviewLine,
} from "./04-asientos/preview-asientos.service";
export type {
  JournalPersistenceError,
  JournalPersistenceErrorType,
} from "./05-persistencia/persistencia-asientos.service";

export class AccountingEngine {
  constructor(private readonly excelLibroDiarioService = new ExcelLibroDiarioService()) {}

  async process(buffer: Buffer, originalFilename: string): Promise<Record<string, unknown>> {
    return this.excelLibroDiarioService.processAsync(buffer, originalFilename);
  }
}

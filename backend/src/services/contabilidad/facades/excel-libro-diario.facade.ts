import * as XLSX from "xlsx";
import { prisma as defaultPrisma } from "../../../lib/prisma";
import { adaptCompra } from "../adapters/compra.adapter";
import { adaptGasto } from "../adapters/gasto.adapter";
import { adaptVenta } from "../adapters/venta.adapter";
import type { AccountingDocument } from "../domain/accounting-document";
import {
  classifyAccountingDocument,
  loadClassificationConfigFromPrisma,
  type AccountingClassificationConfig,
  type AccountingClassificationResult,
  type AccountingRuleHint,
} from "../application/accounting-classification.service";
import {
  generateAccountingEvents,
  type AccountingEvent,
  type NormalizedAccountingSourceDocument,
} from "../application/accounting-event-generator.service";
import { AccountingEventJournalBuilder, type PreviewEntry } from "../application/accounting-journal-builder.service";
import {
  AccountingRoleResolver,
  loadAccountConfigurationsFromPrisma,
  type AccountConfigurationRecord,
  type AccountingRuleAccountHint,
  type ResolvedAccount,
} from "../application/accounting-role-resolver.service";
import { AccountingJournalValidatorService } from "../application/accounting-journal-validator.service";
import type { ValidationIssue } from "../domain/validation-issue";

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
  const compact = raw.replace(/\s/g, "").replace(/%/g, "");
  const normalized =
    compact.includes(",") && !compact.includes(".")
      ? compact.replace(",", ".")
      : compact.replace(/,/g, "");
  const numberValue = Number(normalized);
  return Number.isFinite(numberValue) ? Math.round((numberValue + Number.EPSILON) * 100) / 100 : 0;
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
  const eventCode = event.tipo.includes("NOTA_CREDITO") ? "04" : event.tipo.includes("NOTA_DEBITO") ? "05" : event.hojaOrigen === "VENTAS" ? "18" : "01";
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

    const eventResult = generateAccountingEvents(documents, { emitPendingPaymentEvents: false });
    issues.push(
      ...eventResult.warnings.map((warning) =>
        buildIssue("WARNING", warning.mensaje, {
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

      if (event.estado !== "GENERABLE") {
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
      if ((event.hojaOrigen === "COMPRAS" || event.hojaOrigen === "GASTOS") && !rule) {
        issues.push(
          buildIssue("WARNING", "Compra/gasto con categoría identificada, pero sin regla contable configurada para resolver una cuenta real.", {
            codigo: "PENDIENTE_CUENTA",
            hoja: event.hojaOrigen,
            fila: event.filaOrigen,
            campo: event.documentoOrigen,
          })
        );
        continue;
      }

      const resolvedRoles = resolver.resolveMany({ event, reglaContable: rule });
      const unresolved = resolvedRoles.filter((resolution) => !resolution.resolved);
      if (unresolved.length > 0) {
        unresolved.forEach((resolution) => {
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
        asientos.push(entryWithContext(built.entry, event, built.warnings, validationErrors));
        numero += 1;
      }
    }

    const totalDebe = total(asientos, "debe");
    const totalHaber = total(asientos, "haber");
    if (Math.abs(totalDebe - totalHaber) > 0.01) {
      issues.push(buildIssue("ERROR", `El total global Debe (${totalDebe.toFixed(2)}) no coincide con Haber (${totalHaber.toFixed(2)}).`, { codigo: "LIBRO_DESCUADRADO" }));
    }

    const uniqueIssues = deduplicateIssues(issues);
    const warnings = uniqueIssues.filter((issue) => issue.tipo === "WARNING");
    const errors = uniqueIssues.filter((issue) => issue.tipo === "ERROR");
    const filasPorHoja = new Map(hojas.map((hoja) => [normalizeSheetName(hoja.nombre), hoja.filas]));

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
      },
      hojas,
      libroDiario: asientos,
      asientos,
      issues: [
        buildIssue("INFO", "Excel leído y procesado en memoria. No se persistieron asientos."),
         ...uniqueIssues,
      ],
      warnings,
      errors,
      auditoriaCompras,
    };
  }
}

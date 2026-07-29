import { prisma as defaultPrisma } from "../../../lib/prisma";
import {
  classifyAccountingDocument,
  type AccountingClassificationResult,
  type AccountingClassificationConfig,
  loadClassificationConfigFromPrisma,
} from "../02-clasificacion/clasificador.service";
import { AccountingEventJournalBuilder, type CreditNoteRelationPreview } from "../04-asientos/constructor-asiento.service";
import { AccountingJournalValidatorService } from "../04-asientos/validador-cuadre.service";
import {
  TipoComprobanteSRI,
  TiposComprobanteCompraSRI,
  TiposComprobanteVentaSRI,
} from "../../../constants/tipos-comprobante-sri";
import {
  adaptCompraToAccountingSource,
  adaptVentaToAccountingSource,
  generateAccountingEvents,
  type AccountingEvent,
  type NormalizedAccountingSourceDocument,
} from "../04-asientos/generador-eventos.service";
import {
  AccountingRoleResolver,
  loadAccountConfigurationsFromPrisma,
  type AccountingRoleResolution,
} from "../03-cuentas/resolver-cuentas.service";
import type { JournalEntry, JournalLine } from "../contratos";
import type { ValidationIssue } from "../contratos";

export type PreviewLine = JournalLine;
export type PreviewEntry = JournalEntry & {
  reglaCodigo?: string;
  atsLoteId?: string;
  clasificacion?: AccountingClassificationResult;
  reglaUtilizada?: unknown;
  cuentasUtilizadas?: Record<string, string | undefined>;
  advertencias?: string[];
  tipoEvento?: string;
  idTemporalEvento?: string;
  eventoRelacionadoId?: string;
  rolesResueltos?: AccountingRoleResolution[];
  evidencias?: unknown[];
  notaCreditoRelacion?: CreditNoteRelationPreview;
};

export type PendingClassification = {
  hojaOrigen: string;
  filaOrigen: number;
  documentoOrigen: string;
  tercero: string;
  categoria: string;
  categoriaBase?: string | null;
  destinoContable?: string | null;
  confianzaCategoria?: string;
  confianzaDestino?: string;
  requiereDecisionDestino?: boolean;
  alternativasDestino?: string[];
  confianza: string;
  origen: string;
  motivos: string[];
  evidencias: string[];
};

export type PendingEvent = {
  tipoEvento: string;
  hojaOrigen: string;
  filaOrigen: number;
  documentoOrigen: string;
  estado: string;
  motivos: string[];
};

export type JournalPreviewResult = {
  resumen: {
    ruc: string;
    razonSocial: string;
    loteId: string;
    periodo: string;
    asientosValidos: number;
    asientosPendientes: number;
    errores: number;
  };
  resumenClasificacion: {
    totalDocumentos: number;
    clasificadosAutomaticamente: number;
    pendientesRevision: number;
    sinClasificacion: number;
    confianzaAlta: number;
    confianzaMedia: number;
    confianzaBaja: number;
  };
  persistible: boolean;
  periodo: {
    id: string;
    anio: number;
    mes: string;
    estado: string;
  };
  asientos: PreviewEntry[];
  eventos: AccountingEvent[];
  eventosPendientes: PendingEvent[];
  pendientes: PendingEvent[];
  pendientesClasificacion: PendingClassification[];
  rolesSinResolver: AccountingRoleResolution[];
  issues: ValidationIssue[];
  warnings: ValidationIssue[];
  errors: ValidationIssue[];
};

type DbClient = typeof defaultPrisma;

function money(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function shouldHoldForClassification(classification: Pick<AccountingClassificationResult, "categoria" | "confianza" | "origen">) {
  return (
    classification.origen === "SIN_CLASIFICACION" ||
    classification.confianza === "BAJA" ||
    classification.categoria.includes("PENDIENTE_REVISION")
  );
}

export function validateResolvedRuleAccounts(rule: {
  codigo?: string;
  cuentaBase?: { codigo?: string; activa?: boolean; movimiento?: boolean } | null;
  cuentaIva?: { codigo?: string; activa?: boolean; movimiento?: boolean } | null;
  cuentaContrapartida?: { codigo?: string; activa?: boolean; movimiento?: boolean } | null;
}) {
  const errors: string[] = [];
  const entries = [
    ["cuentaBase", rule.cuentaBase],
    ["cuentaIva", rule.cuentaIva],
    ["cuentaContrapartida", rule.cuentaContrapartida],
  ] as const;

  for (const [name, account] of entries) {
    if (account === undefined) continue;
    if (!account) {
      errors.push(`La ${name} de la regla ${rule.codigo || "SIN_CODIGO"} no existe.`);
      continue;
    }
    if (account.activa === false) {
      errors.push(`La cuenta ${account.codigo || name} de la regla ${rule.codigo || "SIN_CODIGO"} está inactiva.`);
    }
    if (account.movimiento === false) {
      errors.push(`La cuenta ${account.codigo || name} de la regla ${rule.codigo || "SIN_CODIGO"} es agrupadora.`);
    }
  }

  return errors;
}

export function validatePreviewEntryForTest(entry: PreviewEntry) {
  const errors: string[] = [];
  if (entry.lineas.length < 2) errors.push("El asiento debe tener al menos dos líneas.");

  for (const line of entry.lineas) {
    if (line.debe > 0 && line.haber > 0) errors.push("Una línea no puede tener Debe y Haber simultáneamente.");
    if (line.debe === 0 && line.haber === 0) errors.push("Una línea no puede tener Debe y Haber en cero.");
  }

  const totalDebe = money(entry.lineas.reduce((total, line) => total + line.debe, 0));
  const totalHaber = money(entry.lineas.reduce((total, line) => total + line.haber, 0));
  if (totalDebe !== totalHaber || money(entry.totalDebe) !== money(entry.totalHaber)) {
    errors.push("Debe y Haber no son iguales.");
  }

  return errors;
}

function classifyCompra(compra: Record<string, unknown>, reglas: any[], config: AccountingClassificationConfig) {
  return classifyAccountingDocument(
    {
      hojaOrigen: "COMPRAS",
      rucTercero: String(compra.noIdentificacion || ""),
      razonSocial: String(compra.razonSocialProveedor || ""),
      actividadEconomica: String(compra.tipoActividad || ""),
      concepto: String(compra.conceptoContableCompra || compra.conceptoCompra || compra.observaciones || ""),
      codigoSustento: String(compra.codigoSustento || ""),
      tipoComprobante: String(compra.comprobante || ""),
      formaPago: String(compra.formaPago1 || compra.formaPago2 || ""),
    },
    { ...config, reglasContablesExistentes: reglas }
  );
}

function classifyVenta(venta: Record<string, unknown>, reglas: any[], config: AccountingClassificationConfig) {
  return classifyAccountingDocument(
    {
      hojaOrigen: "VENTAS",
      rucTercero: String(venta.noIdentificacion || ""),
      razonSocial: String(venta.razonSocialCliente || ""),
      actividadEconomica: String(venta.tipoActividad || ""),
      concepto: String(venta.conceptoContableVenta || venta.conceptoVenta || ""),
      tipoComprobante: String(venta.tipoComprobante || ""),
    },
    { ...config, reglasContablesExistentes: reglas }
  );
}

function pendingClassification(document: NormalizedAccountingSourceDocument, classification: AccountingClassificationResult): PendingClassification {
  return {
    hojaOrigen: document.hojaOrigen,
    filaOrigen: document.filaOrigen,
    documentoOrigen: document.documentoOrigen,
    tercero: document.razonSocialTercero,
    categoria: classification.categoria,
    categoriaBase: classification.categoriaBase,
    destinoContable: classification.destinoContable,
    confianzaCategoria: classification.confianzaCategoria,
    confianzaDestino: classification.confianzaDestino,
    requiereDecisionDestino: classification.requiereDecisionDestino,
    alternativasDestino: classification.alternativasDestino,
    confianza: classification.confianza,
    origen: classification.origen,
    motivos: classification.motivos,
    evidencias: classification.evidencias,
  };
}

function pendingEvent(event: AccountingEvent): PendingEvent {
  return {
    tipoEvento: event.tipo,
    hojaOrigen: event.hojaOrigen,
    filaOrigen: event.filaOrigen,
    documentoOrigen: event.documentoOrigen,
    estado: event.estado,
    motivos: event.motivos,
  };
}

function documentNumberLookupKey(value: unknown) {
  return String(value || "").replace(/\D/g, "").replace(/^0+/, "") || "";
}

function normalizedPurchaseKey(document: Pick<NormalizedAccountingSourceDocument, "identificacionTercero" | "documentoOrigen">) {
  return `${document.identificacionTercero || "SIN_ID"}|${documentNumberLookupKey(document.documentoOrigen) || "SIN_DOCUMENTO"}`;
}

function isCreditNoteDocument(document: NormalizedAccountingSourceDocument) {
  return document.tipoComprobante === TipoComprobanteSRI.NOTA_CREDITO;
}

function isDebitNoteDocument(document: NormalizedAccountingSourceDocument) {
  return document.tipoComprobante === TipoComprobanteSRI.NOTA_DEBITO;
}

function eventDocumentKey(event: Pick<AccountingEvent, "hojaOrigen" | "filaOrigen" | "documentoOrigen">) {
  return `${event.hojaOrigen}:${event.filaOrigen}:${event.documentoOrigen}`;
}

function documentEventKey(document: Pick<NormalizedAccountingSourceDocument, "hojaOrigen" | "filaOrigen" | "documentoOrigen">) {
  return `${document.hojaOrigen}:${document.filaOrigen}:${document.documentoOrigen}`;
}

function documentValues(document: NormalizedAccountingSourceDocument) {
  return {
    base: money(Math.abs(Number(document.baseTarifa0 || 0)) + Math.abs(Number(document.baseGravada || 0))),
    iva: money(Math.abs(Number(document.iva || 0))),
    total: money(Math.abs(Number(document.total || 0))),
  };
}

function totalsMatch(left: number, right: number) {
  return Math.abs(left - right) <= 0.01;
}

function documentIsBefore(candidate: NormalizedAccountingSourceDocument, creditNote: NormalizedAccountingSourceDocument) {
  return candidate.fechaEmision.getTime() <= creditNote.fechaEmision.getTime();
}

function findCreditNoteOriginalForPreview(params: {
  event: AccountingEvent;
  document?: NormalizedAccountingSourceDocument;
  purchaseDocumentsByKey: Map<string, NormalizedAccountingSourceDocument>;
  purchaseEntriesByKey: Map<string, PreviewEntry>;
}) {
  const { event, document, purchaseDocumentsByKey, purchaseEntriesByKey } = params;
  if (!document) return null;

  const modifiedNumber = documentNumberLookupKey(document.documentoModificado);
  const noteValues = {
    base: money(Math.abs(Number(event.montos.base || 0))),
    iva: money(Math.abs(Number(event.montos.iva || 0))),
    total: money(Math.abs(Number(event.montos.totalDocumento || 0))),
  };
  let originalDocument: NormalizedAccountingSourceDocument | undefined;
  let originalKey = `${document.identificacionTercero || "SIN_ID"}|${modifiedNumber || "SIN_DOCUMENTO"}`;

  if (modifiedNumber) originalDocument = purchaseDocumentsByKey.get(originalKey);
  if (!originalDocument) {
    const candidates = Array.from(purchaseDocumentsByKey.entries()).filter(([, candidate]) => {
      const values = documentValues(candidate);
      return (
        String(candidate.identificacionTercero || "") === String(document.identificacionTercero || "") &&
        documentIsBefore(candidate, document) &&
        totalsMatch(values.base, noteValues.base) &&
        totalsMatch(values.iva, noteValues.iva) &&
        totalsMatch(values.total, noteValues.total)
      );
    });
    if (candidates.length !== 1) return null;
    [originalKey, originalDocument] = candidates[0];
  }

  const originalEntry = purchaseEntriesByKey.get(originalKey);
  if (!originalEntry || noteValues.total <= 0) return null;
  const originalValues = documentValues(originalDocument);
  const ratio = money(noteValues.total / originalValues.total);
  if (!Number.isFinite(ratio) || ratio <= 0 || ratio - 1 > 0.01) return null;
  return { originalKey, originalDocument, originalEntry, ratio, noteValues };
}

function reverseLinesFromOriginal(originalEntry: PreviewEntry, ratio: number, description: string) {
  const lineas = originalEntry.lineas
    .map((line, index) => ({
      ...line,
      descripcion: line.descripcion || description,
      debe: money(Number(line.haber || 0) * ratio),
      haber: money(Number(line.debe || 0) * ratio),
      orden: line.orden ?? index + 1,
    }))
    .filter((line) => line.debe > 0 || line.haber > 0);
  const totalDebe = money(lineas.reduce((sum, line) => sum + Number(line.debe || 0), 0));
  const totalHaber = money(lineas.reduce((sum, line) => sum + Number(line.haber || 0), 0));
  const difference = money(totalDebe - totalHaber);
  if (difference > 0) {
    const target = lineas.find((line) => Number(line.haber || 0) > 0);
    if (target) target.haber = money(Number(target.haber || 0) + difference);
  } else if (difference < 0) {
    const target = lineas.find((line) => Number(line.debe || 0) > 0);
    if (target) target.debe = money(Number(target.debe || 0) + Math.abs(difference));
  }
  return lineas;
}

function buildCreditNoteReverseEntryForPreview(params: {
  event: AccountingEvent;
  originalEntry: PreviewEntry;
  originalDocument: NormalizedAccountingSourceDocument;
  ratio: number;
  numero: number;
}) {
  const thirdParty = String(params.event.tercero.razonSocial || params.event.tercero.identificacion || "").trim();
  const description = [
    "Nota de credito segun documento",
    params.event.documentoOrigen,
    "relacionada con factura",
    params.originalDocument.documentoOrigen,
    thirdParty ? "de" : "",
    thirdParty,
  ].filter(Boolean).join(" ");
  const lineas = reverseLinesFromOriginal(params.originalEntry, params.ratio, description);
  const totalDebe = money(lineas.reduce((sum, line) => sum + Number(line.debe || 0), 0));
  const totalHaber = money(lineas.reduce((sum, line) => sum + Number(line.haber || 0), 0));
  const originalValues = documentValues(params.originalDocument);
  const reversedValues = {
    base: money(Math.abs(Number(params.event.montos.base || 0))),
    iva: money(Math.abs(Number(params.event.montos.iva || 0))),
    totalDocumento: money(Math.abs(Number(params.event.montos.totalDocumento || 0))),
    retencionFuente: money(Math.abs(Number(params.event.montos.retencionFuente || 0))),
    retencionIva: money(Math.abs(Number(params.event.montos.retencionIva || 0))),
  };

  return {
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
    eventoRelacionadoId: params.originalEntry.idTemporal || params.originalEntry.idTemporalEvento,
    notaCreditoRelacion: {
      documentoOriginalId: params.originalEntry.idTemporal || params.originalEntry.idTemporalEvento,
      notaCreditoDocumento: params.event.documentoOrigen,
      documentoOriginalNumero: params.originalDocument.documentoOrigen,
      documentoOriginalEncontrado: params.originalDocument.documentoOrigen,
      filaOriginal: params.originalDocument.filaOrigen,
      metodoRelacion: "NUMERO_EXACTO_LOTE_ACTUAL",
      confianzaRelacion: "ALTA",
      coincidenciaNumeroExacto: true,
      coincidenciaProveedor: true,
      coincidenciaBase: true,
      coincidenciaIva: true,
      coincidenciaTotal: true,
      asientoOriginalId: params.originalEntry.idTemporal || params.originalEntry.idTemporalEvento,
      reversoGenerado: true,
      valoresOriginales: {
        base: originalValues.base,
        iva: originalValues.iva,
        totalDocumento: originalValues.total,
        retencionFuente: 0,
        retencionIva: 0,
      },
      valoresRevertidos: reversedValues,
      esReversoParcial: params.ratio < 0.999,
    },
  } satisfies PreviewEntry;
}

function missingConfigurationReason(motivos: string[]) {
  return motivos.find((motivo) => motivo.startsWith("No existe ConfiguracionCuentaContable activa para"));
}

function operationForEvent(event: AccountingEvent) {
  return event.hojaOrigen === "VENTAS" ? "VENTA" : "COMPRA";
}

function findRuleForEvent(event: AccountingEvent, rules: any[]) {
  const operation = operationForEvent(event);
  return rules
    .filter((rule) => rule.activa !== false)
    .filter((rule) => rule.tipoOperacion === operation)
    .find((rule) => {
      if (operation === "VENTA" && event.tipo === "DEVENGO_VENTA") return [...TiposComprobanteVentaSRI, null, undefined].includes(rule.tipoComprobante);
      if (event.tipo.includes("NOTA_CREDITO")) return rule.tipoComprobante === TipoComprobanteSRI.NOTA_CREDITO;
      if (event.tipo.includes("NOTA_DEBITO")) return rule.tipoComprobante === TipoComprobanteSRI.NOTA_DEBITO;
      return [...TiposComprobanteCompraSRI, null, undefined].includes(rule.tipoComprobante);
    });
}

export class JournalPreviewService {
  constructor(private readonly db: DbClient = defaultPrisma) {}

  async buildFromAtsLote(ruc: string, loteId: string): Promise<JournalPreviewResult> {
    const contribuyente = await (this.db as any).contribuyente.findUnique({ where: { ruc } });
    const lote = await (this.db as any).atsLote.findFirst({
      where: { id: loteId, contribuyenteId: contribuyente?.id },
      include: { compras: true, ventas: true },
    });

    if (!contribuyente || !lote) {
      throw new Error("No se encontró el lote ATS solicitado para el contribuyente.");
    }

    const periodo = await (this.db as any).periodoContable.upsert({
      where: {
        contribuyenteId_anio_mes: {
          contribuyenteId: contribuyente.id,
          anio: lote.anio,
          mes: lote.mes,
        },
      },
      update: {},
      create: {
        contribuyenteId: contribuyente.id,
        anio: lote.anio,
        mes: lote.mes,
        estado: "ABIERTO",
      },
    });
    const last = await (this.db as any).asientoContable.findFirst({
      where: { contribuyenteId: contribuyente.id, periodoId: periodo.id },
      orderBy: { numero: "desc" },
    });
    const rules = await (this.db as any).reglaContable.findMany({
      include: {
        cuentaBase: true,
        cuentaIva: true,
        cuentaContrapartida: true,
      },
    });
    const classificationConfig = await loadClassificationConfigFromPrisma(this.db);
    const accountConfigurations = await loadAccountConfigurationsFromPrisma(this.db);
    const resolver = new AccountingRoleResolver({ configuraciones: accountConfigurations });
    const builder = new AccountingEventJournalBuilder();
    const validator = new AccountingJournalValidatorService();
    const documents: NormalizedAccountingSourceDocument[] = [];

    for (const compra of lote.compras || []) {
      const classification = classifyCompra(compra, rules, classificationConfig);
      documents.push(adaptCompraToAccountingSource(compra, classification));
    }
    for (const venta of lote.ventas || []) {
      const classification = classifyVenta(venta, rules, classificationConfig);
      documents.push(adaptVentaToAccountingSource(venta, classification));
    }

    const asientos: PreviewEntry[] = [];
    const eventos: AccountingEvent[] = [];
    const eventosPendientes: PendingEvent[] = [];
    const pendientesClasificacion: PendingClassification[] = [];
    const rolesSinResolver: AccountingRoleResolution[] = [];
    const issues: ValidationIssue[] = [];
    const warnings: ValidationIssue[] = [];
    const errors: ValidationIssue[] = [];
    const missingConfigurationGroups = new Map<
      string,
      {
        role: string;
        reason: string;
        affected: number;
      }
    >();
    const classifications: AccountingClassificationResult[] = [];
    const blockedEventIds = new Set<string>();
    const generableDocuments: NormalizedAccountingSourceDocument[] = [];
    let numero = Number(last?.numero || 0) + 1;

    for (const document of documents) {
      const classification = document.clasificacion;
      classifications.push(classification);
      if (shouldHoldForClassification(classification)) {
        pendientesClasificacion.push(pendingClassification(document, classification));
        continue;
      }

      generableDocuments.push(document);
    }

    const generated = generateAccountingEvents(generableDocuments);
    const documentByEventId = new Map(generableDocuments.map((document) => [documentEventKey(document), document]));
    const purchaseDocumentsByKey = new Map(
      generableDocuments
        .filter((document) => document.hojaOrigen === "COMPRAS")
        .filter((document) => !isCreditNoteDocument(document) && !isDebitNoteDocument(document))
        .map((document) => [normalizedPurchaseKey(document), document])
    );
    const purchaseEntriesByKey = new Map<string, PreviewEntry>();
    warnings.push(
      ...generated.warnings.map((warning) => ({
        tipo: warning.tipo === "INFO" ? "INFO" as const : "WARNING" as const,
        codigo: warning.codigo,
        hoja: warning.hojaOrigen,
        fila: warning.filaOrigen,
        documentoOrigen: warning.documentoOrigen,
        mensaje: warning.mensaje,
      }))
    );
    errors.push(
      ...generated.errors.map((error) => ({
        tipo: "ERROR" as const,
        codigo: error.codigo,
        hoja: error.hojaOrigen,
        fila: error.filaOrigen,
        documentoOrigen: error.documentoOrigen,
        mensaje: error.mensaje,
      }))
    );
    eventos.push(...generated.eventos);

    for (const event of generated.eventos) {
      if (event.eventoRelacionadoId && blockedEventIds.has(event.eventoRelacionadoId)) {
        warnings.push({
          tipo: "WARNING",
          codigo: "EVENTO_RELACIONADO_BLOQUEADO",
          hoja: event.hojaOrigen,
          fila: event.filaOrigen,
          documentoOrigen: event.documentoOrigen,
          mensaje: `El evento ${event.tipo} no se genera porque su evento relacionado ${event.eventoRelacionadoId} no fue generado.`,
        });
        continue;
      }

      if (event.estado !== "GENERABLE") {
        blockedEventIds.add(event.idTemporal);
        if (event.tipo === "NOTA_CREDITO_COMPRA") {
          const relation = findCreditNoteOriginalForPreview({
            event,
            document: documentByEventId.get(eventDocumentKey(event)),
            purchaseDocumentsByKey,
            purchaseEntriesByKey,
          });

          if (relation) {
            const reverseEntry = buildCreditNoteReverseEntryForPreview({
              event,
              originalEntry: relation.originalEntry,
              originalDocument: relation.originalDocument,
              ratio: relation.ratio,
              numero,
            });
            const validationIssues = validator.validate(reverseEntry);
            if (validationIssues.length === 0) {
              asientos.push(reverseEntry);
              numero += 1;
              continue;
            }
            errors.push(...validationIssues);
          }
        }
        eventosPendientes.push(pendingEvent(event));
        continue;
      }

      const rule = findRuleForEvent(event, rules);
      const resolvedRoles = resolver.resolveMany({ event, reglaContable: rule });
      const unresolved = resolvedRoles.filter((role) => !role.resolved);
      if (unresolved.length > 0) {
        blockedEventIds.add(event.idTemporal);
        rolesSinResolver.push(...unresolved);
        unresolved.forEach((resolution) => {
          const reason = missingConfigurationReason(resolution.motivos);
          if (!reason) return;
          const key = `${resolution.role}|${reason}`;
          const group = missingConfigurationGroups.get(key) || {
            role: resolution.role,
            reason,
            affected: 0,
          };
          group.affected += 1;
          missingConfigurationGroups.set(key, group);
        });
        continue;
      }

      const built = builder.build(event, {
        numero,
        atsLoteId: lote.id,
        reglaCodigo: rule?.codigo,
        reglaDescripcion: rule?.descripcion,
        resolvedRoles,
      });

      if (built.entry) {
        const validationIssues = validator.validate(built.entry);
        if (validationIssues.length === 0) {
          asientos.push(built.entry);
          if (event.hojaOrigen === "COMPRAS" && event.tipo === "DEVENGO_COMPRA") {
            const document = documentByEventId.get(eventDocumentKey(event));
            if (document) purchaseEntriesByKey.set(normalizedPurchaseKey(document), built.entry);
          }
          numero += 1;
        } else {
          blockedEventIds.add(event.idTemporal);
          errors.push(...validationIssues);
        }
      }
      if (!built.entry || built.errors.length > 0) {
        blockedEventIds.add(event.idTemporal);
      }
      errors.push(
        ...built.errors.map((mensaje) => ({
          tipo: "ERROR" as const,
          hoja: event.hojaOrigen,
          fila: event.filaOrigen,
          documentoOrigen: event.documentoOrigen,
          mensaje,
        }))
      );
      warnings.push(
        ...built.warnings.map((mensaje) => ({
          tipo: "WARNING" as const,
          hoja: event.hojaOrigen,
          fila: event.filaOrigen,
          documentoOrigen: event.documentoOrigen,
          mensaje,
        }))
      );
    }

    missingConfigurationGroups.forEach((group) => {
      errors.push({
        tipo: "ERROR",
        severidad: "BLOQUEANTE",
        codigo: "ROL_SIN_RESOLVER",
        campo: group.role,
        mensaje: `${group.reason} Documentos afectados: ${group.affected}.`,
      });
    });

    issues.push(...warnings, ...errors);
    const persistible = errors.length === 0 && pendientesClasificacion.length === 0 && rolesSinResolver.length === 0;

    return {
      resumen: {
        ruc: contribuyente.ruc,
        razonSocial: contribuyente.razonSocial,
        loteId: lote.id,
        periodo: `${lote.mes}/${lote.anio}`,
        asientosValidos: asientos.length,
        asientosPendientes: eventosPendientes.length + pendientesClasificacion.length + rolesSinResolver.length,
        errores: errors.length,
      },
      resumenClasificacion: {
        totalDocumentos: documents.length,
        clasificadosAutomaticamente: classifications.filter((item) => !shouldHoldForClassification(item)).length,
        pendientesRevision: pendientesClasificacion.length,
        sinClasificacion: classifications.filter((item) => item.origen === "SIN_CLASIFICACION").length,
        confianzaAlta: classifications.filter((item) => item.confianza === "ALTA").length,
        confianzaMedia: classifications.filter((item) => item.confianza === "MEDIA").length,
        confianzaBaja: classifications.filter((item) => item.confianza === "BAJA").length,
      },
      persistible,
      periodo: {
        id: periodo.id,
        anio: periodo.anio,
        mes: periodo.mes,
        estado: periodo.estado,
      },
      asientos,
      eventos,
      eventosPendientes,
      pendientes: eventosPendientes,
      pendientesClasificacion,
      rolesSinResolver,
      issues,
      warnings,
      errors,
    };
  }
}

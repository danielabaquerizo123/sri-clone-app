import { prisma as defaultPrisma } from "../../../lib/prisma";
import {
  classifyAccountingDocument,
  type AccountingClassificationResult,
  type AccountingClassificationConfig,
  loadClassificationConfigFromPrisma,
} from "../02-clasificacion/clasificador.service";
import { AccountingEventJournalBuilder } from "../04-asientos/constructor-asiento.service";
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
      concepto: String(compra.conceptoContableCompra || compra.conceptoCompra || ""),
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
      where: { contribuyenteId: contribuyente.id, periodoContableId: periodo.id },
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
    let numero = Number(last?.numero || 0) + 1;

    for (const document of documents) {
      const classification = document.clasificacion;
      classifications.push(classification);
      if (shouldHoldForClassification(classification)) {
        pendientesClasificacion.push(pendingClassification(document, classification));
        continue;
      }

      const generated = generateAccountingEvents([document]);
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

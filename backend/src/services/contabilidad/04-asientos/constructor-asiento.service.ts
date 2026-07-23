import type {
  AccountingEvent,
  AccountingEventType,
} from "./generador-eventos.service";
import type { RequiredAccountRole } from "../contratos";
import type { AccountingClassificationResult } from "../02-clasificacion/clasificador.service";
import type { AccountingRoleResolution } from "../03-cuentas/resolver-cuentas.service";
import type { JournalEntry, JournalLine } from "../contratos";
import { generarGlosaOperacionDesdeEvento } from "../accounting-description.service";

export type PreviewLine = JournalLine;
export type CreditNoteRelationPreview = {
  documentoOriginalId?: string;
  documentoOriginalNumero: string;
  notaCreditoDocumento?: string;
  documentoModificadoDeclarado?: string;
  documentoOriginalEncontrado?: string;
  loteOriginalId?: string;
  filaOriginal?: number;
  metodoRelacion:
    | "NUMERO_EXACTO_LOTE_ACTUAL"
    | "NUMERO_EXACTO_LOTE_HISTORICO"
    | "AUTORIZACION_EXACTA"
    | "PROVEEDOR_VALORES_FECHA_UNICA"
    | "SIN_COINCIDENCIA"
    | "MULTIPLES_COINCIDENCIAS";
  confianzaRelacion: "ALTA" | "MEDIA" | "BAJA";
  coincidenciaNumeroExacto?: boolean;
  coincidenciaProveedor?: boolean;
  coincidenciaBase?: boolean;
  coincidenciaIva?: boolean;
  coincidenciaTotal?: boolean;
  asientoOriginalId?: string;
  reversoGenerado?: boolean;
  valoresOriginales: {
    base: number;
    iva: number;
    totalDocumento: number;
    retencionFuente: number;
    retencionIva: number;
  };
  valoresRevertidos: {
    base: number;
    iva: number;
    totalDocumento: number;
    retencionFuente: number;
    retencionIva: number;
  };
  esReversoParcial: boolean;
  motivoRevision?: string;
};

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

export type AccountingEventJournalBuildResult = {
  entry?: PreviewEntry;
  errors: string[];
  warnings: string[];
};

export type AccountingEventJournalBuilderParams = {
  numero: number;
  atsLoteId?: string;
  reglaCodigo?: string;
  reglaDescripcion?: string;
  resolvedRoles: AccountingRoleResolution[];
};

function money(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function absMoney(value: number) {
  return Math.abs(money(value));
}

function add(values: number[]) {
  return money(values.reduce((total, value) => total + value, 0));
}

function dateToIsoDate(value: Date) {
  return value.toISOString().slice(0, 10);
}

function isCreditNote(type: AccountingEventType) {
  return type === "NOTA_CREDITO_COMPRA" || type === "NOTA_CREDITO_VENTA";
}

function isPurchaseIncrease(type: AccountingEventType) {
  return type === "DEVENGO_COMPRA" || type === "NOTA_DEBITO_COMPRA";
}

function isSaleIncrease(type: AccountingEventType) {
  return type === "DEVENGO_VENTA" || type === "NOTA_DEBITO_VENTA";
}

function isBuildableEvent(type: AccountingEventType) {
  return (
    isPurchaseIncrease(type) ||
    isSaleIncrease(type) ||
    type === "NOTA_CREDITO_COMPRA" ||
    type === "NOTA_CREDITO_VENTA" ||
    type === "PAGO_PROVEEDOR" ||
    type === "COBRO_CLIENTE" ||
    type === "RETENCION_EMITIDA" ||
    type === "RETENCION_RECIBIDA"
  );
}

function sideFor(baseSide: "DEBE" | "HABER", eventType: AccountingEventType) {
  if (!isCreditNote(eventType)) return baseSide;
  return baseSide === "DEBE" ? "HABER" : "DEBE";
}

function canonicalRole(role: RequiredAccountRole): RequiredAccountRole {
  return role === "INGRESO" ? "INGRESO_VENTAS" : role;
}

function roleMap(resolutions: AccountingRoleResolution[]) {
  const map = new Map<RequiredAccountRole, AccountingRoleResolution>();
  resolutions.forEach((resolution) => {
    map.set(resolution.role, resolution);
    map.set(canonicalRole(resolution.role), resolution);
  });
  return map;
}

function missingRoles(event: AccountingEvent, resolutions: AccountingRoleResolution[]) {
  const map = roleMap(resolutions);
  return event.rolesRequeridos.filter((role) => !map.get(canonicalRole(role))?.resolved);
}

function line(params: {
  role: RequiredAccountRole;
  side: "DEBE" | "HABER";
  amount: number;
  description: string;
  order: number;
  resolutions: AccountingRoleResolution[];
}): PreviewLine | null {
  const amount = absMoney(params.amount);
  if (amount <= 0) return null;

  const resolution = roleMap(params.resolutions).get(canonicalRole(params.role));
  if (!resolution?.resolved || !resolution.cuenta) return null;

  return {
    cuentaId: resolution.cuenta.id,
    codigo: resolution.cuenta.codigo,
    cuenta: resolution.cuenta.nombre,
    descripcion: params.description,
    debe: params.side === "DEBE" ? amount : 0,
    haber: params.side === "HABER" ? amount : 0,
    orden: params.order,
  };
}

function purchaseLines(event: AccountingEvent, resolutions: AccountingRoleResolution[]) {
  const description = accountingDescription(event);

  return [
    line({
      role: "GASTO_COSTO_ACTIVO",
      side: sideFor("DEBE", event.tipo),
      amount: event.montos.base,
      description,
      order: 1,
      resolutions,
    }),
    line({
      role: "IVA_CREDITO_TRIBUTARIO",
      side: sideFor("DEBE", event.tipo),
      amount: event.montos.iva,
      description,
      order: 2,
      resolutions,
    }),
    line({
      role: "CUENTAS_POR_PAGAR_PROVEEDORES",
      side: sideFor("HABER", event.tipo),
      amount: event.montos.totalDocumento,
      description,
      order: 3,
      resolutions,
    }),
  ].filter((item): item is PreviewLine => Boolean(item));
}

function purchasePaymentLines(event: AccountingEvent, resolutions: AccountingRoleResolution[]) {
  const description = accountingDescription(event);
  const netoFinanciero = add([
    event.montos.totalDocumento,
    -event.montos.retencionFuente,
    -event.montos.retencionIva,
  ]);

  return [
    line({
      role: "CUENTAS_POR_PAGAR_PROVEEDORES",
      side: "DEBE",
      amount: event.montos.totalDocumento,
      description,
      order: 1,
      resolutions,
    }),
    line({
      role: "RETENCION_FUENTE_POR_PAGAR",
      side: sideFor("HABER", event.tipo),
      amount: event.montos.retencionFuente,
      description,
      order: 2,
      resolutions,
    }),
    line({
      role: "RETENCION_IVA_POR_PAGAR",
      side: sideFor("HABER", event.tipo),
      amount: event.montos.retencionIva,
      description,
      order: 3,
      resolutions,
    }),
    line({
      role: "CUENTA_FINANCIERA",
      side: "HABER",
      amount: netoFinanciero,
      description,
      order: 4,
      resolutions,
    }),
  ].filter((item): item is PreviewLine => Boolean(item));
}

function saleLines(event: AccountingEvent, resolutions: AccountingRoleResolution[]) {
  const description = accountingDescription(event);
  return [
    line({
      role: "CUENTAS_POR_COBRAR_CLIENTES",
      side: sideFor("DEBE", event.tipo),
      amount: event.montos.totalDocumento,
      description,
      order: 1,
      resolutions,
    }),
    line({
      role: "INGRESO_VENTAS",
      side: sideFor("HABER", event.tipo),
      amount: event.montos.base,
      description,
      order: 2,
      resolutions,
    }),
    line({
      role: "IVA_POR_PAGAR",
      side: sideFor("HABER", event.tipo),
      amount: event.montos.iva,
      description,
      order: 3,
      resolutions,
    }),
  ].filter((item): item is PreviewLine => Boolean(item));
}

function retentionIssuedLines(event: AccountingEvent, resolutions: AccountingRoleResolution[]) {
  const description = accountingDescription(event);
  const totalRetenido = add([event.montos.retencionFuente, event.montos.retencionIva]);

  return [
    line({
      role: "CUENTAS_POR_PAGAR_PROVEEDORES",
      side: "DEBE",
      amount: totalRetenido,
      description,
      order: 1,
      resolutions,
    }),
    line({
      role: "RETENCION_FUENTE_POR_PAGAR",
      side: "HABER",
      amount: event.montos.retencionFuente,
      description,
      order: 2,
      resolutions,
    }),
    line({
      role: "RETENCION_IVA_POR_PAGAR",
      side: "HABER",
      amount: event.montos.retencionIva,
      description,
      order: 3,
      resolutions,
    }),
  ].filter((item): item is PreviewLine => Boolean(item));
}

function retentionReceivedLines(event: AccountingEvent, resolutions: AccountingRoleResolution[]) {
  const description = accountingDescription(event);
  const totalRetenido = add([event.montos.retencionFuente, event.montos.retencionIva]);

  return [
    line({
      role: "RETENCION_FUENTE_POR_COBRAR",
      side: "DEBE",
      amount: event.montos.retencionFuente,
      description,
      order: 1,
      resolutions,
    }),
    line({
      role: "RETENCION_IVA_POR_COBRAR",
      side: "DEBE",
      amount: event.montos.retencionIva,
      description,
      order: 2,
      resolutions,
    }),
    line({
      role: "CUENTAS_POR_COBRAR_CLIENTES",
      side: "HABER",
      amount: totalRetenido,
      description,
      order: 3,
      resolutions,
    }),
  ].filter((item): item is PreviewLine => Boolean(item));
}

function collectionLines(event: AccountingEvent, resolutions: AccountingRoleResolution[]) {
  const description = accountingDescription(event);
  const netoFinanciero = add([
    event.montos.totalDocumento,
    -event.montos.retencionFuente,
    -event.montos.retencionIva,
  ]);

  return [
    line({
      role: "CUENTA_FINANCIERA",
      side: "DEBE",
      amount: netoFinanciero,
      description,
      order: 1,
      resolutions,
    }),
    line({
      role: "RETENCION_FUENTE_POR_COBRAR",
      side: "DEBE",
      amount: event.montos.retencionFuente,
      description,
      order: 2,
      resolutions,
    }),
    line({
      role: "RETENCION_IVA_POR_COBRAR",
      side: "DEBE",
      amount: event.montos.retencionIva,
      description,
      order: 3,
      resolutions,
    }),
    line({
      role: "CUENTAS_POR_COBRAR_CLIENTES",
      side: "HABER",
      amount: event.montos.totalDocumento,
      description,
      order: 4,
      resolutions,
    }),
  ].filter((item): item is PreviewLine => Boolean(item));
}

function linesForEvent(event: AccountingEvent, resolutions: AccountingRoleResolution[]) {
  if (isPurchaseIncrease(event.tipo) || event.tipo === "NOTA_CREDITO_COMPRA") {
    return purchaseLines(event, resolutions);
  }
  if (isSaleIncrease(event.tipo) || event.tipo === "NOTA_CREDITO_VENTA") {
    return saleLines(event, resolutions);
  }
  if (event.tipo === "PAGO_PROVEEDOR") {
    return purchasePaymentLines(event, resolutions);
  }
  if (event.tipo === "COBRO_CLIENTE") {
    return collectionLines(event, resolutions);
  }
  if (event.tipo === "RETENCION_EMITIDA") {
    return retentionIssuedLines(event, resolutions);
  }
  if (event.tipo === "RETENCION_RECIBIDA") {
    return retentionReceivedLines(event, resolutions);
  }
  return [];
}

function accountingDescription(event: AccountingEvent) {
  return generarGlosaOperacionDesdeEvento(event);
}

export class AccountingEventJournalBuilder {
  build(event: AccountingEvent, params: AccountingEventJournalBuilderParams): AccountingEventJournalBuildResult {
    if (event.estado !== "GENERABLE") {
      return {
        errors: [`El evento ${event.tipo} no es generable (${event.estado}).`],
        warnings: [],
      };
    }

    if (!isBuildableEvent(event.tipo)) {
      return {
        errors: [`El evento ${event.tipo} no genera asiento de preview en esta fase.`],
        warnings: [],
      };
    }

    const unresolved = missingRoles(event, params.resolvedRoles);
    if (unresolved.length > 0) {
      return {
        errors: unresolved.map((role) => `No se resolvió el rol ${role} para el evento ${event.tipo}.`),
        warnings: [],
      };
    }

    const roleErrors = params.resolvedRoles
      .filter((resolution) => !resolution.resolved)
      .flatMap((resolution) => resolution.motivos);
    if (roleErrors.length > 0) {
      return {
        errors: roleErrors,
        warnings: [],
      };
    }

    const lineas = linesForEvent(event, params.resolvedRoles);
    const totalDebe = add(lineas.map((item) => item.debe));
    const totalHaber = add(lineas.map((item) => item.haber));
    const descripcion = accountingDescription(event);
    const entry: PreviewEntry = {
      numero: params.numero,
      fecha: dateToIsoDate(event.fecha),
      fechaDate: event.fecha,
      glosa: descripcion,
      descripcion,
      documentoOrigen: event.documentoOrigen,
      hojaOrigen: event.hojaOrigen,
      filaOrigen: event.filaOrigen,
      reglaCodigo: params.reglaCodigo || event.reglaSugeridaCodigo || "SIN_REGLA",
      lineas,
      totalDebe,
      totalHaber,
      valido: true,
      errores: [],
      atsLoteId: params.atsLoteId,
      clasificacion: event.clasificacion,
      reglaUtilizada: params.reglaCodigo
        ? {
            codigo: params.reglaCodigo,
            descripcion: params.reglaDescripcion || params.reglaCodigo,
          }
        : undefined,
      cuentasUtilizadas: Object.fromEntries(
        params.resolvedRoles
          .filter((resolution) => resolution.resolved && resolution.cuenta)
          .map((resolution) => [resolution.role, resolution.cuenta?.codigo])
      ),
      advertencias: event.requiereRevision ? event.motivos : [],
      tipoEvento: event.tipo,
      idTemporalEvento: event.idTemporal,
      eventoRelacionadoId: event.eventoRelacionadoId,
      rolesResueltos: params.resolvedRoles,
      evidencias: event.evidencias,
    };

    return {
      entry,
      errors: [],
      warnings: [],
    };
  }
}

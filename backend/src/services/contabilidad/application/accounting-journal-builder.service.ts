import type {
  AccountingEvent,
  AccountingEventType,
  RequiredAccountRole,
} from "./accounting-event-generator.service";
import type { AccountingClassificationResult } from "./accounting-classification.service";
import type { AccountingRoleResolution } from "./accounting-role-resolver.service";
import type { JournalEntry, JournalLine } from "../domain/journal-entry";

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
    type === "RETENCION_EMITIDA" ||
    type === "RETENCION_RECIBIDA"
  );
}

function sideFor(baseSide: "DEBE" | "HABER", eventType: AccountingEventType) {
  if (!isCreditNote(eventType)) return baseSide;
  return baseSide === "DEBE" ? "HABER" : "DEBE";
}

function roleMap(resolutions: AccountingRoleResolution[]) {
  return new Map(resolutions.map((resolution) => [resolution.role, resolution]));
}

function missingRoles(event: AccountingEvent, resolutions: AccountingRoleResolution[]) {
  const map = roleMap(resolutions);
  return event.rolesRequeridos.filter((role) => !map.get(role)?.resolved);
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

  const resolution = roleMap(params.resolutions).get(params.role);
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
  const netoProveedor = add([
    event.montos.totalDocumento,
    -event.montos.retencionFuente,
    -event.montos.retencionIva,
  ]);

  return [
    line({
      role: "GASTO_COSTO_ACTIVO",
      side: sideFor("DEBE", event.tipo),
      amount: event.montos.base,
      description: `${event.tipo} base ${event.documentoOrigen}`,
      order: 1,
      resolutions,
    }),
    line({
      role: "IVA_CREDITO_TRIBUTARIO",
      side: sideFor("DEBE", event.tipo),
      amount: event.montos.iva,
      description: `${event.tipo} IVA ${event.documentoOrigen}`,
      order: 2,
      resolutions,
    }),
    line({
      role: "CUENTAS_POR_PAGAR_PROVEEDORES",
      side: sideFor("HABER", event.tipo),
      amount: netoProveedor,
      description: `${event.tipo} neto proveedor ${event.documentoOrigen}`,
      order: 3,
      resolutions,
    }),
    line({
      role: "RETENCION_FUENTE_POR_PAGAR",
      side: sideFor("HABER", event.tipo),
      amount: event.montos.retencionFuente,
      description: `${event.tipo} retencion fuente ${event.documentoOrigen}`,
      order: 4,
      resolutions,
    }),
    line({
      role: "RETENCION_IVA_POR_PAGAR",
      side: sideFor("HABER", event.tipo),
      amount: event.montos.retencionIva,
      description: `${event.tipo} retencion IVA ${event.documentoOrigen}`,
      order: 5,
      resolutions,
    }),
  ].filter((item): item is PreviewLine => Boolean(item));
}

function saleLines(event: AccountingEvent, resolutions: AccountingRoleResolution[]) {
  return [
    line({
      role: "CUENTAS_POR_COBRAR_CLIENTES",
      side: sideFor("DEBE", event.tipo),
      amount: event.montos.totalDocumento,
      description: `${event.tipo} contrapartida ${event.documentoOrigen}`,
      order: 1,
      resolutions,
    }),
    line({
      role: "INGRESO",
      side: sideFor("HABER", event.tipo),
      amount: event.montos.base,
      description: `${event.tipo} base ${event.documentoOrigen}`,
      order: 2,
      resolutions,
    }),
    line({
      role: "IVA_POR_PAGAR",
      side: sideFor("HABER", event.tipo),
      amount: event.montos.iva,
      description: `${event.tipo} IVA ${event.documentoOrigen}`,
      order: 3,
      resolutions,
    }),
  ].filter((item): item is PreviewLine => Boolean(item));
}

function retentionIssuedLines(event: AccountingEvent, resolutions: AccountingRoleResolution[]) {
  const totalRetenido = add([event.montos.retencionFuente, event.montos.retencionIva]);

  return [
    line({
      role: "CUENTAS_POR_PAGAR_PROVEEDORES",
      side: "DEBE",
      amount: totalRetenido,
      description: `${event.tipo} baja CxP ${event.documentoOrigen}`,
      order: 1,
      resolutions,
    }),
    line({
      role: "RETENCION_FUENTE_POR_PAGAR",
      side: "HABER",
      amount: event.montos.retencionFuente,
      description: `${event.tipo} fuente ${event.documentoOrigen}`,
      order: 2,
      resolutions,
    }),
    line({
      role: "RETENCION_IVA_POR_PAGAR",
      side: "HABER",
      amount: event.montos.retencionIva,
      description: `${event.tipo} IVA ${event.documentoOrigen}`,
      order: 3,
      resolutions,
    }),
  ].filter((item): item is PreviewLine => Boolean(item));
}

function retentionReceivedLines(event: AccountingEvent, resolutions: AccountingRoleResolution[]) {
  const totalRetenido = add([event.montos.retencionFuente, event.montos.retencionIva]);

  return [
    line({
      role: "RETENCION_FUENTE_POR_COBRAR",
      side: "DEBE",
      amount: event.montos.retencionFuente,
      description: `${event.tipo} fuente ${event.documentoOrigen}`,
      order: 1,
      resolutions,
    }),
    line({
      role: "RETENCION_IVA_POR_COBRAR",
      side: "DEBE",
      amount: event.montos.retencionIva,
      description: `${event.tipo} IVA ${event.documentoOrigen}`,
      order: 2,
      resolutions,
    }),
    line({
      role: "CUENTAS_POR_COBRAR_CLIENTES",
      side: "HABER",
      amount: totalRetenido,
      description: `${event.tipo} baja CxC ${event.documentoOrigen}`,
      order: 3,
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
  if (event.tipo === "RETENCION_EMITIDA") {
    return retentionIssuedLines(event, resolutions);
  }
  if (event.tipo === "RETENCION_RECIBIDA") {
    return retentionReceivedLines(event, resolutions);
  }
  return [];
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
    const entry: PreviewEntry = {
      numero: params.numero,
      fecha: dateToIsoDate(event.fecha),
      fechaDate: event.fecha,
      glosa: `${event.tipo} ${event.tercero.razonSocial}`.trim(),
      descripcion: `${event.tipo} ${event.documentoOrigen}`.trim(),
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

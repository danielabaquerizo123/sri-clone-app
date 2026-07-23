import assert from "node:assert/strict";
import { prisma } from "../src/lib/prisma";
import { classifyAccountingDocument } from "../src/services/contabilidad/02-clasificacion/clasificador.service";
import {
  AccountingEventGenerator,
  generateAccountingEvents,
  type AccountingEvent,
  type NormalizedAccountingSourceDocument,
} from "../src/services/contabilidad/04-asientos/generador-eventos.service";
import { AccountingRoleResolver, type ResolvedAccount } from "../src/services/contabilidad/03-cuentas/resolver-cuentas.service";
import { AccountingEventJournalBuilder } from "../src/services/contabilidad/04-asientos/constructor-asiento.service";
import { JournalPreviewService } from "../src/services/contabilidad/motor-contable";

const accounts = {
  gasto: { id: "cuenta-gasto", codigo: "5020228", nombre: "SUMINISTROS Y MATERIALES", activa: true, movimiento: true },
  mantenimiento: { id: "cuenta-mantenimiento", codigo: "5020208", nombre: "MANTENIMIENTO Y REPARACIONES", activa: true, movimiento: true },
  ivaCompras: { id: "cuenta-iva-compras", codigo: "1010501", nombre: "IVA CREDITO TRIBUTARIO", activa: true, movimiento: true },
  proveedor: { id: "cuenta-proveedor", codigo: "2010102", nombre: "CUENTAS POR PAGAR PROVEEDORES", activa: true, movimiento: true },
  retFuentePagar: { id: "cuenta-ret-fuente-pagar", codigo: "2010702", nombre: "RETENCIONES FUENTE POR PAGAR", activa: true, movimiento: true },
  retIvaPagar: { id: "cuenta-ret-iva-pagar", codigo: "2010703", nombre: "RETENCIONES IVA POR PAGAR", activa: true, movimiento: true },
  ventas: { id: "cuenta-ventas", codigo: "4010101", nombre: "VENTAS LOCALES", activa: true, movimiento: true },
  ivaVentas: { id: "cuenta-iva-ventas", codigo: "2010701", nombre: "IVA VENTAS", activa: true, movimiento: true },
  cliente: { id: "cuenta-cliente", codigo: "1010201", nombre: "CUENTAS POR COBRAR CLIENTES", activa: true, movimiento: true },
  retFuenteCobrar: { id: "cuenta-ret-fuente-cobrar", codigo: "1010502", nombre: "RETENCION FUENTE POR COBRAR", activa: true, movimiento: true, tipo: "ACTIVO", naturaleza: "DEUDORA" },
  retIvaCobrar: { id: "cuenta-ret-iva-cobrar", codigo: "1010504", nombre: "RETENCION IVA POR COBRAR", activa: true, movimiento: true, tipo: "ACTIVO", naturaleza: "DEUDORA" },
  caja: { id: "cuenta-caja", codigo: "1010101", nombre: "CAJA", activa: true, movimiento: true, tipo: "ACTIVO", naturaleza: "DEUDORA" },
  banco: { id: "cuenta-banco", codigo: "1010103", nombre: "INSTITUCIONES FINANCIERAS PRIVADAS", activa: true, movimiento: true, tipo: "ACTIVO", naturaleza: "DEUDORA" },
};

const classifiedPurchase = {
  categoria: "SUMINISTROS_MATERIALES",
  confianza: "ALTA" as const,
  origen: "REGLA_CONCEPTO" as const,
  requiereRevision: false,
  motivos: ["Fixture de prueba clasificado."],
  evidencias: ["TEST"],
};

const classifiedSale = {
  categoria: "VENTA_BIENES",
  confianza: "ALTA" as const,
  origen: "REGLA_GENERAL" as const,
  requiereRevision: false,
  motivos: ["Fixture de venta clasificado."],
  evidencias: ["TEST"],
};

function rule(overrides: Record<string, unknown> = {}) {
  const tipoOperacion = overrides.tipoOperacion || "COMPRA";
  const isVenta = tipoOperacion === "VENTA";
  const isCredit = overrides.tipoComprobante === "04";

  return {
    id: `rule-${tipoOperacion}-${overrides.tipoComprobante || "01"}`,
    codigo: `${tipoOperacion}_${overrides.tipoComprobante || "01"}`,
    descripcion: "Regla prueba",
    tipoOperacion,
    tipoComprobante: overrides.tipoComprobante || (isVenta ? "18" : "01"),
    codigoSustento: null,
    tarifaIva: null,
    formaPago: null,
    prioridad: 10,
    activa: true,
    cuentaBase: isVenta ? accounts.ventas : accounts.gasto,
    cuentaIva: isVenta ? accounts.ivaVentas : accounts.ivaCompras,
    cuentaContrapartida: isVenta ? accounts.cliente : accounts.proveedor,
    ladoBase: isVenta ? (isCredit ? "DEBE" : "HABER") : isCredit ? "HABER" : "DEBE",
    ladoIva: isVenta ? (isCredit ? "DEBE" : "HABER") : isCredit ? "HABER" : "DEBE",
    ladoContrapartida: isVenta ? (isCredit ? "HABER" : "DEBE") : isCredit ? "DEBE" : "HABER",
    ...overrides,
  };
}

function compra(overrides: Record<string, unknown> = {}) {
  return {
    filaExcel: 10,
    noIdentificacion: "0999999999001",
    razonSocialProveedor: "Proveedor prueba",
    tipoActividad: "",
    comprobante: "01",
    establecimiento: "001",
    puntoEmision: "001",
    numeroSecuencial: "000000001",
    fechaEmision: new Date("2026-04-10T00:00:00.000Z"),
    fechaRegistro: new Date("2026-04-10T00:00:00.000Z"),
    codigoSustento: "01",
    baseTarifa0: 0,
    baseGravableIva1: 100,
    montoIva1: 15,
    totalDocumento: 115,
    conceptoCompra: "Compra prueba",
    ...overrides,
  };
}

function venta(overrides: Record<string, unknown> = {}) {
  return {
    filaExcel: 20,
    noIdentificacion: "0999999999002",
    razonSocialCliente: "Cliente prueba",
    tipoComprobante: "18",
    codigoEstablecimiento: "001",
    noDocumento: "000000020",
    fechaEmision: new Date("2026-04-11T00:00:00.000Z"),
    baseGravableIva1: 200,
    montoIva1: 30,
    totalDocumento: 230,
    conceptoVenta: "Venta de producto terminado",
    ...overrides,
  };
}

function source(overrides: Partial<NormalizedAccountingSourceDocument> = {}): NormalizedAccountingSourceDocument {
  return {
    hojaOrigen: "COMPRAS",
    filaOrigen: 10,
    documentoOrigen: "001-001-000000001",
    fechaEmision: new Date("2026-04-10T00:00:00.000Z"),
    identificacionTercero: "0999999999001",
    razonSocialTercero: "Proveedor prueba",
    tipoOperacion: "COMPRA",
    tipoComprobante: "01",
    codigoSustento: "01",
    baseGravada: 100,
    iva: 15,
    total: 115,
    clasificacion: classifiedPurchase,
    ...overrides,
  };
}

function installPrismaMock(params: { compras?: any[]; ventas?: any[]; lastNumber?: number; rules?: any[] }) {
  const rules = params.rules || [
    rule({ tipoOperacion: "COMPRA", tipoComprobante: "01" }),
    rule({ tipoOperacion: "COMPRA", tipoComprobante: "04" }),
    rule({ tipoOperacion: "COMPRA", tipoComprobante: "05" }),
    rule({ tipoOperacion: "VENTA", tipoComprobante: "18" }),
    rule({ tipoOperacion: "VENTA", tipoComprobante: "01" }),
    rule({ tipoOperacion: "VENTA", tipoComprobante: "04" }),
    rule({ tipoOperacion: "VENTA", tipoComprobante: "05" }),
  ];
  const prismaMock = prisma as any;

  prismaMock.contribuyente = {
    findUnique: async () => ({ id: "contribuyente-1", ruc: "1250531510", razonSocial: "Daniela Baquerizo" }),
  };
  prismaMock.atsLote = {
    findFirst: async () => ({
      id: "lote-1",
      contribuyenteId: "contribuyente-1",
      anio: 2026,
      mes: "04",
      compras: params.compras || [],
      ventas: params.ventas || [],
    }),
  };
  prismaMock.periodoContable = {
    upsert: async () => ({ id: "periodo-1", anio: 2026, mes: "04", estado: "ABIERTO" }),
  };
  prismaMock.asientoContable = {
    findFirst: async () => (params.lastNumber ? { numero: params.lastNumber } : null),
  };
  prismaMock.reglaContable = {
    findMany: async (args?: any) => {
      if (!args?.where?.tipoOperacion) return rules;
      return rules.filter(
        (item) =>
          item.activa !== false &&
          item.tipoOperacion === args.where.tipoOperacion &&
          (item.tipoComprobante === args.where.OR?.[0]?.tipoComprobante || item.tipoComprobante === null)
      );
    },
  };
  prismaMock.reglaClasificacionContable = {
    findMany: async () => [
      {
        codigo: "TEST_COMPRA_MANTENIMIENTO",
        categoria: "MANTENIMIENTO_REPARACIONES",
        tipoOperacion: "COMPRA",
        prioridad: 5,
        activa: true,
        condiciones: {
          origen: "REGLA_CONCEPTO",
          confianza: "ALTA",
          palabrasClave: ["mantenimiento"],
          hojas: ["COMPRAS"],
          motivos: ["Fixture de mantenimiento clasificado desde regla configurable."],
        },
        descripcion: "Fixture de compra mantenimiento.",
      },
      {
        codigo: "TEST_COMPRA_MATERIALES",
        categoria: "SUMINISTROS_MATERIALES",
        tipoOperacion: "COMPRA",
        prioridad: 10,
        activa: true,
        condiciones: {
          origen: "REGLA_CONCEPTO",
          confianza: "ALTA",
          palabrasClave: ["compra", "materiales"],
          hojas: ["COMPRAS"],
          motivos: ["Fixture de prueba clasificado desde regla configurable."],
        },
        descripcion: "Fixture de compra clasificada.",
      },
      {
        codigo: "TEST_VENTA_LOCAL",
        categoria: "VENTA_BIENES",
        tipoOperacion: "VENTA",
        prioridad: 20,
        activa: true,
        condiciones: {
          origen: "REGLA_GENERAL",
          confianza: "ALTA",
          requiereRevision: false,
          tiposComprobante: ["18"],
          hojas: ["VENTAS"],
          motivos: ["Fixture de venta clasificada desde regla configurable."],
        },
        descripcion: "Fixture de venta clasificada.",
      },
    ],
  };
  prismaMock.configuracionCuentaContable = {
    findMany: async () => [
      { clave: "CATEGORIA:SUMINISTROS_MATERIALES", activa: true, cuenta: accounts.gasto },
      { clave: "CATEGORIA:MANTENIMIENTO_REPARACIONES", activa: true, cuenta: accounts.mantenimiento },
      { clave: "ROL:IVA_CREDITO_TRIBUTARIO", activa: true, cuenta: accounts.ivaCompras },
      { clave: "ROL:CUENTAS_POR_PAGAR_PROVEEDORES", activa: true, cuenta: accounts.proveedor },
      { clave: "ROL:RETENCION_FUENTE_POR_PAGAR", activa: true, cuenta: accounts.retFuentePagar },
      { clave: "ROL:RETENCION_IVA_POR_PAGAR", activa: true, cuenta: accounts.retIvaPagar },
      { clave: "ROL:CUENTAS_POR_COBRAR_CLIENTES", activa: true, cuenta: accounts.cliente },
      { clave: "ROL:RETENCION_FUENTE_POR_COBRAR", activa: true, cuenta: accounts.retFuenteCobrar },
      { clave: "ROL:RETENCION_IVA_POR_COBRAR", activa: true, cuenta: accounts.retIvaCobrar },
      { clave: "ROL:INGRESO_VENTAS", activa: true, cuenta: accounts.ventas },
      { clave: "ROL:IVA_POR_PAGAR", activa: true, cuenta: accounts.ivaVentas },
      { clave: "ROL:CUENTA_FINANCIERA_CAJA", activa: true, cuenta: accounts.caja },
      { clave: "ROL:CUENTA_FINANCIERA_BANCO", activa: true, cuenta: accounts.banco },
    ],
  };
}

function firstEvent(doc: NormalizedAccountingSourceDocument): AccountingEvent {
  const result = generateAccountingEvents([doc], { emitPendingPaymentEvents: false });
  assert.equal(result.errors.length, 0);
  return result.eventos[0];
}

function testResolver() {
  return new AccountingRoleResolver({
    configuraciones: [
      { clave: "CATEGORIA:SUMINISTROS_MATERIALES", activa: true, cuenta: accounts.gasto },
      { clave: "ROL:IVA_CREDITO_TRIBUTARIO", activa: true, cuenta: accounts.ivaCompras },
      { clave: "ROL:CUENTAS_POR_PAGAR_PROVEEDORES", activa: true, cuenta: accounts.proveedor },
      { clave: "ROL:RETENCION_FUENTE_POR_PAGAR", activa: true, cuenta: accounts.retFuentePagar },
      { clave: "ROL:RETENCION_IVA_POR_PAGAR", activa: true, cuenta: accounts.retIvaPagar },
    ],
  });
}

async function main() {
{
  const event = firstEvent(source());
  const roles = testResolver().resolveMany({ event, reglaContable: rule() });
  const entry = new AccountingEventJournalBuilder().build(event, {
    numero: 1,
    reglaCodigo: "COMPRA_01",
    reglaDescripcion: "Compra",
    resolvedRoles: roles,
  }).entry;

  assert.ok(entry);
  assert.equal(entry.tipoEvento, "DEVENGO_COMPRA");
  assert.equal(entry.lineas.length, 3);
  assert.equal(entry.totalDebe, 115);
  assert.equal(entry.totalHaber, 115);
}

{
  const event = firstEvent(source({ iva: 0, total: 100 }));
  const roles = testResolver().resolveMany({ event, reglaContable: rule() });
  const entry = new AccountingEventJournalBuilder().build(event, {
    numero: 1,
    reglaCodigo: "COMPRA_01",
    resolvedRoles: roles,
  }).entry;

  assert.ok(entry);
  assert.equal(entry.lineas.some((line) => line.codigo === accounts.ivaCompras.codigo), false);
}

{
  const event = firstEvent(source({
    hojaOrigen: "VENTAS",
    tipoOperacion: "VENTA",
    tipoComprobante: "18",
    baseGravada: 200,
    iva: 30,
    total: 230,
    clasificacion: classifiedSale,
  }));
  const roles = new AccountingRoleResolver().resolveMany({ event, reglaContable: rule({ tipoOperacion: "VENTA", tipoComprobante: "18" }) });
  const entry = new AccountingEventJournalBuilder().build(event, {
    numero: 1,
    reglaCodigo: "VENTA_18",
    resolvedRoles: roles,
  }).entry;

  assert.ok(entry);
  assert.equal(entry.tipoEvento, "DEVENGO_VENTA");
  assert.equal(entry.lineas[0].debe, 230);
  assert.equal(entry.lineas[1].haber, 200);
  assert.equal(entry.lineas[2].haber, 30);
}

{
  const event = {
    ...firstEvent(source({
      hojaOrigen: "VENTAS",
      tipoOperacion: "VENTA",
      tipoComprobante: "18",
      baseGravada: 200,
      iva: 30,
      total: 230,
      clasificacion: classifiedSale,
    })),
    rolesRequeridos: ["CUENTAS_POR_COBRAR_CLIENTES", "INGRESO", "IVA_POR_PAGAR"] as AccountingEvent["rolesRequeridos"],
  };
  const roles = new AccountingRoleResolver({
    configuraciones: [
      { clave: "ROL:CUENTAS_POR_COBRAR_CLIENTES", activa: true, cuenta: accounts.cliente },
      { clave: "ROL:INGRESO_VENTAS", activa: true, cuenta: accounts.ventas },
      { clave: "ROL:IVA_POR_PAGAR", activa: true, cuenta: accounts.ivaVentas },
    ],
  }).resolveMany({ event, reglaContable: null });
  const entry = new AccountingEventJournalBuilder().build(event, {
    numero: 1,
    resolvedRoles: roles,
  }).entry;

  assert.ok(roles.some((role) => role.role === "INGRESO" && role.origen === "CONFIGURACION_CUENTA"));
  assert.ok(entry);
  assert.ok(entry.lineas.some((line) => line.codigo === accounts.ventas.codigo && line.haber === 200));
  assert.equal(entry.totalDebe, entry.totalHaber);
}

{
  const event = firstEvent(source({ tipoComprobante: "04", baseGravada: -100, iva: -15, total: -115 }));
  const roles = testResolver().resolveMany({ event, reglaContable: rule({ tipoComprobante: "04" }) });
  const entry = new AccountingEventJournalBuilder().build(event, {
    numero: 1,
    reglaCodigo: "NC_COMPRA",
    resolvedRoles: roles,
  }).entry;

  assert.ok(entry);
  assert.equal(entry.tipoEvento, "NOTA_CREDITO_COMPRA");
  assert.equal(entry.lineas[0].haber, 100);
  assert.equal(entry.lineas[1].haber, 15);
  assert.equal(entry.lineas[2].debe, 115);
}

{
  const event = firstEvent(source({
    hojaOrigen: "VENTAS",
    tipoOperacion: "VENTA",
    tipoComprobante: "04",
    baseGravada: -200,
    iva: -30,
    total: -230,
    clasificacion: classifiedSale,
  }));
  const roles = new AccountingRoleResolver().resolveMany({ event, reglaContable: rule({ tipoOperacion: "VENTA", tipoComprobante: "04" }) });
  const entry = new AccountingEventJournalBuilder().build(event, {
    numero: 1,
    reglaCodigo: "NC_VENTA",
    resolvedRoles: roles,
  }).entry;

  assert.ok(entry);
  assert.equal(entry.tipoEvento, "NOTA_CREDITO_VENTA");
  assert.equal(entry.lineas[0].haber, 230);
  assert.equal(entry.lineas[1].debe, 200);
  assert.equal(entry.lineas[2].debe, 30);
}

{
  const ndCompra = firstEvent(source({ tipoComprobante: "05", total: 115 }));
  const ndVenta = firstEvent(source({
    hojaOrigen: "VENTAS",
    tipoOperacion: "VENTA",
    tipoComprobante: "05",
    baseGravada: 200,
    iva: 30,
    total: 230,
    clasificacion: classifiedSale,
  }));
  assert.equal(ndCompra.tipo, "NOTA_DEBITO_COMPRA");
  assert.equal(ndVenta.tipo, "NOTA_DEBITO_VENTA");
}

{
  const inactive = { ...accounts.gasto, activa: false };
  const event = firstEvent(source());
  const resolution = new AccountingRoleResolver({
    configuraciones: [{ clave: "CATEGORIA:SUMINISTROS_MATERIALES", activa: true, cuenta: inactive }],
  }).resolve({ event, role: "GASTO_COSTO_ACTIVO", reglaContable: rule({ cuentaBase: inactive }) });
  assert.equal(resolution.resolved, false);
  assert.ok(resolution.motivos.some((item) => item.includes("inactiva")));
}

{
  const grouped = { ...accounts.gasto, movimiento: false };
  const event = firstEvent(source());
  const resolution = new AccountingRoleResolver({
    configuraciones: [{ clave: "CATEGORIA:SUMINISTROS_MATERIALES", activa: true, cuenta: grouped }],
  }).resolve({ event, role: "GASTO_COSTO_ACTIVO", reglaContable: rule({ cuentaBase: grouped }) });
  assert.equal(resolution.resolved, false);
  assert.ok(resolution.motivos.some((item) => item.includes("agrupadora")));
}

{
  const result = generateAccountingEvents([
    source({
      datosRetencion: {
        retencionesFuente: [{ codigo: "332", base: 100, porcentaje: 1, valor: 1 }],
        retencionesIva: [{ porcentaje: 30, valor: 4.5 }],
        totalRetenidoFuente: 1,
        totalRetenidoIva: 4.5,
      },
    }),
  ]);
  assert.equal(result.eventos.some((event) => event.tipo === "RETENCION_EMITIDA"), false);
  const devengo = result.eventos.find((event) => event.tipo === "DEVENGO_COMPRA");
  assert.ok(devengo);
  assert.equal(devengo.montos.retencionFuente, 1);
  assert.equal(devengo.montos.retencionIva, 4.5);
  assert.equal(devengo.rolesRequeridos.includes("RETENCION_FUENTE_POR_PAGAR"), false);
  assert.equal(devengo.rolesRequeridos.includes("RETENCION_IVA_POR_PAGAR"), false);
  const pago = result.eventos.find((event) => event.tipo === "PAGO_PROVEEDOR");
  assert.ok(pago);
  assert.ok(pago.rolesRequeridos.includes("RETENCION_FUENTE_POR_PAGAR"));
  assert.ok(pago.rolesRequeridos.includes("RETENCION_IVA_POR_PAGAR"));
}

{
  const result = generateAccountingEvents([
    source({
      fechaRegistro: new Date("2026-04-10T00:00:00.000Z"),
      paymentEvidence: { formaPago1: "20-OTROS CON UTILIZACION DEL SISTEMA FINANCIERO" },
    }),
  ]);
  assert.equal(result.eventos.some((event) => event.tipo === "PAGO_PROVEEDOR"), true);
  assert.equal(result.eventos.some((event) => event.tipo === "PAGO_PROVEEDOR" && event.estado === "GENERABLE"), true);
}

{
  const event = generateAccountingEvents([
    source({
      datosRetencion: {
        retencionesFuente: [{ codigo: "332", base: 100, porcentaje: 1, valor: 1 }],
        retencionesIva: [],
        totalRetenidoFuente: 1,
        totalRetenidoIva: 0,
      },
    }),
  ]).eventos.find((item) => item.tipo === "DEVENGO_COMPRA");
  assert.ok(event);
  const roles = new AccountingRoleResolver().resolveMany({ event, reglaContable: rule() });
  assert.equal(roles.some((item) => item.role === "RETENCION_FUENTE_POR_PAGAR" && item.resolved), false);
  assert.equal(roles.some((item) => item.cuenta?.nombre?.includes("ADMINISTRACION TRIBUTARIA")), false);
}

{
  installPrismaMock({ compras: [compra({ formaPago1: "20" })] });
  const preview = await new JournalPreviewService().buildFromAtsLote("1250531510", "lote-1");
  assert.equal(preview.asientos.length, 2);
  assert.equal(preview.asientos[0].tipoEvento, "DEVENGO_COMPRA");
  assert.equal(preview.asientos[1].tipoEvento, "PAGO_PROVEEDOR");
  assert.equal(preview.eventosPendientes.some((event) => event.tipoEvento === "PAGO_PROVEEDOR"), false);
  assert.equal(preview.persistible, true);
}

{
  installPrismaMock({
    compras: [
      compra({
        establecimientoRet: "001",
        puntoEmisionRet: "002",
        numeroSecuencialRet: "000000777",
        fechaEmisionRet1: new Date("2026-04-12T00:00:00.000Z"),
        codigoRetencion1: "332",
        baseImponibleRet1: 100,
        porcentajeRetencion1: 1,
        valorRetenido1: 1,
        formaPago1: "20",
      }),
    ],
  });
  const preview = await new JournalPreviewService().buildFromAtsLote("1250531510", "lote-1");
  assert.equal(preview.asientos.length, 2);
  assert.equal(preview.eventos.some((event) => event.tipo === "RETENCION_EMITIDA"), false);
  assert.equal(preview.asientos[1].tipoEvento, "PAGO_PROVEEDOR");
  assert.equal(preview.asientos[1].lineas.some((linea) => linea.codigo === accounts.retFuentePagar.codigo), true);
  assert.equal(preview.persistible, true);
}

{
  installPrismaMock({
    ventas: [
      venta({
        valorRetenidoFuente: 2,
        noDocumentoRetencion: "000000111",
        fechaRetencion: new Date("2026-04-12T00:00:00.000Z"),
        formaCobro1: "20",
      }),
    ],
  });
  const preview = await new JournalPreviewService().buildFromAtsLote("1250531510", "lote-1");
  assert.equal(preview.asientos.length, 2);
  assert.equal(preview.eventos.some((event) => event.tipo === "RETENCION_RECIBIDA"), false);
  assert.equal(preview.asientos[1].tipoEvento, "COBRO_CLIENTE");
  assert.equal(preview.asientos[1].lineas.some((linea) => linea.codigo === accounts.retFuenteCobrar.codigo), true);
  assert.equal(preview.persistible, true);
}

{
  installPrismaMock({
    compras: [
      compra({ filaExcel: 1, numeroSecuencial: "000000001" }),
      compra({ filaExcel: 2, numeroSecuencial: "000000002" }),
    ],
    lastNumber: 24,
  });
  const preview = await new JournalPreviewService().buildFromAtsLote("1250531510", "lote-1");
  assert.deepEqual(preview.asientos.map((entry) => entry.numero), [25, 26]);
}

{
  installPrismaMock({
    compras: [
      compra({
        noIdentificacion: "0921638813001",
        razonSocialProveedor: "LITUMA RAMIREZ RUTH ELSA",
        tipoActividad: "FERRETERIA",
        codigoSustento: "",
        conceptoCompra: "",
      }),
    ],
  });
  const preview = await new JournalPreviewService().buildFromAtsLote("1250531510", "lote-1");
  assert.equal(preview.asientos.length, 0);
  assert.equal(preview.persistible, false);
  assert.equal(preview.pendientesClasificacion[0].categoria, "REGLA_PRUEBA");
}

{
  installPrismaMock({
    compras: [
      compra({
        noIdentificacion: "0921638813001",
        razonSocialProveedor: "LITUMA RAMIREZ RUTH ELSA",
        tipoActividad: "FERRETERIA",
        conceptoCompra: "Compra de materiales para mantenimiento",
      }),
    ],
  });
  const preview = await new JournalPreviewService().buildFromAtsLote("1250531510", "lote-1");
  assert.equal(preview.asientos.length, 1);
  assert.equal(preview.asientos[0].clasificacion?.categoria, "MANTENIMIENTO_REPARACIONES");
}

{
  installPrismaMock({
    compras: [compra({ razonSocialProveedor: "UPS SCS", baseGravableIva1: 0, baseTarifa0: 63.96, montoIva1: 0, totalDocumento: 63.96 })],
  });
  const preview = await new JournalPreviewService().buildFromAtsLote("1250531510", "lote-1");
  assert.equal(preview.asientos[0].lineas.some((line) => line.codigo === accounts.ivaCompras.codigo), false);
}

console.log("accounting-event preview integration tests passed");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

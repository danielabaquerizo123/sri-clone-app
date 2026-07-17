import assert from "node:assert/strict";
import {
  classifyAccountingDocument,
  type AccountingClassificationResult,
} from "../src/services/contabilidad/application/accounting-classification.service";
import {
  generateAccountingEvents,
  type NormalizedAccountingSourceDocument,
} from "../src/services/contabilidad/application/accounting-event-generator.service";
import { AccountingEventJournalBuilder } from "../src/services/contabilidad/application/accounting-journal-builder.service";
import { AccountingRoleResolver } from "../src/services/contabilidad/application/accounting-role-resolver.service";
import {
  shouldHoldForClassification,
  validatePreviewEntryForTest,
  type PreviewEntry,
} from "../src/services/contabilidad/journal-preview.service";

const accounts = {
  gasto: { id: "cuenta-gasto", codigo: "5.02.02.08", nombre: "Mantenimiento", activa: true, movimiento: true },
  ivaCompras: { id: "cuenta-iva-compras", codigo: "1.01.05.01", nombre: "IVA compras", activa: true, movimiento: true },
  proveedor: { id: "cuenta-proveedor", codigo: "2.01.01.01", nombre: "Proveedores", activa: true, movimiento: true },
  ventas: { id: "cuenta-ventas", codigo: "4.01.01.01", nombre: "Ventas locales", activa: true, movimiento: true },
  ivaVentas: { id: "cuenta-iva-ventas", codigo: "2.01.07.01", nombre: "IVA ventas", activa: true, movimiento: true },
  cliente: { id: "cuenta-cliente", codigo: "1.01.02.01", nombre: "Clientes", activa: true, movimiento: true },
};

function classification(overrides: Partial<AccountingClassificationResult> = {}): AccountingClassificationResult {
  return {
    categoria: "MANTENIMIENTO_REPARACIONES",
    confianza: "ALTA",
    origen: "REGLA_CONCEPTO",
    requiereRevision: false,
    motivos: ["Clasificacion de prueba."],
    evidencias: ["concepto"],
    ...overrides,
  };
}

function rule(tipoOperacion: "COMPRA" | "VENTA", tipoComprobante = tipoOperacion === "VENTA" ? "18" : "01") {
  const isVenta = tipoOperacion === "VENTA";
  return {
    codigo: `${tipoOperacion}_${tipoComprobante}`,
    descripcion: "Regla numerica",
    tipoOperacion,
    tipoComprobante,
    cuentaBase: isVenta ? accounts.ventas : accounts.gasto,
    cuentaIva: isVenta ? accounts.ivaVentas : accounts.ivaCompras,
    cuentaContrapartida: isVenta ? accounts.cliente : accounts.proveedor,
  };
}

function document(overrides: Partial<NormalizedAccountingSourceDocument> = {}): NormalizedAccountingSourceDocument {
  return {
    hojaOrigen: "COMPRAS",
    filaOrigen: 1,
    documentoOrigen: "001-001-000000001",
    fechaEmision: new Date("2026-04-01T00:00:00.000Z"),
    identificacionTercero: "0999999999001",
    razonSocialTercero: "Tercero prueba",
    tipoOperacion: "COMPRA",
    tipoComprobante: "01",
    codigoSustento: "01",
    baseGravada: 100,
    iva: 15,
    total: 115,
    clasificacion: classification(),
    concepto: "Mantenimiento",
    ...overrides,
  };
}

function buildEntry(doc: NormalizedAccountingSourceDocument, ruleLike = rule(doc.tipoOperacion === "VENTA" ? "VENTA" : "COMPRA", doc.tipoComprobante || "01")) {
  const event = generateAccountingEvents([doc], { emitPendingPaymentEvents: false }).eventos[0];
  const roles = new AccountingRoleResolver().resolveMany({ event, reglaContable: ruleLike });
  const result = new AccountingEventJournalBuilder().build(event, {
    numero: 1,
    reglaCodigo: ruleLike.codigo,
    reglaDescripcion: ruleLike.descripcion,
    resolvedRoles: roles,
  });
  assert.deepEqual(result.errors, []);
  assert.ok(result.entry);
  return result.entry;
}

{
  const entry = buildEntry(document({ baseGravada: 100, iva: 15, total: 115 }));
  assert.equal(entry.lineas.find((line) => line.codigo === accounts.gasto.codigo)?.debe, 100);
  assert.equal(entry.lineas.find((line) => line.codigo === accounts.ivaCompras.codigo)?.debe, 15);
  assert.equal(entry.lineas.find((line) => line.codigo === accounts.proveedor.codigo)?.haber, 115);
  assert.equal(entry.totalDebe, 115);
  assert.equal(entry.totalHaber, 115);
}

{
  const entry = buildEntry(document({ baseGravada: 0, baseTarifa0: 63.96, iva: 0, total: 63.96 }));
  assert.equal(entry.lineas.find((line) => line.codigo === accounts.gasto.codigo)?.debe, 63.96);
  assert.equal(entry.lineas.some((line) => line.codigo === accounts.ivaCompras.codigo), false);
  assert.equal(entry.lineas.find((line) => line.codigo === accounts.proveedor.codigo)?.haber, 63.96);
}

{
  const entry = buildEntry(
    document({
      hojaOrigen: "VENTAS",
      tipoOperacion: "VENTA",
      tipoComprobante: "18",
      baseGravada: 200,
      iva: 30,
      total: 230,
      clasificacion: classification({ categoria: "VENTA_BIENES" }),
    }),
    rule("VENTA", "18")
  );
  assert.equal(entry.lineas.find((line) => line.codigo === accounts.cliente.codigo)?.debe, 230);
  assert.equal(entry.lineas.find((line) => line.codigo === accounts.ventas.codigo)?.haber, 200);
  assert.equal(entry.lineas.find((line) => line.codigo === accounts.ivaVentas.codigo)?.haber, 30);
}

{
  const entry = buildEntry(document({ tipoComprobante: "04", baseGravada: -100, iva: -15, total: -115 }), rule("COMPRA", "04"));
  assert.equal(entry.tipoEvento, "NOTA_CREDITO_COMPRA");
  assert.equal(entry.lineas.find((line) => line.codigo === accounts.gasto.codigo)?.haber, 100);
  assert.equal(entry.lineas.find((line) => line.codigo === accounts.ivaCompras.codigo)?.haber, 15);
  assert.equal(entry.lineas.find((line) => line.codigo === accounts.proveedor.codigo)?.debe, 115);
  assert.equal(entry.totalDebe, entry.totalHaber);
}

{
  const result = generateAccountingEvents([
    document({
      datosRetencion: {
        retencionesFuente: [{ codigo: "332", base: 100, porcentaje: 1, valor: 1 }],
        retencionesIva: [{ porcentaje: 30, valor: 4.5 }],
        totalRetenidoFuente: 1,
        totalRetenidoIva: 4.5,
      },
      formaPago: "20",
    }),
  ]);
  const retencion = result.eventos.find((event) => event.tipo === "RETENCION_EMITIDA");
  assert.ok(retencion);
  assert.equal(retencion.montos.retencionFuente, 1);
  assert.equal(retencion.montos.retencionIva, 4.5);
  assert.equal(result.eventos.filter((event) => event.tipo === "RETENCION_EMITIDA").length, 1);
  assert.equal(result.eventos.some((event) => event.tipo === "PAGO_PROVEEDOR" && event.estado === "GENERABLE"), false);
}

{
  const pending = classifyAccountingDocument({
    hojaOrigen: "COMPRAS",
    tipoComprobante: "01",
    concepto: "",
    codigoSustento: "",
  });
  assert.equal(shouldHoldForClassification(pending), true);
}

{
  const first = classifyAccountingDocument({
    hojaOrigen: "COMPRAS",
    rucTercero: "0101010101001",
    tipoComprobante: "01",
    concepto: "Mantenimiento de equipos",
  });
  const second = classifyAccountingDocument({
    hojaOrigen: "COMPRAS",
    rucTercero: "0202020202001",
    tipoComprobante: "01",
    concepto: "Mantenimiento de equipos",
  });
  assert.equal(first.categoria, second.categoria);
  assert.equal(first.origen, "REGLA_CONCEPTO");
}

{
  const bad: PreviewEntry = {
    ...buildEntry(document()),
    totalDebe: 115,
    totalHaber: 114.98,
  };
  const errors = validatePreviewEntryForTest(bad);
  assert.ok(errors.some((message) => message.includes("Debe y Haber")));
}

console.log("accounting-application-numeric.test.ts OK");

import assert from "node:assert/strict";
import { classifyAccountingDocument } from "../src/services/contabilidad/application/accounting-classification.service";
import {
  AccountingEventGenerator,
  adaptCompraToAccountingSource,
  adaptVentaToAccountingSource,
  calculatePendingBalance,
  generateAccountingEvents,
  sumRetencionesFuente,
  sumRetencionesIva,
  type NormalizedAccountingSourceDocument,
} from "../src/services/contabilidad/application/accounting-event-generator.service";

const alta = {
  categoria: "SUMINISTROS_MATERIALES",
  confianza: "ALTA" as const,
  origen: "REGLA_CONCEPTO" as const,
  requiereRevision: false,
  motivos: ["Fixture de prueba clasificado."],
  evidencias: ["TEST"],
};

const ventaBienes = classifyAccountingDocument({
  hojaOrigen: "VENTAS",
  tipoComprobante: "18",
  concepto: "Venta de producto terminado",
});

function compra(overrides: Partial<NormalizedAccountingSourceDocument> = {}): NormalizedAccountingSourceDocument {
  return {
    hojaOrigen: "COMPRAS",
    filaOrigen: 10,
    documentoOrigen: "001-001-000000001",
    fechaEmision: new Date("2026-04-10T00:00:00.000Z"),
    identificacionTercero: "0999999999001",
    razonSocialTercero: "Proveedor de prueba",
    tipoOperacion: "COMPRA",
    tipoComprobante: "01",
    codigoSustento: "01",
    baseTarifa0: 0,
    baseGravada: 100,
    iva: 15,
    total: 115,
    clasificacion: alta,
    ...overrides,
  };
}

function venta(overrides: Partial<NormalizedAccountingSourceDocument> = {}): NormalizedAccountingSourceDocument {
  return {
    hojaOrigen: "VENTAS",
    filaOrigen: 20,
    documentoOrigen: "001-000000123",
    fechaEmision: new Date("2026-04-11T00:00:00.000Z"),
    identificacionTercero: "0999999999002",
    razonSocialTercero: "Cliente de prueba",
    tipoOperacion: "VENTA",
    tipoComprobante: "18",
    baseGravada: 200,
    iva: 30,
    total: 230,
    clasificacion: ventaBienes,
    ...overrides,
  };
}

{
  const result = generateAccountingEvents([compra()]);

  assert.equal(result.errors.length, 0);
  assert.deepEqual(result.eventos.map((event) => event.tipo), ["DEVENGO_COMPRA", "PAGO_PROVEEDOR"]);
  assert.equal(result.eventos[1].estado, "PENDIENTE_EVIDENCIA");
  assert.ok(result.eventos[1].rolesRequeridos.includes("CUENTA_FINANCIERA"));
}

{
  const result = generateAccountingEvents([
    compra({
      datosRetencion: {
        fechaEmision: new Date("2026-04-12T00:00:00.000Z"),
        establecimiento: "001",
        puntoEmision: "002",
        secuencial: "000000888",
        autorizacion: "1234567890",
        retencionesFuente: [{ codigo: "332", base: 100, porcentaje: 1, valor: 1 }],
        retencionesIva: [],
        totalRetenidoFuente: 1,
        totalRetenidoIva: 0,
      },
    }),
  ]);

  const devengo = result.eventos.find((event) => event.tipo === "DEVENGO_COMPRA");
  assert.ok(devengo);
  assert.equal(result.eventos.some((event) => event.tipo === "RETENCION_EMITIDA"), false);
  assert.equal(devengo.montos.retencionFuente, 1);
  assert.ok(devengo.rolesRequeridos.includes("RETENCION_FUENTE_POR_PAGAR"));
  assert.equal(result.eventos.some((event) => event.tipo === "PAGO_PROVEEDOR" && event.estado === "GENERABLE"), false);
}

{
  const result = generateAccountingEvents([
    compra({
      datosRetencion: {
        retencionesFuente: [],
        retencionesIva: [{ porcentaje: 30, valor: 4.5 }],
        totalRetenidoFuente: 0,
        totalRetenidoIva: 4.5,
      },
    }),
  ]);

  const devengo = result.eventos.find((event) => event.tipo === "DEVENGO_COMPRA");
  assert.ok(devengo);
  assert.equal(result.eventos.some((event) => event.tipo === "RETENCION_EMITIDA"), false);
  assert.equal(devengo.montos.retencionIva, 4.5);
  assert.ok(devengo.rolesRequeridos.includes("RETENCION_IVA_POR_PAGAR"));
}

{
  const result = generateAccountingEvents([
    compra({
      datosRetencion: {
        retencionesFuente: [{ codigo: "312", base: 100, porcentaje: 1.75, valor: 1.75 }],
        retencionesIva: [{ porcentaje: 70, valor: 10.5 }],
        totalRetenidoFuente: 1.75,
        totalRetenidoIva: 10.5,
      },
    }),
  ]);

  const devengo = result.eventos.find((event) => event.tipo === "DEVENGO_COMPRA");
  assert.ok(devengo);
  assert.equal(result.eventos.some((event) => event.tipo === "RETENCION_EMITIDA"), false);
  assert.equal(devengo.montos.retencionFuente, 1.75);
  assert.equal(devengo.montos.retencionIva, 10.5);
  assert.equal(devengo.montos.saldoPendiente, 102.75);
  assert.ok(devengo.rolesRequeridos.includes("RETENCION_FUENTE_POR_PAGAR"));
  assert.ok(devengo.rolesRequeridos.includes("RETENCION_IVA_POR_PAGAR"));
}

{
  const result = generateAccountingEvents([
    compra({
      total: 50,
      datosRetencion: {
        retencionesFuente: [{ codigo: "332", base: 50, porcentaje: 100, valor: 60 }],
        retencionesIva: [],
        totalRetenidoFuente: 60,
        totalRetenidoIva: 0,
      },
    }),
  ]);

  assert.equal(result.errors.length, 1);
  assert.equal(result.errors[0].codigo, "RETENCIONES_SUPERAN_TOTAL");
  assert.equal(result.eventos.length, 0);
}

{
  const result = generateAccountingEvents([
    venta({
      datosRetencion: {
        fechaEmision: new Date("2026-04-13T00:00:00.000Z"),
        secuencial: "000000222",
        autorizacion: "998877",
        retencionesFuente: [{ codigo: "332", base: 200, porcentaje: 1, valor: 2 }],
        retencionesIva: [{ porcentaje: 30, valor: 9 }],
        totalRetenidoFuente: 2,
        totalRetenidoIva: 9,
      },
    }),
  ]);

  const retention = result.eventos.find((event) => event.tipo === "RETENCION_RECIBIDA");
  assert.ok(retention);
  assert.equal(retention.eventoRelacionadoId, result.eventos[0].idTemporal);
  assert.deepEqual(retention.rolesRequeridos, [
    "CUENTAS_POR_COBRAR_CLIENTES",
    "RETENCION_FUENTE_POR_COBRAR",
    "RETENCION_IVA_POR_COBRAR",
  ]);
}

{
  const result = generateAccountingEvents([
    compra({
      tipoComprobante: "04",
      baseGravada: -100,
      iva: -15,
      total: -115,
    }),
  ]);

  assert.equal(result.eventos[0].tipo, "NOTA_CREDITO_COMPRA");
  assert.equal(result.eventos[0].montos.totalDocumento, -115);
  assert.equal(result.eventos.some((event) => event.tipo === "PAGO_PROVEEDOR"), false);
}

{
  const result = generateAccountingEvents([
    venta({
      tipoComprobante: "04",
      baseGravada: -200,
      iva: -30,
      total: -230,
    }),
  ]);

  assert.equal(result.eventos[0].tipo, "NOTA_CREDITO_VENTA");
  assert.equal(result.eventos[0].montos.totalDocumento, -230);
  assert.equal(result.eventos.some((event) => event.tipo === "COBRO_CLIENTE"), false);
}

{
  const result = generateAccountingEvents([
    compra({
      razonSocialTercero: "UPS SCS ECUADOR CIA LTDA",
      baseTarifa0: 63.96,
      baseGravada: 0,
      iva: 0,
      total: 63.96,
    }),
  ]);

  assert.equal(result.eventos[0].tipo, "DEVENGO_COMPRA");
  assert.equal(result.eventos[0].montos.iva, 0);
  assert.equal(result.eventos[0].rolesRequeridos.includes("IVA_CREDITO_TRIBUTARIO"), false);
}

{
  const litumaClassification = classifyAccountingDocument({
    hojaOrigen: "COMPRAS",
    rucTercero: "0921638813001",
    razonSocial: "LITUMA RAMIREZ RUTH ELSA",
    actividadEconomica: "FERRETERIA",
    tipoComprobante: "01",
    concepto: "",
  });
  const result = generateAccountingEvents([
    compra({
      identificacionTercero: "0921638813001",
      razonSocialTercero: "LITUMA RAMIREZ RUTH ELSA",
      actividadEconomica: "FERRETERIA",
      clasificacion: litumaClassification,
    }),
  ]);

  assert.equal(result.eventos[0].estado, "PENDIENTE_CLASIFICACION");
  assert.equal(result.eventos[0].clasificacion.categoria, "SIN_CLASIFICACION");
  assert.equal(result.eventos.some((event) => event.tipo === "PAGO_PROVEEDOR" && event.estado === "GENERABLE"), false);
  assert.equal(result.eventos[0].clasificacion.motivos.some((item) => item.includes("concepto")), true);
}

{
  const result = generateAccountingEvents([compra({ paymentEvidence: { formaPago1: "20" } })]);

  assert.equal(result.eventos.some((event) => event.tipo === "PAGO_PROVEEDOR" && event.estado === "GENERABLE"), false);
  assert.equal(result.warnings[0].codigo, "FORMA_PAGO_NO_PRUEBA_PAGO");
  assert.equal(result.eventos[1].evidencias[0].campo, "formaPago1");
}

{
  const adapted = adaptCompraToAccountingSource(
    {
      filaExcel: 15,
      noIdentificacion: "0999999999001",
      razonSocialProveedor: "Proveedor Retencion",
      comprobante: "01",
      establecimiento: "001",
      puntoEmision: "001",
      numeroSecuencial: "000000015",
      fechaEmision: "2026-04-14",
      baseGravadaIva1: 0,
      baseGravableIva1: 100,
      montoIva1: 15,
      totalDocumento: 115,
      establecimientoRet: "002",
      puntoEmisionRet: "003",
      numeroSecuencialRet: "000000009",
      numeroAutorizacionSriRet: "RET123",
      fechaEmisionRet1: "2026-04-15",
      codigoRetencion1: "332",
      baseImponibleRet1: 100,
      porcentajeRetencion1: 1,
      valorRetenido1: 1,
      valorRetencionIva10: 1.5,
      valorRetencionIva20: 3,
      valorRetencionIva30: 4.5,
    },
    alta
  );

  assert.equal(adapted.datosRetencion?.fechaEmision?.toISOString().slice(0, 10), "2026-04-15");
  assert.equal(adapted.datosRetencion?.retencionesIva.some((item) => item.porcentaje === 10), true);
  assert.equal(adapted.datosRetencion?.retencionesIva.some((item) => item.porcentaje === 20), true);
  assert.equal(sumRetencionesIva(adapted.datosRetencion?.retencionesIva || []), 9);
}

{
  const adapted = adaptVentaToAccountingSource(
    {
      filaExcel: 16,
      noIdentificacion: "0999999999002",
      razonSocialCliente: "Cliente Retencion",
      tipoComprobante: "18",
      codigoEstablecimiento: "001",
      noDocumento: "000000016",
      fechaEmision: "2026-04-14",
      baseGravableIva1: 200,
      montoIva1: 30,
      totalDocumento: 230,
      noDocumentoRetencion: "000000777",
      fechaRetencion: "2026-04-16",
      noAutorizacionRetencion: "AUTVENTA",
      retFuenteCodigoRetencion1: "332",
      retFuenteBaseImponible1: 200,
      retFuentePorcentaje1: 1,
      retFuenteValorRetenido1: 2,
    },
    ventaBienes
  );

  assert.equal(adapted.datosRetencion?.retencionesFuente[0].codigo, "332");
  assert.equal(adapted.datosRetencion?.retencionesFuente[0].base, 200);
  assert.equal(adapted.datosRetencion?.retencionesFuente[0].porcentaje, 1);
  assert.equal(sumRetencionesFuente(adapted.datosRetencion?.retencionesFuente || []), 2);
}

{
  assert.equal(calculatePendingBalance(115, 1, 4.5), 109.5);
}

{
  const result = new AccountingEventGenerator({ emitPendingPaymentEvents: false }).generate([compra()]);

  assert.deepEqual(result.eventos.map((event) => event.tipo), ["DEVENGO_COMPRA"]);
}

console.log("accounting-event-generator tests passed");

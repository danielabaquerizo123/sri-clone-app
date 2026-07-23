import assert from "node:assert/strict";
import { adaptCompra } from "../src/services/contabilidad/01-lectura/compra.adapter";
import { adaptGasto } from "../src/services/contabilidad/01-lectura/gasto.adapter";
import { adaptVenta } from "../src/services/contabilidad/01-lectura/venta.adapter";
import { SIN_CLASIFICACION } from "../src/services/contabilidad/contratos";

{
  const compra = adaptCompra({
    filaExcel: 8,
    establecimiento: "001",
    puntoEmision: "002",
    numeroSecuencial: "000000123",
    fechaEmision: "2026-04-10",
    fechaRegistro: "2026-04-11",
    noIdentificacion: "0999999999001",
    razonSocialProveedor: "Proveedor de Materiales",
    comprobante: "01",
    codigoSustento: "01",
    baseNoObjetoIva: "2.50",
    baseExenta: 0,
    baseTarifa0: "10",
    baseGravableIva1: "100",
    baseGravableIva2: "50",
    montoIva1: "15",
    montoIva2: "7.5",
    totalDocumento: "185",
    tipoPago: "01-PAGO A RESIDENTE",
    formaPago1: "20",
    formaPago2: "01",
    fechaEmisionRet1: "2026-04-12",
    establecimientoRet: "001",
    puntoEmisionRet: "003",
    numeroSecuencialRet: "000000010",
    numeroAutorizacionSriRet: "AUT-RET",
    codigoRetencionFuente1: "332",
    baseImponibleRetencionFuente1: "150",
    porcentajeRetencionFuente1: "1.75",
    valorRetenidoFuente1: "2.63",
    valorRetenidoIva10: "1",
    valorRetenidoIva20: "2",
    tipoActividad: "FERRETERIA",
    conceptoCompra: "Materiales de mantenimiento",
    establecimientoModificado: "001",
    puntoEmisionModificado: "002",
    numeroSecuencialModificado: "000000100",
    numeroAutorizacionSriModificado: "AUT-MOD",
  });

  assert.equal(compra.hojaOrigen, "COMPRAS");
  assert.equal(compra.documentoOrigen, "001-002-000000123");
  assert.equal(compra.identificacionTercero, "0999999999001");
  assert.equal(compra.baseGravada, 150);
  assert.equal(compra.iva, 22.5);
  assert.equal(compra.total, 185);
  assert.equal(compra.paymentEvidence?.tipoPago, "01-PAGO A RESIDENTE");
  assert.equal(compra.paymentEvidence?.formaPago1, "20");
  assert.equal(compra.paymentEvidence?.formaPago2, "01");
  assert.ok(compra.evidencias?.some((evidence) => evidence.campo === "tipoPago"));
  assert.ok(compra.evidencias?.some((evidence) => evidence.campo === "formaPago1"));
  assert.ok(compra.evidencias?.some((evidence) => evidence.campo === "formaPago2"));
  assert.equal(compra.datosRetencion?.totalRetenidoFuente, 2.63);
  assert.equal(compra.datosRetencion?.totalRetenidoIva, 3);
  assert.equal(compra.datosRetencion?.retencionesIva.map((item) => item.porcentaje).join(","), "10,20");
  assert.equal(compra.documentoModificado, "001-002-000000100");
  assert.equal(compra.autorizacionModificada, "AUT-MOD");
}

{
  const venta = adaptVenta({
    filaExcel: 14,
    codigoEstablecimiento: "002",
    noDocumento: "000000444",
    fechaEmision: "2026-04-15",
    noIdentificacion: "0911111111001",
    razonSocialCliente: "Cliente Demo",
    tipoComprobante: "18",
    baseTarifa0: "5",
    baseGravableIva1: "200",
    montoIva1: "30",
    totalDocumento: "235",
    valorRetenidoFuente: "3",
    codigoRetencionFuente: "344",
    baseImponibleRetencionFuente: "200",
    porcentajeRetencionFuente: "1.5",
    valorRetenidoIva: "6",
    fechaRetencion: "2026-04-20",
    noDocumentoRetencion: "000000009",
    noAutorizacionRetencion: "AUT-VENTA",
    conceptoVenta: "Venta de bienes",
    formaPago1: "01",
    formaPago2: "20",
  });

  assert.equal(venta.hojaOrigen, "VENTAS");
  assert.equal(venta.documentoOrigen, "002-000000444");
  assert.equal(venta.baseGravada, 200);
  assert.equal(venta.iva, 30);
  assert.equal(venta.datosRetencion?.totalRetenidoFuente, 3);
  assert.equal(venta.datosRetencion?.totalRetenidoIva, 6);
  assert.equal(venta.datosRetencion?.secuencial, "000000009");
  assert.equal(venta.collectionEvidence?.formaCobro1, "01");
  assert.equal(venta.collectionEvidence?.formaCobro2, "20");
  assert.ok(venta.evidencias?.some((evidence) => evidence.campo === "formaCobro1"));
  assert.ok(venta.evidencias?.some((evidence) => evidence.campo === "formaCobro2"));
  assert.equal(venta.evidencias?.some((evidence) => evidence.campo.includes("formaPago")), false);
}

{
  const gasto = adaptGasto({
    filaExcel: 21,
    establecimiento: "003",
    puntoEmision: "004",
    numeroSecuencial: "000000777",
    fechaEmision: 46122,
    rucProveedor: "0988888888001",
    proveedor: "Proveedor Servicios",
    tipoComprobante: "01",
    baseGravableIva1: "80",
    montoIva1: "12",
    valor: "92",
    formaPago: "01",
    concepto: "Arriendo oficina",
  });

  assert.equal(gasto.hojaOrigen, "GASTOS");
  assert.equal(gasto.documentoOrigen, "003-004-000000777");
  assert.equal(gasto.tipoOperacion, "GASTO");
  assert.equal(gasto.baseGravada, 80);
  assert.equal(gasto.iva, 12);
  assert.equal(gasto.total, 92);
  assert.equal(gasto.concepto, "Arriendo oficina");
}

assert.equal(SIN_CLASIFICACION.origen, "SIN_CLASIFICACION");
assert.equal(SIN_CLASIFICACION.requiereRevision, true);

console.log("contabilidad-domain-adapters.test.ts OK");
